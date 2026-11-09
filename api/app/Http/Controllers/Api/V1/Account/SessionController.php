<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Models\Answer;
use App\Models\Item;
use App\Models\PlaySession;
use App\Services\ProgressTracker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Le téléphone envoie chaque série jouée (aussitôt, ou plus tard s'il était hors ligne).
 * L'identifiant vient du téléphone : renvoyer la même série ne compte qu'une fois.
 */
class SessionController extends Controller
{
    public function store(Request $request, string $profile, ProgressTracker $tracker): JsonResponse
    {
        $child = ProfileController::find($request, $profile);

        $data = $request->validate([
            'id' => ['required', 'uuid'],
            'locale' => ['required', 'string', Rule::exists('languages', 'code')],
            'mode' => ['required', Rule::in(PlaySession::MODES)],
            'categories' => ['sometimes', 'array', 'max:50'],
            'categories.*' => ['string', 'max:100'],
            'started_at' => ['required', 'date', 'before_or_equal:now'],
            'ended_at' => ['sometimes', 'nullable', 'date', 'after_or_equal:started_at'],
            'answers' => ['required', 'array', 'min:1', 'max:100'],
            'answers.*.item_id' => ['required', 'integer'],
            'answers.*.result' => ['required', Rule::in(Answer::RESULTS)],
            'answers.*.response_ms' => ['sometimes', 'nullable', 'integer', 'between:0,600000'],
        ]);

        $existing = PlaySession::find($data['id']);
        if ($existing) {
            abort_unless($existing->child_profile_id === $child->id, 409, __('This session already exists.'));

            return response()->json(['data' => ['id' => $existing->id, 'answers' => $existing->answers()->count()]]);
        }

        // Objets supprimés entre-temps : réponses ignorées
        $known = Item::whereIn('id', collect($data['answers'])->pluck('item_id'))->pluck('id')->flip();

        $session = DB::transaction(function () use ($child, $data, $known, $tracker) {
            $session = $child->sessions()->create([
                ...collect($data)->except('answers')->all(),
                'count' => count($data['answers']),
            ]);

            foreach (array_values($data['answers']) as $position => $answer) {
                if (! $known->has($answer['item_id'])) {
                    continue;
                }
                $session->answers()->create([...$answer, 'position' => $position]);
                $tracker->record($child, $answer['item_id'], $answer['result']);
            }

            return $session;
        });

        return response()->json(['data' => ['id' => $session->id, 'answers' => $session->answers()->count()]], 201);
    }
}
