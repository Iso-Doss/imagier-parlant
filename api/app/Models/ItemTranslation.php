<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property list<string>|null $aliases
 */
#[Fillable(['locale', 'name', 'sentence', 'aliases', 'audio_path'])]
class ItemTranslation extends Model
{
    public const MAX_ALIASES = 10;

    /** @return BelongsTo<Item, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /** Toutes les réponses acceptées : le nom puis les variantes. */
    /** @return list<string> */
    public function acceptedForms(): array
    {
        return [$this->name, ...($this->aliases ?? [])];
    }

    /** @return Attribute<list<string>|null, list<string>|null> */
    protected function aliases(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => $value === null ? null : json_decode($value, true),
            // Variantes nettoyées : sans espaces en trop, sans doublon, null si la liste est vide.
            set: function (?array $value) {
                $clean = array_values(array_unique(array_filter(array_map(
                    fn ($alias) => trim((string) $alias),
                    $value ?? [],
                ), fn (string $alias) => $alias !== '')));

                return $clean === [] ? null : json_encode($clean, JSON_UNESCAPED_UNICODE);
            },
        );
    }
}
