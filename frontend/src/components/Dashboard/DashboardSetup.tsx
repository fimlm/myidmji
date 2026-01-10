import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { EventsService, UsersService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"

export function DashboardSetup() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null)

  // Fetch active events
  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["events", "active"],
    queryFn: async () => {
      const allEvents = await EventsService.readEvents()
      return allEvents.filter((e: any) => e.is_active)
    },
    enabled: !user?.church_id && !user?.is_superuser,
  })

  // Fetch churches for the selected event
  const { data: eventChurches, isLoading: isLoadingChurches } = useQuery({
    queryKey: ["eventChurches", selectedEventId],
    queryFn: () =>
      EventsService.getEventChurches({ eventId: selectedEventId! }),
    enabled: !!selectedEventId && selectedEventId !== "undefined" && selectedEventId !== "null",
  })

  const mutation = useMutation({
    mutationFn: (data: { church_id: string }) =>
      UsersService.updateUserMe({ requestBody: { ...data } as any }),
    onSuccess: () => {
      showSuccessToast(t("dashboard.setup.successToast"))
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
    },
    onError: (err: any) => {
      showErrorToast(err.body?.detail || t("dashboard.setup.errorToast"))
    },
  })

  const handleSave = () => {
    if (!selectedChurchId) return
    mutation.mutate({ church_id: selectedChurchId })
  }

  if (user?.church_id || user?.is_superuser) {
    return null // Already set up or is superuser
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>{t("dashboard.setup.welcomeTitle")}</CardTitle>
        <CardDescription>{t("dashboard.setup.welcomeDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t("dashboard.setup.eventLabel")}
          </label>
          <Select onValueChange={setSelectedEventId} disabled={isLoadingEvents}>
            <SelectTrigger>
              <SelectValue
                placeholder={t("dashboard.setup.eventPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {events?.map((event: any) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedEventId && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("dashboard.setup.churchLabel")}
            </label>
            <Select
              onValueChange={setSelectedChurchId}
              disabled={isLoadingChurches}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("dashboard.setup.churchPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {eventChurches?.data?.map((church: any) => (
                  <SelectItem key={church.id} value={church.id}>
                    {church.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={!selectedChurchId || mutation.isPending}
        >
          {mutation.isPending
            ? t("dashboard.setup.savingButton")
            : t("dashboard.setup.saveButton")}
        </Button>
      </CardFooter>
    </Card>
  )
}
