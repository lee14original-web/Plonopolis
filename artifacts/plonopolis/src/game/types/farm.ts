import type { CompostBonus, CompostType } from "./crop";

export type FarmPlot = {
  id: number;
  left: string;
  top: string;
  width: string;
  height: string;
};

export type FieldViewPlotLayout = {
  id: number;
  left: string;
  top: string;
  width: string;
  height: string;
};

export type PlotCropState = {
  cropId: string | null;
  plantedAt: number | null;
  watered: boolean;
  plantedQuality?: string | null;
  compostBonus?: CompostBonus | null;
  frozenStatMult?: number | null;
};

export type SeedInventory = Record<string, number>;

export type HarvestEvent = {
  id: number;
  cropName: string;
  cropId: string;
  baseAmount: number;
  bonusAmount: number;
  bonusSource: string | null;
  baseExp: number;
  quality: "rotten" | "good" | "epic" | "legendary";
  timestamp: number;
  compostBonus?: CompostBonus | null;
  expBonusPct?: number;
};

export type PendingFieldAction = {
  kind: "plant" | "harvest" | "water";
  startMs: number;
  durationMs: number;
  seedId?: string;
  bonusesSnapshot?: {
    extraHarvestPct?: number;
    bonusDropPct?: number;
    expPct?: number;
  };
};

export type { CompostType, CompostBonus };
