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

#[Fillable(['reference', 'category_id', 'emoji', 'image_path', 'image_variants', 'sort_order', 'is_published'])]
class Item extends Model
{
    /** @use HasTranslations<ItemTranslation> */
    use HasFactory, HasImage, HasTranslations;

    protected static function booted(): void
    {
        // Remove the picture and the recordings along with the item.
        static::deleting(function (Item $item) {
            $audio = $item->translations()->whereNotNull('audio_path')->pluck('audio_path')->all();
            app(MediaStore::class)->delete([...$item->imageFiles(), ...$audio]);
        });
    }

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'sort_order' => 'integer', 'image_variants' => 'array'];
    }

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** @return HasMany<ItemTranslation, $this> */
    public function translations(): HasMany
    {
        return $this->hasMany(ItemTranslation::class);
    }

    protected function imageDirectory(): string
    {
        return "items/{$this->id}/image";
    }

    /** @param  Builder<Item>  $query */
    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true);
    }
}
