# 10. Backends en Supabase: staging y producción sin navegador

Si tu backend vive en Supabase (migraciones SQL + Edge Functions), el staging en Docker del kit no sirve y desplegar desde el SQL Editor o el panel en el navegador deja el despliegue fuera de git y sin repetibilidad. El kit lo hace con la **CLI de Supabase** contra dos proyectos: uno de staging y uno de producción.

## 10.1 Recomendación: dos proyectos Supabase

| Opción | Cuándo | Contras |
|---|---|---|
| **Dos proyectos (staging + prod)** — recomendada | Siempre que puedas tener dos proyectos en tu organización (el plan gratuito permite dos activos) | Hay que crear el segundo y copiar la configuración de Auth/Storage una vez |
| Supabase local (`supabase start`) | Quieres staging sin nube; tienes Docker Desktop con recursos de sobra | Pesado (varios contenedores); Auth/Storage/Edge se comportan casi igual, no igual |
| Branching de Supabase | Plan que lo soporte y quieres una rama por feature | Coste; más piezas móviles |

Con dos proyectos, lo que pasa por el pipeline se prueba en staging con datos de prueba, y `.\kit.ps1 prod` repite exactamente los mismos comandos contra producción. Nunca se toca producción desde el navegador.

## 10.2 Configurar una vez

1. Instala la CLI: `winget install Supabase.cli` (o `scoop install supabase`) y `supabase login`.
2. Crea el proyecto de staging en el panel (nombre `<app>-staging`). Anota el **Reference ID** de ambos proyectos (Settings → General).
3. En `pipeline.config.ps1`:

```powershell
$STAGING_PROVIDER     = "supabase"
$SUPABASE_DIR         = "oanig-backend"      # carpeta que contiene supabase/ (o "." si está en la raíz)
$SUPABASE_STAGING_REF = "abcdefghijklmnop"
$SUPABASE_PROD_REF    = "qrstuvwxyzabcdef"
$SUPABASE_FUNCTIONS   = @()                  # todas las de supabase/functions, o una lista
$SUPABASE_NO_VERIFY_JWT = $true              # igual que "Verify JWT" apagado en el panel
$STAGING_URL  = "https://abcdefghijklmnop.supabase.co"
$HEALTH_PATH  = "/functions/v1/config"       # una función pública que responda 200
$SMOKE_CMD    = "node scripts/smoke.mjs"     # opcional: llama a las funciones de la feature contra $env:STAGING_URL
$SUB_REPOS    = @("oanig-backend")           # si el backend es un git aparte
```

4. Si tus migraciones históricas se aplicaron a mano en el SQL Editor y `supabase/migrations/` no está sincronizado, haz una sola vez en cada proyecto: `supabase link --project-ref <ref>` y `supabase migration repair --status applied <versiones…>` (o `supabase db pull` para generar la migración base). A partir de ahí, toda migración nueva es un archivo en `supabase/migrations/` y se aplica con el kit.

## 10.3 Qué hace el kit

- `.\kit.ps1 staging -Feature <slug>`: build y tests del proyecto → `supabase link` al ref de staging → `supabase db push` → `supabase functions deploy <fn> --no-verify-jwt` por cada función → comprueba `STAGING_URL + HEALTH_PATH`.
- `.\kit.ps1 smoke`: salud + `SMOKE_CMD` si lo definiste.
- `.\kit.ps1 prod`: las mismas compuertas de siempre (staging OK, smoke OK, `VEREDICTO: APROBADO`, escribir `PRODUCCION`) y después los mismos comandos contra `SUPABASE_PROD_REF`. Se niega si staging y prod tienen el mismo ref.

Lo que **no** automatiza (y el informe de release debe listar como comprobación manual): ajustes de Auth (p. ej. "Allow new users to sign up"), buckets de Storage, secretos de funciones (`supabase secrets set`), y el panel en Vercel u otro hosting (usa `STAGING_DEPLOY_CMD`/`PROD_DEPLOY_CMD` o el despliegue por git de Vercel).

## 10.4 Reglas para los agentes (ya incluidas en `stack-db` y `metodo-deploy`)

- Nunca desplegar migraciones ni funciones desde el navegador ni por automatización del navegador; siempre CLI desde el repositorio.
- RLS en todas las tablas expuestas; `service_role` nunca en el cliente; políticas con `(select auth.uid())`.
- Migraciones reversibles y probadas en staging antes de producción; las destructivas en dos pasos.

---
Anterior: [09-cloud-agent-y-github.md](09-cloud-agent-y-github.md) · Siguiente: [11-staging-por-proveedor.md](11-staging-por-proveedor.md) · [Índice](../README.md)
