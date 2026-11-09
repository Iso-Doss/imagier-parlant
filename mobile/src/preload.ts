import { Image } from "react-native"
import { mediaUrl, type Item } from "./api"
import { preloadRecording } from "./audio"

const fetched = new Set<string>()

/** Charge à l'avance les images et les sons des prochains objets : aucune attente entre deux images. */
export function preloadItems(items: Item[]) {
  for (const item of items) {
    const image = mediaUrl(item.image_url)
    if (image && !fetched.has(image)) {
      fetched.add(image)
      Image.prefetch(image).catch(() => fetched.delete(image))
    }
    const audio = mediaUrl(item.audio_url)
    if (audio) preloadRecording(audio)
  }
}
