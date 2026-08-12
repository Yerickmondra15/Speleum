import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("pulido de admin y UI", () => {
  it("propaga isAdmin desde la sesión hasta AuthProvider", () => {
    expect(source("lib/auth.ts")).toContain("isAdmin: user.isAdmin");
    expect(source("app/auth/AuthProvider.tsx")).toContain("isAdmin: boolean");
  });

  it("oculta telemetría del HUD a usuarios normales y la conserva para admin", () => {
    const hud = source("app/play/components/GameHud.tsx");
    expect(hud).toContain("user?.isAdmin === true");
    expect(hud).toContain("isAdmin && zoneMessage");
    expect(hud).toContain("isAdmin && <p");
  });

  it("mantiene el mapa y una forma de restaurar la UI", () => {
    for (const file of ["TacticalGame.tsx", "MultiplayerGame.tsx"]) {
      const game = source(`app/play/components/${file}`);
      expect(game).toContain('isUiHidden ? "absolute inset-0"');
      expect(game).toContain("<GameTopControls");
      expect(game).toContain("onToggleUi=");
    }
  });
});
