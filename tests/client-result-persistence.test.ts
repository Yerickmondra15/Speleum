import { describe, expect, it, vi } from "vitest";

import {
  MatchResultSaveError,
  saveMatchResultRequest,
} from "@/lib/matches/client-result-persistence";

describe("persistencia cliente de resultados", () => {
  it("envia el resultado al endpoint esperado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await saveMatchResultRequest(
      { mode: "multiplayer", receipt: "signed-receipt" },
      { fetchImpl, maxAttempts: 3, retryDelaysMs: [0, 0] },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/matches/results",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "multiplayer", receipt: "signed-receipt" }),
      }),
    );
  });

  it("reintenta fallos transitorios y termina al confirmar", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const onAttempt = vi.fn();

    await saveMatchResultRequest(
      { mode: "multiplayer", receipt: "signed-receipt" },
      { fetchImpl, maxAttempts: 3, retryDelaysMs: [0, 0], onAttempt },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(onAttempt.mock.calls).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it("detiene el retry al alcanzar el limite", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(
      saveMatchResultRequest(
        { mode: "multiplayer", receipt: "signed-receipt" },
        { fetchImpl, maxAttempts: 3, retryDelaysMs: [0, 0] },
      ),
    ).rejects.toMatchObject({ retryable: true, status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("no reintenta rechazos permanentes del contrato", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 400 });

    await expect(
      saveMatchResultRequest(
        { mode: "multiplayer", receipt: "invalid" },
        { fetchImpl, maxAttempts: 3, retryDelaysMs: [0, 0] },
      ),
    ).rejects.toEqual(expect.any(MatchResultSaveError));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("trata un 5xx local como fallo aunque fetch haya resuelto", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      saveMatchResultRequest(
        {
          mode: "local",
          matchId: "local-match",
          status: "finished",
          startedAt: "2026-01-01T00:00:00.000Z",
          endedAt: "2026-01-01T00:00:01.000Z",
          creature: "cave-axolotl",
          result: "loss",
        },
        { fetchImpl, maxAttempts: 1 },
      ),
    ).rejects.toMatchObject({ retryable: true, status: 500 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("cancela el ciclo de retry cuando la vista se desmonta", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    const savePromise = saveMatchResultRequest(
      { mode: "multiplayer", receipt: "signed-receipt" },
      {
        fetchImpl,
        maxAttempts: 3,
        retryDelaysMs: [10_000, 10_000],
        signal: controller.signal,
        onAttempt: () => queueMicrotask(() => controller.abort()),
      },
    );

    await expect(savePromise).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
