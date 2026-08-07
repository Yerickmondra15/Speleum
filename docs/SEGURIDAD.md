# Seguridad

## Modelo de confianza

El navegador no es una fuente confiable para identidad, puntuación ni ganador. Next.js autentica al usuario mediante una cookie firmada; Socket.IO recibe identidad mediante un ticket temporal firmado; el resultado competitivo vuelve a Next.js mediante un comprobante firmado por el servidor de juego.

## Sesión web

- Formato versionado `v: 1` con `sub`, `iat` y `exp`.
- HMAC-SHA256 y comparación segura de la firma.
- TTL de 7 días tanto dentro del token como en `maxAge` de la cookie.
- Cookie `httpOnly`, `sameSite=lax`, `path=/` y `secure` en producción.
- `SESSION_SECRET` es obligatorio en producción y debe tener al menos 32 caracteres.

## Login y códigos

- Los códigos de seis dígitos se generan con `crypto.randomInt`, se enlazan al `challengeId`, se almacenan únicamente como hash HMAC y vencen según `AUTH_CODE_EXPIRATION_MINUTES`.
- Un desafío consumido, vencido o con demasiados intentos no puede reutilizarse.
- Registro, login, verificación y reenvío usan esquemas Zod estrictos y límite del cuerpo HTTP.
- Cada contraseña incorrecta se registra mediante un `UPDATE` atómico. Tras cinco fallos, `lockedUntil` aplica bloqueos progresivos de 30, 60, 120 segundos y así sucesivamente hasta 15 minutos. Durante el bloqueo no se ejecuta bcrypt; el contador y `lockedUntil` se reinician después de verificar el acceso.
- Al operar autenticación se eliminan oportunísticamente desafíos con más de siete días.
- Si Resend falla, el desafío recién emitido se invalida y la API devuelve un mensaje seguro sin registrar correo, código ni cuerpo del proveedor.

### Riesgo explícito del modo demo

`AUTH_DELIVERY_MODE=demo` entrega el código solamente en la respuesta de creación/reenvío y la interfaz lo conserva únicamente en estado React. No usa URL, cookies, `localStorage` ni `sessionStorage`; recargar obliga a pedir otro código. Aun así, no verifica propiedad del correo, no equivale a 2FA y cualquier persona con la contraseña válida puede leer el código en esa pantalla. En producción requiere la aceptación explícita `ALLOW_PUBLIC_DEMO_AUTH=true` y debe sustituirse por `email` cuando haya un dominio verificado.

## Socket.IO

- `POST /api/socket/ticket` exige una sesión web válida.
- El ticket dura 60 segundos, incluye `sub`, `username`, `jti`, `iat`, `exp` y propósito, y está firmado.
- El middleware consume cada `jti` una sola vez y guarda la identidad en `socket.data`.
- La identidad no se acepta en eventos del cliente. `socket.id`, `player.id` y `userId` son valores distintos.
- `maxHttpBufferSize` es 16 KiB; todos los eventos tienen esquemas estrictos y las coordenadas deben ser finitas y estar dentro del mapa.
- CORS admite únicamente orígenes configurados, localhost y previews de Vercel con formato controlado.

La protección de replay es local al proceso. Para varias instancias necesita un almacén compartido y atómico.

## Resultados

- Local: contrato estricto, duración entre 1 segundo y 4 horas, `scoreEarned=0`, sin ganador persistido y sin efecto competitivo.
- Multijugador: el cliente solo envía `{ mode, receipt }`. El comprobante contiene usuario, ganador, criatura, resultado, score y fechas calculados por Socket.IO, y vence en 30 minutos.
- La API verifica firma, propósito, vencimiento, usuario de sesión, criatura y duración.
- Una transacción Prisma `Serializable`, más la restricción única `(matchId, userId)`, evita duplicar estadísticas. Una repetición idéntica devuelve `idempotent: true`; un resultado distinto devuelve `409`.

## Secretos obligatorios en producción

| Variable | Uso |
|---|---|
| `SESSION_SECRET` | sesión web |
| `AUTH_CODE_SECRET` | hash de códigos |
| `SOCKET_AUTH_SECRET` | tickets de conexión |
| `MULTIPLAYER_RESULT_SECRET` | comprobantes de resultados |

No deben usar el mismo valor. No llevan prefijo `NEXT_PUBLIC_` y nunca llegan al bundle del navegador.

## Riesgos restantes

- Los tickets consumidos y salas son memoria de una sola instancia.
- Los resultados previos a esta política no se reclasifican automáticamente.
- Falta una tarea programada independiente para limpiar desafíos si no hay tráfico de autenticación.
- La entrega del comprobante depende de que el cliente se conecte y llame a la API.
- `npm audit --omit=dev` reporta cero vulnerabilidades; queda un aviso bajo de desarrollo en `esbuild`, transitivo de `tsx`/Vitest.
