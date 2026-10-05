<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\StockMovement;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// pagos y abonos de facturas, y lo del stock reservado de tienda
class PaymentService
{
    public function nextReceiptNumber(): string
    {
        $count = \App\Models\Payment::count() + 1;

        return 'RECV-' . now()->format('Ymd') . '-' . str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }

    // registra un abono, si se completa da puntos y si es pedido de tienda lo confirma
    public function register(Invoice $invoice, array $validated, int $actorId): Invoice
    {
        $wasPaid = $invoice->status === 'paid';

        DB::transaction(function () use ($invoice, $validated, $actorId, $wasPaid) {
            $invoice->payments()->create([
                'user_id' => $invoice->user_id,
                'amount' => $validated['amount'],
                'method' => $validated['method'],
                'paid_at' => now(),
                'reference' => $validated['reference'] ?? null,
                'receipt_number' => $this->nextReceiptNumber(),
                'notes' => $validated['notes'] ?? null,
                'recorded_by' => $actorId,
            ]);

            $paid = round((float) $invoice->paid_amount + (float) $validated['amount'], 2);
            $status = $paid >= (float) $invoice->total ? 'paid' : 'partial';
            $invoice->update(['paid_amount' => $paid, 'status' => $status]);

            if ($status === 'paid' && ! $wasPaid) {
                if ($invoice->user) {
                    app(LoyaltyService::class)->award(
                        $invoice->user,
                        app(LoyaltyService::class)->earnedForTotal((float) $invoice->total),
                        "Pago completo {$invoice->invoice_number}"
                    );
                }

                // Pedido de tienda: confirmar pedido + consumir la reserva de stock
                if (! $invoice->work_order_id && $invoice->order_status !== 'confirmed') {
                    $invoice->update(['order_status' => 'confirmed']);
                    $this->consumeReservedFor($invoice);
                    if ($invoice->user && (int) $invoice->points_used > 0) {
                        app(LoyaltyService::class)->spend(
                            $invoice->user,
                            (int) $invoice->points_used,
                            "Canje por descuento en {$invoice->invoice_number}"
                        );
                    }
                }
            }
        });

        return $invoice->fresh()->load('payments', 'items');
    }

    // recalcula lo pagado y el estado desde los pagos (cuando se edita o borra uno)
    public function recompute(Invoice $invoice): Invoice
    {
        $paid = round((float) $invoice->payments()->sum('amount'), 2);
        $status = $paid >= (float) $invoice->total ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');
        $invoice->update(['paid_amount' => $paid, 'status' => $status]);

        return $invoice->fresh()->load('payments', 'items');
    }

    // historial de pagos listo para devolver en la api
    public function history(Invoice $invoice): Collection
    {
        return $invoice->payments()->with('recorder')->orderByDesc('paid_at')->get()->map(fn ($p) => [
            'id' => $p->id,
            'amount' => (float) $p->amount,
            'method' => $p->method,
            'paid_at' => $p->paid_at?->toDateTimeString(),
            'reference' => $p->reference,
            'receipt_number' => $p->receipt_number,
            'notes' => $p->notes,
            'recorded_by' => $p->recorder?->name,
        ]);
    }

    // aparta el stock cuando se aprueba una cotizacion (solo reserved, el fisico baja al facturar)
    public function reserveForOrder(\App\Models\WorkOrder $order, int $userId): void
    {
        $stock = app(InventoryService::class);
        foreach ($order->items as $item) {
            if (! $item->product_id) {
                continue;
            }
            $stock->reserve($item->product_id, $item->quantity, [
                'order_id' => $order->id,
                'reference' => $order->order_number,
                'user_id' => $userId,
                'note' => 'Reserva por aprobación de cotización',
            ]);
        }
    }

    // suelta la reserva (cuando rechazan o cancelan)
    public function releaseForOrder(\App\Models\WorkOrder $order, int $userId): void
    {
        $stock = app(InventoryService::class);
        foreach ($order->items as $item) {
            if (! $item->product_id) {
                continue;
            }
            $stock->release($item->product_id, $item->quantity, [
                'order_id' => $order->id,
                'reference' => $order->order_number,
                'user_id' => $userId,
                'note' => 'Liberación de reserva',
            ]);
        }
    }

    // vende lo que estaba reservado para una factura confirmada
    public function consumeReservedFor(Invoice $invoice): void
    {
        $stock = app(InventoryService::class);
        foreach (StockMovement::where('type', 'reserve')->where('invoice_id', $invoice->id)->get() as $m) {
            $stock->consumeReserved($m->product_id, $m->quantity, [
                'invoice_id' => $invoice->id,
                'reference' => $invoice->invoice_number,
                'user_id' => $invoice->user_id,
                'note' => 'Confirmación pedido',
            ]);
        }
    }

    // libera lo reservado de un pedido cancelado
    public function releaseReservedFor(Invoice $invoice): void
    {
        $stock = app(InventoryService::class);
        foreach (StockMovement::where('type', 'reserve')->where('invoice_id', $invoice->id)->get() as $m) {
            $stock->release($m->product_id, $m->quantity, [
                'invoice_id' => $invoice->id,
                'reference' => $invoice->invoice_number,
                'user_id' => $invoice->user_id,
                'note' => 'Cancelación pedido',
            ]);
        }
    }
}
