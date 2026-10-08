<?php

namespace App\Services;

use App\Models\MaintenanceRule;
use App\Models\Motorcycle;
use App\Models\WorkOrder;
use Illuminate\Support\Collection;

class MaintenanceService
{
    public function alerts(?string $urgencyFilter = null): array
    {
        $rules = MaintenanceRule::where('is_active', true)->get();

        $alerts = [];
        $motorcycles = Motorcycle::with(['user', 'brand', 'model'])->get();

        foreach ($motorcycles as $motorcycle) {
            foreach ($this->predictiveMaintenance($motorcycle, $rules) as $due) {
                $alerts[] = [
                    'motorcycle_id' => $motorcycle->id,
                    'plate' => $motorcycle->plate,
                    'nickname' => $motorcycle->nickname,
                    'brand' => $motorcycle->brand?->name,
                    'model' => $motorcycle->model?->name,
                    'current_odometer' => $motorcycle->current_odometer,
                    'customer' => $motorcycle->user?->name,
                    'customer_phone' => $motorcycle->user?->phone,
                    ...$due,
                ];
            }
        }

        usort($alerts, fn ($a, $b) => $a['priority_score'] <=> $b['priority_score']);

        if ($urgencyFilter) {
            $alerts = array_values(array_filter($alerts, fn ($a) => in_array($a['urgency'], explode(',', $urgencyFilter))));
        }

        return [
            'data' => array_slice($alerts, 0, 200),
            'overdue' => count(array_filter($alerts, fn ($a) => $a['urgency'] === 'overdue')),
            'soon' => count(array_filter($alerts, fn ($a) => $a['urgency'] === 'soon')),
        ];
    }

    public function forMotorcycle(Motorcycle $motorcycle, $rules): array
    {
        return $this->predictiveMaintenance($motorcycle, $rules);
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

            $urgency = 'ok';
            if (($kmLeft !== null && $kmLeft <= 0) || ($daysLeft !== null && $daysLeft <= 0)) {
                $urgency = 'overdue';
            } elseif (($kmLeft !== null && $kmLeft <= 500) || ($daysLeft !== null && $daysLeft <= 14)) {
                $urgency = 'soon';
            }

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
                'overdue' => ($kmLeft !== null && $kmLeft === 0) || ($daysLeft !== null && $daysLeft <= 0),
                'priority_score' => $priorityScore,
            ];
        }

        return $result;
    }
}
