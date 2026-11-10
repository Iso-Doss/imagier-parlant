<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Category;
use App\Models\Item;
use App\Models\Language;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Construit le « pack » hors connexion d'une catégorie : ses objets dans toutes les langues
 * actives, avec l'adresse de chaque image et de chaque son à télécharger.
 *
 * Le numéro de version est l'empreinte du contenu : il change dès qu'un nom, une image
 * ou un son change, et l'app sait alors qu'il faut mettre à jour.
 */
class PackBuilder
{
    public function __construct(private MediaStore $media) {}

    /** Résumé de chaque pack (pour la liste de l'espace parent). */
    public function summaries(): Collection
    {
        return Category::published()->with('translations')->get()
            ->map(fn (Category $category) => [
                'slug' => $category->slug,
                'name' => $category->translation()?->name,
                'emoji' => $category->emoji,
                ...collect($this->build($category))->only(['version', 'size', 'items_count'])->all(),
            ])
            ->filter(fn (array $pack) => $pack['items_count'] > 0)
            ->values();
    }

    /**
     * Le pack complet. Gardé en cache tant que rien ne change dans la catégorie.
     *
     * @return array<string, mixed>
     */
    public function build(Category $category): array
    {
        return Cache::rememberForever("pack:{$category->id}:{$this->stamp($category)}", fn () => $this->make($category));
    }

    /** @return array<string, mixed> */
    private function make(Category $category): array
    {
        $languages = Language::active()->get();
        $category->load(['translations', 'items' => fn ($q) => $q->published()->with('translations')]);

        $names = [];
        foreach ($languages as $language) {
            $names[$language->code] = $category->translation($language->code)?->name;
        }

        $files = [$category->image_variants['thumb'] ?? $category->image_path];
        $items = $category->items->map(function (Item $item) use ($languages, &$files) {
            $texts = [];
            foreach ($languages as $language) {
                $translation = $item->translation($language->code);
                if (! $translation) {
                    continue;
                }
                $texts[$language->code] = [
                    'name' => $translation->name,
                    'sentence' => $translation->sentence ?? $language->answerFor($translation->name),
                    'aliases' => $translation->aliases ?? [],
                    'audio_url' => $this->media->url($translation->audio_path),
                ];
                $files[] = $translation->audio_path;
            }
            $files[] = $item->image_variants['full'] ?? $item->image_path;
            $files[] = $item->image_variants['thumb'] ?? null;

            return [
                'id' => $item->id,
                'emoji' => $item->emoji,
                'image_url' => $item->imageUrl(),
                'thumb_url' => $item->imageUrl('thumb'),
                'texts' => $texts,
            ];
        })->values()->all();

        $content = [
            'slug' => $category->slug,
            'category' => [
                'slug' => $category->slug,
                'emoji' => $category->emoji,
                'color' => $category->color,
                'image_url' => $category->imageUrl(),
                'thumb_url' => $category->imageUrl('thumb'),
                'names' => $names,
            ],
            'languages' => $languages->map(fn (Language $l) => [
                'code' => $l->code,
                'name' => $l->name,
                'tts_locale' => $l->tts_locale,
                'question' => $l->question,
                'answer_template' => $l->answer_template,
            ])->all(),
            'items' => $items,
        ];

        return [
            'version' => substr(hash('sha256', (string) json_encode($content)), 0, 12),
            'size' => $this->size(array_unique(array_filter($files))),
            'items_count' => count($items),
            ...$content,
        ];
    }

    /** Taille totale des fichiers à télécharger, en octets (plus ~1 Ko par objet pour le texte). */
    private function size(array $paths): int
    {
        $total = 0;
        foreach ($paths as $path) {
            try {
                $total += $this->media->disk()->size($path);
            } catch (Throwable) {
                // Fichier absent : l'app gardera l'émoji ou la voix du téléphone
            }
        }

        return $total;
    }

    /** Change dès qu'un élément de la catégorie (ou une langue) est modifié. */
    private function stamp(Category $category): string
    {
        $items = DB::table('items')->where('category_id', $category->id);
        $parts = [
            $category->updated_at?->getTimestamp(),
            DB::table('category_translations')->where('category_id', $category->id)->max('updated_at'),
            (clone $items)->max('updated_at'),
            (clone $items)->count(),
            DB::table('item_translations')->whereIn('item_id', (clone $items)->select('id'))->max('updated_at'),
            DB::table('languages')->max('updated_at'),
            DB::table('languages')->where('is_active', true)->count(),
        ];

        return substr(sha1(implode('|', array_map('strval', $parts))), 0, 16);
    }
}
