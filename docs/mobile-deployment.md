# Guía de Despliegue Móvil (iOS, Android y PWA)

Este documento detalla la infraestructura móvil implementada en el proyecto, basada en **Capacitor v8** y **Vite PWA**. Proporciona las instrucciones necesarias para gestionar el ciclo de vida de la aplicación móvil, desde la generación de recursos hasta la compilación y sincronización.

## 📱 Descripción General
El proyecto utiliza una arquitectura de código único para desplegar en tres plataformas:
- **Web/PWA:** Accesible vía navegador con capacidades offline e instalación.
- **Android:** Aplicación nativa generada vía Capacitor.
- **iOS:** Aplicación nativa generada vía Capacitor.

## 🚀 Comandos de Gestión (NPM Scripts)

Se han configurado scripts automatizados en `frontend/package.json` para facilitar las tareas comunes. Todos los comandos deben ejecutarse desde el directorio `frontend/`.

| Comando | Acción | Descripción Detallada |
| :--- | :--- | :--- |
| `npm run cap:sync` | **Sincronizar** | 1. Compila la aplicación web (`vite build`).<br>2. Copia los archivos compilados a los proyectos nativos.<br>3. Actualiza plugins y configuraciones nativas. |
| `npm run cap:build` | **Construir y Abrir** | Ejecuta el proceso de sincronización completo (`cap:sync`) y abre automáticamente el proyecto en Android Studio (o Xcode si se configura) para compilar el binario final (.apk/.aab). |
| `npm run resources` | **Generar Assets** | Genera automáticamente todos los iconos y pantallas de carga (splash screens) requeridos por iOS, Android y PWA a partir de archivos base. |

## 🎨 Gestión de Recursos Gráficos

El sistema cuenta con una generación automática de assets para evitar el redimensionamiento manual de imágenes.

### Ubicación de Archivos Base
Los archivos fuente se encuentran en: `frontend/resources/`

### Procedimiento de Actualización de Branding
Para cambiar el logo y pantalla de carga de la aplicación:

1.  Prepare sus imágenes definitivas:
    -   **Icono:** Formato PNG, idealmente 1024x1024 px.
    -   **Splash Screen:** Formato PNG, idealmente 2732x2732 px (para cubrir iPads Pro).
2.  Reemplace los archivos existentes en la carpeta `frontend/resources/`:
    -   Sobrescriba `icon.png` con su nuevo icono.
    -   Sobrescriba `splash.png` con su nueva pantalla de carga.
3.  Ejecute la regeneración de recursos:
    ```bash
    npm run resources
    ```
    *El sistema generará todas las variantes necesarias en `android/`, `ios/` y `public/` (para PWA).*

## ⚙️ Configuración Técnica

### Capacitor
- **Archivo de Configuración:** `frontend/capacitor.config.ts`
- **Versión:** Capacitor v8.
- **Identificador de App:** Actualmente configurado como `com.fullstack.app`. **Importante:** Cambie este valor por su identificador de dominio inverso (ej. `com.miempresa.proyecto`) antes de publicar en tiendas.

### PWA (Progressive Web App)
- **Configuración:** `frontend/vite.config.ts` (plugin `VitePWA`).
- **Manifest:** Se genera automáticamente. Para personalizar el nombre y colores de la PWA, edite la sección `manifest` dentro de `vite.config.ts`.
