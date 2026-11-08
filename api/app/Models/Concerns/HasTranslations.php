<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Model;

/**
 * Shared helpers for models that keep one translation row per language.
 *
 * @template TTranslation of Model
 */
trait HasTranslations
{
    /**
     * The translation for $locale, or the fallback language's, or null.
     *
     * @return TTranslation|null
     */
    public function translation(?string $locale = null): ?Model
    {
        $locale ??= app()->getLocale();

        return $this->translations->firstWhere('locale', $locale)
            ?? $this->translations->firstWhere('locale', config('app.fallback_locale'));
    }

    /**
     * Create, update or delete translation rows from a payload like
     * ['fr' => ['name' => 'une pomme'], 'en' => ['name' => 'an apple']].
     * A locale set to null removes that translation.
     */
    /** @param  array<string, array<string, mixed>|null>  $translations */
    public function syncTranslations(array $translations): void
    {
        foreach ($translations as $locale => $fields) {
            if ($fields === null) {
                $this->translations()->where('locale', $locale)->delete();

                continue;
            }

            $this->translations()->updateOrCreate(['locale' => $locale], $fields);
        }

        $this->unsetRelation('translations');
    }
}
