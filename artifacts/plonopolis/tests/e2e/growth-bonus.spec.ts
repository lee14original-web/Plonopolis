import { expect, test } from "@playwright/test";
import {
  formatNewPlayerBonusRemaining,
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

test("timer bonusu pokazuje minuty i sekundy", () => {
  expect(formatNewPlayerBonusRemaining(15 * 60_000)).toBe("15:00");
  expect(formatNewPlayerBonusRemaining(3 * 60_000 + 45_000)).toBe("03:45");
  expect(formatNewPlayerBonusRemaining(-1)).toBe("00:00");
});