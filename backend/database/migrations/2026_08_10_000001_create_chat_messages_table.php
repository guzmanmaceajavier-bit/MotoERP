<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            // Cliente dueño de la conversación (el taller es el otro lado).
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // 'client' = lo escribió el cliente · 'staff' = lo escribió el taller.
            $table->string('sender')->default('client');
            $table->foreignId('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['staff_id', 'is_read']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
    }
};