import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fetchCategories, fetchLanguages, type Category, type Language } from "../api"
import { BigButton, Chip, Picture, Toggle } from "../components/ui"
import { strings } from "../i18n"
import type { CountStyle, Settings } from "../settings"
import { fonts, hardShadow, tintFor, useTheme } from "../theme"

type Props = {
  settings: Settings
  update: (p: Partial<Settings>) => void
  onStart: () => void
  starting: boolean
  startError: string | null
}

export function HomeScreen({ settings, update, onStart, starting, startError }: Props) {
  const t = useTheme()
  const s = strings(settings.lang)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [languages, setLanguages] = useState<Language[]>([])
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [langs, cats] = await Promise.all([fetchLanguages(), fetchCategories(settings.lang)])
      setLanguages(langs)
      setCategories(cats)
      // Forget categories that no longer exist
      const known = new Set(cats.map((c) => c.slug))
      if (settings.categories.some((c) => !known.has(c))) update({ categories: settings.categories.filter((c) => known.has(c)) })
    } catch (e) {
      setError((e as Error).message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.lang])

  useEffect(() => { load() }, [load])

  const columns = width > 700 ? 4 : width > 480 ? 3 : 2
  const gap = 12
  const contentWidth = Math.min(width, 760) - 32
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns
  const selected = new Set(settings.categories)
  const allSelected = !!categories && categories.length > 0 && categories.every((c) => selected.has(c.slug))

  const toggleCat = (slug: string) =>
    update({ categories: selected.has(slug) ? settings.categories.filter((c) => c !== slug) : [...settings.categories, slug] })

  return (
    <View style={{ flex: 1, backgroundColor: t.sky }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: t.sun, borderColor: t.edge }, hardShadow(t.drop, 3)]}>
              <Text style={{ fontFamily: fonts.display, fontSize: 28, color: t.sunInk }}>?</Text>
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.title, { color: t.ink }]}>Imagier parlant</Text>
              <Text style={{ fontFamily: fonts.body, color: t.muted }}>{s.tagline}</Text>
            </View>
          </View>
        </View>

        {languages.length > 1 && (
          <View style={styles.chips}>
            {languages.map((l) => (
              <Chip key={l.code} label={l.name} selected={settings.lang === l.code} onPress={() => update({ lang: l.code })} />
            ))}
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={[styles.h2, { color: t.ink }]}>{s.chooseCats}</Text>
          {categories && categories.length > 0 && (
            <Pressable onPress={() => update({ categories: allSelected ? [] : categories.map((c) => c.slug) })} hitSlop={8}>
              <Text style={{ fontFamily: fonts.bodyBold, color: t.coral, textDecorationLine: "underline" }}>{allSelected ? s.none : s.all}</Text>
            </Pressable>
          )}
        </View>

        {error ? (
          <View style={[styles.panel, { backgroundColor: t.paper, borderColor: t.edge }]}>
            <Text style={{ fontFamily: fonts.bodyBold, color: t.ink, fontSize: 16 }}>{s.offline}</Text>
            <Text style={{ fontFamily: fonts.body, color: t.muted }}>{error}</Text>
            <BigButton label={s.retry} onPress={load} />
          </View>
        ) : !categories ? (
          <View style={{ padding: 32, alignItems: "center" }}><ActivityIndicator color={t.ink} /></View>
        ) : (
          <View style={[styles.grid, { gap }]}>
            {categories.map((c, i) => {
              const on = selected.has(c.slug)
              return (
                <Pressable
                  key={c.slug}
                  onPress={() => toggleCat(c.slug)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${c.name}, ${s.objects(c.items_count)}`}
                  style={({ pressed }) => [
                    styles.cat,
                    { width: cardWidth, backgroundColor: tintFor(t, c.color, i), borderColor: t.edge },
                    pressed ? { transform: [{ translateX: 2 }, { translateY: 2 }], ...hardShadow(t.drop, 2) } : hardShadow(t.drop, 4),
                  ]}
                >
                  <View style={[styles.check, { borderColor: t.edge, backgroundColor: on ? t.leaf : t.paper }]}>
                    {on && <Text style={{ color: "#fff", fontFamily: fonts.bodyBold, fontSize: 14 }}>✓</Text>}
                  </View>
                  <Picture image={c.image_url} emoji={c.emoji} size={48} />
                  <Text style={[styles.catName, { color: t.ink }]} numberOfLines={2}>{c.name}</Text>
                  <Text style={{ fontFamily: fonts.bodyBold, color: t.muted, fontSize: 13 }}>{s.objects(c.items_count)}</Text>
                </Pressable>
              )
            })}
          </View>
        )}

        <Text style={[styles.h2, { color: t.ink, marginTop: 8 }]}>{s.mySeries}</Text>
        <View style={[styles.panel, { backgroundColor: t.paper, borderColor: t.edge }, hardShadow(t.drop, 4)]}>
          <Setting label={s.howMany}>
            {[10, 20, 50, 100].map((n) => <Chip key={n} label={String(n)} selected={settings.count === n} onPress={() => update({ count: n })} />)}
          </Setting>
          <Setting label={s.thinkTime}>
            {[3, 5, 8, 10].map((n) => <Chip key={n} label={`${n} s`} selected={settings.delay === n} onPress={() => update({ delay: n })} />)}
          </Setting>
          <Setting label={s.countdown}>
            {(["tick", "voice", "silent"] as CountStyle[]).map((c) => (
              <Chip key={c} label={s[c]} selected={settings.countStyle === c} onPress={() => update({ countStyle: c })} />
            ))}
          </Setting>
          <Toggle label={s.showWord} value={settings.showWord} onChange={(v) => update({ showWord: v })} />
          {languages.length > 1 && <Toggle label={s.showTranslation} value={settings.showTranslation} onChange={(v) => update({ showTranslation: v })} />}
          <Toggle label={s.autoNext} value={settings.autoNext} onChange={(v) => update({ autoNext: v })} />
        </View>
      </ScrollView>

      <View style={[styles.startBar, { paddingBottom: insets.bottom + 14, backgroundColor: t.sky }]}>
        {startError && <Text style={{ fontFamily: fonts.bodyBold, color: t.coral, textAlign: "center" }}>{startError}</Text>}
        <BigButton
          label={starting ? s.loading : settings.categories.length ? s.start(settings.count) : s.pick}
          onPress={onStart}
          disabled={!settings.categories.length || starting || !!error}
          style={{ width: "100%", maxWidth: 520 }}
        />
      </View>
    </View>
  )
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme()
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: t.ink }}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 18, width: "100%", maxWidth: 760, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  logo: { width: 48, height: 48, borderRadius: 14, borderWidth: 3, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  h2: { fontFamily: fonts.display, fontSize: 22 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cat: { borderWidth: 3, borderRadius: 18, padding: 12, gap: 2, minHeight: 130 },
  check: { position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  catName: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 21, marginTop: 4 },
  panel: { borderWidth: 3, borderRadius: 20, padding: 16, gap: 16 },
  startBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, alignItems: "center", gap: 8 },
})
