import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { format } from "date-fns"
import { EventsService } from "@/client"
import { CreateEventDialog } from "@/components/Events/CreateEventDialog"
import { EditEventDialog } from "@/components/Events/EditEventDialog"
import { RegisterEventDialog } from "@/components/Events/RegisterEventDialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/events/")({
  component: EventsList,
})

function EventsList() {
  const { user } = useAuth()
  const isAdmin =
    user?.is_superuser || ["admin", "supervisor"].includes(user?.role || "")

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => EventsService.readEvents(),
  })

  if (isLoading) return <div>Loading...</div>
  // if (error) return <div>Error loading events</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Events Management</h2>
        {isAdmin && <CreateEventDialog />}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Total Quota</TableHead>
              <TableHead>Registration Deadline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events?.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>{event.description}</TableCell>
                <TableCell>{event.total_quota}</TableCell>
                <TableCell>
                  {event.max_registration_date
                    ? format(new Date(event.max_registration_date), "PP p")
                    : "N/A"}
                </TableCell>
                <TableCell>{event.is_active ? "Active" : "Inactive"}</TableCell>
                <TableCell className="text-right">
                  {isAdmin ? (
                    <div className="flex justify-end gap-2">
                      <EditEventDialog event={event} />
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to="/events/$eventId"
                          params={{ eventId: event.id }}
                        >
                          Manage
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <RegisterEventDialog
                      eventId={event.id}
                      eventName={event.name}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
