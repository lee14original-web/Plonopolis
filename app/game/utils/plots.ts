import { MAX_FIELDS } from "../constants/game";
import type { PlotCropState, CompostBonus, CompostType } from "../types/farm";

export function getDefaultUnlockedPlots(): number[] {
  return Array.from({ length: 20 }, (_, i) => i + 1);
}

export function normalizeUnlockedPlots(plots: number[]): number[] {
  return Array.from(new Set([...getDefaultUnlockedPlots(), ...plots]))
    .filter((plotId) => Number.isInteger(plotId) && plotId >= 1 && plotId <= MAX_FIELDS)
    .sort((a, b) => a - b);
}

export function parseUnlockedPlots(value: unknown): number[] {
  if (!Array.isArray(value)) return getDefaultUnlockedPlots();
  return normalizeUnlockedPlots(value.map((item) => Number(item)));
}

export function saveTutorialPlotIdsToStorage(userId: string, ids: number[]): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(`plonopolis_tutorial_plots_${userId}`, JSON.stringify(ids));
  } catch {}
}

export function loadTutorialPlotIdsFromStorage(userId: string): number[] {
  try {
    if (typeof window === "undefined") return [];
    return JSON.parse(window.localStorage.getItem(`plonopolis_tutorial_plots_${userId}`) ?? "[]") as number[];
  } catch { return []; }
}

export function buildEmptyPlotCrop(): PlotCropState {
  return { cropId: null, plantedAt: null, watered: false };
}

export function parsePlotCrops(value: unknown): Record<number, PlotCropState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const entries = Object.entries(value as Record<string, unknown>);
  const parsedEntries: Array<readonly [number, PlotCropState]> = [];

  for (const [key, rawValue] of entries) {
    const plotId = Number(key);
    if (!Number.isInteger(plotId) || plotId < 1 || plotId > MAX_FIELDS) continue;

    const item = rawValue as Partial<PlotCropState> | null;
    let _compostBonus: CompostBonus | null = null;
    if (item && (item as { compostBonus?: unknown }).compostBonus && typeof (item as { compostBonus?: unknown }).compostBonus === "object") {
      const cb = (item as { compostBonus: { type?: unknown; value?: unknown } }).compostBonus;
      const ct = cb.type;
      const cv = cb.value;
      if ((ct === "growth" || ct === "yield" || ct === "exp" || ct === "guide") && typeof cv === "number" && cv > 0) {
        _compostBonus = { type: ct as CompostType, value: cv };
      }
    }
    parsedEntries.push([
      plotId,
      {
        cropId: typeof item?.cropId === "string" ? item.cropId : null,
        plantedAt: typeof item?.plantedAt === "number" ? item.plantedAt : null,
        watered: Boolean(item?.watered),
        plantedQuality: typeof item?.plantedQuality === "string" ? item.plantedQuality : null,
        compostBonus: _compostBonus,
        frozenStatMult: typeof (item as { frozenStatMult?: unknown })?.frozenStatMult === "number"
          ? (item as { frozenStatMult: number }).frozenStatMult
          : null,
      },
    ]);
  }
  return Object.fromEntries(parsedEntries);
}

export function serializePlotCrops(value: Record<number, PlotCropState>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      {
        cropId: v.cropId,
        plantedAt: v.plantedAt,
        watered: v.watered,
        plantedQuality: v.plantedQuality ?? null,
        compostBonus: v.compostBonus ?? null,
        frozenStatMult: v.frozenStatMult ?? null,
      },
    ])
  );
}
