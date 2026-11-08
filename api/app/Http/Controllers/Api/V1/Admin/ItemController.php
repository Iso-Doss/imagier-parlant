<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ItemRequest;
use App\Http\Resources\Admin\AdminItemResource;
use App\Models\Item;
use App\Models\Language;
use App\Services\MediaStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ItemController extends Controller
{
    public function __construct(private MediaStore $media) {}

    /**
     * Filters: ?category_id=1  ?search=pomme  ?published=1|0
     *          ?missing=image|audio|translation  ?per_page=25
     */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'category_id' => ['sometimes', 'integer'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'published' => ['sometimes', 'boolean'],
            'missing' => ['sometimes', 'in:image,audio,translation'],
            'per_page' => ['sometimes', 'integer', 'between:1,200'],
        ]);

        $languageCount = Language::count();

        $items = Item::query()
            ->with(['translations', 'category'])
            ->when($filters['category_id'] ?? null, fn ($q, $id) => $q->where('category_id', $id))
            ->when(isset($filters['published']), fn ($q) => $q->where('is_published', $request->boolean('published')))
            ->when($filters['search'] ?? null, fn ($q, $s) => $q->whereHas('translations', fn ($t) => $t->where('name', 'like', "%$s%")))
            ->when(($filters['missing'] ?? null) === 'image', fn ($q) => $q->whereNull('image_path'))
            ->when(($filters['missing'] ?? null) === 'audio', fn ($q) => $q->whereHas('translations', fn ($t) => $t->whereNull('audio_path')))
            ->when(($filters['missing'] ?? null) === 'translation', fn ($q) => $q->has('translations', '<', $languageCount))
            ->orderBy('category_id')->orderBy('sort_order')->orderBy('id')
            ->paginate($filters['per_page'] ?? 25)
            ->withQueryString();

        return AdminItemResource::collection($items);
    }

    public function store(ItemRequest $request)
    {
        $item = DB::transaction(function () use ($request) {
            $data = $request->safe()->except('translations');
            $data['sort_order'] ??= (int) Item::where('category_id', $data['category_id'])->max('sort_order') + 1;
            $item = Item::create($data);
            $item->syncTranslations($request->validated('translations'));

            return $item;
        });

        return (new AdminItemResource($item->load('translations', 'category')))->response()->setStatusCode(201);
    }

    public function show(Item $item)
    {
        return new AdminItemResource($item->load('translations', 'category'));
    }

    public function update(ItemRequest $request, Item $item)
    {
        DB::transaction(function () use ($request, $item) {
            $item->update($request->safe()->except('translations'));
            if ($request->has('translations')) {
                foreach ($request->validated('translations') as $locale => $fields) {
                    if ($fields === null) {
                        $this->deleteAudioFile($item, $locale);
                    }
                }
                $item->syncTranslations($request->validated('translations'));
            }
        });

        return $this->show($item);
    }

    public function destroy(Item $item)
    {
        $item->delete(); // files are removed in Item::booted

        return response()->noContent();
    }

    public function uploadImage(Request $request, Item $item)
    {
        $request->validate(['image' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:10240']]);

        $item->replaceImage($request->file('image')->get());

        return $this->show($item);
    }

    public function deleteImage(Item $item)
    {
        $item->removeImage();

        return $this->show($item);
    }

    /** Recorded pronunciation for one language (mp3, m4a, wav, ogg, webm). */
    public function uploadAudio(Request $request, Item $item, string $locale)
    {
        $request->validate([
            'audio' => ['required', 'file', 'max:5120', 'mimes:mp3,mpga,m4a,mp4,wav,ogg,oga,webm,aac'],
        ]);

        $translation = $item->translations()->where('locale', $locale)->first();
        abort_unless($translation !== null, 404, __('Add the ":locale" name before uploading its audio.', ['locale' => $locale]));

        $file = $request->file('audio');
        $old = $translation->audio_path;
        $path = $this->media->putAudio($file->get(), $file->guessExtension() ?: $file->getClientOriginalExtension(), "items/{$item->id}/audio/$locale");
        $translation->update(['audio_path' => $path]);
        if ($old && $old !== $path) {
            $this->media->delete($old);
        }

        return $this->show($item->unsetRelation('translations'));
    }

    public function deleteAudio(Item $item, string $locale)
    {
        $this->deleteAudioFile($item, $locale);
        $item->translations()->where('locale', $locale)->update(['audio_path' => null]);

        return $this->show($item->unsetRelation('translations'));
    }

    private function deleteAudioFile(Item $item, string $locale): void
    {
        $this->media->delete($item->translations()->where('locale', $locale)->value('audio_path'));
    }
}
