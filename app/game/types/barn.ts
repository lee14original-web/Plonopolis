export type BarnAnimalState = {
  owned: number;
  slots: number;
  hunger: number;
  lastFedAt: number;
  storage: number;
  prodStart: number;
  baseProdStart: number;
};

export type BarnState = Record<string, BarnAnimalState>;
export type BarnItems = Record<string, number>;

export interface AnimalItemDef {
  id: string;
  name: string;
  icon: string;
  sellPrice: number;
  n1: string;
  n24: string;
  n5: string;
}

export interface AnimalFeedDef {
  cropId: string;
  name: string;
  icon: string;
  points: number;
}

export interface AnimalDef {
  id: string;
  name: string;
  icon: string;
  unlockLevel: number;
  prodMs: number;
  itemId: string;
  storageMax: number;
  startSlots: number;
  maxSlots: number;
  buyPrice: number;
  slotUpgCosts: number[];
  feed: AnimalFeedDef[];
}

export interface THHitbox {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
}

export interface TreeDef {
  id: string;
  name: string;
  icon: string;
  unlockLevel: number;
  fruitId: string;
  fruitName: string;
  fruitIcon: string;
  growthTimeMs: number;
  dropMin: number;
  dropMax: number;
  pricePerFruit: number;
  buyPrice: number;
}
