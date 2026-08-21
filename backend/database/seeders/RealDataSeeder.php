<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\MaintenanceRule;
use App\Models\MotorcycleModel;
use App\Models\Post;
use App\Models\Product;
use App\Models\Service;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class RealDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->fixAndAddModels();
        $this->categories();
        $this->services();
        $this->suppliers();
        $this->products();
        $this->maintenanceRules();
        $this->posts();

        $this->command?->info('RealDataSeeder terminado.');
    }

    private function fixAndAddModels(): void
    {
        $suzuki = Brand::firstOrCreate(['name' => 'Suzuki']);
        $honda = Brand::firstOrCreate(['name' => 'Honda']);

        MotorcycleModel::where('brand_id', $honda->id)
            ->whereIn('name', ['Gixxer 250', 'GN 125'])
            ->update(['brand_id' => $suzuki->id]);

        $add = [
            'Bajaj' => ['Avenger 220'],
            'Yamaha' => ['MT-09', 'XTZ 125', 'Crypton 110'],
            'Honda' => ['XR 150L', 'XR 190L', 'Wave 110', 'Tornado XR 250'],
            'Suzuki' => ['Burgman 200'],
            'AKT' => ['TTR 125', 'CR4 125', 'NKD 200'],
            'TVS' => ['Ntorq 125', 'Apache RR 310'],
            'Hero' => ['Glamour 125'],
            'KTM' => ['Duke 200', 'Duke 390'],
        ];
        foreach ($add as $brandName => $models) {
            $brand = Brand::firstOrCreate(['name' => $brandName]);
            foreach ($models as $name) {
                MotorcycleModel::firstOrCreate(['brand_id' => $brand->id, 'name' => $name]);
            }
        }
    }

    private function categories(): void
    {
        $names = [
            'Aceites y Lubricantes', 'Filtros', 'Frenos', 'Transmisión',
            'Llantas y Cámaras', 'Baterías', 'Luces y Eléctrico',
            'Manubrios y Controles', 'Estética y Carenajes',
            'Equipo de Protección', 'Herramientas', 'Accesorios',
        ];
        foreach ($names as $name) {
            Category::firstOrCreate(['slug' => Str::slug($name)], ['name' => $name]);
        }
    }

    private function services(): void
    {
        $list = [
            ['Cambio de aceite y filtro', 'Incluye aceite 4T y filtro; revisión rápida de niveles.', 'Mecánica general', 45000, 45],
            ['Cambio de kit de arrastre', 'Cambio de cadena, piñón y estrella con tensado y lubricado.', 'Transmisión', 60000, 90],
            ['Cambio de balatas de freno', 'Balatas traseras o delanteras; ajuste y prueba de frenado.', 'Frenos', 30000, 45],
            ['Cambio de pastillas de freno', 'Pastillas delanteras hidráulicas con sangrado del sistema.', 'Frenos', 40000, 60],
            ['Ajuste y sincronización de carburador', 'Calibración de mezcla y ralentí para marcha estable.', 'Motor', 40000, 60],
            ['Cambio de bujía', 'Reemplazo de bujía y verificación de encendido.', 'Encendido', 10000, 20],
            ['Cambio de batería', 'Instalación de batería nueva y prueba de carga.', 'Eléctrico', 15000, 20],
            ['Cambio de llanta y cámara', 'Montaje, balanceo básico e inflado a presión correcta.', 'Llantas', 25000, 40],
            ['Cambio de amortiguadores', 'Reemplazo de amortiguadores traseros y prueba de manejo.', 'Suspensión', 80000, 90],
            ['Alineación y balanceo de llanta', 'Balanceo con pesos y alineación de dirección.', 'Llantas', 30000, 45],
            ['Ajuste de clutch y cables', 'Tensado y lubricación de clutch y cables.', 'Transmisión', 20000, 30],
            ['Cambio de líquido de frenos', 'Sangrado completo del circuito hidráulico.', 'Frenos', 35000, 45],
            ['Diagnóstico general (20 puntos)', 'Revisión integral: luces, frenos, cadena, niveles y más.', 'Diagnóstico', 20000, 40],
            ['Lavado general y detallado', 'Lavado a mano, cera protectora y limpieza de motor.', 'Estética', 35000, 60],
        ];
        foreach ($list as $s) {
            Service::firstOrCreate(
                ['name' => $s[0]],
                [
                    'description' => $s[1],
                    'category' => $s[2],
                    'price' => $s[3],
                    'estimated_minutes' => $s[4],
                    'is_active' => true,
                ]
            );
        }
    }

    private function suppliers(): void
    {
        $list = [
            ['Auteco S.A.S.', 'Distribuidor autorizado de motos y repuestos en Colombia.', null, null],
            ['Incolmotos Yamaha S.A.', 'Fábrica y distribuidor de repuestos originales Yamaha.', null, null],
            ['Grupo UMA Motos', 'Representante de Honda en Colombia; repuestos originales.', null, null],
            ['Suzuki Motor de Colombia S.A.', 'Distribuidor oficial Suzuki; repuestos y accesorios.', null, null],
            ['AKT Motos S.A.S.', 'Ensamble y distribución de motos AKT y TVS.', null, null],
        ];
        foreach ($list as $s) {
            Supplier::firstOrCreate(
                ['name' => $s[0]],
                ['contact' => $s[1], 'phone' => $s[2], 'email' => $s[3]]
            );
        }
    }

    private function products(): void
    {
        // [categoría, marca, modelo, nombre, precio, sku, cantidad, stock mínimo, promo, part_type]
        $list = [
            ['Aceites y Lubricantes', 'Bajaj', 'Pulsar NS 200', 'Aceite Motul 5100 10W-40 4T (1L)', 62000, 'AC-001', 12, 4, null, 'original'],
            ['Aceites y Lubricantes', 'Yamaha', 'YBR 125', 'Aceite Yamalube 20W-50 4T (1L)', 38000, 'AC-002', 12, 4, null, 'original'],
            ['Aceites y Lubricantes', 'Honda', 'CB 125F', 'Aceite Castrol Power1 10W-40 4T (1L)', 45000, 'AC-003', 10, 3, null, 'original'],
            ['Aceites y Lubricantes', 'AKT', 'NKD 125', 'Aceite Mobil Super 20W-50 4T (1L)', 34000, 'AC-004', 15, 4, null, 'original'],
            ['Aceites y Lubricantes', null, null, 'Aceite Motul 7100 10W-40 4T premium (1L)', 85000, 'AC-005', 6, 2, null, 'original'],
            ['Filtros', 'Bajaj', 'Pulsar NS 200', 'Filtro de aceite Pulsar NS 200', 14000, 'FL-001', 2, 5, null, 'original'],
            ['Filtros', 'Yamaha', 'YBR 125', 'Filtro de aire YBR 125', 22000, 'FL-002', 8, 3, null, 'original'],
            ['Filtros', 'Honda', 'CB 125F', 'Filtro de aceite CB 125F', 12000, 'FL-003', 6, 3, null, 'original'],
            ['Filtros', 'Suzuki', 'Gixxer 150', 'Filtro de aire Gixxer 150', 25000, 'FL-004', 5, 2, null, 'original'],
            ['Filtros', null, null, 'Filtro de aire universal 48mm', 28000, 'FL-005', 10, 3, null, 'original'],
            ['Frenos', 'Bajaj', 'Pulsar NS 200', 'Balatas de freno delanteras Pulsar NS 200 (par)', 18000, 'FR-001', 15, 5, null, 'original'],
            ['Frenos', 'Yamaha', 'YBR 125', 'Balatas de freno traseras YBR 125', 16000, 'FR-002', 15, 5, null, 'original'],
            ['Frenos', 'Honda', 'CB 190R', 'Pastillas de freno delanteras CB 190R', 32000, 'FR-003', 8, 3, null, 'original'],
            ['Frenos', 'AKT', 'NKD 125', 'Kit de balatas NKD 125', 15000, 'FR-004', 4, 2, null, 'alternativo'],
            ['Frenos', null, null, 'Líquido de frenos DOT 4 (500ml)', 15000, 'FR-005', 20, 5, null, 'original'],
            ['Transmisión', 'Bajaj', 'Pulsar NS 200', 'Kit cadena y piñones Pulsar NS 200', 95000, 'TR-001', 1, 3, 79000, 'original'],
            ['Transmisión', 'Yamaha', 'YBR 125', 'Cadena de transmisión 428H YBR 125', 60000, 'TR-002', 6, 2, null, 'original'],
            ['Transmisión', 'Suzuki', 'Gixxer 150', 'Piñón de ataque Gixxer 150', 28000, 'TR-003', 7, 2, null, 'original'],
            ['Transmisión', 'Honda', 'CB 125F', 'Kit cadena y piñones CB 125F', 78000, 'TR-004', 5, 2, null, 'original'],
            ['Transmisión', null, null, 'Estrella trasera 47 dientes (110-125cc)', 42000, 'TR-005', 6, 2, null, 'original'],
            ['Llantas y Cámaras', 'Bajaj', 'Pulsar NS 200', 'Llanta delantera 90/90-17', 135000, 'LL-001', 6, 2, null, 'original'],
            ['Llantas y Cámaras', 'Honda', 'CB 125F', 'Llanta trasera 120/80-17', 145000, 'LL-002', 6, 2, null, 'original'],
            ['Llantas y Cámaras', 'AKT', 'NKD 125', 'Llanta trasera 100/90-18', 140000, 'LL-003', 5, 2, null, 'original'],
            ['Llantas y Cámaras', null, null, 'Cámara de aire 17 pulgadas', 22000, 'LL-004', 25, 8, null, 'alternativo'],
            ['Baterías', 'Yamaha', 'YBR 125', 'Batería YTX7L-BS', 95000, 'BA-001', 8, 3, 85000, 'original'],
            ['Baterías', 'Bajaj', 'Pulsar NS 200', 'Batería YTX9-BS', 110000, 'BA-002', 6, 2, null, 'original'],
            ['Baterías', 'Honda', 'Wave 110', 'Batería YTX4L-BS', 80000, 'BA-003', 5, 2, null, 'alternativo'],
            ['Luces y Eléctrico', 'Yamaha', 'YBR 125', 'Bujía NGK C7HSA', 12000, 'LU-001', 30, 10, 9900, 'original'],
            ['Luces y Eléctrico', 'Bajaj', 'Pulsar NS 200', 'Bujía NGK CR8E', 16000, 'LU-002', 20, 6, null, 'original'],
            ['Luces y Eléctrico', null, null, 'Foco H4 12V 60/55W', 25000, 'LU-003', 12, 4, null, 'alternativo'],
            ['Luces y Eléctrico', 'Suzuki', 'Gixxer 150', 'Regulador de voltaje 12V Gixxer', 35000, 'LU-004', 6, 2, null, 'original'],
            ['Manubrios y Controles', null, null, 'Manubrio de freno (fijación izquierda)', 15000, 'MA-001', 20, 6, null, 'alternativo'],
            ['Manubrios y Controles', null, null, 'Manubrio de clutch', 15000, 'MA-002', 20, 6, null, 'alternativo'],
            ['Manubrios y Controles', 'Bajaj', 'Boxer CT 100', 'Cable de acelerador Boxer CT 100', 12000, 'MA-003', 10, 3, null, 'original'],
            ['Estética y Carenajes', null, null, 'Espejos retrovisores (par)', 30000, 'ES-001', 12, 3, null, 'original'],
            ['Estética y Carenajes', null, null, 'Foco de stop 12V', 18000, 'ES-002', 15, 5, null, 'alternativo'],
            ['Equipo de Protección', null, null, 'Casco integral (tallas M y L)', 145000, 'EP-001', 4, 2, 129000, 'original'],
            ['Equipo de Protección', null, null, 'Guantes de moto con protección en nudillos', 60000, 'EP-002', 12, 3, null, 'original'],
            ['Equipo de Protección', null, null, 'Chaqueta con protecciones', 220000, 'EP-003', 5, 2, null, 'original'],
            ['Herramientas', null, null, 'Juego de dados milimétrico 1/4 pulgada', 85000, 'HR-001', 4, 2, null, 'alternativo'],
            ['Herramientas', null, null, 'Gato para motocicleta', 90000, 'HR-002', 3, 1, null, 'alternativo'],
            ['Accesorios', null, null, 'Candado de disco antirrobo', 55000, 'AC-006', 3, 2, 45000, 'original'],
            ['Accesorios', null, null, 'Bolso de tanque magnético', 120000, 'AC-007', 5, 2, null, 'original'],
            ['Accesorios', null, null, 'Soporte de celular para manubrio', 40000, 'AC-008', 15, 4, 32000, 'original'],
            ['Accesorios', null, null, 'Cable candado para casco', 45000, 'AC-009', 10, 3, null, 'original'],
        ];

        foreach ($list as $p) {
            [$categoryName, $brandName, $modelName, $name, $price, $sku, $qty, $min, $promo, $part] = $p;

            $category = Category::firstOrCreate(['slug' => Str::slug($categoryName)], ['name' => $categoryName]);

            $brandId = null;
            $modelId = null;
            if ($brandName) {
                $brand = Brand::firstOrCreate(['name' => $brandName]);
                $brandId = $brand->id;
                if ($modelName) {
                    $modelId = MotorcycleModel::firstOrCreate(['brand_id' => $brand->id, 'name' => $modelName])->id;
                }
            }

            $product = Product::firstOrCreate(
                ['name' => $name],
                [
                    'category_id' => $category->id,
                    'brand_id' => $brandId,
                    'motorcycle_model_id' => $modelId,
                    'slug' => Str::slug($name) . '-' . strtolower(Str::random(4)),
                    'description' => $this->describeProduct($categoryName, $name),
                    'price' => $price,
                    'cost' => round($price * 0.7),
                    'sku' => $sku,
                    'unit' => 'unidad',
                    'promo_price' => $promo,
                    'part_type' => $part,
                    'is_active' => true,
                ]
            );

            Inventory::firstOrCreate(
                ['product_id' => $product->id],
                ['quantity' => $qty, 'reserved' => 0, 'min_stock' => $min, 'location' => 'Bodega A']
            );
        }
    }

    private function describeProduct(string $category, string $name): string
    {
        $generic = 'Repuesto de buena calidad para tu moto. Consulte compatibilidad exacta con su modelo antes de comprar.';
        return match ($category) {
            'Aceites y Lubricantes' => 'Lubricante para motor de 4 tiempos, mejora el rendimiento y protege el motor.',
            'Filtros' => 'Filtro de repuesto; reemplácelo en cada mantenimiento para cuidar el motor.',
            'Frenos' => 'Elemento de frenado de alta duración; revise su desgaste periódicamente.',
            'Transmisión' => 'Pieza de transmisión que garantiza un cambio de velocidad suave y seguro.',
            'Llantas y Cámaras' => 'Producto de rodadura de calidad para un manejo estable y seguro.',
            'Baterías' => 'Batería libre de mantenimiento para un arranque confiable.',
            'Luces y Eléctrico' => 'Componente eléctrico de calidad para el sistema de luces y encendido.',
            'Manubrios y Controles' => 'Control y manubrio para un manejo preciso y cómodo.',
            'Estética y Carenajes' => 'Pieza de acabado que mejora la apariencia de tu moto.',
            'Equipo de Protección' => 'Equipo de protección para conducción segura y cómoda.',
            'Herramientas' => 'Herramienta útil para el mantenimiento de tu moto.',
            default => $generic,
        };
    }

    private function maintenanceRules(): void
    {
        $list = [
            ['Cambio de aceite y filtro', 3000, 3, 'Mantenimiento periódico'],
            ['Revisión y tensado de cadena', 2000, 1, 'Transmisión'],
            ['Cambio de kit de arrastre', 20000, 24, 'Transmisión'],
            ['Cambio de balatas de freno', 15000, 12, 'Frenos'],
            ['Cambio de líquido de frenos', 24000, 24, 'Frenos'],
            ['Cambio de bujía', 10000, 12, 'Encendido'],
            ['Cambio de filtro de aire', 12000, 12, 'Mantenimiento periódico'],
            ['Revisión de batería y sistema eléctrico', 12000, 6, 'Eléctrico'],
        ];
        foreach ($list as $r) {
            MaintenanceRule::firstOrCreate(
                ['service_name' => $r[0]],
                ['interval_km' => $r[1], 'interval_months' => $r[2], 'category' => $r[3], 'is_active' => true]
            );
        }
    }

    private function posts(): void
    {
        $admin = User::where('role', 'admin')->orderBy('id')->first();
        if (! $admin) {
            return;
        }

        $posts = [
            [
                'title' => 'Cómo cambiar el aceite de tu moto en casa',
                'excerpt' => 'Aprende a hacer el cambio de aceite de tu moto paso a paso y alargar la vida del motor.',
                'content' => "Cambiar el aceite de tu moto es el mantenimiento más importante y uno de los más fáciles de hacer en casa.\n\nNecesitas: aceite 4T adecuado a tu modelo, una llave para el tapón de drenaje, un recipiente para el aceite usado y una llave de filtro si tu moto tiene filtro externo.\n\n1. Calienta el motor durante unos minutos para que el aceite fluya mejor.\n2. Ubica el tapón de drenaje y aflójalo con cuidado.\n3. Deja drenar el aceite por completo y desecha el usado en un centro de recolección.\n4. Reemplaza el filtro de aceite si corresponde.\n5. Vuelve a colocar el tapón y llena con la cantidad recomendada por el fabricante.\n6. Enciende la moto por un minuto y revisa que no haya fugas.\n\nRecuerda revisar el nivel con la varilla en terreno plano y con el motor apagado. Si no te sientes seguro, agenda tu cambio de aceite con nosotros.",
                'is_published' => true,
            ],
            [
                'title' => '¿Cada cuánto debo cambiar la cadena de mi moto?',
                'excerpt' => 'La cadena y los piñones son clave en la transmisión; te contamos cuándo reemplazarlos.',
                'content' => "El kit de arrastre (cadena, piñón y estrella) tiene una vida útil de entre 20.000 y 30.000 kilómetros, dependiendo del uso y el mantenimiento.\n\nSeñales de desgaste:\n\n- La cadena se estira y necesita tensado cada vez más seguido.\n- Escuchas un sonido metálico al acelerar o cambiar de marcha.\n- Los piñones tienen los dientes puntiagudos o en forma de anzuelo.\n- La cadena se puede levantar fácilmente de los dientes del piñón trasero.\n\nUn kit desgastado puede partirse en plena marcha y dañar el motor o el cárter. Además de reemplazarlo a tiempo, lubrica la cadena cada 500 kilómetros y revisa el tensado mensualmente.\n\nEn nuestro taller realizamos el cambio de kit con repuestos de calidad y ajuste de alineación de rueda incluido.",
                'is_published' => true,
            ],
            [
                'title' => '5 señales de que tus balatas de freno están gastadas',
                'excerpt' => 'La seguridad depende de tus frenos. Aprende a detectar el desgaste a tiempo.',
                'content' => "Las balatas y pastillas de freno se desgastan con el uso y deben revisarse periódicamente.\n\nEstas son las 5 señales más comunes:\n\n1. Un chirrido metálico al frenar, causado por el indicador de desgaste.\n2. Menos potencia de frenado o sensación de freno 'esponjoso'.\n3. Vibración en el manubrio al frenar.\n4. Desgaste visible inferior a 2 mm en el material de fricción.\n5. Testigo de frenos encendido en motos con sistema ABS.\n\nEn promedio se recomienda cambiar las balatas cada 15.000 kilómetros, pero el desgaste depende de tu estilo de manejo y del terreno.\n\nNo dejes pasar estas señales: los frenos son el sistema de seguridad más importante de tu moto. Agenda una revisión con nosotros si notas alguno de estos síntomas.",
                'is_published' => true,
            ],
            [
                'title' => 'Guía básica de mantenimiento preventivo para tu moto',
                'excerpt' => 'Los chequeos periódicos evitan reparaciones costosas. Aquí tienes tu checklist.',
                'content' => "El mantenimiento preventivo es la mejor inversión para tu moto. Unos minutos cada semana pueden ahorrarte reparaciones costosas.\n\nChecklist semanal:\n\n- Revisa la presión y el estado de las llantas.\n- Verifica el nivel de aceite.\n- Revisa el tensado y la lubricación de la cadena.\n- Prueba luces, direccionales, claxon y stop.\n- Revisa que no haya fugas de líquidos bajo la moto.\n\nChecklist mensual:\n\n- Limpia y lubrica cables de acelerador y clutch.\n- Revisa el estado de las balatas y pastillas.\n- Verifica los niveles de líquido de frenos y refrigerante si aplica.\n\nChequeos por kilometraje:\n\n- Cada 3.000 km: cambio de aceite y filtro.\n- Cada 10.000 km: cambio de bujía.\n- Cada 20.000 km: kit de arrastre, balatas y líquido de frenos.\n\nMantén el registro de tus servicios. Si necesitas una revisión completa, agenda nuestro diagnóstico general de 20 puntos.",
                'is_published' => true,
            ],
        ];

        foreach ($posts as $p) {
            Post::firstOrCreate(
                ['title' => $p['title']],
                [
                    'slug' => Str::slug($p['title']),
                    'excerpt' => $p['excerpt'],
                    'content' => $p['content'],
                    'is_published' => true,
                    'published_at' => now(),
                    'user_id' => $admin->id,
                ]
            );
        }
    }
}