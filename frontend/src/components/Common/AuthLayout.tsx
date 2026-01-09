import { Appearance } from "@/components/Common/Appearance"
import { LanguageSwitcher } from "@/components/Common/LanguageSwitcher"
import { Logo } from "@/components/Common/Logo"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="absolute right-4 top-4 flex items-center gap-2 md:right-8 md:top-8">
        <LanguageSwitcher />
        <Appearance />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Logo variant="full" className="h-10" asLink={false} />
        </div>
        {children}
      </div>
    </div>
  )
}
