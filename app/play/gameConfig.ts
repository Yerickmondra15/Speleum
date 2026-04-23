export type Rect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PointOfInterest = {
  id: string;
  label: string;
  x: number;
  y: number;
};

export type CharacterOption = {
  id: string;
  name: string;
  role: string;
  status: "available" | "locked";
  moveRange: number;
  moveCooldownMultiplier: number;
  moveSignalMultiplier: number;
  trait: string;
};

export type ActionKind = "move" | "attack" | "defend";

export type PlayerPosition = {
  x: number;
  y: number;
};

export const CAVE_WIDTH = 3600;
export const CAVE_HEIGHT = 2400;
export const PLAYER_RADIUS = 24;
export const MAX_MOVE_DISTANCE = 320;
export const MOVE_BASE_COOLDOWN = 700;
export const MOVE_DISTANCE_COOLDOWN = 7;
export const ATTACK_COOLDOWN = 2600;
export const DEFEND_COOLDOWN = 1900;
export const ATTACK_RADIUS = 210;

export const startPosition: PlayerPosition = {
  x: 330,
  y: 2020,
};

export const characterOptions: CharacterOption[] = [
  {
    id: "cave-axolotl",
    name: "Ajolote de cueva",
    role: "Explorador sensible a vibraciones",
    status: "available",
    moveRange: 320,
    moveCooldownMultiplier: 1,
    moveSignalMultiplier: 1,
    trait: "Percibe ecos con estabilidad y mantiene una vision equilibrada.",
  },
  {
    id: "cave-crab",
    name: "Cangrejo cavernicola",
    role: "Control de pasillos",
    status: "locked",
    moveRange: 280,
    moveCooldownMultiplier: 1.08,
    moveSignalMultiplier: 1.1,
    trait: "Especialista en bloquear rutas estrechas.",
  },
  {
    id: "blind-fish",
    name: "Pez ciego",
    role: "Lectura de corrientes",
    status: "locked",
    moveRange: 340,
    moveCooldownMultiplier: 0.96,
    moveSignalMultiplier: 0.9,
    trait: "Lee corrientes y cambios de presion.",
  },
  {
    id: "cave-shrimp",
    name: "Camaron de cueva",
    role: "Movimiento evasivo",
    status: "available",
    moveRange: 430,
    moveCooldownMultiplier: 0.78,
    moveSignalMultiplier: 0.55,
    trait: "Se reposiciona con impulsos cortos y deja senales mas tenues.",
  },
  {
    id: "cave-spider",
    name: "Arana cavernicola",
    role: "Trampas y silencio",
    status: "locked",
    moveRange: 300,
    moveCooldownMultiplier: 0.9,
    moveSignalMultiplier: 0.65,
    trait: "Aprovecha paredes y espera emboscadas.",
  },
];

export const caveWalls: Rect[] = [
  { id: "north", x: 0, y: 0, width: 3600, height: 72 },
  { id: "south", x: 0, y: 2328, width: 3600, height: 72 },
  { id: "west", x: 0, y: 0, width: 72, height: 2400 },
  { id: "east", x: 3528, y: 0, width: 72, height: 2400 },
  { id: "lower-left-wall", x: 120, y: 1810, width: 520, height: 96 },
  { id: "lower-left-fang", x: 565, y: 1500, width: 104, height: 408 },
  { id: "low-channel", x: 820, y: 2090, width: 660, height: 86 },
  { id: "lower-middle-mass", x: 1330, y: 1680, width: 118, height: 520 },
  { id: "lower-middle-cap", x: 1210, y: 1680, width: 470, height: 90 },
  { id: "deep-right-floor", x: 1970, y: 1980, width: 760, height: 96 },
  { id: "deep-right-column", x: 2620, y: 1640, width: 112, height: 440 },
  { id: "far-right-pocket", x: 2950, y: 1850, width: 360, height: 88 },
  { id: "mid-left-basin", x: 180, y: 1120, width: 760, height: 96 },
  { id: "mid-left-drop", x: 820, y: 910, width: 96, height: 310 },
  { id: "central-rib", x: 1200, y: 980, width: 680, height: 96 },
  { id: "central-spine", x: 1760, y: 760, width: 110, height: 530 },
  { id: "mid-right-lung", x: 2210, y: 1060, width: 620, height: 104 },
  { id: "mid-right-tail", x: 2740, y: 1060, width: 104, height: 420 },
  { id: "upper-left-mass", x: 160, y: 360, width: 720, height: 104 },
  { id: "upper-left-drop", x: 760, y: 360, width: 108, height: 380 },
  { id: "upper-bridge", x: 1070, y: 250, width: 850, height: 92 },
  { id: "upper-cleft", x: 2100, y: 270, width: 116, height: 430 },
  { id: "upper-right-shelf", x: 2430, y: 430, width: 760, height: 94 },
  { id: "upper-right-hook", x: 3110, y: 430, width: 112, height: 500 },
  { id: "stone-a", x: 1030, y: 1420, width: 128, height: 128 },
  { id: "stone-b", x: 1980, y: 1380, width: 146, height: 118 },
  { id: "stone-c", x: 1510, y: 520, width: 120, height: 120 },
  { id: "stone-d", x: 3070, y: 1320, width: 156, height: 132 },
  { id: "stone-e", x: 470, y: 680, width: 132, height: 118 },
];

export const pointsOfInterest: PointOfInterest[] = [
  { id: "nest", label: "nido", x: 330, y: 2020 },
  { id: "still-water", label: "agua quieta", x: 1130, y: 1320 },
  { id: "thin-crack", label: "grieta fina", x: 2560, y: 820 },
  { id: "drop", label: "fosa", x: 3150, y: 1760 },
  { id: "echo", label: "eco hueco", x: 1710, y: 470 },
  { id: "gate", label: "paso angosto", x: 3330, y: 620 },
];
