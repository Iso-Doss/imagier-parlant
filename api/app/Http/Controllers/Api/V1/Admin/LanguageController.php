<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LanguageRequest;
use App\Http\Resources\Admin\AdminLanguageResource;
use App\Models\CategoryTranslation;
use App\Models\ItemTranslation;
use App\Models\Language;

class LanguageController extends Controller
{
    public function index()
    {
        return AdminLanguageResource::collection(Language::orderBy('sort_order')->orderBy('id')->get());
    }

    public function store(LanguageRequest $request)
    {
        $data = $request->validated();
        $data['sort_order'] ??= (int) Language::max('sort_order') + 1;

        return (new AdminLanguageResource(Language::create($data)))
            ->response()->setStatusCode(201);
    }

    public function show(Language $language)
    {
        return new AdminLanguageResource($language);
    }

    public function update(LanguageRequest $request, Language $language)
    {
        $data = $request->validated();
        if (isset($data['code']) && $data['code'] !== $language->code && $this->hasContent($language)) {
            abort(409, 'This language already has translations, so its code cannot change.');
        }

        $language->update($data);

        return new AdminLanguageResource($language);
    }

    public function destroy(Language $language)
    {
        if ($language->code === config('app.fallback_locale')) {
            abort(409, 'The default language cannot be deleted.');
        }
        if ($this->hasContent($language)) {
            abort(409, 'This language has translations. Deactivate it instead, or delete its translations first.');
        }

        $language->delete();

        return response()->noContent();
    }

    private function hasContent(Language $language): bool
    {
        return ItemTranslation::where('locale', $language->code)->exists()
            || CategoryTranslation::where('locale', $language->code)->exists();
    }
}
