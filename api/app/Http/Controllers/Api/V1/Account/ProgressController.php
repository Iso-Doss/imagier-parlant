<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\ItemResource;
use App\Models\ItemProgress;
use App\Models\PlaySession;
use App\Services\ProgressTracker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Résumé des progrès d'un profil, pour l'espace parent. */
class ProgressController extends Controller
{
    public function show(Request $request, string $profile): JsonResponse
    {
        $child = ProfileController::find($request, $profile);
        $progress = $child->progress()->with(['item.translations', 'item.category.translations'])->get();

        $weekSessions = $child->sessions()->where('started_at', '>=', now()->subDays(7))->get();
        $seconds = $weekSessions->sum(fn (PlaySession $s) => $s->ended_at ? max(0, $s->ended_at->diffInSeconds($s->started_at, true)) : 0);

        $toReview = $progress->filter(fn (ItemProgress $p) => $p->box < ProgressTracker::KNOWN_BOX && $p->wrong_count > 0)
            ->sortBy('box')->take(30);

        return response()->json(['data' => [
            'seen' => $progress->count(),
            'known' => $progress->where('box', '>=', ProgressTracker::KNOWN_BOX)->count(),
            'learning' => $progress->where('box', '<', ProgressTracker::KNOWN_BOX)->count(),
            'week' => [
                'sessions' => $weekSessions->count(),
                'minutes' => (int) round($seconds / 60),
                'answers' => $child->sessions()->where('started_at', '>=', now()->subDays(7))->withCount('answers')->get()->sum('answers_count'),
            ],
            'categories' => $progress->groupBy(fn (ItemProgress $p) => $p->item?->category?->slug)
                ->map(fn ($group, $slug) => [
                    'slug' => $slug,
                    'name' => $group->first()->item?->category?->translation()?->name,
                    'seen' => $group->count(),
                    'known' => $group->where('box', '>=', ProgressTracker::KNOWN_BOX)->count(),
                ])->values(),
            'to_review' => ItemResource::collection($toReview->pluck('item')->filter()->values())->resolve($request),
        ]]);
    }
}
