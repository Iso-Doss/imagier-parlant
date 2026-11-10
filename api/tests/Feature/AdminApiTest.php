<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Item;
use App\Models\User;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\LanguageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([LanguageSeeder::class, CatalogSeeder::class]);
        Storage::fake('public');
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create(['is_admin' => true]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    public function test_admin_can_log_in_and_out(): void
    {
        User::factory()->create(['email' => 'boss@test.local', 'password' => 'secret-pass', 'is_admin' => true]);

        $token = $this->postJson('/api/v1/auth/login', ['email' => 'boss@test.local', 'password' => 'secret-pass'])
            ->assertOk()->assertJsonPath('user.is_admin', true)->json('token');

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertJsonPath('user.email', 'boss@test.local');
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_wrong_password_and_non_admins_are_refused(): void
    {
        User::factory()->create(['email' => 'kid@test.local', 'password' => 'secret-pass', 'is_admin' => false]);

        $this->postJson('/api/v1/auth/login', ['email' => 'kid@test.local', 'password' => 'wrong'])->assertStatus(422);
        $this->postJson('/api/v1/auth/login', ['email' => 'kid@test.local', 'password' => 'secret-pass'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', "Ce compte ne peut pas ouvrir l'administration.");
    }

    public function test_admin_routes_need_an_admin_token(): void
    {
        $this->getJson('/api/v1/admin/items')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));
        $this->getJson('/api/v1/admin/items')->assertForbidden();
    }

    public function test_admin_creates_a_category_with_translations(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/categories', [
            'slug' => 'couleurs', 'emoji' => '🎨', 'color' => '#FFE1D9',
            'translations' => ['fr' => ['name' => 'Couleurs'], 'en' => ['name' => 'Colours']],
        ])->assertCreated()
            ->assertJsonPath('data.translations.en.name', 'Colours')
            ->assertJsonPath('data.sort_order', $this->catalogCategories());

        $this->postJson('/api/v1/admin/categories', [
            'slug' => 'couleurs', 'translations' => ['xx' => ['name' => 'X'], 'fr' => []],
        ])->assertStatus(422)->assertJsonValidationErrors(['slug', 'translations.xx', 'translations.fr.name']);
    }

    public function test_admin_creates_updates_and_filters_items(): void
    {
        $this->actingAsAdmin();
        $fruits = Category::where('slug', 'fruits')->first();

        $id = $this->postJson('/api/v1/admin/items', [
            'category_id' => $fruits->id, 'emoji' => '🫐',
            'translations' => ['fr' => ['name' => 'des groseilles', 'sentence' => 'Ce sont des groseilles'], 'en' => ['name' => 'blueberries']],
        ])->assertCreated()->json('data.id');

        $this->patchJson("/api/v1/admin/items/$id", ['translations' => ['en' => null], 'is_published' => false])
            ->assertOk()
            ->assertJsonPath('data.is_published', false)
            ->assertJsonMissingPath('data.translations.en');

        $this->getJson('/api/v1/admin/items?search=groseilles')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/admin/items?missing=translation')->assertJsonPath('meta.total', 1);
        $this->getJson("/api/v1/admin/items?category_id={$fruits->id}&per_page=100")->assertJsonPath('meta.total', $this->catalogItems('fruits') + 1);
    }

    public function test_admin_uploads_images_and_audio_and_files_are_removed_on_delete(): void
    {
        $this->actingAsAdmin();
        $item = Item::first();

        $image = $this->post("/api/v1/admin/items/{$item->id}/image", ['image' => UploadedFile::fake()->image('pomme.jpg')], ['Accept' => 'application/json'])
            ->assertOk()->json('data.image_url');
        $this->assertNotNull($image);

        $this->post("/api/v1/admin/items/{$item->id}/audio/fr", ['audio' => UploadedFile::fake()->create('pomme.mp3', 40, 'audio/mpeg')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.translations.fr.audio_url', fn ($url) => str_contains($url, '/audio/fr/'));

        $item->refresh()->load('translations');
        $this->assertSame(['card', 'full', 'thumb'], collect($item->image_variants)->keys()->sort()->values()->all());
        $this->assertStringEndsWith('-full.webp', $item->image_path);
        $this->assertStringStartsWith("items/{$item->id}/audio/fr/", $item->translation('fr')->audio_path);
        $paths = [...array_values($item->image_variants), $item->translation('fr')->audio_path];
        Storage::disk('public')->assertExists($paths);

        // The public API now serves the recording
        $this->getJson('/api/v1/categories/fruits?lang=fr')->assertJsonPath('data.items.0.audio_url', fn ($url) => $url !== null);

        $this->deleteJson("/api/v1/admin/items/{$item->id}")->assertNoContent();
        Storage::disk('public')->assertMissing($paths);
    }

    public function test_a_file_that_is_not_an_image_is_refused(): void
    {
        $this->actingAsAdmin();
        $item = Item::first();

        $fake = UploadedFile::fake()->createWithContent('pomme.jpg', '<?php echo "pas une image";');
        $this->post("/api/v1/admin/items/{$item->id}/image", ['image' => $fake], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('image');
    }

    public function test_audio_needs_an_existing_translation(): void
    {
        $this->actingAsAdmin();
        $item = Item::first();

        $this->post("/api/v1/admin/items/{$item->id}/audio/de", ['audio' => UploadedFile::fake()->create('x.mp3', 10, 'audio/mpeg')], ['Accept' => 'application/json'])
            ->assertNotFound();
    }

    public function test_deleting_a_category_removes_its_items(): void
    {
        $this->actingAsAdmin();
        $category = Category::where('slug', 'fruits')->first();

        $this->deleteJson("/api/v1/admin/categories/{$category->id}")->assertNoContent();
        $this->assertDatabaseMissing('items', ['category_id' => $category->id]);
        $this->assertSame($this->catalogItems() - $this->catalogItems('fruits'), Item::count());
    }

    public function test_categories_can_be_reordered(): void
    {
        $this->actingAsAdmin();
        $ids = Category::orderBy('sort_order')->pluck('id')->reverse()->values()->all();

        $this->postJson('/api/v1/admin/categories/reorder', ['ids' => $ids])
            ->assertOk()->assertJsonPath('data.0.slug', collect($this->catalog()['categories'])->last()['slug']);
    }

    public function test_languages_can_be_added_but_not_deleted_while_in_use(): void
    {
        $this->actingAsAdmin();

        $wo = $this->postJson('/api/v1/admin/languages', [
            'code' => 'wo', 'name' => 'Wolof', 'tts_locale' => 'wo-SN', 'question' => 'Lii lan la?', 'answer_template' => ':name la',
        ])->assertCreated()->json('data.id');

        $this->getJson('/api/v1/admin/stats')->assertJsonPath('languages.2.missing_translations', $this->catalogItems());

        $fr = $this->getJson('/api/v1/admin/languages')->json('data.0.id');
        $this->deleteJson("/api/v1/admin/languages/$fr")->assertStatus(409);
        $this->deleteJson("/api/v1/admin/languages/$wo")->assertNoContent();

        $this->postJson('/api/v1/admin/languages', [
            'code' => 'de', 'name' => 'Deutsch', 'tts_locale' => 'de-DE', 'question' => 'Was ist das?', 'answer_template' => 'Das ist',
        ])->assertStatus(422)->assertJsonValidationErrors('answer_template');
    }
}
