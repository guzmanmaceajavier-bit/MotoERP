<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FavoriteShare extends \Illuminate\Database\Eloquent\Model
{
    protected $fillable = ['user_id', 'token'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}