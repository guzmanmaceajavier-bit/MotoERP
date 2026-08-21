<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabla de pagos (efectivo/transferencia/tarjeta) y balance pagado por factura,
     * para soportar abonos parciales y deudas pendientes.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // quien paga (deudor)
            $table->decimal('amount', 12, 2);
            $table->string('method')->default('efectivo'); // efectivo | transferencia | tarjeta
            $table->timestamp('paid_at');
            $table->string('reference')->nullable(); // referencia de transferencia
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('paid_amount', 12, 2)->default(0)->after('total');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('paid_amount');
        });
        Schema::dropIfExists('payments');
    }
};