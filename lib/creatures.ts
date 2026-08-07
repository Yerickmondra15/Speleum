export const SELECTED_CREATURE_KEY = "speleum.selectedCreature.v1";
export const LIGHTS_ON_KEY = "speleum.lightsOn.v1";

export type CreatureId =
  | "cave-axolotl"
  | "cave-shrimp"
  | "blind-fish"
  | "cave-crab"
  | "cave-spider";

export type CreatureStatKey = "vida" | "velocidad" | "sigilo" | "defensa" | "deteccion";

export type CreatureGameplayProfile = {
  maxHealth: number;
  moveRangeTiles: number;
  moveCooldownMultiplier: number;
  noiseMultiplier: number;
  outgoingDamageMultiplier: number;
  incomingDamageMultiplier: number;
  radarRangeTiles: number;
};

export type Creature = {
  id: CreatureId;
  nombre: string;
  descripcionCorta: string;
  rol: string;
  habilidad: string;
  stats: Record<CreatureStatKey, number>;
  gameplay: CreatureGameplayProfile;
  imagenJuego: string;
  imagenIlustracion: string;
};

export const creatures: Creature[] = [
  {
    id: "cave-axolotl",
    nombre: "Ajolote de cueva",
    descripcionCorta: "Explorador equilibrado y sensible a las vibraciones cercanas.",
    rol: "Explorador sensible",
    habilidad: "Radar amplio y resistencia equilibrada.",
    stats: {
      vida: 72,
      velocidad: 62,
      sigilo: 58,
      defensa: 57,
      deteccion: 86,
    },
    gameplay: {
      maxHealth: 100,
      moveRangeTiles: 4,
      moveCooldownMultiplier: 1,
      noiseMultiplier: 0.9,
      outgoingDamageMultiplier: 1,
      incomingDamageMultiplier: 0.94,
      radarRangeTiles: 13,
    },
    imagenJuego: "/creatures/Ajolote-juego.png",
    imagenIlustracion: "/creatures/Ajolote-ilustacion.png",
  },
  {
    id: "cave-shrimp",
    nombre: "Camaron de cueva",
    descripcionCorta: "Criatura rapida y evasiva, util para reposicionarse.",
    rol: "Rapido / evasivo",
    habilidad: "Movimiento rapido y ruido reducido, a cambio de menor vida.",
    stats: {
      vida: 44,
      velocidad: 94,
      sigilo: 79,
      defensa: 34,
      deteccion: 56,
    },
    gameplay: {
      maxHealth: 78,
      moveRangeTiles: 5,
      moveCooldownMultiplier: 0.78,
      noiseMultiplier: 0.55,
      outgoingDamageMultiplier: 0.9,
      incomingDamageMultiplier: 1.12,
      radarRangeTiles: 10,
    },
    imagenJuego: "/creatures/Camaron-juego.png",
    imagenIlustracion: "/creatures/Camaron-ilustracion.png",
  },
  {
    id: "blind-fish",
    nombre: "Pez ciego",
    descripcionCorta: "Rastrea el entorno en silencio y evita el combate frontal.",
    rol: "Rastreador / silencioso",
    habilidad: "El radar de mayor alcance y movimiento silencioso.",
    stats: {
      vida: 52,
      velocidad: 76,
      sigilo: 85,
      defensa: 39,
      deteccion: 80,
    },
    gameplay: {
      maxHealth: 86,
      moveRangeTiles: 4,
      moveCooldownMultiplier: 0.92,
      noiseMultiplier: 0.72,
      outgoingDamageMultiplier: 0.92,
      incomingDamageMultiplier: 1.04,
      radarRangeTiles: 14,
    },
    imagenJuego: "/creatures/pez-juego.png",
    imagenIlustracion: "/creatures/pez-ilustracion.png",
  },
  {
    id: "cave-crab",
    nombre: "Cangrejo cavernicola",
    descripcionCorta: "Controla pasillos estrechos y resiste mejor los encuentros directos.",
    rol: "Defensivo / tanque",
    habilidad: "Mayor vida y armadura, con desplazamiento mas corto.",
    stats: {
      vida: 91,
      velocidad: 36,
      sigilo: 32,
      defensa: 94,
      deteccion: 50,
    },
    gameplay: {
      maxHealth: 125,
      moveRangeTiles: 3,
      moveCooldownMultiplier: 1.12,
      noiseMultiplier: 1.15,
      outgoingDamageMultiplier: 0.95,
      incomingDamageMultiplier: 0.72,
      radarRangeTiles: 9,
    },
    imagenJuego: "/creatures/Cangrejo-juego.png",
    imagenIlustracion: "/creatures/Cangrejo-ilustracion.png",
  },
  {
    id: "cave-spider",
    nombre: "Arana cavernicola",
    descripcionCorta: "Cazadora sigilosa que rinde mejor cuando ya gano posicion.",
    rol: "Cazadora / sigilosa",
    habilidad: "Ataques mas fuertes y desplazamiento sigiloso.",
    stats: {
      vida: 50,
      velocidad: 78,
      sigilo: 91,
      defensa: 40,
      deteccion: 67,
    },
    gameplay: {
      maxHealth: 84,
      moveRangeTiles: 4,
      moveCooldownMultiplier: 0.88,
      noiseMultiplier: 0.62,
      outgoingDamageMultiplier: 1.15,
      incomingDamageMultiplier: 1.06,
      radarRangeTiles: 11,
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
