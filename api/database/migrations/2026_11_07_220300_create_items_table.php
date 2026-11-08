<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An "item" is one object shown to the child (une pomme, un chien…).
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->string('emoji', 16)->nullable();        // fallback picture until a photo is uploaded
            $table->string('image_path')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->index(['category_id', 'is_published']);
        });

        Schema::create('item_translations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->string('locale', 10);
            $table->string('name');                         // with its article: "une pomme", "an apple"
            $table->string('sentence')->nullable();         // overrides the language template, e.g. "Ce sont des ciseaux"
            $table->string('audio_path')->nullable();       // recorded pronunciation; the app falls back to speech synthesis
            $table->timestamps();
            $table->unique(['item_id', 'locale']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('item_translations');
        Schema::dropIfExists('items');
    }
};
