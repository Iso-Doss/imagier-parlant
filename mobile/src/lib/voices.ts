// Choix de la voix de synthèse : la plus naturelle parmi celles installées sur l'appareil.
// Sans dépendance : ce fichier est recopié dans le prototype web (npm run sync:prototype).

/** Ce qu'il faut savoir d'une voix (expo-speech sur téléphone, speechSynthesis sur le web). */
export type VoiceInfo = { identifier: string; name: string; language: string; quality?: string; localService?: boolean }

// Voix « fantaisie » d'Apple (chantées, robotiques…) : jamais pour un enfant qui apprend un mot
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|deranged|hysterical|pipe organ)\b/i
// Voix « Eloquence » d'Apple : compréhensibles mais métalliques
const ELOQUENCE = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i
// Indices de voix naturelles : qualité améliorée, premium, neuronale…
const NATURAL = /premium|enhanced|améliorée|neural|natural|naturelle|wavenet|studio|siri/i
// Voix connues pour être agréables, par langue
const KNOWN: Record<string, RegExp> = {
  fr: /\b(amélie|amelie|audrey|aurélie|aurelie|marie|thomas|google français|google francais|denise|henri|vivienne)\b/i,
  en: /\b(samantha|ava|zoe|allison|susan|nicky|evan|daniel|serena|kate|google us english|google uk english female|aria|jenny|guy|libby|sonia)\b/i,
}

const norm = (s: string) => s.toLowerCase().replace("_", "-")

/** Note d'une voix pour une langue (fr-FR, en-US…) ; null si elle ne parle pas cette langue. */
export function scoreVoice(voice: VoiceInfo, locale: string): number | null {
  const want = norm(locale)
  const base = want.slice(0, 2)
  const lang = norm(voice.language || "")
  if (!lang.startsWith(base)) return null
  const name = `${voice.name} ${voice.identifier}`
  if (NOVELTY.test(name)) return null

  let score = 0
  if (lang === want) score += 15 // même pays (fr-FR plutôt que fr-CA)
  if (voice.quality === "Enhanced") score += 40
  if (NATURAL.test(name)) score += 30
  if (KNOWN[base]?.test(name)) score += 12
  if (ELOQUENCE.test(name)) score -= 25
  // Android : « -local » marche sans réseau, « -network » non
  if (/-local\b/i.test(voice.identifier)) score += 5
  if (/-network\b/i.test(voice.identifier) || voice.localService === false) score -= 10
  return score
}

/** Voix d'une langue, de la meilleure à la moins bonne. */
export function rankVoices<V extends VoiceInfo>(voices: V[], locale: string): V[] {
  return voices
    .map((v) => ({ v, s: scoreVoice(v, locale) }))
    .filter((x): x is { v: V; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name))
    .map((x) => x.v)
}

/** La voix choisie par le parent si elle est encore installée, sinon la meilleure. */
export function pickVoice<V extends VoiceInfo>(voices: V[], locale: string, chosen?: string | null): V | null {
  const ranked = rankVoices(voices, locale)
  return (chosen && ranked.find((v) => v.identifier === chosen)) || ranked[0] || null
}

/** Voix de bonne qualité ? (pour l'afficher au parent) */
export function isNaturalVoice(voice: VoiceInfo): boolean {
  return voice.quality === "Enhanced" || NATURAL.test(`${voice.name} ${voice.identifier}`)
}

/** Débit adapté aux petits : un peu plus lent que la normale, encore plus en « lent ». */
export function speechRate(speed: "slow" | "normal", quick = false): number {
  if (quick) return speed === "slow" ? 0.95 : 1.05 // chiffres du compte à rebours
  return speed === "slow" ? 0.72 : 0.88
}
