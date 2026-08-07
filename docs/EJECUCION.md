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

Entrega de autenticación: `AUTH_DELIVERY_MODE` es obligatoria y acepta únicamente `demo` o `email`.

- `demo`: devuelve el código de un solo uso únicamente a la respuesta que creó o reenvió el desafío. En producción exige `ALLOW_PUBLIC_DEMO_AUTH=true`.
- `email`: exige `RESEND_API_KEY` y `AUTH_EMAIL_FROM`; nunca cambia automáticamente a `demo` si Resend falla.

Límites: `AUTH_CODE_EXPIRATION_MINUTES`, `AUTH_CODE_MAX_ATTEMPTS`, `AUTH_RESEND_COOLDOWN_SECONDS`, `AUTH_MAX_RESENDS`, `AUTH_RATE_LIMIT_WINDOW_MINUTES`, `AUTH_RATE_LIMIT_PER_EMAIL`, `AUTH_RATE_LIMIT_PER_IP`, `AUTH_LOGIN_LOCK_THRESHOLD`, `AUTH_LOGIN_LOCK_BASE_SECONDS`, `AUTH_LOGIN_LOCK_MAX_MINUTES`.

No existe un modo de entrega predeterminado silencioso. Si falta `AUTH_DELIVERY_MODE`, si tiene otro valor o si se intenta usar `demo` en producción sin confirmación, la API falla con un error de configuración claro.

### Dónde configurar cada variable

- `.env.local` y Vercel (proceso Next.js): todas las variables `AUTH_*`, `ALLOW_PUBLIC_DEMO_AUTH`, `RESEND_API_KEY` y `AUTH_EMAIL_FROM`, además de base de datos y sesión.
- Render/servidor Socket.IO separado: ninguna variable de entrega de códigos ni de bloqueo. Solo necesita sus variables de red y los secretos de socket/resultado ya documentados.

El modo `demo` no comprueba que el usuario sea dueño del correo, no es 2FA real y permite que cualquiera con una contraseña válida vea el código en esa misma pantalla. Debe cambiarse a `email` cuando exista un dominio de envío verificado.

### Preferencia visual pública

El tema se resuelve con esta prioridad: preferencia válida del dispositivo en `localStorage`, futura preferencia de cuenta si se incorpora sincronización explícita y, finalmente, oscuro como valor inicial. Actualmente no se persiste tema en la base de datos. Un script `beforeInteractive` aplica la preferencia local antes de hidratar para evitar destellos; el proveedor React usa el mismo estado externo sin leer `window` durante el renderizado del servidor. Cerrar sesión elimina únicamente la sesión y conserva el tema general del dispositivo, que puede cambiarse desde las páginas públicas.

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
- Resend rechaza el dominio: verificar el dominio/remitente de `AUTH_EMAIL_FROM`; el API devuelve un error seguro y deja el desafío fallido invalidado.
- Reconexión perdida tras reinicio: es una limitación conocida de la memoria local.

En algunas instalaciones Windows con inspección TLS corporativa, Node puede requerir `NODE_OPTIONS=--use-system-ca`. No desactivar la verificación TLS.
