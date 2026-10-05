<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;

// ventas de mostrador (POS)
class SaleService
{
    // todas las facturas con totales
    public function list(array $filters, int $page, int $perPage): array
    {
        $query = Invoice::with(['user', 'items', 'workOrder.items.product']);

        if (! empty($filters['from'])) {
            $query->whereDate('issue_date', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->whereDate('issue_date', '<=', $filters['to']);
        }
        if (! empty($filters['payment_method'])) {
            $query->where('payment_method', $filters['payment_method']);
        }

        $query->orderByDesc('issue_date')->orderByDesc('id');

        $allInvoices = $query->get();

        $total = $allInvoices->sum('total');
        $count = $allInvoices->count();
        $totalCost = $allInvoices->sum(fn ($i) => app(ReportService::class)->invoiceCost($i));
        $totalProfit = round($allInvoices->sum('paid_amount') - $totalCost, 2);

        $pageInvoices = $allInvoices->forPage($page, $perPage)->values();

        return [
            'total' => (float) $total,
            'count' => $count,
            'cost' => $totalCost,
            'profit' => $totalProfit,
            'data' => $pageInvoices->map(fn ($i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'customer' => $i->customer_name ?: ($i->user?->name ?? 'Sin cliente'),
                'order_number' => $i->workOrder?->order_number ?? (str_starts_with($i->invoice_number, 'INV-') ? $i->invoice_number : null),
                'subtotal' => (float) $i->subtotal,
                'discount' => (float) $i->discount,
                'total' => (float) $i->total,
                'paid_amount' => (float) $i->paid_amount,
                'outstanding' => (float) $i->outstanding,
                'cost' => app(ReportService::class)->invoiceCost($i),
                'profit' => round((float) $i->paid_amount - app(ReportService::class)->invoiceCost($i), 2),
                'payment_method' => $i->payment_method,
                'status' => $i->status,
                'issue_date' => $i->issue_date?->toDateString(),
            ]),
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'last_page' => (int) ceil($count / $perPage),
                'total' => $count,
            ],
        ];
    }

    // buscar clientes para el POS
    public function clients(string $q)
    {
        $query = User::where('role', 'customer');

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('name', 'ilike', "%{$q}%")
                    ->orWhere('email', 'ilike', "%{$q}%")
                    ->orWhere('phone', 'ilike', "%{$q}%");
            });
        }

        return $query->orderBy('name')->limit(15)->get([
            'id', 'name', 'email', 'phone', 'points_balance',
        ]);
    }

    // guarda la venta: cliente, precios reales, quita stock y deja el pago
    // si no hay stock tira RuntimeException y el controlador devuelve 422
    public function store(array $validated, int $actorId, float $taxRate): Invoice
    {
        return DB::transaction(function () use ($validated, $actorId, $taxRate) {
            // Resolver o crear cliente
            if (! empty($validated['client_id'])) {
                $client = User::findOrFail($validated['client_id']);
            } else {
                $identity = [
                    'name' => \App\Support\Input::clean($validated['client_name']),
                    'email' => \App\Support\Input::clean($validated['client_email'] ?? null),
                    'phone' => \App\Support\Input::clean($validated['client_phone'] ?? null),
                    'role' => 'customer',
                    'password' => bcrypt(\Illuminate\Support\Str::random(40)),
                ];
                $client = empty($identity['email'])
                    ? User::create($identity)
                    : User::firstOrCreate(['email' => $identity['email']], $identity);
            }

            // Reconstruir items con precio/costo reales (no confiar en el cliente)
            $inventory = app(InventoryService::class);
            $subtotal = 0;
            $lines = [];
            foreach ($validated['items'] as $line) {
                $product = \App\Models\Product::with('inventory')->where('is_active', true)->findOrFail($line['product_id']);
                $inventory->assertAvailable($line['product_id'], $line['quantity']);
                $price = (float) $product->final_price;
                $total = round($price * $line['quantity'], 2);
                $subtotal += $total;
                $lines[] = ['product' => $product, 'quantity' => $line['quantity'], 'unit_price' => $price, 'total' => $total];
            }

            $discount = (float) ($validated['discount'] ?? 0);
            $discount = min($discount, $subtotal);
            $taxable = $subtotal - $discount;
            $tax = round($taxable * ($taxRate / 100), 2);
            $total = round($taxable + $tax, 2);

            $invoice = Invoice::create([
                'invoice_number' => app(InvoiceService::class)->generateInvoiceNumber(),
                'user_id' => $client->id,
                'customer_name' => $client->name,
                'customer_email' => $client->email,
                'customer_phone' => $client->phone,
                'subtotal' => $subtotal,
                'tax' => $tax,
                'tax_rate' => $taxRate,
                'discount' => $discount,
                'total' => $total,
                'paid_amount' => $total,
                'payment_method' => $validated['payment_method'] ?? 'efectivo',
                'status' => 'paid',
                'issue_date' => now(),
            ]);

            foreach ($lines as $l) {
                $invoice->items()->create([
                    'description' => $l['product']->name,
                    'quantity' => $l['quantity'],
                    'unit_price' => $l['unit_price'],
                    'cost' => (float) ($l['product']->cost ?? 0) * $l['quantity'],
                    'total' => $l['total'],
                ]);

                $inventory->sell($l['product']->id, $l['quantity'], [
                    'invoice_id' => $invoice->id,
                    'reference' => $invoice->invoice_number,
                    'user_id' => $actorId,
                    'note' => 'Venta mostrador',
                ]);
            }

            // Registrar abono (pago total)
            $invoice->payments()->create([
                'user_id' => $client->id,
                'amount' => $total,
                'method' => $validated['payment_method'] ?? 'efectivo',
                'reference' => $validated['notes'] ?? null,
                'paid_at' => now(),
                'recorded_by' => $actorId,
            ]);

            return $invoice;
        });
    }

    // cambia metodo o estado de pago de una venta
    public function update(Invoice $invoice, array $validated): array
    {
        $data = [];
        if (isset($validated['payment_method'])) {
            $data['payment_method'] = $validated['payment_method'];
        }
        if (isset($validated['status'])) {
            $data['status'] = $validated['status'];
            if ($validated['status'] === 'paid') {
                $data['paid_amount'] = $invoice->total;
            } elseif ($validated['status'] === 'pending') {
                $data['paid_amount'] = 0;
            }
        }
        if (isset($validated['paid_amount'])) {
            $data['paid_amount'] = min((float) $validated['paid_amount'], (float) $invoice->total);
            $data['status'] = (float) $data['paid_amount'] >= (float) $invoice->total ? 'paid' : ((float) $data['paid_amount'] > 0 ? 'partial' : 'pending');
        }

        if (! empty($data)) {
            $invoice->update($data);
        }

        return [
            'invoice_number' => $invoice->invoice_number,
            'total' => (float) $invoice->total,
            'paid_amount' => (float) $invoice->paid_amount,
            'status' => $invoice->status,
            'payment_method' => $invoice->payment_method,
        ];
    }

    // anula la venta y devuelve el stock
    public function destroy(Invoice $invoice, int $actorId): void
    {
        DB::transaction(function () use ($invoice, $actorId) {
            $inventory = app(InventoryService::class);
            foreach ($invoice->items as $line) {
                if ($line->product_id) {
                    $inventory->add($line->product_id, (int) $line->quantity, [
                        'invoice_id' => $invoice->id,
                        'reference' => $invoice->invoice_number,
                        'user_id' => $actorId,
                        'note' => 'Devolución por venta anulada',
                    ]);
                }
            }
            $invoice->items()->delete();
            $invoice->payments()->delete();
            $invoice->delete();
        });
    }
}
