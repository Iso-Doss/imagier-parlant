# Imagier parlant

Application d'apprentissage pour les enfants : une image apparaît, l'application demande
« Qu'est-ce que c'est ? », lance un compte à rebours, puis dit et écrit le nom de l'objet.
Français et anglais, d'autres langues s'ajoutent depuis l'administration.

| Dossier      | Contenu                                         | État     |
|--------------|-------------------------------------------------|----------|
| `api/`       | API Laravel 13 (Sanctum, Horizon)               | en place |
| `admin/`     | Administration, React + shadcn/ui               | en place |
| `mobile/`    | Application mobile, Expo (React Native)         | en place |
| `prototype/` | Prototype web jouable, un seul fichier HTML     | en place |

Documentation (en français) : [docs/](docs/README.md) — PRD, TRD, parcours, UI/UX, backend, plan, sécurité, conventions.

## Prérequis

- PHP 8.4 avec les extensions `gd`, `exif`, `redis`, `pdo_mysql` (Herd les fournit)
- Composer, Node.js 20 ou plus
- Docker Desktop (MySQL et stockage S3 local) et Redis (`brew install redis` ou le service Docker)

## Services de développement

```bash
docker compose up -d mysql s3        # MySQL sur 3306, S3 local (SeaweedFS) sur 8333
docker compose up -d redis           # seulement si Redis n'est pas déjà installé sur la machine
```

Au premier démarrage, créer le bucket des médias :

```bash
docker compose exec s3 sh -c "echo 's3.bucket.create -name imagier-media' | weed shell"
```

Sans Docker, on peut revenir à SQLite et au dossier local dans `api/.env` :
`DB_CONNECTION=sqlite`, `MEDIA_DISK=public`, `QUEUE_CONNECTION=sync`, `CACHE_STORE=file`.

## Lancer l'API

```bash
cd api
cp .env.example .env && php artisan key:generate   # première fois seulement
php artisan migrate:fresh --seed     # 11 catégories, 146 objets, FR + EN, compte admin
php artisan serve                    # http://localhost:8000
php artisan horizon                  # traitement des files (dans un autre terminal)
```

Le seeder crée le compte d'administration à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD` dans `api/.env`.
Le tableau de bord des files est sur http://localhost:8000/horizon (local uniquement).

### Médias

Les images envoyées sont réencodées en WebP dans trois tailles (`full` 768 px, `card` 320 px,
`thumb` 96 px) et rangées sous un nom qui contient leur empreinte :
`items/{id}/image/{empreinte}-{taille}.webp`. Les sons vont dans `items/{id}/audio/{langue}/`.
Le disque est choisi par `MEDIA_DISK` : `s3` (S3 local, R2, AWS…) ou `public` (dossier local).

Pour transférer des fichiers rangés à l'ancienne vers le disque des médias :

```bash
php artisan media:migrate            # en file « media » (Horizon doit tourner)
php artisan media:migrate --sync     # tout de suite
```

### Vérifications

```bash
php artisan test                     # tests (SQLite en mémoire)
vendor/bin/pint --test               # formatage
vendor/bin/phpstan analyse           # analyse statique (Larastan niveau 5)
```

Les mêmes vérifications tournent sur GitHub à chaque push et pull request (`.github/workflows/ci.yml`),
avec les tests lancés sur SQLite **et** MySQL.

## Lancer l'administration

```bash
cd api && php artisan serve              # terminal 1
cd admin && npm install && npm run dev   # terminal 2 → http://localhost:5173
```

Vite renvoie `/api` et `/storage` vers `localhost:8000`. Pour la production :
`VITE_API_URL=https://api.example.com npm run build`, puis servir `admin/dist`.

Pages : tableau de bord (ce qui manque par langue), catégories (nom par langue, couleur, photo,
ordre, publication), objets (recherche et filtres, photo, nom et phrase facultative par langue,
voix : enregistrer au micro, envoyer un fichier ou écouter la voix du téléphone), langues.

## Lancer l'application mobile

Sur le téléphone, installer **Expo Go** (App Store / Play Store). Téléphone et ordinateur sur le même Wi-Fi.

```bash
cd api && php artisan serve --host=0.0.0.0   # joignable depuis le téléphone
cd mobile && npx expo start                   # scanner le QR code avec l'appareil photo / Expo Go
```

`npx expo start --web` lance l'app dans le navigateur (pratique pour un contrôle rapide).
L'app joint l'API sur l'ordinateur qui lance Expo, port 8000, et les médias sur le même ordinateur
(port 8333 pour le S3 local). `EXPO_PUBLIC_API_URL` dans `mobile/.env` permet de viser une API déployée.
Pour le simulateur iOS, accepter d'abord la licence Xcode (`sudo xcodebuild -license`).

Déroulé : langue et catégories → série de 10/20/50/100 → image + question dite →
compte à rebours (tic-tac, chiffres dits ou silence) → carillon, nom écrit et dit (enregistrement
de l'admin s'il existe, sinon voix du téléphone) → suivant. Pause, réécouter, passer ;
l'écran reste allumé pendant une série et se met en pause si l'app passe en arrière-plan.

## Routes (préfixe `/api/v1`)

### Application mobile — publiques, lecture seule

Langue : `?lang=fr` ou l'en-tête `Accept-Language`.

| Méthode | Route | Description |
|---|---|---|
| GET | `/languages` | Langues actives, avec la question et la phrase de réponse |
| GET | `/categories` | Catégories publiées, traduites, avec `items_count` |
| GET | `/categories/{slug}` | Une catégorie et ses objets |
| GET | `/series?categories=fruits,animaux&count=10&translation=en` | Série mélangée de 1 à 100 images. Sans `categories`, tout est mélangé. Les objets se répètent si besoin, jamais deux fois de suite |

Chaque objet renvoie `emoji`, `image_url` (+ `card_url`, `thumb_url`), `name` (« une pomme »),
`sentence` (« C'est une pomme ») et `audio_url` (prononciation enregistrée, ou `null` → l'app
utilise la synthèse vocale).

### Administration — `Authorization: Bearer <jeton>`

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → `{token, user}` (administrateurs uniquement) |
| GET / POST | `/auth/me`, `/auth/logout` | |
| GET | `/admin/stats` | Comptes, traductions / images / sons manquants par langue |
| CRUD | `/admin/languages` | Une langue qui a des traductions peut être désactivée, pas supprimée |
| CRUD | `/admin/categories` | `translations: {fr: {name}, en: {name}}` |
| POST | `/admin/categories/reorder` | `{ids: [3,1,2]}` |
| POST / DELETE | `/admin/categories/{id}/image` | multipart `image` (JPEG, PNG, WebP ≤ 10 Mo) |
| CRUD | `/admin/items` | Filtres : `category_id`, `search`, `published`, `missing=image\|audio\|translation`, `per_page` |
| POST / DELETE | `/admin/items/{id}/image` | multipart `image` (JPEG, PNG, WebP ≤ 10 Mo) |
| POST / DELETE | `/admin/items/{id}/audio/{langue}` | multipart `audio` (mp3, m4a, wav, ogg, webm) |

Contenu d'un objet : `{category_id, emoji, is_published, translations: {fr: {name, sentence?}, en: {...}, de: null}}` —
`null` supprime une traduction. `sentence` ne sert que si la phrase de la langue ne convient pas (pluriels).

Les messages d'erreur sont en français (`api/lang/fr`) ; sur les routes publiques, ils suivent la langue demandée.
