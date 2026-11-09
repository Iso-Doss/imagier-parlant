// Petites animations réutilisables (Reanimated). Toutes respectent « Réduire les animations ».
import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { useTheme } from "../theme"

const CONFETTI_COLORS = ["#FF8A65", "#FFD54F", "#81C784", "#64B5F6", "#BA68C8", "#4DD0E1"]

/** 12 confettis qui jaillissent du centre quand `burst` change (bonne réponse). */
export function Confetti({ burst }: { burst: number }) {
  const reduced = useReducedMotion()
  if (reduced || burst === 0) return null
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.center}>
        {Array.from({ length: 12 }, (_, i) => <Piece key={`${burst}-${i}`} index={i} />)}
      </View>
    </View>
  )
}

function Piece({ index }: { index: number }) {
  const p = useSharedValue(0)
  // Direction et distance fixes par confetti, avec un peu de hasard
  const [shape] = useState(() => {
    const angle = (index / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
    const dist = 110 + Math.random() * 70
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, spin: (Math.random() - 0.5) * 720, color: CONFETTI_COLORS[index % CONFETTI_COLORS.length], round: index % 3 === 0 }
  })
  useEffect(() => {
    p.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
  }, [p])
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value * p.value,
    transform: [
      { translateX: shape.dx * p.value },
      // Petite chute à la fin (gravité)
      { translateY: shape.dy * p.value + 40 * p.value * p.value },
      { rotate: `${shape.spin * p.value}deg` },
      { scale: 1 - 0.3 * p.value },
    ],
  }))
  return <Animated.View style={[styles.piece, { backgroundColor: shape.color, borderRadius: shape.round ? 6 : 2 }, style]} />
}

/** Texte écrit lettre par lettre (40 ms par lettre). Renvoie le nombre de lettres à montrer. */
export function useTyping(text: string, active: boolean, msPerLetter = 40): number {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(active && !reduced ? 0 : text.length)
  useEffect(() => {
    if (!active || reduced) { setShown(text.length); return }
    setShown(0)
    let n = 0
    const timer = setInterval(() => {
      n += 1
      setShown(n)
      if (n >= text.length) clearInterval(timer)
    }, msPerLetter)
    return () => clearInterval(timer)
  }, [text, active, reduced, msPerLetter])
  return shown
}

/** Nombre qui compte de 0 jusqu'à `to` en `duration` ms. */
export function CountUp({ to, duration = 1500, style }: { to: number; duration?: number; style?: object }) {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(reduced ? to : 0)
  useEffect(() => {
    if (reduced || to === 0) { setValue(to); return }
    const start = Date.now()
    const timer = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / duration)
      setValue(Math.round(to * (1 - (1 - k) ** 3)))
      if (k >= 1) clearInterval(timer)
    }, 30)
    return () => clearInterval(timer)
  }, [to, duration, reduced])
  return <Text style={style}>{value}</Text>
}

/** Étoiles qui tombent doucement (fin de série). */
export function FallingStars({ count = 14, height }: { count?: number; height: number }) {
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => <Star key={i} index={i} count={count} height={height} />)}
    </View>
  )
}

function Star({ index, count, height }: { index: number; count: number; height: number }) {
  const t = useTheme()
  const fall = useSharedValue(0)
  const [cfg] = useState(() => ({
    left: `${((index + 0.5) / count) * 100}%` as const,
    delay: Math.random() * 900,
    size: 16 + Math.random() * 18,
    sway: (Math.random() - 0.5) * 60,
    spin: (Math.random() - 0.5) * 360,
  }))
  useEffect(() => {
    fall.value = withDelay(cfg.delay, withTiming(1, { duration: 1500 + Math.random() * 600, easing: Easing.in(Easing.quad) }))
  }, [fall, cfg.delay])
  const style = useAnimatedStyle(() => ({
    opacity: fall.value < 0.85 ? 1 : (1 - fall.value) / 0.15,
    transform: [
      { translateY: -40 + fall.value * (height + 40) },
      { translateX: Math.sin(fall.value * Math.PI * 2) * cfg.sway },
      { rotate: `${cfg.spin * fall.value}deg` },
    ],
  }))
  return <Animated.Text style={[{ position: "absolute", top: 0, left: cfg.left, fontSize: cfg.size, color: t.sun }, style]}>★</Animated.Text>
}

/** Valeur partagée qui « pulse » (1 → 1,25 → 1) à chaque changement de `trigger`. */
export function usePulse(trigger: unknown): SharedValue<number> {
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  useEffect(() => {
    if (reduced) return
    scale.value = withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, { stiffness: 300, damping: 12 }))
  }, [trigger, reduced, scale])
  return scale
}

/** Léger balancement continu (mascotte, étoile de fin). */
export function Wiggle({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  const r = useSharedValue(0)
  useEffect(() => {
    if (reduced) return
    r.value = withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(-1, { duration: 380 })), -1, true)
  }, [r, reduced])
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 8}deg` }, { translateY: -Math.abs(r.value) * 6 }] }))
  return <Animated.View style={style}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  piece: { position: "absolute", width: 12, height: 12 },
})

