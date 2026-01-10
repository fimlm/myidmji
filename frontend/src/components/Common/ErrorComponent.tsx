import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

const ErrorComponent = ({ error }: { error?: Error }) => {
  const { t } = useTranslation()

  return (
    <div
      className="flex min-h-screen items-center justify-center flex-col p-4"
      data-testid="error-component"
    >
      <div className="flex items-center z-10">
        <div className="flex flex-col ml-4 items-center justify-center p-4">
          <span className="text-6xl md:text-8xl font-bold leading-none mb-4">
            Error
          </span>
          <span className="text-2xl font-bold mb-2">Oops!</span>
        </div>
      </div>

      <p className="text-lg text-muted-foreground mb-4 text-center z-10">
        {t("common.errorTitle")}
      </p>

      {/* Debug Info for User Reports */}
      <div className="max-w-md w-full mb-6 z-10">
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer list-none text-center hover:text-foreground transition-colors">
            {t("common.showDetails") || "Show Technical Details"}
          </summary>
          <div className="mt-2 bg-muted p-4 rounded-md text-xs font-mono overflow-auto max-h-[300px] text-left border border-border">
            <p className="font-bold text-red-500 mb-2">{error?.message || "Unknown error"}</p>
            <p className="text-muted-foreground mb-2">Location: {window.location.pathname}</p>
            <pre className="whitespace-pre-wrap">{error?.stack}</pre>
          </div>
        </details>
      </div>

      <Link to="/" onClick={() => window.location.href = "/"}>
        <Button>{t("common.goHome") || "Home"}</Button>
      </Link>
    </div>
  )
}

export default ErrorComponent
