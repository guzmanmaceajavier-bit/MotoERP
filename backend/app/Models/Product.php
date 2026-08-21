<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id', 'brand_id', 'motorcycle_model_id', 'name', 'slug',
        'description', 'price', 'cost', 'sku', 'unit', 'image', 'is_active',
        'promo_price', 'part_type', 'variants',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'cost' => 'decimal:2',
        'promo_price' => 'decimal:2',
        'is_active' => 'boolean',
        'variants' => 'array',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function motorcycleModel(): BelongsTo
    {
        return $this->belongsTo(MotorcycleModel::class, 'motorcycle_model_id');
    }

    public function inventory(): HasOne
    {
        return $this->hasOne(Inventory::class);
    }

    public function stockAlerts(): HasMany
    {
        return $this->hasMany(StockAlert::class);
    }

    public function priceAlerts(): HasMany
    {
        return $this->hasMany(PriceAlert::class);
    }

    public function priceHistory(): HasMany
    {
        return $this->hasMany(PriceHistory::class);
    }

    public function getAvailableAttribute(): int
    {
        return max(0, ($this->inventory?->quantity ?? 0) - ($this->inventory?->reserved ?? 0));
    }

    public function getFinalPriceAttribute(): float
    {
        return $this->promo_price !== null && $this->promo_price < $this->price
            ? (float) $this->promo_price
            : (float) $this->price;
    }
}