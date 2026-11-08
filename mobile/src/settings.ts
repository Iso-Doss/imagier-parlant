import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useState } from "react"

export type CountStyle = "tick" | "voice" | "silent"
export type Settings = {
  lang: string
  categories: string[]
  count: number
  delay: number
  countStyle: CountStyle
  showWord: boolean
  showTranslation: boolean
  autoNext: boolean
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
