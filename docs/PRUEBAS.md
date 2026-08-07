# Pruebas y CI

## Comandos

```bash
npm run test          # modo interactivo
npm run test:run      # una ejecución
npm run test:coverage # cobertura V8
npm run lint
npm run typecheck
npm run build
```

## Cobertura funcional

La suite contiene 44 casos en cinco archivos:

- coordenadas, rutas, bloqueos, ataque, visión, daño, parry, stun y cooldown;
- radar, fusión de pulsos y eliminación de señales vencidas;
- cueva reproducible y spawns separados;
- catálogo y modificadores de criaturas;
- firma, alteración y expiración de tickets;
- contrato local/multijugador, duración y pertenencia del comprobante;
- 20 integraciones Socket.IO: autenticación, replay, salas, capacidad, ready/start, movimiento, ataque, parry, desconexión/reanudación/salida, final, limpieza, suplantación y payload inválido.

Las integraciones levantan HTTP y Socket.IO en un puerto efímero. Cada prueba desconecta clientes, limpia salas y el cierre final detiene los tres intervalos del servidor.

## Qué no prueba todavía

- La transacción real contra PostgreSQL y contención simultánea de varias instancias de API.
- La entrega real de Resend.
- Flujos end-to-end en un navegador con base de datos real.
- Compatibilidad entre varias instancias Socket.IO, porque no está soportada.

La idempotencia está reforzada por contrato, transacción serializable y clave única, pero se recomienda añadir Testcontainers/PostgreSQL para probar carreras de persistencia reales.

## GitHub Actions

`.github/workflows/ci.yml` se ejecuta en pull requests y pushes a `main`, usa Node 20 y corre `npm ci`, `prisma generate`, lint, typecheck, tests y build. Las URL y secretos del job son valores aislados de CI; no existe un PostgreSQL real porque estas tareas no conectan durante build o tests.
