<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('monthly_expense_limit', 14, 2)->nullable();
        });

        Schema::table('earnings', function (Blueprint $table) {
            $table->text('slug')->nullable();
            $table->string('recurrence_type', 20)->default('days');
            $table->unsignedTinyInteger('claim_day')->nullable();
            $table->boolean('auto_claim')->default(true);
            $table->timestamp('last_notified_claim_at')->nullable();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->text('slug')->nullable();
            $table->string('recurrence_type', 20)->default('days');
            $table->unsignedTinyInteger('claim_day')->nullable();
            $table->boolean('auto_claim')->default(true);
        });

        Schema::table('shop_list_items', function (Blueprint $table) {
            $table->boolean('not_discount')->default(false);
        });

        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_currency_check');
            DB::statement("ALTER TABLE earnings ADD CONSTRAINT earnings_currency_check CHECK (currency IN ('$', 'bs', '\$bcv', '\$parallel', '€'))");
        } elseif ($driver === 'mysql') {
            DB::statement("ALTER TABLE earnings MODIFY currency ENUM('$', 'bs', '\$bcv', '\$parallel', '€') NOT NULL");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_currency_check');
            DB::statement("ALTER TABLE earnings ADD CONSTRAINT earnings_currency_check CHECK (currency IN ('$', 'bs', '\$bcv', '\$parallel'))");
        } elseif ($driver === 'mysql') {
            DB::statement("ALTER TABLE earnings MODIFY currency ENUM('$', 'bs', '\$bcv', '\$parallel') NOT NULL");
        }

        Schema::table('shop_list_items', fn (Blueprint $table) => $table->dropColumn('not_discount'));
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn(['slug', 'recurrence_type', 'claim_day', 'auto_claim']);
        });
        Schema::table('earnings', function (Blueprint $table) {
            $table->dropColumn(['slug', 'recurrence_type', 'claim_day', 'auto_claim', 'last_notified_claim_at']);
        });
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('monthly_expense_limit'));
    }
};
