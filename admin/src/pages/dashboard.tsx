import { Link } from "react-router-dom"
import { ArrowRight, ImageOff, Mic, Languages as LanguagesIcon } from "lucide-react"
import { PageHeader } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useStats } from "@/hooks/queries"

function Meter({ value, total, tone }: { value: number; total: number; tone: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
        {value} / {total} · {pct} %
      </span>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading } = useStats()

  const tiles = data && [
    { label: "Catégories", value: data.categories, to: "/categories" },
    { label: "Objets", value: data.items, to: "/items" },
    { label: "Publiés", value: data.published_items, to: "/items?published=1" },
    { label: "Sans photo", value: data.items_without_image, to: "/items?missing=image", warn: data.items_without_image > 0 },
  ]

  return (
    <>
      <PageHeader title="Tableau de bord" description="Ce qui est prêt dans l'application, et ce qu'il reste à compléter." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading || !tiles
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : tiles.map((t) => (
              <Link key={t.label} to={t.to} className="group">
                <Card className="h-full gap-1 py-5 transition-colors group-hover:border-ring">
                  <CardHeader className="px-5">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider">{t.label}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-end justify-between px-5">
                    <span className="font-display text-4xl font-bold tabular-nums">{t.value}</span>
                    {t.warn && <Badge className="bg-warning text-sun-foreground">À faire</Badge>}
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><LanguagesIcon className="size-5" /> Avancement par langue</CardTitle>
          <CardDescription>
            Un objet sans enregistrement est lu par la voix du téléphone. Enregistrer sa propre voix rend la prononciation plus fiable.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {isLoading && <Skeleton className="h-24" />}
          {data?.languages.map((l) => (
            <div key={l.code} className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono uppercase">{l.code}</Badge>
                <span className="font-semibold">{l.name}</span>
                {!l.is_active && <Badge variant="secondary">Désactivée</Badge>}
                {l.missing_translations > 0 && (
                  <Link to={`/items?missing=translation`} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                    {l.missing_translations} traduction{l.missing_translations > 1 ? "s" : ""} manquante{l.missing_translations > 1 ? "s" : ""} <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </div>
              <div className="grid gap-2 text-sm">
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-muted-foreground">Mots traduits</span>
                  <Meter value={l.translated_items} total={data.items} tone="bg-success" />
                </div>
                <div className="grid gap-1">
                  <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Mic className="size-3" /> Voix enregistrées</span>
                  <Meter value={l.items_with_audio} total={l.translated_items} tone="bg-sun" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {data && data.items_without_image > 0 && (
        <Link to="/items?missing=image" className="mt-4 flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm hover:border-ring">
          <ImageOff className="size-5 text-muted-foreground" />
          <span><b>{data.items_without_image} objets</b> utilisent encore un emoji. Ajoutez une vraie photo pour que l'enfant reconnaisse l'objet dans la vie de tous les jours.</span>
          <ArrowRight className="ml-auto size-4" />
        </Link>
      )}
    </>
  )
}
