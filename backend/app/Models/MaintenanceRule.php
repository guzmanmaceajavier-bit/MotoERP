<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaintenanceRule extends Model
{
    protected $fillable = [
        'service_name', 'interval_km', 'interval_months', 'category', 'is_active',
    ];

    protected $casts = [
        'interval_km' => 'integer',
        'interval_months' => 'integer',
        'is_active' => 'boolean',
    ];
}
