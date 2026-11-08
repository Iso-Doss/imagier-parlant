<?php

namespace App\Http\Resources;

use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Item */
class ItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $translation = $this->translation();
        $language = $request->attributes->get('language');
        $disk = Storage::disk('public');

        return [
            'id' => $this->id,
            'emoji' => $this->emoji,
            'image_url' => $this->image_path ? $disk->url($this->image_path) : null,
            'name' => $translation?->name,
            // What the app says when it reveals the answer: "C'est une pomme"
            'sentence' => $translation?->sentence
                ?? ($translation && $language ? $language->answerFor($translation->name) : null),
            'audio_url' => $translation?->audio_path ? $disk->url($translation->audio_path) : null,
            'translation' => $this->when(
                (bool) $request->attributes->get('translation_locale'),
                fn () => $this->translations->firstWhere('locale', $request->attributes->get('translation_locale'))?->name,
            ),
            'category' => $this->whenLoaded('category', fn () => [
                'slug' => $this->category->slug,
                'name' => $this->category->translation()?->name,
            ]),
        ];
    }
}
