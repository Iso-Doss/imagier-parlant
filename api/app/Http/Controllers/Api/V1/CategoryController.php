<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;

class CategoryController extends Controller
{
    /** Les catégories principales publiées, chacune avec ses sous-catégories publiées. */
    public function index()
    {
        $categories = Category::published()->roots()
            ->with(['translations', 'children' => fn ($q) => $q->where('is_published', true)
                ->with('translations')->withCount(['items' => fn ($q) => $q->published()])])
            ->withCount(['items' => fn ($q) => $q->published()])
            ->get();

        return CategoryResource::collection($categories);
    }

    public function show(Category $category)
    {
        abort_unless($category->is_published, 404);

        $category->load([
            'translations',
            'items' => fn ($q) => $q->published()->with('translations'),
        ])->loadCount(['items' => fn ($q) => $q->published()]);

        return new CategoryResource($category);
    }
}
