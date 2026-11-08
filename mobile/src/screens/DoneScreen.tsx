import { useEffect } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { Series } from "../api"
import type { PlayResult } from "./PlayScreen"
import { playChime } from "../audio"
import { BigButton, Picture, SmallButton } from "../components/ui"
import { strings } from "../i18n"
import { fonts, hardShadow, useTheme } from "../theme"

export function DoneScreen({ series, results, lang, onAgain, onHome }: { series: Series; results: PlayResult[]; lang: string; onAgain: () => void; onHome: () => void }) {
  const t = useTheme()
  const s = strings(lang)
  const insets = useSafeAreaInsets()
  useEffect(() => { playChime() }, [])

  const unique = [...new Map(series.items.map((i) => [i.id, i])).values()]
  // Mode « un adulte valide » : on dit ce qui est trouvé, et on montre doucement ce qui est à revoir
  const judged = results.filter((r) => r.result !== "skipped")
  const found = judged.filter((r) => r.result === "correct").length
  const missed = new Set(judged.filter((r) => r.result !== "correct").map((r) => r.item_id))

  return (
    <ScrollView style={{ backgroundColor: t.sky }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
      <View style={[styles.star, { backgroundColor: t.sun, borderColor: t.edge }, hardShadow(t.drop, 4)]}>
        <Text style={{ fontSize: 40, color: t.sunInk }}>★</Text>
      </View>
      <Text style={[styles.title, { color: t.ink }]}>{s.bravo}</Text>
      <Text style={[styles.text, { color: t.muted }]}>{judged.length ? s.foundText(found, judged.length) : s.doneText(series.items.length)}</Text>
      {missed.size > 0 && <Text style={[styles.text, { color: t.ink }]}>{s.toReview}</Text>}
      <View style={styles.grid}>
        {unique.filter((i) => !missed.size || missed.has(i.id)).map((i) => (
          <View key={i.id} style={[styles.tile, { backgroundColor: t.paper, borderColor: t.edge }]} accessibilityLabel={i.name ?? undefined}>
            <Picture image={i.thumb_url ?? i.image_url} emoji={i.emoji} size={i.image_url ? 48 : 34} />
          </View>
        ))}
      </View>
      <BigButton label={s.again} onPress={onAgain} style={{ width: "100%", maxWidth: 420 }} />
      <SmallButton label={s.change} onPress={onHome} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, alignItems: "center", gap: 18, maxWidth: 620, width: "100%", alignSelf: "center" },
  star: { width: 76, height: 76, borderRadius: 20, borderWidth: 3, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] },
  title: { fontFamily: fonts.display, fontSize: 44, lineHeight: 50 },
  text: { fontFamily: fonts.bodyBold, fontSize: 16, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  tile: { width: 56, height: 56, borderRadius: 12, borderWidth: 2.5, alignItems: "center", justifyContent: "center", overflow: "hidden" },
})
