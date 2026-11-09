import { View } from "react-native"
import Animated, { useAnimatedStyle } from "react-native-reanimated"
import Svg, { Circle } from "react-native-svg"
import { fonts, useTheme } from "../theme"
import { usePulse } from "./motion"

/** Anneau qui se vide pendant le temps de réflexion ; le chiffre pulse à chaque seconde. */
export function CountdownRing({ progress, seconds, size = 96 }: { progress: number; seconds: number; size?: number }) {
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
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.coral} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * progress} />
      </Svg>
      <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
        <Animated.Text style={[{ fontFamily: fonts.display, fontSize: size * 0.4, color: t.ink }, digit]}>{seconds}</Animated.Text>
      </View>
    </View>
  )
}
