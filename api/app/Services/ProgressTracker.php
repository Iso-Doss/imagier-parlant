<?php

namespace App\Services;

use App\Models\ChildProfile;
use App\Models\ItemProgress;

/**
 * Répétition espacée (boîtes de Leitner) : une bonne réponse fait monter l'objet
 * d'une boîte, une erreur ou un silence le renvoie en boîte 1. Plus la boîte est
 * haute, plus l'objet revient tard.
 */
class ProgressTracker
{
    /** Délai en jours avant de revoir un objet, par boîte */
    public const DELAYS = [1 => 0, 2 => 1, 3 => 3, 4 => 7, 5 => 21];

    /** À partir de cette boîte, l'objet compte comme « connu » */
    public const KNOWN_BOX = 4;

    public function record(ChildProfile $profile, int $itemId, string $result): void
    {
        if ($result === 'skipped') {
            return;
        }

        /** @var ItemProgress $progress */
        $progress = $profile->progress()->firstOrNew(['item_id' => $itemId], ['box' => 1, 'correct_count' => 0, 'wrong_count' => 0]);

        if ($result === 'correct') {
            $progress->box = min(5, $progress->exists ? $progress->box + 1 : 2);
            $progress->correct_count++;
        } else {
            $progress->box = 1;
            $progress->wrong_count++;
        }

        $progress->last_result = $result;
        $progress->last_seen_at = now();
        $progress->next_due_at = now()->addDays(self::DELAYS[$progress->box]);
        $progress->save();
    }
}
