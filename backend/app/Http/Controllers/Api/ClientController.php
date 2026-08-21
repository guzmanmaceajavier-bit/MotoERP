<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\Invoice;
use App\Models\LoyaltyPoint;
use App\Models\MaintenanceRule;
use App\Models\Motorcycle;
use App\Models\Warranty;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $motorcycles = Motorcycle::where('user_id', $userId)->count();
        $activeServices = WorkOrder::where('user_id', $userId)
            ->whereIn('status', ['pending', 'in_progress', 'awaiting_approval'])
            ->count();

        $activeWarranties = Warranty::where('is_active', true)
            ->whereHas('workOrder', fn ($q) => $q->where('user_id', $userId))
            ->where(function ($q) {
                $q->whereNull('end_date')->orWhere('end_date', '>=', now());
            })
            ->get();

        $unreadNotifications = AppNotification::where('user_id', $userId)->whereNull('read_at')->count();

        $recentInvoices = Invoice::where('user_id', $userId)
            ->orderByDesc('id')->limit(5)->get();

        $points = LoyaltyPoint::where('user_id', $userId)
            ->orderByDesc('id')->limit(5)->get();

        $rules = MaintenanceRule::where('is_active', true)->get();
        $nextMaintenances = [];
        $userMotorcycles = Motorcycle::where('user_id', $userId)->get();
        foreach ($userMotorcycles as $motorcycle) {
            foreach ($this->predictiveMaintenance($motorcycle, $rules) as $due) {
                $nextMaintenances[] = $due;
            }
        }
        usort($nextMaintenances, fn ($a, $b) => $a['priority_score'] <=> $b['priority_score']);

        $monthlySeries = ['labels' => [], 'spend' => [], 'orders' => []];
        for ($i = 5; $i >= 0; $i--) {
            $month = now()->copy()->subMonths($i);
            $monthlySeries['labels'][] = $month->format('M');
            $monthlySeries['spend'][] = (float) Invoice::where('user_id', $userId)
                ->whereYear('issue_date', $month->year)
                ->whereMonth('issue_date', $month->month)
                ->sum('total');
            $monthlySeries['orders'][] = Invoice::where('user_id', $userId)
                ->whereYear('issue_date', $month->year)
                ->whereMonth('issue_date', $month->month)
                ->count();
        }

        return response()->json([
            'monthly_series' => $monthlySeries,
            'services_by_status' => $this->servicesByStatus($userId),
            'motorcycles_count' => $motorcycles,
            'active_services' => $activeServices,
            'active_warranties' => $activeWarranties->count(),
            'warranties' => $activeWarranties->map(fn ($w) => [
                'id' => $w->id,
                'description' => $w->description,
                'type' => $w->type,
                'end_date' => $w->end_date?->toDateString(),
            ]),
            'unread_notifications' => $unreadNotifications,
            'points_balance' => $request->user()->points_balance,
            'recent_orders' => WorkOrder::where('user_id', $userId)
                ->orderByDesc('id')->limit(5)
                ->get()
                ->map(fn ($o) => [
                    'id' => $o->id,
                    'order_number' => $o->order_number,
                    'status' => $o->status,
                    'quotation_status' => $o->quotation_status,
                    'created_at' => $o->created_at?->toDateTimeString(),
                    'motorcycle' => $o->motorcycle ? [
                        'nickname' => $o->motorcycle->nickname,
                        'brand' => $o->motorcycle->brand?->name,
                    ] : null,
                ]),
            'recent_invoices' => $recentInvoices->map(fn ($i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'total' => (float) $i->total,
                'status' => $i->status,
                'issue_date' => $i->issue_date?->toDateString(),
            ]),
            'points_history' => $points->map(fn ($p) => [
                'id' => $p->id,
                'points' => $p->points,
                'concept' => $p->concept,
            ]),
            'next_maintenances' => $nextMaintenances,
        ]);
    }

    // ---------- Distribución de servicios del cliente (donut) ----------

    private function servicesByStatus(int $userId): array
    {
        $statuses = [
            'pending' => ['label' => 'Pendientes', 'color' => '#f59e0b'],
            'in_progress' => ['label' => 'En taller', 'color' => '#0ea5e9'],
            'awaiting_approval' => ['label' => 'Por aprobar', 'color' => '#ea580c'],
            'approved' => ['label' => 'Aprobados', 'color' => '#10b981'],
            'completed' => ['label' => 'Completados', 'color' => '#059669'],
            'rejected' => ['label' => 'Rechazados', 'color' => '#ef4444'],
        ];

        $counts = WorkOrder::where('user_id', $userId)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->map(fn ($c) => (int) $c)
            ->all();

        return collect($statuses)
            ->map(fn ($meta, $status) => [
                'label' => $meta['label'],
                'value' => $counts[$status] ?? 0,
                'color' => $meta['color'],
            ])
            ->values()
            ->all();
    }

    // ---------- Hoja de Vida Digital de una moto ----------

    public function requestService(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'motorcycle_id' => 'nullable|exists:motorcycles,id',
            'service_type' => 'required|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        if (! empty($validated['motorcycle_id'])) {
            $moto = Motorcycle::find($validated['motorcycle_id']);
            abort_if(! $moto || $moto->user_id !== $request->user()->id, 403, 'Moto no válida');
        }

        $order = WorkOrder::create([
            'order_number' => \App\Http\Controllers\Api\OrderController::generateOrderNumber(),
            'user_id' => $request->user()->id,
            'motorcycle_id' => $validated['motorcycle_id'] ?? null,
            'mechanic_id' => null,
            'status' => 'pending',
            'quotation_status' => 'draft',
            'service_type' => \App\Support\Input::clean($validated['service_type']),
            'client_notes' => \App\Support\Input::clean($validated['notes'] ?? null),
        ]);

        app(\App\Services\NotificationService::class)->notify(
            $request->user(),
            'Servicio solicitado',
            "Tu solicitud de \"{$order->service_type}\" ({$order->order_number}) fue recibida. Un encargado preparará la cotización.",
            'success',
            ['channel' => 'order']
        );

        return response()->json([
            'id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'service_type' => $order->service_type,
        ], 201);
    }

    public function motorcycleHistory(Request $request, Motorcycle $motorcycle): JsonResponse
    {
        $this->authorizeOwner($request, $motorcycle);
        $motorcycle->load(['brand', 'model']);

        $orders = WorkOrder::where('motorcycle_id', $motorcycle->id)
            ->with(['items', 'labors', 'user', 'mechanic', 'warranties', 'photos'])
            ->orderByDesc('id')
            ->get();

        $rules = MaintenanceRule::where('is_active', true)->get();

        return response()->json([
            'motorcycle' => $motorcycle->toArray() + [
                'brand' => $motorcycle->brand?->name,
                'model' => $motorcycle->model?->name,
                'accessories' => $motorcycle->accessories ?? [],
                'documentation' => $motorcycle->documentation,
                'registered_at' => $motorcycle->registered_at?->toDateString(),
            ],
            'odometer' => $motorcycle->current_odometer,
            'maintenances' => $this->predictiveMaintenance($motorcycle, $rules),
            'services' => $orders->map(fn ($o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'status' => $o->status,
                'service_type' => $o->service_type,
                'diagnosis' => $o->diagnosis,
                'odometer_in' => $o->odometer_in,
                'odometer_out' => $o->odometer_out,
                'created_at' => $o->created_at?->toDateTimeString(),
                'estimated_delivery' => $o->estimated_delivery?->toDateString(),
                'total' => round((float) $o->quotation_total, 2),
                'mechanic' => $o->mechanic?->name,
                'items' => $o->items->map(fn ($i) => [
                    'description' => $i->description,
                    'quantity' => $i->quantity,
                    'unit_price' => (float) $i->unit_price,
                    'total' => round($i->quantity * $i->unit_price, 2),
                ]),
                'labors' => $o->labors->map(fn ($l) => [
                    'description' => $l->description,
                    'hours' => (float) $l->hours,
                    'amount' => (float) $l->amount,
                ]),
                'photos' => $o->photos->map(fn ($p) => [
                    'id' => $p->id,
                    'caption' => $p->caption,
                    'type' => $p->type,
                    'url' => $p->url,
                ]),
            ]),
            'warranties' => Warranty::whereIn('work_order_id', WorkOrder::where('motorcycle_id', $motorcycle->id)->pluck('id')->all())
                ->with('product')
                ->orderByDesc('id')
                ->get()
                ->map(fn ($w) => [
                    'id' => $w->id,
                    'description' => $w->description,
                    'type' => $w->type,
                    'duration' => $w->duration,
                    'start_date' => $w->start_date?->toDateString(),
                    'end_date' => $w->end_date?->toDateString(),
                    'status' => $w->status,
                ]),
            'invoices' => Invoice::whereHas('workOrder', fn ($q) => $q->where('motorcycle_id', $motorcycle->id))
                ->orderByDesc('id')
                ->get()
                ->map(fn ($i) => [
                    'id' => $i->id,
                    'invoice_number' => $i->invoice_number,
                    'total' => (float) $i->total,
                    'issue_date' => $i->issue_date?->toDateString(),
                ]),
        ]);
    }

    private function predictiveMaintenance(Motorcycle $motorcycle, $rules): array
    {
        $result = [];

        foreach ($rules as $rule) {
            $order = WorkOrder::where('motorcycle_id', $motorcycle->id)
                ->when($rule->category, fn ($q) => $q->where('service_type', 'ilike', "%{$rule->category}%"))
                ->orderByDesc('created_at')
                ->first();

            $lastKm = $order && $order->odometer_in !== null ? (int) $order->odometer_in : (int) $motorcycle->current_odometer;
            $lastDate = $order && $order->created_at ? $order->created_at : now()->subMonths($rule->interval_months ?? 0);

            $dueKm = $rule->interval_km !== null ? $lastKm + $rule->interval_km : null;
            $dueDate = $rule->interval_months !== null ? $lastDate->copy()->addMonths($rule->interval_months) : null;

            $kmLeft = $dueKm !== null ? max(0, $dueKm - (int) $motorcycle->current_odometer) : null;
            $daysLeft = $dueDate !== null ? (int) now()->diffInDays($dueDate, false) : null;

            $overdue = (($kmLeft !== null && $kmLeft === 0) || ($daysLeft !== null && $daysLeft <= 0));

            // Clasificar urgencia
            $urgency = 'ok';
            if (($kmLeft !== null && $kmLeft <= 0) || ($daysLeft !== null && $daysLeft <= 0)) {
                $urgency = 'overdue';
            } elseif (($kmLeft !== null && $kmLeft <= 500) || ($daysLeft !== null && $daysLeft <= 14)) {
                $urgency = 'soon';
            }

            // Score de prioridad (menor = más urgente)
            $priorityScore = PHP_INT_MAX;
            if ($daysLeft !== null) {
                $priorityScore = $daysLeft;
            }
            if ($kmLeft !== null && ($priorityScore === PHP_INT_MAX || $kmLeft < $priorityScore)) {
                $priorityScore = $kmLeft;
            }

            $result[] = [
                'service_name' => $rule->service_name,
                'category' => $rule->category,
                'interval_km' => $rule->interval_km,
                'interval_months' => $rule->interval_months,
                'due_km' => $dueKm,
                'due_date' => $dueDate?->toDateString(),
                'km_left' => $kmLeft,
                'days_left' => $daysLeft,
                'urgency' => $urgency,
                'overdue' => $overdue,
                'priority_score' => $priorityScore,
            ];
        }

        return $result;
    }

    private function authorizeOwner(Request $request, Motorcycle $motorcycle): void
    {
        abort_if($motorcycle->user_id !== $request->user()->id, 403, 'No autorizado');
    }
}