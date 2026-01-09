import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { EventsService, UsersService, type UserUpdateMe } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

const UserInformation = () => {
  const { t } = useTranslation()

  const formSchema = z.object({
    full_name: z.string().max(30).optional(),
    email: z.string().email({ message: t("settings.profile.invalidEmail") }),
    church_id: z.string().uuid().optional(),
  })

  type FormData = z.infer<typeof formSchema>

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [editMode, setEditMode] = useState(false)
  const { user: currentUser } = useAuth()

  // Fetch churches for the dropdown
  const { data: churchesData } = useQuery({
    queryKey: ["churches"],
    queryFn: () => EventsService.readChurches({ limit: 1000 }),
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      full_name: currentUser?.full_name ?? undefined,
      email: currentUser?.email,
      church_id: currentUser?.church_id ?? undefined,
    },
  })

  const toggleEditMode = () => {
    setEditMode(!editMode)
  }

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) =>
      UsersService.updateUserMe({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast(t("settings.profile.successToast"))
      toggleEditMode()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries()
    },
  })

  const onSubmit = (data: FormData) => {
    const updateData: UserUpdateMe = {}

    // only include fields that have changed
    if (data.full_name !== currentUser?.full_name) {
      updateData.full_name = data.full_name
    }
    if (data.email !== currentUser?.email) {
      updateData.email = data.email
    }
    if (data.church_id !== currentUser?.church_id) {
      updateData.church_id = data.church_id as any
    }

    mutation.mutate(updateData)
  }

  const onCancel = () => {
    form.reset()
    toggleEditMode()
  }

  const currentChurchName =
    churchesData?.data.find((c) => c.id === currentUser?.church_id)?.name ||
    currentUser?.church_name ||
    t("settings.profile.notAvailable")

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold py-4">
        {t("settings.profile.infoTitle")}
      </h3>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.profile.fullNameLabel")}</FormLabel>
                {editMode ? (
                  <FormControl>
                    <Input type="text" {...field} />
                  </FormControl>
                ) : (
                  <p
                    className={cn(
                      "py-2 truncate max-w-sm",
                      !field.value && "text-muted-foreground",
                    )}
                  >
                    {field.value || t("settings.profile.notAvailable")}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.profile.emailLabel")}</FormLabel>
                {editMode ? (
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                ) : (
                  <p className="py-2 truncate max-w-sm">{field.value}</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="church_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.profile.churchLabel")}</FormLabel>
                {editMode ? (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("settings.profile.churchPlaceholder")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {churchesData?.data.map((church) => (
                        <SelectItem key={church.id} value={church.id}>
                          {church.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="py-2 truncate max-w-sm">{currentChurchName}</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3 mt-4">
            {editMode ? (
              <>
                <LoadingButton
                  type="submit"
                  loading={mutation.isPending}
                  disabled={!form.formState.isDirty}
                >
                  {t("settings.profile.saveButton")}
                </LoadingButton>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={mutation.isPending}
                >
                  {t("settings.profile.cancelButton")}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={toggleEditMode}>
                {t("settings.profile.editButton")}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}

export default UserInformation
