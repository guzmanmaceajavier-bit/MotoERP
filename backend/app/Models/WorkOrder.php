<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_number', 'user_id', 'motorcycle_id', 'appointment_id', 'mechanic_id', 'status',
        'quotation_status', 'quotation_sent_at', 'quotation_resolved_at', 'customer_response_notes',
        'service_type', 'client_notes', 'diagnosis', 'mechanic_notes', 'observations',
        'odometer_in', 'odometer_out', 'estimated_delivery', 'started_at',
        'finished_at', 'labor_cost', 'parts_cost', 'total', 'quotation_total',
    ];

    protected $casts = [
        'estimated_delivery' => 'datetime',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'quotation_sent_at' => 'datetime',
        'quotation_resolved_at' => 'datetime',
        'labor_cost' => 'decimal:2',
        'parts_cost' => 'decimal:2',
        'total' => 'decimal:2',
        'quotation_total' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function motorcycle(): BelongsTo
    {
        return $this->belongsTo(Motorcycle::class);
    }

    public function mechanic(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mechanic_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(WorkOrderItem::class);
    }

    public function labors(): HasMany
    {
        return $this->hasMany(WorkOrderLabor::class);
    }

    public function statuses(): HasMany
    {
        return $this->hasMany(WorkOrderStatus::class)->latest();
    }

    public function warranties(): HasMany
    {
        return $this->hasMany(Warranty::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(WorkOrderPhoto::class);
    }

    public function getQuotationSubtotalAttribute(): float
    {
        $parts = $this->items->sum(fn ($i) => $i->quantity * $i->unit_price);
        $labor = $this->labors->sum('amount');

        return (float) $parts + (float) $labor;
    }
}