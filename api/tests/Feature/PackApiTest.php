<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Item;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\LanguageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PackApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([LanguageSeeder::class, CatalogSeeder::class]);
    }

    public function test_it_lists_one_pack_per_published_category(): void
    {
        $response = $this->getJson('/api/v1/packs?lang=en')->assertOk()->assertJsonCount($this->catalogCategories(), 'data');

        $fruits = collect($response->json('data'))->firstWhere('slug', 'fruits');
        $this->assertSame('Fruits', $fruits['name']);
        $this->assertSame($this->catalogItems('fruits'), $fruits['items_count']);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{12}$/', $fruits['version']);
        $this->assertIsInt($fruits['size']);
    }

    public function test_a_pack_holds_every_language(): void
    {
        $this->getJson('/api/v1/packs/fruits')
            ->assertOk()
            ->assertJsonPath('slug', 'fruits')
            ->assertJsonPath('category.names.fr', 'Fruits')
            ->assertJsonPath('languages.0.code', 'fr')
            ->assertJsonPath('languages.1.code', 'en')
            ->assertJsonCount($this->catalogItems('fruits'), 'items')
            ->assertJsonPath('items.0.texts.fr.name', 'une pomme')
            ->assertJsonPath('items.0.texts.fr.sentence', "C'est une pomme")
            ->assertJsonPath('items.0.texts.en.sentence', "It's an apple");
    }

    public function test_the_version_changes_with_the_content(): void
    {
        $before = $this->getJson('/api/v1/packs/fruits')->json('version');
        $this->assertSame($before, $this->getJson('/api/v1/packs/fruits')->json('version'));

        $this->travel(2)->seconds();
        $item = Item::whereHas('category', fn ($q) => $q->where('slug', 'fruits'))->orderBy('sort_order')->first();
        $item->translations()->where('locale', 'fr')->update(['name' => 'une pomme rouge', 'updated_at' => now()]);

        $after = $this->getJson('/api/v1/packs/fruits')->assertJsonPath('items.0.texts.fr.name', 'une pomme rouge')->json('version');
        $this->assertNotSame($before, $after);
    }

    public function test_unpublished_items_and_categories_stay_out(): void
    {
        $category = Category::where('slug', 'fruits')->first();
        $category->items()->first()->update(['is_published' => false]);
        $this->getJson('/api/v1/packs/fruits')->assertJsonCount($this->catalogItems('fruits') - 1, 'items');

        $category->update(['is_published' => false]);
        $this->getJson('/api/v1/packs/fruits')->assertNotFound();
        $this->getJson('/api/v1/packs')->assertJsonCount($this->catalogCategories() - 1, 'data');
    }
}
