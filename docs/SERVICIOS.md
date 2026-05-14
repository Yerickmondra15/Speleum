# Servicios y Endpoints de Speleum

Este documento describe unicamente las APIs reales presentes en `app/api`.

## Resumen de rutas existentes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/resend-code`
- `POST /api/auth/verify-email-code`
- `POST /api/auth/verify-login-code`
- `GET /api/auth/session`
- `DELETE /api/auth/session`
- `GET /api/profile`
- `GET /api/ranking`
- `POST /api/matches/results`
- `PATCH /api/users/me/active-creature`

## Autenticacion

### POST /api/auth/register

Descripción:
Registra un nuevo usuario, crea su registro inicial de estadísticas y genera un código de verificación por correo.

Entrada:

```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

Reglas visibles en el código:

- `username` con al menos 3 caracteres
- `email` válido
- `password` con al menos 6 caracteres

Respuesta:

- `201` con un objeto `PendingAuthResponse`:

```json
{
  "status": "pending_email_verification",
  "challengeId": "string",
  "email": "string",
  "expiresAt": "ISO date",
  "resendAvailableAt": "ISO date",
  "message": "string",
  "demoCode": "string opcional"
}
```

Errores:

- `400` si faltan datos o no cumplen validación
- `409` si el correo o el nombre ya existen
- `502` si el correo no pudo enviarse y no está activo el modo demo
- `429`, `404`, `410`, `500` según fallos de retos de autenticación

### POST /api/auth/login

Descripción:
Valida correo y contraseña. Si son correctos, genera un reto de verificación de correo o un código de segundo factor para completar el acceso.

Entrada:

```json
{
  "email": "string",
  "password": "string"
}
```

Respuesta:

- `200` con `PendingAuthResponse`
- Si el correo aún no está verificado, responde con `status: "pending_email_verification"`
- Si el usuario ya está verificado, responde con `status: "pending_login_verification"`

Errores:

- `400` si faltan correo o contraseña
- `401` si las credenciales son inválidas
- `502` si falla el envío del correo y no está activo el modo demo
- errores de retos como `429`, `404`, `410` o `500`

### POST /api/auth/resend-code

Descripción:
Reenvía un código de verificación o de login usando un reto activo.

Entrada:

```json
{
  "challengeId": "string",
  "email": "string"
}
```

Respuesta:

- `200` con `PendingAuthResponse` actualizado

Errores:

- `400` si no se encuentra un desafío válido en la entrada
- `404` si el reto ya no existe
- `409` si el reto ya fue usado
- `410` si el reto expiró
- `429` por enfriamiento, límite de reenvíos o demasiados intentos
- `502` si falla el correo y no está activo el modo demo

### POST /api/auth/verify-email-code

Descripción:
Verifica el código de activación del correo, marca el usuario como verificado y crea la sesión.

Entrada:

```json
{
  "challengeId": "string",
  "email": "string",
  "code": "string de 6 dígitos"
}
```

Respuesta:

- `200` con:

```json
{
  "status": "authenticated",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "emailVerified": true,
    "activeCreature": "string",
    "createdAt": "ISO date"
  }
}
```

Errores:

- `400` si el código no tiene 6 dígitos o es inválido
- `404` si no existe reto o usuario válido
- `409` si el código ya fue usado
- `410` si expiró
- `429` si se superaron intentos
- `500` si ocurre un fallo interno

### POST /api/auth/verify-login-code

Descripción:
Verifica el segundo paso del login, actualiza `lastLoginAt`, reinicia fallos de acceso y crea la sesión.

Entrada:

```json
{
  "challengeId": "string",
  "email": "string",
  "code": "string de 6 dígitos"
}
```

Respuesta:

- `200` con:

```json
{
  "status": "authenticated",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "emailVerified": true,
    "activeCreature": "string",
    "createdAt": "ISO date"
  }
}
```

Errores:

- `400` si el código es inválido o incompleto
- `404` si no existe reto o usuario válido
- `409` si el código ya fue usado
- `410` si expiró
- `429` si se agotaron intentos
- `500` si ocurre un fallo interno

### GET /api/auth/session

Descripción:
Consulta el usuario autenticado actualmente según la cookie de sesión.

Entrada:
No requiere body.

Respuesta:

- `200` con:

```json
{
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "emailVerified": true,
    "activeCreature": "string",
    "createdAt": "ISO date"
  }
}
```

- Si no hay sesión:

```json
{
  "user": null
}
```

Errores:

- No expone errores específicos en el flujo normal; responde `200`

### DELETE /api/auth/session

Descripción:
Cierra la sesión eliminando la cookie del usuario.

Entrada:
No requiere body.

Respuesta:

- `204 No Content`

Errores:

- No define un flujo de error especial en la ruta

## Perfil

### GET /api/profile

Descripción:
Devuelve la información de perfil y estadísticas del usuario autenticado.

Entrada:
No requiere body.

Respuesta:

```json
{
  "username": "string",
  "email": "string",
  "activeCreature": "string",
  "matchesPlayed": 0,
  "wins": 0,
  "losses": 0,
  "score": 0,
  "lastMatchAt": "ISO date o null"
}
```

Errores:

- `401` si no hay usuario autenticado
- `404` si el usuario no existe en la base de datos

### PATCH /api/users/me/active-creature

Descripción:
Actualiza la criatura activa del usuario autenticado.

Entrada:

```json
{
  "activeCreature": "string"
}
```

Respuesta:

```json
{
  "id": "string",
  "activeCreature": "string"
}
```

Errores:

- `400` si `activeCreature` no llega informado
- `401` si no hay sesión válida

## Ranking

### GET /api/ranking

Descripción:
Devuelve el ranking persistido a partir de `UserStats`, enlazado con los datos visibles del usuario.

Entrada:
No requiere body.

Respuesta:

```json
[
  {
    "rank": 1,
    "userId": "string",
    "username": "string",
    "activeCreature": "string",
    "matchesPlayed": 0,
    "wins": 0,
    "losses": 0,
    "score": 0,
    "lastMatchAt": "ISO date o null"
  }
]
```

Errores:

- La ruta actual no define respuestas de error personalizadas

## Resultados y puntuaciones

### POST /api/matches/results

Descripción:
Guarda el resultado de una partida para el usuario autenticado. También crea o actualiza la partida y actualiza las estadísticas acumuladas.

Entrada:

```json
{
  "matchId": "string",
  "mode": "string",
  "status": "string",
  "winnerId": "string o null",
  "startedAt": "ISO date o null",
  "endedAt": "ISO date o null",
  "creature": "string",
  "result": "win o loss",
  "scoreEarned": 0
}
```

Notas del flujo real:

- `matchId`, `mode`, `status`, `creature` y `result` son obligatorios
- si el resultado del mismo `matchId` y usuario ya existe, no lo duplica
- actualiza `UserStats` en la misma transacción

Respuesta:

- `201` con:

```json
{
  "id": "string"
}
```

Errores:

- `400` si faltan datos mínimos para guardar la partida
- `401` si el usuario no está autenticado
- `500` si falla el guardado del resultado

## Servicio multijugador complementario

Además de las APIs HTTP, Speleum usa [server/socketServer.ts](C:/Users/yeric/Desktop/Speleum/speleum/server/socketServer.ts) para salas en tiempo real con Socket.IO. Ese módulo en evolución no expone endpoints REST adicionales dentro de `app/api`, pero sí sincroniza:

- movimiento
- ataque
- defensa
- enemigos
- señales de radar
- estado de sala y partida
