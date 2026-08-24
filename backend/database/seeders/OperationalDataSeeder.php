<?php

namespace Database\Seeders;

use App\Models\Appointment;
use App\Models\Brand;
use App\Models\Invoice;
use App\Models\LoyaltyPoint;
use App\Models\Motorcycle;
use App\Models\MotorcycleModel;
use App\Models\Rating;
use App\Models\Service;
use App\Models\User;
use App\Models\Warranty;
use App\Models\WorkOrder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class OperationalDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->ensureDemoCredentials();
        $staff = $this->staff();
        $client = $this->clientsAndMotorcycles();
        $this->appointments($staff);
        $this->ordersAndFinance($client, $staff);

        $this->command?->info('OperationalDataSeeder terminado.');
    }

    private function ensureDemoCredentials(): void
    {
        $password = env('SEED_PASSWORD', Str::random(16));
        User::whereIn('email', ['admin@gmail.com', 'carlos@gmail.com', 'cliente@demo.com'])->update(['password' => Hash::make($password)]);
    }

    private function staff(): array
    {
        $password = env('SEED_PASSWORD', Str::random(16));

        $andres = User::firstOrCreate(
            ['email' => 'andres@motohub.test'],
            [
                'name' => 'Andrés Mejía', 'phone' => '3001112233', 'role' => 'mechanic',
                'password' => Hash::make($password),
                'specialty' => 'Mecánica general y transmisión',
                'bio' => 'Más de 8 años de experiencia en motos de 125 a 400 cc. Especialista en transmisión y motores de 4 tiempos.',
            ]
        );
        $daniela = User::firstOrCreate(
            ['email' => 'daniela@motohub.test'],
            [
                'name' => 'Daniela Ríos', 'phone' => '3004445566', 'role' => 'mechanic',
                'password' => Hash::make($password),
                'specialty' => 'Suspensión y sistema eléctrico',
                'bio' => 'Técnica en mantenimiento de motocicletas. Se enfoca en suspensión, frenos y diagnóstico eléctrico.',
            ]
        );
        $valentina = User::firstOrCreate(
            ['email' => 'valentina@motohub.test'],
            [
                'name' => 'Valentina Gómez', 'phone' => '3007778899', 'role' => 'receptionist',
                'password' => Hash::make($password),
                'specialty' => 'Atención al cliente',
                'bio' => 'Encargada de recibir tu moto, agendar citas y mantenerte al día con tus servicios.',
            ]
        );

        User::where('email', 'carlos@gmail.com')->update([
            'specialty' => 'Motores y carburación',
            'bio' => 'Mecánico senior. Diagnóstico de motores, carburación y sincronización.',
        ]);
        User::where('email', 'admin@gmail.com')->update([
            'specialty' => 'Dirección general',
            'bio' => 'Fundador y director del taller. Supervisa cada servicio y la calidad del trabajo.',
        ]);

        return [
            'andres' => $andres,
            'daniela' => $daniela,
            'valentina' => $valentina,
        ];
    }

    private function clientsAndMotorcycles(): User
    {
        $client = User::where('email', 'cliente@demo.com')->first();
        if (! $client) {
            $client = User::create([
                'name' => 'Cliente Demo', 'email' => 'cliente@demo.com', 'phone' => '3105550101',
                'role' => 'customer', 'password' => Hash::make($password), 'points_balance' => 0,
            ]);
        }

        $javier = User::where('email', 'guzmanmaceajavier@gmail.com')->first();
        $ana = User::where('email', 'ana@test.com')->first();

        if (Motorcycle::where('user_id', $client->id)->count() === 0) {
            $this->createMotorcycles($client, [
                ['Yamaha', 'YBR 125', 'Diaria', 'ZQR-12A', 2022, 'Azul', 18600],
                ['Bajaj', 'Pulsar NS 200', 'Pulsar', 'MOP-45B', 2021, 'Negro', 24800],
                ['Suzuki', 'Gixxer 150', 'Gixxer', 'GIX-90C', 2023, 'Rojo', 9200],
            ]);
        }
        if ($javier && Motorcycle::where('user_id', $javier->id)->count() === 0) {
            $this->createMotorcycles($javier, [
                ['Honda', 'CB 125F', 'CB Familiar', 'JAV-01D', 2020, 'Negro', 32100],
            ]);
        }
        if ($ana && Motorcycle::where('user_id', $ana->id)->count() === 0) {
            $this->createMotorcycles($ana, [
                ['Yamaha', 'YBR 125', 'YBR de trabajo', 'ANA-77E', 2021, 'Gris', 15400],
            ]);
        }

        return $client;
    }

    private function createMotorcycles(User $user, array $rows): void
    {
        foreach ($rows as $r) {
            [$brandName, $modelName, $nickname, $plate, $year, $color, $odo] = $r;
            $brand = Brand::firstOrCreate(['name' => $brandName]);
            $model = MotorcycleModel::firstOrCreate(['brand_id' => $brand->id, 'name' => $modelName]);
            Motorcycle::firstOrCreate(
                ['user_id' => $user->id, 'plate' => $plate],
                [
                    'brand_id' => $brand->id,
                    'motorcycle_model_id' => $model->id,
                    'nickname' => $nickname,
                    'year' => $year,
                    'color' => $color,
                    'current_odometer' => $odo,
                    'status' => 'active',
                ]
            );
        }
    }

    private function appointments(array $staff): void
    {
        $client = User::where('email', 'cliente@demo.com')->first();
        $javier = User::where('email', 'guzmanmaceajavier@gmail.com')->first();

        $svc = fn (string $name) => Service::where('name', $name)->value('id');

        $list = [
            ['done', now()->subDays(3)->toDateString(), '10:00', 'Carlos Rodríguez', 'cliente@demo.com', '3105550101', 'Cambio de aceite y filtro', $staff['andres']->id, $client->id, 'Cambio de aceite completado.'],
            ['done', now()->subDays(2)->toDateString(), '14:00', $javier?->name ?? 'Javier Guzman', $javier?->email, $javier?->phone, 'Cambio de balatas de freno', $staff['daniela']->id, $javier?->id, null],
            ['pending', now()->toDateString(), '10:00', 'Pedro Sánchez', 'pedro@example.com', '3201112233', 'Diagnóstico general (20 puntos)', $staff['andres']->id, null, 'Revisión completa antes de viaje.'],
            ['confirmed', now()->toDateString(), '15:30', 'Cliente Demo', 'cliente@demo.com', '3105550101', 'Cambio de kit de arrastre', $staff['daniela']->id, $client->id, null],
            ['pending', now()->addDays(2)->toDateString(), '09:30', 'Ana Torres', 'anatorres@example.com', '3204445566', 'Cambio de aceite y filtro', $staff['andres']->id, null, null],
            ['confirmed', now()->addDays(5)->toDateString(), '11:00', 'Cliente Demo', 'cliente@demo.com', '3105550101', 'Lavado general y detallado', $staff['valentina']->id, $client->id, null],
        ];

        foreach ($list as $a) {
            [$status, $date, $time, $name, $email, $phone, $serviceType, $mechanicId, $userId, $notes] = $a;
            if (Appointment::where('email', $email)->where('date', $date)->where('time', $time)->exists()) {
                continue;
            }
            Appointment::create([
                'user_id' => $userId,
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'service_type' => $serviceType,
                'service_id' => $svc($serviceType),
                'mechanic_id' => $mechanicId,
                'notes' => $notes,
                'date' => $date,
                'time' => $time,
                'status' => $status,
            ]);
        }
    }

    private function ordersAndFinance(User $client, array $staff): void
    {
        $andres = $staff['andres'];
        $daniela = $staff['daniela'];
        $javier = User::where('email', 'guzmanmaceajavier@gmail.com')->first();
        $ana = User::where('email', 'ana@test.com')->first();

        $svc = app(\App\Services\InventoryService::class);
        $modelName = fn (string $n) => \App\Models\Product::where('name', $n)->value('id');

        // --- ORDEN 1: cambio de aceite (completada, pagada) ---
        $motoYbr = Motorcycle::where('plate', 'ZQR-12A')->first();
        if ($motoYbr && ! WorkOrder::where('order_number', 'ORD-2026-0001')->exists()) {
            $oil = $modelName('Aceite Yamalube 20W-50 4T (1L)');
            $filter = $modelName('Filtro de aire YBR 125');
            $order = WorkOrder::create([
                'order_number' => 'ORD-2026-0001',
                'user_id' => $client->id,
                'motorcycle_id' => $motoYbr->id,
                'mechanic_id' => $andres->id,
                'status' => 'completed',
                'quotation_status' => 'approved',
                'service_type' => 'Cambio de aceite y filtro',
                'diagnosis' => 'Aceite oscurecido y filtro sucio; nivel bajo.',
                'odometer_in' => 18600,
                'odometer_out' => 18645,
                'started_at' => now()->subDays(3)->setTime(9, 0),
                'finished_at' => now()->subDays(3)->setTime(11, 0),
                'parts_cost' => 60000,
                'labor_cost' => 30000,
                'total' => 90000,
            ]);
            $order->items()->create(['description' => 'Aceite Yamalube 20W-50 4T (1L)', 'product_id' => $oil, 'quantity' => 1, 'unit_price' => 38000]);
            $order->items()->create(['description' => 'Filtro de aire YBR 125', 'product_id' => $filter, 'quantity' => 1, 'unit_price' => 22000]);
            $order->labors()->create(['description' => 'Mano de obra cambio de aceite y filtro', 'hours' => 1.5, 'hourly_rate' => 20000, 'amount' => 30000]);
            $order->statuses()->create(['status' => 'completed', 'comment' => 'Servicio completado y entregado', 'changed_by' => $andres->id]);

            $invoice = Invoice::create([
                'invoice_number' => 'INV-2026-0001',
                'work_order_id' => $order->id,
                'user_id' => $client->id,
                'customer_name' => $client->name,
                'customer_email' => $client->email,
                'customer_phone' => $client->phone,
                'subtotal' => 90000,
                'tax' => 0,
                'tax_rate' => 0,
                'discount' => 0,
                'points_used' => 0,
                'total' => 90000,
                'paid_amount' => 90000,
                'payment_method' => 'nequi',
                'status' => 'paid',
                'issue_date' => now()->subDays(3),
            ]);
            $invoice->items()->create(['description' => 'Aceite Yamalube 20W-50 4T (1L)', 'product_id' => $oil, 'quantity' => 1, 'unit_price' => 38000, 'total' => 38000]);
            $invoice->items()->create(['description' => 'Filtro de aire YBR 125', 'product_id' => $filter, 'quantity' => 1, 'unit_price' => 22000, 'total' => 22000]);
            $invoice->items()->create(['description' => 'Mano de obra', 'quantity' => 1, 'unit_price' => 30000, 'total' => 30000]);

            $this->addPoints($client, 90, 'Servicio INV-2026-0001');
            Warranty::create([
                'work_order_id' => $order->id,
                'description' => 'Garantía de mano de obra y repuestos',
                'type' => 'months', 'duration' => 3,
                'start_date' => now()->subDays(3), 'end_date' => now()->subDays(3)->addMonths(3),
                'is_active' => true,
            ]);

            $svc->sell($oil, 1, ['reference' => 'INV-2026-0001', 'note' => 'Venta por servicio', 'user_id' => $client->id, 'invoice_id' => $invoice->id]);
            $svc->sell($filter, 1, ['reference' => 'INV-2026-0001', 'note' => 'Venta por servicio', 'user_id' => $client->id, 'invoice_id' => $invoice->id]);

            Rating::firstOrCreate(
                ['work_order_id' => $order->id],
                ['user_id' => $client->id, 'score' => 5, 'comment' => 'Excelente atención, mi moto quedó como nueva. Muy buen precio.']
            );
        }

        // --- ORDEN 2: balatas (completada, pagada) ---
        $motoJavier = $javier ? Motorcycle::where('user_id', $javier->id)->first() : null;
        if ($motoJavier && ! WorkOrder::where('order_number', 'ORD-2026-0002')->exists()) {
            $pads = $modelName('Pastillas de freno delanteras CB 190R');
            $fluid = $modelName('Líquido de frenos DOT 4 (500ml)');
            $order = WorkOrder::create([
                'order_number' => 'ORD-2026-0002',
                'user_id' => $javier->id,
                'motorcycle_id' => $motoJavier->id,
                'mechanic_id' => $daniela->id,
                'status' => 'completed',
                'quotation_status' => 'approved',
                'service_type' => 'Cambio de balatas de freno',
                'diagnosis' => 'Pastillas delanteras gastadas al límite; freno esponjoso.',
                'odometer_in' => 32100,
                'odometer_out' => 32150,
                'started_at' => now()->subDays(2)->setTime(8, 30),
                'finished_at' => now()->subDays(2)->setTime(11, 30),
                'parts_cost' => 47000,
                'labor_cost' => 25000,
                'total' => 72000,
            ]);
            $order->items()->create(['description' => 'Pastillas de freno delanteras CB 190R', 'product_id' => $pads, 'quantity' => 1, 'unit_price' => 32000]);
            $order->items()->create(['description' => 'Líquido de frenos DOT 4 (500ml)', 'product_id' => $fluid, 'quantity' => 1, 'unit_price' => 15000]);
            $order->labors()->create(['description' => 'Mano de obra y sangrado del sistema', 'hours' => 2, 'hourly_rate' => 12500, 'amount' => 25000]);
            $order->statuses()->create(['status' => 'completed', 'comment' => 'Servicio completado y entregado', 'changed_by' => $daniela->id]);

            $invoice = Invoice::create([
                'invoice_number' => 'INV-2026-0002',
                'work_order_id' => $order->id,
                'user_id' => $javier->id,
                'customer_name' => $javier->name,
                'customer_email' => $javier->email,
                'customer_phone' => $javier->phone,
                'subtotal' => 72000,
                'tax' => 0,
                'tax_rate' => 0,
                'discount' => 0,
                'points_used' => 0,
                'total' => 72000,
                'paid_amount' => 72000,
                'payment_method' => 'efectivo',
                'status' => 'paid',
                'issue_date' => now()->subDays(2),
            ]);
            $invoice->items()->create(['description' => 'Pastillas de freno delanteras CB 190R', 'product_id' => $pads, 'quantity' => 1, 'unit_price' => 32000, 'total' => 32000]);
            $invoice->items()->create(['description' => 'Líquido de frenos DOT 4 (500ml)', 'product_id' => $fluid, 'quantity' => 1, 'unit_price' => 15000, 'total' => 15000]);
            $invoice->items()->create(['description' => 'Mano de obra', 'quantity' => 1, 'unit_price' => 25000, 'total' => 25000]);

            $this->addPoints($javier, 72, 'Servicio INV-2026-0002');

            $svc->sell($pads, 1, ['reference' => 'INV-2026-0002', 'note' => 'Venta por servicio', 'user_id' => $javier->id, 'invoice_id' => $invoice->id]);
            $svc->sell($fluid, 1, ['reference' => 'INV-2026-0002', 'note' => 'Venta por servicio', 'user_id' => $javier->id, 'invoice_id' => $invoice->id]);

            Rating::firstOrCreate(
                ['work_order_id' => $order->id],
                ['user_id' => $javier->id, 'score' => 5, 'comment' => 'Detectaron el problema a tiempo y el freno quedó perfecto.']
            );
        }

        // --- ORDEN 3: llanta (completada, pagada) ---
        $motoAna = $ana ? Motorcycle::where('user_id', $ana->id)->first() : null;
        if ($motoAna && ! WorkOrder::where('order_number', 'ORD-2026-0003')->exists()) {
            $tire = $modelName('Llanta trasera 120/80-17');
            $order = WorkOrder::create([
                'order_number' => 'ORD-2026-0003',
                'user_id' => $ana->id,
                'motorcycle_id' => $motoAna->id,
                'mechanic_id' => $andres->id,
                'status' => 'completed',
                'quotation_status' => 'approved',
                'service_type' => 'Cambio de llanta',
                'diagnosis' => 'Llanta trasera desgastada y con corte lateral.',
                'odometer_in' => 15400,
                'odometer_out' => 15420,
                'started_at' => now()->subDay()->setTime(10, 0),
                'finished_at' => now()->subDay()->setTime(12, 0),
                'parts_cost' => 145000,
                'labor_cost' => 25000,
                'total' => 170000,
            ]);
            $order->items()->create(['description' => 'Llanta trasera 120/80-17', 'product_id' => $tire, 'quantity' => 1, 'unit_price' => 145000]);
            $order->labors()->create(['description' => 'Montaje, balanceo y alineación', 'hours' => 1.5, 'hourly_rate' => 16667, 'amount' => 25000]);
            $order->statuses()->create(['status' => 'completed', 'comment' => 'Servicio completado y entregado', 'changed_by' => $andres->id]);

            $invoice = Invoice::create([
                'invoice_number' => 'INV-2026-0003',
                'work_order_id' => $order->id,
                'user_id' => $ana->id,
                'customer_name' => $ana->name,
                'customer_email' => $ana->email,
                'customer_phone' => $ana->phone,
                'subtotal' => 170000,
                'tax' => 0,
                'tax_rate' => 0,
                'discount' => 0,
                'points_used' => 0,
                'total' => 170000,
                'paid_amount' => 170000,
                'payment_method' => 'tarjeta',
                'status' => 'paid',
                'issue_date' => now()->subDay(),
            ]);
            $invoice->items()->create(['description' => 'Llanta trasera 120/80-17', 'product_id' => $tire, 'quantity' => 1, 'unit_price' => 145000, 'total' => 145000]);
            $invoice->items()->create(['description' => 'Mano de obra', 'quantity' => 1, 'unit_price' => 25000, 'total' => 25000]);

            $this->addPoints($ana, 170, 'Servicio INV-2026-0003');

            $svc->sell($tire, 1, ['reference' => 'INV-2026-0003', 'note' => 'Venta por servicio', 'user_id' => $ana->id, 'invoice_id' => $invoice->id]);

            Rating::firstOrCreate(
                ['work_order_id' => $order->id],
                ['user_id' => $ana->id, 'score' => 5, 'comment' => 'Cambiaron la llanta rápido y quedó muy bien balanceada.']
            );
        }

        // --- ORDEN 4: kit de arrastre (en proceso) ---
        $motoPulsar = Motorcycle::where('plate', 'MOP-45B')->first();
        if ($motoPulsar && ! WorkOrder::where('order_number', 'ORD-2026-0004')->exists()) {
            $kit = $modelName('Kit cadena y piñones Pulsar NS 200');
            $order = WorkOrder::create([
                'order_number' => 'ORD-2026-0004',
                'user_id' => $client->id,
                'motorcycle_id' => $motoPulsar->id,
                'mechanic_id' => $daniela->id,
                'status' => 'in_progress',
                'quotation_status' => 'approved',
                'service_type' => 'Cambio de kit de arrastre',
                'diagnosis' => 'Cadena estirada y piñones con dientes puntiagudos; ruido metálico al acelerar.',
                'odometer_in' => 24800,
                'started_at' => now(),
                'estimated_delivery' => now()->addDay(),
                'parts_cost' => 95000,
                'labor_cost' => 60000,
                'total' => 155000,
            ]);
            $order->items()->create(['description' => 'Kit cadena y piñones Pulsar NS 200', 'product_id' => $kit, 'quantity' => 1, 'unit_price' => 95000]);
            $order->labors()->create(['description' => 'Cambio de kit, tensado y lubricación', 'hours' => 2, 'hourly_rate' => 30000, 'amount' => 60000]);
            $order->statuses()->create(['status' => 'in_progress', 'comment' => 'Reparación iniciada', 'changed_by' => $daniela->id]);
        }
    }

    private function addPoints(User $user, int $points, string $concept): void
    {
        $balance = (int) $user->points_balance + $points;
        LoyaltyPoint::create(['user_id' => $user->id, 'points' => $points, 'concept' => $concept, 'balance_after' => $balance]);
        $user->update(['points_balance' => $balance]);
    }
}