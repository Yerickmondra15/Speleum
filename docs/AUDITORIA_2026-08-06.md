# Auditoría técnica de Speleum — 6 de agosto de 2026

## Alcance

Esta auditoría compara la documentación actual con el código de la rama `main`. El objetivo es identificar faltantes reales, riesgos técnicos y el orden recomendado de trabajo antes de seguir agregando contenido visual.

## Resumen ejecutivo

Speleum ya tiene una base amplia y funcional: partida local, generación procedural, enemigos, radar, combate, autenticación con códigos, perfil, ranking y salas privadas con Socket.IO. Sin embargo, el multijugador y la persistencia aún dependen demasiado de datos enviados por el cliente. La prioridad inmediata debe ser confiabilidad, seguridad, reconexión y pruebas.

## Hallazgos críticos

### 1. Resultados y ranking confiados al cliente

El navegador envía `winnerId`, `result`, `scoreEarned`, fechas, modo y estado al endpoint de resultados. Un usuario puede modificar esa petición y aumentar su puntuación o declararse ganador.

Acción recomendada:

- En multijugador, guardar resultados desde el servidor autoritativo de Socket.IO o mediante un token de resultado firmado por el servidor.
- En local, separar el ranking competitivo del progreso de demostración o validar el resultado con reglas limitadas del servidor.
- Rechazar puntuaciones negativas, excesivas, fechas inválidas, modos desconocidos y estados no permitidos.
- Verificar que `winnerId` corresponda al ganador real y no al valor enviado por el jugador.

### 2. Socket.IO no autentica al usuario

Las salas usan identificadores aleatorios y nombres temporales. El servidor de sockets no conoce la sesión de Next.js ni relaciona de forma segura un socket con un usuario registrado.

Acción recomendada:

- Crear un ticket temporal de conexión desde una API autenticada de Next.js.
- Firmar el ticket con expiración corta.
- Validarlo en el middleware de Socket.IO.
- Asociar cada jugador a `userId` real sin exponer cookies al servidor de sockets.

### 3. No existe reconexión real de partida

El cliente intenta reconectarse automáticamente, pero el servidor elimina al jugador de la partida al recibir `disconnect`. Al volver la conexión, el usuario no recupera su identidad, estado, sala ni posición.

Acción recomendada:

- Introducir `reconnectToken` o identidad autenticada.
- Mantener al jugador en estado `disconnected` durante una ventana de gracia de 20–30 segundos.
- Permitir `resume-room` durante esa ventana.
- Eliminar o declarar derrota solo después de vencer el plazo.

### 4. El servidor de sockets vive completamente en memoria

Salas, jugadores, partidas y resultados desaparecen si el proceso se reinicia. Tampoco permite escalar a varias instancias.

Acción recomendada para el MVP:

- Documentar claramente la limitación de una sola instancia.
- Añadir expiración y limpieza de salas abandonadas o terminadas.
- Guardar los resultados finales en PostgreSQL.

Acción futura:

- Redis adapter para Socket.IO y almacenamiento compartido de salas si se requiere escalar.

### 5. No hay pruebas automatizadas

El proyecto no tiene Vitest, Jest, Playwright ni scripts de prueba. Solo existen `lint` y `build`.

Cobertura mínima recomendada:

- Movimiento y rutas válidas.
- Alcance de ataque por tiles.
- Parry, daño, stun y cooldowns.
- Generación procedural reproducible por semilla.
- Señales de radar y expiración.
- Creación, unión, ready-check, inicio, salida y reconexión de salas.
- Validación de resultados y autenticación.

### 6. No hay CI

No existe un workflow visible que ejecute lint, tipos, pruebas y build en cada cambio.

Acción recomendada:

- Añadir GitHub Actions con Node 20.
- Ejecutar `npm ci`, `npm run lint`, `npx tsc --noEmit`, pruebas y build.
- Usar variables de entorno de prueba seguras.

## Hallazgos de seguridad y backend

### Sesión sin expiración

La cookie contiene un identificador firmado, pero no incluye fecha de expiración ni rotación. Una cookie robada puede seguir siendo válida mientras el secreto no cambie.

Mejora:

- Incluir `issuedAt` y `expiresAt` en el payload.
- Configurar `maxAge` en la cookie.
- Rechazar tokens expirados.
- Fallar en producción si `SESSION_SECRET` no está definido, en lugar de usar un secreto por defecto.

### Intentos de inicio de sesión sin bloqueo efectivo

`failedLoginAttempts` aumenta al fallar, pero no se utiliza para bloquear temporalmente ni ralentizar intentos.

Mejora:

- Guardar `lockedUntil` o aplicar límite por IP/correo al endpoint de contraseña.
- Restablecer intentos solo al completar correctamente el segundo factor.

### Registro parcialmente creado si falla el correo

El usuario se crea antes de emitir o enviar el desafío. Si la entrega falla, queda una cuenta no verificada, lo cual puede ser aceptable, pero debe existir un flujo claro de recuperación y limpieza.

Mejora:

- Mantener el usuario y permitir reenvío explícito, documentándolo.
- O ejecutar creación y desafío como operación coordinada y limpiar cuentas abandonadas después de cierto tiempo.

### Validaciones manuales incompletas

Los endpoints convierten JSON directamente a tipos TypeScript; esos tipos no validan datos en ejecución.

Mejora:

- Incorporar Zod o validadores equivalentes.
- Definir enums compartidos para `mode`, `status`, `result` y criatura.
- Limitar longitudes y rangos numéricos.

### Criatura activa sin lista permitida

El endpoint acepta cualquier texto como `activeCreature`.

Mejora:

- Validar contra los IDs definidos en `lib/creatures.ts`.

## Hallazgos del juego

### Estadísticas y habilidades no están completamente conectadas

Las criaturas muestran vida, velocidad, sigilo, defensa, detección y una habilidad. Actualmente la diferencia jugable real se concentra sobre todo en multiplicadores de movimiento y ruido. La vida máxima, daño, defensa, detección y habilidades especiales no varían de forma completa por criatura.

Decisión necesaria:

- O implementar los efectos prometidos.
- O cambiar la interfaz para presentar esas estadísticas como identidad conceptual y no como atributos activos.

### Balance centralizado pero sin pruebas

Los valores están centralizados en `gameConfig.ts`, lo cual es positivo. Sin pruebas de simulación o partidas repetidas, es difícil saber si las diferencias son justas.

Mejora:

- Crear escenarios deterministas.
- Registrar duración, daño, bajas, uso de parry y tasa de victoria por criatura.
- Ajustar valores después de pruebas, no solo por sensación.

### Código grande y acoplado

`socketServer.ts`, `TacticalGame.tsx`, `MultiplayerGame.tsx`, `gameLogic.ts` y `proceduralCave.ts` concentran mucha responsabilidad.

Refactor recomendado después de estabilizar:

- `server/rooms/roomStore.ts`
- `server/rooms/lobbyService.ts`
- `server/game/matchEngine.ts`
- `server/socket/handlers/*.ts`
- hooks de cliente para socket, persistencia y controles

No conviene hacer este refactor antes de cubrir la lógica con pruebas.

## Hallazgos de repositorio y documentación

- Falta `.env.example` aunque el README ya enumera variables.
- Existe `.next-dev.log` versionado; debería eliminarse del repositorio e ignorarse mediante un patrón compatible.
- `.gitkeep-example` está en la raíz aunque su contenido corresponde a `docs/img/.gitkeep`.
- Falta evidencia visual real.
- Falta documento de protocolo de eventos Socket.IO.
- Falta una matriz de pruebas manuales y criterios de aceptación.
- Falta política clara para distinguir ranking local de ranking persistido.
- La documentación describe la base correctamente, pero no explica varias limitaciones críticas anteriores.

## Orden recomendado

1. Integridad de resultados y validaciones.
2. Autenticación del socket.
3. Reconexión con ventana de gracia.
4. Limpieza de salas y persistencia final.
5. Pruebas automatizadas y CI.
6. Balance y habilidades reales.
7. Perfil, historial y estadísticas.
8. Responsive, accesibilidad, sonidos y pulido visual.

## Definición de terminado para el MVP

El MVP puede considerarse listo para demostración sólida cuando:

- Dos o más usuarios completan una partida sin desincronización visible.
- Una reconexión breve no elimina al jugador.
- Un cliente no puede inventar ganador o puntuación.
- Las salas terminadas se limpian correctamente.
- El resultado aparece una sola vez en perfil y ranking.
- Lint, TypeScript, pruebas y build pasan en CI.
- Existe una guía reproducible de despliegue y prueba.
- La documentación distingue funciones reales, parciales y futuras.
