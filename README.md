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

5. Si quieres levantar tambien el servidor de sockets:

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
