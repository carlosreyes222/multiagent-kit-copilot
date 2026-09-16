---
name: stack-android
description: Convenciones y reglas para proyectos Android nativos con Kotlin y Jetpack Compose. Úsala siempre que el proyecto tenga build.gradle(.kts) con el plugin de Android, archivos .kt con composables, o el ADR elija Android nativo — al diseñar, implementar, probar o revisar.
---

Aplica estas reglas en cualquier trabajo sobre Android nativo. Son la capa de convenciones del dueño del proyecto; el detalle técnico profundo está en las skills oficiales complementarias (ver al final).

## 1. Convenciones del proyecto (fijas)

- **Arquitectura: MVVM + flujo de datos unidireccional (UDF).** `ViewModel` expone un único `StateFlow<UiState>`; la UI lo consume con `collectAsStateWithLifecycle()`. Los eventos one-shot (navegar, snackbar) van por `Channel` + `receiveAsFlow()` en la ruta, nunca dentro del estado. La UI envía intenciones al ViewModel mediante funciones; la UI nunca muta estado de negocio.
- **Composables en dos niveles:** una `XRoute` (conecta ViewModel, estado y eventos) y una `XScreen` *stateless* que recibe `UiState` inmutable + lambdas y es previsualizable con `@Preview` sin dependencias.
- **Módulos Gradle según tamaño:** un solo módulo `app` con paquetes por feature (`feature/login`, `feature/home`, `core/network`…) al empezar. Cuando haya más de ~5 features o el build pase de 2–3 min, el arquitecto propone migrar a multimódulo `:feature:*` / `:core:*` (estilo Now in Android) en un ADR propio; no se hace de forma implícita.
- **Librerías (DI, red, imágenes, persistencia): las elige el arquitecto por proyecto** en el ADR de stack, justificando. Opciones habituales: Hilt o Koin; Retrofit/OkHttp o Ktor client; Room; Coil. Una vez elegidas, no se mezclan (no dos frameworks de DI, no dos clientes HTTP).
- **Pruebas por defecto:** unitarias con JUnit para ViewModels y lógica (Flows con Turbine, `MainDispatcherRule`, fakes escritos a mano en lugar de mocks para repositorios) y pruebas de UI de Compose (`compose-ui-test`) para cada pantalla con al menos el estado de carga, el de éxito y el de error. Screenshot tests solo si el ADR lo pide.
- **Material 3** con colores semánticos del tema; nunca colores ni textos literales en composables (strings en recursos). Accesibilidad (`contentDescription` o `semantics`) en todo nodo interactivo o icono.
- **Kotlin idiomático:** corrutinas y Flow; nada de `Thread`, `Handler` ni callbacks anidados. `sealed interface` para estados y resultados.

## 2. Antes de proponer versiones o APIs: consulta lo último

Tu conocimiento de versiones puede estar desactualizado. Antes de fijar versiones en un ADR, `libs.versions.toml` o al usar una API reciente, consulta y cita:

- Versiones de Android y cambios de comportamiento: https://developer.android.com/about/versions
- Compose BOM y releases: https://developer.android.com/develop/ui/compose/bom/bom-mapping y https://developer.android.com/jetpack/androidx/releases/compose
- Releases AndroidX (Navigation 3, Room, Lifecycle, Paging): https://developer.android.com/jetpack/androidx/versions
- Kotlin: https://kotlinlang.org/docs/releases.html · AGP: https://developer.android.com/build/releases/gradle-plugin
- Guía de arquitectura: https://developer.android.com/topic/architecture · Referencia modular: https://github.com/android/nowinandroid

Fija versiones concretas en `libs.versions.toml` y anótalas en el ADR con la fecha de consulta. Si una API está en alpha/beta, dilo explícitamente y no la uses en producción sin aprobación humana.

## 3. Reglas duras

**Obligatorio**
- Estado hoisted al dueño más bajo posible; `remember` para estado de UI local, `rememberSaveable` para lo que debe sobrevivir a la rotación (solo tipos serializables).
- Efectos con el ciclo de vida correcto: `LaunchedEffect(key)` con claves semánticas; `LifecycleStartEffect`/`LifecycleResumeEffect` para trabajo ligado al ciclo de vida.
- Listas: `LazyColumn`/`LazyRow` con `key = { it.id }` y `contentType` si hay tipos mixtos; nunca `Column` + `forEach` para listas largas.
- Estabilidad: colecciones inmutables (`ImmutableList`) en el estado de UI; lambdas de items recordadas por clave. No anotar `@Stable`/`@Immutable` para silenciar un reporte si el tipo es realmente mutable.
- Layout estable durante carga o refresco: no reemplazar toda la pantalla por un spinner.
- Secretos: nunca en código ni en `local.properties` versionado; usar `BuildConfig` alimentado desde CI o Android Keystore para claves.
- Seguridad de datos: `EncryptedSharedPreferences`/Keystore para tokens; nunca registrar tokens ni datos personales en logs; `android:allowBackup` y `usesCleartextTraffic` revisados; certificate pinning si la app maneja dinero o datos sensibles.

**Prohibido**
- Lógica de negocio dentro de composables.
- `GlobalScope`, `runBlocking` en producción, `Dispatchers.Main` fijo en pruebas.
- `LiveData` en código nuevo (usar `StateFlow`).
- Pasar `Context`, `Activity` o `NavController` a ViewModels.
- Mocks de librerías (MockK/Mockito) para repositorios propios cuando un fake simple sirve.

## 4. Lista de verificación para revisores

- ¿Cada pantalla tiene `Route` + `Screen` stateless y un `@Preview`?
- ¿El `UiState` es inmutable y único por ViewModel? ¿Los eventos one-shot van por `Channel`?
- ¿Las listas tienen `key`? ¿Hay lambdas creadas en cada recomposición dentro de items?
- ¿Se lee estado animado en la fase de composición cuando debería leerse en layout/draw?
- ¿Hay trabajo pesado en el hilo principal? ¿Colecciones de Flow que sigan vivas fuera de pantalla?
- ¿Tokens, PII o payloads sensibles en logs? ¿Claves en código? ¿Tráfico en claro?
- ¿Cada criterio de aceptación tiene prueba unitaria o de UI?
- Rendimiento: si se afirma una mejora, ¿hay evidencia (reporte del compilador de Compose, Macrobenchmark, Layout Inspector)? No optimizar sin medir.

## 5. Skills oficiales complementarias (detalle técnico)

Si están instaladas, úsalas para profundizar; si no, sugiere al usuario instalarlas (ver `docs/08-skills-de-stack.md` del kit):

- `chrisbanes/skills` — estado y efectos, rendimiento, diseño de componentes, pruebas de UI, corrutinas/Flow (Apache-2.0).
- `skydoves/compose-performance-skills` — diagnóstico y corrección de rendimiento en Compose, Baseline Profiles, R8 (Apache-2.0).
- `Drjacky/claude-android-ninja` — reglas "required/forbidden" de arquitectura, seguridad (Play Integrity, Keystore) y testing muy actualizadas (Apache-2.0).
