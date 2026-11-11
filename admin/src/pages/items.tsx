import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Mic, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Thumb } from "@/components/brand"
import { ConfirmDelete } from "@/components/confirm"
import { ItemSheet } from "@/components/item-sheet"
import { PageHeader } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { displayName, useCategories, useLanguages } from "@/hooks/queries"
import { api, asMap, type Item, type Paginated } from "@/lib/api"

const ALL = "all"
const MISSING = [
  { value: ALL, label: "Tous les objets" },
  { value: "image", label: "Sans photo" },
  { value: "audio", label: "Sans enregistrement" },
  { value: "translation", label: "Traduction manquante" },
]

export function ItemsPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { data: languages = [] } = useLanguages()
  const { data: categories = [] } = useCategories()
  const [search, setSearch] = useState(params.get("search") ?? "")
  const [editing, setEditing] = useState<Item | null>(null)
  const [open, setOpen] = useState(false)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value && value !== ALL) next.set(key, value)
    else next.delete(key)
    if (key !== "page") next.delete("page")
    setParams(next, { replace: true })
  }

  // Search as you type, with a short pause
  useEffect(() => {
    const t = setTimeout(() => { if ((params.get("search") ?? "") !== search) setParam("search", search || null) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const query = new URLSearchParams(params)
  query.set("per_page", "25")
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["items", query.toString()],
    queryFn: () =>
      api<Paginated<Item>>(`/admin/items?${query}`).then((r) => ({ ...r, data: r.data.map((i) => ({ ...i, translations: asMap(i.translations) })) })),
    placeholderData: keepPreviousData,
  })

  const refresh = () => { qc.invalidateQueries({ queryKey: ["items"] }); qc.invalidateQueries({ queryKey: ["stats"] }); qc.invalidateQueries({ queryKey: ["categories"] }) }
  const togglePublish = useMutation({
    mutationFn: (i: Item) => api(`/admin/items/${i.id}`, { method: "PATCH", json: { is_published: !i.is_published } }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  })
  const remove = useMutation({
    mutationFn: (i: Item) => api(`/admin/items/${i.id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast.success("Objet supprimé") },
    onError: (e) => toast.error((e as Error).message),
  })

  const categoryId = params.get("category_id")
  const meta = data?.meta
  const page = meta?.current_page ?? 1

  return (
    <>
      <PageHeader
        title="Objets"
        description={meta ? `${meta.total} objet${meta.total > 1 ? "s" : ""}${isFetching ? " · mise à jour…" : ""}` : "Les images que l'enfant doit reconnaître."}
        actions={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus /> Nouvel objet</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_210px_210px_190px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un mot : pomme, chien…" className="pl-9" aria-label="Chercher" />
        </div>
        <Select value={categoryId ?? ALL} onValueChange={(v) => setParam("category_id", v)}>
          <SelectTrigger className="w-full" aria-label="Catégorie"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les catégories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={String(c.id)} className={c.parent_id ? "pl-6" : ""}>{c.parent_id ? "↳ " : ""}{c.emoji} {displayName(c.translations, languages)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={params.get("missing") ?? ALL} onValueChange={(v) => setParam("missing", v)}>
          <SelectTrigger className="w-full" aria-label="À compléter"><SelectValue /></SelectTrigger>
          <SelectContent>{MISSING.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={params.get("published") ?? ALL} onValueChange={(v) => setParam("published", v)}>
          <SelectTrigger className="w-full" aria-label="Publication"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Publiés et masqués</SelectItem>
            <SelectItem value="1">Publiés</SelectItem>
            <SelectItem value="0">Masqués</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                {languages.map((l) => <TableHead key={l.code}><span className="font-mono uppercase">{l.code}</span> · {l.name}</TableHead>)}
                <TableHead>Catégorie</TableHead>
                <TableHead>Publié</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={languages.length + 4} className="text-muted-foreground">Chargement…</TableCell></TableRow>}
              {data && !data.data.length && (
                <TableRow><TableCell colSpan={languages.length + 4} className="py-10 text-center text-muted-foreground">Aucun objet ne correspond à ces filtres.</TableCell></TableRow>
              )}
              {data?.data.map((i) => {
                const cat = categories.find((c) => c.id === i.category_id)
                return (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => { setEditing(i); setOpen(true) }}>
                    <TableCell><Thumb image={i.thumb_url ?? i.image_url} emoji={i.emoji} color={cat?.color} /></TableCell>
                    {languages.map((l) => {
                      const t = i.translations[l.code]
                      return (
                        <TableCell key={l.code}>
                          {t ? (
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                              {t.name}
                              {t.audio_url && <Mic className="size-3.5 text-success" aria-label="Voix enregistrée" />}
                            </span>
                          ) : <Badge variant="outline" className="border-destructive/50 text-destructive">À traduire</Badge>}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-sm text-muted-foreground">{cat ? `${cat.emoji ?? ""} ${displayName(cat.translations, languages)}` : "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch checked={i.is_published} onCheckedChange={() => togglePublish.mutate(i)} aria-label="Publié" />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Modifier" onClick={() => { setEditing(i); setOpen(true) }}><Pencil /></Button>
                        <ConfirmDelete
                          title={`Supprimer « ${displayName(i.translations, languages)} » ?`}
                          description="La photo et les enregistrements de cet objet seront supprimés. C'est définitif."
                          onConfirm={() => remove.mutate(i)}
                        >
                          <Button size="icon" variant="ghost" aria-label="Supprimer"><Trash2 /></Button>
                        </ConfirmDelete>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
            <span className="tabular-nums text-muted-foreground">{meta.from}–{meta.to} sur {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}><ChevronLeft /> Précédent</Button>
              <span className="tabular-nums">{page} / {meta.last_page}</span>
              <Button size="sm" variant="outline" disabled={page >= meta.last_page} onClick={() => setParam("page", String(page + 1))}>Suivant <ChevronRight /></Button>
            </div>
          </div>
        )}
      </Card>

      <ItemSheet item={editing} defaultCategoryId={categoryId ? Number(categoryId) : undefined} open={open} onOpenChange={setOpen} />
    </>
  )
}
