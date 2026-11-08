import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"
import { mediaUrl } from "../api"
import { fonts, hardShadow, useTheme } from "../theme"

/** Photo if there is one, else the emoji. */
export function Picture({ image, emoji, size }: { image?: string | null; emoji?: string | null; size: number }) {
  const uri = mediaUrl(image)
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size * 0.08 }} resizeMode="cover" accessibilityIgnoresInvertColors />
  return <Text style={{ fontSize: size * 0.8, lineHeight: size, textAlign: "center" }}>{emoji ?? "❓"}</Text>
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: t.edge, backgroundColor: selected ? t.ink : t.paper, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={{ fontFamily: fonts.bodyBold, color: selected ? t.paper : t.ink, fontSize: 15 }}>{label}</Text>
    </Pressable>
  )
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useTheme()
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} style={styles.row}>
      <Text style={[styles.rowLabel, { color: t.ink }]}>{label}</Text>
      <View style={[styles.switch, { borderColor: t.edge, backgroundColor: value ? t.leaf : t.track }]}>
        <View style={[styles.knob, { borderColor: t.edge, backgroundColor: t.paper, left: value ? 25 : 3 }]} />
      </View>
    </Pressable>
  )
}

export function BigButton({ label, onPress, disabled, style }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.big,
        { backgroundColor: t.sun, borderColor: t.edge, opacity: disabled ? 0.5 : 1 },
        pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }], ...hardShadow(t.drop, 1) } : hardShadow(t.drop, 4),
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: 21, color: t.sunInk, textAlign: "center" }}>{label}</Text>
    </Pressable>
  )
}

export function SmallButton({ label, onPress, primary, icon }: { label?: string; onPress: () => void; primary?: boolean; icon?: string }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? icon}
      style={({ pressed }) => [
        styles.small,
        { backgroundColor: primary ? t.sun : t.paper, borderColor: t.edge, paddingHorizontal: label ? 18 : 0, width: label ? undefined : 48 },
        pressed ? { transform: [{ translateX: 2 }, { translateY: 2 }], ...hardShadow(t.drop, 1) } : hardShadow(t.drop, 3),
      ]}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: primary ? t.sunInk : t.ink }}>
        {icon ? `${icon}${label ? "  " : ""}` : ""}{label ?? ""}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 2.5 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  rowLabel: { fontFamily: fonts.bodyBold, fontSize: 16, flex: 1 },
  switch: { width: 52, height: 30, borderRadius: 999, borderWidth: 2.5, justifyContent: "center" },
  knob: { position: "absolute", width: 19, height: 19, borderRadius: 10, borderWidth: 2.5 },
  big: { borderWidth: 3, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 24 },
  small: { borderWidth: 3, borderRadius: 14, height: 48, alignItems: "center", justifyContent: "center" },
})
