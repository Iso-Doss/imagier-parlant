<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Item;
use App\Models\User;
use Database\Seeders\LanguageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminItemAliasesTest extends TestCase
{
    use RefreshDatabase;

    private function item(): Item
    {
        $this->seed(LanguageSeeder::class);
        $category = Category::create(['slug' => 'transports', 'is_published' => true]);
        $category->syncTranslations(['fr' => ['name' => 'Transports']]);
        $item = Item::create(['category_id' => $category->id, 'emoji' => '🚗', 'is_published' => true]);
        $item->syncTranslations(['fr' => ['name' => 'une voiture']]);

        return $item;
    }

    public function test_l_admin_enregistre_des_variantes_nettoyees(): void
    {
        $item = $this->item();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $this->patchJson("/api/v1/admin/items/{$item->id}", [
            'translations' => ['fr' => ['name' => 'une voiture', 'aliases' => [' une auto ', '', 'une auto', 'une bagnole']]],
        ])->assertOk()->assertJsonPath('data.translations.fr.aliases', ['une auto', 'une bagnole']);

        $this->patchJson("/api/v1/admin/items/{$item->id}", [
            'translations' => ['fr' => ['name' => 'une voiture', 'aliases' => []]],
        ])->assertOk()->assertJsonPath('data.translations.fr.aliases', []);
    }

    public function test_il_refuse_trop_de_variantes(): void
    {
        $item = $this->item();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $this->patchJson("/api/v1/admin/items/{$item->id}", [
            'translations' => ['fr' => ['name' => 'une voiture', 'aliases' => array_map(fn ($i) => "auto $i", range(1, 11))]],
        ])->assertUnprocessable()->assertJsonValidationErrors('translations.fr.aliases');
    }

    public function test_les_series_renvoient_les_variantes(): void
    {
        $item = $this->item();
        $item->translations()->where('locale', 'fr')->first()->update(['aliases' => ['une auto']]);

        $this->getJson('/api/v1/series?count=1&lang=fr')
            ->assertOk()
            ->assertJsonPath('items.0.name', 'une voiture')
            ->assertJsonPath('items.0.aliases', ['une auto']);
    }
}
