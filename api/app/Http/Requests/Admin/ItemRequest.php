<?php

namespace App\Http\Requests\Admin;

use App\Models\ItemTranslation;
use Illuminate\Foundation\Http\FormRequest;

class ItemRequest extends FormRequest
{
    use ValidatesTranslations;

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'category_id' => [$required, 'integer', 'exists:categories,id'],
            'emoji' => ['sometimes', 'nullable', 'string', 'max:16'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
            ...$this->translationRules([
                'name' => ['string', 'max:120'],
                'sentence' => ['nullable', 'string', 'max:200'],
                'aliases' => ['nullable', 'array', 'max:'.ItemTranslation::MAX_ALIASES],
                'aliases.*' => ['nullable', 'string', 'max:80'],
            ]),
            'translations' => [$required, 'array'],
        ];
    }
}
