export type SocketServiceState =
  | "connecting"
  | "waking"
  | "ready"
  | "retrying"
  | "error";

type WarmSocketServiceOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  onState?: (state: SocketServiceState) => void;
  signal?: AbortSignal;
  wait?: (milliseconds: number) => Promise<void>;
};

function defaultWait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function warmSocketService(
  socketUrl: string,
  options: WarmSocketServiceOptions = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const retryDelaysMs = options.retryDelaysMs ?? [0, 2_000, 5_000, 5_000];
  const wait = options.wait ?? defaultWait;

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
    if (options.signal?.aborted) throw options.signal.reason;
    if (retryDelaysMs[attempt] > 0) await wait(retryDelaysMs[attempt]);
    if (options.signal?.aborted) return false;

    options.onState?.(
      attempt === 0 ? "connecting" : attempt === 1 ? "waking" : "retrying",
    );

    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
    const abort = () => timeoutController.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });

    try {
      const response = await fetchImpl(`${socketUrl.replace(/\/$/, "")}/ready`, {
        method: "GET",
        cache: "no-store",
        signal: timeoutController.signal,
      });
      if (response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          status?: unknown;
        } | null;
        if (payload?.status === "ready") {
          options.onState?.("ready");
          return true;
        }
      }
    } catch {
      // A timeout, 502 or sleeping host is retried with the bounded schedule above.
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  options.onState?.("error");
  return false;
}
