# Diseño de juego de Speleum

## Idea central

Speleum es supervivencia táctica de información incompleta. El jugador se desplaza por tiles, interpreta ecos y ruido, administra cooldowns y decide cuándo atacar o abrir una ventana de parry.

## Sistemas implementados

- Cueva generada de forma reproducible por semilla, con fallback estático seguro.
- Movimiento con búsqueda de ruta y alcance por criatura.
- Visión limitada, radar temporal, ruido y comportamiento de enemigos.
- Daño, vida, parry, stun, cooldowns, kills y final de partida.
- Multijugador 2–6 con el mismo lenguaje táctico y autoridad del servidor.
- Cinco criaturas diferenciadas mediante modificadores pequeños y centralizados.

## Criaturas

Las “habilidades” actuales son pasivas: combinaciones de vida, movimiento, ruido, ataque, defensa y radar. No hay dash, salto, contraataque automático o emboscada activa. La tabla exacta vive en `MATRIZ_FUNCIONALIDADES.md`.

## Confianza y competencia

El modo local es práctica/historial y no afecta score competitivo porque su simulación vive en el navegador. El multijugador calcula resultados en Socket.IO y es la única fuente nueva de `UserStats`.

## Principios de evolución

1. Toda mecánica multijugador debe ser validada por el servidor.
2. Un texto de interfaz no debe prometer una habilidad sin implementación y prueba.
3. El balance debe cambiar en `lib/creature-gameplay.ts`, no dispersarse en componentes.
4. Antes de añadir habilidades complejas, medir las pasivas actuales y ampliar pruebas.
