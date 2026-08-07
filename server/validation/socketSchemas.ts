import { z } from "zod";

import { CAVE_HEIGHT, CAVE_WIDTH } from "../../app/play/gameConfig";
import { creatureIdSchema } from "../../lib/validation/schemas";

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/);

const playerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(18)
  .regex(/^[\p{L}\p{N}_. -]+$/u, "Nombre temporal invalido.");

const roomIdentitySchema = z.object({ roomCode: roomCodeSchema }).strict();

export const createRoomSchema = z
  .object({
    name: playerNameSchema.optional(),
    characterId: creatureIdSchema,
  })
  .strict();

export const joinRoomSchema = z
  .object({
    roomCode: roomCodeSchema,
    name: playerNameSchema.optional(),
    characterId: creatureIdSchema,
  })
  .strict();

export const resumeRoomSchema = roomIdentitySchema;
export const roomActionSchema = roomIdentitySchema;

const finiteCoordinateSchema = z.number().finite();
const targetSchema = z
  .object({
    x: finiteCoordinateSchema.min(0).max(CAVE_WIDTH),
    y: finiteCoordinateSchema.min(0).max(CAVE_HEIGHT),
  })
  .strict();
const directionSchema = z
  .object({
    x: finiteCoordinateSchema.min(-1).max(1),
    y: finiteCoordinateSchema.min(-1).max(1),
  })
  .strict();

export const playerMoveSchema = z
  .object({
    roomCode: roomCodeSchema,
    target: targetSchema.optional(),
    direction: directionSchema.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.target || value.direction), {
    message: "Se requiere un destino o direccion.",
  });

export function parseSocketPayload<T>(schema: z.ZodType<T>, payload: unknown) {
  const parsed = schema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
