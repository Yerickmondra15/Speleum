# Matriz de funcionalidades y criaturas

## Estado general

| Área | Estado | Evidencia principal |
|---|---|---|
| Sesión web | Implementada | `lib/auth-session.ts` |
| Login en dos pasos y bloqueo | Implementada | `lib/auth-challenge.ts`, rutas de auth |
| Partida local | Implementada, no competitiva | `app/play/components/TacticalGame.tsx` |
| Socket autenticado | Implementada, una instancia | `server/auth/socketAuth.ts` |
| Reconexión de 25 s | Implementada, memoria | `server/handlers/connectionHandlers.ts`, `roomHandlers.ts` |
| Resultado competitivo autoritativo | Implementado mediante comprobante | `server/rooms/roomLifecycle.ts`, `lib/matches/result-contract.ts` |
| Persistencia del resultado de desconectados | Parcial | requiere que el navegador entregue el comprobante |
| Perfil e historial | Implementado con límite 25 | `app/api/profile/route.ts` |
| Ranking | Implementado con límite 50/página | `app/api/ranking/route.ts` |
| i18n y accesibilidad | Parcial | navegación principal; HUD aún contiene español fijo |
| Escalado horizontal | No implementado | salas y replay viven en memoria |

## Efectos reales de criaturas

Los valores visuales `vida`, `velocidad`, `sigilo`, `defensa` y `detección` son una presentación relativa. El efecto jugable se centraliza en `lib/creature-gameplay.ts` y se aplica tanto en local como en servidor.

| Criatura | Vida | Movimiento | Ruido | Daño saliente | Daño recibido | Radar | Estado |
|---|---:|---:|---:|---:|---:|---:|---|
| Ajolote | 100 | 4 tiles, x1.00 | x0.90 | x1.00 | x0.94 | 13 tiles | Implementado |
| Camarón | 78 | 5 tiles, x0.78 | x0.55 | x0.90 | x1.12 | 10 tiles | Implementado |
| Pez ciego | 86 | 4 tiles, x0.92 | x0.72 | x0.92 | x1.04 | 14 tiles | Implementado |
| Cangrejo | 125 | 3 tiles, x1.12 | x1.15 | x0.95 | x0.72 | 9 tiles | Implementado |
| Araña | 84 | 4 tiles, x0.88 | x0.62 | x1.15 | x1.06 | 11 tiles | Implementado |

| Estadística visual | Efecto real | Archivos | Estado |
|---|---|---|---|
| Vida | `maxHealth` inicial y HUD | `creature-gameplay.ts`, `TacticalGame.tsx`, `roomLifecycle.ts` | Implementada |
| Velocidad | rango y multiplicador de cooldown | `gameConfig.ts`, `gameplayHandlers.ts` | Implementada |
| Sigilo | radio e intensidad de ruido | `creature-gameplay.ts`, modos local/multi | Implementada |
| Defensa | multiplicador de daño recibido | `creature-gameplay.ts`, `roomLifecycle.ts`, `TacticalGame.tsx` | Implementada |
| Detección | rango de señales del radar | `RadarPanel.tsx`, `roomSerialization.ts` | Implementada |
| Habilidad especial | pasiva compuesta de los modificadores anteriores | `lib/creatures.ts` | Implementada como pasiva; no hay habilidad activa única |

No existen actualmente dash, salto, contraataque automático ni emboscada activa para el jugador; los textos se ajustaron para no prometerlos.
