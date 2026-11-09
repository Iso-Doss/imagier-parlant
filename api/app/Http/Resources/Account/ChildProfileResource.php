<?php

namespace App\Http\Resources\Account;

use App\Models\ChildProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ChildProfile */
class ChildProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nickname' => $this->nickname,
            'avatar' => $this->avatar,
            'age_band' => $this->age_band,
            'locale' => $this->locale,
            'settings' => (object) ($this->settings ?? []),
            'created_at' => $this->created_at,
        ];
    }
}
