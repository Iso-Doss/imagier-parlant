<?php

namespace App\Models;

use App\Models\Concerns\HasImage;
use App\Models\Concerns\HasTranslations;
use App\Services\MediaStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['slug', 'emoji', 'color', 'image_path', 'image_variants', 'sort_order', 'is_published'])]
class Category extends Model
{
    /** @use HasTranslations<CategoryTranslation> */
    use HasFactory, HasImage, HasTranslations;

    protected static function booted(): void
    {
        // Delete items one by one so each removes its own files.
        static::deleting(function (Category $category) {
            $category->items()->get()->each->delete();
            app(MediaStore::class)->delete($category->imageFiles());
        });
    }

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'sort_order' => 'integer', 'image_variants' => 'array'];
    }

    /** @return HasMany<CategoryTranslation, $this> */
    public function translations(): HasMany
    {
        return $this->hasMany(CategoryTranslation::class);
    }

    /** @return HasMany<Item, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(Item::class)->orderBy('sort_order')->orderBy('id');
    }

    protected function imageDirectory(): string
    {
        return "categories/{$this->id}";
    }

    /** @param  Builder<Category>  $query */
    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true)->orderBy('sort_order')->orderBy('id');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
