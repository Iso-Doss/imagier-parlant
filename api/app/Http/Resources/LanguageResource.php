<?php

namespace App\Http\Resources;

use App\Models\Language;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Language */
class LanguageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'tts_locale' => $this->tts_locale,
            'question' => $this->question,
            'answer_template' => $this->answer_template,
        ];
    }
}
