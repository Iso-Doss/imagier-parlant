<?php

namespace App\Models;

use App\Models\Concerns\HasImage;
use App\Models\Concerns\HasTranslations;
use App\Services\MediaStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['parent_id', 'slug', 'emoji', 'color', 'image_path', 'image_variants', 'sort_order', 'is_published'])]
class Category extends Model
{
    /** @use HasTranslations<CategoryTranslation> */
    use HasFactory, HasImage, HasTranslations;

    protected static function booted(): void
    {
        // Delete items one by one so each removes its own files.
        static::deleting(function (Category $category) {
            $category->children()->get()->each->delete();
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

    /** @return BelongsTo<Category, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    /**
     * Sous-catégories, dans l'ordre d'affichage.
     *
     * @return HasMany<Category, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id')->orderBy('sort_order')->orderBy('id');
    }

    /** @param  Builder<Category>  $query */
    public function scopeRoots(Builder $query): void
    {
        $query->whereNull('parent_id');
    }

    /**
     * Les catégories jouées quand on choisit celles-ci : elles-mêmes et leurs sous-catégories publiées.
     *
     * @param  list<string>  $slugs
     * @return list<int>
     */
    public static function playableIds(array $slugs): array
    {
        $chosen = static::whereIn('slug', $slugs)->where('is_published', true)
            ->where(fn ($q) => $q->whereNull('parent_id')->orWhereHas('parent', fn ($p) => $p->where('is_published', true)))
            ->pluck('id');

        return $chosen->merge(static::whereIn('parent_id', $chosen)->where('is_published', true)->pluck('id'))
            ->unique()->values()->all();
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
