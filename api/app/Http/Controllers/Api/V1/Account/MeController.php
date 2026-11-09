<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\Account\UserResource;
use App\Models\Answer;
use App\Models\ChildProfile;
use App\Models\ItemProgress;
use App\Models\PlaySession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\PersonalAccessToken;

class MeController extends Controller
{
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user()->load('profiles'));
    }

    public function update(Request $request): UserResource
    {
        $data = $request->validate([
            'locale' => ['sometimes', 'string', Rule::exists('languages', 'code')],
            'current_password' => ['required_with:password', 'current_password:sanctum'],
            'password' => ['sometimes', 'string', Password::defaults()],
        ]);

        $user = $request->user();
        $user->fill(collect($data)->only(['locale', 'password'])->all())->save();

        // Nouveau mot de passe : les autres appareils sont déconnectés
        if (isset($data['password'])) {
            $user->tokens()->whereKeyNot($user->currentAccessToken()->getKey())->delete();
        }

        return new UserResource($user->load('profiles'));
    }

    /** Suppression immédiate et définitive du compte, des profils et des progrès. */
    public function destroy(Request $request): Response
    {
        $request->validate(['password' => ['required', 'current_password:sanctum']]);

        $user = $request->user();
        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            $user->delete(); // profils, séries, réponses et progrès suivent (clés étrangères en cascade)
        });

        return response()->noContent();
    }

    /** Toutes les données du compte, lisibles (droit d'accès et de portabilité). */
    public function export(Request $request): JsonResponse
    {
        $user = $request->user()->load(['profiles.sessions.answers.item', 'profiles.progress.item']);

        return response()->json([
            'exported_at' => now()->toIso8601String(),
            'account' => [
                'email' => $user->email,
                'locale' => $user->locale,
                'created_at' => $user->created_at,
                'terms_accepted_at' => $user->terms_accepted_at,
            ],
            'profiles' => $user->profiles->map(fn (ChildProfile $p) => [
                'nickname' => $p->nickname,
                'avatar' => $p->avatar,
                'age_band' => $p->age_band,
                'created_at' => $p->created_at,
                'sessions' => $p->sessions->map(fn (PlaySession $s) => [
                    'started_at' => $s->started_at,
                    'ended_at' => $s->ended_at,
                    'locale' => $s->locale,
                    'mode' => $s->mode,
                    'answers' => $s->answers->map(fn (Answer $a) => ['item' => $a->item?->reference, 'result' => $a->result, 'response_ms' => $a->response_ms])->all(),
                ])->all(),
                'progress' => $p->progress->map(fn (ItemProgress $g) => [
                    'item' => $g->item?->reference, 'box' => $g->box,
                    'correct' => $g->correct_count, 'wrong' => $g->wrong_count, 'last_seen_at' => $g->last_seen_at,
                ])->all(),
            ])->all(),
        ], 200, ['Content-Disposition' => 'attachment; filename="imagier-parlant-donnees.json"']);
    }

    public function devices(Request $request): JsonResponse
    {
        $current = $request->user()->currentAccessToken()->getKey();

        return response()->json(['data' => $request->user()->tokens()->latest('last_used_at')->get()
            ->map(fn (PersonalAccessToken $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'last_used_at' => $t->last_used_at,
                'created_at' => $t->created_at,
                'current' => $t->id === $current,
            ])]);
    }

    public function revokeDevice(Request $request, int $id): Response
    {
        $request->user()->tokens()->whereKey($id)->firstOrFail()->delete();

        return response()->noContent();
    }
}
