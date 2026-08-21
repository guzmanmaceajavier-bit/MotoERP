<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\Paginates;
use App\Models\Invoice;
use App\Models\LoyaltyPoint;
use App\Models\Payment;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warranty;
use App\Models\WorkOrder;
use App\Services\InventoryService;
use App\Services\NotificationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class InvoiceController extends Controller
{
    use Paginates;

    // ---------- Facturas (cliente) ----------

    /**
     * PDF de una factura para el staff (ventas de mostrador/tienda y órdenes).
     */
    public function staffSalePdf(Request $request, Invoice $invoice): \Illuminate\Http\Response
    {
        if (! in_array($request->user()->role, ['admin', 'receptionist'])) {
            abort(403, 'No autorizado');
        }

        $invoice->load(['items', 'payments', 'user']);

        set_time_limit(120);
        $workshop = [
            'name' => \App\Support\Settings::get('workshop_name', config('app.name')),
            'address' => \App\Support\Settings::get('workshop_address', ''),
            'logo' => \App\Support\Settings::get('workshop_logo', ''),
            'phone' => \App\Support\Settings::get('workshop_phone', ''),
            'email' => \App\Support\Settings::get('workshop_email', ''),
        ];
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.invoice', ['invoice' => $invoice, 'workshop' => $workshop]);

        return $pdf->download("factura-{$invoice->invoice_number}.pdf");
    }

    public function myInvoices(Request $request): JsonResponse
    {
        $query = Invoice::with('items')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id');

        $source = $request->query('source');
        if ($source === 'store') {
            $query->whereNull('work_order_id');
        } elseif ($source === 'service') {
            $query->whereNotNull('work_order_id');
        }

        $status = $request->query('status');
        if (in_array($status, ['paid', 'partial', 'unpaid', 'pending'], true)) {
            $query->where('status', $status);
        }

        $orderStatus = $request->query('order_status');
        if (in_array($orderStatus, ['pending', 'payment_review', 'confirmed', 'shipped', 'delivered', 'cancelled'], true)) {
            $query->where('order_status', $orderStatus);
        }

        if ($request->filled('from')) {
            $query->whereDate('issue_date', '>=', (string) $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('issue_date', '<=', (string) $request->query('to'));
        }

        $term = trim((string) $request->query('term'));
        if ($term !== '') {
            $query->where('invoice_number', 'ilike', '%' . $term . '%');
        }

        $withItems = $request->boolean('with_items');
        $page = $this->page($request);
        $perPage = $this->perPage($request);

        $total = $query->toBase()->getCountForPagination();
        $rows = $query->forPage($page, $perPage)->get();

        // Mapa nombre-producto => imagen para resolver miniaturas de los ítems
        $images = $this->itemImages($rows);

        $items = $rows->map(fn ($i) => $this->serialize($i, $withItems, $images));

        // Totales globales reales (de TODAS las facturas del cliente, sin paginar)
        $totQ = Invoice::where('user_id', $request->user()->id);
        if ($source === 'store') {
            $totQ->whereNull('work_order_id');
        } elseif ($source === 'service') {
            $totQ->whereNotNull('work_order_id');
        }
        $totals = [
            'orders' => (clone $totQ)->count(),
            'total_spent' => round((float) (clone $totQ)->sum('total'), 2),
            'this_month' => (clone $totQ)
                ->whereBetween('issue_date', [now()->startOfMonth(), now()->endOfMonth()])
                ->count(),
            'outstanding' => (clone $totQ)->whereIn('status', ['unpaid', 'partial'])->count(),
        ];

        return response()->json([
            ...$this->paginatePayload($items, $page, $perPage, $total),
            'totals' => $totals,
        ]);
    }

    /**
     * Exporta el historial del cliente a CSV (compatible con Excel).
     * Respeta los mismos filtros que myInvoices (source, status, term, from, to).
     */
    public function exportCsv(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $query = Invoice::with('items')
            ->where('user_id', $request->user()->id)
            ->orderBy('issue_date');

        $source = $request->query('source');
        if ($source === 'store') {
            $query->whereNull('work_order_id');
        } elseif ($source === 'service') {
            $query->whereNotNull('work_order_id');
        }

        $status = $request->query('status');
        if (in_array($status, ['paid', 'partial', 'unpaid', 'pending'], true)) {
            $query->where('status', $status);
        }

        if ($request->filled('from')) {
            $query->whereDate('issue_date', '>=', (string) $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('issue_date', '<=', (string) $request->query('to'));
        }

        $term = trim((string) $request->query('term'));
        if ($term !== '') {
            $query->where('invoice_number', 'ilike', '%' . $term . '%');
        }

        $invoices = $query->get();

        $statusLabels = ['paid' => 'Pagado', 'partial' => 'Abonado', 'unpaid' => 'Pendiente', 'pending' => 'Pendiente'];

        return response()->streamDownload(function () use ($invoices, $statusLabels) {
            $out = fopen('php://output', 'w');

            // BOM para que Excel detecte UTF-8
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, ['N° Factura', 'Fecha', 'Tipo', 'Método', 'Estado', 'Abonado', 'Total', 'Saldo', 'Detalle']);

            foreach ($invoices as $i) {
                $detail = $i->items->map(fn ($it) => $it->quantity . 'x ' . $it->description . ($it->variant ? ' (' . $it->variant . ')' : ''))->implode(' | ');
                fputcsv($out, [
                    $i->invoice_number,
                    $i->issue_date?->toDateString() ?? '',
                    $i->work_order_id ? 'Servicio' : 'Tienda',
                    $i->payment_method ?? '',
                    $statusLabels[$i->status] ?? $i->status,
                    number_format((float) $i->paid_amount, 2, ',', '.'),
                    number_format((float) $i->total, 2, ',', '.'),
                    number_format((float) $i->outstanding, 2, ',', '.'),
                    $detail,
                ]);
            }

            if ($invoices->isNotEmpty()) {
                fputcsv($out, [
                    'TOTAL', '', '', '',
                    '',
                    number_format((float) $invoices->sum('paid_amount'), 2, ',', '.'),
                    number_format((float) $invoices->sum('total'), 2, ',', '.'),
                    number_format((float) $invoices->sum('outstanding'), 2, ',', '.'),
                    $invoices->count() . ' facturas',
                ]);
            }

            fclose($out);
        }, 'historial-pedidos.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Línea de tiempo unificada del cliente: facturas de tienda, facturas de
     * servicio, órdenes de trabajo y movimientos de puntos, en un solo feed
     * cronológico descendente. Respeta source, from, to y term.
     */
    public function myTimeline(Request $request): JsonResponse
    {
        $user = $request->user();
        $source = $request->query('source', 'all'); // all|store|service|points
        $status = $request->query('status');
        $from = (string) $request->query('from');
        $to = (string) $request->query('to');
        $term = trim((string) $request->query('term'));

        $events = collect();

        // ---- Facturas (tienda y/o servicio) ----
        $inScope = in_array($source, ['all', 'store', 'service'], true);
        if ($inScope) {
            $invQ = Invoice::with('items')->where('user_id', $user->id);
            if ($source === 'store') {
                $invQ->whereNull('work_order_id');
            } elseif ($source === 'service') {
                $invQ->whereNotNull('work_order_id');
            }

            $invoiceStatuses = ['paid', 'partial', 'unpaid', 'pending'];
            if (in_array($status, $invoiceStatuses, true)) {
                $invQ->where('status', $status);
            }
            if ($from !== '') {
                $invQ->whereDate('issue_date', '>=', $from);
            }
            if ($to !== '') {
                $invQ->whereDate('issue_date', '<=', $to);
            }
            if ($term !== '') {
                $invQ->where('invoice_number', 'ilike', '%' . $term . '%');
            }

            $invoices = $invQ->get();
            $images = $this->itemImages($invoices);
            $statusLabels = ['paid' => 'Pagado', 'partial' => 'Abonado', 'unpaid' => 'Pendiente', 'pending' => 'Pendiente'];

            foreach ($invoices as $i) {
                $items = $i->items->map(fn ($it) => [
                    'description' => $it->description,
                    'variant' => $it->variant,
                    'quantity' => $it->quantity,
                    'unit_price' => (float) $it->unit_price,
                    'total' => (float) $it->total,
                    'image' => $images[mb_strtolower(trim((string) $it->description))] ?? null,
                ])->values();

                $events->push([
                    'type' => 'invoice',
                    'source' => $i->work_order_id ? 'service' : 'store',
                    'event_id' => 'inv-' . $i->id,
                    'id' => $i->id,
                    'date' => $i->issue_date?->toDateString(),
                    'reference' => $i->invoice_number,
                    'title' => $i->work_order_id ? 'Servicio de taller' : 'Compra en tienda',
                    'subtitle' => $items->take(2)->map(fn ($it) => $it['quantity'] . 'x ' . $it['description'])->implode(' · '),
                    'status' => $i->status,
                    'status_label' => $statusLabels[$i->status] ?? $i->status,
                    'amount' => (float) $i->total,
                    'paid_amount' => (float) $i->paid_amount,
                    'outstanding' => (float) $i->outstanding,
                    'points' => null,
                    'thumbnail' => $items->first(fn ($it) => ! empty($it['image']))['image'] ?? null,
                    'items' => $items,
                    'items_count' => $items->count(),
                    'detail' => ['payment_method' => $i->payment_method],
                ]);
            }
        }

        // ---- Órdenes de trabajo (servicios) ----
        if (in_array($source, ['all', 'service'], true)) {
            $ordQ = $user->workOrders()
                ->with(['motorcycle', 'motorcycle.brand']);

            $orderStatuses = ['pending', 'in_progress', 'awaiting_approval', 'approved', 'completed', 'delivered', 'cancelled'];
            if (in_array($status, $orderStatuses, true)) {
                $ordQ->where('status', $status);
            }
            if ($from !== '') {
                $ordQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ordQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ordQ->where('order_number', 'ilike', '%' . $term . '%');
            }

            foreach ($ordQ->get() as $o) {
                $events->push([
                    'type' => 'order',
                    'source' => 'service',
                    'event_id' => 'ord-' . $o->id,
                    'id' => $o->id,
                    'date' => $o->created_at?->toDateString(),
                    'reference' => $o->order_number,
                    'title' => $o->service_type,
                    'subtitle' => $o->motorcycle ? $o->motorcycle->nickname . ($o->motorcycle->plate ? ' · ' . $o->motorcycle->plate : '') : 'Sin moto asignada',
                    'status' => $o->status,
                    'status_label' => $o->status,
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => [
                        'quotation_status' => $o->quotation_status,
                        'estimated_delivery' => $o->estimated_delivery?->toDateString(),
                        'motorcycle' => $o->motorcycle ? [
                            'nickname' => $o->motorcycle->nickname,
                            'plate' => $o->motorcycle->plate,
                            'brand' => $o->motorcycle->brand?->name,
                        ] : null,
                    ],
                ]);
            }
        }

        // ---- Citas agendadas ----
        if (in_array($source, ['all', 'service'], true)) {
            $apptQ = \App\Models\Appointment::where('user_id', $user->id);
            if ($from !== '') {
                $apptQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $apptQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $apptQ->where(function ($q) use ($term) {
                    $q->where('name', 'ilike', '%' . $term . '%')
                        ->orWhere('service_type', 'ilike', '%' . $term . '%')
                        ->orWhere('status', 'ilike', '%' . $term . '%');
                });
            }

            $apptLabels = ['pending' => 'Pendiente', 'confirmed' => 'Confirmada', 'completed' => 'Atendida', 'cancelled' => 'Cancelada', 'no_show' => 'No asistió'];
            foreach ($apptQ->get() as $a) {
                $events->push([
                    'type' => 'appointment',
                    'source' => 'service',
                    'event_id' => 'appt-' . $a->id,
                    'id' => $a->id,
                    'date' => $a->created_at?->toDateString(),
                    'reference' => null,
                    'title' => 'Cita agendada',
                    'subtitle' => $a->service_type ?: 'Servicio del taller',
                    'status' => $a->status,
                    'status_label' => $apptLabels[$a->status] ?? $a->status,
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => [
                        'scheduled_at' => $a->date?->toDateString() . ' · ' . substr((string) $a->time, 0, 5),
                        'notes' => $a->notes,
                    ],
                ]);
            }
        }

        // ---- Favoritos de tienda ----
        if (in_array($source, ['all', 'store'], true)) {
            $favQ = \App\Models\Favorite::with('product')->where('user_id', $user->id);
            if ($from !== '') {
                $favQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $favQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $favQ->whereHas('product', fn ($q) => $q->where('name', 'ilike', '%' . $term . '%'));
            }

            foreach ($favQ->get() as $f) {
                $events->push([
                    'type' => 'favorite',
                    'source' => 'store',
                    'event_id' => 'fav-' . $f->id,
                    'id' => $f->id,
                    'date' => $f->created_at?->toDateString(),
                    'reference' => null,
                    'title' => 'Agregado a favoritos',
                    'subtitle' => $f->product?->name ?: 'Producto de la tienda',
                    'status' => 'saved',
                    'status_label' => 'Favorito',
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => $f->product?->image ?: null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => [],
                ]);
            }
        }

        // ---- Valoraciones de servicios ----
        if (in_array($source, ['all', 'service'], true)) {
            $ratQ = \App\Models\Rating::where('user_id', $user->id);
            if ($from !== '') {
                $ratQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ratQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ratQ->where('comment', 'ilike', '%' . $term . '%');
            }

            foreach ($ratQ->get() as $r) {
                $events->push([
                    'type' => 'rating',
                    'source' => 'service',
                    'event_id' => 'rat-' . $r->id,
                    'id' => $r->id,
                    'date' => $r->created_at?->toDateString(),
                    'reference' => null,
                    'title' => 'Valoraste un servicio',
                    'subtitle' => str_repeat('★', (int) $r->score) . str_repeat('☆', 5 - (int) $r->score) . ($r->comment ? ' · ' . $r->comment : ''),
                    'status' => 'rated',
                    'status_label' => $r->score . '/5',
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => ['score' => (int) $r->score, 'comment' => $r->comment],
                ]);
            }
        }

        // ---- Motos registradas en el garaje ----
        if (in_array($source, ['all', 'service'], true)) {
            $motoQ = \App\Models\Motorcycle::with(['brand', 'model'])->where('user_id', $user->id);
            if ($from !== '') {
                $motoQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $motoQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $motoQ->where(function ($q) use ($term) {
                    $q->where('nickname', 'ilike', '%' . $term . '%')
                        ->orWhere('plate', 'ilike', '%' . $term . '%');
                });
            }

            foreach ($motoQ->get() as $m) {
                $events->push([
                    'type' => 'motorcycle',
                    'source' => 'service',
                    'event_id' => 'moto-' . $m->id,
                    'id' => $m->id,
                    'date' => $m->created_at?->toDateString(),
                    'reference' => null,
                    'title' => 'Moto registrada',
                    'subtitle' => collect([$m->brand?->name, $m->nickname, $m->plate])->filter()->implode(' · '),
                    'status' => 'saved',
                    'status_label' => 'Garaje',
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => ['year' => $m->year, 'color' => $m->color],
                ]);
            }
        }

        // ---- Movimientos de puntos ----
        if (in_array($source, ['all', 'points'], true)) {
            $ptQ = LoyaltyPoint::where('user_id', $user->id);
            if ($from !== '') {
                $ptQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ptQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ptQ->where('concept', 'ilike', '%' . $term . '%');
            }

            foreach ($ptQ->get() as $p) {
                $events->push([
                    'type' => 'points',
                    'source' => 'points',
                    'event_id' => 'pts-' . $p->id,
                    'id' => $p->id,
                    'date' => $p->created_at?->toDateString(),
                    'reference' => null,
                    'title' => $p->points >= 0 ? 'Puntos ganados' : 'Canje de puntos',
                    'subtitle' => $p->concept,
                    'status' => $p->points >= 0 ? 'earned' : 'spent',
                    'status_label' => $p->points >= 0 ? 'Ganados' : 'Canjeados',
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => (int) $p->points,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => ['balance_after' => $p->balance_after],
                ]);
            }
        }

        // Orden cronológico descendente (los nulos al final)
        $events = $events->sortByDesc('date')->values();

        $page = $this->page($request);
        $perPage = $this->perPage($request);

        // Totales globales de facturas (sin paginar), igual que myInvoices
        $totQ = Invoice::where('user_id', $user->id);
        if ($source === 'store') {
            $totQ->whereNull('work_order_id');
        } elseif ($source === 'service') {
            $totQ->whereNotNull('work_order_id');
        }
        $totals = [
            'orders' => (clone $totQ)->count(),
            'total_spent' => round((float) (clone $totQ)->sum('total'), 2),
            'this_month' => (clone $totQ)
                ->whereBetween('issue_date', [now()->startOfMonth(), now()->endOfMonth()])
                ->count(),
            'outstanding' => (clone $totQ)->whereIn('status', ['unpaid', 'partial'])->count(),
        ];

        return response()->json([
            ...$this->paginateCollection($events, $perPage, $page),
            'totals' => $totals,
            'points_balance' => (int) $user->points_balance,
        ]);
    }

    /**
     * Exporta la línea de tiempo unificada a CSV (compatible con Excel),
     * ordenada por fecha ascendente, respetando los mismos filtros de myTimeline.
     */
    public function timelineExport(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $user = $request->user();
        $source = $request->query('source', 'all');
        $status = $request->query('status');
        $from = (string) $request->query('from');
        $to = (string) $request->query('to');
        $term = trim((string) $request->query('term'));

        $events = collect();

        $invoiceStatuses = ['paid', 'partial', 'unpaid', 'pending'];
        $orderStatuses = ['pending', 'in_progress', 'awaiting_approval', 'approved', 'completed', 'delivered', 'cancelled'];

        if (in_array($source, ['all', 'store', 'service'], true)) {
            $invQ = Invoice::with('items')->where('user_id', $user->id);
            if ($source === 'store') {
                $invQ->whereNull('work_order_id');
            } elseif ($source === 'service') {
                $invQ->whereNotNull('work_order_id');
            }
            if (in_array($status, $invoiceStatuses, true)) {
                $invQ->where('status', $status);
            }
            if ($from !== '') {
                $invQ->whereDate('issue_date', '>=', $from);
            }
            if ($to !== '') {
                $invQ->whereDate('issue_date', '<=', $to);
            }
            if ($term !== '') {
                $invQ->where('invoice_number', 'ilike', '%' . $term . '%');
            }

            $statusLabels = ['paid' => 'Pagado', 'partial' => 'Abonado', 'unpaid' => 'Pendiente', 'pending' => 'Pendiente'];
            foreach ($invQ->get() as $i) {
                $events->push([
                    'date' => $i->issue_date?->toDateString() ?? '',
                    'type' => $i->work_order_id ? 'Servicio' : 'Tienda',
                    'reference' => $i->invoice_number,
                    'detail' => $i->items->map(fn ($it) => $it->quantity . 'x ' . $it->description . ($it->variant ? ' (' . $it->variant . ')' : ''))->implode(' | '),
                    'status' => $statusLabels[$i->status] ?? $i->status,
                    'amount' => (float) $i->total,
                    'paid' => (float) $i->paid_amount,
                    'outstanding' => (float) $i->outstanding,
                    'points' => '',
                ]);
            }
        }

        if (in_array($source, ['all', 'service'], true)) {
            $ordQ = $user->workOrders()->with(['motorcycle', 'motorcycle.brand']);
            if (in_array($status, $orderStatuses, true)) {
                $ordQ->where('status', $status);
            }
            if ($from !== '') {
                $ordQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ordQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ordQ->where('order_number', 'ilike', '%' . $term . '%');
            }

            $orderLabels = [
                'pending' => 'Pendiente',
                'in_progress' => 'En taller',
                'awaiting_approval' => 'Esperando aprobación',
                'approved' => 'Aprobada',
                'completed' => 'Completada',
                'delivered' => 'Entregada',
                'cancelled' => 'Cancelada',
            ];

            foreach ($ordQ->get() as $o) {
                $events->push([
                    'date' => $o->created_at?->toDateString() ?? '',
                    'type' => 'Orden de servicio',
                    'reference' => $o->order_number,
                    'detail' => $o->service_type . ($o->motorcycle ? ' · ' . $o->motorcycle->nickname : ''),
                    'status' => $orderLabels[$o->status] ?? $o->status,
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }
        }

        if (in_array($source, ['all', 'points'], true)) {
            $ptQ = LoyaltyPoint::where('user_id', $user->id);
            if ($from !== '') {
                $ptQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ptQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ptQ->where('concept', 'ilike', '%' . $term . '%');
            }

            foreach ($ptQ->get() as $p) {
                $events->push([
                    'date' => $p->created_at?->toDateString() ?? '',
                    'type' => $p->points >= 0 ? 'Puntos ganados' : 'Canje de puntos',
                    'reference' => '',
                    'detail' => $p->concept,
                    'status' => $p->points >= 0 ? 'Ganados' : 'Canjeados',
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => (int) $p->points,
                ]);
            }
        }

        if (in_array($source, ['all', 'service'], true)) {
            foreach (\App\Models\Appointment::where('user_id', $user->id)->get() as $a) {
                if ($from !== '' && $a->created_at && $a->created_at->toDateString() < $from) {
                    continue;
                }
                if ($to !== '' && $a->created_at && $a->created_at->toDateString() > $to) {
                    continue;
                }
                $events->push([
                    'date' => $a->created_at?->toDateString() ?? '',
                    'type' => 'Cita agendada',
                    'reference' => '',
                    'detail' => ($a->service_type ?: 'Servicio') . ($a->date ? ' (' . $a->date->toDateString() . ' ' . substr((string) $a->time, 0, 5) . ')' : ''),
                    'status' => $a->status,
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }

            foreach (\App\Models\Rating::where('user_id', $user->id)->get() as $r) {
                if ($from !== '' && $r->created_at && $r->created_at->toDateString() < $from) {
                    continue;
                }
                if ($to !== '' && $r->created_at && $r->created_at->toDateString() > $to) {
                    continue;
                }
                $events->push([
                    'date' => $r->created_at?->toDateString() ?? '',
                    'type' => 'Valoración',
                    'reference' => '',
                    'detail' => str_repeat('★', (int) $r->score) . str_repeat('☆', 5 - (int) $r->score) . ($r->comment ? ' · ' . $r->comment : ''),
                    'status' => $r->score . '/5',
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }

            foreach (\App\Models\Motorcycle::with('brand')->where('user_id', $user->id)->get() as $m) {
                if ($from !== '' && $m->created_at && $m->created_at->toDateString() < $from) {
                    continue;
                }
                if ($to !== '' && $m->created_at && $m->created_at->toDateString() > $to) {
                    continue;
                }
                $events->push([
                    'date' => $m->created_at?->toDateString() ?? '',
                    'type' => 'Moto registrada',
                    'reference' => '',
                    'detail' => collect([$m->brand?->name, $m->nickname, $m->plate])->filter()->implode(' · '),
                    'status' => 'Garaje',
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }
        }

        if (in_array($source, ['all', 'store'], true)) {
            $favQ = \App\Models\Favorite::with('product')->where('user_id', $user->id);
            if ($from !== '') {
                $favQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $favQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $favQ->whereHas('product', fn ($q) => $q->where('name', 'ilike', '%' . $term . '%'));
            }

            foreach ($favQ->get() as $f) {
                $events->push([
                    'date' => $f->created_at?->toDateString() ?? '',
                    'type' => 'Favorito',
                    'reference' => '',
                    'detail' => $f->product?->name ?: 'Producto de la tienda',
                    'status' => 'Favorito',
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }
        }

        $events = $events->sortBy('date')->values();

        return response()->streamDownload(function () use ($events) {
            $out = fopen('php://output', 'w');

            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, ['Fecha', 'Tipo', 'Referencia', 'Detalle', 'Estado', 'Total', 'Abonado', 'Saldo', 'Puntos']);

            foreach ($events as $e) {
                fputcsv($out, [
                    $e['date'],
                    $e['type'],
                    $e['reference'],
                    $e['detail'],
                    $e['status'],
                    $e['amount'] === '' ? '' : number_format((float) $e['amount'], 2, ',', '.'),
                    $e['paid'] === '' ? '' : number_format((float) $e['paid'], 2, ',', '.'),
                    $e['outstanding'] === '' ? '' : number_format((float) $e['outstanding'], 2, ',', '.'),
                    $e['points'] === '' ? '' : (string) $e['points'],
                ]);
            }

            if ($events->isNotEmpty()) {
                fputcsv($out, [
                    'TOTAL',
                    '',
                    '',
                    $events->count() . ' movimientos',
                    '',
                    number_format((float) $events->sum(fn ($e) => $e['amount'] === '' ? 0 : (float) $e['amount']), 2, ',', '.'),
                    number_format((float) $events->sum(fn ($e) => $e['paid'] === '' ? 0 : (float) $e['paid']), 2, ',', '.'),
                    number_format((float) $events->sum(fn ($e) => $e['outstanding'] === '' ? 0 : (float) $e['outstanding']), 2, ',', '.'),
                    (string) $events->sum(fn ($e) => $e['points'] === '' ? 0 : (int) $e['points']),
                ]);
            }

            fclose($out);
        }, 'historial-actividad.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Mapa descripción (normalizada) => URL de imagen del producto, para mostrar
     * miniaturas en los pedidos del cliente. Los ítems de factura guardan la
     * descripción del producto al momento de la venta.
     */
    private function itemImages(Collection $invoices): array
    {
        $names = $invoices
            ->flatMap(fn ($i) => $i->items->pluck('description'))
            ->map(fn ($d) => mb_strtolower(trim((string) $d)))
            ->unique()
            ->filter()
            ->values();

        if ($names->isEmpty()) {
            return [];
        }

        return Product::whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(TRIM(name))'), $names)
            ->get(['name', 'image'])
            ->mapWithKeys(fn ($p) => [mb_strtolower(trim($p->name)) => $p->image])
            ->filter()
            ->all();
    }

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizeOwnership($request, $invoice);
        $invoice->load(['items', 'payments', 'workOrder.warranties']);

        return response()->json($this->serialize($invoice, true));
    }

    public function downloadPdf(Request $request, Invoice $invoice): \Illuminate\Http\Response
    {
        $this->authorizeOwnership($request, $invoice);
        $invoice->load(['items', 'payments', 'workOrder.warranties']);

        set_time_limit(120);

        return $this->pdfFor($invoice)->download("factura-{$invoice->invoice_number}.pdf");
    }

    private function pdfFor(Invoice $invoice): \Barryvdh\DomPDF\Facade\Pdf
    {
        $workshop = [
            'name' => \App\Support\Settings::get('workshop_name', config('app.name')),
            'address' => \App\Support\Settings::get('workshop_address', ''),
            'logo' => \App\Support\Settings::get('workshop_logo', ''),
            'phone' => \App\Support\Settings::get('workshop_phone', ''),
            'email' => \App\Support\Settings::get('workshop_email', ''),
        ];

        return Pdf::loadView('pdf.invoice', ['invoice' => $invoice, 'workshop' => $workshop]);
    }

    // ---------- Generación de factura a partir de orden (staff) ----------

    public function generateFromOrder(Request $request, WorkOrder $order): JsonResponse
    {
        $order->load(['items', 'labors', 'user']);

        if (! $order->user_id) {
            return response()->json(['message' => 'La orden no tiene cliente asociado'], 422);
        }

        // Idempotencia: una orden solo genera una factura (parcial o total).
        $existing = \App\Models\Invoice::where('work_order_id', $order->id)->first();
        if ($existing) {
            return response()->json([
                'message' => 'La orden ya tiene una factura asociada (' . $existing->invoice_number . '). Haz un abono desde la factura existente.',
                'invoice' => $this->serialize($existing->load(['items', 'user', 'payments']), true),
            ], 200);
        }

        $partsTotal = (float) $order->items->sum(fn ($i) => $i->quantity * $i->unit_price);
        $laborTotal = (float) $order->labors->sum('amount');
        $subtotal = $partsTotal + $laborTotal;

        $validated = $request->validate([
            'payment_method' => 'nullable|in:efectivo,transferencia,tarjeta',
            'amount_paid' => 'nullable|numeric|min:0',
            'points_to_use' => 'nullable|integer|min:0',
            'discount' => 'nullable|numeric|min:0|max:100',
        ]);

        $pointsValue = (float) config('points.value', 100);
        $taxRate = (float) (\App\Support\Settings::get('tax_rate') ?? 18);

        // Descuento por convenio / especial (porcentaje)
        $manualPercent = (float) ($validated['discount'] ?? 0);
        $manualDiscount = round($subtotal * ($manualPercent / 100), 2);

        // Si se paga de contado (abono ≥ total) se pueden usar puntos; en abonos parciales no.
        $requestedPaid = (float) ($validated['amount_paid'] ?? ($subtotal - $manualDiscount));
        $fullPayment = $requestedPaid >= ($subtotal - $manualDiscount);

        $pointsToUse = 0;
        $pointsDiscount = 0;
        $discount = $manualDiscount;

        if ($fullPayment) {
            $availablePoints = (int) $order->user->points_balance;
            $pointsToUse = (int) ($validated['points_to_use'] ?? 0);
            $pointsToUse = min($pointsToUse, $availablePoints);
            $maxPoints = (int) floor(($subtotal - $manualDiscount) / $pointsValue);
            $pointsToUse = min($pointsToUse, $maxPoints);
            $pointsDiscount = $pointsToUse * $pointsValue;
            $discount = round($manualDiscount + $pointsDiscount, 2);
        }

        $taxable = max(0, $subtotal - $discount);
        $tax = round($taxable * ($taxRate / 100), 2);
        $total = round($taxable + $tax, 2);

        $paidAmount = max(0, min($requestedPaid, $total));
        $status = $paidAmount >= $total ? 'paid' : ($paidAmount > 0 ? 'partial' : 'unpaid');

        $invoice = \Illuminate\Support\Facades\DB::transaction(function () use ($request, $order, $validated, $pointsToUse, $discount, $total, $subtotal, $tax, $taxRate, $paidAmount, $status) {
        $invoice = Invoice::create([
            'invoice_number' => $this->generateInvoiceNumber(),
            'work_order_id' => $order->id,
            'user_id' => $order->user_id,
            'subtotal' => $subtotal,
            'tax' => $tax,
            'tax_rate' => $taxRate,
            'total' => $total,
            'paid_amount' => $paidAmount,
            'discount' => $discount,
            'points_used' => $pointsToUse,
            'payment_method' => $validated['payment_method'] ?? 'efectivo',
            'status' => $status,
            'issue_date' => now(),
        ]);

        if ($paidAmount > 0) {
            $invoice->payments()->create([
                'user_id' => $order->user_id,
                'amount' => $paidAmount,
                'method' => $validated['payment_method'] ?? 'efectivo',
                'paid_at' => now(),
                'recorded_by' => $request->user()->id,
                'receipt_number' => $this->nextReceiptNumber(),
                'notes' => 'Pago inicial al facturar',
            ]);
        }

        // Consumir la reserva de inventario hecha al aprobar la cotización
            $stock = app(\App\Services\InventoryService::class);
            foreach ($order->items as $item) {
                $invoice->items()->create([
                    'description' => $item->description,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'total' => round($item->quantity * $item->unit_price, 2),
                ]);

                if ($item->product_id) {
                    $stock->consumeReserved($item->product_id, $item->quantity, [
                        'order_id' => $order->id,
                        'invoice_id' => $invoice->id,
                        'reference' => $invoice->invoice_number,
                        'user_id' => $request->user()->id,
                        'note' => 'Consumo de stock facturado',
                    ]);
                }
            }
        foreach ($order->labors as $labor) {
            $invoice->items()->create([
                'description' => $labor->description . ' (mano de obra)',
                'quantity' => 1,
                'unit_price' => $labor->amount,
                'total' => round($labor->amount, 2),
            ]);
        }

        // Puntos: solo aplicar/ganar cuando la factura queda totalmente pagada.
        if ($status === 'paid') {
            if ($pointsToUse > 0) {
                $order->user->decrement('points_balance', $pointsToUse);
                LoyaltyPoint::create([
                    'user_id' => $order->user_id,
                    'points' => -$pointsToUse,
                    'concept' => "Canje por descuento en {$invoice->invoice_number}",
                    'balance_after' => $order->user->fresh()->points_balance,
                ]);
            }

            $points = (int) floor($total / 1000);
            if ($points > 0) {
                $order->user->increment('points_balance', $points);
                LoyaltyPoint::create([
                    'user_id' => $order->user_id,
                    'points' => $points,
                    'concept' => "Compra {$invoice->invoice_number}",
                    'balance_after' => $order->user->fresh()->points_balance,
                ]);
            }
        }

        return $invoice;
        });

        app(NotificationService::class)->invoiceGenerated($order);

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'invoice_generated',
            'Invoice',
            $invoice->id,
            ['invoice_number' => $invoice->invoice_number, 'order_id' => $order->id, 'total' => $invoice->total, 'status' => $invoice->status]
        );

        return response()->json($this->serialize($invoice->load('items', 'payments')), 201);
    }

    // ---------- Pagos / abonos ----------

    public function registerPayment(Request $request, Invoice $invoice): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|in:efectivo,transferencia,tarjeta',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $outstanding = $invoice->outstanding;
        if ($validated['amount'] > $outstanding) {
            return response()->json(['message' => "El abono supera el saldo pendiente (quedan por pagar {$outstanding})"], 422);
        }

        $wasPaid = $invoice->status === 'paid';

        \Illuminate\Support\Facades\DB::transaction(function () use ($request, $invoice, $validated, $wasPaid) {
            $invoice->payments()->create([
                'user_id' => $invoice->user_id,
                'amount' => $validated['amount'],
                'method' => $validated['method'],
                'paid_at' => now(),
                'reference' => $validated['reference'] ?? null,
                'receipt_number' => $this->nextReceiptNumber(),
                'notes' => $validated['notes'] ?? null,
                'recorded_by' => $request->user()->id,
            ]);

            $paid = round((float) $invoice->paid_amount + (float) $validated['amount'], 2);
            $status = $paid >= (float) $invoice->total ? 'paid' : 'partial';
            $invoice->update(['paid_amount' => $paid, 'status' => $status]);

            if ($status === 'paid' && ! $wasPaid) {
                $points = (int) floor((float) $invoice->total / 1000);
                if ($points > 0 && $invoice->user) {
                    $invoice->user->increment('points_balance', $points);
                    LoyaltyPoint::create([
                        'user_id' => $invoice->user_id,
                        'points' => $points,
                        'concept' => "Pago completo {$invoice->invoice_number}",
                        'balance_after' => $invoice->user->fresh()->points_balance,
                    ]);
                }

                // Pedido de tienda: confirmar pedido + consumir la reserva de stock
                if (! $invoice->work_order_id && $invoice->order_status !== 'confirmed') {
                    $invoice->update(['order_status' => 'confirmed']);
                    $this->consumeReservedFor($invoice);
                    if ($invoice->user && (int) $invoice->points_used > 0) {
                        $invoice->user->decrement('points_balance', (int) $invoice->points_used);
                        LoyaltyPoint::create([
                            'user_id' => $invoice->user_id,
                            'points' => -(int) $invoice->points_used,
                            'concept' => "Canje por descuento en {$invoice->invoice_number}",
                            'balance_after' => $invoice->user->fresh()->points_balance,
                        ]);
                    }
                }
            }
        });

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'payment_registered',
            'Invoice',
            $invoice->id,
            ['invoice_number' => $invoice->invoice_number, 'amount' => $validated['amount'], 'method' => $validated['method'], 'new_status' => $invoice->status]
        );

        return response()->json($this->serialize($invoice->fresh()->load('payments', 'items')));
    }

    public function invoicePayments(Request $request, Invoice $invoice): JsonResponse
    {
        return response()->json($invoice->payments()->with('recorder')->orderByDesc('paid_at')->get()->map(fn ($p) => [
            'id' => $p->id,
            'amount' => (float) $p->amount,
            'method' => $p->method,
            'paid_at' => $p->paid_at?->toDateTimeString(),
            'reference' => $p->reference,
            'receipt_number' => $p->receipt_number,
            'notes' => $p->notes,
            'recorded_by' => $p->recorder?->name,
        ]));
    }

    // ---------- Pedidos de la tienda ----------

    /**
     * Lista los pedidos de la tienda (facturas sin orden de servicio).
     */
    public function shopOrders(Request $request): JsonResponse
    {
        $query = Invoice::whereNull('work_order_id')->with(['items', 'user', 'payments']);

        if ($request->user()->role === 'customer') {
            $query->where('user_id', $request->user()->id);
        }

        if ($status = $request->query('order_status')) {
            $query->where('order_status', $status);
        }
        if ($request->boolean('pending_only')) {
            $query->whereIn('order_status', ['pending', 'payment_review', 'confirmed']);
        }
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_email', 'like', "%{$search}%");
            });
        }

        $perPage = $this->perPage($request);
        $page = $this->page($request);

        $total = $query->toBase()->getCountForPagination();
        $rows = $query->forPage($page, $perPage)->get();

        $items = $rows->map(fn ($i) => $this->serialize($i, true));

        return response()->json($this->paginatePayload($items, $page, $perPage, $total), 200, [], JSON_UNESCAPED_UNICODE);
    }

    /**
     * Cambia el estado de un pedido de tienda (verify+stock side effects).
     */
    public function updateShopOrderStatus(Request $request, Invoice $invoice): JsonResponse
    {
        if ($invoice->work_order_id) {
            return response()->json(['message' => 'La factura no es un pedido de tienda'], 422);
        }

        $validated = $request->validate([
            'order_status' => 'required|in:pending,payment_review,confirmed,shipped,delivered,cancelled',
        ]);

        $from = $invoice->order_status;
        $to = $validated['order_status'];

        $allowedTransitions = [
            'pending' => ['payment_review', 'confirmed', 'cancelled'],
            'payment_review' => ['confirmed', 'cancelled'],
            'confirmed' => ['shipped', 'delivered'],
            'shipped' => ['delivered'],
            'delivered' => [],
            'cancelled' => [],
        ];

        if (! in_array($to, $allowedTransitions[$from] ?? [], true)) {
            return response()->json(['message' => "Transición no permitida: {$from} → {$to}"], 422);
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($invoice, $to) {
            $invoice->update(['order_status' => $to]);
            if ($to === 'confirmed') {
                $this->consumeReservedFor($invoice);
                // Transferencia/tarjeta ya están pagadas al confirmar (comprobante verificado o
                // cobro directo). El efectivo se paga al retirar/recibir, cuando el staff
                // registra el pago.
                if ($invoice->payment_method !== 'efectivo' && $invoice->user && ! $invoice->paid_amount) {
                    $invoice->update(['paid_amount' => (float) $invoice->total, 'status' => 'paid']);
                }
                if ($invoice->user && (int) $invoice->points_used > 0) {
                    $invoice->user->decrement('points_balance', (int) $invoice->points_used);
                    LoyaltyPoint::create([
                        'user_id' => $invoice->user_id,
                        'points' => -(int) $invoice->points_used,
                        'concept' => "Canje por descuento en {$invoice->invoice_number}",
                        'balance_after' => $invoice->user->fresh()->points_balance,
                    ]);
                }
            }
            if ($to === 'cancelled') {
                $this->releaseReservedFor($invoice);
                $invoice->update(['status' => 'cancelled']);
            }
        });

        // Notificar al cliente según el estado
        $messages = [
            'confirmed' => ['Pedido confirmado', "Tu pedido {$invoice->invoice_number} fue confirmado y está en preparación.", 'success'],
            'shipped' => ['Pedido enviado', "Tu pedido {$invoice->invoice_number} fue enviado y va en camino.", 'info'],
            'delivered' => ['Pedido entregado', "Tu pedido {$invoice->invoice_number} fue entregado. ¡Gracias por tu compra!", 'success'],
            'cancelled' => ['Pedido cancelado', "Tu pedido {$invoice->invoice_number} fue cancelado.", 'danger'],
            'payment_review' => ['Comprobante en revisión', "Tu comprobante del pedido {$invoice->invoice_number} está en revisión.", 'info'],
        ];

        if (isset($messages[$to]) && $invoice->user) {
            app(NotificationService::class)->notify(
                $invoice->user,
                $messages[$to][0],
                $messages[$to][1],
                $messages[$to][2],
                ['channel' => 'order']
            );
        }

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'shop_order_updated',
            'Invoice',
            $invoice->id,
            ['order_status' => "{$from} → {$to}"]
        );

        return response()->json($this->serialize($invoice->fresh()->load('items', 'payments', 'user')));
    }

    /**
     * El cliente sube el comprobante de pago (pasa a revisión).
     */
    public function uploadProof(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizeOwnership($request, $invoice);

        if ($invoice->work_order_id) {
            return response()->json(['message' => 'La factura no es un pedido de tienda'], 422);
        }
        if (! in_array($invoice->order_status, ['pending', 'payment_review'], true)) {
            return response()->json(['message' => "No se puede subir el comprobante en estado {$invoice->order_status}"], 422);
        }

        $validated = $request->validate([
            'proof' => 'required|file|mimes:jpg,jpeg,png,pdf,webp|max:8192',
            'payment_method' => 'nullable|in:efectivo,transferencia,tarjeta',
            'reference' => 'nullable|string|max:255',
        ]);

        $path = $request->file('proof')->store('store/proofs', 'public');

        $invoice->update([
            'payment_proof_path' => $path,
            'payment_method' => $validated['payment_method'] ?? $invoice->payment_method,
            'order_status' => 'payment_review',
        ]);

        $reference = $validated['reference'] ?? 'sin referencia';

        app(NotificationService::class)->notify(
            $invoice->user,
            'Comprobante recibido',
            "Recibimos tu comprobante para {$invoice->invoice_number} ({$reference}). Lo revisaremos y te avisaremos.",
            'info',
            ['channel' => 'order']
        );
        $this->notifyStaff(
            "Comprobante subido en {$invoice->invoice_number}",
            "{$invoice->customer_name} subió el comprobante de pago. Verifícalo en Ventas → Pedidos de tienda."
        );

        return response()->json($this->serialize($invoice->fresh()->load('items')));
    }

    /**
     * El cliente cancela su pedido mientras esté pendiente.
     */
    public function cancelShopOrder(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizeOwnership($request, $invoice);

        if ($invoice->work_order_id) {
            return response()->json(['message' => 'La factura no es un pedido de tienda'], 422);
        }
        // Pendientes (transferencia sin pagar) o confirmados que aún no se han pagado
        // (efectivo sin cobrar): el cliente puede desistir antes de pagar.
        $canCancel = in_array($invoice->order_status, ['pending', 'confirmed'], true)
            && (float) $invoice->paid_amount <= 0;
        if (! $canCancel) {
            return response()->json(['message' => 'Solo puedes cancelar un pedido que aún no esté pagado'], 422);
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($invoice) {
            $this->releaseReservedFor($invoice);
            // Devolver los puntos canjeados por el descuento
            if ((int) $invoice->points_used > 0 && $invoice->user) {
                $invoice->user->increment('points_balance', (int) $invoice->points_used);
                LoyaltyPoint::create([
                    'user_id' => $invoice->user_id,
                    'points' => (int) $invoice->points_used,
                    'concept' => "Devolución por cancelación {$invoice->invoice_number}",
                    'balance_after' => $invoice->user->fresh()->points_balance,
                ]);
            }
            $invoice->update(['order_status' => 'cancelled', 'status' => 'cancelled']);
        });

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'shop_order_cancelled',
            'Invoice',
            $invoice->id,
            ['order_status' => 'cancelled']
        );

        return response()->json($this->serialize($invoice->fresh()->load('items')));
    }

    /**
     * El staff sube el PDF de la factura para descarga del cliente.
     */
    public function uploadInvoicePdf(Request $request, Invoice $invoice): JsonResponse
    {
        if ($invoice->work_order_id) {
            return response()->json(['message' => 'La factura no es un pedido de tienda'], 422);
        }

        $validated = $request->validate([
            'invoice_pdf' => 'required|file|mimes:pdf|max:12288',
        ]);

        $path = $request->file('invoice_pdf')->store('store/invoices', 'public');
        $invoice->update(['invoice_pdf_path' => $path]);

        if ($invoice->user) {
            app(NotificationService::class)->notify(
                $invoice->user,
                'Tu factura está lista',
                "La factura {$invoice->invoice_number} está disponible para descargar desde Mis Pedidos.",
                'success',
                ['channel' => 'invoice']
            );
        }

        return response()->json($this->serialize($invoice->fresh()->load('items')));
    }

    /**
     * Descarga el PDF de la factura (subido por staff; fallback al generado).
     */
    public function downloadInvoicePdf(Request $request, Invoice $invoice): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\Response
    {
        $authRole = $request->user()->role;
        if ($authRole === 'customer') {
            $this->authorizeOwnership($invoice, $request);
        }

        if ($invoice->invoice_pdf_path && \Storage::disk('public')->exists($invoice->invoice_pdf_path)) {
            return response()->download(
                \Storage::disk('public')->path($invoice->invoice_pdf_path),
                'factura-' . $invoice->invoice_number . '.pdf'
            );
        }

        $pdf = $this->pdfFor($invoice);

        return $pdf->stream('factura-' . $invoice->invoice_number . '.pdf');
    }

    /**
     * Consume (vende) el stock reservado para una factura confirmada.
     */
    private function consumeReservedFor(Invoice $invoice): void
    {
        $stock = app(InventoryService::class);
        foreach (StockMovement::where('type', 'reserve')->where('invoice_id', $invoice->id)->get() as $m) {
            $stock->consumeReserved($m->product_id, $m->quantity, [
                'invoice_id' => $invoice->id,
                'reference' => $invoice->invoice_number,
                'user_id' => $invoice->user_id,
                'note' => 'Confirmación pedido',
            ]);
        }
    }

    /**
     * Libera el stock reservado de un pedido cancelado.
     */
    private function releaseReservedFor(Invoice $invoice): void
    {
        $stock = app(InventoryService::class);
        foreach (StockMovement::where('type', 'reserve')->where('invoice_id', $invoice->id)->get() as $m) {
            $stock->release($m->product_id, $m->quantity, [
                'invoice_id' => $invoice->id,
                'reference' => $invoice->invoice_number,
                'user_id' => $invoice->user_id,
                'note' => 'Cancelación pedido',
            ]);
        }
    }

    private function notifyStaff(string $title, string $message): void
    {
        foreach (User::whereIn('role', ['admin', 'receptionist'])->get() as $u) {
            app(NotificationService::class)->notify($u, $title, $message, 'info', ['channel' => 'order']);
        }
    }

    private function nextReceiptNumber(): string
    {
        $count = \App\Models\Payment::count() + 1;

        return 'RECV-' . now()->format('Ymd') . '-' . str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }

    // ---------- Garantías ----------

    public function createWarranty(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'nullable|exists:work_orders,id',
            'product_id' => 'nullable|exists:products,id',
            'description' => 'required|string',
            'type' => 'required|in:days,km,months',
            'duration' => 'required|integer|min:1',
            'start_date' => 'required|date',
        ]);

        $warranty = Warranty::create([
            ...$validated,
            'end_date' => match ($validated['type']) {
                'days', 'months' => now()->parse($validated['start_date'])->addMonths($validated['type'] === 'months' ? $validated['duration'] : 0)->addDays($validated['type'] === 'days' ? $validated['duration'] : 0),
                'km' => null,
            },
            'is_active' => true,
        ]);

        return response()->json($warranty, 201);
    }

    public function warranties(Request $request): JsonResponse
    {
        $query = Warranty::with(['workOrder', 'product']);

        if (in_array($request->user()->role, ['customer'])) {
            $query->whereHas('workOrder', fn ($q) => $q->where('user_id', $request->user()->id));
        }

        if ($status = $request->get('status')) {
            if ($status === 'active') {
                $query->where('is_active', true)
                    ->where(fn ($q) => $q->whereNull('end_date')->orWhere('end_date', '>=', now()));
            } elseif ($status === 'expired') {
                $query->where('is_active', true)
                    ->whereNotNull('end_date')
                    ->where('end_date', '<', now());
            } elseif ($status === 'inactive') {
                $query->where('is_active', false);
            }
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'ilike', "%{$search}%")
                    ->orWhereHas('workOrder', fn ($oq) => $oq->where('order_number', 'ilike', "%{$search}%")
                        ->orWhereHas('user', fn ($uq) => $uq->where('name', 'ilike', "%{$search}%")))
                    ->orWhereHas('product', fn ($pq) => $pq->where('name', 'ilike', "%{$search}%"));
            });
        }

        return response()->json($this->paginateBuilder(
            $query->orderByDesc('id'),
            $this->perPage($request),
            $this->page($request)
        ));
    }

    // ---------- Puntos (cliente) ----------

    public function myPoints(Request $request): JsonResponse
    {
        return response()->json([
            'balance' => $request->user()->points_balance,
            'history' => LoyaltyPoint::where('user_id', $request->user()->id)
                ->orderByDesc('id')
                ->get(),
        ]);
    }

    public function redeemPoints(Request $request): JsonResponse
    {
        $pointsValue = (float) config('points.value', 100);

        $validated = $request->validate([
            'points' => 'required|integer|min:100',
        ]);

        $points = (int) $validated['points'];
        $balance = (int) $request->user()->points_balance;

        if ($points > $balance) {
            return response()->json(['message' => 'No tienes suficientes puntos.'], 422);
        }

        $value = $points * $pointsValue;

        $request->user()->decrement('points_balance', $points);

        LoyaltyPoint::create([
            'user_id' => $request->user()->id,
            'points' => -$points,
            'concept' => "Canje por cupón de {$value}",
            'balance_after' => $request->user()->fresh()->points_balance,
        ]);

        $coupon = 'MOTO-' . strtoupper(substr(str_shuffle('ABCDEFGHJKMNPQRSTUVWXYZ'), 0, 5)) . '-' . random_int(1000, 9999);

        return response()->json([
            'message' => "Canje exitoso. Presenta el cupón en el mostrador.",
            'coupon' => $coupon,
            'value' => $value,
            'points' => $points,
            'balance' => $request->user()->fresh()->points_balance,
        ]);
    }

    public function warrantyPdf(Request $request, Warranty $warranty): \Illuminate\Http\Response
    {
        $warranty->load(['workOrder.user', 'workOrder.motorcycle.brand', 'workOrder.items', 'product']);
        $order = $warranty->workOrder;

        if (! $order) {
            abort(404, 'Garantía sin orden asociada');
        }

        if (! in_array($request->user()->role, ['admin', 'receptionist', 'mechanic'])
            && $order->user_id !== $request->user()->id) {
            abort(403, 'No autorizado');
        }

        set_time_limit(120);
        $workshop = [
            'name' => \App\Support\Settings::get('workshop_name', config('app.name')),
            'address' => \App\Support\Settings::get('workshop_address', ''),
            'logo' => \App\Support\Settings::get('workshop_logo', ''),
            'phone' => \App\Support\Settings::get('workshop_phone', ''),
            'email' => \App\Support\Settings::get('workshop_email', ''),
        ];
        $pdf = Pdf::loadView('pdf.warranty', [
            'warranty' => $warranty,
            'order' => $order,
            'workshop' => $workshop,
        ]);

        return $pdf->download("garantia-{$warranty->id}.pdf");
    }

    // ---------- helpers ----------

    private function authorizeOwnership(Request $request, Invoice $invoice): void
    {
        if (! in_array($request->user()->role, ['admin', 'receptionist'])
            && $invoice->user_id !== $request->user()->id) {
            abort(403, 'No autorizado');
        }
    }

    private function serialize(Invoice $i, bool $withItems = false, array $itemImages = []): array
    {
        $data = [
            'id' => $i->id,
            'invoice_number' => $i->invoice_number,
            'source' => $i->work_order_id ? 'service' : 'store',
            'customer_name' => $i->customer_name ?? $i->user?->name,
            'customer_email' => $i->customer_email ?? $i->user?->email,
            'customer_phone' => $i->customer_phone ?? $i->user?->phone,
            'shipping_address' => $i->shipping_address,
            'subtotal' => (float) $i->subtotal,
            'tax' => (float) $i->tax,
            'tax_rate' => (float) ($i->tax_rate ?? 0),
            'discount' => (float) $i->discount,
            'profit' => request()->user()?->role === 'admin' ? $this->invoiceProfit($i) : null,
            'points_used' => (int) $i->points_used,
            'total' => (float) $i->total,
            'paid_amount' => (float) $i->paid_amount,
            'outstanding' => (float) $i->outstanding,
            'payment_method' => $i->payment_method,
            'status' => $i->status,
            'order_status' => $i->order_status ?? ($i->work_order_id ? null : 'pending'),
            'payment_proof_url' => $i->payment_proof_path ? \Storage::disk('public')->url($i->payment_proof_path) : null,
            'invoice_pdf_url' => $i->invoice_pdf_path ? \Storage::disk('public')->url($i->invoice_pdf_path) : null,
            'issue_date' => $i->issue_date?->toDateString(),
        ];

        if ($withItems) {
            $rows = $i->items->map(fn ($it) => [
                'product_id' => $it->product_id,
                'description' => $it->description,
                'variant' => $it->variant,
                'quantity' => $it->quantity,
                'unit_price' => (float) $it->unit_price,
                'total' => (float) $it->total,
                'image' => $itemImages[mb_strtolower(trim((string) $it->description))] ?? null,
            ]);

            $data['items'] = $rows;
            $data['items_count'] = $rows->count();
            $data['thumbnail'] = $rows->firstWhere(fn ($r) => ! empty($r['image']))['image'] ?? null;
            $data['warranties'] = $i->workOrder?->warranties
                ->map(fn ($w) => [
                    'id' => $w->id,
                    'description' => $w->description,
                    'type' => $w->type,
                    'duration' => $w->duration,
                    'start_date' => $w->start_date?->toDateString(),
                    'end_date' => $w->end_date?->toDateString(),
                    'status' => $w->status,
                ])
                ->values()
                ->all() ?? [];
            $data['payments'] = $i->payments->map(fn ($p) => [
                'id' => $p->id,
                'amount' => (float) $p->amount,
                'method' => $p->method,
                'paid_at' => $p->paid_at?->toDateTimeString(),
                'reference' => $p->reference,
                'receipt_number' => $p->receipt_number,
                'notes' => $p->notes,
            ])->values()->all();
        }

        return $data;
    }

    /**
     * Ganancia bruta: ingreso cobrado menos costo de los repuestos vendidos.
     */
    private function invoiceProfit(Invoice $i): float
    {
        return round((float) $i->paid_amount - $this->costOfSold($i), 2);
    }

    private function costOfSold($i): float
    {
        $cost = 0;
        foreach ($i->items ?? [] as $it) {
            if ((float) $it->cost > 0) {
                $cost += (float) $it->cost;
            }
        }
        if ($cost > 0) {
            return round($cost, 2);
        }

        foreach ($i->workOrder?->items ?? [] as $woItem) {
            $product = $woItem->product;
            if ($product) {
                $cost += ($product->cost ?? 0) * $woItem->quantity;
            }
        }

        return round($cost, 2);
    }

    public static function generateInvoiceNumber(): string
    {
        do {
            $number = 'INV-' . date('Y') . '-' . strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ'), 0, 3)) . '-' . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        } while (Invoice::where('invoice_number', $number)->exists());

        return $number;
    }
}