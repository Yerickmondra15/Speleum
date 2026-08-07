# Hoja de ruta de gameplay

## Completado en `agent/gameplay-overhaul`

1. Constantes, rangos, IDs, catálogo de criaturas y geometría de visión unificados.
2. IA determinista por entidad con percepción, memoria, cooldown y muerte terminal.
3. Reconexión con ACK, takeover autenticado y recuperación de sesiones obsoletas.
4. Generación procedural determinista, variada y 100% conectada.
5. Pruebas de paridad y HUD de escritorio compacto con detalles colapsables.
6. Motores puros y probados para habilidades y cordura, todavía sin activación en runtime.

## Siguiente incremento: activar habilidades

Crear un contrato pequeño, compartido y data-driven:

```ts
type AbilityDefinition = {
  id: string;
  creatureId: CreatureId;
  cooldownMs: number;
  validate(context: AbilityContext): AbilityFailure | null;
  resolve(context: AbilityContext): GameplayEvent[];
};
```

El cliente envía una intención; offline o el servidor ejecutan el mismo validador/resolutor. Primero se implementará una familia de efectos reutilizables —pulso, mitigación breve, desplazamiento corto o señuelo de ruido— antes de cinco sistemas especiales independientes.

## Siguiente incremento: activar cordura

La cordura será un reducer por eventos, no un contador que decrece cada segundo.

- Factores: inactividad prolongada, proximidad hostil confirmada, oscuridad/eventos y daño.
- Recuperación: movimiento con propósito, refugio y completar una acción relevante.
- Umbrales iniciales: estable (70–100), tensión (40–69), distorsión (20–39), crisis (0–19).
- Consecuencias iniciales: señales dudosas y jitter de radar; nunca información falsa enviada por el servidor como si fuera estado real.

## Después

- Consolidar catálogo visual y modificadores efectivos de criaturas.
- Añadir objetivos PvE y escape sobre el loop explorar–escuchar–decidir–combatir.
- Añadir línea de visión por paredes tras medir su impacto en balance.
- Separar snapshot de mapa inmutable del estado dinámico online.
- Persistir rooms/snapshots y coordinar un único loop si se despliega más de una instancia.
- Traducir eventos abstractos de ruido a audio sin acoplar IA a Web Audio.
