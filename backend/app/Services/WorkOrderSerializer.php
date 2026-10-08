<?php

namespace App\Services;

use App\Models\WorkOrder;

class WorkOrderSerializer
{
    public function serialize(WorkOrder $o): array
    {
        return [
            'id' => $o->id,
            'order_number' => $o->order_number,
            'status' => $o->status,
            'quotation_status' => $o->quotation_status,
            'service_type' => $o->service_type,
            'diagnosis' => $o->diagnosis,
            'created_at' => $o->created_at?->toDateTimeString(),
            'estimated_delivery' => $o->estimated_delivery?->toDateString(),
            'quotation_total' => round((float) $o->quotation_total, 2),
            'customer' => $o->user ? ['id' => $o->user->id, 'name' => $o->user->name] : null,
            'motorcycle' => $o->motorcycle ? [
                'id' => $o->motorcycle->id,
                'nickname' => $o->motorcycle->nickname,
                'plate' => $o->motorcycle->plate,
                'brand' => $o->motorcycle->brand?->name,
            ] : null,
            'mechanic' => $o->mechanic ? ['id' => $o->mechanic->id, 'name' => $o->mechanic->name] : null,
        ];
    }
}
