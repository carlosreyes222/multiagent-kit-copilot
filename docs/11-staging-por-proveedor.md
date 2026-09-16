# 11. Staging por tipo de proyecto (`STAGING_PROVIDER`)

El staging es la prueba real antes de producción, y no es igual para una API, un backend en Supabase o un juego Android. `pipeline.config.ps1` lo declara con `$STAGING_PROVIDER`; el release-manager **no debe improvisar** una infraestructura distinta: si el proveedor no encaja, reporta `STAGING: FALLÓ — CONFIGURACION` y te pide cambiarlo.

| Proveedor | Para qué | Qué hace `kit.ps1 staging` | Variables |
|---|---|---|---|
| `docker` | Un servicio (API, web) empaquetable en una imagen | Build/tests → `Dockerfile.staging` + compose del kit → espera `STAGING_URL+HEALTH_PATH` | `STAGING_PORT`, `BASE_IMAGE`, `CONTAINER_CMD`, `STAGING_ENV_FILE` |
| `compose` | Varios servicios (app + db + seed…) con tu propio compose | Build/tests → `docker compose -f $STAGING_COMPOSE_FILE up -d --build` → espera salud | `STAGING_COMPOSE_FILE`, `STAGING_ENV_FILE`, `STAGING_URL`, `HEALTH_PATH` |
| `supabase` | Backend en Supabase | Build/tests → CLI: link + db push + functions deploy contra el proyecto de staging | ver [10-supabase.md](10-supabase.md) |
| `comando` | Vercel, Fly, Railway, APK a emulador, export de Godot… | Build/tests → `$STAGING_DEPLOY_CMD` → espera salud si hay `STAGING_URL` | `STAGING_DEPLOY_CMD`, `STAGING_URL`, `HEALTH_PATH` |
| `ninguno` | Nada automatizable todavía (app móvil sin export, hardware) | Sale con código 3; el release-manager documenta la verificación manual y termina con `STAGING: MANUAL — …` | — |

En todos los casos, `SMOKE_CMD` es el smoke test **del proyecto**: un script que llame a los endpoints o pantallas de la feature contra `$env:STAGING_URL` y falle con código ≠ 0. Sin él, `kit.ps1 smoke` solo prueba la salud y avisa; el release-manager puede hacer lecturas manuales, pero nunca escribir datos, borrar volúmenes ni generar secretos sin tu confirmación.

## Ejemplos

**API NestJS con Postgres (compose):**
```powershell
$STAGING_PROVIDER = "compose"; $STAGING_COMPOSE_FILE = "staging/docker-compose.staging.yml"
$STAGING_URL = "http://localhost:8088"; $HEALTH_PATH = "/health"; $SMOKE_CMD = "npm run smoke"
```

**Backend Supabase + panel en Vercel:**
```powershell
$STAGING_PROVIDER = "supabase"   # el panel se despliega por git (Vercel preview) y se lista en el informe
```

**App Android (Kotlin) en emulador — provisional hasta el modo móvil del kit:**
```powershell
$STAGING_PROVIDER = "comando"
$STAGING_DEPLOY_CMD = ".\gradlew installDebug"      # con un emulador o dispositivo conectado
$STAGING_URL = ""                                     # sin URL: se considera desplegado si el comando termina en 0
$SMOKE_CMD = "adb shell am start -n com.miapp/.MainActivity"   # o un flujo Maestro
```

**Juego Godot (Android) sin export web:**
```powershell
$STAGING_PROVIDER = "ninguno"    # el release-manager documenta: instalar el .apk exportado en el dispositivo y recorrer la checklist
```

## Errores frecuentes

- **Puerto ocupado**: `kit.ps1 staging` comprueba `STAGING_PORT` antes de levantar Docker y te dice qué cambiar.
- **`docker compose down` falla por variables**: el kit pasa siempre `--env-file $STAGING_ENV_FILE` y comprueba que existe.
- **Secretos dentro de la imagen**: el `.dockerignore` del kit excluye `*.jks`, `*.keystore`, `google-services.json`, `.env*` y similares; si tu proyecto ya tenía uno, `init` añade las líneas que falten.
- **PowerShell 5.1 y stderr**: los scripts usan `Invoke-Native`, que no convierte la salida de error de `docker`/`git` en excepción. Aun así, PowerShell 7 es más fiable: `winget install Microsoft.PowerShell`.

---
Anterior: [10-supabase.md](10-supabase.md) · Siguiente: [12-skills-y-plugins-externos.md](12-skills-y-plugins-externos.md) · [Índice](../README.md)
