import { useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2"
import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito"
import { fetchSeries, type Series } from "./src/api"
import { initAudio } from "./src/audio"
import { DoneScreen } from "./src/screens/DoneScreen"
import { HomeScreen } from "./src/screens/HomeScreen"
import { PlayScreen } from "./src/screens/PlayScreen"
import { useSettings } from "./src/settings"
import { useTheme } from "./src/theme"

type Screen = "home" | "play" | "done"

export default function App() {
  const [fontsLoaded] = useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold, Nunito_600SemiBold, Nunito_800ExtraBold })
  const { settings, update, ready } = useSettings()
  const theme = useTheme()
  const [screen, setScreen] = useState<Screen>("home")
  const [series, setSeries] = useState<Series | null>(null)
  const [playKey, setPlayKey] = useState(0)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const start = async () => {
    setStarting(true)
    setStartError(null)
    try {
      await initAudio()
      const other = settings.lang === "fr" ? "en" : "fr"
      const s = await fetchSeries({
        lang: settings.lang,
        categories: settings.categories,
        count: settings.count,
        translation: settings.showTranslation ? other : undefined,
      })
      if (!s.items.length) throw new Error("Ces catégories n'ont pas encore d'images.")
      setSeries(s)
      setPlayKey((k) => k + 1)
      setScreen("play")
    } catch (e) {
      setStartError((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  const again = () => { setPlayKey((k) => k + 1); setScreen("play") }

  if (!fontsLoaded || !ready) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.sky }}><ActivityIndicator color={theme.ink} /></View>
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {screen === "home" && <HomeScreen settings={settings} update={update} onStart={start} starting={starting} startError={startError} />}
      {screen === "play" && series && (
        <PlayScreen key={playKey} series={series} settings={settings} onQuit={() => setScreen("home")} onDone={() => setScreen("done")} />
      )}
      {screen === "done" && series && (
        <DoneScreen series={series} lang={settings.lang} onAgain={again} onHome={() => setScreen("home")} />
      )}
    </SafeAreaProvider>
  )
}
