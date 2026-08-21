<?php

namespace App\Services;

use App\Models\PriceAlert;
use App\Models\PriceHistory;
use App\Models\Product;
use App\Models\StockAlert;
use App\Models\User;

class ProductAlertService
{
    /**
     * Registra un snapshot de precio si cambió respecto al último, y evalúa
     * las alertas de bajada de precio (one-shot) para ese producto.
     */
    public function recordPriceChange(Product $product): void
    {
        $last = PriceHistory::where('product_id', $product->id)->latest('id')->first();

        $price = (float) $product->price;
        $promo = $product->promo_price !== null ? (float) $product->promo_price : null;

        $changed = $last === null
            || (float) $last->price !== $price
            || ($promo === null ? null : $promo) !== ($last->promo_price !== null ? (float) $last->promo_price : null);

        if (! $changed) {
            $this->checkPriceAlerts($product);

            return;
        }

        PriceHistory::create([
            'product_id' => $product->id,
            'price' => $price,
            'promo_price' => $promo,
        ]);

        // Solo conservamos las últimas 30 entradas por producto.
        PriceHistory::where('product_id', $product->id)
            ->orderByDesc('id')
            ->skip(30)
            ->take(PHP_INT_MAX)
            ->delete();

        $this->checkPriceAlerts($product);
    }

    /**
     * Notifica (una vez) a los usuarios que pidieron aviso si el precio final
     * ya es menor o igual a su precio objetivo, y elimina la alerta.
     */
    public function checkPriceAlerts(Product $product): void
    {
        $final = (float) $product->final_price;
        $alerts = PriceAlert::where('product_id', $product->id)
            ->whereRaw('target_price >= ?', [$final])
            ->with('user')
            ->get();

        foreach ($alerts as $alert) {
            $alert->delete();

            $user = $alert->user;
            if ($user) {
                app(NotificationService::class)->notify(
                    $user,
                    '¡Bajó el precio!',
                    "\"{$product->name}\" ya está en ".$this->money($final).', al precio que querías.'.($user->phone ? ' Llévalo en la tienda.' : ''),
                    'success',
                    ['channel' => 'store']
                );
            }
        }
    }

    /**
     * Si el producto volvió a estar disponible, notifica a los usuarios con
     * alerta de stock y limpia esas alertas (one-shot).
     */
    public function checkStockAlerts(Product $product): void
    {
        if ($product->available <= 0 || $product->is_active === false) {
            return;
        }

        $alerts = StockAlert::where('product_id', $product->id)->with('user')->get();
        if ($alerts->isEmpty()) {
            return;
        }

        foreach ($alerts as $alert) {
            $alert->delete();

            $user = $alert->user;
            if ($user) {
                app(NotificationService::class)->notify(
                    $user,
                    '¡Volvió el stock!',
                    "\"{$product->name}\" ya está disponible ({$product->available} unidades).".($user->phone ? ' Llévalo en la tienda.' : ''),
                    'success',
                    ['channel' => 'store']
                );
            }
        }
    }

    private function money(float $value): string
    {
        return '$'.number_format($value, 0, ',', '.');
    }
}