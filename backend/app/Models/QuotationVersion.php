<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationVersion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'work_order_id', 'version', 'status', 'parts_total', 'labor_total', 'subtotal',
        'tax_rate', 'tax', 'discount', 'total', 'items', 'labors', 'reason', 'created_by',
    ];

    protected $casts = [
        'parts_total' => 'decimal:2',
        'labor_total' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax' => 'decimal:2',
        'discount' => 'decimal:2',
        'total' => 'decimal:2',
        'items' => 'array',
        'labors' => 'array',
    ];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}