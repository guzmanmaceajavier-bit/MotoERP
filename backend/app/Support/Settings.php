<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * Acceso a ajustes almacenados en BD (sobreexcribe a config() para
 * WhatsApp / Cloudinary / teléfono del taller sin depender del .env).
 *
 * Usa un único query + cache para evitar el problema N+1 con PgBouncer.
 */
class Settings
{
    private static ?array $cache = null;

    /**
     * Carga todos los settings en un solo query. Llamado automáticamente
     * en el primer get(), pero puede invocarse explícitamente.
     */
    public static function loadAll(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        self::$cache = Cache::remember('settings:all', 300, function () {
            $rows = Setting::pluck('value', 'key')->toArray();
            return is_array($rows) ? $rows : [];
        });

        return self::$cache;
    }

    public static function get(string $key, $default = null)
    {
        $all = self::loadAll();

        return array_key_exists($key, $all) ? $all[$key] : $default;
    }

    public static function set(string $key, $value): void
    {
        Setting::updateOrCreate(['key' => $key], ['value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value]);

        self::$cache = null;
        Cache::forget('settings:all');
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::get($key);

        return $value === null ? $default : filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    public static function flush(): void
    {
        self::$cache = null;
        Cache::forget('settings:all');
    }
}