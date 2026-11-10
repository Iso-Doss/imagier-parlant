// Recopie dans prototype/index.html (sans les types) le code partagé avec l'app :
// - src/lib/answerMatcher.ts entre // <answer-matcher> et // </answer-matcher>
// - src/lib/voices.ts entre // <voice-picker> et // </voice-picker>
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

writeFileSync(file, html)
console.log("prototype/index.html mis à jour")
