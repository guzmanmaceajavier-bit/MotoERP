<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Favorite;
use App\Models\Invoice;
use App\Models\LoyaltyPoint;
use App\Models\Motorcycle;
use App\Models\Rating;
use App\Models\User;
use Illuminate\Support\Collection;

class TimelineService
{
    public function collect(User $user, array $f): Collection
    {
        $source = $f['source'] ?? 'all';
        $status = $f['status'] ?? null;
        $from = $f['from'] ?? '';
        $to = $f['to'] ?? '';
        $term = $f['term'] ?? '';

        $events = collect();

        if (in_array($source, ['all', 'store', 'service'], true)) {
            $invQ = Invoice::with('items')->where('user_id', $user->id);
            if ($source === 'store') {
                $invQ->whereNull('work_order_id');
            } elseif ($source === 'service') {
                $invQ->whereNotNull('work_order_id');
            }

            $invoiceStatuses = ['paid', 'partial', 'unpaid', 'pending'];
            if (in_array($status, $invoiceStatuses, true)) {
                $invQ->where('status', $status);
            }
            if ($from !== '') {
                $invQ->whereDate('issue_date', '>=', $from);
            }
            if ($to !== '') {
                $invQ->whereDate('issue_date', '<=', $to);
            }
            if ($term !== '') {
                $invQ->where('invoice_number', 'ilike', '%' . $term . '%');
            }

            $invoices = $invQ->get();
            $images = app(InvoiceSerializer::class)->itemImages($invoices);
            $statusLabels = ['paid' => 'Pagado', 'partial' => 'Abonado', 'unpaid' => 'Pendiente', 'pending' => 'Pendiente'];

            foreach ($invoices as $i) {
                $items = $i->items->map(fn ($it) => [
                    'description' => $it->description,
                    'variant' => $it->variant,
                    'quantity' => $it->quantity,
                    'unit_price' => (float) $it->unit_price,
                    'total' => (float) $it->total,
                    'image' => $images[mb_strtolower(trim((string) $it->description))] ?? null,
                ])->values();

                $events->push([
                    'type' => 'invoice',
                    'source' => $i->work_order_id ? 'service' : 'store',
                    'event_id' => 'inv-' . $i->id,
                    'id' => $i->id,
                    'date' => $i->issue_date?->toDateString(),
                    'reference' => $i->invoice_number,
                    'title' => $i->work_order_id ? 'Servicio de taller' : 'Compra en tienda',
                    'subtitle' => $items->take(2)->map(fn ($it) => $it['quantity'] . 'x ' . $it['description'])->implode(' · '),
                    'status' => $i->status,
                    'status_label' => $statusLabels[$i->status] ?? $i->status,
                    'amount' => (float) $i->total,
                    'paid_amount' => (float) $i->paid_amount,
                    'outstanding' => (float) $i->outstanding,
                    'points' => null,
                    'thumbnail' => $items->first(fn ($it) => ! empty($it['image']))['image'] ?? null,
                    'items' => $items,
                    'items_count' => $items->count(),
                    'detail' => ['payment_method' => $i->payment_method],
                ]);
            }
        }

        if (in_array($source, ['all', 'service'], true)) {
            $ordQ = $user->workOrders()
                ->with(['motorcycle', 'motorcycle.brand']);

            $orderStatuses = ['pending', 'in_progress', 'awaiting_approval', 'approved', 'completed', 'delivered', 'cancelled'];
            if (in_array($status, $orderStatuses, true)) {
                $ordQ->where('status', $status);
            }
            if ($from !== '') {
                $ordQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ordQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ordQ->where('order_number', 'ilike', '%' . $term . '%');
            }

            foreach ($ordQ->get() as $o) {
                $events->push([
                    'type' => 'order',
                    'source' => 'service',
                    'event_id' => 'ord-' . $o->id,
                    'id' => $o->id,
                    'date' => $o->created_at?->toDateString(),
                    'reference' => $o->order_number,
                    'title' => $o->service_type,
                    'subtitle' => $o->motorcycle ? $o->motorcycle->nickname . ($o->motorcycle->plate ? ' · ' . $o->motorcycle->plate : '') : 'Sin moto asignada',
                    'status' => $o->status,
                    'status_label' => $o->status,
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => [
                        'quotation_status' => $o->quotation_status,
                        'estimated_delivery' => $o->estimated_delivery?->toDateString(),
                        'motorcycle' => $o->motorcycle ? [
                            'nickname' => $o->motorcycle->nickname,
                            'plate' => $o->motorcycle->plate,
                            'brand' => $o->motorcycle->brand?->name,
                        ] : null,
                    ],
                ]);
            }
        }

        if (in_array($source, ['all', 'service'], true)) {
            $apptQ = Appointment::where('user_id', $user->id);
            if ($from !== '') {
                $apptQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $apptQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $apptQ->where(function ($q) use ($term) {
                    $q->where('name', 'ilike', '%' . $term . '%')
                        ->orWhere('service_type', 'ilike', '%' . $term . '%')
                        ->orWhere('status', 'ilike', '%' . $term . '%');
                });
            }

            $apptLabels = ['pending' => 'Pendiente', 'confirmed' => 'Confirmada', 'completed' => 'Atendida', 'cancelled' => 'Cancelada', 'no_show' => 'No asistió'];
            foreach ($apptQ->get() as $a) {
                $events->push([
                    'type' => 'appointment',
                    'source' => 'service',
                    'event_id' => 'appt-' . $a->id,
                    'id' => $a->id,
                    'date' => $a->created_at?->toDateString(),
                    'reference' => null,
                    'title' => 'Cita agendada',
                    'subtitle' => $a->service_type ?: 'Servicio del taller',
                    'status' => $a->status,
                    'status_label' => $apptLabels[$a->status] ?? $a->status,
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => [
                        'scheduled_at' => $a->date?->toDateString() . ' · ' . substr((string) $a->time, 0, 5),
                        'notes' => $a->notes,
                    ],
                ]);
            }
        }

        if (in_array($source, ['all', 'store'], true)) {
            $favQ = Favorite::with('product')->where('user_id', $user->id);
            if ($from !== '') {
                $favQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $favQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $favQ->whereHas('product', fn ($q) => $q->where('name', 'ilike', '%' . $term . '%'));
            }

            foreach ($favQ->get() as $f) {
                $events->push([
                    'type' => 'favorite',
                    'source' => 'store',
                    'event_id' => 'fav-' . $f->id,
                    'id' => $f->id,
                    'date' => $f->created_at?->toDateString(),
                    'reference' => null,
                    'title' => 'Agregado a favoritos',
                    'subtitle' => $f->product?->name ?: 'Producto de la tienda',
                    'status' => 'saved',
                    'status_label' => 'Favorito',
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => $f->product?->image ?: null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => [],
                ]);
            }
        }

        if (in_array($source, ['all', 'service'], true)) {
            $ratQ = Rating::where('user_id', $user->id);
            if ($from !== '') {
                $ratQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ratQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ratQ->where('comment', 'ilike', '%' . $term . '%');
            }

            foreach ($ratQ->get() as $r) {
                $events->push([
                    'type' => 'rating',
                    'source' => 'service',
                    'event_id' => 'rat-' . $r->id,
                    'id' => $r->id,
                    'date' => $r->created_at?->toDateString(),
                    'reference' => null,
                    'title' => 'Valoraste un servicio',
                    'subtitle' => str_repeat('★', (int) $r->score) . str_repeat('☆', 5 - (int) $r->score) . ($r->comment ? ' · ' . $r->comment : ''),
                    'status' => 'rated',
                    'status_label' => $r->score . '/5',
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => ['score' => (int) $r->score, 'comment' => $r->comment],
                ]);
            }
        }

        if (in_array($source, ['all', 'service'], true)) {
            $motoQ = Motorcycle::with(['brand', 'model'])->where('user_id', $user->id);
            if ($from !== '') {
                $motoQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $motoQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $motoQ->where(function ($q) use ($term) {
                    $q->where('nickname', 'ilike', '%' . $term . '%')
                        ->orWhere('plate', 'ilike', '%' . $term . '%');
                });
            }

            foreach ($motoQ->get() as $m) {
                $events->push([
                    'type' => 'motorcycle',
                    'source' => 'service',
                    'event_id' => 'moto-' . $m->id,
                    'id' => $m->id,
                    'date' => $m->created_at?->toDateString(),
                    'reference' => null,
                    'title' => 'Moto registrada',
                    'subtitle' => collect([$m->brand?->name, $m->nickname, $m->plate])->filter()->implode(' · '),
                    'status' => 'saved',
                    'status_label' => 'Garaje',
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => null,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => ['year' => $m->year, 'color' => $m->color],
                ]);
            }
        }

        if (in_array($source, ['all', 'points'], true)) {
            $ptQ = LoyaltyPoint::where('user_id', $user->id);
            if ($from !== '') {
                $ptQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ptQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ptQ->where('concept', 'ilike', '%' . $term . '%');
            }

            foreach ($ptQ->get() as $p) {
                $events->push([
                    'type' => 'points',
                    'source' => 'points',
                    'event_id' => 'pts-' . $p->id,
                    'id' => $p->id,
                    'date' => $p->created_at?->toDateString(),
                    'reference' => null,
                    'title' => $p->points >= 0 ? 'Puntos ganados' : 'Canje de puntos',
                    'subtitle' => $p->concept,
                    'status' => $p->points >= 0 ? 'earned' : 'spent',
                    'status_label' => $p->points >= 0 ? 'Ganados' : 'Canjeados',
                    'amount' => null,
                    'paid_amount' => null,
                    'outstanding' => null,
                    'points' => (int) $p->points,
                    'thumbnail' => null,
                    'items' => [],
                    'items_count' => 0,
                    'detail' => ['balance_after' => $p->balance_after],
                ]);
            }
        }

        return $events->sortByDesc('date')->values();
    }

    public function collectExportRows(User $user, array $f): Collection
    {
        $source = $f['source'] ?? 'all';
        $status = $f['status'] ?? null;
        $from = $f['from'] ?? '';
        $to = $f['to'] ?? '';
        $term = $f['term'] ?? '';

        $events = collect();

        $invoiceStatuses = ['paid', 'partial', 'unpaid', 'pending'];
        $orderStatuses = ['pending', 'in_progress', 'awaiting_approval', 'approved', 'completed', 'delivered', 'cancelled'];

        if (in_array($source, ['all', 'store', 'service'], true)) {
            $invQ = Invoice::with('items')->where('user_id', $user->id);
            if ($source === 'store') {
                $invQ->whereNull('work_order_id');
            } elseif ($source === 'service') {
                $invQ->whereNotNull('work_order_id');
            }
            if (in_array($status, $invoiceStatuses, true)) {
                $invQ->where('status', $status);
            }
            if ($from !== '') {
                $invQ->whereDate('issue_date', '>=', $from);
            }
            if ($to !== '') {
                $invQ->whereDate('issue_date', '<=', $to);
            }
            if ($term !== '') {
                $invQ->where('invoice_number', 'ilike', '%' . $term . '%');
            }

            $statusLabels = ['paid' => 'Pagado', 'partial' => 'Abonado', 'unpaid' => 'Pendiente', 'pending' => 'Pendiente'];
            foreach ($invQ->get() as $i) {
                $events->push([
                    'date' => $i->issue_date?->toDateString() ?? '',
                    'type' => $i->work_order_id ? 'Servicio' : 'Tienda',
                    'reference' => $i->invoice_number,
                    'detail' => $i->items->map(fn ($it) => $it->quantity . 'x ' . $it->description . ($it->variant ? ' (' . $it->variant . ')' : ''))->implode(' | '),
                    'status' => $statusLabels[$i->status] ?? $i->status,
                    'amount' => (float) $i->total,
                    'paid' => (float) $i->paid_amount,
                    'outstanding' => (float) $i->outstanding,
                    'points' => '',
                ]);
            }
        }

        if (in_array($source, ['all', 'service'], true)) {
            $ordQ = $user->workOrders()->with(['motorcycle', 'motorcycle.brand']);
            if (in_array($status, $orderStatuses, true)) {
                $ordQ->where('status', $status);
            }
            if ($from !== '') {
                $ordQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ordQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ordQ->where('order_number', 'ilike', '%' . $term . '%');
            }

            $orderLabels = [
                'pending' => 'Pendiente',
                'in_progress' => 'En taller',
                'awaiting_approval' => 'Esperando aprobación',
                'approved' => 'Aprobada',
                'completed' => 'Completada',
                'delivered' => 'Entregada',
                'cancelled' => 'Cancelada',
            ];

            foreach ($ordQ->get() as $o) {
                $events->push([
                    'date' => $o->created_at?->toDateString() ?? '',
                    'type' => 'Orden de servicio',
                    'reference' => $o->order_number,
                    'detail' => $o->service_type . ($o->motorcycle ? ' · ' . $o->motorcycle->nickname : ''),
                    'status' => $orderLabels[$o->status] ?? $o->status,
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }
        }

        if (in_array($source, ['all', 'points'], true)) {
            $ptQ = LoyaltyPoint::where('user_id', $user->id);
            if ($from !== '') {
                $ptQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $ptQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $ptQ->where('concept', 'ilike', '%' . $term . '%');
            }

            foreach ($ptQ->get() as $p) {
                $events->push([
                    'date' => $p->created_at?->toDateString() ?? '',
                    'type' => $p->points >= 0 ? 'Puntos ganados' : 'Canje de puntos',
                    'reference' => '',
                    'detail' => $p->concept,
                    'status' => $p->points >= 0 ? 'Ganados' : 'Canjeados',
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => (int) $p->points,
                ]);
            }
        }

        if (in_array($source, ['all', 'service'], true)) {
            foreach (Appointment::where('user_id', $user->id)->get() as $a) {
                if ($from !== '' && $a->created_at && $a->created_at->toDateString() < $from) {
                    continue;
                }
                if ($to !== '' && $a->created_at && $a->created_at->toDateString() > $to) {
                    continue;
                }
                $events->push([
                    'date' => $a->created_at?->toDateString() ?? '',
                    'type' => 'Cita agendada',
                    'reference' => '',
                    'detail' => ($a->service_type ?: 'Servicio') . ($a->date ? ' (' . $a->date->toDateString() . ' ' . substr((string) $a->time, 0, 5) . ')' : ''),
                    'status' => $a->status,
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }

            foreach (Rating::where('user_id', $user->id)->get() as $r) {
                if ($from !== '' && $r->created_at && $r->created_at->toDateString() < $from) {
                    continue;
                }
                if ($to !== '' && $r->created_at && $r->created_at->toDateString() > $to) {
                    continue;
                }
                $events->push([
                    'date' => $r->created_at?->toDateString() ?? '',
                    'type' => 'Valoración',
                    'reference' => '',
                    'detail' => str_repeat('★', (int) $r->score) . str_repeat('☆', 5 - (int) $r->score) . ($r->comment ? ' · ' . $r->comment : ''),
                    'status' => $r->score . '/5',
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }

            foreach (Motorcycle::with('brand')->where('user_id', $user->id)->get() as $m) {
                if ($from !== '' && $m->created_at && $m->created_at->toDateString() < $from) {
                    continue;
                }
                if ($to !== '' && $m->created_at && $m->created_at->toDateString() > $to) {
                    continue;
                }
                $events->push([
                    'date' => $m->created_at?->toDateString() ?? '',
                    'type' => 'Moto registrada',
                    'reference' => '',
                    'detail' => collect([$m->brand?->name, $m->nickname, $m->plate])->filter()->implode(' · '),
                    'status' => 'Garaje',
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }
        }

        if (in_array($source, ['all', 'store'], true)) {
            $favQ = Favorite::with('product')->where('user_id', $user->id);
            if ($from !== '') {
                $favQ->whereDate('created_at', '>=', $from);
            }
            if ($to !== '') {
                $favQ->whereDate('created_at', '<=', $to);
            }
            if ($term !== '') {
                $favQ->whereHas('product', fn ($q) => $q->where('name', 'ilike', '%' . $term . '%'));
            }

            foreach ($favQ->get() as $f) {
                $events->push([
                    'date' => $f->created_at?->toDateString() ?? '',
                    'type' => 'Favorito',
                    'reference' => '',
                    'detail' => $f->product?->name ?: 'Producto de la tienda',
                    'status' => 'Favorito',
                    'amount' => '',
                    'paid' => '',
                    'outstanding' => '',
                    'points' => '',
                ]);
            }
        }

        return $events->sortBy('date')->values();
    }

    public function invoiceTotals(int $userId, ?string $source = null): array
    {
        $totQ = Invoice::where('user_id', $userId);
        if ($source === 'store') {
            $totQ->whereNull('work_order_id');
        } elseif ($source === 'service') {
            $totQ->whereNotNull('work_order_id');
        }

        return [
            'orders' => (clone $totQ)->count(),
            'total_spent' => round((float) (clone $totQ)->sum('total'), 2),
            'this_month' => (clone $totQ)
                ->whereBetween('issue_date', [now()->startOfMonth(), now()->endOfMonth()])
                ->count(),
            'outstanding' => (clone $totQ)->whereIn('status', ['unpaid', 'partial'])->count(),
        ];
    }
}
