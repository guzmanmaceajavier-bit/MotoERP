<?php

namespace App\Console\Commands;

use App\Models\Warranty;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class CheckWarranties extends Command
{
    protected $signature = 'warranties:check';

    protected $description = 'Notifica cuando una garantía está próxima a vencer (dentro de 14 días)';

    public function handle(NotificationService $notifier): int
    {
        $expiring = Warranty::where('is_active', true)
            ->whereNotNull('end_date')
            ->whereBetween('end_date', [now(), now()->addDays(14)])
            ->get();

        foreach ($expiring as $warranty) {
            $notifier->warrantyExpiring($warranty);
        }

        $this->info("Garantías próximas a vencer notificadas: {$expiring->count()}");

        return 0;
    }
}