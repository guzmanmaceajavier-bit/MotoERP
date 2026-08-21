<?php

namespace Tests\Unit;

use App\Models\Inventory;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use RuntimeException;
use Tests\TestCase;

class InventoryServiceTest extends TestCase
{
    use DatabaseTransactions;

    private function product(int $qty = 10, int $reserved = 0): Product
    {
        $product = Product::factory()->create();
        Inventory::create(['product_id' => $product->id, 'quantity' => $qty, 'reserved' => $reserved, 'min_stock' => 0]);

        return $product;
    }

    public function test_reserve_increments_reserved_without_touching_physical(): void
    {
        $product = $this->product(10);
        $service = app(InventoryService::class);

        $service->reserve($product->id, 3);

        $inv = $product->inventory->fresh();
        $this->assertSame(10, (int) $inv->quantity);
        $this->assertSame(3, (int) $inv->reserved);
    }

    public function test_over_reserve_throws(): void
    {
        $product = $this->product(5);
        $service = app(InventoryService::class);

        $this->expectException(RuntimeException::class);
        $service->reserve($product->id, 6);
    }

    public function test_reserve_never_exceeds_quantity_invariant(): void
    {
        $product = $this->product(4, 3);
        $service = app(InventoryService::class);

        $this->expectException(RuntimeException::class);
        $service->reserve($product->id, 2); // 3 + 2 > 4
    }

    public function test_release_reduces_reserved(): void
    {
        $product = $this->product(10, 5);
        $service = app(InventoryService::class);

        $service->release($product->id, 4);

        $this->assertSame(1, (int) $product->fresh()->inventory->reserved);
    }

    public function test_release_clamps_to_reserved(): void
    {
        $product = $this->product(10, 2);
        $service = app(InventoryService::class);

        $service->release($product->id, 5); // solo libera los 2 reservados

        $this->assertSame(0, (int) $product->fresh()->inventory->reserved);
        $this->assertSame(10, (int) $product->fresh()->inventory->quantity);
    }

    public function test_consume_reserved_moves_reserved_to_physical(): void
    {
        $product = $this->product(10, 5);
        $service = app(InventoryService::class);

        $service->consumeReserved($product->id, 4);

        $inv = $product->fresh()->inventory;
        $this->assertSame(6, (int) $inv->quantity);
        $this->assertSame(1, (int) $inv->reserved);
    }

    public function test_sell_reduces_physical_and_fails_when_unavailable(): void
    {
        $product = $this->product(3);
        $service = app(InventoryService::class);

        $service->sell($product->id, 1);
        $this->assertSame(2, (int) $product->fresh()->inventory->quantity);

        $this->expectException(RuntimeException::class);
        $service->sell($product->id, 99);
    }

    public function test_adjust_does_not_go_below_reserved(): void
    {
        $product = $this->product(10, 7);
        $service = app(InventoryService::class);

        // físico 10 -> no puede bajar por debajo de reserved (7)
        $this->expectException(RuntimeException::class);
        $service->adjust($product->id, -8);
    }
}