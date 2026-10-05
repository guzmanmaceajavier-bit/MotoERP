<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\User;
use App\Models\WorkOrder;

// agenda del taller: mecanicos, citas de hoy y las que vienen, calendario
class AgendaService
{
    public function workshop(): array
    {
        $mechanics = User::where('role', 'mechanic')->orderBy('name')->get();

        $perMechanic = $mechanics->map(fn ($m) => [
            'id' => $m->id,
            'name' => $m->name,
            'active_orders' => WorkOrder::where('mechanic_id', $m->id)
                ->whereIn('status', ['pending', 'in_progress', 'awaiting_approval'])
                ->count(),
            'in_progress' => WorkOrder::where('mechanic_id', $m->id)
                ->where('status', 'in_progress')
                ->count(),
            'orders' => WorkOrder::where('mechanic_id', $m->id)
                ->whereIn('status', ['pending', 'in_progress', 'awaiting_approval'])
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->map(fn ($o) => [
                    'id' => $o->id,
                    'order_number' => $o->order_number,
                    'status' => $o->status,
                    'service_type' => $o->service_type,
                    'estimated_delivery' => $o->estimated_delivery?->toDateString(),
                    'customer' => $o->user?->name,
                    'motorcycle' => $o->motorcycle?->nickname ?? $o->motorcycle?->plate,
                ]),
        ]);

        return [
            'mechanics' => $perMechanic,
            'today_appointments' => Appointment::with('mechanic')->whereDate('date', now()->toDateString())
                ->orderBy('time')
                ->get()
                ->map(fn ($a) => $this->appointmentRow($a)),
            'upcoming_appointments' => Appointment::with(['mechanic', 'motorcycle'])->where('date', '>', now()->toDateString())
                ->orderBy('date')
                ->orderBy('time')
                ->get()
                ->map(fn ($a) => $this->appointmentRow($a)),
            'waiting' => WorkOrder::where('status', 'pending')->whereNull('mechanic_id')->count(),
            'in_reparation' => WorkOrder::where('status', 'in_progress')->count(),
        ];
    }

    // lo de un dia puntual
    public function dayDetail(string $day): array
    {
        return [
            'date' => $day,
            'day_name' => $this->dayName($day),
            'appointments' => Appointment::with(['mechanic', 'motorcycle'])->whereDate('date', $day)
                ->orderBy('time')->get()
                ->map(fn ($a) => [
                    'id' => $a->id,
                    'date' => $a->date?->toDateString(),
                    'time' => $a->time,
                    'day_name' => $this->dayName($a->date?->toDateString()),
                    'customer' => $a->name ?? 'Cliente',
                    'service_type' => $a->service_type,
                    'motorcycle' => $a->motorcycle ? ($a->motorcycle->plate ?? $a->motorcycle->nickname ?? 'Moto') : null,
                    'status' => $a->status,
                    'mechanic_id' => $a->mechanic_id,
                    'mechanic_name' => $a->mechanic?->name,
                ]),
        ];
    }

    // que dias del mes estan ocupados
    public function month(string $month): array
    {
        $monthStart = $month . '-01';
        $monthEnd = $month . '-31';

        // Citas agendadas por día (todas excepto canceladas)
        $appointments = Appointment::whereBetween('date', [$monthStart, $monthEnd])
            ->where('status', '!=', 'cancelled')
            ->selectRaw("date, count(*) as total")
            ->groupBy('date')
            ->pluck('total', 'date')->map(fn ($v) => (int) $v);

        // Órdenes con entrega estimada en el mes (no finalizadas)
        $orders = WorkOrder::whereBetween('estimated_delivery', [$monthStart, $monthEnd])
            ->whereNotIn('status', ['completed', 'delivered', 'cancelled'])
            ->selectRaw("estimated_delivery, count(*) as total")
            ->groupBy('estimated_delivery')
            ->pluck('total', 'estimated_delivery')->map(fn ($v) => (int) $v);

        $days = collect(range(1, \Carbon\Carbon::parse($monthStart)->daysInMonth))->map(function ($day) use ($month, $appointments, $orders) {
            $date = $month . '-' . str_pad((string) $day, 2, '0', STR_PAD_LEFT);
            $spanish = [1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado', 7 => 'Domingo'];

            return [
                'date' => $date,
                'day_name' => $spanish[\Carbon\Carbon::parse($date)->dayOfWeek] ?? '',
                'appointments' => $appointments[$date] ?? 0,
                'orders' => $orders[$date] ?? 0,
            ];
        });

        return ['month' => $month, 'days' => $days];
    }

    private function appointmentRow(Appointment $a): array
    {
        return [
            'id' => $a->id,
            'name' => $a->customer_name ?? $a->name ?? 'Cliente',
            'email' => $a->email ?? '',
            'phone' => $a->phone,
            'service_type' => $a->service_type,
            'date' => $a->date?->toDateString(),
            'day_name' => $this->dayName($a->date?->toDateString()),
            'time' => $a->time,
            'status' => $a->status,
            'mechanic_id' => $a->mechanic_id,
            'mechanic_name' => $a->mechanic?->name,
            'motorcycle' => $a->motorcycle ? ($a->motorcycle->plate ?? $a->motorcycle->nickname ?? 'Moto') : null,
        ];
    }

    public function dayName(?string $date): ?string
    {
        if (! $date) {
            return null;
        }
        $spanish = [1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado', 7 => 'Domingo'];

        return $spanish[\Carbon\Carbon::parse($date)->dayOfWeek] ?? null;
    }
}
