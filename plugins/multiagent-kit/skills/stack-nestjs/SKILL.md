---
name: stack-nestjs
description: Convenciones y reglas para backends en TypeScript con NestJS y Prisma. Úsala siempre que el proyecto tenga @nestjs/core en package.json o el ADR elija NestJS — al diseñar, implementar, probar o revisar APIs.
---

Aplica estas reglas en cualquier trabajo sobre un backend NestJS. Son la capa de convenciones del dueño del proyecto; el detalle profundo está en las skills complementarias (ver al final).

## 1. Convenciones del proyecto (fijas)

- **NestJS + Prisma.** Prisma es el ORM por defecto (schema declarativo, migraciones con `prisma migrate`). TypeORM solo si un ADR lo justifica (p. ej. base de datos heredada).
- **Módulos por feature**, no por capa técnica: `src/<feature>/{<feature>.module.ts, <feature>.controller.ts, <feature>.service.ts, dto/, entities/}`. Módulos compartidos en `src/common` (filtros, pipes, guards, interceptores) y `src/config`.
- **Controladores delgados:** parsean entrada HTTP, llaman a un servicio, devuelven un DTO de respuesta. Nada de lógica de negocio ni de coordinación de escrituras múltiples en controladores.
- **Inyección por constructor** siempre; nunca `new Servicio()`. Tokens de inyección para interfaces. `forwardRef()` solo como último recurso y documentado.
- **DTOs para toda entrada y salida:** `class-validator` + `class-transformer`; nunca pasar `req.body` crudo a un servicio ni devolver entidades de Prisma directamente (exponen columnas internas).
- **Configuración validada al arrancar** (`ConfigModule` con esquema); la app termina si falta una variable. Nada de `process.env` suelto por el código.
- **Pruebas por defecto:** unitarias de servicios con `Test.createTestingModule` y fakes/mocks solo de dependencias externas (Prisma, HTTP, colas); e2e de cada endpoint con Supertest usando los mismos pipes y filtros globales que producción; base de datos de prueba en Docker.

## 2. Antes de proponer versiones o APIs: consulta lo último

- NestJS: https://docs.nestjs.com · migración entre majors: https://docs.nestjs.com/migration-guide · releases: https://github.com/nestjs/nest/releases
- Prisma: https://www.prisma.io/docs · releases: https://github.com/prisma/prisma/releases
- Node.js LTS vigente: https://nodejs.org/en/about/previous-releases
- class-validator: https://github.com/typestack/class-validator

Fija versiones exactas en `package.json` y anótalas en el ADR con la fecha de consulta.

## 3. Reglas duras

**Obligatorio**
- `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Un único filtro global de excepciones con un sobre de error consistente (`{ statusCode, message, error, correlationId }`); los servicios lanzan excepciones HTTP tipadas (`NotFoundException`, `ConflictException`…).
- Autenticación con JWT de vida corta (≈15 min) + refresh; secreto desde configuración; el payload nunca lleva contraseña ni datos sensibles; `validate()` comprueba que el usuario existe y está activo.
- Guards para reglas de acceso gruesas; autorización por recurso dentro del servicio (evitar IDOR: comprobar que el recurso pertenece al usuario).
- Rate limiting (`@nestjs/throttler`) y cabeceras de seguridad (`helmet`) en endpoints públicos; CORS explícito.
- Transacciones (`prisma.$transaction`) para escrituras multi-paso, encapsuladas en el servicio dueño de la unidad de trabajo.
- Evitar N+1: usar `include`/`select` de Prisma o consultas agregadas; revisar consultas en bucles.
- Migraciones versionadas y revisadas; nunca `prisma db push` en producción.
- Logging estructurado con id de correlación; sin PII ni secretos en logs. Apagado ordenado (`enableShutdownHooks`) y endpoint de salud.

**Prohibido**
- Devolver entidades/modelos de Prisma directamente desde un controlador.
- Dependencias circulares entre módulos.
- Secretos en código o en `.env` versionado.
- Consultas SQL crudas construidas por concatenación (usar `Prisma.sql` parametrizado si hace falta SQL).
- Exponer stack traces o mensajes internos en respuestas de error.

## 4. Lista de verificación para revisores

- ¿Todo endpoint tiene DTO de entrada validado y DTO de respuesta explícito?
- ¿Algún controlador con lógica de negocio o con varias escrituras sin transacción?
- ¿Guards en todas las rutas no públicas? ¿Comprobación de propiedad del recurso en el servicio?
- ¿JWT de corta duración, secreto desde config, payload mínimo?
- ¿Consultas en bucles (N+1)? ¿Índices para los filtros usados?
- ¿Migración incluida y reversible? ¿Cambios de esquema que bloqueen tablas grandes?
- ¿Pruebas e2e con los mismos pipes/filtros globales que producción?
- ¿Logs con PII? ¿Errores que filtren detalles internos?

## 5. Skills complementarias (detalle técnico)

- `Kadajett/agent-nestjs-skills` — 40 reglas con ejemplos incorrecto/correcto por categoría: arquitectura, DI, errores, seguridad, testing, DB (MIT). Instalable con `npx skills add Kadajett/agent-nestjs-skills`.
- `affaan-m/everything-claude-code` — `nestjs-patterns`, `prisma-patterns` y `database-migrations` (MIT).
