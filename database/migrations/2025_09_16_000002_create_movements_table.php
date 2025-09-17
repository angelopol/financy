<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user')->constrained()->cascadeOnDelete()->cascadeOnUpdate();
            $table->enum('type', ['earning', 'expense']);
            $table->unsignedBigInteger('reference_id'); // earning.id or expense.id
            $table->string('description', 500);
            $table->decimal('amount');
            $table->enum('provider', ['box', 'savings']);
            $table->timestamps();

            $table->index(['type', 'reference_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('movements');
    }
};
