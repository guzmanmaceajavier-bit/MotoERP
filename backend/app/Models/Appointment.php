<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    protected $fillable = [
        'user_id', 'motorcycle_id', 'name', 'email', 'phone', 'service_type', 'service_id',
        'mechanic_id', 'reminder_sent_at',
        'notes', 'date', 'time', 'status',
    ];

    protected $casts = [
        'date' => 'date',
        'reminder_sent_at' => 'datetime',
    ];

    protected $appends = ['day_name'];

    public function mechanic(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'mechanic_id');
    }

    public function getDayNameAttribute(): string
    {
        if (! $this->date) {
            return '';
        }

        $days = [1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado', 7 => 'Domingo'];

        return $days[$this->date->dayOfWeek] ?? '';
    }

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function motorcycle(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Motorcycle::class);
    }
}