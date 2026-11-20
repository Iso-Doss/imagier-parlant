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

    /** Objets d'une catégorie, sous-catégories comprises (ou de tout le catalogue). */
    protected function catalogItems(?string $slug = null): int
    {
        return collect($this->catalog()['categories'])
            ->filter(fn (array $c) => $slug === null || $c['slug'] === $slug || ($c['parent'] ?? null) === $slug)
            ->sum(fn (array $c) => count($c['items']));
    }

    /** Catégories principales (celles que l'app montre à l'accueil). */
    protected function catalogCategories(): int
    {
        return collect($this->catalog()['categories'])->whereNull('parent')->count();
    }

    /** La dernière catégorie principale du fichier. */
    protected function lastRootSlug(): string
    {
        return collect($this->catalog()['categories'])->whereNull('parent')->last()['slug'];
    }
}
