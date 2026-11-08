import { useColorScheme } from "react-native"

// Same palette as the web prototype: flash cards with ink outlines and hard shadows.
const light = {
  sky: "#E7F1FA", paper: "#FFFFFF", ink: "#1B2A4A", muted: "#5A6987", edge: "#1B2A4A", drop: "#1B2A4A",
  sun: "#FFC53D", sunInk: "#1B2A4A", coral: "#F2624A", leaf: "#22A97F", track: "#D3E0EE",
  tints: ["#FFF0C4", "#FFE1D9", "#D5F2E7", "#E1E5FF", "#F6DFF3"],
}
const dark: typeof light = {
  sky: "#0F192C", paper: "#17243D", ink: "#EEF3FB", muted: "#9DAECB", edge: "#3B4F78", drop: "#060B16",
  sun: "#FFC53D", sunInk: "#1B2A4A", coral: "#FF8570", leaf: "#4FD3A8", track: "#26385A",
  tints: ["#3A3220", "#3C2826", "#1C3830", "#252B4B", "#382540"],
}
export type Theme = typeof light

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light
}

/** Category colours come from the admin in light tones; in dark mode use the matching dark tint. */
export function tintFor(theme: Theme, color: string | null | undefined, index: number) {
  if (theme === light && color) return color
  return theme.tints[index % theme.tints.length]
}

export const fonts = {
  display: "Baloo2_800ExtraBold",
  displayBold: "Baloo2_700Bold",
  body: "Nunito_600SemiBold",
  bodyBold: "Nunito_800ExtraBold",
}

export const hardShadow = (color: string, offset = 4) => ({
  shadowColor: color,
  shadowOffset: { width: offset, height: offset },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 0,
})
