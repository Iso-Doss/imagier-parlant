# Imagier parlant

Learning app for children: a picture appears, the app asks "Qu'est-ce que c'est ?",
counts down, then says and writes the name of the object. French and English, more languages addable.

| Folder    | What                                      | Status        |
|-----------|-------------------------------------------|---------------|
| `api/`    | Laravel 13 API (Sanctum)                  | done          |
| `admin/`  | Back office, React + shadcn/ui            | done          |
| `mobile/` | Mobile app, Expo (React Native)           | done          |

Documentation (en français) : [docs/](docs/README.md) — PRD, TRD, parcours, UI/UX, backend, plan, sécurité, conventions.

## Run the API

```bash
cd api
php artisan migrate:fresh --seed   # 11 categories, 146 objects, FR + EN
php artisan serve                  # http://localhost:8000
php artisan test
```

The seeder creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `api/.env`.
Development uses SQLite (`api/database/database.sqlite`).

## Run the admin

```bash
cd api && php artisan serve        # terminal 1
cd admin && npm install && npm run dev   # terminal 2 → http://localhost:5173
```

Vite forwards `/api` and `/storage` to `localhost:8000`. For production, build with
`VITE_API_URL=https://api.example.com npm run build` and serve `admin/dist`.

Pages: dashboard (what is missing per language), categories (names per language, colour,
photo, order, publish), objects (search and filters, photo, name + optional sentence per language,
voice: record with the microphone, upload a file, or preview the phone's voice), languages.

## Run the mobile app

On your phone, install **Expo Go** (App Store / Play Store). Phone and computer on the same Wi-Fi.

```bash
cd api && php artisan serve --host=0.0.0.0   # reachable from the phone
cd mobile && npx expo start                   # scan the QR code with the camera / Expo Go
```

`npx expo start --web` runs it in the browser (handy for quick checks).
The app reaches the API on the computer running Expo, port 8000; set `EXPO_PUBLIC_API_URL`
in `mobile/.env` to point at a deployed API. For the iOS simulator, accept the Xcode licence first
(`sudo xcodebuild -license`).

Flow: choose language and categories → series of 10/20/50/100 → picture + spoken question →
countdown (tick, spoken numbers or silent) → chime, answer written and spoken (recording from the
admin if there is one, otherwise the phone's voice) → next. Pause, repeat, skip; the screen stays on
during a series and pauses itself when the app goes to the background.

## Endpoints (prefix `/api/v1`)

### Mobile app — public, read-only
Language: `?lang=fr` or the `Accept-Language` header.

| Method | Path | Description |
|---|---|---|
| GET | `/languages` | Active languages, with the question and answer template |
| GET | `/categories` | Published categories, translated, with `items_count` |
| GET | `/categories/{slug}` | One category with its items |
| GET | `/series?categories=fruits,animaux&count=10&translation=en` | A shuffled series of 1–100 pictures. Omit `categories` to mix all. Items repeat when needed, never twice in a row |

Each item returns `emoji`, `image_url`, `name` ("une pomme"), `sentence` ("C'est une pomme")
and `audio_url` (recorded pronunciation, or `null` → the app uses speech synthesis).

### Admin — `Authorization: Bearer <token>`
| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → `{token, user}` (admins only) |
| GET / POST | `/auth/me`, `/auth/logout` | |
| GET | `/admin/stats` | Counts, missing translations / images / audio per language |
| CRUD | `/admin/languages` | A language with translations can be deactivated, not deleted |
| CRUD | `/admin/categories` | `translations: {fr: {name}, en: {name}}` |
| POST | `/admin/categories/reorder` | `{ids: [3,1,2]}` |
| POST / DELETE | `/admin/categories/{id}/image` | multipart `image` |
| CRUD | `/admin/items` | Filters: `category_id`, `search`, `published`, `missing=image\|audio\|translation`, `per_page` |
| POST / DELETE | `/admin/items/{id}/image` | multipart `image` (≤ 5 MB) |
| POST / DELETE | `/admin/items/{id}/audio/{locale}` | multipart `audio` (mp3, m4a, wav, ogg, webm) |

Item payload: `{category_id, emoji, is_published, translations: {fr: {name, sentence?}, en: {...}, de: null}}` —
`null` removes a translation. `sentence` is only needed when the language template does not fit (plurals).
