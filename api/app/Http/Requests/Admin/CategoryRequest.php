<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use Closure;
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
            // Deux niveaux au plus : le parent est une catégorie principale, et une catégorie
            // qui a déjà des sous-catégories ne peut pas devenir elle-même une sous-catégorie.
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id', function (string $attribute, mixed $value, Closure $fail) {
                $self = $this->route('category');
                $parent = $value ? Category::find($value) : null;
                if (! $parent) {
                    return;
                }
                if ($self instanceof Category && $parent->is($self)) {
                    $fail(__('A category cannot be inside itself.'));
                } elseif ($parent->parent_id !== null) {
                    $fail(__('Choose a main category: sub-categories cannot have their own.'));
                } elseif ($self instanceof Category && $self->children()->exists()) {
                    $fail(__('This category has sub-categories, so it must stay a main category.'));
                }
            }],
            'emoji' => ['sometimes', 'nullable', 'string', 'max:16'],
            'color' => ['sometimes', 'nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
            ...$this->translationRules(['name' => ['string', 'max:80']]),
            'translations' => [$required, 'array'],
        ];
    }
}
