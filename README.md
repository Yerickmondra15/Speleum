# SPELEUM — supervivencia táctica en cuevas

Speleum es un juego web táctico con partidas locales y salas multijugador en tiempo real. El proyecto combina Next.js 16, React 19, TypeScript, Prisma/PostgreSQL y Socket.IO. La prioridad técnica actual es que identidad, movimiento, combate y resultados competitivos sean verificables por el servidor.

## Estado verificado

- Autenticación web con registro, verificación por código, login en dos pasos, sesión firmada de 7 días y bloqueo temporal progresivo.
- Partida local con cueva determinista por semilla, movimiento por tiles, enemigos, ataque, parry, stun, radar y cinco criaturas diferenciadas.
- Multijugador para 2–6 usuarios con ticket autenticado de un solo uso, estado autoritativo, reconexión segura de 25 segundos y limpieza central de salas.
- Resultados locales guardados como `local_unverified` y excluidos del ranking competitivo.
- Resultados multijugador aceptados únicamente mediante un comprobante firmado por Socket.IO; el navegador no decide ganador ni puntuación.
- Perfil con estadísticas e historial reciente; ranking competitivo paginado.
- 44 pruebas automatizadas, incluidas las 20 situaciones de integración Socket.IO solicitadas.
- CI para pull requests y pushes a `main` con Node.js 20.

## Límites conocidos

- Las salas viven en memoria y soportan una sola instancia de Socket.IO. Reiniciar el proceso pierde las partidas activas; no hay sincronización horizontal ni Redis.
- La protección de reutilización de tickets también vive en memoria y es por instancia.
- El resultado multijugador se persiste desde el navegador con un comprobante firmado. Si un cliente derrotado no vuelve antes de que expire el comprobante, su resultado puede no llegar a PostgreSQL.
- Las estadísticas históricas anteriores a la migración pueden incluir resultados creados con el contrato antiguo, que confiaba en el cliente.
- El correo real requiere Resend. Sin credenciales solo es viable el flujo de demostración en un entorno controlado.
- La internacionalización y la revisión de accesibilidad cubren la navegación principal, pero todavía hay textos del HUD multijugador únicamente en español.

## Arquitectura resumida

```text
Navegador
├── HTTP / Next.js App Router
│   ├── autenticación y sesión
│   ├── ticket temporal de Socket.IO
│   ├── perfil y ranking
│   └── persistencia de resultados
└── Socket.IO autenticado
    └── servidor autoritativo de salas y combate (memoria, una instancia)

Next.js API ── Prisma ── PostgreSQL
Socket.IO ── comprobante HMAC ── Next.js API
```

El punto de entrada del servidor de sockets es deliberadamente pequeño. La autenticación, validación, almacenamiento de salas, ciclo de vida, serialización, handlers y puntuación están separados bajo `server/`.

## Requisitos

- Node.js 20
- npm
- PostgreSQL accesible
- Credenciales de Resend para correo real (opcionales en desarrollo)

## Configuración

1. Copia `.env.example` a `.env`.
2. Configura `DATABASE_URL` y `DIRECT_URL`.
3. En producción define cuatro secretos diferentes de al menos 32 caracteres:
   `SESSION_SECRET`, `AUTH_CODE_SECRET`, `SOCKET_AUTH_SECRET` y `MULTIPLAYER_RESULT_SECRET`.
4. Configura `NEXT_PUBLIC_SOCKET_URL`, `FRONTEND_URL` y `ALLOWED_ORIGINS` si frontend y sockets usan orígenes distintos.

En desarrollo se generan secretos efímeros si faltan. En producción la aplicación falla de forma explícita; nunca usa un secreto predeterminado.

## Instalación y base de datos

```bash
npm ci
npx prisma migrate deploy
```

La migración nueva es `20260807010000_secure_results_and_login_lockout`. Añade el bloqueo temporal de login, el nivel de verificación de partidas y un índice para consultas competitivas. No borra datos existentes.

## Ejecución local

```bash
# Next.js
npm run dev

# Socket.IO, en otra terminal
npm run socket

# Ambos procesos
npm run dev:full
```

Por defecto Next.js usa `http://localhost:3000` y Socket.IO el puerto definido por `PORT` (ejemplo: `4001`).

## Calidad y build

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:coverage
npm run build
```

La suite no necesita PostgreSQL: prueba las políticas puras y el servidor Socket.IO con un servidor HTTP efímero. El build genera Prisma Client, pero no conecta a una base de datos.

## Documentación técnica

- [Arquitectura](docs/ARQUITECTURA.md)
- [Base de datos](docs/BASE_DE_DATOS.md)
- [Servicios y contratos](docs/SERVICIOS.md)
- [Ejecución y despliegue](docs/EJECUCION.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Multijugador](docs/MULTIJUGADOR.md)
- [Pruebas](docs/PRUEBAS.md)
- [Matriz funcional y criaturas](docs/MATRIZ_FUNCIONALIDADES.md)
- [Diseño de juego](docs/DISENO_JUEGO_SPELEUM.md)
- [Auditoría actualizada](docs/AUDITORIA_2026-08-06.md)
- [Riesgos y mejoras futuras](docs/MEJORAS_FUTURAS.md)

## Autoría

Proyecto académico desarrollado por Yerickmondra15. La asistencia de IA se empleó para revisión técnica, implementación y documentación; las decisiones y resultados verificables quedan registrados en el historial de Git y la suite automatizada.
