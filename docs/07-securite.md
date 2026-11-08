# Sécurité et protection des données

> Imagier parlant · version 1.0 · 8 novembre 2026

L'application s'adresse à des enfants. La règle de fond est simple : **collecter le moins
possible, protéger tout ce qui est collecté, ne rien partager**.

## 1. Données traitées

| Donnée | Qui | Pourquoi | Durée de conservation |
|---|---|---|---|
| E-mail, mot de passe (haché) | Parent | Compte, récupération | Vie du compte + 30 jours |
| Identifiant Apple / Google | Parent | Connexion simplifiée | Vie du compte |
| Surnom, avatar, tranche d'âge | Profil enfant | Personnaliser le jeu | Vie du profil |
| Résultats de jeu (objet, juste/faux, temps de réponse) | Profil enfant | Progrès, répétition espacée | Vie du profil |
| Appareils (nom, plateforme, dernière connexion) | Parent | Sécurité du compte | Vie du jeton |
| Adresse IP | Tous | Sécurité, limites de débit | 30 jours, tronquée dans le journal |
| **Voix de l'enfant** | — | **Jamais conservée, jamais envoyée** | — |

Interdits : nom de famille, date de naissance exacte, photo, géolocalisation, identifiant
publicitaire, contacts, publicité, traceurs tiers.

## 2. Cadre légal et règles des stores

| Texte | Ce qu'il impose | Comment on y répond |
|---|---|---|
| **RGPD** (UE) — art. 8 | Consentement parental sous 15 ans en France | Seul le parent crée le compte ; l'enfant n'a pas de compte propre |
| RGPD — droits | Accès, rectification, effacement, portabilité | Export JSON et suppression depuis l'app, sans écrire au support |
| RGPD — registre | Registre des traitements, analyse d'impact (données d'enfants) | AIPD à rédiger avant la sortie |
| **COPPA** (États-Unis) | Consentement parental vérifiable, pas de données d'enfants sans lui | Pas de donnée personnelle de l'enfant ; surnom libre ; politique dédiée |
| **Apple — catégorie Enfants** (règles 1.3 et 5.1.4) | Pas de pub ciblée, pas d'analytique tierce, portail parental avant liens, achats, réglages | Portail parental, aucun SDK publicitaire ou analytique tiers |
| **Google Play — Familles** | SDK certifiés Familles uniquement, pas d'identifiant publicitaire | Liste blanche des dépendances, permission `AD_ID` retirée |

Une **politique de confidentialité** en français et en anglais, lisible par un parent en
2 minutes, est publiée avant la sortie et liée depuis l'app, le site et les stores.

## 3. Comptes et authentification

### 3.1 Parents

- Mots de passe : 10 caractères minimum, vérifiés contre les fuites connues (`Password::uncompromised()`),
  hachés avec Argon2id (ou bcrypt coût 12).
- E-mail vérifié par code à 6 chiffres, valable 15 minutes, 5 essais maximum.
- Connexion Apple et Google : le jeton d'identité est **vérifié côté serveur** (signature,
  audience, expiration), jamais cru sur parole.
- Jetons Sanctum personnels : un par appareil, nommés, révocables, expiration après 90 jours
  sans utilisation. Stockés dans **SecureStore** (Keychain / Keystore) sur mobile, jamais AsyncStorage.
- Changement ou réinitialisation du mot de passe → tous les autres jetons sont révoqués.
- Messages identiques pour « e-mail inconnu » et « mauvais mot de passe » (pas d'énumération des comptes).

### 3.2 Équipe d'administration

- Rôles : `editor` (contenu), `reviewer` (validation), `admin` (tout, y compris comptes et équipe).
  Droits vérifiés par des **Policies** Laravel sur chaque route, pas seulement dans l'interface.
- Double authentification (TOTP) **obligatoire** pour tous les membres de l'équipe.
- Jeton admin : expiration après 12 heures, stocké en mémoire + `sessionStorage` (pas
  `localStorage` à terme), ou cookie de session Sanctum `HttpOnly`, `Secure`, `SameSite=Lax`
  quand l'admin est servie sur le même domaine que l'API.
- Les comptes parents ne peuvent jamais ouvrir l'administration (déjà en place).
- Accès aux données des parents limité au rôle `admin` et tracé dans le journal.

## 4. Protection de l'API

| Mesure | Détail |
|---|---|
| HTTPS partout | HSTS 1 an, TLS 1.2 minimum, redirection HTTP → HTTPS |
| Limites de débit | Public 120/min par IP · connexion 5/min par e-mail + IP · inscription 3/h par IP · code e-mail 5 essais · admin 600/min par utilisateur |
| Validation | Toute entrée passe par un Form Request ; listes fermées pour les tris, filtres et langues |
| Requêtes SQL | Eloquent / requêtes paramétrées uniquement ; aucune concaténation |
| Assignation de masse | `$fillable` explicite sur chaque modèle ; `is_admin` et `role` jamais remplis depuis une requête publique |
| Isolation des données | Toute route `/me/...` filtre par `user_id` du jeton ; un profil d'un autre compte renvoie 404 |
| CORS | Origines autorisées : domaine de l'admin et du prototype seulement |
| En-têtes | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`, CSP stricte sur l'admin |
| Erreurs | `APP_DEBUG=false` en production ; aucune trace de pile renvoyée |

## 5. Fichiers envoyés

- Types vérifiés par le **contenu** (MIME réel), pas l'extension : images JPEG, PNG, WebP ;
  sons MP3, M4A, WAV, WebM, OGG ; imports CSV et ZIP.
- Tailles maximales : image 10 Mo, son 5 Mo, CSV 50 Mo, ZIP 5 Go (envoi direct S3).
- Les images sont **réencodées** (supprime les métadonnées EXIF et tout contenu caché).
- ZIP : refus des chemins avec `..`, des liens symboliques, des archives trop compressées
  (bombe ZIP : taille décompressée > 20 × taille compressée ou > 20 Go).
- Les fichiers ne sont jamais exécutés ni servis depuis le dossier de l'application.
- Noms de fichiers générés par le serveur (empreinte), jamais ceux de l'utilisateur.

## 6. Microphone et voix

- La permission micro est demandée **par le parent**, derrière le portail parental, après une
  explication : « La voix sert seulement à savoir si la réponse est juste. Elle n'est ni
  enregistrée ni envoyée. »
- Reconnaissance **sur l'appareil** quand le système le permet (`requiresOnDeviceRecognition`
  sur iOS, modèle hors ligne sur Android). Si le système ne peut pas garantir le traitement
  local, l'option est signalée au parent qui choisit (micro ou mode parent).
- Aucun fichier audio écrit, aucun texte reconnu enregistré ni envoyé : seul le résultat
  (juste, faux, silence) quitte la fonction de comparaison.
- Le micro n'est actif que pendant le compte à rebours ; un indicateur est visible.
- L'enregistrement de voix dans l'administration (voix de l'éditeur pour les objets) est un
  autre usage, réservé à l'équipe, sur un navigateur de bureau.

## 7. Secrets et configuration

- Aucun secret dans Git : `.env` ignoré, `.env.example` sans valeurs réelles (déjà en place).
- Production : secrets dans le gestionnaire du fournisseur (variables chiffrées), jamais dans les images Docker.
- Clés du service de synthèse vocale et de S3 : un compte de service par environnement,
  droits minimaux (S3 : écriture sur le seul bucket du projet).
- `APP_KEY` changée par environnement ; rotation des clés tous les ans ou après départ d'un membre.
- L'app mobile ne contient **aucun secret** : seulement l'URL publique de l'API.

## 8. Dépendances

- `composer audit` et `npm audit` dans l'intégration continue ; échec si faille haute ou critique.
- Dependabot (ou Renovate) activé sur GitHub pour `api/`, `admin/`, `mobile/`.
- Côté mobile : liste blanche des bibliothèques autorisées (règles Familles de Google) ;
  toute nouvelle dépendance native est vérifiée (collecte de données, réseau).

## 9. Journal et surveillance

- Journal d'audit : connexions de l'équipe, modifications du catalogue, accès aux comptes
  parents, suppressions, exports. Conservé 1 an.
- Alerte sur : rafales d'échecs de connexion, nombre anormal d'inscriptions, accès admin
  depuis un nouveau pays, erreurs 5xx.
- Sentry configuré pour **ne jamais** envoyer e-mail, surnom, IP complète ni corps de requête.

## 10. Sauvegardes et incidents

- Base sauvegardée chaque nuit, chiffrée, sur un autre fournisseur ou une autre région, gardée 30 jours.
- Restauration testée tous les mois.
- Procédure d'incident : contenir (révoquer les jetons, couper l'accès), évaluer, notifier la
  CNIL sous 72 heures si des données personnelles sont touchées, prévenir les parents concernés.

## 11. Contrôles avant chaque mise en production

- [ ] `APP_DEBUG=false`, `APP_ENV=production`, HTTPS forcé
- [ ] Tests verts, `composer audit` et `npm audit` sans faille haute
- [ ] Aucune nouvelle route sans middleware d'authentification ou limite de débit adaptée
- [ ] Aucune nouvelle colonne contenant des données d'enfant sans mise à jour du §1
- [ ] Aucune nouvelle dépendance mobile non vérifiée
- [ ] Politique de confidentialité à jour si un traitement change
