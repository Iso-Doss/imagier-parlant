// Vérifie le catalogue de départ (api/database/seeders/data/catalog.json) avant qu'il parte en base.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchAnswer } from "../src/lib/answerMatcher";

type Item = { emoji: string; fr: string; en: string; fr_sentence?: string; en_sentence?: string; fr_aliases?: string[]; en_aliases?: string[] };
type Category = { slug: string; emoji: string; color: string; names: { fr: string; en: string }; items: Item[] };

const file = join(__dirname, "..", "..", "api", "database", "seeders", "data", "catalog.json");
const catalog = JSON.parse(readFileSync(file, "utf8")) as { categories: Category[] };
const all = catalog.categories.flatMap((c) => c.items.map((it) => ({ ...it, cat: c.slug })));

// Comme Str::slug de Laravel : la référence d'un objet en base
const slug = (s: string) => s.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const forms = (it: Item, lang: "fr" | "en") => [it[lang], ...(it[`${lang}_aliases`] ?? [])];

test("taille du catalogue", () => {
  assert.ok(catalog.categories.length >= 25, `${catalog.categories.length} catégories`);
  assert.ok(all.length >= 450, `${all.length} objets`);
  for (const c of catalog.categories) assert.ok(c.items.length >= 8, `${c.slug} : seulement ${c.items.length} objets`);
});

test("catégories : slug, noms et couleur", () => {
  const slugs = catalog.categories.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slug en double");
  for (const c of catalog.categories) {
    assert.match(c.slug, /^[a-z][a-z0-9-]*$/, c.slug);
    assert.ok(c.names.fr && c.names.en, `${c.slug} : nom manquant`);
    assert.match(c.color, /^#[0-9A-F]{6}$/i, `${c.slug} : couleur`);
  }
});

test("chaque émoji n'apparaît qu'une fois et c'est bien un émoji", () => {
  const seen = new Map<string, string>();
  for (const it of all) {
    assert.match(it.emoji, /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u, `${it.fr} : « ${it.emoji} » n'est pas un émoji`);
    assert.ok(!seen.has(it.emoji), `${it.emoji} utilisé pour « ${seen.get(it.emoji)} » et « ${it.fr} »`);
    seen.set(it.emoji, it.fr);
  }
});

test("références uniques dans chaque catégorie (nom anglais)", () => {
  for (const c of catalog.categories) {
    const refs = c.items.map((it) => slug(it.en));
    const dup = refs.find((r, i) => refs.indexOf(r) !== i);
    assert.equal(dup, undefined, `${c.slug} : deux objets ont la référence ${c.slug}-${dup}`);
  }
});

test("français : un article, ou une phrase à dire", () => {
  const article = /^(un |une |des |du |de la |de l'|le |la |les |l')/;
  for (const it of all) {
    assert.ok(article.test(it.fr) || it.fr_sentence, `« ${it.fr} » : sans article, il faut une phrase (fr_sentence)`);
    if (/^(des|les) /.test(it.fr)) assert.match(it.fr_sentence ?? "", /^Ce sont /, `« ${it.fr} » : pluriel, phrase « Ce sont … » attendue`);
    assert.equal(it.fr, it.fr.trim());
  }
});

test("anglais : a / an au bon endroit", () => {
  const vowelSound = (w: string) => /^[aeio]/i.test(w) || /^u(?!ni|se|ku)/i.test(w) || /^hour|^honest/i.test(w);
  for (const it of all) {
    const m = it.en.match(/^(a|an) (\S+)/);
    if (!m) continue;
    const want = vowelSound(m[2]) ? "an" : "a";
    assert.equal(m[1], want, `« ${it.en} » : « ${want} ${m[2]} » attendu`);
  }
});

test("au micro, le nom et ses variantes sont reconnus", () => {
  for (const it of all) {
    for (const lang of ["fr", "en"] as const) {
      for (const form of forms(it, lang)) assert.equal(matchAnswer(form, forms(it, lang), { lang }), "correct", `${lang} « ${form} »`);
    }
  }
});

// Mots d'un nom, sans article ni pluriel : « une voiture de police » → voiture, police
const STOP = new Set(["un", "une", "des", "du", "de", "la", "le", "les", "l", "d", "a", "an", "the", "of", "and", "et"]);
const words = (s: string) => slug(s).split("-").filter((w) => w && !STOP.has(w)).map((w) => w.replace(/s$/, ""));
/** « une voiture de police » contient « une voiture » : un nom plus précis, accepté sans souci. */
const moreSpecific = (longer: string, shorter: string) => words(shorter).every((w) => words(longer).includes(w));


test("au micro, deux objets d'une même catégorie ne se confondent pas", () => {
  const clashes: string[] = [];
  for (const c of catalog.categories) {
    for (const a of c.items) for (const b of c.items) {
      if (a === b) continue;
      for (const lang of ["fr", "en"] as const) {
        if (moreSpecific(b[lang], a[lang])) continue
        const key = `${c.slug} (${lang}) : ${b[lang]} → ${a[lang]}`;
        if (matchAnswer(b[lang], forms(a, lang), { lang }) === "correct") clashes.push(key);
      }
    }
  }
  assert.deepEqual(clashes, [], "dire le premier nom serait accepté pour le second");
});

test("prototype : la copie intégrée a le même catalogue", () => {
  const html = readFileSync(join(__dirname, "..", "..", "prototype", "index.html"), "utf8");
  const block = html.match(/\/\/ <catalog>.*\n([\s\S]*?)\/\/ <\/catalog>/);
  assert.ok(block, "bloc // <catalog> introuvable dans prototype/index.html (npm run sync:prototype)");
  const cats = new Function(`${block[1]}; return CATS;`)() as { id: string; items: [string, string, string, string?, string?, { fr: string[]; en: string[] }?][] }[];
  assert.deepEqual(cats.map((c) => c.id), catalog.categories.map((c) => c.slug));
  assert.deepEqual(cats.flatMap((c) => c.items.map((i) => `${i[0]} ${i[1]} ${i[2]} ${i[3] ?? ""} ${i[4] ?? ""} ${JSON.stringify(i[5]?.fr ?? [])}`)),
    all.map((i) => `${i.emoji} ${i.fr} ${i.en} ${i.fr_sentence ?? ""} ${i.en_sentence ?? ""} ${JSON.stringify(i.fr_aliases ?? [])}`));
});
