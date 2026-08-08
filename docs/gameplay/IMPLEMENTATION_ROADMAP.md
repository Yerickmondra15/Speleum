# Hoja de ruta de gameplay

## Completado en `agent/gameplay-overhaul`

1. Constantes, rangos, IDs, catálogo de criaturas y geometría de visión unificados.
2. IA determinista por entidad con percepción, memoria, cooldown y muerte terminal.
3. Reconexión con ACK, takeover autenticado y recuperación de sesiones obsoletas.
4. Generación procedural determinista, variada y 100% conectada.
5. Pruebas de paridad y HUD de escritorio compacto con detalles colapsables.
6. Motores puros de habilidades y sanidad integrados en runtime local y multijugador autoritativo.

## Incremento completado: habilidades activas

Se implementó un contrato pequeño, compartido y data-driven:

```ts
type AbilityDefinition = {
  id: string;
  creatureId: CreatureId;
  cooldownMs: number;
  validate(context: AbilityContext): AbilityFailure | null;
  resolve(context: AbilityContext): GameplayEvent[];
};
```

El cliente envía una intención; offline o el servidor ejecutan el mismo validador/resolutor. Están activas regeneración, impulso silencioso, ecolocalización, caparazón y trampa de seda.

## Incremento completado: sanidad anti-camping

La sanidad depende de la última celda realmente ocupada: feedback desde 10 s y daño desde 20 s. Ataque o defensa no reinician el reloj. Pausa local y desconexión multijugador suspenden el castigo.

## Después

- Consolidar catálogo visual y modificadores efectivos de criaturas.
- Añadir objetivos PvE y escape sobre el loop explorar–escuchar–decidir–combatir.
- Añadir línea de visión por paredes tras medir su impacto en balance.
- Separar snapshot de mapa inmutable del estado dinámico online.
- Persistir rooms/snapshots y coordinar un único loop si se despliega más de una instancia.
- Traducir eventos abstractos de ruido a audio sin acoplar IA a Web Audio.
