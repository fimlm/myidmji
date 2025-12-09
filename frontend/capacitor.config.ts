import type { CapacitorConfig } from "@capacitor/cli"
import dotenv from "dotenv"
dotenv.config({ path: "../.env" })

const config: CapacitorConfig = {
  appId: "com.fullstack.app",
  appName: "Full Stack App",
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
