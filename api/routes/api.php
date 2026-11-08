<?php

use App\Http\Controllers\Api\V1;
use App\Http\Controllers\Api\V1\Admin;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ---- Mobile app (public, read-only). Language: ?lang=fr or Accept-Language ----
    Route::middleware(['content.language', 'throttle:120,1'])->group(function () {
        Route::get('languages', [V1\LanguageController::class, 'index']);
        Route::get('categories', [V1\CategoryController::class, 'index']);
        Route::get('categories/{category:slug}', [V1\CategoryController::class, 'show']);
        Route::get('series', V1\SeriesController::class);
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
