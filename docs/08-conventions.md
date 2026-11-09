# Conventions

> Imagier parlant · version 1.0 · 8 novembre 2026

## 1. Langue

| Élément | Langue |
|---|---|
| Documentation, README, commentaires | **Français** |
| Textes d'interface, e-mails, messages d'erreur visibles | **Français** (et traductions) |
| Messages de commit, titres et descriptions de pull request | **Français** |
| Code : variables, fonctions, classes, fichiers, routes, colonnes, clés JSON | Anglais |

Exemple : `function buildSeries()` avec le commentaire `// Évite deux fois le même objet de suite`.

## 2. Git

### 2.1 Branches

- `main` : toujours déployable, protégée (pull request + tests verts obligatoires).
- Une branche par tâche, nommée `type/sujet-court` :
  `feat/comptes-parents`, `fix/compte-a-rebours-pause`, `docs/specifications`, `chore/mysql`.

### 2.2 Commits — Conventional Commits, en français

```
<type>(<portée>): <résumé à l'impératif, 72 caractères max>

<pourquoi ce changement, si ce n'est pas évident>
```

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation |
| `style` | Mise en forme sans effet sur le code |
| `refactor` | Restructuration sans changement de comportement |
| `perf` | Performance |
| `test` | Tests |
| `chore` | Outils, dépendances, configuration |

Portées : `api`, `admin`, `mobile`, `prototype`, `docs`, `ci`.

Exemples :
- `feat(mobile): valider la réponse de l'enfant au micro`
- `fix(api): ne pas renvoyer les objets dépubliés dans les séries`

### 2.3 Pull requests

- Titre au format du commit ; description : ce qui change, pourquoi, comment tester, captures pour l'interface.
- Petites (< 400 lignes modifiées hors fichiers générés) ; sinon découper.
- Une relecture minimum ; la personne qui ouvre la PR fusionne après approbation.
- Fusion en « squash » sur `main`.
- Si la PR change un comportement décrit dans `docs/`, le document est mis à jour dans la même PR.

## 3. API Laravel (`api/`)

- PHP 8.4, typage strict des paramètres et retours ; `declare(strict_types=1)` dans les nouveaux fichiers.
- Formatage : **Pint** (preset Laravel) — `vendor/bin/pint` avant chaque commit.
- Analyse statique : Larastan niveau 6 minimum (à installer en phase 1).
- Contrôleurs minces ; la logique dans `app/Services` ; une action = une méthode.
- Validation **toujours** dans un Form Request ; réponses **toujours** via une API Resource.
- Routes : `kebab-case` au pluriel (`/admin/items`, `/me/profiles`) ; versionnées sous `/api/v1`.
- Base : tables au pluriel `snake_case`, clés étrangères `xxx_id` avec contrainte, index sur
  chaque colonne filtrée ; jamais de modification d'une migration déjà fusionnée → nouvelle migration.
- Pas de requête dans une boucle : `with()` / `load()` ; vérifier avec Herd Insights (N+1).
- Traitements longs (> 1 s) dans une tâche en file, jamais dans la requête.
- Textes visibles via `__()` et les fichiers `lang/fr`, `lang/en`.
- Tests : un fichier Feature par groupe de routes ; nommage `test_il_refuse_un_profil_d_un_autre_compte`.

## 4. Administration (`admin/`)

- TypeScript strict, aucun `any` (utiliser `unknown` puis affiner).
- Composants : `PascalCase` pour le nom, fichiers en `kebab-case.tsx` ; un composant exporté par fichier.
- Composants shadcn dans `src/components/ui/` : ne pas les modifier sauf nécessité (ils se régénèrent).
- Données serveur : **TanStack Query** uniquement (pas de `useEffect` + `fetch`) ; clés de requête
  sous forme de tableau (`["items", filtres]`).
- Filtres et pagination dans l'URL (`useSearchParams`) pour qu'une vue soit partageable.
- Styles : classes Tailwind et variables du thème ; pas de couleurs en dur.
- Lint : `npm run lint` sans erreur ; `npm run build` doit passer.

## 5. Application mobile (`mobile/`)

- TypeScript strict ; écrans dans `src/screens/`, composants dans `src/components/`,
  logique sans interface dans `src/lib/` ou fichiers dédiés (`audio.ts`, `api.ts`).
- Animations avec **Reanimated** (pas l'API `Animated` de base) ; uniquement `transform` et `opacity`.
- Textes visibles dans `src/i18n.ts` (ou fichiers de traduction), jamais en dur dans un écran.
- Couleurs, tailles et rayons depuis `src/theme.ts`.
- Aucune dépendance native ajoutée sans vérification de conformité (voir sécurité §8).
- Secrets : aucun ; jetons dans SecureStore.
- Vérification : `npm run typecheck`, `npm test` et `npx expo-doctor` sans erreur.

## 6. Prototype (`prototype/`)

- Un seul fichier HTML autonome ; JavaScript moderne sans étape de build.
- Sert d'essai : une idée validée dans le prototype est ensuite réécrite proprement dans le mobile.

## 7. Nommage métier (glossaire)

| Français (doc, interface) | Code |
|---|---|
| Objet | `item` |
| Catégorie, sous-catégorie | `category` (avec `parent_id`) |
| Traduction | `translation` |
| Variante acceptée | `alias` |
| Son, voix | `audio` |
| Série | `series` |
| Partie, séance | `play_session` |
| Réponse | `answer` |
| Profil enfant | `child_profile` |
| Compte parent | `user` (rôle `parent`) |
| Pack hors connexion | `pack` |
| Portail parental | `parental_gate` |
| Compte à rebours | `countdown` |

## 8. Tests et qualité

| Projet | Commande | Obligatoire avant fusion |
|---|---|---|
| API | `php artisan test` | Oui |
| API | `vendor/bin/pint --test` | Oui |
| Admin | `npm run lint && npm run build` | Oui |
| Mobile | `npm run typecheck && npm test` | Oui |
| Tous | `composer audit`, `npm audit --audit-level=high` | Oui |

Toute correction de bug arrive avec un test qui échouait avant la correction.

## 9. Documentation

- Les documents de `docs/` sont la référence ; le code qui s'en écarte doit les mettre à jour.
- En tête de chaque document : version et date ; changer la version à chaque modification importante.
- Schémas en Mermaid (affichés directement par GitHub).
