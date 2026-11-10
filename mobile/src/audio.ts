import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio"
import * as Speech from "expo-speech"
import { pickVoice, speechRate, type VoiceInfo } from "./lib/voices"

// Short sound effects, loaded once.
let players: { tick: AudioPlayer; last: AudioPlayer; chime: AudioPlayer } | null = null

export async function initAudio() {
  loadVoices().catch(() => {})
  await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  if (!players) {
    players = {
      tick: createAudioPlayer(require("../assets/sounds/tick.wav")),
      last: createAudioPlayer(require("../assets/sounds/tick-last.wav")),
      chime: createAudioPlayer(require("../assets/sounds/chime.wav")),
    }
  }
}

function play(p: AudioPlayer | undefined) {
  if (!p) return
  try { p.seekTo(0); p.play() } catch { /* ignore */ }
}
export const playTick = (last: boolean) => play(last ? players?.last : players?.tick)
export const playChime = () => play(players?.chime)

// ---------------------------------------------------------------- Voix de synthèse

let installed: VoiceInfo[] = []
let loadingVoices: Promise<VoiceInfo[]> | null = null
/** Choix du parent (langue → identifiant de voix) et débit */
let prefs: { voices: Record<string, string>; speed: "slow" | "normal" } = { voices: {}, speed: "normal" }

/** Voix installées sur l'appareil (le web les donne parfois après un court délai). */
export function loadVoices(): Promise<VoiceInfo[]> {
  loadingVoices ??= (async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { installed = await Speech.getAvailableVoicesAsync() } catch { installed = [] }
      if (installed.length) break
      await new Promise((r) => setTimeout(r, 400))
    }
    if (!installed.length) loadingVoices = null // on réessaiera plus tard
    return installed
  })()
  return loadingVoices
}

export function setVoicePrefs(next: { voices: Record<string, string>; speed: "slow" | "normal" }) {
  prefs = next
}

/** La voix utilisée pour une langue (fr-FR…) : celle du parent, sinon la plus naturelle. */
export function voiceFor(locale: string): VoiceInfo | null {
  return pickVoice(installed, locale, prefs.voices[locale.slice(0, 2)])
}

/** Says a sentence with the chosen device voice. Resolves when done (or after a safety timeout). */
export function say(text: string, language: string, opts: { quick?: boolean; voice?: string } = {}): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve() } }
    const rate = speechRate(prefs.speed, opts.quick)
    const guard = setTimeout(finish, 2000 + (text.length * 120) / rate)
    const voice = opts.voice ?? voiceFor(language)?.identifier
    Speech.stop()
    Speech.speak(text, { language, rate, pitch: 1.05, ...(voice ? { voice } : {}), onDone: finish, onStopped: finish, onError: finish })
  })
}

export const stopSpeaking = () => Speech.stop()

// Prononciations chargées à l'avance (les 3 objets suivants), pour ne jamais attendre le réseau.
const preloaded = new Map<string, AudioPlayer>()
const MAX_PRELOADED = 4

export function preloadRecording(url: string) {
  if (preloaded.has(url)) return
  try {
    preloaded.set(url, createAudioPlayer({ uri: url }))
  } catch {
    return
  }
  // On garde seulement les plus récentes
  while (preloaded.size > MAX_PRELOADED) {
    const [oldest, player] = preloaded.entries().next().value as [string, AudioPlayer]
    preloaded.delete(oldest)
    player.remove()
  }
}

/** Plays a recorded pronunciation. Resolves false if it could not play, so the caller can fall back to the device voice. */
export function playRecording(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    let player: AudioPlayer | null = null
    let settled = false
    let started = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(guard)
      sub?.remove()
      setTimeout(() => player?.remove(), 200)
      resolve(ok)
    }
    // If nothing is heard after 8 s, give up — unless it is playing, then trust it
    const guard = setTimeout(() => finish(started), 8000)
    let sub: { remove: () => void } | undefined
    try {
      player = preloaded.get(url) ?? createAudioPlayer({ uri: url })
      preloaded.delete(url)
      sub = player.addListener("playbackStatusUpdate", (s) => {
        if (s.playing) started = true
        if (s.didJustFinish) finish(true)
      })
      player.play()
    } catch {
      finish(false)
    }
  })
}
