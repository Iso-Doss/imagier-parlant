import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { AppLayout } from "@/components/layout"
import { useAuth } from "@/lib/auth"
import { CategoriesPage } from "@/pages/categories"
import { DashboardPage } from "@/pages/dashboard"
import { ItemsPage } from "@/pages/items"
import { LanguagesPage } from "@/pages/languages"
import { LoginPage } from "@/pages/login"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="grid min-h-svh place-items-center text-muted-foreground">Chargement…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="languages" element={<LanguagesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
