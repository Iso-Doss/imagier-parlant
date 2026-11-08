<?php

namespace App\Http\Resources\Admin;

use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Item */
class AdminItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $disk = Storage::disk('public');

        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'slug' => $this->category->slug,
                'emoji' => $this->category->emoji,
            ]),
            'emoji' => $this->emoji,
            'image_url' => $this->image_path ? $disk->url($this->image_path) : null,
            'sort_order' => $this->sort_order,
            'is_published' => $this->is_published,
            'translations' => $this->translations->mapWithKeys(fn ($t) => [$t->locale => [
                'name' => $t->name,
                'sentence' => $t->sentence,
                'audio_url' => $t->audio_path ? $disk->url($t->audio_path) : null,
            ]]),
            'updated_at' => $this->updated_at,
        ];
    }
}
