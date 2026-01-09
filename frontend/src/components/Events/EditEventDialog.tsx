import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { type EventPublic, EventsService } from "@/client"
import { Button } from "@/components/ui/button"
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
import { Label } from "@/components/ui/label"

interface EditEventDialogProps {
  event: EventPublic
}

export function EditEventDialog({ event }: EditEventDialogProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: event.name,
      description: event.description || "",
      total_quota: event.total_quota,
      max_registration_date: event.max_registration_date
        ? new Date(event.max_registration_date).toISOString().slice(0, 16)
        : "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: any) =>
      EventsService.updateEvent({ eventId: event.id, requestBody: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      setOpen(false)
    },
  })

  const onSubmit = (data: any) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            Update the event details and total capacity.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-name" className="text-right">
              Name
            </Label>
            <Input
              id="edit-name"
              {...register("name", { required: true })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-description" className="text-right">
              Description
            </Label>
            <Input
              id="edit-description"
              {...register("description")}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-total_quota" className="text-right">
              Total Quota
            </Label>
            <Input
              id="edit-total_quota"
              type="number"
              {...register("total_quota", {
                required: true,
                valueAsNumber: true,
              })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-max_date" className="text-right">
              Deadline
            </Label>
            <Input
              id="edit-max_date"
              type="datetime-local"
              {...register("max_registration_date")}
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating..." : "Update Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
