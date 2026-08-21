<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Flujo de pedidos de la tienda sobre la tabla de facturas:
     * - order_status: pending → payment_review → confirmed → shipped/delivered | cancelled
     * - payment_proof_path: comprobante subido por el cliente
     * - invoice_pdf_path: PDF de la factura subido por el admin para descarga del cliente
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('order_status')->default('pending')->after('status');
            $table->string('payment_proof_path')->nullable()->after('order_status');
            $table->string('invoice_pdf_path')->nullable()->after('payment_proof_path');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['order_status', 'payment_proof_path', 'invoice_pdf_path']);
        });
    }
};