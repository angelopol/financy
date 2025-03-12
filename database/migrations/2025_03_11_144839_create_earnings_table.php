<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('earnings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user')->constrained()->onDelete('cascade')->onUpdate('cascade');
            $table->string('description', 500);
            $table->decimal('amount');
            $table->enum('currency', ['$', 'bs', '$bcv', '$parallel']);
            $table->enum('provider', ['box', 'savings']);
            $table->integer('term')->nullable();
            $table->integer('NextClaim')->nullable();
            $table->timestamp('UpdatedTerm')->nullable();
            $table->decimal('OneTimeTase')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('earnings');
    }
};
