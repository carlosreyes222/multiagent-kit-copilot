# 14. SDKs del equipo y flujo end-to-end

Muchos proyectos consumen librerías propias del equipo: un paquete npm `@org/core-sdk`, una librería Android publicada en Maven, un pod iOS. El kit puede **leer ese código** como contexto y, cuando una feature nace en el SDK, llevarla de extremo a extremo: implementar en el SDK, generar una **versión de trabajo local** y dejarla integrada en el proyecto padre, sin publicar nada en registros remotos ni hacer push por ti.

## 14.1 Declarar los SDKs

En `pipeline.config.json` del proyecto padre:

```json
"SDKS": [
  { "nombre": "core",  "tipo": "npm",     "paquete": "@bcp/core-sdk",
    "ruta": "../core-sdk", "repo": "https://github.com/bcp/core-sdk.git", "rama": "main",
    "build": "pnpm build", "test": "pnpm test" },
  { "nombre": "pagos", "tipo": "android", "paquete": "com.bcp.sdk:pagos",
    "repo": "https://github.com/bcp/pagos-android.git", "rama": "develop" },
  { "nombre": "auth",  "tipo": "ios",     "paquete": "BCPAuth", "ruta": "../auth-ios", "destino": "ios/Podfile" }
]
```

| Campo | Obligatorio | Significado |
|---|---|---|
| `nombre` | sí | Identificador corto; es el que usas en `--sdk <nombre>` y en `node kit.js sdk …` |
| `tipo` | sí | `npm`, `android`, `ios` o `comando` (tú das los comandos) |
| `paquete` | npm/android/ios | npm: nombre del paquete · android: `grupo:artefacto` · ios: nombre del pod o del paquete Swift |
| `ruta` | una de las dos | Carpeta local del SDK, relativa al proyecto (p. ej. `../core-sdk`). Si existe, se usa tal cual |
| `repo` | una de las dos | URL git. Si no hay `ruta` (o no existe), se clona en `.pipeline/sdks/<nombre>` (fuera de git) |
| `rama` | no | Rama a usar (`main` por defecto). Se puede cambiar puntualmente con `node kit.js sdk sync <nombre> --rama x` |
| `build`, `test`, `lint` | no | Comandos que se ejecutan **dentro del SDK**. `build` antes de empaquetar; `test`/`lint` los usa la compuerta de commit cuando el agente hace commit en el SDK |
| `publicar`, `enlazar` | tipo `comando` | `publicar` corre en el SDK (recibe `SDK_VERSION`, `SDK_DIR`, `PROJECT_DIR`); `enlazar` corre en el padre. En npm/android/ios `publicar` sustituye el paso por defecto |
| `destino` | no | `package.json` o `Podfile` concreto del padre si no es el de la raíz (en monorepos el kit busca hasta 3 niveles) |
| `modulo` | android | Carpeta del módulo de la librería si la versión no está en `gradle.properties` ni en la raíz (por defecto `lib`) |

`node kit.js check` valida las entradas.

## 14.2 Comandos

| Comando | Qué hace |
|---|---|
| `node kit.js sdk list` | SDKs declarados, origen y estado |
| `node kit.js sdk sync [nombre] [--rama x]` | Localiza la carpeta o clona/actualiza el repo en la rama declarada (`fetch` + `pull --ff-only`; si el clon tiene cambios sin commit no toca nada). Sin nombre: todos |
| `node kit.js sdk pack <nombre> [--feature slug]` | Versión de trabajo + publicar en local + actualizar la dependencia del padre (ver abajo) |
| `node kit.js sdk api <nombre> [--base]` | Breaking changes de la API pública frente a la rama base (§14.4) |
| `node kit.js sdk publish <nombre> --version X.Y.Z` | Versión definitiva y enlace del padre a la versión publicada; paso humano (§14.5) |
| `node kit.js sdk status` | Qué versión de trabajo está enlazada en el padre |

Lo que hace `pack` según el tipo:

| Tipo | Publicar en local | Enlazar en el padre |
|---|---|---|
| `npm` | Sube la versión del SDK a `X.Y.Z-local.N` **solo en memoria** (el `package.json` del SDK se restaura), ejecuta `build`, `npm pack` → `vendor/sdks/<paquete>-X.Y.Z-local.N.tgz` (se versiona; si tu `.gitignore` ignora `*.tgz` el kit añade la excepción) | `"@org/x": "file:vendor/sdks/…tgz"` en el `package.json` que lo declare y `npm/pnpm/yarn install` según el lockfile. Borra los tgz `-local` anteriores del mismo paquete |
| `android` | `gradlew publishToMavenLocal` con la versión `X.Y.Z-local.N` fijada temporalmente en `gradle.properties` (`VERSION_NAME`/`version`) o `build.gradle(.kts)`; queda en `~/.m2` | Actualiza la versión en `gradle/libs.versions.toml` (por `version.ref` o inline) o en cualquier `build.gradle(.kts)` con la coordenada literal; añade `mavenLocal()` al primer bloque `repositories {}` de `settings.gradle(.kts)` si falta |
| `ios` | Nada que publicar: se enlaza por ruta | `pod 'Nombre', :path => '<ruta>'` en el Podfile (y `pod install` en macOS si CocoaPods está instalado) o `.package(path: …)` en `Package.swift` |
| `comando` | Tu `publicar` | Tu `enlazar` |

El número `N` sube en cada `pack` (se guarda en `.pipeline/sdks.json`). La versión real del SDK no se toca: **publicar la versión definitiva y sustituir la dependencia `-local.N` es un paso humano**, y el kit te lo recuerda al final.

## 14.3 Flujo end-to-end: `/pipeline --sdk <nombre> "idea"`

```
/pipeline --sdk core "El SDK debe exponer refreshToken() y la app usarlo al recibir 401"
```

1. **Sync**: el orquestador ejecuta `node kit.js sdk sync core` y anota `sdk=core` en el estado.
2. **Spec** (compuerta humana): separa lo que cambia en el SDK de lo que cambia en el padre.
3. **Arquitectura**: el arquitecto lee ambos códigos; el ADR trae dos planes (SDK y padre).
4. **Implementación**, en orden: rama `feature/<slug>` en el SDK con código y pruebas, commits **sin push** → `node kit.js sdk pack core --feature <slug>` → rama `feature/<slug>` en el padre con la integración, commits (incluidos `package.json`, lockfile y `vendor/sdks/*.tgz`, o `libs.versions.toml`, o `Podfile`).
5. **QA y revisiones**: el tester corre las pruebas del SDK (`test` de la entrada o las del propio SDK) y las del padre; los revisores revisan los dos diffs, con especial atención a la API pública nueva.
6. **Staging** y **arquitectura viva** como siempre (`docs/ARQUITECTURA.md` registra qué SDKs consume el proyecto y con qué versión).
7. **Entrega**: rama y commits del SDK, versión de trabajo enlazada, resultado de `sdk api`, y lo que queda para ti: `node kit.js sdk publish <nombre> --version X.Y.Z` (§14.5), que fija la versión, enlaza el padre y te dice qué publicar.

Los hooks aplican también dentro del SDK: no se puede hacer commit ni push en `main`/`master` del SDK, y la compuerta de commit usa `test`/`lint` de su entrada (si no los declaras, se omite con aviso). Nada del kit publica en npm, Maven remoto ni hace `git push`.

Sin `--sdk`, los SDKs declarados sirven igualmente como **contexto de solo lectura**: el arquitecto los consulta para no reimplementar en el padre lo que el SDK ya ofrece. Si solo quieres usar en el padre una versión nueva del SDK que ya está en `main`: `node kit.js sdk sync core` y `node kit.js sdk pack core`, y sigues con `/pipeline` normal.

## 14.4 Breaking changes: `node kit.js sdk api <nombre>`

`sdk sync` guarda una instantánea de la API pública del SDK cuando está en su rama base (`.pipeline/sdks/api/<nombre>.json`): en npm, los `export` de los `.d.ts` (`types` del `package.json`, `dist/` o `lib/`; si no hay build, `src/index.ts`) y los miembros públicos de clases e interfaces exportadas; en Android, los archivos `api/*.api` de *binary-compatibility-validator* si el SDK los tiene (exacto) o, si no, las declaraciones públicas de `src/main` (aproximado); en iOS, las declaraciones `public`/`open` de Swift. `node kit.js sdk api <nombre>` compara la API actual con la base: lista los símbolos nuevos y los **eliminados o renombrados**; si hay eliminados y la versión no sube la major, termina con error. `sdk pack` avisa de lo mismo, el revisor de código lo trata como BLOQUEANTE y `sdk publish` se niega salvo con major nueva o `--forzar`. `sdk api <nombre> --base` vuelve a guardar la base desde la rama actual.

## 14.5 Versión definitiva: `node kit.js sdk publish <nombre> --version X.Y.Z`

Es el paso humano que cierra el ciclo (los agentes lo tienen bloqueado, como `prod`). Comprueba los breaking changes, fija la versión definitiva en el SDK (`package.json`, `gradle.properties`/`build.gradle`, `.podspec`) y hace commit en la rama actual del SDK (`--sin-commit` para no hacerlo), cambia la dependencia del padre a la versión publicada (npm: `^X.Y.Z`, o exacta con `--exacta`, y borra el tgz de `vendor/sdks/`; Android: versión en `libs.versions.toml`/gradle; iOS: `pod 'X', '~> X.Y.Z'`) y te deja los tres pasos que quedan: push + PR + publicar en el SDK, `install`/sync + commit en el padre, y `sdk sync` para actualizar la API base.

## 14.6 Dónde queda cada cosa

| | Dónde | ¿Va a git? |
|---|---|---|
| Clon del SDK (cuando no hay `ruta`) | `.pipeline/sdks/<nombre>` | No (`.pipeline/` está excluido) |
| Registro de sincronización y versiones | `.pipeline/sdks.json` | No |
| tgz de npm | `vendor/sdks/*.tgz` | **Sí**, para que el equipo y el cloud agent instalen sin tener el SDK |
| Artefacto Android | `~/.m2/repository/...` | No (cada PC publica el suyo con `sdk pack`) |
| Cambios de dependencia en el padre | `package.json`, lockfile, `libs.versions.toml`, `build.gradle(.kts)`, `settings.gradle(.kts)`, `Podfile` | Sí, en la rama `feature/*` |
| Versión `-local.N` en el repo del SDK | — | Nunca: se fija solo mientras se empaqueta |

---
Anterior: [13-diferencias-con-claude.md](13-diferencias-con-claude.md) · [Índice](../README.md)
