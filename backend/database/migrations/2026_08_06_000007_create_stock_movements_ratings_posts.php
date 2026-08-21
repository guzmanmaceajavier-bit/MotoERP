<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Support\Settings;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->integer('quantity');
            $table->string('type'); // initial, purchase, sale, reserve, release, adjustment, return
            $table->string('reference')->nullable();
            $table->string('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('score'); // 1..5
            $table->text('comment')->nullable();
            $table->timestamps();
        });

        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('excerpt')->nullable();
            $table->text('content');
            $table->string('cover')->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        // Ajustes nuevos por defecto
        Settings::set('tax_rate', 18);
        Settings::set('workshop_name', config('app.name', 'MotoSystem'));
        Settings::set('workshop_address', '');
        Settings::set('workshop_logo', '');
        Settings::set('schedule_open', '09:00');
        Settings::set('schedule_close', '18:00');
        Settings::set('closed_days', json_encode([]));
        Settings::set('banners', json_encode([]));
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
        Schema::dropIfExists('ratings');
        Schema::dropIfExists('stock_movements');
    }
};