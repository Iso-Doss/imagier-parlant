<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Item;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\LanguageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([LanguageSeeder::class, CatalogSeeder::class]);
    }

    public function test_it_lists_active_languages_with_their_question(): void
    {
        $this->getJson('/api/v1/languages')
            ->assertOk()
            ->assertJsonPath('data.0.code', 'fr')
            ->assertJsonPath('data.0.question', "Qu'est-ce que c'est ?")
            ->assertJsonPath('data.1.code', 'en');
    }

    public function test_categories_are_translated_and_counted(): void
    {
        $this->getJson('/api/v1/categories?lang=en')
            ->assertOk()
            ->assertHeader('Content-Language', 'en')
            ->assertJsonCount($this->catalogCategories(), 'data')
            ->assertJsonPath('data.1.name', 'Vegetables')
            ->assertJsonPath('data.0.items_count', $this->catalogItems('fruits'));

        $this->getJson('/api/v1/categories', ['Accept-Language' => 'fr-FR,fr;q=0.9'])
            ->assertJsonPath('data.1.name', 'Légumes');
    }

    public function test_a_category_shows_its_items_with_the_spoken_sentence(): void
    {
        $this->getJson('/api/v1/categories/fruits?lang=fr')
            ->assertOk()
            ->assertJsonPath('data.items.0.name', 'une pomme')
            ->assertJsonPath('data.items.0.sentence', "C'est une pomme")
            ->assertJsonPath('data.items.7.sentence', 'Ce sont des cerises');

        $this->getJson('/api/v1/categories/fruits?lang=en')
            ->assertJsonPath('data.items.0.sentence', "It's an apple");
    }

    public function test_unknown_language_is_rejected(): void
    {
        $this->getJson('/api/v1/categories?lang=xx')->assertStatus(422);
    }

    public function test_unpublished_content_is_hidden(): void
    {
        Category::where('slug', 'fruits')->update(['is_published' => false]);
        Item::whereHas('category', fn ($q) => $q->where('slug', 'animaux'))->limit(3)->update(['is_published' => false]);

        $this->getJson('/api/v1/categories/fruits')->assertNotFound();
        $this->getJson('/api/v1/categories')
            ->assertJsonCount($this->catalogCategories() - 1, 'data')
            ->assertJsonPath('data.1.items_count', $this->catalogItems('animaux') - 3);
        $this->getJson('/api/v1/series?categories=fruits&count=5')->assertJsonPath('count', 0);
    }

    public function test_series_has_the_requested_length_and_never_repeats_back_to_back(): void
    {
        $response = $this->getJson('/api/v1/series?lang=fr&categories=bain&count=100')
            ->assertOk()
            ->assertJsonPath('count', 100)
            ->assertJsonPath('distinct_items', $this->catalogItems('bain'))
            ->assertJsonPath('language.question', "Qu'est-ce que c'est ?");

        $ids = array_column($response->json('items'), 'id');
        $this->assertCount(100, $ids);
        $this->assertCount($this->catalogItems('bain'), array_unique($ids));
        for ($i = 1; $i < count($ids); $i++) {
            $this->assertNotSame($ids[$i - 1], $ids[$i], "Item repeated at position $i");
        }
    }

    public function test_series_mixes_several_categories(): void
    {
        $response = $this->getJson('/api/v1/series?categories[]=fruits&categories[]=legumes&count=20')->assertOk();

        $slugs = collect($response->json('items'))->pluck('category.slug')->unique()->sort()->values()->all();
        $this->assertSame(['fruits', 'legumes'], $slugs);
    }

    public function test_categories_come_with_their_sub_categories(): void
    {
        $animals = collect($this->getJson('/api/v1/categories?lang=fr')->json('data'))->firstWhere('slug', 'animaux');
        $this->assertSame(['ferme', 'mer', 'insectes', 'oiseaux', 'foret'], array_column($animals['children'], 'slug'));
        $this->assertSame('La ferme', $animals['children'][0]['name']);
        $this->assertSame($this->catalogItems('animaux'), $animals['items_count']);
        $this->assertNotContains('ferme', collect($this->getJson('/api/v1/categories')->json('data'))->pluck('slug'));
    }

    public function test_a_main_category_plays_its_sub_categories_too(): void
    {
        $all = $this->getJson('/api/v1/series?categories=animaux&count=100')->assertOk();
        $this->assertSame($this->catalogItems('animaux'), $all->json('distinct_items'));

        $one = $this->getJson('/api/v1/series?categories=ferme&count=10')->assertOk();
        $this->assertSame(['ferme'], collect($one->json('items'))->pluck('category.slug')->unique()->values()->all());

        // Parent masqué : ses sous-catégories aussi
        Category::where('slug', 'animaux')->update(['is_published' => false]);
        $this->getJson('/api/v1/series?categories=ferme&count=5')->assertJsonPath('count', 0);
        $this->assertSame(0, collect($this->getJson('/api/v1/series?count=100')->json('items'))->whereIn('category.slug', ['ferme', 'mer'])->count());
    }

    public function test_series_can_include_a_second_language(): void
    {
        $this->getJson('/api/v1/series?lang=fr&categories=fruits&count=100&translation=en')
            ->assertOk()
            ->assertJsonPath('items', fn ($items) => collect($items)->contains(fn ($i) => $i['name'] === 'une pomme' && $i['translation'] === 'an apple'));

        $this->getJson('/api/v1/series?lang=fr&count=1')->assertJsonMissingPath('items.0.translation');
    }

    public function test_series_validates_its_input(): void
    {
        $this->getJson('/api/v1/series?count=101')->assertStatus(422)->assertJsonValidationErrors('count');
        $this->getJson('/api/v1/series?categories=nope')->assertStatus(422)->assertJsonValidationErrors('categories.0');
    }
}
