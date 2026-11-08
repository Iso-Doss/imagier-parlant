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
            ['email' => config('admin.email')],
            ['name' => 'Admin', 'password' => config('admin.password'), 'is_admin' => true],
        );
    }
}
