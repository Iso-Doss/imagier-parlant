import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useState } from "react"
import type { Tolerance } from "./lib/answerMatcher"
import type { ThemePref } from "./theme"

export type CountStyle = "tick" | "voice" | "silent"
/** Comment l'enfant répond : au micro, le parent valide ✓/✗, ou on regarde seulement (comme la vidéo) */
export type AnswerMode = "voice" | "parent" | "watch"
export type Settings = {
  lang: string
  categories: string[]
  count: number
  delay: number
  countStyle: CountStyle
  showWord: boolean
  showTranslation: boolean
  autoNext: boolean
  answerMode: AnswerMode
  /** Sévérité de la comparaison au micro */
  tolerance: Tolerance
  /** Voix choisie par le parent, par langue (fr, en) ; absente = la plus naturelle */
  voices: Record<string, string>
  /** Débit de la voix */
  speechSpeed: "slow" | "normal"
  /** Thème : celui du téléphone, clair ou sombre */
  theme: ThemePref
}

export const DEFAULTS: Settings = {
  lang: "fr",
  categories: ["fruits", "animaux", "maison"],
  count: 10,
  delay: 5,
  countStyle: "tick",
  showWord: true,
  showTranslation: false,
  autoNext: true,
  answerMode: "watch",
  tolerance: "normal",
  voices: {},
  speechSpeed: "normal",
  theme: "system",
}

const KEY = "imagier-settings-v1"

/** Settings kept on the device between launches. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSettings({ ...DEFAULTS, ...JSON.parse(raw) }))
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch }
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {})
      return next
    })

  return { settings, update, ready }
}
