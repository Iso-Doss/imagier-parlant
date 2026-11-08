<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([LanguageSeeder::class, CatalogSeeder::class]);

        // Compte d'administration : ADMIN_EMAIL / ADMIN_PASSWORD dans .env
        $email = config('admin.email');
        $password = config('admin.password');
        $exists = User::where('email', $email)->exists();

        if (! $password && $exists) {
            return; // compte déjà créé : on ne change pas son mot de passe
        }
        if (! $password) {
            $password = Str::password(20, symbols: false);
            $this->command?->warn("Compte admin créé : $email / $password (notez-le, il ne sera plus affiché)");
        }

        User::updateOrCreate(['email' => $email], ['name' => 'Admin', 'password' => $password, 'is_admin' => true]);
    }
}
