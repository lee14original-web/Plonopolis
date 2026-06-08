import type React from "react";

export function ttStyle(mx: number, my: number, tipW = 288, tipH = 230): React.CSSProperties {
  const gw = 1920;
  const gh = 1280;
  const left = Math.min(mx + 18, gw - tipW - 8);
  const top = my > gh * 0.58
    ? Math.max(8, my - tipH)
    : Math.min(my + 16, gh - tipH - 8);
  return { left, top };
}

export type LigaTier = { name: string; color: string; icon: string; bg: string; border: string };

export function getLigaTier(rank: number, tot: number): LigaTier {
  if (tot === 0 || rank < 0) return { name: "Liga Drewna",   color: "#9ca3af", icon: "🌿", bg: "rgba(20,20,20,0.7)",  border: "#374151" };
  if (rank === 0)             return { name: "Liga Mistrzów", color: "#f97316", icon: "🏆", bg: "rgba(50,20,5,0.85)",  border: "#f97316" };
  const pct = rank / tot;
  if (pct <= 0.10)            return { name: "Liga Złota",    color: "#f2ca69", icon: "🥇", bg: "rgba(45,30,0,0.85)",  border: "#f2ca69" };
  if (pct <= 0.30)            return { name: "Liga Srebrna",  color: "#94a3b8", icon: "🥈", bg: "rgba(25,30,40,0.85)", border: "#94a3b8" };
  if (pct <= 0.60)            return { name: "Liga Brązowa",  color: "#c9952f", icon: "🥉", bg: "rgba(40,22,5,0.85)",  border: "#c9952f" };
  return                             { name: "Liga Drewna",   color: "#9ca3af", icon: "🌿", bg: "rgba(20,20,20,0.7)",  border: "#374151" };
}

/** Kolor tieru nawozu kompostowego (0=szary, 1=zielony, 2=fioletowy). */
export function compostTierColor(tierIdx: number): string {
  return tierIdx === 0 ? "#9ca3af" : tierIdx === 1 ? "#22c55e" : "#a78bfa";
}

/** Formatuje liczbę jako "Nk" (tysiące) lub pełną wartość w stylu pl-PL. */
export function fmtK(n: number): string {
  return n >= 1000
    ? `${(n / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 0 })}k`
    : n.toLocaleString("pl-PL");
}

/** Formatuje liczbę jako pełną wartość w stylu pl-PL. */
export function fmtFull(n: number): string {
  return n.toLocaleString("pl-PL");
}
