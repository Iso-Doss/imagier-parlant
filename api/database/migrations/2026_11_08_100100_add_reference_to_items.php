<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * - items.reference : clé unique et stable d'un objet (imports, seeder).
 * - Sur MySQL, les emoji sont comparés octet par octet : avec la collation
 *   par défaut, tous les emoji sont « égaux » (🍎 = 🍌).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->string('reference', 120)->nullable()->unique()->after('id');
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'])) {
            foreach (['items', 'categories'] as $name) {
                Schema::table($name, function (Blueprint $table) {
                    $table->string('emoji', 16)->nullable()->charset('utf8mb4')->collation('utf8mb4_bin')->change();
                });
            }
        }

        // Références pour les objets déjà présents : « fruits-apple », « fruits-apple-2 »…
        $taken = [];
        DB::table('items')->join('categories', 'categories.id', '=', 'items.category_id')
            ->select('items.id', 'categories.slug')->orderBy('items.id')->get()
            ->each(function ($row) use (&$taken) {
                $name = DB::table('item_translations')->where('item_id', $row->id)
                    ->orderByRaw("locale = 'en' desc")->value('name');
                $base = Str::limit($row->slug.'-'.Str::slug((string) $name), 110, '');
                $reference = $base;
                for ($i = 2; isset($taken[$reference]); $i++) {
                    $reference = "$base-$i";
                }
                $taken[$reference] = true;
                DB::table('items')->where('id', $row->id)->update(['reference' => $reference]);
            });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropUnique(['reference']);
            $table->dropColumn('reference');
        });
    }
};
