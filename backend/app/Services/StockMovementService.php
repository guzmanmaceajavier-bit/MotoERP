<?php

namespace App\Services;

use App\Models\StockMovement;

class StockMovementService
{
    /**
     * Registra un movimiento de inventario.
     *
     * @param int    $productId
     * @param int    $quantity   cantidad del movimiento (siempre positiva)
     * @param string $type       initial|purchase|sale|reserve|release|adjustment|return
     * @param string|null $reference e.g. número de orden/factura
     * @param string|null $note
     * @param int|null $userId
     */
    public function record(int $productId, int $quantity, string $type, ?string $reference = null, ?string $note = null, ?int $userId = null): void
    {
        if ($quantity === 0) {
            return;
        }

        StockMovement::create([
            'product_id' => $productId,
            'quantity' => abs($quantity),
            'type' => $type,
            'reference' => $reference,
            'note' => $note,
            'user_id' => $userId,
        ]);
    }
}