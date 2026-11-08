import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDelete } from "@/components/confirm"
import { PageHeader } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLanguages } from "@/hooks/queries"
import { api, ApiError, type Language } from "@/lib/api"

type Form = Pick<Language, "code" | "name" | "tts_locale" | "question" | "answer_template" | "is_active">
const EMPTY: Form = { code: "", name: "", tts_locale: "", question: "", answer_template: "", is_active: true }

function LanguageDialog({ language, open, onOpenChange }: { language: Language | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Form>(EMPTY)
  const [error, setError] = useState<ApiError | null>(null)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = open ? String(language?.id ?? "new") : null
  if (key !== lastKey) {
    setLastKey(key)
    setForm(language ? { ...language } : EMPTY)
    setError(null)
  }

  const save = useMutation({
    mutationFn: () =>
      language
        ? api(`/admin/languages/${language.id}`, { method: "PATCH", json: form })
        : api("/admin/languages", { method: "POST", json: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["languages"] })
      qc.invalidateQueries({ queryKey: ["stats"] })
      toast.success(language ? "Langue enregistrée" : "Langue ajoutée")
      onOpenChange(false)
    },
    onError: (e) => setError(e as ApiError),
  })

  const field = (name: keyof Form, label: string, hint?: string, placeholder?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`lang-${name}`}>{label}</Label>
      <Input id={`lang-${name}`} value={String(form[name])} placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })} aria-invalid={!!error?.field(name)} />
      {error?.field(name) ? <p className="text-xs font-semibold text-destructive">{error.field(name)}</p>
        : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{language ? `Modifier ${language.name}` : "Ajouter une langue"}</DialogTitle>
          <DialogDescription>La question et la réponse sont dites à voix haute par l'application.</DialogDescription>
        </DialogHeader>
        <form id="language-form" className="grid gap-4" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
          <div className="grid grid-cols-2 gap-4">
            {field("code", "Code", "Ex. fr, en, wo", "wo")}
            {field("name", "Nom", undefined, "Wolof")}
          </div>
          {field("tts_locale", "Voix du téléphone", "Code de la voix de synthèse, ex. fr-FR, en-US", "wo-SN")}
          {field("question", "Question", undefined, "Qu'est-ce que c'est ?")}
          {field("answer_template", "Réponse", "« :name » est remplacé par le nom de l'objet.", "C'est :name")}
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span className="text-sm"><b>Visible dans l'application</b><br /><span className="text-muted-foreground">Désactivez-la tant que les traductions ne sont pas prêtes.</span></span>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </label>
          {error && !Object.keys(error.errors).length && <p className="text-sm font-semibold text-destructive">{error.message}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" form="language-form" disabled={save.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LanguagesPage() {
  const qc = useQueryClient()
  const { data: languages = [], isLoading } = useLanguages()
  const [editing, setEditing] = useState<Language | null>(null)
  const [open, setOpen] = useState(false)

  const toggle = useMutation({
    mutationFn: (l: Language) => api(`/admin/languages/${l.id}`, { method: "PATCH", json: { is_active: !l.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["languages"] }),
    onError: (e) => toast.error((e as Error).message),
  })
  const remove = useMutation({
    mutationFn: (l: Language) => api(`/admin/languages/${l.id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["languages"] }); toast.success("Langue supprimée") },
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <>
      <PageHeader
        title="Langues"
        description="Chaque langue a sa question, sa phrase de réponse et sa voix."
        actions={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus /> Ajouter une langue</Button>}
      />
      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Langue</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Réponse</TableHead>
                <TableHead>Voix</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-muted-foreground">Chargement…</TableCell></TableRow>}
              {languages.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><div className="flex items-center gap-2"><Badge variant="outline" className="font-mono uppercase">{l.code}</Badge><span className="font-semibold">{l.name}</span></div></TableCell>
                  <TableCell>{l.question}</TableCell>
                  <TableCell className="text-muted-foreground">{l.answer_template.replace(":name", "…")}</TableCell>
                  <TableCell className="font-mono text-xs">{l.tts_locale}</TableCell>
                  <TableCell><Switch checked={l.is_active} onCheckedChange={() => toggle.mutate(l)} aria-label={`Rendre ${l.name} visible`} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Modifier ${l.name}`} onClick={() => { setEditing(l); setOpen(true) }}><Pencil /></Button>
                      <ConfirmDelete title={`Supprimer ${l.name} ?`} description="Possible seulement si aucune traduction n'existe dans cette langue. Sinon, désactivez-la." onConfirm={() => remove.mutate(l)}>
                        <Button size="icon" variant="ghost" aria-label={`Supprimer ${l.name}`}><Trash2 /></Button>
                      </ConfirmDelete>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <LanguageDialog language={editing} open={open} onOpenChange={setOpen} />
    </>
  )
}
