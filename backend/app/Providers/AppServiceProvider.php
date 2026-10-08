<?php

namespace App\Providers;

use App\Models\Inventory;
use App\Models\Product;
use App\Services\ProductAlertService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
    }

    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $user = $request->user();
            if ($user) {
                return Limit::perMinute(200)->by($user->id);
            }
            return Limit::perMinute(60)->by($request->ip() ?? 'unknown');
        });

        Product::saved(function (Product $product) {
            if ($product->wasRecentlyCreated
                || $product->wasChanged('price')
                || $product->wasChanged('promo_price')) {
                app(ProductAlertService::class)->recordPriceChange($product);
            }
        });

        Inventory::saved(function (Inventory $inv) {
            $oldAvailable = max(0, ((int) $inv->getOriginal('quantity') ?? 0) - ((int) $inv->getOriginal('reserved') ?? 0));
            $newAvailable = max(0, (int) $inv->quantity - (int) $inv->reserved);

            if ($newAvailable > 0 && $oldAvailable <= 0) {
                $product = Product::find($inv->product_id);
                if ($product) {
                    app(ProductAlertService::class)->checkStockAlerts($product);
                }
            }
        });
    }
}