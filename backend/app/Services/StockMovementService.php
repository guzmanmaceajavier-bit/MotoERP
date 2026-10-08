<?php

namespace App\Services;

use App\Models\StockMovement;

class StockMovementService
{
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