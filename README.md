# Speleum

Speleum es un juego web de supervivencia en cuevas con vision limitada. El jugador controla una criatura subterranea, detecta actividad cercana mediante radar, se desplaza por un mapa oscuro, ataca, se defiende y compite por resultados persistidos en ranking.

## Objetivo del proyecto

Desarrollar una experiencia web jugable que combine exploracion, tension espacial y competencia, integrando autenticacion de usuarios, persistencia de datos, ranking y una base funcional de partidas en tiempo real.

## Tecnologias utilizadas

- Next.js
- React
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Socket.IO
- Vercel (para despliegue del frontend, si aplica)

## Estado actual del sistema

Speleum se encuentra en una etapa de avance estructurado con una base funcional integrada. Ya dispone de autenticacion, perfil, ranking, guardado de resultados, partida local completa y un modo multijugador en evolucion con salas en tiempo real.

## Funcionalidades implementadas

- Landing y pantallas informativas alineadas con la tematica de supervivencia en cuevas.
- Registro de usuarios con verificacion por codigo enviado al correo.
- Inicio de sesion con validacion por codigo temporal.
- Gestion de sesion y perfil de usuario.
- Seleccion y persistencia de criatura activa.
- Ranking persistido en base de datos.
- Registro de resultados de partida local y multijugador.
- Partida local con:
  - vision limitada
  - movimiento por tiles
  - ataque y defensa
  - radar de senales
  - criaturas hostiles de cueva
- Modo multijugador con salas privadas, sincronizacion por Socket.IO y soporte inicial de combate en tiempo real.

## Funcionalidades pendientes o ampliables

- Mayor variedad de criaturas jugables y amenazas de cueva.
- Ajustes de balance en combate, deteccion y tiempos de recuperacion.
- Persistencia adicional de salas o historiales de partidas multijugador.
- Mejoras visuales y de retroalimentacion para eventos de radar y combate.
- Automatizacion de pruebas y cobertura de escenarios multijugador.

## Estructura de documentacion tecnica

- [Arquitectura](docs/ARQUITECTURA.md)
- [Base de datos](docs/BASE_DE_DATOS.md)
- [Servicios y modulos](docs/SERVICIOS.md)
- [Ejecucion del proyecto](docs/EJECUCION.md)
- [Mejoras futuras](docs/MEJORAS_FUTURAS.md)
- [Uso de IA](docs/USO_IA.md)

## Requisitos previos

- Node.js 20 o superior
- npm
- PostgreSQL disponible localmente o en la nube

## Variables de entorno necesarias

### Requeridas

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`

### Recomendadas o segun el entorno

- `AUTH_CODE_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_SOCKET_URL`
- `FRONTEND_URL`
- `NEXT_PUBLIC_APP_URL`

### Opcionales para desarrollo o demostracion

- `DEMO_AUTH_CODES`
- `DEMO_AUTH_CODES_PUBLIC`
- `AUTH_RESEND_COOLDOWN_SECONDS`
- `AUTH_MAX_VERIFY_ATTEMPTS`
- `AUTH_MAX_RESENDS`
- `AUTH_RATE_LIMIT_WINDOW_MINUTES`
- `AUTH_RATE_LIMIT_PER_EMAIL`
- `AUTH_RATE_LIMIT_PER_IP`
- `ALLOWED_ORIGINS`

## Instrucciones para ejecutar el sistema

1. Instalar dependencias:

```bash
npm install
```

2. Generar cliente de Prisma:

```bash
npx prisma generate
```

3. Aplicar migraciones en desarrollo:

```bash
npx prisma migrate dev
```

4. Iniciar el frontend:

```bash
npm run dev
```

5. Si se desea probar el modo multijugador, configurar la URL del socket y levantar el servidor:

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001
npm run socket
```

6. Para ejecutar frontend y socket al mismo tiempo:

```bash
npm run dev:full
```

## Comandos principales

```bash
npm install
npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
npm run dev
npm run build
```

## Build y despliegue

Para compilar el proyecto:

```bash
npm run build
```

En entornos productivos con cambios de esquema aplicados manualmente:

```bash
npx prisma migrate deploy
```

## Evidencia visual

- Agregar captura de landing
- Agregar captura de login
- Agregar captura de perfil
- Agregar captura de partida
- Agregar captura de ranking
- Agregar captura de multijugador

## Uso de inteligencia artificial en el desarrollo

Durante el desarrollo de Speleum se utilizo inteligencia artificial como apoyo en tareas de generacion de codigo, revision de errores, documentacion, diseno de componentes y mejora de estructura general del proyecto.

La implementacion final fue revisada, adaptada y probada por el estudiante, por lo que la IA se utilizo como herramienta de asistencia y no como reemplazo del proceso de desarrollo.
