// Fichiers des packs sur le téléphone (dossier Documents de l'app, jamais vidé par le système).
// La version web est dans packStore.web.ts.
import { Directory, File, Paths } from "expo-file-system"
import type { Pack } from "./lib/packs"

const root = () => new Directory(Paths.document, "packs")
const dir = (slug: string, version: string) => new Directory(root(), `${slug}-${version}`)

export const packStore = {
  supported: true,

  /** Place libre sur l'appareil, en octets (null si inconnue). */
  freeSpace(): number | null {
    try { return Paths.availableDiskSpace } catch { return null }
  },

  async prepare(slug: string, version: string): Promise<void> {
    const d = dir(slug, version)
    if (d.exists) d.delete()
    d.create({ intermediates: true, idempotent: true })
  },

  /** Télécharge un fichier dans le dossier du pack ; renvoie sa taille. */
  async download(slug: string, version: string, url: string, name: string): Promise<number> {
    const file = await File.downloadFileAsync(url, new File(dir(slug, version), name), { idempotent: true })
    return file.size ?? 0
  },

  async saveJson(slug: string, version: string, pack: Pack): Promise<void> {
    new File(dir(slug, version), "pack.json").write(JSON.stringify(pack))
  },

  async readJson(slug: string, version: string): Promise<Pack | null> {
    const f = new File(dir(slug, version), "pack.json")
    if (!f.exists) return null
    return JSON.parse(await f.text()) as Pack
  },

  /** Adresses locales des fichiers d'un pack installé. */
  async uris(slug: string, version: string, files: Record<string, string>): Promise<Record<string, string>> {
    const d = dir(slug, version)
    const out: Record<string, string> = {}
    for (const [url, name] of Object.entries(files)) out[url] = new File(d, name).uri
    return out
  },

  /** Supprime un pack (une version précise, ou toutes). */
  async remove(slug: string, version?: string): Promise<void> {
    const r = root()
    if (!r.exists) return
    for (const entry of r.list()) {
      if (!(entry instanceof Directory)) continue
      const name = entry.name
      if (version ? name === `${slug}-${version}` : new RegExp(`^${slug}-[0-9a-f]{12}$`).test(name)) entry.delete()
    }
  },
}
