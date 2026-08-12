import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("modo demo admin local", () => {
  const tactical = read("app/play/components/TacticalGame.tsx");
  const map = read("app/play/components/GameMap.tsx");

  it("solo se habilita para admin y comienza apagado", () => {
    expect(tactical).toContain("user?.isAdmin === true");
    expect(tactical).toContain("useState(false)");
    expect(tactical).toContain("const adminDemoEnabled = isAdmin && isAdminDemoEnabled");
    expect(tactical).toContain("{isAdmin && !isUiHidden && (");
  });

  it("revela el mapa sin retirar la IA", () => {
    expect(tactical).toContain("revealAll={adminDemoEnabled}");
    expect(map).toContain("revealAll || isTileVisible");
    expect(tactical).toContain("void enemyTurn()");
    expect(tactical).toContain("ENEMY_MOVE_INTERVAL");
  });

  it("elimina solo el cooldown de movimiento y conserva pathfinding", () => {
    expect(tactical).toContain("planMovementPath(");
    expect(tactical).toContain("caveSession.lookup");
    expect(tactical).toContain("adminDemoEnabled ? 0 : Date.now() + movePlan.cooldownMs");
  });

  it("limita wheel al mapa, acota zoom y permite reset", () => {
    expect(map).toContain("onWheel={handleMapWheel}");
    expect(map).toContain("Math.min(1.5, Math.max(0.5");
    expect(tactical).toContain("onClick={() => setDemoZoom(1)}");
    expect(tactical).toContain("onZoomChange={adminDemoEnabled ? setDemoZoom : undefined}");
  });

  it("al reiniciar restaura demo y zoom", () => {
    expect(tactical).toContain("setIsAdminDemoEnabled(false)");
    expect(tactical).toContain("setDemoZoom(1)");
  });
});
