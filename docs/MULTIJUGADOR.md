# Multijugador

## Flujo de conexión

1. El navegador autenticado solicita `POST /api/socket/ticket`.
2. Socket.IO verifica firma, vencimiento y uso único del ticket.
3. La identidad validada se guarda en `socket.data`.
4. Crear, unir, ready, movimiento, ataque, defensa, salida y reanudación validan estado y pertenencia a la sala.

El nombre temporal y la criatura se validan, pero nunca sustituyen la identidad autenticada.

## Estado autoritativo

El servidor conserva posición, vida máxima y actual, cooldowns, parry, stun, kills, daño, enemigos, señales, ruidos y estado de sala. El cliente envía intenciones; el servidor valida ruta, rango, colisiones, cooldown y consecuencias.

## Reconexión

- Una desconexión inesperada marca al jugador como desconectado durante 25 segundos.
- Se preservan posición, vida, kills, cooldowns, ruta, parry, stun, sala y partida.
- Un nuevo socket con la misma identidad emite `resume-room { roomCode }` y se enlaza al mismo `player.id`.
- Otro usuario no puede recuperar la sesión.
- `leave-room` es definitivo y no crea ventana de reconexión.
- Si vence la gracia durante una partida, el jugador pierde. En lobby se elimina.
- Una sala terminada aún puede devolver el estado final mientras permanezca en memoria.

El cliente guarda solo `matchId`, `roomCode`, `playerId`, nombre y criatura en `sessionStorage`; esa información ayuda a la interfaz, no autentica.

## Ciclo de vida

Un proceso central, no un timer por evento, atiende:

- movimiento y combate;
- ready check e inicio;
- señales y ruidos vencidos;
- jugadores que excedieron la gracia;
- lobbies inactivos por 15 minutos;
- salas vacías;
- partidas finalizadas retenidas 2 minutos;
- índices de sockets y tickets usados.

Los intervalos usan `unref()` y `createSocketGameServer().close()` los detiene, desconecta Socket.IO y vacía almacenes; esto permite pruebas sin procesos colgados.

## Resultados

Al finalizar, el servidor calcula placement, victoria, kills y puntuación (máximo 300), y firma un comprobante individual para cada usuario. El comprobante no permite guardar para otra identidad ni cambiar ganador o score.

## Despliegue

El frontend y Socket.IO pueden estar en dominios diferentes. Configurar:

- frontend: `NEXT_PUBLIC_SOCKET_URL`;
- Socket.IO: `FRONTEND_URL` o `ALLOWED_ORIGINS`;
- ambos procesos: el mismo `SOCKET_AUTH_SECRET` y `MULTIPLAYER_RESULT_SECRET`.

## Limitación de escalado

La arquitectura actual es de una sola instancia. No usar balanceo hacia varias instancias: una sala, un ticket consumido o una sesión desconectada no existen en otro proceso. El paso futuro correcto es un adaptador Socket.IO con Redis y estado compartido/atómico, no afinidad de sesión presentada como solución completa.
