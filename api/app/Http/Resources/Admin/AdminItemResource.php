<?php

namespace App\Http\Resources\Admin;

use App\Models\Item;
use App\Services\MediaStore;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Item */
class AdminItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $media = app(MediaStore::class);

        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'slug' => $this->category->slug,
                'emoji' => $this->category->emoji,
            ]),
            'emoji' => $this->emoji,
            'image_url' => $this->imageUrl(),
            'card_url' => $this->imageUrl('card'),
            'thumb_url' => $this->imageUrl('thumb'),
            'sort_order' => $this->sort_order,
            'is_published' => $this->is_published,
            'translations' => $this->translations->mapWithKeys(fn ($t) => [$t->locale => [
                'name' => $t->name,
                'sentence' => $t->sentence,
                'audio_url' => $media->url($t->audio_path),
            ]]),
            'updated_at' => $this->updated_at,
        ];
    }
}
