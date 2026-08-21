<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Acceso a ajustes almacenados en BD (sobreexcribe a config() para
 * WhatsApp / Cloudinary / teléfono del taller sin depender del .env).
 */
class Settings
{
    public static function get(string $key, $default = null)
    {
        $row = Setting::where('key', $key)->first();

        return $row ? $row->value : $default;
    }

    public static function set(string $key, $value): void
    {
        Setting::updateOrCreate(['key' => $key], ['value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value]);
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::get($key);

        return $value === null ? $default : filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}