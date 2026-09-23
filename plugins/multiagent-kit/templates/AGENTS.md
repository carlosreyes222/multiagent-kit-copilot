# <Nombre de la app>

> Rellena esta plantilla al inicializar el kit. La leen GitHub Copilot (CLI y VS Code) y todos los agentes del kit al arrancar: mantenla en ≤ 40 líneas. Los detalles largos (errores conocidos, procedimientos) van a `docs/TROUBLESHOOTING.md`, enlazado abajo.

## Lectura obligatoria
`docs/ARQUITECTURA.md` es la descripción viva de la app (la mantiene el agente arquitecto al cierre de cada feature). Léelo antes de explorar código. Si no existe, el proyecto aún no ha pasado por el pipeline.

## Qué es esta app
Una o dos frases. React Native **bare** (`@react-native-community/cli`, TypeScript), sin Expo. Versión de RN: `<0.xx>`.

## Stack
- Skill de stack: `stack-react-native` (convenciones, reglas duras y lista de verificación; la aplican todos los agentes).
- Navegación / estado / red / persistencia y versiones fijadas: ver `docs/adr/0000-stack.md`.

## Comandos
Los comandos de instalar / build / test / lint están en `pipeline.config.json`. Úsalos desde ahí (`kit …`); no inventes otros. Repositorios: `<uno solo | lista SUB_REPOS>`. SDKs del equipo: `<ninguno | lista SDKS>`.

## Convenciones que los agentes deben respetar
- Ramas: `feature/<slug>` o `fix/<slug>`, creadas **desde la rama base que se acuerda al iniciar cada pipeline** (`develop`, `release_xx`…). Con ticket de Jira: `feature/TICKET-descripcion-corta` (ticket en MAYÚSCULAS, ej. `feature/BMOSHELL-123-login-biometrico`).
- Commits: `<tipo>: <TICKET> descripción` (`feat: BMOSHELL-123 añade login biométrico`; tipos feat, fix, chore, docs, test, refactor, perf, build, ci, style). Primera línea ≤ 72 caracteres. El hook rechaza lo que no cumpla.
- Entrega: el flujo termina en el **pull request** contra la rama base (`kit pr`). Nunca merge, nunca push a `main`/`develop`/`release_*`, nunca despliegues: eso es del equipo y del tren de release.
- Secretos: solo por variables de entorno. Nunca en código ni en `docs/`. Los agentes no leen `.env*`, keystores ni `google-services.json`.
- Pruebas: Jest + React Native Testing Library; cambios de UI con verificación en emulador Android (Nivel 2) documentada en el informe de QA.
- Estructura relevante: `<src/…>`, `<__tests__/…>` (describe solo lo que no es obvio).

## Sistema operativo
Los comandos del kit son **idénticos** en Windows y macOS: `kit <check|pr|status|state|epica|sdk|update>` (Node ≥ 18). Para lo demás detecta el sistema (`node -p process.platform`): `.\gradlew` / `winget` / `\` en Windows, `./gradlew` / `brew` / `/` en macOS; iOS (`pod install`, Xcode) solo en macOS. Cuando muestres un comando al usuario, en la forma de su sistema.

## Flujo multiagente (kit `multiagent-kit` para Copilot)
- `/pipeline "idea"` — spec → ADR → código → QA → revisiones → **PR** → arquitectura viva. `--rapido` (tamaño S), `--epica` (idea grande en HU), `--sdk <nombre>` (feature que nace en un SDK), `continuar <slug|epica>`.
- `/analisis "alcance o pregunta"` — entender/auditar sin tocar código. `/bugfix "descripción o traza"` — reproducir, corregir y validar (`--solo-diagnostico`, `--urgente`). `/ideas ["dirección"]` — mejoras priorizadas. `/retro-kit` — retrospectiva del kit.
- Orquestador: agente `director` (`@director` en VS Code, `copilot --agent director` en la CLI). Agentes: `product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador`.
- Skills de método (los agentes las aplican siempre): `metodo-spec`, `metodo-adr`, `metodo-code-review`, `metodo-qa`, `metodo-pr`.
- Estado del pipeline: solo con `kit state clave=valor`; nunca editar `.pipeline/state.json` a mano.

## Cosas que suelen romperse
Una línea por gotcha (máx. 8). El detalle va en `docs/TROUBLESHOOTING.md`.
