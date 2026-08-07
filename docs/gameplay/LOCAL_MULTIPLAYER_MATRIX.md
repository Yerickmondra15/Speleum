# Matriz offline vs multijugador

Última revisión: 2026-08-06. Esta matriz es un control de paridad, no una lista de deseos. `Compartida` significa que ambos modos consumen la misma función o configuración; la autoridad del servidor sigue siendo una diferencia intencional.

| Mecánica | Offline | Multijugador | Estado | Fuente canónica |
| --- | --- | --- | --- | --- |
| Dimensiones y tiles | 65 × 40, tile 80 | Igual | Compartida | `lib/gameplay/rules.ts` |
| Seed | Local por partida | La decide el servidor | Diferencia intencional | `createCaveLayout(seed)` |
| Mapa | Reconstruye el layout de la seed | Recibe el layout completo del servidor | Compartida | `app/play/proceduralCave.ts` |
| Conectividad | Componente jugable completo | Igual | En corrección | Validador de `CaveLayout` |
| Spawns | Spawn PvE seguro | Spawns separados para jugadores | Diferencia intencional | `pickSeparatedSpawns` |
| Visión | Chebyshev, 8 tiles | Misma métrica en payload y cliente | Compartida | `isTileVisible` |
| Movimiento | BFS, rango de criatura | Preview cliente + validación servidor | Compartida | `planMovementPath` |
| Peligros | Eliminación al entrar | Eliminación al entrar | Compartida | `hitHazard` |
| Ataque | Objetivo único más cercano | Objetivo único más cercano, incluido PvP | En corrección | Selector y `resolveCombatHit` compartidos |
| Daño del jugador | Base 30 + modificadores | Igual | Compartida | `PLAYER_ATTACK_DAMAGE`, `creature-gameplay.ts` |
| Daño de IA | `EnemyConfig.damage` | Igual | En corrección | Configuración de enemigo |
| Parry | 850 ms, consume primer golpe | Igual | Compartida | `resolveCombatHit` |
| Stun | 1.800 ms | Igual | Compartida | `canTakeTurn`/`resolveCombatHit` |
| IA | Máquina de estados compartida | La evalúa el servidor | En corrección | `updateEnemyState` |
| Cooldown IA | Timestamp por entidad | Igual, independiente del tick | En corrección | `calculateEnemyMoveCooldown` |
| Percepción IA | Visión limitada + ruido | Igual | En corrección | Estado de última posición conocida |
| Señales | ID estable, merge y TTL | Igual | Compartida | `signalUtils.ts`, `event-ids.ts` |
| Ruido | Evento abstracto por acción | Igual | En corrección | `NoiseEvent` |
| Muerte de IA | Sin nuevos ticks/eventos | Igual | En corrección | Transición de muerte compartida |
| Criaturas | Modificadores efectivos | Igual | Compartida | `lib/creature-gameplay.ts` |
| Habilidades | Arquitectura pendiente | Igual | Pendiente | `lib/gameplay/abilities.ts` |
| Cordura | Sistema pendiente | Igual | Pendiente | `lib/gameplay/sanity.ts` |
| Reconexión | No aplica | Restaura snapshot autoritativo | En corrección | RoomStore + sesión cliente |
| Victoria | Eliminar amenazas PvE | Último jugador vivo | Diferencia intencional | Orquestación del modo |

## Divergencias descubiertas en la auditoría

- El generador caía casi siempre al fallback estático y aceptaba 95% de conectividad.
- La IA online avanzaba cada 80 ms y la offline cada 420 ms, sin cooldown propio.
- El servidor ignoraba el daño configurado de enemigos.
- El ataque offline era single-target y online era AOE.
- La serialización online usaba distancia euclidiana y el cliente Chebyshev.
- Los hazards no tenían efecto offline.
- Las señales usaban `Date.now()` como ID único.
- La reconexión rechazaba una recarga si el socket anterior aún no había notificado su disconnect.

Cada fila debe volver a revisarse cuando cambie una regla fundamental.
