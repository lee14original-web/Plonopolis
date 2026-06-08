import type { CropQuality } from "../types/crop";
import { CROPS } from "../constants/crops";

export function rollCropQuality(): CropQuality {
  const r = Math.random();
  if (r < 0.15) return "rotten";
  if (r < 0.94) return "good";
  if (r < 0.99) return "epic";
  return "legendary";
}

export function getQualityKey(cropId: string, quality: CropQuality) {
  return `${cropId}_${quality}`;
}

export function parseQualityKey(key: string): { baseCropId: string; quality: CropQuality | null } {
  for (const q of ["rotten", "good", "epic", "legendary"] as CropQuality[]) {
    if (key.endsWith(`_${q}`)) return { baseCropId: key.slice(0, -(q.length + 1)), quality: q };
  }
  return { baseCropId: key, quality: null };
}

export function getPolandDayNumber(): number {
  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function getMsToPolandMidnight(): number {
  const warsawStr = new Date().toLocaleString("sv", { timeZone: "Europe/Warsaw" });
  const timePart = warsawStr.split(" ")[1];
  const [hh, mm, ss] = timePart.split(":").map(Number);
  return 86400000 - (hh * 3600 + mm * 60 + ss) * 1000;
}

export function getDailyPromos(): { normal: string[]; super_: string[] } {
  const day = getPolandDayNumber();
  const eligible = CROPS.filter(c => c.id !== "test_nasiono");
  const arr = [...eligible];
  for (let i = arr.length - 1; i > 0; i--) {
    const x = Math.sin(day * 9301 + i * 49297) * 233280;
    const j = Math.floor((x - Math.floor(x)) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { normal: arr.slice(0, 3).map(c => c.id), super_: [arr[3].id] };
}

export function formatShopCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function calcObstacleCost(_plotId: number, type: string): number {
  const OBSTACLE_FIXED_COSTS: Record<string, number> = {
    chwasty: 15, kamienie: 50, maly_pien: 150, duzy_pien: 250, kret: 500,
  };
  return OBSTACLE_FIXED_COSTS[type] ?? 20;
}
