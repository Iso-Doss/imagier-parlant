// Version web des fichiers de packs : le cache du navigateur (Cache Storage), lu en adresses « blob: ».
import type { Pack } from "./lib/packs"

const CACHE = "imagier-packs"
const key = (slug: string, version: string, name: string) => `https://packs.imagier.local/${slug}-${version}/${name}`
const hasCache = typeof globalThis.caches !== "undefined"
// Une seule adresse blob par fichier, gardée tant que la page est ouverte
const blobs = new Map<string, string>()

export const packStore = {
  supported: hasCache,

  freeSpace(): number | null {
    return null
  },

  async prepare(slug: string, version: string): Promise<void> {
    await packStore.remove(slug, version)
  },

  async download(slug: string, version: string, url: string, name: string): Promise<number> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const cache = await caches.open(CACHE)
    await cache.put(key(slug, version, name), new Response(blob, { headers: { "Content-Type": blob.type } }))
    return blob.size
  },

  async saveJson(slug: string, version: string, pack: Pack): Promise<void> {
    const cache = await caches.open(CACHE)
    await cache.put(key(slug, version, "pack.json"), new Response(JSON.stringify(pack), { headers: { "Content-Type": "application/json" } }))
  },

  async readJson(slug: string, version: string): Promise<Pack | null> {
    const res = await (await caches.open(CACHE)).match(key(slug, version, "pack.json"))
    return res ? ((await res.json()) as Pack) : null
  },

  async uris(slug: string, version: string, files: Record<string, string>): Promise<Record<string, string>> {
    const cache = await caches.open(CACHE)
    const out: Record<string, string> = {}
    await Promise.all(Object.entries(files).map(async ([url, name]) => {
      const k = key(slug, version, name)
      let blob = blobs.get(k)
      if (!blob) {
        const res = await cache.match(k)
        if (!res) return
        blob = URL.createObjectURL(await res.blob())
        blobs.set(k, blob)
      }
      out[url] = blob
    }))
    return out
  },

  async remove(slug: string, version?: string): Promise<void> {
    if (!hasCache) return
    const cache = await caches.open(CACHE)
    const mine = version ? (u: string) => u.startsWith(key(slug, version, "")) : (u: string) => new RegExp(`^https://packs\\.imagier\\.local/${slug}-[0-9a-f]{12}/`).test(u)
    for (const req of await cache.keys()) {
      if (!mine(req.url)) continue
      await cache.delete(req)
      const b = blobs.get(req.url)
      if (b) { URL.revokeObjectURL(b); blobs.delete(req.url) }
    }
  },
}
