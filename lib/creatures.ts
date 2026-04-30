export const SELECTED_CREATURE_KEY = "speleum.selectedCreature.v1";
export const LIGHTS_ON_KEY = "speleum.lightsOn.v1";

export type CreatureId =
  | "cave-axolotl"
  | "cave-shrimp"
  | "blind-fish"
  | "cave-crab"
  | "cave-spider";

export type CreatureStatKey = "vida" | "velocidad" | "sigilo" | "defensa" | "deteccion";

export type Creature = {
  id: CreatureId;
  nombre: string;
  descripcionCorta: string;
  rol: string;
  habilidad: string;
  stats: Record<CreatureStatKey, number>;
  imagenJuego: string;
  imagenIlustracion: string;
};

export const creatures: Creature[] = [
  {
    id: "cave-axolotl",
    nombre: "Ajolote de cueva",
    descripcionCorta: "Explorador equilibrado y sensible a las vibraciones cercanas.",
    rol: "Explorador sensible",
    habilidad: "Detecta vibraciones cercanas.",
    stats: {
      vida: 72,
      velocidad: 62,
      sigilo: 58,
      defensa: 57,
      deteccion: 86,
    },
    imagenJuego: "/creatures/Ajolote-juego.png",
    imagenIlustracion: "/creatures/Ajolote-ilustacion.png",
  },
  {
    id: "cave-shrimp",
    nombre: "Camaron de cueva",
    descripcionCorta: "Criatura rapida y evasiva, util para reposicionarse.",
    rol: "Rapido / evasivo",
    habilidad: "Embestida rapida o escape corto.",
    stats: {
      vida: 44,
      velocidad: 94,
      sigilo: 79,
      defensa: 34,
      deteccion: 56,
    },
    imagenJuego: "/creatures/Camaron-juego.png",
    imagenIlustracion: "/creatures/Camaron-ilustracion.png",
  },
  {
    id: "blind-fish",
    nombre: "Pez ciego",
    descripcionCorta: "Rastrea el entorno en silencio y evita el combate frontal.",
    rol: "Rastreador / silencioso",
    habilidad: "Percibe corrientes o presencia cercana.",
    stats: {
      vida: 52,
      velocidad: 76,
      sigilo: 85,
      defensa: 39,
      deteccion: 80,
    },
    imagenJuego: "/creatures/pez-juego.png",
    imagenIlustracion: "/creatures/Pez-ilustracion.png",
  },
  {
    id: "cave-crab",
    nombre: "Cangrejo cavernicola",
    descripcionCorta: "Controla pasillos estrechos y resiste mejor los encuentros directos.",
    rol: "Defensivo / tanque",
    habilidad: "Bloqueo o contraataque.",
    stats: {
      vida: 91,
      velocidad: 36,
      sigilo: 32,
      defensa: 94,
      deteccion: 50,
    },
    imagenJuego: "/creatures/Cangrejo-juego.png",
    imagenIlustracion: "/creatures/Cangrejo-ilustracion.png",
  },
  {
    id: "cave-spider",
    nombre: "Arana cavernicola",
    descripcionCorta: "Cazadora sigilosa que rinde mejor cuando ya gano posicion.",
    rol: "Cazadora / sigilosa",
    habilidad: "Salto corto o emboscada.",
    stats: {
      vida: 50,
      velocidad: 78,
      sigilo: 91,
      defensa: 40,
      deteccion: 67,
    },
    imagenJuego: "/creatures/Araña-juego.png",
    imagenIlustracion: "/creatures/Araña-ilustracion.png",
  },
];

export const creaturesById: Record<CreatureId, Creature> = {
  "cave-axolotl": creatures[0],
  "cave-shrimp": creatures[1],
  "blind-fish": creatures[2],
  "cave-crab": creatures[3],
  "cave-spider": creatures[4],
};

export function getCreatureById(id: string) {
  return creaturesById[id as CreatureId] ?? creaturesById["cave-axolotl"];
}

