<?php

namespace Tests\Feature;

use App\Models\Inventory;
use App\Models\Product;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class StoreValidationTest extends TestCase
{
    use DatabaseTransactions;

    public function test_validate_cart_returns_current_price_and_stock(): void
    {
        $product = Product::factory()->create();
        Inventory::create(['product_id' => $product->id, 'quantity' => 5, 'reserved' => 0, 'min_stock' => 0]);

        $resp = $this->postJson('/api/v1/store/validate-cart', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ])->assertOk();

        $line = $resp->json('lines.0');
        $this->assertTrue($line['ok']);
        $this->assertEqualsWithDelta((float) $product->fresh()->final_price, (float) $line['price'], 0.001);
        $this->assertSame(5, (int) $line['available']);
    }

    public function test_validate_cart_flags_inactive_product(): void
    {
        $product = Product::factory()->create(['is_active' => false]);
        Inventory::create(['product_id' => $product->id, 'quantity' => 5, 'reserved' => 0, 'min_stock' => 0]);

        $this->postJson('/api/v1/store/validate-cart', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk()->assertJsonPath('lines.0.ok', false);
    }

    public function test_validate_cart_rejects_bad_payload(): void
    {
        $this->postJson('/api/v1/store/validate-cart', ['items' => []])->assertStatus(422);
    }
}
