<?php

namespace App\Console\Commands;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\MotorcycleModel;
use App\Models\Product;
use App\Models\Service;
use App\Services\CloudinaryService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class SeedCatalog extends Command
{
    protected $signature = 'catalog:seed {--skip-images : No subir imágenes a Cloudinary}';

    protected $description = 'Siembra el catálogo: marcas, modelos, categorías, servicios y productos (con imágenes en Cloudinary)';

    private const PICSUM = 'https://picsum.photos/seed/motoerp-';

    public function handle(): int
    {
        $withImages = ! $this->option('skip-images') && CloudinaryService::configured();

        if ($this->option('skip-images')) {
            $this->warn('Imágenes omitidas (--skip-images).');
        } elseif (! CloudinaryService::configured()) {
            $this->warn('Cloudinary no está configurado; se crearán registros sin imagen. Define CLOUDINARY_* en .env.');
        }

        $this->seedBrands($withImages);
        $this->seedCategories($withImages);
        $this->seedServices();
        $this->seedProducts($withImages);

        $this->info('Catálogo sembrado.');

        return 0;
    }

    private function image(string $seed, bool $withImages): ?string
    {
        if (! $withImages) {
            return null;
        }

        return CloudinaryService::uploadFromUrl(self::PICSUM . $seed . '/640/480', 'catalog');
    }

    private function seedBrands(bool $withImages): void
    {
        $brands = [
            'Honda' => ['AX-100', 'CB', 'Wave', 'XR'],
            'Yamaha' => ['Crypton', 'FZ', 'MT', 'XTZ'],
            'Suzuki' => ['GN', 'GSX-R', 'V-Strom', 'AX4'],
            'KTM' => ['Duke 200', 'RC 390', 'Adventure 390'],
            'Bajaj' => ['Pulsar 150', 'Pulsar NS200', 'Dominar 400'],
            'TVS' => ['Apache RTR 160', 'Ntorq 125'],
        ];

        foreach ($brands as $name => $models) {
            $brand = Brand::updateOrCreate(
                ['name' => $name],
                ['image' => $this->image(Str::slug($name), $withImages)]
            );

            foreach ($models as $modelName) {
                MotorcycleModel::updateOrCreate(
                    ['brand_id' => $brand->id, 'name' => $modelName],
                    ['year' => null, 'is_active' => true]
                );
            }
        }

        $this->info('Marcas y modelos: ' . count($brands) . ' marcas listas.');
    }

    private function seedCategories(bool $withImages): void
    {
        $categories = [
            'Aceites y lubricantes',
            'Frenos',
            'Transmisión y cadena',
            'Eléctrico',
            'Neumáticos',
            'Filtros',
            'Accesorios',
            'Casco y seguridad',
        ];

        foreach ($categories as $name) {
            Category::updateOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'image' => $this->image('cat-' . Str::slug($name), $withImages)]
            );
        }

        $this->info('Categorías: ' . count($categories) . ' listas.');
    }

    private function seedServices(): void
    {
        $services = [
            ['Cambio de aceite y filtro', 'Cambio de aceite del motor y filtro de aceite, con verificación general.', 45000, 'Mantenimiento', 60],
            ['Cambio de frenos', 'Inspección y reemplazo de pastillas y/o balatas de freno.', 80000, 'Mantenimiento', 90],
            ['Ajuste y engrase de cadena', 'Limpieza, ajuste y lubricación de la cadena de transmisión.', 25000, 'Mantenimiento', 45],
            ['Diagnóstico eléctrico', 'Revisión de batería, cargador y sistema eléctrico con scanner.', 60000, 'Diagnóstico', 60],
            ['Sincronización de carburadores', 'Ajuste de carburadores para un funcionamiento suave del motor.', 95000, 'Motor', 120],
            ['Cambio de llanta', 'Desmonte y montaje de llanta trasera o delantera, con balanceo si aplica.', 50000, 'Neumáticos', 60],
            ['Revisión y mantenimiento preventivo', 'Chequeo completo de 21 puntos: frenos, luces, neumáticos, fluidos y más.', 65000, 'Mantenimiento', 90],
            ['Limpieza de inyectores', 'Limpieza ultrasónica de inyectores para motos de inyección.', 110000, 'Motor', 120],
        ];

        foreach ($services as $s) {
            Service::updateOrCreate(
                ['name' => $s[0]],
                [
                    'description' => $s[1],
                    'price' => $s[2],
                    'category' => $s[3],
                    'estimated_minutes' => $s[4],
                    'is_active' => true,
                ]
            );
        }

        $this->info('Servicios: ' . count($services) . ' listos.');
    }

    private function seedProducts(bool $withImages): void
    {
        $category = fn (string $slug) => Category::where('slug', $slug)->value('id');
        $brand = fn (string $name) => Brand::where('name', $name)->value('id');

        $products = [
            ['name' => 'Aceite de motor 10W-40 (1L)', 'category' => 'aceites-y-lubricantes', 'brand' => null, 'price' => 42000, 'cost' => 30000, 'unit' => 'litro', 'qty' => 40, 'min' => 10],
            ['name' => 'Aceite de motor 20W-50 (1L)', 'category' => 'aceites-y-lubricantes', 'brand' => null, 'price' => 38000, 'cost' => 26000, 'unit' => 'litro', 'qty' => 30, 'min' => 8],
            ['name' => 'Filtro de aceite universal', 'category' => 'filtros', 'brand' => null, 'price' => 15000, 'cost' => 9000, 'unit' => 'unidad', 'qty' => 60, 'min' => 15],
            ['name' => 'Filtro de aire', 'category' => 'filtros', 'brand' => null, 'price' => 18000, 'cost' => 11000, 'unit' => 'unidad', 'qty' => 50, 'min' => 12],
            ['name' => 'Pastillas de freno delanteras', 'category' => 'frenos', 'brand' => 'Honda', 'price' => 35000, 'cost' => 20000, 'unit' => 'juego', 'qty' => 35, 'min' => 10],
            ['name' => 'Balatas traseras', 'category' => 'frenos', 'brand' => null, 'price' => 28000, 'cost' => 16000, 'unit' => 'juego', 'qty' => 30, 'min' => 8],
            ['name' => 'Líquido de frenos DOT 4', 'category' => 'frenos', 'brand' => null, 'price' => 22000, 'cost' => 13000, 'unit' => 'botella', 'qty' => 25, 'min' => 6],
            ['name' => 'Kit de arrastre (pifión + corona + cadena)', 'category' => 'transmision-y-cadena', 'brand' => 'Yamaha', 'price' => 180000, 'cost' => 125000, 'unit' => 'kit', 'qty' => 12, 'min' => 3],
            ['name' => 'Cadena sellada 428', 'category' => 'transmision-y-cadena', 'brand' => null, 'price' => 95000, 'cost' => 65000, 'unit' => 'unidad', 'qty' => 15, 'min' => 4],
            ['name' => 'Batería 12V sellada', 'category' => 'electrico', 'brand' => null, 'price' => 130000, 'cost' => 85000, 'unit' => 'unidad', 'qty' => 10, 'min' => 3],
            ['name' => 'Bujía NGK', 'category' => 'electrico', 'brand' => null, 'price' => 12000, 'cost' => 7000, 'unit' => 'unidad', 'qty' => 80, 'min' => 20],
            ['name' => 'Llanta trasera 110/90-17', 'category' => 'neumaticos', 'brand' => null, 'price' => 220000, 'cost' => 150000, 'unit' => 'unidad', 'qty' => 8, 'min' => 2],
            ['name' => 'Llanta delantera 90/90-18', 'category' => 'neumaticos', 'brand' => null, 'price' => 190000, 'cost' => 128000, 'unit' => 'unidad', 'qty' => 8, 'min' => 2],
            ['name' => 'Guantes de conducción', 'category' => 'accesorios', 'brand' => null, 'price' => 45000, 'cost' => 25000, 'unit' => 'par', 'qty' => 20, 'min' => 5],
            ['name' => 'Casco integral', 'category' => 'casco-y-seguridad', 'brand' => null, 'price' => 160000, 'cost' => 95000, 'unit' => 'unidad', 'qty' => 14, 'min' => 4],
            ['name' => 'Chaleco reflectivo', 'category' => 'casco-y-seguridad', 'brand' => null, 'price' => 25000, 'cost' => 12000, 'unit' => 'unidad', 'qty' => 25, 'min' => 6],
        ];

        foreach ($products as $p) {
            $slug = Str::slug($p['name']);
            $product = Product::updateOrCreate(
                ['slug' => $slug],
                [
                    'category_id' => $category($p['category']),
                    'brand_id' => $p['brand'] ? $brand($p['brand']) : null,
                    'name' => $p['name'],
                    'description' => 'Producto de catálogo para motos.',
                    'price' => $p['price'],
                    'cost' => $p['cost'],
                    'sku' => 'SKU-' . strtoupper(Str::slug($p['category'], '')) . '-' . random_int(100, 999),
                    'unit' => $p['unit'],
                    'image' => $this->image('prod-' . $slug, $withImages),
                    'is_active' => true,
                ]
            );

            Inventory::firstOrCreate(
                ['product_id' => $product->id],
                ['quantity' => $p['qty'], 'reserved' => 0, 'min_stock' => $p['min']]
            );
        }

        $this->info('Productos: ' . count($products) . ' listos (con stock inicial).');
    }
}