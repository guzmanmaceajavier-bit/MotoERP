<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $columns = DB::select("SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices' AND table_schema = 'public'");
        $existing = array_column($columns, 'column_name');

        Schema::table('invoices', function (Blueprint $table) use ($existing) {
            if (!in_array('checkout_token', $existing)) {
                $table->string('checkout_token', 100)->nullable()->index();
            }
            if (!in_array('due_date', $existing)) {
                $table->date('due_date')->nullable();
            }
            if (!in_array('coupon_code', $existing)) {
                $table->string('coupon_code', 50)->nullable();
            }
            if (!in_array('points_used', $existing)) {
                $table->integer('points_used')->default(0);
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['checkout_token', 'due_date', 'coupon_code', 'points_used']);
        });
    }
};
