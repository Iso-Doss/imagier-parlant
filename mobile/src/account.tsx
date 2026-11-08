import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Platform } from "react-native"
import { API_URL } from "./api"

/**
 * Compte parent (facultatif) : jeton gardé dans le trousseau du téléphone (SecureStore),
 * profils enfant, et file des séries jouées à envoyer au serveur, même plus tard
 * si le téléphone était hors ligne.
 */

export type Profile = { id: string; nickname: string; avatar: string; age_band: string; locale: string | null; settings: Record<string, unknown> }
export type Account = { id: number; email: string; locale: string; email_verified: boolean; profiles: Profile[] }
export type AnswerResult = "correct" | "wrong" | "silent" | "skipped"
export type PlayedSession = {
  id: string
  profileId: string
  locale: string
  mode: "voice" | "parent" | "watch"
  categories: string[]
  started_at: string
  ended_at: string
  answers: { item_id: number; result: AnswerResult; response_ms?: number | null }[]
}
export type Progress = {
  seen: number
  known: number
  learning: number
  week: { sessions: number; minutes: number; answers: number }
  categories: { slug: string; name: string | null; seen: number; known: number }[]
  to_review: { id: number; name: string | null; emoji: string | null; image_url: string | null; thumb_url: string | null }[]
}

export const AVATARS: Record<string, string> = {
  ours: "🐻", lapin: "🐰", chat: "🐱", chien: "🐶", renard: "🦊", hibou: "🦉",
  lion: "🦁", panda: "🐼", grenouille: "🐸", baleine: "🐳", tortue: "🐢", licorne: "🦄",
}
export const AGE_BANDS = ["2-3", "4-5", "6-7"] as const
/** Temps de réflexion conseillé selon l'âge (secondes) */
export const DELAY_FOR_AGE: Record<string, number> = { "2-3": 8, "4-5": 5, "6-7": 3 }

const TOKEN_KEY = "imagier-token"
const PROFILE_KEY = "imagier-active-profile"
const QUEUE_KEY = "imagier-pending-sessions"

// SecureStore n'existe pas sur le web : on retombe sur le stockage du navigateur
const tokenStore = {
  get: () => (Platform.OS === "web" ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY)),
  set: (v: string) => (Platform.OS === "web" ? AsyncStorage.setItem(TOKEN_KEY, v) : SecureStore.setItemAsync(TOKEN_KEY, v)),
  clear: () => (Platform.OS === "web" ? AsyncStorage.removeItem(TOKEN_KEY) : SecureStore.deleteItemAsync(TOKEN_KEY)),
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public errors: Record<string, string[]> = {}, public reason?: string) {
    super(message)
  }
  field(name: string) { return this.errors[name]?.[0] }
}

export async function request<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null; lang?: string } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: opts.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Language": opts.lang ?? "fr",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError("Impossible de joindre le serveur.", 0)
  }
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(json.message ?? `Erreur ${res.status}`, res.status, json.errors ?? {}, json.reason)
  return json as T
}

const deviceName = () => `${Platform.OS === "ios" ? "iPhone / iPad" : Platform.OS === "android" ? "Android" : "Navigateur"} · Imagier`

type Ctx = {
  ready: boolean
  token: string | null
  account: Account | null
  profiles: Profile[]
  activeProfile: Profile | null
  selectProfile: (id: string | null) => void
  register: (email: string, password: string, lang: string) => Promise<void>
  verify: (email: string, code: string) => Promise<void>
  resend: (email: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  forgot: (email: string) => Promise<void>
  reset: (email: string, code: string, password: string) => Promise<void>
  logout: () => Promise<void>
  deleteAccount: (password: string) => Promise<void>
  saveProfile: (data: Partial<Profile>, id?: string) => Promise<Profile>
  removeProfile: (id: string) => Promise<void>
  progress: (id: string, lang: string) => Promise<Progress>
  recordSession: (s: PlayedSession) => Promise<void>
  refresh: () => Promise<void>
}

const AccountContext = createContext<Ctx | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const signedIn = useCallback(async (t: string, a: Account) => {
    await tokenStore.set(t)
    setToken(t)
    setAccount(a)
    if (a.profiles.length === 1) selectProfile(a.profiles[0].id)
    flush(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signedOut = useCallback(async () => {
    await tokenStore.clear().catch(() => {})
    await AsyncStorage.multiRemove([PROFILE_KEY, QUEUE_KEY]).catch(() => {})
    setToken(null)
    setAccount(null)
    setActiveId(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const me = await request<{ data: Account }>("/me", { token })
      setAccount(me.data)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await signedOut() // compte supprimé ou jeton expiré
    }
  }, [token, signedOut])

  // Démarrage : relire le jeton, le profil choisi, et envoyer les séries en attente
  useEffect(() => {
    ;(async () => {
      try {
        const [t, p] = await Promise.all([tokenStore.get(), AsyncStorage.getItem(PROFILE_KEY)])
        if (t) {
          setToken(t)
          setActiveId(p)
          const me = await request<{ data: Account }>("/me", { token: t }).catch((e) => {
            if (e instanceof ApiError && e.status === 401) { signedOut(); return null }
            throw e
          })
          if (me) { setAccount(me.data); flush(t) }
        }
      } catch {
        // hors ligne : on garde le jeton, on réessaiera
      } finally {
        setReady(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectProfile(id: string | null) {
    setActiveId(id)
    if (id) AsyncStorage.setItem(PROFILE_KEY, id).catch(() => {})
    else AsyncStorage.removeItem(PROFILE_KEY).catch(() => {})
  }

  async function readQueue(): Promise<PlayedSession[]> {
    try { return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? "[]") } catch { return [] }
  }

  /** Envoie les séries en attente ; celles qui échouent (réseau) restent pour la prochaine fois. */
  async function flush(t: string | null = token) {
    if (!t) return
    const queue = await readQueue()
    const left: PlayedSession[] = []
    for (const s of queue) {
      try {
        const { profileId, ...body } = s
        await request(`/me/profiles/${profileId}/sessions`, { method: "POST", body, token: t })
      } catch (e) {
        // Erreur définitive (profil supprimé, données refusées) : on abandonne cette série
        if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.status === 429) left.push(s)
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(left)).catch(() => {})
  }

  const value = useMemo<Ctx>(() => {
    const profiles = account?.profiles ?? []
    return {
      ready, token, account, profiles,
      activeProfile: profiles.find((p) => p.id === activeId) ?? null,
      selectProfile,
      register: async (email, password, lang) => {
        await request("/account/register", { method: "POST", body: { email, password, locale: lang, accept_terms: true }, lang })
      },
      verify: async (email, code) => {
        const r = await request<{ token: string; user: Account }>("/account/verify", { method: "POST", body: { email, code, device_name: deviceName() } })
        await signedIn(r.token, r.user)
      },
      resend: async (email) => { await request("/account/verify/resend", { method: "POST", body: { email } }) },
      login: async (email, password) => {
        const r = await request<{ token: string; user: Account }>("/account/login", { method: "POST", body: { email, password, device_name: deviceName() } })
        await signedIn(r.token, r.user)
      },
      forgot: async (email) => { await request("/account/password/forgot", { method: "POST", body: { email } }) },
      reset: async (email, code, password) => {
        const r = await request<{ token: string; user: Account }>("/account/password/reset", { method: "POST", body: { email, code, password, device_name: deviceName() } })
        await signedIn(r.token, r.user)
      },
      logout: async () => {
        await request("/account/logout", { method: "POST", token }).catch(() => {})
        await signedOut()
      },
      deleteAccount: async (password) => {
        await request("/me", { method: "DELETE", body: { password }, token })
        await signedOut()
      },
      saveProfile: async (data, id) => {
        const r = await request<{ data: Profile }>(id ? `/me/profiles/${id}` : "/me/profiles", { method: id ? "PATCH" : "POST", body: data, token })
        setAccount((a) => a && { ...a, profiles: id ? a.profiles.map((p) => (p.id === id ? r.data : p)) : [...a.profiles, r.data] })
        if (!id) selectProfile(r.data.id)
        return r.data
      },
      removeProfile: async (id) => {
        await request(`/me/profiles/${id}`, { method: "DELETE", token })
        setAccount((a) => a && { ...a, profiles: a.profiles.filter((p) => p.id !== id) })
        if (activeId === id) selectProfile(null)
      },
      progress: async (id, lang) => (await request<{ data: Progress }>(`/me/profiles/${id}/progress?lang=${lang}`, { token, lang })).data,
      recordSession: async (s) => {
        const queue = await readQueue()
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue.filter((q) => q.id !== s.id), s].slice(-50))).catch(() => {})
        await flush()
      },
      refresh,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, account, activeId, refresh])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error("useAccount doit être utilisé dans AccountProvider")
  return ctx
}
