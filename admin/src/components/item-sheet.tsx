import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AudioField } from "@/components/audio-field"
import { ImagePicker } from "@/components/image-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { displayName, useCategories, useLanguages } from "@/hooks/queries"
import { api, ApiError, upload, type Item } from "@/lib/api"

type Form = {
  category_id: string
  emoji: string
  is_published: boolean
  t: Record<string, { name: string; sentence: string; aliases: string }>
}

const EMPTY = { name: "", sentence: "", aliases: "" }

const splitAliases = (text: string) => text.split(/[,;\n]/).map((a) => a.trim()).filter((a) => a !== "")

export function ItemSheet({ item, defaultCategoryId, open, onOpenChange }: {
  item: Item | null
  defaultCategoryId?: number
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const qc = useQueryClient()
  const { data: languages = [] } = useLanguages()
  const { data: categories = [] } = useCategories()
  const [form, setForm] = useState<Form>({ category_id: "", emoji: "", is_published: true, t: {} })
  const [image, setImage] = useState<File | null>(null)
  const [audio, setAudio] = useState<Record<string, File | null>>({})
  const [error, setError] = useState<ApiError | null>(null)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = open ? String(item?.id ?? "new") : null
  if (key !== lastKey) {
    setLastKey(key)
    setForm(item
      ? { category_id: String(item.category_id), emoji: item.emoji ?? "", is_published: item.is_published,
          t: Object.fromEntries(Object.entries(item.translations).map(([k, v]) => [k, { name: v.name, sentence: v.sentence ?? "", aliases: (v.aliases ?? []).join(", ") }])) }
      : { category_id: defaultCategoryId ? String(defaultCategoryId) : "", emoji: "", is_published: true, t: {} })
    setImage(null)
    setAudio({})
    setError(null)
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["items"] })
    qc.invalidateQueries({ queryKey: ["categories"] })
    qc.invalidateQueries({ queryKey: ["stats"] })
  }

  const save = useMutation({
    mutationFn: async () => {
      const translations: Record<string, { name: string; sentence: string | null; aliases: string[] } | null> = {}
      for (const l of languages) {
        const v = form.t[l.code]
        if (v?.name.trim()) translations[l.code] = { name: v.name.trim(), sentence: v.sentence.trim() || null, aliases: splitAliases(v.aliases) }
        else if (item?.translations[l.code]) translations[l.code] = null
      }
      const body = { category_id: Number(form.category_id), emoji: form.emoji || null, is_published: form.is_published, translations }
      const saved = item
        ? await api<{ data: Item }>(`/admin/items/${item.id}`, { method: "PATCH", json: body })
        : await api<{ data: Item }>("/admin/items", { method: "POST", json: body })
      const id = saved.data.id
      if (image) await upload(`/admin/items/${id}/image`, "image", image)
      for (const [code, file] of Object.entries(audio)) {
        if (file && translations[code]) await upload(`/admin/items/${id}/audio/${code}`, "audio", file)
      }
    },
    onSuccess: () => {
      refresh()
      toast.success(item ? "Objet enregistré" : "Objet ajouté")
      onOpenChange(false)
    },
    onError: (e) => setError(e as ApiError),
  })

  const removeMedia = useMutation({
    mutationFn: (path: string) => api(`/admin/items/${item!.id}${path}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast.success("Fichier supprimé") },
  })

  const setT = (code: string, field: "name" | "sentence" | "aliases", value: string) =>
    setForm({ ...form, t: { ...form.t, [code]: { ...(form.t[code] ?? EMPTY), [field]: value } } })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-2xl">{item ? "Modifier l'objet" : "Nouvel objet"}</SheetTitle>
          <SheetDescription>Ce que l'enfant voit, et ce que l'application dit après le décompte.</SheetDescription>
        </SheetHeader>

        <form id="item-form" className="grid gap-6 p-4" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
          <div className="grid grid-cols-[1fr_96px] gap-4">
            <div className="grid gap-1.5">
              <Label>Catégorie</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger className="w-full" aria-invalid={!!error?.field("category_id")}><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.emoji} {displayName(c.translations, languages)}</SelectItem>)}
                </SelectContent>
              </Select>
              {error?.field("category_id") && <p className="text-xs font-semibold text-destructive">Choisissez une catégorie.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="item-emoji">Emoji</Label>
              <Input id="item-emoji" value={form.emoji} maxLength={8} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="text-center text-xl" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Photo</Label>
            <ImagePicker currentUrl={item?.image_url ?? null} emoji={form.emoji} file={image} onFile={setImage}
              onRemove={item ? () => removeMedia.mutate("/image") : undefined} />
          </div>

          {languages.map((l) => {
            const v = form.t[l.code] ?? EMPTY
            const said = v.sentence.trim() || (v.name.trim() ? l.answer_template.replace(":name", v.name.trim()) : "")
            const err = error?.field(`translations.${l.code}.name`)
            return (
              <section key={l.code} className="grid gap-3">
                <Separator />
                <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Badge variant="outline" className="font-mono uppercase">{l.code}</Badge> {l.name}
                  {!l.is_active && <Badge variant="secondary">langue désactivée</Badge>}
                </h3>
                <div className="grid gap-1.5">
                  <Label htmlFor={`name-${l.code}`}>Nom avec son article</Label>
                  <Input id={`name-${l.code}`} value={v.name} onChange={(e) => setT(l.code, "name", e.target.value)}
                    placeholder={l.code === "fr" ? "une pomme" : l.code === "en" ? "an apple" : ""} aria-invalid={!!err} />
                  {err && <p className="text-xs font-semibold text-destructive">{err}</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`sentence-${l.code}`}>Phrase dite (facultatif)</Label>
                  <Input id={`sentence-${l.code}`} value={v.sentence} onChange={(e) => setT(l.code, "sentence", e.target.value)}
                    placeholder={v.name ? l.answer_template.replace(":name", v.name) : l.answer_template} />
                  <p className="text-xs text-muted-foreground">
                    À remplir seulement si la phrase automatique ne convient pas, par exemple au pluriel : « Ce sont des ciseaux ».
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`aliases-${l.code}`}>Autres réponses acceptées (facultatif)</Label>
                  <Input id={`aliases-${l.code}`} value={v.aliases} onChange={(e) => setT(l.code, "aliases", e.target.value)}
                    placeholder={l.code === "fr" ? "une auto, une bagnole" : l.code === "en" ? "an automobile" : ""}
                    aria-invalid={!!error?.field(`translations.${l.code}.aliases`)} />
                  <p className="text-xs text-muted-foreground">
                    Séparées par des virgules, 10 au plus. Inutile d'ajouter le nom sans article, le pluriel ou les
                    petites erreurs de prononciation : ils sont déjà acceptés quand l'enfant répond au micro.
                  </p>
                  {error?.field(`translations.${l.code}.aliases`) && (
                    <p className="text-xs font-semibold text-destructive">{error.field(`translations.${l.code}.aliases`)}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Prononciation</Label>
                  {v.name.trim() || item?.translations[l.code] ? (
                    <AudioField
                      currentUrl={item?.translations[l.code]?.audio_url ?? null}
                      file={audio[l.code] ?? null}
                      onFile={(f) => setAudio({ ...audio, [l.code]: f })}
                      onRemove={item?.translations[l.code]?.audio_url ? () => removeMedia.mutate(`/audio/${l.code}`) : undefined}
                      speakText={said}
                      ttsLocale={l.tts_locale}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Écrivez d'abord le nom.</p>
                  )}
                </div>
              </section>
            )
          })}

          <Separator />
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span className="text-sm"><b>Publié</b><br /><span className="text-muted-foreground">Peut apparaître dans les séries.</span></span>
            <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
          </label>
          {error && !Object.keys(error.errors).length && <p className="text-sm font-semibold text-destructive">{error.message}</p>}
          {error?.field("translations") && <p className="text-sm font-semibold text-destructive">Donnez au moins un nom.</p>}
        </form>

        <SheetFooter className="sticky bottom-0 flex-row justify-end border-t bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" form="item-form" disabled={save.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
