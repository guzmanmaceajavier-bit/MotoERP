<?php

namespace App\Services;

use App\Models\Purchase;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;

// compras a proveedores
class PurchaseService
{
    public function suppliers(string $q, int $page, int $perPage): array
    {
        $query = Supplier::withCount('purchases')
            ->withSum('purchases', 'total')
            ->when($q, function ($sub) use ($q) {
                $sub->where(function ($w) use ($q) {
                    $w->where('name', 'like', "%{$q}%")
                        ->orWhere('contact', 'like', "%{$q}%")
                        ->orWhere('phone', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%");
                });
            })
            ->orderBy('name');

        $total = (clone $query)->toBase()->getCountForPagination();
        $rows = $query->forPage($page, $perPage)->get();

        return [
            'data' => $rows->map(fn (Supplier $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'contact' => $s->contact,
                'phone' => $s->phone,
                'email' => $s->email,
                'purchase_count' => (int) $s->purchases_count,
                'purchase_total' => round((float) ($s->purchases_sum_total ?? 0), 2),
            ])->values(),
            'meta' => $this->meta($page, $perPage, $total),
        ];
    }

    public function storeSupplier(array $validated): Supplier
    {
        return Supplier::create($validated);
    }

    public function updateSupplier(Supplier $supplier, array $validated): Supplier
    {
        $supplier->update($validated);

        return $supplier->fresh();
    }

    public function deleteSupplier(Supplier $supplier): void
    {
        if ($supplier->purchases()->exists()) {
            abort(422, 'No se puede eliminar un proveedor que tiene compras registradas.');
        }

        $supplier->delete();
    }

    /**
     * @param array{q?:string,supplier_id?:int,from?:?string,to?:?string} $filters
     */
    public function list(array $filters, int $page, int $perPage): array
    {
        $q = trim((string) ($filters['q'] ?? ''));
        $supplierId = (int) ($filters['supplier_id'] ?? 0);
        $from = $filters['from'] ?? null;
        $to = $filters['to'] ?? null;

        $query = Purchase::with(['items', 'supplier'])
            ->when($q, function ($sub) use ($q) {
                $sub->where(function ($w) use ($q) {
                    $w->where('purchase_number', 'like', "%{$q}%")
                        ->orWhere('supplier_name', 'like', "%{$q}%")
                        ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$q}%"));
                });
            })
            ->when($supplierId > 0, fn ($sub) => $sub->where('supplier_id', $supplierId))
            ->when($from, fn ($sub) => $sub->where('purchase_date', '>=', $from))
            ->when($to, fn ($sub) => $sub->where('purchase_date', '<=', $to))
            ->orderByDesc('purchase_date');

        $total = (clone $query)->toBase()->getCountForPagination();
        $rows = $query->forPage($page, $perPage)->get();

        return [
            'data' => $rows->map(fn (Purchase $p) => [
                'id' => $p->id,
                'purchase_number' => $p->purchase_number,
                'supplier_id' => $p->supplier_id,
                'supplier_name' => $p->supplier?->name ?? $p->supplier_name ?? null,
                'supplier' => $p->supplier ? ['id' => $p->supplier->id, 'name' => $p->supplier->name] : null,
                'purchase_date' => $p->purchase_date?->toDateString(),
                'total' => (float) $p->total,
                'item_count' => $p->items->count(),
                'items' => $p->items->map(fn ($i) => [
                    'id' => $i->id,
                    'product_id' => $i->product_id,
                    'description' => $i->description,
                    'quantity' => (int) $i->quantity,
                    'unit_cost' => (float) $i->unit_cost,
                    'total' => (float) $i->total,
                ])->values(),
            ])->values(),
            'meta' => $this->meta($page, $perPage, $total),
        ];
    }

    // guarda la compra y suma el stock
    public function store(array $validated, int $actorId): Purchase
    {
        return DB::transaction(function () use ($validated, $actorId) {
            $purchase = Purchase::create([
                'purchase_number' => 'COM-' . strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ'), 0, 4)) . '-' . random_int(1000, 9999),
                'supplier_id' => $validated['supplier_id'] ?? null,
                'supplier_name' => $validated['supplier_name'] ?? null,
                'total' => $validated['items'] ? array_sum(array_map(fn ($i) => $i['quantity'] * $i['unit_cost'], $validated['items'])) : 0,
                'purchase_date' => $validated['purchase_date'],
                'created_by' => $actorId,
            ]);

            foreach ($validated['items'] as $item) {
                $purchase->items()->create([
                    'product_id' => $item['product_id'] ?? null,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'total' => $item['quantity'] * $item['unit_cost'],
                ]);

                // Reponer stock
                if (! empty($item['product_id'])) {
                    app(InventoryService::class)->add($item['product_id'], $item['quantity'], [
                        'purchase_id' => $purchase->id,
                        'reference' => $purchase->purchase_number,
                        'user_id' => $actorId,
                        'note' => 'Recepción de compra',
                    ]);
                }
            }

            return $purchase;
        });
    }

    // editar ajustando solo la diferencia de stock
    // si algo falla tira RuntimeException y el controlador devuelve 422
    public function update(Purchase $purchase, array $validated, int $actorId): Purchase
    {
        DB::transaction(function () use ($purchase, $validated, $actorId) {
            $existing = $purchase->items()->get()->keyBy('id');

            // Diferencial de stock por producto (nuevo - actual)
            $stockBefore = [];
            foreach ($existing as $item) {
                if ($item->product_id) {
                    $stockBefore[$item->product_id] = ($stockBefore[$item->product_id] ?? 0) + (int) $item->quantity;
                }
            }
            $stockAfter = [];
            foreach ($validated['items'] as $line) {
                if (! empty($line['product_id'])) {
                    $stockAfter[(int) $line['product_id']] = ($stockAfter[(int) $line['product_id']] ?? 0) + (int) $line['quantity'];
                }
            }

            // Reconciliar líneas: actualizar las existentes por id, crear las nuevas, borrar las que falten
            $total = 0;
            $sentIds = [];
            foreach ($validated['items'] as $line) {
                $total += (float) $line['quantity'] * (float) $line['unit_cost'];
                $lineTotal = round((float) $line['quantity'] * (float) $line['unit_cost'], 2);
                $id = $line['id'] ?? null;

                if ($id && $existing->has($id)) {
                    $existing[$id]->update([
                        'product_id' => $line['product_id'] ?? null,
                        'description' => $line['description'],
                        'quantity' => $line['quantity'],
                        'unit_cost' => $line['unit_cost'],
                        'total' => $lineTotal,
                    ]);
                    $sentIds[] = $id;
                } else {
                    $purchase->items()->create([
                        'product_id' => $line['product_id'] ?? null,
                        'description' => $line['description'],
                        'quantity' => $line['quantity'],
                        'unit_cost' => $line['unit_cost'],
                        'total' => $lineTotal,
                    ]);
                }
            }
            foreach ($existing as $id => $item) {
                if (! in_array($id, $sentIds)) {
                    $item->delete();
                }
            }

            // Ajustar inventario según la diferencia neta por producto
            $inventory = app(InventoryService::class);
            foreach (array_unique(array_merge(array_keys($stockBefore), array_keys($stockAfter))) as $productId) {
                $delta = ($stockAfter[$productId] ?? 0) - ($stockBefore[$productId] ?? 0);
                if ($delta !== 0) {
                    $inventory->adjust($productId, $delta, [
                        'purchase_id' => $purchase->id,
                        'reference' => $purchase->purchase_number,
                        'user_id' => $actorId,
                        'note' => 'Ajuste de compra',
                    ]);
                }
            }

            $purchase->update([
                'supplier_id' => $validated['supplier_id'] ?? $purchase->supplier_id,
                'supplier_name' => $validated['supplier_name'] ?? null,
                'purchase_date' => $validated['purchase_date'] ?? $purchase->purchase_date,
                'total' => round($total, 2),
            ]);
        });

        return $purchase->fresh()->load('items', 'supplier');
    }

    // borrar compra y quitar lo que habia sumado al stock
    public function destroy(Purchase $purchase, int $actorId): void
    {
        DB::transaction(function () use ($purchase, $actorId) {
            $inventory = app(InventoryService::class);
            foreach ($purchase->items as $item) {
                if ($item->product_id) {
                    $inventory->adjust($item->product_id, -(int) $item->quantity, [
                        'purchase_id' => $purchase->id,
                        'reference' => $purchase->purchase_number,
                        'user_id' => $actorId,
                        'note' => 'Eliminación de compra',
                    ]);
                }
            }
            $purchase->items()->delete();
            $purchase->delete();
        });
    }

    private function meta(int $page, int $perPage, int $total): array
    {
        $lastPage = $perPage > 0 ? (int) ceil($total / $perPage) : 0;

        return [
            'current_page' => $page,
            'per_page' => $perPage,
            'last_page' => $lastPage,
            'total' => $total,
            'has_more' => $page < $lastPage,
        ];
    }
}
