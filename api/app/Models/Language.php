<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['code', 'name', 'tts_locale', 'question', 'answer_template', 'is_active', 'sort_order'])]
class Language extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort_order' => 'integer'];
    }

    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true)->orderBy('sort_order')->orderBy('id');
    }

    /** "C'est :name" + "une pomme" → "C'est une pomme" */
    public function answerFor(string $name): string
    {
        return str_replace(':name', $name, $this->answer_template);
    }
}
