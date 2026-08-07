import { z } from "zod";

import { creatures } from "@/lib/creatures";

const creatureIds = creatures.map((creature) => creature.id) as [
  (typeof creatures)[number]["id"],
  ...(typeof creatures)[number]["id"][],
];

export const creatureIdSchema = z.enum(creatureIds);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[\p{L}\p{N}_. -]+$/u, "Contiene caracteres no permitidos.");
export const passwordSchema = z.string().min(8).max(72);
export const challengeIdSchema = z.string().trim().min(10).max(64);
export const verificationCodeSchema = z.string().trim().regex(/^\d{6}$/);

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const verifyCodeSchema = z
  .object({
    challengeId: challengeIdSchema,
    email: emailSchema,
    code: verificationCodeSchema,
  })
  .strict();

export const resendCodeSchema = z
  .object({
    challengeId: challengeIdSchema,
    email: emailSchema,
  })
  .strict();

export const activeCreatureSchema = z
  .object({
    activeCreature: creatureIdSchema,
  })
  .strict();
