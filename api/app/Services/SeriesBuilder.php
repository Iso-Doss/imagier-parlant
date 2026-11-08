<?php

namespace App\Services;

use Illuminate\Support\Collection;

/**
 * Builds a quiz series of exactly $count items from a pool.
 * When the series is longer than the pool, the pool is reshuffled and
 * repeated, and the same item never shows up twice in a row.
 */
class SeriesBuilder
{
    public function build(Collection $pool, int $count): Collection
    {
        $pool = $pool->values();
        if ($pool->isEmpty() || $count < 1) {
            return collect();
        }

        $series = collect();
        while ($series->count() < $count) {
            $round = $pool->shuffle()->values();

            if ($series->isNotEmpty() && $round->count() > 1 && $round->first()->is($series->last())) {
                $round->push($round->shift());
            }

            $series = $series->concat($round);
        }

        return $series->take($count)->values();
    }
}
