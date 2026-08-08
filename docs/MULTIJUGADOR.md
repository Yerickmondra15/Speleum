# Multijugador

## Autoridad

El navegador envía intenciones `player-move`, `player-attack`, `player-defend` y `player-ability`. Socket.IO valida con Zod la sala, identidad, estado, tile, rango, colisiones y cooldown; solo el servidor muta posición, vida, curación, sanidad, trampas, stun, daño o resultados.

La partida es FFA: los jugadores pueden dañarse entre sí y las criaturas de la cueva atacan jugadores. Los enemigos IA reciben únicamente jugadores como objetivos y no combaten entre sí.

El parry se resuelve en servidor: un bloqueo acertado aturde al atacante 2,4 s; si la ventana vence sin interceptar un ataque, el defensor recibe 1,4 s de stun.

## Curación y sanidad

- Una baja PvP cura al atacante 20% de su vida máxima sin exceder el máximo.
- Los refugios `R` se resuelven en servidor: 2,8 s de permanencia, 22% de curación y un uso global por refugio durante la partida.
- El servidor registra la última celda realmente ocupada. A los 10 s cambia el estado de sanidad; desde 20 s aplica 5% de daño cada 2 s.
- Los jugadores desconectados no reciben ticks de sanidad durante la gracia de reconexión.

## Habilidades

`player-ability` acepta sala y target opcional validado. Regeneración, reducción de daño, bloqueo de movimiento, bonus de rango/ruido y cooldown viven en `AbilityState` del jugador. Las trampas de seda viven en `room.traps`, caducan a los 11 s y el primer jugador o enemigo hostil que las pisa queda aturdido 1,5 s.

## Spawns

`startRoom` deriva un RNG reproducible de `cave.seed + matchId`. Cada partida baraja candidatos seguros y la asignación de jugadores, conservando:

- tile caminable, no roca/obstáculo/`H`;
- buffer de hazards y enemigos;
- posiciones únicas y separación mínima de 6 tiles (verificada incluso con 6 jugadores);
- resultados reproducibles para la misma semilla de partida, pero diferentes entre partidas.

## Reconexión y resultados

La reconexión conserva snapshot autoritativo durante 25 s. Al expirar se procesa la derrota. El resultado competitivo se firma individualmente; el modo local no escribe estadísticas competitivas.

La arquitectura sigue siendo de una sola instancia en memoria. Escalado horizontal requerirá estado compartido y adaptador de Socket.IO.
