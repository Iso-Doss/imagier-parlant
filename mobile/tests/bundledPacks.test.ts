// Version web sans serveur : le catalogue intégré, présenté comme des packs hors connexion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packsFromCatalog, type Catalog } from "../src/lib/bundledPacks";
import { categoriesFromPacks, coversCategories, seriesFromPacks } from "../src/lib/packs";

const read = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");
const source = JSON.parse(read("..", "api", "database", "seeders", "data", "catalog.json")) as Catalog;
const packs = packsFromCatalog(source);

test("la copie intégrée est le catalogue de l'API (npm run sync:prototype)", () => {
  assert.equal(read("src", "data", "catalog.json"), read("..", "api", "database", "seeders", "data", "catalog.json"));
});

test("un pack par catégorie principale, tous les objets, identifiants uniques", () => {
  const roots = source.categories.filter((c) => !c.parent);
  assert.deepEqual(packs.map((p) => p.slug), roots.map((c) => c.slug));
  const all = source.categories.reduce((n, c) => n + c.items.length, 0);
  const ids = packs.flatMap((p) => p.items.map((it) => it.id));
  assert.equal(ids.length, all);
  assert.equal(new Set(ids).size, all);
  const animals = packs.find((p) => p.slug === "animaux")!;
  assert.deepEqual(animals.children?.map((c) => c.slug), source.categories.filter((c) => c.parent === "animaux").map((c) => c.slug));
});

test("phrases : celle du catalogue, sinon « C'est … » / « It's … »", () => {
  const apple = packs.flatMap((p) => p.items).find((it) => it.texts.en.name === "an apple")!;
  assert.equal(apple.texts.fr.sentence, "C'est une pomme");
  assert.equal(apple.texts.en.sentence, "It's an apple");
  const cherries = packs.flatMap((p) => p.items).find((it) => it.texts.fr.name === "des cerises")!;
  assert.equal(cherries.texts.fr.sentence, "Ce sont des cerises");
});

test("l'accueil et la partie marchent sans serveur, sous-catégories comprises", () => {
  const cats = categoriesFromPacks(packs, "fr", {});
  assert.equal(cats.length, packs.length);
  assert.ok(coversCategories(packs, ["mer", "fruits"]));
  const s = seriesFromPacks(packs, { lang: "en", categories: ["mer"], count: 10, translation: "fr" }, {})!;
  assert.equal(s.items.length, 10);
  assert.ok(s.items.every((it) => it.category?.slug === "mer" && it.translation));
  assert.equal(s.language.code, "en");
});
