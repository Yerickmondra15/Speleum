# Matriz de funcionalidades y criaturas

## Estado general

| Área | Estado | Fuente principal |
| --- | --- | --- |
| Partida local PvE | Implementada | `TacticalGame.tsx` + reglas compartidas |
| Multijugador FFA 2–6 | Implementado, autoritativo | `server/rooms/roomLifecycle.ts` |
| Procedural reproducible | Implementado | `proceduralCave.ts` |
| Terreno `# . H W S R N` | Implementado y diferenciado | `tileMap.ts`, `survival.ts` |
| Sanidad anti-camping | Implementada en ambos modos | `lib/gameplay/sanity.ts` |
| Refugios recuperativos | Implementados, un uso | `lib/gameplay/survival.ts` |
| Habilidades activas | Cinco implementadas | `lib/gameplay/abilities.ts` |
| Radar fuera de visión | Implementado | `RadarPanel.tsx`, serialización |
| Spawns seeded por partida | Implementados | `pickSeparatedSpawns` |
| Boss/elite | No existe | pendiente; no se simula con enemigos comunes |

## Perfiles efectivos

| Criatura | HP | Movimiento | Ruido | Daño recibido | Radar | Habilidad / CD |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Ajolote | 100 | 4, ×1,00 | ×0,90 | ×0,94 | 18 | Regeneración / 32 s |
| Camarón | 78 | 5, ×0,78 | ×0,55 | ×1,12 | 15 | Impulso / 17 s |
| Pez ciego | 86 | 4, ×0,92 | ×0,72 | ×1,04 | 22 | Ecolocalización / 22 s |
| Cangrejo | 125 | 3, ×1,12 | ×1,15 | ×0,72 | 14 | Caparazón / 24 s |
| Araña | 84 | 4, ×0,88 | ×0,62 | ×1,06 | 17 | Trampa / 28 s |

Las estadísticas, habilidades, radar, terreno, IA, sanidad y colisiones se consumen desde módulos compartidos. La diferencia intencional es de orquestación: local es humano contra IA; multijugador añade FFA entre jugadores y autoridad del servidor.
