import { Capacitor } from "@capacitor/core"
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth"
import { type CredentialResponse, GoogleLogin } from "@react-oauth/google"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LoginService } from "@/client"
import { Button } from "@/components/ui/button"

export function GoogleLoginButton() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const googleLoginMutation = useMutation({
    mutationFn: async (token: string) => {
      return LoginService.loginGoogle({ requestBody: { token } })
    },
    onSuccess: (data) => {
      // Store token exactly like the standard login does
      localStorage.setItem("access_token", data.access_token)
      toast.success("Login successful")
      navigate({ to: "/" })
    },
    onError: (error) => {
      console.error("Google Login Error:", error)
      toast.error("Google Login failed. Please try again.")
    },
  })

  const handleWebSuccess = (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      googleLoginMutation.mutate(credentialResponse.credential)
    }
  }

  const handleNativeLogin = async () => {
    try {
      const user = await GoogleAuth.signIn()
      if (user.authentication.idToken) {
        googleLoginMutation.mutate(user.authentication.idToken)
      } else {
        toast.error("No ID Token received from Google")
      }
    } catch (error) {
      console.error("Native Google Login Error:", error)
      // Ignore dismissed error
    }
  }

  if (Capacitor.isNativePlatform()) {
    return (
      <Button
        onClick={handleNativeLogin}
        variant="outline"
        className="w-full relative gap-2"
        disabled={googleLoginMutation.isPending}
      >
        {/* Placeholder Icon - You can replace with an SVG component */}
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
            <path
              fill="#4285F4"
              d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
            />
            <path
              fill="#34A853"
              d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
            />
            <path
              fill="#FBBC05"
              d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.734 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
            />
            <path
              fill="#EA4335"
              d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.799 L -6.734 42.379 C -8.804 40.439 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
            />
          </g>
        </svg>
        {t("google.signIn")}
      </Button>
    )
  }

  // Web Platform
  return (
    <div className="w-full flex justify-center">
      <GoogleLogin
        onSuccess={handleWebSuccess}
        onError={() => {
          toast.error("Login Failed")
        }}
        useOneTap
        theme="outline"
        width="100%"
      />
    </div>
  )
}
