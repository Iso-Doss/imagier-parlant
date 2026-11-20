// Packs hors connexion : ce qui ne dépend ni du réseau ni du disque (testé dans tests/packs.test.ts).
import type { Category, Item, Language, Series } from "../api"

export type PackText = { name: string; sentence: string | null; aliases: string[]; audio_url: string | null }
/** `category` : la sous-catégorie de l'objet (ou la catégorie du pack) */
export type PackItem = { id: number; category?: string; emoji: string | null; image_url: string | null; thumb_url: string | null; texts: Record<string, PackText> }
export type PackCategory = { slug: string; emoji: string | null; color: string | null; image_url: string | null; thumb_url: string | null; names: Record<string, string | null> }
export type Pack = {
  slug: string
  version: string
  size: number
  items_count: number
  category: PackCategory
  /** Sous-catégories (un pack par catégorie principale) */
  children?: PackCategory[]
  languages: Language[]
  items: PackItem[]
}
/** Une ligne de GET /packs */
export type PackSummary = { slug: string; name: string | null; emoji: string | null; version: string; size: number; items_count: number }

/** Adresse distante → nom du fichier local. */
export type FileMap = Record<string, string>

export type PackState = "absent" | "ready" | "outdated"

export function packState(installed: { version: string } | undefined, remote: { version: string } | undefined): PackState {
  if (!installed) return "absent"
  if (remote && remote.version !== installed.version) return "outdated"
  return "ready"
}

/** Toutes les adresses à télécharger pour un pack (sans doublon). */
export function packFiles(pack: Pack): string[] {
  const urls = new Set<string>()
  const add = (u: string | null | undefined) => { if (u) urls.add(u) }
  for (const c of [pack.category, ...(pack.children ?? [])]) add(c.thumb_url ?? c.image_url)
  for (const item of pack.items) {
    add(item.image_url)
    add(item.thumb_url)
    for (const text of Object.values(item.texts)) add(text.audio_url)
  }
  return [...urls]
}

/** Nom de fichier stable et sûr pour une adresse (elle contient déjà l'empreinte du contenu). */
export function fileNameFor(url: string): string {
  const path = url.replace(/^[a-z]+:\/\/[^/]+\//i, "").replace(/\?.*$/, "")
  const clean = path.replace(/[^a-zA-Z0-9.-]+/g, "_").replace(/^_+/, "")
  return clean.slice(-120) || "fichier"
}

/** Les catégories des packs installés (avec leurs sous-catégories), dans la langue de l'app. */
export function categoriesFromPacks(packs: Pack[], lang: string, files: FileMap): Category[] {
  let id = 0
  const make = (c: PackCategory, items: PackItem[]): Category => ({
    id: -1 - id++,
    slug: c.slug,
    name: c.names[lang] ?? Object.values(c.names).find(Boolean) ?? c.slug,
    emoji: c.emoji,
    color: c.color,
    image_url: local(c.image_url, files),
    thumb_url: local(c.thumb_url, files),
    items_count: items.filter((it) => it.texts[lang]).length,
  })
  return packs.map((p) => {
    const children = (p.children ?? []).map((c) => make(c, p.items.filter((it) => it.category === c.slug)))
    return { ...make(p.category, p.items), ...(children.length ? { children } : {}) }
  })
}

/** Catégorie d'un objet du pack : sa sous-catégorie si elle existe, sinon celle du pack. */
function categoryOf(item: PackItem, pack: Pack): PackCategory {
  return pack.children?.find((c) => c.slug === item.category) ?? pack.category
}

export function languagesFromPacks(packs: Pack[]): Language[] {
  return packs[0]?.languages ?? []
}

function local(url: string | null | undefined, files: FileMap): string | null {
  if (!url) return null
  return files[url] ?? url
}

/** Un objet du pack, présenté comme l'API le renvoie, avec les fichiers locaux. */
export function itemFromPack(item: PackItem, pack: Pack, lang: string, files: FileMap, translation?: string): Item | null {
  const text = item.texts[lang]
  if (!text) return null
  return {
    id: item.id,
    emoji: item.emoji,
    image_url: local(item.image_url, files),
    card_url: local(item.image_url, files),
    thumb_url: local(item.thumb_url, files),
    name: text.name,
    sentence: text.sentence,
    aliases: text.aliases,
    audio_url: local(text.audio_url, files),
    ...(translation ? { translation: item.texts[translation]?.name ?? null } : {}),
    category: { slug: categoryOf(item, pack).slug, name: categoryOf(item, pack).names[lang] ?? null },
  }
}

/** Catégories et sous-catégories présentes dans les packs installés. */
export function packSlugs(packs: Pack[]): Set<string> {
  return new Set(packs.flatMap((p) => [p.slug, ...(p.children ?? []).map((c) => c.slug)]))
}

/** Les catégories demandées sont-elles toutes téléchargées ? (aucune = toutes les catégories) */
export function coversCategories(packs: Pack[], categories: string[]): boolean {
  if (packs.length === 0) return false
  if (categories.length === 0) return true
  const have = packSlugs(packs)
  return categories.every((c) => have.has(c))
}

/**
 * Compose une série sans le serveur, avec la même règle que SeriesBuilder (API) :
 * on mélange, on répète si besoin, jamais deux fois le même objet de suite.
 */
export function seriesFromPacks(
  packs: Pack[],
  opts: { lang: string; categories: string[]; count: number; translation?: string },
  files: FileMap,
  random: () => number = Math.random,
): Series | null {
  // Une catégorie principale choisie : tout le pack ; une sous-catégorie : ses objets seulement
  const wanted = (p: Pack, it: PackItem) => !opts.categories.length || opts.categories.includes(p.slug) || opts.categories.includes(categoryOf(it, p).slug)
  const pool = packs.flatMap((p) => p.items.filter((it) => wanted(p, it)).map((it) => itemFromPack(it, p, opts.lang, files, opts.translation)).filter((x): x is Item => !!x))
  const language = packs[0]?.languages.find((l) => l.code === opts.lang)
  if (!language || pool.length === 0) return null

  const items: Item[] = []
  while (items.length < opts.count) {
    const round = shuffle(pool, random)
    if (items.length > 0 && round.length > 1 && round[0].id === items[items.length - 1].id) round.push(round.shift()!)
    items.push(...round)
  }
  return { language, count: opts.count, distinct_items: pool.length, items: items.slice(0, opts.count) }
}

/** Remplace les adresses d'une série en ligne par les fichiers déjà téléchargés (moins d'attente, moins de données). */
export function localizeSeries(series: Series, files: FileMap): Series {
  if (Object.keys(files).length === 0) return series
  return {
    ...series,
    items: series.items.map((it) => ({
      ...it,
      image_url: local(it.image_url, files),
      card_url: local(it.card_url, files),
      thumb_url: local(it.thumb_url, files),
      audio_url: local(it.audio_url, files),
    })),
  }
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 1 234 567 octets → « 1,2 Mo » */
export function formatSize(bytes: number, lang: string): string {
  const fr = lang === "fr"
  if (bytes < 1000 * 1000) return `${Math.max(1, Math.round(bytes / 1000))} ${fr ? "Ko" : "KB"}`
  const mb = (bytes / 1000 / 1000).toFixed(1)
  return `${fr ? mb.replace(".", ",") : mb} ${fr ? "Mo" : "MB"}`
}
