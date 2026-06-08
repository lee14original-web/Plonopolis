import type { PlayerStatsMap } from "../types/stats";
import { DEFAULT_STATS } from "../types/stats";
import { PER_SESSION_KEYS } from "../constants/storage-keys";

export function clearPerSessionLocalStorage(): void {
  try { PER_SESSION_KEYS.forEach(k => localStorage.removeItem(k)); } catch {}
}

export function lsKey(base: string, uid: string): string {
  return uid ? `${base}_${uid}` : base;
}

export function lsLoadMigrate<T>(base: string, uid: string, parse: (s: string) => T, dflt: () => T): T {
  try {
    const uk = lsKey(base, uid);
    const sNew = localStorage.getItem(uk);
    if (sNew != null) return parse(sNew);
    const sOld = localStorage.getItem(base);
    if (sOld != null) {
      localStorage.setItem(uk, sOld);
      localStorage.removeItem(base);
      return parse(sOld);
    }
  } catch {}
  return dflt();
}

export function loadAvatarDataLS(userId: string): { skin: number; stats: PlayerStatsMap; fsp: number; prevLevel: number; changeCount: number; lastChangeAt: number } {
  const skin = parseInt(localStorage.getItem(`plonopolis_skin_${userId}`) ?? "-1");
  const statsRaw = localStorage.getItem(`plonopolis_stats_${userId}`);
  const stats: PlayerStatsMap = statsRaw ? JSON.parse(statsRaw) : { ...DEFAULT_STATS };
  const fspRaw = localStorage.getItem(`plonopolis_fsp_${userId}`);
  const fsp = fspRaw !== null ? parseInt(fspRaw) : 3;
  const prevLevel = parseInt(localStorage.getItem(`plonopolis_prevlv_${userId}`) ?? "0");
  const changeCount = parseInt(localStorage.getItem(`plonopolis_avatar_changes_${userId}`) ?? "0");
  const lastChangeAt = parseInt(localStorage.getItem(`plonopolis_avatar_last_change_${userId}`) ?? "0");
  return { skin, stats, fsp, prevLevel, changeCount, lastChangeAt };
}

export function saveAvatarDataLS(userId: string, skin: number, stats: PlayerStatsMap, fsp: number, prevLevel: number, changeCount?: number, lastChangeAt?: number): void {
  localStorage.setItem(`plonopolis_skin_${userId}`, String(skin));
  localStorage.setItem(`plonopolis_stats_${userId}`, JSON.stringify(stats));
  localStorage.setItem(`plonopolis_fsp_${userId}`, String(fsp));
  localStorage.setItem(`plonopolis_prevlv_${userId}`, String(prevLevel));
  if (changeCount !== undefined) localStorage.setItem(`plonopolis_avatar_changes_${userId}`, String(changeCount));
  if (lastChangeAt !== undefined) localStorage.setItem(`plonopolis_avatar_last_change_${userId}`, String(lastChangeAt));
}
