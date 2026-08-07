# Speleum - Master status audit

Fecha de auditoria: 2026-07-30  
Alcance: repositorio local completo excluyendo `node_modules`, `.next`, builds y caches.  
Estado de Git antes de crear estos documentos: `main...origin/main`, sin cambios rastreados.  
Archivos revisados: 106 archivos de proyecto encontrados con `rg --files` fuera de carpetas generadas.

## Resumen real del proyecto

Speleum es actualmente una aplicacion Next.js con App Router que sirve un juego web de supervivencia en cuevas. El codigo contiene una experiencia local jugable contra criaturas controladas por IA, una experiencia multijugador por salas privadas con Socket.IO, autenticacion por correo con retos de 6 digitos, perfil, ranking persistido con Prisma y PostgreSQL, internacionalizacion basica ES/EN y tema claro/oscuro.

La arquitectura esta dividida asi:

- Frontend Next/React: `app/`, con rutas `/`, `/login`, `/play`, `/profile`, `/ranking`, `/world` y `/How-to-play`.
- API backend en Next route handlers: `app/api/**/route.ts`.
- Logica compartida de juego: `app/play/gameConfig.ts`, `gameLogic.ts`, `tileMap.ts`, `proceduralCave.ts`, `signalUtils.ts`, `types.ts`.
- Servidor multijugador separado: `server/socketServer.ts`, ejecutado con `npm run server` o `npm run socket`.
- Base de datos: Prisma en `prisma/schema.prisma`, datasource PostgreSQL con `DATABASE_URL` y `DIRECT_URL`.
- Estado de sesion: cookie `httpOnly` firmada manualmente en `lib/auth-session.ts`.
- Correo: Resend por `fetch("https://api.resend.com/emails")` en `lib/auth-email.ts`; no se usa Nodemailer.

La aplicacion inicia con `npm run dev` para Next. El servidor realtime inicia aparte con `npm run server`/`npm run socket`, escucha `PORT || 4001` en `0.0.0.0` y mantiene salas, jugadores, mapa, enemigos, senales y resultados en memoria. `npm run dev:full` y `npm run dev:all` levantan Next y Socket.IO en paralelo usando `concurrently`.

El cliente multijugador resuelve la URL con `NEXT_PUBLIC_SOCKET_URL`; si no existe y el hostname es `localhost` o `127.0.0.1`, usa `http://localhost:4001`; en produccion sin esa variable el modo multijugador queda deshabilitado.

Partes que funcionan confirmadas por codigo y comandos:

- `npm run lint` pasa.
- `npx tsc --noEmit` pasa.
- `npm run build` pasa; genera rutas estaticas y dinamicas correctamente.
- Auth registra usuario, crea reto, envia codigo con Resend si hay `RESEND_API_KEY`, verifica email/login y crea cookie.
- Juego local genera cueva procedural con fallback, mueve por tiles, aplica cooldowns, ataque, parry, stun, IA, radar y guardado de resultado.
- Multijugador crea sala, permite unirse por codigo, ready, countdown, partida, movimiento/combate/IA server-side y filtrado de vision.

Partes incompletas o fragiles:

- La persistencia de resultados confia en el cliente; el servidor Socket.IO no escribe en base de datos.
- No hay reconexion real de jugador: al desconectar, el servidor marca al jugador como `left` o lo elimina de la partida.
- Las salas y partidas viven solo en memoria.
- La proteccion de rutas `/play` y `/profile` depende principalmente de redireccion cliente; no hay middleware.
- No hay recuperacion de cuenta, expiracion de sesion, CSRF, rate limit de login/password o validacion estricta de criatura activa.
- No hay `.env.example`; `.env` existe localmente pero esta ignorado por Git.
- El mapa procedural es finito, de 65 x 40 tiles, con 10-13 secciones por intento; no es infinito.
- Responsive fue revisado por codigo, no por navegador en viewports reales.

## Tabla general del estado

| Area | Estado | Funciona | Problemas | Prioridad | Documento relacionado |
| --- | --- | --- | --- | --- | --- |
| App Router / rutas | Funcional con errores | Si, build lista 7 rutas publicas | Proteccion cliente, assets de iconos faltantes, responsive no validado visualmente | HIGH | [01-FRONTEND-AUDIT.md](./01-FRONTEND-AUDIT.md) |
| Home y paginas informativas | Funcional con errores | Si | Mucho texto/UI mezclado ES/EN parcial, posible overflow por tracking alto | MEDIUM | [01-FRONTEND-AUDIT.md](./01-FRONTEND-AUDIT.md) |
| Login/registro | Funcional con errores | Si por codigo y build | Sin expiracion de sesion, fallback de secreto, correo falla si Resend no esta configurado | CRITICAL | [02-BACKEND-AUDIT.md](./02-BACKEND-AUDIT.md) |
| Verificacion por correo/2FA | Parcialmente implementado | Si con AuthChallenge | No hay proveedor alterno; preview loguea codigo; demo depende de env | HIGH | [02-BACKEND-AUDIT.md](./02-BACKEND-AUDIT.md) |
| Perfil | Funcional con errores | Lee `/api/profile` | Redireccion solo cliente; logout ok | MEDIUM | [01-FRONTEND-AUDIT.md](./01-FRONTEND-AUDIT.md) |
| Ranking | Funcional con errores | Lee Prisma `UserStats` | Integridad depende de resultados enviados por cliente | BLOCKER | [02-BACKEND-AUDIT.md](./02-BACKEND-AUDIT.md) |
| Prisma/Neon | Parcialmente implementado | Schema y migraciones existen | Sin `.env.example`; no se comprobo conexion real a Neon | HIGH | [03-CONNECTIONS-AND-DEPLOYMENT.md](./03-CONNECTIONS-AND-DEPLOYMENT.md) |
| Juego local | Funcional con errores | Logica completa y compilada | Victoria por limpiar enemigos, no Battle Royale real; logs de debug | HIGH | [04-GAME-MAP-AND-MULTIPLAYER.md](./04-GAME-MAP-AND-MULTIPLAYER.md) |
| Mapa procedural | Funcional con errores | Se llama desde local y servidor | Finito, puede caer a fallback, spawns salen de candidatos cercanos antes de seleccion separada | HIGH | [04-GAME-MAP-AND-MULTIPLAYER.md](./04-GAME-MAP-AND-MULTIPLAYER.md) |
| IA | Funcional con errores | Stalker/territorial/wanderer/ambusher/aggressive existen | Estados no coinciden exactamente con lista esperada; local/multi difieren en damage | MEDIUM | [04-GAME-MAP-AND-MULTIPLAYER.md](./04-GAME-MAP-AND-MULTIPLAYER.md) |
| Multijugador Socket.IO | Parcialmente implementado | Salas, ready, countdown, autoridad basica | Sin auth, sin reconexion, memoria volatil, no persiste resultados | BLOCKER | [04-GAME-MAP-AND-MULTIPLAYER.md](./04-GAME-MAP-AND-MULTIPLAYER.md) |
| Despliegue Vercel/Render | Parcialmente implementado | Scripts y envs base existen | CORS/env incompletos, dominio no comprobado, Socket URL publica obligatoria | HIGH | [03-CONNECTIONS-AND-DEPLOYMENT.md](./03-CONNECTIONS-AND-DEPLOYMENT.md) |
| Dependencias | Funcional con errores | Instaladas y build OK | `npm ls` muestra paquetes extraneous; `npm outdated` no respondio | LOW | [03-CONNECTIONS-AND-DEPLOYMENT.md](./03-CONNECTIONS-AND-DEPLOYMENT.md) |

## Problemas criticos

### [BLOCKER] Ranking y resultados confiados al cliente

**Estado:** Confirmado  
**Archivo:** `app/api/matches/results/route.ts`, `app/play/components/TacticalGame.tsx`, `app/play/components/MultiplayerGame.tsx`  
**Simbolo relacionado:** `POST`, `fetch("/api/matches/results")`  
**Sistema:** Backend / Juego / Multijugador  
**Descripcion:**  
El endpoint que crea `Match`, `MatchResult` y `UserStats` acepta `matchId`, `mode`, `status`, `winnerId`, `result` y `scoreEarned` desde el navegador autenticado.

**Evidencia:**  
`app/api/matches/results/route.ts` valida que los campos existan, pero no recalcula ganador, puntuacion, duracion ni resultado desde un estado autoritativo. `TacticalGame.tsx` y `MultiplayerGame.tsx` hacen el `fetch` al terminar.

**Consecuencia:**  
Un usuario autenticado puede fabricar victorias, puntajes o resultados con una llamada HTTP manual. Bloquea ranking competitivo y estadisticas confiables.

**Como reproducirlo:**  
Con sesion iniciada, enviar `POST /api/matches/results` con JSON valido y `scoreEarned` arbitrario. No se probo contra DB real para no alterar datos.

**Recomendacion:**  
Mover el guardado de resultados al servidor autoritativo; para multijugador, el Socket.IO server debe firmar o enviar resultados al backend con secreto server-to-server. Para local, limitar puntaje o tratarlo como modo no competitivo.

**Dependencias afectadas:**  
`UserStats`, ranking, perfil, `Match`, `MatchResult`, UI de resultados.

### [BLOCKER] No existe reconexion real de jugadores multijugador

**Estado:** Confirmado  
**Archivo:** `server/socketServer.ts`, `app/play/components/MultiplayerGame.tsx`  
**Simbolo relacionado:** `disconnect`, `getPlayerBySocket`, `handleConnect`  
**Sistema:** Multijugador  
**Descripcion:**  
El cliente intenta reconectar Socket.IO, pero el servidor identifica al jugador solo por `socket.id`. Al desconectarse, lo marca como eliminado/left y no hay token o evento para recuperar identidad.

**Evidencia:**  
`disconnect` en `server/socketServer.ts` cambia `player.connected = false`; si la sala esta jugando llama `eliminatePlayer`. No existe evento `rejoin`, `resume`, ni almacenamiento de `playerId` en cliente para reclamar estado.

**Consecuencia:**  
Una desconexion temporal en movil o Render elimina al jugador. La promesa de reconexion no se cumple.

**Como reproducirlo:**  
Crear sala, iniciar partida, cortar conexion del socket. El codigo marca al jugador como perdido.

**Recomendacion:**  
Crear token de sala/jugador, guardar estado por `playerId`, permitir ventana de reconexion y diferenciar desconexion transitoria de abandono.

**Dependencias afectadas:**  
Lobby, resultados, experiencia movil, ranking, Render.

### [CRITICAL] Sesion sin expiracion y con secreto fallback de desarrollo

**Estado:** Confirmado  
**Archivo:** `lib/auth-session.ts`  
**Simbolo relacionado:** `SESSION_SECRET`, `createUserSession`, `decodeSession`  
**Sistema:** Backend / Seguridad  
**Descripcion:**  
La cookie se firma con `SESSION_SECRET`, pero si falta usa `"dev-only-speleum-session-secret-change-me"`. Ademas no hay expiracion ni rotacion.

**Evidencia:**  
`SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only..."`; `cookieStore.set` no define `maxAge` ni `expires`; el payload es solo `userId`.

**Consecuencia:**  
En produccion mal configurada, todas las sesiones comparten un secreto predecible. Las sesiones no caducan por tiempo.

**Como reproducirlo:**  
Omitir `SESSION_SECRET` y registrar/login; la app firmara cookies con fallback.

**Recomendacion:**  
Fallar el arranque/build server si falta `SESSION_SECRET` en produccion; incluir expiracion, rotacion y version de token.

**Dependencias afectadas:**  
AuthProvider, `/api/auth/session`, `/profile`, `/play`, resultados.

### [CRITICAL] Correo depende solo de Resend y falla sin `RESEND_API_KEY`

**Estado:** Confirmado  
**Archivo:** `lib/auth-email.ts`, `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts`  
**Simbolo relacionado:** `sendAuthCodeEmail`, `isDemoAuthCodesEnabled`  
**Sistema:** Backend / Conexiones  
**Descripcion:**  
No hay Nodemailer. Si falta `RESEND_API_KEY`, el codigo se imprime en consola y se devuelve error, salvo que `DEMO_AUTH_CODES=true`.

**Evidencia:**  
`sendAuthCodeEmail` retorna `{ ok:false, mode:"not-configured" }`; los endpoints devuelven 502 si delivery falla y demo no esta activo.

**Consecuencia:**  
Registro/login quedan bloqueados en produccion si Resend o dominio/remitente no estan listos.

**Como reproducirlo:**  
Ejecutar registro sin `RESEND_API_KEY` y sin demo; endpoint retorna error.

**Recomendacion:**  
Definir configuracion de Resend por entorno, dominio verificado, fallback controlado de demo solo para staging y mensajes claros.

**Dependencias afectadas:**  
Registro, login 2FA, resend, entregabilidad de correo.

### [HIGH] Proteccion de rutas sensibles depende del cliente

**Estado:** Confirmado  
**Archivo:** `app/play/components/PlayScene.tsx`, `app/profile/profile-panel.tsx`  
**Simbolo relacionado:** `router.replace("/login")`  
**Sistema:** Frontend / Auth  
**Descripcion:**  
`/play` y `/profile` son rutas estaticas. La redireccion ocurre despues de montar cliente y consultar `/api/auth/session`.

**Evidencia:**  
`PlayScene` y `ProfilePanel` revisan `status` en `useEffect`. No hay `middleware.ts` ni layout server que haga `requireCurrentUser`.

**Consecuencia:**  
Se puede cargar HTML/JS de pantallas protegidas; las APIs protegidas responden 401, pero la UX y el control de acceso de pagina son debiles.

**Como reproducirlo:**  
Abrir `/play` sin sesion; la ruta carga y luego redirige.

**Recomendacion:**  
Agregar middleware o server component guard para rutas privadas.

**Dependencias afectadas:**  
AuthProvider, perfil, play, ranking indirecto.

## Plan realista para las ultimas dos semanas

1. Bloqueadores:
   - Cerrar integridad de resultados. Decidir si ranking competitivo solo acepta multijugador server-side.
   - Implementar reconexion minima o declarar desconexion como eliminacion intencional en UI/documentacion.
   - Exigir `SESSION_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `RESEND_API_KEY`/modo demo segun entorno.

2. Juego base:
   - Estabilizar loop local y multijugador; quitar logs de debug; definir condicion Battle Royale real.
   - Revisar cooldowns, parry, stun y mensajes para consistencia ES/EN.

3. Mapa y spawns:
   - Mantener mapa finito procedural. No intentar "infinito" en dos semanas.
   - Hacer que spawns iniciales los seleccione servidor con distancia minima, sin preferir spawns cercanos fijos.

4. Multijugador:
   - Token de jugador/sala para reconexion.
   - Limpieza de salas terminadas.
   - Autenticacion opcional de socket con usuario actual o al menos validacion de session token.

5. Autenticacion y correo:
   - Fail-fast de secretos en produccion.
   - Configurar Resend con dominio propio, SPF/DKIM y remitente real.
   - Limitar login/password y no loguear codigos salvo demo local.

6. Base de datos:
   - Validar migraciones contra Neon staging.
   - Agregar limpieza de `AuthChallenge` expirados.
   - Validar `activeCreature` contra lista.

7. Responsive:
   - Probar manualmente `/`, `/login`, `/play`, lobby y partida en 375px, 768px, laptop y desktop.
   - Ajustar HUD/radar/controles tactiles.

8. Despliegue y dominio:
   - Crear `.env.example`.
   - Configurar Vercel envs, Render envs, CORS y `NEXT_PUBLIC_SOCKET_URL`.
   - Verificar dominio y cookies HTTPS.

9. Pruebas finales:
   - Mantener `lint`, `tsc`, `build`.
   - Agregar pruebas unitarias para `pickSeparatedSpawns`, `generateProceduralCave`, `resolveCombatHit`, auth challenge.

10. Limpieza de codigo muerto:
   - Quitar assets de plantilla Next no usados.
   - Revisar `lib/session.ts` localStorage legacy.
   - Quitar textos temporales y logs.

## Comandos ejecutados

| Comando | Resultado | Observaciones |
| --- | --- | --- |
| `git status --short --branch` | OK | `## main...origin/main`; sin cambios antes de docs. |
| `rg --files ...` | OK | 106 archivos revisados fuera de generados. |
| `npm run lint` | OK | ESLint sin errores ni warnings emitidos. |
| `npx tsc --noEmit` | OK | TypeScript sin errores. No es script declarado. |
| `npm run build` | OK | `prisma generate && next build`; build de Next exitoso, 20 paginas generadas. |
| `npm run server` | Error operacional | Primer intento quedo sin salida antes del timeout y dejo el puerto ocupado; segundo intento fallo con `EADDRINUSE 0.0.0.0:4001`. Se cerro el proceso de este workspace. |
| `npm ls --depth=0` | OK con advertencias | Muestra paquetes `extraneous` en `node_modules`. |
| `npm outdated --depth=0` | No se pudo comprobar | Timeout tras 64s; no se inventa estado de versiones. |
| `npm test` | No ejecutado | No existe script `test` en `package.json`. |
| `npm run typecheck` | No ejecutado | No existe script `typecheck`; se uso `npx tsc --noEmit`. |

## Conteo de problemas por severidad

| Severidad | Cantidad documentada |
| --- | ---: |
| BLOCKER | 2 |
| CRITICAL | 4 |
| HIGH | 11 |
| MEDIUM | 14 |
| LOW | 8 |
| INFO | 6 |

## Cinco bloqueadores principales

1. Ranking/estadisticas aceptan resultados desde el cliente.
2. Reconexion multijugador no existe realmente.
3. Secretos de sesion/auth tienen fallback de desarrollo.
4. Produccion de correo depende de Resend correctamente configurado.
5. Multijugador vive en memoria y no persiste resultados desde el servidor.

## No se pudo comprobar

- Conexion real a Neon: no se ejecutaron migraciones ni queries manuales para no alterar datos.
- Envio real de correo: no se envio email para no usar credenciales/servicio.
- Responsive visual en navegador: no hay Playwright/script e2e instalado y no se instalaron herramientas.
- `npm outdated`: timeout.
- Dominio Vercel/Render real: no hay configuracion de despliegue en repo aparte de scripts/envs.
- Funcionamiento de una partida multijugador completa con dos navegadores reales: no se levanto entorno visual.

## Apendice: inventario de archivos revisados

Inventario confirmado antes de crear `docs/project-audit/`: 106 archivos de proyecto, excluyendo `node_modules`, `.next`, builds y caches.

```text
tsconfig.json
postcss.config.mjs
package.json
package-lock.json
next.config.ts
eslint.config.mjs
README.md
server/socketServer.ts
prisma/schema.prisma
prisma/migrations/migration_lock.toml
prisma/migrations/20260513153000_email_auth_challenges/migration.sql
prisma/migrations/20260511022301_init/migration.sql
lib/theme/ThemeProvider.tsx
lib/theme/theme.ts
lib/socket.ts
lib/session.ts
lib/ranking.ts
lib/prisma.ts
lib/i18n/messages.ts
lib/i18n/LanguageProvider.tsx
lib/i18n/content.ts
lib/creatures.ts
lib/auth.ts
lib/auth-session.ts
lib/auth-email.ts
lib/auth-challenge.ts
lib/auth-api.ts
app/layout.tsx
app/page.tsx
app/globals.css
app/favicon.ico
app/ranking.tsx
app/world/page.tsx
app/ranking/page.tsx
app/profile/profile-panel.tsx
app/profile/page.tsx
app/How-to-play/page.tsx
app/login/page.tsx
app/auth/AuthProvider.tsx
app/components/ThemeSwitcher.tsx
app/components/PreferenceToggleGroup.tsx
app/components/LanguageSwitcher.tsx
app/play/types.ts
app/play/tileMap.ts
app/play/signalUtils.ts
app/play/proceduralCave.ts
app/play/page.tsx
app/play/gameLogic.ts
app/play/gameConfig.ts
app/play/components/TacticalGame.tsx
app/play/components/RadarPanel.tsx
app/play/components/PlayScene.tsx
app/play/components/PlayMenu.tsx
app/play/components/PauseOverlay.tsx
app/play/components/MultiplayerMenu.tsx
app/play/components/MultiplayerGame.tsx
app/play/components/MatchmakingScreen.tsx
app/play/components/LoadingCaveScreen.tsx
app/play/components/GameTopControls.tsx
app/play/components/GameOverlay.tsx
app/play/components/GameMap.tsx
app/play/components/GameHud.tsx
app/play/components/CharacterSelect.tsx
app/play/components/ActionControls.tsx
app/api/ranking/route.ts
app/api/profile/route.ts
app/api/users/me/active-creature/route.ts
app/api/auth/login/route.ts
app/api/auth/register/route.ts
app/api/auth/verify-login-code/route.ts
app/api/auth/session/route.ts
app/api/auth/verify-email-code/route.ts
app/api/auth/resend-code/route.ts
app/api/matches/results/route.ts
docs/USO_IA.md
docs/SERVICIOS.md
docs/MEJORAS_FUTURAS.md
docs/EJECUCION.md
docs/DISENO_JUEGO_SPELEUM.md
docs/BASE_DE_DATOS.md
docs/ARQUITECTURA.md
public/window.svg
public/vercel.svg
public/readme/speleum-banner.svg
public/next.svg
public/Grafico/Nombre.svg
public/Grafico/Nombre.png
public/Grafico/Nombre-white.svg
public/Grafico/Logo Speleum.svg
public/Grafico/Logo Speleum.png
public/Grafico/logo simple.svg
public/Grafico/Logo simple.png
public/Grafico/Logo blanco.svg
public/Grafico/Logo blanco.png
public/globe.svg
public/file.svg
public/creatures/pez-juego.png
public/creatures/pez-ilustracion.png
public/creatures/Cangrejo-juego.png
public/creatures/Cangrejo-ilustracion.png
public/creatures/Camaron-juego.png
public/creatures/Camaron-ilustracion.png
public/creatures/Araña-juego.png
public/creatures/Araña-ilustracion.png
public/creatures/Ajolote-juego.png
public/creatures/Ajolote-ilustacion.png
```

## Confirmacion de alcance

No se modifico codigo fuente, configuracion, schema ni assets. Los unicos archivos nuevos intencionales son los documentos dentro de `docs/project-audit/`.
