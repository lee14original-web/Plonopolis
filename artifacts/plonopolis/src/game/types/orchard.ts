export type FruitQuality = "zwykly" | "soczysty" | "zloty" | "zgnile";

export type OrchardTreeState = {
  owned: number;
  prodStart: number;
  storage: Record<FruitQuality, number>;
};

export type OrchardState = Record<string, OrchardTreeState>;
