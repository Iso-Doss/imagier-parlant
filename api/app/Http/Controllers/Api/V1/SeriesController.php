<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ItemResource;
use App\Http\Resources\LanguageResource;
use App\Models\Item;
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
        ]);

        $pool = Item::published()
            ->whereHas('category', function ($q) use ($data) {
                $q->where('is_published', true);
                if (! empty($data['categories'])) {
                    $q->whereIn('slug', $data['categories']);
                }
            })
            ->with(['translations', 'category.translations'])
            ->get();

        $series = $builder->build($pool, (int) ($data['count'] ?? 10));

        // ?translation=en adds the name in a second language, shown under the answer
        $second = $data['translation'] ?? null;
        $request->attributes->set('translation_locale', $second !== app()->getLocale() ? $second : null);

        return response()->json([
            'language' => new LanguageResource($request->attributes->get('language')),
            'count' => $series->count(),
            'distinct_items' => $pool->count(),
            'items' => ItemResource::collection($series)->resolve($request),
        ]);
    }
}
