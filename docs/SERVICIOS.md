# Servicios y contratos

Todos los cuerpos modificadores se limitan en tamaño, deben ser JSON válido y pasan esquemas estrictos; campos desconocidos producen `400`.

## Autenticación

| Método y ruta | Autenticación | Propósito |
|---|---|---|
| `POST /api/auth/register` | no | crea o recupera cuenta y desafío de correo |
| `POST /api/auth/login` | no | valida contraseña, bloqueo y crea desafío 2FA |
| `POST /api/auth/resend-code` | no | reenvía un desafío válido con cooldown/límites |
| `POST /api/auth/verify-email-code` | no | consume código, verifica correo y crea sesión |
| `POST /api/auth/verify-login-code` | no | consume código, reinicia fallos y crea sesión |
| `GET /api/auth/session` | cookie | devuelve usuario actual |
| `DELETE /api/auth/session` | cookie | elimina cookie de sesión |

Los códigos no aparecen en logs. El modo demo debe mantenerse desactivado en producción.

## Ticket Socket.IO

### `POST /api/socket/ticket`

Requiere sesión. Devuelve `{ ticket, expiresAt }` con `Cache-Control: no-store`. El ticket dura 60 segundos, es HMAC, de un solo uso por instancia y no contiene secretos.

## Perfil y criatura

### `GET /api/profile?historyLimit=10`

Requiere sesión. `historyLimit` acepta 1–25. Devuelve únicamente el perfil propio: email, criatura, estadísticas, porcentaje, última partida e historial con modo, resultado, score, fecha, duración y nivel de verificación.

### `PATCH /api/users/me/active-creature`

Requiere sesión y `{ activeCreature }` perteneciente al catálogo real.

## Ranking

### `GET /api/ranking?page=1&limit=20`

Público. `page` empieza en 1 y `limit` acepta 1–50. Solo incluye `UserStats` con partidas competitivas, devuelve `entries` y `pagination`. No expone email.

## Resultados

### `POST /api/matches/results`

Requiere sesión y admite una unión discriminada:

```json
{
  "mode": "local",
  "matchId": "uuid",
  "status": "finished",
  "startedAt": "ISO-8601",
  "endedAt": "ISO-8601",
  "creature": "cave-axolotl",
  "result": "win"
}
```

Local siempre persiste score cero, ganador nulo y no modifica ranking.

```json
{ "mode": "multiplayer", "receipt": "token-firmado" }
```

Multi verifica que el comprobante pertenezca al usuario de la cookie. El cliente no puede enviar `winnerId`, `scoreEarned`, fechas o resultado por separado.

Respuestas relevantes: `201` creado, `200` repetición idempotente, `400` contrato/fecha, `401` sin sesión, `403` comprobante inválido/ajeno, `409` conflicto y `500` error inesperado.

## Eventos Socket.IO

Cliente: `create-room`, `join-room`, `resume-room`, `player-ready`, `player-move`, `player-attack`, `player-defend`, `leave-room`.

Servidor: `game-state`, `game-over`, `player-left`, `error-message`.

Todos los eventos entrantes reciben `unknown` y se validan. Ninguno acepta `userId`.
