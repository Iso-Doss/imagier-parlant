// Recopie dans prototype/index.html (sans les types) le code partagé avec l'app :
// - src/lib/answerMatcher.ts entre // <answer-matcher> et // </answer-matcher>
// - src/lib/voices.ts entre // <voice-picker> et // </voice-picker>
// - le catalogue de départ (api/database/seeders/data/catalog.json) entre // <catalog> et // </catalog>
// Lancer : npm run sync:prototype — les tests vérifient ensuite que les copies donnent les mêmes résultats.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

const root = join(__dirname, "..", "..")
const file = join(root, "prototype", "index.html")
let html = readFileSync(file, "utf8")

for (const [marker, source] of [["answer-matcher", "answerMatcher.ts"], ["voice-picker", "voices.ts"]] as const) {
  const code = readFileSync(join(root, "mobile", "src", "lib", source), "utf8")
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: false } })
    .outputText.replace(/^export /gm, "").replace(/^\/\/# sourceMappingURL.*$/m, "").trim()
  const block = `// <${marker}> — copie générée de mobile/src/lib/${source}, ne pas modifier ici\n${js}\n// </${marker}>`
  const pattern = new RegExp(`// <${marker}>[\\s\\S]*?// </${marker}>`)
  if (!pattern.test(html)) throw new Error(`Marqueurs <${marker}> absents de prototype/index.html`)
  html = html.replace(pattern, () => block)
}

// Catalogue de départ : même fichier que le seeder de l'API, en format compact
type CatalogItem = { emoji: string; fr: string; en: string; fr_sentence?: string; en_sentence?: string; fr_aliases?: string[]; en_aliases?: string[] }
type CatalogCategory = { slug: string; emoji: string; names: { fr: string; en: string }; items: CatalogItem[] }
const catalog = JSON.parse(readFileSync(join(root, "api", "database", "seeders", "data", "catalog.json"), "utf8")) as { categories: CatalogCategory[] }
const row = (it: CatalogItem) => {
  const aliases = it.fr_aliases || it.en_aliases ? { fr: it.fr_aliases ?? [], en: it.en_aliases ?? [] } : undefined
  const cells: unknown[] = [it.emoji, it.fr, it.en, it.fr_sentence ?? null, it.en_sentence ?? null, aliases]
  while (cells.length > 3 && (cells[cells.length - 1] === null || cells[cells.length - 1] === undefined)) cells.pop()
  return JSON.stringify(cells)
}
const cats = catalog.categories.map((c) => ` {id:${JSON.stringify(c.slug)}, em:${JSON.stringify(c.emoji)}, fr:${JSON.stringify(c.names.fr)}, en:${JSON.stringify(c.names.en)}, items:[\n  ${c.items.map(row).join(",\n  ")}]}`)
const catalogBlock = `// <catalog> — copie générée de api/database/seeders/data/catalog.json, ne pas modifier ici\nconst CATS = [\n${cats.join(",\n")}\n];\n// </catalog>`
if (!/\/\/ <catalog>[\s\S]*?\/\/ <\/catalog>/.test(html)) throw new Error("Marqueurs <catalog> absents de prototype/index.html")
html = html.replace(/\/\/ <catalog>[\s\S]*?\/\/ <\/catalog>/, () => catalogBlock)

writeFileSync(file, html)
console.log("prototype/index.html mis à jour")
