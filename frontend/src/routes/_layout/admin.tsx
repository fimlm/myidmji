import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense, useEffect, useState } from "react"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import PendingUsers from "@/components/Pending/PendingUsers"
import { Button } from "@/components/ui/button"
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter"
import useAuth from "@/hooks/useAuth"
import { Mail } from "lucide-react"
import { FaGoogle } from "react-icons/fa"
import useCustomToast from "@/hooks/useCustomToast"

function getUsersQueryOptions() {
  return {
    queryFn: () => UsersService.readUsers({ skip: 0, limit: 100 }),
    queryKey: ["users"],
  }
}

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  loader: () => ({
    title: "Admin - EventosMasivos",
  }),
  beforeLoad: async () => {
    // We can check local storage or use a lightweight auth check if context has user
    // For now, simpler to do it in component or wait for context if available
    // But TanStack Router standard is context.
    // Let's use a component wrapper for now as useAuth is a hook.
  },
})

function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Redirect if not admin
  useEffect(() => {
    if (user && !user.is_superuser && user.role !== "ADMIN") {
      navigate({ to: "/" })
    }
  }, [user, navigate])

  if (user && !user.is_superuser && user.role !== "ADMIN") {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <AddUser />
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <UsersTable />
      </Suspense>
    </div>
  )
}

function UsersTableContent() {
  const { user: currentUser } = useAuth()
  const { data: users } = useSuspenseQuery(getUsersQueryOptions())
  const [rowSelection, setRowSelection] = useState({})

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const tableData: UserTableData[] = users.data.map((user: UserPublic) => ({
    ...user,
    isCurrentUser: currentUser?.id === user.id,
    is_google_account: user.is_google_account || user.email.toLowerCase().endsWith("@gmail.com"),
  }))

  const bulkMutation = useMutation({
    mutationFn: (data: { role?: string; is_active?: boolean }) => {
      const selectedIds = Object.keys(rowSelection).map(
        (index) => tableData[parseInt(index, 10)].id,
      )
      if (selectedIds.length === 0) return Promise.resolve()

      // Construct payload dynamically based on what's passed
      const payload = {
        ids: selectedIds,
        ...(data.role && { role: data.role }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      }

      return UsersService.updateUsersBulk({ requestBody: payload as any })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setRowSelection({})
      showSuccessToast("Users updated successfully")
    },
    onError: (err: any) => {
      const errDetail = err.body?.detail
      const errorMessage = typeof errDetail === 'string'
        ? errDetail
        : "Failed to update users"
      showErrorToast(errorMessage)
    },
  })

  const hasSelection = Object.keys(rowSelection).length > 0

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant="default"
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={!hasSelection || bulkMutation.isPending}
          onClick={() => bulkMutation.mutate({ is_active: true })}
        >
          Activate Selected
        </Button>
        <Button
          variant="secondary"
          disabled={!hasSelection || bulkMutation.isPending}
          onClick={() => bulkMutation.mutate({ role: "DIGITER" })}
        >
          Promote to Digiter
        </Button>
        <Button
          variant="secondary"
          disabled={!hasSelection || bulkMutation.isPending}
          onClick={() => bulkMutation.mutate({ role: "SUPERVISOR" })}
        >
          Promote to Supervisor
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={tableData}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
        renderToolbar={(table) => (
          <div className="flex items-center gap-2">
            {table.getColumn("is_google_account") && (
              <DataTableFacetedFilter
                column={table.getColumn("is_google_account")}
                title="Provider"
                options={[
                  { label: "Google", value: "true", icon: FaGoogle },
                  { label: "Email", value: "false", icon: Mail },
                ]}
              />
            )}
          </div>
        )}
      />
    </div>
  )
}

function UsersTable() {
  return (
    <Suspense fallback={<PendingUsers />}>
      <UsersTableContent />
    </Suspense>
  )
}
