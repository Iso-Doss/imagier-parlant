<?php

use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\SetContentLanguage;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'content.language' => SetContentLanguage::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Messages d'erreur génériques traduits (« Non authentifié. », « Introuvable »…)
        $exceptions->render(fn (AuthenticationException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => __('Unauthenticated.')], 401)
            : null);
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/*') || ($e->getMessage() !== '' && ! str_starts_with($e->getMessage(), 'No query results'))) {
                return null;
            }

            return response()->json(['message' => __(Response::$statusTexts[$e->getStatusCode()] ?? 'Error')], $e->getStatusCode(), $e->getHeaders());
        });
    })->create();
