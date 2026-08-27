<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\Paginates;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\Motorcycle;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderPhoto;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class StaffController extends Controller
{
    use Paginates;

    // ---------- Recepcionista / Admin: crear y gestionar órdenes ----------

    public function createOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'motorcycle_id' => 'nullable|exists:motorcycles,id',
            'service_id' => 'nullable|exists:services,id',
            'appointment_id' => 'nullable|exists:appointments,id',
            'service_type' => 'nullable|string|max:255',
            'client_notes' => 'nullable|string',
            'odometer_in' => 'nullable|integer|min:0',
            'estimated_delivery' => 'nullable|date',
        ]);

        $service = isset($validated['service_id'])
            ? \App\Models\Service::find($validated['service_id'])
            : null;

        $mechanicId = in_array($request->user()->role, ['admin', 'mechanic']) ? $request->user()->id : null;

        $order = WorkOrder::create([
            'order_number' => OrderController::generateOrderNumber(),
            'user_id' => $validated['user_id'] ?? null,
            'motorcycle_id' => $validated['motorcycle_id'] ?? null,
            'appointment_id' => $validated['appointment_id'] ?? null,
            'service_id' => $service?->id,
            'mechanic_id' => $mechanicId,
            'status' => 'pending',
            'quotation_status' => 'pending',
            'service_type' => $service?->name ?? ($validated['service_type'] ?? null),
            'client_notes' => $validated['client_notes'] ?? null,
            'odometer_in' => $validated['odometer_in'] ?? null,
            'estimated_delivery' => $validated['estimated_delivery'] ?? null,
        ]);

        $order->statuses()->create(['status' => 'pending', 'comment' => 'Orden de trabajo creada', 'changed_by' => $request->user()->id]);

        if ($order->user) {
            app(NotificationService::class)->orderCreated($order);
        }

        return response()->json($this->staffSerialize($order), 201);
    }

    public function listOrders(Request $request): JsonResponse
    {
        $query = WorkOrder::with(['user', 'motorcycle', 'motorcycle.brand', 'mechanic'])
            ->withCount('items');

        if ($request->get('status')) {
            $query->where('status', $request->get('status'));
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'ilike', "%{$search}%")
                    ->orWhere('service_type', 'ilike', "%{$search}%")
                    ->orWhereHas('motorcycle', fn ($mq) => $mq->where('plate', 'ilike', "%{$search}%"))
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'ilike', "%{$search}%"));
            });
        }

        if ($request->user()->role === 'mechanic') {
            $query->where('mechanic_id', $request->user()->id);
        }

        $scoped = WorkOrder::query();
        if ($search = $request->get('search')) {
            $scoped->where(function ($q) use ($search) {
                $q->where('order_number', 'ilike', "%{$search}%")
                    ->orWhere('service_type', 'ilike', "%{$search}%")
                    ->orWhereHas('motorcycle', fn ($mq) => $mq->where('plate', 'ilike', "%{$search}%"))
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'ilike', "%{$search}%"));
            });
        }
        if ($request->user()->role === 'mechanic') {
            $scoped->where('mechanic_id', $request->user()->id);
        }
        $counts = $scoped->select('status')->selectRaw('count(*) as total')->groupBy('status')->pluck('total', 'status')->all();
        $counts['all'] = array_sum($counts);

        $total = $query->toBase()->getCountForPagination();
        $items = $query->orderByDesc('id')->forPage($this->page($request), $this->perPage($request))
            ->get()->map(fn ($o) => $this->staffSerialize($o));

        $payload = $this->paginatePayload($items, $this->page($request), $this->perPage($request), $total);
        $payload['meta']['counts'] = $counts;

        return response()->json($payload);
    }

    public function assignMechanic(Request $request, WorkOrder $order): JsonResponse
    {
        $validated = $request->validate([
            'mechanic_id' => 'required|exists:users,id',
        ]);

        $order->update(['mechanic_id' => $validated['mechanic_id']]);
        app(\App\Services\WorkOrderStatusService::class)->applyOperative($order, 'assigned', $request->user(), 'Mecánico asignado');

        return response()->json($this->staffSerialize($order->fresh()));
    }

    public function startWork(Request $request, WorkOrder $order): JsonResponse
    {
        $this->authorizeMechanic($request, $order);

        app(\App\Services\WorkOrderStatusService::class)->applyOperative($order, 'in_progress', $request->user(), 'Reparación iniciada');
        if (! $order->started_at) {
            $order->update(['started_at' => now()]);
        }

        if ($order->user) {
            app(NotificationService::class)->workStarted($order);
        }

        return response()->json($this->staffSerialize($order->fresh()));
    }

    // ---------- Mecánico: diagnóstico y cotización ----------

    public function submitDiagnosisAndQuotation(Request $request, WorkOrder $order): JsonResponse
    {
        $this->authorizeMechanic($request, $order);
        $this->authorizeOwner($request, $order);

        if ($order->quotation_status === 'approved') {
            abort(422, 'La cotización aprobada está congelada. Para modificarla se debe solicitar una revisión y generar una nueva versión.');
        }

        $validated = $request->validate([
            'diagnosis' => 'required|string',
            'estimated_delivery' => 'nullable|date',
            'reason' => 'nullable|string|max:500',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.product_id' => 'nullable|exists:products,id',
            'labors' => 'nullable|array',
            'labors.*.description' => 'required|string',
            'labors.*.hours' => 'required|numeric|min:0',
            'labors.*.hourly_rate' => 'required|numeric|min:0',
        ]);

        DB::transaction(function () use ($request, $order, $validated) {
            $order->items()->delete();
            $order->labors()->delete();

            $tax = 1; // IVA 0 por ahora
            $partsTotal = 0;
            $stock = app(\App\Services\InventoryService::class);
            foreach ($validated['items'] as $item) {
                $order->items()->create($item);
                $partsTotal += $item['quantity'] * $item['unit_price'];
                // Solo validamos disponibilidad al cotizar; la reserva real se hace
                // cuando el cliente APRUEBA. Evita la doble reserva.
                if (! empty($item['product_id'])) {
                    $stock->assertAvailable($item['product_id'], $item['quantity']);
                }
            }

            $laborTotal = 0;
            foreach ($validated['labors'] ?? [] as $labor) {
                $amount = $labor['hours'] * $labor['hourly_rate'];
                $order->labors()->create([
                    ...$labor,
                    'amount' => $amount,
                ]);
                $laborTotal += $amount;
            }

            $order->update([
                'diagnosis' => $validated['diagnosis'],
                'estimated_delivery' => $validated['estimated_delivery'] ?? $order->estimated_delivery,
                'parts_cost' => $partsTotal,
                'labor_cost' => $laborTotal,
                'quotation_total' => round(($partsTotal + $laborTotal) * $tax, 2),
            ]);

            $statusService = app(\App\Services\WorkOrderStatusService::class);
            if ($order->status !== 'awaiting_approval') {
                $statusService->applyOperative($order, 'awaiting_approval', $request->user(), 'Cotización enviada al cliente');
            }
            $order->update(['quotation_status' => 'awaiting_approval', 'quotation_sent_at' => now()]);

            app(\App\Services\QuotationService::class)->snapshot(
                $order,
                'sent',
                $validated['reason'] ?? 'Envío de cotización',
                $request->user()
            );
        });

        if ($order->user) {
            app(NotificationService::class)->quotationReady($order);
        }

        return response()->json($this->staffSerialize($order->fresh()->load('items', 'labors')));
    }

    // ---------- Estados / finalización ----------

    public function updateStatus(Request $request, WorkOrder $order): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:in_progress,completed,delivered,cancelled',
            'comment' => 'nullable|string',
        ]);

        $statusService = app(\App\Services\WorkOrderStatusService::class);
        $statusService->applyOperative($order, $validated['status'], $request->user(), $validated['comment'] ?? null);

        if ($order->user && in_array($validated['status'], ['completed', 'delivered'])) {
            app(NotificationService::class)->workCompleted($order);
        }

        // Si se cancela la orden, se libera el stock reservado (si quedaba alguno).
        if ($validated['status'] === 'cancelled') {
            $stock = app(\App\Services\InventoryService::class);
            foreach ($order->items as $item) {
                if ($item->product_id) {
                    $stock->release($item->product_id, $item->quantity, [
                        'order_id' => $order->id,
                        'reference' => $order->order_number,
                        'user_id' => $request->user()->id,
                        'note' => 'Liberación por cancelación de orden',
                    ]);
                }
            }
        }

        return response()->json($this->staffSerialize($order->fresh()));
    }

    // ---------- Fotografías de la orden ----------

    public function uploadPhoto(Request $request, WorkOrder $order): JsonResponse
    {
        $this->authorizeMechanic($request, $order);

        $validated = $request->validate([
            'photo' => 'required|image|max:8192',
            'caption' => 'nullable|string|max:255',
            'type' => 'nullable|in:diagnosis,progress,finish,general',
        ]);

        $path = $request->file('photo')->store('work-orders/' . $order->id, 'public');

        $photo = $order->photos()->create([
            'path' => $path,
            'caption' => $validated['caption'] ?? null,
            'type' => $validated['type'] ?? 'general',
            'uploaded_by' => $request->user()->id,
        ]);

        if ($order->user) {
            app(NotificationService::class)->notify(
                $order->user,
                'Nueva foto en tu orden',
                "Se agregó una fotografía a la orden {$order->order_number}.",
                'info',
                ['channel' => 'order']
            );
        }

        return response()->json([
            'id' => $photo->id,
            'caption' => $photo->caption,
            'type' => $photo->type,
            'url' => $photo->url,
        ], 201);
    }

    public function listPhotos(Request $request, WorkOrder $order): JsonResponse
    {
        $staffRoles = ['admin', 'receptionist', 'mechanic'];
        if (! in_array($request->user()->role, $staffRoles, true)
            && $order->user_id !== $request->user()->id) {
            abort(403, 'No autorizado');
        }

        return response()->json($order->photos()->orderByDesc('id')->get()->map(fn ($p) => [
            'id' => $p->id,
            'caption' => $p->caption,
            'type' => $p->type,
            'url' => $p->url,
            'created_at' => $p->created_at?->toDateTimeString(),
            'uploaded_by' => $p->uploader?->name,
        ]));
    }

    // ---------- Clientes / motos (recepcionista) ----------

    public function storeClient(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:30',
            'password' => 'nullable|string|min:8',
        ]);

        $motorcycles = $request->input('motorcycles');
        if ($motorcycles) {
            $request->validate([
                'motorcycles.*.nickname' => 'nullable|string|max:255',
                'motorcycles.*.plate' => 'required|string|max:20',
                'motorcycles.*.year' => 'nullable|integer|between:1960,2100',
                'motorcycles.*.color' => 'nullable|string|max:50',
                'motorcycles.*.vin' => 'nullable|string|max:30',
                'motorcycles.*.brand_id' => 'nullable|exists:brands,id',
                'motorcycles.*.motorcycle_model_id' => 'nullable|exists:motorcycle_models,id',
                'motorcycles.*.current_odometer' => 'nullable|integer|min:0',
            ]);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'role' => 'customer',
            'password' => Hash::make($validated['password'] ?? Str::random(12)),
        ]);

        foreach ($motorcycles ?: [] as $moto) {
            $user->motorcycles()->create($moto + ['registered_at' => now()]);
        }

        return response()->json($user, 201);
    }

    public function listClients(Request $request): JsonResponse
    {
        $query = User::withCount('motorcycles')->where('role', 'customer')->orderBy('name');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('phone', 'ilike', "%{$search}%");
            });
        }

        $payload = $this->paginateBuilder($query, $this->perPage($request), $this->page($request));
        $payload['meta']['counts'] = [
            'all' => (int) $payload['meta']['total'],
            'this_month' => User::where('role', 'customer')
                ->where('created_at', '>=', now()->startOfMonth())
                ->count(),
        ];

        return response()->json($payload);
    }

    public function updateClient(Request $request, User $user): JsonResponse
    {
        if ($user->role !== 'customer') {
            abort(403, 'Solo clientes');
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:30',
            'points_balance' => 'sometimes|integer|min:0',
            'password' => 'sometimes|nullable|string|min:8',
        ]);

        $data = $validated;
        unset($data['password']);
        if (! empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        return response()->json($user->setHidden(['password']));
    }

    /**
     * Vista del admin sobre el garaje de un cliente: sus motos, servicios e historial.
     * NO se exponen credenciales, tokens ni información sensible.
     */
    public function clientDetail(Request $request, User $client): JsonResponse
    {
        if ($client->role !== 'customer') {
            abort(404);
        }

        $motorcycles = Motorcycle::with(['brand', 'model'])
            ->where('user_id', $client->id)
            ->orderByDesc('id')
            ->get();

        $orders = WorkOrder::where('user_id', $client->id)
            ->with('motorcycle')
            ->orderByDesc('id')
            ->get();

        $totalInvoiced = Invoice::where('user_id', $client->id)
            ->get()
            ->sum('total');

        return response()->json([
            'client' => [
                'id' => $client->id,
                'name' => $client->name,
                'email' => $client->email,
                'phone' => $client->phone,
                'points_balance' => (int) $client->points_balance,
                'created_at' => $client->created_at?->toDateString(),
            ],
            'motorcycles' => $motorcycles->map(fn ($m) => [
                'id' => $m->id,
                'nickname' => $m->nickname,
                'plate' => $m->plate,
                'year' => $m->year,
                'color' => $m->color,
                'vin' => $m->vin,
                'brand' => $m->brand?->name,
                'model' => $m->model?->name,
                'current_odometer' => $m->current_odometer,
                'status' => $m->status,
                'accessories' => collect($m->accessories ?? [])->values()->all(),
                'documentation' => $m->documentation,
                'registered_at' => $m->registered_at?->toDateString(),
                'photo' => $m->photo,
            ]),
            'orders' => $orders->map(fn ($o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'status' => $o->status,
                'quotation_status' => $o->quotation_status,
                'service_type' => $o->service_type,
                'created_at' => $o->created_at?->toDateTimeString(),
                'estimated_delivery' => $o->estimated_delivery?->toDateString(),
                'motorcycle' => $o->motorcycle?->nickname,
                'total' => round((float) $o->quotation_total, 2),
            ]),
            'stats' => [
                'motorcycles' => $motorcycles->count(),
                'orders' => $orders->count(),
                'active_orders' => $orders->whereIn('status', ['pending', 'in_progress', 'awaiting_approval'])->count(),
                'invoiced' => round($totalInvoiced, 2),
            ],
        ]);
    }

    public function deleteClient(Request $request, User $user): JsonResponse
    {
        if ($user->role !== 'customer') {
            abort(403, 'Solo clientes');
        }
        $user->delete();

        return response()->json(['message' => 'Cliente eliminado'], 200);
    }

    public function listMotorcycles(Request $request): JsonResponse
    {
        $query = Motorcycle::with(['user', 'brand'])->orderByDesc('id');

        if ($request->has('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        return response()->json($this->paginateBuilder($query, $this->perPage($request), $this->page($request)));
    }

    public function appointments(Request $request): JsonResponse
    {
        $query = Appointment::with(['mechanic', 'motorcycle'])->orderBy('date')->orderBy('time');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('phone', 'ilike', "%{$search}%");
            });
        }

        if ($request->get('status') && $request->get('status') !== 'all') {
            $query->where('status', $request->get('status'));
        }

        $pageData = $this->paginateBuilder($query, $this->perPage($request), $this->page($request));
        $pageData['data'] = collect($pageData['data'])->map(function ($a) {
            $a['day_name'] = $this->dayName($a['date']);
            $a['mechanic_name'] = isset($a['mechanic']) && $a['mechanic'] ? $a['mechanic']['name'] : null;
            unset($a['mechanic']);
            $a['motorcycle'] = isset($a['motorcycle']) && $a['motorcycle']
                ? ($a['motorcycle']['plate'] ?? $a['motorcycle']['nickname'] ?? 'Moto')
                : null;
            return $a;
        })->values();
        $pageData['meta']['counts'] = [
            'all' => Appointment::count(),
            'pending' => Appointment::where('status', 'pending')->count(),
            'confirmed' => Appointment::where('status', 'confirmed')->count(),
            'done' => Appointment::where('status', 'done')->count(),
            'cancelled' => Appointment::where('status', 'cancelled')->count(),
        ];

        return response()->json($pageData);
    }

    public function updateAppointment(Request $request, Appointment $appointment): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email',
            'phone' => 'nullable|string|max:30',
            'service_id' => 'nullable|exists:services,id',
            'notes' => 'nullable|string',
            'status' => 'sometimes|in:pending,confirmed,cancelled,done',
            'mechanic_id' => 'nullable|exists:users,id',
            'date' => 'nullable|date',
            'time' => 'nullable|date_format:H:i',
        ]);

        if (array_key_exists('date', $validated) || array_key_exists('time', $validated)) {
            $date = $validated['date'] ?? $appointment->date?->toDateString();
            $time = $validated['time'] ?? $appointment->time;
            app(\App\Services\AppointmentAvailabilityService::class)->assertSlot($date, $time);
        }

        if (array_key_exists('service_id', $validated)) {
            $service = $validated['service_id'] ? \App\Models\Service::find($validated['service_id']) : null;
            $validated['service_type'] = $service?->name;
        }
        if (isset($validated['name'])) {
            $validated['name'] = \App\Support\Input::clean($validated['name']);
        }
        if (isset($validated['notes'])) {
            $validated['notes'] = \App\Support\Input::clean($validated['notes'] ?? null);
        }

        $appointment->update($validated);

        // Al confirmar, avisar por WhatsApp al cliente (si está configurado).
        if (($validated['status'] ?? null) === 'confirmed') {
            $appointment->refresh();
            $sent = app(\App\Services\NotificationService::class)->sendAppointmentConfirmation($appointment);
            $appointment->load('mechanic');

            return response()->json([...$appointment->toArray(), 'wa_sent' => $sent]);
        }

        return response()->json($appointment->load('mechanic'));
    }

    public function deleteAppointment(Request $request, Appointment $appointment): JsonResponse
    {
        $appointment->delete();

        return response()->json(['message' => 'Cita eliminada'], 200);
    }

    // ---------- Citas ----------

    public function storeAppointment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email',
            'phone' => 'nullable|string|max:30',
            'service_id' => 'nullable|exists:services,id',
            'notes' => 'nullable|string',
            'date' => 'required|date|after:today',
            'time' => 'required|date_format:H:i',
        ]);

        $service = isset($validated['service_id'])
            ? \App\Models\Service::find($validated['service_id'])
            : null;

        app(\App\Services\AppointmentAvailabilityService::class)->assertSlot($validated['date'], $validated['time']);

        $appointment = \App\Models\Appointment::create([
            ...$validated,
            'name' => \App\Support\Input::clean($validated['name']),
            'email' => \App\Support\Input::clean($validated['email']),
            'phone' => $validated['phone'] ?? null,
            'service_type' => $service?->name,
            'notes' => \App\Support\Input::clean($validated['notes'] ?? null),
            'status' => 'confirmed',
        ]);

        app(\App\Services\NotificationService::class)->sendAppointmentConfirmation($appointment);

        return response()->json($appointment->load('mechanic'), 201);
    }

    // ---------- Inventario ----------

    public function stockMovements(Request $request, Product $product): JsonResponse
    {
        $query = \App\Models\StockMovement::with('user')->where('product_id', $product->id)
            ->orderByDesc('created_at')->orderByDesc('id');

        return response()->json($this->paginateBuilder($query, $this->perPage($request), $this->page($request)));
    }

    public function inventory(Request $request): JsonResponse
    {
        $base = Product::with(['category', 'brand', 'inventory'])->orderBy('name');

        if ($request->get('q')) {
            $q = $request->get('q');
            $base->where(function ($b) use ($q) {
                $b->where('name', 'ilike', "%{$q}%")
                    ->orWhere('sku', 'ilike', "%{$q}%")
                    ->orWhereHas('category', fn ($c) => $c->where('name', 'ilike', "%{$q}%"))
                    ->orWhereHas('brand', fn ($br) => $br->where('name', 'ilike', "%{$q}%"));
            });
        }
        if ($request->filled('category_id')) {
            $base->where('category_id', $request->get('category_id'));
        }
        if ($request->filled('brand_id')) {
            $base->where('brand_id', $request->get('brand_id'));
        }
        if ($request->filled('is_active')) {
            $base->where('is_active', filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $allCount = $base->toBase()->getCountForPagination();

        $low = (clone $base)->whereHas('inventory', fn ($q) => $q->whereColumn('quantity', '<=', 'min_stock'))->count();
        $out = (clone $base)->whereHas('inventory', fn ($q) => $q->where('quantity', 0))->count();

        $items = $base->forPage($this->page($request), $this->perPage($request))->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'description' => $p->description,
                'category_id' => $p->category_id,
                'category' => $p->category?->name,
                'brand_id' => $p->brand_id,
                'brand' => $p->brand?->name,
                'sku' => $p->sku,
                'unit' => $p->unit,
                'image' => $p->image,
                'price' => (float) $p->price,
                'promo_price' => $p->promo_price !== null ? (float) $p->promo_price : null,
                'cost' => (float) $p->cost,
                'quantity' => $p->inventory?->quantity ?? 0,
                'reserved' => $p->inventory?->reserved ?? 0,
                'available' => max(0, ($p->inventory?->quantity ?? 0) - ($p->inventory?->reserved ?? 0)),
                'min_stock' => $p->inventory?->min_stock ?? 0,
                'is_active' => (bool) $p->is_active,
            ]);

        $payload = $this->paginatePayload($items, $this->page($request), $this->perPage($request), $allCount);
        $payload['meta']['counts'] = ['all' => $allCount, 'low' => $low, 'out' => $out];

        return response()->json($payload);
    }

    public function updateStock(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'quantity' => 'required|integer|min:0',
            'min_stock' => 'nullable|integer|min:0',
            'price' => 'nullable|numeric|min:0',
            'cost' => 'nullable|numeric|min:0',
        ]);

        $price = isset($validated['price']) ? (float) $validated['price'] : (float) $product->price;
        $cost = isset($validated['cost']) ? (float) $validated['cost'] : (float) $product->cost;
        if ($price < $cost) {
            return response()->json([
                'message' => 'El precio de venta no puede ser menor al precio de compra (costo).',
            ], 422);
        }

        if (array_key_exists('price', $validated)) {
            $product->update(['price' => $price]);
        }
        if (array_key_exists('cost', $validated)) {
            $product->update(['cost' => $cost]);
        }

        $inv = $product->inventory()->firstOrCreate(['product_id' => $product->id]);
        $delta = $validated['quantity'] - ($inv->quantity ?? 0);
        $inv->update(['quantity' => $validated['quantity'], 'min_stock' => $validated['min_stock'] ?? $inv->min_stock]);

        app(\App\Services\InventoryService::class)->adjust(
            $product->id,
            $delta,
            [
                'reference' => null,
                'note' => $delta >= 0 ? 'Ajuste manual (entrada)' : 'Ajuste manual (salida)',
                'user_id' => $request->user()->id,
            ]
        );

        return response()->json($inv->fresh());
    }

    // ---------- Usuarios del taller (admin) ----------

    public function storeStaff(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:30',
            'role' => 'required|in:admin,receptionist,mechanic',
            'password' => 'required|string|min:8',
            'specialty' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:1000',
        ]);

        $user = User::create([
            ...$validated,
            'password' => Hash::make($validated['password']),
        ]);

        app(\App\Services\AuditService::class)->fromRequest($request, 'user_created', 'User', $user->id, ['name' => $user->name, 'role' => $user->role, 'email' => $user->email]);

        return response()->json($user, 201);
    }

    public function uploadStaffPhoto(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'photo' => 'required|image|max:5120',
        ]);

        $file = $request->file('photo');
        $photo = \App\Services\CloudinaryService::upload($file, 'staff')
            ?? url('/storage/' . $file->store('staff', 'public'));
        $user->update(['photo' => $photo]);

        return response()->json(['photo' => $user->photo, 'user_id' => $user->id]);
    }

    public function staff(Request $request): JsonResponse
    {
        $query = User::whereIn('role', ['admin', 'receptionist', 'mechanic'])->orderBy('name');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('phone', 'ilike', "%{$search}%")
                    ->orWhere('specialty', 'ilike', "%{$search}%");
            });
        }

        if ($request->get('role') && $request->get('role') !== 'all') {
            $query->where('role', $request->get('role'));
        }

        $payload = $this->paginateBuilder($query, $this->perPage($request), $this->page($request));
        $payload['meta']['counts'] = [
            'all' => User::whereIn('role', ['admin', 'receptionist', 'mechanic'])->count(),
            'admin' => User::where('role', 'admin')->count(),
            'receptionist' => User::where('role', 'receptionist')->count(),
            'mechanic' => User::where('role', 'mechanic')->count(),
        ];

        return response()->json($payload);
    }

    public function updateStaff(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:30',
            'role' => 'sometimes|in:admin,receptionist,mechanic',
            'specialty' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:1000',
        ]);

        $user->update($validated);

        return response()->json($user);
    }

    public function deleteStaff(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            abort(422, 'No puedes eliminarte a ti mismo');
        }
        $user->delete();

        return response()->json(['message' => 'Personal eliminado']);
    }

    // ---------- Dashboard (admin) ----------

    public function dashboard(Request $request): JsonResponse
    {
        $period = in_array($request->get('period'), ['7d', '30d', '12m'], true)
            ? $request->get('period')
            : '12m';

        return response()->json([
            'orders_total' => WorkOrder::count(),
            'orders_pending' => WorkOrder::where('status', 'pending')->count(),
            'orders_in_progress' => WorkOrder::where('status', 'in_progress')->count(),
            'orders_awaiting_approval' => WorkOrder::where('quotation_status', 'awaiting_approval')->count(),
            'customers' => User::where('role', 'customer')->count(),
            'motorcycles' => Motorcycle::count(),
            'products' => Product::count(),
            'appointments_pending' => Appointment::where('status', 'pending')->count(),
            'stock_low' => DB::table('inventory')
                ->whereColumn('quantity', '<=', 'min_stock')
                ->count(),
            'invoices_this_month' => Invoice::whereMonth('issue_date', now()->month)
                ->whereYear('issue_date', now()->year)
                ->get()
                ->sum('total'),
            'profit_this_month' => $this->monthProfit(),
            'store_orders_pending' => Invoice::whereNull('work_order_id')
                ->where('order_status', 'pending')
                ->count(),
            'store_proofs_pending' => Invoice::whereNull('work_order_id')
                ->where('order_status', 'payment_review')
                ->count(),
            'store_sales_this_month' => round((float) Invoice::whereNull('work_order_id')
                ->whereMonth('issue_date', now()->month)
                ->whereYear('issue_date', now()->year)
                ->sum('total'), 2),
            'recent_store_orders' => Invoice::whereNull('work_order_id')
                ->with('user')
                ->orderByDesc('id')->limit(5)->get()
                ->map(fn ($i) => [
                    'id' => $i->id,
                    'invoice_number' => $i->invoice_number,
                    'order_status' => $i->order_status ?? 'pending',
                    'customer' => $i->customer_name ?? $i->user?->name,
                    'total' => (float) $i->total,
                    'payment_method' => $i->payment_method,
                    'issued_at' => $i->issue_date?->toDateString(),
                ]),
            'monthly_series' => $this->monthlySeries($period),
            'channel_series' => $this->channelSeries($period),
            'top_products' => $this->topProducts(6),
            'payment_distribution' => $this->paymentDistribution($period),
            'recent_orders' => WorkOrder::with(['user', 'motorcycle', 'motorcycle.brand'])
                ->orderByDesc('id')->limit(8)->get()
                ->map(fn ($o) => $this->staffSerialize($o)),
            'orders_by_status' => $this->ordersByStatus(),
            'mechanics_workload' => $this->mechanicsWorkload(),
            'period' => $period,
        ]);
    }

    // ---------- Series de ventas por canal (tienda vs taller) ----------

    private function channelSeries(string $period): array
    {
        $buckets = $this->periodBuckets($period);

        Invoice::selectRaw('issue_date, work_order_id, sum(total) as total')
            ->where('issue_date', '>=', $buckets[0]['start'])
            ->where('issue_date', '<', end($buckets)['end'])
            ->groupBy('issue_date', 'work_order_id')
            ->get()
            ->each(function ($row) use (&$buckets, $period) {
                $idx = $this->bucketIndex($buckets, $row->issue_date, $period);
                if ($idx === null) {
                    return;
                }
                if ($row->work_order_id === null) {
                    $buckets[$idx]['store'] += (float) $row->total;
                } else {
                    $buckets[$idx]['workshop'] += (float) $row->total;
                }
            });

        return [
            'labels' => array_column($buckets, 'label'),
            'store' => array_column($buckets, 'store'),
            'workshop' => array_column($buckets, 'workshop'),
        ];
    }

    // ---------- Productos más vendidos ----------

    private function topProducts(int $limit): array
    {
        $storeItems = \App\Models\InvoiceItem::selectRaw('product_id, sum(quantity) as qty, sum(total) as revenue')
            ->whereNotNull('product_id')
            ->groupBy('product_id');

        $rows = \App\Models\WorkOrderItem::selectRaw('product_id, sum(quantity) as qty, sum(unit_price * quantity) as revenue')
            ->whereNotNull('product_id')
            ->groupBy('product_id')
            ->unionAll($storeItems)
            ->get()
            ->groupBy('product_id')
            ->map(function ($group) {
                return [
                    'qty' => (int) $group->sum('qty'),
                    'revenue' => (float) $group->sum('revenue'),
                ];
            })
            ->sortByDesc('revenue')
            ->take($limit);

        $products = \App\Models\Product::whereIn('id', $rows->keys()->all())->get()->keyBy('id');

        return $rows->map(fn ($r, $pid) => [
            'product_id' => (int) $pid,
            'name' => $products[$pid]->name ?? 'Producto',
            'qty' => $r['qty'],
            'revenue' => round($r['revenue'], 2),
            'stock' => $products[$pid]->available ?? 0,
        ])->values()->all();
    }

    // ---------- Distribución de métodos de pago ----------

    private function paymentDistribution(string $period): array
    {
        $buckets = $this->periodBuckets($period);

        $labels = [
            'efectivo' => ['label' => 'Efectivo', 'color' => '#10b981'],
            'transferencia' => ['label' => 'Transferencia', 'color' => '#0ea5e9'],
            'tarjeta' => ['label' => 'Tarjeta', 'color' => '#8b5cf6'],
        ];

        $counts = Invoice::selectRaw('payment_method, count(*) as count, sum(total) as total')
            ->where('issue_date', '>=', $buckets[0]['start'])
            ->where('issue_date', '<', end($buckets)['end'])
            ->groupBy('payment_method')
            ->get()
            ->keyBy('payment_method');

        return collect($labels)
            ->map(fn ($meta, $method) => [
                'label' => $meta['label'],
                'value' => (int) ($counts[$method]->count ?? 0),
                'amount' => (float) ($counts[$method]->total ?? 0),
                'color' => $meta['color'],
            ])
            ->values()
            ->all();
    }

    // Buckets según periodo: lista ordenada con rango [start, end), label y contadores
    private function periodBuckets(string $period): array
    {
        $buckets = [];

        if ($period === '7d') {
            foreach (range(6, 0) as $i) {
                $d = now()->copy()->subDays($i)->startOfDay();
                $buckets[] = [
                    'label' => $d->format('d/m'),
                    'start' => $d,
                    'end' => $d->copy()->addDay(),
                    'store' => 0.0,
                    'workshop' => 0.0,
                    'sales' => 0.0,
                ];
            }

            return $buckets;
        }

        $count = $period === '30d' ? 4 : 12;
        foreach (range($count - 1, 0) as $i) {
            if ($period === '30d') {
                $start = now()->copy()->subWeeks($i)->startOfWeek();
                $label = $start->format('d/m');
                $end = $start->copy()->addWeek();
            } else {
                $start = now()->copy()->subMonths($i)->startOfMonth();
                $label = $start->format('M');
                $end = $start->copy()->addMonth();
            }
            $buckets[] = [
                'label' => $label,
                'start' => $start,
                'end' => $end,
                'store' => 0.0,
                'workshop' => 0.0,
                'sales' => 0.0,
            ];
        }

        return $buckets;
    }

    // Índice del bucket que contiene la fecha, o null si está fuera del rango
    private function bucketIndex(array $buckets, $date, string $period): ?int
    {
        if (! $date) {
            return null;
        }

        foreach ($buckets as $i => $b) {
            if ($b['start']->lte($date) && $b['end']->gt($date)) {
                return $i;
            }
        }

        return null;
    }

    // ---------- Distribución de órdenes por estado (donut) ----------

    private function ordersByStatus(): array
    {
        $statuses = [
            'pending' => ['label' => 'Pendientes', 'color' => '#f59e0b'],
            'in_progress' => ['label' => 'En reparación', 'color' => '#0ea5e9'],
            'awaiting_approval' => ['label' => 'Por aprobar', 'color' => '#ea580c'],
            'approved' => ['label' => 'Aprobadas', 'color' => '#10b981'],
            'completed' => ['label' => 'Completadas', 'color' => '#059669'],
            'rejected' => ['label' => 'Rechazadas', 'color' => '#ef4444'],
        ];

        return array_map(
            fn ($s, $meta) => [
                'label' => $meta['label'],
                'value' => $s,
                'color' => $meta['color'],
            ],
            array_column(
                $this->ordersCounts(),
                'count',
                'status'
            ),
            $statuses
        );
    }

    private function ordersCounts(): array
    {
        return WorkOrder::selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->map(fn ($c) => ['count' => (int) $c])
            ->all();
    }

    // ---------- Carga de trabajo por mecánico (barras) ----------

    private function mechanicsWorkload(): array
    {
        return User::where('role', 'mechanic')
            ->orderBy('name')
            ->get()
            ->map(fn ($m) => [
                'label' => $m->name,
                'active' => WorkOrder::where('mechanic_id', $m->id)
                    ->whereIn('status', ['pending', 'in_progress'])
                    ->count(),
                'done' => WorkOrder::where('mechanic_id', $m->id)
                    ->whereIn('status', ['approved', 'completed'])
                    ->count(),
            ])
            ->values()
            ->all();
    }

    // ---------- Mantenimiento predictivo (admin) ----------

    public function maintenanceAlerts(Request $request): JsonResponse
    {
        $rules = \App\Models\MaintenanceRule::where('is_active', true)->get();

        $alerts = [];
        $motorcycles = Motorcycle::with(['user', 'brand', 'model'])->get();

        foreach ($motorcycles as $motorcycle) {
            foreach ($this->predictiveMaintenance($motorcycle, $rules) as $due) {
                $alerts[] = [
                    'motorcycle_id' => $motorcycle->id,
                    'plate' => $motorcycle->plate,
                    'nickname' => $motorcycle->nickname,
                    'brand' => $motorcycle->brand?->name,
                    'model' => $motorcycle->model?->name,
                    'current_odometer' => $motorcycle->current_odometer,
                    'customer' => $motorcycle->user?->name,
                    'customer_phone' => $motorcycle->user?->phone,
                    ...$due,
                ];
            }
        }

        usort($alerts, fn ($a, $b) => $a['priority_score'] <=> $b['priority_score']);

        $filters = $request->get('urgency');
        if ($filters) {
            $alerts = array_values(array_filter($alerts, fn ($a) => in_array($a['urgency'], explode(',', $filters))));
        }

        return response()->json([
            'data' => array_slice($alerts, 0, 200),
            'overdue' => count(array_filter($alerts, fn ($a) => $a['urgency'] === 'overdue')),
            'soon' => count(array_filter($alerts, fn ($a) => $a['urgency'] === 'soon')),
        ]);
    }

    private function predictiveMaintenance(Motorcycle $motorcycle, $rules): array
    {
        $result = [];

        foreach ($rules as $rule) {
            $order = WorkOrder::where('motorcycle_id', $motorcycle->id)
                ->when($rule->category, fn ($q) => $q->where('service_type', 'ilike', "%{$rule->category}%"))
                ->orderByDesc('created_at')
                ->first();

            $lastKm = $order && $order->odometer_in !== null ? (int) $order->odometer_in : (int) $motorcycle->current_odometer;
            $lastDate = $order && $order->created_at ? $order->created_at : now()->subMonths($rule->interval_months ?? 0);

            $dueKm = $rule->interval_km !== null ? $lastKm + $rule->interval_km : null;
            $dueDate = $rule->interval_months !== null ? $lastDate->copy()->addMonths($rule->interval_months) : null;

            $kmLeft = $dueKm !== null ? max(0, $dueKm - (int) $motorcycle->current_odometer) : null;
            $daysLeft = $dueDate !== null ? (int) now()->diffInDays($dueDate, false) : null;

            $urgency = 'ok';
            if (($kmLeft !== null && $kmLeft <= 0) || ($daysLeft !== null && $daysLeft <= 0)) {
                $urgency = 'overdue';
            } elseif (($kmLeft !== null && $kmLeft <= 500) || ($daysLeft !== null && $daysLeft <= 14)) {
                $urgency = 'soon';
            }

            $priorityScore = PHP_INT_MAX;
            if ($daysLeft !== null) {
                $priorityScore = $daysLeft;
            }
            if ($kmLeft !== null && ($priorityScore === PHP_INT_MAX || $kmLeft < $priorityScore)) {
                $priorityScore = $kmLeft;
            }

            $result[] = [
                'service_name' => $rule->service_name,
                'category' => $rule->category,
                'interval_km' => $rule->interval_km,
                'interval_months' => $rule->interval_months,
                'due_km' => $dueKm,
                'due_date' => $dueDate?->toDateString(),
                'km_left' => $kmLeft,
                'days_left' => $daysLeft,
                'urgency' => $urgency,
                'overdue' => ($kmLeft !== null && $kmLeft === 0) || ($daysLeft !== null && $daysLeft <= 0),
                'priority_score' => $priorityScore,
            ];
        }

        return $result;
    }

    // ---------- Agenda del taller (admin) ----------

    public function workshopAgenda(Request $request): JsonResponse
    {
        $mechanics = User::where('role', 'mechanic')->orderBy('name')->get();

        $perMechanic = $mechanics->map(fn ($m) => [
            'id' => $m->id,
            'name' => $m->name,
            'active_orders' => WorkOrder::where('mechanic_id', $m->id)
                ->whereIn('status', ['pending', 'in_progress', 'awaiting_approval'])
                ->count(),
            'in_progress' => WorkOrder::where('mechanic_id', $m->id)
                ->where('status', 'in_progress')
                ->count(),
            'orders' => WorkOrder::where('mechanic_id', $m->id)
                ->whereIn('status', ['pending', 'in_progress', 'awaiting_approval'])
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->map(fn ($o) => [
                    'id' => $o->id,
                    'order_number' => $o->order_number,
                    'status' => $o->status,
                    'service_type' => $o->service_type,
                    'estimated_delivery' => $o->estimated_delivery?->toDateString(),
                    'customer' => $o->user?->name,
                    'motorcycle' => $o->motorcycle?->nickname ?? $o->motorcycle?->plate,
                ]),
        ]);

        return response()->json([
            'mechanics' => $perMechanic,
            'today_appointments' => Appointment::with('mechanic')->whereDate('date', now()->toDateString())
                ->orderBy('time')
                ->get()
                ->map(fn ($a) => $this->appointmentRow($a)),
            'upcoming_appointments' => Appointment::with(['mechanic', 'motorcycle'])->where('date', '>', now()->toDateString())
                ->orderBy('date')
                ->orderBy('time')
                ->get()
                ->map(fn ($a) => $this->appointmentRow($a)),
            'waiting' => WorkOrder::where('status', 'pending')->whereNull('mechanic_id')->count(),
            'in_reparation' => WorkOrder::where('status', 'in_progress')->count(),
        ]);
    }

    // ---------- Calendario (días ocupados) ----------

    public function calendar(Request $request): JsonResponse
    {
        if ($day = $request->get('day')) {
            if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $day)) {
                return response()->json(['message' => 'Formato de día inválido'], 422);
            }

            return response()->json([
                'date' => $day,
                'day_name' => $this->dayName($day),
                'appointments' => Appointment::with(['mechanic', 'motorcycle'])->whereDate('date', $day)
                    ->orderBy('time')->get()
                    ->map(fn ($a) => [
                        'id' => $a->id,
                        'date' => $a->date?->toDateString(),
                        'time' => $a->time,
                        'day_name' => $this->dayName($a->date?->toDateString()),
                        'customer' => $a->name ?? 'Cliente',
                        'service_type' => $a->service_type,
                        'motorcycle' => $a->motorcycle ? ($a->motorcycle->plate ?? $a->motorcycle->nickname ?? 'Moto') : null,
                        'status' => $a->status,
                        'mechanic_id' => $a->mechanic_id,
                        'mechanic_name' => $a->mechanic?->name,
                    ]),
            ]);
        }

        $month = strval($request->get('month', now()->format('Y-m')));
        if (! preg_match('/^\d{4}-\d{2}$/', $month)) {
            $month = now()->format('Y-m');
        }

        $monthStart = $month . '-01';
        $monthEnd = $month . '-31';

        // Citas agendadas por día (todas excepto canceladas)
        $appointments = Appointment::whereBetween('date', [$monthStart, $monthEnd])
            ->where('status', '!=', 'cancelled')
            ->selectRaw("date, count(*) as total")
            ->groupBy('date')
            ->pluck('total', 'date')->map(fn ($v) => (int) $v);

        // Órdenes con entrega estimada en el mes (no finalizadas)
        $orders = WorkOrder::whereBetween('estimated_delivery', [$monthStart, $monthEnd])
            ->whereNotIn('status', ['completed', 'delivered', 'cancelled'])
            ->selectRaw("estimated_delivery, count(*) as total")
            ->groupBy('estimated_delivery')
            ->pluck('total', 'estimated_delivery')->map(fn ($v) => (int) $v);

        $days = collect(range(1, \Carbon\Carbon::parse($monthStart)->daysInMonth))->map(function ($day) use ($month, $appointments, $orders) {
            $date = $month . '-' . str_pad((string) $day, 2, '0', STR_PAD_LEFT);
            $spanish = [1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado', 7 => 'Domingo'];

            return [
                'date' => $date,
                'day_name' => $spanish[\Carbon\Carbon::parse($date)->dayOfWeek] ?? '',
                'appointments' => $appointments[$date] ?? 0,
                'orders' => $orders[$date] ?? 0,
            ];
        });

        return response()->json(['month' => $month, 'days' => $days]);
    }

    // ---------- helpers ----------

    private function dayName(?string $date): ?string
    {
        if (! $date) {
            return null;
        }
        $spanish = [1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado', 7 => 'Domingo'];

        return $spanish[\Carbon\Carbon::parse($date)->dayOfWeek] ?? null;
    }

    /**
     * Ganancia del mes actual: cobrado - costo de repuestos de facturas del mes.
     */
    private function monthProfit(): float
    {
        $invoices = Invoice::with('workOrder.items.product')
            ->whereMonth('issue_date', now()->month)
            ->whereYear('issue_date', now()->year)
            ->get();

        $cost = 0;
        foreach ($invoices as $invoice) {
            foreach ($invoice->workOrder?->items ?? [] as $woItem) {
                if ($woItem->product) {
                    $cost += ($woItem->product->cost ?? 0) * $woItem->quantity;
                }
            }
        }

        return round($invoices->sum('paid_amount') - $cost, 2);
    }

    private function monthlySeries(string $period = '12m'): array
    {
        $buckets = $this->periodBuckets($period);

        Invoice::selectRaw('issue_date, sum(total) as total')
            ->where('issue_date', '>=', $buckets[0]['start'])
            ->where('issue_date', '<', end($buckets)['end'])
            ->groupBy('issue_date')
            ->get()
            ->each(function ($row) use (&$buckets, $period) {
                $idx = $this->bucketIndex($buckets, $row->issue_date, $period);
                if ($idx === null) {
                    return;
                }
                $buckets[$idx]['sales'] += (float) $row->total;
            });

        return [
            'labels' => array_column($buckets, 'label'),
            'sales' => array_column($buckets, 'sales'),
        ];
    }

    private function appointmentRow(Appointment $a): array
    {
        return [
            'id' => $a->id,
            'name' => $a->customer_name ?? $a->name ?? 'Cliente',
            'email' => $a->email ?? '',
            'phone' => $a->phone,
            'service_type' => $a->service_type,
            'date' => $a->date?->toDateString(),
            'day_name' => $this->dayName($a->date?->toDateString()),
            'time' => $a->time,
            'status' => $a->status,
            'mechanic_id' => $a->mechanic_id,
            'mechanic_name' => $a->mechanic?->name,
            'motorcycle' => $a->motorcycle ? ($a->motorcycle->plate ?? $a->motorcycle->nickname ?? 'Moto') : null,
        ];
    }

    private function authorizeMechanic(Request $request, WorkOrder $order): void
    {
        if ($request->user()->role === 'mechanic' && $order->mechanic_id !== $request->user()->id) {
            abort(403, 'Esta orden no está asignada a ti');
        }
    }

    private function authorizeOwner(Request $request, WorkOrder $order): void
    {
        $mechanics = ['mechanic', 'admin', 'receptionist'];
        if (! in_array($request->user()->role, $mechanics, true)) {
            abort(403, 'No autorizado');
        }
    }

    public function auditLog(Request $request): JsonResponse
    {
        $query = \App\Models\AuditLog::with('user')->orderByDesc('id');

        if ($request->get('action')) {
            $query->where('action', $request->get('action'));
        }
        if ($request->get('entity_type')) {
            $query->where('entity_type', $request->get('entity_type'));
        }

        $total = $query->toBase()->getCountForPagination();
        $items = $query->forPage($this->page($request), $this->perPage($request))->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'user' => $a->user?->name,
                'action' => $a->action,
                'entity_type' => $a->entity_type,
                'entity_id' => $a->entity_id,
                'details' => $a->details,
                'ip' => $a->ip,
                'created_at' => $a->created_at?->toDateTimeString(),
            ]);

        return response()->json($this->paginatePayload($items, $this->page($request), $this->perPage($request), $total));
    }

    private function staffSerialize(WorkOrder $o): array
    {
        return [
            'id' => $o->id,
            'order_number' => $o->order_number,
            'status' => $o->status,
            'quotation_status' => $o->quotation_status,
            'service_type' => $o->service_type,
            'diagnosis' => $o->diagnosis,
            'created_at' => $o->created_at?->toDateTimeString(),
            'estimated_delivery' => $o->estimated_delivery?->toDateString(),
            'quotation_total' => round((float) $o->quotation_total, 2),
            'customer' => $o->user ? ['id' => $o->user->id, 'name' => $o->user->name] : null,
            'motorcycle' => $o->motorcycle ? [
                'id' => $o->motorcycle->id,
                'nickname' => $o->motorcycle->nickname,
                'plate' => $o->motorcycle->plate,
                'brand' => $o->motorcycle->brand?->name,
            ] : null,
            'mechanic' => $o->mechanic ? ['id' => $o->mechanic->id, 'name' => $o->mechanic->name] : null,
        ];
    }
}