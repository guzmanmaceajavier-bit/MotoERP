<?php

namespace App\Console\Commands;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Supplier;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class CheckInventoryLowStock extends Command
{
    protected $signature = 'inventory:low-check {--draft-po}';

    protected $description = 'Detecta productos bajo el stock mínimo, notifica a administradores y opcionalmente crea un borrador de orden de compra';

    public function handle(NotificationService $notifier): int
    {
        $low = Inventory::with('product')
            ->where('quantity', '<=', 0)
            ->get()
            ->merge(
                Inventory::with('product')
                    ->where('quantity', '>', 0)
                    ->whereNotNull('min_stock')
                    ->whereColumn('quantity', '<=', 'min_stock')
                    ->get()
            );

        if ($low->isEmpty()) {
            $this->info('No hay productos bajo stock mínimo.');

            return 0;
        }

        $admins = User::where('role', 'admin')->get();
        foreach ($low as $inv) {
            $product = $inv->product;
            if (! $product) {
                continue;
            }
            foreach ($admins as $admin) {
                $notifier->notify(
                    $admin,
                    'Stock bajo',
                    "El producto \"{$product->name}\" está en {$inv->quantity} (mínimo: {$inv->min_stock}). Revisa el inventario.",
                    'warning',
                    ['channel' => 'inventory']
                );
            }
        }

        if ($this->option('draft-po') && $low->isNotEmpty()) {
            $total = $low->sum(function ($inv) {
                return (float) $inv->product?->cost * max(1, ($inv->min_stock ?? 0) * 2 - $inv->quantity);
            });

            $supplier = Supplier::first();
            $purchase = Purchase::create([
                'purchase_number' => 'PO-' . strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ'), 0, 4)) . '-' . random_int(1000, 9999),
                'supplier_id' => $supplier?->id,
                'supplier_name' => $supplier?->name ?? 'Proveedor pendiente',
                'total' => round($total, 2),
                'purchase_date' => now()->toDateString(),
                'created_by' => null,
            ]);

            foreach ($low as $inv) {
                $product = $inv->product;
                if (! $product) {
                    continue;
                }
                $qty = max(1, ($inv->min_stock ?? 0) * 2 - $inv->quantity);
                $purchase->items()->create([
                    'product_id' => $product->id,
                    'description' => $product->name,
                    'quantity' => $qty,
                    'unit_cost' => (float) $product->cost,
                    'total' => round($qty * (float) $product->cost, 2),
                ]);
            }

            $this->info('Orden de compra generada (reposición por stock bajo): ' . $purchase->purchase_number);
        }

        $this->info("Productos bajo stock notificados: {$low->count()}");

        return 0;
    }
}