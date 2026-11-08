# UI / UX — Charte visuelle et principes d'interaction

> Imagier parlant · version 1.0 · 8 novembre 2026

## 1. Les cinq règles

1. **Une chose à la fois.** Un écran enfant = une image, une question, un geste.
2. **Tout se comprend sans lire.** Chaque texte important est aussi dit à voix haute et illustré.
3. **Tout bouge, rien ne gêne.** Chaque action a une réponse animée, mais aucune animation
   ne retarde l'enfant ni ne détourne son regard de l'image.
4. **Jamais d'échec.** Pas de croix rouge, pas de son négatif, pas de score qui baisse.
5. **Le parent est ailleurs.** Réglages et texte dense sont derrière le portail parental.

## 2. Identité visuelle « imagier »

Le style rappelle les cartes d'un imagier en carton : formes rondes, aplats francs, une
ombre portée nette et décalée (pas de flou), beaucoup d'espace.

### 2.1 Couleurs

| Rôle | Nom | Clair | Sombre |
|---|---|---|---|
| Texte principal, contours | Encre | `#1B2A4A` | `#EEF3FA` |
| Fond | Ciel | `#E7F1FA` | `#0F1A2E` |
| Surface des cartes | Papier | `#FFFFFF` | `#1A2742` |
| Action principale | Soleil | `#FFC53D` | `#FFC53D` |
| Réussite | Feuille | `#3DBE72` | `#4FD488` |
| Accent, attention douce | Corail | `#FF7A59` | `#FF8A6C` |
| Information | Lagon | `#3A9BDC` | `#5AB2EE` |

- Chaque catégorie a sa propre couleur pastel (définie dans l'administration), toujours
  utilisée avec l'Encre pour le texte : contraste ≥ 4,5:1 vérifié à la saisie.
- Le rouge n'est jamais utilisé côté enfant.

### 2.2 Typographie

| Usage | Police | Taille mobile |
|---|---|---|
| Nom de l'objet (réponse) | Baloo 2, 800 | 44 à 56 pt |
| Titres | Baloo 2, 700 | 28 à 34 pt |
| Question | Baloo 2, 600 | 24 pt |
| Texte parent | Nunito, 400/600 | 16 à 17 pt |
| Petites mentions | Nunito, 600 | 13 pt |

Les noms d'objets sont écrits en **minuscules d'imprimerie** avec l'article (« une pomme »),
car c'est ce qu'on apprend à lire en maternelle. Option « écriture cursive » plus tard (P2).

### 2.3 Formes et espace

- Rayon des cartes 28 pt, des boutons 20 pt, des puces 999 (pilule).
- Ombre « imagier » : `4 pt 6 pt 0` couleur Encre à 100 % (clair) / noir à 60 % (sombre).
- Grille de 8 pt ; marges d'écran 20 pt ; espace entre cartes 16 pt.
- L'image d'un objet occupe au moins **60 % de la largeur** de l'écran en partie.

### 2.4 Iconographie

- Icônes rondes et épaisses (Lucide, trait 2,5) côté parent.
- Côté enfant : pictos dessinés maison (▶, ⏸, 🔁, 🏠, 🎤) en 64 pt minimum.
- Mascotte : un petit livre-personnage qui réagit (cligne, saute, applaudit). Elle n'apparaît
  qu'à l'accueil et à la fin, jamais pendant la question.

## 3. Mouvement et animations

### 3.1 Principes

- **Ressorts plutôt que durées fixes** (Reanimated `withSpring`) : les objets ont du poids.
- Animations sur le fil natif uniquement (transform, opacity) ; jamais de largeur/hauteur animées.
- Durée perçue courte : 150 à 450 ms. Rien au-delà de 800 ms sauf la fête de fin de série.
- Option « réduire les animations » du système respectée : fondus simples à la place des
  mouvements, pas de confettis.

### 3.2 Catalogue des animations

| Moment | Animation | Réglage |
|---|---|---|
| Toucher un bouton | Enfoncement : échelle 0,94 et ombre réduite à 1 pt, retour en ressort | ressort 400/18 |
| Choisir une catégorie | Rebond (échelle 1 → 1,08 → 1) + couleur qui se remplit | ressort 300/12 |
| Entrée d'une image | Glisse depuis la droite + échelle 0,85 → 1 + légère rotation −4° → 0 | ressort 220/20 |
| Question | Le texte monte de 12 pt en fondu | 250 ms |
| Compte à rebours | Anneau qui se vide en continu ; chaque seconde, petite pulsation du chiffre | linéaire + ressort |
| L'enfant parle | Le micro grossit selon le volume (0,9 à 1,2) | suivi du volume |
| Bonne réponse | Anneau qui devient vert, 12 confettis, carte qui saute | 600 ms |
| Nom de l'objet | Écriture lettre par lettre (40 ms/lettre) synchronisée avec la voix | — |
| Sortie d'une image | S'envole vers la gauche avec fondu | 300 ms |
| Fin de série | Étoiles qui tombent, mascotte qui danse, chiffre qui compte jusqu'au score | 1,5 s |
| Changement d'écran | Partagé : la carte de catégorie choisie devient le fond de la partie | 400 ms |

### 3.3 Son et vibration

| Événement | Son | Vibration |
|---|---|---|
| Toucher | « pop » doux | légère |
| Tic du compte à rebours | « tac » bois, plus aigu la dernière seconde | aucune |
| Bonne réponse | carillon montant | succès |
| Fin du temps | petit « hop » neutre | aucune |
| Fin de série | courte fanfare | succès |

Volume des effets ≤ 60 % de la voix. Musique de fond optionnelle, coupée pendant l'écoute.

## 4. Écrans clés (gabarits)

### 4.1 Partie (portrait)

```
┌──────────────────────────────┐
│ ⏸               ●●●●○○○○○○  │  ← commandes discrètes, 44 pt
│                              │
│   ┌──────────────────────┐   │
│   │                      │   │
│   │        IMAGE         │   │  ← 60 à 80 % de la largeur
│   │                      │   │
│   └──────────────────────┘   │
│                              │
│    Qu'est-ce que c'est ?     │  ← puis le nom, en très gros
│                              │
│           ( 3 )  🎤          │  ← anneau + micro qui pulse
│                              │
│   [  ✗  ]          [  ✓  ]   │  ← mode parent seulement
└──────────────────────────────┘
```

Sur tablette en paysage : image à gauche (55 %), texte et anneau à droite.

### 4.2 Accueil

```
┌──────────────────────────────┐
│ (🐻 Léo)                🔒  │
│  À quoi on joue ?            │
│ ┌──────────┐ ┌──────────┐    │
│ │   🍎     │ │   🐶     │    │  ← cartes 2 colonnes (3-4 sur tablette)
│ │  Fruits  │ │ Animaux ›│    │
│ └──────────┘ └──────────┘    │
│ ┌──────────┐ ┌──────────┐    │
│ │   🚗     │ │   🏠     │    │
│ └──────────┘ └──────────┘    │
│        [ ▶  Jouer ]          │  ← apparaît après un choix
└──────────────────────────────┘
```

## 5. Administration

- Base shadcn/ui (thème « new-york ») avec les couleurs de la marque, mode sombre.
- Densité « confortable » par défaut, « compacte » au choix pour les éditeurs qui traitent beaucoup d'objets.
- Tableaux : en-tête fixe, sélection au clavier (Maj + clic), actions groupées dans une barre
  qui apparaît en bas quand des lignes sont sélectionnées.
- Raccourcis : `/` rechercher, `N` nouvel objet, `⌘S` enregistrer, `Échap` fermer la fiche.
- Retours : toasts (sonner) pour les succès, message sous le champ pour les erreurs.
- États vides et squelettes de chargement partout ; aucune page blanche.

## 6. Accessibilité

- Zones tactiles : 64 pt minimum pour l'enfant, 44 pt pour le parent.
- Contraste texte ≥ 4,5:1 ; nom de l'objet ≥ 7:1.
- Aucune information portée par la couleur seule (la bonne réponse a aussi une icône et un son).
- Libellés VoiceOver/TalkBack sur tous les boutons parent ; en partie, l'image a pour
  libellé « image à deviner » (pour ne pas donner la réponse).
- Sous-titres : tout ce qui est dit est aussi écrit.
- Taille du texte du système respectée côté parent (jusqu'à 200 %).

## 7. Écriture (ton)

- Côté enfant : phrases de 3 à 6 mots, tutoiement, positives. « Bravo ! », « Presque ! »,
  « On continue ? », « Tu as trouvé 8 images ! ».
- Côté parent : vouvoiement, clair et court. « Le micro est coupé. Vous pouvez valider
  vous-même les réponses. »
- Côté administration : vouvoiement, termes du métier (objet, catégorie, variante, son).

## 8. Validation

Chaque nouvel écran enfant est testé avec **au moins 3 enfants** de la tranche d'âge visée
avant d'être figé : peuvent-ils lancer une partie seuls ? Comprennent-ils quand répondre ?
Sourient-ils à la bonne réponse ?
