<?php

namespace Tests\Feature;

use App\Models\Item;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\LanguageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_old_files_move_to_the_media_disk_with_webp_sizes(): void
    {
        $this->seed([LanguageSeeder::class, CatalogSeeder::class]);
        Storage::fake('public');
        Storage::fake('s3');
        config(['media.disk' => 's3']);

        $item = Item::first();
        $legacy = Storage::disk('public');
        $legacy->put('items/ancienne.jpg', UploadedFile::fake()->image('a.jpg', 1200, 900)->get());
        $legacy->put('audio/fr/ancien.mp3', 'ID3');
        $item->update(['image_path' => 'items/ancienne.jpg']);
        $item->translations()->where('locale', 'fr')->update(['audio_path' => 'audio/fr/ancien.mp3']);

        $this->artisan('media:migrate', ['--sync' => true])->assertSuccessful();

        $item->refresh();
        Storage::disk('s3')->assertExists(array_values($item->image_variants));
        Storage::disk('s3')->assertExists($item->translation('fr')->audio_path);
        $legacy->assertMissing(['items/ancienne.jpg', 'audio/fr/ancien.mp3']);

        // Une seconde passe ne refait rien
        $this->artisan('media:migrate', ['--sync' => true])->expectsOutputToContain('0 fiche')->assertSuccessful();
    }
}
