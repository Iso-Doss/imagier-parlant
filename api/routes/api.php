<?php

use App\Http\Controllers\Api\V1;
use App\Http\Controllers\Api\V1\Account;
use App\Http\Controllers\Api\V1\Admin;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ---- Mobile app (public, read-only). Language: ?lang=fr or Accept-Language ----
    Route::middleware(['content.language', 'throttle:120,1'])->group(function () {
        Route::get('languages', [V1\LanguageController::class, 'index']);
        Route::get('categories', [V1\CategoryController::class, 'index']);
        Route::get('categories/{category:slug}', [V1\CategoryController::class, 'show']);
        Route::get('series', V1\SeriesController::class);
        Route::get('packs', [V1\PackController::class, 'index']);
        Route::get('packs/{category:slug}', [V1\PackController::class, 'show']);
    });

    // ---- Comptes parents (application mobile) ----
    Route::prefix('account')->middleware('content.language')->group(function () {
        Route::post('register', [Account\AuthController::class, 'register'])->middleware('throttle:register');
        Route::post('verify', [Account\AuthController::class, 'verify'])->middleware('throttle:codes');
        Route::post('verify/resend', [Account\AuthController::class, 'resend'])->middleware('throttle:codes');
        Route::post('login', [Account\AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('password/forgot', [Account\AuthController::class, 'forgotPassword'])->middleware('throttle:codes');
        Route::post('password/reset', [Account\AuthController::class, 'resetPassword'])->middleware('throttle:codes');
        Route::post('logout', [Account\AuthController::class, 'logout'])->middleware('auth:sanctum');
    });

    Route::prefix('me')->middleware(['auth:sanctum', 'content.language', 'throttle:120,1'])->group(function () {
        Route::get('/', [Account\MeController::class, 'show']);
        Route::patch('/', [Account\MeController::class, 'update']);
        Route::delete('/', [Account\MeController::class, 'destroy']);
        Route::get('export', [Account\MeController::class, 'export'])->middleware('throttle:5,60');
        Route::get('devices', [Account\MeController::class, 'devices']);
        Route::delete('devices/{id}', [Account\MeController::class, 'revokeDevice'])->whereNumber('id');

        Route::get('profiles', [Account\ProfileController::class, 'index']);
        Route::post('profiles', [Account\ProfileController::class, 'store']);
        Route::patch('profiles/{profile}', [Account\ProfileController::class, 'update'])->whereUuid('profile');
        Route::delete('profiles/{profile}', [Account\ProfileController::class, 'destroy'])->whereUuid('profile');
        Route::post('profiles/{profile}/sessions', [Account\SessionController::class, 'store'])->whereUuid('profile');
        Route::get('profiles/{profile}/progress', [Account\ProgressController::class, 'show'])->whereUuid('profile');
    });

    // ---- Admin sign-in (Sanctum personal access tokens) ----
    Route::post('auth/login', [V1\AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('auth/me', [V1\AuthController::class, 'me']);
        Route::post('auth/logout', [V1\AuthController::class, 'logout']);
    });

    // ---- Admin (shadcn + React back office) ----
    Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
        Route::get('stats', Admin\StatsController::class);

        Route::apiResource('languages', Admin\LanguageController::class);

        Route::post('categories/reorder', [Admin\CategoryController::class, 'reorder']);
        Route::get('categories', [Admin\CategoryController::class, 'index']);
        Route::post('categories', [Admin\CategoryController::class, 'store']);
        Route::get('categories/{category:id}', [Admin\CategoryController::class, 'show']);
        Route::match(['put', 'patch'], 'categories/{category:id}', [Admin\CategoryController::class, 'update']);
        Route::delete('categories/{category:id}', [Admin\CategoryController::class, 'destroy']);
        Route::post('categories/{category:id}/image', [Admin\CategoryController::class, 'uploadImage']);
        Route::delete('categories/{category:id}/image', [Admin\CategoryController::class, 'deleteImage']);

        Route::apiResource('items', Admin\ItemController::class);
        Route::post('items/{item}/image', [Admin\ItemController::class, 'uploadImage']);
        Route::delete('items/{item}/image', [Admin\ItemController::class, 'deleteImage']);
        Route::post('items/{item}/audio/{locale}', [Admin\ItemController::class, 'uploadAudio']);
        Route::delete('items/{item}/audio/{locale}', [Admin\ItemController::class, 'deleteAudio']);
    });
});
