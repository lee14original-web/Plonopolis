export type EquipSlot = "dlonie" | "nogi" | "glowa";

export interface EquipBonus {
  base: number;
  label: string;
  flat?: boolean;
}

export interface CharEquipItem {
  id: string;
  name: string;
  slot: EquipSlot;
  icon: string;
  img?: string;
  unlockLevel: number;
  bonuses: EquipBonus[];
  desc?: string;
}

export type CharEquipped = Record<EquipSlot, { id: string; upg: number } | null>;
