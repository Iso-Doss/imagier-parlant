<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\Account\ChildProfileResource;
use App\Models\ChildProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return ChildProfileResource::collection($request->user()->profiles);
    }

    public function store(Request $request): ChildProfileResource
    {
        if ($request->user()->profiles()->count() >= ChildProfile::MAX_PER_ACCOUNT) {
            throw ValidationException::withMessages(['nickname' => __('An account can have up to :max profiles.', ['max' => ChildProfile::MAX_PER_ACCOUNT])]);
        }

        $profile = $request->user()->profiles()->create($this->validated($request, true));

        return new ChildProfileResource($profile);
    }

    public function update(Request $request, string $profile): ChildProfileResource
    {
        $model = $this->find($request, $profile);
        $model->update($this->validated($request, false));

        return new ChildProfileResource($model);
    }

    public function destroy(Request $request, string $profile): Response
    {
        $this->find($request, $profile)->delete();

        return response()->noContent();
    }

    /** Un profil d'un autre compte répond 404, comme s'il n'existait pas. */
    public static function find(Request $request, string $id): ChildProfile
    {
        return $request->user()->profiles()->whereKey($id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'nickname' => [$required, 'string', 'min:1', 'max:20'],
            'avatar' => [$required, Rule::in(ChildProfile::AVATARS)],
            'age_band' => [$required, Rule::in(ChildProfile::AGE_BANDS)],
            'locale' => ['sometimes', 'nullable', 'string', Rule::exists('languages', 'code')],
            'settings' => ['sometimes', 'array:delay,count,mode,showWord,showTranslation,countStyle,tolerance'],
        ]);
    }
}
