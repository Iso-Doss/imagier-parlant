<?php

namespace App\Jobs;

use App\Models\Category;
use App\Models\Item;
use App\Services\MediaStore;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;

/**
 * Transfère les médias d'un objet (ou d'une catégorie) de l'ancien rangement
 * (dossier public, noms aléatoires) vers le disque des médias avec empreinte
 * et tailles WebP. Rejouable sans risque : ce qui est déjà transféré est ignoré.
 */
class MigrateItemMedia implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public string $model, public int $id, public string $from = 'public')
    {
        $this->onQueue('media');
    }

    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(MediaStore $media): void
    {
        $record = ($this->model === 'category' ? Category::class : Item::class)::find($this->id);
        if (! $record) {
            return;
        }
        $source = Storage::disk($this->from);

        if ($record->image_path && ! $record->image_variants && $source->exists($record->image_path)) {
            $old = $record->image_path;
            $record->replaceImage($source->get($old));
            if ($this->from !== config('media.disk')) {
                $source->delete($old);
            }
        }

        if ($record instanceof Item) {
            foreach ($record->translations()->whereNotNull('audio_path')->get() as $translation) {
                $old = $translation->audio_path;
                if (str_starts_with($old, "items/{$record->id}/audio/") || ! $source->exists($old)) {
                    continue;
                }
                $path = $media->putAudio($source->get($old), pathinfo($old, PATHINFO_EXTENSION) ?: 'mp3', "items/{$record->id}/audio/{$translation->locale}");
                $translation->update(['audio_path' => $path]);
                if ($path !== $old) {
                    $source->delete($old);
                }
            }
        }
    }
}
