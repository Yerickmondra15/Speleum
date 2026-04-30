import {
  getCreatureById,
  type CreatureId,
} from "@/lib/creatures";

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
  id: CreatureId;
  name: string;
  role: string;
  status: "available" | "locked";
  moveRange: number;
  moveCooldownMultiplier: number;
  moveSignalMultiplier: number;
  trait: string;
  ability: string;
  description: string;
  stats: Record<"vida" | "velocidad" | "sigilo" | "defensa" | "deteccion", number>;
  imageGame: string;
  imageIllustration: string;
};

export type ActionKind = "move" | "attack" | "defend";
export type GameStatus = "playing" | "won" | "lost" | "paused";

export type PlayerPosition = {
  x: number;
  y: number;
};

export type Zone = Rect & {
  name: string;
  tone: "safe" | "tunnels" | "open" | "danger" | "trap" | "goal";
  subtitle: string;
  ambient: string;
  pressure: number;
};

export type HazardArea = Rect & {
  label: string;
};

export type GoalArea = Rect & {
  label: string;
};

export type EnemyConfig = {
  id: string;
  name: string;
  start: PlayerPosition;
  patrolPoints: PlayerPosition[];
  speed: number;
  chaseSpeed: number;
  detectionRange: number;
  giveUpRange: number;
  touchRange: number;
};

export const CAVE_WIDTH = 5200;
export const CAVE_HEIGHT = 3200;
export const PLAYER_RADIUS = 24;
export const ENEMY_RADIUS = 26;
export const MAX_HEALTH = 100;
export const MAX_SANITY = 100;
export const FEAR_WARNING_THRESHOLD = 45;
export const FEAR_CRITICAL_THRESHOLD = 18;
export const KEYBOARD_STEP = 110;
export const PLAYER_SPEED = 240;
export const VISION_TILE_SIZE = 80;
export const VISION_RADIUS = VISION_TILE_SIZE * 8;
export const MOVE_BASE_COOLDOWN = 180;
export const MOVE_DISTANCE_COOLDOWN = 2.1;
export const MOVE_BURST_IDLE_MS = 220;
export const ATTACK_COOLDOWN = 2600;
export const DEFEND_COOLDOWN = 1900;
export const ATTACK_RADIUS = 210;
export const PLAYER_ATTACK_DAMAGE = 28;
export const CAVE_ATTACK_DAMAGE = 20;
export const DEFEND_DAMAGE_REDUCTION = 0.55;
export const DARKNESS_SANITY_DRAIN = 7;
export const MOVING_SANITY_RECOVERY = 4.5;
export const IDLE_SANITY_DRAIN = 6.5;
export const SAFE_ZONE_SANITY_RECOVERY = 4;
export const CHASE_SANITY_DRAIN = 4;
export const THREAT_WARNING_MS = 2600;
export const THREAT_HUNT_MS = 5200;
export const THREAT_DEATH_MS = 8600;
export const SANITY_DAMAGE_THRESHOLD = 12;
export const SANITY_DAMAGE_PER_TICK = 8;
export const MAX_ROOM_PLAYERS = 4;
export const MIN_ROOM_PLAYERS = 2;

export const startPosition: PlayerPosition = {
  x: 500,
  y: 2860,
};

export const multiplayerSpawnPositions: PlayerPosition[] = [
  startPosition,
  {
    x: 860,
    y: 2860,
  },
  {
    x: 1120,
    y: 2860,
  },
  {
    x: 1380,
    y: 2860,
  },
];

export const characterOptions: CharacterOption[] = [
  {
    id: "cave-axolotl",
    name: getCreatureById("cave-axolotl").nombre,
    role: getCreatureById("cave-axolotl").rol,
    status: "available",
    moveRange: 320,
    moveCooldownMultiplier: 1,
    moveSignalMultiplier: 1,
    trait: "Percibe ecos con estabilidad y mantiene una vision equilibrada.",
    ability: getCreatureById("cave-axolotl").habilidad,
    description: getCreatureById("cave-axolotl").descripcionCorta,
    stats: getCreatureById("cave-axolotl").stats,
    imageGame: getCreatureById("cave-axolotl").imagenJuego,
    imageIllustration: getCreatureById("cave-axolotl").imagenIlustracion,
  },
  {
    id: "cave-crab",
    name: getCreatureById("cave-crab").nombre,
    role: getCreatureById("cave-crab").rol,
    status: "available",
    moveRange: 280,
    moveCooldownMultiplier: 1.08,
    moveSignalMultiplier: 1.1,
    trait: "Especialista en bloquear rutas estrechas.",
    ability: getCreatureById("cave-crab").habilidad,
    description: getCreatureById("cave-crab").descripcionCorta,
    stats: getCreatureById("cave-crab").stats,
    imageGame: getCreatureById("cave-crab").imagenJuego,
    imageIllustration: getCreatureById("cave-crab").imagenIlustracion,
  },
  {
    id: "blind-fish",
    name: getCreatureById("blind-fish").nombre,
    role: getCreatureById("blind-fish").rol,
    status: "available",
    moveRange: 340,
    moveCooldownMultiplier: 0.96,
    moveSignalMultiplier: 0.9,
    trait: "Lee corrientes y cambios de presion.",
    ability: getCreatureById("blind-fish").habilidad,
    description: getCreatureById("blind-fish").descripcionCorta,
    stats: getCreatureById("blind-fish").stats,
    imageGame: getCreatureById("blind-fish").imagenJuego,
    imageIllustration: getCreatureById("blind-fish").imagenIlustracion,
  },
  {
    id: "cave-shrimp",
    name: getCreatureById("cave-shrimp").nombre,
    role: getCreatureById("cave-shrimp").rol,
    status: "available",
    moveRange: 430,
    moveCooldownMultiplier: 0.78,
    moveSignalMultiplier: 0.55,
    trait: "Se reposiciona con impulsos cortos y deja senales mas tenues.",
    ability: getCreatureById("cave-shrimp").habilidad,
    description: getCreatureById("cave-shrimp").descripcionCorta,
    stats: getCreatureById("cave-shrimp").stats,
    imageGame: getCreatureById("cave-shrimp").imagenJuego,
    imageIllustration: getCreatureById("cave-shrimp").imagenIlustracion,
  },
  {
    id: "cave-spider",
    name: getCreatureById("cave-spider").nombre,
    role: getCreatureById("cave-spider").rol,
    status: "available",
    moveRange: 300,
    moveCooldownMultiplier: 0.9,
    moveSignalMultiplier: 0.65,
    trait: "Aprovecha paredes y espera emboscadas.",
    ability: getCreatureById("cave-spider").habilidad,
    description: getCreatureById("cave-spider").descripcionCorta,
    stats: getCreatureById("cave-spider").stats,
    imageGame: getCreatureById("cave-spider").imagenJuego,
    imageIllustration: getCreatureById("cave-spider").imagenIlustracion,
  },
];

export const caveZones: Zone[] = [
  {
    id: "safe-hollow",
    name: "Refugio inicial",
    subtitle: "Respira y escucha",
    tone: "safe",
    x: 120,
    y: 2280,
    width: 1180,
    height: 760,
    ambient: "La roca amortigua el ruido. Recuperas compostura por un instante.",
    pressure: -1.2,
  },
  {
    id: "thin-tunnels",
    name: "Tuneles estrechos",
    subtitle: "Cuello de botella",
    tone: "tunnels",
    x: 1200,
    y: 1700,
    width: 1420,
    height: 1220,
    ambient: "Las paredes aprietan. Aqui cada encuentro se vuelve letal.",
    pressure: 1.4,
  },
  {
    id: "echo-pocket",
    name: "Bolsillo de eco",
    subtitle: "Respiro incierto",
    tone: "safe",
    x: 1470,
    y: 2580,
    width: 340,
    height: 250,
    ambient: "Una grieta corta el ruido. Apenas alcanza para recomponerte.",
    pressure: -0.4,
  },
  {
    id: "false-passage",
    name: "Grieta falsa",
    subtitle: "Engano mineral",
    tone: "trap",
    x: 1700,
    y: 520,
    width: 1040,
    height: 940,
    ambient: "La cueva susurra rutas falsas y castiga la distraccion.",
    pressure: 2.8,
  },
  {
    id: "open-abyss",
    name: "Camara abierta",
    subtitle: "Exposicion total",
    tone: "open",
    x: 2480,
    y: 1360,
    width: 1540,
    height: 1360,
    ambient: "La amplitud te da aire, pero tambien te vuelve un objetivo.",
    pressure: 1.9,
  },
  {
    id: "pool-rim",
    name: "Borde de la laguna",
    subtitle: "Superficie tensa",
    tone: "trap",
    x: 3260,
    y: 2040,
    width: 640,
    height: 420,
    ambient: "El agua devuelve ecos deformados. Quedarte quieto aqui es un error.",
    pressure: 3.2,
  },
  {
    id: "hunter-den",
    name: "Nido del acechante",
    subtitle: "Corazon hostil",
    tone: "danger",
    x: 3000,
    y: 320,
    width: 1700,
    height: 1320,
    ambient: "Algo respira contigo. La cueva caza a quien se quede quieto.",
    pressure: 3.8,
  },
  {
    id: "last-corridor",
    name: "Corredor final",
    subtitle: "Sin margen",
    tone: "danger",
    x: 4100,
    y: 500,
    width: 820,
    height: 580,
    ambient: "Aqui ya no se escucha la cueva: te escucha a ti.",
    pressure: 4.2,
  },
  {
    id: "final-gate",
    name: "Camara umbral",
    subtitle: "Presion extrema",
    tone: "goal",
    x: 4300,
    y: 160,
    width: 740,
    height: 700,
    ambient: "No hay salida. Solo roca, hambre y criaturas buscando el final.",
    pressure: 2.4,
  },
];

// El mapa sigue una estructura simple de rectangulos para poder ampliarlo
// o reajustarlo sin tocar la logica del juego.
export const caveWalls: Rect[] = [
  { id: "north", x: 0, y: 0, width: CAVE_WIDTH, height: 90 },
  { id: "south", x: 0, y: CAVE_HEIGHT - 90, width: CAVE_WIDTH, height: 90 },
  { id: "west", x: 0, y: 0, width: 90, height: CAVE_HEIGHT },
  { id: "east", x: CAVE_WIDTH - 90, y: 0, width: 90, height: CAVE_HEIGHT },

  { id: "safe-top", x: 220, y: 2200, width: 920, height: 96 },
  { id: "safe-left-stone", x: 210, y: 2440, width: 120, height: 320 },
  { id: "safe-mid-block", x: 560, y: 2520, width: 220, height: 180 },
  { id: "safe-right-stone", x: 900, y: 2380, width: 110, height: 280 },
  { id: "safe-low-ridge", x: 320, y: 2920, width: 720, height: 72 },
  { id: "safe-nook", x: 1080, y: 2480, width: 110, height: 220 },

  { id: "tunnel-entry-top", x: 1120, y: 2140, width: 620, height: 84 },
  { id: "tunnel-entry-bottom", x: 1120, y: 2500, width: 520, height: 84 },
  { id: "tunnel-bend-a", x: 1700, y: 1840, width: 86, height: 740 },
  { id: "tunnel-bend-b", x: 1960, y: 1680, width: 86, height: 600 },
  { id: "tunnel-bend-c", x: 2210, y: 2020, width: 86, height: 560 },
  { id: "tunnel-cap-north", x: 1450, y: 1620, width: 700, height: 76 },
  { id: "tunnel-pocket", x: 1450, y: 2760, width: 420, height: 86 },
  { id: "tunnel-spur", x: 2370, y: 1700, width: 84, height: 540 },
  { id: "tunnel-pocket-cap", x: 1790, y: 2480, width: 90, height: 280 },

  { id: "false-top", x: 1760, y: 470, width: 880, height: 84 },
  { id: "false-left", x: 1760, y: 470, width: 84, height: 740 },
  { id: "false-center-block", x: 2080, y: 760, width: 220, height: 220 },
  { id: "false-fall", x: 2420, y: 720, width: 84, height: 500 },
  { id: "false-bottom", x: 1760, y: 1220, width: 700, height: 84 },

  { id: "open-floor", x: 2680, y: 2550, width: 1040, height: 84 },
  { id: "open-left-column", x: 2640, y: 1680, width: 96, height: 520 },
  { id: "open-center-island", x: 3180, y: 1820, width: 270, height: 220 },
  { id: "open-right-column", x: 3760, y: 1540, width: 96, height: 820 },
  { id: "open-bridge-top", x: 2880, y: 1360, width: 780, height: 80 },
  { id: "open-lower-split", x: 2940, y: 2260, width: 260, height: 84 },
  { id: "open-pool-spur", x: 3490, y: 2040, width: 90, height: 300 },

  { id: "den-bottom", x: 3200, y: 1480, width: 1140, height: 84 },
  { id: "den-left", x: 3040, y: 560, width: 84, height: 980 },
  { id: "den-mid", x: 3560, y: 780, width: 80, height: 420 },
  { id: "den-upper", x: 3300, y: 330, width: 920, height: 84 },
  { id: "den-right-pillar", x: 4180, y: 500, width: 96, height: 620 },
  { id: "den-lair", x: 3880, y: 980, width: 260, height: 220 },
  { id: "den-bridge", x: 4320, y: 880, width: 260, height: 70 },

  { id: "goal-left", x: 4270, y: 180, width: 84, height: 600 },
  { id: "goal-bottom", x: 4270, y: 776, width: 650, height: 84 },
  { id: "goal-right", x: 4920, y: 180, width: 84, height: 600 },
  { id: "goal-throat", x: 4440, y: 610, width: 260, height: 70 },
];

export const hazardAreas: HazardArea[] = [
  {
    id: "false-pit",
    label: "fosa muda",
    x: 2320,
    y: 930,
    width: 220,
    height: 210,
  },
  {
    id: "abyss-pool",
    label: "laguna profunda",
    x: 3370,
    y: 2180,
    width: 330,
    height: 220,
  },
  {
    id: "needle-crack",
    label: "grieta de presion",
    x: 4520,
    y: 540,
    width: 180,
    height: 120,
  },
];

export const goalArea: GoalArea = {
  id: "exit",
  label: "camara umbral",
  x: 4460,
  y: 300,
  width: 300,
  height: 300,
};

export const stalkerConfig: EnemyConfig = {
  id: "stalker",
  name: "Acechante ciego",
  start: { x: 3440, y: 1120 },
  patrolPoints: [
    { x: 3320, y: 1240 },
    { x: 3960, y: 1240 },
    { x: 4120, y: 760 },
    { x: 3440, y: 520 },
  ],
  speed: 118,
  chaseSpeed: 172,
  detectionRange: 420,
  giveUpRange: 640,
  touchRange: 44,
};

export const pointsOfInterest: PointOfInterest[] = [
  { id: "nest", label: "nido", x: 360, y: 2720 },
  { id: "still-water", label: "agua quieta", x: 900, y: 2430 },
  { id: "squeeze", label: "grieta", x: 1500, y: 2330 },
  { id: "wrong-turn", label: "luz falsa", x: 2110, y: 930 },
  { id: "chasm", label: "camara abierta", x: 3180, y: 1980 },
  { id: "echo-pocket", label: "bolsillo de eco", x: 1650, y: 2690 },
  { id: "pool-rim", label: "borde de la laguna", x: 3520, y: 2330 },
  { id: "den", label: "nido oscuro", x: 3720, y: 900 },
  { id: "last-corridor", label: "corredor final", x: 4540, y: 680 },
  { id: "gate", label: "umbral", x: 4610, y: 440 },
];
