import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
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

// Note: This is an internal component, not a route, but TanStack might treat files in routes/ as routes.
// To avoid auto-routing, we usually prefix with _ or put in separate components folder.
// Since the previous file was auto-routed (create-dialog.tsx), I'll make it export a generic component
// and NOT export 'Route' if it's just a component.
// BUT I see the file was generated as a route.
// If I want it to be just a component, I should move it to components/Events/CreateEventDialog.tsx.
// For now, I will keep it but remove 'export const Route' if I use it as a component.
// WAIT, the previous file had 'export const Route'. I will replace the file with just the COMPONENT.

export function CreateEventDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset } = useForm<{
    name: string
    description: string
    total_quota: number
    max_registration_date: string
  }>()

  const mutation = useMutation({
    mutationFn: (data: any) => EventsService.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      setOpen(false)
      reset()
    },
  })

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      total_quota: Number(data.total_quota),
      max_registration_date: data.max_registration_date || null,
      is_active: true,
    }
    mutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create New Event</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>
            Create a new event and set the total quota.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              {...register("name", { required: true })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input
              id="description"
              {...register("description")}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="total_quota" className="text-right">
              Total Quota
            </Label>
            <Input
              id="total_quota"
              type="number"
              {...register("total_quota", { required: true })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="max_date" className="text-right">
              Deadline
            </Label>
            <Input
              id="max_date"
              type="datetime-local"
              {...register("max_registration_date")}
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
