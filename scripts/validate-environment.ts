import { loadEnvConfig } from "@next/env";
import { assertEnvironment, type SpeleumService } from "../lib/config/environment";

loadEnvConfig(process.cwd());

const requested = process.argv[2];
if (requested !== "next" && requested !== "socket") {
  throw new Error("Uso: tsx scripts/validate-environment.ts <next|socket>");
}

assertEnvironment(requested as SpeleumService, process.env);
console.log(`PASS Entorno ${requested}: variables requeridas presentes y formato valido.`);
