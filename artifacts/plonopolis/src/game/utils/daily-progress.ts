import type { DailyProgress } from "../types/settings";
import { DP_LS_KEY } from "../constants/storage-keys";

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function emptyDP(): DailyProgress {
  return { date: todayStr(), harvests: 0, customers: 0, expGained: 0, moneyGained: 0, levelsGained: 0 };
}

export function loadDP(uid: string): DailyProgress {
  try {
    const r = localStorage.getItem(DP_LS_KEY(uid));
    if (!r) return emptyDP();
    const p = JSON.parse(r) as DailyProgress;
    return p.date === todayStr() ? p : emptyDP();
  } catch { return emptyDP(); }
}

export function saveDP(uid: string, dp: DailyProgress): void {
  try { localStorage.setItem(DP_LS_KEY(uid), JSON.stringify(dp)); } catch {}
}
