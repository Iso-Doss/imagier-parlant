<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Loads the starter categories and objects. Safe to run again: it updates instead of duplicating. */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = require __DIR__.'/data/catalog.php';

        DB::transaction(function () use ($catalog) {
            foreach ($catalog as $position => $entry) {
                $category = Category::updateOrCreate(
                    ['slug' => $entry['slug']],
                    ['emoji' => $entry['emoji'], 'color' => $entry['color'], 'sort_order' => $position, 'is_published' => true],
                );
                $category->syncTranslations(collect($entry['names'])->map(fn ($name) => ['name' => $name])->all());

                foreach ($entry['items'] as $order => [$emoji, $fr, $en, $frSentence, $enSentence]) {
                    $item = $category->items()->updateOrCreate(
                        ['reference' => $category->slug.'-'.Str::slug($en)],
                        ['emoji' => $emoji, 'sort_order' => $order, 'is_published' => true],
                    );
                    $item->syncTranslations([
                        'fr' => ['name' => $fr, 'sentence' => $frSentence],
                        'en' => ['name' => $en, 'sentence' => $enSentence],
                    ]);
                }
            }
        });
    }
}
