import { useEffect, useRef, useState } from "react"
import { Mic, Square, Trash2, Upload, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * One language's pronunciation: play what exists, record with the microphone,
 * pick a file, or preview with the device's speech synthesis.
 */
export function AudioField({ currentUrl, file, onFile, onRemove, speakText, ttsLocale }: {
  currentUrl: string | null
  file: File | null
  onFile: (f: File | null) => void
  onRemove?: () => void
  speakText: string
  ttsLocale: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const src = preview ?? currentUrl

  const record = async () => {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const type = rec.mimeType || "audio/webm"
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"
        onFile(new File(chunks, `enregistrement.${ext}`, { type }))
        setRecording(false)
      }
      rec.start()
      recorder.current = rec
      setRecording(true)
    } catch {
      setMicError("Micro inaccessible. Autorisez-le dans le navigateur, ou choisissez un fichier.")
    }
  }

  const speak = () => {
    if (!("speechSynthesis" in window) || !speakText) return
    const u = new SpeechSynthesisUtterance(speakText)
    u.lang = ttsLocale
    u.rate = 0.9
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  }

  return (
    <div className="grid gap-2">
      {src ? (
        <audio controls src={src} className="h-9 w-full" />
      ) : (
        <p className="text-xs text-muted-foreground">Pas d'enregistrement : l'application utilisera la voix du téléphone.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {recording ? (
          <Button type="button" size="sm" variant="destructive" onClick={() => recorder.current?.stop()}><Square /> Arrêter</Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={record}><Mic /> Enregistrer ma voix</Button>
        )}
        <input ref={input} type="file" accept="audio/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}><Upload /> Fichier</Button>
        <Button type="button" size="sm" variant="ghost" onClick={speak} disabled={!speakText}><Volume2 /> Voix du téléphone</Button>
        {file && <Button type="button" size="sm" variant="ghost" onClick={() => onFile(null)}>Annuler</Button>}
        {!file && currentUrl && onRemove && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onRemove}><Trash2 /> Supprimer</Button>
        )}
      </div>
      {recording && <p className="text-xs font-semibold text-destructive">● Enregistrement en cours… dites « {speakText} »</p>}
      {micError && <p className="text-xs font-semibold text-destructive">{micError}</p>}
    </div>
  )
}
