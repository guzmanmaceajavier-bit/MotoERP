<?php

namespace Tests\Feature;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class OrderFlowTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'email' => 'admin@test.test']);
    }

    private function client(): User
    {
        return User::factory()->create(['role' => 'client', 'email' => 'client@test.test']);
    }

    private function productWithStock(int $qty = 10): Product
    {
        $product = Product::factory()->create();
        Inventory::create(['product_id' => $product->id, 'quantity' => $qty, 'reserved' => 0, 'min_stock' => 0]);

        return $product;
    }

    private function orderWithItem(User $client, Product $product, int $qty = 2): WorkOrder
    {
        $order = WorkOrder::factory()->create([
            'user_id' => $client->id,
            'status' => 'pending',
            'quotation_status' => 'pending',
        ]);
        $order->items()->create([
            'product_id' => $product->id,
            'description' => $product->name,
            'quantity' => $qty,
            'unit_price' => (float) $product->price,
        ]);

        return $order;
    }

    public function test_submit_quotation_only_checks_availability_no_reserve_yet(): void
    {
        $admin = $this->admin();
        $client = $this->client();
        $product = $this->productWithStock(5);
        $order = $this->orderWithItem($client, $product, 2);

        $this->actingAs($admin)->postJson("/api/v1/staff/orders/{$order->id}/quotation", [
            'diagnosis' => 'Cambio de frenos',
            'items' => [['product_id' => $product->id, 'description' => 'Pastillas', 'quantity' => 2, 'unit_price' => 100]],
            'labors' => [['description' => 'Mano de obra', 'hours' => 1, 'hourly_rate' => 50]],
        ])->assertOk();

        $this->assertEquals('awaiting_approval', $order->fresh()->quotation_status);
        $this->assertEquals('awaiting_approval', $order->fresh()->status);
        // Al cotizar NO se reserva.
        $this->assertSame(0, (int) $product->fresh()->inventory->reserved);
        // Se crea una versión de cotización.
        $this->assertSame(1, \App\Models\QuotationVersion::where('work_order_id', $order->id)->count());
    }

    public function test_approving_quotation_reserves_stock(): void
    {
        $admin = $this->admin();
        $client = $this->client();
        $product = $this->productWithStock(5);
        $order = $this->orderWithItem($client, $product, 2);

        $this->actingAs($admin)->postJson("/api/v1/staff/orders/{$order->id}/quotation", [
            'diagnosis' => 'x',
            'items' => [['product_id' => $product->id, 'description' => 'Pastillas', 'quantity' => 2, 'unit_price' => 50]],
        ])->assertStatus(200);

        $this->actingAs($client)->postJson("/api/v1/orders/{$order->id}/respond", [
            'decision' => 'approved',
        ])->assertStatus(200);

        $order->fresh();
        $this->assertEquals('approved', $order->fresh()->quotation_status);
        $this->assertSame(2, (int) $product->fresh()->inventory->reserved);
    }

    public function test_rejecting_quotation_does_not_reserve(): void
    {
        $admin = $this->admin();
        $client = $this->client();
        $product = $this->productWithStock(5);
        $order = $this->orderWithItem($client, $product, 2);

        $this->actingAs($admin)->postJson("/api/v1/staff/orders/{$order->id}/quotation", [
            'diagnosis' => 'x',
            'items' => [['product_id' => $product->id, 'description' => 'x', 'quantity' => 2, 'unit_price' => 100]],
        ])->assertStatus(200);

        $this->actingAs($client)->postJson("/api/v1/orders/{$order->id}/respond", [
            'decision' => 'rejected',
        ])->assertStatus(200);

        $this->assertSame(0, (int) $product->fresh()->inventory->reserved);
    }

    public function test_generates_single_invoice_per_order(): void
    {
        $admin = $this->admin();
        $client = $this->client();
        $product = $this->productWithStock(10);
        $order = $this->orderWithItem($client, $product, 2);

        $this->actingAs($admin)->postJson("/api/v1/staff/orders/{$order->id}/quotation", [
            'diagnosis' => 'x',
            'items' => [['product_id' => $product->id, 'description' => 'x', 'quantity' => 2, 'unit_price' => 100]],
        ])->assertStatus(200);

        $this->actingAs($client)->postJson("/api/v1/orders/{$order->id}/respond", ['decision' => 'approved'])->assertStatus(200);

        $this->actingAs($admin)->postJson("/api/v1/staff/orders/{$order->id}/invoice", ['payment_method' => 'efectivo'])
            ->assertStatus(201);

        $this->actingAs($admin)->postJson("/api/v1/staff/orders/{$order->id}/invoice", ['payment_method' => 'efectivo'])
            ->assertStatus(200);

        $this->assertSame(1, \App\Models\Invoice::where('work_order_id', $order->id)->count(), 'Una orden solo debe generar una factura');
        $this->assertSame(0, (int) $product->fresh()->inventory->reserved, 'La reserva se consume al facturar');
        $this->assertSame(8, (int) $product->fresh()->inventory->quantity, 'El físico baja al consumir la reserva');
    }

    public function test_staff_routes_reject_regular_client(): void
    {
        $client = $this->client();

        $this->actingAs($client)->getJson('/api/v1/staff/orders')->assertStatus(403);
        $this->actingAs($client)->getJson('/api/v1/staff/inventory')->assertStatus(403);
    }

    public function test_mechanic_cannot_access_admin_only_inventory(): void
    {
        $mechanic = User::factory()->create(['role' => 'mechanic', 'email' => 'mechanic@test.test']);

        $this->actingAs($mechanic)->getJson('/api/v1/staff/inventory')->assertStatus(403);
    }
}