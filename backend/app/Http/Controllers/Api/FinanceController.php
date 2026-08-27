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
use App\Models\WorkOrder;
use App\Services\CloudinaryService;
use App\Services\InventoryService;
use App\Services\NotificationService;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class FinanceController extends Controller
{
    use Paginates;

    // ---------- Ventas (todas las facturas) ----------

    public function sales(Request $request): JsonResponse
    {
        $query = Invoice::with(['user', 'items', 'workOrder.items.product']);

        if ($request->get('from')) {
            $query->whereDate('issue_date', '>=', $request->get('from'));
        }
        if ($request->get('to')) {
            $query->whereDate('issue_date', '<=', $request->get('to'));
        }
        if ($request->get('payment_method')) {
            $query->where('payment_method', $request->get('payment_method'));
        }

        $query->orderByDesc('issue_date')->orderByDesc('id');

        $allInvoices = (clone $query)->get();

        $total = $allInvoices->sum('total');
        $count = $allInvoices->count();
        $totalCost = $allInvoices->sum(fn ($i) => $this->invoiceCost($i));
        $totalProfit = round($allInvoices->sum('paid_amount') - $totalCost, 2);

        $page = $this->page($request);
        $perPage = $this->perPage($request);

        $pageInvoices = $allInvoices->forPage($page, $perPage)->values();

        return response()->json([
            'total' => (float) $total,
            'count' => $count,
            'cost' => $totalCost,
            'profit' => $totalProfit,
            'data' => $pageInvoices->map(fn ($i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'customer' => $i->customer_name ?: ($i->user?->name ?? 'Sin cliente'),
                'order_number' => $i->workOrder?->order_number ?? (str_starts_with($i->invoice_number, 'INV-') ? $i->invoice_number : null),
                'subtotal' => (float) $i->subtotal,
                'discount' => (float) $i->discount,
                'total' => (float) $i->total,
                'paid_amount' => (float) $i->paid_amount,
                'outstanding' => (float) $i->outstanding,
                'cost' => $this->invoiceCost($i),
                'profit' => round((float) $i->paid_amount - $this->invoiceCost($i), 2),
                'payment_method' => $i->payment_method,
                'status' => $i->status,
                'issue_date' => $i->issue_date?->toDateString(),
            ]),
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'last_page' => (int) ceil($count / $perPage),
                'total' => $count,
            ],
        ]);
    }

    // ---------- Nueva venta (POS) ----------

    /**
     * Clientes para el buscador de la venta.
     */
    public function saleClients(Request $request): JsonResponse
    {
        $q = trim((string) $request->get('q'));
        $query = \App\Models\User::where('role', 'customer');

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('name', 'ilike', "%{$q}%")
                    ->orWhere('email', 'ilike', "%{$q}%")
                    ->orWhere('phone', 'ilike', "%{$q}%");
            });
        }

        return response()->json($query->orderBy('name')->limit(15)->get([
            'id', 'name', 'email', 'phone', 'points_balance',
        ]));
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
            $invoice = DB::transaction(function () use ($request, $validated, $taxRate) {
                // Resolver o crear cliente
                if (! empty($validated['client_id'])) {
                    $client = \App\Models\User::findOrFail($validated['client_id']);
                } else {
                    $identity = [
                        'name' => \App\Support\Input::clean($validated['client_name']),
                        'email' => \App\Support\Input::clean($validated['client_email'] ?? null),
                        'phone' => \App\Support\Input::clean($validated['client_phone'] ?? null),
                        'role' => 'customer',
                        'password' => bcrypt(\Illuminate\Support\Str::random(40)),
                    ];
                    $client = empty($identity['email'])
                        ? \App\Models\User::create($identity)
                        : \App\Models\User::firstOrCreate(['email' => $identity['email']], $identity);
                }

                // Reconstruir items con precio/costo reales (no confiar en el cliente)
                $inventory = app(InventoryService::class);
                $subtotal = 0;
                $lines = [];
                foreach ($validated['items'] as $line) {
                    $product = \App\Models\Product::with('inventory')->where('is_active', true)->findOrFail($line['product_id']);
                    $inventory->assertAvailable($line['product_id'], $line['quantity']);
                    $price = (float) $product->final_price;
                    $total = round($price * $line['quantity'], 2);
                    $subtotal += $total;
                    $lines[] = ['product' => $product, 'quantity' => $line['quantity'], 'unit_price' => $price, 'total' => $total];
                }

                $discount = (float) ($validated['discount'] ?? 0);
                $discount = min($discount, $subtotal);
                $taxable = $subtotal - $discount;
                $tax = round($taxable * ($taxRate / 100), 2);
                $total = round($taxable + $tax, 2);

                $invoice = Invoice::create([
                    'invoice_number' => \App\Http\Controllers\Api\InvoiceController::generateInvoiceNumber(),
                    'user_id' => $client->id,
                    'customer_name' => $client->name,
                    'customer_email' => $client->email,
                    'customer_phone' => $client->phone,
                    'subtotal' => $subtotal,
                    'tax' => $tax,
                    'tax_rate' => $taxRate,
                    'discount' => $discount,
                    'total' => $total,
                    'paid_amount' => $total,
                    'payment_method' => $validated['payment_method'] ?? 'efectivo',
                    'status' => 'paid',
                    'issue_date' => now(),
                ]);

                foreach ($lines as $l) {
                    $invoice->items()->create([
                        'description' => $l['product']->name,
                        'quantity' => $l['quantity'],
                        'unit_price' => $l['unit_price'],
                        'cost' => (float) ($l['product']->cost ?? 0) * $l['quantity'],
                        'total' => $l['total'],
                    ]);

                    $inventory->sell($l['product']->id, $l['quantity'], [
                        'invoice_id' => $invoice->id,
                        'reference' => $invoice->invoice_number,
                        'user_id' => $request->user()->id,
                        'note' => 'Venta mostrador',
                    ]);
                }

                // Registrar abono (pago total)
                $invoice->payments()->create([
                    'user_id' => $client->id,
                    'amount' => $total,
                    'method' => $validated['payment_method'] ?? 'efectivo',
                    'reference' => $validated['notes'] ?? null,
                    'paid_at' => now(),
                    'recorded_by' => $request->user()->id,
                ]);

                return $invoice;
            });
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

          $data = [];
          if (isset($validated['payment_method'])) {
              $data['payment_method'] = $validated['payment_method'];
          }
          if (isset($validated['status'])) {
              $data['status'] = $validated['status'];
              if ($validated['status'] === 'paid') {
                  $data['paid_amount'] = $invoice->total;
              } elseif ($validated['status'] === 'pending') {
                  $data['paid_amount'] = 0;
              }
          }
          if (isset($validated['paid_amount'])) {
              $data['paid_amount'] = min((float) $validated['paid_amount'], (float) $invoice->total);
              $data['status'] = (float) $data['paid_amount'] >= (float) $invoice->total ? 'paid' : ((float) $data['paid_amount'] > 0 ? 'partial' : 'pending');
          }

          if (! empty($data)) {
              $invoice->update($data);
          }

          return response()->json([
              'message' => 'Venta actualizada',
              'invoice_number' => $invoice->invoice_number,
              'total' => (float) $invoice->total,
              'paid_amount' => (float) $invoice->paid_amount,
              'status' => $invoice->status,
              'payment_method' => $invoice->payment_method,
          ]);
      }

      /**
       * Anular una venta directa: devuelve el stock y borra factura, líneas y pagos.
       */
      public function deleteSale(Request $request, Invoice $invoice): JsonResponse
      {
          if ($invoice->work_order_id) {
              abort(422, 'Las ventas vinculadas a órdenes de trabajo no se pueden eliminar.');
          }

          DB::transaction(function () use ($request, $invoice) {
              $inventory = app(InventoryService::class);
              foreach ($invoice->items as $line) {
                  if ($line->product_id) {
                      $inventory->add($line->product_id, (int) $line->quantity, [
                          'invoice_id' => $invoice->id,
                          'reference' => $invoice->invoice_number,
                          'user_id' => $request->user()->id,
                          'note' => 'Devolución por venta anulada',
                      ]);
                  }
              }
              $invoice->items()->delete();
              $invoice->payments()->delete();
              $invoice->delete();
          });

          return response()->json(['message' => 'Venta anulada y stock devuelto al inventario']);
      }

    // ---------- Reportes ----------

    public function reports(Request $request): JsonResponse
    {
        $from = $request->get('from') ?: now()->startOfMonth()->toDateString();
        $to = $request->get('to') ?: now()->toDateString();

        $compareMode = $request->get('compare', 'prev');

        // Período anterior de la misma longitud para comparación
        $prevFrom = null;
        $prevTo = null;
        if ($compareMode !== 'none') {
            $span = (new \DateTimeImmutable($from))->diff(new \DateTimeImmutable($to));
            $prevFrom = (new \DateTimeImmutable($from))->sub(\DateInterval::createFromDateString('1 day'))->modify('-'.$span->days.' days')->format('Y-m-d');
            $prevTo = (new \DateTimeImmutable($from))->sub(\DateInterval::createFromDateString('1 day'))->format('Y-m-d');
        }

        $invoices = Invoice::with('workOrder.items.product', 'items')
            ->whereBetween('issue_date', [$from, $to])
            ->get();

        $daily = $invoices
            ->groupBy(fn ($i) => $i->issue_date->toDateString())
            ->map(fn ($group) => [
                'issue_date' => $group->first()->issue_date->toDateString(),
                'total' => round($group->sum('paid_amount'), 2),
                'count' => $group->count(),
            ])
            ->values();

        $byMechanic = WorkOrder::with('mechanic')
            ->whereBetween('finished_at', [$from.' 00:00:00', $to.' 23:59:59'])
            ->whereIn('status', ['completed', 'delivered'])
            ->get()
            ->groupBy(fn ($o) => $o->mechanic?->name ?? 'Sin asignar')
            ->map(fn ($group) => [
                'mechanic' => $group->first()->mechanic?->name ?? 'Sin asignar',
                'count' => $group->count(),
                'total' => round($group->sum('quotation_total'), 2),
            ])
            ->values();

        $periodCost = $invoices->sum(fn ($i) => $this->invoiceCost($i));
        $salesTotal = round($invoices->sum('paid_amount'), 2);
        $periodProfit = round($salesTotal - $periodCost, 2);

        // Métodos de pago (usa el total facturado del período)
        $byMethod = $invoices
            ->groupBy(fn ($i) => $i->payment_method ?: 'efectivo')
            ->map(fn ($group) => [
                'method' => $group->first()->payment_method ?: 'efectivo',
                'count' => $group->count(),
                'total' => round($group->sum('paid_amount'), 2),
            ])
            ->values();

        // Top 5 productos más vendidos (ventas directas + órdenes)
        $productCounts = [];
        foreach ($invoices as $i) {
            foreach ($i->items as $line) {
                if (!$line->product_id) {
                    continue;
                }
                $key = $line->product_id;
                $productCounts[$key]['product_id'] = $line->product_id;
                $productCounts[$key]['qty'] = ($productCounts[$key]['qty'] ?? 0) + (int) $line->quantity;
                $productCounts[$key]['revenue'] = ($productCounts[$key]['revenue'] ?? 0) + (float) $line->total;
                $productCounts[$key]['cost'] = ($productCounts[$key]['cost'] ?? 0) + (float) $line->cost;
                $productCounts[$key]['name'] = $line->description ?? ('#'.$line->product_id);
            }
            foreach ($i->workOrder?->items ?? [] as $woItem) {
                $product = $woItem->product;
                if (!$product) {
                    continue;
                }
                $key = $product->id;
                $productCounts[$key]['product_id'] = $product->id;
                $productCounts[$key]['qty'] = ($productCounts[$key]['qty'] ?? 0) + (int) $woItem->quantity;
                $productCounts[$key]['revenue'] = ($productCounts[$key]['revenue'] ?? 0) + (float) ($product->final_price * $woItem->quantity);
                $productCounts[$key]['cost'] = ($productCounts[$key]['cost'] ?? 0) + (float) ($product->cost ?? 0) * $woItem->quantity;
                $productCounts[$key]['name'] = $product->name;
            }
        }
        $topProducts = collect($productCounts)
            ->map(fn ($row) => [
                'product_id' => $row['product_id'] ?? null,
                'name' => $row['name'],
                'quantity' => (int) $row['qty'],
                'revenue' => round((float) $row['revenue'], 2),
                'profit' => round((float) $row['revenue'] - (float) $row['cost'], 2),
            ])
            ->sortByDesc('quantity')
            ->take(5)
            ->values();

        // Cuentas por cobrar abiertas (fuera del período, pendientes hoy)
        $outstanding = round((float) Invoice::whereIn('status', ['pending', 'partial'])
            ->get()
            ->sum(fn ($i) => max(0, (float) $i->total - (float) $i->paid_amount)), 2);

        // Comparación con período anterior
        $prevSales = 0;
        $prevProfit = 0;
        $salesDelta = null;
        $profitDelta = null;
        if ($prevFrom && $prevTo) {
            $prevInvoices = Invoice::whereBetween('issue_date', [$prevFrom, $prevTo])->get();
            $prevSales = round($prevInvoices->sum('paid_amount'), 2);
            $prevCost = $prevInvoices->sum(fn ($i) => $this->invoiceCost($i));
            $prevProfit = round($prevSales - $prevCost, 2);
            $salesDelta = $prevSales > 0 ? round(($salesTotal - $prevSales) / $prevSales * 100, 1) : null;
            $profitDelta = $prevProfit > 0 ? round(($periodProfit - $prevProfit) / $prevProfit * 100, 1) : null;
        }

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'total_sales' => $salesTotal,
            'invoice_count' => $invoices->count(),
            'cost' => $periodCost,
            'profit' => $periodProfit,
            'outstanding' => $outstanding,
            'compare' => [
                'prev_from' => $prevFrom,
                'prev_to' => $prevTo,
                'sales' => $prevSales,
                'profit' => $prevProfit,
                'sales_delta' => $salesDelta,
                'profit_delta' => $profitDelta,
            ],
            'daily' => $daily,
            'by_method' => $byMethod,
            'by_mechanic' => $byMechanic,
            'top_products' => $topProducts,
        ]);
    }

    /**
     * Costo total de los repuestos vendidos en una factura.
     */
    private function invoiceCost(Invoice $i): float
    {
        // Costo de ventas directas grabado en cada línea
        $directCost = (float) $i->items->sum('cost');
        if ($directCost > 0) {
            return round($directCost, 2);
        }

        $cost = 0;
        foreach ($i->workOrder?->items ?? [] as $woItem) {
            $product = $woItem->product;
            if ($product) {
                $cost += ($product->cost ?? 0) * $woItem->quantity;
            }
        }

        return round($cost, 2);
    }

    // ---------- Caja ----------

    public function cashSessions(Request $request): JsonResponse
    {
        $open = CashSession::with('user')->where('status', 'open')->get()
            ->map(function (CashSession $s) {
                $cashByMethod = Payment::where('paid_at', '>=', $s->opened_at)
                    ->select('method', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
                    ->groupBy('method')
                    ->get()
                    ->keyBy('method')
                    ->map(fn ($r) => ['total' => (float) $r->total, 'count' => (int) $r->count]);

                return [
                    'id' => $s->id,
                    'user' => $s->user,
                    'user_id' => $s->user_id,
                    'opening_amount' => (float) $s->opening_amount,
                    'opened_at' => $s->opened_at?->toDateTimeString(),
                    'status' => $s->status,
                    'notes' => $s->notes,
                    'expected_efectivo' => round((float) $s->opening_amount + (float) ($cashByMethod['efectivo']['total'] ?? 0), 2),
                    'cash_by_method' => $cashByMethod,
                ];
            })
            ->values();

        $historyQ = CashSession::with('user')->orderByDesc('opened_at');
        $history = $this->paginateBuilder($historyQ, $this->perPage($request), $this->page($request));
        $history['data'] = collect($history['data'])->map(fn (CashSession $s) => [
            'id' => $s->id,
            'user' => $s->user,
            'user_id' => $s->user_id,
            'opening_amount' => (float) $s->opening_amount,
            'closing_amount' => $s->closing_amount !== null ? (float) $s->closing_amount : null,
            'expected_amount' => $s->expected_amount !== null ? (float) $s->expected_amount : null,
            'opened_at' => $s->opened_at?->toDateTimeString(),
            'closed_at' => $s->closed_at?->toDateTimeString(),
            'status' => $s->status,
            'notes' => $s->notes,
        ]);

        // Resumen del día (recaudado por método desde medianoche)
        $todayStart = now()->startOfDay()->toDateTimeString();
        $byMethodToday = Payment::where('paid_at', '>=', $todayStart)
            ->select('method', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('method')
            ->get()
            ->keyBy('method')
            ->map(fn ($r) => ['total' => (float) $r->total, 'count' => (int) $r->count]);

        return response()->json([
            'open' => $open,
            'history' => $history,
            'summary' => [
                'today_by_method' => $byMethodToday,
                'today_total' => round((float) $byMethodToday->sum('total'), 2),
            ],
        ]);
    }

    /**
     * Pagos paginados con búsqueda y filtros (para CRUD y exportación).
     */
    public function cashPayments(Request $request): JsonResponse
    {
        $query = Payment::with(['invoice', 'recorder'])->orderByDesc('paid_at');

        if ($q = trim((string) $request->get('q'))) {
            $query->where(function ($sub) use ($q) {
                $sub->whereHas('invoice', function ($i) use ($q) {
                    $i->where('invoice_number', 'like', "%{$q}%")
                        ->orWhere('customer_name', 'like', "%{$q}%")
                        ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$q}%"));
                });
            });
        }

        if ($method = $request->get('method')) {
            $query->where('method', $method);
        }

        if ($from = $request->get('from')) {
            $query->where('paid_at', '>=', $from.' 00:00:00');
        }

        if ($to = $request->get('to')) {
            $query->where('paid_at', '<=', $to.' 23:59:59');
        }

        $items = $query->get()->map(fn (Payment $p) => [
            'id' => $p->id,
            'invoice_number' => $p->invoice?->invoice_number,
            'customer' => $p->invoice?->user?->name ?? $p->invoice?->customer_name ?? 'Sin cliente',
            'amount' => (float) $p->amount,
            'method' => $p->method,
            'paid_at' => $p->paid_at?->toDateTimeString(),
            'reference' => $p->reference,
            'receipt_number' => $p->receipt_number,
            'notes' => $p->notes,
            'recorded_by' => $p->recorder?->name,
        ]);

        return response()->json($this->paginateCollection(collect($items), $this->perPage($request), $this->page($request)));
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

        $invoice = $payment->invoice;

        DB::transaction(function () use ($payment, $invoice, $validated) {
            $amount = $validated['amount'] ?? $payment->amount;
            if ($invoice) {
                $otherPaid = (float) $invoice->payments()
                    ->where('id', '!=', $payment->id)
                    ->sum('amount');
                if ($otherPaid + (float) $amount - (float) $invoice->total > 0.01) {
                    throw new \RuntimeException('El nuevo monto supera el total de la factura.');
                }
            }

            $payment->update([
                'amount' => $amount,
                'method' => $validated['method'] ?? $payment->method,
                'reference' => $validated['reference'] ?? $payment->reference,
                'notes' => $validated['notes'] ?? $payment->notes,
            ]);

            if ($invoice) {
                $this->recomputeInvoicePayment($invoice);
            }
        });

        return response()->json(['message' => 'Pago actualizado']);
    }

    /**
     * Eliminar un pago recalculando el estado de la factura.
     */
    public function deletePayment(Request $request, Payment $payment): JsonResponse
    {
        $invoice = $payment->invoice;
        $label = $payment->invoice?->invoice_number ?? 'pago';

        DB::transaction(function () use ($payment, $invoice) {
            $payment->delete();
            if ($invoice) {
                $this->recomputeInvoicePayment($invoice);
            }
        });

        return response()->json(['message' => "Pago de {$label} eliminado"]);
    }

    private function recomputeInvoicePayment(Invoice $invoice): void
    {
        $paid = round((float) $invoice->payments()->sum('amount'), 2);
        $total = round((float) $invoice->total, 2);
        $status = $paid >= $total ? 'paid' : ($paid > 0 ? 'partial' : 'partial');
        $invoice->update(['paid_amount' => $paid, 'status' => $status]);
    }

    public function openCash(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'opening_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        if (CashSession::where('status', 'open')->exists()) {
            return response()->json(['message' => 'Ya hay una caja abierta'], 422);
        }

        $session = CashSession::create([
            'user_id' => $request->user()->id,
            'opening_amount' => $validated['opening_amount'] ?? 0,
            'opened_at' => now(),
            'status' => 'open',
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json($session, 201);
    }

    public function closeCash(Request $request, CashSession $session): JsonResponse
    {
        $validated = $request->validate([
            'closing_amount' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        // Pagos en efectivo registrados durante la sesión (desde la apertura)
        $cashIn = Payment::where('method', 'efectivo')
            ->where('paid_at', '>=', $session->opened_at)
            ->sum('amount');

        // Transferencias y tarjetas registradas en el periodo (informativas)
        $byMethod = Payment::where('paid_at', '>=', $session->opened_at)
            ->select('method', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('method')
            ->get()
            ->keyBy('method')
            ->map(fn ($r) => ['total' => (float) $r->total, 'count' => (int) $r->count]);

        // Cajas/depósitos previos registrados como ingresos (no aplica aquí)

        $expected = (float) $session->opening_amount + (float) $cashIn;

        $session->update([
            'closing_amount' => $validated['closing_amount'],
            'expected_amount' => $expected,
            'closed_at' => now(),
            'status' => 'closed',
            'notes' => $validated['notes'] ?? $session->notes,
        ]);

        return response()->json([
            'session' => $session->fresh(),
            'expected_efectivo' => $expected,
            'cash_received' => (float) $cashIn,
            'by_method' => $byMethod,
            'difference' => round((float) $validated['closing_amount'] - $expected, 2),
        ]);
    }

    // ---------- Deudores (abonos pendientes) ----------

    public function debtors(Request $request): JsonResponse
    {
        $q = trim((string) $request->get('q'));

        $invoices = Invoice::with('user', 'payments')
            ->whereIn('status', ['partial', 'unpaid'])
            ->whereColumn('paid_amount', '<', 'total')
            ->when($q, function ($query) use ($q) {
                $query->whereHas('user', fn ($u) => $u->where('name', 'like', "%{$q}%"));
            })
            ->orderByDesc('issue_date')
            ->get();

        $grouped = $invoices->groupBy('user_id')->map(function ($group, $userId) {
            $user = $group->first()->user;
            $debt = (float) $group->sum('outstanding');

            return [
                'user_id' => $userId,
                'customer' => $user?->name ?? 'Sin cliente',
                'phone' => $user?->phone,
                'total_debt' => round($debt, 2),
                'invoices' => $group->map(fn ($i) => [
                    'id' => $i->id,
                    'invoice_number' => $i->invoice_number,
                    'total' => (float) $i->total,
                    'paid_amount' => (float) $i->paid_amount,
                    'outstanding' => (float) $i->outstanding,
                    'issue_date' => $i->issue_date?->toDateString(),
                    'status' => $i->status,
                ])->values(),
            ];
        })->values();

        return response()->json([
            'debtors' => $grouped,
            'total_debt' => round($invoices->sum('outstanding'), 2),
        ]);
    }

    // ---------- Compras ----------

    public function suppliers(Request $request): JsonResponse
    {
        $q = trim((string) $request->get('q'));

        $query = Supplier::withCount('purchases')
            ->withSum('purchases', 'total')
            ->when($q, function ($sub) use ($q) {
                $sub->where(function ($w) use ($q) {
                    $w->where('name', 'like', "%{$q}%")
                        ->orWhere('contact', 'like', "%{$q}%")
                        ->orWhere('phone', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%");
                });
            })
            ->orderBy('name');

        $list = $this->paginateBuilder($query, $this->perPage($request), $this->page($request));
        $list['data'] = collect($list['data'])->map(fn (Supplier $s) => [
            'id' => $s->id,
            'name' => $s->name,
            'contact' => $s->contact,
            'phone' => $s->phone,
            'email' => $s->email,
            'purchase_count' => (int) $s->purchases_count,
            'purchase_total' => round((float) ($s->purchases_sum_total ?? 0), 2),
        ])->values();

        return response()->json($list);
    }

    public function storeSupplier(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email',
        ]);

        return response()->json(Supplier::create($validated), 201);
    }

    public function updateSupplier(Request $request, Supplier $supplier): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'contact' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email',
        ]);

        $supplier->update($validated);

        return response()->json([
            'message' => 'Proveedor actualizado',
            'supplier' => $supplier->fresh(),
        ]);
    }

    public function deleteSupplier(Request $request, Supplier $supplier): JsonResponse
    {
        if ($supplier->purchases()->exists()) {
            abort(422, 'No se puede eliminar un proveedor que tiene compras registradas.');
        }

        $supplier->delete();

        return response()->json(['message' => 'Proveedor eliminado']);
    }

    public function purchases(Request $request): JsonResponse
    {
        $q = trim((string) $request->get('q'));
        $supplierId = (int) $request->get('supplier_id');
        $from = $request->get('from');
        $to = $request->get('to');

        $query = Purchase::with(['items', 'supplier'])
            ->when($q, function ($sub) use ($q) {
                $sub->where(function ($w) use ($q) {
                    $w->where('purchase_number', 'like', "%{$q}%")
                        ->orWhere('supplier_name', 'like', "%{$q}%")
                        ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$q}%"));
                });
            })
            ->when($supplierId > 0, fn ($sub) => $sub->where('supplier_id', $supplierId))
            ->when($from, fn ($sub) => $sub->where('purchase_date', '>=', $from))
            ->when($to, fn ($sub) => $sub->where('purchase_date', '<=', $to))
            ->orderByDesc('purchase_date');

        $list = $this->paginateBuilder($query, $this->perPage($request), $this->page($request));
        $list['data'] = collect($list['data'])->map(fn (Purchase $p) => [
            'id' => $p->id,
            'purchase_number' => $p->purchase_number,
            'supplier_id' => $p->supplier_id,
            'supplier_name' => $p->supplier?->name ?? $p->supplier_name ?? null,
            'supplier' => $p->supplier ? ['id' => $p->supplier->id, 'name' => $p->supplier->name] : null,
            'purchase_date' => $p->purchase_date?->toDateString(),
            'total' => (float) $p->total,
            'item_count' => $p->items->count(),
            'items' => $p->items->map(fn ($i) => [
                'id' => $i->id,
                'product_id' => $i->product_id,
                'description' => $i->description,
                'quantity' => (int) $i->quantity,
                'unit_cost' => (float) $i->unit_cost,
                'total' => (float) $i->total,
            ])->values(),
        ])->values();

        return response()->json($list);
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

        $total = 0;
        foreach ($validated['items'] as $item) {
            $total += $item['quantity'] * $item['unit_cost'];
        }

        $purchase = DB::transaction(function () use ($request, $validated) {
            $purchase = Purchase::create([
                'purchase_number' => 'COM-'.strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ'), 0, 4)).'-'.random_int(1000, 9999),
                'supplier_id' => $validated['supplier_id'] ?? null,
                'supplier_name' => $validated['supplier_name'] ?? null,
                'total' => $validated['items'] ? array_sum(array_map(fn ($i) => $i['quantity'] * $i['unit_cost'], $validated['items'])) : 0,
                'purchase_date' => $validated['purchase_date'],
                'created_by' => $request->user()->id,
            ]);

            foreach ($validated['items'] as $item) {
                $purchase->items()->create([
                    'product_id' => $item['product_id'] ?? null,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'total' => $item['quantity'] * $item['unit_cost'],
                ]);

                // Reponer stock
                if (! empty($item['product_id'])) {
                    app(InventoryService::class)->add($item['product_id'], $item['quantity'], [
                        'purchase_id' => $purchase->id,
                        'reference' => $purchase->purchase_number,
                        'user_id' => $request->user()->id,
                        'note' => 'Recepción de compra',
                    ]);
                }
            }

            return $purchase;
        });

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
            DB::transaction(function () use ($request, $purchase, $validated) {
                $existing = $purchase->items()->get()->keyBy('id');

                // Diferencial de stock por producto (nuevo - actual)
                $stockBefore = [];
                foreach ($existing as $item) {
                    if ($item->product_id) {
                        $stockBefore[$item->product_id] = ($stockBefore[$item->product_id] ?? 0) + (int) $item->quantity;
                    }
                }
                $stockAfter = [];
                foreach ($validated['items'] as $line) {
                    if (! empty($line['product_id'])) {
                        $stockAfter[(int) $line['product_id']] = ($stockAfter[(int) $line['product_id']] ?? 0) + (int) $line['quantity'];
                    }
                }

                // Reconciliar líneas: actualizar las existentes por id, crear las nuevas, borrar las que falten
                $total = 0;
                $sentIds = [];
                foreach ($validated['items'] as $line) {
                    $total += (float) $line['quantity'] * (float) $line['unit_cost'];
                    $lineTotal = round((float) $line['quantity'] * (float) $line['unit_cost'], 2);
                    $id = $line['id'] ?? null;

                    if ($id && $existing->has($id)) {
                        $existing[$id]->update([
                            'product_id' => $line['product_id'] ?? null,
                            'description' => $line['description'],
                            'quantity' => $line['quantity'],
                            'unit_cost' => $line['unit_cost'],
                            'total' => $lineTotal,
                        ]);
                        $sentIds[] = $id;
                    } else {
                        $purchase->items()->create([
                            'product_id' => $line['product_id'] ?? null,
                            'description' => $line['description'],
                            'quantity' => $line['quantity'],
                            'unit_cost' => $line['unit_cost'],
                            'total' => $lineTotal,
                        ]);
                    }
                }
                foreach ($existing as $id => $item) {
                    if (! in_array($id, $sentIds)) {
                        $item->delete();
                    }
                }

                // Ajustar inventario según la diferencia neta por producto
                $inventory = app(InventoryService::class);
                foreach (array_unique(array_merge(array_keys($stockBefore), array_keys($stockAfter))) as $productId) {
                    $delta = ($stockAfter[$productId] ?? 0) - ($stockBefore[$productId] ?? 0);
                    if ($delta !== 0) {
                        $inventory->adjust($productId, $delta, [
                            'purchase_id' => $purchase->id,
                            'reference' => $purchase->purchase_number,
                            'user_id' => $request->user()->id,
                            'note' => 'Ajuste de compra',
                        ]);
                    }
                }

                $purchase->update([
                    'supplier_id' => $validated['supplier_id'] ?? $purchase->supplier_id,
                    'supplier_name' => $validated['supplier_name'] ?? null,
                    'purchase_date' => $validated['purchase_date'] ?? $purchase->purchase_date,
                    'total' => round($total, 2),
                ]);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Compra actualizada',
            'purchase' => $purchase->fresh()->load('items', 'supplier'),
        ]);
    }

    /**
     * Eliminar una compra revirtiendo el stock recibido.
     */
    public function deletePurchase(Request $request, Purchase $purchase): JsonResponse
    {
        DB::transaction(function () use ($request, $purchase) {
            $inventory = app(InventoryService::class);
            foreach ($purchase->items as $item) {
                if ($item->product_id) {
                    $inventory->adjust($item->product_id, -(int) $item->quantity, [
                        'purchase_id' => $purchase->id,
                        'reference' => $purchase->purchase_number,
                        'user_id' => $request->user()->id,
                        'note' => 'Eliminación de compra',
                    ]);
                }
            }
            $purchase->items()->delete();
            $purchase->delete();
        });

        return response()->json(['message' => 'Compra eliminada y stock revertido']);
    }

    // ---------- Configuración ----------

    public function settings(): JsonResponse
    {
        return response()->json([
            'workshop_name' => Settings::get('workshop_name', config('app.name')),
            'workshop_phone' => Settings::get('workshop_phone', ''),
            'workshop_address' => Settings::get('workshop_address', ''),
            'workshop_logo' => Settings::get('workshop_logo', ''),
            'workshop_email' => Settings::get('workshop_email', ''),
            'social_facebook' => Settings::get('social_facebook', ''),
            'social_instagram' => Settings::get('social_instagram', ''),
            'social_tiktok' => Settings::get('social_tiktok', ''),
            'tax_rate' => (float) (Settings::get('tax_rate') ?? 18),
            'schedule_open' => Settings::get('schedule_open', '09:00'),
            'schedule_close' => Settings::get('schedule_close', '18:00'),
            'closed_days' => json_decode((string) Settings::get('closed_days', '[]'), true) ?: [],
            'day_hours' => json_decode((string) Settings::get('day_hours', '[]'), true) ?: [],
            'holidays' => json_decode((string) Settings::get('holidays', '[]'), true) ?: [],
            'banners' => json_decode((string) Settings::get('banners', '[]'), true) ?: [],
            'hero_images' => json_decode((string) Settings::get('hero_images', '{}'), true) ?: [],
            'hero_texts' => json_decode((string) Settings::get('hero_texts', '{}'), true) ?: [],
            'workshop_country' => Settings::get('workshop_country', 'CO'),
            'points_value' => (float) (Settings::get('points_value') ?? config('points.value', 100)),
            'payment_options' => json_decode((string) Settings::get('payment_options', '[]'), true) ?: [],
            'payment_instructions' => (string) Settings::get('payment_instructions', ''),
            'whatsapp_enabled' => app(NotificationService::class)->whatsappEnabled(),
            'whatsapp_configured' => app(NotificationService::class)->whatsappEnabled(),
            'whatsapp_phone_id' => Settings::get('whatsapp_phone_id', ''),
            'whatsapp_template' => Settings::get('whatsapp_template', config('services.whatsapp.template')),
            'whatsapp_template_lang' => Settings::get('whatsapp_template_lang', 'es'),
            'cloudinary_configured' => CloudinaryService::configured(),
            'cloudinary_cloud_name' => Settings::get('cloudinary_cloud_name', env('CLOUDINARY_CLOUD_NAME', '')),
            'maintenance_rules' => MaintenanceRule::orderBy('service_name')->get(),
            'terms_content' => (string) Settings::get('terms_content', ''),
            'privacy_content' => (string) Settings::get('privacy_content', ''),
            'store_shipping_fee' => (float) (Settings::get('store_shipping_fee') ?? config('store.shipping_fee', 12000)),
            'store_free_shipping_threshold' => (float) (Settings::get('store_free_shipping_threshold') ?? config('store.free_shipping_threshold', 150000)),
        ]);
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
            'workshop_country' => 'nullable|string|max:2',
            'points_value' => 'nullable|numeric|min:1',
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

        $map = [
            'workshop_name' => 'workshop_name',
            'workshop_phone' => 'workshop_phone',
            'workshop_address' => 'workshop_address',
            'workshop_map_lat' => 'workshop_map_lat',
            'workshop_map_lng' => 'workshop_map_lng',
            'workshop_logo' => 'workshop_logo',
            'workshop_email' => 'workshop_email',
            'social_facebook' => 'social_facebook',
            'social_instagram' => 'social_instagram',
            'social_tiktok' => 'social_tiktok',
            'tax_rate' => 'tax_rate',
            'schedule_open' => 'schedule_open',
            'schedule_close' => 'schedule_close',
        ];
        foreach ($map as $key => $setting) {
            if (array_key_exists($key, $validated)) {
                Settings::set($setting, (string) $validated[$key]);
            }
        }
        if (array_key_exists('closed_days', $validated)) {
            Settings::set('closed_days', json_encode($validated['closed_days']));
        }
        if (array_key_exists('day_hours', $validated)) {
            Settings::set('day_hours', json_encode($validated['day_hours']));
        }
        if (array_key_exists('holidays', $validated)) {
            Settings::set('holidays', json_encode($validated['holidays']));
        }
        if (array_key_exists('banners', $validated)) {
            Settings::set('banners', json_encode($validated['banners']));
        }
        if (array_key_exists('hero_images', $validated)) {
            Settings::set('hero_images', json_encode($validated['hero_images']));
        }
        if (array_key_exists('hero_texts', $validated)) {
            Settings::set('hero_texts', json_encode($validated['hero_texts']));
        }
        if (array_key_exists('workshop_country', $validated)) {
            Settings::set('workshop_country', (string) $validated['workshop_country']);
        }
        if (array_key_exists('payment_options', $validated)) {
            Settings::set('payment_options', json_encode(array_values($validated['payment_options'])));
        }
        if (array_key_exists('payment_instructions', $validated)) {
            Settings::set('payment_instructions', (string) $validated['payment_instructions']);
        }
        if (array_key_exists('points_value', $validated)) {
            Settings::set('points_value', (string) $validated['points_value']);

            $envFile = base_path('.env');
            if (is_writable($envFile)) {
                $contents = file_get_contents($envFile);
                $contents = preg_match('/POINTS_VALUE=.*/', $contents)
                    ? preg_replace('/POINTS_VALUE=.*/', 'POINTS_VALUE='.$validated['points_value'], $contents)
                    : $contents."\nPOINTS_VALUE=".$validated['points_value']."\n";
                file_put_contents($envFile, $contents);
            }
        }
        if (array_key_exists('whatsapp_enabled', $validated)) {
            Settings::set('whatsapp_enabled', (bool) $validated['whatsapp_enabled']);
        }
        if (array_key_exists('whatsapp_phone_id', $validated)) {
            Settings::set('whatsapp_phone_id', (string) $validated['whatsapp_phone_id']);
        }
        if (array_key_exists('whatsapp_template', $validated)) {
            Settings::set('whatsapp_template', (string) $validated['whatsapp_template']);
        }
        if (array_key_exists('whatsapp_template_lang', $validated)) {
            Settings::set('whatsapp_template_lang', (string) $validated['whatsapp_template_lang']);
        }
        if (array_key_exists('cloudinary_cloud_name', $validated)) {
            Settings::set('cloudinary_cloud_name', (string) $validated['cloudinary_cloud_name']);
        }
        if (array_key_exists('terms_content', $validated)) {
            Settings::set('terms_content', (string) $validated['terms_content']);
        }
        if (array_key_exists('privacy_content', $validated)) {
            Settings::set('privacy_content', (string) $validated['privacy_content']);
        }
        if (array_key_exists('store_shipping_fee', $validated)) {
            Settings::set('store_shipping_fee', (string) $validated['store_shipping_fee']);
        }
        if (array_key_exists('store_free_shipping_threshold', $validated)) {
            Settings::set('store_free_shipping_threshold', (string) $validated['store_free_shipping_threshold']);
        }
        if (array_key_exists('delivery_days', $validated)) {
            Settings::set('delivery_days', (string) ($validated['delivery_days'] ?? 3));
        }

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

        $file = $request->file('image');
        $url = CloudinaryService::upload($file, 'site')
            ?? url('/storage/' . $file->store('site', 'public'));

        return response()->json(['url' => $url]);
    }

    // ---------- Reglas de mantenimiento predictivo ----------

    public function storeMaintenanceRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_name' => 'required|string|max:120',
            'interval_km' => 'nullable|integer|min:0',
            'interval_months' => 'nullable|integer|min:0',
        ]);

        $rule = MaintenanceRule::create([
            'service_name' => $validated['service_name'],
            'interval_km' => $validated['interval_km'] ?? null,
            'interval_months' => $validated['interval_months'] ?? null,
            'is_active' => true,
        ]);

        return response()->json($rule, 201);
    }

    public function updateMaintenanceRule(Request $request, MaintenanceRule $rule): JsonResponse
    {
        $validated = $request->validate([
            'service_name' => 'required|string|max:120',
            'interval_km' => 'nullable|integer|min:0',
            'interval_months' => 'nullable|integer|min:0',
        ]);

        $rule->update([
            'service_name' => $validated['service_name'],
            'interval_km' => $validated['interval_km'] ?? null,
            'interval_months' => $validated['interval_months'] ?? null,
        ]);

        return response()->json($rule);
    }

    public function deleteMaintenanceRule(MaintenanceRule $rule): JsonResponse
    {
        $rule->delete();

        return response()->json(['message' => 'Regla eliminada']);
    }

    // ---------- Respaldo de base de datos ----------

    private function dbEnv(): array
    {
        $cfg = config('database.connections.pgsql');
        $env = $_ENV + getenv();
        $env['PGPASSWORD'] = (string) $cfg['password'];
        $env['PGCLIENTENCODING'] = 'UTF8';

        return $env;
    }

    private function dbCommand(array $args): Process
    {
        $cfg = config('database.connections.pgsql');
        $base = [
            '--host=' . $cfg['host'],
            '--port=' . (string) $cfg['port'],
            '--username=' . $cfg['username'],
        ];
        $proc = new Process([...$base, ...$args, $cfg['database']]);
        $proc->setEnv($this->dbEnv());
        $proc->setTimeout(300);

        return $proc;
    }

    public function backupDatabase(): JsonResponse
    {
        try {
            $proc = $this->dbCommand(['--no-owner', '--no-privileges', '--clean', '--if-exists']);
            $proc->run();
            if (! $proc->isSuccessful()) {
                Log::error('Backup fallido: ' . $proc->getErrorOutput());

                return response()->json(['message' => 'No se pudo generar el backup.'], 500);
            }
        } catch (\Throwable $e) {
            Log::error('Backup excepción: ' . $e->getMessage());

            return response()->json(['message' => 'No se pudo generar el backup.'], 500);
        }

        $sql = $proc->getOutput();
        $filename = 'motoerp-backup-' . date('Y-m-d-His') . '.sql';
        $payload = base64_encode($sql);
        $hash = hash('sha256', $sql);
        Settings::set('last_backup_at', now()->toDateTimeString());

        return response()->json([
            'filename' => $filename,
            'size' => strlen($sql),
            'payload' => $payload,
            'hash' => $hash,
            'generated_at' => now()->toDateTimeString(),
        ]);
    }

    public function restoreBackup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sql' => 'required|string',
        ]);

        $sql = base64_decode($validated['sql'], true);
        if ($sql === false || empty(trim((string) $sql))) {
            return response()->json(['message' => 'El backup es inválido.'], 422);
        }

        try {
            $proc = $this->dbCommand(['--single-transaction', '-v', 'ON_ERROR_STOP=1']);
            $proc->setInput($sql);
            $proc->run();
            if (! $proc->isSuccessful()) {
                Log::error('Restore fallido: ' . $proc->getErrorOutput());

                return response()->json(['message' => 'No se pudo restaurar el backup.'], 500);
            }
        } catch (\Throwable $e) {
            Log::error('Restore excepción: ' . $e->getMessage());

            return response()->json(['message' => 'No se pudo restaurar el backup.'], 500);
        }

        Settings::set('last_restore_at', now()->toDateTimeString());

        return response()->json(['message' => 'Backup restaurado correctamente']);
    }

    public function resetDatabase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'confirm' => 'required|string|in:FORMATEAR',
        ]);

        $tables = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        $names = array_map(fn ($t) => $t->tablename, $tables);
        $excluded = ['migrations', 'users', 'settings'];

        $targets = array_filter($names, fn ($n) => ! in_array($n, $excluded, true));
        if (count($targets) > 0) {
            DB::statement('TRUNCATE TABLE ' . implode(', ', array_map(fn ($n) => '"'.$n.'"', $targets)) . ' RESTART IDENTITY CASCADE');
        }

        return response()->json(['message' => 'Datos formateados. Se conservaron usuarios y configuración.']);
    }
}
