import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { EventsService } from "@/client"
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

interface RegisterEventDialogProps {
  eventId: string
  eventName: string
}

export function RegisterEventDialog({
  eventId,
  eventName,
}: RegisterEventDialogProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset } = useForm<{
    full_name: string
    document_id: string
  }>()

  const mutation = useMutation({
    mutationFn: (data: any) =>
      EventsService.registerAttendee({ eventId, requestBody: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] }) // Maybe invalidate specific event stats if available
      setOpen(false)
      reset()
      toast.success("Attendee registered successfully")
    },
    onError: (err: any) => {
      toast.error(err.body?.detail || "Registration failed")
    },
  })

  const onSubmit = (data: any) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Register</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Register for {eventName}</DialogTitle>
          <DialogDescription>
            Register a new attendee for this event.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="full_name" className="text-right">
              Full Name
            </Label>
            <Input
              id="full_name"
              {...register("full_name", { required: true })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="document_id" className="text-right">
              Document ID
            </Label>
            <Input
              id="document_id"
              {...register("document_id")}
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Registering..." : "Register"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
