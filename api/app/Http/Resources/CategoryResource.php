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
            // Pour une catégorie principale : ses objets et ceux de ses sous-catégories
            'items_count' => $this->whenCounted('items', fn () => $this->items_count
                + ($this->relationLoaded('children') ? (int) $this->children->sum('items_count') : 0)),
            'children' => CategoryResource::collection($this->whenLoaded('children')),
            'items' => ItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
