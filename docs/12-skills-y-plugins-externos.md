# 12. Skills de stack y skills externas

## 12.1 Skills de stack del kit

Copilot ya sabe Kotlin, Compose, React Native, TypeScript y SQL. Lo que no puede saber es **cómo trabajas tú**, **qué salió el mes pasado** ni **qué mira un revisor en tu contexto**. Las skills de stack (`skills/stack-*/SKILL.md` en el plugin, copiadas a `.github/skills/` en cada proyecto) fijan eso en una o dos pantallas:

| Skill | Cubre | Convenciones fijadas |
|---|---|---|
| `stack-android` | Kotlin + Jetpack Compose | MVVM + UDF; Route/Screen stateless; módulos según tamaño; librerías a elección del arquitecto; JUnit + Turbine + compose-ui-test |
| `stack-react-native` | React Native bare, TypeScript | Bare (CLI), sin Expo; TS estricto; estado/navegación a elección del arquitecto; Jest + RNTL |
| `stack-nestjs` | Backend TypeScript | NestJS + Prisma; módulos por feature; DTOs validados; JWT corto; e2e con Supertest |
| `stack-ktor` | Backend Kotlin | Ktor; rutas delgadas; datos/DI a elección del arquitecto; `testApplication` |
| `stack-db` | PostgreSQL, Supabase, MongoDB, Firestore | Tabla de elección; reglas por base; seguridad (RLS, reglas, roles) |

Copilot activa una skill cuando su descripción encaja; el arquitecto las lee al proponer stack y `AGENTS.md` de cada proyecto lista cuáles aplican. Cada una lleva la sección **Antes de proponer versiones o APIs** con las URLs oficiales que el arquitecto y el implementador deben consultar antes de fijar versiones: así "lo nuevo que salga" entra por la documentación oficial, no por la memoria del modelo.

Para cambiar una convención global, edita la skill en el plugin y publica versión ([06](06-actualizar-el-kit.md)). Para una convención de un solo proyecto, escríbela en `AGENTS.md`; prevalece sobre la skill.

## 12.2 Skills de terceros

Las skills son un formato abierto (`SKILL.md`), así que las mismas que se usan con Claude Code sirven en Copilot. Tres formas de instalarlas:

**a) Como skill de proyecto** (queda en `.github/skills/`, se versiona con el repo, la ven CLI, VS Code y cloud agent):

```powershell
copilot skill add --project https://github.com/vercel-labs/agent-skills/blob/main/skills/react-native-guidelines/SKILL.md
copilot skill add --project ./ruta/local/SKILL.md
```

**b) Como skill personal** (todos los proyectos de este PC, solo CLI): `copilot skill add <archivo|URL>` sin `--project`, o copiando la carpeta a `~/.copilot/skills/`.

**c) Como plugin de Copilot** (CLI y cloud agent), cuando el autor publica un `marketplace.json`:

```powershell
copilot plugin marketplace add supabase/agent-skills
copilot plugin marketplace browse <nombre-del-marketplace>
copilot plugin install <plugin>@<marketplace>
```

Copilot también lee `.claude-plugin/marketplace.json`, así que los marketplaces publicados para Claude Code suelen funcionar. Y el marketplace integrado `awesome-copilot` (`copilot plugin marketplace browse awesome-copilot`) trae agentes, skills e instrucciones mantenidos por GitHub.

## 12.3 Recomendadas por stack

| Stack | Fuente | Instalar |
|---|---|---|
| Android / Compose | `chrisbanes/skills`, `skydoves/compose-performance-skills`, `Drjacky/claude-android-ninja` | `copilot plugin marketplace add <repo>` y luego `install` |
| React Native | `callstackincubator/agent-skills`, `software-mansion-labs/skills`, Vercel `react-native-guidelines` | idem, o `copilot skill add --project <URL del SKILL.md>` |
| NestJS / Ktor | `Kadajett/agent-nestjs-skills`, `affaan-m/everything-claude-code` (`kotlin-ktor-patterns`, `prisma-patterns`) | `copilot skill add --project <URL del SKILL.md>` |
| Bases de datos | `supabase/agent-skills`, `mongodb/agent-skills`, `firebase/skills`, `neondatabase/postgres-skills` | marketplace + install |
| Método | Anthropic `knowledge-work-plugins` (engineering, product-management), `superpowers`, `petrkindlmann/qa-skills`, mattpocock-skills, GitHub `spec-kit` (`specify init --here --integration copilot`) | según el repo |

Instala solo lo que uses: cada skill añade contexto a cada sesión. Las skills `metodo-*` del kit mandan en el pipeline; si una skill externa contradice una convención del kit, prevalece el kit y `AGENTS.md`.

## 12.4 Dónde no instalar

No ejecutes `copilot skill add` ni `npx skills add` dentro de este repositorio del kit: aquí no tiene efecto sobre ningún proyecto y `.agents/` y `.claude/` están ignorados por git.

---
Anterior: [11-staging-por-proveedor.md](11-staging-por-proveedor.md) · Siguiente: [13-diferencias-con-claude.md](13-diferencias-con-claude.md) · [Índice](../README.md)
