<?php

namespace App\Services;

use App\Models\LoyaltyPoint;
use App\Models\User;

class LoyaltyService
{
    public function pointsValue(): float
    {
        return (float) config('points.value', 100);
    }

    public function earnedForTotal(float $total): int
    {
        return (int) floor($total / 1000);
    }

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

    public function couponCode(): string
    {
        return 'MOTO-' . strtoupper(substr(str_shuffle('ABCDEFGHJKMNPQRSTUVWXYZ'), 0, 5)) . '-' . random_int(1000, 9999);
    }
}
