import { useCallback, useEffect, useRef, useState } from "react"
import Animated, { useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, useAnimatedStyle } from "react-native-reanimated"
import { ActivityIndicator, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View, type ViewInstance, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AVATARS, useAccount } from "../account"
import { NetworkError, fetchCategories, fetchLanguages, type Category, type Language } from "../api"
import { categoriesFromPacks, languagesFromPacks } from "../lib/packs"
import { useOffline } from "../offline"
import { BigButton, Chip, Picture, Toggle } from "../components/ui"
import type { Rect } from "../components/LaunchOverlay"
import { strings } from "../i18n"
import { micPermission } from "../speech"
import type { AnswerMode, CountStyle, Settings } from "../settings"
import { fonts, hardShadow, tintFor, useTheme } from "../theme"

type Props = {
  settings: Settings
  update: (p: Partial<Settings>) => void
  /** `from` : position du bouton, pour la transition vers la partie */
  onStart: (from?: Rect, emojis?: string[]) => void
  starting: boolean
  startError: string | null
  onParent: () => void
}

export function HomeScreen({ settings, update, onStart, starting, startError, onParent }: Props) {
  const acc = useAccount()
  const t = useTheme()
  const s = strings(settings.lang)
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  // Tablette en paysage : catégories à gauche, série à droite, sans étapes
  const wide = width >= 900 && width > height
  const [languages, setLanguages] = useState<Language[]>([])
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Pas de réseau : on propose les catégories téléchargées
  const [offlineOnly, setOfflineOnly] = useState(false)
  const offline = useOffline()
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  // Deux étapes : 1. les catégories, 2. la série
  const [step, setStep] = useState<1 | 2>(1)
  const reduced = useReducedMotion()
  const fade = useSharedValue(1)
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: (1 - fade.value) * 12 }] }))
  const scroll = useRef<ScrollViewInstance>(null)
  const startRef = useRef<ViewInstance>(null)
  const launch = () => {
    const emojis = (categories ?? []).filter((c) => settings.categories.includes(c.slug)).map((c) => c.emoji ?? "🖼️")
    const node = startRef.current
    if (!node) return onStart(undefined, emojis)
    node.measureInWindow((x, y, w, h) => onStart(w > 0 ? { x, y, width: w, height: h } : undefined, emojis))
  }
  const goTo = (next: 1 | 2) => {
    if (next === step) return
    setStep(next)
    scroll.current?.scrollTo({ y: 0, animated: false })
    if (reduced) return
    fade.value = 0
    fade.value = withTiming(1, { duration: 220 })
  }

  // Le micro ne s'active qu'après l'accord d'un adulte, dans l'espace parent.
  const chooseMode = async (m: AnswerMode) => {
    setVoiceNote(null)
    if (m !== "voice") return update({ answerMode: m })
    const permission = await micPermission()
    if (permission === "granted") return update({ answerMode: "voice" })
    if (permission === "unavailable") return setVoiceNote(s.voiceUnavailable)
    setVoiceNote(s.voiceNeedsParent)
    onParent()
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const [langs, cats] = await Promise.all([fetchLanguages(), fetchCategories(settings.lang)])
      setLanguages(langs)
      setCategories(cats)
      setOfflineOnly(false)
      // Forget categories that no longer exist
      const known = new Set(cats.map((c) => c.slug))
      if (settings.categories.some((c) => !known.has(c))) update({ categories: settings.categories.filter((c) => known.has(c)) })
    } catch (e) {
      const { packs, files } = offline
      if (e instanceof NetworkError && packs.length > 0) {
        setLanguages(languagesFromPacks(packs))
        setCategories(categoriesFromPacks(packs, settings.lang, files))
        setOfflineOnly(true)
        // Seules les catégories téléchargées restent choisies
        const have = new Set(packs.map((p) => p.slug))
        if (settings.categories.some((c) => !have.has(c))) update({ categories: settings.categories.filter((c) => have.has(c)) })
      } else {
        setError((e as Error).message)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.lang, offline.ready, offline.packs])

  useEffect(() => { if (offline.ready) load() }, [load, offline.ready])

  const gap = 12
  const contentWidth = wide ? (Math.min(width, 1200) - 32 - 24) * (1.45 / 2.45) : Math.min(width, 760) - 32
  const columns = contentWidth > 640 ? 4 : contentWidth > 440 ? 3 : 2
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns
  const selected = new Set(settings.categories)
  const allSelected = !!categories && categories.length > 0 && categories.every((c) => selected.has(c.slug))

  // En-tête : langue et thème
  const langs = languages.length ? languages.map((l) => l.code) : ["fr", "en"]
  const currentLang = languages.find((l) => l.code === settings.lang)
  const nextLanguage = () => update({ lang: langs[(langs.indexOf(settings.lang) + 1) % langs.length] })
  const themes = ["system", "light", "dark"] as const
  const themeName = settings.theme === "light" ? s.themeLight : settings.theme === "dark" ? s.themeDark : s.themeSystem
  const nextTheme = () => update({ theme: themes[(themes.indexOf(settings.theme) + 1) % themes.length] })

  const toggleCat = (slug: string) =>
    update({ categories: selected.has(slug) ? settings.categories.filter((c) => c !== slug) : [...settings.categories, slug] })

  const catsPart = (
        <>

        {acc.profiles.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: t.ink }]}>{s.whoPlays}</Text>
            <View style={styles.chips}>
              {acc.profiles.map((p) => (
                <Pressable key={p.id} onPress={() => acc.selectProfile(p.id)} accessibilityRole="button" accessibilityState={{ selected: acc.activeProfile?.id === p.id }}
                  style={[styles.who, { borderColor: t.edge, backgroundColor: acc.activeProfile?.id === p.id ? t.sun : t.paper }]}>
                  <Text style={{ fontSize: 22 }}>{AVATARS[p.avatar] ?? "🙂"}</Text>
                  <Text style={[styles.label, { color: t.ink }]}>{p.nickname}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => acc.selectProfile(null)} accessibilityRole="button" accessibilityState={{ selected: !acc.activeProfile }}
                style={[styles.who, { borderColor: t.edge, backgroundColor: !acc.activeProfile ? t.sun : t.paper }]}>
                <Text style={[styles.label, { color: t.ink }]}>{s.guest}</Text>
              </Pressable>
            </View>
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

        {offlineOnly && (
          <View style={[styles.note, { backgroundColor: t.paper, borderColor: t.edge }]}>
            <Text style={{ fontSize: 18 }}>📴</Text>
            <Text style={{ fontFamily: fonts.bodyBold, color: t.ink, flexShrink: 1 }}>{s.offlineOnly}</Text>
            <Pressable onPress={load} hitSlop={8} accessibilityRole="button">
              <Text style={{ fontFamily: fonts.bodyBold, color: t.coral, textDecorationLine: "underline" }}>{s.retry}</Text>
            </Pressable>
          </View>
        )}

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
              return <CategoryCard key={c.slug} category={c} index={i} on={on} width={cardWidth} label={s.objects(c.items_count)} saved={!!offline.installed[c.slug]} savedLabel={s.savedOffline} onPress={() => toggleCat(c.slug)} />
            })}
          </View>
        )}

        </>
  )
  const seriesPart = (
        <>
        <View style={styles.sectionHead}>
          <Text style={[styles.h2, { color: t.ink }]}>{s.mySeries}</Text>
          {!wide && (
            <Pressable onPress={() => goTo(1)} hitSlop={8} accessibilityRole="button">
              <Text style={{ fontFamily: fonts.bodyBold, color: t.coral, textDecorationLine: "underline" }}>{s.change}</Text>
            </Pressable>
          )}
        </View>
        {categories && !wide && (
          <View style={styles.chips}>
            {categories.filter((c) => selected.has(c.slug)).map((c) => (
              <View key={c.slug} style={[styles.who, { borderColor: t.edge, backgroundColor: t.paper }]}>
                <Picture image={c.thumb_url ?? c.image_url} emoji={c.emoji} size={22} />
                <Text style={[styles.label, { color: t.ink }]}>{c.name}</Text>
              </View>
            ))}
          </View>
        )}
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
          <Setting label={s.answerMode}>
            {(["voice", "parent", "watch"] as AnswerMode[]).map((m) => (
              <Chip key={m} label={m === "voice" ? s.modeVoice : m === "parent" ? s.modeParent : s.modeWatch} selected={settings.answerMode === m} onPress={() => chooseMode(m)} />
            ))}
          </Setting>
          {voiceNote && <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.muted }}>{voiceNote}</Text>}
          <Toggle label={s.showWord} value={settings.showWord} onChange={(v) => update({ showWord: v })} />
          {languages.length > 1 && <Toggle label={s.showTranslation} value={settings.showTranslation} onChange={(v) => update({ showTranslation: v })} />}
          <Toggle label={s.autoNext} value={settings.autoNext} onChange={(v) => update({ autoNext: v })} />
        </View>
        </>
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.sky }}>
      <ScrollView ref={scroll} contentContainerStyle={[styles.content, wide && { maxWidth: 1200 }, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}>
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
          <View style={styles.tools}>
            {/* Langue : passe à la suivante */}
            <HeadButton label={s.languageButton(currentLang?.name ?? settings.lang)} onPress={nextLanguage}>
              <Text style={[styles.toolText, { color: t.ink }]}>{settings.lang.toUpperCase()}</Text>
            </HeadButton>
            {/* Thème : téléphone → clair → sombre */}
            <HeadButton label={s.theme(themeName)} onPress={nextTheme}>
              <Text style={{ fontSize: 19 }}>{settings.theme === "light" ? "☀️" : settings.theme === "dark" ? "🌙" : "🌓"}</Text>
            </HeadButton>
            {/* Compte : connexion ou création, derrière le portail parental */}
            <HeadButton label={acc.account ? s.accountSigned(acc.account.email) : s.account} onPress={onParent}>
              <Text style={{ fontSize: 19 }}>{acc.activeProfile ? AVATARS[acc.activeProfile.avatar] ?? "👤" : "👤"}</Text>
              <View style={[styles.lockBadge, { backgroundColor: acc.account ? t.leaf : t.sun, borderColor: t.edge }]}>
                <Text style={{ fontSize: 9 }}>{acc.account ? "✓" : "🔒"}</Text>
              </View>
            </HeadButton>
          </View>
        </View>

        {!wide && <View style={styles.steps} accessibilityRole="tablist">
          {([1, 2] as const).map((n) => {
            const active = step === n
            const reachable = n === 1 || settings.categories.length > 0
            return (
              <Pressable key={n} onPress={() => reachable && goTo(n)} disabled={!reachable} accessibilityRole="tab"
                accessibilityState={{ selected: active, disabled: !reachable }}
                style={[styles.step, { borderColor: t.edge, backgroundColor: active ? t.ink : t.paper, opacity: reachable ? 1 : 0.5 }]}>
                <View style={[styles.stepNum, { backgroundColor: active ? t.sun : t.sky, borderColor: t.edge }]}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 15, color: active ? t.sunInk : t.ink }}>{n}</Text>
                </View>
                <Text style={[styles.label, { color: active ? t.paper : t.ink, flexShrink: 1 }]} numberOfLines={1}>
                  {n === 1 ? s.stepCats : s.mySeries}
                </Text>
              </Pressable>
            )
          })}
        </View>}

        {wide ? (
          <View style={styles.columns}>
            <View style={{ flex: 1.45, gap: 18 }}>{catsPart}</View>
            <View style={{ flex: 1, gap: 18 }}>{seriesPart}</View>
          </View>
        ) : (
          <Animated.View style={[{ gap: 18 }, fadeStyle]}>{step === 1 ? catsPart : seriesPart}</Animated.View>
        )}
      </ScrollView>

      <View style={[styles.startBar, { paddingBottom: insets.bottom + 14, backgroundColor: t.sky }]}>
        {startError && <Text style={{ fontFamily: fonts.bodyBold, color: t.coral, textAlign: "center" }}>{startError}</Text>}
        {step === 1 && !wide ? (
          <BigButton
            label={settings.categories.length ? `${s.nextStep} · ${s.catsChosen(settings.categories.length)} →` : s.pick}
            onPress={() => goTo(2)}
            disabled={!settings.categories.length || !!error}
            style={{ width: "100%", maxWidth: 520 }}
          />
        ) : (
          <View ref={startRef} collapsable={false} style={{ width: "100%", maxWidth: 520 }}>
            <BigButton
              label={starting ? s.loading : s.start(settings.count)}
              onPress={launch}
              disabled={!settings.categories.length || starting || !!error}
              style={{ width: "100%" }}
            />
          </View>
        )}
      </View>
    </View>
  )
}

/** Bouton carré de l'en-tête (langue, thème, compte) */
function HeadButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => [styles.tool, { borderColor: t.edge, backgroundColor: t.paper }, pressed ? { transform: [{ translateX: 1 }, { translateY: 1 }] } : hardShadow(t.drop, 2)]}>
      {children}
    </Pressable>
  )
}

/** Carte de catégorie : rebondit (1 → 1,08 → 1) quand on la choisit ou l'enlève. */
function CategoryCard({ category: c, index: i, on, width, label, saved, savedLabel, onPress }: {
  category: Category
  index: number
  on: boolean
  width: number
  label: string
  /** Téléchargée : jouable sans réseau */
  saved: boolean
  savedLabel: string
  onPress: () => void
}) {
  const t = useTheme()
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!reduced) scale.value = withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, { stiffness: 300, damping: 12 }))
  }, [on, reduced, scale])
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Animated.View style={bounce}>
      <Pressable
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${c.name}, ${label}${saved ? `, ${savedLabel}` : ""}`}
        style={({ pressed }) => [
          styles.cat,
          { width, backgroundColor: tintFor(t, c.color, i), borderColor: t.edge },
          pressed ? { transform: [{ translateX: 2 }, { translateY: 2 }], ...hardShadow(t.drop, 2) } : hardShadow(t.drop, 4),
        ]}
      >
        <View style={[styles.check, { borderColor: t.edge, backgroundColor: on ? t.leaf : t.paper }]}>
          {on && <Text style={{ color: "#fff", fontFamily: fonts.bodyBold, fontSize: 14 }}>✓</Text>}
        </View>
        <Picture image={c.thumb_url ?? c.image_url} emoji={c.emoji} size={48} />
        <Text style={[styles.catName, { color: t.ink }]} numberOfLines={2}>{c.name}</Text>
        <Text style={{ fontFamily: fonts.bodyBold, color: t.muted, fontSize: 13 }}>{label}{saved ? "  📥" : ""}</Text>
      </Pressable>
    </Animated.View>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  tools: { flexDirection: "row", gap: 8 },
  tool: { width: 44, height: 44, borderRadius: 14, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  toolText: { fontFamily: fonts.display, fontSize: 16 },
  lockBadge: { position: "absolute", right: -6, bottom: -6, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.bodyBold, fontSize: 15 },
  who: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 2.5 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  logo: { width: 48, height: 48, borderRadius: 14, borderWidth: 3, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  h2: { fontFamily: fonts.display, fontSize: 22 },
  columns: { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  steps: { flexDirection: "row", gap: 8 },
  step: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 2.5 },
  stepNum: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cat: { borderWidth: 3, borderRadius: 18, padding: 12, gap: 2, minHeight: 130 },
  check: { position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  catName: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 21, marginTop: 4 },
  note: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 2.5, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  panel: { borderWidth: 3, borderRadius: 20, padding: 16, gap: 16 },
  startBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, alignItems: "center", gap: 8 },
})
