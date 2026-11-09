// Vérifie AnswerMatcher (mobile et prototype) sur les cas partagés avec l'API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchAnswer, type MatchResult, type Tolerance } from "../src/lib/answerMatcher";

interface Case {
  lang: string;
  answer: string;
  aliases?: string[];
  heard: string | string[];
  tolerance?: Tolerance;
  expected: MatchResult;
  note?: string;
}

const root = join(__dirname, "..", "..");
const { cases } = JSON.parse(readFileSync(join(root, "shared", "answer-cases.json"), "utf8")) as { cases: Case[] };

type Matcher = (heard: string | string[], forms: string[], options: { lang: string; tolerance?: Tolerance }) => MatchResult;

function check(matcher: Matcher) {
  const failures = cases.filter((c) => matcher(c.heard, [c.answer, ...(c.aliases ?? [])], { lang: c.lang, tolerance: c.tolerance }) !== c.expected);
  assert.deepEqual(
    failures.map((c) => `${c.lang} « ${c.answer} » / « ${String(c.heard)} » (${c.tolerance ?? "normal"}) : attendu ${c.expected}, obtenu ${matcher(c.heard, [c.answer, ...(c.aliases ?? [])], { lang: c.lang, tolerance: c.tolerance })}`),
    [],
  );
}

test("mobile : tous les cas partagés", () => check(matchAnswer));

test("prototype : la copie intégrée donne les mêmes résultats", () => {
  const html = readFileSync(join(root, "prototype", "index.html"), "utf8");
  const block = html.match(/\/\/ <answer-matcher>.*\n([\s\S]*?)\/\/ <\/answer-matcher>/);
  assert.ok(block, "bloc // <answer-matcher> introuvable dans prototype/index.html");
  const matcher = new Function(`${block[1]}; return matchAnswer;`)() as Matcher;
  check(matcher);
});
