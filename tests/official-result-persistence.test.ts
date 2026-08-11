import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ResultConflictError } from "@/lib/matches/result-persistence";
import {
  persistOfficialResultsWithRetry,
  type OfficialResultPersister,
} from "@/server/results/officialResultPersistence";

describe("orquestacion de persistencia oficial", () => {
  it("reintenta con un limite explicito y reporta el intento exitoso", async () => {
    const persist = vi
      .fn<OfficialResultPersister>()
      .mockRejectedValueOnce(new Error("network-1"))
      .mockRejectedValueOnce(new Error("network-2"))
      .mockResolvedValueOnce([]);
    const onAttempt = vi.fn();

    await expect(
      persistOfficialResultsWithRetry({
        input: [],
        persist,
        retryDelaysMs: [0, 0],
        onAttempt,
      }),
    ).resolves.toEqual({ attempts: 3, results: [] });
    expect(persist).toHaveBeenCalledTimes(3);
    expect(onAttempt.mock.calls).toEqual([[1], [2], [3]]);
  });

  it("detiene un error permanente de conflicto sin reintentar", async () => {
    const persist = vi
      .fn<OfficialResultPersister>()
      .mockRejectedValue(new ResultConflictError("canonical conflict"));

    await expect(
      persistOfficialResultsWithRetry({
        input: [],
        persist,
        retryDelaysMs: [0, 0],
      }),
    ).rejects.toBeInstanceOf(ResultConflictError);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("respeta errores de adaptador marcados como no reintentables", async () => {
    const permanentError = Object.assign(new Error("invalid adapter input"), {
      retryable: false,
    });
    const persist = vi
      .fn<OfficialResultPersister>()
      .mockRejectedValue(permanentError);

    await expect(
      persistOfficialResultsWithRetry({
        input: [],
        persist,
        retryDelaysMs: [0, 0],
      }),
    ).rejects.toBe(permanentError);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("no reintenta un error Prisma permanente", async () => {
    const permanentError = new Prisma.PrismaClientKnownRequestError(
      "foreign key violation",
      { code: "P2003", clientVersion: "test" },
    );
    const persist = vi
      .fn<OfficialResultPersister>()
      .mockRejectedValue(permanentError);

    await expect(
      persistOfficialResultsWithRetry({
        input: [],
        persist,
        retryDelaysMs: [0, 0],
      }),
    ).rejects.toBe(permanentError);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
