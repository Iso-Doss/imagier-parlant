// Version web publique sans serveur (EXPO_PUBLIC_STANDALONE=1 au moment de la construction) :
// tout le catalogue est dans l'app, rien n'est demandé à l'API, pas de compte.
import catalog from "./data/catalog.json"
import { packsFromCatalog, type Catalog } from "./lib/bundledPacks"
import type { Pack } from "./lib/packs"

export const STANDALONE = process.env.EXPO_PUBLIC_STANDALONE === "1"

let packs: Pack[] | null = null
/** Les catégories intégrées, comme si elles étaient toutes téléchargées. */
export function bundledPacks(): Pack[] {
  packs ??= packsFromCatalog(catalog as Catalog)
  return packs
}
