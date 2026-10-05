<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// arma el json de la factura para la api
class InvoiceSerializer
{
    public function serialize(Invoice $i, bool $withItems = false, array $itemImages = [], bool $isAdmin = false): array
    {
        $data = [
            'id' => $i->id,
            'invoice_number' => $i->invoice_number,
            'source' => $i->work_order_id ? 'service' : 'store',
            'customer_name' => $i->customer_name ?? $i->user?->name,
            'customer_email' => $i->customer_email ?? $i->user?->email,
            'customer_phone' => $i->customer_phone ?? $i->user?->phone,
            'shipping_address' => $i->shipping_address,
            'subtotal' => (float) $i->subtotal,
            'tax' => (float) $i->tax,
            'tax_rate' => (float) ($i->tax_rate ?? 0),
            'discount' => (float) $i->discount,
            'profit' => $isAdmin ? $this->profit($i) : null,
            'points_used' => (int) $i->points_used,
            'total' => (float) $i->total,
            'paid_amount' => (float) $i->paid_amount,
            'outstanding' => (float) $i->outstanding,
            'payment_method' => $i->payment_method,
            'status' => $i->status,
            'order_status' => $i->order_status ?? ($i->work_order_id ? null : 'pending'),
            'payment_proof_url' => $i->payment_proof_path ? \Storage::disk('public')->url($i->payment_proof_path) : null,
            'invoice_pdf_url' => $i->invoice_pdf_path ? \Storage::disk('public')->url($i->invoice_pdf_path) : null,
            'issue_date' => $i->issue_date?->toDateString(),
        ];

        if ($withItems) {
            $rows = $i->items->map(fn ($it) => [
                'product_id' => $it->product_id,
                'description' => $it->description,
                'variant' => $it->variant,
                'quantity' => $it->quantity,
                'unit_price' => (float) $it->unit_price,
                'total' => (float) $it->total,
                'image' => $itemImages[mb_strtolower(trim((string) $it->description))] ?? null,
            ]);

            $data['items'] = $rows;
            $data['items_count'] = $rows->count();
            $data['thumbnail'] = $rows->firstWhere(fn ($r) => ! empty($r['image']))['image'] ?? null;
            $data['warranties'] = $i->workOrder?->warranties
                ->map(fn ($w) => [
                    'id' => $w->id,
                    'description' => $w->description,
                    'type' => $w->type,
                    'duration' => $w->duration,
                    'start_date' => $w->start_date?->toDateString(),
                    'end_date' => $w->end_date?->toDateString(),
                    'status' => $w->status,
                ])
                ->values()
                ->all() ?? [];
            $data['payments'] = $i->payments->map(fn ($p) => [
                'id' => $p->id,
                'amount' => (float) $p->amount,
                'method' => $p->method,
                'paid_at' => $p->paid_at?->toDateTimeString(),
                'reference' => $p->reference,
                'receipt_number' => $p->receipt_number,
                'notes' => $p->notes,
            ])->values()->all();
        }

        return $data;
    }

    // busca la foto de cada producto por el nombre (los items guardan la descripcion al vender)
    public function itemImages(Collection $invoices): array
    {
        $names = $invoices
            ->flatMap(fn ($i) => $i->items->pluck('description'))
            ->map(fn ($d) => mb_strtolower(trim((string) $d)))
            ->unique()
            ->filter()
            ->values();

        if ($names->isEmpty()) {
            return [];
        }

        return Product::whereIn(DB::raw('LOWER(TRIM(name))'), $names)
            ->get(['name', 'image'])
            ->mapWithKeys(fn ($p) => [mb_strtolower(trim($p->name)) => $p->image])
            ->filter()
            ->all();
    }

    // lo que se gano: lo cobrado menos lo que costaron los repuestos
    public function profit(Invoice $i): float
    {
        return round((float) $i->paid_amount - $this->costOfSold($i), 2);
    }

    public function costOfSold($i): float
    {
        $cost = 0;
        foreach ($i->items ?? [] as $it) {
            if ((float) $it->cost > 0) {
                $cost += (float) $it->cost;
            }
        }
        if ($cost > 0) {
            return round($cost, 2);
        }

        foreach ($i->workOrder?->items ?? [] as $woItem) {
            $product = $woItem->product;
            if ($product) {
                $cost += ($product->cost ?? 0) * $woItem->quantity;
            }
        }

        return round($cost, 2);
    }
}
