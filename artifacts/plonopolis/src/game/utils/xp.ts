import { XP_TABLE } from "../constants/xp";

export function getXpForLevel(level: number): number {
  return XP_TABLE[level] ?? 999999999;
}
