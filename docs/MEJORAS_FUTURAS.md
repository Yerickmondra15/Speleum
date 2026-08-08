# Mejoras futuras

## Riesgo alto

1. Persistir salas, tickets consumidos y ventanas de reconexión en un almacén compartido; añadir adaptador Redis antes de escalar Socket.IO horizontalmente.
2. Entregar resultados a PostgreSQL desde un servicio confiable o una cola, para no depender del navegador del jugador desconectado.
3. Auditar y, si corresponde, recalcular o separar estadísticas creadas antes de `verificationLevel`.
4. Añadir pruebas de persistencia con PostgreSQL real/Testcontainers para carreras de `matchId + userId`.
5. Programar limpieza de `AuthChallenge` independiente del tráfico de login.

## Riesgo medio

1. Ejecutar E2E de registro, correo simulado, 2FA, sesión, perfil y partida con Playwright.
2. Completar internacionalización del HUD, errores multijugador y overlays.
3. Realizar auditoría WCAG de foco, anuncios de estado, contraste y navegación solo teclado.
4. Incorporar rate limiting compartido para autenticación y emisión de tickets en despliegues distribuidos.
5. Rotación versionada de secretos con periodo de transición.

## Producto y balance

1. Telemetría anonimizada de duración, selección y resultados antes de ajustar modificadores.
2. Ampliar las cinco habilidades activas actuales únicamente después de medir su balance y mantener validación autoritativa.
3. Separar ranking por temporada y conservar histórico.
4. Mejorar reintento visible de persistencia de comprobantes finales.

## Mantenimiento

- Vigilar el aviso bajo de desarrollo de `esbuild` y actualizar `tsx`/Vitest cuando publiquen una combinación compatible.
- Mantener Next.js, Prisma y Socket.IO dentro de sus líneas soportadas y ejecutar `npm audit --omit=dev` en CI o mantenimiento programado.
- Revisar recursos públicos no referenciados con evidencia de uso antes de eliminarlos.
