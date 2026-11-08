<?php

namespace App\Http\Resources;

use App\Models\Item;
use App\Services\MediaStore;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Item */
class ItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $translation = $this->translation();
        $language = $request->attributes->get('language');
        $media = app(MediaStore::class);

        return [
            'id' => $this->id,
            'emoji' => $this->emoji,
            'image_url' => $this->imageUrl(),
            'card_url' => $this->imageUrl('card'),
            'thumb_url' => $this->imageUrl('thumb'),
            'name' => $translation?->name,
            // What the app says when it reveals the answer: "C'est une pomme"
            'sentence' => $translation->sentence
                ?? ($translation && $language ? $language->answerFor($translation->name) : null),
            'audio_url' => $media->url($translation?->audio_path),
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
