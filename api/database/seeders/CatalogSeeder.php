<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Charge le catalogue de départ (data/catalog.json, recopié dans le prototype web).
 * Peut être relancé : il ajoute et met à jour, sans rien supprimer ni dupliquer,
 * donc les progrès des enfants sont gardés.
 */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = json_decode((string) file_get_contents(__DIR__.'/data/catalog.json'), true, flags: JSON_THROW_ON_ERROR);

        DB::transaction(function () use ($catalog) {
            foreach ($catalog['categories'] as $position => $entry) {
                $category = Category::updateOrCreate(
                    ['slug' => $entry['slug']],
                    ['emoji' => $entry['emoji'], 'color' => $entry['color'], 'sort_order' => $position, 'is_published' => true],
                );
                $category->syncTranslations(collect($entry['names'])->map(fn ($name) => ['name' => $name])->all());

                foreach ($entry['items'] as $order => $item) {
                    // La référence vient du nom anglais : ne pas le changer, sinon l'objet serait recréé
                    $model = $category->items()->updateOrCreate(
                        ['reference' => $category->slug.'-'.Str::slug($item['en'])],
                        ['emoji' => $item['emoji'], 'sort_order' => $order, 'is_published' => true],
                    );
                    $model->syncTranslations(collect(['fr', 'en'])->mapWithKeys(fn (string $lang) => [$lang => [
                        'name' => $item[$lang],
                        'sentence' => $item[$lang.'_sentence'] ?? null,
                        'aliases' => $item[$lang.'_aliases'] ?? null,
                    ]])->all());
                }
            }
        });
    }
}
