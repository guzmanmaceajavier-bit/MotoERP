<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Service;
use App\Models\User;
use App\Models\WorkOrder;
use App\Support\Settings;

class AppointmentQueueService
{
    public const DEFAULT_MINUTES = 60;

    public const BIG_JOB_THRESHOLD_MINUTES = 180;

    public const DAY_EFFICIENCY = 0.9;

    public function forDate(string $date, ?int $serviceId, ?string $serviceType = null): array
    {
        $service = $serviceId ? Service::find($serviceId) : null;

        $duration = (int) ($service?->estimated_minutes ?? 0);
        if ($duration <= 0) {
            $duration = (int) Settings::get('default_service_minutes', self::DEFAULT_MINUTES) ?: self::DEFAULT_MINUTES;
        }

        $bigJob = $duration >= self::BIG_JOB_THRESHOLD_MINUTES;

        $mechanics = (int) User::where('role', 'mechanic')->count();
        if ($mechanics < 1) {
            $mechanics = 1;
        }

        $confirmed = Appointment::where('date', $date)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->get();

        $orders = WorkOrder::whereDate('created_at', $date)
            ->whereNotIn('status', ['cancelled', 'delivered'])
            ->count();

        $priorJobs = $confirmed->count() + $orders;
        $turn = $priorJobs + 1;

        $queuedMinutes = 0;
        foreach ($confirmed as $appointment) {
            $svc = $appointment->service_id ? Service::find($appointment->service_id) : null;
            $queuedMinutes += (int) ($svc?->estimated_minutes ?? $duration);
        }
        $queuedMinutes += $orders * $duration;

        $waitMinutes = (int) round($queuedMinutes / $mechanics);

        $dow = (int) \Carbon\Carbon::parse($date)->dayOfWeek;

        $dayHours = collect(json_decode((string) Settings::get('day_hours', '[]'), true) ?: [])
            ->first(fn ($d) => ($d['day'] ?? null) === $dow);
        $closedDays = (array) json_decode((string) Settings::get('closed_days', '[]'), true) ?: [];

        if (($dow === 0 && ! $dayHours) || in_array($dow, $closedDays, true)) {
            $dayMinutes = 0;
        } else {
            $open = $dayHours['open'] ?? (string) Settings::get('schedule_open', '09:00');
            $close = $dayHours['close'] ?? (string) Settings::get('schedule_close', '18:00');
            $dayMinutes = $this->minutesBetween($open, $close);
        }

        $effectiveDay = (int) round($dayMinutes * self::DAY_EFFICIENCY);
        if ($effectiveDay < 60) {
            $effectiveDay = 60;
        }

        $sameDayFeasible = $waitMinutes + $duration <= $effectiveDay;

        $daysOut = $waitMinutes > 0 ? (int) floor($waitMinutes / $effectiveDay) : 0;

        return [
            'service_type' => $service?->name ?? $serviceType,
            'estimated_minutes' => $duration,
            'big_job' => $bigJob,
            'available_mechanics' => $mechanics,
            'prior_jobs' => $priorJobs,
            'turn' => $turn,
            'queued_minutes' => $queuedMinutes,
            'estimated_wait_minutes' => $waitMinutes,
            'same_day_feasible' => $sameDayFeasible,
            'days_out' => $daysOut,
        ];
    }

    public function message(array $queue): string
    {
        if ($queue['turn'] <= 1) {
            return 'Eres el primer turno del día. Llegamos contigo apenas abra el taller.';
        }

        $inLine = $queue['turn'] - 1;
        $base = "Hay {$inLine} trabajo" . ($inLine === 1 ? '' : 's') . ' antes que tu moto en la cola del día.';

        if (! $queue['same_day_feasible']) {
            $dias = $queue['days_out'] + 1;

            return $base . ' Tu trabajo es extenso y tomará el turno del día ' . $dias . ' dentro de tu jornada disponible.';
        }

        $horas = round(($queue['estimated_wait_minutes'] ?? 0) / 60, 1);

        return $base . ' La espera estimada es de ' . $horas . ' h. Te avisamos cuando esté por entrar tu moto.';
    }

    private function minutesBetween(string $start, string $end): int
    {
        if ($end < $start) {
            $end = $end.'+1 day';
        }

        return max(0, (int) round((strtotime($end) - strtotime($start)) / 60));
    }
}