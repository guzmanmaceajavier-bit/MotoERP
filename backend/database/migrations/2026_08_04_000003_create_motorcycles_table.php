<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('motorcycles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('motorcycle_model_id')->nullable()->constrained()->nullOnDelete();
            $table->string('nickname')->nullable();
            $table->string('plate')->nullable();
            $table->integer('year')->nullable();
            $table->string('color')->nullable();
            $table->string('vin', 30)->nullable();
            $table->unsignedBigInteger('current_odometer')->default(0);
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('motorcycles');
    }
};