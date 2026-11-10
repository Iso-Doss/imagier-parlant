import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, { FadeIn, FadeInUp, ZoomIn } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { playChime, playTick, say, stopSpeaking } from "../audio"
import { CountdownRing } from "../components/CountdownRing"
import { Wiggle } from "../components/motion"
import { BigButton, SmallButton } from "../components/ui"
import { strings } from "../i18n"
import { fonts, hardShadow, useTheme } from "../theme"

/** Bienvenue (premier lancement) : trois écrans qui montrent le jeu en le jouant. */
export function WelcomeScreen({ lang, onDone }: { lang: string; onDone: (next: "play" | "account") => void }) {
  const t = useTheme()
  const s = strings(lang)
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState(0)
  const locale = lang === "fr" ? "fr-FR" : "en-US"
  const last = step === 2

  useEffect(() => () => { stopSpeaking() }, [])

  return (
    <View style={[styles.screen, { backgroundColor: t.sky, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.top}>
        {!last && (
          <Pressable onPress={() => onDone("play")} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.skip, { color: t.muted }]}>{s.skip}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        {step === 0 && <QuestionSlide key="q" text={s.welcomeQuestion} locale={locale} />}
        {step === 1 && <AnswerSlide key="a" text={s.welcomeAnswer} locale={locale} />}
        {step === 2 && <MicSlide key="m" text={s.welcomeMic} locale={locale} />}
        <Animated.Text key={`hint-${step}`} entering={FadeInUp.delay(250)} style={[styles.hint, { color: t.muted }]}>
          {[s.welcomeHint1, s.welcomeHint2, s.welcomeHint3][step]}
        </Animated.Text>
      </View>

      <View style={styles.dots} accessibilityLabel={`${step + 1} / 3`}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { borderColor: t.edge, backgroundColor: i === step ? t.ink : t.paper, width: i === step ? 26 : 12 }]} />
        ))}
      </View>

      <View style={styles.actions}>
        {last ? (
          <>
            <BigButton label={s.playNow} onPress={() => onDone("play")} style={{ width: "100%", maxWidth: 420 }} />
            <SmallButton label={s.createAccount} onPress={() => onDone("account")} />
          </>
        ) : (
          <BigButton label={`${s.nextStep} →`} onPress={() => setStep(step + 1)} style={{ width: "100%", maxWidth: 420 }} />
        )}
      </View>
    </View>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  return (
    <Animated.View entering={ZoomIn.springify().stiffness(220).damping(14)} style={[styles.card, { backgroundColor: t.paper, borderColor: t.edge }, hardShadow(t.drop, 6)]}>
      {children}
    </Animated.View>
  )
}

function QuestionSlide({ text, locale }: { text: string; locale: string }) {
  const t = useTheme()
  useEffect(() => { const timer = setTimeout(() => say(text, locale), 400); return () => clearTimeout(timer) }, [text, locale])
  return (
    <>
      <Card><Text style={styles.emoji}>🍎</Text></Card>
      <Animated.Text entering={FadeInUp.delay(150)} style={[styles.title, { color: t.ink }]}>{text}</Animated.Text>
    </>
  )
}

function AnswerSlide({ text, locale }: { text: string; locale: string }) {
  const t = useTheme()
  const [left, setLeft] = useState(3)
  useEffect(() => {
    playTick(false)
    const timer = setInterval(() => setLeft((n) => {
      if (n <= 1) { clearInterval(timer); return 0 }
      playTick(n === 2)
      return n - 1
    }), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (left !== 0) return
    playChime()
    const timer = setTimeout(() => say(text, locale), 250)
    return () => clearTimeout(timer)
  }, [left, text, locale])
  return (
    <>
      <Card><Text style={styles.emoji}>🍎</Text></Card>
      <View style={styles.stage}>
        {left > 0
          ? <CountdownRing progress={(3 - left) / 3} seconds={left} />
          : <Animated.Text entering={FadeInUp} style={[styles.title, { color: t.leaf }]}>{text}</Animated.Text>}
      </View>
    </>
  )
}

function MicSlide({ text, locale }: { text: string; locale: string }) {
  const t = useTheme()
  useEffect(() => { const timer = setTimeout(() => say(text, locale), 400); return () => clearTimeout(timer) }, [text, locale])
  return (
    <>
      <Animated.View entering={ZoomIn.springify()}>
        <Wiggle>
          <View style={[styles.mic, { backgroundColor: t.sun, borderColor: t.edge }, hardShadow(t.drop, 5)]}>
            <Text style={{ fontSize: 64 }}>🎤</Text>
            <Text style={styles.smile}>😊</Text>
          </View>
        </Wiggle>
      </Animated.View>
      <Animated.Text entering={FadeIn.delay(200)} style={[styles.title, { color: t.ink }]}>{text}</Animated.Text>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  top: { height: 32, alignItems: "flex-end", justifyContent: "center", width: "100%", maxWidth: 620, alignSelf: "center" },
  skip: { fontFamily: fonts.bodyBold, fontSize: 16, textDecorationLine: "underline" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22 },
  card: { width: 220, height: 220, borderWidth: 4, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 120, lineHeight: 140 },
  title: { fontFamily: fonts.display, fontSize: 32, textAlign: "center" },
  hint: { fontFamily: fonts.bodyBold, fontSize: 16, textAlign: "center", maxWidth: 360 },
  stage: { minHeight: 100, alignItems: "center", justifyContent: "center" },
  mic: { width: 170, height: 170, borderRadius: 85, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  smile: { position: "absolute", bottom: 14, right: 14, fontSize: 36 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 18 },
  dot: { height: 12, borderRadius: 6, borderWidth: 2 },
  actions: { alignItems: "center", gap: 12 },
})
