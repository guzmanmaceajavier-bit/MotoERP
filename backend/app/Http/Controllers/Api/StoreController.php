<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\LoyaltyPoint;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class StoreController extends Controller
{
    public function recommended(Request $request): JsonResponse
    {
        // Modelos de las motos del usuario (por motorcycle_model_id)
        $modelIds = $request->user()->motorcycles()
            ->whereNotNull('motorcycle_model_id')
            ->pluck('motorcycle_model_id')
            ->unique()
            ->values();

        $compatible = collect();
        if ($modelIds->isNotEmpty()) {
            $compatible = Product::where('is_active', true)
                ->whereIn('motorcycle_model_id', $modelIds)
                ->with(['category', 'brand', 'inventory'])
                ->get();
        }

        // Lubricantes adecuados (categoría aceites/lubricantes)
        $lubricants = Product::where('is_active', true)
            ->whereHas('category', fn ($q) => $q->where('name', 'ilike', '%aceite%')->orWhere('name', 'ilike', '%lubricante%'))
            ->with(['category', 'brand', 'inventory'])
            ->limit(4)
            ->get();

        // Accesorios recomendados (categoría accesorios)
        $accessories = Product::where('is_active', true)
            ->whereHas('category', fn ($q) => $q->where('name', 'ilike', '%accesorios%'))
            ->with(['category', 'brand', 'inventory'])
            ->limit(4)
            ->get();

        // Promociones personalizadas (productos con precio promocional)
        $promotions = Product::where('is_active', true)
            ->whereNotNull('promo_price')
            ->whereColumn('promo_price', '<', 'price')
            ->with(['category', 'brand', 'inventory'])
            ->inRandomOrder()
            ->limit(4)
            ->get();

        // Repuestos alternativos (part_type = alternativo, sin modelo específico)
        $alternatives = Product::where('is_active', true)
            ->where('part_type', 'alternativo')
            ->with(['category', 'brand', 'inventory'])
            ->inRandomOrder()
            ->limit(4)
            ->get();

        // Accesibles/lubricantes y repuestos genéricos como sugerencias
        $suggestions = Product::where('is_active', true)
            ->whereNull('motorcycle_model_id')
            ->with(['category', 'brand', 'inventory'])
            ->inRandomOrder()
            ->limit(6)
            ->get();

        $map = fn ($p) => [
            'id' => $p->id,
            'name' => $p->name,
            'slug' => $p->slug,
            'description' => $p->description,
            'price' => (float) $p->price,
            'promo_price' => $p->promo_price !== null ? (float) $p->promo_price : null,
            'final_price' => $p->final_price,
            'part_type' => $p->part_type,
            'unit' => $p->unit,
            'image' => $p->image,
            'category' => $p->category?->name,
            'brand' => $p->brand?->name,
            'available' => $p->available,
        ];

        return response()->json([
            'compatible' => $compatible->map($map)->values(),
            'lubricants' => $lubricants->map($map)->values(),
            'accessories' => $accessories->map($map)->values(),
            'promotions' => $promotions->map($map)->values(),
            'alternatives' => $alternatives->map($map)->values(),
            'suggestions' => $suggestions->map($map)->values(),
        ]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $validated = $this->validateCart($request);
        $validated['checkout_token'] = $request->input('checkout_token');

        // Prevenir doble clic: si ya existe una orden reciente con este token, retornar la existente
        if ($validated['checkout_token']) {
            try {
                $existingOrder = \App\Models\Invoice::where('checkout_token', $validated['checkout_token'])
                    ->where('created_at', '>', now()->subMinutes(5))
                    ->first();
                if ($existingOrder) {
                    return response()->json($existingOrder->load('items'), 200);
                }
            } catch (\Throwable $e) {
                // Columna checkout_token puede no existir aún
            }
        }

        return $this->processCheckout($request->user(), $request, $validated);
    }

    /**
     * Compra sin registro: crea (o reutiliza) un cliente con los datos que
     * ingresó el visitante y procesa la factura igual que un comprador normal.
     */
    public function checkoutGuest(Request $request): JsonResponse
    {
        $validated = $this->validateCart($request);

        $identity = $request->validate([
            'guest_name' => 'required|string|max:255',
            'guest_email' => 'required|email',
            'guest_phone' => 'nullable|string|max:30',
            'shipping_address' => 'nullable',
            'checkout_token' => 'nullable|string|max:100',
        ]);

        $validated['guest_name'] = \App\Support\Input::clean($identity['guest_name']);
        $validated['guest_email'] = $identity['guest_email'];
        $validated['guest_phone'] = \App\Support\Input::clean($identity['guest_phone'] ?? null);
        $validated['shipping_address'] = $this->normalizeShippingAddress($identity['shipping_address'] ?? null);
        $validated['points_to_use'] = 0;
        $validated['checkout_token'] = $identity['checkout_token'] ?? null;

        // Prevenir doble clic: si ya existe una orden reciente con este token, retornar la existente
        if ($validated['checkout_token']) {
            try {
                $existingOrder = \App\Models\Invoice::where('checkout_token', $validated['checkout_token'])
                    ->where('created_at', '>', now()->subMinutes(5))
                    ->first();
                if ($existingOrder) {
                    return response()->json($existingOrder->load('items'), 200);
                }
            } catch (\Throwable $e) {
                // Columna checkout_token puede no existir aún
            }
        }

        try {
            $user = User::firstOrCreate(
                ['email' => $validated['guest_email']],
                [
                    'name' => $validated['guest_name'],
                    'phone' => $validated['guest_phone'],
                    'role' => 'customer',
                    'password' => Hash::make(Str::random(40)),
                ]
            );

            // Guest: crear pedido simple sin tocar stock (el taller confirma al pagar)
            $expirationDays = (int) (\App\Support\Settings::get('order_expiration_days', 1));
            $expirationDays = $expirationDays > 0 ? $expirationDays : 1;

            $request->merge(['user' => $user]);
            // Reusar processCheckout pero sin reserva de stock para guest
            $validated['skip_stock'] = true;
            $validated['due_date'] = now()->addDays($expirationDays)->toDateString();

            return $this->processCheckout($user, $request, $validated);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('checkoutGuest failed: '.$e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Error al procesar pedido: '.$e->getMessage()], 422);
        }
    }

    private function validateCart(Request $request): array
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'fulfillment' => 'required|in:shipping,pickup,installing',
            'motorcycle_id' => 'nullable|exists:motorcycles,id',
            'payment_method' => 'nullable|in:efectivo,transferencia,tarjeta',
            'points_to_use' => 'nullable|integer|min:0',
        ]);

        $validated['shipping_address'] = $this->normalizeShippingAddress($request->input('shipping_address'));

        return $validated;
    }

    private function normalizeShippingAddress(mixed $value): ?string
    {
        if (is_string($value) && trim($value) !== '') {
            return \App\Support\Input::clean($value);
        }
        if (is_array($value)) {
            $parts = [];
            foreach (['address', 'city', 'phone', 'notes'] as $key) {
                $v = $value[$key] ?? null;
                if (is_string($v) && trim($v) !== '') {
                    $parts[] = trim($v);
                }
            }
            $address = implode(', ', $parts);
            if ($address === '') {
                return null;
            }
            return mb_substr($address, 0, 500);
        }

        return null;
    }

    private function processCheckout(User $user, Request $request, array $validated): JsonResponse
    {
        // Verificar que la moto de instalación sea del usuario (si aplica)
        if (! empty($validated['motorcycle_id'])) {
            $owns = \App\Models\Motorcycle::where('id', $validated['motorcycle_id'])
                ->where('user_id', $user->id)
                ->exists();
            if (! $owns) {
                return response()->json(['message' => 'La moto seleccionada no pertenece al cliente'], 422);
            }
        }
        if ($validated['fulfillment'] === 'installing' && empty($validated['motorcycle_id'])) {
            return response()->json(['message' => 'Debes indicar la moto para una instalación'], 422);
        }

        try {
            $result = DB::transaction(function () use ($user, $validated) {
            // Reconstruir items con costo/stock (no confiar en cliente) + bloqueo atómico
            $lineItems = [];
            $subtotal = 0;
            $stock = app(\App\Services\InventoryService::class);
            foreach ($validated['items'] as $line) {
                $product = Product::with('inventory')->where('is_active', true)->findOrFail($line['product_id']);
                // Validación de disponibilidad; la baja real se hace con bloqueo al facturar. Guest skip_stock no valida stock.
                if (!($validated['skip_stock'] ?? false)) {
                    $stock->assertAvailable($line['product_id'], $line['quantity']);
                }
                // Usa el precio final (respeta promociones)
                $price = $product->final_price;
                $total = round($price * $line['quantity'], 2);
                $subtotal += $total;
                $variantName = isset($line['variant']) && is_string($line['variant']) && trim($line['variant']) !== ''
                    ? trim($line['variant'])
                    : null;
                if ($variantName !== null && isset($product->variants) && is_array($product->variants)) {
                    $names = array_column($product->variants, 'name');
                    if (! in_array($variantName, $names, true)) {
                        throw new \RuntimeException("Color '{$variantName}' no válido para {$product->name}.");
                    }
                }
                $lineItems[] = [
                    'product' => $product,
                    'quantity' => $line['quantity'],
                    'unit_price' => (float) $price,
                    'total' => $total,
                    'variant' => $variantName,
                ];
            }

            // Costo de envío a domicilio (gratis desde cierto subtotal)
            $shippingFee = 0.0;
            if ($validated['fulfillment'] === 'shipping') {
                $freeThreshold = (float) Settings::get('store_free_shipping_threshold', config('store.free_shipping_threshold', 150000));
                $shippingFee = $subtotal >= $freeThreshold
                    ? 0.0
                    : (float) Settings::get('store_shipping_fee', config('store.shipping_fee', 12000));
            }

            // Descuento por puntos (canjeo)
            $pointsValue = (float) config('points.value', 100);
            $pointsToUse = min((int) ($validated['points_to_use'] ?? 0), (int) $user->points_balance, (int) floor($subtotal / $pointsValue));
            $discount = $pointsToUse * $pointsValue;
            $total = max(0, $subtotal - $discount) + $shippingFee;

            $taxEnabled = Setting::where('key', 'tax_enabled')->value('value') === '1';
            $taxRate = (float) (Setting::where('key', 'tax_rate')->value('value') ?: 19);
            $tax = $taxEnabled ? round($subtotal * ($taxRate / 100), 0) : 0;
            $total += $tax;

            $paymentMethod = $validated['payment_method'] ?? 'efectivo';
            // En efectivo (retiro/instalación/contra entrega) el pedido se confirma al crearlo:
            // se prepara y se paga al retirar/recibir. Con transferencia/tarjeta queda a la
            // espera del comprobante.
            $orderStatus = $paymentMethod === 'efectivo' ? 'confirmed' : 'pending';

            $invoice = Invoice::create([
                'invoice_number' => InvoiceController::generateInvoiceNumber(),
                'user_id' => $user->id,
                'customer_name' => $validated['guest_name'] ?? $user->name,
                'customer_email' => $validated['guest_email'] ?? $user->email,
                'customer_phone' => $validated['guest_phone'] ?? $user->phone,
                'shipping_address' => $validated['shipping_address'] ?? null,
                'subtotal' => $subtotal,
                'tax' => $tax,
                'discount' => $discount,
                'points_used' => $pointsToUse,
                'total' => $total,
                'payment_method' => $paymentMethod,
                'status' => 'unpaid',
                'order_status' => $orderStatus,
                'issue_date' => now(),
            ]);

            foreach ($lineItems as $line) {
                $invoice->items()->create([
                    'product_id' => $line['product']->id,
                    'description' => $line['product']->name,
                    'variant' => $line['variant'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'total' => $line['total'],
                ]);

                // Reservar stock del pedido (se confirma la venta al verificar el pago)
                if ($line['product']->id && !($validated['skip_stock'] ?? false)) {
                    $stock->reserve($line['product']->id, $line['quantity'], [
                        'invoice_id' => $invoice->id,
                        'reference' => $invoice->invoice_number,
                        'user_id' => $user->id,
                        'note' => 'Reserva pedido tienda',
                    ]);
                }
            }

            if ($shippingFee > 0) {
                $invoice->items()->create([
                    'description' => 'Envío a domicilio',
                    'quantity' => 1,
                    'unit_price' => $shippingFee,
                    'total' => $shippingFee,
                ]);
            }

            // Crear orden de instalación si aplica
            if ($validated['fulfillment'] === 'installing') {
                $user->workOrders()->create([
                    'order_number' => \App\Http\Controllers\Api\OrderController::generateOrderNumber(),
                    'motorcycle_id' => $validated['motorcycle_id'],
                    'mechanic_id' => null,
                    'status' => 'pending',
                    'quotation_status' => 'approved',
                    'service_type' => 'Instalación de accesorios',
                ]);
            }

            // Efectivo: el pedido queda confirmado de inmediato → consumir el stock reservado
            // y cobrar los puntos canjeados por el descuento.
            if ($orderStatus === 'confirmed' && !($validated['skip_stock'] ?? false)) {
                foreach (\App\Models\StockMovement::where('type', 'reserve')->where('invoice_id', $invoice->id)->get() as $m) {
                    $stock->consumeReserved($m->product_id, $m->quantity, [
                        'invoice_id' => $invoice->id,
                        'reference' => $invoice->invoice_number,
                        'user_id' => $user->id,
                        'note' => 'Confirmación pedido (efectivo)',
                    ]);
                }
                if ($pointsToUse > 0) {
                    $user->decrement('points_balance', $pointsToUse);
                    LoyaltyPoint::create([
                        'user_id' => $user->id,
                        'points' => -$pointsToUse,
                        'concept' => "Canje por descuento en {$invoice->invoice_number}",
                        'balance_after' => $user->fresh()->points_balance,
                    ]);
                }
            }

            return $invoice;
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        // Set checkout_token/due_date AFTER transaction (columns may not exist yet)
        try {
            $update = [];
            if (!empty($validated['checkout_token'])) $update['checkout_token'] = $validated['checkout_token'];
            if (!empty($validated['due_date'])) $update['due_date'] = $validated['due_date'];
            if ($update) {
                $result->update($update);
            }
        } catch (\Throwable $e) {
            // Columns don't exist yet — migration pending, ignore
        }

        app(NotificationService::class)->notify(
            $user,
            'Pedido registrado',
            "Tu pedido {$result->invoice_number} quedó registrado por " .
                number_format($result->total, 2) . ". Completa el pago ({$result->payment_method}) y sube tu comprobante desde Mis Pedidos para que lo confirmemos.",
            'info',
            ['channel' => 'invoice']
        );

        // Avisar al equipo del taller
        $this->notifyStaff(
            "Nuevo pedido {$result->invoice_number}",
            "Pedido por " . number_format($result->total, 2) . " ({$result->payment_method}), cliente: {$result->customer_name}. Gestionarlo en Ventas → Pedidos de tienda.",
            $result->invoice_number
        );

        app(\App\Services\AuditService::class)->fromRequest(
            $request,
            'store_checkout',
            'Invoice',
            $result->id,
            ['invoice_number' => $result->invoice_number, 'total' => $result->total, 'method' => $result->payment_method, 'guest' => ! $request->user()]
        );

        return response()->json($this->serialize($result->load('items')), 201);
    }

    private function serialize(Invoice $i): array
    {
        return [
            'id' => $i->id,
            'invoice_number' => $i->invoice_number,
            'customer_name' => $i->customer_name,
            'customer_email' => $i->customer_email,
            'customer_phone' => $i->customer_phone,
            'shipping_address' => $i->shipping_address,
            'subtotal' => (float) $i->subtotal,
            'discount' => (float) $i->discount,
            'points_used' => (int) $i->points_used,
            'total' => (float) $i->total,
            'payment_method' => $i->payment_method,
            'status' => $i->status,
            'issue_date' => $i->issue_date?->toDateString(),
            'items' => $i->items->map(fn ($it) => [
                'product_id' => $it->product_id,
                'description' => $it->description,
                'variant' => $it->variant,
                'quantity' => $it->quantity,
                'unit_price' => (float) $it->unit_price,
                'total' => (float) $it->total,
            ]),
        ];
    }

    private function applyPoints(User $user, float $total, string $invoiceNumber, int $pointsToUse): void
    {
        if ($pointsToUse > 0) {
            $user->decrement('points_balance', $pointsToUse);
            LoyaltyPoint::create([
                'user_id' => $user->id,
                'points' => -$pointsToUse,
                'concept' => "Canje por descuento en {$invoiceNumber}",
                'balance_after' => $user->fresh()->points_balance,
            ]);
        }

        $earned = (int) floor($total / 1000);
        if ($earned > 0) {
            $user->increment('points_balance', $earned);
            LoyaltyPoint::create([
                'user_id' => $user->id,
                'points' => $earned,
                'concept' => "Compra tienda {$invoiceNumber}",
                'balance_after' => $user->fresh()->points_balance,
            ]);
        }
    }

    private function notifyStaff(string $title, string $message, string $reference): void
    {
        $staff = User::whereIn('role', ['admin', 'receptionist'])->get();
        foreach ($staff as $u) {
            app(NotificationService::class)->notify($u, $title, $message, 'info', ['channel' => 'order']);
        }
    }

    // ---------- Favoritos ----------

    public function favorites(Request $request): JsonResponse
    {
        $items = $request->user()->favorites()
            ->with(['product.category', 'product.brand', 'product.inventory'])
            ->orderByDesc('favorites.id')
            ->get();

        $stockIds = $request->user()->stockAlerts()->pluck('product_id')->map(fn ($id) => (int) $id)->all();
        $priceAlerts = $request->user()->priceAlerts()
            ->get()->keyBy('product_id')
            ->map(fn ($a) => (float) $a->target_price)->all();

        $data = $items->map(function ($fav) use ($stockIds, $priceAlerts) {
            return $this->favoriteMap($fav->product) + [
                'stock_alert' => in_array((int) $fav->product_id, $stockIds),
                'price_alert' => isset($priceAlerts[$fav->product_id]) ? $priceAlerts[$fav->product_id] : null,
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function toggleStockAlert(Request $request, Product $product): JsonResponse
    {
        $existing = $request->user()->stockAlerts()->where('product_id', $product->id)->first();
        if ($existing) {
            $existing->delete();

            return response()->json(['stock_alert' => false]);
        }

        $request->user()->stockAlerts()->create(['product_id' => $product->id]);

        return response()->json(['stock_alert' => true]);
    }

    public function setPriceAlert(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'target_price' => 'required|numeric|min:1',
        ]);

        $target = (float) $validated['target_price'];
        $alert = $request->user()->priceAlerts()->updateOrCreate(
            ['product_id' => $product->id],
            ['target_price' => $target],
        );

        // Snapshot inicial: si no hay historial, guarda el precio actual como punto de partida.
        app(\App\Services\ProductAlertService::class)->recordPriceChange($product);

        // Si ya está al precio objetivo, notifica inmediatamente.
        app(\App\Services\ProductAlertService::class)->checkPriceAlerts($product);

        return response()->json(['price_alert' => (float) $alert->fresh()->target_price]);
    }

    public function removePriceAlert(Request $request, Product $product): JsonResponse
    {
        $request->user()->priceAlerts()->where('product_id', $product->id)->delete();

        return response()->json(['price_alert' => null]);
    }

    public function priceHistory(Product $product): JsonResponse
    {
        $history = \App\Models\PriceHistory::where('product_id', $product->id)
            ->orderByDesc('id')
            ->limit(30)
            ->get()
            ->map(fn ($h) => [
                'price' => (float) $h->price,
                'promo_price' => $h->promo_price !== null ? (float) $h->promo_price : null,
                'final_price' => $h->promo_price !== null ? min((float) $h->price, (float) $h->promo_price) : (float) $h->price,
                'date' => $h->created_at?->toDateTimeString(),
            ]);

        return response()->json(['data' => $history]);
    }

    public function compare(Product $product): JsonResponse
    {
        $categoryId = $product->category_id;
        $query = Product::with(['category', 'brand', 'inventory'])
            ->where('is_active', true)
            ->where('id', '!=', $product->id);

        if ($categoryId) {
            $query->where('category_id', $categoryId);
        } else {
            $query->where('name', 'ilike', '%' . collect(explode(' ', $product->name))->first() . '%');
        }

        $alternatives = $query->orderByRaw('COALESCE(promo_price, price)')
            ->limit(6)
            ->get()
            ->map(fn ($p) => $this->favoriteMap($p));

        return response()->json([
            'current' => $this->favoriteMap($product),
            'data' => $alternatives,
        ]);
    }

    public function validateCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:50',
            'subtotal' => 'required|numeric|min:0',
        ]);

        $coupon = \App\Models\Coupon::where('code', strtoupper(trim($validated['code'])))->first();

        if (!$coupon || !$coupon->isValid()) {
            return response()->json(['message' => 'Cupón inválido o expirado'], 422);
        }

        if ($validated['subtotal'] < $coupon->min_order) {
            return response()->json([
                'message' => 'El pedido mínimo para este cupón es ' . number_format($coupon->min_order, 0, ',', '.'),
            ], 422);
        }

        $discount = $coupon->applyDiscount($validated['subtotal']);

        return response()->json([
            'code' => $coupon->code,
            'type' => $coupon->type,
            'value' => $coupon->value,
            'discount' => $discount,
        ]);
    }

    public function share(Request $request): JsonResponse
    {
        $share = \App\Models\FavoriteShare::firstOrCreate(
            ['user_id' => $request->user()->id],
            ['token' => \Illuminate\Support\Str::random(40)],
        );

        return response()->json(['token' => $share->token]);
    }

    public function toggleFavorite(Request $request): JsonResponse
    {
        $validated = $request->validate(['product_id' => 'required|exists:products,id']);

        $existing = $request->user()->favorites()->where('product_id', $validated['product_id'])->first();
        if ($existing) {
            $existing->delete();

            return response()->json(['favorite' => false]);
        }

        $request->user()->favorites()->create(['product_id' => $validated['product_id']]);

        return response()->json(['favorite' => true]);
    }

    public function removeFavorite(Request $request, Product $product): JsonResponse
    {
        $request->user()->favorites()->where('product_id', $product->id)->delete();
        $request->user()->stockAlerts()->where('product_id', $product->id)->delete();
        $request->user()->priceAlerts()->where('product_id', $product->id)->delete();

        return response()->json(['favorite' => false]);
    }

    public function clearFavorites(Request $request): JsonResponse
    {
        $request->user()->favorites()->delete();
        $request->user()->stockAlerts()->delete();
        $request->user()->priceAlerts()->delete();

        return response()->json(['deleted' => $request->user()->favorites()->count()]);
    }

    private function favoriteMap(Product $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'slug' => $p->slug,
            'description' => $p->description,
            'price' => (float) $p->price,
            'promo_price' => $p->promo_price !== null ? (float) $p->promo_price : null,
            'final_price' => $p->final_price,
            'part_type' => $p->part_type,
            'unit' => $p->unit,
            'image' => $p->image,
            'variants' => $p->variants ?? [],
            'category' => $p->category?->name,
            'brand' => $p->brand?->name,
            'available' => $p->available,
        ];
    }
}