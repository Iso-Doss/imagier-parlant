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
            // Les principales d'abord : une sous-catégorie a besoin de son parent
            $entries = collect($catalog['categories'])->sortBy(fn (array $e) => isset($e['parent']) ? 1 : 0, SORT_REGULAR, false);
            $siblings = [];
            foreach ($entries as $entry) {
                $parent = isset($entry['parent']) ? Category::where('slug', $entry['parent'])->value('id') : null;
                // Ordre d'affichage : la place dans le fichier, parmi les catégories de même parent
                $position = $siblings[$parent ?? 0] = ($siblings[$parent ?? 0] ?? -1) + 1;
                $category = Category::updateOrCreate(
                    ['slug' => $entry['slug']],
                    ['parent_id' => $parent, 'emoji' => $entry['emoji'], 'color' => $entry['color'], 'sort_order' => $position, 'is_published' => true],
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
