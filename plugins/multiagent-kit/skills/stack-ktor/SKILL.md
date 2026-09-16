---
name: stack-ktor
description: Convenciones y reglas para backends en Kotlin con Ktor. Úsala siempre que el proyecto tenga io.ktor:ktor-server en build.gradle(.kts) o el ADR elija Ktor — al diseñar, implementar, probar o revisar APIs.
---

Aplica estas reglas en cualquier trabajo sobre un backend Ktor. Son la capa de convenciones del dueño del proyecto; el detalle profundo está en las skills complementarias (ver al final).

## 1. Convenciones del proyecto (fijas)

- **Ktor (servidor) en Kotlin, sobre corrutinas.** Se elige Ktor frente a Spring Boot cuando el proyecto es un servicio o API para apps móviles propias, o cuando conviene compartir modelos con Android (Kotlin Multiplatform para los DTOs). Spring Boot solo si un ADR lo justifica (integración con ecosistema empresarial existente).
- **Acceso a datos y DI: los elige el arquitecto por proyecto** en el ADR de stack. Opciones habituales: Exposed (DSL/DAO) o SQLDelight para datos; Koin o el plugin de DI nativo de Ktor (3.2+) para inyección. Una vez elegidos, no se mezclan.
- **Estructura:** `Application.module()` pequeño que llama a funciones `configureSerialization()`, `configureSecurity()`, `configureStatusPages()`, `configureDI()`, `configureRouting()`, cada una en `plugins/`. Rutas por feature en `routes/<feature>Routes.kt` (extensiones de `Route`); lógica en `services/`; acceso a datos en `repositories/`; DTOs en `models/` con `kotlinx.serialization`.
- **Rutas delgadas:** reciben, validan, llaman a un servicio, responden. Nada de lógica de negocio en el bloque `routing {}`.
- **Configuración** en `application.yaml`/`application.conf` leída con `environment.config`; secretos por variables de entorno.
- **Pruebas por defecto:** `testApplication { }` para cada endpoint (recorre el pipeline real sin abrir socket), con dependencias externas sustituidas en el módulo de DI de pruebas; unitarias de servicios con JUnit 5 o Kotest; base de datos de prueba en Docker (Testcontainers) para repositorios.

## 2. Antes de proponer versiones o APIs: consulta lo último

- Ktor: https://ktor.io/docs/ · novedades: https://ktor.io/docs/whats-new.html · releases: https://github.com/ktorio/ktor/releases
- Kotlin: https://kotlinlang.org/docs/releases.html · kotlinx.serialization: https://github.com/Kotlin/kotlinx.serialization/releases
- Exposed: https://www.jetbrains.com/help/exposed/ · Koin: https://insert-koin.io/docs/

Fija versiones exactas en `libs.versions.toml` y anótalas en el ADR con la fecha de consulta.

## 3. Reglas duras

**Obligatorio**
- Todo handler es `suspend`: nunca `Thread.sleep` ni llamadas bloqueantes; lo bloqueante (JDBC) va en `withContext(Dispatchers.IO)` o en transacciones suspend.
- Plugins instalados en el módulo (o en `route("/x") { install(...) }` si aplican a un subconjunto), no dispersos en `main`.
- Errores centralizados con `StatusPages`: un formato de error único; sin `try/catch` en cada handler; el `Throwable` genérico se registra y responde 500 sin detalles internos.
- Validación explícita de cada request (`require`/validador) antes de llamar al servicio; respuesta 400 con mensaje claro.
- Autenticación con `install(Authentication)` + `authenticate("nombre") { }`; JWT de vida corta con secreto desde configuración; principal vía `call.principal<T>()`. Autorización por recurso dentro del servicio (evitar IDOR).
- CORS explícito; cabeceras de seguridad; rate limiting en endpoints públicos.
- Transacciones para escrituras multi-paso en el servicio dueño de la unidad de trabajo; migraciones versionadas (Flyway o Liquibase), nunca `SchemaUtils.create` en producción.
- Pool de conexiones (HikariCP) configurado; logging estructurado con id de correlación; sin PII ni secretos en logs; endpoint de salud y apagado ordenado.

**Prohibido**
- Lógica de negocio dentro de `routing {}`.
- `runBlocking` en producción; `GlobalScope`.
- SQL construido por concatenación.
- Secretos en código, en `application.conf` versionado o en logs.
- Mezclar dos frameworks de DI o dos capas de acceso a datos.

## 4. Lista de verificación para revisores

- ¿Cada ruta es delgada y delega en un servicio? ¿Validación antes de la llamada?
- ¿Alguna llamada bloqueante fuera de `Dispatchers.IO`?
- ¿`StatusPages` cubre las excepciones del dominio y el genérico sin filtrar detalles?
- ¿Rutas protegidas con `authenticate`? ¿Comprobación de propiedad del recurso?
- ¿Escrituras multi-paso en transacción? ¿Migración incluida?
- ¿Pruebas con `testApplication` por endpoint y unitarias del servicio?
- ¿Logs con PII? ¿Secretos en configuración versionada?

## 5. Skills complementarias (detalle técnico)

- `affaan-m/everything-claude-code` — `kotlin-ktor-patterns` (routing, serialización, JWT, StatusPages, Koin, testApplication), `kotlin-exposed-patterns` (HikariCP, Flyway, transacciones), `kotlin-testing` (MIT).
- `KotlinHero/ktor-skill` — destilado de la documentación oficial de Ktor 3.x, incluye `@Resource` y DI nativo (sin licencia declarada: usar solo como referencia de lectura).
