# 9. Cloud agent y GitHub

Aquí es donde el kit encaja con el flujo de un equipo (tren de release, Jira, PRs): el cloud agent de Copilot ejecuta el trabajo en la nube a partir de un issue y entrega un pull request; las compuertas del kit se aplican dentro de esa sesión, y las reglas del repositorio garantizan lo que ningún agente puede saltarse.

## 9.1 Preparar el repositorio

1. Ejecuta `/kit-init` y haz commit de `.github/`, `kit.js`, `AGENTS.md` y `pipeline.config.json`.
2. Revisa `.github/workflows/copilot-setup-steps.yml`: el job **debe** llamarse `copilot-setup-steps`. Añade la instalación de dependencias de tu stack (JDK/Android, .NET…). Node viene preinstalado en `ubuntu-latest`, así que `kit.js` y los hooks del kit funcionan.
3. `.github/copilot/settings.json` (lo copia `init`) habilita el plugin para el cloud agent; aun sin él, agentes y skills ya están en `.github/`.
4. Activa Copilot cloud agent en el repositorio (Settings → Copilot → Coding agent) y, si tu organización lo requiere, la política correspondiente. El firewall del sandbox solo deja salir a GitHub por defecto; si `INSTALL_CMD` necesita otros registros, el administrador debe permitirlos.

## 9.2 Asignar trabajo a Copilot

- **Desde un issue**: escribe la historia de usuario en el issue (o pega la spec) y asígnalo a **Copilot**. Para que use el kit, la primera línea del issue puede ser el comando: `pipeline: <idea>` o `bugfix: <traza>`, y en el cuerpo "Usa el agente director". Copilot crea la rama, trabaja y abre un PR borrador con el resumen.
- **Eligiendo agente**: al asignar, puedes seleccionar un agente personalizado del repositorio (`director`, `implementador`…). También desde VS Code (*Delegate to cloud agent*) o desde la CLI con `/delegate`.
- **Desde Jira**: la integración Jira → cloud agent (vista previa) permite asignar tickets a Copilot; si no está disponible, crea el issue en GitHub con la key de Jira en el título (`features/KEY_DESCRIPCION` como rama).

En la nube no hay compuertas humanas interactivas: el `director` deja la spec en `docs/specs/`, el ADR y los informes en el PR, y **tú apruebas en la revisión del PR** lo que en local aprobarías en el chat. Si algo requería tu decisión (elección de stack), el agente lo deja como pregunta en el PR y se detiene.

## 9.3 Lo que garantiza GitHub (no depende de los agentes)

- **Rulesets / branch protection en `main` y `release_*`**: PR obligatorio, revisiones requeridas, status checks en verde, sin push directo. Es la barrera que el hook `protect-main` reproduce en local, pero aquí la impone GitHub.
- **Copilot code review automático**: en el ruleset activa *Request pull request review from Copilot* para que cada PR reciba una revisión automática además de la del `revisor-codigo` del kit.
- **GitHub Actions**: tus workflows de tests, análisis estático (Checkmarx, Sonar…) y build siguen siendo los status checks. El kit no los sustituye: `commit-gate` es la versión local y rápida.
- **Secretos**: el cloud agent no tiene `GITHUB_TOKEN`; usa *Copilot environment secrets* si `INSTALL_CMD` necesita alguno. Los agentes del kit tienen prohibido leer `.env*`.

## 9.4 Agentes a nivel de organización (opcional)

Para que todos los repositorios de la organización vean los agentes sin copiarlos, publica los `*.agent.md` en la carpeta `agents/` del repositorio `.github` (o `.github-private`) de la organización. Los agentes del repositorio (`.github/agents/`) tienen prioridad sobre los de la organización si coinciden en nombre. Las skills y los hooks, en cambio, se leen solo del repositorio del proyecto (o de un plugin), por eso `node kit.js init` sigue siendo necesario.

## 9.5 Flujo sugerido para un tren de release

1. HU en Jira → issue en GitHub con `pipeline: <HU>` → asignar a Copilot (o `/pipeline` en local si prefieres seguirlo en vivo).
2. Copilot abre el PR con spec, ADR, código, pruebas e informes de QA, código y seguridad.
3. Copilot code review + revisión de los seniors solo sobre lo que los informes marcan como riesgo.
4. Actions en verde → merge al tren → `node kit.js staging` (o el pipeline de despliegue del equipo) → QA manual → `node kit.js prod` por una persona.

---
Anterior: [08-superficies-copilot.md](08-superficies-copilot.md) · Siguiente: [10-supabase.md](10-supabase.md) · [Índice](../README.md)
