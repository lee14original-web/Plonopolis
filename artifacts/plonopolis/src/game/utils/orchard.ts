import type { FruitQuality, OrchardState } from "../types/orchard";
import { TREES } from "../constants/orchard";
import { FRUIT_QUALITY_DEFS } from "../constants/orchard";

export function rollFruitQuality(luckPct: number = 0): FruitQuality {
  const r = Math.random();
  const zgnileChance = FRUIT_QUALITY_DEFS.zgnile.baseChance;
  if (r < zgnileChance) return "zgnile";
  const lf = 1 + Math.max(0, luckPct) / 100;
  const zlotyChance    = Math.min(0.50, FRUIT_QUALITY_DEFS.zloty.baseChance    * lf);
  const soczystyChance = Math.min(0.60, FRUIT_QUALITY_DEFS.soczysty.baseChance * lf);
  const rr = (r - zgnileChance) / (1 - zgnileChance);
  if (rr < zlotyChance) return "zloty";
  if (rr < zlotyChance + soczystyChance) return "soczysty";
  return "zwykly";
}

export function getMaxTreeSlots(level: number): number {
  if (level >= 25) return 8;
  if (level >= 20) return 6;
  if (level >= 15) return 4;
  if (level >= 10) return 2;
  return 0;
}

export function defaultOrchardState(): OrchardState {
  const s: OrchardState = {};
  TREES.forEach(t => {
    s[t.id] = { owned: 0, prodStart: 0, storage: { zwykly: 0, soczysty: 0, zloty: 0, zgnile: 0 } };
  });
  return s;
}

export function migrateOrchardState(raw: unknown): OrchardState {
  const def = defaultOrchardState();
  if (!raw || typeof raw !== "object") return def;
  const r = raw as Record<string, unknown>;
  TREES.forEach(t => {
    const v = r[t.id];
    if (!v || typeof v !== "object") return;
    const s = v as { owned?: number; prodStart?: number; storage?: Record<string, number> };
    def[t.id] = {
      owned:    typeof s.owned    === "number" ? s.owned    : 0,
      prodStart:typeof s.prodStart === "number" ? s.prodStart : 0,
      storage: {
        zwykly:   typeof s.storage?.zwykly   === "number" ? s.storage.zwykly   : 0,
        soczysty: typeof s.storage?.soczysty === "number" ? s.storage.soczysty : 0,
        zloty:    typeof s.storage?.zloty    === "number" ? s.storage.zloty    : 0,
        zgnile:   typeof s.storage?.zgnile   === "number" ? s.storage.zgnile   : 0,
      },
    };
  });
  return def;
}

export function getOrchardTotalOwned(state: OrchardState): number {
  return TREES.reduce((s, t) => s + (state[t.id]?.owned ?? 0), 0);
}
