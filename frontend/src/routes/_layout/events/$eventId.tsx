import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
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
  DialogFooter,
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
        <h1 className="text-3xl font-bold">
          Event Dashboard: <span className="text-muted-foreground">{stats?.event_name || "..."}</span>
        </h1>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          {/* @ts-ignore */}
          <Link to="/checkin/$eventId" params={{ eventId }}>
            Control de Ingreso
          </Link>
        </Button>
      </div>

      {/* Global Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Quota
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_quota}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registered Attendees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_registered}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(
                ((stats?.total_registered || 0) / (stats?.total_quota || 1)) * 100,
              )}
              % Filled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Checked-in
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats?.checked_in_count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(
                ((stats?.checked_in_count || 0) / (stats?.total_registered || 1)) *
                100,
              )}
              % Attendance
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Physical Capacity Left
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">
              {(stats?.total_quota || 0) - (stats?.checked_in_count || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on check-ins
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="churches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="churches">Churches & Quotas</TabsTrigger>
          <TabsTrigger value="assigned_digiters">Assigned Digiters</TabsTrigger>
          <TabsTrigger value="attendees">Attendees List</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
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
                    <TableHead>Checked-in</TableHead>
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
                      <TableCell>{church.registered_count}</TableCell>
                      <TableCell>
                        {church.checked_in_count}
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

        <TabsContent value="maintenance">
          <MaintenanceTab eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MaintenanceTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: duplicates, refetch: refetchDuplicates, isFetching } = useQuery({
    queryKey: ["eventDuplicates", eventId],
    queryFn: () => EventsService.getEventDuplicates({ eventId }) as Promise<any[]>,
  })

  const cleanupMutation = useMutation({
    mutationFn: () => EventsService.cleanupEventDuplicates({ eventId }),
    onSuccess: (data: any) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["eventStats", eventId] })
      queryClient.invalidateQueries({ queryKey: ["eventAttendees", eventId] })
      refetchDuplicates()
      setConfirmOpen(false)
    },
    onError: () => {
      toast.error("Failed to cleanup duplicates")
    },
  })

  const handleInitialClick = () => {
    if (!duplicates?.length) return

    // 1. Download Backup
    const backupData = JSON.stringify(duplicates, null, 2)
    const blob = new Blob([backupData], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `backup_duplicates_event_${eventId}_${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // 2. Open Custom Confirm Dialog
    setConfirmOpen(true)
  }

  const duplicatesCount = duplicates?.reduce((acc: number, curr: any) => acc + (curr.count - 1), 0) || 0

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Mantenimiento de Datos</CardTitle>
          <CardDescription>
            Identificar y limpiar registros duplicados basándose en el Document ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <p className="font-semibold">Duplicados Encontrados: {duplicatesCount}</p>
              <p className="text-sm text-muted-foreground">
                Se mantendrá el registro más reciente y se eliminarán los anteriores.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="default" className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link to="/checkin"> control de Ingreso</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => refetchDuplicates()}
                disabled={isFetching}
              >
                Recargar Reporte
              </Button>
              <Button
                disabled={!duplicatesCount || cleanupMutation.isPending}
                onClick={handleInitialClick}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {cleanupMutation.isPending ? "Limpiando..." : "Descargar Backup y Limpiar"}
              </Button>
            </div>
          </div>

          {duplicates?.length ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Detalle de Duplicados</h3>
              <div className="grid gap-2">
                {duplicates.map((group: any) => (
                  <div key={group.document_id} className="p-3 border rounded text-sm">
                    <p className="font-mono font-bold mb-2">ID: {group.document_id} ({group.count} registros)</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {group.attendees.map((a: any, idx: number) => (
                        <li key={a.id}>
                          {idx === 0 ? "🌟 (Se queda) " : "🗑️ (Borrar) "}
                          {a.full_name} - {new Date(a.created_at!).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : !isFetching && (
            <p className="text-center py-8 text-muted-foreground">
              No se encontraron duplicados en este evento. ✨
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Limpieza</DialogTitle>
            <DialogDescription>
              Se ha descargado un archivo de respaldo. ¿Deseas proceder con la eliminación definitiva de los registros duplicados antiguos?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending ? "Eliminando..." : "Eliminar Registros"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

