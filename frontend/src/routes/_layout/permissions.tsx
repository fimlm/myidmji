import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { UsersService } from "@/client"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/permissions")({
  component: PermissionsManager,
  loader: () => ({
    title: "Roles & Permissions",
  }),
})

function PermissionsManager() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const [filterRole, setFilterRole] = useState<"staff" | "all">("all")
  const [rowSelection, setRowSelection] = useState({})

  // Strict Superadmin Guard
  useEffect(() => {
    if (currentUser && !currentUser.is_superuser) {
      navigate({ to: "/" })
    }
  }, [currentUser, navigate])

  const { data: users, isLoading } = useQuery({
    queryKey: ["users", filterRole],
    queryFn: async () => {
      if (filterRole === "staff") {
        // Fetch supervisors and digiters
        // API doesn't support multiple roles yet, so we fetch all and filter client side OR
        // since we added `role` param, we can fetch one by one?
        // Actually, for "Staff", let's just fetch all and filter in frontend for now to avoid complexity,
        // or if we really used the backend param:
        // const d = await UsersService.readUsers({ role: "digiter" })
        // const s = await UsersService.readUsers({ role: "supervisor" })
        // return [...d.data, ...s.data]
        // But pagination breaks.
        // Let's rely on client side filtering for "Staff" view over the 100 limit, or just fetch all.
        // The user asked for "assign role", so seeing everyone is fine.
        // Let's just use the `limit` increased to 1000 for this view to ensure we see everyone.
        const response = await UsersService.readUsers({ limit: 1000 })
        return response.data.filter((u) =>
          ["supervisor", "digiter", "admin"].includes(u.role || ""),
        )
      }
      return (await UsersService.readUsers({ limit: 1000 })).data
    },
  })

  if (currentUser && !currentUser.is_superuser) {
    return null
  }

  const tableData: UserTableData[] = users
    ? users.map((user) => ({
        ...user,
        isCurrentUser: currentUser?.id === user.id,
      }))
    : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground">
            Manage system-wide roles (Supervisors, Digiters, Admins).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterRole === "all" ? "default" : "outline"}
            onClick={() => setFilterRole("all")}
          >
            All Users
          </Button>
          <Button
            variant={filterRole === "staff" ? "default" : "outline"}
            onClick={() => setFilterRole("staff")}
          >
            Staff Only
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div>Loading users...</div>
      ) : (
        <DataTable
          columns={columns}
          data={tableData}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
        />
      )}
    </div>
  )
}
