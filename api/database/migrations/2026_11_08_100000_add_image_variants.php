<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['items', 'categories'] as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->json('image_variants')->nullable()->after('image_path');
            });
        }
    }

    public function down(): void
    {
        foreach (['items', 'categories'] as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->dropColumn('image_variants');
            });
        }
    }
};
