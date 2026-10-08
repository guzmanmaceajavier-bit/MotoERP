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

        return response()->json(app(\App\Services\WorkOrderSerializer::class)->serialize($order), 201);
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
            ->get()->map(fn ($o) => app(\App\Services\WorkOrderSerializer::class)->serialize($o));

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

        return response()->json(app(\App\Services\WorkOrderSerializer::class)->serialize($order->fresh()));
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

        return response()->json(app(\App\Services\WorkOrderSerializer::class)->serialize($order->fresh()));
    }

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

        return response()->json(app(\App\Services\WorkOrderSerializer::class)->serialize($order->fresh()->load('items', 'labors')));
    }

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

        return response()->json(app(\App\Services\WorkOrderSerializer::class)->serialize($order->fresh()));
    }

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

        $passwordChanged = ! empty($validated['password']);

        $data = $validated;
        unset($data['password']);
        if ($passwordChanged) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        if ($passwordChanged) {
            $user->tokens()->delete();
        }

        return response()->json($user->setHidden(['password']));
    }

    public function sendClientCredentials(Request $request, User $user): JsonResponse
    {
        if ($user->role !== 'customer') {
            abort(403, 'Solo clientes');
        }

        $validated = $request->validate([
            'password' => 'required|string|min:8',
        ]);

        if (! $user->phone) {
            return response()->json(['message' => 'El cliente no tiene número de teléfono registrado'], 422);
        }

        $message = "Hola {$user->name}!\n\n"
            . "Tus credenciales para acceder a tu panel de {$user->email} son:\n\n"
            . "Correo: {$user->email}\n"
            . "Contraseña: {$validated['password']}\n\n"
            . "Puedes iniciar sesión aquí: " . config('app.url', 'https://motoerp.vercel.app') . "/login\n\n"
            . "Si no solicitaste este cambio, contacta al taller.";

        $sent = app(\App\Services\NotificationService::class)->sendWhatsApp($user->phone, $message);

        if ($sent) {
            return response()->json(['message' => 'Credenciales enviadas por WhatsApp']);
        }

        return response()->json(['message' => 'No se pudo enviar el mensaje. Verifica que WhatsApp esté configurado.'], 500);
    }

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
            $a['day_name'] = app(\App\Services\AgendaService::class)->dayName($a['date']);
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

    public function dashboard(Request $request): JsonResponse
    {
        $period = in_array($request->get('period'), ['7d', '30d', '12m'], true)
            ? $request->get('period')
            : '12m';

        return response()->json(app(\App\Services\DashboardService::class)->overview($period));
    }

    public function maintenanceAlerts(Request $request): JsonResponse
    {
        return response()->json(
            app(\App\Services\MaintenanceService::class)->alerts($request->get('urgency'))
        );
    }

    public function workshopAgenda(Request $request): JsonResponse
    {
        return response()->json(app(\App\Services\AgendaService::class)->workshop());
    }

    public function calendar(Request $request): JsonResponse
    {
        if ($day = $request->get('day')) {
            if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $day)) {
                return response()->json(['message' => 'Formato de día inválido'], 422);
            }

            return response()->json(app(\App\Services\AgendaService::class)->dayDetail((string) $day));
        }

        $month = strval($request->get('month', now()->format('Y-m')));
        if (! preg_match('/^\d{4}-\d{2}$/', $month)) {
            $month = now()->format('Y-m');
        }

        return response()->json(app(\App\Services\AgendaService::class)->month($month));
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
}