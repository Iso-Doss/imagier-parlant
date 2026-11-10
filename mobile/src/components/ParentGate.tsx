import { useMemo, useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { parentStrings } from "../i18n-parent"
import { TEXT_SCALE, fonts, hardShadow, useTheme } from "../theme"
import { SmallButton } from "./ui"

/**
 * Portail parental : une multiplication simple pour un adulte, impossible pour un petit.
 * Trois erreurs ferment le portail.
 */
export function ParentGate({ visible, lang, onPass, onClose }: { visible: boolean; lang: string; onPass: () => void; onClose: () => void }) {
  const t = useTheme()
  const p = parentStrings(lang)
  const [round, setRound] = useState(0)
  const [errors, setErrors] = useState(0)

  const { a, b, choices } = useMemo(() => {
    const a = 3 + Math.floor(Math.random() * 6)
    const b = 3 + Math.floor(Math.random() * 6)
    const right = a * b
    const set = new Set([right])
    while (set.size < 4) set.add(Math.max(4, right + (Math.floor(Math.random() * 13) - 6)))
    return { a, b, choices: [...set].sort(() => Math.random() - 0.5) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, visible])

  const close = () => { setErrors(0); onClose() }
  const pick = (n: number) => {
    if (n === a * b) { setErrors(0); setRound((r) => r + 1); onPass(); return }
    if (errors + 1 >= 3) { close(); return }
    setErrors((e) => e + 1)
    setRound((r) => r + 1)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.backdrop, { backgroundColor: "#0B1424CC" }]}>
        <View style={[styles.card, { backgroundColor: t.paper, borderColor: t.edge }, hardShadow(t.drop, 6)]}>
          <Text style={[styles.lock]} accessible={false} aria-hidden>🔒</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>{p.gateTitle}</Text>
          <Text style={[styles.question, { color: t.ink }]}>{p.gateQuestion(a, b)}</Text>
          <View style={styles.grid}>
            {choices.map((n) => (
              <Pressable key={n} onPress={() => pick(n)} accessibilityRole="button"
                style={({ pressed }) => [styles.choice, { borderColor: t.edge, backgroundColor: pressed ? t.sun : t.sky }]}>
                <Text maxFontSizeMultiplier={TEXT_SCALE.button} style={[styles.choiceText, { color: t.ink }]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          {errors > 0 && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ fontFamily: fonts.bodyBold, color: t.coral }}>{p.gateWrong}</Text>}
          <SmallButton label={p.close} onPress={close} />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 380, borderWidth: 3, borderRadius: 24, padding: 22, alignItems: "center", gap: 14 },
  lock: { fontSize: 36 },
  title: { fontFamily: fonts.display, fontSize: 26 },
  question: { fontFamily: fonts.bodyBold, fontSize: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  choice: { width: 120, minHeight: 64, borderRadius: 16, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  choiceText: { fontFamily: fonts.display, fontSize: 28 },
})
