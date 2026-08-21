<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('tax_rate', 5, 2)->nullable()->after('tax');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->string('receipt_number')->nullable()->after('reference');
        });

        Schema::table('appointments', function (Blueprint $table) {
            $table->foreignId('mechanic_id')->nullable()->after('service_id')->constrained('users')->nullOnDelete();
            $table->timestamp('reminder_sent_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('tax_rate');
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('receipt_number');
        });
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('mechanic_id');
            $table->dropColumn('reminder_sent_at');
        });
    }
};