<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\Paginates;
use App\Models\Invoice;
use App\Models\LoyaltyPoint;
use App\Models\Warranty;
use App\Models\WorkOrder;
use App\Services\InvoiceSerializer;
use App\Services\InvoiceService;
use App\Services\LoyaltyService;
use App\Services\NotificationService;
use App\Services\PaymentService;
use App\Services\TimelineService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    use Paginates;

    private function serializer(): InvoiceSerializer
    {
        return app(InvoiceSerializer::class);
    }

    private function isAdmin(Request $request): bool
    {
        return $request->user()->role === 'admin';
    }

    private function timelineFilters(Request $request): array
    {
        return [
            'source' => $request->query('source', 'all'),
            'status' => $request->query('status'),
            'from' => (string) $request->query('from'),
            'to' => (string) $request->query('to'),
            'term' => trim((string) $request->query('term')),
        ];
    }

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
        $images = $this->serializer()->itemImages($rows);
        $isAdmin = $this->isAdmin($request);

        $items = $rows->map(fn ($i) => $this->serializer()->serialize($i, $withItems, $images, $isAdmin));

        // Totales globales reales (de TODAS las facturas del cliente, sin paginar)
        $totals = app(TimelineService::class)->invoiceTotals(
            $request->user()->id,
            in_array($source, ['store', 'service'], true) ? $source : null
        );

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
        $filters = $this->timelineFilters($request);

        $events = app(TimelineService::class)->collect($user, $filters);

        $page = $this->page($request);
        $perPage = $this->perPage($request);

        // Totales globales de facturas (sin paginar), igual que myInvoices
        $totals = app(TimelineService::class)->invoiceTotals(
            $user->id,
            in_array($filters['source'], ['store', 'service'], true) ? $filters['source'] : null
        );

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
        $events = app(TimelineService::class)->collectExportRows($request->user(), $this->timelineFilters($request));

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

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizeOwnership($request, $invoice);
        $invoice->load(['items', 'payments', 'workOrder.warranties']);

        return response()->json($this->serializer()->serialize($invoice, true, [], $this->isAdmin($request)));
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
                'invoice' => $this->serializer()->serialize($existing->load(['items', 'user', 'payments']), true, [], $this->isAdmin($request)),
            ], 200);
        }

        $validated = $request->validate([
            'payment_method' => 'nullable|in:efectivo,transferencia,tarjeta',
            'amount_paid' => 'nullable|numeric|min:0',
            'points_to_use' => 'nullable|integer|min:0',
            'discount' => 'nullable|numeric|min:0|max:100',
        ]);

        $invoice = app(InvoiceService::class)->createFromOrder($order, $validated, $request->user()->id);

        app(NotificationService::class)->invoiceGenerated($order);

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'invoice_generated',
            'Invoice',
            $invoice->id,
            ['invoice_number' => $invoice->invoice_number, 'order_id' => $order->id, 'total' => $invoice->total, 'status' => $invoice->status]
        );

        return response()->json($this->serializer()->serialize($invoice->load('items', 'payments'), false, [], $this->isAdmin($request)), 201);
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

        $invoice = app(PaymentService::class)->register($invoice, $validated, $request->user()->id);

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'payment_registered',
            'Invoice',
            $invoice->id,
            ['invoice_number' => $invoice->invoice_number, 'amount' => $validated['amount'], 'method' => $validated['method'], 'new_status' => $invoice->status]
        );

        return response()->json($this->serializer()->serialize($invoice, false, [], $this->isAdmin($request)));
    }

    public function invoicePayments(Request $request, Invoice $invoice): JsonResponse
    {
        return response()->json(app(PaymentService::class)->history($invoice));
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

        $isAdmin = $this->isAdmin($request);
        $items = $rows->map(fn ($i) => $this->serializer()->serialize($i, true, [], $isAdmin));

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

        if (! in_array($to, app(InvoiceService::class)->allowedTransitions()[$from] ?? [], true)) {
            return response()->json(['message' => "Transición no permitida: {$from} → {$to}"], 422);
        }

        app(InvoiceService::class)->transitionShopOrder($invoice, $to);

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'shop_order_updated',
            'Invoice',
            $invoice->id,
            ['order_status' => "{$from} → {$to}"]
        );

        return response()->json($this->serializer()->serialize($invoice->fresh()->load('items', 'payments', 'user'), false, [], $this->isAdmin($request)));
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

        return response()->json($this->serializer()->serialize($invoice->fresh()->load('items'), false, [], $this->isAdmin($request)));
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

        app(InvoiceService::class)->cancelShopOrder($invoice);

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'shop_order_cancelled',
            'Invoice',
            $invoice->id,
            ['order_status' => 'cancelled']
        );

        return response()->json($this->serializer()->serialize($invoice->fresh()->load('items'), false, [], $this->isAdmin($request)));
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

        return response()->json($this->serializer()->serialize($invoice->fresh()->load('items'), false, [], $this->isAdmin($request)));
    }

    /**
     * Descarga el PDF de la factura (subido por staff; fallback al generado).
     */
    public function downloadInvoicePdf(Request $request, Invoice $invoice): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\Response
    {
        $authRole = $request->user()->role;
        if ($authRole === 'customer') {
            $this->authorizeOwnership($request, $invoice);
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

    private function notifyStaff(string $title, string $message): void
    {
        foreach (\App\Models\User::whereIn('role', ['admin', 'receptionist'])->get() as $u) {
            app(NotificationService::class)->notify($u, $title, $message, 'info', ['channel' => 'order']);
        }
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
        $pointsValue = app(LoyaltyService::class)->pointsValue();

        $validated = $request->validate([
            'points' => 'required|integer|min:100',
        ]);

        $points = (int) $validated['points'];
        $balance = (int) $request->user()->points_balance;

        if ($points > $balance) {
            return response()->json(['message' => 'No tienes suficientes puntos.'], 422);
        }

        $value = $points * $pointsValue;

        app(LoyaltyService::class)->spend(
            $request->user(),
            $points,
            "Canje por cupón de {$value}"
        );

        $coupon = app(LoyaltyService::class)->couponCode();

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

    /**
     * Compatibilidad: StoreController y FinanceController usan
     * InvoiceController::generateInvoiceNumber().
     */
    public static function generateInvoiceNumber(): string
    {
        return app(InvoiceService::class)->generateInvoiceNumber();
    }
}
