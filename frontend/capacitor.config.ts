import type { CapacitorConfig } from "@capacitor/cli"
import dotenv from "dotenv"

dotenv.config({ path: "../.env" })

const config: CapacitorConfig = {
  appId: "org.idmji.myidmji",
  appName: "MyIDMJI",
  webDir: "dist",
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: process.env.VITE_GOOGLE_CLIENT_ID,
      forceCodeForRefreshToken: true,
    },
  },
}

export default config
