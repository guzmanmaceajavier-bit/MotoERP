<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Support\Settings;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
        });

        Settings::set('workshop_phone', '');
        Settings::set('whatsapp_enabled', false);
        Settings::set('whatsapp_token', '');
        Settings::set('whatsapp_phone_id', '');
        Settings::set('cloudinary_cloud_name', '');
        Settings::set('cloudinary_api_key', '');
        Settings::set('cloudinary_api_secret', '');
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};