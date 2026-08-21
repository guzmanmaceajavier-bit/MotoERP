<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\MotorcycleModel;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $products = [[
            'category' => 'Aceites y Lubricantes',
            'name' => 'Aceite Motul 3000 10W-40',
            'desc' => 'Aceite mineral para motor de 4 tiempos.',
            'price' => 22000, 'cost' => 15000, 'qty' => 40, 'min' => 10,
        ], [
            'category' => 'Aceites y Lubricantes',
            'name' => 'Aceite Shell Advance 4T 20W-50',
            'desc' => 'Aceite semisintético para altas temperaturas.',
            'price' => 25000, 'cost' => 17000, 'qty' => 35, 'min' => 8,
        ], [
            'category' => 'Frenos',
            'name' => 'Balatas de freno delantero (Juego)',
            'desc' => 'Juego de balatas sinterizadas, alta duración.',
            'price' => 18000, 'cost' => 11000, 'qty' => 25, 'min' => 5,
        ], [
            'category' => 'Frenos',
            'name' => 'Líquido de frenos DOT 4 (500ml)',
            'desc' => 'Líquido de frenos para sistema hidráulico.',
            'price' => 15000, 'cost' => 9000, 'qty' => 20, 'min' => 5,
        ], [
            'category' => 'Filtros',
            'name' => 'Filtro de aire universal (48mm)',
            'desc' => 'Filtro de aire de alto flujo, lavable.',
            'price' => 28000, 'cost' => 16000, 'qty' => 15, 'min' => 4,
        ], [
            'category' => 'Filtros',
            'name' => 'Filtro de aceite',
            'desc' => 'Filtro de aceite compatible con la mayoría de marcas.',
            'price' => 12000, 'cost' => 7000, 'qty' => 30, 'min' => 8,
        ], [
            'category' => 'Transmisión',
            'name' => 'Kit de arrastre completo (17/42)',
            'desc' => 'Estrella, piñón y cadena. Alta resistencia.',
            'price' => 145000, 'cost' => 95000, 'qty' => 6, 'min' => 2,
        ], [
            'category' => 'Encendido',
            'name' => 'Bujía NGK C7HSA',
            'desc' => 'Bujía estándar para motores de baja-moderada cilindrada.',
            'price' => 10000, 'cost' => 6000, 'qty' => 50, 'min' => 12,
        ], [
            'category' => 'Accesorios',
            'name' => 'Casco Integral MotoHub (Gris)',
            'desc' => 'Casco integral certificado, tallas S a XL.',
            'price' => 220000, 'cost' => 150000, 'qty' => 12, 'min' => 3,
        ], [
            'category' => 'Accesorios',
            'name' => 'Guantes de moto refuerzo Kevlar',
            'desc' => 'Guantes protectores con refuerzo en nudillos.',
            'price' => 95000, 'cost' => 60000, 'qty' => 18, 'min' => 4,
        ], [
            'category' => 'Suspensión',
            'name' => 'Amortiguador trasero (par)',
            'desc' => 'Amortiguadores ajustables, mejoran manejo.',
            'price' => 320000, 'cost' => 210000, 'qty' => 5, 'min' => 2,
        ], [
            'category' => 'Eléctrico',
            'name' => 'Batería 12V 7Ah libre de mantenimiento',
            'desc' => 'Batería sellada de arranque.',
            'price' => 180000, 'cost' => 130000, 'qty' => 10, 'min' => 3,
        ]];

        $brands = [
            'Yamaha' => ['YB 110', 'FZ-S 150', 'XTZ 125', 'NMAX 155', 'Crypton 110'],
            'Honda' => ['CB 125', 'XRM 125', 'Wave 110', 'CGL 125', 'XRE 300'],
            'Suzuki' => ['AX4', 'GN 125', 'Gixxer 150', 'Burgman 125'],
            'Bajaj' => ['Pulsar 150', 'Pulsar RS 200', 'Dominar 400', 'Boxer CT 100'],
            'Kawasaki' => ['Ninja 400', 'Vulcan 650', 'Versys 650'],
            'AKT' => ['NKD 125', 'TT 150', 'CR4 150'],
            'Vento' => ['Ventum 125', 'Moto X 150'],
            'Victory' => ['V6 250', 'Cross 250'],
        ];

        $admin = User::firstOrCreate(
            ['email' => 'admin@motohub.test'],
            ['name' => 'Administrador', 'phone' => '3000000000', 'role' => 'admin',
                'password' => Hash::make('secret123')]
        );
        $this->command?->info("Admin creado: admin@motohub.test / secret123");

        $brandModels = [];
        foreach ($brands as $brandName => $modelNames) {
            $brand = Brand::firstOrCreate(['name' => $brandName]);
            foreach ($modelNames as $modelName) {
                $brandModels[] = MotorcycleModel::firstOrCreate(
                    ['brand_id' => $brand->id, 'name' => $modelName]
                );
            }
        }

        foreach ($products as $p) {
            $category = Category::firstOrCreate(
                ['slug' => Str::slug($p['category'])],
                ['name' => $p['category']]
            );
            $product = Product::firstOrCreate(
                ['slug' => Str::slug($p['name'])],
                [
                    'category_id' => $category->id,
                    'name' => $p['name'],
                    'description' => $p['desc'],
                    'price' => $p['price'],
                    'cost' => $p['cost'],
                    'unit' => 'unidad',
                    'promo_price' => $p['promo'] ?? null,
                    'part_type' => $p['part'] ?? 'original',
                    'is_active' => true,
                ]
            );
            Inventory::firstOrCreate(
                ['product_id' => $product->id],
                ['quantity' => $p['qty'], 'reserved' => 0, 'min_stock' => $p['min'], 'location' => 'Bodega A']
            );
        }

        // Promociones e insumos adicionales (con descuento o alternativo)
        $extras = [
            ['category' => 'Aceites y Lubricantes', 'name' => 'Pack cambio de aceite MotoHub', 'desc' => 'Aceite 1L + filtro + mano de obra con descuento.', 'price' => 48000, 'cost' => 32000, 'qty' => 10, 'min' => 2, 'promo' => 39900],
            ['category' => 'Frenos', 'name' => 'Balatas genéricas de freno trasero', 'desc' => 'Repuesto alternativo con buena relación calidad-precio.', 'price' => 9800, 'cost' => 6000, 'qty' => 40, 'min' => 8, 'part' => 'alternativo'],
            ['category' => 'Encendido', 'name' => 'Bujía genérica (alternativa)', 'desc' => 'Alternativa económica, rendimiento estándar.', 'price' => 6800, 'cost' => 4200, 'qty' => 60, 'min' => 15, 'part' => 'alternativo'],
            ['category' => 'Accesorios', 'name' => 'Soporte de celular MotoHub', 'desc' => 'Soporte universal para GPS/celular, promoción de lanzamiento.', 'price' => 55000, 'cost' => 38000, 'qty' => 15, 'min' => 3, 'promo' => 44900],
        ];
        foreach ($extras as $p) {
            $category = Category::firstOrCreate(
                ['slug' => Str::slug($p['category'])],
                ['name' => $p['category']]
            );
            $product = Product::firstOrCreate(
                ['slug' => Str::slug($p['name'])],
                [
                    'category_id' => $category->id,
                    'name' => $p['name'],
                    'description' => $p['desc'],
                    'price' => $p['price'],
                    'cost' => $p['cost'],
                    'unit' => 'unidad',
                    'promo_price' => $p['promo'] ?? null,
                    'part_type' => $p['part'] ?? 'original',
                    'is_active' => true,
                ]
            );
            Inventory::firstOrCreate(
                ['product_id' => $product->id],
                ['quantity' => $p['qty'], 'reserved' => 0, 'min_stock' => $p['min'], 'location' => 'Bodega A']
            );
        }

        $this->command?->info('Catálogo sembrado: ' . count($brandModels) . ' modelos, ' . count($products) . ' productos.');

        $this->call(DemoDataSeeder::class);
        $this->call(MaintenanceRuleSeeder::class);
        $this->call(RealDataSeeder::class);
        $this->call(OperationalDataSeeder::class);
    }
}