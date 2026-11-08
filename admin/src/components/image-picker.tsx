import { useEffect, useRef, useState } from "react"
import { ImagePlus, Trash2 } from "lucide-react"
import { Thumb } from "@/components/brand"
import { Button } from "@/components/ui/button"

/**
 * Shows the current picture and lets the admin choose a new one.
 * The file is handed to the parent, which uploads it when the form is saved.
 */
export function ImagePicker({ currentUrl, emoji, color, file, onFile, onRemove }: {
  currentUrl: string | null
  emoji?: string | null
  color?: string | null
  file: File | null
  onFile: (f: File | null) => void
  onRemove?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const shown = preview ?? currentUrl
  return (
    <div className="flex items-center gap-4">
      <Thumb image={shown} emoji={emoji} color={color} className="size-24 text-5xl" />
      <div className="grid gap-2">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <ImagePlus /> {shown ? "Changer la photo" : "Ajouter une photo"}
        </Button>
        {file && <Button type="button" variant="ghost" size="sm" onClick={() => { onFile(null); if (input.current) input.current.value = "" }}>Annuler ce choix</Button>}
        {!file && currentUrl && onRemove && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}><Trash2 /> Retirer la photo</Button>
        )}
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, 5 Mo max. Sans photo, l'emoji est affiché.</p>
      </div>
    </div>
  )
}
