<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriceAlert extends \Illuminate\Database\Eloquent\Model
{
    protected $fillable = ['user_id', 'product_id', 'target_price'];

    protected $casts = [
        'target_price' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}