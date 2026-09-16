# =====================================================================
#  pipeline.config.ps1  —  ÚNICO archivo que debes rellenar por proyecto
# =====================================================================
#  Los scripts del plugin (kit.ps1 staging/smoke/prod/status) y los hooks
#  leen este archivo. Deja una variable en "" si no aplica.
# ---------------------------------------------------------------------

# --- 1. Comandos del proyecto (agnóstico de lenguaje) -----------------
#   Node/TS : "npm ci"  "npm run build"  "npm test"  "npm run lint"
#   .NET    : "dotnet restore"  "dotnet build"  "dotnet test"  ""
#   Godot   : ""  'call "C:\Program Files\Godot\Godot.exe" --headless --path . --import'  "<gdUnit4>"  ""
$INSTALL_CMD = ""
$BUILD_CMD   = ""
$TEST_CMD    = ""
$LINT_CMD    = ""
#   Comando opcional para levantar dependencias de prueba (p. ej. un Postgres efímero).
#   Si está vacío, el tester NO debe levantar infraestructura propia.
$TEST_DB_CMD = ""

# --- 2. Staging: ¿dónde se prueba antes de producción? ----------------
#   docker   : el kit construye staging/Dockerfile.staging y levanta staging/docker-compose.staging.yml (un servicio).
#   compose  : el proyecto tiene su propio compose (varios servicios, db, seed…); el kit solo hace up/down.
#   supabase : backend en Supabase; staging = proyecto Supabase separado; despliegue con la CLI (db push + functions deploy).
#   comando  : cualquier otro (Vercel, Fly, APK a emulador…); el kit ejecuta $STAGING_DEPLOY_CMD y comprueba $STAGING_URL.
#   ninguno  : no hay staging automatizable (p. ej. app móvil sin export); el release-manager documenta verificación manual.
$STAGING_PROVIDER = "docker"

#   Común a todos los proveedores:
$APP_NAME     = "mi-app"
$STAGING_URL  = "http://localhost:8080"      # base que debe responder; en supabase: https://<ref-staging>.supabase.co
$HEALTH_PATH  = "/health"                    # relativo a STAGING_URL; en supabase p. ej. "/functions/v1/config"
$SMOKE_CMD    = ""                           # opcional: comando propio de smoke tests (falla ≠ 0). Ej: "npm run smoke"
$STAGING_ENV_FILE = "staging/.env.staging"   # variables para docker/compose; debe existir antes de up/down

#   Solo docker:
$STAGING_PORT  = 8080
$BASE_IMAGE    = "alpine:3.20"
$CONTAINER_CMD = "sh -c 'echo listo && sleep infinity'"

#   Solo compose:
$STAGING_COMPOSE_FILE = "staging/docker-compose.staging.yml"

#   Solo supabase (ver docs/10-supabase.md):
$SUPABASE_STAGING_REF = ""                   # ref del proyecto de STAGING (Settings → General → Reference ID)
$SUPABASE_PROD_REF    = ""                   # ref del proyecto de PRODUCCIÓN
$SUPABASE_DIR         = "."                  # carpeta que contiene supabase/ (p. ej. "oanig-backend")
$SUPABASE_FUNCTIONS   = @()                  # @() = todas las de supabase/functions; o @("apertura","config")
$SUPABASE_NO_VERIFY_JWT = $true              # las funciones se despliegan con --no-verify-jwt (como en el panel)

#   Solo comando:
$STAGING_DEPLOY_CMD = ""                     # ej: "vercel deploy --prebuilt" · "gradle installDebug" · "specific.ps1"

# --- 3. Producción ----------------------------------------------------
#   Se ejecuta SOLO desde kit.ps1 prod, SOLO si staging + smoke + seguridad APROBADO, y SOLO por una persona.
#   Con STAGING_PROVIDER = supabase y PROD_DEPLOY_CMD vacío, el kit hace db push + functions deploy contra SUPABASE_PROD_REF.
$PROD_DEPLOY_CMD = ""

# --- 4. Repositorios y ramas ------------------------------------------
#   Sub-repositorios con su propio .git dentro del proyecto (el implementador hace commit en cada uno;
#   el release-manager los lista en el informe). Ej: @("oanig-backend")
$SUB_REPOS = @()
$PROTECTED_BRANCHES = @("main", "master", "produccion", "release")

# --- 5. Compuertas ----------------------------------------------------
$GATE_TESTS_ON_COMMIT = $true
#   Límites de tamaño de documentos (líneas). Los agentes deben respetarlos; kit.ps1 status avisa si se superan.
$MAX_LINES_ARQUITECTURA = 300
$MAX_LINES_INFORME      = 100
$MAX_LINES_ADR          = 150
