import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const useCustomToast = () => {
  const { t } = useTranslation()

  const showSuccessToast = (description: string) => {
    toast.success(t("common.success"), {
      description,
    })
  }

  const showErrorToast = (description: string) => {
    // Try to translate the description if it matches a key in common.errors
    const translationKey = `common.errors.${description}`
    const translatedDescription = t(translationKey)

    // If translation exists (doesn't match the key), use it
    const finalDescription = translatedDescription !== translationKey
      ? translatedDescription
      : description

    toast.error(t("common.errorTitle"), {
      description: finalDescription,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
