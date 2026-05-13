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

- Registro e inicio de sesion con cookie de sesion
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

3. Genera Prisma y aplica migraciones en desarrollo:

```bash
npx prisma generate
npx prisma migrate dev --name init
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
- Corre las migraciones manualmente solo cuando cambie la base de datos:

```bash
npx prisma migrate deploy
```

- Si prefieres usar el script del proyecto:

```bash
npm run db:migrate:deploy
```

## Deploy del socket

- El frontend se despliega en Vercel.
- El servidor multiplayer de Socket.IO se despliega por separado en Render o Railway.
- Usa este comando de arranque para el servicio del socket:

```bash
npm run socket
```

- El servidor escucha en `process.env.PORT || 4001`, asi que Render y Railway pueden inyectar `PORT` automaticamente.
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
NEXT_PUBLIC_SOCKET_URL=https://URL_DEL_SOCKET
```

- Vercel necesita `NEXT_PUBLIC_SOCKET_URL` para activar multiplayer.
- En el servicio del socket puedes definir `FRONTEND_URL=https://tu-frontend.vercel.app` para permitir un dominio exacto adicional.
