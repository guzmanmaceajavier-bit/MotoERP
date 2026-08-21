<?php

namespace App\Console\Commands;

use App\Models\Appointment;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class RemindAppointments extends Command
{
    protected $signature = 'appointments:remind';

    protected $description = 'Envía recordatorio de cita por WhatsApp/notificación 24h antes';

    public function handle(NotificationService $notifier): int
    {
        $start = now()->addHours(20);
        $end = now()->addHours(30);

        $appointments = Appointment::with('user')
            ->whereIn('status', ['pending', 'confirmed'])
            ->whereNull('reminder_sent_at')
            ->get()
            ->filter(function ($appointment) use ($start, $end) {
                $datetime = Carbon::parse($appointment->date->toDateString() . ' ' . $appointment->time);
                return $datetime >= $start && $datetime <= $end;
            });

        $notified = 0;
        foreach ($appointments as $appointment) {
            $datetime = Carbon::parse($appointment->date->toDateString() . ' ' . $appointment->time);

            if ($appointment->user) {
                $notifier->notify(
                    $appointment->user,
                    'Recordatorio de cita',
                    "Te recordamos tu cita en el taller el " .
                        $datetime->isoFormat('DD-MM-YYYY [a las] HH:mm') .
                        ($appointment->service_type ? " para: {$appointment->service_type}" : '') .
                        '. Te esperamos.',
                    'info',
                    ['channel' => 'appointment']
                );
            }

            $notifier->sendAppointmentReminder($appointment);

            $appointment->update(['reminder_sent_at' => now()]);
            $notified++;
        }

        $this->info("Recordatorios de cita enviados: {$notified}");

        return 0;
    }
}