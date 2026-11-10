import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"
import { mediaUrl } from "../api"
import { TEXT_SCALE, fonts, hardShadow, useTheme } from "../theme"

/** Photo if there is one, else the emoji. */
export function Picture({ image, emoji, size }: { image?: string | null; emoji?: string | null; size: number }) {
  const uri = mediaUrl(image)
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size * 0.08 }} resizeMode="cover" accessibilityIgnoresInvertColors accessible={false} aria-hidden />
  return (
    <Text style={{ fontSize: size * 0.8, lineHeight: size, textAlign: "center" }} allowFontScaling={false}
      accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      {emoji ?? "❓"}
    </Text>
  )
}

/** Toucher un bouton : il s'enfonce (0,94) puis revient en ressort (catalogue UI/UX §3.2). */
function usePressScale() {
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const spring = (to: number) => { scale.value = reduced ? 1 : withSpring(to, { stiffness: 400, damping: 18 }) }
  return { style, onPressIn: () => spring(0.94), onPressOut: () => spring(1) }
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme()
  const press = usePressScale()
  return (
    <Animated.View style={press.style}>
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: t.edge, backgroundColor: selected ? t.ink : t.paper, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text maxFontSizeMultiplier={TEXT_SCALE.button} style={{ fontFamily: fonts.bodyBold, color: selected ? t.paper : t.ink, fontSize: 15 }}>{label}</Text>
    </Pressable>
    </Animated.View>
  )
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useTheme()
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} aria-checked={value} accessibilityLabel={label} style={styles.row}>
      <Text style={[styles.rowLabel, { color: t.ink }]}>{label}</Text>
      <View style={[styles.switch, { borderColor: t.edge, backgroundColor: value ? t.leaf : t.track }]}>
        <View style={[styles.knob, { borderColor: t.edge, backgroundColor: t.paper, left: value ? 25 : 3 }]} />
      </View>
    </Pressable>
  )
}

export function BigButton({ label, onPress, disabled, style }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  const press = usePressScale()
  return (
    <Animated.View style={[style, press.style]}>
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      aria-disabled={!!disabled}
      style={({ pressed }) => [
        styles.big,
        { backgroundColor: t.sun, borderColor: t.edge, opacity: disabled ? 0.5 : 1 },
        pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }], ...hardShadow(t.drop, 1) } : hardShadow(t.drop, 4),
      ]}
    >
      <Text maxFontSizeMultiplier={TEXT_SCALE.button} style={{ fontFamily: fonts.display, fontSize: 21, color: t.sunInk, textAlign: "center" }}>{label}</Text>
    </Pressable>
    </Animated.View>
  )
}

/** `a11yLabel` : ce que dit le lecteur d'écran pour un bouton qui n'a qu'une icône (« ✕ » → « Quitter »). */
export function SmallButton({ label, onPress, primary, icon, a11yLabel }: { label?: string; onPress: () => void; primary?: boolean; icon?: string; a11yLabel?: string }) {
  const t = useTheme()
  const press = usePressScale()
  return (
    <Animated.View style={press.style}>
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label ?? icon}
      style={({ pressed }) => [
        styles.small,
        { backgroundColor: primary ? t.sun : t.paper, borderColor: t.edge, paddingHorizontal: label ? 18 : 0, minWidth: 48 },
        pressed ? { transform: [{ translateX: 2 }, { translateY: 2 }], ...hardShadow(t.drop, 1) } : hardShadow(t.drop, 3),
      ]}
    >
      <Text maxFontSizeMultiplier={label ? TEXT_SCALE.button : 1} style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: primary ? t.sunInk : t.ink, textAlign: "center" }}>
        {icon ? `${icon}${label ? "  " : ""}` : ""}{label ?? ""}
      </Text>
    </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 2.5 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  rowLabel: { fontFamily: fonts.bodyBold, fontSize: 16, flex: 1 },
  switch: { width: 52, height: 30, borderRadius: 999, borderWidth: 2.5, justifyContent: "center" },
  knob: { position: "absolute", width: 19, height: 19, borderRadius: 10, borderWidth: 2.5 },
  big: { borderWidth: 3, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 24 },
  small: { borderWidth: 3, borderRadius: 14, minHeight: 48, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
})
