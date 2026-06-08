import type { SeedInventory } from "../types/farm";
import { CROPS } from "../constants/crops";
import { COMPOST_DEFS } from "../constants/compost";
import { isCompostKey, compostTypeFromKey } from "./compost";
import { parseQualityKey } from "./crop";

export function getDefaultSeedInventory(): SeedInventory {
  return {};
}

export function parseSeedInventory(value: unknown): SeedInventory {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const merged: Record<string, number> = {};

  for (const [seedId, amount] of Object.entries(value as Record<string, unknown>)) {
    const safeAmount = Math.floor(Number(amount));
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) continue;

    if (seedId === "guide_compost") {
      merged["guide_compost"] = (merged["guide_compost"] ?? 0) + safeAmount;
      continue;
    }

    if (isCompostKey(seedId)) {
      const ct = compostTypeFromKey(seedId);
      const parts = seedId.split("_");
      const lastNum = Number(parts[parts.length - 1]);
      const hasTier = ct ? COMPOST_DEFS[ct].bonusValues.includes(lastNum) : false;
      const normalizedKey = ct && !hasTier
        ? `${COMPOST_DEFS[ct].id}_${COMPOST_DEFS[ct].bonusValues[0]}`
        : seedId;
      merged[normalizedKey] = (merged[normalizedKey] ?? 0) + safeAmount;
      continue;
    }

    const { baseCropId, quality } = parseQualityKey(seedId);
    if (!CROPS.some((crop) => crop.id === baseCropId)) continue;
    const normalizedKey = quality === null ? `${seedId}_good` : seedId;
    merged[normalizedKey] = (merged[normalizedKey] ?? 0) + safeAmount;
  }

  return merged;
}

export function serializeSeedInventory(value: SeedInventory): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value)
      .map(([seedId, amount]) => [seedId, Math.max(0, Math.floor(Number(amount) || 0))] as const)
      .filter(([, amount]) => amount > 0)
  );
}
