import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AGE_BANDS, AVATARS, ApiError, DELAY_FOR_AGE, useAccount, type Profile, type Progress } from "../account"
import { BigButton, Chip, Picture, SmallButton } from "../components/ui"
import { parentStrings, type ParentStrings } from "../i18n-parent"
import type { Tolerance } from "../lib/answerMatcher"
import type { Settings } from "../settings"
import { fetchPacks } from "../api"
import { formatSize, packState, type PackSummary } from "../lib/packs"
import { downloadPack, removePack, useOffline } from "../offline"
import { micPermission, onDeviceSupported, requestMicPermission, type MicPermission } from "../speech"
import { fonts, hardShadow, useTheme } from "../theme"

/** Espace parent (derrière le portail) : compte, profils enfant, progrès. */
export function ParentScreen({ lang, settings, update, onClose }: {
  lang: string
  settings: Settings
  update: (p: Partial<Settings>) => void
  onClose: () => void
}) {
  const t = useTheme()
  const p = parentStrings(lang)
  const insets = useSafeAreaInsets()
  const { account } = useAccount()

  return (
    <View style={{ flex: 1, backgroundColor: t.sky }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.bar}>
          <SmallButton icon="←" label={p.back} onPress={onClose} />
          <Text style={[styles.title, { color: t.ink }]}>{p.parentArea}</Text>
        </View>
        <MicCard p={p} settings={settings} update={update} />
        <OfflineCard p={p} lang={lang} />
        {account ? <Signed p={p} lang={lang} /> : <AuthFlow p={p} lang={lang} />}
        <Text style={[styles.note, { color: t.muted }]}>🔒 {p.privacy}</Text>
      </ScrollView>
    </View>
  )
}

// ---------------------------------------------------------------- Micro

/** Le parent autorise le micro ici, après l'explication (jamais pendant le jeu). */
function MicCard({ p, settings, update }: { p: ParentStrings; settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const t = useTheme()
  const [permission, setPermission] = useState<MicPermission | null>(null)
  useEffect(() => { micPermission().then(setPermission) }, [])

  const allow = async () => {
    const result = await requestMicPermission()
    setPermission(result)
    if (result === "granted") update({ answerMode: "voice" })
  }
  const levels: [Tolerance, string][] = [["strict", p.toleranceStrict], ["normal", p.toleranceNormal], ["lenient", p.toleranceLenient]]

  return (
    <Card>
      <Text style={[styles.h2, { color: t.ink }]}>🎤 {p.mic}</Text>
      <Text style={[styles.text, { color: t.muted }]}>{p.micText}</Text>
      {permission === null && <ActivityIndicator color={t.ink} />}
      {permission === "unavailable" && <Text style={[styles.small, { color: t.ink }]}>{p.micUnavailable}</Text>}
      {permission === "denied" && <Text style={[styles.small, { color: t.coral }]}>{p.micDenied}</Text>}
      {permission === "undetermined" && <BigButton label={p.micAllow} onPress={allow} />}
      {permission === "granted" && (
        <>
          <Text style={[styles.small, { color: t.leaf }]}>✓ {p.micGranted}</Text>
          {settings.answerMode === "voice"
            ? <Text style={[styles.small, { color: t.ink }]}>{p.micInUse}</Text>
            : <SmallButton label={p.micUse} onPress={() => update({ answerMode: "voice" })} primary />}
        </>
      )}
      {permission !== null && permission !== "unavailable" && !onDeviceSupported() && (
        <Text style={[styles.small, { color: t.muted }]}>{p.micCloud}</Text>
      )}
      {permission === "granted" && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: t.ink }]}>{p.tolerance}</Text>
          <View style={styles.row}>
            {levels.map(([level, label]) => (
              <Chip key={level} label={label} selected={settings.tolerance === level} onPress={() => update({ tolerance: level })} />
            ))}
          </View>
          <Text style={[styles.small, { color: t.muted }]}>{p.toleranceHelp}</Text>
        </View>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- Hors connexion

/** Catégories à télécharger pour jouer sans réseau, et place utilisée. */
function OfflineCard({ p, lang }: { p: ParentStrings; lang: string }) {
  const t = useTheme()
  const off = useOffline()
  const [remote, setRemote] = useState<PackSummary[] | null>(null)
  const [noNetwork, setNoNetwork] = useState(false)
  useEffect(() => {
    fetchPacks(lang).then((r) => { setRemote(r); setNoNetwork(false) }).catch(() => { setRemote([]); setNoNetwork(true) })
  }, [lang])

  if (!off.supported) {
    return (
      <Card>
        <Text style={[styles.h2, { color: t.ink }]}>📥 {p.offline}</Text>
        <Text style={[styles.small, { color: t.muted }]}>{p.offlineUnsupported}</Text>
      </Card>
    )
  }

  // Les catégories du serveur, plus celles téléchargées qui n'y sont plus (hors réseau)
  const rows: PackSummary[] = [...(remote ?? [])]
  for (const pack of off.packs) {
    if (rows.some((r) => r.slug === pack.slug)) continue
    const entry = off.installed[pack.slug]
    rows.push({ slug: pack.slug, name: pack.category.names[lang] ?? pack.slug, emoji: pack.category.emoji, version: pack.version, size: entry?.size ?? pack.size, items_count: pack.items_count })
  }
  const used = Object.values(off.installed).reduce((sum, e) => sum + e.size, 0)
  const messages = { noSpace: p.noSpace, failed: p.downloadFailed }
  const missing = (remote ?? []).filter((r) => packState(off.installed[r.slug], r) !== "ready" && off.progress[r.slug] === undefined)
  const downloadAll = async () => { for (const r of missing) await downloadPack(r.slug, messages) }

  return (
    <Card>
      <Text style={[styles.h2, { color: t.ink }]}>📥 {p.offline}</Text>
      <Text style={[styles.text, { color: t.muted }]}>{p.offlineText}</Text>
      {noNetwork && <Text style={[styles.small, { color: t.ink }]}>{p.offlineNoNetwork}</Text>}
      {remote === null || !off.ready ? <ActivityIndicator color={t.ink} /> : (
        <View style={{ gap: 10 }}>
          {rows.map((r) => {
            const entry = off.installed[r.slug]
            const state = packState(entry, remote.find((x) => x.slug === r.slug))
            const progress = off.progress[r.slug]
            const error = off.errors[r.slug]
            return (
              <View key={r.slug} style={[styles.pack, { borderColor: t.edge }]}>
                <Text style={{ fontSize: 28 }}>{r.emoji ?? "📦"}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.label, { color: t.ink }]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[styles.small, { color: t.muted }]}>
                    {p.packInfo(r.items_count, formatSize(entry && state === "ready" ? entry.size : r.size, lang))}
                    {state === "ready" && progress === undefined ? `  ·  ✓ ${p.downloaded}` : ""}
                  </Text>
                  {progress !== undefined && (
                    <View style={[styles.bar2, { borderColor: t.edge }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
                      <View style={{ width: `${Math.round(progress * 100)}%`, height: "100%", backgroundColor: t.leaf }} />
                    </View>
                  )}
                  {error && <Text style={[styles.small, { color: t.coral }]}>{error}</Text>}
                </View>
                {progress !== undefined ? (
                  <Text style={[styles.label, { color: t.ink }]}>{Math.round(progress * 100)} %</Text>
                ) : state === "absent" ? (
                  <SmallButton label={p.download} onPress={() => downloadPack(r.slug, messages)} primary />
                ) : (
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    {state === "outdated" && !noNetwork && <SmallButton label={p.update} onPress={() => downloadPack(r.slug, messages)} primary />}
                    <LinkText label={p.removePack} onPress={() => removePack(r.slug)} danger />
                  </View>
                )}
              </View>
            )
          })}
          <View style={styles.rowBetween}>
            <Text style={[styles.small, { color: t.muted }]}>{p.spaceUsed(formatSize(used, lang))}</Text>
            {missing.length > 1 && !noNetwork && <SmallButton label={p.downloadAll} onPress={downloadAll} />}
          </View>
        </View>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- Connexion / inscription

type Step = "login" | "register" | "code" | "forgot" | "reset"

function AuthFlow({ p, lang }: { p: ParentStrings; lang: string }) {
  const t = useTheme()
  const acc = useAccount()
  const [step, setStep] = useState<Step>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setInfo(null)
    try { await fn() } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(p.error, 0)
      // Compte pas encore confirmé : l'API vient de renvoyer un code
      if (err.reason === "email_not_verified") { setStep("code"); setInfo(err.message) } else setError(err)
    } finally { setBusy(false) }
  }

  const go = (s: Step) => { setStep(s); setError(null); setInfo(null); setCode("") }

  return (
    <Card>
      {step !== "code" && step !== "reset" && <Text style={[styles.text, { color: t.muted }]}>{p.guestIntro}</Text>}

      {(step === "login" || step === "register") && (
        <>
          <View style={styles.tabs}>
            <Tab label={p.login} active={step === "login"} onPress={() => go("login")} />
            <Tab label={p.register} active={step === "register"} onPress={() => go("register")} />
          </View>
          <Field label={p.email} value={email} onChangeText={setEmail} error={error?.field("email")} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          <Field label={p.password} hint={step === "register" ? p.passwordHint : undefined} value={password} onChangeText={setPassword}
            error={error?.field("password")} secureTextEntry autoComplete={step === "register" ? "new-password" : "current-password"} textContentType={step === "register" ? "newPassword" : "password"} />
          {step === "register" && (
            <Pressable onPress={() => setTerms(!terms)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: terms }}>
              <View style={[styles.box, { borderColor: t.edge, backgroundColor: terms ? t.leaf : t.paper }]}>{terms && <Text style={styles.tick}>✓</Text>}</View>
              <Text style={[styles.small, { color: t.ink, flex: 1 }]}>{p.terms}</Text>
            </Pressable>
          )}
          {error && !error.field("email") && !error.field("password") && <ErrorText text={error.field("accept_terms") ?? error.message} />}
          <BigButton
            label={busy ? "…" : step === "login" ? p.login : p.register}
            disabled={busy || !email || !password || (step === "register" && !terms)}
            onPress={() => run(async () => {
              if (step === "login") await acc.login(email.trim(), password)
              else { await acc.register(email.trim(), password, lang); go("code") }
            })}
          />
          {step === "login" && <LinkText label={p.forgot} onPress={() => go("forgot")} />}
        </>
      )}

      {step === "code" && (
        <>
          <Text style={[styles.h2, { color: t.ink }]}>{p.codeTitle}</Text>
          <Text style={[styles.text, { color: t.muted }]}>{info ?? p.codeText(email)}</Text>
          <CodeField value={code} onChange={setCode} error={error?.field("code")} label={p.code} />
          <BigButton label={busy ? "…" : p.confirm} disabled={busy || code.length !== 6} onPress={() => run(() => acc.verify(email.trim(), code))} />
          <LinkText label={p.resend} onPress={() => run(async () => { await acc.resend(email.trim()); setInfo(p.resent) })} />
          <LinkText label={p.back} onPress={() => go("register")} />
        </>
      )}

      {step === "forgot" && (
        <>
          <Text style={[styles.h2, { color: t.ink }]}>{p.forgot}</Text>
          <Text style={[styles.text, { color: t.muted }]}>{p.forgotText}</Text>
          <Field label={p.email} value={email} onChangeText={setEmail} error={error?.field("email")} keyboardType="email-address" autoCapitalize="none" />
          <BigButton label={busy ? "…" : p.sendCode} disabled={busy || !email} onPress={() => run(async () => { await acc.forgot(email.trim()); go("reset") })} />
          <LinkText label={p.back} onPress={() => go("login")} />
        </>
      )}

      {step === "reset" && (
        <>
          <Text style={[styles.h2, { color: t.ink }]}>{p.codeTitle}</Text>
          <Text style={[styles.text, { color: t.muted }]}>{p.codeText(email)}</Text>
          <CodeField value={code} onChange={setCode} error={error?.field("code")} label={p.code} />
          <Field label={p.newPassword} hint={p.passwordHint} value={password} onChangeText={setPassword} error={error?.field("password")} secureTextEntry textContentType="newPassword" />
          <BigButton label={busy ? "…" : p.savePassword} disabled={busy || code.length !== 6 || !password}
            onPress={() => run(() => acc.reset(email.trim(), code, password))} />
          <LinkText label={p.back} onPress={() => go("login")} />
        </>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- Connecté

function Signed({ p, lang }: { p: ParentStrings; lang: string }) {
  const t = useTheme()
  const acc = useAccount()
  const [editing, setEditing] = useState<Profile | "new" | null>(acc.profiles.length === 0 ? "new" : null)
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => { acc.refresh() /* profils à jour (autre appareil) */ }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={[styles.h2, { color: t.ink }]}>{p.profiles}</Text>
          {acc.profiles.length < 6 && editing === null && <SmallButton icon="+" label={p.addProfile} onPress={() => setEditing("new")} />}
        </View>
        {editing === "new" && <ProfileForm p={p} onDone={() => setEditing(null)} />}
        {acc.profiles.map((profile) => editing !== "new" && editing?.id === profile.id
          ? <ProfileForm key={profile.id} p={p} profile={profile} onDone={() => setEditing(null)} />
          : <ProfileRow key={profile.id} p={p} lang={lang} profile={profile} onEdit={() => setEditing(profile)} />)}
      </Card>

      <Card>
        <Text style={[styles.h2, { color: t.ink }]}>{p.account}</Text>
        <Text style={[styles.text, { color: t.ink }]}>{acc.account?.email}</Text>
        <SmallButton label={p.logout} onPress={() => acc.logout()} />
        {!deleting ? (
          <LinkText label={p.deleteAccount} danger onPress={() => setDeleting(true)} />
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={[styles.text, { color: t.coral }]}>{p.deleteText}</Text>
            <Field label={p.password} value={password} onChangeText={setPassword} secureTextEntry error={error?.field("password")} />
            <View style={styles.row}>
              <SmallButton label={p.cancel} onPress={() => { setDeleting(false); setPassword(""); setError(null) }} />
              <SmallButton label={p.deleteConfirm} onPress={async () => {
                try { await acc.deleteAccount(password) } catch (e) { setError(e instanceof ApiError ? e : new ApiError(p.error, 0)) }
              }} />
            </View>
          </View>
        )}
      </Card>
    </>
  )
}

function ProfileRow({ p, lang, profile, onEdit }: { p: ParentStrings; lang: string; profile: Profile; onEdit: () => void }) {
  const t = useTheme()
  const acc = useAccount()
  const active = acc.activeProfile?.id === profile.id
  const [open, setOpen] = useState(active)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (open) acc.progress(profile.id, lang).then(setProgress).catch(() => setProgress(null))
  }, [open, profile.id, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.profile, { borderColor: active ? t.leaf : t.edge, backgroundColor: t.sky }]}>
      <Pressable onPress={() => setOpen(!open)} style={styles.row} accessibilityRole="button">
        <Text style={styles.avatar}>{AVATARS[profile.avatar] ?? "🙂"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: t.ink }]}>{profile.nickname}</Text>
          <Text style={[styles.small, { color: t.muted }]}>{p.years(profile.age_band)}{active ? ` · ${p.playsNow}` : ""}</Text>
        </View>
        <Text style={{ color: t.muted, fontSize: 18 }}>{open ? "▴" : "▾"}</Text>
      </Pressable>

      {open && (
        <View style={{ gap: 10 }}>
          {!active && <SmallButton primary label={p.playAs} onPress={() => acc.selectProfile(profile.id)} />}
          {progress === null ? <ActivityIndicator color={t.ink} /> : progress.seen === 0 ? (
            <Text style={[styles.small, { color: t.muted }]}>{p.nothingYet}</Text>
          ) : (
            <>
              <View style={styles.stats}>
                <Stat value={progress.seen} label={p.seen} />
                <Stat value={progress.known} label={p.known} color={t.leaf} />
                <Stat value={progress.learning} label={p.learning} color={t.sun} />
              </View>
              <Text style={[styles.small, { color: t.ink }]}>{p.thisWeek(progress.week.sessions, progress.week.minutes)}</Text>
              {progress.to_review.length > 0 && (
                <>
                  <Text style={[styles.label, { color: t.ink }]}>{p.toReview}</Text>
                  <View style={styles.thumbs}>
                    {progress.to_review.slice(0, 12).map((i) => (
                      <View key={i.id} style={[styles.thumb, { borderColor: t.edge, backgroundColor: t.paper }]} accessibilityLabel={i.name ?? undefined}>
                        <Picture image={i.thumb_url ?? i.image_url} emoji={i.emoji} size={i.image_url ? 40 : 28} />
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
          <View style={styles.row}>
            <SmallButton label={p.edit} onPress={onEdit} />
            {!confirm ? <SmallButton label={p.remove} onPress={() => setConfirm(true)} /> : (
              <SmallButton label={p.removeProfileConfirm(profile.nickname)} onPress={() => acc.removeProfile(profile.id)} />
            )}
          </View>
        </View>
      )}
    </View>
  )
}

function ProfileForm({ p, profile, onDone }: { p: ParentStrings; profile?: Profile; onDone: () => void }) {
  const t = useTheme()
  const acc = useAccount()
  const [nickname, setNickname] = useState(profile?.nickname ?? "")
  const [avatar, setAvatar] = useState(profile?.avatar ?? "ours")
  const [age, setAge] = useState(profile?.age_band ?? "4-5")
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true); setError(null)
    try {
      // La tranche d'âge règle le temps de réflexion conseillé
      await acc.saveProfile({ nickname: nickname.trim(), avatar, age_band: age, settings: { ...(profile?.settings ?? {}), delay: DELAY_FOR_AGE[age] } }, profile?.id)
      onDone()
    } catch (e) { setError(e instanceof ApiError ? e : new ApiError(p.error, 0)) } finally { setBusy(false) }
  }

  return (
    <View style={[styles.profile, { borderColor: t.edge, backgroundColor: t.sky, gap: 12 }]}>
      <Field label={p.nickname} hint={p.nicknameHint} value={nickname} onChangeText={setNickname} maxLength={20} error={error?.field("nickname")} />
      <Text style={[styles.label, { color: t.ink }]}>{p.age}</Text>
      <View style={styles.row}>
        {AGE_BANDS.map((b) => <Tab key={b} label={p.years(b)} active={age === b} onPress={() => setAge(b)} />)}
      </View>
      <Text style={[styles.label, { color: t.ink }]}>{p.avatar}</Text>
      <View style={styles.avatars}>
        {Object.entries(AVATARS).map(([key, emoji]) => (
          <Pressable key={key} onPress={() => setAvatar(key)} accessibilityRole="button" accessibilityLabel={key} accessibilityState={{ selected: avatar === key }}
            style={[styles.avatarChoice, { borderColor: avatar === key ? t.ink : "transparent", backgroundColor: avatar === key ? t.sun : t.paper }]}>
            <Text style={{ fontSize: 30 }}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        <SmallButton label={p.cancel} onPress={onDone} />
        <SmallButton primary label={busy ? "…" : p.save} onPress={save} />
      </View>
    </View>
  )
}

// ---------------------------------------------------------------- Petits composants

function Card({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  return <View style={[styles.card, { backgroundColor: t.paper, borderColor: t.edge }, hardShadow(t.drop, 4)]}>{children}</View>
}

function Field({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const t = useTheme()
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.label, { color: t.ink }]}>{label}</Text>
      <TextInput {...input} placeholderTextColor={t.muted}
        style={[styles.input, { borderColor: error ? t.coral : t.edge, color: t.ink, backgroundColor: t.sky }]} />
      {error ? <ErrorText text={error} /> : hint ? <Text style={[styles.small, { color: t.muted }]}>{hint}</Text> : null}
    </View>
  )
}

function CodeField({ value, onChange, error, label }: { value: string; onChange: (v: string) => void; error?: string; label: string }) {
  return <Field label={label} value={value} onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 6))}
    keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} error={error}
    style={{ fontSize: 28, letterSpacing: 8, textAlign: "center" }} />
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}
      style={[styles.tab, { borderColor: t.edge, backgroundColor: active ? t.ink : t.paper }]}>
      <Text style={{ fontFamily: fonts.bodyBold, color: active ? t.paper : t.ink, fontSize: 15 }}>{label}</Text>
    </Pressable>
  )
}

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  const t = useTheme()
  return (
    <View style={[styles.stat, { borderColor: t.edge, backgroundColor: t.paper }]}>
      <Text style={[styles.statValue, { color: color ?? t.ink }]}>{value}</Text>
      <Text style={[styles.small, { color: t.muted }]}>{label}</Text>
    </View>
  )
}

function LinkText({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme()
  return <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link"><Text style={[styles.link, { color: danger ? t.coral : t.ink }]}>{label}</Text></Pressable>
}

function ErrorText({ text }: { text: string }) {
  const t = useTheme()
  return <Text style={[styles.small, { color: t.coral }]}>{text}</Text>
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 16, maxWidth: 620, width: "100%", alignSelf: "center" },
  bar: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 28 },
  card: { borderWidth: 3, borderRadius: 22, padding: 18, gap: 14 },
  h2: { fontFamily: fonts.display, fontSize: 22 },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15 },
  note: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", paddingHorizontal: 8 },
  input: { borderWidth: 2.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.bodyBold, fontSize: 17 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 2.5 },
  check: { flexDirection: "row", alignItems: "center", gap: 10 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  tick: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 16 },
  link: { fontFamily: fonts.bodyBold, fontSize: 15, textDecorationLine: "underline", textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  profile: { borderWidth: 2.5, borderRadius: 18, padding: 12, gap: 8 },
  avatar: { fontSize: 38 },
  name: { fontFamily: fonts.display, fontSize: 22 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderWidth: 2.5, borderRadius: 14, padding: 8, alignItems: "center" },
  statValue: { fontFamily: fonts.display, fontSize: 26 },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  thumb: { width: 48, height: 48, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  pack: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2.5, borderRadius: 16, padding: 10 },
  bar2: { height: 8, borderRadius: 4, borderWidth: 1.5, overflow: "hidden", marginTop: 4 },
  avatars: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  avatarChoice: { width: 54, height: 54, borderRadius: 14, borderWidth: 3, alignItems: "center", justifyContent: "center" },
})
