import type { CharacterOption, Zone } from "@/app/play/gameConfig";
import { getCreatureById, type CreatureId, type CreatureStatKey } from "@/lib/creatures";
import type { Locale } from "./messages";

const creatureCopy = {
  "cave-axolotl": {
    es: {
      name: "Ajolote de cueva",
      short: "Explorador equilibrado y sensible a las vibraciones cercanas.",
      role: "Explorador sensible",
      ability: "Regeneración cavernícola: recupera 18% de vida durante 4,5 s. Cooldown: 32 s.",
    },
    en: {
      name: "Cave axolotl",
      short: "Balanced explorer sensitive to nearby vibrations.",
      role: "Sensitive explorer",
      ability: "Cavern regeneration: restores 18% health over 4.5 s. Cooldown: 32 s.",
    },
  },
  "cave-shrimp": {
    es: {
      name: "Camarón de cueva",
      short: "Criatura rápida y evasiva, útil para reposicionarse.",
      role: "Rápido / evasivo",
      ability: "Impulso fantasma: el siguiente movimiento gana 2 tiles y genera mucho menos ruido. Cooldown: 17 s.",
    },
    en: {
      name: "Cave shrimp",
      short: "Fast, evasive creature that excels at repositioning.",
      role: "Fast / evasive",
      ability: "Ghost surge: the next move gains 2 tiles and makes far less noise. Cooldown: 17 s.",
    },
  },
  "blind-fish": {
    es: {
      name: "Pez ciego",
      short: "Rastrea el entorno en silencio y evita el combate frontal.",
      role: "Rastreador / silencioso",
      ability: "Ecolocalización: amplía la visión 6 tiles, extiende el radar y mejora su precisión durante 5 s. Cooldown: 22 s.",
    },
    en: {
      name: "Blind fish",
      short: "Tracks the environment quietly and avoids frontal combat.",
      role: "Tracker / silent",
      ability: "Echolocation: expands vision by 6 tiles, extends radar, and improves its precision for 5 s. Cooldown: 22 s.",
    },
  },
  "cave-crab": {
    es: {
      name: "Cangrejo cavernícola",
      short: "Controla pasillos estrechos y resiste mejor los encuentros directos.",
      role: "Defensivo / tanque",
      ability: "Caparazón: reduce 70% del daño durante 2,5 s, pero inmoviliza. Cooldown: 24 s.",
    },
    en: {
      name: "Cave crab",
      short: "Controls narrow corridors and withstands direct encounters better.",
      role: "Defensive / tank",
      ability: "Shell: reduces damage by 70% for 2.5 s, but prevents movement. Cooldown: 24 s.",
    },
  },
  "cave-spider": {
    es: {
      name: "Araña cavernícola",
      short: "Cazadora sigilosa que rinde mejor cuando ya ganó posición.",
      role: "Cazadora / sigilosa",
      ability: "Trampa de seda: dura 11 s y aturde 1,5 s al primer hostil. Cooldown: 28 s.",
    },
    en: {
      name: "Cave spider",
      short: "Stealth hunter that performs best after securing position.",
      role: "Hunter / stealth",
      ability: "Silk trap: lasts 11 s and stuns the first hostile for 1.5 s. Cooldown: 28 s.",
    },
  },
} as const satisfies Record<
  CreatureId,
  Record<Locale, { name: string; short: string; role: string; ability: string }>
>;

const characterTraits = {
  "cave-axolotl": {
    es: "Percibe ecos con estabilidad y mantiene una visión equilibrada.",
    en: "Reads echoes steadily and keeps a balanced field of vision.",
  },
  "cave-crab": {
    es: "Especialista en bloquear rutas estrechas.",
    en: "Specialist at blocking narrow routes.",
  },
  "blind-fish": {
    es: "Lee corrientes y cambios de presión.",
    en: "Reads currents and pressure shifts.",
  },
  "cave-shrimp": {
    es: "Se reposiciona con impulsos cortos y deja señales más tenues.",
    en: "Repositions with short bursts and leaves fainter signals.",
  },
  "cave-spider": {
    es: "Aprovecha paredes y espera emboscadas.",
    en: "Uses walls and waits for ambush openings.",
  },
} as const satisfies Record<CreatureId, Record<Locale, string>>;

const statLabels = {
  vida: { es: "vida", en: "health" },
  velocidad: { es: "velocidad", en: "speed" },
  sigilo: { es: "sigilo", en: "stealth" },
  defensa: { es: "defensa", en: "defense" },
  deteccion: { es: "detección", en: "detection" },
} as const satisfies Record<CreatureStatKey, Record<Locale, string>>;

const zoneBaseCopy = {
  "safe-hollow": {
    es: { name: "Refugio inicial", subtitle: "Respira y escucha", ambient: "La roca amortigua el ruido. Recuperas compostura por un instante." },
    en: { name: "Starting refuge", subtitle: "Breathe and listen", ambient: "The rock dampens the noise. You recover your composure for a moment." },
  },
  "thin-tunnels": {
    es: { name: "Túneles estrechos", subtitle: "Cuello de botella", ambient: "Las paredes aprietan. Aquí cada encuentro se vuelve letal." },
    en: { name: "Narrow tunnels", subtitle: "Bottleneck", ambient: "The walls tighten in. Every encounter becomes lethal here." },
  },
  "echo-pocket": {
    es: { name: "Bolsillo de eco", subtitle: "Respiro incierto", ambient: "Una grieta corta el ruido. Apenas alcanza para recomponerte." },
    en: { name: "Echo pocket", subtitle: "Uncertain respite", ambient: "A crack cuts the noise. It is barely enough to recover." },
  },
  "false-passage": {
    es: { name: "Grieta falsa", subtitle: "Engaño mineral", ambient: "La cueva susurra rutas falsas y castiga la distracción." },
    en: { name: "False fissure", subtitle: "Mineral deception", ambient: "The cave whispers false routes and punishes distraction." },
  },
  "open-abyss": {
    es: { name: "Cámara abierta", subtitle: "Exposición total", ambient: "La amplitud te da aire, pero también te vuelve un objetivo." },
    en: { name: "Open chamber", subtitle: "Full exposure", ambient: "The openness gives you room to breathe, but it also turns you into a target." },
  },
  "pool-rim": {
    es: { name: "Borde de la laguna", subtitle: "Superficie tensa", ambient: "El agua devuelve ecos deformados. Quedarte quieto aquí es un error." },
    en: { name: "Lagoon rim", subtitle: "Tense surface", ambient: "The water returns distorted echoes. Standing still here is a mistake." },
  },
  "hunter-den": {
    es: { name: "Nido del acechante", subtitle: "Corazón hostil", ambient: "Algo respira contigo. La cueva caza a quien se quede quieto." },
    en: { name: "Hunter's den", subtitle: "Hostile heart", ambient: "Something breathes with you. The cave hunts whoever stays still." },
  },
  "last-corridor": {
    es: { name: "Corredor final", subtitle: "Sin margen", ambient: "Aquí ya no se escucha la cueva: te escucha a ti." },
    en: { name: "Final corridor", subtitle: "No margin", ambient: "The cave is no longer heard here: it hears you." },
  },
  "final-gate": {
    es: { name: "Cámara umbral", subtitle: "Presión extrema", ambient: "No hay salida. Solo roca, hambre y criaturas buscando el final." },
    en: { name: "Threshold chamber", subtitle: "Extreme pressure", ambient: "There is no exit. Only rock, hunger, and creatures chasing the end." },
  },
} as const;

type ZoneBaseId = keyof typeof zoneBaseCopy;

const proceduralZoneCopy = {
  "start-refuge": {
    es: { name: "Refugio inicial", subtitle: "Base de respiración", ambient: "Las paredes todavía amortiguan el ruido y te dejan reagruparte." },
    en: { name: "Starting refuge", subtitle: "Breathing base", ambient: "The walls still dampen sound and let you regroup." },
  },
  "narrow-tunnel": {
    es: { name: "Túnel de transición", subtitle: "Paso estrecho", ambient: "Cada eco viaja lejos en este cuello de botella." },
    en: { name: "Transition tunnel", subtitle: "Narrow passage", ambient: "Every echo travels far through this bottleneck." },
  },
  "wide-tunnel": {
    es: { name: "Túnel de transición", subtitle: "Paso estrecho", ambient: "Cada eco viaja lejos en este cuello de botella." },
    en: { name: "Transition tunnel", subtitle: "Narrow passage", ambient: "Every echo travels far through this bottleneck." },
  },
  "spider-nest": {
    es: { name: "Nido activo", subtitle: "Territorio hostil", ambient: "El nido vibra como si algo respirara en la piedra." },
    en: { name: "Active nest", subtitle: "Hostile territory", ambient: "The nest vibrates as if something were breathing inside the stone." },
  },
  "wet-chamber": {
    es: { name: "Cámara húmeda", subtitle: "Roca saturada", ambient: "La humedad deforma el sonido y confunde la distancia." },
    en: { name: "Wet chamber", subtitle: "Saturated rock", ambient: "Humidity distorts sound and confuses distance." },
  },
  "water-pocket": {
    es: { name: "Agua profunda", subtitle: "Suelo inestable", ambient: "El agua devuelve un eco traicionero y castiga la quietud." },
    en: { name: "Deep water", subtitle: "Unstable ground", ambient: "Water throws back treacherous echoes and punishes stillness." },
  },
  "danger-pocket": {
    es: { name: "Bolsa de peligro", subtitle: "Tensión continua", ambient: "La roca se siente hostil y cualquier error tiene costo." },
    en: { name: "Danger pocket", subtitle: "Constant tension", ambient: "The rock feels hostile and every mistake has a cost." },
  },
  "combat-chamber": {
    es: { name: "Cámara abierta", subtitle: "Espacio de choque", ambient: "La amplitud abre líneas de ataque y deja poco escondite." },
    en: { name: "Open chamber", subtitle: "Collision space", ambient: "The openness creates attack lines and leaves little cover." },
  },
  "broken-passage": {
    es: { name: "Pasillo roto", subtitle: "Garganta rota", ambient: "La cueva se fractura y obliga a atravesar puntos tensos." },
    en: { name: "Broken passage", subtitle: "Broken throat", ambient: "The cave fractures and forces you through tense choke points." },
  },
  "temporary-shelter": {
    es: { name: "Refugio temporal", subtitle: "Cobertura precaria", ambient: "Un respiro corto antes de volver a exponerte." },
    en: { name: "Temporary shelter", subtitle: "Precarious cover", ambient: "A short breath before exposing yourself again." },
  },
} as const;

export function getCreatureContent(locale: Locale, id: CreatureId) {
  return creatureCopy[id][locale];
}

export function getLocalizedCreature(locale: Locale, id: CreatureId | string) {
  const base = getCreatureById(id);
  const content = getCreatureContent(locale, base.id);

  return {
    ...base,
    nombre: content.name,
    descripcionCorta: content.short,
    rol: content.role,
    habilidad: content.ability,
  };
}

export function localizeCharacterOption(locale: Locale, option: CharacterOption): CharacterOption {
  const content = getCreatureContent(locale, option.id);

  return {
    ...option,
    name: content.name,
    role: content.role,
    ability: content.ability,
    description: content.short,
    trait: characterTraits[option.id][locale],
  };
}

export function getStatLabel(locale: Locale, stat: CreatureStatKey) {
  return statLabels[stat][locale];
}

const abilityNames: Record<CreatureId, Record<Locale, string>> = {
  "cave-axolotl": { es: "Regeneración cavernícola", en: "Cavern regeneration" },
  "cave-shrimp": { es: "Impulso fantasma", en: "Ghost surge" },
  "blind-fish": { es: "Ecolocalización", en: "Echolocation" },
  "cave-crab": { es: "Caparazón", en: "Fortified shell" },
  "cave-spider": { es: "Trampa de seda", en: "Silk trap" },
};

export function getLocalizedAbilityName(locale: Locale, creatureId: CreatureId) {
  return abilityNames[creatureId][locale];
}

const terrainNames: Record<string, Record<Locale, string>> = {
  "Peligro letal": { es: "Peligro letal", en: "Lethal hazard" },
  "Agua oscura": { es: "Agua oscura", en: "Dark water" },
  Refugio: { es: "Refugio", en: "Shelter" },
  "Refugio agotado": { es: "Refugio agotado", en: "Exhausted shelter" },
  Nido: { es: "Nido", en: "Nest" },
  "Punto de aparición": { es: "Punto de aparición", en: "Spawn point" },
  "Suelo cavernícola": { es: "Suelo cavernícola", en: "Cavern floor" },
};

export function localizeTerrainName(locale: Locale, terrainName: string) {
  return terrainNames[terrainName]?.[locale] ?? terrainName;
}

export function localizeZone(locale: Locale, zone: Zone): Zone {
  if (zone.id in zoneBaseCopy) {
    const copy = zoneBaseCopy[zone.id as ZoneBaseId][locale];
    return { ...zone, ...copy };
  }

  const prefix = zone.id.split("-").slice(0, -1).join("-");
  const copy = proceduralZoneCopy[prefix as keyof typeof proceduralZoneCopy];

  if (!copy) {
    return zone;
  }

  return {
    ...zone,
    ...copy[locale],
  };
}

const authMessageMap: Record<string, Record<Locale, string>> = {
  "Ingresa un correo valido.": {
    es: "Ingresa un correo válido.",
    en: "Enter a valid email address.",
  },
  "La contrasena debe tener al menos 6 caracteres.": {
    es: "La contraseña debe tener al menos 6 caracteres.",
    en: "The password must have at least 6 characters.",
  },
  "Ese correo ya existe.": {
    es: "Ese correo ya existe.",
    en: "That email already exists.",
  },
  "Ese nombre de usuario ya existe.": {
    es: "Ese nombre de usuario ya existe.",
    en: "That username already exists.",
  },
  "Completa correo y contrasena.": {
    es: "Completa correo y contraseña.",
    en: "Enter your email and password.",
  },
  "Tu correo aun no esta verificado. Te enviamos un nuevo codigo para activarlo.": {
    es: "Tu correo aún no está verificado. Te enviamos un nuevo código para activarlo.",
    en: "Your email is not verified yet. We sent you a new code to activate it.",
  },
  "Te enviamos un codigo para verificar tu correo.": {
    es: "Te enviamos un código para verificar tu correo.",
    en: "We sent you a code to verify your email.",
  },
  "Te enviamos un codigo para completar tu inicio de sesion.": {
    es: "Te enviamos un código para completar tu inicio de sesión.",
    en: "We sent you a code to complete your sign-in.",
  },
  "Completa el codigo de 6 digitos.": {
    es: "Completa el código de 6 dígitos.",
    en: "Enter the 6-digit code.",
  },
  "No encontramos un usuario valido para esta verificacion.": {
    es: "No encontramos un usuario válido para esta verificación.",
    en: "We couldn't find a valid user for this verification.",
  },
  "El codigo es invalido.": {
    es: "El código es inválido.",
    en: "The code is invalid.",
  },
  "El codigo expiro. Solicita uno nuevo.": {
    es: "El código expiró. Solicita uno nuevo.",
    en: "The code expired. Request a new one.",
  },
  "Este codigo ya fue utilizado.": {
    es: "Este código ya fue utilizado.",
    en: "This code has already been used.",
  },
  "No encontramos un desafio activo para este correo.": {
    es: "No encontramos un desafío activo para este correo.",
    en: "We couldn't find an active challenge for this email.",
  },
  "Debes esperar antes de reenviar otro codigo.": {
    es: "Debes esperar antes de reenviar otro código.",
    en: "You need to wait before resending another code.",
  },
  "Ya alcanzaste el limite de reenvios para este codigo.": {
    es: "Ya alcanzaste el límite de reenvíos para este código.",
    en: "You already reached the resend limit for this code.",
  },
  "Te enviamos un nuevo codigo para verificar tu correo.": {
    es: "Te enviamos un nuevo código para verificar tu correo.",
    en: "We sent you a new code to verify your email.",
  },
  "Te enviamos un nuevo codigo para completar tu inicio de sesion.": {
    es: "Te enviamos un nuevo código para completar tu inicio de sesión.",
    en: "We sent you a new code to complete your sign-in.",
  },
  "No se pudo completar la solicitud.": {
    es: "No se pudo completar la solicitud.",
    en: "The request could not be completed.",
  },
};

export function translateAuthMessage(locale: Locale, message: string) {
  return authMessageMap[message]?.[locale] ?? message;
}

const multiplayerEnglishMessages: Record<string, string> = {
  "Los datos para crear la sala no son validos.": "The room creation data is invalid.",
  "Ya perteneces a una sala.": "You already belong to a room.",
  "El codigo, nombre o criatura no son validos.": "The code, name, or creature is invalid.",
  "La sala no existe.": "The room does not exist.",
  "La sala ya comenzo o termino.": "The room has already started or ended.",
  "La sala ya esta completa.": "The room is already full.",
  "Este usuario ya esta conectado en la sala.": "This user is already connected to the room.",
  "El codigo de sala para reconectar no es valido.": "The room code for reconnection is invalid.",
  "El socket ya esta asociado a otra sala.": "This connection is already associated with another room.",
  "No existe una sesion recuperable para este usuario.": "There is no recoverable session for this user.",
  "El socket ya esta asociado a otra identidad de la sala.": "This connection is already associated with another room identity.",
  "La partida termino mientras estabas desconectado.": "The match ended while you were disconnected.",
  "No perteneces a la sala indicada.": "You do not belong to that room.",
  "La sala no acepta confirmaciones en este estado.": "The room does not accept ready confirmations in this state.",
  "El movimiento enviado no es valido.": "The submitted movement is invalid.",
  "No puedes moverte en el estado actual.": "You cannot move in the current state.",
  "Tu criatura aun recupera el impulso.": "Your creature is still recovering its movement.",
  "Tu criatura esta aturdida.": "Your creature is stunned.",
  "El caparazón cerrado impide desplazarte.": "The closed shell prevents movement.",
  "No hay una ruta valida hacia esa celda.": "There is no valid route to that cell.",
  "El ataque enviado no es valido.": "The submitted attack is invalid.",
  "No puedes atacar en el estado actual.": "You cannot attack in the current state.",
  "Tu criatura aun esta recuperandose.": "Your creature is still recovering.",
  "La defensa enviada no es valida.": "The submitted defense is invalid.",
  "No puedes defenderte en el estado actual.": "You cannot defend in the current state.",
  "Tu criatura aun no puede hacer parry.": "Your creature cannot parry yet.",
  "La habilidad enviada no es válida.": "The submitted ability is invalid.",
  "No puedes usar habilidades en el estado actual.": "You cannot use abilities in the current state.",
  "La habilidad requiere un tile seguro y caminable.": "The ability requires a safe, walkable tile.",
  "La sala expiro por inactividad.": "The room expired due to inactivity.",
  "Iniciando partida...": "Starting match...",
  "Esperando la reconexion de los jugadores admitidos.": "Waiting for admitted players to reconnect.",
  "La sala puede iniciar. Esperando la confirmacion final del servidor.": "The room can start. Waiting for final server confirmation.",
  "La cueva se cierra. Sobrevive la ultima criatura.": "The cave closes in. Only the last creature survives.",
  "La cueva consumio a todas las criaturas.": "The cave consumed every creature.",
  "Ninguna criatura sobrevivio al colapso.": "No creature survived the collapse.",
};

export function translateMultiplayerMessage(locale: Locale, message: string): string {
  if (locale === "es") return message;
  const exact = multiplayerEnglishMessages[message];
  if (exact) return exact;

  const leftLobby = message.match(/^(.+) abandono la sala\. (.+)$/);
  if (leftLobby) {
    return `${leftLobby[1]} left the room. ${translateMultiplayerMessage(locale, leftLobby[2])}`;
  }

  const activatedAbility = message.match(/^(.+) activa (.+)\.$/);
  if (activatedAbility) {
    const ability = Object.values(abilityNames).find(
      (copy) => copy.es === activatedAbility[2],
    );
    return `${activatedAbility[1]} activates ${ability?.en ?? activatedAbility[2]}.`;
  }

  const replacements: Array<[RegExp, string]> = [
    [/^Esperando minimo (\d+) jugadores\.$/, "Waiting for at least $1 players."],
    [/^(.+) recupero su sesion\.$/, "$1 restored their session."],
    [/^(.+) abandono la cueva\.$/, "$1 left the cave."],
    [/^(.+) abandono la conexion, pero permanece en los resultados de la partida\.$/, "$1 disconnected but remains in the match results."],
    [/^(.+) abandono la partida\.$/, "$1 left the match."],
    [/^(.+) ataco, pero no encontro presa\.$/, "$1 attacked but found no prey."],
    [/^(.+) abre una ventana de parry arriesgada\.$/, "$1 opens a risky parry window."],
    [/^(.+) golpeo a (.+)\.$/, "$1 hit $2."],
    [/^(.+) derribo a (.+)\.$/, "$1 took down $2."],
    [/^(.+) bloqueó en falso y quedó expuesto\.$/, "$1 mistimed the block and was left exposed."],
    [/^(.+) desvia el golpe y aturde a (.+)\.$/, "$1 deflects the hit and stuns $2."],
    [/^(.+) quedó atrapad[oa] en seda\.$/, "$1 was caught in silk."],
    [/^(.+) agotó la energía de un refugio\.$/, "$1 exhausted a shelter."],
    [/^(.+) escucha a la cueva acercarse: debe moverse\.$/, "$1 hears the cave closing in and must move."],
    [/^(.+) cedió al encierro de la cueva\.$/, "$1 succumbed to the cave's confinement."],
    [/^(.+) domina la cadena de la vida\.$/, "$1 dominates the chain of life."],
    [/^(.+) fue tragado por la cueva\.$/, "$1 was swallowed by the cave."],
    [/^(.+) resiste como la ultima criatura viva\.$/, "$1 remains as the last creature alive."],
    [/^(.+) fue cazado por la cueva\.$/, "$1 was hunted down by the cave."],
    [/^(.+) resistio hasta el final\.$/, "$1 endured until the end."],
    [/^No se pudo activar la habilidad: (.+)\.$/, "The ability could not be activated: $1."],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(message)) return message.replace(pattern, replacement);
  }
  return message;
}

const gameplayEnglishMessages: Record<string, string> = {
  "Bloqueaste demasiado pronto: la apertura te deja aturdido.": "You blocked too early; the opening leaves you stunned.",
  "Parry fallido · stun": "Failed parry · stunned",
  "La oscuridad te alcanza. Muévete al menos una celda.": "The darkness reaches you. Move at least one cell.",
  "El refugio cede su última reserva y queda agotado.": "The shelter gives up its last reserve and is exhausted.",
  "Refugio +22% HP": "Shelter +22% HP",
  "Escuchas ecos agresivos. El radar sugiere peligro, no certezas.": "You hear aggressive echoes. The radar suggests danger, not certainty.",
  "La cueva te atrapo en una zona letal.": "The cave trapped you in a lethal zone.",
  "Permaneciste inmóvil demasiado tiempo y la cueva te consumió.": "You stayed still for too long and the cave consumed you.",
  "Tu vida llego a cero. La cueva cerro el combate a su favor.": "Your health reached zero. The cave ended the fight in its favor.",
  "Limpiaste la cueva. Ninguna criatura hostil quedo con vida.": "You cleared the cave. No hostile creature remained alive.",
  "Parry activo": "Parry active",
  "Silenciaste todos los ecos hostiles de la cueva.": "You silenced every hostile echo in the cave.",
};

export function translateGameplayMessage(locale: Locale, message: string) {
  if (locale === "es") return message;
  const exact = gameplayEnglishMessages[message];
  if (exact) return exact;
  const replacements: Array<[RegExp, string]> = [
    [/^(.+) queda inmovilizada por la seda\.$/, "$1 is immobilized by silk."],
    [/^Parry perfecto: (.+) queda aturdida\.$/, "Perfect parry: $1 is stunned."],
    [/^(.+) entra en rango y golpea\.$/, "$1 moves into range and hits."],
    [/^(.+) confirma tu posicion y te persigue\.$/, "$1 confirms your position and gives chase."],
    [/^(.+) investiga el ultimo ruido que escucho\.$/, "$1 investigates the last noise it heard."],
    [/^(.+) se queda inmovil esperando una apertura\.$/, "$1 stays still, waiting for an opening."],
    [/^(.+) cae y desaparece entre los ecos de roca\.$/, "$1 falls and disappears among the stone echoes."],
    [/^Impacto confirmado sobre (.+)\.$/, "Hit confirmed on $1."],
    [/^(.*) · baja$/, "$1 · kill"],
    [/^(.*) · encierro$/, "$1 · darkness"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(message)) return message.replace(pattern, replacement);
  }
  return message;
}
