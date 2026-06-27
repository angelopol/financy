<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['expenses', 'earnings', 'movements'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->unsignedBigInteger('project_id')->nullable()->after('user')->index();
            });
        }
    }

    public function down(): void
    {
        foreach (['expenses', 'earnings', 'movements'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropIndex([$tableName === 'movements' ? 'project_id' : 'project_id']);
                $table->dropColumn('project_id');
            });
        }
    }
};
