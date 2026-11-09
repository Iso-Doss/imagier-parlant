import { useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2"
import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito"
import * as Crypto from "expo-crypto"
import { AccountProvider, useAccount } from "./src/account"
import { fetchSeries, type Series } from "./src/api"
import { ParentGate } from "./src/components/ParentGate"
import { ParentScreen } from "./src/screens/ParentScreen"
import type { PlayResult } from "./src/screens/PlayScreen"
import { initAudio } from "./src/audio"
import { DoneScreen } from "./src/screens/DoneScreen"
import { HomeScreen } from "./src/screens/HomeScreen"
import { PlayScreen } from "./src/screens/PlayScreen"
import { useSettings } from "./src/settings"
import { useTheme } from "./src/theme"

type Screen = "home" | "play" | "done" | "parent"

export default function App() {
  return (
    <SafeAreaProvider>
      <AccountProvider>
        <Main />
      </AccountProvider>
    </SafeAreaProvider>
  )
}

function Main() {
  const acc = useAccount()
  const [gate, setGate] = useState(false)
  const [results, setResults] = useState<PlayResult[]>([])
  const [startedAt, setStartedAt] = useState(new Date())
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
        profile: acc.activeProfile?.id,
        token: acc.token,
      })
      if (!s.items.length) throw new Error("Ces catégories n'ont pas encore d'images.")
      setSeries(s)
      beginPlay()
    } catch (e) {
      setStartError((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  const beginPlay = () => { setStartedAt(new Date()); setResults([]); setPlayKey((k) => k + 1); setScreen("play") }
  const again = () => beginPlay()

  /** Série terminée ou quittée : envoyée au compte si un profil joue (sinon rien ne quitte le téléphone). */
  const finish = (r: PlayResult[], done: boolean) => {
    setResults(r)
    setScreen(done ? "done" : "home")
    const profile = acc.activeProfile
    if (!profile || !series || r.length === 0) return
    acc.recordSession({
      id: Crypto.randomUUID(),
      profileId: profile.id,
      locale: series.language.code,
      mode: settings.answerMode,
      categories: settings.categories,
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      answers: r,
    }).catch(() => {})
  }

  // Profil choisi : on reprend son temps de réflexion (réglé selon l'âge)
  const profileDelay = acc.activeProfile?.settings?.delay
  useEffect(() => {
    if (typeof profileDelay === "number" && profileDelay !== settings.delay) update({ delay: profileDelay })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acc.activeProfile?.id, profileDelay])

  if (!fontsLoaded || !ready || !acc.ready) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.sky }}><ActivityIndicator color={theme.ink} /></View>
  }

  return (
    <>
      <StatusBar style="auto" />
      {screen === "home" && <HomeScreen settings={settings} update={update} onStart={start} starting={starting} startError={startError} onParent={() => setGate(true)} />}
      {screen === "play" && series && (
        <PlayScreen key={playKey} series={series} settings={settings} onQuit={(r) => finish(r, false)} onDone={(r) => finish(r, true)} />
      )}
      {screen === "done" && series && (
        <DoneScreen series={series} results={results} lang={settings.lang} onAgain={again} onHome={() => setScreen("home")} />
      )}
      {screen === "parent" && <ParentScreen lang={settings.lang} onClose={() => setScreen("home")} />}
      <ParentGate visible={gate} lang={settings.lang} onClose={() => setGate(false)} onPass={() => { setGate(false); setScreen("parent") }} />
    </>
  )
}
