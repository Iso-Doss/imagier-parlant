<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Le catalogue de départ (celui du seeder), pour ne pas écrire ses chiffres en dur dans les tests.
     *
     * @return array{categories: list<array{slug: string, items: list<array<string, mixed>>}>}
     */
    protected function catalog(): array
    {
        return json_decode((string) file_get_contents(database_path('seeders/data/catalog.json')), true);
    }

    protected function catalogItems(?string $slug = null): int
    {
        return collect($this->catalog()['categories'])
            ->filter(fn (array $c) => $slug === null || $c['slug'] === $slug)
            ->sum(fn (array $c) => count($c['items']));
    }

    protected function catalogCategories(): int
    {
        return count($this->catalog()['categories']);
    }
}
