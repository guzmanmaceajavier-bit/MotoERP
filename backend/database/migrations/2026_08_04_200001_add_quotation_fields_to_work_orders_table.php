<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->string('quotation_status')
                ->default('pending')
                ->after('status')
                ->comment('pending, awaiting_approval, approved, rejected, modification_requested');
            $table->dateTime('quotation_sent_at')->nullable()->after('quotation_total');
            $table->dateTime('quotation_resolved_at')->nullable()->after('quotation_sent_at');
            $table->text('customer_response_notes')->nullable()->after('quotation_resolved_at');
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn(['quotation_status', 'quotation_sent_at', 'quotation_resolved_at', 'customer_response_notes']);
        });
    }
};