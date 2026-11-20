<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ItemResource;
use App\Http\Resources\LanguageResource;
use App\Models\Category;
use App\Models\Item;
use App\Models\User;
use App\Services\SeriesBuilder;
use Illuminate\Http\Request;

/**
 * GET /api/v1/series?lang=fr&categories=fruits,animaux&count=10
 * Returns a ready-to-play list of pictures. Leave out "categories" to mix every category.
 */
class SeriesController extends Controller
{
    public function __invoke(Request $request, SeriesBuilder $builder)
    {
        $slugs = $request->input('categories');
        if (is_string($slugs)) {
            $request->merge(['categories' => array_values(array_filter(explode(',', $slugs)))]);
        }

        $data = $request->validate([
            'categories' => ['sometimes', 'array', 'max:50'],
            'categories.*' => ['string', 'exists:categories,slug'],
            'count' => ['sometimes', 'integer', 'between:1,100'],
            'translation' => ['sometimes', 'nullable', 'string', 'exists:languages,code'],
            'profile' => ['sometimes', 'nullable', 'uuid'],
        ]);

        // Choisir une catégorie principale joue aussi ses sous-catégories
        $pool = Item::published()
            ->when(! empty($data['categories']),
                fn ($q) => $q->whereIn('category_id', Category::playableIds($data['categories'])),
                fn ($q) => $q->whereHas('category', fn ($c) => $c->where('is_published', true)
                    ->where(fn ($c) => $c->whereNull('parent_id')->orWhereHas('parent', fn ($p) => $p->where('is_published', true)))))
            ->with(['translations', 'category.translations'])
            ->get();

        $count = (int) ($data['count'] ?? 10);

        // Avec un profil (parent connecté) : jusqu'à 30 % d'objets « à revoir » dont la date est passée
        $review = collect();
        $user = auth('sanctum')->user();
        if (! empty($data['profile']) && $user instanceof User) {
            $profile = $user->profiles()->whereKey($data['profile'])->first();
            if ($profile) {
                $due = $profile->progress()->where('next_due_at', '<=', now())
                    ->whereIn('item_id', $pool->modelKeys())->orderBy('box')->orderBy('next_due_at')
                    ->limit((int) ceil($count * 0.3))->pluck('item_id');
                $review = $pool->whereIn('id', $due)->values();
            }
        }

        $series = $builder->mixIn($builder->build($pool, $count - $review->count()), $review);

        // ?translation=en adds the name in a second language, shown under the answer
        $second = $data['translation'] ?? null;
        $request->attributes->set('translation_locale', $second !== app()->getLocale() ? $second : null);

        return response()->json([
            'language' => new LanguageResource($request->attributes->get('language')),
            'count' => $series->count(),
            'review_items' => $review->count(),
            'distinct_items' => $pool->count(),
            'items' => ItemResource::collection($series)->resolve($request),
        ]);
    }
}
