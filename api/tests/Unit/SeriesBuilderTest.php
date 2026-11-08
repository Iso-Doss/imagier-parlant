<?php

namespace Tests\Unit;

use App\Models\Item;
use App\Services\SeriesBuilder;
use PHPUnit\Framework\TestCase;

class SeriesBuilderTest extends TestCase
{
    private function pool(int $size)
    {
        return collect(range(1, $size))->map(fn ($id) => (new Item)->forceFill(['id' => $id]));
    }

    public function test_la_serie_a_la_longueur_demandee_et_ne_repete_jamais_deux_fois_de_suite(): void
    {
        foreach ([[3, 50], [2, 100], [10, 10], [40, 7]] as [$size, $count]) {
            $series = (new SeriesBuilder)->build($this->pool($size), $count);

            $this->assertCount($count, $series);
            $ids = $series->pluck('id')->all();
            for ($i = 1; $i < count($ids); $i++) {
                $this->assertNotSame($ids[$i - 1], $ids[$i], "Même objet deux fois de suite (pool $size, série $count)");
            }
        }
    }

    public function test_une_reserve_vide_donne_une_serie_vide(): void
    {
        $this->assertCount(0, (new SeriesBuilder)->build(collect(), 10));
        $this->assertCount(0, (new SeriesBuilder)->build($this->pool(3), 0));
    }
}
