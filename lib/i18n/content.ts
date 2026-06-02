import type { CharacterOption, Zone } from "@/app/play/gameConfig";
import { getCreatureById, type CreatureId, type CreatureStatKey } from "@/lib/creatures";
import type { Locale } from "./messages";

const creatureCopy = {
  "cave-axolotl": {
    es: {
      name: "Ajolote de cueva",
      short: "Explorador equilibrado y sensible a las vibraciones cercanas.",
      role: "Explorador sensible",
      ability: "Detecta vibraciones cercanas.",
    },
    en: {
      name: "Cave axolotl",
      short: "Balanced explorer sensitive to nearby vibrations.",
      role: "Sensitive explorer",
      ability: "Detects nearby vibrations.",
    },
  },
  "cave-shrimp": {
    es: {
      name: "Camarón de cueva",
      short: "Criatura rápida y evasiva, útil para reposicionarse.",
      role: "Rápido / evasivo",
      ability: "Embestida rápida o escape corto.",
    },
    en: {
      name: "Cave shrimp",
      short: "Fast, evasive creature that excels at repositioning.",
      role: "Fast / evasive",
      ability: "Quick dash or short escape.",
    },
  },
  "blind-fish": {
    es: {
      name: "Pez ciego",
      short: "Rastrea el entorno en silencio y evita el combate frontal.",
      role: "Rastreador / silencioso",
      ability: "Percibe corrientes o presencia cercana.",
    },
    en: {
      name: "Blind fish",
      short: "Tracks the environment quietly and avoids frontal combat.",
      role: "Tracker / silent",
      ability: "Senses currents or nearby presence.",
    },
  },
  "cave-crab": {
    es: {
      name: "Cangrejo cavernícola",
      short: "Controla pasillos estrechos y resiste mejor los encuentros directos.",
      role: "Defensivo / tanque",
      ability: "Bloqueo o contraataque.",
    },
    en: {
      name: "Cave crab",
      short: "Controls narrow corridors and withstands direct encounters better.",
      role: "Defensive / tank",
      ability: "Block or counterattack.",
    },
  },
  "cave-spider": {
    es: {
      name: "Araña cavernícola",
      short: "Cazadora sigilosa que rinde mejor cuando ya ganó posición.",
      role: "Cazadora / sigilosa",
      ability: "Salto corto o emboscada.",
    },
    en: {
      name: "Cave spider",
      short: "Stealth hunter that performs best after securing position.",
      role: "Hunter / stealth",
      ability: "Short leap or ambush.",
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
