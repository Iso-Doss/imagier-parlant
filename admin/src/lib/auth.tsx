import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api, setUnauthorizedHandler, tokenStore, type User } from "@/lib/api"

type AuthState = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!tokenStore.get())
  const queryClient = useQueryClient()

  const forget = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(forget)
    if (!tokenStore.get()) return
    api<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(forget)
      .finally(() => setLoading(false))
  }, [forget])

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      json: { email, password, device_name: "admin-web" },
    })
    tokenStore.set(r.token)
    setUser(r.user)
  }

  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {})
    forget()
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
