<?php

namespace Database\Seeders;

use App\Models\Appointment;
use App\Models\Brand;
use App\Models\Invoice;
use App\Models\LoyaltyPoint;
use App\Models\Motorcycle;
use App\Models\MotorcycleModel;
use App\Models\Product;
use App\Models\Warranty;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Models\WorkOrderLabor;
use App\Models\WorkOrderStatus;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        if (User::where('email', 'carlos@test.com')->exists()) {
            $this->command?->warn('Demo ya sembrado, se omite.');
            return;
        }

        // ---- Staff ----
        $mechanic1 = User::create(['name' => 'Jorge Pérez', 'email' => 'jorge@motohub.test', 'phone' => '3001112222', 'role' => 'mechanic', 'password' => Hash::make('secret123')]);
        $mechanic2 = User::create(['name' => 'Luis Gómez', 'email' => 'luis@motohub.test', 'phone' => '3003334444', 'role' => 'mechanic', 'password' => Hash::make('secret123')]);
        $reception = User::create(['name' => 'María Torres', 'email' => 'reception@motohub.test', 'phone' => '3005556666', 'role' => 'receptionist', 'password' => Hash::make('secret123')]);

        // ---- Cliente ----
        $carlos = User::create([
            'name' => 'Carlos Rodríguez',
            'email' => 'carlos@test.com',
            'phone' => '3119876543',
            'role' => 'customer',
            'password' => Hash::make('secret123'),
            'points_balance' => 49,
        ]);

        // ---- Motos ----
        $brandYamaha = Brand::where('name', 'Yamaha')->first();
        $modelYB = MotorcycleModel::where('name', 'YB 110')->first();
        $modelCGL = MotorcycleModel::where('name', 'CGL 125')->first();

        $moto1 = Motorcycle::create([
            'user_id' => $carlos->id,
            'brand_id' => $brandYamaha->id,
            'motorcycle_model_id' => $modelYB->id,
            'nickname' => 'Yamaha Diaria',
            'plate' => 'AB1-234',
            'year' => 2021,
            'color' => 'Azul',
            'current_odometer' => 18450,
            'status' => 'active',
        ]);
        $moto2 = Motorcycle::create([
            'user_id' => $carlos->id,
            'brand_id' => Brand::where('name', 'Honda')->first()->id,
            'motorcycle_model_id' => $modelCGL->id,
            'nickname' => 'Honda Paseo',
            'plate' => 'CD5-678',
            'year' => 2019,
            'color' => 'Negro',
            'current_odometer' => 32100,
            'status' => 'active',
        ]);

        // ---- Órdenes de trabajo ----
        $productOil = Product::where('slug', 'aceite-motul-3000-10w-40')->first();
        $productFilter = Product::where('slug', 'filtro-de-aceite')->first();

        $order1 = WorkOrder::create([
            'order_number' => 'ORD-TEST-0001',
            'user_id' => $carlos->id,
            'motorcycle_id' => $moto1->id,
            'mechanic_id' => $mechanic1->id,
            'status' => 'in_progress',
            'quotation_status' => 'approved',
            'service_type' => 'Cambio de aceite',
            'diagnosis' => 'El aceite está oscurecido y el nivel está bajo.',
            'odometer_in' => 18400,
            'estimated_delivery' => now()->addDay(),
            'started_at' => now(),
            'parts_cost' => 34000,
            'labor_cost' => 15000,
            'quotation_total' => 49000,
        ]);
        $order1->items()->create(['description' => $productOil->name, 'quantity' => 1, 'unit_price' => $productOil->price]);
        $order1->items()->create(['description' => $productFilter->name, 'quantity' => 1, 'unit_price' => $productFilter->price]);
        $order1->labors()->create(['description' => 'Mano de obra cambio de aceite y filtro', 'hours' => 1, 'hourly_rate' => 15000, 'amount' => 15000]);
        $order1->statuses()->create(['status' => 'pending', 'comment' => 'Orden creada', 'changed_by' => $reception->id]);

        // Orden disponible para aprobación de cotización
        $order2 = WorkOrder::create([
            'order_number' => 'ORD-EX-0657',
            'user_id' => $carlos->id,
            'motorcycle_id' => $moto2->id,
            'mechanic_id' => $mechanic2->id,
            'status' => 'awaiting_approval',
            'quotation_status' => 'awaiting_approval',
            'service_type' => 'Mantenimiento programado',
            'diagnosis' => 'Revisión general: tensar cadena y revisar frenos.',
            'odometer_in' => 32000,
            'quotation_sent_at' => now(),
            'parts_cost' => 42000,
            'labor_cost' => 26000,
            'quotation_total' => 68000,
        ]);
        $order2->items()->create(['description' => 'Kit de arrastre', 'quantity' => 1, 'unit_price' => 42000]);
        $order2->labors()->create(['description' => 'Instalación kit y ajustes', 'hours' => 2, 'hourly_rate' => 13000, 'amount' => 26000]);
        $order2->statuses()->create(['status' => 'awaiting_approval', 'comment' => 'Cotización enviada', 'changed_by' => $mechanic2->id]);

        // ---- Factura + puntos ----
        $inv = Invoice::create([
            'invoice_number' => 'INV-2026-BFS-5929',
            'work_order_id' => $order1->id,
            'user_id' => $carlos->id,
            'subtotal' => 49000,
            'tax' => 0,
            'discount' => 0,
            'points_used' => 0,
            'total' => 49000,
            'payment_method' => 'efectivo',
            'status' => 'paid',
            'issue_date' => now(),
        ]);
        $inv->items()->create(['description' => $productOil->name, 'quantity' => 1, 'unit_price' => $productOil->price, 'total' => $productOil->price]);
        $inv->items()->create(['description' => $productFilter->name, 'quantity' => 1, 'unit_price' => $productFilter->price, 'total' => $productFilter->price]);
        $inv->items()->create(['description' => 'Mano de obra', 'quantity' => 1, 'unit_price' => 15000, 'total' => 15000]);

        LoyaltyPoint::create(['user_id' => $carlos->id, 'points' => 49, 'concept' => 'Compra INV-2026-BFS-5929', 'balance_after' => 49]);

        // ---- Garantía ----
        Warranty::create([
            'work_order_id' => $order1->id,
            'description' => 'Garantía de mano de obra y repuestos',
            'type' => 'months',
            'duration' => 3,
            'start_date' => now(),
            'end_date' => now()->addMonths(3),
            'is_active' => true,
        ]);

        // ---- Citas ----
        Appointment::create([
            'user_id' => null,
            'name' => 'Pedro Sánchez',
            'email' => 'pedro@example.com',
            'phone' => '3201112233',
            'service_type' => 'Cambio de aceite',
            'date' => now()->toDateString(),
            'time' => '10:00',
            'status' => 'confirmed',
        ]);
        Appointment::create([
            'user_id' => null,
            'name' => 'Ana Díaz',
            'email' => 'ana@example.com',
            'phone' => '3204445566',
            'service_type' => 'Revisión de frenos',
            'date' => now()->addDay()->toDateString(),
            'time' => '15:30',
            'status' => 'pending',
        ]);

        $this->command?->info('Datos demo sembrados: 2 clientes+staff, 2 motos, 2 órdenes, 1 factura, 1 garantía, 2 citas.');
    }
}