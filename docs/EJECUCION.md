# Ejecución y despliegue

## Requisitos

- Node.js 20
- npm
- PostgreSQL
- Resend para correo real

## Variables

Copiar `.env.example` a `.env`.

Obligatorias para datos: `DATABASE_URL`, `DIRECT_URL`.

Obligatorias en producción y con mínimo 32 caracteres: `SESSION_SECRET`, `AUTH_CODE_SECRET`, `SOCKET_AUTH_SECRET`, `MULTIPLAYER_RESULT_SECRET`.

Red: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SOCKET_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `PORT`. Si frontend y sockets se despliegan separados, ambos procesos deben compartir los dos secretos de socket/resultado y el servidor debe permitir el origen exacto del frontend.

Correo: `RESEND_API_KEY`, `EMAIL_FROM`.

Límites: `AUTH_RESEND_COOLDOWN_SECONDS`, `AUTH_MAX_VERIFY_ATTEMPTS`, `AUTH_MAX_RESENDS`, `AUTH_RATE_LIMIT_WINDOW_MINUTES`, `AUTH_RATE_LIMIT_PER_EMAIL`, `AUTH_RATE_LIMIT_PER_IP`, `AUTH_LOGIN_LOCK_THRESHOLD`, `AUTH_LOGIN_LOCK_BASE_SECONDS`, `AUTH_LOGIN_LOCK_MAX_MINUTES`.

`DEMO_AUTH_CODES` y `DEMO_AUTH_CODES_PUBLIC` deben ser `false` en producción.

## Instalación

```bash
npm ci
npx prisma migrate deploy
```

## Desarrollo

```bash
npm run dev       # Next.js
npm run socket    # Socket.IO
npm run dev:full  # ambos
```

## Validación

```bash
npx prisma validate
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Producción

Frontend/API:

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start
```

Socket.IO:

```bash
npm ci
npm run socket
```

Socket.IO necesita un host con proceso persistente y WebSockets; no debe ejecutarse como una función serverless efímera. Next.js puede desplegarse aparte. El almacenamiento actual exige exactamente una instancia de sockets.

## Diagnóstico

- Error de secreto: comprobar longitud y que la variable esté disponible en el proceso correcto.
- `AUTH_INVALID_TICKET`: iniciar sesión y solicitar un ticket nuevo; cada ticket se usa una vez.
- CORS: añadir el origen completo a `ALLOWED_ORIGINS`, separado por comas.
- Prisma no generado: ejecutar `npx prisma generate`.
- Esquema no actualizado: ejecutar `npx prisma migrate deploy` con `DIRECT_URL` accesible.
- Reconexión perdida tras reinicio: es una limitación conocida de la memoria local.

En algunas instalaciones Windows con inspección TLS corporativa, Node puede requerir `NODE_OPTIONS=--use-system-ca`. No desactivar la verificación TLS.
