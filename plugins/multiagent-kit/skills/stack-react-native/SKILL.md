---
name: stack-react-native
description: Convenciones y reglas para proyectos React Native (bare, React Native CLI, TypeScript). Úsala siempre que el proyecto tenga react-native en package.json y carpetas android/ e ios/, o el ADR elija React Native — al diseñar, implementar, probar o revisar.
---

Aplica estas reglas en cualquier trabajo sobre React Native. Son la capa de convenciones del dueño del proyecto; el detalle profundo está en las skills oficiales complementarias (ver al final).

## 1. Convenciones del proyecto (fijas)

- **Base: bare con React Native CLI. Expo no se usa** (ni el framework, ni `expo-router`, ni EAS, ni `npx create-expo-app`). Motivo: control total del código nativo y del build. Proyectos nuevos: `npx @react-native-community/cli@latest init NombreApp` (plantilla TypeScript por defecto); `android/` e `ios/` se versionan; se ejecuta con `npx react-native run-android` / `run-ios` y Metro con `npx react-native start`. Requisitos: Node LTS, JDK 17, Android SDK (variables `ANDROID_HOME`, `JAVA_HOME`); ver https://reactnative.dev/docs/set-up-your-environment.
- **Detección:** si `package.json` tiene `expo` en dependencias, existe `app.json` con clave `expo`, o hay `expo-router`/`eas.json`, el proyecto es Expo: **no lo conviertas ni añadas más Expo por tu cuenta**; señálalo al usuario y pregunta si quiere migrar a bare (ADR aparte) o excluir el proyecto de esta convención.
- Código nativo: Turbo Module o Fabric component (Nueva Arquitectura), en Kotlin para Android y Swift para iOS. Librerías `expo-*` sueltas solo si no hay alternativa bare, funcionan sin el runtime de Expo y el ADR lo justifica.
- **TypeScript estricto** (`"strict": true`), sin `any` salvo con comentario que lo justifique. Tipar la navegación (`RootStackParamList`) y las respuestas de API.
- **Estado y navegación: los elige el arquitecto por proyecto** en el ADR de stack. Navegación siempre con React Navigation (stack nativo), nunca `expo-router`. Estado: Zustand o Redux Toolkit para estado de cliente, TanStack Query para estado de servidor. Regla fija: el estado de servidor (datos remotos, caché) nunca se guarda en el store de cliente.
- **Estructura por feature:** `src/features/<nombre>/{screens,components,hooks,api}`, más `src/components` (UI reutilizable), `src/navigation`, `src/services`, `src/theme`. Pruebas junto al código (`*.test.tsx`).
- **Pruebas por defecto:** unitarias y de componentes con Jest + React Native Testing Library (queries por rol/accesibilidad, `userEvent` sobre `fireEvent`, `findBy*` para lo asíncrono); hooks con `renderHook`. E2E con Maestro solo si el ADR lo pide. Comprobar la versión de RNTL en `package.json` antes de escribir pruebas: la API cambia entre v13 y v14.
- **Nueva Arquitectura activada** (por defecto desde RN 0.76). Antes de añadir una librería, comprobar su compatibilidad en https://reactnative.directory.

## 1b. Comandos para `pipeline.config.ps1` (proyecto bare típico)

| Variable | Valor habitual |
|---|---|
| `INSTALL_CMD` | `npm ci` |
| `BUILD_CMD` | `cd android && .\gradlew assembleDebug` (Windows) · `cd android && ./gradlew assembleDebug` (macOS/Linux) |
| `TEST_CMD` | `npm test -- --ci` |
| `LINT_CMD` | `npx tsc --noEmit && npm run lint` |
| `STAGING_PROVIDER` | `comando` — `STAGING_DEPLOY_CMD` instala el APK en un emulador/dispositivo (`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`) o lo sube a Firebase App Distribution; `SMOKE_CMD` puede ser un flujo de Maestro (`maestro test .maestro/smoke.yaml`) |
| `PROD_DEPLOY_CMD` | build de release firmado (`.\gradlew bundleRelease`) + subida a la pista interna de Play; el arquitecto lo fija en el ADR |

El keystore de release y `google-services.json` no se copian a imágenes ni a `docs/` (están en `.dockerignore`); las claves de firma se leen de variables de entorno.

## 2. Antes de proponer versiones o APIs: consulta lo último

Antes de fijar versiones en `package.json`, subir React Native o usar una API reciente, consulta y cita:

- Releases y versiones soportadas: https://github.com/facebook/react-native/releases · https://reactnative.dev/versions · blog: https://reactnative.dev/blog
- Subidas de versión: Upgrade Helper https://react-native-community.github.io/upgrade-helper/ (nunca subir RN "a mano"; aplicar el diff del template)
- Nueva Arquitectura, Turbo Modules, Fabric: https://reactnative.dev/docs/the-new-architecture/landing-page
- React Navigation: https://reactnavigation.org/docs/getting-started · RNTL: https://callstack.github.io/react-native-testing-library/ · Reanimated: https://docs.swmansion.com/react-native-reanimated/
- Compatibilidad de librerías: https://reactnative.directory

Fija versiones exactas y anótalas en el ADR con la fecha de consulta.

## 3. Reglas duras

**Obligatorio**
- `FlatList`/`FlashList`/`SectionList` para listas; `ScrollView` solo para contenido corto y fijo.
- `SafeAreaView`/insets y `KeyboardAvoidingView` en formularios; manejar el botón atrás de Android en flujos modales.
- Estilos con `StyleSheet.create` o el sistema de tema del proyecto; nada de objetos de estilo inline creados en cada render.
- Animaciones con Reanimated (hilo de UI); nunca `setTimeout`/`setInterval` para animar.
- Almacenamiento: credenciales y tokens solo en almacenamiento seguro (Keychain/Keystore, p. ej. `react-native-keychain`); MMKV o AsyncStorage para preferencias no sensibles.
- Rendimiento: medir antes de optimizar (React DevTools Profiler, FPS, TTI, tamaño de bundle con `source-map-explorer`). No añadir `useMemo`/`useCallback` sin evidencia de renders desperdiciados. Evitar imports de barril que inflan el bundle.
- Código nativo: métodos asíncronos en Turbo Modules salvo necesidad demostrada; trabajo pesado fuera del hilo principal.

**Prohibido**
- Introducir Expo en un proyecto bare: `expo install`, `expo-router`, `expo-dev-client`, EAS Build/Update, `npx expo …`. Los comandos son siempre `npx react-native …` y Gradle/Xcode.
- Secretos en el bundle JS (`.env` con claves privadas): el bundle es legible; lo sensible vive en el backend.
- Deshabilitar la Nueva Arquitectura para "arreglar" una librería incompatible; se busca alternativa o se hace un módulo propio.
- Cadenas o colores literales fuera del tema/i18n del proyecto.

## 4. Lista de verificación para revisores

- ¿Rutas y parámetros de navegación tipados? ¿`any` sin justificar?
- ¿Listas con `keyExtractor` estable y componentes de item memoizados solo si el profiler lo pidió?
- ¿Estado de servidor separado del estado de cliente?
- ¿Tokens en almacenamiento seguro? ¿Logs con datos personales? ¿Claves privadas en el bundle?
- ¿Las pruebas usan `screen` y queries accesibles? ¿Hay `waitFor` + `getBy` donde debería haber `findBy`?
- ¿Cada criterio de aceptación tiene prueba?
- ¿Apareció alguna dependencia `expo`/`expo-*` o un script `expo` en `package.json`? → RECHAZADO salvo que el ADR lo justifique explícitamente.
- Si hay módulo nativo: ¿compila en Android e iOS? ¿Está en la Nueva Arquitectura?

## 5. Skills oficiales complementarias (detalle técnico)

Si están instaladas, úsalas; si no, sugiere instalarlas (ver `docs/12-skills-y-plugins-externos.md`):

- `callstackincubator/agent-skills` — rendimiento (Measure → Optimize → Re-measure), subida de versión con rn-diff-purge, creación de librerías y módulos nativos, brownfield (MIT).
- `software-mansion-labs/skills` — Reanimated, Gesture Handler, worklets, JSI (MIT).
- `vercel-labs/agent-skills` → `react-native-guidelines` — reglas de rendimiento, layout, animación, imágenes y estado (MIT).
- No instalar `expo/skills`: sus recetas asumen el runtime de Expo y contradicen esta convención.
