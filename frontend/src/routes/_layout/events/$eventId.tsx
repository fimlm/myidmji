import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { type AttendeePublic, EventsService, type UserPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const Route = createFileRoute("/_layout/events/$eventId")({
  component: EventEditor,
})

function EventEditor() {
  const { eventId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery({
    queryKey: ["eventStats", eventId],
    queryFn: () => EventsService.getEventStats({ eventId }),
  })

  const { data: digiters } = useQuery({
    queryKey: ["eventDigiters", eventId],
    queryFn: () => EventsService.getEventDigiters({ eventId }),
  })

  const { data: attendees } = useQuery({
    queryKey: ["eventAttendees", eventId],
    queryFn: () => EventsService.getEventAttendees({ eventId }),
  })

  // Mutation to update church quota
  const inviteMutation = useMutation({
    mutationFn: (data: { church_id: string; quota: number }) =>
      EventsService.inviteChurchToEvent({
        eventId,
        churchId: data.church_id,
        quota: data.quota,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventStats", eventId] })
      toast.success("Quota updated")
    },
    onError: () => {
      toast.error("Failed to update quota")
    },
  })

  // Local state for editing quotas
  const [editQuota, setEditQuota] = useState<{ [key: string]: number }>({})

  const handleQuotaChange = (churchId: string, val: string) => {
    setEditQuota((prev) => ({ ...prev, [churchId]: parseInt(val, 10) || 0 }))
  }

  const saveQuota = (churchId: string) => {
    if (editQuota[churchId] !== undefined) {
      inviteMutation.mutate({ church_id: churchId, quota: editQuota[churchId] })
    }
  }

  if (isLoading) return <div>Loading event stats...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Event Dashboard</h1>
      </div>

      {/* Global Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_quota}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Registered Attendees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_registered}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.total_quota
                ? Math.round((stats.total_registered / stats.total_quota) * 100)
                : 0}
              % Filled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Remote Digitizers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{digiters?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="churches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="churches">Churches & Quotas</TabsTrigger>
          <TabsTrigger value="assigned_digiters">Assigned Digiters</TabsTrigger>
          <TabsTrigger value="attendees">Attendees List</TabsTrigger>
        </TabsList>

        <TabsContent value="churches" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Church Management</CardTitle>
                <CardDescription>
                  Manage quotas per church and view registration progress.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Church Name</TableHead>
                    <TableHead>Assigned Quota</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Digiters</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.church_stats?.map((church: any) => (
                    <TableRow key={church.church_id}>
                      <TableCell className="font-medium">
                        {church.church_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="w-20"
                            defaultValue={church.quota_limit}
                            onChange={(e) =>
                              handleQuotaChange(
                                church.church_id,
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {church.registered_count} / {church.quota_limit}
                      </TableCell>
                      <TableCell>{church.digiters_count}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveQuota(church.church_id)}
                        >
                          Save Quota
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-[#1EB980] hover:bg-[#1EB980]/90">
                      Add / Import Churches
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import Churches</DialogTitle>
                      <DialogDescription>
                        Add churches to this event. They will be created if they
                        don't exist.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        Coming soon
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assigned_digiters">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Digiters</CardTitle>
              <CardDescription>
                Users with 'Digiter' role belonging to churches invited to this
                event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Church ID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {digiters?.length ? (
                    digiters.map((user: UserPublic) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || "N/A"}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {user.church_id}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              user.is_active ? "text-green-500" : "text-red-500"
                            }
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No digiters found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendees">
          <Card>
            <CardHeader>
              <CardTitle>Registered Attendees</CardTitle>
              <CardDescription>
                List of all attendees registered for this event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Document ID</TableHead>
                    <TableHead>Registered By</TableHead>
                    <TableHead>Registration Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendees?.length ? (
                    attendees.map((attendee: AttendeePublic) => (
                      <TableRow key={attendee.id}>
                        <TableCell className="font-medium">
                          {attendee.full_name}
                        </TableCell>
                        <TableCell>{attendee.document_id || "N/A"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {attendee.registered_by_email || "N/A"}
                        </TableCell>
                        <TableCell>
                          {attendee.created_at
                            ? new Date(attendee.created_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No attendees registered yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
