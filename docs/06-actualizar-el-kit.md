# 6. Actualizar el kit

## 6.1 Qué vive dónde

| En el plugin (se actualiza con `copilot plugin update`) | En tu perfil (lo refresca `kit update`) | En el proyecto |
|---|---|---|
| `com.github.copilot/agents/*.agent.md`, `skills/*/SKILL.md`, `scripts/*.js`, `templates/` | `~/.copilot/agents`, `~/.copilot/skills`, `~/.copilot/hooks/bkit.json`, lanzador de hooks; prompts, agentes y `kit.instructions.md` en `User/prompts` de VS Code; comando `kit` en `~/.multiagent-kit/bin` | `pipeline.config.json`, `AGENTS.md`, `.pipeline/` (fuera de git) y los documentos que producen los agentes (versionados) |

## 6.2 Publicar una versión nueva (tú, en el repositorio del kit)

1. Haz los cambios en `plugins/bkit/`.
2. Ejecuta las pruebas en la raíz del repositorio del kit: `npm test` (Node ≥ 18; no instala nada). Cubren los hooks (unos 150 comandos de sh, cmd y PowerShell que deben bloquearse o permitirse, en el formato de VS Code y de la CLI), la compuerta de commit, el estado con escrituras simultáneas, `kit pr` contra un origin local y la resolución del plugin con los dos kits instalados. Si cambias una regla del hook, añade su caso a `test/hook-protect.test.js`. GitHub Actions (`.github/workflows/test.yml`) las repite en Windows, macOS y Linux en cada push y PR.
3. Sube la versión en **dos** sitios, con la misma cifra (p. ej. `2.1.0`):
   - `plugins/bkit/plugin.json` → `"version"`
   - `marketplace.json` (raíz del repositorio) → `"version"` de la entrada del plugin y de `metadata`
4. Anota el cambio en `CHANGELOG.md` e indica si hace falta `kit update` en los proyectos.
5. `git add . ; git commit -m "bkit 3.0.1" ; git push`

`test/` y `package.json` son del repositorio del kit, no del plugin: no se instalan en ningún proyecto. Para comparar el comportamiento con otra copia del plugin (p. ej. la versión publicada): `KIT_TEST_PLUGIN=<ruta>/plugins/multiagent-kit npm test`.

## 6.3 Recibir una versión nueva

En cada PC:

```powershell
copilot plugin marketplace update bkit
copilot plugin update bkit
```

o dentro de `copilot`: `/plugin` marca los plugins con versión nueva y ofrece **Update**. Para que se actualice solo al iniciar sesión, añade `"autoUpdate": true` a la entrada `bkit` de `extraKnownMarketplaces` en `~/.copilot/settings.json` (solo se honra en la configuración de usuario, no en la del repositorio).

En cada proyecto:

```powershell
kit update
```

No hay nada que commitear: el kit no deja archivos en el repositorio. En VS Code, recarga la ventana (*Developer: Reload Window*) para que lea los agentes y prompts nuevos. `update` refresca los archivos del perfil (`~/.copilot/…` y prompts de VS Code) y sobrescribe uno **solo si no lo has modificado** desde la última copia (hashes en `~/.copilot/multiagent-kit-manifest.json`). Si lo tocaste, deja la versión nueva al lado como `.kit` y te lo dice. Al abrir `copilot`, el hook de inicio avisa cuando los archivos del proyecto son de una versión anterior al plugin; `kit version` lo muestra también.

## 6.4 Personalizar sin perder las actualizaciones

- Para cambiar un agente o una skill **para ti**, no edites el archivo gestionado: crea otro al lado con otro nombre (`~/.copilot/agents/arquitecto-mobile.agent.md`, `~/.copilot/skills/mi-metodo/SKILL.md`) y menciónalo en el `AGENTS.md` del proyecto. Si aun así editas uno gestionado, `update` lo respeta y te deja el `.kit`.
- Para cambiar algo **para todos los proyectos**, edítalo en el plugin y publica versión.

## 6.5 Probar un cambio antes de publicarlo

Registra el marketplace desde la carpeta local: los plugins con origen local se cargan en vivo y cada cambio se ve al reiniciar la sesión (`/restart`), sin `plugin update`:

```powershell
copilot plugin marketplace add C:\Users\carr9\Documents\multiagent-kit-copilot
copilot plugin install bkit@bkit
```

En un proyecto de prueba, la variable de entorno `KIT_PLUGIN_ROOT` con la ruta `…\multiagent-kit-copilot\plugins\bkit` hace que `kit` y los hooks usen esa copia directamente (`$env:KIT_PLUGIN_ROOT="…"` en PowerShell, `export KIT_PLUGIN_ROOT=…` en macOS). Al terminar, `copilot plugin marketplace remove carlos-kits-copilot --force` y vuelve a añadir el de GitHub.

## 6.6 Aviso automático de versión nueva

Cada sesión, el hook de inicio compara la versión instalada con la de GitHub (una petición al día, caché en `~/.multiagent-kit/`) y avisa si hay una nueva. `kit update` hace la misma comprobación y te dice el comando para actualizar el plugin (`kit update --plugin` lo ejecuta por ti); después vuelve a ejecutar `kit update` para refrescar los archivos del proyecto. 

Recuerda que **hacer push del kit no cambia nada en los PCs**: cada uno tiene su copia instalada hasta que actualiza el plugin. `kit doctor` te lo señala.

## 6.7 `kit doctor`

Cuando algo no cuadra, antes de investigar a mano: `kit doctor` revisa plugin (versión frente a GitHub), Node, archivos del proyecto (versión, modo, `kit.js`, `.git/info/exclude`, restos de versiones antiguas), hooks (lanza un `git push origin main` de prueba y espera que lo bloquee), permisos, copias `.kit`, locks de git colgados y las entradas de `SDKS`. Cada problema trae su arreglo; `kit doctor --fix` aplica los seguros (permisos que faltan, `kit.js` desactualizado, `.kit` idénticos, locks de más de 10 minutos).

---
Anterior: [05-arquitectura-viva.md](05-arquitectura-viva.md) · Siguiente: [07-problemas-frecuentes.md](07-problemas-frecuentes.md) · [Índice](../README.md)
