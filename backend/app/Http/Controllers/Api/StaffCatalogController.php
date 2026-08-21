<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\MotorcycleModel;
use App\Models\Product;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StaffCatalogController extends Controller
{
    // ---------- Servicios del taller ----------

    public function services(): JsonResponse
    {
        return response()->json(Service::orderBy('name')->get());
    }

    public function storeService(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'category' => 'nullable|string|max:120',
            'estimated_minutes' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        return response()->json(Service::create($validated), 201);
    }

    public function updateService(Request $request, Service $service): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
            'category' => 'nullable|string|max:120',
            'estimated_minutes' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        $service->update($validated);

        return response()->json($service);
    }

    public function deleteService(Request $request, Service $service): JsonResponse
    {
        $service->delete();

        return response()->json(['message' => 'Servicio eliminado']);
    }

    // ---------- Marcas ----------

    public function brands(): JsonResponse
    {
        return response()->json(Brand::withCount('models')->orderBy('name')->get());
    }

    public function storeBrand(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'image' => 'nullable|image|max:5120',
            'image_url' => 'nullable|string|max:2048',
        ]);

        $data = ['name' => $validated['name']];
        if ($request->hasFile('image')) {
            $data['image'] = \App\Services\CloudinaryService::upload($request->file('image'), 'brands');
        } elseif ($request->filled('image_url')) {
            $data['image'] = $request->input('image_url');
        }

        return response()->json(Brand::create($data), 201);
    }

    public function updateBrand(Request $request, Brand $brand): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:120',
            'image' => 'nullable|image|max:5120',
            'image_url' => 'nullable|string|max:2048',
        ]);

        $data = collect($validated)->except(['image', 'image_url'])->all();
        if ($request->hasFile('image')) {
            $data['image'] = \App\Services\CloudinaryService::upload($request->file('image'), 'brands');
        } elseif ($request->filled('image_url')) {
            $data['image'] = $request->input('image_url');
        }

        $brand->update($data);

        return response()->json($brand);
    }

    public function deleteBrand(Request $request, Brand $brand): JsonResponse
    {
        if ($brand->motorcycles()->exists()) {
            return response()->json(['message' => 'La marca tiene motos asociadas'], 422);
        }
        $brand->delete();

        return response()->json(['message' => 'Marca eliminada']);
    }

    // ---------- Modelos ----------

    public function models(): JsonResponse
    {
        return response()->json(
            MotorcycleModel::with('brand')->orderBy('name')->get()
                ->map(fn ($m) => ['id' => $m->id, 'brand_id' => $m->brand_id, 'brand' => $m->brand?->name, 'name' => $m->name, 'year' => $m->year, 'is_active' => (bool) $m->is_active])
        );
    }

    public function storeModel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'brand_id' => 'required|exists:brands,id',
            'name' => 'required|string|max:120',
            'year' => 'nullable|integer|min:1900',
            'is_active' => 'nullable|boolean',
        ]);

        return response()->json(MotorcycleModel::create($validated), 201);
    }

    public function updateModel(Request $request, MotorcycleModel $model): JsonResponse
    {
        $validated = $request->validate([
            'brand_id' => 'sometimes|exists:brands,id',
            'name' => 'sometimes|string|max:120',
            'year' => 'nullable|integer|min:1900',
            'is_active' => 'nullable|boolean',
        ]);

        $model->update($validated);

        return response()->json($model);
    }

    public function deleteModel(Request $request, MotorcycleModel $model): JsonResponse
    {
        $model->delete();

        return response()->json(['message' => 'Modelo eliminado']);
    }

    // ---------- Categorías ----------

    public function categories(): JsonResponse
    {
        return response()->json(Category::withCount('products')->orderBy('name')->get());
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'icon' => 'nullable|string|max:60',
        ]);

        return response()->json(
            Category::create([
                'name' => $validated['name'],
                'slug' => Str::slug($validated['name']),
                'icon' => $validated['icon'] ?? null,
            ]),
            201
        );
    }

    public function updateCategory(Request $request, Category $category): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:120',
            'icon' => 'nullable|string|max:60',
        ]);

        $data = [];
        if (isset($validated['name'])) {
            $data['name'] = $validated['name'];
            $data['slug'] = Str::slug($validated['name']);
        }
        if (array_key_exists('icon', $validated)) {
            $data['icon'] = $validated['icon'] ?: null;
        }

        $category->update($data);

        return response()->json($category);
    }

    public function deleteCategory(Request $request, Category $category): JsonResponse
    {
        if ($category->products()->exists()) {
            return response()->json(['message' => 'La categoría tiene productos'], 422);
        }
        $category->delete();

        return response()->json(['message' => 'Categoría eliminada']);
    }

    // ---------- Productos (tienda) ----------

    public function products(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'brand', 'inventory'])->orderBy('name');

        if ($request->get('q')) {
            $query->where('name', 'ilike', '%' . $request->get('q') . '%');
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->get('category_id'));
        }
        if ($request->filled('brand_id')) {
            $query->where('brand_id', $request->get('brand_id'));
        }
        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $counts = [
            'active' => Product::where('is_active', true)->count(),
            'inactive' => Product::where('is_active', false)->count(),
        ];

        return response()->json([
            'data' => $query->get()->map(fn ($p) => $this->productSerialize($p)),
            'meta' => ['counts' => $counts],
        ]);
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $this->normalizeVariants($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category_id' => 'nullable|exists:categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            'motorcycle_model_id' => 'nullable|exists:motorcycle_models,id',
            'price' => 'required|numeric|min:0',
            'promo_price' => 'nullable|numeric|min:0',
            'cost' => 'nullable|numeric|min:0',
            'sku' => 'nullable|string|max:100',
            'unit' => 'nullable|string|max:30',
            'part_type' => 'nullable|string|max:30',
            'description' => 'nullable|string',
            'quantity' => 'nullable|integer|min:0',
            'min_stock' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'image' => 'nullable|image|max:5120',
            'image_url' => 'nullable|string|max:2048',
            'variants' => 'nullable|array',
            'variants.*.name' => 'nullable|string|max:60',
            'variants.*.hex' => 'nullable|string|max:20',
        ]);

        $price = max(0, (float) ($validated['price'] ?? 0));
        $cost = max(0, (float) ($validated['cost'] ?? 0));
        if ($price < $cost) {
            return response()->json([
                'message' => 'El precio de venta no puede ser menor al precio de compra (costo).',
            ], 422);
        }

        $image = $request->filled('image_url') ? $request->input('image_url') : null;
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $image = \App\Services\CloudinaryService::upload($file, 'products')
                ?? url('/storage/' . $file->store('products', 'public'));
        }

        $product = Product::create([
            ...collect($validated)->except(['quantity', 'min_stock', 'image', 'image_url'])->all(),
            'slug' => $this->uniqueSlug($validated['name']),
            'image' => $image,
            'is_active' => $validated['is_active'] ?? true,
            'variants' => $validated['variants'] ?? [],
        ]);

        Inventory::create([
            'product_id' => $product->id,
            'quantity' => $validated['quantity'] ?? 0,
            'reserved' => 0,
            'min_stock' => $validated['min_stock'] ?? 0,
            'location' => 'Bodega A',
        ]);

        return response()->json($this->productSerialize($product->load('category', 'brand', 'inventory')), 201);
    }

    public function updateProduct(Request $request, Product $product): JsonResponse
    {
        $this->normalizeVariants($request);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'category_id' => 'nullable|exists:categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            'motorcycle_model_id' => 'nullable|exists:motorcycle_models,id',
            'price' => 'sometimes|numeric|min:0',
            'promo_price' => 'nullable|numeric|min:0',
            'cost' => 'nullable|numeric|min:0',
            'sku' => 'nullable|string|max:100',
            'unit' => 'nullable|string|max:30',
            'part_type' => 'nullable|string|max:30',
            'description' => 'nullable|string',
            'quantity' => 'nullable|integer|min:0',
            'min_stock' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'image' => 'nullable|image|max:5120',
            'image_url' => 'nullable|string|max:2048',
            'variants' => 'nullable|array',
            'variants.*.name' => 'nullable|string|max:60',
            'variants.*.hex' => 'nullable|string|max:20',
        ]);

        // Precio de venta no puede ser menor que el costo.
        $price = isset($validated['price']) ? (float) $validated['price'] : (float) $product->price;
        $cost = isset($validated['cost']) ? (float) $validated['cost'] : (float) $product->cost;
        if ($price < $cost) {
            return response()->json([
                'message' => 'El precio de venta no puede ser menor al precio de compra (costo).',
            ], 422);
        }

        $data = collect($validated)->except(['quantity', 'min_stock', 'image', 'image_url'])->all();
        if (array_key_exists('variants', $validated)) {
            $data['variants'] = $validated['variants'] ?? [];
        }
        if (isset($validated['name'])) {
            $data['slug'] = $this->uniqueSlug($validated['name'], $product->id);
        }
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $data['image'] = \App\Services\CloudinaryService::upload($file, 'products')
                ?? url('/storage/' . $file->store('products', 'public'));
        } elseif ($request->filled('image_url')) {
            $data['image'] = $request->input('image_url');
        }

        $product->update($data);

        if (array_key_exists('quantity', $validated) || array_key_exists('min_stock', $validated)) {
            $inv = $product->inventory()->firstOrCreate(['product_id' => $product->id]);
            $inv->update([
                'quantity' => $validated['quantity'] ?? $inv->quantity,
                'min_stock' => $validated['min_stock'] ?? $inv->min_stock,
            ]);
        }

        return response()->json($this->productSerialize($product->load('category', 'brand', 'inventory')));
    }

    public function deleteProduct(Request $request, Product $product): JsonResponse
    {
        $product->delete();

        return response()->json(['message' => 'Producto eliminado']);
    }

    // ---------- helpers ----------

    private function normalizeVariants(Request $request): void
    {
        $variants = $request->input('variants');
        if (is_string($variants)) {
            $decoded = json_decode($variants, true);
            if (is_array($decoded)) {
                $request->request->set('variants', $decoded);
            } else {
                $request->request->remove('variants');
            }
        }
    }

    private function uniqueSlug(string $name, ?int $ignore = null): string
    {
        $base = Str::slug($name);
        $slug = $base;
        $i = 1;
        while (Product::where('slug', $slug)->when($ignore, fn ($q) => $q->where('id', '!=', $ignore))->exists()) {
            $slug = $base . '-' . ($i++);
        }

        return $slug;
    }

    private function productSerialize(Product $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'slug' => $p->slug,
            'description' => $p->description,
            'price' => (float) $p->price,
            'promo_price' => $p->promo_price !== null ? (float) $p->promo_price : null,
            'final_price' => $p->final_price,
            'cost' => (float) $p->cost,
            'part_type' => $p->part_type,
            'unit' => $p->unit,
            'sku' => $p->sku,
            'image' => $p->image,
            'is_active' => (bool) $p->is_active,
            'variants' => $p->variants ?? [],
            'category_id' => $p->category_id,
            'category' => $p->category?->name,
            'brand_id' => $p->brand_id,
            'brand' => $p->brand?->name,
            'motorcycle_model_id' => $p->motorcycle_model_id,
            'quantity' => $p->inventory?->quantity ?? 0,
            'reserved' => $p->inventory?->reserved ?? 0,
            'min_stock' => $p->inventory?->min_stock ?? 0,
        ];
    }
}