<?php

namespace App\Services;

use App\Models\LoyaltyPoint;
use App\Models\User;

// Puntos de fidelización, sumar/restar y dejar el registro en loyalty_points
class LoyaltyService
{
    // cuantos pesos vale cada punto
    public function pointsValue(): float
    {
        return (float) config('points.value', 100);
    }

    // 1 punto por cada 1000 pesos de compra
    public function earnedForTotal(float $total): int
    {
        return (int) floor($total / 1000);
    }

    // suma puntos y guarda el movimiento
    public function award(User $user, int $points, string $concept): void
    {
        if ($points <= 0) {
            return;
        }

        $user->increment('points_balance', $points);
        LoyaltyPoint::create([
            'user_id' => $user->id,
            'points' => $points,
            'concept' => $concept,
            'balance_after' => $user->fresh()->points_balance,
        ]);
    }

    // resta puntos y guarda el movimiento
    public function spend(User $user, int $points, string $concept): void
    {
        if ($points <= 0) {
            return;
        }

        $user->decrement('points_balance', $points);
        LoyaltyPoint::create([
            'user_id' => $user->id,
            'points' => -$points,
            'concept' => $concept,
            'balance_after' => $user->fresh()->points_balance,
        ]);
    }

    // codigo del cupon para canjear en el mostrador
    public function couponCode(): string
    {
        return 'MOTO-' . strtoupper(substr(str_shuffle('ABCDEFGHJKMNPQRSTUVWXYZ'), 0, 5)) . '-' . random_int(1000, 9999);
    }
}
