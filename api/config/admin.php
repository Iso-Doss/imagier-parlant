<?php

// Compte d'administration créé par le seeder. Sans mot de passe dans .env,
// le seeder en tire un au hasard et l'affiche une seule fois.
return [
    'email' => env('ADMIN_EMAIL', 'admin@imagier.test'),
    'password' => env('ADMIN_PASSWORD'),
];
