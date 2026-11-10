// Vérifie la partie hors connexion qui ne touche ni au réseau ni au disque.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoriesFromPacks,
  coversCategories,
  fileNameFor,
  formatSize,
  localizeSeries,
  packFiles,
  packState,
  seriesFromPacks,
  type Pack,
} from "../src/lib/packs";

const lang = (code: string) => ({ code, name: code, tts_locale: code, question: "?", answer_template: ":name" });

function pack(slug: string, ids: number[]): Pack {
  return {
    slug,
    version: "abcdef123456",
    size: 1000,
    items_count: ids.length,
    category: { slug, emoji: "🍎", color: null, image_url: null, thumb_url: `http://cdn/${slug}-thumb.webp`, names: { fr: `Cat ${slug}`, en: `Cat ${slug} EN` } },
    languages: [lang("fr"), lang("en")],
    items: ids.map((id) => ({
      id,
      emoji: null,
      image_url: `http://cdn/items/${id}/image/h-full.webp`,
      thumb_url: `http://cdn/items/${id}/image/h-thumb.webp`,
      texts: {
        fr: { name: `nom ${id}`, sentence: `C'est ${id}`, aliases: [], audio_url: `http://cdn/items/${id}/fr.m4a` },
        ...(id % 2 ? { en: { name: `name ${id}`, sentence: null, aliases: [], audio_url: null } } : {}),
      },
    })),
  };
}

// Hasard reproductible
function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

test("une série sans réseau a la bonne longueur et jamais deux fois le même objet de suite", () => {
  const packs = [pack("fruits", [1, 2, 3]), pack("animaux", [10, 11])];
  for (let seed = 1; seed < 50; seed++) {
    const s = seriesFromPacks(packs, { lang: "fr", categories: ["fruits", "animaux"], count: 20 }, {}, seeded(seed));
    assert.ok(s);
    assert.equal(s.items.length, 20);
    assert.equal(s.distinct_items, 5);
    for (let i = 1; i < s.items.length; i++) assert.notEqual(s.items[i].id, s.items[i - 1].id);
  }
});

test("seules les catégories choisies sont jouées, avec les fichiers locaux", () => {
  const packs = [pack("fruits", [1, 2]), pack("animaux", [10])];
  const files = { "http://cdn/items/1/image/h-full.webp": "file:///p/1.webp" };
  const s = seriesFromPacks(packs, { lang: "fr", categories: ["fruits"], count: 4, translation: "en" }, files, seeded(3))!;
  assert.deepEqual(new Set(s.items.map((i) => i.id)), new Set([1, 2]));
  const one = s.items.find((i) => i.id === 1)!;
  assert.equal(one.image_url, "file:///p/1.webp");
  assert.equal(one.sentence, "C'est 1");
  assert.equal(one.translation, "name 1");
  assert.equal(s.items.find((i) => i.id === 2)!.translation, null);
});

test("un objet sans texte dans la langue est laissé de côté", () => {
  const s = seriesFromPacks([pack("fruits", [1, 2, 3, 4])], { lang: "en", categories: [], count: 6 }, {}, seeded(1))!;
  assert.deepEqual(new Set(s.items.map((i) => i.id)), new Set([1, 3]));
  assert.equal(seriesFromPacks([pack("fruits", [2])], { lang: "en", categories: [], count: 3 }, {}), null);
});

test("il faut que toutes les catégories choisies soient téléchargées", () => {
  const packs = [pack("fruits", [1])];
  assert.equal(coversCategories(packs, ["fruits"]), true);
  assert.equal(coversCategories(packs, ["fruits", "animaux"]), false);
  assert.equal(coversCategories(packs, []), true);
  assert.equal(coversCategories([], []), false);
});

test("état d'un pack : absent, à jour, à mettre à jour", () => {
  assert.equal(packState(undefined, { version: "a" }), "absent");
  assert.equal(packState({ version: "a" }, { version: "a" }), "ready");
  assert.equal(packState({ version: "a" }, { version: "b" }), "outdated");
  assert.equal(packState({ version: "a" }, undefined), "ready");
});

test("fichiers à télécharger : images, vignettes, sons, sans doublon", () => {
  const files = packFiles(pack("fruits", [1, 2]));
  assert.equal(files.length, 1 + 2 * 3);
  assert.equal(new Set(files).size, files.length);
  assert.equal(new Set(files.map(fileNameFor)).size, files.length);
  assert.equal(fileNameFor("http://localhost:8333/media/items/1/image/3f9a-full.webp?x=1"), "media_items_1_image_3f9a-full.webp");
});

test("une série en ligne reprend les fichiers déjà téléchargés", () => {
  const online = { language: lang("fr"), count: 1, distinct_items: 1, items: [{ id: 1, emoji: null, image_url: "http://a/1.webp", card_url: null, thumb_url: null, name: "x", sentence: null, audio_url: "http://a/1.m4a" }] };
  const s = localizeSeries(online, { "http://a/1.webp": "file:///1.webp" });
  assert.equal(s.items[0].image_url, "file:///1.webp");
  assert.equal(s.items[0].audio_url, "http://a/1.m4a");
});

test("catégories hors ligne et tailles affichées", () => {
  const cats = categoriesFromPacks([pack("fruits", [1, 2, 3])], "en", { "http://cdn/fruits-thumb.webp": "file:///t.webp" });
  assert.equal(cats[0].name, "Cat fruits EN");
  assert.equal(cats[0].items_count, 2);
  assert.equal(cats[0].thumb_url, "file:///t.webp");
  assert.equal(formatSize(1_234_567, "fr"), "1,2 Mo");
  assert.equal(formatSize(1_234_567, "en"), "1.2 MB");
  assert.equal(formatSize(4_200, "fr"), "4 Ko");
});
