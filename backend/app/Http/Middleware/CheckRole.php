<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $allowed = array_map(fn ($r) => trim($r), $roles);

        if (! in_array($user->role, $allowed, true)) {
            return response()->json(['message' => 'No autorizado para esta acción'], 403);
        }

        return $next($request);
    }
}