import { useQuery } from "@tanstack/react-query"
import { api, asMap, type Category, type Language, type Stats } from "@/lib/api"

export const useLanguages = () =>
  useQuery({
    queryKey: ["languages"],
    queryFn: () => api<{ data: Language[] }>("/admin/languages").then((r) => r.data),
  })

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      api<{ data: Category[] }>("/admin/categories").then((r) =>
        r.data.map((c) => ({ ...c, translations: asMap(c.translations) })),
      ),
  })

export const useStats = () =>
  useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/admin/stats") })

/** Name in the first language that has one: "Fruits" */
export function displayName(translations: Record<string, { name: string }>, languages: Language[] = []) {
  for (const l of languages) if (translations[l.code]?.name) return translations[l.code].name
  return Object.values(translations)[0]?.name ?? "Sans nom"
}
