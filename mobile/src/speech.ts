// Écoute de la réponse de l'enfant, sur l'appareil.
// La voix n'est ni enregistrée ni envoyée : seules les transcriptions passent par ce fichier,
// et elles ne servent qu'à la comparaison (voir lib/answerMatcher.ts).
import type { ExpoSpeechRecognitionErrorCode } from "expo-speech-recognition"

type Module = typeof import("expo-speech-recognition")

// Le module natif n'existe pas dans Expo Go : l'app passe alors au mode parent ✓/✗.
let native: Module | null = null
try {
  native = require("expo-speech-recognition") as Module
  if (!native.ExpoSpeechRecognitionModule) native = null
} catch {
  native = null
}

export type MicPermission = "granted" | "denied" | "undetermined" | "unavailable"

/** La reconnaissance existe-t-elle sur cet appareil (et dans cette version de l'app) ? */
export function voiceAvailable(): boolean {
  try {
    return !!native && native.ExpoSpeechRecognitionModule.isRecognitionAvailable()
  } catch {
    return false
  }
}

/** Traitement garanti sur l'appareil (sinon le parent est prévenu). */
export function onDeviceSupported(): boolean {
  try {
    return !!native && native.ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()
  } catch {
    return false
  }
}

export async function micPermission(): Promise<MicPermission> {
  if (!voiceAvailable()) return "unavailable"
  try {
    const p = await native!.ExpoSpeechRecognitionModule.getPermissionsAsync()
    return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied"
  } catch {
    return "unavailable"
  }
}

/** À n'appeler que depuis l'espace parent, après l'explication. */
export async function requestMicPermission(): Promise<MicPermission> {
  if (!voiceAvailable()) return "unavailable"
  try {
    const p = await native!.ExpoSpeechRecognitionModule.requestPermissionsAsync()
    return p.granted ? "granted" : "denied"
  } catch {
    return "unavailable"
  }
}

export type ListenHandlers = {
  /** Une ou plusieurs transcriptions (partielles ou finales). */
  onHeard: (transcripts: string[]) => void
  /** Volume entre 0 et 1, pour animer le micro. */
  onVolume?: (level: number) => void
  /** La reconnaissance ne peut pas fonctionner : il faut passer au mode parent. */
  onUnavailable: () => void
}

// Erreurs qui veulent dire « ça ne marchera pas sur cet appareil » (et pas « rien entendu »).
const FATAL: ExpoSpeechRecognitionErrorCode[] = ["not-allowed", "service-not-allowed", "language-not-supported", "audio-capture", "network"]

/**
 * Écoute dans la langue de la partie jusqu'à l'appel de la fonction renvoyée.
 * `hints` : le nom attendu et ses variantes, pour aider la reconnaissance.
 */
export function listen(locale: string, hints: string[], handlers: ListenHandlers): () => void {
  if (!native || !voiceAvailable()) {
    handlers.onUnavailable()
    return () => {}
  }
  const m = native.ExpoSpeechRecognitionModule
  let stopped = false
  const onDevice = onDeviceSupported()

  const subs = [
    m.addListener("result", (e) => {
      if (stopped) return
      const transcripts = e.results.map((r) => r.transcript).filter((t) => t.trim() !== "")
      if (transcripts.length > 0) handlers.onHeard(transcripts)
    }),
    m.addListener("error", (e) => {
      if (stopped) return
      if (FATAL.includes(e.error)) handlers.onUnavailable()
    }),
    m.addListener("volumechange", (e) => {
      if (!stopped) handlers.onVolume?.(Math.max(0, Math.min(1, e.value / 10)))
    }),
  ]

  try {
    m.start({
      lang: locale,
      interimResults: true,
      maxAlternatives: 5,
      continuous: true,
      contextualStrings: hints,
      requiresOnDeviceRecognition: onDevice,
      addsPunctuation: false,
      volumeChangeEventOptions: { enabled: !!handlers.onVolume, intervalMillis: 120 },
      // Rien n'est gardé : pas de fichier audio.
      recordingOptions: { persist: false },
      androidIntentOptions: { EXTRA_LANGUAGE_MODEL: "web_search" },
    })
  } catch {
    handlers.onUnavailable()
  }

  return () => {
    if (stopped) return
    stopped = true
    subs.forEach((s) => s.remove())
    try {
      m.abort()
    } catch {
      // déjà arrêtée
    }
  }
}
