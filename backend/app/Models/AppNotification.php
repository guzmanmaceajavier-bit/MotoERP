<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'type', 'title', 'message', 'channel', 'wa_sent', 'read_at'])]
class AppNotification extends \Illuminate\Database\Eloquent\Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'wa_sent' => 'boolean',
        ];
    }
}