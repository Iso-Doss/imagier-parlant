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

    /**
     * Glisse des objets « à revoir » dans une série, à des places au hasard,
     * en gardant la règle : jamais deux fois le même objet de suite.
     */
    public function mixIn(Collection $series, Collection $review): Collection
    {
        $series = $series->values()->all();
        foreach ($review->values() as $item) {
            $places = collect(range(0, count($series)))->shuffle();
            $place = $places->first(fn (int $i) => ! (isset($series[$i - 1]) && $series[$i - 1]->is($item))
                && ! (isset($series[$i]) && $series[$i]->is($item)));
            if ($place !== null) {
                array_splice($series, $place, 0, [$item]);
            }
        }

        return collect($series);
    }
}
