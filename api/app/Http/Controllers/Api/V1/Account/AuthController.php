<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\Account\UserResource;
use App\Models\AccountCode;
use App\Models\User;
use App\Services\AccountCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * Comptes parents : inscription avec code e-mail, connexion, mot de passe oublié.
 * Les réponses ne révèlent jamais si une adresse a un compte, sauf à l'inscription.
 */
class AuthController extends Controller
{
    public function __construct(private AccountCodes $codes) {}

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'password' => ['required', 'string', Password::defaults()],
            'locale' => ['sometimes', 'string', Rule::exists('languages', 'code')],
            'accept_terms' => ['accepted'],
        ]);

        $user = User::where('email', $data['email'])->first();
        if ($user?->email_verified_at) {
            throw ValidationException::withMessages(['email' => __('This email already has an account. Sign in instead?')]);
        }

        // Inscription recommencée avant la vérification : on met à jour et on renvoie un code
        $user ??= new User(['email' => $data['email']]);
        $user->fill([
            'password' => $data['password'],
            'locale' => $data['locale'] ?? app()->getLocale(),
            'terms_accepted_at' => now(),
        ])->save();

        $this->codes->send($user, AccountCode::VERIFY);

        return response()->json(['message' => __('We sent you a 6-digit code by email.')], 201);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'digits:6'],
            'device_name' => ['required', 'string', 'max:100'],
        ]);

        $user = User::where('email', $data['email'])->whereNull('email_verified_at')->first();
        if (! $user || ! $this->codes->check($user, AccountCode::VERIFY, $data['code'])) {
            throw ValidationException::withMessages(['code' => __('This code is wrong or has expired.')]);
        }

        $user->forceFill(['email_verified_at' => now()])->save();

        return $this->tokenResponse($user, $data['device_name'], 201);
    }

    public function resend(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $data['email'])->whereNull('email_verified_at')->first();
        if ($user) {
            $this->codes->send($user, AccountCode::VERIFY);
        }

        return response()->json(['message' => __('If this address is waiting for confirmation, a new code is on its way.')], 202);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['required', 'string', 'max:100'],
        ]);

        $user = User::where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        if (! $user->email_verified_at) {
            $this->codes->send($user, AccountCode::VERIFY);

            return response()->json([
                'message' => __('Confirm your email first: we sent you a new code.'),
                'reason' => 'email_not_verified',
            ], 403);
        }

        return $this->tokenResponse($user, $data['device_name']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $data['email'])->whereNotNull('email_verified_at')->first();
        if ($user) {
            $this->codes->send($user, AccountCode::RESET);
        }

        return response()->json(['message' => __('If this address has an account, a code is on its way.')], 202);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'string', Password::defaults()],
            'device_name' => ['required', 'string', 'max:100'],
        ]);

        $user = User::where('email', $data['email'])->first();
        if (! $user || ! $this->codes->check($user, AccountCode::RESET, $data['code'])) {
            throw ValidationException::withMessages(['code' => __('This code is wrong or has expired.')]);
        }

        // Nouveau mot de passe : tous les appareils sont déconnectés
        $user->forceFill(['password' => $data['password']])->save();
        $user->tokens()->delete();

        return $this->tokenResponse($user, $data['device_name']);
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    private function tokenResponse(User $user, string $device, int $status = 200): JsonResponse
    {
        $token = $user->createToken($device, ['account'], now()->addDays(90))->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user->load('profiles')),
        ], $status);
    }
}
