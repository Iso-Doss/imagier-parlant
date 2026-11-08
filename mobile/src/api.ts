import Constants from "expo-constants"
import { Platform } from "react-native"

/**
 * Where the Laravel API lives.
 * 1. EXPO_PUBLIC_API_URL in .env wins (use it for staging / production).
 * 2. In development on a phone, use the computer that runs the Expo server, port 8000
 *    (start Laravel with: php artisan serve --host=0.0.0.0).
 * 3. Otherwise localhost.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  const host = Constants.expoConfig?.hostUri?.split(":")[0]
  if (Platform.OS !== "web" && host) return `http://${host}:8000`
  return "http://localhost:8000"
}

export const API_URL = resolveBaseUrl()

/**
 * En développement, les adresses des médias pointent vers « localhost » (API ou S3 local).
 * Un téléphone ne peut pas joindre ce nom : on le remplace par la machine de l'API,
 * en gardant le port (8000 pour l'API, 8333 pour le S3 local).
 */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const apiHost = API_URL.replace(/^https?:\/\//, "").replace(/[:/].*$/, "")
  return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/, `$1${apiHost}`)
}

export type Language = { code: string; name: string; tts_locale: string; question: string; answer_template: string }
export type Category = { id: number; slug: string; name: string | null; emoji: string | null; color: string | null; image_url: string | null; thumb_url: string | null; items_count: number }
export type Item = {
  id: number
  emoji: string | null
  image_url: string | null
  card_url: string | null
  thumb_url: string | null
  name: string | null
  sentence: string | null
  audio_url: string | null
  translation?: string | null
  category?: { slug: string; name: string | null }
}
export type Series = { language: Language; count: number; distinct_items: number; items: Item[] }

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/v1${path}${qs ? `?${qs}` : ""}`, { headers: { Accept: "application/json" } })
  } catch {
    throw new Error(`Impossible de joindre le serveur (${API_URL}).`)
  }
  if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}.`)
  return res.json()
}

export const fetchLanguages = () => get<{ data: Language[] }>("/languages").then((r) => r.data)
export const fetchCategories = (lang: string) => get<{ data: Category[] }>("/categories", { lang }).then((r) => r.data)
export const fetchSeries = (opts: { lang: string; categories: string[]; count: number; translation?: string }) =>
  get<Series>("/series", { lang: opts.lang, categories: opts.categories.join(","), count: opts.count, translation: opts.translation })
