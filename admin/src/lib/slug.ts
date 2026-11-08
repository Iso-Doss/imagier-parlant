export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/^(les|la|le|l')\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
