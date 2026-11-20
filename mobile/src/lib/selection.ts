// Choix des catégories à l'accueil, avec les sous-catégories (testé dans tests/selection.test.ts).
// La sélection est une liste de slugs : une catégorie principale veut dire « tout, sous-catégories
// comprises » ; une sous-catégorie seule veut dire « seulement elle ».
import type { Category } from "../api"

export type CardState = "on" | "partial" | "off"

const childSlugs = (root: Category) => (root.children ?? []).map((c) => c.slug)

/** Coche d'une carte : toute la catégorie, une partie de ses sous-catégories, ou rien. */
export function cardState(selection: string[], root: Category): CardState {
  if (selection.includes(root.slug)) return "on"
  return childSlugs(root).some((s) => selection.includes(s)) ? "partial" : "off"
}

/** Toucher la carte : tout prendre (ou tout enlever si elle était entièrement choisie). */
export function toggleRoot(selection: string[], root: Category): string[] {
  const mine = new Set([root.slug, ...childSlugs(root)])
  const others = selection.filter((s) => !mine.has(s))
  return cardState(selection, root) === "on" ? others : [...others, root.slug]
}

/** Choisir ou enlever une seule sous-catégorie. */
export function toggleChild(selection: string[], root: Category, child: string): string[] {
  if (selection.includes(root.slug)) {
    // Toute la catégorie était choisie : on garde les autres sous-catégories
    return [...selection.filter((s) => s !== root.slug), ...childSlugs(root).filter((s) => s !== child)]
  }
  return selection.includes(child) ? selection.filter((s) => s !== child) : [...selection, child]
}

/** Ce qui est choisi, pour le rappel de l'étape 2 : catégories entières et sous-catégories seules. */
export function chosenCategories(selection: string[], roots: Category[]): Category[] {
  return roots.flatMap((r) => (selection.includes(r.slug) ? [r] : (r.children ?? []).filter((c) => selection.includes(c.slug))))
}

/** Tous les slugs connus, sous-catégories comprises (pour oublier ceux qui n'existent plus). */
export function allSlugs(roots: Category[]): Set<string> {
  return new Set(roots.flatMap((r) => [r.slug, ...childSlugs(r)]))
}
