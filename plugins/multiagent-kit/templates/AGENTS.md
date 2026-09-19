# <Nombre del proyecto>

> Rellena esta plantilla al inicializar el kit. La leen GitHub Copilot (CLI, VS Code y cloud agent) y todos los agentes del kit al arrancar: mantenla en ≤ 40 líneas. Los detalles largos (errores conocidos, procedimientos) van a `docs/TROUBLESHOOTING.md`, enlazado abajo.

## Lectura obligatoria
`docs/ARQUITECTURA.md` es la descripción viva del sistema (la mantiene el agente arquitecto al cierre de cada feature). Léelo antes de explorar código. Si no existe, el proyecto aún no ha pasado por el pipeline.

## Qué es este proyecto
Una o dos frases. Lenguaje y framework principal.

## Stack y skills aplicables
- Skills de stack: `<stack-android | stack-react-native | stack-nestjs | stack-ktor | stack-db>` (borra las que no apliquen; el arquitecto las fija en el ADR de stack). Están en `.github/skills/`.
- Versiones fijadas: ver `docs/adr/0000-stack.md`

## Comandos
Los comandos de instalar / build / test / lint y el proveedor de staging (`STAGING_PROVIDER`) están en `pipeline.config.json`. Úsalos desde ahí (`node kit.js …`); no inventes otros. Repositorios: `<uno solo | lista SUB_REPOS>`.

## Convenciones que los agentes deben respetar
- Ramas: `feature/<slug>` para todo cambio; con ticket de Jira, `feature/TICKET-descripcion-corta` (ticket en MAYÚSCULAS, ej. `feature/BMOSHELL-123-login-biometrico`) y commits `feat: BMOSHELL-123 descripción`. `main` está protegida por hooks (no commit, no push, no merge sin seguridad APROBADO) y por las reglas del repositorio en GitHub.
- Commits: mensajes en español, imperativo, máx. 72 caracteres en la primera línea.
- Secretos: solo por variables de entorno. Nunca en código ni en `docs/`. Los agentes no leen `.env*` ni keystores.
- Pruebas: framework `<jest | junit | pytest | …>`. Toda feature nueva lleva pruebas.
- Estructura relevante: `<src/…>`, `<tests/…>` (describe solo lo que no es obvio).

## Sistema operativo
Los comandos del kit son **idénticos** en Windows, macOS y Linux: `node kit.js <check|staging|smoke|status|state|init|update>` (Node ≥ 18, que ya exige la propia herramienta). Solo cambia lo del proyecto: detecta el sistema por la ruta (`C:\…` es Windows; `/Users/…` macOS; `/home/…` Linux) o con `node -p process.platform`, y usa `.\gradlew` / `winget` / `\` en Windows y `./gradlew` / `brew` / `/` en macOS/Linux. iOS solo en macOS. Escribe los comandos de `pipeline.config.json` para el sistema donde corre el proyecto (o usa `npm run …` / Gradle, que valen en todos), y cuando muestres un comando al usuario, en la forma de su sistema.

## Flujo multiagente (kit `multiagent-kit` para Copilot)
- `/pipeline "idea"` — flujo completo (spec → ADR → código → QA → revisiones → staging → arquitectura). En un proyecto vacío propone el stack y crea el esqueleto.
- `/analisis "alcance o pregunta"` — entender/auditar sin tocar código.
- `/bugfix "descripción o traza"` — reproducir, corregir y validar un bug (`--solo-diagnostico`, `--urgente`).
- `/ideas ["dirección"]` — que el equipo proponga mejoras y nuevas ideas priorizadas (`--producto`, `--mercado`, `--tecnico`).
- `/deploy-staging` — solo desplegar la rama actual a staging. `/promote-prod` — ver compuertas; la promoción real la hace una persona con `node kit.js prod`.
- Orquestador: agente `director` (`@director` en VS Code, `copilot --agent director` en la CLI). Agentes: `product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador` (en `.github/agents/`).
- Skills de método (los agentes las aplican siempre): `metodo-spec`, `metodo-adr`, `metodo-code-review`, `metodo-qa`, `metodo-deploy`.
- Estado del pipeline: solo con `node kit.js state clave=valor`; nunca editar `.pipeline/state.json` a mano.

## Cosas que suelen romperse
Una línea por gotcha (máx. 8). El detalle va en `docs/TROUBLESHOOTING.md`.
