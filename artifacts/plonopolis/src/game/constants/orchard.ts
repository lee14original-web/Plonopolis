import type { FruitQuality } from "../types/orchard";
import type { TreeDef } from "../types/barn";

export type { TreeDef };

export const FRUIT_QUALITY_DEFS: Record<FruitQuality, { label: string; mult: number; color: string; icon: string; baseChance: number }> = {
  zwykly:   { label: "Zwykły",   mult: 1, color: "#86efac", icon: "",    baseChance: 0.78 },
  soczysty: { label: "Soczysty", mult: 2, color: "#22d3ee", icon: "💧", baseChance: 0.12 },
  zloty:    { label: "Złoty",    mult: 5, color: "#fde047", icon: "✨", baseChance: 0.03 },
  zgnile:   { label: "Zgniłe",   mult: 0, color: "#6b7280", icon: "",    baseChance: 0.10 },
};

export const TREES: TreeDef[] = [
  { id: "jablon",      name: "Jabłoń",      icon: "🍎", unlockLevel: 10, fruitId: "jablko",      fruitName: "Jabłko",      fruitIcon: "🍎", growthTimeMs:  4 * 3600000, dropMin: 10, dropMax: 14, pricePerFruit: 20,  buyPrice:    4500 },
  { id: "grusza",      name: "Grusza",      icon: "🍐", unlockLevel: 12, fruitId: "gruszka",     fruitName: "Gruszka",     fruitIcon: "🍐", growthTimeMs:  6 * 3600000, dropMin:  9, dropMax: 12, pricePerFruit: 35,  buyPrice:    9000 },
  { id: "sliwa",       name: "Śliwa",       icon: "🟣", unlockLevel: 14, fruitId: "sliwka",      fruitName: "Śliwka",      fruitIcon: "🟣", growthTimeMs:  8 * 3600000, dropMin:  8, dropMax: 10, pricePerFruit: 55,  buyPrice:   18000 },
  { id: "wisnia",      name: "Wiśnia",      icon: "🍒", unlockLevel: 16, fruitId: "wisnia",      fruitName: "Wiśnia",      fruitIcon: "🍒", growthTimeMs: 10 * 3600000, dropMin:  7, dropMax:  9, pricePerFruit: 80,  buyPrice:   35000 },
  { id: "czeresnia",   name: "Czereśnia",   icon: "🍒", unlockLevel: 18, fruitId: "czeresnia",   fruitName: "Czereśnia",   fruitIcon: "🍒", growthTimeMs: 12 * 3600000, dropMin:  6, dropMax:  8, pricePerFruit: 110, buyPrice:   60000 },
  { id: "brzoskwinia", name: "Brzoskwinia", icon: "🍑", unlockLevel: 20, fruitId: "brzoskwinia", fruitName: "Brzoskwinia", fruitIcon: "🍑", growthTimeMs: 14 * 3600000, dropMin:  5, dropMax:  7, pricePerFruit: 150, buyPrice:  100000 },
  { id: "morela",      name: "Morela",      icon: "🟠", unlockLevel: 22, fruitId: "morela",      fruitName: "Morela",      fruitIcon: "🟠", growthTimeMs: 16 * 3600000, dropMin:  4, dropMax:  6, pricePerFruit: 220, buyPrice:  170000 },
  { id: "pomarancza",  name: "Pomarańcza",  icon: "🍊", unlockLevel: 23, fruitId: "pomarancza",  fruitName: "Pomarańcza",  fruitIcon: "🍊", growthTimeMs: 18 * 3600000, dropMin:  3, dropMax:  5, pricePerFruit: 320, buyPrice:  260000 },
  { id: "cytryna",     name: "Cytryna",     icon: "🍋", unlockLevel: 25, fruitId: "cytryna",     fruitName: "Cytryna",     fruitIcon: "🍋", growthTimeMs: 24 * 3600000, dropMin:  2, dropMax:  4, pricePerFruit: 500, buyPrice:  450000 },
];
