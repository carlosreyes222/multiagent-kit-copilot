---
name: metodo-pr
description: Método de entrega por pull request — qué debe cumplir una rama antes de subirse, cómo se escribe la descripción del PR, qué pasa cuando el push o el PR fallan, y qué queda en manos del equipo (revisión, merge, tren de release). Lo usa el release-manager al cierre del pipeline y del bugfix.
---

Aplica este método al cerrar una feature o un bugfix. Regla de oro: **el kit termina en el PR**; el merge y el release son del equipo y de sus reglas en GitHub.

## 1. Antes de subir la rama
- Rama `feature/<slug>` o `fix/<slug>` creada desde la rama base acordada (`develop`, `release_xx`, `main`… la que el usuario indicó al iniciar). Con ticket de Jira: `feature/TICKET-descripcion-corta`.
- Commits pequeños, con la nomenclatura del equipo (`feat: TICKET descripción`, `fix: …`, `test: …`, `chore: …`), sin secretos, sin archivos generados (`node_modules`, `android/build`, `ios/Pods`, `.gradle`), sin cambios ajenos a la feature (formateos masivos, renombrados oportunistas).
- Informes aprobados: `docs/reviews/<slug>-qa.md` (`QA: APROBADO`), `<slug>-codigo.md` (`CODIGO: APROBADO`, salvo modo rápido) y `<slug>-seguridad.md` (`VEREDICTO: APROBADO`). Spec, ADR e informes son **documentos de trabajo fuera de git** (`.git/info/exclude`): no se commitean. Lo único de `docs/` que va en el repo es `docs/ARQUITECTURA.md` (y su detalle en `docs/detalle/`).
- Cada informe con un **único** veredicto y con `COMMIT: <sha>` del código que se revisó; después de ese commit solo puede haber cambios en `docs/`. Si el implementador corrigió algo tras una revisión, esa revisión se repite.
- Lint y tests pasan en la rama (la compuerta de commit ya lo exige en cada commit; `kit pr` vuelve a exigir rama limpia).
- Nivel 2 para cambios de UI en React Native: evidencia en el informe de QA de que la app arranca y la pantalla afectada funciona en emulador Android (y simulador iOS si hay Mac); si no se pudo, decirlo explícitamente en el PR.

## 2. Descripción del PR (`docs/reviews/<slug>-pr.md`, la genera `kit pr`)
Título `<tipo>: <TICKET> <título de la spec>`. Cuerpo: ticket, rama → base, compuertas con su veredicto y el commit revisado, criterios de aceptación (de la spec), decisión técnica (sección *Decisión* del ADR), observaciones de seguridad, lista de commits y cómo probar (sección *Cómo probar* del informe de QA). Como los documentos no están en el repo, el PR lleva **resúmenes**, no enlaces; nada de pegar diffs ni informes enteros. Para que el resumen salga bien, respeta esos títulos de sección en spec, ADR e informes.

## 3. Cuando algo falla
| Situación | Qué hace el kit | Qué hace la persona |
|---|---|---|
| `gh` no instalado o sin sesión | Sube la rama; `PR: RAMA SUBIDA` | Abre el PR en GitHub pegando la descripción |
| Push rechazado (sin permisos, sin remoto, rama remota con commits nuevos) | Nada más; `PR: RAMA LOCAL (motivo)` | Resuelve (permisos, `git pull --rebase` si procede) y vuelve a lanzar `kit pr` |
| Ya existe un PR **abierto** para la rama | Lo reutiliza (los cerrados o fusionados no cuentan); `PR: CREADO <url>` | Nada |
| Compuertas sin aprobar o código sin commitear | `PR BLOQUEADO` con la lista (código 1) | Vuelve a la etapa que falta |
| Código cambiado después del `COMMIT:` de un informe, o veredictos contradictorios | `PR BLOQUEADO` | Repetir QA o la revisión afectada |
| La base no existe (ni en origin ni en local) | `PR BLOQUEADO` sin hacer push | Corregir el nombre: `kit state pr_base=<rama>` |
| La rama va por detrás de la base o habrá conflictos | Aviso (no bloquea) | Integrar la base (`git merge origin/<base>`) y repetir las pruebas |

Códigos de salida de `kit pr`: 0 = PR creado (o `--sin-push`), 2 = entrega parcial (`RAMA SUBIDA`/`RAMA LOCAL`, con motivo), 1 = bloqueado.
Nunca `--force`, nunca cambiar la base para "que pase", nunca abrir el PR contra `main` si la base acordada era otra.

## 4. Después del PR (fuera del kit)
Revisión por el equipo, CI del repositorio, merge según las reglas de GitHub y tren de release. Si la revisión pide cambios, se retoma con `/pipeline continuar <slug>` desde la Etapa 3: el implementador añade commits a la misma rama y el PR se actualiza solo (si la feature ya se cerró, `kit state restaurar <slug>` devuelve sus documentos al proyecto).

## 5. Cierre de la feature
`kit state reset` cierra la feature: archiva spec, ADR, informes y la descripción del PR en `~/.multiagent-kit/archivo/<proyecto>/<slug>/` (fuera del repo, consultable con `kit archivo`) y, si su épica quedó completa, también la épica. Así el proyecto solo conserva lo vivo.

## 6. Prohibido
`git push --force`, `git merge` a ramas protegidas, `gh pr merge`, editar `.pipeline/state.json`, abrir el PR con informes RECHAZADOS, commitear specs/ADR/informes, editar un informe para cambiar su `COMMIT:` o su veredicto sin repetir la revisión, ejecutar despliegues de ningún tipo.
