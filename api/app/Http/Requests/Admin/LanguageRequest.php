<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LanguageRequest extends FormRequest
{
    public function rules(): array
    {
        $creating = $this->isMethod('post');
        $required = $creating ? 'required' : 'sometimes';

        return [
            'code' => [$required, 'string', 'max:10', 'regex:/^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/',
                Rule::unique('languages', 'code')->ignore($this->route('language'))],
            'name' => [$required, 'string', 'max:60'],
            'tts_locale' => [$required, 'string', 'max:20'],
            'question' => [$required, 'string', 'max:120'],
            'answer_template' => [$required, 'string', 'max:120', 'regex:/:name/'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return ['answer_template.regex' => 'The answer template must contain :name, e.g. "C\'est :name".'];
    }
}
