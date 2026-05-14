# Speleum

Speleum es un juego web multijugador de supervivencia en cuevas. Controlas criaturas subterraneas, te mueves con vision limitada, lees ecos en el radar, atacas, te defiendes y compites por score y ranking.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Socket.IO
- PostgreSQL
- Prisma

## Estado actual

- Registro con verificacion de correo
- Inicio de sesion con 2FA por codigo enviado al correo
- Cookie de sesion creada solo despues de validar el codigo
- Perfil y ranking conectados a PostgreSQL
- Guardado de resultados y estadisticas con Prisma
- Modo local funcional con:
  - vision limitada de 8 tiles
  - movimiento por seleccion de celdas
  - combate por tiles
  - radar de ecos
  - defensa y cooldowns
- Base multijugador existente con Socket.IO, mantenida compatible

## Ejecutar

1. Instala dependencias:

```bash
npm install
```

2. Asegura estas variables en `.env`:

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `AUTH_CODE_SECRET` opcional, recomendado para separar la firma de codigos
- `RESEND_API_KEY` para intentar envio real con Resend
- `EMAIL_FROM` remitente de correo. Para demo en Vercel gratis puedes usar `Speleum <onboarding@resend.dev>`
- `DEMO_AUTH_CODES` opcional. Usa `true` solo en casos puntuales de demo o desarrollo

3. Genera Prisma y aplica migraciones en desarrollo:

```bash
npx prisma generate
npx prisma migrate dev
```

4. Inicia la app:

```bash
npm run dev
```

5. Configura multiplayer local:

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001
```

6. Si quieres levantar tambien el servidor de sockets:

```bash
npm run socket
```

7. Si quieres levantar frontend + socket al mismo tiempo:

```bash
npm run dev:full
```

8. El script anterior `dev:all` sigue disponible:

```bash
npm run dev:all
```

## Validacion

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Deploy y migraciones

- El build de produccion ejecuta `prisma generate` y `next build`.
- El deploy normal no ejecuta `prisma migrate deploy`.
- El flujo de auth por correo requiere que las migraciones de Prisma esten aplicadas antes de desplegar.
- Corre las migraciones manualmente solo cuando cambie la base de datos:

```bash
npx prisma migrate deploy
```

- Si prefieres usar el script del proyecto:

```bash
npm run db:migrate:deploy
```

## Correo de autenticacion en Vercel

- Si estas desplegando en un dominio gratuito `*.vercel.app`, no controlas el DNS del subdominio y no puedes verificar SPF/DKIM para enviar como `noreply@tu-app.vercel.app`.
- Para demo o presentacion puedes configurar:

```bash
EMAIL_FROM="Speleum <onboarding@resend.dev>"
```

- Para correo real profesional necesitas un dominio propio verificado en Resend.
- Variables recomendadas en Vercel:

- Variables recomendadas en Vercel sin dominio propio:

```bash
RESEND_API_KEY=...
EMAIL_FROM="Speleum <onboarding@resend.dev>"
```

- Si necesitas una presentacion puntual sin entrega real de correo, puedes activar temporalmente:

```bash
DEMO_AUTH_CODES=true
```

- Si `DEMO_AUTH_CODES=true`, el backend devolvera el codigo en la respuesta solo para ese uso puntual.
- Si `DEMO_AUTH_CODES` no esta activo, nunca se devuelve el codigo al frontend.

## Deploy del socket

- El frontend se despliega en Vercel.
- El servidor multiplayer de Socket.IO se despliega por separado en Render o Railway.
- En Render usa:

```bash
Build Command: npm ci
Start Command: npm run socket
```

- Tambien sigue siendo compatible con:

```bash
npx tsx server/socketServer.ts
```

- Render debe usar `process.env.PORT` automaticamente.
- CORS permite:
  - `localhost`
  - `127.0.0.1`
  - el dominio configurado en `FRONTEND_URL` o `NEXT_PUBLIC_APP_URL`
  - previews y produccion de `*.vercel.app`

## Variables de entorno para multiplayer

### Local

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001
```

### Produccion

```bash
NEXT_PUBLIC_SOCKET_URL=https://URL_DEL_SOCKET.onrender.com
```

- Vercel necesita `NEXT_PUBLIC_SOCKET_URL` para activar multiplayer.
- En Render pon:

```bash
FRONTEND_URL=https://URL_DE_VERCEL.vercel.app
```

- La partida inicia con minimo 3 jugadores y soporta hasta 4.
- El multiplayer sigue siendo experimental.
- Si `NEXT_PUBLIC_SOCKET_URL` no esta configurado, el multiplayer queda deshabilitado sin afectar `/play` local.
