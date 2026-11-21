// Version web publique : fonctionne sans réseau (service worker) et s'installe sur l'écran d'accueil.
import { useEffect, useState } from "react"
import { Platform } from "react-native"
import { installState, type InstallState } from "./lib/install"
import { STANDALONE } from "./standalone"

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

let deferred: PromptEvent | null = null
let justInstalled = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Actif seulement dans la version web publique (pas en développement, pas sur téléphone). */
export const pwaEnabled = Platform.OS === "web" && STANDALONE && typeof window !== "undefined"

/** À appeler une fois, au démarrage : l'invite d'installation arrive tôt. */
export function setupPwa() {
  if (!pwaEnabled) return
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; notify() })
  window.addEventListener("appinstalled", () => { deferred = null; justInstalled = true; notify() })
  if ("serviceWorker" in navigator) {
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {})
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }
}

function current(): InstallState {
  const standalone = justInstalled || window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return installState({ standalone, hasPrompt: !!deferred, userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 })
}

/** État de l'installation, et le bouton « Installer » quand le navigateur le permet. */
export function useInstall(): { state: InstallState | null; install: () => Promise<void> } {
  const [state, setState] = useState<InstallState | null>(pwaEnabled ? current() : null)
  useEffect(() => {
    if (!pwaEnabled) return
    const update = () => setState(current())
    listeners.add(update)
    update()
    return () => { listeners.delete(update) }
  }, [])
  const install = async () => {
    if (!deferred) return
    const e = deferred
    deferred = null
    await e.prompt()
    const { outcome } = await e.userChoice
    if (outcome === "accepted") justInstalled = true
    notify()
  }
  return { state, install }
}
