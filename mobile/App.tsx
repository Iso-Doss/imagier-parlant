import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, View, useColorScheme } from "react-native"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2"
import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito"
import * as Crypto from "expo-crypto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { AccountProvider, useAccount } from "./src/account"
import { NetworkError, fetchSeries, type Series } from "./src/api"
import { coversCategories, localizeSeries, seriesFromPacks } from "./src/lib/packs"
import { loadOffline, offlineState } from "./src/offline"
import { strings } from "./src/i18n"
import { ParentGate } from "./src/components/ParentGate"
import { LAUNCH_MS, LaunchOverlay, type LaunchStage, type Rect } from "./src/components/LaunchOverlay"
import { useReducedMotion } from "react-native-reanimated"
import { ParentScreen } from "./src/screens/ParentScreen"
import type { PlayResult } from "./src/screens/PlayScreen"
import { initAudio, setVoicePrefs } from "./src/audio"
import { DoneScreen } from "./src/screens/DoneScreen"
import { HomeScreen } from "./src/screens/HomeScreen"
import { PlayScreen } from "./src/screens/PlayScreen"
import { WelcomeScreen } from "./src/screens/WelcomeScreen"
import { useSettings } from "./src/settings"
import { ThemePrefProvider, useTheme } from "./src/theme"

type Screen = "home" | "play" | "done" | "parent"
const WELCOME_KEY = "imagier-welcome-v1"

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
  const system = useColorScheme()
  const dark = settings.theme === "dark" || (settings.theme === "system" && system === "dark")
  const [screen, setScreen] = useState<Screen>("home")
  // Bienvenue au premier lancement seulement (null : pas encore lu)
  const [welcome, setWelcome] = useState<boolean | null>(null)
  useEffect(() => {
    AsyncStorage.getItem(WELCOME_KEY).then((v) => setWelcome(v !== "done")).catch(() => setWelcome(false))
    initAudio().catch(() => {})
    loadOffline().catch(() => {})
  }, [])
  const endWelcome = (next: "play" | "account") => {
    setWelcome(false)
    AsyncStorage.setItem(WELCOME_KEY, "done").catch(() => {})
    if (next === "account") setGate(true)
  }
  const [series, setSeries] = useState<Series | null>(null)
  const [playKey, setPlayKey] = useState(0)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  // Transition du bouton « Commencer » vers la partie
  const reduced = useReducedMotion()
  const [launch, setLaunch] = useState<{ from: Rect; emojis: string[]; stage: LaunchStage } | null>(null)
  const endLaunch = useCallback(() => setLaunch(null), [])

  const start = async (from?: Rect, emojis: string[] = []) => {
    setStarting(true)
    setStartError(null)
    if (from && !reduced) setLaunch({ from, emojis, stage: "grow" })
    // La partie n'apparaît qu'une fois l'écran rempli (même si la série arrive plus vite)
    const grown = new Promise((r) => setTimeout(r, from && !reduced ? LAUNCH_MS : 0))
    try {
      await initAudio()
      const other = settings.lang === "fr" ? "en" : "fr"
      const translation = settings.showTranslation ? other : undefined
      const off = offlineState()
      let s: Series | null
      try {
        // Les fichiers déjà téléchargés servent aussi en ligne : moins d'attente, moins de données
        s = localizeSeries(await fetchSeries({
          lang: settings.lang,
          categories: settings.categories,
          count: settings.count,
          translation,
          profile: acc.activeProfile?.id,
          token: acc.token,
        }), off.files)
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e
        // Pas de réseau : la série est composée avec les catégories téléchargées
        if (!coversCategories(off.packs, settings.categories)) throw new Error(strings(settings.lang).offlineMissing)
        s = seriesFromPacks(off.packs, { lang: settings.lang, categories: settings.categories, count: settings.count, translation }, off.files)
      }
      if (!s?.items.length) throw new Error("Ces catégories n'ont pas encore d'images.")
      await grown
      setSeries(s)
      beginPlay()
      setLaunch((l) => l && { ...l, stage: "leave" })
    } catch (e) {
      setLaunch((l) => l && { ...l, stage: "cancel" })
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

  // Voix et débit choisis dans l'espace parent
  useEffect(() => { setVoicePrefs({ voices: settings.voices, speed: settings.speechSpeed }) }, [settings.voices, settings.speechSpeed])

  // Profil choisi : on reprend son temps de réflexion (réglé selon l'âge)
  const profileDelay = acc.activeProfile?.settings?.delay
  useEffect(() => {
    if (typeof profileDelay === "number" && profileDelay !== settings.delay) update({ delay: profileDelay })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acc.activeProfile?.id, profileDelay])

  if (!fontsLoaded || !ready || !acc.ready || welcome === null) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.sky }}><ActivityIndicator color={theme.ink} /></View>
  }

  return (
    <ThemePrefProvider value={settings.theme}>
      <StatusBar style={dark ? "light" : "dark"} />
      {welcome && <WelcomeScreen lang={settings.lang} onDone={endWelcome} />}
      {!welcome && screen === "home" && <HomeScreen settings={settings} update={update} onStart={start} starting={starting} startError={startError} onParent={() => setGate(true)} />}
      {screen === "play" && series && (
        <PlayScreen key={playKey} series={series} settings={settings} onQuit={(r) => finish(r, false)} onDone={(r) => finish(r, true)} />
      )}
      {screen === "done" && series && (
        <DoneScreen series={series} results={results} lang={settings.lang} onAgain={again} onHome={() => setScreen("home")} />
      )}
      {screen === "parent" && <ParentScreen lang={settings.lang} settings={settings} update={update} onClose={() => setScreen("home")} />}
      {launch && <LaunchOverlay from={launch.from} emojis={launch.emojis} stage={launch.stage} onGone={endLaunch} />}
      <ParentGate visible={gate} lang={settings.lang} onClose={() => setGate(false)} onPass={() => { setGate(false); setScreen("parent") }} />
    </ThemePrefProvider>
  )
}
