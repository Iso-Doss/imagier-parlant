<?php

namespace App\Http\Requests\Admin;

use App\Models\Language;
use Illuminate\Validation\Validator;

/**
 * Checks a "translations" payload keyed by language code:
 * { "fr": { "name": "une pomme" }, "en": { "name": "an apple" }, "de": null }
 */
trait ValidatesTranslations
{
    protected function translationRules(array $fields): array
    {
        $rules = ['translations' => ['array']];
        $rules['translations.*'] = ['nullable', 'array'];
        foreach ($fields as $field => $fieldRules) {
            $rules["translations.*.$field"] = $fieldRules;
        }

        return $rules;
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            $known = Language::pluck('code')->all();
            foreach ((array) $this->input('translations', []) as $locale => $fields) {
                if (! in_array($locale, $known, true)) {
                    $validator->errors()->add("translations.$locale", __('The language ":locale" does not exist.', ['locale' => $locale]));
                } elseif (is_array($fields) && blank($fields['name'] ?? null)) {
                    $validator->errors()->add("translations.$locale.name", __('The name is required.'));
                }
            }
        }];
    }
}
