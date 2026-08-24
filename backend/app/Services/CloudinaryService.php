<?php

namespace App\Services;

use App\Support\Settings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CloudinaryService
{
    /**
     * Credenciales: el .env (config) tiene prioridad; la tabla de ajustes es el fallback.
     * Nunca se escribe la clave secreta en código.
     */
    public static function cloudName(): ?string
    {
        return config('services.cloudinary.cloud_name') ?: env('CLOUDINARY_CLOUD_NAME') ?: null;
    }

    public static function apiKey(): ?string
    {
        return config('services.cloudinary.api_key') ?: env('CLOUDINARY_API_KEY') ?: null;
    }

    public static function apiSecret(): ?string
    {
        return config('services.cloudinary.api_secret') ?: env('CLOUDINARY_API_SECRET') ?: null;
    }

    public static function configured(): bool
    {
        return self::cloudName() && self::apiKey() && self::apiSecret();
    }

    /**
     * Sube una imagen desde el navegador a Cloudinary y devuelve la URL segura.
     */
    public static function upload(UploadedFile $file, string $folder = 'motoerp'): ?string
    {
        if (! self::configured()) {
            return null;
        }

        try {
            $response = Http::withBasicAuth(self::apiKey(), self::apiSecret())
                ->withoutVerifying()
                ->timeout(15)
                ->connectTimeout(8)
                ->attach('file', fopen($file->getRealPath(), 'r'), $file->getClientOriginalName())
                ->post('https://api.cloudinary.com/v1_1/' . self::cloudName() . '/image/upload', [
                    'folder' => $folder,
                ]);

            if (! $response->successful()) {
                Log::error('Cloudinary: subida fallida. ' . $response->body());

                return null;
            }

            return $response->json('secure_url');
        } catch (\Throwable $e) {
            Log::error('Cloudinary: error al subir. ' . $e->getMessage());

            return null;
        }
    }

    /**
     * Sube a Cloudinary una imagen ya publicada en Internet (se trae y se guarda
     * en tu nube). Útil para sembrar el catálogo o importar URLs.
     */
    public static function uploadFromUrl(string $url, string $folder = 'motoerp'): ?string
    {
        if (! self::configured() || ! filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }

        try {
            $response = Http::withBasicAuth(self::apiKey(), self::apiSecret())
                ->withoutVerifying()
                ->timeout(25)
                ->connectTimeout(10)
                ->asForm()
                ->post('https://api.cloudinary.com/v1_1/' . self::cloudName() . '/image/upload', [
                    'file' => $url,
                    'folder' => $folder,
                ]);

            if (! $response->successful()) {
                Log::error('Cloudinary: fetch fallido. ' . $response->body());

                return null;
            }

            return $response->json('secure_url');
        } catch (\Throwable $e) {
            Log::error('Cloudinary: error al traer URL. ' . $e->getMessage());

            return null;
        }
    }
}
