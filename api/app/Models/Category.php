<?php

namespace App\Models;

use App\Models\Concerns\HasTranslations;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

#[Fillable(['slug', 'emoji', 'color', 'image_path', 'sort_order', 'is_published'])]
class Category extends Model
{
    use HasFactory, HasTranslations;

    protected static function booted(): void
    {
        // Delete items one by one so each removes its own files.
        static::deleting(function (Category $category) {
            $category->items()->get()->each->delete();
            if ($category->image_path) {
                Storage::disk('public')->delete($category->image_path);
            }
        });
    }

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'sort_order' => 'integer'];
    }

    public function translations(): HasMany
    {
        return $this->hasMany(CategoryTranslation::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(Item::class)->orderBy('sort_order')->orderBy('id');
    }

    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true)->orderBy('sort_order')->orderBy('id');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
