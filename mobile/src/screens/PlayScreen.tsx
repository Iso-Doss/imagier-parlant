import { useEffect, useRef, useState } from "react"
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useKeepAwake } from "expo-keep-awake"
import * as Haptics from "expo-haptics"
import { mediaUrl, type Item, type Series } from "../api"
import type { AnswerResult } from "../account"
import { playChime, playRecording, playTick, say, stopSpeaking } from "../audio"
import { CountdownRing } from "../components/CountdownRing"
import { Confetti, useTyping } from "../components/motion"
import { BigButton, Picture, SmallButton } from "../components/ui"
import { NUMBERS, strings } from "../i18n"
import { hintsFor, matchAnswer } from "../lib/answerMatcher"
import { preloadItems } from "../preload"
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
  // Animations (catalogue UI/UX §3.2) ; tout est immédiat si « Réduire les animations » est actif
  const reduced = useReducedMotion()
  const volume = useSharedValue(0)
  const enter = useSharedValue(0)
  const leave = useSharedValue(0)
  const questionIn = useSharedValue(0)
  const reveal = useSharedValue(0)
  const jump = useSharedValue(0)
  const [burst, setBurst] = useState(0)
  const [ringFound, setRingFound] = useState(false)

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

  const animate = (value: SharedValue<number>, to: number, how: (to: number) => number) => {
    value.value = reduced ? to : how(to)
  }

  async function playItem(item: Item, i: number, my: number) {
    // Les 3 objets suivants se chargent pendant celui-ci
    preloadItems(items.slice(i + 1, i + 4))

    // 1. Picture + question : l'image arrive de la droite, la question monte en fondu
    setPhase("question")
    setElapsed(0)
    reveal.value = 0
    questionIn.value = 0
    leave.value = 0
    enter.value = 0
    animate(enter, 1, (to) => withSpring(to, { stiffness: 220, damping: 20 }))
    animate(questionIn, 1, (to) => withTiming(to, { duration: 250 }))
    await wait(450, my)
    await waitWhilePaused(my)
    await say(language.question, language.tts_locale)
    await waitWhilePaused(my)

    // 2. Countdown
    setPhase("count")
    verdictRef.current = null
    setVerdict(null)
    setRingFound(false)
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
    // La réponse est notée : la pause qui suit ne doit pas s'arrêter tout de suite
    verdictRef.current = null

    // Bonne réponse : l'anneau devient vert un instant avant la réponse
    if (outcome === "correct" && !reduced) {
      setRingFound(true)
      await sleep(350)
      if (runId.current !== my) throw ABORT
    }

    // 3. Answer
    setPhase("answer")
    animate(reveal, 1, (to) => withTiming(to, { duration: 380, easing: Easing.out(Easing.back(1.6)) }))
    if (outcome === "correct") {
      // Bonne réponse : la carte saute et 12 confettis jaillissent
      setBurst((b) => b + 1)
      if (!reduced) jump.value = withSequence(withTiming(-28, { duration: 160 }), withSpring(0, { stiffness: 300, damping: 10 }))
    }
    // Le carillon seulement si c'est trouvé (ou en mode « on regarde ») : jamais de son négatif
    if (result !== "skip" && (outcome === "correct" || !judged)) { playChime(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}) }
    await sleep(250)
    if (runId.current !== my) throw ABORT
    await speakAnswer(item)
    await waitWhilePaused(my)

    // 4. Short pause, or wait for "Next"
    if (settings.autoNext) await wait(2200, my)
    else while (true) { if (runId.current !== my) throw ABORT; if (skipRef.current) { skipRef.current = false; break } await sleep(60) }

    // 5. L'image s'envole vers la gauche
    if (!reduced) {
      leave.value = withTiming(1, { duration: 300, easing: Easing.in(Easing.quad) })
      await sleep(300)
    }
  }

  // Écoute pendant le compte à rebours ; s'arrête dès que la réponse est juste.
  function startListening(item: Item, onAnything: () => void) {
    const forms = [item.name ?? "", ...(item.aliases ?? [])].filter((f) => f !== "")
    setHearing("listening")
    volume.value = 0
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
      onVolume: (level) => { volume.value = withTiming(level, { duration: 100 }) },
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
      say(word, language.tts_locale, { quick: true })
    }
  }

  useEffect(() => {
    const my = ++runId.current
    ;(async () => {
      try {
        for (let i = 0; i < items.length; i++) {
          setIdx(i)
          await playItem(items[i], i, my)
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
  // Tablette en paysage : l'image à gauche (55 %), le texte et l'anneau à droite
  const landscape = width > height && width >= 700
  const cardSize = landscape ? Math.min(width * 0.5, height * 0.72, 560) : Math.min(width - 32, height * 0.46, 460)
  const word = item.name ?? ""
  const m = word.match(ARTICLE)
  // Le nom s'écrit lettre par lettre pendant qu'il est dit
  const typed = useTyping(word, phase === "answer" && settings.showWord)
  const article = m ? m[1] : ""
  const shownArticle = article.slice(0, typed)
  const shownRest = (m ? m[2] : word).slice(0, Math.max(0, typed - article.length))

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value * (1 - leave.value),
    transform: [
      { translateX: (1 - enter.value) * 80 - leave.value * width * 0.7 },
      { translateY: jump.value },
      { scale: 0.85 + 0.15 * enter.value },
      { rotate: `${(1 - enter.value) * -4}deg` },
    ],
  }))
  const questionStyle = useAnimatedStyle(() => ({ opacity: questionIn.value, transform: [{ translateY: (1 - questionIn.value) * 12 }] }))
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value, transform: [{ translateY: (1 - reveal.value) * 14 }] }))

  return (
    <View style={{ flex: 1, backgroundColor: t.sky, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}>
      <View style={[styles.wrap, landscape && { maxWidth: 1100 }]}>
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

        <View style={[styles.center, landscape && styles.centerRow]}>
          <Animated.View style={[styles.card, { width: cardSize, height: cardSize, borderColor: t.edge, backgroundColor: t.paper }, hardShadow(t.drop, 6), cardStyle]}>
            <Picture image={item.image_url} emoji={item.emoji} size={item.image_url ? cardSize - 8 : cardSize * 0.62} />
          </Animated.View>
          <Confetti burst={burst} />

          <View style={[styles.stage, landscape && styles.stageSide]}>
            {phase === "question" && <Animated.Text style={[styles.question, { color: t.ink }, questionStyle]}>{language.question}</Animated.Text>}
            {phase === "count" && <CountdownRing progress={elapsed / total} seconds={secondsLeft} found={ringFound} />}
            {phase === "answer" && (
              <Animated.View style={[{ alignItems: "center", gap: 4 }, revealStyle]}>
                {settings.showWord ? (
                  <Text style={[styles.word, { color: t.ink }]} adjustsFontSizeToFit numberOfLines={2} accessibilityLabel={word}>
                    {shownArticle ? <Text style={[styles.article, { color: t.muted }]}>{shownArticle}</Text> : null}
                    {shownRest || "\u00a0"}
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
function MicIndicator({ volume, label }: { volume: SharedValue<number>; label: string }) {
  const t = useTheme()
  const halo = useAnimatedStyle(() => ({ opacity: 0.15 + 0.35 * volume.value, transform: [{ scale: 1 + 0.6 * volume.value }] }))
  // Le micro grossit selon le volume (0,9 à 1,2)
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: 0.9 + 0.3 * volume.value }] }))
  return (
    <View style={styles.mic} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <View style={styles.micWrap}>
        <Animated.View style={[styles.micHalo, { backgroundColor: t.leaf }, halo]} />
        <Animated.View style={[styles.micDot, { borderColor: t.edge, backgroundColor: t.paper }, dot]}><Text style={styles.micIcon}>🎤</Text></Animated.View>
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
  centerRow: { flexDirection: "row", gap: 32 },
  stageSide: { flex: 1, alignSelf: "center" },
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
