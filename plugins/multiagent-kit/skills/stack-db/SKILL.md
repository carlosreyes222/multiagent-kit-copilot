---
name: stack-db
description: Criterios para elegir y usar la base de datos de un proyecto entre PostgreSQL, Supabase, MongoDB y Firebase Firestore, con reglas de esquema, índices, migraciones y seguridad para cada una. Úsala al diseñar el modelo de datos en un ADR, al escribir migraciones o consultas, y al revisar seguridad de datos.
---

Aplica esta skill en cualquier decisión o trabajo sobre la base de datos. Las cuatro opciones son fortalezas del dueño del proyecto; el arquitecto elige entre ellas en el ADR de stack con esta guía, y los demás agentes siguen las reglas de la elegida. El detalle profundo está en las skills oficiales complementarias (ver al final).

## 1. Cómo elegir (arquitecto)

| Situación | Elección por defecto | Por qué |
|---|---|---|
| Datos con estructura y relaciones claras; backend propio (NestJS/Ktor) | **PostgreSQL** | Integridad, transacciones, consultas ricas; funciona con Prisma y Exposed |
| Lo mismo, pero se quiere auth, API instantánea y tiempo real sin montar backend, o el cliente móvil accede directo | **Supabase** | Es PostgreSQL gestionado + auth + RLS + realtime; migrable a Postgres propio |
| App móvil que necesita sincronización en tiempo real y auth con mínimo backend, y se acepta dependencia de Google | **Firestore** | Arranque más rápido para móvil; offline y realtime integrados |
| Documentos con esquema muy variable o anidado, alto volumen de escritura, equipo TypeScript | **MongoDB** | Modelo documental flexible; Atlas gestionado |

Reglas de decisión: si hay dudas, PostgreSQL. Presentar en el ADR al menos dos opciones con pros/contras para ESE proyecto y un plan de salida (cómo migrar si la elección resulta mala). Nunca elegir por moda ni por "es lo que hay en el ejemplo".

## 2. Antes de proponer versiones o funciones: consulta lo último

- PostgreSQL: https://www.postgresql.org/docs/current/ · release notes: https://www.postgresql.org/docs/release/ · versiones soportadas: https://www.postgresql.org/support/versioning/
- Supabase: cambios (buscar `breaking-change`): https://supabase.com/changelog.md · docs (cualquier página + `.md`): https://supabase.com/docs · CLI: https://github.com/supabase/cli/releases
- MongoDB: https://www.mongodb.com/docs/manual/release-notes/ · modelado: https://www.mongodb.com/docs/manual/data-modeling/
- Firestore: https://firebase.google.com/docs/firestore · releases: https://firebase.google.com/support/releases · precios: https://firebase.google.com/docs/firestore/pricing

## 3. Reglas comunes (todas las bases)

- El **backend es la frontera de confianza**: el cliente nunca toma la decisión final de autorización.
- Esquema y reglas de acceso **versionados en el repositorio** (migraciones, `schema.prisma`, reglas de Firestore, políticas RLS). Nada se cambia a mano en producción.
- Índices para cada patrón de consulta real; justificar cada índice con la consulta que sirve. Medir con `EXPLAIN`/`explain()` antes de afirmar una mejora.
- Datos sensibles: cifrado en tránsito siempre; en reposo según proveedor; nunca datos personales o tokens en logs; retención definida.
- Copias de seguridad y restauración probadas antes de producción.
- Operaciones destructivas (drop, delete masivo, cambio de tipo de columna) solo con aprobación humana explícita y plan de reversión.

## 4. Reglas por base de datos

### PostgreSQL
- Identificadores en `snake_case` sin comillas. Claves primarias `bigint GENERATED ALWAYS AS IDENTITY` o UUID v7 (no v4 en tablas grandes). Siempre `timestamptz`. `text` + `CHECK` en lugar de `varchar(n)`.
- Índice compuesto: columnas de igualdad primero, luego rango/orden. Índices parciales para subconjuntos frecuentes; `INCLUDE` para index-only scans; GIN para `jsonb`/arrays/texto.
- Migraciones seguras en línea: `ADD COLUMN` (con o sin default) sí; `SET NOT NULL` vía `CHECK ... NOT VALID` + `VALIDATE` primero; `ALTER COLUMN TYPE` reescribe la tabla (planificar ventana).
- Roles mínimos: la app no se conecta como superusuario; pool de conexiones (PgBouncer o el del ORM).

### Supabase
- RLS activado en **todas** las tablas de esquemas expuestos (`public`), con políticas que reflejen el modelo de acceso real: `to authenticated using ((select auth.uid()) = user_id)`; `UPDATE` con `using` **y** `with check`; recordar que `UPDATE` necesita también política `SELECT`.
- Nunca `service_role`/clave secreta en clientes; usar claves publicables. Nunca autorizar con `user_metadata` (lo edita el usuario): usar `app_metadata`.
- Vistas con `security_invoker = true`; `SECURITY DEFINER` solo fuera de `public`, con comprobación de `auth.uid()` dentro y nunca para "arreglar" un permiso denegado.
- Migraciones y funciones se despliegan con la CLI (`supabase db push`, `supabase functions deploy`) contra un proyecto de staging separado y luego producción; nunca desde el SQL Editor ni el panel (ver `docs/10-supabase.md`).
- Índices en toda columna usada en políticas RLS. Ejecutar `supabase db advisors` tras cambios de esquema. Migraciones con `supabase migration new` / `db pull`, nunca inventar nombres de archivo.

### MongoDB
- "Lo que se lee junto se guarda junto": diseñar por consultas, no por entidades. Embeber 1:1 y 1:pocos acotados; referenciar 1:muchos sin límite y M:N. Vigilar el límite de 16 MB (arrays sin cota).
- Validación de esquema con `$jsonSchema` (`moderate`/`warn` al principio, `strict`/`error` después). Versionado de esquema en el documento.
- Índices compuestos en orden ESR (Equality → Sort → Range). Objetivo en `explain`: `nReturned ≈ totalKeysExamined ≈ totalDocsExamined`; un `COLLSCAN` o `SORT` en memoria es un índice que falta.
- `writeConcern: majority` para datos que importan. Nunca clave de shard monotónica.
- Escrituras masivas o destructivas solo con aprobación humana.

### Firebase Firestore
- Reglas de seguridad con **denegación por defecto**, funciones auxiliares (`isAuthenticated`, `isOwner`), validadores de datos llamados en `create` **y** `update`, protección del `uid` (no se puede reasignar). Nunca `allow read: true` en la primera versión. Documentar el modelo de datos asumido al inicio del archivo de reglas.
- Las reglas deben permitir exactamente las consultas que hace el cliente (`where`/`orderBy`/`limit`); probar con el emulador y hacer una fase de "abogado del diablo" (intentar romperlas) antes de desplegar.
- Modelado: subcolecciones para padre-hijo, colecciones raíz para consultas transversales; embeber lo que se lee junto y cambia poco; evitar documentos calientes (contadores con sharding).
- Costes: se paga por lectura/escritura; diseñar para minimizar lecturas (paginación, caché, `limit`), alertas de presupuesto y App Check en producción.
- Identificar la edición (Standard/Enterprise) con `firebase firestore:databases:get` antes de proponer funciones.

## 5. Lista de verificación para revisores

- ¿Migración o cambio de reglas incluido en la rama y reversible?
- ¿Cada consulta nueva tiene índice o justificación de por qué no?
- ¿Algún acceso desde cliente que confíe en el cliente (RLS/reglas ausentes, `service_role` expuesto)?
- ¿Datos personales en logs? ¿Campos sensibles sin cifrar?
- ¿Operaciones destructivas sin aprobación humana documentada?

## 6. Skills oficiales complementarias (detalle técnico)

- PostgreSQL: `neondatabase/postgres-skills` (Apache-2.0; PG 14–18, migraciones seguras, índices, replicación) y `supabase/agent-skills` → `supabase-postgres-best-practices` (MIT; sirve para cualquier Postgres).
- Supabase: `supabase/agent-skills` → `supabase` (MIT, oficial).
- MongoDB: `mongodb/agent-skills` → `mongodb-schema-design`, `mongodb-query-optimizer` (Apache-2.0, oficial).
- Firestore: `firebase/skills` → `firebase-firestore`, `firestore-rules-creation`, `firebase-security-rules-auditor` (Apache-2.0, oficial).
