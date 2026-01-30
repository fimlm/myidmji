
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AlertCircle, Check, ChevronsUpDown, Search, UserCheck, X, CheckCircle2 } from "lucide-react"
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

export const Route = createFileRoute("/_layout/checkin/")({
    component: Checkin,
})

const checkinSchema = z.object({
    document_id: z.string().min(1, "Document ID is required"),
})

type CheckinFormValues = z.infer<typeof checkinSchema>

function Checkin() {
    const { t } = useTranslation()
    const { user: currentUser } = useAuth()
    const { showSuccessToast, showErrorToast } = useCustomToast()
    const navigate = useNavigate()
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [openEventSelect, setOpenEventSelect] = useState(false)

    // State for search/confirm flow
    const [searchedAttendee, setSearchedAttendee] = useState<AttendeePublic | null>(null)
    const [sessionCheckins, setSessionCheckins] = useState<AttendeePublic[]>([])
    const [notFoundError, setNotFoundError] = useState<boolean>(false)

    // Name Search State
    const [showNameSearch, setShowNameSearch] = useState<boolean>(false)
    const [nameQuery, setNameQuery] = useState<string>("")
    const [nameDebounce, setNameDebounce] = useState<string>("")

    // Debounce logic
    useEffect(() => {
        const handler = setTimeout(() => {
            setNameDebounce(nameQuery)
        }, 500)
        return () => clearTimeout(handler)
    }, [nameQuery])

    // Redirect if not digiter/admin
    useEffect(() => {
        if (
            currentUser &&
            !currentUser.is_superuser &&
            !["ADMIN", "SUPERVISOR", "DIGITER"].includes(currentUser.role || "")
        ) {
            navigate({ to: "/" })
        }
    }, [currentUser, navigate])

    // Fetch my active events 
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
        !["ADMIN", "SUPERVISOR", "DIGITER"].includes(currentUser.role || "")
    ) {
        return null
    }

    const form = useForm<CheckinFormValues>({
        resolver: zodResolver(checkinSchema),
        defaultValues: {
            document_id: "",
        },
    })

    // 1. Search Mutation (ID)
    const searchMutation = useMutation({
        mutationFn: (data: { document_id: string, eventId: string }) =>
            EventsService.searchAttendeeByDocument({
                eventId: data.eventId,
                documentId: data.document_id,
            }),
        onSuccess: (data) => {
            setSearchedAttendee(data)
            setNotFoundError(false)
            setShowNameSearch(false) // ensure name search is closed
        },
        onError: (err: any) => {
            setSearchedAttendee(null)
            const detail = err.body?.detail

            // If explicit 404, show UI card instead of toast
            if (err.status === 404 || detail === "Attendee not found") {
                setNotFoundError(true)
            } else {
                // Other errors (server, etc) show toast
                showErrorToast(detail || t("common.error"))
                form.setFocus("document_id")
            }
        },
    })

    // 2. Search Query (Name)
    const { data: nameSearchResults, isLoading: isSearchingName } = useQuery({
        queryKey: ["searchByName", selectedEventId, nameDebounce],
        queryFn: () =>
            EventsService.searchAttendeeByName({
                eventId: selectedEventId!,
                q: nameDebounce
            }),
        enabled: !!selectedEventId && showNameSearch && nameDebounce.length >= 3,
    })

    // 3. Check-in Mutation
    const checkinMutation = useMutation({
        mutationFn: () =>
            EventsService.checkinAttendee({
                eventId: selectedEventId!,
                attendeeId: searchedAttendee!.id,
            }),
        onSuccess: (data: AttendeePublic) => {
            showSuccessToast(t("checkin.successTitle").replace("{{name}}", data.full_name))
            setSessionCheckins((prev) => [data, ...prev])
            // Reset flow
            onCancelCheckin() // This handles full reset including name search
        },
        onError: (err: any) => {
            showErrorToast(err.body?.detail || t("common.error"))
        }
    })

    const onSubmitSearch = (data: CheckinFormValues) => {
        if (!selectedEventId) {
            showErrorToast(t("registration.selectEventError"))
            return
        }
        setNotFoundError(false) // clear previous error
        searchMutation.mutate({ document_id: data.document_id, eventId: selectedEventId })
    }

    const onConfirmCheckin = () => {
        if (!searchedAttendee || !selectedEventId) return
        checkinMutation.mutate()
    }

    const onCancelCheckin = () => {
        setSearchedAttendee(null)
        setNotFoundError(false)
        setShowNameSearch(false)
        setNameQuery("")
        form.reset()
        // Slight delay to focus to ensure rendering
        setTimeout(() => form.setFocus("document_id"), 100)
    }

    const startNameSearch = () => {
        setNotFoundError(false)
        setShowNameSearch(true)
    }

    if (isLoadingEvents) {
        return <div className="p-8">{t("common.loading")}</div>
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 space-y-8 max-w-2xl mx-auto animate-in fade-in duration-500">
            {/* Header Info */}
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">{t("checkin.title")}</h1>
                {selectedEvent && (
                    <div className="mt-2 text-lg text-muted-foreground">
                        {t("registration.eventLabel")}:{" "}
                        <span className="font-semibold text-primary">
                            {selectedEvent.name}
                        </span>
                    </div>
                )}
            </div>

            <Card className="w-full max-w-lg border-2 shadow-md transition-all duration-300">
                <CardHeader>
                    <CardTitle>
                        {showNameSearch ? t("checkin.searchTitle") : t("checkin.searchTitle")}
                    </CardTitle>
                    <CardDescription>
                        {showNameSearch ? t("checkin.searchByNamePlaceholder") : t("checkin.searchDesc")}
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
                        <>
                            {/* Event Selection */}
                            {activeEvents.length > 1 && !searchedAttendee && !notFoundError && !showNameSearch && (
                                <div className="flex flex-col space-y-2 mb-6">
                                    <label className="text-sm font-medium leading-none">
                                        {t("checkin.selectEvent")}
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
                                                    : t("checkin.selectEventPlaceholder")}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0">
                                            <Command>
                                                <CommandInput
                                                    placeholder={t("registration.searchPlaceholder")}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>{t("checkin.noEvent")}</CommandEmpty>
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

                            {/* MODE 1: ID SEARCH FORM */}
                            {!searchedAttendee && !notFoundError && !showNameSearch && (
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmitSearch)} className="space-y-6">
                                        <FormField
                                            control={form.control}
                                            name="document_id"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-lg">{t("checkin.documentLabel")}</FormLabel>
                                                    <FormControl>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                placeholder={t("checkin.documentPlaceholder")}
                                                                className="text-xl h-14"
                                                                autoFocus
                                                                autoComplete="off"
                                                                {...field}
                                                            />
                                                            <Button
                                                                type="submit"
                                                                size="lg"
                                                                className="h-14 px-6"
                                                                disabled={!selectedEventId || searchMutation.isPending}
                                                            >
                                                                {searchMutation.isPending ? t("checkin.searching") : <Search className="w-6 h-6" />}
                                                            </Button>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </form>
                                </Form>
                            )}

                            {/* MODE 2: NOT FOUND CARD (Choice) */}
                            {notFoundError && (
                                <div className="animate-in zoom-in-95 duration-200 space-y-4 text-center">
                                    <div className="bg-destructive/10 p-6 rounded-lg border border-destructive/20">
                                        <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
                                        <h3 className="text-2xl font-bold text-destructive">{t("checkin.notFoundTitle")}</h3>
                                        <p className="text-lg text-muted-foreground mt-2">
                                            {t("checkin.notFoundDesc")}
                                        </p>
                                        <div className="mt-4 font-mono bg-background p-2 rounded inline-block">
                                            CC: {form.getValues("document_id")}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <Button
                                            size="lg"
                                            className="w-full h-12"
                                            variant="secondary"
                                            onClick={startNameSearch}
                                        >
                                            {t("checkin.searchByNameButton")}
                                        </Button>
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="w-full h-12"
                                            onClick={onCancelCheckin}
                                        >
                                            {t("checkin.notFoundAction")}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* MODE 3: NAME SEARCH */}
                            {showNameSearch && !searchedAttendee && (
                                <div className="space-y-4 animate-in fade-in zoom-in-95">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder={t("checkin.searchByNamePlaceholder")}
                                            value={nameQuery}
                                            onChange={(e) => setNameQuery(e.target.value)}
                                            className="text-lg h-12"
                                            autoFocus
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-12 w-12"
                                            onClick={onCancelCheckin}
                                        >
                                            <X className="w-5 h-5" />
                                        </Button>
                                    </div>

                                    <div className="min-h-[200px] border rounded-md p-2 bg-muted/20">
                                        {nameDebounce.length < 3 ? (
                                            <div className="text-center text-muted-foreground py-8">
                                                {t("checkin.searchByNamePlaceholder")}
                                            </div>
                                        ) : isSearchingName ? (
                                            <div className="text-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                                                {t("checkin.searching")}
                                            </div>
                                        ) : nameSearchResults?.length === 0 ? (
                                            <div className="text-center text-muted-foreground py-8">
                                                {t("checkin.noResults")}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {nameSearchResults?.map((att) => (
                                                    <Button
                                                        key={att.id}
                                                        variant="ghost"
                                                        className="w-full justify-start h-auto text-left p-3 hover:bg-primary/5 border border-transparent hover:border-primary/20"
                                                        onClick={() => setSearchedAttendee(att)}
                                                    >
                                                        <UserCheck className="w-5 h-5 mr-3 text-muted-foreground" />
                                                        <div>
                                                            <div className="font-semibold">{att.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                CC: {att.document_id || "N/A"} • {att.church_name}
                                                            </div>
                                                        </div>
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        variant="link"
                                        className="w-full text-muted-foreground"
                                        onClick={onCancelCheckin}
                                    >
                                        {t("checkin.backToId")}
                                    </Button>
                                </div>
                            )}

                            {/* CONFIRMATION CARD (Replaces Form when found) */}
                            {searchedAttendee && (
                                <div className="animate-in zoom-in-95 duration-200 space-y-4">
                                    <div className="bg-primary/5 p-6 rounded-lg text-center border border-primary/20">
                                        <UserCheck className="w-16 h-16 mx-auto text-primary mb-4" />
                                        <h3 className="text-2xl font-bold">{searchedAttendee.full_name}</h3>
                                        <p className="text-lg text-muted-foreground mt-1">CC: {searchedAttendee.document_id}</p>

                                        <div className="mt-4 p-2 bg-background rounded border inline-block px-4">
                                            <span className="text-sm text-muted-foreground uppercase tracking-wider">{t("checkin.church")}</span>
                                            <div className="font-semibold">{searchedAttendee.church_name}</div>
                                        </div>

                                        {searchedAttendee.checked_in_at && (
                                            <div className="mt-4 p-3 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/30 font-bold backdrop-blur-sm">
                                                {t("checkin.alreadyCheckedIn").replace("{{date}}", new Date(searchedAttendee.checked_in_at).toLocaleString())}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            size="lg"
                                            className="flex-1 h-12"
                                            onClick={onCancelCheckin}
                                        >
                                            {t("checkin.cancelButton")}
                                        </Button>
                                        {!searchedAttendee.checked_in_at && (
                                            <Button
                                                size="lg"
                                                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-lg"
                                                onClick={onConfirmCheckin}
                                                disabled={checkinMutation.isPending}
                                            >
                                                {checkinMutation.isPending ? t("checkin.registering") : t("checkin.confirmButton")}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* SESSION LOG */}
            <div className="mt-12 w-full max-w-lg space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-semibold">{t("checkin.recentLog")}</h2>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300">
                        {sessionCheckins.length}
                    </Badge>
                </div>

                <div className="relative">
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background to-transparent pointer-events-none z-10" />
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pb-20 pr-2 custom-scrollbar">
                        {sessionCheckins.length > 0 ? (
                            sessionCheckins.map((att, idx) => (
                                <div
                                    key={att.id}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border backdrop-blur-sm transition-all animate-in fade-in slide-in-from-top-2 duration-500",
                                        idx === 0
                                            ? "border-green-500/50 shadow-sm bg-green-500/10 dark:bg-green-900/20"
                                            : "opacity-70 scale-95 origin-top bg-card border-border"
                                    )}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground">
                                            {att.full_name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date().toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                {t("checkin.noLog")}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}


