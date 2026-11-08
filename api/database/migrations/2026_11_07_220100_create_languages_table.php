<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('languages', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();          // fr, en, wo…
            $table->string('name');                         // Français
            $table->string('tts_locale', 20);               // fr-FR, used by the app's speech engine
            $table->string('question');                     // Qu'est-ce que c'est ?
            $table->string('answer_template');              // C'est :name
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('languages');
    }
};
