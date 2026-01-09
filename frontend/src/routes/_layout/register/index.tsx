import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AlertCircle, Check, ChevronsUpDown } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { EventsService, type AttendeePublic } from "@/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/register/")({
  component: Register,
})

const registerSchema = z.object({
  full_name: z.string().min(3, "Name is required"),
  document_id: z.string().optional(),
})

type RegisterFormValues = z.infer<typeof registerSchema>

function Register() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const navigate = useNavigate()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [openEventSelect, setOpenEventSelect] = useState(false)
  const [sessionRegistrations, setSessionRegistrations] = useState<
    AttendeePublic[]
  >([])

  // Redirect if not digiter/admin
  useEffect(() => {
    if (
      currentUser &&
      !currentUser.is_superuser &&
      !["admin", "supervisor", "digiter"].includes(currentUser.role || "")
    ) {
      navigate({ to: "/" })
    }
  }, [currentUser, navigate])

  // Fetch my active events (context aware)
  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["myEvents"],
    queryFn: () => EventsService.getMyEvents(),
    enabled: !!currentUser,
  })

  // Auto-select if only one event
  useEffect(() => {
    if (events && events.length === 1) {
      setSelectedEventId(events[0].id)
    }
  }, [events])

  const activeEvents = events || []
  const selectedEvent = activeEvents.find((e) => e.id === selectedEventId)

  // Wait for auth check
  if (
    currentUser &&
    !currentUser.is_superuser &&
    !["admin", "supervisor", "digiter"].includes(currentUser.role || "")
  ) {
    return null
  }

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      document_id: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: RegisterFormValues & { event_id: string }) => {
      return EventsService.registerAttendee({
        eventId: data.event_id,
        requestBody: {
          full_name: data.full_name,
          document_id: data.document_id,
        },
      })
    },
    onSuccess: (data: AttendeePublic) => {
      showSuccessToast(
        t("registration.detailedSuccessToast", {
          name: data.full_name,
          church: data.church_name || currentUser?.church_name || "---",
          event: data.event_name || selectedEvent?.name || "---",
        }),
      )
      setSessionRegistrations((prev) => [data, ...prev])
      form.reset()
      // Create a new empty registration immediately
      const docInput = document.querySelector(
        'input[name="full_name"]',
      ) as HTMLInputElement
      if (docInput) docInput.focus()
    },
    onError: (err: any) => {
      const detail = err.body?.detail
      // Try to translate the error code
      const translationKey = `registration.errors.${detail}`
      const translatedError = t(translationKey)

      // If translation exists (doesn't match key) use it, otherwise use detail or fallback
      const message = translatedError !== translationKey
        ? translatedError
        : (detail || t("registration.errorToast"))

      showErrorToast(message)
    },
  })

  const onSubmit = (data: RegisterFormValues) => {
    if (!selectedEventId) {
      showErrorToast(t("registration.selectEventError"))
      return
    }
    mutation.mutate({ ...data, event_id: selectedEventId })
  }

  if (isLoadingEvents) {
    return <div className="p-8">{t("registration.loadingContext")}</div>
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {/* Header Info */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">{t("registration.title")}</h1>
        {selectedEvent && (
          <div className="mt-2 text-lg text-muted-foreground">
            {t("registration.registeringFor")}{" "}
            <span className="font-semibold text-primary">
              {selectedEvent.name}
            </span>
            {currentUser?.church_name && (
              <span> - {currentUser.church_name}</span>
            )}
          </div>
        )}
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t("registration.newAttendee")}</CardTitle>
          <CardDescription>{t("registration.attendeeDesc")}</CardDescription>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Event Selection (Only if > 1 event) */}
                {activeEvents.length > 1 && (
                  <div className="flex flex-col space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {t("registration.eventLabel")}
                    </label>
                    <Popover
                      open={openEventSelect}
                      onOpenChange={setOpenEventSelect}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openEventSelect}
                          className="justify-between"
                        >
                          {selectedEventId
                            ? activeEvents.find(
                              (event) => event.id === selectedEventId,
                            )?.name
                            : t("registration.eventPlaceholder")}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput
                            placeholder={t("registration.searchPlaceholder")}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {t("registration.noEventFound")}
                            </CommandEmpty>
                            <CommandGroup>
                              {activeEvents.map((event) => (
                                <CommandItem
                                  key={event.id}
                                  value={event.name}
                                  onSelect={() => {
                                    setSelectedEventId(event.id)
                                    setOpenEventSelect(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedEventId === event.id
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {event.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Read-only Event Display if auto-selected (Optional, maybe redundant with header) */}
                {/* 
              {activeEvents.length === 1 && selectedEvent && (
                  <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                      Target Event: <span className="font-medium text-foreground">{selectedEvent.name}</span>
                  </div>
              )}
               */}

                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("registration.fullName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("registration.fullNamePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="document_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("registration.documentId")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("registration.documentIdPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!selectedEventId || mutation.isPending}
                >
                  {mutation.isPending
                    ? t("registration.registering")
                    : t("registration.registerButton")}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        {t("registration.loggedInAs")}{" "}
        <span className="font-medium">{currentUser?.full_name}</span>
      </div>

      {/* Registration Log / "Lock" Effect */}
      <div className="mt-12 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-semibold">{t("registration.sessionLog")}</h2>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {sessionRegistrations.length} {t("sidebar.register")}
          </Badge>
        </div>

        <div className="relative">
          {/* Faded/Degrade Effect Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />

          <div className="space-y-2 max-h-[300px] overflow-y-auto pb-20 pr-2 custom-scrollbar">
            {sessionRegistrations.length > 0 ? (
              sessionRegistrations.map((reg, idx) => (
                <div
                  key={reg.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border bg-card/50 backdrop-blur-sm transition-all animate-in fade-in slide-in-from-top-2 duration-500",
                    idx === 0 ? "border-primary/50 shadow-sm" : "opacity-70 scale-95 origin-top"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      {reg.full_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {reg.church_name || currentUser?.church_name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono p-1 bg-muted rounded uppercase tracking-wider">
                    {reg.document_id || "N/A"}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground italic">
                {t("registration.noRecentRegistrations")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  )
}
