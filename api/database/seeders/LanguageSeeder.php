<?php

namespace Database\Seeders;

use App\Models\Language;
use Illuminate\Database\Seeder;

class LanguageSeeder extends Seeder
{
    public function run(): void
    {
        $languages = [
            ['code' => 'fr', 'name' => 'Français', 'tts_locale' => 'fr-FR', 'question' => "Qu'est-ce que c'est ?", 'answer_template' => "C'est :name", 'sort_order' => 0],
            ['code' => 'en', 'name' => 'English', 'tts_locale' => 'en-US', 'question' => 'What is this?', 'answer_template' => "It's :name", 'sort_order' => 1],
        ];

        foreach ($languages as $language) {
            Language::updateOrCreate(['code' => $language['code']], $language);
        }
    }
}
