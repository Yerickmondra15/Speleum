# Registro de bugs de gameplay

## Corregidos o en validación

| Bug | Causa raíz | Corrección |
| --- | --- | --- |
| Keys React duplicadas | `RadarSignal.id` era solo `Date.now()` | ID string con timestamp + secuencia + propietario |
| Alcance de ataque engañoso | UI dibujaba 1,45 tiles y la regla permitía 3 | Tiles atacables derivados de la misma búsqueda que combate |
| Visión diagonal distinta online | Servidor usaba círculo euclidiano; cliente Chebyshev | `isTileVisible` compartida en serialización y render |
| IA online demasiado rápida | Cada tick de 80 ms equivalía a un tile | `nextMoveAt` por entidad y cooldown derivado de velocidad |
| IA omnisciente | Posición actual sustituía la última conocida fuera de detección | Última posición congelada hasta una nueva percepción |
| Daño IA divergente | Servidor usaba daño fijo 18 | Ambos consumen `EnemyConfig.damage` |
| Señales de ataque fantasma offline | Se emitían antes de comprobar cooldown | Se emiten solo con golpe válido |
| Mapa aparentemente fijo | El generador caía casi siempre al fallback | Reparación de plantillas, conectividad y validación multiseed |
| Waypoints bloqueados | Offsets geométricos no se validaban | Snap a tiles caminables y conectados |
| ID de enemigos duplicado | Omitía placement en el ID | ID incluye placement único |
| Recarga atascada | Resume llegaba antes del disconnect viejo y no reintentaba | Takeover autenticado y ack estructurado |
| Sesión obsoleta sin salida | Pantalla ignoraba el fallo terminal | Limpieza de sesión y UI recuperable |

## Limitaciones conocidas

- Las salas y snapshots viven en memoria de una sola instancia. Sobrevivir a reinicios o escalar horizontalmente requiere un almacén compartido y un lease de loop autoritativo.
- La visión todavía no tiene línea de visión/oclusión por pared; ambos modos son coherentes, pero esta mejora queda para balance posterior.
- El payload multijugador reenvía el layout inmutable completo en cada snapshot. Separar `room-init` de estado dinámico es una optimización posterior.
- Los valores visuales 0–100 del catálogo de criaturas y los modificadores efectivos todavía son dos representaciones que deben consolidarse.
