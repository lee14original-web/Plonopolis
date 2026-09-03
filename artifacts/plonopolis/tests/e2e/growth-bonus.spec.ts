import { expect, test } from "@playwright/test";
import {
  getGrowthTimeWithMinimum,
  getNewPlayerGrowthMultiplier,
} from "../../src/game/utils/growth";

test("bonus nowego konta skraca 100 sekund do 25 sekund", () => {
  const multiplier = getNewPlayerGrowthMultiplier({
    cropId: "carrot",
    plantedAt: Date.now(),
    watered: false,
    newPlayerGrowthMult: 0.25,
  });

  expect(multiplier).toBe(0.25);
  expect(getGrowthTimeWithMinimum(100_000, multiplier, true, 0.35)).toBe(25_000);
});

test("uprawa przewodnika nie korzysta z bonusu nowego konta", () => {
  const multiplier = getNewPlayerGrowthMultiplier({
    cropId: "carrot",
    plantedAt: Date.now(),
    watered: false,
    newPlayerGrowthMult: 0.25,
    compostBonus: { type: "guide", value: 75 },
  });

  expect(multiplier).toBe(1);
  expect(getGrowthTimeWithMinimum(100_000, multiplier, false, 0.35)).toBe(100_000);
});