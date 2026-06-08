import type { CompostType } from "../types/crop";
import type { CompostQuality } from "../types/compost";
import { COMPOST_DEFS, COMPOST_TIER_WEIGHTS, COMPOST_QUALITY_DEFS } from "../constants/compost";

export function isCompostKey(key: string): boolean {
  return key.startsWith("compost_");
}

export function isGuideCompostKey(key: string): boolean {
  return key === "guide_compost";
}

export function compostTypeFromKey(key: string): CompostType | null {
  if (key === "guide_compost")           return "guide";
  if (key.startsWith("compost_growth"))  return "growth";
  if (key.startsWith("compost_yield"))   return "yield";
  if (key.startsWith("compost_exp"))     return "exp";
  return null;
}

export function compostValueFromKey(key: string): number {
  const t = compostTypeFromKey(key);
  if (!t) return 0;
  const parts = key.split("_");
  const last = parts[parts.length - 1];
  const n = Number(last);
  if (Number.isFinite(n) && COMPOST_DEFS[t].bonusValues.includes(n)) return n;
  return COMPOST_DEFS[t].bonusValues[0];
}

export function compostKeyFor(type: CompostType, value: number): string {
  if (type === "guide") return "guide_compost";
  return `${COMPOST_DEFS[type].id}_${value}`;
}

export function rollCompostTierIdx(): number {
  const total = COMPOST_TIER_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < COMPOST_TIER_WEIGHTS.length; i++) {
    r -= COMPOST_TIER_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
}

export function getCompostQualityFromScore(score: number): CompostQuality {
  for (const def of COMPOST_QUALITY_DEFS) {
    if (score >= def.min) return def.id;
  }
  return "very_weak";
}

export function getCompostQualityDef(quality: CompostQuality) {
  return COMPOST_QUALITY_DEFS.find(d => d.id === quality)!;
}

export function rollFromChances(chances: number[]): number {
  let r = Math.random() * 100;
  for (let i = 0; i < chances.length; i++) {
    r -= chances[i];
    if (r < 0) return i;
  }
  return 0;
}
