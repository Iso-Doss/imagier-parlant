<?php

namespace Tests\Feature;

use App\Models\ChildProfile;
use App\Models\Item;
use App\Models\User;
use App\Notifications\AccountCodeNotification;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\LanguageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([LanguageSeeder::class, CatalogSeeder::class]);
        Notification::fake();
        $this->withHeader('Accept-Language', 'fr');
    }

    private function sentCode(string $email): string
    {
        $code = null;
        Notification::assertSentTo(User::where('email', $email)->first(), AccountCodeNotification::class,
            function (AccountCodeNotification $n) use (&$code) {
                $code = $n->code;

                return true;
            });

        return $code;
    }

    private function parent(): User
    {
        $user = User::factory()->create(['is_admin' => false]);
        Sanctum::actingAs($user, ['account']);

        return $user;
    }

    public function test_un_parent_s_inscrit_confirme_son_e_mail_et_recoit_un_jeton(): void
    {
        $this->postJson('/api/v1/account/register', ['email' => 'parent@test.local', 'password' => 'un-bon-mot-de-passe', 'accept_terms' => true])
            ->assertCreated();
        $code = $this->sentCode('parent@test.local');

        // Avant confirmation : pas de connexion
        $this->postJson('/api/v1/account/login', ['email' => 'parent@test.local', 'password' => 'un-bon-mot-de-passe', 'device_name' => 'iPhone'])
            ->assertForbidden()->assertJsonPath('reason', 'email_not_verified');

        $this->postJson('/api/v1/account/verify', ['email' => 'parent@test.local', 'code' => $code === '000000' ? '111111' : '000000', 'device_name' => 'iPhone'])
            ->assertUnprocessable()->assertJsonValidationErrors('code');

        $code = $this->sentCode('parent@test.local'); // le login a renvoyé un nouveau code
        $token = $this->postJson('/api/v1/account/verify', ['email' => 'parent@test.local', 'code' => $code, 'device_name' => 'iPhone'])
            ->assertCreated()->assertJsonPath('user.email_verified', true)->json('token');

        $this->withToken($token)->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.email', 'parent@test.local');

        // Un compte parent n'ouvre pas l'administration
        $this->withToken($token)->getJson('/api/v1/admin/stats')->assertForbidden();
    }

    public function test_l_inscription_refuse_un_mot_de_passe_court_et_les_conditions_non_acceptees(): void
    {
        $this->postJson('/api/v1/account/register', ['email' => 'parent@test.local', 'password' => 'court'])
            ->assertUnprocessable()->assertJsonValidationErrors(['password', 'accept_terms']);
    }

    public function test_un_code_ne_tient_que_cinq_essais(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class); // on teste la limite du code, pas celle du débit
        $this->postJson('/api/v1/account/register', ['email' => 'p@test.local', 'password' => 'un-bon-mot-de-passe', 'accept_terms' => true]);
        $code = $this->sentCode('p@test.local');
        $wrong = $code === '123456' ? '654321' : '123456';

        foreach (range(1, 5) as $i) {
            $this->postJson('/api/v1/account/verify', ['email' => 'p@test.local', 'code' => $wrong, 'device_name' => 'x']);
        }
        $this->postJson('/api/v1/account/verify', ['email' => 'p@test.local', 'code' => $code, 'device_name' => 'x'])
            ->assertUnprocessable();
    }

    public function test_mot_de_passe_oublie_deconnecte_les_autres_appareils(): void
    {
        $user = User::factory()->create(['email' => 'p@test.local']);
        $old = $user->createToken('vieux téléphone')->plainTextToken;

        $this->postJson('/api/v1/account/password/forgot', ['email' => 'p@test.local'])->assertStatus(202);
        $this->postJson('/api/v1/account/password/forgot', ['email' => 'inconnu@test.local'])->assertStatus(202);

        $token = $this->postJson('/api/v1/account/password/reset', [
            'email' => 'p@test.local', 'code' => $this->sentCode('p@test.local'),
            'password' => 'nouveau-mot-de-passe', 'device_name' => 'iPad',
        ])->assertOk()->json('token');

        $this->assertNotNull($token);
        $this->assertSame(1, $user->tokens()->count());
        $this->postJson('/api/v1/account/login', ['email' => 'p@test.local', 'password' => 'nouveau-mot-de-passe', 'device_name' => 'x'])->assertOk();
        $this->assertNotSame($old, $token);
    }

    public function test_profils_limites_a_six_et_invisibles_pour_un_autre_compte(): void
    {
        $this->parent();
        $id = $this->postJson('/api/v1/me/profiles', ['nickname' => 'Léo', 'avatar' => 'ours', 'age_band' => '4-5'])
            ->assertCreated()->json('data.id');

        $this->postJson('/api/v1/me/profiles', ['nickname' => 'X', 'avatar' => 'dragon', 'age_band' => '9-10'])
            ->assertUnprocessable()->assertJsonValidationErrors(['avatar', 'age_band']);

        foreach (range(2, 6) as $i) {
            $this->postJson('/api/v1/me/profiles', ['nickname' => "Enfant $i", 'avatar' => 'chat', 'age_band' => '2-3'])->assertCreated();
        }
        $this->postJson('/api/v1/me/profiles', ['nickname' => 'Septième', 'avatar' => 'chat', 'age_band' => '2-3'])
            ->assertUnprocessable()->assertJsonPath('errors.nickname.0', 'Un compte peut avoir jusqu\'à 6 profils.');

        $this->patchJson("/api/v1/me/profiles/$id", ['avatar' => 'licorne'])->assertOk()->assertJsonPath('data.avatar', 'licorne');

        // Autre parent : le profil n'existe pas pour lui
        $this->parent();
        $this->patchJson("/api/v1/me/profiles/$id", ['nickname' => 'Pirate'])->assertNotFound();
        $this->getJson("/api/v1/me/profiles/$id/progress")->assertNotFound();
    }

    public function test_une_serie_jouee_met_a_jour_les_progres_une_seule_fois(): void
    {
        $user = $this->parent();
        $profile = $user->profiles()->create(['nickname' => 'Léo', 'avatar' => 'ours', 'age_band' => '4-5']);
        [$a, $b] = Item::take(2)->pluck('id')->all();

        $payload = [
            'id' => (string) Str::uuid(), 'locale' => 'fr', 'mode' => 'voice', 'categories' => ['fruits'],
            'started_at' => now()->subMinutes(4)->toIso8601String(), 'ended_at' => now()->toIso8601String(),
            'answers' => [
                ['item_id' => $a, 'result' => 'correct', 'response_ms' => 1800],
                ['item_id' => $b, 'result' => 'wrong'],
                ['item_id' => 999999, 'result' => 'correct'], // objet supprimé : ignoré
            ],
        ];

        $this->postJson("/api/v1/me/profiles/{$profile->id}/sessions", $payload)->assertCreated()->assertJsonPath('data.answers', 2);
        $this->postJson("/api/v1/me/profiles/{$profile->id}/sessions", $payload)->assertOk(); // renvoyée : pas de doublon

        $this->assertSame(1, $profile->sessions()->count());
        $this->assertSame(2, $profile->progress()->where('item_id', $a)->value('box'));
        $this->assertSame(1, $profile->progress()->where('item_id', $b)->value('box'));

        $this->getJson("/api/v1/me/profiles/{$profile->id}/progress?lang=fr")->assertOk()
            ->assertJsonPath('data.seen', 2)
            ->assertJsonPath('data.week.sessions', 1)
            ->assertJsonPath('data.week.minutes', 4)
            ->assertJsonPath('data.to_review.0.id', $b);
    }

    public function test_les_objets_a_revoir_reviennent_dans_la_serie(): void
    {
        $user = $this->parent();
        $profile = $user->profiles()->create(['nickname' => 'Léo', 'avatar' => 'ours', 'age_band' => '4-5']);
        $missed = Item::whereHas('category', fn ($q) => $q->where('slug', 'fruits'))->first();
        $profile->progress()->create(['item_id' => $missed->id, 'box' => 1, 'wrong_count' => 1, 'next_due_at' => now()->subDay()]);

        $series = $this->getJson("/api/v1/series?categories=fruits&count=10&profile={$profile->id}")
            ->assertOk()->assertJsonPath('review_items', 1)->json('items');

        $this->assertCount(10, $series);
        $this->assertContains($missed->id, array_column($series, 'id'));
    }

    public function test_suppression_du_compte_et_export(): void
    {
        $user = $this->parent();
        $user->update(['password' => 'mot-de-passe-actuel']);
        $user->profiles()->create(['nickname' => 'Léo', 'avatar' => 'ours', 'age_band' => '4-5']);

        $this->getJson('/api/v1/me/export')->assertOk()->assertJsonPath('profiles.0.nickname', 'Léo');

        $this->deleteJson('/api/v1/me', ['password' => 'faux'])->assertUnprocessable();
        $this->deleteJson('/api/v1/me', ['password' => 'mot-de-passe-actuel'])->assertNoContent();

        $this->assertModelMissing($user);
        $this->assertSame(0, ChildProfile::count());
    }
}
