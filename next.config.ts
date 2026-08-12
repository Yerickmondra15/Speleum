import type { NextConfig } from "next";
import { assertEnvironment } from "./lib/config/environment";

if (process.env.VERCEL === "1" || process.env.SPELEUM_VALIDATE_ENV === "true") {
  assertEnvironment("next", process.env, "production");
}

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
