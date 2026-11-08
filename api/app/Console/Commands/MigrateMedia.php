<?php

namespace App\Console\Commands;

use App\Jobs\MigrateItemMedia;
use App\Models\Category;
use App\Models\Item;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('media:migrate {--from=public : Disque où se trouvent les anciens fichiers} {--sync : Traiter tout de suite au lieu de passer par la file « media »}')]
#[Description('Transfère les images et les sons existants vers le disque des médias (empreinte + WebP)')]
class MigrateMedia extends Command
{
    public function handle(): int
    {
        $from = (string) $this->option('from');
        $count = 0;

        $dispatch = function (string $model, int $id) use ($from, &$count) {
            $job = new MigrateItemMedia($model, $id, $from);
            $this->option('sync') ? dispatch_sync($job) : dispatch($job);
            $count++;
        };

        Category::query()->whereNotNull('image_path')->whereNull('image_variants')->pluck('id')
            ->each(fn ($id) => $dispatch('category', $id));

        Item::query()
            ->where(fn ($q) => $q->whereNotNull('image_path')->whereNull('image_variants'))
            ->orWhereHas('translations', fn ($q) => $q->whereNotNull('audio_path')->where('audio_path', 'not like', 'items/%'))
            ->select('id')->chunkById(500, function ($items) use ($dispatch) {
                $items->each(fn ($item) => $dispatch('item', $item->id));
            });

        $this->components->info($this->option('sync')
            ? "$count fiche(s) traitée(s) vers le disque « ".config('media.disk').' ».'
            : "$count tâche(s) envoyée(s) dans la file « media ».");

        return self::SUCCESS;
    }
}
