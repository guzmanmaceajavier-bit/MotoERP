<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Brand extends Model
{
    protected $fillable = ['name', 'image'];

    public function models(): HasMany
    {
        return $this->hasMany(MotorcycleModel::class);
    }
}