import { useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { Image, Languages, LayoutDashboard, LogOut, Menu, Moon, Shapes, Sun } from "lucide-react"
import { BrandMark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/categories", label: "Catégories", icon: Shapes },
  { to: "/items", label: "Objets", icon: Image },
  { to: "/languages", label: "Langues", icon: Languages },
]

function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))
  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    try { localStorage.setItem("imagier-admin-theme", next ? "dark" : "light") } catch { /* ignore */ }
    setDark(next)
  }
  return { dark, toggle }
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const { dark, toggle } = useDarkMode()
  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar p-4 text-sidebar-foreground">
      <div className="flex items-center gap-3 px-1 pt-1">
        <BrandMark />
        <div className="leading-tight">
          <div className="font-display text-lg font-bold">Imagier parlant</div>
          <div className="text-xs text-sidebar-muted">Administration</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                isActive ? "bg-sun text-sun-foreground" : "text-sidebar-foreground/85 hover:bg-white/10",
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
        <div className="px-1 text-sm">
          <div className="font-semibold">{user?.name}</div>
          <div className="truncate text-xs text-sidebar-muted">{user?.email}</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="flex-1 justify-start text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground" onClick={logout}>
            <LogOut /> Se déconnecter
          </Button>
          <Button size="icon" variant="ghost" className="size-8 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground" onClick={toggle} aria-label="Changer de thème">
            {dark ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-svh lg:block">
        <SidebarContent />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-sidebar px-4 py-2 text-sidebar-foreground lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="hover:bg-white/10 hover:text-sidebar-foreground" aria-label="Menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <BrandMark className="size-7 text-base" />
          <span className="font-display font-bold">Imagier parlant</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
