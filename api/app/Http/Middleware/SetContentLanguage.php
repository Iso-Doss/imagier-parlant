<?php

namespace App\Http\Middleware;

use App\Models\Language;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Picks the language the content is returned in: ?lang=fr, then the
 * Accept-Language header, then the app's fallback locale.
 */
class SetContentLanguage
{
    public function handle(Request $request, Closure $next): Response
    {
        $active = Language::active()->get()->keyBy('code');

        // Sans ?lang ni en-tête Accept-Language : langue par défaut (sinon Symfony prend la première de la liste)
        $wanted = $request->query('lang')
            ?: ($request->headers->has('Accept-Language') ? $request->getPreferredLanguage($active->keys()->all()) : null);
        $language = $active->get((string) $wanted) ?? $active->get(config('app.fallback_locale')) ?? $active->first();

        if ($request->filled('lang') && ! $active->has($request->query('lang'))) {
            abort(422, __('Unknown or inactive language: :code', ['code' => (string) $request->query('lang')]));
        }

        if ($language) {
            app()->setLocale($language->code);
            $request->attributes->set('language', $language);
        }

        $response = $next($request);
        if ($language) {
            $response->headers->set('Content-Language', $language->code);
        }

        return $response;
    }
}
