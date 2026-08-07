# Diseño de inteligencia artificial

La IA es una máquina de estados compartida. Offline ejecuta el mismo paso puro que el servidor; multijugador solo cambia quién es la autoridad.

## Estados

`idle`, `patrol`, `listening`, `investigating`, `ambushing`, `chasing`, `attacking`, `stunned` y `dead`.

Flujo normal:

```text
idle/patrol -> listening -> investigating -> chasing -> attacking
                       \-> patrol (si no confirma el objetivo)
```

`stunned` interrumpe temporalmente cualquier acción. `dead` es terminal.

## Reloj por entidad

Cada enemigo conserva `lastMoveAt`, `nextMoveAt`, `lastAttackAt` y `nextAttackAt`.

- La percepción puede evaluarse en cada tick.
- Si `now < nextMoveAt`, no hay desplazamiento.
- Si `now < nextAttackAt`, no hay golpe ni señal de ataque.
- Cada evaluación permite como máximo un paso y un golpe.
- Tras lag se programa desde `now + cooldown`; nunca se usa un bucle de recuperación.
- `speed` y `chaseSpeed` se convierten en milisegundos por tile mediante la regla compartida.

## Percepción sin omnisciencia

La IA recibe objetivos vivos y eventos de ruido abstractos. Un objetivo solo actualiza su posición conocida cuando está detectado. Al perderlo, la última posición queda congelada; la IA investiga ese tile, escucha y después vuelve a patrulla si no redetecta.

El ruido se puntúa por tipo, intensidad, radio y distancia. Un evento inaudible no revela al emisor. La integración futura de audio puede reproducir un sonido, pero la IA solo consume el `NoiseEvent` de gameplay.

## Patrulla y pathfinding

Los waypoints procedurales deben ser tiles caminables y estar en el componente conectado del mapa. Si un camino deja de existir, la IA avanza al siguiente waypoint en vez de oscilar indefinidamente.

`territorial` puede quedarse quieta en su origen y `ambusher` puede esperar sin estímulo: esos son comportamientos intencionales, no un fallo de timer.

## Muerte

La transición terminal fija HP 0, `alive=false`, `state=dead`, limpia target/memoria accionable y cancela timestamps futuros. Los pulsos ya emitidos pueden completar su TTL; nunca se crean señales, ruidos, pasos o ataques nuevos desde una entidad muerta.
