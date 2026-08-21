<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\Request;

trait Paginates
{
    protected function perPage(Request $request): int
    {
        $perPage = (int) $request->get('per_page', 10);
        return min(max($perPage, 1), 50);
    }

    protected function page(Request $request): int
    {
        return max((int) $request->get('page', 1), 1);
    }

    protected function paginateCollection(\Illuminate\Support\Collection $items, int $perPage, int $page): array
    {
        $total = $items->count();
        $slice = $items->forPage($page, $perPage)->values();

        return $this->paginatePayload($slice, $page, $perPage, $total);
    }

    protected function paginateBuilder(\Illuminate\Database\Eloquent\Builder $query, int $perPage, int $page): array
    {
        $total = $query->toBase()->getCountForPagination();
        $items = $query->forPage($page, $perPage)->get();

        return $this->paginatePayload($items, $page, $perPage, $total);
    }

    protected function paginatePayload(\Illuminate\Support\Collection $items, int $page, int $perPage, int $total): array
    {
        $lastPage = $perPage > 0 ? (int) ceil($total / $perPage) : 0;

        return [
            'data' => $items->values(),
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'last_page' => $lastPage,
                'total' => $total,
                'has_more' => $page < $lastPage,
            ],
        ];
    }
}
