<?php

return [

    /*
    | Disque où sont rangés les images et les sons : « public » (dossier
    | storage/app/public, développement) ou « s3 » (S3 / R2 / SeaweedFS + CDN).
    */
    'disk' => env('MEDIA_DISK', 'public'),

    // Les noms de fichiers contiennent l'empreinte du contenu : un fichier ne change
    // jamais à la même adresse, le CDN peut donc le garder un an.
    'cache_control' => 'public, max-age=31536000, immutable',

    // Largeur maximale de chaque taille d'image (WebP)
    'image_sizes' => [
        'full' => 768,
        'card' => 320,
        'thumb' => 96,
    ],

    'webp_quality' => 82,

];
