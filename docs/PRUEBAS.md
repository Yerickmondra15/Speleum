# Pruebas y CI

## Comandos

```bash
npm run test:run
npm run lint
npm run typecheck
npm run build
```

## Cobertura de gameplay

La suite cubre rutas y paredes, cuatro entradas por plantilla, acceso a todo tile seguro sin cruzar `H`, ataque, parry exitoso/fallido, stun, visión de 8 tiles, ecolocalización temporal, radar agrupado por fuente, IDs de señales, IA con un paso por cooldown, ausencia de IA contra IA en local, terreno `H/W/R/N/S`, refugios limitados, curación acotada, sanidad a 10/20 s, pausa, cinco habilidades y cooldowns.

Las pruebas procedurales recorren matrices de semillas, conectividad total, diversidad, spawns caminables/separados y variación seeded entre partidas.

Las integraciones Socket.IO levantan un servidor real en puerto efímero y verifican autenticación, salas, ready/start, movimiento, combate, reconexión, resultados, payloads inválidos, habilidad autoritativa, curación por baja y exclusión de sanidad durante desconexión.

## Fuera de alcance actual

- PostgreSQL real y contención entre instancias.
- Entrega real de correo.
- E2E visual en navegadores/dispositivos físicos.
- Bosses/elites, porque todavía no existe ese sistema de gameplay.
