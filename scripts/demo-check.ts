import { loadEnvConfig } from "@next/env";
import { runDemoChecks } from "../lib/demo/smoke-check";

loadEnvConfig(process.cwd());

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

const nextUrl = argument("next-url") ?? process.env.DEMO_NEXT_URL ?? process.env.NEXT_PUBLIC_APP_URL;
const socketUrl = argument("socket-url") ?? process.env.DEMO_SOCKET_URL ?? process.env.NEXT_PUBLIC_SOCKET_URL;

async function main() {
  if (!nextUrl || !socketUrl) {
    console.error("FAIL Configuracion: DEMO_NEXT_URL/NEXT_PUBLIC_APP_URL y DEMO_SOCKET_URL/NEXT_PUBLIC_SOCKET_URL son obligatorias.");
    process.exitCode = 1;
    return;
  }

  const checks = await runDemoChecks({ nextUrl, socketUrl });
  for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

void main();
