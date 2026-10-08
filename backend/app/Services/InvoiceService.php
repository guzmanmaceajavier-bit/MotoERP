<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    public function generateInvoiceNumber(): string
    {
        do {
            $number = 'INV-' . date('Y') . '-' . strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ'), 0, 3)) . '-' . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        } while (Invoice::where('invoice_number', $number)->exists());

        return $number;
    }

    public function allowedTransitions(): array
    {
        return [
            'pending' => ['payment_review', 'confirmed', 'cancelled'],
            'payment_review' => ['confirmed', 'cancelled'],
            'confirmed' => ['shipped', 'delivered'],
            'shipped' => ['delivered'],
            'delivered' => [],
            'cancelled' => [],
        ];
    }

    public function calculateOrderTotals(WorkOrder $order, array $validated): array
    {
        $partsTotal = (float) $order->items->sum(fn ($i) => $i->quantity * $i->unit_price);
        $laborTotal = (float) $order->labors->sum('amount');
        $subtotal = $partsTotal + $laborTotal;

        $pointsValue = app(LoyaltyService::class)->pointsValue();
        $taxRate = (float) (\App\Support\Settings::get('tax_rate') ?? 18);

        $manualPercent = (float) ($validated['discount'] ?? 0);
        $manualDiscount = round($subtotal * ($manualPercent / 100), 2);

        $requestedPaid = (float) ($validated['amount_paid'] ?? ($subtotal - $manualDiscount));
        $fullPayment = $requestedPaid >= ($subtotal - $manualDiscount);

        $pointsToUse = 0;
        $pointsDiscount = 0;
        $discount = $manualDiscount;

        if ($fullPayment) {
            $availablePoints = (int) $order->user->points_balance;
            $pointsToUse = (int) ($validated['points_to_use'] ?? 0);
            $pointsToUse = min($pointsToUse, $availablePoints);
            $maxPoints = (int) floor(($subtotal - $manualDiscount) / $pointsValue);
            $pointsToUse = min($pointsToUse, $maxPoints);
            $pointsDiscount = $pointsToUse * $pointsValue;
            $discount = round($manualDiscount + $pointsDiscount, 2);
        }

        $taxable = max(0, $subtotal - $discount);
        $tax = round($taxable * ($taxRate / 100), 2);
        $total = round($taxable + $tax, 2);

        $paidAmount = max(0, min($requestedPaid, $total));
        $status = $paidAmount >= $total ? 'paid' : ($paidAmount > 0 ? 'partial' : 'unpaid');

        return compact(
            'subtotal', 'discount', 'pointsToUse', 'taxRate', 'tax',
            'total', 'paidAmount', 'status', 'requestedPaid'
        );
    }

    public function createFromOrder(WorkOrder $order, array $validated, int $actorId): Invoice
    {
        $t = $this->calculateOrderTotals($order, $validated);
        $payments = app(PaymentService::class);
        $loyalty = app(LoyaltyService::class);

        return DB::transaction(function () use ($order, $validated, $actorId, $t, $payments, $loyalty) {
            $invoice = Invoice::create([
                'invoice_number' => $this->generateInvoiceNumber(),
                'work_order_id' => $order->id,
                'user_id' => $order->user_id,
                'subtotal' => $t['subtotal'],
                'tax' => $t['tax'],
                'tax_rate' => $t['taxRate'],
                'total' => $t['total'],
                'paid_amount' => $t['paidAmount'],
                'discount' => $t['discount'],
                'points_used' => $t['pointsToUse'],
                'payment_method' => $validated['payment_method'] ?? 'efectivo',
                'status' => $t['status'],
                'issue_date' => now(),
            ]);

            if ($t['paidAmount'] > 0) {
                $invoice->payments()->create([
                    'user_id' => $order->user_id,
                    'amount' => $t['paidAmount'],
                    'method' => $validated['payment_method'] ?? 'efectivo',
                    'paid_at' => now(),
                    'recorded_by' => $actorId,
                    'receipt_number' => $payments->nextReceiptNumber(),
                    'notes' => 'Pago inicial al facturar',
                ]);
            }

            $stock = app(\App\Services\InventoryService::class);
            foreach ($order->items as $item) {
                $invoice->items()->create([
                    'description' => $item->description,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'total' => round($item->quantity * $item->unit_price, 2),
                ]);

                if ($item->product_id) {
                    $stock->consumeReserved($item->product_id, $item->quantity, [
                        'order_id' => $order->id,
                        'invoice_id' => $invoice->id,
                        'reference' => $invoice->invoice_number,
                        'user_id' => $actorId,
                        'note' => 'Consumo de stock facturado',
                    ]);
                }
            }
            foreach ($order->labors as $labor) {
                $invoice->items()->create([
                    'description' => $labor->description . ' (mano de obra)',
                    'quantity' => 1,
                    'unit_price' => $labor->amount,
                    'total' => round($labor->amount, 2),
                ]);
            }

            if ($t['status'] === 'paid') {
                if ($t['pointsToUse'] > 0) {
                    $loyalty->spend($order->user, $t['pointsToUse'], "Canje por descuento en {$invoice->invoice_number}");
                }
                $loyalty->award($order->user, $loyalty->earnedForTotal($t['total']), "Compra {$invoice->invoice_number}");
            }

            return $invoice;
        });
    }

    public function transitionShopOrder(Invoice $invoice, string $to): void
    {
        DB::transaction(function () use ($invoice, $to) {
            $invoice->update(['order_status' => $to]);
            if ($to === 'confirmed') {
                app(PaymentService::class)->consumeReservedFor($invoice);
                if ($invoice->payment_method !== 'efectivo' && $invoice->user && ! $invoice->paid_amount) {
                    $invoice->update(['paid_amount' => (float) $invoice->total, 'status' => 'paid']);
                }
                if ($invoice->user && (int) $invoice->points_used > 0) {
                    app(LoyaltyService::class)->spend(
                        $invoice->user,
                        (int) $invoice->points_used,
                        "Canje por descuento en {$invoice->invoice_number}"
                    );
                }
            }
            if ($to === 'cancelled') {
                app(PaymentService::class)->releaseReservedFor($invoice);
                $invoice->update(['status' => 'cancelled']);
            }
        });

        $messages = [
            'confirmed' => ['Pedido confirmado', "Tu pedido {$invoice->invoice_number} fue confirmado y está en preparación.", 'success'],
            'shipped' => ['Pedido enviado', "Tu pedido {$invoice->invoice_number} fue enviado y va en camino.", 'info'],
            'delivered' => ['Pedido entregado', "Tu pedido {$invoice->invoice_number} fue entregado. ¡Gracias por tu compra!", 'success'],
            'cancelled' => ['Pedido cancelado', "Tu pedido {$invoice->invoice_number} fue cancelado.", 'danger'],
            'payment_review' => ['Comprobante en revisión', "Tu comprobante del pedido {$invoice->invoice_number} está en revisión.", 'info'],
        ];

        if (isset($messages[$to]) && $invoice->user) {
            app(NotificationService::class)->notify(
                $invoice->user,
                $messages[$to][0],
                $messages[$to][1],
                $messages[$to][2],
                ['channel' => 'order']
            );
        }
    }

    public function cancelShopOrder(Invoice $invoice): void
    {
        DB::transaction(function () use ($invoice) {
            app(PaymentService::class)->releaseReservedFor($invoice);
            if ((int) $invoice->points_used > 0 && $invoice->user) {
                app(LoyaltyService::class)->award(
                    $invoice->user,
                    (int) $invoice->points_used,
                    "Devolución por cancelación {$invoice->invoice_number}"
                );
            }
            $invoice->update(['order_status' => 'cancelled', 'status' => 'cancelled']);
        });
    }
}
