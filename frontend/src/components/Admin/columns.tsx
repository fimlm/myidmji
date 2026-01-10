import type { ColumnDef } from "@tanstack/react-table"

import type { UserPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { UserActionsMenu } from "./UserActionsMenu"

import { ArrowUpDown, Mail } from "lucide-react"
import { FaGoogle } from "react-icons/fa"
import { Button } from "@/components/ui/button"

export type UserTableData = UserPublic & {
  isCurrentUser: boolean
}

const sortableHeader = (column: any, title: string) => {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}

export const columns: ColumnDef<UserTableData>[] = [
  {
    accessorKey: "is_google_account",
    header: "Provider",
    cell: ({ row }) => {
      const isGoogle = row.original.is_google_account
      return (
        <div className="flex items-center">
          {isGoogle ? (
            <FaGoogle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" title="Google" />
          ) : (
            <span title="Email">
              <Mail className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
            </span>
          )}
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false,
    filterFn: (row, id, value) => {
      return value.includes(String(row.getValue(id)))
    },
  },
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value: boolean) =>
          table.toggleAllPageRowsSelected(!!value)
        }
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "full_name",
    header: ({ column }) => sortableHeader(column, "Full Name"),
    cell: ({ row }) => {
      const fullName = row.original.full_name
      return (
        <div className="flex items-center gap-2">
          <span
            className={cn("font-medium", !fullName && "text-muted-foreground")}
          >
            {fullName || "N/A"}
          </span>
          {row.original.isCurrentUser && (
            <Badge variant="outline" className="text-xs">
              You
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => sortableHeader(column, "Email"),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email}</span>
    ),
  },
  {
    accessorKey: "is_superuser",
    header: ({ column }) => sortableHeader(column, "Role"),
    cell: ({ row }) => (
      <Badge variant={row.original.is_superuser ? "default" : "secondary"}>
        {row.original.is_superuser ? "Superuser" : "User"}
      </Badge>
    ),
  },
  {
    accessorKey: "role",
    header: ({ column }) => sortableHeader(column, "System Role"),
    cell: ({ row }) => {
      const role = row.original.role
      return (
        <Badge
          variant={
            role === "ADMIN"
              ? "default"
              : role === "SUPERVISOR" || role === "DIGITER"
                ? "secondary"
                : "outline"
          }
        >
          {role ? role.toUpperCase() : "N/A"}
        </Badge>
      )
    },
  },
  {
    accessorKey: "church_id",
    header: ({ column }) => sortableHeader(column, "Church ID"),
    cell: ({ row }) => (
      <span
        className="text-xs text-muted-foreground font-mono truncate max-w-[150px] block"
        title={row.original.church_id || ""}
      >
        {row.original.church_id || "N/A"}
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => sortableHeader(column, "Registered At"),
    cell: ({ row }) => {
      if (!row.original.created_at) return <span className="text-muted-foreground text-sm">-</span>
      const date = new Date(row.original.created_at)
      return (
        <span className="text-muted-foreground text-sm">
          {date.toLocaleString()}
        </span>
      )
    },
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            row.original.is_active ? "bg-green-500" : "bg-gray-400",
          )}
        />
        <span className={row.original.is_active ? "" : "text-muted-foreground"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </span>
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <UserActionsMenu user={row.original} />
      </div>
    ),
  },
]
