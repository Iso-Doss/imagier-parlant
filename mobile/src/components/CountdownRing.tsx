import { View } from "react-native"
import Animated, { useAnimatedStyle } from "react-native-reanimated"
import Svg, { Circle } from "react-native-svg"
import { fonts, useTheme } from "../theme"
import { usePulse } from "./motion"

/** Anneau qui se vide pendant le temps de réflexion ; le chiffre pulse à chaque seconde. */
/** `found` : bonne réponse, l'anneau se remplit en vert (catalogue UI/UX §3.2). */
export function CountdownRing({ progress, seconds, size = 96, found = false }: { progress: number; seconds: number; size?: number; found?: boolean }) {
  const t = useTheme()
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pulse = usePulse(seconds)
  const digit = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))
  return (
    <View style={{ width: size, height: size }} accessibilityRole="timer" accessibilityLabel={`${seconds}`}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={found ? t.leaf : t.coral} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={found ? 0 : c * progress} />
      </Svg>
      <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
        <Animated.Text style={[{ fontFamily: fonts.display, fontSize: size * 0.4, color: found ? t.leaf : t.ink }, digit]}>{found ? "✓" : seconds}</Animated.Text>
      </View>
    </View>
  )
}
