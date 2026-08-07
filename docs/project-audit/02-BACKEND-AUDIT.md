# Speleum - Backend audit

Este documento cubre APIs, autenticacion, Prisma, estadisticas y seguridad. Ver tambien [03-CONNECTIONS-AND-DEPLOYMENT.md](./03-CONNECTIONS-AND-DEPLOYMENT.md).

## APIs y route handlers

| Metodo | Ruta | Archivo | Body/params | Auth | DB | Consumidor | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | `app/api/auth/register/route.ts` | `username`, `email`, `password` | No | `User`, `UserStats`, `AuthChallenge` | `AuthProvider.register` | Funcional con errores |
| `POST` | `/api/auth/login` | `app/api/auth/login/route.ts` | `email`, `password` | No | `User`, `AuthChallenge` | `AuthProvider.login` | Funcional con errores |
| `POST` | `/api/auth/verify-email-code` | `app/api/auth/verify-email-code/route.ts` | `challengeId`, `email`, `code` | No | `AuthChallenge`, `User` | `AuthProvider.verifyEmailCode` | Funcional |
| `POST` | `/api/auth/verify-login-code` | `app/api/auth/verify-login-code/route.ts` | `challengeId`, `email`, `code` | No | `AuthChallenge`, `User` | `AuthProvider.verifyLoginCode` | Funcional |
| `POST` | `/api/auth/resend-code` | `app/api/auth/resend-code/route.ts` | `challengeId`, `email` | No | `AuthChallenge` | `AuthProvider.resendCode` | Funcional con errores |
| `GET` | `/api/auth/session` | `app/api/auth/session/route.ts` | Ninguno | Cookie opcional | `User` | `AuthProvider` | Funcional |
| `DELETE` | `/api/auth/session` | `app/api/auth/session/route.ts` | Ninguno | Cookie opcional | No | `logout` | Funcional |
| `GET` | `/api/profile` | `app/api/profile/route.ts` | Ninguno | Si | `User`, `UserStats` | `ProfilePanel` | Funcional |
| `GET` | `/api/ranking` | `app/api/ranking/route.ts` | Ninguno | No | `UserStats`, `User` | `RankingView` | Funcional con riesgo |
| `PATCH` | `/api/users/me/active-creature` | `app/api/users/me/active-creature/route.ts` | `activeCreature` | Si | `User` | `AuthProvider.updateActiveCreature` | Funcional con errores |
| `POST` | `/api/matches/results` | `app/api/matches/results/route.ts` | `matchId`, `mode`, `status`, `winnerId`, `creature`, `result`, `scoreEarned`, fechas | Si | `Match`, `MatchResult`, `UserStats` | `TacticalGame`, `MultiplayerGame` | Funcional pero inseguro |

## Autenticacion

Registro:

1. `POST /api/auth/register` valida username >= 3, email regex simple, password >= 6.
2. Busca usuario por username case-insensitive o email.
3. Hashea password con `bcryptjs` `hash(password, 12)`.
4. Crea `User` y `UserStats`.
5. Emite `AuthChallenge` tipo `email_verification` por 15 minutos.
6. Intenta enviar email con Resend.
7. Si envio falla y `DEMO_AUTH_CODES` no esta activo, responde 502.

Login:

1. `POST /api/auth/login` busca por email.
2. Compara password con `bcryptjs`.
3. Si falla, incrementa `failedLoginAttempts`, pero no bloquea ni aplica rate limit de password.
4. Si email no verificado, reemite reto `email_verification`.
5. Si email verificado, emite reto `login_2fa` por 10 minutos.

Verificacion:

- `verifyAuthChallenge` busca por `challengeId`, `email`, `type`.
- Rechaza consumidos, expirados y exceso de intentos.
- Compara HMAC SHA-256 con `timingSafeEqual`.
- Al acertar, marca todos los retos activos de ese email/tipo como consumidos.
- `verify-email-code` marca `emailVerified` y crea sesion.
- `verify-login-code` actualiza `lastLoginAt` y crea sesion.

Cookie:

- Nombre: `speleum_session`.
- `httpOnly: true`, `sameSite: "lax"`, `secure` solo en produccion.
- Payload: `userId` en base64url + firma HMAC.
- No hay `maxAge`, `expires`, `iat`, `exp` ni rotacion.

Proveedor de correo real:

- Confirmado: Resend API directa.
- No se usa Nodemailer.
- Si falta `RESEND_API_KEY`, se loguea `[auth-email-preview] email subject code` y retorna error.
- Remitente default: `Speleum <onboarding@resend.dev>` si falta `EMAIL_FROM`.

Modo demo:

- `DEMO_AUTH_CODES=true` permite que endpoints no fallen por delivery.
- `DEMO_AUTH_CODES_PUBLIC=true` expone `demoCode` en la respuesta.

No existe:

- Recuperacion de cuenta.
- Cambio de password.
- Expiracion de sesion.
- Middleware de autorizacion de paginas.
- Bloqueo por `failedLoginAttempts`.

## Prisma y base de datos

Modelos confirmados:

- `User`
- `AuthChallenge`
- `UserStats`
- `Match`
- `MatchResult`

Relaciones:

- `User.stats` 1:1 con cascade delete.
- `User.matchResults` 1:N con cascade delete.
- `User.matchesWon` via `Match.winnerId` con `onDelete: SetNull`.
- `AuthChallenge.userId` opcional con cascade delete.
- `Match.results` 1:N cascade delete.

Indices:

- `User.username` unique.
- `User.email` unique.
- `UserStats.userId` unique.
- `AuthChallenge.email`, `userId`, `[type,email,consumedAt]`, `expiresAt`.
- `Match.winnerId`, `startedAt`.
- `MatchResult.[matchId,userId]` unique; `[userId,createdAt]`.

Diferencias/riesgos:

- `User.twoFactorEnabled` existe pero no se usa para saltar 2FA; login siempre emite `login_2fa` si email verificado.
- `failedLoginAttempts` se incrementa, pero no se consulta para bloquear.
- `AuthChallenge` expirados quedan en DB; no hay job de limpieza.
- `Match`/`MatchResult` se crean desde cliente, no desde servidor autoritativo.

## Estadisticas y partidas

Juego local:

- `TacticalGame` crea `matchId` con `crypto.randomUUID()`.
- Al ganar/perder, envia `/api/matches/results`.
- `winnerId` es `user?.id` si gano local; si pierde, null.
- `scoreEarned` es el estado local `score`.
- Si falla fetch, solo resetea `resultSavedRef`; no informa al usuario.

Multijugador:

- Socket.IO server crea `matchId` y resultados en memoria.
- Al recibir estado `finished`, `MultiplayerGame` calcula si gano (`gameState.winnerId === gameState.self.id`) y calcula `scoreEarned` en cliente.
- El backend no verifica que `winnerId` del socket coincida con usuario autenticado.
- El servidor Socket.IO no conoce la sesion Next ni `User.id`; sus `player.id` son UUID temporales.

Ranking:

- `/api/ranking` lee `UserStats` ordenado por score desc, wins desc, matchesPlayed asc.
- La integridad queda comprometida porque `UserStats` se actualiza desde resultados enviados por cliente.

Que pasa si:

- Neon no esta disponible: APIs Prisma fallan y devuelven 500/401 generico segun handler.
- Servidor Socket.IO se reinicia: salas y partidas se pierden.
- Jugador se desconecta: servidor lo marca `left` o lo elimina si estaba jugando.
- Partida no termina: no hay persistencia parcial ni recovery.

## Seguridad

Riesgos confirmados:

- Fallback de `SESSION_SECRET` y `AUTH_CODE_SECRET`.
- Sesion sin expiracion.
- Falta CSRF para endpoints POST/PATCH/DELETE basados en cookie.
- Falta rate limit de login/password.
- Enumeracion parcial: registro diferencia email existente vs username existente.
- `activeCreature` acepta cualquier string.
- Resultados/puntaje confiados al cliente.
- Socket.IO sin autenticacion de usuario.
- Codigos de email logueados si Resend no esta configurado.
- `ALLOWED_ORIGINS` acepta cualquier `*.vercel.app` por regex para preview.
- No hay validacion de origen adicional en APIs Next.

## Matriz backend

| Sistema | Archivo | Estado | Problema | Severidad | Recomendacion |
| --- | --- | --- | --- | --- | --- |
| Resultados | `app/api/matches/results/route.ts` | Funcional inseguro | Confia en cliente | BLOCKER | Guardado autoritativo server-side. |
| Sesion | `lib/auth-session.ts` | Funcional inseguro | Fallback secreto, sin exp | CRITICAL | Exigir secreto y expiracion. |
| Correo | `lib/auth-email.ts` | Parcial | Resend obligatorio o demo | CRITICAL | Configurar dominio/envs y fallback controlado. |
| Login | `app/api/auth/login/route.ts` | Parcial | No bloquea por intentos | HIGH | Rate limit y lock temporal. |
| Auth challenge | `lib/auth-challenge.ts` | Funcional | Retos expirados sin limpieza | MEDIUM | Job cron o limpieza opportunistic. |
| Active creature | `active-creature/route.ts` | Funcional inseguro | No valida criatura | MEDIUM | Validar contra `creatures`. |
| Profile | `app/api/profile/route.ts` | Funcional | Error catch trata todo como 401 | LOW | Diferenciar DB vs auth. |
| Ranking | `app/api/ranking/route.ts` | Funcional con riesgo | Sin paginacion/cache | LOW | Paginacion y fuente confiable. |

## Problemas importantes

### [BLOCKER] Resultados y puntajes manipulables

**Estado:** Confirmado  
**Archivo:** `app/api/matches/results/route.ts`  
**Simbolo relacionado:** `POST`  
**Sistema:** Backend  
**Descripcion:** El endpoint acepta resultado y puntaje desde el navegador.

**Evidencia:** `scoreEarned` se toma de `body`; `winnerId` se toma de `body.winnerId`.

**Consecuencia:** Ranking no confiable.

**Como reproducirlo:** Con cookie valida, enviar JSON arbitrario. No se ejecuto para no alterar DB.

**Recomendacion:** Persistir solo resultados calculados server-side.

**Dependencias afectadas:** Ranking, perfil, Match, MatchResult.

### [CRITICAL] Fallback de secreto de sesion

**Estado:** Confirmado  
**Archivo:** `lib/auth-session.ts`  
**Simbolo relacionado:** `SESSION_SECRET`  
**Sistema:** Backend / Seguridad  
**Descripcion:** Si falta la variable se usa secreto predecible.

**Evidencia:** `process.env.SESSION_SECRET ?? "dev-only..."`.

**Consecuencia:** Riesgo de falsificacion de cookies en produccion mal configurada.

**Como reproducirlo:** Arrancar sin `SESSION_SECRET`.

**Recomendacion:** Throw en produccion si falta.

**Dependencias afectadas:** Todas las rutas autenticadas.

### [HIGH] No hay CSRF en endpoints con cookie

**Estado:** Probable  
**Archivo:** `app/api/**/route.ts`  
**Simbolo relacionado:** `POST`, `PATCH`, `DELETE`  
**Sistema:** Backend / Seguridad  
**Descripcion:** Las APIs usan cookie `sameSite:lax` pero no token CSRF.

**Evidencia:** No hay middleware, token ni validacion de header CSRF.

**Consecuencia:** Riesgo en acciones state-changing, especialmente si cambia SameSite o flujos cross-site.

**Como reproducirlo:** No se ejecuto ataque; hallazgo por ausencia de defensa.

**Recomendacion:** Token CSRF o validar Origin/Referer para mutaciones.

**Dependencias afectadas:** Auth, perfil, resultados.
