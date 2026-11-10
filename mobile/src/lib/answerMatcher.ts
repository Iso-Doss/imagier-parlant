// Compare ce que l'enfant a dit avec le nom attendu.
// Même algorithme que api/app/Services/AnswerMatcher.php et le prototype web :
// les trois sont testés sur shared/answer-cases.json.

export type Tolerance = "strict" | "normal" | "lenient";
export type MatchResult = "correct" | "close" | "wrong";

const PHRASES: Record<string, string[]> = {
  fr: ["est ce que c est", "est ce que", "c est", "ce sont", "ca c est", "ca", "voila", "je crois que", "je pense que", "il y a"],
  en: ["is it", "it is", "it s", "its", "this is", "that is", "that s", "thats", "i think", "there is", "there s"],
};

const WORDS: Record<string, string[]> = {
  fr: ["le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "mon", "ma", "mes", "ton", "ta", "tes",
    "son", "sa", "ses", "ce", "cet", "cette", "ces", "euh", "heu", "hum", "bah", "ben", "oh", "ah", "et"],
  en: ["the", "a", "an", "my", "your", "this", "that", "some", "um", "uh", "er", "oh", "ah", "and"],
};

export function normalize(text: string, lang: string): string {
  const base = lang.slice(0, 2).toLowerCase();
  let s = ` ${text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")} `;
  s = s.replace(/œ/g, "oe").replace(/æ/g, "ae");
  s = s.replace(/[^a-z0-9]+/g, " ");
  for (const phrase of PHRASES[base] ?? []) {
    s = s.split(` ${phrase} `).join(" ");
  }
  const skip = new Set(WORDS[base] ?? []);
  const words = s.split(" ").filter((w) => w !== "");
  // Un article n'est retiré que s'il est suivi d'un autre mot (« un dé » garde « de »).
  return words.filter((w, i) => !skip.has(w) || (i === words.length - 1 && !words.slice(0, i).some((x) => !skip.has(x)))).join(" ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function replaceAll(s: string, rules: [RegExp, string][]): string {
  for (const [re, to] of rules) s = s.replace(re, to);
  return s;
}

const FR_RULES: [RegExp, string][] = [
  [/ph/g, "f"],
  [/sch|ch|sh/g, "S"],
  [/h/g, ""],
  [/eaux?/g, "o"],
  [/au/g, "o"],
  [/qu/g, "k"],
  [/q/g, "k"],
  [/gu([eiy])/g, "g$1"],
  [/ge([aou])/g, "j$1"],
  [/g([eiy])/g, "j$1"],
  [/c([eiy])/g, "s$1"],
  [/c/g, "k"],
  [/gn/g, "N"],
  [/ou/g, "U"],
  [/oi/g, "WA"],
  [/(ai|ei)n(?![aeiouy])/g, "E"],
  [/(ai|ei)m(?![aeiouy])/g, "E"],
  [/[ae]n(?![aeiouyn])|[ae]m(?![aeiouym])/g, "A"],
  [/on(?![aeiouyn])|om(?![aeiouym])/g, "O"],
  [/(in|yn|un)(?![aeiouyn])|(im|ym|um)(?![aeiouym])/g, "E"],
  [/ai|ei/g, "E"],
  [/(er|et)$/g, "E"],
  [/y/g, "i"],
  [/w/g, "v"],
  [/x$/g, ""],
  [/([aeiouAEOUi])s(?=[aeiouAEOUi])/g, "$1z"],
  [/(.)\1+/g, "$1"],
  [/[sxtdpe]+$/g, ""],
  [/S/g, "s"],
  [/E/g, "e"],
];

const EN_RULES: [RegExp, string][] = [
  [/^kn/g, "n"],
  [/^wr/g, "r"],
  [/^ps/g, "s"],
  [/mb$/g, "m"],
  [/ph/g, "f"],
  [/aw|au/g, "o"],
  [/gh(?![aeiou])/g, ""],
  [/ck/g, "k"],
  [/sch/g, "sk"],
  [/tch|ch|sh/g, "S"],
  [/th/g, "0"],
  [/dg/g, "j"],
  [/c([eiy])/g, "s$1"],
  [/c|q/g, "k"],
  [/g([eiy])/g, "j$1"],
  [/x/g, "ks"],
  [/z/g, "s"],
  [/ee|ea/g, "i"],
  [/oo/g, "u"],
  [/y/g, "i"],
  [/([^aeiou])h/g, "$1"],
  [/(.)\1+/g, "$1"],
  [/(e?s)$/g, ""],
  [/(.)e$/g, "$1"],
];

export function phonetic(word: string, lang: string): string {
  const rules = lang.slice(0, 2).toLowerCase() === "en" ? EN_RULES : FR_RULES;
  return replaceAll(word.replace(/ /g, ""), rules);
}

// Une autre première lettre change souvent le mot (« gâteau » / « bateau ») : 2 points de plus.
// Sauf si l'enfant a avalé le début (« apin » / « lapin ») ou fait une substitution courante
// (« zirafe », « sien », « kitare », « wabbit »).
const SOFT_FIRST = new Set(["zg", "zj", "sc", "kg", "kc", "ck", "wr", "fp"]);

function firstLetterPenalty(heard: string, target: string): number {
  if (heard[0] === target[0] || SOFT_FIRST.has(heard[0] + target[0])) return 0;
  if (heard.length < target.length && target.slice(1, 3).includes(heard[0])) return 0;
  return 2;
}

function threshold(form: string, tolerance: Tolerance): number {
  if (tolerance === "strict") return 0;
  const len = form.replace(/ /g, "").length;
  const base = len <= 3 ? 0 : len <= 5 ? 1 : 2;
  return tolerance === "lenient" ? base + 1 : base;
}

// Les morceaux de la phrase dite (mots collés) qui peuvent correspondre à une forme de n mots.
function windows(heard: string[], size: number): string[] {
  const out: string[] = [];
  for (let n = 1; n <= Math.min(size + 1, heard.length); n++) {
    for (let i = 0; i + n <= heard.length; i++) out.push(heard.slice(i, i + n).join(""));
  }
  return out;
}

export interface MatchOptions {
  lang: string;
  tolerance?: Tolerance;
}

// `heard` : une ou plusieurs transcriptions proposées par la reconnaissance vocale.
// `forms` : le nom attendu et ses variantes acceptées.
export function matchAnswer(heard: string | string[], forms: string[], options: MatchOptions): MatchResult {
  const tolerance = options.tolerance ?? "normal";
  const lang = options.lang;
  const candidates = (Array.isArray(heard) ? heard : [heard]).map((h) => normalize(h, lang)).filter((h) => h !== "");
  const targets = [...new Set(forms.map((f) => normalize(f, lang)).filter((f) => f !== ""))];
  let close = false;

  for (const target of targets) {
    const compact = target.replace(/ /g, "");
    const limit = threshold(target, tolerance);
    const key = phonetic(compact, lang);
    for (const candidate of candidates) {
      const said = candidate.replace(/ /g, "");
      for (const piece of windows(candidate.split(" "), target.split(" ").length)) {
        if (piece === compact) return "correct";
        if (tolerance === "strict") continue;
        const distance = levenshtein(piece, compact) + firstLetterPenalty(piece, compact);
        const sound = phonetic(piece, lang);
        if (key.length >= 2 && sound === key) return "correct";
        // Un morceau d'une phrase plus longue (« shirt » dans « t-shirt », « stop » dans « bus stop »)
        // doit être exact : à peu près, ce serait souvent un autre mot.
        if (piece !== said) {
          if (distance <= limit + 1 && distance / compact.length <= 0.34) close = true;
          continue;
        }
        // Au-delà d'une lettre d'écart, il faut aussi que les deux mots sonnent presque pareil.
        if (distance <= Math.min(limit, 1)) return "correct";
        if (distance <= limit && levenshtein(sound, key) <= (tolerance === "lenient" ? 2 : 1)) return "correct";
        if (distance <= limit + 1 && distance / compact.length <= 0.34) close = true;
      }
    }
  }

  return close ? "close" : "wrong";
}

// Mots à donner à la reconnaissance vocale pour l'aider (nom sans article et variantes).
export function hintsFor(forms: string[], lang: string): string[] {
  return [...new Set(forms.flatMap((f) => [f, normalize(f, lang)]).filter((f) => f !== ""))];
}
