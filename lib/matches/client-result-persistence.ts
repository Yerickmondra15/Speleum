export type MatchResultSaveStatus = "idle" | "saving" | "saved" | "failed";

type MatchResultResponse = Pick<Response, "ok" | "status">;

type MatchResultFetch = (
  input: string,
  init: RequestInit,
) => Promise<MatchResultResponse>;

type SaveMatchResultOptions = {
  fetchImpl?: MatchResultFetch;
  maxAttempts?: number;
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  retryDelaysMs?: readonly number[];
  signal?: AbortSignal;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAYS_MS = [400, 1_200] as const;

export class MatchResultSaveError extends Error {
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(message: string, options: { retryable: boolean; status?: number | null }) {
    super(message);
    this.name = "MatchResultSaveError";
    this.retryable = options.retryable;
    this.status = options.status ?? null;
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function abortError() {
  return new DOMException("Result save aborted", "AbortError");
}

function waitForRetry(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(abortError());
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, Math.max(0, delayMs));

    const handleAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export async function saveMatchResultRequest(
  payload: unknown,
  options: SaveMatchResultOptions = {},
) {
  const fetchImpl: MatchResultFetch = options.fetchImpl ?? fetch;
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS));
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw abortError();
    }

    options.onAttempt?.(attempt, maxAttempts);
    let failure: MatchResultSaveError;

    try {
      const response = await fetchImpl("/api/matches/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: options.signal,
      });

      if (response.ok) {
        return;
      }

      failure = new MatchResultSaveError("Result endpoint rejected the request", {
        retryable: isRetryableStatus(response.status),
        status: response.status,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      failure =
        error instanceof MatchResultSaveError
          ? error
          : new MatchResultSaveError("Result endpoint could not be reached", {
              retryable: true,
            });
    }

    if (!failure.retryable || attempt === maxAttempts) {
      throw failure;
    }

    await waitForRetry(retryDelaysMs[attempt - 1] ?? retryDelaysMs.at(-1) ?? 0, options.signal);
  }
}
