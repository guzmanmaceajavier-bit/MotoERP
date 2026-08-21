<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriceHistory extends \Illuminate\Database\Eloquent\Model
{
    protected $table = 'price_history';

    protected $fillable = ['product_id', 'price', 'promo_price'];

    protected $casts = [
        'price' => 'decimal:2',
        'promo_price' => 'decimal:2',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}