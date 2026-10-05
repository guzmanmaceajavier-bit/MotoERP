<?php

namespace App\Services;

use App\Models\MaintenanceRule;
use App\Support\Settings;
use Illuminate\Http\UploadedFile;

// configuracion del taller (lo que se edita desde el panel)
class SettingsService
{
    public function all(): array
    {
        return [
            'workshop_name' => Settings::get('workshop_name', config('app.name')),
            'workshop_phone' => Settings::get('workshop_phone', ''),
            'workshop_address' => Settings::get('workshop_address', ''),
            'workshop_logo' => Settings::get('workshop_logo', ''),
            'workshop_email' => Settings::get('workshop_email', ''),
            'social_facebook' => Settings::get('social_facebook', ''),
            'social_instagram' => Settings::get('social_instagram', ''),
            'social_tiktok' => Settings::get('social_tiktok', ''),
            'tax_rate' => (float) (Settings::get('tax_rate') ?? 18),
            'schedule_open' => Settings::get('schedule_open', '09:00'),
            'schedule_close' => Settings::get('schedule_close', '18:00'),
            'closed_days' => json_decode((string) Settings::get('closed_days', '[]'), true) ?: [],
            'day_hours' => json_decode((string) Settings::get('day_hours', '[]'), true) ?: [],
            'holidays' => json_decode((string) Settings::get('holidays', '[]'), true) ?: [],
            'banners' => json_decode((string) Settings::get('banners', '[]'), true) ?: [],
            'hero_images' => json_decode((string) Settings::get('hero_images', '{}'), true) ?: [],
            'hero_texts' => json_decode((string) Settings::get('hero_texts', '{}'), true) ?: [],
            'trabajos_gallery' => json_decode((string) Settings::get('trabajos_gallery', '[]'), true) ?: [],
            'workshop_country' => Settings::get('workshop_country', 'CO'),
            'points_value' => (float) (Settings::get('points_value') ?? config('points.value', 100)),
            'points_earning_threshold' => (float) (Settings::get('points_earning_threshold', 50000)),
            'payment_options' => json_decode((string) Settings::get('payment_options', '[]'), true) ?: [],
            'payment_instructions' => (string) Settings::get('payment_instructions', ''),
            'whatsapp_enabled' => app(NotificationService::class)->whatsappEnabled(),
            'whatsapp_configured' => app(NotificationService::class)->whatsappEnabled(),
            'whatsapp_phone_id' => Settings::get('whatsapp_phone_id', ''),
            'whatsapp_template' => Settings::get('whatsapp_template', config('services.whatsapp.template')),
            'whatsapp_template_lang' => Settings::get('whatsapp_template_lang', 'es'),
            'cloudinary_configured' => CloudinaryService::configured(),
            'cloudinary_cloud_name' => Settings::get('cloudinary_cloud_name', env('CLOUDINARY_CLOUD_NAME', '')),
            'maintenance_rules' => MaintenanceRule::orderBy('service_name')->get(),
            'terms_content' => (string) Settings::get('terms_content', ''),
            'privacy_content' => (string) Settings::get('privacy_content', ''),
            'store_shipping_fee' => (float) (Settings::get('store_shipping_fee') ?? config('store.shipping_fee', 12000)),
            'store_free_shipping_threshold' => (float) (Settings::get('store_free_shipping_threshold') ?? config('store.free_shipping_threshold', 150000)),
        ];
    }

    // guarda lo que llegue (solo las claves que vengan)
    public function update(array $validated): void
    {
        $map = [
            'workshop_name' => 'workshop_name',
            'workshop_phone' => 'workshop_phone',
            'workshop_address' => 'workshop_address',
            'workshop_map_lat' => 'workshop_map_lat',
            'workshop_map_lng' => 'workshop_map_lng',
            'workshop_logo' => 'workshop_logo',
            'workshop_email' => 'workshop_email',
            'social_facebook' => 'social_facebook',
            'social_instagram' => 'social_instagram',
            'social_tiktok' => 'social_tiktok',
            'tax_rate' => 'tax_rate',
            'schedule_open' => 'schedule_open',
            'schedule_close' => 'schedule_close',
        ];
        foreach ($map as $key => $setting) {
            if (array_key_exists($key, $validated)) {
                Settings::set($setting, (string) $validated[$key]);
            }
        }
        if (array_key_exists('closed_days', $validated)) {
            Settings::set('closed_days', json_encode($validated['closed_days']));
        }
        if (array_key_exists('day_hours', $validated)) {
            Settings::set('day_hours', json_encode($validated['day_hours']));
        }
        if (array_key_exists('holidays', $validated)) {
            Settings::set('holidays', json_encode($validated['holidays']));
        }
        if (array_key_exists('banners', $validated)) {
            Settings::set('banners', json_encode($validated['banners']));
        }
        if (array_key_exists('hero_images', $validated)) {
            Settings::set('hero_images', json_encode($validated['hero_images']));
        }
        if (array_key_exists('hero_texts', $validated)) {
            Settings::set('hero_texts', json_encode($validated['hero_texts']));
        }
        if (array_key_exists('trabajos_gallery', $validated)) {
            Settings::set('trabajos_gallery', json_encode($validated['trabajos_gallery']));
        }
        if (array_key_exists('workshop_country', $validated)) {
            Settings::set('workshop_country', (string) $validated['workshop_country']);
        }
        if (array_key_exists('payment_options', $validated)) {
            Settings::set('payment_options', json_encode(array_values($validated['payment_options'])));
        }
        if (array_key_exists('payment_instructions', $validated)) {
            Settings::set('payment_instructions', (string) $validated['payment_instructions']);
        }
        if (array_key_exists('points_value', $validated)) {
            Settings::set('points_value', (string) $validated['points_value']);

            $envFile = base_path('.env');
            if (is_writable($envFile)) {
                $contents = file_get_contents($envFile);
                $contents = preg_match('/POINTS_VALUE=.*/', $contents)
                    ? preg_replace('/POINTS_VALUE=.*/', 'POINTS_VALUE=' . $validated['points_value'], $contents)
                    : $contents . "\nPOINTS_VALUE=" . $validated['points_value'] . "\n";
                file_put_contents($envFile, $contents);
            }
        }
        if (array_key_exists('points_earning_threshold', $validated)) {
            Settings::set('points_earning_threshold', (string) $validated['points_earning_threshold']);
        }
        if (array_key_exists('whatsapp_enabled', $validated)) {
            Settings::set('whatsapp_enabled', (bool) $validated['whatsapp_enabled']);
        }
        if (array_key_exists('whatsapp_phone_id', $validated)) {
            Settings::set('whatsapp_phone_id', (string) $validated['whatsapp_phone_id']);
        }
        if (array_key_exists('whatsapp_template', $validated)) {
            Settings::set('whatsapp_template', (string) $validated['whatsapp_template']);
        }
        if (array_key_exists('whatsapp_template_lang', $validated)) {
            Settings::set('whatsapp_template_lang', (string) $validated['whatsapp_template_lang']);
        }
        if (array_key_exists('cloudinary_cloud_name', $validated)) {
            Settings::set('cloudinary_cloud_name', (string) $validated['cloudinary_cloud_name']);
        }
        if (array_key_exists('terms_content', $validated)) {
            Settings::set('terms_content', (string) $validated['terms_content']);
        }
        if (array_key_exists('privacy_content', $validated)) {
            Settings::set('privacy_content', (string) $validated['privacy_content']);
        }
        if (array_key_exists('store_shipping_fee', $validated)) {
            Settings::set('store_shipping_fee', (string) $validated['store_shipping_fee']);
        }
        if (array_key_exists('store_free_shipping_threshold', $validated)) {
            Settings::set('store_free_shipping_threshold', (string) $validated['store_free_shipping_threshold']);
        }
        if (array_key_exists('delivery_days', $validated)) {
            Settings::set('delivery_days', (string) ($validated['delivery_days'] ?? 3));
        }
    }

    // sube logo o imagenes, a cloudinary si hay si no a storage
    public function uploadImage(UploadedFile $file): string
    {
        return CloudinaryService::upload($file, 'site')
            ?? url('/storage/' . $file->store('site', 'public'));
    }

    public function storeRule(array $validated): MaintenanceRule
    {
        return MaintenanceRule::create([
            'service_name' => $validated['service_name'],
            'interval_km' => $validated['interval_km'] ?? null,
            'interval_months' => $validated['interval_months'] ?? null,
            'is_active' => true,
        ]);
    }

    public function updateRule(MaintenanceRule $rule, array $validated): MaintenanceRule
    {
        $rule->update([
            'service_name' => $validated['service_name'],
            'interval_km' => $validated['interval_km'] ?? null,
            'interval_months' => $validated['interval_months'] ?? null,
        ]);

        return $rule;
    }

    public function deleteRule(MaintenanceRule $rule): void
    {
        $rule->delete();
    }
}
