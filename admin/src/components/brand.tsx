import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 -rotate-6 place-items-center rounded-lg border-2 border-sun-foreground/80 bg-sun font-display text-xl font-extrabold text-sun-foreground shadow-[2px_2px_0_rgba(0,0,0,.35)]",
        className,
      )}
    >
      ?
    </div>
  )
}

/** The picture of an item or category: uploaded photo, else its emoji. */
export function Thumb({ image, emoji, color, className }: { image?: string | null; emoji?: string | null; color?: string | null; className?: string }) {
  return (
    <div
      className={cn("grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-2xl", className)}
      style={color && !image ? { backgroundColor: color } : undefined}
    >
      {image ? <img src={image} alt="" className="size-full object-cover" /> : <span aria-hidden>{emoji ?? "·"}</span>}
    </div>
  )
}
