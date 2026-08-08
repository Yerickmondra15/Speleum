# Reglas de juego de Speleum

Este documento describe las reglas fundamentales compartidas por el modo offline y el multijugador. El servidor conserva la autoridad en multijugador: el cliente puede previsualizar una intención con estas reglas, pero solo el servidor valida y muta el estado oficial.

## Fuente de verdad

Las magnitudes canónicas viven en `lib/gameplay/rules.ts`. Los módulos puros de movimiento, pathfinding, combate e IA son consumidos por ambos modos. `app/play/gameConfig.ts` mantiene reexportaciones de compatibilidad mientras se completa la inversión de dependencias desde `app/play` hacia `lib/gameplay`.

| Regla | Valor | Observación |
| --- | ---: | --- |
| Mapa | 65 × 40 tiles | 5.200 × 3.200 unidades; tile de 80 |
| Visión | 8 tiles | Distancia Chebyshev; misma geometría en render y serialización |
| Movimiento base | 4 tiles | Cada criatura puede modificarlo |
| Ataque | 3 tiles | Requiere camino caminable dentro del rango |
| Parry | Hasta el alcance del ataque recibido | Ventana de 850 ms; se consume con el primer golpe válido |
| Radar | 14–22 tiles | Por criatura; visión permanece en 8 |
| Cooldown de ataque | 950 ms | Jugadores e IA no recuperan ataques perdidos por lag |
| Stun de parry | 2.400 ms | Impide tomar turnos |
| Parry fallido | 1.400 ms | Si la ventana vence sin bloquear un golpe, aturde al defensor |

## Movimiento

- Se mueve por tiles cardinales y usa BFS para calcular una ruta caminable.
- El rango se mide por longitud de ruta, no por distancia visual en píxeles.
- El cooldown depende de tiles recorridos y del multiplicador de la criatura.
- Una ruta aceptada se ejecuta paso a paso; ningún loop recupera varios pasos instantáneos tras un retraso.
- `H` es caminable pero letal. `W` es agua oscura no letal: aumenta 25% el cooldown y 30% el ruido. `R` cura 22% tras 2,8 s y se agota; `N` identifica un nido.

## Visión, radar y ruido

- Visible, caminable y atacable son conceptos distintos y se muestran con capas distintas.
- La visión usa la misma métrica de tiles en cliente y servidor.
- El radar recibe eventos abstractos de gameplay. La IA escucha `NoiseEvent`; no depende de Web Audio.
- El radar agrupa señales activas por fuente y no muestra el ruido propio; cada contacto conserva una pulsación breve.
- Ecolocalización amplía temporalmente la visión directa en 6 tiles, además de mejorar alcance y precisión del radar durante 5 s.
- Movimiento, ataque y defensa pueden crear ruido con radio e intensidad.
- El sigilo de la criatura reduce radio e intensidad del ruido mediante `lib/creature-gameplay.ts`.
- Cada señal y ruido tiene un ID estable con timestamp y secuencia; el timestamp por sí solo no es identidad.

## Combate

- Un ataque es de objetivo único. Entre los objetivos alcanzables se elige el más cercano y se desempata por ID estable.
- Daño base del jugador: 30, ajustado por ataque del atacante y defensa del objetivo.
- El daño de IA proviene de su `EnemyConfig.damage`; no existe un daño online paralelo.
- Un parry activo evita el daño, consume la ventana y aturde al atacante.
- Si la ventana de parry vence sin recibir un ataque, el defensor queda aturdido durante 1.400 ms.
- Una entidad muerta queda en estado `dead`, con HP 0 y sin movimiento, ataque, percepción ni eventos nuevos.

## Diferencias intencionales por modo

Offline termina al eliminar la amenaza PvE y puede usar objetivos individuales. Multijugador añade salas, ready check, PvP, reconexión, eliminación y ganador autoritativo. Estas diferencias de orquestación no cambian alcance, daño, cooldown, IA, mapa, señales ni estadísticas.

## Criaturas

| Criatura | HP | Movimiento | CD movimiento | Ruido | Daño saliente | Daño entrante | Radar |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ajolote | 100 | 4 | ×1,00 | ×0,90 | ×1,00 | ×0,94 | 18 |
| Camarón | 78 | 5 | ×0,78 | ×0,55 | ×0,90 | ×1,12 | 15 |
| Pez ciego | 86 | 4 | ×0,92 | ×0,72 | ×0,92 | ×1,04 | 22 |
| Cangrejo | 125 | 3 | ×1,12 | ×1,15 | ×0,95 | ×0,72 | 14 |
| Araña | 84 | 4 | ×0,88 | ×0,62 | ×1,15 | ×1,06 | 17 |

Las habilidades activas viven en `lib/gameplay/abilities.ts`; la sanidad posicional vive en `lib/gameplay/sanity.ts`. Ambos motores se usan en local y servidor.
