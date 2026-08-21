<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

/**
 * Autoridad única para el inventario.
 *
 * stock_disponible = quantity (físico) - reserved (reservado)
 *
 * Garantiza las invariantes:
 *   - reserved nunca supera quantity (no stock_disponible < 0)
 *   - no se reserva/consume más de lo disponible
 *   - cada cambio se registra en stock_movements con trazabilidad
 *   - concurrencia controlada con bloqueo de fila (SELECT ... FOR UPDATE)
 */
class InventoryService
{
    /**
     * Lanza excepción si no hay stock disponible suficiente.
     */
    public function assertAvailable(int $productId, int $qty): void
    {
        $inv = Inventory::where('product_id', $productId)->lockForUpdate()->first();
        if ($inv) {
            $available = $inv->quantity - $inv->reserved;
            if ($available < $qty) {
                throw new \RuntimeException(
                    sprintf('Stock insuficiente (%d disponible, %d pedido)', $available, $qty)
                );
            }
        }
    }

    /**
     * Reserva sin quitar del físico. Falla si no hay disponible suficiente.
     */
    public function reserve(int $productId, int $qty, array $ctx = []): void
    {
        if ($qty <= 0) {
            return;
        }

        DB::transaction(function () use ($productId, $qty, $ctx) {
            $inv = Inventory::where('product_id', $productId)->lockForUpdate()->first();
            if (! $inv) {
                throw new \RuntimeException('El producto no tiene inventario configurado');
            }
            $available = $inv->quantity - $inv->reserved;
            if ($available < $qty) {
                throw new \RuntimeException(
                    sprintf('Stock insuficiente para reservar %d (disponible: %d)', $qty, max(0, $available))
                );
            }
            $inv->increment('reserved', $qty);
            $this->record([...$ctx], sellerProduct: $productId, qty: $qty, type: 'reserve');
        });
    }

    /**
     * Libera una reserva (no tocap físico).
     */
    public function release(int $productId, int $qty, array $ctx = []): void
    {
        if ($qty <= 0) {
            return;
        }

        DB::transaction(function () use ($productId, $qty, $ctx) {
            $inv = Inventory::where('product_id', $productId)->lockForUpdate()->first();
            if ($inv && $inv->reserved > 0) {
                $toRelease = min($qty, $inv->reserved);
                $inv->decrement('reserved', $toRelease);
                $this->record([...$ctx], sellerProduct: $productId, qty: $toRelease, type: 'release');
            }
        });
    }

    /**
     * Consume una reserva existente al facturar: baja físico y reservado.
     */
    public function consumeReserved(int $productId, int $qty, array $ctx = []): void
    {
        if ($qty <= 0) {
            return;
        }

        DB::transaction(function () use ($productId, $qty, $ctx) {
            $inv = Inventory::where('product_id', $productId)->lockForUpdate()->first();
            if ($inv) {
                $reserved = min($qty, $inv->reserved);
                $physical = min($qty, $inv->quantity);
                $inv->decrement('reserved', $reserved);
                $inv->decrement('quantity', $physical);
                $this->record([...$ctx], sellerProduct: $productId, qty: $physical, type: 'sale');
            }
        });
    }

    /**
     * Venta directa de tienda (sin reserva previa): solo baja físico.
     */
    public function sell(int $productId, int $qty, array $ctx = []): void
    {
        if ($qty <= 0) {
            return;
        }

        DB::transaction(function () use ($productId, $qty, $ctx) {
            $inv = Inventory::where('product_id', $productId)->lockForUpdate()->first();
            if ($inv) {
                if ($inv->quantity < $qty) {
                    throw new \RuntimeException('Stock insuficiente para la venta');
                }
                $inv->decrement('quantity', $qty);
                $this->record([...$ctx], sellerProduct: $productId, qty: $qty, type: 'sale');
            }
        });
    }

    /**
     * Entrada de stock (compra/suministro): sube físico.
     */
    public function add(int $productId, int $qty, array $ctx = []): void
    {
        if ($qty <= 0) {
            return;
        }

        DB::transaction(function () use ($productId, $qty, $ctx) {
            $inv = Inventory::firstOrCreate(['product_id' => $productId], ['quantity' => 0, 'reserved' => 0]);
            $locked = Inventory::lockForUpdate()->find($inv->id);
            $locked->increment('quantity', $qty);
            $this->record([...$ctx], sellerProduct: $productId, qty: $qty, type: 'purchase');
        });
    }

    /**
     * Ajuste manual: diferencia puede ser positiva o negativa.
     */
    public function adjust(int $productId, int $delta, array $ctx = []): void
    {
        if ($delta === 0) {
            return;
        }

        DB::transaction(function () use ($productId, $delta, $ctx) {
            $inv = Inventory::firstOrCreate(['product_id' => $productId], ['quantity' => 0, 'reserved' => 0]);
            $locked = Inventory::lockForUpdate()->find($inv->id);
            $newQty = $locked->quantity + $delta;
            if ($newQty < $locked->reserved) {
                throw new \RuntimeException('No se puede reducir el físico por debajo de lo reservado');
            }
            if ($newQty < 0) {
                throw new \RuntimeException('El stock físico no puede quedar negativo');
            }
            $locked->update(['quantity' => $newQty]);
            $this->record([...$ctx], sellerProduct: $productId, qty: abs($delta), type: 'adjustment');
        });
    }

    private function record(array $ctx, int $sellerProduct, int $qty, string $type): void
    {
        StockMovement::create([
            'product_id' => $sellerProduct,
            'quantity' => abs($qty),
            'type' => $type,
            'reference' => $ctx['reference'] ?? null,
            'note' => $ctx['note'] ?? null,
            'user_id' => $ctx['user_id'] ?? null,
            'order_id' => $ctx['order_id'] ?? null,
            'invoice_id' => $ctx['invoice_id'] ?? null,
            'purchase_id' => $ctx['purchase_id'] ?? null,
        ]);
    }
}