<?php

namespace App\Http\Resources\Admin;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Category */
class AdminCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'slug' => $this->slug,
            'emoji' => $this->emoji,
            'color' => $this->color,
            'image_url' => $this->imageUrl(),
            'card_url' => $this->imageUrl('card'),
            'thumb_url' => $this->imageUrl('thumb'),
            'sort_order' => $this->sort_order,
            'is_published' => $this->is_published,
            'items_count' => $this->whenCounted('items'),
            'children_count' => $this->whenCounted('children'),
            'translations' => $this->translations->mapWithKeys(fn ($t) => [$t->locale => ['name' => $t->name]]),
            'updated_at' => $this->updated_at,
        ];
    }
}
