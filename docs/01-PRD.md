# PRD — Document des exigences produit

> Imagier parlant · version 1.0 · 8 novembre 2026

## 1. Vision

Une application qui apprend aux jeunes enfants le nom des objets du quotidien, comme un
imagier qui parle. Une image apparaît, l'application demande « Qu'est-ce que c'est ? »,
laisse quelques secondes pour répondre, puis dit et écrit le nom de l'objet.

L'idée vient des vidéos courtes très regardées par les enfants (format « devine l'objet »).
L'application reprend ce format en le rendant **interactif** : l'enfant choisit son thème,
répond à voix haute, et l'application lui dit s'il a trouvé.

**Promesse** : fluide, animée, minimaliste, simple à utiliser, compréhensible sans savoir lire.

## 2. Pour qui

| Profil | Âge | Ce qu'il veut | Ce qu'il fait dans l'app |
|---|---|---|---|
| **L'enfant** | 2 à 7 ans | Jouer, deviner, être félicité | Regarde, répond à voix haute, touche de grands boutons |
| **Le parent** | adulte | Un écran utile, sans pub, sans risque | Crée le compte, règle la série, suit les progrès |
| **L'enseignant / l'orthophoniste** | adulte | Travailler un vocabulaire précis avec plusieurs enfants | Plusieurs profils, séries ciblées, suivi |
| **L'éditeur de contenu** | équipe interne | Alimenter et corriger le catalogue | Utilise l'espace d'administration |

## 3. Périmètre

### 3.1 Les cinq briques

1. **Prototype web** — démonstration jouable dans un navigateur, sans installation. Sert à
   tester les idées (rythme, sons, animations) avant de les porter sur mobile.
2. **Espace d'administration** — gestion du catalogue, des langues, des comptes et des statistiques.
3. **Catalogue** — catégories et objets. Chaque objet a une image, un nom écrit et un son
   par langue. Objectif : **environ 50 000 objets**.
4. **Application mobile** — iOS et Android, l'expérience principale pour l'enfant.
5. **API** — Laravel, sert les quatre autres briques.

### 3.2 Ce qui existe déjà (fin de la phase 0)

- Prototype web jouable (catégories, séries de 10 à 100, compte à rebours, FR/EN, voix du navigateur).
- API Laravel : langues, catégories, objets, séries, connexion des administrateurs.
- Administration React + shadcn : tableau de bord, catégories, objets, langues, enregistrement de la voix.
- Application Expo : accueil, partie, pause, écran de fin.
- Catalogue de départ : 11 catégories, 146 objets, français et anglais.

## 4. Fonctionnalités

Priorité : **P0** indispensable à la sortie, **P1** attendu peu après, **P2** plus tard.

### 4.1 Partie (cœur du produit)

| # | Fonctionnalité | Priorité |
|---|---|---|
| F1 | Choisir une ou plusieurs catégories | P0 |
| F2 | Choisir la longueur de la série : 10, 20, 50 ou 100 | P0 |
| F3 | Pour chaque objet : image → « Qu'est-ce que c'est ? » → compte à rebours sonore (tic-tac) → nom dit et écrit | P0 |
| F4 | Durée du compte à rebours réglable (3, 5, 8 secondes) | P0 |
| F5 | Choisir la langue de la partie (FR, EN, puis d'autres) | P0 |
| F6 | Afficher la traduction dans une seconde langue (option) | P1 |
| F7 | Pause, reprise, passer un objet, quitter | P0 |
| F8 | Écran de fin festif avec le nombre d'objets trouvés | P0 |
| F9 | Réécouter le nom de l'objet (bouton haut-parleur) | P0 |

### 4.2 Écouter la réponse et dire si c'est juste

C'est la grande nouveauté par rapport au format vidéo.

| # | Fonctionnalité | Priorité |
|---|---|---|
| R1 | Pendant le compte à rebours, l'application **écoute** l'enfant (micro) | P0 |
| R2 | Elle compare ce qu'elle a entendu au nom attendu et à ses variantes acceptées (« une pomme », « pomme », « la pomme ») | P0 |
| R3 | Si c'est juste : félicitation sonore et visuelle, le nom est dit tout de suite (pas d'attente) | P0 |
| R4 | Si ce n'est pas juste ou rien d'entendu : réponse douce (« Presque ! C'est… ») sans jamais punir | P0 |
| R5 | **Mode parent** : à la place du micro, le parent touche ✓ (« trouvé ») ou ✗ (« pas encore ») | P0 |
| R6 | Le micro peut être coupé à tout moment ; sans micro, la partie fonctionne comme la vidéo | P0 |
| R7 | Tolérance réglable (stricte / normale / indulgente) pour les petits qui prononcent mal | P1 |
| R8 | Les objets ratés reviennent plus souvent dans les séries suivantes (répétition espacée) | P1 |

La voix de l'enfant est analysée **sur l'appareil** quand c'est possible et n'est **jamais
enregistrée** ni envoyée au serveur (voir [07-securite.md](07-securite.md)).

### 4.3 Comptes

| # | Fonctionnalité | Priorité |
|---|---|---|
| C1 | Jouer **sans compte** (mode invité), réglages gardés sur le téléphone | P0 |
| C2 | Créer un compte parent : e-mail + mot de passe, vérification de l'e-mail | P0 |
| C3 | Se connecter avec Apple et Google | P1 |
| C4 | Plusieurs profils enfant par compte (prénom ou surnom, avatar, âge approximatif) — aucune autre donnée | P0 |
| C5 | Suivi des progrès par profil : objets connus, à revoir, temps de jeu | P1 |
| C6 | Mot de passe oublié, modification, suppression du compte et de toutes ses données | P0 |
| C7 | Portail parental (petite opération à résoudre) avant les réglages, le compte et les liens externes | P0 |
| C8 | Synchronisation des progrès entre appareils | P1 |
| C9 | Compte « classe » pour les enseignants (jusqu'à 30 profils) | P2 |

### 4.4 Catalogue

| # | Fonctionnalité | Priorité |
|---|---|---|
| K1 | Catégories avec nom par langue, couleur, image, ordre, publication | P0 |
| K2 | Objets avec image, nom par langue, phrase facultative, variantes acceptées, son par langue | P0 |
| K3 | Sous-catégories (ex. Animaux › Ferme, Animaux › Savane) — nécessaires à 50 000 objets | P0 |
| K4 | Niveau de difficulté par objet (1 facile à 3 difficile) et âge conseillé | P1 |
| K5 | Téléchargement de catégories pour jouer **hors connexion** | P1 |

### 4.5 Administration

| # | Fonctionnalité | Priorité |
|---|---|---|
| A1 | Tout ce qui existe (catégories, objets, langues, voix, tableau de bord) | P0 |
| A2 | **Import en masse** : fichier CSV + dossier d'images/sons (ZIP) avec rapport d'erreurs | P0 |
| A3 | Génération automatique des sons manquants par synthèse vocale | P0 |
| A4 | Circuit de validation : brouillon → à relire → publié | P1 |
| A5 | Rôles : administrateur, éditeur, relecteur | P1 |
| A6 | Recherche rapide sur 50 000 objets, filtres, actions groupées (publier, déplacer, supprimer) | P0 |
| A7 | Gestion des comptes parents (consultation, suspension, suppression sur demande) | P0 |
| A8 | Statistiques : objets les plus ratés, catégories les plus jouées | P1 |
| A9 | Journal des modifications (qui a changé quoi) | P1 |

### 4.6 Prototype web

| # | Fonctionnalité | Priorité |
|---|---|---|
| W1 | Lire le catalogue depuis l'API au lieu de la liste figée | P1 |
| W2 | Tester la reconnaissance vocale (Web Speech API, Chrome/Safari) | P1 |
| W3 | Servir de terrain d'essai pour les nouvelles animations | P1 |

## 5. Ce que l'application ne fera pas

- Aucune publicité, aucun achat dans l'application visible par l'enfant.
- Pas de chat, pas de partage social, pas de classement entre enfants.
- Pas de collecte du nom de famille, de la photo ou de la voix de l'enfant.
- Pas de minuterie stressante : le compte à rebours est un jeu, jamais une sanction.

## 6. Mesures du succès

| Indicateur | Cible à 6 mois |
|---|---|
| Séries terminées / séries commencées | ≥ 70 % |
| Durée médiane d'une séance | 6 à 12 minutes |
| Taux de bonnes réponses reconnues correctement par le micro | ≥ 90 % (sur un échantillon testé à la main) |
| Faux « c'est faux » (l'enfant avait juste) | ≤ 5 % |
| Note moyenne sur les stores | ≥ 4,5 |
| Plantages | < 0,5 % des séances |
| Objets publiés avec image + son dans chaque langue active | 50 000 |

## 7. Hypothèses et risques

| Risque | Conséquence | Réponse |
|---|---|---|
| Reconnaissance vocale peu fiable avec des voix d'enfants de 2-4 ans | Frustration, faux « c'est faux » | Tolérance réglable, variantes acceptées, mode parent ✓/✗, jamais de pénalité |
| 50 000 images de qualité et libres de droits | Coût, délai, droits | Sources sous licence, banques d'images, images générées vérifiées ; champ « source / licence » obligatoire |
| 50 000 × N langues sons | Coût de la synthèse, temps d'enregistrement | Synthèse vocale neuronale par lots, voix humaine pour les 2 000 objets les plus joués |
| Règles strictes des stores pour les applis enfants | Refus de publication | Suivre dès le départ les règles Apple « Kids » et Google « Familles » (voir sécurité) |
| Trop d'objets rares pour de petits enfants | Séries décourageantes | Difficulté et âge par objet, séries « essentiels » par défaut |

## 8. Questions ouvertes

1. Modèle économique : gratuit, abonnement familial, ou packs de catégories ?
2. Quelles langues après le français et l'anglais ?
3. Qui produit les 50 000 images (équipe, prestataire, génération) ?
4. Le compte « classe » doit-il viser les écoles (contrats, facturation) ?
