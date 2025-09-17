<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('earnings', function (Blueprint $table) {
            $table->foreignId('recurring_id')->nullable()->after('user')
                ->constrained('earnings')->nullOnDelete();
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignId('recurring_id')->nullable()->after('user')
                ->constrained('expenses')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('earnings', function (Blueprint $table) {
            $table->dropForeign(['recurring_id']);
            $table->dropColumn('recurring_id');
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['recurring_id']);
            $table->dropColumn('recurring_id');
        });
    }
};
