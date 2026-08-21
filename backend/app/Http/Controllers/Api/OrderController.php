<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\Paginates;
use App\Models\WorkOrder;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    use Paginates;

    public function myOrders(Request $request): JsonResponse
    {
        $query = $request->user()->workOrders()
            ->with(['motorcycle', 'motorcycle.brand', 'items', 'labors']);

        $status = $request->query('status');
        if (in_array($status, ['pending', 'in_progress', 'awaiting_approval', 'approved', 'completed', 'delivered', 'cancelled'], true)) {
            $query->where('status', $status);
        } elseif ($status === 'completed_group') {
            $query->whereIn('status', ['completed', 'delivered']);
        } elseif ($status === 'pending_group') {
            $query->whereIn('status', ['pending', 'awaiting_approval']);
        }

        $from = $request->query('from');
        if ($from && strtotime($from)) {
            $query->whereDate('created_at', '>=', $from);
        }
        $to = $request->query('to');
        if ($to && strtotime($to)) {
            $query->whereDate('created_at', '<=', $to);
        }

        $sort = $request->query('sort', 'newest');
        if ($sort === 'oldest') {
            $query->orderBy('id');
        } else {
            $query->orderByDesc('id');
        }

        $total = $query->toBase()->getCountForPagination();
        $items = $query->forPage($this->page($request), $this->perPage($request))
            ->get()->map(fn ($o) => $this->serialize($o));

        return response()->json($this->paginatePayload($items, $this->page($request), $this->perPage($request), $total));
    }

    /**
     * Devuelve las fechas reales de cada orden del cliente para el calendario:
     * creada, iniciada, finalizada y entrega estimada, junto a su estado.
     */
    public function myCalendar(Request $request): JsonResponse
    {
        $orders = $request->user()->workOrders()
            ->with(['motorcycle', 'motorcycle.brand'])
            ->orderByDesc('id')
            ->get()
            ->map(fn (WorkOrder $o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'status' => $o->status,
                'quotation_status' => $o->quotation_status,
                'service_type' => $o->service_type,
                'motorcycle' => $o->motorcycle ? [
                    'nickname' => $o->motorcycle->nickname,
                    'brand' => $o->motorcycle->brand?->name,
                ] : null,
                'created_at' => $o->created_at?->toDateString(),
                'started_at' => $o->started_at?->toDateString(),
                'finished_at' => $o->finished_at?->toDateString(),
                'estimated_delivery' => $o->estimated_delivery?->toDateString(),
            ]);

        return response()->json($orders);
    }

    public function show(Request $request, WorkOrder $order): JsonResponse
    {
        $this->authorizeOwner($request, $order);
        $order->load(['motorcycle', 'motorcycle.brand', 'mechanic', 'items', 'labors', 'statuses.changedBy']);

        return response()->json($this->serialize($order, true));
    }

    /**
     * PDF de la cotización para el cliente.
     */
    public function quotationPdf(Request $request, WorkOrder $order): \Illuminate\Http\Response
    {
        $this->authorizeOwner($request, $order);

        abort_unless($order->items->isNotEmpty() || $order->labors->isNotEmpty(), 422, 'La cotización aún no tiene desglose de costos.');

        $order->load(['motorcycle', 'motorcycle.brand', 'items', 'labors']);

        set_time_limit(120);
        $workshop = [
            'name' => \App\Support\Settings::get('workshop_name', config('app.name')),
            'address' => \App\Support\Settings::get('workshop_address', ''),
            'logo' => \App\Support\Settings::get('workshop_logo', ''),
            'phone' => \App\Support\Settings::get('workshop_phone', ''),
            'email' => \App\Support\Settings::get('workshop_email', ''),
        ];

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.quotation', [
            'order' => $order,
            'workshop' => $workshop,
        ]);

        return $pdf->download("cotizacion-{$order->order_number}.pdf");
    }

    /**
     * Permite al cliente cancelar su propia orden SOLO mientras esté pendiente
     * de asignación y sin cotización emitida. Marca como cancelada (no borra).
     */
    public function cancelOwnOrder(Request $request, WorkOrder $order): JsonResponse
    {
        $this->authorizeOwner($request, $order);

        abort_if($order->status !== 'pending', 422, 'Solo puedes cancelar una orden que aún esté pendiente de asignación.');
        abort_if(! in_array($order->quotation_status, ['draft', 'pending', null], true), 422, 'Tu cotización ya está en curso. Escríbenos al taller para gestionarla.');

        $order->update(['status' => 'cancelled', 'finished_at' => now()]);
        $this->recordStatus($order, 'cancelled', 'Cancelada por el cliente', $request->user());

        app(\App\Services\NotificationService::class)->notify(
            $request->user(),
            'Orden cancelada',
            "Tu solicitud \"{$order->service_type}\" ({$order->order_number}) fue cancelada. Si quieres agendar algo más, crea una nueva orden.",
            'info',
            ['channel' => 'order']
        );

        return response()->json($this->serialize($order->load([
            'motorcycle', 'motorcycle.brand', 'mechanic', 'items', 'labors', 'statuses.changedBy',
        ]), true));
    }

    public function respondQuotation(Request $request, WorkOrder $order): JsonResponse
    {
        $this->authorizeOwner($request, $order);

        $validated = $request->validate([
            'decision' => 'required|in:approved,rejected,modification_requested',
            'notes' => 'nullable|string',
        ]);

        if ($order->quotation_status !== 'awaiting_approval') {
            return response()->json(['message' => 'La cotización no está pendiente de aprobación'], 422);
        }

        $statusService = app(\App\Services\WorkOrderStatusService::class);
        $wasApproved = $order->status === 'approved';

        \Illuminate\Support\Facades\DB::transaction(function () use ($request, $order, $validated, $statusService, $wasApproved) {
            $order->update([
                'quotation_status' => $validated['decision'],
                'quotation_resolved_at' => now(),
                'customer_response_notes' => $validated['notes'] ?? null,
            ]);

            $this->recordStatus($order, $validated['decision'], $validated['notes'] ?? 'Cotización ' . $validated['decision'], $request->user());

            if ($validated['decision'] === 'approved') {
                $statusService->applyOperative($order, 'approved', $request->user(), 'Cotización aprobada');
                $this->reserveOrderStock($order, $request->user()->id);
                app(\App\Services\QuotationService::class)->markLatest($order, 'approved');
            } else {
                // Rechazada o en revisión tras una aprobación previa: se libera stock.
                app(\App\Services\QuotationService::class)->markLatest(
                    $order,
                    $validated['decision'] === 'modification_requested' ? 'modification_requested' : 'rejected',
                    $validated['notes'] ?? null
                );
                if ($wasApproved) {
                    $this->releaseOrderStock($order, $request->user()->id);
                }
                if ($wasApproved || $order->status === 'approved') {
                    $order->update(['status' => 'awaiting_approval']);
                }
            }
            app(\App\Services\AuditService::class)->fromRequest(
                $request,
                'quotation_responded',
                'WorkOrder',
                $order->id,
                ['decision' => $validated['decision'], 'notes' => $validated['notes'] ?? null]
            );
        });

        if ($validated['decision'] === 'approved') {
            app(NotificationService::class)->quotationApproved($order);
        }

        $order->load(['items', 'labors']);

        return response()->json($this->serialize($order, true));
    }

    /**
     * Reserva el inventario de los repuestos de una cotización aprobada.
     * Solo incrementa "reserved"; el físico se descuenta al facturar.
     * Usa InventoryService (bloqueo + invariantes). Si falta stock, aborta.
     */
    private function reserveOrderStock(WorkOrder $order, int $userId): void
    {
        $service = app(\App\Services\InventoryService::class);
        foreach ($order->items as $item) {
            if (! $item->product_id) {
                continue;
            }
            $service->reserve($item->product_id, $item->quantity, [
                'order_id' => $order->id,
                'reference' => $order->order_number,
                'user_id' => $userId,
                'note' => 'Reserva por aprobación de cotización',
            ]);
        }
    }

    /**
     * Libera las reservas de los repuestos de una orden (rechazo, cancelación o
     * cotización que ya no avanza).
     */
    private function releaseOrderStock(WorkOrder $order, int $userId): void
    {
        $service = app(\App\Services\InventoryService::class);
        foreach ($order->items as $item) {
            if (! $item->product_id) {
                continue;
            }
            $service->release($item->product_id, $item->quantity, [
                'order_id' => $order->id,
                'reference' => $order->order_number,
                'user_id' => $userId,
                'note' => 'Liberación de reserva',
            ]);
        }
    }

    private function recordStatus(WorkOrder $order, string $status, ?string $comment, $user): void
    {
        $order->statuses()->create([
            'status' => $status,
            'comment' => $comment,
            'changed_by' => $user->id,
        ]);
    }

    private function authorizeOwner(Request $request, WorkOrder $order): void
    {
        abort_if($order->user_id !== $request->user()->id, 403, 'No autorizado');
    }

    private function serialize(WorkOrder $o, bool $withDetails = false): array
    {
        $data = [
            'id' => $o->id,
            'order_number' => $o->order_number,
            'status' => $o->status,
            'quotation_status' => $o->quotation_status,
            'service_type' => $o->service_type,
            'diagnosis' => $o->diagnosis,
            'observations' => $o->observations,
            'created_at' => $o->created_at?->toDateTimeString(),
            'estimated_delivery' => $o->estimated_delivery?->toDateString(),
            'motorcycle' => $o->motorcycle ? [
                'id' => $o->motorcycle->id,
                'nickname' => $o->motorcycle->nickname,
                'plate' => $o->motorcycle->plate,
                'brand' => $o->motorcycle->brand?->name,
            ] : null,
            'mechanic' => $o->mechanic ? [
                'id' => $o->mechanic->id,
                'name' => $o->mechanic->name,
            ] : null,
        ];

        if ($withDetails) {
            $data['quotation_total'] = round($o->quotation_subtotal, 2);
            $data['customer_response_notes'] = $o->customer_response_notes;
            $data['odometer_in'] = $o->odometer_in;
            $data['items'] = $o->items->map(fn ($i) => [
                'description' => $i->description,
                'quantity' => $i->quantity,
                'unit_price' => (float) $i->unit_price,
                'total' => round($i->quantity * $i->unit_price, 2),
            ]);
            $data['labors'] = $o->labors->map(fn ($l) => [
                'description' => $l->description,
                'hours' => (float) $l->hours,
                'amount' => (float) $l->amount,
            ]);
            $data['timeline'] = $o->statuses->map(fn ($s) => [
                'status' => $s->status,
                'comment' => $s->comment,
                'created_at' => $s->created_at?->toDateTimeString(),
                'changed_by' => $s->changedBy?->name,
            ]);
        }

        return $data;
    }

    public function quotationHistory(Request $request, WorkOrder $order): JsonResponse
    {
        $staffRoles = ['admin', 'receptionist', 'mechanic'];
        $isStaff = in_array($request->user()->role, $staffRoles, true);
        if (! $isStaff && $order->user_id !== $request->user()->id) {
            abort(403, 'No autorizado');
        }

        $versions = app(\App\Services\QuotationService::class)->versionsFor($order)->map(function ($v) {
            return [
                'version' => $v->version,
                'status' => $v->status,
                'reason' => $v->reason,
                'created_at' => $v->created_at?->toDateTimeString(),
                'created_by' => $v->author?->name,
                'parts_total' => $v->parts_total,
                'labor_total' => $v->labor_total,
                'subtotal' => $v->subtotal,
                'tax' => $v->tax,
                'total' => $v->total,
                'items' => $v->items,
                'labors' => $v->labors,
            ];
        });

        return response()->json([
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'quotation_status' => $order->quotation_status,
            'versions' => $versions,
        ]);
    }

    public static function generateOrderNumber(): string
    {
        do {
            $number = 'ORD-' . strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ'), 0, 2)) . '-' . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        } while (WorkOrder::where('order_number', $number)->exists());

        return $number;
    }
}