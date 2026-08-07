# Auditoría técnica de Speleum — actualización del 6 de agosto de 2026

## Alcance revisado

Se inspeccionaron README, documentación técnica, esquema y migraciones Prisma, servidor Socket.IO, todo `app/play/`, `app/api/`, `lib/` y los issues #2–#5. Esta versión registra implementación y verificación, no solo recomendaciones.

## Hallazgos originales y resolución

| Hallazgo | Estado actual | Evidencia |
|---|---|---|
| Navegador decidía ganador y score | Resuelto para resultados nuevos | comprobante firmado y `result-contract.ts` |
| Socket sin identidad web | Resuelto en una instancia | ticket 60 s, replay store, `socket.data` |
| Desconexión eliminaba jugador | Resuelto | gracia segura de 25 s y `resume-room` |
| Salas sin limpieza | Resuelto para una instancia | ciclo central y metadatos de expiración |
| `socketServer.ts` monolítico | Resuelto | entrada pequeña y módulos por responsabilidad |
| Sesión sin expiración/secretos débiles | Resuelto | token v1 de 7 días y fallo en producción |
| `failedLoginAttempts` sin efecto | Resuelto | `lockedUntil` progresivo |
| `Math.random` para códigos | Resuelto | `crypto.randomInt` |
| Validaciones manuales parciales | Resuelto en rutas/eventos prioritarios | Zod estricto y límites |
| Sin pruebas | Resuelto para núcleo | 44 pruebas, 20 integraciones socket |
| Sin CI | Resuelto | `.github/workflows/ci.yml` |
| Stats de criaturas solo visuales | Resuelto como pasivas simples | modificadores compartidos local/multi |
| Perfil/ranking sin escala | Resuelto | límites y paginación |

## Seguridad verificada

- Campos desconocidos, cuerpos exagerados, fechas imposibles, criaturas inválidas, coordenadas `NaN`/`Infinity` y acciones fuera de estado se rechazan.
- El cliente multijugador no puede mandar `winnerId`, `scoreEarned` o el resultado de otra identidad.
- Los tickets alterados, vencidos, repetidos o ausentes fallan el handshake.
- Reanudar una sala usa el `userId` firmado, no un ID del payload.
- La restricción única y transacción serializable hacen idempotente la persistencia.
- Secretos distintos son obligatorios en producción y no se exportan al navegador.
- La auditoría de dependencias pasó de 18 avisos (2 críticos) a cero vulnerabilidades de producción. Persiste un aviso bajo de desarrollo transitivo en `esbuild`.

## Migración

`20260807010000_secure_results_and_login_lockout` añade `lockedUntil`, `verificationLevel` y el índice `(mode, verificationLevel, endedAt)`. No destruye ni reescribe datos.

## Verificación automatizada

- Prisma schema: válido.
- ESLint: pasa sin errores ni advertencias.
- TypeScript: pasa con `tsc --noEmit`.
- Vitest: 5 archivos, 44 pruebas pasadas.
- Build: Next.js 16.3.0 compiló, validó TypeScript y generó las 20 rutas correctamente.

## Limitaciones y hallazgos abiertos

1. Salas y replay son memoria de una sola instancia; un reinicio pierde partidas.
2. El navegador entrega el comprobante final a la API. Un usuario que no vuelve puede no persistir su derrota.
3. Datos anteriores a la migración pueden haber sido creados bajo el contrato inseguro anterior.
4. No existe prueba contra PostgreSQL real de dos solicitudes concurrentes, aunque la política y restricciones están implementadas.
5. La limpieza de desafíos es oportunista, no una tarea programada independiente.
6. Correo real y flujos manuales completos requieren credenciales/servicios no disponibles en esta revisión.
7. Quedan textos multijugador fijos en español y falta auditoría WCAG completa.
8. `app/ranking.tsx` es un componente importado por `app/ranking/page.tsx`; no es una ruta duplicada. Renombrarlo sería higiene opcional, no un error funcional.

## Conclusión

Los riesgos críticos de los issues #2–#5 quedaron implementados y cubiertos por pruebas. Speleum es considerablemente más seguro y comprobable, pero todavía debe presentarse como arquitectura de una instancia y no como multijugador horizontalmente escalable.
