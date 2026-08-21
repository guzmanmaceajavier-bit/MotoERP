<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\MotorcycleModel;
use Illuminate\Http\JsonResponse;

class CatalogController extends Controller
{
    public function brands(): JsonResponse
    {
        return response()->json(Brand::orderBy('name')->get());
    }

    public function models(int $brandId): JsonResponse
    {
        return response()->json(
            MotorcycleModel::where('brand_id', $brandId)
                ->where('is_active', true)
                ->orderBy('name')
                ->get()
        );
    }
}