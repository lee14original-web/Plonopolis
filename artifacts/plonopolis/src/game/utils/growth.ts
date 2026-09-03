import type { PlotCropState } from "../types/farm";

export const NEW_PLAYER_GROWTH_MULTIPLIER = 0.25;
export const NEW_PLAYER_GROWTH_BONUS_DURATION_MS = 15 * 60 * 1000;

export function formatNewPlayerBonusRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

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