<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\AccountCodeNotification;
use Illuminate\Support\Facades\Hash;

/**
 * Codes à 6 chiffres envoyés par e-mail : vérification de l'adresse et
 * mot de passe oublié. Valables 15 minutes, 5 essais au maximum, gardés hachés.
 */
class AccountCodes
{
    public const TTL_MINUTES = 15;

    public const MAX_ATTEMPTS = 5;

    public function send(User $user, string $purpose): void
    {
        $code = str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT);

        $user->accountCodes()->where('purpose', $purpose)->delete();
        $user->accountCodes()->create([
            'purpose' => $purpose,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(self::TTL_MINUTES),
        ]);

        $user->notify(new AccountCodeNotification($code, $purpose));
    }

    /** Vrai si le code est bon ; il est alors consommé. */
    public function check(User $user, string $purpose, string $code): bool
    {
        $record = $user->accountCodes()->where('purpose', $purpose)->latest('id')->first();

        if (! $record || $record->expires_at->isPast() || $record->attempts >= self::MAX_ATTEMPTS) {
            return false;
        }

        if (! Hash::check($code, $record->code_hash)) {
            $record->increment('attempts');

            return false;
        }

        $record->delete();

        return true;
    }
}
