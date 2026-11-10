// Vérifie le choix de la voix (mobile et prototype : même fichier recopié).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isNaturalVoice, pickVoice, rankVoices, scoreVoice, speechRate, type VoiceInfo } from "../src/lib/voices";

const v = (identifier: string, name: string, language: string, quality = "Default", localService?: boolean): VoiceInfo =>
  ({ identifier, name, language, quality, localService });

// Voix typiques d'un iPhone
const ios = [
  v("com.apple.speech.synthesis.voice.Albert", "Albert", "en-US"),
  v("com.apple.eloquence.fr-FR.Grandpa", "Grandpa", "fr-FR"),
  v("com.apple.voice.compact.fr-FR.Thomas", "Thomas", "fr-FR"),
  v("com.apple.voice.compact.fr-CA.Amelie", "Amélie", "fr-CA"),
  v("com.apple.voice.premium.fr-FR.Audrey", "Audrey (Premium)", "fr-FR", "Enhanced"),
  v("com.apple.voice.compact.en-US.Samantha", "Samantha", "en-US"),
  v("com.apple.voice.enhanced.en-GB.Serena", "Serena (Enhanced)", "en-GB", "Enhanced"),
];

test("la voix premium passe devant, les voix fantaisie sont écartées", () => {
  assert.equal(pickVoice(ios, "fr-FR")?.name, "Audrey (Premium)");
  assert.deepEqual(rankVoices(ios, "fr-FR").map((x) => x.name), ["Audrey (Premium)", "Thomas", "Amélie", "Grandpa"]);
  assert.equal(scoreVoice(ios[0], "en-US"), null);
});

test("même pays avant une autre variante de la langue, à qualité égale", () => {
  const list = [v("a", "Amélie", "fr-CA"), v("b", "Thomas", "fr-FR")];
  assert.equal(pickVoice(list, "fr-FR")?.name, "Thomas");
  assert.equal(pickVoice(list, "fr-CA")?.name, "Amélie");
});

test("une voix améliorée d'un autre pays bat une voix simple du bon pays", () => {
  assert.equal(pickVoice(ios, "en-US")?.name, "Serena (Enhanced)");
});

test("le choix du parent est gardé tant que la voix existe", () => {
  assert.equal(pickVoice(ios, "fr-FR", "com.apple.voice.compact.fr-FR.Thomas")?.name, "Thomas");
  assert.equal(pickVoice(ios, "fr-FR", "voix-disparue")?.name, "Audrey (Premium)");
  assert.equal(pickVoice(ios, "es-ES"), null);
});

test("Android : une voix locale passe devant une voix réseau", () => {
  const android = [v("fr-fr-x-frd-network", "fr-fr-x-frd-network", "fr-FR"), v("fr-fr-x-frc-local", "fr-fr-x-frc-local", "fr-FR")];
  assert.equal(pickVoice(android, "fr-FR")?.identifier, "fr-fr-x-frc-local");
});

test("web : voix naturelles des navigateurs reconnues", () => {
  const web = [
    v("Microsoft Paul - French (France)", "Microsoft Paul - French (France)", "fr-FR", "Default", true),
    v("Microsoft Denise Online (Natural) - French (France)", "Microsoft Denise Online (Natural) - French (France)", "fr-FR", "Default", false),
    v("Google français", "Google français", "fr-FR", "Default", false),
  ];
  assert.equal(pickVoice(web, "fr-FR")?.name, "Microsoft Denise Online (Natural) - French (France)");
  assert.equal(isNaturalVoice(web[1]), true);
  assert.equal(isNaturalVoice(web[0]), false);
  assert.equal(isNaturalVoice(ios[4]), true);
});

test("débit plus lent pour les petits", () => {
  assert.ok(speechRate("slow") < speechRate("normal"));
  assert.ok(speechRate("normal") < 1);
  assert.ok(speechRate("normal", true) > speechRate("normal"));
});

test("prototype : la copie intégrée classe les voix pareil", () => {
  const html = readFileSync(join(__dirname, "..", "..", "prototype", "index.html"), "utf8");
  const block = html.match(/\/\/ <voice-picker>.*\n([\s\S]*?)\/\/ <\/voice-picker>/);
  assert.ok(block, "bloc // <voice-picker> introuvable dans prototype/index.html");
  const proto = new Function(`${block[1]}; return rankVoices;`)() as typeof rankVoices;
  for (const locale of ["fr-FR", "en-US", "en-GB", "fr-CA"]) {
    assert.deepEqual(proto(ios, locale).map((x) => x.identifier), rankVoices(ios, locale).map((x) => x.identifier), locale);
  }
});
