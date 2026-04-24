# Diseno de juego minimo para Speleum

## 1. Propuesta clara del juego

### Concepto base
Speleum es un juego web multijugador 1 vs 1 de exploracion y supervivencia en una cueva oscura. Cada jugador controla una criatura subterranea y solo puede ver un radio corto a su alrededor. La partida gira en torno a explorar, evitar peligros, encontrar la salida y sobrevivir mejor que el rival.

### Version minima recomendada para la entrega
La mejor version minima para una entrega escolar es un juego top-down por casillas.

Esto permite:
- implementar vision limitada sin complejidad extra
- hacer colisiones y zonas peligrosas con reglas faciles de explicar
- sincronizar dos jugadores mas facilmente
- terminar una version jugable y estable en menos tiempo

### Fantasia jugable
- ambiente: cueva profunda, humeda y oscura
- tono visual: negro, gris palido, blanco sucio y rosa apagado
- criaturas: ajolote ciego, camaron de cueva, larva luminica apagada
- emocion principal: tension por no saber que hay mas adelante

### Bucle principal
1. Entrar al menu.
2. Elegir criatura.
3. Crear sala o unirse con codigo.
4. Esperar al segundo jugador.
5. Explorar con vision limitada.
6. Evitar amenaza, trampas y zonas peligrosas.
7. Encontrar la salida.
8. Ganar por escapar con mejor estado o sobrevivir mas que el rival.

## 2. Flujo completo de pantallas

### Menu principal
Objetivo: entrada rapida al juego.

Elementos:
- boton `Jugar`
- boton `Ranking local`
- boton `Como jugar`
- fondo animado con niebla y brillo suave
- criatura en idle respirando lentamente

### Seleccion de personaje
Objetivo: elegir identidad visual y una pasiva simple.

Opciones minimas:
- Ajolote de cueva: mas vida
- Camaron de cueva: mas velocidad

Datos visibles:
- ilustracion o sprite
- nombre
- ventaja simple
- boton `Confirmar`

### Crear sala
Objetivo: generar una partida.

Elementos:
- codigo de sala
- boton `Copiar codigo`
- boton `Esperar jugador`

### Unirse con codigo
Objetivo: entrar a una sala existente.

Elementos:
- input para codigo
- boton `Unirse`
- mensaje de error si el codigo no existe

### Pantalla de espera
Objetivo: confirmar que la sala esta activa.

Elementos:
- codigo de sala visible
- estado `Jugador 1 listo`
- estado `Esperando jugador 2`
- animacion sutil de respiracion o brillo
- texto corto de lore o tip

### Partida
Objetivo: fase jugable principal.

Capas:
- mapa central
- niebla de guerra
- HUD compacto
- alertas temporales

### Victoria
Se muestra si el jugador gana por mejor puntuacion o por condicion de supervivencia.

Elementos:
- texto `Escapaste de Speleum`
- puntuacion final
- resumen rapido de la partida
- boton `Volver al menu`

### Derrota
Se muestra si el jugador muere, abandona o pierde por puntuacion.

Elementos:
- texto `La cueva te reclamo`
- causa de derrota
- comparacion breve con rival
- boton `Reintentar` o `Volver al menu`

### Ranking local
Objetivo: guardar resultados en localStorage para la entrega.

Campos:
- nombre del jugador
- criatura usada
- resultado
- puntuacion
- tiempo de partida
- fecha

## 3. Mecanicas principales

### Vision limitada
Mecanica imprescindible.

Regla recomendada:
- cada jugador ve un radio de 4 casillas alrededor de su posicion
- eso produce una ventana de 9x9 centrada en el personaje
- fuera de esa zona, el mapa se ve negro o con niebla opaca

Extras visuales:
- bordes difusos
- pequenas particulas
- pulso suave de luz alrededor del personaje

### Movimiento
Recomendacion para MVP: movimiento por casillas.

Motivo:
- es mas facil de implementar
- hace mas clara la lectura tactica
- encaja mejor con vision corta
- reduce bugs de colision

Regla:
- un paso por tecla o un paso cada pocos milisegundos al mantener direccion

Si quieres que se vea menos rigido:
- interpolar visualmente el sprite entre casillas
- agregar squash ligero al frenar
- reproducir una vibracion breve al entrar en zona peligrosa

### Encuentros entre jugadores
Cuando ambos jugadores estan cerca o entran en la misma zona visible:
- aparece un indicador de presencia rival
- si se pisan o quedan adyacentes, ocurre un encuentro

Version minima del encuentro:
- ambos reciben dano leve
- ambos son empujados una casilla
- se revela por un instante la posicion del rival

Esto evita tener que disenar combate complejo.

### Enemigo o amenaza del mapa
Para MVP conviene una sola amenaza global:
- una criatura ciega que patrulla
- o un derrumbe viviente que persigue ruido

Comportamiento simple:
- se mueve cada cierto tiempo
- prioriza zonas cercanas a jugadores
- si toca al jugador, inflige mucho dano

### Zonas peligrosas
Agregar 2 tipos maximo:
- lodo profundo: reduce velocidad o consume tiempo extra
- grieta toxica: quita vida al cruzar

### Salida o meta
La salida debe:
- estar lejos del spawn
- no ser visible al inicio
- activarse visualmente con brillo blanco rosado cuando el jugador la descubre

### Sistema de puntuacion
Puntuacion simple y facil de explicar:
- +100 por llegar a la salida
- +30 por sobrevivir
- +20 por descubrir la salida primero
- +10 por cada zona nueva explorada
- -20 por recibir dano grave
- -50 por morir

## 4. HUD recomendado

El HUD debe ser pequeno para no tapar el mapa.

### Cluster superior izquierdo
- vida o estado
- zona actual
- amenaza cercana

### Cluster superior derecho
- tiempo
- codigo de sala
- estado del otro jugador

### Cluster inferior izquierdo
- puntuacion actual

### Centro inferior temporal
- avisos como `Amenaza cerca`, `Zona toxica`, `Has visto al rival`

### Estados a mostrar
- Vida: `Alta`, `Media`, `Critica`
- Zona actual: `Tunel humedo`, `Camara fosil`, `Paso toxico`
- Amenaza cercana: `Baja`, `Media`, `Alta`
- Estado rival: `Explorando`, `Herido`, `Desconectado`, `Escapo`

## 5. Reglas del modo multijugador

### Si un jugador llega a la salida
- no termina de inmediato la partida
- se activa una cuenta regresiva corta de 15 segundos
- el otro jugador puede intentar escapar tambien o sumar puntos finales

Esto evita victorias anticlimaticas.

### Si un jugador muere
- queda eliminado
- el otro gana de forma automatica si sigue con vida
- si ambos estan en estado critico, se revisa la puntuacion final

### Si ambos llegan
- gana quien tenga mayor puntuacion total
- si hay empate, gana quien llego primero
- si aun hay empate, ambos quedan como `Supervivencia compartida`

### Si uno se desconecta
- esperar 10 segundos para reconexion
- si no vuelve, pierde por abandono
- el rival gana y recibe bonificacion de supervivencia

### Como se calcula el ganador
Orden recomendado:
1. Jugador vivo y rival muerto.
2. Jugador que escapo y rival no.
3. Si ambos escaparon, mayor puntuacion.
4. Si nadie escapo, mayor puntuacion al final del tiempo.
5. Si empatan, gana quien sufrio menos dano.

## 6. Ideas para que no se sienta statico

### Animaciones simples
- idle con respiracion
- pequeno rebote al moverse
- estela leve al correr
- parpadeo del brillo del personaje

### Senales visuales
- borde de pantalla con pulso rosado si hay peligro
- icono de amenaza cuando el enemigo esta cerca
- destello corto al descubrir salida o rival

### Particulas
- polvo flotando
- gotas de humedad
- motas blancas dentro del radio visible

### Niebla
- capa oscura sobre todo el mapa
- apertura circular alrededor del jugador
- bordes suaves en vez de circulo duro

### Vibracion de pantalla
- muy corta cuando:
  - el enemigo golpea
  - ocurre un derrumbe
  - el jugador entra en una grieta toxica

### Cambios de iluminacion
- luz tenue normal
- pulso mas fuerte al detectar amenaza
- brillo especial al acercarse a la salida

### Feedback al moverse
- sonido seco de paso o burbujeo
- sprite con inclinacion de 2 o 3 grados
- sombreado debajo del personaje que cambie levemente

## 7. Lista de mecanicas imprescindibles

- mapa por casillas
- vision limitada de 8 casillas alrededor
- 2 personajes elegibles
- crear sala
- unirse con codigo
- pantalla de espera
- movimiento del jugador
- 1 amenaza del mapa
- 2 tipos de zona peligrosa
- salida del nivel
- vida o estado
- puntuacion
- pantalla de victoria y derrota
- ranking local en localStorage

## 8. Lista de mejoras opcionales

- habilidades unicas por criatura
- objetos recogibles
- huellas o rastros del rival
- minimapa temporal
- varios tipos de amenazas
- eventos aleatorios como derrumbes
- semillas de mapa distintas
- efectos de sonido reactivos
- niebla dinamica mas avanzada
- ranking con top 10 y filtro por criatura

## 9. Recomendacion de implementacion para tu proyecto

Para una entrega escolar, esta es la version mas segura y convincente:

- vista top-down 2D
- mapa en grid
- logica de juego separada del HUD
- HUD en DOM
- partida corta de 2 a 4 minutos
- sincronizacion 1 vs 1 con codigo de sala
- ranking guardado en localStorage

### Orden de desarrollo sugerido
1. Flujo de pantallas.
2. Crear y unirse a sala.
3. Movimiento y vision limitada.
4. Amenaza del mapa y zonas peligrosas.
5. Salida y reglas de victoria.
6. HUD y ranking local.
7. Pulido visual.

## 10. Encaje con la estructura actual del proyecto

Tu repo ya tiene piezas que encajan bien con este MVP:

- `app/play/components/MultiplayerMenu.tsx`: menu para crear o unirse a sala
- `app/play/components/MatchmakingScreen.tsx`: pantalla de espera
- `app/play/components/CharacterSelect.tsx`: seleccion de criatura
- `app/play/components/GameHud.tsx`: HUD compacto
- `app/play/components/GameMap.tsx`: mapa con vision limitada
- `app/play/components/GameOverlay.tsx`: victoria, derrota y alertas
- `app/play/components/MultiplayerGame.tsx`: coordinacion de partida 1 vs 1
- `app/ranking.tsx`: ranking local

La recomendacion es no expandir mucho el alcance y reutilizar estos puntos de entrada para montar el flujo completo.

## 11. Explicacion corta para presentar al profesor

Speleum es un juego web multijugador 1 vs 1 de exploracion y supervivencia ambientado en una cueva oscura. Cada jugador tiene vision limitada, por lo que debe avanzar con cuidado, evitar peligros y encontrar la salida antes o mejor que su rival. La propuesta esta pensada como un MVP funcional y claro: usa movimiento por casillas, una amenaza principal del mapa, zonas peligrosas, sistema de puntuacion y pantallas completas de sala, espera, partida y resultado. Esto permite demostrar diseno de interfaces, flujo de usuario, logica de juego y base multijugador en una entrega alcanzable.
