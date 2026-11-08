<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([LanguageSeeder::class, CatalogSeeder::class]);

        // Admin account for the back office. Set ADMIN_EMAIL / ADMIN_PASSWORD in .env.
        User::updateOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@imagier.test')],
            ['name' => 'Admin', 'password' => env('ADMIN_PASSWORD', 'change-me-please'), 'is_admin' => true],
        );
    }
}
