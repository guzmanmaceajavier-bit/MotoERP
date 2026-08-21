<?php

namespace Database\Factories;

use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

class WorkOrderFactory extends Factory
{
    protected $model = WorkOrder::class;

    public function definition(): array
    {
        return [
            'order_number' => 'ORD-' . strtoupper($this->faker->unique()->lexify('????')) . '-' . $this->faker->unique()->numberBetween(1000, 9999),
            'status' => 'pending',
            'quotation_status' => 'pending',
            'service_type' => 'Mantenimiento',
        ];
    }
}