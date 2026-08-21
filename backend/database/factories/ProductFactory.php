<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $name = $this->faker->unique()->words(2, true);

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'description' => $this->faker->sentence,
            'price' => $this->faker->numberBetween(1000, 50000),
            'cost' => $this->faker->numberBetween(500, 30000),
            'sku' => $this->faker->unique()->bothify('SKU-####'),
            'unit' => 'unidad',
            'is_active' => true,
        ];
    }
}