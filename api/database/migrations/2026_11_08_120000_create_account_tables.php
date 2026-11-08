<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Comptes parents, profils enfant, séries jouées et progrès.
 * Aucune donnée de l'enfant au-delà d'un surnom, d'un avatar et d'une tranche d'âge
 * (voir docs/07-securite.md).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('name')->nullable()->change();
            $table->string('locale', 5)->default('fr')->after('password');
            $table->timestamp('terms_accepted_at')->nullable()->after('locale');
        });

        // Codes à 6 chiffres envoyés par e-mail (vérification, mot de passe oublié)
        Schema::create('account_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('purpose', 10);
            $table->string('code_hash');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index(['user_id', 'purpose']);
        });

        Schema::create('child_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('nickname', 20);
            $table->string('avatar', 30);
            $table->string('age_band', 5);
            $table->string('locale', 5)->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        // Série jouée. L'identifiant vient du téléphone : renvoyer la même série ne crée pas de doublon.
        Schema::create('play_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('child_profile_id')->constrained()->cascadeOnDelete();
            $table->string('locale', 5);
            $table->string('mode', 10);
            $table->json('categories')->nullable();
            $table->unsignedSmallInteger('count');
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            $table->index(['child_profile_id', 'started_at']);
        });

        // Une réponse : jamais l'audio ni le texte entendu, seulement le résultat
        Schema::create('answers', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('play_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->string('result', 10);
            $table->unsignedInteger('response_ms')->nullable();
        });

        // Répétition espacée (boîtes de Leitner 1 à 5)
        Schema::create('item_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('child_profile_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('box')->default(1);
            $table->unsignedInteger('correct_count')->default(0);
            $table->unsignedInteger('wrong_count')->default(0);
            $table->string('last_result', 10)->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('next_due_at')->nullable();
            $table->unique(['child_profile_id', 'item_id']);
            $table->index(['child_profile_id', 'next_due_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('item_progress');
        Schema::dropIfExists('answers');
        Schema::dropIfExists('play_sessions');
        Schema::dropIfExists('child_profiles');
        Schema::dropIfExists('account_codes');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['locale', 'terms_accepted_at']);
        });
    }
};
