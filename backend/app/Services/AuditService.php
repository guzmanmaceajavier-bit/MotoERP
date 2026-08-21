<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Registro de auditoría (traza inmutable de acciones sensibles).
 */
class AuditService
{
    public function log(
        ?int $userId,
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        ?array $details = null,
        ?string $ip = null,
        ?string $userAgent = null,
    ): void {
        try {
            AuditLog::create([
                'user_id' => $userId,
                'action' => $action,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'details' => $details,
                'ip' => $ip,
                'user_agent' => $userAgent,
            ]);
        } catch (\Throwable $e) {
            Log::error('audit_log_failed', ['error' => $e->getMessage()]);
        }
    }

    /** Registra la acción con contexto completo del request (actor, IP, UA). */
    public function fromRequest(Request $request, string $action, ?string $entityType = null, ?int $entityId = null, ?array $details = null): void
    {
        $user = $request->user();
        $this->log(
            $user?->id,
            $action,
            $entityType,
            $entityId,
            $details,
            $request->ip() ?? '',
            substr((string) $request->userAgent(), 0, 255)
        );
    }
}