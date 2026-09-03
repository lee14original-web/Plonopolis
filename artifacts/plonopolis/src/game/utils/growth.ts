import type { PlotCropState } from "../types/farm";

export const NEW_PLAYER_GROWTH_MULTIPLIER = 0.25;

export function getNewPlayerGrowthMultiplier(plot: PlotCropState): number {
  return plot.newPlayerGrowthMult === NEW_PLAYER_GROWTH_MULTIPLIER
    && plot.compostBonus?.type !== "guide"
    ? NEW_PLAYER_GROWTH_MULTIPLIER
    : 1;
}

export function getGrowthTimeWithMinimum(
  baseGrowthMs: number,
  totalMultiplier: number,
  hasNewPlayerBonus: boolean,
  defaultMinimumMultiplier: number,
): number {
  const minimumMultiplier = hasNewPlayerBonus
    ? NEW_PLAYER_GROWTH_MULTIPLIER
    : defaultMinimumMultiplier;

  return Math.round(baseGrowthMs * Math.max(minimumMultiplier, totalMultiplier));
}