import { useEffect } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { fonts, useTheme } from "../theme"

export type Rect = { x: number; y: number; width: number; height: number }
/** grow : le bouton remplit l'écran ; leave : la partie est prête, on s'efface ; cancel : erreur, on se replie */
export type LaunchStage = "grow" | "leave" | "cancel"

export const LAUNCH_MS = 420

/**
 * Transition accueil → partie : le bouton « Commencer » grandit jusqu'à remplir l'écran,
 * avec les catégories choisies au milieu, puis laisse place à la première image.
 */
export function LaunchOverlay({ from, emojis, stage, onGone }: { from: Rect; emojis: string[]; stage: LaunchStage; onGone: () => void }) {
  const t = useTheme()
  const { width, height } = useWindowDimensions()
  const p = useSharedValue(0)
  const fade = useSharedValue(1)

  useEffect(() => {
    if (stage === "grow") p.value = withTiming(1, { duration: LAUNCH_MS, easing: Easing.inOut(Easing.cubic) })
    if (stage === "leave") fade.value = withTiming(0, { duration: 240 })
    if (stage === "cancel") p.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) })
    if (stage === "grow") return
    const timer = setTimeout(onGone, stage === "leave" ? 260 : 280)
    return () => clearTimeout(timer)
  }, [stage, p, fade, onGone])

  const box = useAnimatedStyle(() => ({
    left: from.x * (1 - p.value),
    top: from.y * (1 - p.value),
    width: from.width + (width - from.width) * p.value,
    height: from.height + (height - from.height) * p.value,
    borderRadius: 18 * (1 - p.value),
    borderWidth: 3 * (1 - p.value),
    backgroundColor: interpolateColor(p.value, [0, 1], [t.sun, t.sky]),
    opacity: fade.value,
  }))
  const content = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.5 + 0.7 * p.value }],
  }))

  return (
    <Animated.View pointerEvents="none" style={[styles.box, { borderColor: t.edge }, box]}>
      <Animated.View style={[styles.row, content]}>
        {emojis.slice(0, 4).map((e, i) => (
          <View key={i} style={[styles.bubble, { backgroundColor: t.paper, borderColor: t.edge, transform: [{ rotate: `${(i % 2 ? 1 : -1) * 6}deg` }] }]}>
            <Text style={styles.emoji}>{e}</Text>
          </View>
        ))}
        {emojis.length > 4 && <Text style={[styles.more, { color: t.ink }]}>+{emojis.length - 4}</Text>}
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  box: { position: "absolute", alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 50 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  bubble: { width: 76, height: 76, borderRadius: 22, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 40 },
  more: { fontFamily: fonts.display, fontSize: 28 },
})
