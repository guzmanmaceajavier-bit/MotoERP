<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\Paginates;
use App\Models\Appointment;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicController extends Controller
{
    use Paginates;

    public function paymentInfo(): JsonResponse
    {
        return response()->json([
            'workshop_name' => \App\Support\Settings::get('workshop_name', config('app.name')),
            'payment_options' => json_decode((string) \App\Support\Settings::get('payment_options', '[]'), true) ?: [],
            'payment_instructions' => (string) \App\Support\Settings::get('payment_instructions', ''),
            'shipping_fee' => (float) \App\Support\Settings::get('store_shipping_fee', config('store.shipping_fee', 12000)),
            'free_shipping_threshold' => (float) \App\Support\Settings::get('store_free_shipping_threshold', config('store.free_shipping_threshold', 150000)),
            'delivery_days' => (int) \App\Support\Settings::get('delivery_days', 3),
            'points_value' => (float) (\App\Support\Settings::get('points_value', config('points.value', 100))),
            'points_earning_threshold' => (float) (\App\Support\Settings::get('points_earning_threshold', 50000)),
        ]);
    }

    public function categories(): JsonResponse
    {
        return response()->json(Category::withCount('products')->orderBy('name')->get());
    }

    public function sharedFavorites(string $token): JsonResponse
    {
        $share = \App\Models\FavoriteShare::with('user')->where('token', $token)->first();
        if (! $share) {
            return response()->json(['message' => 'Lista no encontrada.'], 404);
        }

        $items = \App\Models\Favorite::where('user_id', $share->user_id)
            ->with(['product.category', 'product.brand', 'product.inventory'])
            ->orderByDesc('favorites.id')
            ->get()
            ->map(fn ($fav) => $this->serialize($fav->product));

        return response()->json([
            'owner' => $share->user?->name,
            'date' => $share->created_at?->toDateTimeString(),
            'data' => $items,
        ]);
    }

    public function team(): JsonResponse
    {
        $members = User::whereIn('role', ['admin', 'mechanic'])
            ->orderBy('role')
            ->orderBy('name')
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'name' => $m->name,
                'role' => $m->role,
                'photo' => $m->photo,
                'specialty' => $m->specialty,
                'bio' => $m->bio,
                'phone' => $m->phone,
            ]);

        return response()->json($members);
    }

    public function products(Request $request): JsonResponse
    {
        $query = Product::where('is_active', true)
            ->with(['category', 'brand', 'inventory']);

        if ($request->has('category')) {
            $query->whereHas('category', fn ($q) => $q->where('slug', $request->get('category')));
        }

        if ($request->has('brand')) {
            $query->whereHas('brand', fn ($q) => $q->where('id', $request->integer('brand')));
        }

        if ($request->has('model')) {
            $query->where('motorcycle_model_id', $request->integer('model'));
        }

        if ($request->has('part_type') && $request->get('part_type') !== '') {
            $query->where('part_type', $request->get('part_type'));
        }

        if ($request->has('price_min') && $request->get('price_min') !== '') {
            $query->where('price', '>=', $request->float('price_min'));
        }

        if ($request->has('price_max') && $request->get('price_max') !== '') {
            $query->where('price', '<=', $request->float('price_max'));
        }

        if ($request->has('ids') && $request->get('ids') !== '') {
            $ids = array_values(array_filter(array_map('intval', explode(',', (string) $request->get('ids')))));
            if ($ids !== []) {
                $query->whereIn('id', $ids);
            }
        }

        if ($request->has('search') && $request->get('search')) {
            $query->where('name', 'ilike', '%' . $request->get('search') . '%');
        }

        switch ($request->get('sort')) {
            case 'price_asc':
                $query->orderBy('price');
                break;
            case 'price_desc':
                $query->orderByDesc('price');
                break;
            case 'newest':
                $query->orderByDesc('id');
                break;
            default:
                $query->orderBy('name');
        }

        $total = $query->toBase()->getCountForPagination();
        $items = $query->forPage($this->page($request), $this->perPage($request))
            ->get()->map(fn ($p) => $this->serialize($p));

        return response()->json($this->paginatePayload($items, $this->page($request), $this->perPage($request), $total));
    }

    public function storeFilters(): JsonResponse
    {
        $base = Product::where('is_active', true);

        $brands = \App\Models\Brand::orderBy('name')->get()->map(function ($b) use ($base) {
            return [
                'id' => $b->id,
                'name' => $b->name,
                'count' => (clone $base)->where('brand_id', $b->id)->count(),
            ];
        })->filter(fn ($b) => $b['count'] > 0)->values();

        $models = \App\Models\MotorcycleModel::where('is_active', true)->orderBy('name')->get()->map(function ($m) use ($base) {
            return [
                'id' => $m->id,
                'name' => $m->name,
                'brand_id' => $m->brand_id,
                'count' => (clone $base)->where('motorcycle_model_id', $m->id)->count(),
            ];
        })->filter(fn ($m) => $m['count'] > 0)->values();

        $partTypes = $base->select('part_type', \Illuminate\Support\Facades\DB::raw('count(*) as count'))
            ->groupBy('part_type')
            ->pluck('count', 'part_type')
            ->map(fn ($count, $type) => ['type' => $type, 'count' => $count])
            ->values();

        $priceRange = [
            'min' => (float) (clone $base)->min('price'),
            'max' => (float) (clone $base)->max('price'),
        ];

        return response()->json([
            'brands' => $brands,
            'models' => $models,
            'part_types' => $partTypes,
            'price_range' => $priceRange,
        ]);
    }

    public function product(int $id): JsonResponse
    {
        $product = Product::where('is_active', true)
            ->with(['category', 'brand', 'inventory'])
            ->findOrFail($id);

        return response()->json($this->serialize($product));
    }

    public function productBySlug(string $slug): JsonResponse
    {
        $product = Product::where('is_active', true)
            ->where('slug', $slug)
            ->with(['category', 'brand', 'inventory'])
            ->firstOrFail();

        return response()->json($this->serialize($product));
    }

    public function services(): JsonResponse
    {
        return response()->json(
            \App\Models\Service::where('is_active', true)->orderBy('name')->get()
        );
    }

    public function homeData(): JsonResponse
    {
        $customers = \App\Models\User::where('role', 'customer')->count();
        $completedOrders = \App\Models\WorkOrder::whereIn('status', ['completed', 'delivered'])->count();
        $products = \App\Models\Product::where('is_active', true)->count();
        $avgRating = \App\Models\Rating::avg('score');

        $featuredServices = \App\Models\Service::where('is_active', true)
            ->orderBy('name')
            ->take(4)
            ->get(['id', 'name', 'description', 'price', 'estimated_minutes', 'category']);

        $featuredProducts = \App\Models\Product::where('is_active', true)
            ->with(['category', 'brand', 'inventory'])
            ->orderByDesc('id')
            ->take(8)
            ->get()
            ->map(fn ($p) => $this->serialize($p));

        $reviews = \App\Models\Rating::with(['user', 'workOrder'])
            ->whereNotNull('comment')
            ->orderByDesc('created_at')
            ->take(4)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'score' => $r->score,
                'comment' => $r->comment,
                'client_name' => $r->user?->name,
                'motorcycle' => $r->workOrder?->motorcycle?->name,
                'service_type' => $r->workOrder?->service_type,
                'created_at' => $r->created_at?->toDateString(),
            ]);

        $posts = \App\Models\Post::where('is_published', true)
            ->orderByDesc('published_at')
            ->take(3)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'title' => $p->title,
                'slug' => $p->slug,
                'excerpt' => $p->excerptText(),
                'cover' => $p->cover,
                'published_at' => $p->published_at?->toDateString(),
            ]);

        return response()->json([
            'stats' => [
                'customers' => $customers,
                'completed_orders' => $completedOrders,
                'products' => $products,
                'avg_rating' => $avgRating ? round((float) $avgRating, 1) : null,
            ],
            'featured_services' => $featuredServices,
            'featured_products' => $featuredProducts,
            'reviews' => $reviews,
            'posts' => $posts,
        ]);
    }

    public function siteInfo(): JsonResponse
    {
        return response()->json([
            'workshop_name' => \App\Support\Settings::get('workshop_name', config('app.name')),
            'workshop_logo' => \App\Support\Settings::get('workshop_logo', ''),
            'workshop_country' => \App\Support\Settings::get('workshop_country', 'CO'),
            'workshop_phone' => \App\Support\Settings::get('workshop_phone', ''),
            'workshop_address' => \App\Support\Settings::get('workshop_address', ''),
            'workshop_map_lat' => \App\Support\Settings::get('workshop_map_lat', '4.6603'),
            'workshop_map_lng' => \App\Support\Settings::get('workshop_map_lng', '-74.0681'),
            'closed_days' => json_decode((string) \App\Support\Settings::get('closed_days', '[]'), true) ?: [],
            'schedule_open' => \App\Support\Settings::get('schedule_open', '09:00'),
            'schedule_close' => \App\Support\Settings::get('schedule_close', '18:00'),
            'workshop_email' => \App\Support\Settings::get('workshop_email', ''),
            'social_facebook' => \App\Support\Settings::get('social_facebook', ''),
            'social_instagram' => \App\Support\Settings::get('social_instagram', ''),
            'social_tiktok' => \App\Support\Settings::get('social_tiktok', ''),
            'banners' => json_decode((string) \App\Support\Settings::get('banners', '[]'), true) ?: [],
            'hero_images' => json_decode((string) \App\Support\Settings::get('hero_images', '{}'), true) ?: [],
            'hero_texts' => json_decode((string) \App\Support\Settings::get('hero_texts', '{}'), true) ?: [],
            'day_hours' => json_decode((string) \App\Support\Settings::get('day_hours', '[]'), true) ?: [],
            'holidays' => json_decode((string) \App\Support\Settings::get('holidays', '[]'), true) ?: [],
            'points_value' => (float) (\App\Support\Settings::get('points_value', config('points.value', 100))),
            'points_earning_threshold' => (float) (\App\Support\Settings::get('points_earning_threshold', 50000)),
            'terms_content' => (string) \App\Support\Settings::get('terms_content', ''),
            'privacy_content' => (string) \App\Support\Settings::get('privacy_content', ''),
        ]);
    }

    public function contact(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => 'nullable|string|max:30',
            'subject' => 'nullable|string|max:255',
            'message' => 'required|string|max:5000',
        ]);

        $message = \App\Models\ContactMessage::create([
            'name' => \App\Support\Input::clean($validated['name']),
            'email' => \App\Support\Input::clean($validated['email']),
            'phone' => \App\Support\Input::clean($validated['phone'] ?? null),
            'subject' => \App\Support\Input::clean($validated['subject'] ?? null),
            'message' => \App\Support\Input::clean($validated['message']),
        ]);

        return response()->json($message, 201);
    }

    public function storeAppointment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email',
            'phone' => 'nullable|string|max:30',
            'service_id' => 'nullable|exists:services,id',
            'service_type' => 'nullable|string|max:255',
            'motorcycle_id' => 'nullable|exists:motorcycles,id',
            'notes' => 'nullable|string',
            'date' => 'required|date|after:today',
            'time' => 'required|date_format:H:i',
        ]);

        $user = $request->user('sanctum');

        if (! empty($validated['motorcycle_id'])) {
            $motorcycle = \App\Models\Motorcycle::find($validated['motorcycle_id']);
            if (! $motorcycle || ($user && $motorcycle->user_id !== $user->id)) {
                return response()->json(['message' => 'La motocicleta seleccionada no es válida.'], 422);
            }
        }

        $service = isset($validated['service_id'])
            ? \App\Models\Service::find($validated['service_id'])
            : null;

        $slot = app(\App\Services\AppointmentAvailabilityService::class)->check($validated['date'], $validated['time']);
        if ($slot !== true) {
            return response()->json(['message' => $slot], 422);
        }

        $appointment = Appointment::create([
            ...$validated,
            'name' => \App\Support\Input::clean($validated['name']),
            'service_type' => $service?->name ?? \App\Support\Input::clean($validated['service_type'] ?? null),
            'notes' => \App\Support\Input::clean($validated['notes'] ?? null),
            'user_id' => $user?->id,
            'status' => 'pending',
        ]);

        if ($user) {
            app(\App\Services\NotificationService::class)->notify(
                $user,
                'Cita agendada',
                "Tu cita para " . ($appointment->service_type ?: 'el servicio solicitado') .
                    " fue registrada para el " . $appointment->date->isoFormat('DD-MM-YYYY') .
                    " a las {$appointment->time}. Te esperamos.",
                'success',
                ['channel' => 'appointment']
            );
        }

        app(\App\Services\NotificationService::class)->sendAppointmentConfirmation($appointment);

        $queue = app(\App\Services\AppointmentQueueService::class)->forDate(
            $validated['date'],
            $validated['service_id'] ?? null,
            $validated['service_type'] ?? null
        );

        return response()->json([
            'appointment' => $appointment,
            'queue' => $queue,
            'message' => $queue['turn'] <= 1
                ? '¡Cita agendada! Eres el primer turno del día.'
                : '¡Cita agendada! ' . app(\App\Services\AppointmentQueueService::class)->message($queue),
        ], 201);
    }

    public function appointmentQueue(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'service_id' => 'nullable|exists:services,id',
            'service_type' => 'nullable|string|max:255',
        ]);

        $queue = app(\App\Services\AppointmentQueueService::class)->forDate(
            $validated['date'],
            $validated['service_id'] ?? null,
            $validated['service_type'] ?? null
        );

        return response()->json($queue);
    }

    public function trackOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_number' => 'required|string',
        ]);

        $order = WorkOrder::where('order_number', $validated['order_number'])->first();

        // Si no es una orden de taller, puede ser una factura de la tienda.
        if (! $order) {
            $invoice = \App\Models\Invoice::where('invoice_number', $validated['order_number'])
                ->with('items')
                ->first();

            if (! $invoice) {
                return response()->json(['message' => 'Orden no encontrada. Verifica el número.'], 404);
            }

            return response()->json([
                'order_number' => $invoice->invoice_number,
                'status' => $invoice->status,
                'kind' => 'store',
                'service_type' => 'Compra en tienda',
                'customer_name' => $invoice->customer_name,
                'created_at' => $invoice->issue_date?->toDateString(),
                'estimated_delivery' => null,
                'total' => (float) $invoice->total,
                'items' => $invoice->items->map(fn ($it) => [
                    'description' => $it->description,
                    'quantity' => $it->quantity,
                    'total' => (float) $it->total,
                ]),
            ]);
        }

        return response()->json([
            'order_number' => $order->order_number,
            'kind' => 'workshop',
            'status' => $order->status,
            'service_type' => $order->service_type,
            'created_at' => $order->created_at?->toDateString(),
            'estimated_delivery' => $order->estimated_delivery?->toDateString(),
            'observations' => $order->observations,
        ]);
    }

    private function serialize(Product $p): array
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