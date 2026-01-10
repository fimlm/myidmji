import { Briefcase, Calendar, Home, Shield, Users, UserX } from "lucide-react"
import { useTranslation } from "react-i18next"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

export function AppSidebar() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()

  // Items are moved inside component to support dynamic translation
  const baseItems: Item[] = [
    { icon: Home, title: t("sidebar.dashboard"), path: "/" },
  ]

  // Show Events for Admin/Supervisor or Superuser
  const showEvents =
    currentUser?.is_superuser ||
    ["ADMIN", "SUPERVISOR"].includes(currentUser?.role || "")

  const items = [...baseItems]

  if (currentUser?.is_superuser) {
    items.push({
      icon: Shield,
      title: t("sidebar.permissions"),
      path: "/permissions",
    })
  }

  if (showEvents) {
    items.push({ icon: Calendar, title: t("sidebar.events"), path: "/events" })
  }

  // Show Register for Digiter, Admin, or Supervisor
  const canRegister =
    currentUser?.is_superuser ||
    ["ADMIN", "SUPERVISOR", "DIGITER"].includes(currentUser?.role || "")
  if (canRegister) {
    items.push({ icon: Users, title: t("sidebar.register"), path: "/register" })
    items.push({ icon: UserX, title: t("sidebar.unregister"), path: "/unregister" })
  }

  if (
    currentUser?.is_superuser ||
    ["ADMIN"].includes(currentUser?.role || "")
  ) {
    items.push({ icon: Briefcase, title: t("sidebar.admin"), path: "/admin" })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
