<?php

namespace App\Models\Concerns;

use App\Services\MediaStore;

/**
 * Image en plusieurs tailles : image_path (grande) et image_variants
 * (['full' => …, 'card' => …, 'thumb' => …]).
 *
 * @property string|null $image_path
 * @property array<string, string>|null $image_variants
 */
trait HasImage
{
    /** URL d'une taille ; retombe sur la grande image pour les anciens fichiers. */
    public function imageUrl(string $size = 'full'): ?string
    {
        return app(MediaStore::class)->url($this->image_variants[$size] ?? $this->image_path);
    }

    /** @return array<int, string> */
    public function imageFiles(): array
    {
        return array_values(array_unique(array_filter([$this->image_path, ...array_values($this->image_variants ?? [])])));
    }

    public function replaceImage(string $binary): void
    {
        $store = app(MediaStore::class);
        $old = $this->imageFiles();
        $paths = $store->putImage($binary, $this->imageDirectory());

        $this->update(['image_path' => $paths['full'], 'image_variants' => $paths]);
        // Ancien fichier supprimé seulement s'il n'est pas identique au nouveau
        $store->delete(array_diff($old, $paths));
    }

    public function removeImage(): void
    {
        app(MediaStore::class)->delete($this->imageFiles());
        $this->update(['image_path' => null, 'image_variants' => null]);
    }

    abstract protected function imageDirectory(): string;
}
