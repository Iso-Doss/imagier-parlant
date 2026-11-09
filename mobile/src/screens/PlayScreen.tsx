import { useEffect, useRef, useState } from "react"
import { Animated, AppState, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useKeepAwake } from "expo-keep-awake"
import * as Haptics from "expo-haptics"
import * as Speech from "expo-speech"
import { mediaUrl, type Item, type Series } from "../api"
import type { AnswerResult } from "../account"
import { playChime, playRecording, playTick, say, stopSpeaking } from "../audio"
import { CountdownRing } from "../components/CountdownRing"
import { BigButton, Picture, SmallButton } from "../components/ui"
import { NUMBERS, strings } from "../i18n"
import { hintsFor, matchAnswer } from "../lib/answerMatcher"
import { listen } from "../speech"
import type { Settings } from "../settings"
import { fonts, hardShadow, useTheme } from "../theme"

type Phase = "question" | "count" | "answer"
const ABORT = Symbol("abort")
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ARTICLE = /^(un |une |des |du |de l'|le |la |les |l'|a |an |the |some )(.*)$/i

export type PlayResult = { item_id: number; result: AnswerResult; response_ms: number | null }

export function PlayScreen({ series, settings, onQuit, onDone }: {
  series: Series
  settings: Settings
  onQuit: (results: PlayResult[]) => void
  onDone: (results: PlayResult[]) => void
}) {
  useKeepAwake()
  const t = useTheme()
  const s = strings(settings.lang)
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const { items, language } = series

  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>("question")
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)

  const runId = useRef(0)
  const pausedRef = useRef(false)
  const skipRef = useRef(false)
  // Réponse du parent pendant le compte à rebours (mode « un adulte valide »)
  const verdictRef = useRef<"correct" | "wrong" | null>(null)
  const results = useRef<PlayResult[]>([])
  const [verdict, setVerdict] = useState<"correct" | "wrong" | null>(null)
  // Micro indisponible pendant la série (refus, pas de reconnaissance) : on passe au mode parent
  const [fallback, setFallback] = useState(false)
  const fallbackRef = useRef(false)
  const voiceMode = settings.answerMode === "voice" && !fallback
  const parentMode = settings.answerMode === "parent" || (settings.answerMode === "voice" && fallback)
  const judged = settings.answerMode !== "watch"
  const [hearing, setHearing] = useState<"listening" | "close">("listening")
  const volume = useRef(new Animated.Value(0)).current
  const pop = useRef(new Animated.Value(0)).current
  const reveal = useRef(new Animated.Value(0)).current

  const total = settings.delay * 1000
  const secondsLeft = Math.max(1, Math.ceil((total - elapsed) / 1000))

  // Waits ms milliseconds, frozen while paused. Returns "skip" when the child taps Next.
  async function wait(ms: number, my: number, onFrame?: (el: number) => void) {
    let el = 0
    let last = Date.now()
    while (el < ms) {
      if (runId.current !== my) throw ABORT
      if (skipRef.current) { skipRef.current = false; return "skip" }
      if (verdictRef.current) return "verdict"
      await sleep(50)
      const now = Date.now()
      if (!pausedRef.current) el += now - last
      last = now
      onFrame?.(Math.min(el, ms))
    }
    return "done"
  }
  async function waitWhilePaused(my: number) {
    while (pausedRef.current) { if (runId.current !== my) throw ABORT; await sleep(80) }
  }

  async function speakAnswer(item: Item) {
    const url = mediaUrl(item.audio_url)
    if (url && (await playRecording(url))) return
    await say(item.sentence ?? item.name ?? "", language.tts_locale)
  }

  async function playItem(item: Item, my: number) {
    // 1. Picture + question
    setPhase("question")
    setElapsed(0)
    reveal.setValue(0)
    pop.setValue(0)
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start()
    await wait(450, my)
    await waitWhilePaused(my)
    await say(language.question, language.tts_locale)
    await waitWhilePaused(my)

    // 2. Countdown
    setPhase("count")
    verdictRef.current = null
    setVerdict(null)
    let shown = settings.delay
    let answeredAt: number | null = null
    let heardSomething = false
    const listening = settings.answerMode === "voice" && !fallbackRef.current
    const stopListening = listening ? startListening(item, () => { heardSomething = true }) : () => {}
    beat(shown)
    let result: Awaited<ReturnType<typeof wait>>
    try {
      result = await wait(total, my, (el) => {
        setElapsed(el)
        if (verdictRef.current && answeredAt === null) answeredAt = el
        const left = Math.max(1, Math.ceil((total - el) / 1000))
        if (left !== shown && el < total) { shown = left; beat(left) }
      })
    } finally {
      stopListening()
    }

    // Ce qu'on retient pour les progrès : jamais la voix, seulement le résultat
    const verdictNow = verdictRef.current as "correct" | "wrong" | null
    const outcome: AnswerResult = result === "skip" ? "skipped"
      : !judged ? "skipped"
      : verdictNow ?? (listening && heardSomething && !fallbackRef.current ? "wrong" : "silent")
    results.current.push({ item_id: item.id, result: outcome, response_ms: outcome === "correct" ? answeredAt : null })

    // 3. Answer
    setPhase("answer")
    Animated.timing(reveal, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start()
    // Le carillon seulement si c'est trouvé (ou en mode « on regarde ») : jamais de son négatif
    if (result !== "skip" && (outcome === "correct" || !judged)) { playChime(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}) }
    await sleep(250)
    if (runId.current !== my) throw ABORT
    await speakAnswer(item)
    await waitWhilePaused(my)

    // 4. Short pause, or wait for "Next"
    if (settings.autoNext) await wait(2200, my)
    else while (true) { if (runId.current !== my) throw ABORT; if (skipRef.current) { skipRef.current = false; break } await sleep(60) }
  }

  // Écoute pendant le compte à rebours ; s'arrête dès que la réponse est juste.
  function startListening(item: Item, onAnything: () => void) {
    const forms = [item.name ?? "", ...(item.aliases ?? [])].filter((f) => f !== "")
    setHearing("listening")
    volume.setValue(0)
    let stop = () => {}
    stop = listen(language.tts_locale, hintsFor(forms, language.code), {
      onHeard: (transcripts) => {
        if (pausedRef.current || verdictRef.current) return
        onAnything()
        const match = matchAnswer(transcripts, forms, { lang: language.code, tolerance: settings.tolerance })
        if (match === "correct") {
          verdictRef.current = "correct"
          setVerdict("correct")
          stop()
        } else if (match === "close") setHearing("close")
      },
      onVolume: (level) => volume.setValue(level),
      onUnavailable: () => {
        fallbackRef.current = true
        setFallback(true)
      },
    })
    return () => stop()
  }

  function beat(n: number) {
    // Au micro, on ne compte pas à voix haute : la reconnaissance entendrait les chiffres
    const style = settings.answerMode === "voice" && settings.countStyle === "voice" ? "tick" : settings.countStyle
    if (style === "tick") playTick(n === 1)
    else if (style === "voice") {
      const word = NUMBERS[language.code]?.[n] ?? String(n)
      Speech.stop()
      Speech.speak(word, { language: language.tts_locale, rate: 1.1 })
    }
  }

  useEffect(() => {
    const my = ++runId.current
    ;(async () => {
      try {
        for (let i = 0; i < items.length; i++) {
          setIdx(i)
          await playItem(items[i], my)
        }
        onDone(results.current)
      } catch (e) {
        if (e !== ABORT) throw e
      }
    })()
    return () => { runId.current++; stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pause automatically when the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => { if (state !== "active") setPause(true) })
    return () => sub.remove()
  }, [])

  const setPause = (p: boolean) => {
    pausedRef.current = p
    setPaused(p)
    if (p) stopSpeaking()
  }
  const next = () => { skipRef.current = true; stopSpeaking() }
  const repeat = () => {
    const item = items[idx]
    if (phase === "answer") speakAnswer(item)
    else say(language.question, language.tts_locale)
  }
  const quit = () => { runId.current++; stopSpeaking(); onQuit(results.current) }
  const answer = (v: "correct" | "wrong") => {
    if (phase !== "count" || verdictRef.current) return
    verdictRef.current = v
    setVerdict(v)
    Haptics.selectionAsync().catch(() => {})
  }

  const item = items[idx]
  const cats = new Set(items.map((i) => i.category?.slug))
  const catLabel = cats.size > 1 ? s.mixed : item.category?.name ?? ""
  const cardSize = Math.min(width - 32, height * 0.46, 460)
  const word = item.name ?? ""
  const m = word.match(ARTICLE)

  return (
    <View style={{ flex: 1, backgroundColor: t.sky, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}>
      <View style={styles.wrap}>
        <View style={styles.bar}>
          <SmallButton icon="✕" onPress={quit} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.meta}>
              <Text style={[styles.metaText, { color: t.ink }]}>{idx + 1} / {items.length}</Text>
              <Text style={[styles.metaText, { color: t.muted }]} numberOfLines={1}>{catLabel}</Text>
            </View>
            <View style={[styles.track, { borderColor: t.edge, backgroundColor: t.paper }]}>
              <View style={{ height: "100%", width: `${((idx + (phase === "answer" ? 1 : 0)) / items.length) * 100}%`, backgroundColor: t.leaf }} />
            </View>
          </View>
          <SmallButton icon="❚❚" onPress={() => setPause(true)} />
        </View>

        <View style={styles.center}>
          <View style={[styles.card, { width: cardSize, height: cardSize, borderColor: t.edge, backgroundColor: t.paper }, hardShadow(t.drop, 6)]}>
            <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "0deg"] }) }], opacity: pop }}>
              <Picture image={item.image_url} emoji={item.emoji} size={item.image_url ? cardSize - 8 : cardSize * 0.62} />
            </Animated.View>
          </View>

          <View style={styles.stage}>
            {phase === "question" && <Text style={[styles.question, { color: t.ink }]}>{language.question}</Text>}
            {phase === "count" && <CountdownRing progress={elapsed / total} seconds={secondsLeft} />}
            {phase === "answer" && (
              <Animated.View style={{ alignItems: "center", gap: 4, opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
                {settings.showWord ? (
                  <Text style={[styles.word, { color: t.ink }]} adjustsFontSizeToFit numberOfLines={2}>
                    {m ? <Text style={[styles.article, { color: t.muted }]}>{m[1]}</Text> : null}
                    {m ? m[2] : word}
                  </Text>
                ) : (
                  <Text style={[styles.said, { color: t.leaf }]}>{item.sentence} !</Text>
                )}
                {judged && verdict === "correct" && <Text style={[styles.cheer, { color: t.leaf }]}>{s.bravo}</Text>}
                {settings.showTranslation && item.translation && (
                  <Text style={[styles.translation, { color: t.muted }]}>{item.translation}</Text>
                )}
              </Animated.View>
            )}
          </View>
        </View>

        {voiceMode && phase === "count" ? (
          <View style={styles.controls}>
            <MicIndicator volume={volume} label={hearing === "close" ? s.almost : s.listening} />
            <SmallButton label={`${s.next} →`} onPress={next} />
          </View>
        ) : parentMode && phase !== "answer" ? (
          <View style={{ gap: 8 }}>
          {fallback && <Text style={[styles.fallback, { color: t.muted }]}>{s.voiceUnavailable}</Text>}
          <View style={styles.controls}>
            <JudgeButton label={s.notYet} icon="✗" color={t.coral} disabled={phase !== "count"} onPress={() => answer("wrong")} />
            <JudgeButton label={s.found} icon="✓" color={t.leaf} disabled={phase !== "count"} onPress={() => answer("correct")} />
          </View>
          </View>
        ) : (
          <View style={styles.controls}>
            <SmallButton icon="🔊" label={s.repeat} onPress={repeat} />
            <SmallButton label={`${s.next} →`} onPress={next} primary />
          </View>
        )}
      </View>

      {paused && (
        <View style={[StyleSheet.absoluteFill, styles.pauseLayer, { backgroundColor: t.sky + "F2" }]}>
          <Text style={[styles.question, { color: t.ink, fontSize: 40 }]}>{s.paused}</Text>
          <BigButton label={`▶  ${s.resume}`} onPress={() => setPause(false)} />
          <SmallButton label={s.quit} onPress={quit} />
        </View>
      )}
    </View>
  )
}

/** Micro qui grossit avec la voix : l'enfant voit qu'on l'écoute. */
function MicIndicator({ volume, label }: { volume: Animated.Value; label: string }) {
  const t = useTheme()
  return (
    <View style={styles.mic} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <View style={styles.micWrap}>
        <Animated.View style={[styles.micHalo, { backgroundColor: t.leaf, opacity: volume.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] }), transform: [{ scale: volume.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }]} />
        <View style={[styles.micDot, { borderColor: t.edge, backgroundColor: t.paper }]}><Text style={styles.micIcon}>🎤</Text></View>
      </View>
      <Text style={[styles.micLabel, { color: t.ink }]}>{label}</Text>
    </View>
  )
}

/** Gros bouton du parent : ✓ trouvé / ✗ pas encore */
function JudgeButton({ label, icon, color, onPress, disabled }: { label: string; icon: string; color: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.judge,
        { borderColor: t.edge, backgroundColor: color, opacity: disabled ? 0.45 : 1 },
        pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }], ...hardShadow(t.drop, 1) } : hardShadow(t.drop, 4),
      ]}
    >
      <Text style={styles.judgeIcon}>{icon}</Text>
      <Text style={styles.judgeLabel}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fallback: { fontFamily: fonts.body, fontSize: 14, textAlign: "center" },
  mic: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 64 },
  micWrap: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  micHalo: { position: "absolute", width: 60, height: 60, borderRadius: 30 },
  micDot: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  micIcon: { fontSize: 24 },
  micLabel: { fontFamily: fonts.display, fontSize: 22 },
  judge: { flex: 1, maxWidth: 220, minHeight: 72, borderWidth: 3, borderRadius: 20, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  judgeIcon: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: "#fff" },
  judgeLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#fff" },
  cheer: { fontFamily: fonts.display, fontSize: 24 },
  wrap: { flex: 1, width: "100%", maxWidth: 620, alignSelf: "center", gap: 16 },
  bar: { flexDirection: "row", alignItems: "center", gap: 12 },
  meta: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  metaText: { fontFamily: fonts.bodyBold, fontSize: 15, fontVariant: ["tabular-nums"] },
  track: { height: 14, borderRadius: 999, borderWidth: 2.5, overflow: "hidden" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  card: { borderWidth: 4, borderRadius: 28, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  stage: { minHeight: 120, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  question: { fontFamily: fonts.display, fontSize: 32, textAlign: "center" },
  word: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60, textAlign: "center" },
  article: { fontFamily: fonts.displayBold, fontSize: 28 },
  said: { fontFamily: fonts.display, fontSize: 30, textAlign: "center" },
  translation: { fontFamily: fonts.bodyBold, fontSize: 18 },
  controls: { flexDirection: "row", justifyContent: "center", gap: 12 },
  pauseLayer: { alignItems: "center", justifyContent: "center", gap: 18, padding: 24 },
})
