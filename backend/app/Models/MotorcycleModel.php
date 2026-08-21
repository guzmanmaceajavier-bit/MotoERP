<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MotorcycleModel extends Model
{
    protected $fillable = ['brand_id', 'name', 'year', 'is_active'];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}