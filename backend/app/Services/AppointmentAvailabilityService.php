<?php

namespace App\Services;

use App\Models\Appointment;
use App\Support\Settings;
use Illuminate\Support\Carbon;

/**
 * Disponibilidad de agenda centralizada.
 * Reemplaza los validateSlot duplicados (PublicController y StaffController).
 */
class AppointmentAvailabilityService
{
    /** Devuelve true o un mensaje de error. */
    public function check(string $date, ?string $time): true|string
    {
        $closed = (array) json_decode((string) Settings::get('closed_days', '[]'), true) ?: [];

        $dow = (int) Carbon::parse($date)->dayOfWeek; // 0 = Domingo

        // Festivo: cerrado, con horario de sábado o con horario propio.
        $holiday = collect(json_decode((string) Settings::get('holidays', '[]'), true) ?: [])
            ->first(fn ($h) => ($h['date'] ?? null) === $date);

        if ($holiday) {
            return $this->checkHoliday($holiday, $date, $time, $closed);
        }

        // Domingo: cerrado salvo que exista un horario explícito para ese día.
        $dayHours = collect(json_decode((string) Settings::get('day_hours', '[]'), true) ?: [])
            ->first(fn ($d) => ($d['day'] ?? null) === $dow);

        if ($dow === 0 && ! $dayHours) {
            return 'Los domingos el taller está cerrado. Elige otro día.';
        }

        if (in_array($dow, $closed, true)) {
            return 'Este día el taller está cerrado. Elige otro día.';
        }

        if ($dayHours) {
            if ($time !== null && $time !== '' && ($time < $dayHours['open'] || $time > $dayHours['close'])) {
                return 'La hora está fuera del horario de atención de este día.';
            }

            return true;
        }

        $open = (string) Settings::get('schedule_open', '09:00');
        $close = (string) Settings::get('schedule_close', '18:00');

        if ($time !== null && $time !== '' && ($time < $open || $time > $close)) {
            return 'La hora está fuera del horario de atención.';
        }

        return true;
    }

    private function checkHoliday(array $holiday, string $date, ?string $time, array $closed): true|string
    {
        $mode = $holiday['mode'] ?? (empty($holiday['open']) && empty($holiday['close']) ? 'closed' : 'custom');

        if ($mode === 'saturday') {
            $saturday = $this->saturdayHours($closed);
            if (! $saturday) {
                return 'Este día es festivo y el taller no atiende. Elige otro día.';
            }
            if ($time !== null && $time !== '' && ($time < $saturday['open'] || $time > $saturday['close'])) {
                return 'En festivo atendemos como sábado: de ' . $saturday['open'] . ' a ' . $saturday['close'] . '. Elige otra hora.';
            }

            return true;
        }

        if ($mode === 'closed') {
            return 'Este día es festivo y el taller está cerrado. Elige otro día.';
        }

        // Modo personalizado (o legado con horas)
        $holidayOpen = $holiday['open'] ?? null;
        $holidayClose = $holiday['close'] ?? ($holidayOpen ? null : '18:00');
        if ($time !== null && $time !== '' && $holidayClose !== null && $time > $holidayClose) {
            return 'En festivo solo atendemos hasta las ' . $holidayClose . '. Elige otra hora.';
        }
        if ($holidayOpen !== null && $time !== null && $time !== '' && $time < $holidayOpen) {
            return 'En festivo atendemos desde las ' . $holidayOpen . '. Elige otra hora.';
        }

        return true;
    }

    private function saturdayHours(array $closed): ?array
    {
        $dayHours = collect(json_decode((string) Settings::get('day_hours', '[]'), true) ?: [])
            ->first(fn ($d) => ($d['day'] ?? null) === 6);

        if (in_array(6, $closed, true)) {
            return null;
        }
        if ($dayHours) {
            return ['open' => $dayHours['open'], 'close' => $dayHours['close']];
        }

        return [
            'open' => (string) Settings::get('schedule_open', '09:00'),
            'close' => (string) Settings::get('schedule_close', '18:00'),
        ];
    }

    /** Aborta con 422 si el slot no es válido. */
    public function assertSlot(string $date, ?string $time): void
    {
        $result = $this->check($date, $time);
        if ($result !== true) {
            abort(422, $result);
        }
    }
}