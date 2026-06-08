import type { PlayerStatsMap } from "../types/stats";
import type { CharEquipped } from "../types/equipment";
import type { OrchardState } from "../types/orchard";
import type { BarnState } from "../types/barn";
import { CHAR_EQUIP_ITEMS } from "../constants/equipment";
import { TREES } from "../constants/orchard";
import { ANIMALS } from "../constants/animals";

export function computeFarmPower(
  stats: PlayerStatsMap,
  equipped: CharEquipped,
  hiveLevel: number,
  orchard: OrchardState,
  barn: BarnState,
): number {
  const eqPow = (Object.values(equipped) as ({ id: string; upg: number } | null)[]).reduce((s, eq) => {
    if (!eq) return s;
    const d = CHAR_EQUIP_ITEMS.find(it => it.id === eq.id);
    const l = d?.unlockLevel ?? 1;
    const u = eq.upg ?? 0;
    return s + l * 8 + u * u * 4;
  }, 0);
  const orchPow = TREES.reduce((s, t) => s + Math.round(Math.sqrt(t.buyPrice) * 2) * (orchard[t.id]?.owned ?? 0), 0);
  const barnPow = ANIMALS.reduce((s, a) => s + Math.round(Math.sqrt(a.buyPrice) * 2.5) * (barn[a.id]?.owned ?? 0), 0);
  return Math.round(
    Object.values(stats).reduce((s: number, v: unknown) => s + (v as number), 0) * 3
    + hiveLevel * hiveLevel * 20
    + eqPow + orchPow + barnPow
  );
}
