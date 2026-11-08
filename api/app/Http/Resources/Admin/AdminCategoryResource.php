<?php

namespace App\Http\Resources\Admin;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Category */
class AdminCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'emoji' => $this->emoji,
            'color' => $this->color,
            'image_url' => $this->image_path ? Storage::disk('public')->url($this->image_path) : null,
            'sort_order' => $this->sort_order,
            'is_published' => $this->is_published,
            'items_count' => $this->whenCounted('items'),
            'translations' => $this->translations->mapWithKeys(fn ($t) => [$t->locale => ['name' => $t->name]]),
            'updated_at' => $this->updated_at,
        ];
    }
}
