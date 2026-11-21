// Version web : comment proposer d'installer l'app sur l'écran d'accueil (testé dans tests/install.test.ts).

export type InstallState =
  /** Déjà ouverte depuis l'écran d'accueil */
  | "installed"
  /** Le navigateur propose son installation (Chrome, Edge, Android) : un bouton suffit */
  | "prompt"
  /** iPhone, iPad : Partager › Sur l'écran d'accueil (Safari ne propose pas de bouton) */
  | "ios"
  /** Autre navigateur : passer par son menu */
  | "manual"

export function installState(env: {
  standalone: boolean
  hasPrompt: boolean
  userAgent: string
  /** iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile */
  maxTouchPoints: number
}): InstallState {
  if (env.standalone) return "installed"
  if (env.hasPrompt) return "prompt"
  const ios = /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1)
  return ios ? "ios" : "manual"
}
