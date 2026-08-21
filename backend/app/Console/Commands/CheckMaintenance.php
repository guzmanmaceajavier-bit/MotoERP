<?php

namespace App\Console\Commands;

use App\Models\MaintenanceRule;
use App\Models\Motorcycle;
use App\Models\WorkOrder;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class CheckMaintenance extends Command
{
    protected $signature = 'maintenance:check {--force}';

    protected $description = 'Calcula mantenimientos próximos por kilometraje/tiempo y notifica a los clientes';

    public function handle(NotificationService $notifier): int
    {
        $rules = MaintenanceRule::where('is_active', true)->get();

        if ($rules->isEmpty()) {
            $this->info('No hay reglas de mantenimiento configuradas.');

            return 0;
        }

        $notified = 0;

        foreach (Motorcycle::where('status', 'active')->with('user')->get() as $motorcycle) {
            if (! $motorcycle->user) {
                continue;
            }

            foreach ($rules as $rule) {
                $lastKm = $this->lastServiceKm($motorcycle, $rule);
                $lastDate = $this->lastServiceDate($motorcycle, $rule);

                $dueKm = $rule->interval_km ? ($lastKm + $rule->interval_km) : null;
                $dueDate = $rule->interval_months ? $lastDate->copy()->addMonths($rule->interval_months) : null;

                $kmLeft = $dueKm !== null ? max(0, $dueKm - $motorcycle->current_odometer) : null;
                $daysLeft = $dueDate !== null ? (int) now()->diffInDays($dueDate, false) : null;

                $withinKm = $kmLeft !== null && $kmLeft <= 500;
                $withinDays = $daysLeft !== null && $daysLeft <= 14;

                if ($withinKm || $withinDays) {
                    $nickname = $motorcycle->nickname ?: 'moto';
                    $notifier->notify(
                        $motorcycle->user,
                        'Próximo mantenimiento',
                        "Tu {$nickname} debe próximamente un: {$rule->service_name}" .
                            ($kmLeft !== null ? " (faltan ~{$kmLeft} km)" : '') .
                            ($daysLeft !== null ? " (faltan {$daysLeft} días)" : '') . '.',
                        'warning',
                        ['channel' => 'maintenance']
                    );
                    $notified++;
                }
            }
        }

        $this->info("Notificaciones de mantenimiento enviadas: {$notified}");

        return 0;
    }

    private function lastServiceKm(Motorcycle $motorcycle, MaintenanceRule $rule): int
    {
        $order = $this->lastOrder($motorcycle, $rule);
        if ($order && $order->odometer_in !== null) {
            return (int) $order->odometer_in;
        }

        return (int) $motorcycle->current_odometer;
    }

    private function lastServiceDate(Motorcycle $motorcycle, MaintenanceRule $rule): \Illuminate\Support\Carbon
    {
        $order = $this->lastOrder($motorcycle, $rule);
        if ($order && $order->created_at) {
            return $order->created_at;
        }

        return now()->subMonths($rule->interval_months ?? 0);
    }

    private function lastOrder(Motorcycle $motorcycle, MaintenanceRule $rule): ?WorkOrder
    {
        $query = WorkOrder::where('motorcycle_id', $motorcycle->id);

        if ($rule->category) {
            $query->where('service_type', 'ilike', "%{$rule->category}%");
        }

        return $query->orderByDesc('created_at')->first();
    }
}