import { describe, expect, it } from "vitest";

import { createCaveLayout } from "@/app/play/proceduralCave";
import { pickSeparatedSpawns } from "@/app/play/gameLogic";
import { buildTileMap, createTileLookup, tileDistance, worldToTile } from "@/app/play/tileMap";

describe("generacion de cuevas", () => {
  it("reproduce el mismo mapa para la misma semilla", () => {
    const first = createCaveLayout("academic-seed-42");
    const second = createCaveLayout("academic-seed-42");
    expect(second.tileRows).toEqual(first.tileRows);
    expect(second.templatesUsed).toEqual(first.templatesUsed);
    expect(second.startPosition).toEqual(first.startPosition);
  });

  it("produce una cueva utilizable aun si activa el fallback", () => {
    const layout = createCaveLayout("valid-layout");
    expect(layout.tileRows.length).toBeGreaterThan(0);
    expect(layout.zones.length).toBeGreaterThan(0);
    expect(layout.enemyConfigs.length).toBeGreaterThan(0);
  });

  it("selecciona spawns separados y caminables", () => {
    const layout = createCaveLayout("spawn-separation");
    const lookup = createTileLookup(buildTileMap(layout));
    const spawns = pickSeparatedSpawns(layout, lookup, 4, 4);
    expect(spawns).toHaveLength(4);
    for (let left = 0; left < spawns.length; left += 1) {
      for (let right = left + 1; right < spawns.length; right += 1) {
        expect(tileDistance(worldToTile(spawns[left]!), worldToTile(spawns[right]!))).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
