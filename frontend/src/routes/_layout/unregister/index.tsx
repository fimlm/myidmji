import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AlertCircle, Search, Trash2, UserX } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { EventsService, type AttendeePublic } from "@/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

export const Route = createFileRoute("/_layout/unregister/")({
  component: Unregister,
})

const SearchSchema = z.object({
  document_id: z.string().min(1, "Document ID is required"),
})

function Unregister() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [searchedAttendee, setSearchedAttendee] = useState<AttendeePublic | null>(null)

  // 1. Get Events (Reuse similar logic to Register page)
  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryFn: () => EventsService.getMyEvents(),
    queryKey: ["my-events"],
  })

  // Filter active events
  const activeEvents = events?.filter((e) => e.is_active) || []
  const singleEvent = activeEvents.length === 1 ? activeEvents[0] : null
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    singleEvent?.id || null
  )

  // Update selected event if single event loads later
  if (!selectedEventId && singleEvent) {
    setSelectedEventId(singleEvent.id)
  }

  const form = useForm<z.infer<typeof SearchSchema>>({
    resolver: zodResolver(SearchSchema),
    defaultValues: {
      document_id: "",
    },
  })

  // 2. Search Mutation
  const searchMutation = useMutation({
    mutationFn: async (data: z.infer<typeof SearchSchema>) => {
      if (!selectedEventId) throw new Error("No event selected")
      return await EventsService.searchAttendeeByDocument({
        eventId: selectedEventId,
        documentId: data.document_id,
      })
    },
    onSuccess: (data) => {
      setSearchedAttendee(data)
      toast.success(t("unregister.attendeeFound"))
    },
    onError: (err: any) => {
      setSearchedAttendee(null)
      const errorMsg = err.body?.detail || t("common.error")
      toast.error(errorMsg)
    },
  })

  // 3. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      if (!selectedEventId) throw new Error("No event selected")
      return await EventsService.deleteAttendee({
        eventId: selectedEventId,
        attendeeId: attendeeId
      })
    },
    onSuccess: () => {
      toast.success(t("unregister.successDeleted"))
      setSearchedAttendee(null)
      form.reset()
      queryClient.invalidateQueries({ queryKey: ["events"] }) // Update stats
    },
    onError: (err: any) => {
      const errorMsg = err.body?.detail || t("common.error")
      toast.error(errorMsg)
    },
  })

  const onSearch = (data: z.infer<typeof SearchSchema>) => {
    if (!selectedEventId) {
      toast.error(t("registration.selectEventError"))
      return
    }
    searchMutation.mutate(data)
  }

  const handleDelete = () => {
    if (searchedAttendee) {
      deleteMutation.mutate(searchedAttendee.id)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 bg-background">
      <Card className="w-full max-w-lg shadow-lg border-destructive/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-destructive/10 text-destructive">
              <UserX className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl">{t("unregister.title")}</CardTitle>
          <CardDescription>
            {t("unregister.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoadingEvents && activeEvents.length === 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("registration.noEventFound")}</AlertTitle>
              <AlertDescription>
                {t("registration.noEventsFound")}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {/* Event Selector (if > 1) */}
              {activeEvents.length > 1 && (
                <Select
                  onValueChange={(val) => {
                    setSelectedEventId(val)
                    setSearchedAttendee(null)
                  }}
                  defaultValue={selectedEventId || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("registration.eventPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Search Form */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSearch)} className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="document_id"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            placeholder={t("unregister.searchExample")}
                            {...field}
                            disabled={searchMutation.isPending || !!searchedAttendee}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={!selectedEventId || searchMutation.isPending || !!searchedAttendee}
                    variant="secondary"
                  >
                    {searchMutation.isPending ? (
                      <span className="animate-spin mr-2">⏳</span>
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    {t("common.search")}
                  </Button>
                </form>
              </Form>

              {/* Result Card */}
              {searchedAttendee && (
                <div className="mt-6 p-4 border rounded-lg bg-card animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{searchedAttendee.full_name}</h3>
                      <p className="text-sm text-muted-foreground">{t("common.id")}: {searchedAttendee.document_id}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {searchedAttendee.church_name} • {searchedAttendee.event_name}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchedAttendee(null)
                        form.reset()
                      }}
                    >
                      ✕
                    </Button>
                  </div>

                  <Separator className="my-4" />

                  <div className="bg-destructive/10 p-4 rounded-md">
                    <h4 className="flex items-center text-destructive font-semibold mb-2">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      {t("unregister.confirmDelete")}
                    </h4>
                    <p className="text-sm text-destructive/80 mb-4">
                      {t("unregister.warning")}
                    </p>

                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        t("unregister.deleting")
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t("unregister.deleteButton")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
