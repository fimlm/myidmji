import { Link, createFileRoute } from "@tanstack/react-router"
import { Calendar, Shield, UserCheck, UserX } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DashboardSetup } from "@/components/Dashboard/DashboardSetup"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

function Dashboard() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  if (!currentUser) return null

  const canRegister =
    currentUser?.is_superuser ||
    ["ADMIN", "SUPERVISOR", "DIGITER"].includes(currentUser?.role || "")

  const canManageEvents =
    currentUser?.is_superuser ||
    ["ADMIN", "SUPERVISOR"].includes(currentUser?.role || "")

  const canAdmin =
    currentUser?.is_superuser ||
    ["ADMIN"].includes(currentUser?.role || "")

  const isPending =
    currentUser?.role === "USER" &&
    !currentUser?.is_superuser &&
    !!currentUser?.church_id

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("dashboard.greeting", {
            name: currentUser?.full_name || currentUser?.email,
          })}
        </h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.welcome")}</p>
      </div>

      <DashboardSetup />

      {isPending && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Shield className="h-24 w-24" />
          </div>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider">
                {t("dashboard.pendingBanner.waiting")}
              </span>
            </div>
            <CardTitle className="text-xl">
              {t("dashboard.pendingBanner.title", { name: currentUser?.full_name?.split(' ')[0] || 'Demo' })}
            </CardTitle>
            <CardDescription className="text-base max-w-2xl">
              {t("dashboard.pendingBanner.message")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {canRegister && (
          <>
            <Link to="/register" className="group">
              <Card className="h-full transition-all hover:border-primary/50 hover:bg-accent/50 group-hover:shadow-md cursor-pointer">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <CardTitle>{t("dashboard.actions.registerTitle")}</CardTitle>
                  <CardDescription>
                    {t("dashboard.actions.registerDesc")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link to="/unregister" className="group">
              <Card className="h-full transition-all hover:border-destructive/50 hover:bg-destructive/5 group-hover:shadow-md cursor-pointer">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                    <UserX className="h-6 w-6" />
                  </div>
                  <CardTitle>{t("dashboard.actions.unregisterTitle")}</CardTitle>
                  <CardDescription>
                    {t("dashboard.actions.unregisterDesc")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </>
        )}

        {canManageEvents && (
          <Link to="/events" className="group">
            <Card className="h-full transition-all hover:border-blue-500/50 hover:bg-blue-500/5 group-hover:shadow-md cursor-pointer">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Calendar className="h-6 w-6" />
                </div>
                <CardTitle>{t("dashboard.actions.eventsTitle")}</CardTitle>
                <CardDescription>
                  {t("dashboard.actions.eventsDesc")}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {(canAdmin || currentUser?.is_superuser) && (
          <Link to="/admin" className="group">
            <Card className="h-full transition-all hover:border-purple-500/50 hover:bg-purple-500/5 group-hover:shadow-md cursor-pointer">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <Shield className="h-6 w-6" />
                </div>
                <CardTitle>{t("dashboard.actions.adminTitle")}</CardTitle>
                <CardDescription>
                  {t("dashboard.actions.adminDesc")}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>
    </div>
  )
}
