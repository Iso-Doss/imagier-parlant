// Choix des catégories et sous-catégories à l'accueil.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Category } from "../src/api";
import { allSlugs, cardState, chosenCategories, toggleChild, toggleRoot } from "../src/lib/selection";

const cat = (slug: string, children?: string[]): Category => ({
  id: 0, slug, name: slug, emoji: null, color: null, image_url: null, thumb_url: null, items_count: 1,
  ...(children ? { children: children.map((c) => cat(c)) } : {}),
});
const animals = cat("animaux", ["ferme", "mer", "oiseaux"]);
const fruits = cat("fruits");

test("toucher une carte prend toute la catégorie, puis l'enlève", () => {
  let sel = toggleRoot([], animals);
  assert.deepEqual(sel, ["animaux"]);
  assert.equal(cardState(sel, animals), "on");
  sel = toggleRoot(sel, animals);
  assert.deepEqual(sel, []);
});

test("une sous-catégorie seule donne une carte à moitié cochée", () => {
  const sel = toggleChild(["fruits"], animals, "mer");
  assert.deepEqual(sel, ["fruits", "mer"]);
  assert.equal(cardState(sel, animals), "partial");
  assert.equal(cardState(sel, fruits), "on");
  // Toucher la carte à moitié cochée : toute la catégorie
  assert.deepEqual(toggleRoot(sel, animals), ["fruits", "animaux"]);
});

test("enlever une sous-catégorie d'une catégorie entière garde les autres", () => {
  assert.deepEqual(toggleChild(["animaux"], animals, "mer"), ["ferme", "oiseaux"]);
  assert.deepEqual(toggleChild(["mer"], animals, "mer"), []);
});

test("rappel des choix et slugs connus", () => {
  assert.deepEqual(chosenCategories(["mer", "fruits"], [fruits, animals]).map((c) => c.slug), ["fruits", "mer"]);
  assert.deepEqual(chosenCategories(["animaux", "mer"], [animals]).map((c) => c.slug), ["animaux"]);
  assert.deepEqual([...allSlugs([fruits, animals])], ["fruits", "animaux", "ferme", "mer", "oiseaux"]);
});
