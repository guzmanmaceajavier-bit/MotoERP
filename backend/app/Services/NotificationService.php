<?php

namespace App\Services;

use App\Jobs\SendWhatsAppJob;
use App\Models\AppNotification;
use App\Models\Appointment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Support\Settings;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Crea una notificación in-app (siempre) e intenta enviar WhatsApp (si está habilitado).
     */
    public function notify(User $user, string $title, string $message, string $type = 'info', array $extra = []): AppNotification
    {
        $notification = AppNotification::create([
            'user_id' => $user->id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'channel' => $extra['channel'] ?? 'inapp',
            'wa_sent' => false,
        ]);

        // El envío de WhatsApp se encola para no bloquear la petición HTTP
        // (si no hay worker, solo queda pendiente; la notificación in-app ya está).
        if ($this->whatsappEnabled() && $user->phone) {
            SendWhatsAppJob::dispatch($notification->id);
        }

        return $notification;
    }

    /**
     * Envía WhatsApp a un teléfono sin depender de un usuario registrado
     * (p.ej. confirmación de cita del sitio público).
     */
    public function sendAppointmentConfirmation(Appointment $appointment): bool
    {
        if (! $this->whatsappEnabled() || ! $appointment->phone) {
            return false;
        }

        $message = "Hola {$appointment->name}! Tu cita para ".($appointment->service_type ?: 'el servicio solicitado').
            ' quedó agendada para el '.Carbon::parse($appointment->date)->isoFormat('DD-MM-YYYY').
            " a las {$appointment->time}. Te esperamos.";

        return $this->sendToPhone($appointment->phone, $message);
    }

    public function sendAppointmentReminder(Appointment $appointment): bool
    {
        if (! $this->whatsappEnabled() || ! $appointment->phone) {
            return false;
        }

        $message = "Hola {$appointment->name}! Te recordamos tu cita en el taller para el ".
            Carbon::parse($appointment->date)->isoFormat('DD-MM-YYYY')." a las {$appointment->time}.".
            ($appointment->service_type ? " Servicio: {$appointment->service_type}." : '').
            ' Te esperamos.';

        return $this->sendToPhone($appointment->phone, $message);
    }

    public function whatsappEnabled(): bool
    {
        return Settings::bool('whatsapp_enabled', (bool) config('services.whatsapp.enabled', false));
    }

    /**
     * @param  User|string  $user  Usuario o número de teléfono directo.
     */
    public function sendWhatsApp($user, string $message): bool
    {
        $phone = is_string($user) ? $user : $user->phone;

        return $this->sendToPhone($phone, $message);
    }

    public function sendToPhone(?string $phone, string $message): bool
    {
        if (! $phone) {
            return false;
        }

        $provider = config('services.whatsapp.provider', Settings::get('whatsapp_provider', 'meta'));

        try {
            if ($provider === 'twilio') {
                return $this->viaTwilio($phone, $message);
            }

            return $this->viaMeta($phone, $message);
        } catch (ConnectionException $e) {
            Log::warning('WhatsApp: sin conexión. '.$e->getMessage());

            return false;
        } catch (\Throwable $e) {
            Log::error('WhatsApp: error al enviar. '.$e->getMessage());

            return false;
        }
    }

    /**
     * Envía un código de recuperación usando una PLANTILLA aprobada de
     * WhatsApp (Meta Cloud API). Es obligatorio para mensajes de negocio
     * iniciados por el taller (fuera de la ventana de 24h), como un OTP.
     */
    public function sendRecoveryCode(string $phone, string $code): bool
    {
        if (! $phone) {
            Log::warning('Recovery code: sin teléfono para enviar.');

            return false;
        }

        $template = Settings::get('whatsapp_template') ?: config('services.whatsapp.template');

        try {
            return $this->viaMetaTemplate($phone, $template, $code);
        } catch (\Throwable $e) {
            Log::error('WhatsApp: error al enviar código de recuperación. '.$e->getMessage());

            return false;
        }
    }

    private function viaMeta(string $phone, string $message): bool
    {
        $token = config('services.whatsapp.token') ?: env('WHATSAPP_ACCESS_TOKEN');
        $phoneId = config('services.whatsapp.phone_id') ?: env('WHATSAPP_PHONE_ID');

        if (! $token || ! $phoneId) {
            Log::info("WhatsApp [META][NO-CONFIGURADO] a {$phone}: {$message}");

            return false;
        }

        $response = Http::withToken($token)
            ->timeout(10)
            ->connectTimeout(5)
            ->post("https://graph.facebook.com/v20.0/{$phoneId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $phone,
                'type' => 'text',
                'text' => ['body' => $message],
            ]);

        $ok = $response->successful();
        if (! $ok) {
            Log::error('WhatsApp [META] fallo: '.$response->body());
        }

        return $ok;
    }

    private function viaMetaTemplate(string $phone, string $template, string $code): bool
    {
        $token = config('services.whatsapp.token') ?: env('WHATSAPP_ACCESS_TOKEN');
        $phoneId = config('services.whatsapp.phone_id') ?: env('WHATSAPP_PHONE_ID');

        if (! $token || ! $phoneId || ! $template) {
            Log::info("WhatsApp [META][NO-CONFIGURADO] código a {$phone}: {$code} (template: {$template})");

            return false;
        }

        $lang = Settings::get('whatsapp_template_lang', 'es');

        $response = Http::withToken($token)
            ->timeout(10)
            ->connectTimeout(5)
            ->post("https://graph.facebook.com/v19.0/{$phoneId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $phone,
                'type' => 'template',
                'template' => [
                    'name' => $template,
                    'language' => ['code' => $lang],
                    'components' => [
                        [
                            'type' => 'body',
                            'parameters' => [
                                ['type' => 'text', 'text' => $code],
                            ],
                        ],
                    ],
                ],
            ]);

        $ok = $response->successful();
        if (! $ok) {
            Log::error('WhatsApp [META][TEMPLATE] fallo: '.$response->body());
        }

        return $ok;
    }

    private function viaTwilio(string $phone, string $message): bool
    {
        $sid = config('services.whatsapp.twilio_sid');
        $tokenVal = config('services.whatsapp.twilio_token');
        $from = config('services.whatsapp.twilio_from');

        if (! $sid || ! $tokenVal) {
            Log::info("WhatsApp [TWILIO][NO-CONFIGURADO] a {$phone}: {$message}");

            return false;
        }

        $clean = preg_replace('/[^0-9]/', '', $phone);
        $response = Http::asForm()
            ->withBasicAuth($sid, $tokenVal)
            ->timeout(10)
            ->connectTimeout(5)
            ->post("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json", [
                'From' => $from,
                'To' => "whatsapp:{$clean}",
                'Body' => $message,
            ]);

        $ok = $response->successful();
        if (! $ok) {
            Log::error('WhatsApp [TWILIO] fallo: '.$response->body());
        }

        return $ok;
    }

    // ---------- Mensajes predefinidos por evento ----------

    public function orderCreated(WorkOrder $order): void
    {
        $this->notify($order->user, 'Orden creada',
            "Su orden {$order->order_number} fue registrada en el taller.", 'success',
            ['channel' => 'order']);
    }

    public function quotationReady(WorkOrder $order): void
    {
        $this->notify($order->user, 'Cotización lista',
            "El diagnóstico de la orden {$order->order_number} está listo. El total es \$".number_format((float) $order->quotation_total, 2).
            '. Ingrese para aprobarla o solicitar cambios.', 'info',
            ['channel' => 'order']);
    }

    public function quotationApproved(WorkOrder $order): void
    {
        $this->notify($order->user, 'Cotización aprobada',
            "Su cotización {$order->order_number} fue aprobada. Comenzamos la reparación.", 'success',
            ['channel' => 'order']);
    }

    public function workStarted(WorkOrder $order): void
    {
        $this->notify($order->user, 'Reparación iniciada',
            "La reparación de la orden {$order->order_number} comenzó.", 'info',
            ['channel' => 'order']);
    }

    public function workCompleted(WorkOrder $order): void
    {
        $this->notify($order->user, 'Reparación finalizada',
            "Su moto está lista para entrega (orden {$order->order_number}).", 'success',
            ['channel' => 'order']);
    }

    public function invoiceGenerated(WorkOrder $order): void
    {
        $this->notify($order->user, 'Factura generada',
            "Su factura por la orden {$order->order_number} está disponible para descargar.", 'success',
            ['channel' => 'invoice']);
    }

    public function warrantyExpiring($warranty): void
    {
        $order = $warranty->workOrder;
        $user = $order?->user;
        if (! $user) {
            return;
        }
        $this->notify($user, 'Garantía próxima a vencer',
            "La garantía \"{$warranty->description}\" vencerá el ".Carbon::parse($warranty->end_date)->toDateString().'.', 'warning',
            ['channel' => 'warranty']);
    }
}
