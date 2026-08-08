# Matriz offline vs multijugador

| Mecánica | Offline | Multijugador | Fuente compartida |
| --- | --- | --- | --- |
| Mapa/tiles | Procedural seeded | Procedural seeded por sala | `proceduralCave.ts`, `tileMap.ts` |
| Visión | 8 tiles | 8 tiles | `rules.ts`, `isTileVisible` |
| Radar | 14–22 por criatura | Igual, filtrado en servidor | catálogo + `RadarPanel` |
| Movimiento | BFS por tiles | Intención + validación servidor | `planMovementPath` |
| `H` | Letal | Letal autoritativo | `hitHazard` |
| `W` | +25% CD, +30% ruido | Igual | `survival.ts` |
| `R` | 2,8 s, +22%, un uso | Igual, servidor | `survival.ts` |
| Sanidad | 10 s feedback, 20 s daño | Igual; desconectado exento | `sanity.ts` |
| Habilidades | Cinco activas | Cinco, autoridad servidor | `abilities.ts` |
| IA | Solo apunta al humano | Apunta a jugadores vivos conectados | `updateEnemyState` |
| IA vs IA | Nunca | Nunca | construcción de objetivos |
| PvP | No aplica | FFA | orquestación servidor |
| Curación por baja PvP | No aplica | 20% maxHealth | `eliminatePlayer` |
| Spawns | Inicio PvE seguro | Seeded por `cave + matchId`, separados | `pickSeparatedSpawns` |
| Pausa/reconexión | Pausa congela relojes | Gracia conserva snapshot | timeline local / RoomStore |

Las diferencias son intencionales: local es jugador contra criaturas; multijugador añade FFA y autoridad del servidor. No existe todavía un sistema real de boss/elite, por lo que no se asigna curación especial a enemigos comunes.
