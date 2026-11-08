<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CategoryRequest;
use App\Http\Resources\Admin\AdminCategoryResource;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = Category::with('translations')->withCount('items')
            ->orderBy('sort_order')->orderBy('id')->get();

        return AdminCategoryResource::collection($categories);
    }

    public function store(CategoryRequest $request)
    {
        $category = DB::transaction(function () use ($request) {
            $data = $request->safe()->except('translations');
            $data['sort_order'] ??= (int) Category::max('sort_order') + 1;
            $category = Category::create($data);
            $category->syncTranslations($request->validated('translations'));

            return $category;
        });

        return (new AdminCategoryResource($category->load('translations')->loadCount('items')))
            ->response()->setStatusCode(201);
    }

    public function show(Category $category)
    {
        return new AdminCategoryResource($category->load('translations')->loadCount('items'));
    }

    public function update(CategoryRequest $request, Category $category)
    {
        DB::transaction(function () use ($request, $category) {
            $category->update($request->safe()->except('translations'));
            if ($request->has('translations')) {
                $category->syncTranslations($request->validated('translations'));
            }
        });

        return new AdminCategoryResource($category->load('translations')->loadCount('items'));
    }

    public function destroy(Category $category)
    {
        $category->delete(); // its items and their files go with it (see Category::booted)

        return response()->noContent();
    }

    /** Body: { "ids": [3, 1, 2] } — the new display order. */
    public function reorder(Request $request)
    {
        $ids = $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['integer', 'exists:categories,id']])['ids'];

        DB::transaction(function () use ($ids) {
            foreach (array_values($ids) as $position => $id) {
                Category::whereKey($id)->update(['sort_order' => $position]);
            }
        });

        return $this->index();
    }

    public function uploadImage(Request $request, Category $category)
    {
        $request->validate(['image' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:10240']]);

        $category->replaceImage($request->file('image')->get());

        return $this->show($category);
    }

    public function deleteImage(Category $category)
    {
        $category->removeImage();

        return $this->show($category);
    }
}
