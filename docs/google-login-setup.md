# Configuración de Google Login

Para que el inicio de sesión con Google funcione, necesitas obtener credenciales de Google Cloud Console y configurar los proyectos nativos.

## 1. Google Cloud Console
Ve a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto.

### A. Web Client ID
1.  Crea credenciales **OAuth 2.0 Client ID** de tipo **Web application**.
2.  Agrega tus orígenes autorizados (ej. `http://localhost:5173` para dev).
3.  Copia el "Client ID".
4.  Pégalo en tus archivos `.env` (Frontend y Backend):
    ```bash
    # frontend/.env
    VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com

    # backend/.env
    GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
    ```

### B. Android Client ID
1.  Crea otro Client ID de tipo **Android**.
2.  Necesitarás el **Package Name**: `com.fullstack.app` (o el que definas en `capacitor.config.ts`).
3.  Necesitarás el hash SHA-1 de tu firma de debug/release.
    -   Para debug: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
4.  No necesitas poner este ID en el `.env`, Google lo usa internamente para validar tu App.

### C. iOS Client ID
1.  Crea otro Client ID de tipo **iOS**.
2.  Usa el **Bundle ID**: `com.fullstack.app`.
3.  Descarga el archivo `GoogleService-Info.plist` si usas Firebase, o anota el `iOS URL scheme` (algo como `com.googleusercontent.apps.xxxxxxxx`).

## 2. Configuración Nativa (Solo Mobile)

### Android
No requiere configuración extra de código si configuras bien el SHA-1 en la consola.

### iOS (`Info.plist`)
Debes agregar el esquema de URL en `frontend/ios/App/App/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.TU-ID-AQUI</string>
    </array>
  </dict>
</array>
```

Esta configuración manual es necesaria una única vez para iOS.
