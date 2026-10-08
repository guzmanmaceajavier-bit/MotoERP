<?php

namespace App\Support;

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
