<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Motorcycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MotorcycleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $result = $request->user()->motorcycles()->with(['brand', 'model'])->get();

        return response()->json($result->map(fn (Motorcycle $m) => $this->serialize($m)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nickname' => 'nullable|string|max:255',
            'plate' => 'nullable|string|max:20',
            'year' => 'nullable|integer|between:1960,2100',
            'color' => 'nullable|string|max:50',
            'vin' => 'nullable|string|max:30',
            'brand_id' => 'nullable|exists:brands,id',
            'motorcycle_model_id' => 'nullable|exists:motorcycle_models,id',
            'current_odometer' => 'nullable|integer|min:0',
            'accessories' => 'nullable|array',
            'documentation' => 'nullable|string',
        ]);

        $validated['registered_at'] = now();

        $motorcycle = $request->user()->motorcycles()->create($validated);
        $motorcycle->load(['brand', 'model']);

        return response()->json($this->serialize($motorcycle), 201);
    }

    public function show(Request $request, Motorcycle $motorcycle): JsonResponse
    {
        $this->authorizeOwner($request, $motorcycle);

        return response()->json($this->serialize($motorcycle->load(['brand', 'model'])));
    }

    public function update(Request $request, Motorcycle $motorcycle): JsonResponse
    {
        $this->authorizeOwner($request, $motorcycle);

        $validated = $request->validate([
            'nickname' => 'nullable|string|max:255',
            'plate' => 'nullable|string|max:20',
            'year' => 'nullable|integer|between:1960,2100',
            'color' => 'nullable|string|max:50',
            'vin' => 'nullable|string|max:30',
            'brand_id' => 'nullable|exists:brands,id',
            'motorcycle_model_id' => 'nullable|exists:motorcycle_models,id',
            'current_odometer' => 'nullable|integer|min:0',
            'status' => 'nullable|string|max:50',
            'accessories' => 'nullable|array',
            'documentation' => 'nullable|string',
        ]);

        $motorcycle->update($validated);
        $motorcycle->load(['brand', 'model']);

        return response()->json($this->serialize($motorcycle));
    }

    public function destroy(Request $request, Motorcycle $motorcycle): JsonResponse
    {
        $this->authorizeOwner($request, $motorcycle);
        $motorcycle->delete();

        return response()->json(['message' => 'Motocicleta eliminada']);
    }

    public function uploadPhoto(Request $request, Motorcycle $motorcycle): JsonResponse
    {
        $this->authorizeOwner($request, $motorcycle);

        $validated = $request->validate([
            'photo' => 'required|image|max:5120',
        ]);

        $file = $request->file('photo');
        $photo = \App\Services\CloudinaryService::upload($file, 'motorcycles')
            ?? url('/storage/' . $file->store('motorcycles', 'public'));

        $motorcycle->update(['photo' => $photo]);

        return response()->json(['photo' => $photo]);
    }

    private function authorizeOwner(Request $request, Motorcycle $motorcycle): void
    {
        abort_if($motorcycle->user_id !== $request->user()->id, 403, 'No autorizado');
    }

    private function serialize(Motorcycle $m): array
    {
        return [
            'id' => $m->id,
            'nickname' => $m->nickname,
            'plate' => $m->plate,
            'year' => $m->year,
            'color' => $m->color,
            'vin' => $m->vin,
            'brand_id' => $m->brand_id,
            'motorcycle_model_id' => $m->motorcycle_model_id,
            'current_odometer' => (int) $m->current_odometer,
            'status' => $m->status,
            'notes' => $m->notes,
            'accessories' => $m->accessories ?? [],
            'documentation' => $m->documentation,
            'registered_at' => $m->registered_at?->toDateString(),
            'photo' => $m->photo,
            'brand' => $m->brand ? ['id' => $m->brand->id, 'name' => $m->brand->name] : null,
            'model' => $m->model ? ['id' => $m->model->id, 'name' => $m->model->name] : null,
        ];
    }
}