// Recopie src/lib/answerMatcher.ts (sans les types) dans prototype/index.html,
// entre les marqueurs // <answer-matcher> et // </answer-matcher>.
// Lancer : npm run sync:prototype — le test vérifie ensuite que les deux donnent les mêmes résultats.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

const root = join(__dirname, "..", "..")
const source = readFileSync(join(root, "mobile", "src", "lib", "answerMatcher.ts"), "utf8")
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: false } })
  .outputText.replace(/^export /gm, "").replace(/^\/\/# sourceMappingURL.*$/m, "").trim()

const file = join(root, "prototype", "index.html")
const html = readFileSync(file, "utf8")
const block = `// <answer-matcher> — copie générée de mobile/src/lib/answerMatcher.ts, ne pas modifier ici\n${js}\n// </answer-matcher>`
const next = html.replace(/\/\/ <answer-matcher>[\s\S]*?\/\/ <\/answer-matcher>/, () => block)
if (next === html && !html.includes("// <answer-matcher>")) throw new Error("Marqueurs absents de prototype/index.html")
writeFileSync(file, next)
console.log("prototype/index.html mis à jour")
