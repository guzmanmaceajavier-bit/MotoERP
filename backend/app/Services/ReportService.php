<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\WorkOrder;

// reportes de ventas y deudores
class ReportService
{
    // cuanto costo lo vendido en una factura
    public function invoiceCost(Invoice $i): float
    {
        // Costo de ventas directas grabado en cada línea
        $directCost = (float) $i->items->sum('cost');
        if ($directCost > 0) {
            return round($directCost, 2);
        }

        $cost = 0;
        foreach ($i->workOrder?->items ?? [] as $woItem) {
            $product = $woItem->product;
            if ($product) {
                $cost += ($product->cost ?? 0) * $woItem->quantity;
            }
        }

        return round($cost, 2);
    }

    // reporte del periodo con comparacion al anterior
    public function period(string $from, string $to, string $compareMode): array
    {
        // Período anterior de la misma longitud para comparación
        $prevFrom = null;
        $prevTo = null;
        if ($compareMode !== 'none') {
            $span = (new \DateTimeImmutable($from))->diff(new \DateTimeImmutable($to));
            $prevFrom = (new \DateTimeImmutable($from))->sub(\DateInterval::createFromDateString('1 day'))->modify('-' . $span->days . ' days')->format('Y-m-d');
            $prevTo = (new \DateTimeImmutable($from))->sub(\DateInterval::createFromDateString('1 day'))->format('Y-m-d');
        }

        $invoices = Invoice::with('workOrder.items.product', 'items')
            ->whereBetween('issue_date', [$from, $to])
            ->get();

        $daily = $invoices
            ->groupBy(fn ($i) => $i->issue_date->toDateString())
            ->map(fn ($group) => [
                'issue_date' => $group->first()->issue_date->toDateString(),
                'total' => round($group->sum('paid_amount'), 2),
                'count' => $group->count(),
            ])
            ->values();

        $byMechanic = WorkOrder::with('mechanic')
            ->whereBetween('finished_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->whereIn('status', ['completed', 'delivered'])
            ->get()
            ->groupBy(fn ($o) => $o->mechanic?->name ?? 'Sin asignar')
            ->map(fn ($group) => [
                'mechanic' => $group->first()->mechanic?->name ?? 'Sin asignar',
                'count' => $group->count(),
                'total' => round($group->sum('quotation_total'), 2),
            ])
            ->values();

        $periodCost = $invoices->sum(fn ($i) => $this->invoiceCost($i));
        $salesTotal = round($invoices->sum('paid_amount'), 2);
        $periodProfit = round($salesTotal - $periodCost, 2);

        // Métodos de pago (usa el total facturado del período)
        $byMethod = $invoices
            ->groupBy(fn ($i) => $i->payment_method ?: 'efectivo')
            ->map(fn ($group) => [
                'method' => $group->first()->payment_method ?: 'efectivo',
                'count' => $group->count(),
                'total' => round($group->sum('paid_amount'), 2),
            ])
            ->values();

        // Top 5 productos más vendidos (ventas directas + órdenes)
        $productCounts = [];
        foreach ($invoices as $i) {
            foreach ($i->items as $line) {
                if (! $line->product_id) {
                    continue;
                }
                $key = $line->product_id;
                $productCounts[$key]['product_id'] = $line->product_id;
                $productCounts[$key]['qty'] = ($productCounts[$key]['qty'] ?? 0) + (int) $line->quantity;
                $productCounts[$key]['revenue'] = ($productCounts[$key]['revenue'] ?? 0) + (float) $line->total;
                $productCounts[$key]['cost'] = ($productCounts[$key]['cost'] ?? 0) + (float) $line->cost;
                $productCounts[$key]['name'] = $line->description ?? ('#' . $line->product_id);
            }
            foreach ($i->workOrder?->items ?? [] as $woItem) {
                $product = $woItem->product;
                if (! $product) {
                    continue;
                }
                $key = $product->id;
                $productCounts[$key]['product_id'] = $product->id;
                $productCounts[$key]['qty'] = ($productCounts[$key]['qty'] ?? 0) + (int) $woItem->quantity;
                $productCounts[$key]['revenue'] = ($productCounts[$key]['revenue'] ?? 0) + (float) ($product->final_price * $woItem->quantity);
                $productCounts[$key]['cost'] = ($productCounts[$key]['cost'] ?? 0) + (float) ($product->cost ?? 0) * $woItem->quantity;
                $productCounts[$key]['name'] = $product->name;
            }
        }
        $topProducts = collect($productCounts)
            ->map(fn ($row) => [
                'product_id' => $row['product_id'] ?? null,
                'name' => $row['name'],
                'quantity' => (int) $row['qty'],
                'revenue' => round((float) $row['revenue'], 2),
                'profit' => round((float) $row['revenue'] - (float) $row['cost'], 2),
            ])
            ->sortByDesc('quantity')
            ->take(5)
            ->values();

        // Cuentas por cobrar abiertas (fuera del período, pendientes hoy)
        $outstanding = round((float) Invoice::whereIn('status', ['pending', 'partial'])
            ->get()
            ->sum(fn ($i) => max(0, (float) $i->total - (float) $i->paid_amount)), 2);

        // Comparación con período anterior
        $prevSales = 0;
        $prevProfit = 0;
        $salesDelta = null;
        $profitDelta = null;
        if ($prevFrom && $prevTo) {
            $prevInvoices = Invoice::whereBetween('issue_date', [$prevFrom, $prevTo])->get();
            $prevSales = round($prevInvoices->sum('paid_amount'), 2);
            $prevCost = $prevInvoices->sum(fn ($i) => $this->invoiceCost($i));
            $prevProfit = round($prevSales - $prevCost, 2);
            $salesDelta = $prevSales > 0 ? round(($salesTotal - $prevSales) / $prevSales * 100, 1) : null;
            $profitDelta = $prevProfit > 0 ? round(($periodProfit - $prevProfit) / $prevProfit * 100, 1) : null;
        }

        return [
            'period' => ['from' => $from, 'to' => $to],
            'total_sales' => $salesTotal,
            'invoice_count' => $invoices->count(),
            'cost' => $periodCost,
            'profit' => $periodProfit,
            'outstanding' => $outstanding,
            'compare' => [
                'prev_from' => $prevFrom,
                'prev_to' => $prevTo,
                'sales' => $prevSales,
                'profit' => $prevProfit,
                'sales_delta' => $salesDelta,
                'profit_delta' => $profitDelta,
            ],
            'daily' => $daily,
            'by_method' => $byMethod,
            'by_mechanic' => $byMechanic,
            'top_products' => $topProducts,
        ];
    }

    // los que deben plata, agrupados por cliente
    public function debtors(string $q): array
    {
        $invoices = Invoice::with('user', 'payments')
            ->whereIn('status', ['partial', 'unpaid'])
            ->whereColumn('paid_amount', '<', 'total')
            ->when($q, function ($query) use ($q) {
                $query->whereHas('user', fn ($u) => $u->where('name', 'like', "%{$q}%"));
            })
            ->orderByDesc('issue_date')
            ->get();

        $grouped = $invoices->groupBy('user_id')->map(function ($group, $userId) {
            $user = $group->first()->user;
            $debt = (float) $group->sum('outstanding');

            return [
                'user_id' => $userId,
                'customer' => $user?->name ?? 'Sin cliente',
                'phone' => $user?->phone,
                'total_debt' => round($debt, 2),
                'invoices' => $group->map(fn ($i) => [
                    'id' => $i->id,
                    'invoice_number' => $i->invoice_number,
                    'total' => (float) $i->total,
                    'paid_amount' => (float) $i->paid_amount,
                    'outstanding' => (float) $i->outstanding,
                    'issue_date' => $i->issue_date?->toDateString(),
                    'status' => $i->status,
                ])->values(),
            ];
        })->values();

        return [
            'debtors' => $grouped,
            'total_debt' => round($invoices->sum('outstanding'), 2),
        ];
    }
}
