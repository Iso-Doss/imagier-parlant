<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CategoryRequest extends FormRequest
{
    use ValidatesTranslations;

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'slug' => [$required, 'string', 'max:60', 'alpha_dash:ascii',
                Rule::unique('categories', 'slug')->ignore($this->route('category'))],
            'emoji' => ['sometimes', 'nullable', 'string', 'max:16'],
            'color' => ['sometimes', 'nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
            ...$this->translationRules(['name' => ['string', 'max:80']]),
            'translations' => [$required, 'array'],
        ];
    }
}
