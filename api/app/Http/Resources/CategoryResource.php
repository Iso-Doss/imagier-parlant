<?php

namespace App\Http\Resources;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Category */
class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->translation()?->name,
            'emoji' => $this->emoji,
            'color' => $this->color,
            'image_url' => $this->imageUrl(),
            'card_url' => $this->imageUrl('card'),
            'thumb_url' => $this->imageUrl('thumb'),
            'items_count' => $this->whenCounted('items'),
            'items' => ItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
