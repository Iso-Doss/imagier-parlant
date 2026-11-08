// Small client for the Laravel API. In development, Vite forwards /api to php artisan serve.
const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api/v1"
const TOKEN_KEY = "imagier-admin-token"

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  errors: Record<string, string[]>
  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
  /** First validation message for a field, e.g. "translations.fr.name". */
  field(name: string) {
    return this.errors[name]?.[0]
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn)

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")
  const token = tokenStore.get()
  if (token) headers.set("Authorization", `Bearer ${token}`)

  let body = init.body
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(init.json)
  }

  let res: Response
  try {
    res = await fetch(BASE + path, { ...init, headers, body })
  } catch {
    throw new ApiError(0, "Impossible de joindre l'API. Vérifiez que « php artisan serve » tourne.")
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/login")) onUnauthorized()
    throw new ApiError(res.status, data.message ?? `Erreur ${res.status}`, data.errors ?? {})
  }
  return data as T
}

export function upload<T = unknown>(path: string, field: string, file: File) {
  const form = new FormData()
  form.append(field, file)
  return api<T>(path, { method: "POST", body: form })
}

// ---------- Types returned by the API ----------
export type Language = {
  id: number
  code: string
  name: string
  tts_locale: string
  question: string
  answer_template: string
  is_active: boolean
  sort_order: number
}

export type CategoryTranslations = Record<string, { name: string }>
export type Category = {
  id: number
  slug: string
  emoji: string | null
  color: string | null
  image_url: string | null
  thumb_url: string | null
  sort_order: number
  is_published: boolean
  items_count: number
  translations: CategoryTranslations
}

export type ItemTranslation = { name: string; sentence: string | null; audio_url: string | null }
export type Item = {
  id: number
  category_id: number
  category?: { id: number; slug: string; emoji: string | null }
  emoji: string | null
  image_url: string | null
  thumb_url: string | null
  sort_order: number
  is_published: boolean
  translations: Record<string, ItemTranslation>
}

export type Paginated<T> = {
  data: T[]
  meta: { current_page: number; last_page: number; total: number; per_page: number; from: number | null; to: number | null }
}

export type Stats = {
  categories: number
  items: number
  published_items: number
  items_without_image: number
  languages: { code: string; name: string; is_active: boolean; translated_items: number; missing_translations: number; items_with_audio: number }[]
}

export type User = { id: number; name: string; email: string; is_admin: boolean }

/** PHP turns an empty map into [] — make it an object again. */
export const asMap = <T,>(v: Record<string, T> | T[] | undefined): Record<string, T> =>
  !v || Array.isArray(v) ? {} : v
