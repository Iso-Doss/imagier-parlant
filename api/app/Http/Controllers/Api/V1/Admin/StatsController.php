<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;

/** Numbers for the admin dashboard: what exists and what still needs work. */
class StatsController extends Controller
{
    public function __invoke()
    {
        $languages = Language::orderBy('sort_order')->orderBy('id')->get();
        $items = Item::count();

        return response()->json([
            'categories' => Category::count(),
            'items' => $items,
            'published_items' => Item::where('is_published', true)->count(),
            'items_without_image' => Item::whereNull('image_path')->count(),
            'languages' => $languages->map(fn (Language $l) => [
                'code' => $l->code,
                'name' => $l->name,
                'is_active' => $l->is_active,
                'translated_items' => $translated = ItemTranslation::where('locale', $l->code)->count(),
                'missing_translations' => $items - $translated,
                'items_with_audio' => ItemTranslation::where('locale', $l->code)->whereNotNull('audio_path')->count(),
            ]),
        ]);
    }
}
