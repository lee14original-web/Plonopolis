import type { EquipBonus, CharEquipped } from "../types/equipment";
import { CHAR_EQUIP_ITEMS, TIER_MATERIAL, UPGRADE_COST } from "../constants/equipment";

export function getItemTierMultiplier(unlockLevel: number): number {
  if (unlockLevel <= 3)  return 1;
  if (unlockLevel <= 6)  return 1.3;
  if (unlockLevel <= 9)  return 1.6;
  if (unlockLevel <= 12) return 2;
  if (unlockLevel <= 15) return 2.5;
  if (unlockLevel <= 18) return 3;
  if (unlockLevel <= 21) return 4;
  if (unlockLevel <= 25) return 5;
  return 7;
}

export function getSlotMultiplier(slot?: string): number {
  return slot === "glowa" ? 1.3 : 1;
}

export function getItemTierLabel(unlockLevel: number): string {
  if (unlockLevel <= 3)  return "T1";
  if (unlockLevel <= 6)  return "T2";
  if (unlockLevel <= 9)  return "T3";
  if (unlockLevel <= 12) return "T4";
  if (unlockLevel <= 15) return "T5";
  if (unlockLevel <= 18) return "T6";
  if (unlockLevel <= 21) return "T7";
  if (unlockLevel <= 25) return "T8";
  return "T9";
}

export function getItemTierIndex(unlockLevel: number): number {
  if (unlockLevel <= 3)  return 1;
  if (unlockLevel <= 6)  return 2;
  if (unlockLevel <= 9)  return 3;
  if (unlockLevel <= 12) return 4;
  if (unlockLevel <= 15) return 5;
  if (unlockLevel <= 18) return 6;
  if (unlockLevel <= 21) return 7;
  if (unlockLevel <= 25) return 8;
  return 9;
}

export function getUpgradeCost(itemId: string, targetUpg: number): number {
  if (targetUpg < 1 || targetUpg > 10) return 0;
  const item = CHAR_EQUIP_ITEMS.find(i => i.id === itemId);
  const tierMult = item ? getItemTierMultiplier(item.unlockLevel) : 1;
  const slotMult = getSlotMultiplier(item?.slot);
  return Math.round(UPGRADE_COST[targetUpg] * tierMult * slotMult);
}

export function getUpgradeMaterials(itemId: string, targetUpg: number): Array<{ matId: string; qty: number }> {
  if (targetUpg < 4 || targetUpg > 10) return [];
  const item = CHAR_EQUIP_ITEMS.find(i => i.id === itemId);
  if (!item) return [];
  const tier = getItemTierIndex(item.unlockLevel);
  const current  = TIER_MATERIAL[tier];
  const prev     = tier > 1 ? TIER_MATERIAL[tier - 1] : null;
  const prev2    = tier > 2 ? TIER_MATERIAL[tier - 2] : null;
  const rareHigh = TIER_MATERIAL[Math.min(tier + 1, 10)];
  const out: Array<{ matId: string; qty: number }> = [];
  switch (targetUpg) {
    case 4: out.push({ matId: current, qty: 1 }); break;
    case 5: out.push({ matId: current, qty: 2 }); break;
    case 6:
      out.push({ matId: current, qty: 2 });
      if (prev) out.push({ matId: prev, qty: 1 });
      break;
    case 7:
      out.push({ matId: current, qty: 3 });
      if (prev) out.push({ matId: prev, qty: 2 });
      break;
    case 8:
      out.push({ matId: current, qty: 4 });
      if (prev) out.push({ matId: prev, qty: 2 });
      if (prev2) out.push({ matId: prev2, qty: 1 });
      break;
    case 9:
      out.push({ matId: current, qty: 5 });
      if (prev) out.push({ matId: prev, qty: 3 });
      if (prev2) out.push({ matId: prev2, qty: 2 });
      break;
    case 10:
      out.push({ matId: current, qty: 6 });
      if (prev) out.push({ matId: prev, qty: 4 });
      if (rareHigh && rareHigh !== current && (!prev || rareHigh !== prev)) {
        out.push({ matId: rareHigh, qty: 2 });
      }
      break;
  }
  return out;
}

export function getEquipBonusPct(label: string, charEq: Record<string, { id: string; upg: number } | null>): number {
  let total = 0;
  (["dlonie", "nogi", "glowa"] as const).forEach(slot => {
    const eq = charEq[slot];
    if (!eq) return;
    const item = CHAR_EQUIP_ITEMS.find(i => i.id === eq.id);
    if (!item) return;
    const upg = eq.upg ?? 0;
    item.bonuses.forEach(b => {
      if (b.label === label && !b.flat) {
        total += b.base * (1 + 0.15 * upg);
      }
    });
  });
  return total;
}

export function getEquipFlatBonus(label: string, charEq: Record<string, { id: string; upg: number } | null>): number {
  let total = 0;
  (["dlonie", "nogi", "glowa"] as const).forEach(slot => {
    const eq = charEq[slot];
    if (!eq) return;
    const item = CHAR_EQUIP_ITEMS.find(i => i.id === eq.id);
    if (!item) return;
    const upg = eq.upg ?? 0;
    item.bonuses.forEach(b => {
      if (b.label === label && b.flat) {
        total += b.base + upg;
      }
    });
  });
  return total;
}

export function migrateCharEquipped(raw: unknown): CharEquipped {
  const def: CharEquipped = { dlonie: null, nogi: null, glowa: null };
  if (!raw || typeof raw !== "object") return def;
  const r = raw as Record<string, unknown>;
  const parseSlot = (v: unknown): { id: string; upg: number } | null => {
    if (!v) return null;
    if (typeof v === "string") return { id: v, upg: 0 };
    if (typeof v === "object" && v !== null && "id" in v) {
      return { id: (v as { id: string; upg: number }).id, upg: (v as { id: string; upg: number }).upg ?? 0 };
    }
    return null;
  };
  return { dlonie: parseSlot(r.dlonie), nogi: parseSlot(r.nogi), glowa: parseSlot(r.glowa) };
}

export function upgBonusStr(base: number, upg: number, flat?: boolean): string {
  const val = flat ? base + upg : parseFloat((base * (1 + 0.15 * upg)).toFixed(2));
  return val % 1 === 0 ? val.toString() : val.toFixed(2);
}

export function bonusLine(bonuses: EquipBonus[], upg: number): string {
  return bonuses.map(b => `+${upgBonusStr(b.base, upg, b.flat)}${b.label}`).join(" · ");
}
