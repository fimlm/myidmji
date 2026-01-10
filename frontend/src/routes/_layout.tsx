import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { LanguageSwitcher } from "@/components/Common/LanguageSwitcher"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  const navigate = useNavigate()

  useEffect(() => {
    // Reactive check for token presence
    const checkAuth = () => {
      if (!isLoggedIn()) {
        navigate({ to: "/login" })
      }
    }

    // Listen for manual token removal or storage changes
    window.addEventListener("storage", checkAuth)
    const interval = setInterval(checkAuth, 2000) // Polling as fallback

    return () => {
      window.removeEventListener("storage", checkAuth)
      clearInterval(interval)
    }
  }, [navigate])
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
