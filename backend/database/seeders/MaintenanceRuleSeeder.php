<?php

namespace Database\Seeders;

use App\Models\MaintenanceRule;
use Illuminate\Database\Seeder;

class MaintenanceRuleSeeder extends Seeder
{
    public function run(): void
    {
        $rules = [
            ['service_name' => 'Cambio de aceite', 'interval_km' => 5000, 'interval_months' => 6, 'category' => 'aceite'],
            ['service_name' => 'Cambio de filtro de aire', 'interval_km' => 10000, 'interval_months' => 12, 'category' => 'filtro'],
            ['service_name' => 'Cambio de líquido de frenos', 'interval_km' => 20000, 'interval_months' => 24, 'category' => 'freno'],
            ['service_name' => 'Ajuste de válvulas', 'interval_km' => 15000, 'interval_months' => 18, 'category' => 'válvula'],
            ['service_name' => 'Cambio de kit de arrastre', 'interval_km' => 25000, 'interval_months' => 30, 'category' => 'arrastre'],
        ];

        foreach ($rules as $rule) {
            MaintenanceRule::updateOrCreate(['service_name' => $rule['service_name']], $rule);
        }
    }
}