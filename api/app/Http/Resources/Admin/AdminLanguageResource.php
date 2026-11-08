<?php

namespace App\Http\Resources\Admin;

use App\Models\Language;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Language */
class AdminLanguageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'tts_locale' => $this->tts_locale,
            'question' => $this->question,
            'answer_template' => $this->answer_template,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'updated_at' => $this->updated_at,
        ];
    }
}
