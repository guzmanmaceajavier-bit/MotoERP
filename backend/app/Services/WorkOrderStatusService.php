<?php

namespace App\Services;

use App\Models\User;
use App\Models\WorkOrder;

/**
 * Autoridad única para las transiciones de estado de una orden de trabajo.
 *
 * Estados operativos (columna status) existentes en el proyecto.
 * Estados de cotización (columna quotation_status) se validan por separado.
 */
class WorkOrderStatusService
{
    /** Roles de contacto básicos para staff. */
    private const STAFF = ['admin', 'receptionist', 'mechanic'];

    /**
     * Mapa de transiciones permitidas (status) => [status destino => roles permitidos].
     */
    public function allowedTransitions(): array
    {
        return [
            'pending' => [
                'assigned' => ['admin', 'receptionist'],
                'in_progress' => ['admin', 'mechanic'],
                'awaiting_approval' => ['admin', 'mechanic'],
                'cancelled' => ['admin', 'receptionist'],
            ],
            'assigned' => [
                'in_progress' => ['admin', 'mechanic'],
                'awaiting_approval' => ['admin', 'mechanic'],
                'cancelled' => ['admin', 'receptionist'],
            ],
            'in_progress' => [
                'awaiting_approval' => ['admin', 'mechanic'],
                'completed' => ['admin', 'receptionist', 'mechanic'],
                'cancelled' => ['admin', 'receptionist'],
            ],
            'awaiting_approval' => [
                'approved' => ['admin', 'mechanic', 'customer'], // el dueño aprueba vía respondQuotation
                'in_progress' => ['admin', 'mechanic'],
                'cancelled' => ['admin', 'receptionist'],
            ],
            'approved' => [
                'in_progress' => ['admin', 'mechanic'],
                'completed' => ['admin', 'receptionist'],
                'cancelled' => ['admin', 'receptionist'],
            ],
            'completed' => [
                'delivered' => ['admin', 'receptionist'],
                'cancelled' => ['admin', 'receptionist'],
            ],
            // delivered y cancelled son terminales.
        ];
    }

    /** Transiciones de cotización (quotation_status). */
    public function quotationTransitions(): array
    {
        return [
            'draft' => ['pending', 'awaiting_approval', 'revision_requested'],
            'pending' => ['awaiting_approval', 'revision_requested'],
            'awaiting_approval' => ['approved', 'rejected', 'revision_requested'],
            'revision_requested' => ['awaiting_approval', 'rejected', 'approved'],
            'approved' => ['revision_requested', 'rejected'], // solo para corregir tras error
            'rejected' => ['awaiting_approval'], // permite re-cotizar y reenviar
        ];
    }

    public function canTransitionOperative(WorkOrder $order, string $to, User $actor): bool
    {
        $from = $order->status;
        $allowed = $this->allowedTransitions()[$from] ?? [];
        if (! isset($allowed[$to])) {
            return false;
        }

        return in_array($actor->role, $allowed[$to], true);
    }

    public function canTransitionQuotation(WorkOrder $order, string $to): bool
    {
        $allowed = $this->quotationTransitions()[$order->quotation_status ?? 'draft'] ?? [];

        return in_array($to, $allowed, true);
    }

    /**
     * Verifica y registra una transición de estado operativo.
     *
     * @param  string|null  $comment
     * @return \App\Models\WorkOrderStatus
     */
    public function applyOperative(WorkOrder $order, string $to, User $actor, ?string $comment = null)
    {
        if (! $this->canTransitionOperative($order, $to, $actor)) {
            abort(422, sprintf("Transición inválida de '%s' a '%s' para el rol '%s'", $order->status, $to, $actor->role));
        }

        $order->update([
            'status' => $to,
            'finished_at' => in_array($to, ['completed', 'delivered'], true) ? now() : $order->finished_at,
        ]);

        $status = $order->statuses()->create([
            'status' => $to,
            'comment' => $comment,
            'changed_by' => $actor->id,
        ]);

app(\App\Services\AuditService::class)->log(
            $actor->id,
            'work_order_status',
            'WorkOrder',
            $order->id,
            ['from' => $order->getOriginal('status'), 'to' => $to, 'comment' => $comment]
        );

        return $status;
    }
}