# Mejoras Futuras de Speleum

Este plan organiza el trabajo pendiente de Speleum por prioridad para orientar la etapa final del proyecto.

## Alta prioridad

- Terminar de estabilizar partidas en tiempo real.
- Mejorar sincronizacion completa de acciones entre jugadores.
- Ajustar historial de partidas y registro de ganador.
- Mejorar validaciones de sesion y seguridad.
- Revisar reconexion y salida ordenada de salas.
- Afinar consistencia de radar y señales compartidas en multijugador.

## Media prioridad

- Mejorar perfil con estadisticas mas detalladas.
- Agregar mas criaturas y comportamientos.
- Mejorar balance de combate, defensa y cooldowns.
- Mejorar responsive del modo juego.
- Ampliar feedback visual del radar y del combate.
- Incorporar mas variedad de amenazas de cueva.

## Baja prioridad

- Mas animaciones de interfaz y transiciones diegeticas.
- Mas personalizacion visual.
- Sonido ambiental.
- Skins o cosmeticos.
- Elementos decorativos extra para landing y overlays.

## Cronograma sugerido hasta la entrega final

### Semana 1

- Implementacion:
  - estabilizacion de partidas en tiempo real
  - ajuste de sincronizacion de ataque, defensa y movimiento
- Pruebas:
  - validacion manual de flujos local y multijugador

### Semana 2

- Implementacion:
  - mejora de perfil, ranking y guardado de resultados
  - ajuste de balance de criaturas y amenazas
- Pruebas:
  - verificacion de persistencia en PostgreSQL
  - pruebas de autenticacion, sesion y flujo completo

### Semana 3

- Documentacion:
  - cierre de README y documentos tecnicos
  - captura de evidencias visuales
- Despliegue:
  - revision de variables de entorno
  - build final y despliegue en Vercel y servicio de sockets si aplica

## Enfoque recomendado

Primero conviene cerrar estabilidad jugable y persistencia, luego reforzar pruebas, y finalmente pulir documentacion y despliegue. De esa forma el proyecto mantiene una base funcional preparada para ampliacion sin desalinearse del codigo real.
