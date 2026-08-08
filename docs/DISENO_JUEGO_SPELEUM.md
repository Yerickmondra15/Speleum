# Diseño de juego de Speleum

## Idea central

Speleum es supervivencia táctica de información incompleta. La visión directa cubre 8 tiles; el radar escucha actividad a mayor distancia sin revelar coordenadas exactas. El jugador administra movimiento por celdas, ruido, vida, sanidad, parry y una habilidad activa propia de su criatura.

## Supervivencia

- Permanecer en un refugio `R` durante 2,8 s recupera 22% de la vida máxima. Cada refugio se agota tras un uso por partida.
- La sanidad depende exclusivamente de cambiar de celda. A los 10 s inmóvil aparece presión visual; a los 20 s comienza daño de 5% de la vida máxima cada 2 s.
- Pausar el modo local congela esos relojes. Un jugador desconectado en multijugador tampoco recibe daño de sanidad durante su gracia de reconexión.
- En multijugador, eliminar a otro jugador cura 20% de la vida máxima, calculado por el servidor. No existe todavía un concepto real de boss/elite; su curación queda pendiente hasta introducir ese sistema.

## Terreno procedural

| Símbolo | Significado |
| --- | --- |
| `#` | roca no caminable |
| `.` | suelo normal |
| `H` | peligro rojo letal |
| `W` | agua oscura caminable; +25% cooldown y +30% ruido |
| `S` | spawn seguro |
| `R` | refugio recuperativo limitado |
| `N` | nido identificable, asociado a presencia de criaturas |

## Habilidades activas

- Ajolote — **Regeneración cavernícola**: 18% de HP en 4,5 s; daño de al menos 12% de la vida máxima la cancela. CD 32 s.
- Camarón — **Impulso fantasma**: el siguiente movimiento gana 2 tiles y usa 15% del ruido normal. CD 17 s.
- Pez ciego — **Ecolocalización**: +6 tiles de visión, +10 tiles de radar y 65% menos imprecisión durante 5 s. CD 22 s.
- Cangrejo — **Caparazón**: 70% de reducción de daño e inmovilidad durante 2,5 s. CD 24 s.
- Araña — **Trampa de seda**: trampa de 11 s que aturde al primer hostil durante 1,5 s. CD 28 s.

## IA y modos

La IA evalúa percepción con frecuencia pero avanza como máximo una celda cuando vence su cooldown individual. Offline solo recibe al jugador humano como objetivo; multijugador recibe jugadores vivos y conectados. Las IA nunca se atacan entre sí. PvP multijugador continúa siendo todos contra todos y autoritativo.

Las plantillas procedurales tienen cuatro entradas utilizables y las salas de peligro conservan un corredor seguro. Todos los tiles no letales son alcanzables desde el inicio sin obligar a cruzar `H`.

El parry exitoso aturde 2,4 s al atacante. Si la ventana de 850 ms vence sin recibir un golpe, el defensor queda aturdido 1,4 s; bloquear al azar tiene un coste táctico.

## Interfaz de partida

En desktop y tablet horizontal, HUD y radar ocupan una columna compacta, el mapa usa el área superior restante y mover/atacar/defender/habilidad forman la fila inferior. En móvil el mapa mantiene prioridad con panel compacto superpuesto y controles táctiles inferiores. Ocultar UI elimina panel y controles, conservando solo los accesos para restaurarla, salir o pausar.
