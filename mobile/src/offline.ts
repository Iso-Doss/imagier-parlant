// Mode hors connexion : catégories téléchargées par le parent, utilisables sans réseau.
import { useEffect, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { fetchPack, mediaUrl } from "./api"
import { fileNameFor, packFiles, type FileMap, type Pack } from "./lib/packs"
import { packStore } from "./packStore"

const INDEX_KEY = "imagier-packs-v1"
const CONCURRENCY = 4

type Installed = { version: string; size: number; items_count: number; files: Record<string, string> }
export type OfflineState = {
  ready: boolean
  supported: boolean
  /** Packs installés, avec leur contenu */
  packs: Pack[]
  installed: Record<string, Installed>
  /** Adresse distante → fichier local, pour tous les packs */
  files: FileMap
  /** Téléchargements en cours : 0 → 1 */
  progress: Record<string, number>
  errors: Record<string, string>
}

let state: OfflineState = { ready: false, supported: packStore.supported, packs: [], installed: {}, files: {}, progress: {}, errors: {} }
const listeners = new Set<(s: OfflineState) => void>()
const set = (patch: Partial<OfflineState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l(state)) }

export const offlineState = () => state

/** À l'ouverture de l'app : relit les packs installés. */
let loading: Promise<void> | null = null
export function loadOffline(): Promise<void> {
  if (!packStore.supported) { set({ ready: true }); return Promise.resolve() }
  loading ??= (async () => {
    let installed: Record<string, Installed> = {}
    try { installed = JSON.parse((await AsyncStorage.getItem(INDEX_KEY)) ?? "{}") } catch { installed = {} }
    const packs: Pack[] = []
    let files: FileMap = {}
    for (const [slug, entry] of Object.entries(installed)) {
      try {
        const pack = await packStore.readJson(slug, entry.version)
        if (!pack) { delete installed[slug]; continue }
        packs.push(pack)
        files = { ...files, ...(await packStore.uris(slug, entry.version, entry.files)) }
      } catch {
        delete installed[slug]
      }
    }
    set({ ready: true, installed, packs, files })
  })()
  return loading
}

async function saveIndex(installed: Record<string, Installed>) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(installed))
}

export class OfflineError extends Error {}

/**
 * Télécharge (ou met à jour) le pack d'une catégorie. La version précédente reste utilisable
 * jusqu'à la fin : on ne bascule qu'une fois tous les fichiers arrivés.
 */
export async function downloadPack(slug: string, messages: { noSpace: string; failed: string }): Promise<void> {
  if (state.progress[slug] !== undefined) return
  set({ progress: { ...state.progress, [slug]: 0 }, errors: omit(state.errors, slug) })
  let fresh: string | null = null
  try {
    const pack = await fetchPack(slug)
    const free = packStore.freeSpace()
    if (free !== null && free < pack.size * 1.2 + 20_000_000) throw new OfflineError(messages.noSpace)

    // Même version déjà installée : rien à faire
    if (state.installed[slug]?.version === pack.version) return
    fresh = pack.version
    await packStore.prepare(slug, pack.version)
    const urls = packFiles(pack)
    const names: Record<string, string> = {}
    let done = 0
    let failed = 0
    let size = 0
    const queue = [...urls]
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const name = fileNameFor(url)
        try {
          size += await packStore.download(slug, pack.version, mediaUrl(url) ?? url, name)
          names[url] = name
        } catch {
          failed++
        }
        done++
        set({ progress: { ...state.progress, [slug]: urls.length ? done / urls.length : 1 } })
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    // Quelques fichiers absents du serveur : on garde l'émoji ou la voix du téléphone.
    // Beaucoup d'échecs : c'est le réseau, on n'installe rien.
    if (failed > Math.max(1, urls.length * 0.1)) throw new OfflineError(messages.failed)

    await packStore.saveJson(slug, pack.version, pack)
    const previous = state.installed[slug]
    const installed = { ...state.installed, [slug]: { version: pack.version, size, items_count: pack.items_count, files: names } }
    await saveIndex(installed)
    const uris = await packStore.uris(slug, pack.version, names)
    set({
      installed,
      packs: [...state.packs.filter((p) => p.slug !== slug), pack],
      files: { ...withoutPack(state.files, previous), ...uris },
    })
    if (previous && previous.version !== pack.version) await packStore.remove(slug, previous.version).catch(() => {})
  } catch (e) {
    set({ errors: { ...state.errors, [slug]: e instanceof OfflineError ? e.message : messages.failed } })
    // Téléchargement interrompu : on efface les fichiers à moitié arrivés, la version installée reste
    if (fresh && fresh !== state.installed[slug]?.version) await packStore.remove(slug, fresh).catch(() => {})
  } finally {
    set({ progress: omit(state.progress, slug) })
  }
}

export async function removePack(slug: string): Promise<void> {
  const previous = state.installed[slug]
  const installed = omit(state.installed, slug)
  await saveIndex(installed)
  set({ installed, packs: state.packs.filter((p) => p.slug !== slug), files: withoutPack(state.files, previous) })
  await packStore.remove(slug).catch(() => {})
}

function withoutPack(files: FileMap, entry: Installed | undefined): FileMap {
  if (!entry) return files
  const out = { ...files }
  for (const url of Object.keys(entry.files)) delete out[url]
  return out
}

function omit<T>(obj: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = obj
  return rest
}

export function useOffline(): OfflineState {
  const [s, setS] = useState(state)
  useEffect(() => {
    listeners.add(setS)
    setS(state)
    loadOffline()
    return () => { listeners.delete(setS) }
  }, [])
  return s
}
