<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_movements', 'order_id')) {
                $table->foreignId('order_id')->nullable()->after('user_id')->constrained('work_orders')->nullOnDelete();
            }
            if (! Schema::hasColumn('stock_movements', 'invoice_id')) {
                $table->foreignId('invoice_id')->nullable()->after('order_id')->constrained('invoices')->nullOnDelete();
            }
            if (! Schema::hasColumn('stock_movements', 'purchase_id')) {
                $table->foreignId('purchase_id')->nullable()->after('invoice_id')->constrained('purchases')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('order_id');
            $table->dropConstrainedForeignId('invoice_id');
            $table->dropConstrainedForeignId('purchase_id');
        });
    }
};