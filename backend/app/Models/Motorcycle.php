<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Motorcycle extends Model
{
    protected $fillable = [
        'user_id', 'brand_id', 'motorcycle_model_id', 'nickname', 'plate',
        'year', 'color', 'vin', 'current_odometer', 'status', 'notes',
        'accessories', 'documentation', 'registered_at', 'photo',
    ];

    protected $casts = [
        'current_odometer' => 'integer',
        'year' => 'integer',
        'accessories' => 'array',
        'registered_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function model(): BelongsTo
    {
        return $this->belongsTo(MotorcycleModel::class, 'motorcycle_model_id');
    }

    public function workOrders(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function warranties(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
    {
        return $this->hasManyThrough(Warranty::class, WorkOrder::class);
    }
}