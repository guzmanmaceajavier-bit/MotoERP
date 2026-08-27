<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Coupon extends Model
{
    protected $fillable = ['code', 'type', 'value', 'min_order', 'max_uses', 'used_count', 'expires_at', 'active'];
    protected $casts = ['expires_at' => 'datetime', 'active' => 'boolean'];

    public function scopeValid(Builder $query): Builder
    {
        return $query->where('active', true)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->where(function ($q) {
                $q->whereNull('max_uses')->orWhereColumn('used_count', '<', 'max_uses');
            });
    }

    public function isValid(): bool
    {
        if (!$this->active) return false;
        if ($this->expires_at && $this->expires_at->isPast()) return false;
        if ($this->max_uses !== null && $this->used_count >= $this->max_uses) return false;
        return true;
    }

    public function applyDiscount(float $subtotal): float
    {
        if (!$this->isValid()) return 0;
        if ($subtotal < $this->min_order) return 0;
        if ($this->type === 'percentage') {
            return round($subtotal * ($this->value / 100), 0);
        }
        return min($this->value, $subtotal);
    }
}
