<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\Motorcycle;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;

// numeros del dashboard del admin
class DashboardService
{
    public function overview(string $period): array
    {
        return [
            'orders_total' => WorkOrder::count(),
            'orders_pending' => WorkOrder::where('status', 'pending')->count(),
            'orders_in_progress' => WorkOrder::where('status', 'in_progress')->count(),
            'orders_awaiting_approval' => WorkOrder::where('quotation_status', 'awaiting_approval')->count(),
            'customers' => User::where('role', 'customer')->count(),
            'motorcycles' => Motorcycle::count(),
            'products' => Product::count(),
            'appointments_pending' => Appointment::where('status', 'pending')->count(),
            'stock_low' => DB::table('inventory')
                ->whereColumn('quantity', '<=', 'min_stock')
                ->count(),
            'invoices_this_month' => Invoice::whereMonth('issue_date', now()->month)
                ->whereYear('issue_date', now()->year)
                ->get()
                ->sum('total'),
            'profit_this_month' => $this->monthProfit(),
            'store_orders_pending' => Invoice::whereNull('work_order_id')
                ->where('order_status', 'pending')
                ->count(),
            'store_proofs_pending' => Invoice::whereNull('work_order_id')
                ->where('order_status', 'payment_review')
                ->count(),
            'store_sales_this_month' => round((float) Invoice::whereNull('work_order_id')
                ->whereMonth('issue_date', now()->month)
                ->whereYear('issue_date', now()->year)
                ->sum('total'), 2),
            'recent_store_orders' => Invoice::whereNull('work_order_id')
                ->with('user')
                ->orderByDesc('id')->limit(5)->get()
                ->map(fn ($i) => [
                    'id' => $i->id,
                    'invoice_number' => $i->invoice_number,
                    'order_status' => $i->order_status ?? 'pending',
                    'customer' => $i->customer_name ?? $i->user?->name,
                    'total' => (float) $i->total,
                    'payment_method' => $i->payment_method,
                    'issued_at' => $i->issue_date?->toDateString(),
                ]),
            'monthly_series' => $this->monthlySeries($period),
            'channel_series' => $this->channelSeries($period),
            'top_products' => $this->topProducts(6),
            'payment_distribution' => $this->paymentDistribution($period),
            'recent_orders' => WorkOrder::with(['user', 'motorcycle', 'motorcycle.brand'])
                ->orderByDesc('id')->limit(8)->get()
                ->map(fn ($o) => app(WorkOrderSerializer::class)->serialize($o)),
            'orders_by_status' => $this->ordersByStatus(),
            'mechanics_workload' => $this->mechanicsWorkload(),
            'period' => $period,
        ];
    }

    // ventas separadas tienda vs taller por periodo
    private function channelSeries(string $period): array
    {
        $buckets = $this->periodBuckets($period);

        Invoice::selectRaw('issue_date, work_order_id, sum(total) as total')
            ->where('issue_date', '>=', $buckets[0]['start'])
            ->where('issue_date', '<', end($buckets)['end'])
            ->groupBy('issue_date', 'work_order_id')
            ->get()
            ->each(function ($row) use (&$buckets, $period) {
                $idx = $this->bucketIndex($buckets, $row->issue_date, $period);
                if ($idx === null) {
                    return;
                }
                if ($row->work_order_id === null) {
                    $buckets[$idx]['store'] += (float) $row->total;
                } else {
                    $buckets[$idx]['workshop'] += (float) $row->total;
                }
            });

        return [
            'labels' => array_column($buckets, 'label'),
            'store' => array_column($buckets, 'store'),
            'workshop' => array_column($buckets, 'workshop'),
        ];
    }

    // lo mas vendido
    private function topProducts(int $limit): array
    {
        $storeItems = \App\Models\InvoiceItem::selectRaw('product_id, sum(quantity) as qty, sum(total) as revenue')
            ->whereNotNull('product_id')
            ->groupBy('product_id');

        $rows = \App\Models\WorkOrderItem::selectRaw('product_id, sum(quantity) as qty, sum(unit_price * quantity) as revenue')
            ->whereNotNull('product_id')
            ->groupBy('product_id')
            ->unionAll($storeItems)
            ->get()
            ->groupBy('product_id')
            ->map(function ($group) {
                return [
                    'qty' => (int) $group->sum('qty'),
                    'revenue' => (float) $group->sum('revenue'),
                ];
            })
            ->sortByDesc('revenue')
            ->take($limit);

        $products = \App\Models\Product::whereIn('id', $rows->keys()->all())->get()->keyBy('id');

        return $rows->map(fn ($r, $pid) => [
            'product_id' => (int) $pid,
            'name' => $products[$pid]->name ?? 'Producto',
            'qty' => $r['qty'],
            'revenue' => round($r['revenue'], 2),
            'stock' => $products[$pid]->available ?? 0,
        ])->values()->all();
    }

    // como pagan (efectivo, transferencia, tarjeta)
    private function paymentDistribution(string $period): array
    {
        $buckets = $this->periodBuckets($period);

        $labels = [
            'efectivo' => ['label' => 'Efectivo', 'color' => '#10b981'],
            'transferencia' => ['label' => 'Transferencia', 'color' => '#0ea5e9'],
            'tarjeta' => ['label' => 'Tarjeta', 'color' => '#8b5cf6'],
        ];

        $counts = Invoice::selectRaw('payment_method, count(*) as count, sum(total) as total')
            ->where('issue_date', '>=', $buckets[0]['start'])
            ->where('issue_date', '<', end($buckets)['end'])
            ->groupBy('payment_method')
            ->get()
            ->keyBy('payment_method');

        return collect($labels)
            ->map(fn ($meta, $method) => [
                'label' => $meta['label'],
                'value' => (int) ($counts[$method]->count ?? 0),
                'amount' => (float) ($counts[$method]->total ?? 0),
                'color' => $meta['color'],
            ])
            ->values()
            ->all();
    }

    // parte el periodo en pedazos para las graficas
    private function periodBuckets(string $period): array
    {
        $buckets = [];

        if ($period === '7d') {
            foreach (range(6, 0) as $i) {
                $d = now()->copy()->subDays($i)->startOfDay();
                $buckets[] = [
                    'label' => $d->format('d/m'),
                    'start' => $d,
                    'end' => $d->copy()->addDay(),
                    'store' => 0.0,
                    'workshop' => 0.0,
                    'sales' => 0.0,
                ];
            }

            return $buckets;
        }

        $count = $period === '30d' ? 4 : 12;
        foreach (range($count - 1, 0) as $i) {
            if ($period === '30d') {
                $start = now()->copy()->subWeeks($i)->startOfWeek();
                $label = $start->format('d/m');
                $end = $start->copy()->addWeek();
            } else {
                $start = now()->copy()->subMonths($i)->startOfMonth();
                $label = $start->format('M');
                $end = $start->copy()->addMonth();
            }
            $buckets[] = [
                'label' => $label,
                'start' => $start,
                'end' => $end,
                'store' => 0.0,
                'workshop' => 0.0,
                'sales' => 0.0,
            ];
        }

        return $buckets;
    }

    // en que pedazo cae una fecha
    private function bucketIndex(array $buckets, $date, string $period): ?int
    {
        if (! $date) {
            return null;
        }

        foreach ($buckets as $i => $b) {
            if ($b['start']->lte($date) && $b['end']->gt($date)) {
                return $i;
            }
        }

        return null;
    }

    // ordenes por estado para la dona
    private function ordersByStatus(): array
    {
        $statuses = [
            'pending' => ['label' => 'Pendientes', 'color' => '#f59e0b'],
            'in_progress' => ['label' => 'En reparación', 'color' => '#0ea5e9'],
            'awaiting_approval' => ['label' => 'Por aprobar', 'color' => '#ea580c'],
            'approved' => ['label' => 'Aprobadas', 'color' => '#10b981'],
            'completed' => ['label' => 'Completadas', 'color' => '#059669'],
            'rejected' => ['label' => 'Rechazadas', 'color' => '#ef4444'],
        ];

        return array_map(
            fn ($s, $meta) => [
                'label' => $meta['label'],
                'value' => $s,
                'color' => $meta['color'],
            ],
            array_column(
                $this->ordersCounts(),
                'count',
                'status'
            ),
            $statuses
        );
    }

    private function ordersCounts(): array
    {
        return WorkOrder::selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->map(fn ($c) => ['count' => (int) $c])
            ->all();
    }

    // cuantas ordenes activas y terminadas tiene cada mecanico
    private function mechanicsWorkload(): array
    {
        return User::where('role', 'mechanic')
            ->orderBy('name')
            ->get()
            ->map(fn ($m) => [
                'label' => $m->name,
                'active' => WorkOrder::where('mechanic_id', $m->id)
                    ->whereIn('status', ['pending', 'in_progress'])
                    ->count(),
                'done' => WorkOrder::where('mechanic_id', $m->id)
                    ->whereIn('status', ['approved', 'completed'])
                    ->count(),
            ])
            ->values()
            ->all();
    }

    // lo que se gano este mes (cobrado menos repuestos)
    private function monthProfit(): float
    {
        $invoices = Invoice::with('workOrder.items.product')
            ->whereMonth('issue_date', now()->month)
            ->whereYear('issue_date', now()->year)
            ->get();

        $cost = 0;
        foreach ($invoices as $invoice) {
            foreach ($invoice->workOrder?->items ?? [] as $woItem) {
                if ($woItem->product) {
                    $cost += ($woItem->product->cost ?? 0) * $woItem->quantity;
                }
            }
        }

        return round($invoices->sum('paid_amount') - $cost, 2);
    }

    private function monthlySeries(string $period = '12m'): array
    {
        $buckets = $this->periodBuckets($period);

        Invoice::selectRaw('issue_date, sum(total) as total')
            ->where('issue_date', '>=', $buckets[0]['start'])
            ->where('issue_date', '<', end($buckets)['end'])
            ->groupBy('issue_date')
            ->get()
            ->each(function ($row) use (&$buckets, $period) {
                $idx = $this->bucketIndex($buckets, $row->issue_date, $period);
                if ($idx === null) {
                    return;
                }
                $buckets[$idx]['sales'] += (float) $row->total;
            });

        return [
            'labels' => array_column($buckets, 'label'),
            'sales' => array_column($buckets, 'sales'),
        ];
    }
}
