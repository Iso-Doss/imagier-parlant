import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio"
import * as Speech from "expo-speech"

// Short sound effects, loaded once.
let players: { tick: AudioPlayer; last: AudioPlayer; chime: AudioPlayer } | null = null

export async function initAudio() {
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

/** Says a sentence with the device voice. Resolves when done (or after a safety timeout). */
export function say(text: string, language: string, rate = 0.9): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve() } }
    const guard = setTimeout(finish, 2000 + text.length * 120)
    Speech.stop()
    Speech.speak(text, { language, rate, pitch: 1.1, onDone: finish, onStopped: finish, onError: finish })
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
