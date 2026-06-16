import type { CompostType } from "../types/crop";
import type { CompostQuality, CompostBatch } from "../types/compost";

export const KOMPOST_PER_REWARD = 10; // ile ładowań = 1 nagroda
export const KOMPOST_BATCH_SIZE = 100;
export const KOMPOST_REWARDS_PER_BATCH = 5;
export const JACKPOT_CHANCE = 0.5; // % szansy na jackpot per partia
export const MAX_LEGENDARY_EXP_MULT = 50; // cap: base EXP × wszystkie bonusy ≤ base × 50

export const COMPOST_DEFS: Record<CompostType, { id: string; name: string; icon: string; imgs: Record<number, string>; desc: string; descs: Record<number, string>; effectLabel: string; bonusValues: number[]; bonusLabel: (v: number) => string; tierName: (v: number) => string }> = {
  growth: { id: "compost_growth", name: "Kompost Wzrostu",      icon: "⚡", imgs: { 5: "/ekwipunek/kompost/kompost_wzrostu_slaby.png",   10: "/ekwipunek/kompost/kompost_wzrostu_sredni.png",   15: "/ekwipunek/kompost/kompost_wzrostu_mocny.png"   }, desc: "Przyspiesza wzrost upraw",     descs: { 5: "Delikatnie pobudza rośliny do działania. Bez pośpiechu, ale skutecznie.", 10: "Rośliny po nim rosną szybciej, jakby ktoś szepnął im: czas na awans.", 15: "Potężna dawka energii dla upraw, które nie mają czasu na lenistwo." }, effectLabel: "⚡ Szybszy wzrost",   bonusValues: [5, 10, 15], bonusLabel: (v) => `-${v}% czasu wzrostu`, tierName: (v) => v <= 5 ? "Słaby" : v <= 10 ? "Średni" : "Mocny" },
  yield:  { id: "compost_yield",  name: "Kompost Urodzaju",     icon: "🌾", imgs: { 1: "/ekwipunek/kompost/kompost_urodzaju_slaby.png",   2: "/ekwipunek/kompost/kompost_urodzaju_sredni.png",   3: "/ekwipunek/kompost/kompost_urodzaju_mocny.png"   }, desc: "Zwiększa plon przy zbiorze",   descs: { 1: "Skromna pomoc dla plonów, które chcą dać z siebie trochę więcej.", 2: "Ziemia go lubi, a koszyk zbieracza lubi go jeszcze bardziej.", 3: "Sprawia, że pole wygląda, jakby miało wyjątkowo dobry dzień." }, effectLabel: "🌾 Większy plon",     bonusValues: [1, 2, 3],   bonusLabel: (v) => `+${v} sztuk plonu`,    tierName: (v) => v <= 1 ? "Słaby" : v <= 2 ? "Średni" : "Mocny" },
  exp:    { id: "compost_exp",    name: "Kompost Nauki",        icon: "⭐", imgs: { 10: "/ekwipunek/kompost/kompost_nauki_slaby.png",     20: "/ekwipunek/kompost/kompost_nauki_sredni.png",     30: "/ekwipunek/kompost/kompost_nauki_mocny.png"     }, desc: "Daje więcej EXP przy zbiorze", descs: { 10: "Trochę wiedzy z ziemi, trochę doświadczenia z pola.", 20: "Pomaga roślinom rosnąć, a farmerowi szybciej łapać doświadczenie.", 30: "Podobno nawet marchewki po nim wiedzą, co to progres." }, effectLabel: "⭐ Więcej EXP",       bonusValues: [10, 20, 30], bonusLabel: (v) => `+${v}% EXP`,           tierName: (v) => v <= 10 ? "Słaby" : v <= 20 ? "Średni" : "Mocny" },
  guide:  { id: "guide_compost",  name: "Kompost Przewodnika",  icon: "🌟", imgs: { 65: "/ekwipunek/kompost/kompost_przewodnika.png"                                                                                   }, desc: "Specjalny kompost dla początkujących. Skraca czas wzrostu uprawy o 65% (globalny cap). Nie można go sprzedać na targu.", descs: { 65: "Specjalny kompost dla początkujących farmerów. Przewodnik mówi, że działa. Przekonamy się?" }, effectLabel: "🌟 −65% czasu wzrostu", bonusValues: [65], bonusLabel: () => `−65% czasu wzrostu`, tierName: () => "Kompost Przewodnika" },
};

// Wagi losowania tieru: 50% słaby, 35% średni, 15% mocny
export const COMPOST_TIER_WEIGHTS = [50, 35, 15];

export const GUIDE_COMPOST_DEF = COMPOST_DEFS.guide;

// Bazowa wartość uprawy do kompostu wg unlockLevel (lvl 1=1.0, +0.2 per lvl, lvl 25=6.0)
export const COMPOST_BASE_VALUE_BY_LEVEL: Record<number, number> = {
  1: 1.0, 2: 1.2, 3: 1.4, 4: 1.6, 5: 1.8,
  6: 2.0, 7: 2.2, 8: 2.4, 9: 2.6, 10: 2.8,
  11: 3.0, 12: 3.2, 13: 3.4, 14: 3.6, 15: 3.8,
  16: 4.0, 17: 4.2, 18: 4.4, 19: 4.6, 20: 4.8,
  21: 5.0, 22: 5.2, 23: 5.4, 24: 5.6, 25: 6.0,
};

// Mnożnik rzadkości plonu
export const COMPOST_RARITY_MULT: Record<"rotten" | "good" | "epic" | "legendary", number> = {
  rotten:    0.25,
  good:      1.00,
  epic:      2.50,
  legendary: 5.00,
};

// Klasy jakości kompostu (sortowane od najwyższej do najniższej)
export const COMPOST_QUALITY_DEFS: { id: CompostQuality; min: number; label: string; color: string; border: string }[] = [
  { id: "legendary", min: 15.0, label: "Legendarny",   color: "#fbbf24", border: "#f59e0b" },
  { id: "very_good", min: 9.0,  label: "Bardzo dobry", color: "#a78bfa", border: "#8b5cf6" },
  { id: "good",      min: 5.0,  label: "Dobry",        color: "#6ee7b7", border: "#10b981" },
  { id: "medium",    min: 2.5,  label: "Średni",       color: "#dfcfab", border: "#a8a29e" },
  { id: "weak",      min: 1.0,  label: "Słaby",        color: "#fca5a5", border: "#f87171" },
  { id: "very_weak", min: 0,    label: "Bardzo słaby", color: "#94a3b8", border: "#64748b" },
];

// Tabela szans na tier itemu wg jakości kompostu (5 kolumn: I1=lvl1-5, I2=lvl6-10, I3=lvl11-15, I4=lvl16-20, I5=lvl21-25)
export const ITEM_TIER_BY_QUALITY: Record<CompostQuality, [number, number, number, number, number]> = {
  very_weak: [90, 10,  0,  0,  0],
  weak:      [70, 25,  5,  0,  0],
  medium:    [45, 35, 17,  3,  0],
  good:      [20, 35, 30, 12,  3],
  very_good: [ 5, 15, 35, 30, 15],
  legendary: [ 0,  5, 20, 40, 35],
};

export const ITEM_TIER_RARITY: Array<{ border: string; shadow: string; label: string; dot: string }> = [
  { border: "#22c55e", shadow: "rgba(34,197,94,0.30)",   label: "Standard",   dot: "🟢" }, // I1
  { border: "#38bdf8", shadow: "rgba(56,189,248,0.30)",  label: "Dobry",      dot: "🔵" }, // I2
  { border: "#a78bfa", shadow: "rgba(167,139,250,0.40)", label: "Epic",       dot: "🟣" }, // I3
  { border: "#fb923c", shadow: "rgba(251,146,60,0.40)",  label: "Epic+",      dot: "🟠" }, // I4
  { border: "#fbbf24", shadow: "rgba(251,191,36,0.55)",  label: "Legendarny", dot: "👑" }, // I5
];

// Siła kompostu growth/yield/exp wg jakości partii — DETERMINISTYCZNA (0=Słaby, 1=Średni, 2=Mocny)
export const COMPOST_TIER_FIXED_BY_QUALITY: Record<CompostQuality, number> = {
  very_weak: 0,
  weak:      0,
  medium:    1,
  good:      1,
  very_good: 2,
  legendary: 2,
};

export type { CompostBatch };
