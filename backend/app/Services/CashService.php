<?php

namespace App\Services;

use App\Models\CashSession;
use App\Models\Payment;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CashService
{
    public function overview(int $page, int $perPage): array
    {
        $open = CashSession::with('user')->where('status', 'open')->get()
            ->map(function (CashSession $s) {
                $cashByMethod = Payment::where('paid_at', '>=', $s->opened_at)
                    ->select('method', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
                    ->groupBy('method')
                    ->get()
                    ->keyBy('method')
                    ->map(fn ($r) => ['total' => (float) $r->total, 'count' => (int) $r->count]);

                return [
                    'id' => $s->id,
                    'user' => $s->user,
                    'user_id' => $s->user_id,
                    'opening_amount' => (float) $s->opening_amount,
                    'opened_at' => $s->opened_at?->toDateTimeString(),
                    'status' => $s->status,
                    'notes' => $s->notes,
                    'expected_efectivo' => round((float) $s->opening_amount + (float) ($cashByMethod['efectivo']['total'] ?? 0), 2),
                    'cash_by_method' => $cashByMethod,
                ];
            })
            ->values();

        $historyQ = CashSession::with('user')->orderByDesc('opened_at');
        $total = (clone $historyQ)->toBase()->getCountForPagination();
        $rows = $historyQ->forPage($page, $perPage)->get();
        $history = [
            'data' => $rows->map(fn (CashSession $s) => [
                'id' => $s->id,
                'user' => $s->user,
                'user_id' => $s->user_id,
                'opening_amount' => (float) $s->opening_amount,
                'closing_amount' => $s->closing_amount !== null ? (float) $s->closing_amount : null,
                'expected_amount' => $s->expected_amount !== null ? (float) $s->expected_amount : null,
                'opened_at' => $s->opened_at?->toDateTimeString(),
                'closed_at' => $s->closed_at?->toDateTimeString(),
                'status' => $s->status,
                'notes' => $s->notes,
            ])->values(),
            'meta' => $this->meta($page, $perPage, $total),
        ];

        $todayStart = now()->startOfDay()->toDateTimeString();
        $byMethodToday = Payment::where('paid_at', '>=', $todayStart)
            ->select('method', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('method')
            ->get()
            ->keyBy('method')
            ->map(fn ($r) => ['total' => (float) $r->total, 'count' => (int) $r->count]);

        return [
            'open' => $open,
            'history' => $history,
            'summary' => [
                'today_by_method' => $byMethodToday,
                'today_total' => round((float) $byMethodToday->sum('total'), 2),
            ],
        ];
    }

    public function payments(array $filters, int $page, int $perPage): array
    {
        $query = Payment::with(['invoice', 'recorder'])->orderByDesc('paid_at');

        if ($q = trim((string) ($filters['q'] ?? ''))) {
            $query->where(function ($sub) use ($q) {
                $sub->whereHas('invoice', function ($i) use ($q) {
                    $i->where('invoice_number', 'like', "%{$q}%")
                        ->orWhere('customer_name', 'like', "%{$q}%")
                        ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$q}%"));
                });
            });
        }

        if (! empty($filters['method'])) {
            $query->where('method', $filters['method']);
        }

        if (! empty($filters['from'])) {
            $query->where('paid_at', '>=', $filters['from'] . ' 00:00:00');
        }

        if (! empty($filters['to'])) {
            $query->where('paid_at', '<=', $filters['to'] . ' 23:59:59');
        }

        $items = $query->get()->map(fn (Payment $p) => [
            'id' => $p->id,
            'invoice_number' => $p->invoice?->invoice_number,
            'customer' => $p->invoice?->user?->name ?? $p->invoice?->customer_name ?? 'Sin cliente',
            'amount' => (float) $p->amount,
            'method' => $p->method,
            'paid_at' => $p->paid_at?->toDateTimeString(),
            'reference' => $p->reference,
            'receipt_number' => $p->receipt_number,
            'notes' => $p->notes,
            'recorded_by' => $p->recorder?->name,
        ]);

        $total = $items->count();

        return [
            'data' => $items->forPage($page, $perPage)->values(),
            'meta' => $this->meta($page, $perPage, $total),
        ];
    }

    public function updatePayment(Payment $payment, array $validated): void
    {
        $invoice = $payment->invoice;

        DB::transaction(function () use ($payment, $invoice, $validated) {
            $amount = $validated['amount'] ?? $payment->amount;
            if ($invoice) {
                $otherPaid = (float) $invoice->payments()
                    ->where('id', '!=', $payment->id)
                    ->sum('amount');
                if ($otherPaid + (float) $amount - (float) $invoice->total > 0.01) {
                    throw new \RuntimeException('El nuevo monto supera el total de la factura.');
                }
            }

            $payment->update([
                'amount' => $amount,
                'method' => $validated['method'] ?? $payment->method,
                'reference' => $validated['reference'] ?? $payment->reference,
                'notes' => $validated['notes'] ?? $payment->notes,
            ]);

            if ($invoice) {
                app(PaymentService::class)->recompute($invoice);
            }
        });
    }

    public function deletePayment(Payment $payment): string
    {
        $invoice = $payment->invoice;
        $label = $payment->invoice?->invoice_number ?? 'pago';

        DB::transaction(function () use ($payment, $invoice) {
            $payment->delete();
            if ($invoice) {
                app(PaymentService::class)->recompute($invoice);
            }
        });

        return $label;
    }

    public function open(int $userId, array $validated): ?CashSession
    {
        if (CashSession::where('status', 'open')->exists()) {
            return null;
        }

        return CashSession::create([
            'user_id' => $userId,
            'opening_amount' => $validated['opening_amount'] ?? 0,
            'opened_at' => now(),
            'status' => 'open',
            'notes' => $validated['notes'] ?? null,
        ]);
    }

    public function close(CashSession $session, array $validated): array
    {
        $cashIn = Payment::where('method', 'efectivo')
            ->where('paid_at', '>=', $session->opened_at)
            ->sum('amount');

        $byMethod = Payment::where('paid_at', '>=', $session->opened_at)
            ->select('method', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('method')
            ->get()
            ->keyBy('method')
            ->map(fn ($r) => ['total' => (float) $r->total, 'count' => (int) $r->count]);

        $expected = (float) $session->opening_amount + (float) $cashIn;

        $session->update([
            'closing_amount' => $validated['closing_amount'],
            'expected_amount' => $expected,
            'closed_at' => now(),
            'status' => 'closed',
            'notes' => $validated['notes'] ?? $session->notes,
        ]);

        return [
            'session' => $session->fresh(),
            'expected_efectivo' => $expected,
            'cash_received' => (float) $cashIn,
            'by_method' => $byMethod,
            'difference' => round((float) $validated['closing_amount'] - $expected, 2),
        ];
    }

    private function meta(int $page, int $perPage, int $total): array
    {
        $lastPage = $perPage > 0 ? (int) ceil($total / $perPage) : 0;

        return [
            'current_page' => $page,
            'per_page' => $perPage,
            'last_page' => $lastPage,
            'total' => $total,
            'has_more' => $page < $lastPage,
        ];
    }
}
