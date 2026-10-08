<?php

namespace App\Jobs;

use App\Models\AppNotification;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class SendWhatsAppJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $notificationId)
    {
    }

    public function handle(NotificationService $notifications): void
    {
        $notification = AppNotification::find($this->notificationId);
        if (! $notification || $notification->wa_sent) {
            return;
        }

        $user = $notification->user;
        if (! $user || ! $user->phone) {
            return;
        }

        try {
            $sent = $notifications->sendToPhone($user->phone, $notification->message);
            $notification->update(['wa_sent' => $sent]);
        } catch (\Throwable $e) {
            Log::warning('SendWhatsAppJob falló', ['notification_id' => $this->notificationId, 'error' => $e->getMessage()]);
        }
    }
}