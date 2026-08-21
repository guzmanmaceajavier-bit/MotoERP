<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Idempotencia a nivel BD: una orden solo puede tener UNA factura.
        Schema::table('invoices', function (Blueprint $table) {
            $table->unique('work_order_id', 'invoices_work_order_unique');
        });
        $db = Schema::getConnection();
        if ($db->getDriverName() === 'pgsql') {
            $db->statement("ALTER TABLE invoices DROP CONSTRAINT invoices_work_order_unique");
            $db->statement("CREATE UNIQUE INDEX invoices_work_order_unique ON invoices (work_order_id) WHERE work_order_id IS NOT NULL");
        }
        // La constraint simple no admite múltiples NULL en MySQL es lo deseado; en
        // PostgreSQL se convierte a único parcial para permitir facturas sueltas.
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique('invoices_work_order_unique');
        });
    }
};