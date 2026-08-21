<?php

namespace App\Support;

/**
 * Sanitización simple de entradas del usuario antes de guardarlas:
 * recorta espacios y elimina etiquetas HTML/scripts de campos de texto.
 * Los campos rich-text (p. ej. contenido del blog) se validan por separado.
 */
class Input
{
    public static function clean($value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : strip_tags($value);
    }

    public static function cleanNullable($value): ?string
    {
        return self::clean($value);
    }

    public static function cleanInt($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) filter_var($value, FILTER_SANITIZE_NUMBER_INT);
    }

    /**
     * Sanitiza todos los valores de texto de un array (deja intactos los anidados).
     */
    public static function cleanArray(array $data, array $skipKeys = []): array
    {
        foreach ($data as $key => $value) {
            if (in_array($key, $skipKeys, true) || is_array($value)) {
                continue;
            }
            $data[$key] = is_string($value) ? self::clean($value) : $value;
        }

        return $data;
    }
}
