<?php

namespace App\Models;

use App\Models\Concerns\HasTranslations;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

#[Fillable(['category_id', 'emoji', 'image_path', 'sort_order', 'is_published'])]
class Item extends Model
{
    use HasFactory, HasTranslations;

    protected static function booted(): void
    {
        // Remove the picture and the recordings along with the item.
        static::deleting(function (Item $item) {
            $files = $item->translations()->whereNotNull('audio_path')->pluck('audio_path')
                ->push($item->image_path)->filter()->all();
            Storage::disk('public')->delete($files);
        });
    }

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'sort_order' => 'integer'];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function translations(): HasMany
    {
        return $this->hasMany(ItemTranslation::class);
    }

    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true);
    }
}
