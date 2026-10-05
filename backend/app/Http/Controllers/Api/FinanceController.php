<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\Paginates;
use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\Invoice;
use App\Models\MaintenanceRule;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Services\BackupService;
use App\Services\CashService;
use App\Services\PurchaseService;
use App\Services\ReportService;
use App\Services\SaleService;
use App\Services\SettingsService;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceController extends Controller
{
    use Paginates;

    // ---------- Ventas (todas las facturas) ----------

    public function sales(Request $request): JsonResponse
    {
        return response()->json(app(SaleService::class)->list(
            [
                'from' => $request->get('from'),
                'to' => $request->get('to'),
                'payment_method' => $request->get('payment_method'),
            ],
            $this->page($request),
            $this->perPage($request)
        ));
    }

    // ---------- Nueva venta (POS) ----------

    /**
     * Clientes para el buscador de la venta.
     */
    public function saleClients(Request $request): JsonResponse
    {
        $q = trim((string) $request->get('q'));

        return response()->json(app(SaleService::class)->clients($q));
    }

    /**
     * Registrar una venta directa de repuestos (POS). Busca o crea el cliente,
     * valida disponibilidad de stock y descuenta inventario de forma atómica.
     */
    public function storeSale(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'nullable|exists:users,id',
            'client_name' => 'required_without:client_id|string|max:255',
            'client_email' => 'nullable|email',
            'client_phone' => 'nullable|string|max:30',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'payment_method' => 'nullable|in:efectivo,transferencia,tarjeta',
            'discount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:500',
        ]);

        $taxRate = (float) (Settings::get('tax_rate') ?? 18);

        try {
            $invoice = app(SaleService::class)->store($validated, $request->user()->id, $taxRate);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        app(\App\Services\NotificationService::class)->notify(
            $invoice->user,
            'Venta registrada',
            "Tu venta {$invoice->invoice_number} por " . number_format($invoice->total, 2) . " fue registrada (pago: {$invoice->payment_method}).",
            'success',
            ['channel' => 'invoice']
        );

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'pos_sale',
            'Invoice',
            $invoice->id,
            ['invoice_number' => $invoice->invoice_number, 'total' => $invoice->total, 'method' => $invoice->payment_method]
        );

        return response()->json([
            'message' => 'Venta registrada',
            'invoice_number' => $invoice->invoice_number,
            'total' => (float) $invoice->total,
            'id' => $invoice->id,
        ], 201);
    }

    /**
     * Editar el método de pago o el estado de pago de una venta directa (POS).
     * No se puede editar el tipo de venta con orden de trabajo.
     */
    public function updateSale(Request $request, Invoice $invoice): JsonResponse
    {
        if ($invoice->work_order_id) {
            abort(422, 'Esta venta está vinculada a una orden de trabajo y no se puede editar.');
        }

        $validated = $request->validate([
            'payment_method' => 'sometimes|in:efectivo,transferencia,tarjeta',
            'status' => 'sometimes|in:paid,pending,partial',
            'paid_amount' => 'nullable|numeric|min:0',
        ]);

        $result = app(SaleService::class)->update($invoice, $validated);

        return response()->json(['message' => 'Venta actualizada'] + $result);
    }

    /**
     * Anular una venta directa: devuelve el stock y borra factura, líneas y pagos.
     */
    public function deleteSale(Request $request, Invoice $invoice): JsonResponse
    {
        if ($invoice->work_order_id) {
            abort(422, 'Las ventas vinculadas a órdenes de trabajo no se pueden eliminar.');
        }

        app(SaleService::class)->destroy($invoice, $request->user()->id);

        return response()->json(['message' => 'Venta anulada y stock devuelto al inventario']);
    }

    // ---------- Reportes ----------

    public function reports(Request $request): JsonResponse
    {
        $from = $request->get('from') ?: now()->startOfMonth()->toDateString();
        $to = $request->get('to') ?: now()->toDateString();

        $compareMode = $request->get('compare', 'prev');

        return response()->json(
            app(ReportService::class)->period($from, $to, $compareMode)
        );
    }

    // ---------- Caja ----------

    public function cashSessions(Request $request): JsonResponse
    {
        return response()->json(
            app(CashService::class)->overview($this->page($request), $this->perPage($request))
        );
    }

    /**
     * Pagos paginados con búsqueda y filtros (para CRUD y exportación).
     */
    public function cashPayments(Request $request): JsonResponse
    {
        return response()->json(app(CashService::class)->payments(
            [
                'q' => $request->get('q'),
                'method' => $request->get('method'),
                'from' => $request->get('from'),
                'to' => $request->get('to'),
            ],
            $this->page($request),
            $this->perPage($request)
        ));
    }

    /**
     * Editar un pago (monto, método, referencia, notas) recalculando la factura.
     */
    public function updatePayment(Request $request, Payment $payment): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'sometimes|numeric|min:0.01',
            'method' => 'sometimes|in:efectivo,transferencia,tarjeta',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            app(CashService::class)->updatePayment($payment, $validated);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'Pago actualizado']);
    }

    /**
     * Eliminar un pago recalculando el estado de la factura.
     */
    public function deletePayment(Request $request, Payment $payment): JsonResponse
    {
        $label = app(CashService::class)->deletePayment($payment);

        return response()->json(['message' => "Pago de {$label} eliminado"]);
    }

    public function openCash(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'opening_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $session = app(CashService::class)->open($request->user()->id, $validated);
        if (! $session) {
            return response()->json(['message' => 'Ya hay una caja abierta'], 422);
        }

        return response()->json($session, 201);
    }

    public function closeCash(Request $request, CashSession $session): JsonResponse
    {
        $validated = $request->validate([
            'closing_amount' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        return response()->json(app(CashService::class)->close($session, $validated));
    }

    // ---------- Deudores (abonos pendientes) ----------

    public function debtors(Request $request): JsonResponse
    {
        $q = trim((string) $request->get('q'));

        return response()->json(app(ReportService::class)->debtors($q));
    }

    // ---------- Compras ----------

    public function suppliers(Request $request): JsonResponse
    {
        $q = trim((string) $request->get('q'));

        return response()->json(
            app(PurchaseService::class)->suppliers($q, $this->page($request), $this->perPage($request))
        );
    }

    public function storeSupplier(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email',
        ]);

        return response()->json(app(PurchaseService::class)->storeSupplier($validated), 201);
    }

    public function updateSupplier(Request $request, Supplier $supplier): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'contact' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email',
        ]);

        return response()->json([
            'message' => 'Proveedor actualizado',
            'supplier' => app(PurchaseService::class)->updateSupplier($supplier, $validated),
        ]);
    }

    public function deleteSupplier(Request $request, Supplier $supplier): JsonResponse
    {
        app(PurchaseService::class)->deleteSupplier($supplier);

        return response()->json(['message' => 'Proveedor eliminado']);
    }

    public function purchases(Request $request): JsonResponse
    {
        return response()->json(app(PurchaseService::class)->list(
            [
                'q' => $request->get('q'),
                'supplier_id' => $request->get('supplier_id'),
                'from' => $request->get('from'),
                'to' => $request->get('to'),
            ],
            $this->page($request),
            $this->perPage($request)
        ));
    }

    public function storePurchase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => 'nullable|exists:suppliers,id',
            'supplier_name' => 'nullable|string|max:255',
            'purchase_date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
        ]);

        $purchase = app(PurchaseService::class)->store($validated, $request->user()->id);

        return response()->json($purchase->load('items'), 201);
    }

    /**
     * Editar una compra: cambia proveedor/fecha y ajusta el stock por la diferencia de cada línea.
     */
    public function updatePurchase(Request $request, Purchase $purchase): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => 'nullable|exists:suppliers,id',
            'supplier_name' => 'nullable|string|max:255',
            'purchase_date' => 'sometimes|required|date',
            'items' => 'required|array|min:1',
            'items.*.id' => 'sometimes|nullable|integer',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
        ]);

        try {
            $purchase = app(PurchaseService::class)->update($purchase, $validated, $request->user()->id);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Compra actualizada',
            'purchase' => $purchase,
        ]);
    }

    /**
     * Eliminar una compra revirtiendo el stock recibido.
     */
    public function deletePurchase(Request $request, Purchase $purchase): JsonResponse
    {
        app(PurchaseService::class)->destroy($purchase, $request->user()->id);

        return response()->json(['message' => 'Compra eliminada y stock revertido']);
    }

    // ---------- Configuración ----------

    public function settings(): JsonResponse
    {
        return response()->json(app(SettingsService::class)->all());
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'workshop_name' => 'nullable|string|max:120',
            'workshop_phone' => 'nullable|string|max:30',
            'workshop_address' => 'nullable|string|max:255',
            'workshop_map_lat' => 'nullable|string|max:20',
            'workshop_map_lng' => 'nullable|string|max:20',
            'workshop_logo' => 'nullable|string|max:2048',
            'workshop_email' => 'nullable|email|max:120',
            'social_facebook' => 'nullable|string|max:255',
            'social_instagram' => 'nullable|string|max:255',
            'social_tiktok' => 'nullable|string|max:255',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'schedule_open' => 'nullable|date_format:H:i',
            'schedule_close' => 'nullable|date_format:H:i',
            'closed_days' => 'nullable|array',
            'closed_days.*' => 'integer|between:0,6',
            'day_hours' => 'nullable|array',
            'day_hours.*.day' => 'required|integer|between:0,6',
            'day_hours.*.open' => 'required|date_format:H:i',
            'day_hours.*.close' => 'required|date_format:H:i',
            'holidays' => 'nullable|array',
            'holidays.*.date' => 'required|date',
            'holidays.*.mode' => 'nullable|in:closed,saturday,custom',
            'holidays.*.open' => 'nullable|date_format:H:i',
            'holidays.*.close' => 'nullable|date_format:H:i',
            'banners' => 'nullable|array',
            'hero_images' => 'nullable|array',
            'hero_texts' => 'nullable|array',
            'trabajos_gallery' => 'nullable|array',
            'workshop_country' => 'nullable|string|max:2',
            'points_value' => 'nullable|numeric|min:1',
            'points_earning_threshold' => 'nullable|numeric|min:0',
            'payment_options' => 'nullable|array',
            'payment_options.*.method' => 'required|string|max:40',
            'payment_options.*.label' => 'nullable|string|max:120',
            'payment_options.*.holder' => 'nullable|string|max:120',
            'payment_options.*.number' => 'nullable|string|max:120',
            'payment_options.*.extra' => 'nullable|string|max:120',
            'payment_instructions' => 'nullable|string|max:4000',
            'whatsapp_enabled' => 'nullable|boolean',
            'whatsapp_phone_id' => 'nullable|string|max:60',
            'whatsapp_template' => 'nullable|string|max:120',
            'whatsapp_template_lang' => 'nullable|string|max:10',
            'cloudinary_cloud_name' => 'nullable|string|max:120',
            'terms_content' => 'nullable|string|max:20000',
            'privacy_content' => 'nullable|string|max:20000',
            'store_shipping_fee' => 'nullable|numeric|min:0',
            'store_free_shipping_threshold' => 'nullable|numeric|min:0',
            'delivery_days' => 'nullable|integer|min:1|max:30',
        ]);

        app(SettingsService::class)->update($validated);

        return response()->json(['message' => 'Configuración actualizada']);
    }

    /**
     * Sube una imagen para la configuración (logo, heroes, banners) y
     * devuelve la URL final. Usa Cloudinary si está configurado; si no,
     * guarda el archivo en storage/public.
     */
    public function uploadSettingImage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'image' => 'required|image|max:5120',
        ]);

        return response()->json([
            'url' => app(SettingsService::class)->uploadImage($request->file('image')),
        ]);
    }

    // ---------- Reglas de mantenimiento predictivo ----------

    public function storeMaintenanceRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_name' => 'required|string|max:120',
            'interval_km' => 'nullable|integer|min:0',
            'interval_months' => 'nullable|integer|min:0',
        ]);

        return response()->json(app(SettingsService::class)->storeRule($validated), 201);
    }

    public function updateMaintenanceRule(Request $request, MaintenanceRule $rule): JsonResponse
    {
        $validated = $request->validate([
            'service_name' => 'required|string|max:120',
            'interval_km' => 'nullable|integer|min:0',
            'interval_months' => 'nullable|integer|min:0',
        ]);

        return response()->json(app(SettingsService::class)->updateRule($rule, $validated));
    }

    public function deleteMaintenanceRule(MaintenanceRule $rule): JsonResponse
    {
        app(SettingsService::class)->deleteRule($rule);

        return response()->json(['message' => 'Regla eliminada']);
    }

    // ---------- Respaldo de base de datos ----------

    public function backupDatabase(): JsonResponse
    {
        try {
            return response()->json(app(BackupService::class)->backup());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => 'No se pudo generar el backup.'], 500);
        }
    }

    public function restoreBackup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sql' => 'required|string',
        ]);

        try {
            app(BackupService::class)->restore($validated['sql']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => 'El backup es inválido.'], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => 'No se pudo restaurar el backup.'], 500);
        }

        return response()->json(['message' => 'Backup restaurado correctamente']);
    }

    public function resetDatabase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'confirm' => 'required|string|in:FORMATEAR',
        ]);

        app(BackupService::class)->reset();

        return response()->json(['message' => 'Datos formateados. Se conservaron usuarios y configuración.']);
    }
}
