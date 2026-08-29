<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Health endpoints for Render / load balancers — must NOT hit DB cache/session so they never 500.
// Render render.yaml healthCheckPath must match one of these (recommended: /api/health or /up).
Route::get('/health', function () {
    return response()->json(['ok' => true, 'time' => now()->toIso8601String()]);
});
Route::get('/up', function () {
    return response()->json(['ok' => true, 'time' => now()->toIso8601String()]);
});
