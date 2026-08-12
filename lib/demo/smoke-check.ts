export type SmokeCheck = { name: string; ok: boolean; detail: string };

type SmokeCheckOptions = {
  nextUrl: string;
  socketUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

async function request(fetchImpl: typeof fetch, url: string, timeoutMs: number, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

export async function runDemoChecks(options: SmokeCheckOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const nextUrl = options.nextUrl.replace(/\/$/, "");
  const socketUrl = options.socketUrl.replace(/\/$/, "");
  const checks: SmokeCheck[] = [];

  for (const [name, path] of [
    ["Next landing", "/"],
    ["Next login", "/login"],
    ["Ranking API / PostgreSQL", "/api/ranking?page=1&limit=1"],
    ["Favicon", "/favicon.ico"],
  ] as const) {
    try {
      const response = await request(fetchImpl, `${nextUrl}${path}`, timeoutMs);
      checks.push({ name, ok: response.ok, detail: `HTTP ${response.status}` });
    } catch (error) {
      checks.push({ name, ok: false, detail: error instanceof Error ? error.name : "request_failed" });
    }
  }

  try {
    const response = await request(fetchImpl, `${socketUrl}/ready`, timeoutMs, {
      headers: { Origin: nextUrl },
    });
    const payload = (await response.json().catch(() => null)) as { status?: unknown } | null;
    checks.push({
      name: "Socket readiness",
      ok: response.ok && payload?.status === "ready",
      detail: `HTTP ${response.status}`,
    });
  } catch (error) {
    checks.push({ name: "Socket readiness", ok: false, detail: error instanceof Error ? error.name : "request_failed" });
  }

  try {
    const response = await request(fetchImpl, `${socketUrl}/socket.io/?EIO=4&transport=polling`, timeoutMs, {
      headers: { Origin: nextUrl },
    });
    const body = await response.text();
    checks.push({
      name: "Socket.IO polling handshake",
      ok: response.ok && body.startsWith("0{"),
      detail: `HTTP ${response.status}`,
    });
  } catch (error) {
    checks.push({ name: "Socket.IO polling handshake", ok: false, detail: error instanceof Error ? error.name : "request_failed" });
  }

  return checks;
}
