// Catalogue intégré à l'app (version web sans serveur), présenté comme des packs hors connexion.
// Mêmes règles que l'API (CatalogSeeder + PackBuilder) ; testé dans tests/bundledPacks.test.ts.
import type { Language } from "../api"
import type { Pack, PackCategory, PackItem } from "./packs"

type Lang = "fr" | "en"
export type CatalogItem = { emoji: string; fr: string; en: string; fr_sentence?: string; en_sentence?: string; fr_aliases?: string[]; en_aliases?: string[] }
export type CatalogCategory = { slug: string; parent?: string; emoji: string; color: string; names: Record<Lang, string>; items: CatalogItem[] }
export type Catalog = { categories: CatalogCategory[] }

/** Comme LanguageSeeder (API) */
export const BUNDLED_LANGUAGES: Language[] = [
  { code: "fr", name: "Français", tts_locale: "fr-FR", question: "Qu'est-ce que c'est ?", answer_template: "C'est :name" },
  { code: "en", name: "English", tts_locale: "en-US", question: "What is this?", answer_template: "It's :name" },
]

/** « C'est une pomme » : la phrase par défaut, comme Language::answerFor */
const answerFor = (language: Language, name: string) => language.answer_template.replace(":name", name)

/** Un pack par catégorie principale, avec ses sous-catégories (le parent vient avant dans le fichier). */
export function packsFromCatalog(catalog: Catalog): Pack[] {
  let id = 0
  const category = (c: CatalogCategory): PackCategory => ({ slug: c.slug, emoji: c.emoji, color: c.color, image_url: null, thumb_url: null, names: { ...c.names } })
  const item = (c: CatalogCategory, it: CatalogItem): PackItem => ({
    id: ++id,
    category: c.slug,
    emoji: it.emoji,
    image_url: null,
    thumb_url: null,
    texts: Object.fromEntries(BUNDLED_LANGUAGES.map((l) => {
      const code = l.code as Lang
      return [code, { name: it[code], sentence: it[`${code}_sentence`] ?? answerFor(l, it[code]), aliases: it[`${code}_aliases`] ?? [], audio_url: null }]
    })),
  })
  return catalog.categories.filter((c) => !c.parent).map((root) => {
    const children = catalog.categories.filter((c) => c.parent === root.slug)
    const items = [root, ...children].flatMap((c) => c.items.map((it) => item(c, it)))
    return {
      slug: root.slug,
      version: "app",
      size: 0,
      items_count: items.length,
      category: category(root),
      ...(children.length ? { children: children.map(category) } : {}),
      languages: BUNDLED_LANGUAGES,
      items,
    }
  })
}
