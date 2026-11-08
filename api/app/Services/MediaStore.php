<?php

namespace App\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Exceptions\ImageDecoderException;
use Intervention\Image\Format;
use Intervention\Image\ImageManager;

/**
 * Range les images et les sons sur le disque des médias.
 *
 * Chaque fichier est nommé d'après l'empreinte de son contenu
 * (ex. items/12/image/3f9a…-card.webp), ce qui permet un cache CDN d'un an.
 */
class MediaStore
{
    public function disk(): Filesystem
    {
        return Storage::disk(config('media.disk'));
    }

    /**
     * Réencode une image en WebP dans chaque taille. Le réencodage retire
     * aussi les métadonnées (EXIF, GPS) et tout contenu caché.
     *
     * @return array<string, string> taille => chemin, ex. ['full' => '…', 'card' => '…', 'thumb' => '…']
     */
    public function putImage(string $binary, string $directory): array
    {
        $hash = substr(hash('sha256', $binary), 0, 16);
        try {
            $image = ImageManager::usingDriver(GdDriver::class)->decodeBinary($binary)->orient();
        } catch (ImageDecoderException) {
            throw ValidationException::withMessages(['image' => __('This file is not a readable image (JPEG, PNG or WebP).')]);
        }

        $paths = [];
        // Du plus grand au plus petit : chaque réduction part de la précédente
        foreach (collect(config('media.image_sizes'))->sortDesc() as $size => $width) {
            $image->scaleDown(width: $width, height: $width);
            $encoded = $image->encodeUsingFormat(Format::WEBP, quality: config('media.webp_quality'), strip: true);
            $path = "$directory/$hash-$size.webp";
            $this->put($path, $encoded->toString(), 'image/webp');
            $paths[$size] = $path;
        }

        return $paths;
    }

    public function putAudio(string $binary, string $extension, string $directory): string
    {
        $hash = substr(hash('sha256', $binary), 0, 16);
        $path = "$directory/$hash.".strtolower($extension);
        $this->put($path, $binary, self::audioMime($extension));

        return $path;
    }

    public function url(?string $path): ?string
    {
        return $path ? $this->disk()->url($path) : null;
    }

    /** @param  array<int, string|null>|string|null  $paths */
    public function delete(array|string|null $paths): void
    {
        $paths = array_values(array_filter((array) $paths));
        if ($paths) {
            $this->disk()->delete($paths);
        }
    }

    private function put(string $path, string $contents, string $mime): void
    {
        $this->disk()->put($path, $contents, [
            'visibility' => 'public',
            'CacheControl' => config('media.cache_control'),
            'ContentType' => $mime,
        ]);
    }

    private static function audioMime(string $extension): string
    {
        return match (strtolower($extension)) {
            'mp3', 'mpga' => 'audio/mpeg',
            'm4a', 'mp4', 'aac' => 'audio/mp4',
            'wav' => 'audio/wav',
            'ogg', 'oga' => 'audio/ogg',
            'webm' => 'audio/webm',
            default => 'application/octet-stream',
        };
    }
}
