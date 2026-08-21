<?php

namespace App\Services;

use App\Models\QuotationVersion;
use App\Models\User;
use App\Models\WorkOrder;

/**
 * Gestión y versionado de cotizaciones.
 *
 * Cada vez que se envía o se modifica una cotización se crea una nueva versión
 * (snapshot) con items, cantidades, precios y costos internos congelados.
 * La versión aprobada queda inmutable a historial.
 */
class QuotationService
{
    /** Atribuye la siguiente versión y persiste el snapshot actual de la orden. */
    public function snapshot(WorkOrder $order, string $status, ?string $reason = null, ?User $actor = null, ?float $taxRate = null): QuotationVersion
    {
        $order->load(['items', 'labors']);

        $partsTotal = (float) $order->items->sum(fn ($i) => $i->quantity * $i->unit_price);
        $laborTotal = (float) $order->labors->sum('amount');
        $subtotal = $partsTotal + $laborTotal;

        $rate = $taxRate ?? (float) (\App\Support\Settings::get('tax_rate') ?? 18);
        $discount = 0.0;
        $taxable = max(0, $subtotal - $discount);
        $tax = round($taxable * ($rate / 100), 2);
        $total = round($taxable + $tax, 2);

        $version = (int) QuotationVersion::where('work_order_id', $order->id)->max('version');
        $version++;

        return QuotationVersion::create([
            'work_order_id' => $order->id,
            'version' => $version,
            'status' => $status,
            'parts_total' => $partsTotal,
            'labor_total' => $laborTotal,
            'subtotal' => $subtotal,
            'tax_rate' => $rate,
            'tax' => $tax,
            'discount' => $discount,
            'total' => $total,
            'items' => $order->items->map(function ($i) {
                $cost = null;
                if ($i->product_id) {
                    $product = \App\Models\Product::find($i->product_id);
                    $cost = $product ? round((float) $product->cost * $i->quantity, 2) : null;
                }

                return [
                    'product_id' => $i->product_id,
                    'description' => $i->description,
                    'quantity' => $i->quantity,
                    'unit_price' => (float) $i->unit_price,
                    'cost' => $cost,
                    'total' => round($i->quantity * $i->unit_price, 2),
                ];
            })->values()->all(),
            'labors' => $order->labors->map(function ($l) {
                return [
                    'description' => $l->description,
                    'hours' => (float) $l->hours,
                    'hourly_rate' => $l->hours > 0 ? round((float) $l->amount / $l->hours, 2) : 0,
                    'amount' => (float) $l->amount,
                ];
            })->values()->all(),
            'reason' => $reason,
            'created_by' => $actor?->id,
        ]);
    }

    /** Marca la última versión como aprobada (queda congelada). */
    public function markLatest(WorkOrder $order, string $status, ?string $reason = null): void
    {
        $latest = QuotationVersion::where('work_order_id', $order->id)
            ->orderByDesc('version')
            ->first();

        if ($latest) {
            $latest->update(['status' => $status, 'reason' => $reason ?? $latest->reason]);
        }
    }

    public function versionsFor(WorkOrder $order)
    {
        return QuotationVersion::where('work_order_id', $order->id)
            ->orderBy('version')
            ->get();
    }
}