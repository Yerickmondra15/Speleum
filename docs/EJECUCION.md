# Ejecucion de Speleum

## Requisitos previos

- Node.js 20 o superior
- npm
- PostgreSQL disponible
- archivo `.env` configurado

## Variables de entorno

### Minimas para ejecutar la base del sistema

```env
DATABASE_URL=
DIRECT_URL=
SESSION_SECRET=
```

### Recomendadas para autenticacion y despliegue

```env
AUTH_CODE_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
NEXT_PUBLIC_SOCKET_URL=
FRONTEND_URL=
NEXT_PUBLIC_APP_URL=
```

### Opcionales de soporte o demostracion

```env
DEMO_AUTH_CODES=
DEMO_AUTH_CODES_PUBLIC=
AUTH_RESEND_COOLDOWN_SECONDS=
AUTH_MAX_VERIFY_ATTEMPTS=
AUTH_MAX_RESENDS=
AUTH_RATE_LIMIT_WINDOW_MINUTES=
AUTH_RATE_LIMIT_PER_EMAIL=
AUTH_RATE_LIMIT_PER_IP=
ALLOWED_ORIGINS=
```

## Instalacion

1. Instalar dependencias:

```bash
npm install
```

2. Generar cliente Prisma:

```bash
npx prisma generate
```

3. Aplicar migraciones en desarrollo:

```bash
npx prisma migrate dev
```

## Configuracion del archivo `.env`

Ejemplo base:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/speleum"
DIRECT_URL="postgresql://usuario:password@localhost:5432/speleum"
SESSION_SECRET="cambia-este-secreto"
AUTH_CODE_SECRET="opcional-pero-recomendado"
NEXT_PUBLIC_SOCKET_URL="http://localhost:4001"
```

## Ejecucion local

### Frontend

```bash
npm run dev
```

### Servidor de sockets

```bash
npm run socket
```

### Frontend y sockets al mismo tiempo

```bash
npm run dev:full
```

## Build de produccion

```bash
npm run build
```

El script de build ya ejecuta:

- `prisma generate`
- `next build`

## Migraciones para despliegue

Si el entorno ya tiene la base de datos preparada y solo falta aplicar cambios de schema:

```bash
npx prisma migrate deploy
```

También existe el script:

```bash
npm run db:migrate:deploy
```

## Notas para Vercel

- El frontend puede desplegarse en Vercel.
- La base de datos PostgreSQL debe estar accesible desde el entorno desplegado.
- El servidor de sockets debe ejecutarse aparte si se quiere mantener el modo multijugador en tiempo real.
- `NEXT_PUBLIC_SOCKET_URL` debe apuntar al servidor donde corre Socket.IO.
- Si no se configura `NEXT_PUBLIC_SOCKET_URL`, el sistema sigue permitiendo autenticacion, perfil, ranking y partida local.

## Que revisar si falla la ejecucion

### `DATABASE_URL`

- Confirmar que apunte a una base PostgreSQL valida.
- Revisar usuario, contraseña, host, puerto y nombre de base.

### `DIRECT_URL`

- Confirmar que exista y sea compatible con Prisma.
- Mantenerla alineada con el entorno de base de datos usado.

### `SESSION_SECRET`

- Verificar que esté definido.
- Si cambia entre reinicios o despliegues, las sesiones anteriores dejan de ser válidas.

### `prisma generate`

- Ejecutar manualmente:

```bash
npx prisma generate
```

- Revisar si hay errores en el schema o en la instalación de dependencias.

### Migraciones

- Si faltan tablas o columnas, ejecutar:

```bash
npx prisma migrate dev
```

o en producción:

```bash
npx prisma migrate deploy
```

### Puertos ocupados

- El frontend usa el puerto de Next.js.
- El socket usa por defecto el puerto `4001`.
- Si hay conflictos, revisar procesos previos o variables de entorno del servidor de sockets.

## Validacion recomendada despues de configurar

```bash
npm run lint
npx tsc --noEmit
npm run build
```
