<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    protected $fillable = [
        'invoice_number', 'work_order_id', 'user_id', 'customer_name', 'customer_email',
        'customer_phone', 'shipping_address', 'subtotal', 'tax', 'tax_rate',
        'discount', 'points_used', 'total', 'paid_amount', 'payment_method', 'status',
        'order_status', 'payment_proof_path', 'invoice_pdf_path', 'issue_date',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'tax' => 'decimal:2',
        'discount' => 'decimal:2',
        'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'points_used' => 'integer',
        'issue_date' => 'date',
    ];

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function getOutstandingAttribute(): float
    {
        return round((float) $this->total - (float) $this->paid_amount, 2);
    }
}