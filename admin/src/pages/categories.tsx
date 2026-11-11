import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, CornerDownRight, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Thumb } from "@/components/brand"
import { ConfirmDelete } from "@/components/confirm"
import { ImagePicker } from "@/components/image-picker"
import { PageHeader } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { displayName, useCategories, useLanguages } from "@/hooks/queries"
import { api, ApiError, upload, type Category } from "@/lib/api"
import { slugify } from "@/lib/slug"

const COLORS = ["#FFF0C4", "#FFE1D9", "#D5F2E7", "#E1E5FF", "#F6DFF3", "#E7F1FA"]

type Form = { parent_id: string; slug: string; emoji: string; color: string; is_published: boolean; names: Record<string, string> }
const MAIN = "principale"

/** `parentId` : pour créer directement une sous-catégorie. */
function CategoryDialog({ category, parentId, open, onOpenChange }: { category: Category | null; parentId?: number | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const { data: languages = [] } = useLanguages()
  const { data: categories = [] } = useCategories()
  const [form, setForm] = useState<Form>({ parent_id: MAIN, slug: "", emoji: "", color: COLORS[0], is_published: true, names: {} })
  const [slugTouched, setSlugTouched] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = open ? String(category?.id ?? `new-${parentId ?? ""}`) : null
  if (key !== lastKey) {
    setLastKey(key)
    setForm(category
      ? { parent_id: category.parent_id ? String(category.parent_id) : MAIN, slug: category.slug, emoji: category.emoji ?? "", color: category.color ?? COLORS[0], is_published: category.is_published,
          names: Object.fromEntries(Object.entries(category.translations).map(([k, v]) => [k, v.name])) }
      : { parent_id: parentId ? String(parentId) : MAIN, slug: "", emoji: "", color: COLORS[0], is_published: true, names: {} })
    setSlugTouched(!!category)
    setImage(null)
    setError(null)
  }

  const save = useMutation({
    mutationFn: async () => {
      const translations = Object.fromEntries(
        languages.map((l) => [l.code, form.names[l.code]?.trim() ? { name: form.names[l.code].trim() } : category?.translations[l.code] ? null : undefined])
          .filter(([, v]) => v !== undefined),
      )
      const body = { parent_id: form.parent_id === MAIN ? null : Number(form.parent_id), slug: form.slug, emoji: form.emoji || null, color: form.color, is_published: form.is_published, translations }
      const saved = category
        ? await api<{ data: Category }>(`/admin/categories/${category.id}`, { method: "PATCH", json: body })
        : await api<{ data: Category }>("/admin/categories", { method: "POST", json: body })
      if (image) await upload(`/admin/categories/${saved.data.id}/image`, "image", image)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] })
      qc.invalidateQueries({ queryKey: ["stats"] })
      toast.success(category ? "Catégorie enregistrée" : "Catégorie créée")
      onOpenChange(false)
    },
    onError: (e) => setError(e as ApiError),
  })

  const removeImage = useMutation({
    mutationFn: () => api(`/admin/categories/${category!.id}/image`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Photo retirée") },
  })

  const firstCode = languages[0]?.code
  const setName = (code: string, value: string) => {
    const names = { ...form.names, [code]: value }
    setForm({ ...form, names, slug: !slugTouched && code === firstCode ? slugify(value) : form.slug })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          <DialogDescription>Le nom est montré à l'enfant quand il choisit ce qu'il veut apprendre.</DialogDescription>
        </DialogHeader>
        <form id="category-form" className="grid gap-5" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
          <div className="grid gap-3">
            {languages.map((l) => (
              <div key={l.code} className="grid gap-1.5">
                <Label htmlFor={`cat-name-${l.code}`} className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono uppercase">{l.code}</Badge> Nom en {l.name}
                </Label>
                <Input id={`cat-name-${l.code}`} value={form.names[l.code] ?? ""} onChange={(e) => setName(l.code, e.target.value)}
                  placeholder={l.code === "fr" ? "Fruits" : l.code === "en" ? "Fruits" : ""} aria-invalid={!!error?.field(`translations.${l.code}.name`)} />
                {error?.field(`translations.${l.code}.name`) && <p className="text-xs font-semibold text-destructive">{error.field(`translations.${l.code}.name`)}</p>}
              </div>
            ))}
            {error?.field("translations") && <p className="text-xs font-semibold text-destructive">Donnez au moins un nom.</p>}
          </div>

          <div className="grid grid-cols-[1fr_96px] gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cat-slug">Identifiant</Label>
              <Input id="cat-slug" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }) }} className="font-mono" aria-invalid={!!error?.field("slug")} />
              <p className="text-xs text-muted-foreground">{error?.field("slug") ?? "Utilisé par l'application, ex. fruits."}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cat-emoji">Emoji</Label>
              <Input id="cat-emoji" value={form.emoji} maxLength={8} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="text-center text-xl" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cat-parent">Ranger dans</Label>
            <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v })} disabled={!!category?.children_count}>
              <SelectTrigger id="cat-parent" className="w-full" aria-invalid={!!error?.field("parent_id")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={MAIN}>Aucune : catégorie principale</SelectItem>
                {categories.filter((c) => !c.parent_id && c.id !== category?.id).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.emoji} {displayName(c.translations, languages)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {error?.field("parent_id") ?? (category?.children_count
                ? "Elle contient des sous-catégories : elle reste une catégorie principale."
                : "Une sous-catégorie apparaît dans l'application quand on ouvre sa catégorie principale.")}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label>Couleur de la carte</Label>
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} aria-label={`Couleur ${c}`} aria-pressed={form.color === c}
                  className="size-8 rounded-full border-2 border-transparent ring-offset-2 ring-offset-background aria-pressed:border-foreground" style={{ backgroundColor: c }} />
              ))}
              <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value.toUpperCase() })} className="h-8 w-12 p-1" aria-label="Autre couleur" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Image de la catégorie</Label>
            <ImagePicker currentUrl={category?.image_url ?? null} emoji={form.emoji} color={form.color} file={image} onFile={setImage}
              onRemove={category ? () => removeImage.mutate() : undefined} />
          </div>

          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span className="text-sm"><b>Publiée</b><br /><span className="text-muted-foreground">Visible dans l'application.</span></span>
            <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
          </label>
          {error && !Object.keys(error.errors).length && <p className="text-sm font-semibold text-destructive">{error.message}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" form="category-form" disabled={save.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CategoriesPage() {
  const qc = useQueryClient()
  const { data: categories = [], isLoading } = useCategories()
  const { data: languages = [] } = useLanguages()
  const [editing, setEditing] = useState<Category | null>(null)
  const [newParent, setNewParent] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const create = (parent: number | null) => { setEditing(null); setNewParent(parent); setOpen(true) }

  const refresh = () => { qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["stats"] }) }
  const patch = useMutation({
    mutationFn: ({ c, body }: { c: Category; body: object }) => api(`/admin/categories/${c.id}`, { method: "PATCH", json: body }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  })
  const move = useMutation({
    mutationFn: (ids: number[]) => api("/admin/categories/reorder", { method: "POST", json: { ids } }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["categories"] })
      // Nouvel ordre des voisines, le reste de la liste ne bouge pas
      qc.setQueryData<Category[]>(["categories"], (old) => {
        if (!old) return old
        const moved = ids.map((id) => old.find((c) => c.id === id)!)
        let k = 0
        return old.map((c) => (ids.includes(c.id) ? moved[k++] : c))
      })
    },
    onSettled: refresh,
  })
  const remove = useMutation({
    mutationFn: (c: Category) => api(`/admin/categories/${c.id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["items"] }); toast.success("Catégorie supprimée") },
    onError: (e) => toast.error((e as Error).message),
  })

  // Les flèches déplacent une catégorie parmi ses voisines (même parent)
  const siblingsOf = (c: Category) => categories.filter((x) => x.parent_id === c.parent_id)
  const swap = (c: Category, step: -1 | 1) => {
    const ids = siblingsOf(c).map((x) => x.id)
    const i = ids.indexOf(c.id)
    ;[ids[i], ids[i + step]] = [ids[i + step], ids[i]]
    move.mutate(ids)
  }

  return (
    <>
      <PageHeader
        title="Catégories"
        description="L'ordre ici est celui de l'application. Les flèches le changent. Une sous-catégorie s'ouvre depuis sa catégorie principale."
        actions={<Button onClick={() => create(null)}><Plus /> Nouvelle catégorie</Button>}
      />
      <Card className="divide-y overflow-hidden py-0">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && !categories.length && <p className="p-6 text-sm text-muted-foreground">Aucune catégorie pour l'instant. Créez la première, par exemple « Fruits ».</p>}
        {categories.map((c) => {
          const siblings = siblingsOf(c)
          const i = siblings.indexOf(c)
          return (
          <div key={c.id} className={`flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap ${c.parent_id ? "bg-muted/40 pl-8" : ""}`}>
            {c.parent_id ? <CornerDownRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
            <div className="flex flex-col">
              <Button size="icon" variant="ghost" className="size-7" disabled={i === 0} onClick={() => swap(c, -1)} aria-label="Monter"><ArrowUp /></Button>
              <Button size="icon" variant="ghost" className="size-7" disabled={i === siblings.length - 1} onClick={() => swap(c, 1)} aria-label="Descendre"><ArrowDown /></Button>
            </div>
            <Thumb image={c.thumb_url ?? c.image_url} emoji={c.emoji} color={c.color} className={c.parent_id ? "size-11 text-2xl" : "size-14 text-3xl"} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-bold leading-tight">{displayName(c.translations, languages)}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">{c.slug}</span>
                {languages.map((l) => (
                  <span key={l.code} className={c.translations[l.code] ? "" : "font-semibold text-destructive"}>
                    <span className="font-mono uppercase">{l.code}</span> {c.translations[l.code]?.name ?? "manquant"}
                  </span>
                ))}
              </div>
            </div>
            <Link to={`/items?category_id=${c.id}`} className="text-sm font-semibold tabular-nums text-primary underline-offset-4 hover:underline">
              {c.items_count} objet{c.items_count > 1 ? "s" : ""}
            </Link>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Switch checked={c.is_published} onCheckedChange={(v) => patch.mutate({ c, body: { is_published: v } })} />
              {c.is_published ? "Publiée" : "Masquée"}
            </label>
            <div className="flex gap-1">
              {!c.parent_id && (
                <Button size="sm" variant="ghost" onClick={() => create(c.id)} aria-label={`Nouvelle sous-catégorie dans ${displayName(c.translations, languages)}`}>
                  <Plus /> Sous-catégorie
                </Button>
              )}
              <Button size="icon" variant="ghost" aria-label="Modifier" onClick={() => { setEditing(c); setOpen(true) }}><Pencil /></Button>
              <ConfirmDelete
                title={`Supprimer « ${displayName(c.translations, languages)} » ?`}
                description={<>{c.children_count ? <>Ses <b>{c.children_count} sous-catégories</b> et leurs objets seront supprimés. </> : null}Ses <b>{c.items_count} objets</b> seront aussi supprimés, avec leurs photos et leurs enregistrements. C'est définitif. Pour la cacher sans rien perdre, désactivez « Publiée ».</>}
                onConfirm={() => remove.mutate(c)}
              >
                <Button size="icon" variant="ghost" aria-label="Supprimer"><Trash2 /></Button>
              </ConfirmDelete>
            </div>
          </div>
          )
        })}
      </Card>
      <CategoryDialog category={editing} parentId={newParent} open={open} onOpenChange={setOpen} />
    </>
  )
}
