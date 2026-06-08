import type { CharEquipItem, EquipSlot, CharEquipped } from "../types/equipment";

export const CHAR_EQUIP_ITEMS: CharEquipItem[] = [
  // ─── DŁONIE (LVL 1–25, jeden per poziom) ───
  { id: "d1",  name: "Spracowane Rękawice",     slot: "dlonie", icon: "🧤", unlockLevel: 1,  bonuses: [{ base: 1,  label: " pkt Wiedzy", flat: true }] },
  { id: "d2",  name: "Rękawice Siewcy",         slot: "dlonie", icon: "🧤", unlockLevel: 2,  bonuses: [{ base: 1,  label: " pkt Wiedzy", flat: true }] },
  { id: "d3",  name: "Rękawice Rolnika",        slot: "dlonie", icon: "🧤", unlockLevel: 3,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }] },
  { id: "d4",  name: "Grabie Ogrodnika",        slot: "dlonie", icon: "🌿", unlockLevel: 4,  bonuses: [{ base: 1,  label: " pkt Wiedzy", flat: true }] },
  { id: "d5",  name: "Rękawice Ziemi",          slot: "dlonie", icon: "🧤", unlockLevel: 5,  bonuses: [{ base: 2,  label: " pkt Sadownika", flat: true }] },
  { id: "d6",  name: "Łopata Polowa",           slot: "dlonie", icon: "🌿", unlockLevel: 6,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }] },
  { id: "d7",  name: "Rękawice Urodzaju",       slot: "dlonie", icon: "🧤", unlockLevel: 7,  bonuses: [{ base: 1,  label: " pkt Zrecznosci", flat: true }] },
  { id: "d8",  name: "Kosz Zbieracza",          slot: "dlonie", icon: "🧺", unlockLevel: 8,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }] },
  { id: "d9",  name: "Motyka Rolna",            slot: "dlonie", icon: "⛏️", unlockLevel: 9,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }] },
  { id: "d10", name: "Sekator Sadu",            slot: "dlonie", icon: "✂️", unlockLevel: 10, bonuses: [{ base: 3,  label: "% speed drzew" }] },
  { id: "d11", name: "Rękawice Farmera",        slot: "dlonie", icon: "🧤", unlockLevel: 11, bonuses: [{ base: 2,  label: "% EXP z upraw" }] },
  { id: "d12", name: "Rękawice Zbiorów",        slot: "dlonie", icon: "🧤", unlockLevel: 12, bonuses: [{ base: 1,  label: " pkt Zrecznosci", flat: true }] },
  { id: "d13", name: "Narzędzia Sadownika",     slot: "dlonie", icon: "🔧", unlockLevel: 13, bonuses: [{ base: 4,  label: "% speed drzew" }] },
  { id: "d14", name: "Rękawice Nawadniania",    slot: "dlonie", icon: "🧤", unlockLevel: 14, bonuses: [{ base: 3,  label: " pkt Zaradnosci", flat: true }] },
  { id: "d15", name: "Rękawice Hodowcy",        slot: "dlonie", icon: "🧤", unlockLevel: 15, bonuses: [{ base: 3,  label: "% reward zwierząt" }] },
  { id: "d16", name: "Srebrny Sekator",         slot: "dlonie", icon: "✂️", unlockLevel: 16, bonuses: [{ base: 5,  label: "% speed drzew" }] },
  { id: "d17", name: "Rękawice Plonów",         slot: "dlonie", icon: "🧤", unlockLevel: 17, bonuses: [{ base: 2,  label: " pkt Zrecznosci", flat: true }] },
  { id: "d18", name: "Widły Farmera",           slot: "dlonie", icon: "🌿", unlockLevel: 18, bonuses: [{ base: 4,  label: "% EXP z upraw" }] },
  { id: "d19", name: "Narzędzia Mistrza",       slot: "dlonie", icon: "🔧", unlockLevel: 19, bonuses: [{ base: 3,  label: " pkt Wiedzy", flat: true }] },
  { id: "d20", name: "Rękawice Pszczelarza",    slot: "dlonie", icon: "🐝", unlockLevel: 20, bonuses: [{ base: 20, label: "% zużycia stroju" }] },
  { id: "d21", name: "Motyka Obfitości",        slot: "dlonie", icon: "⛏️", unlockLevel: 21, bonuses: [{ base: 2,  label: " pkt Zrecznosci", flat: true }] },
  { id: "d22", name: "Rękawice Żniwiarza",      slot: "dlonie", icon: "🧤", unlockLevel: 22, bonuses: [{ base: 4,  label: " pkt Wiedzy", flat: true }] },
  { id: "d23", name: "Sekator Premium",         slot: "dlonie", icon: "✂️", unlockLevel: 23, bonuses: [{ base: 6,  label: "% speed drzew" }] },
  { id: "d24", name: "Rękawice Natury",         slot: "dlonie", icon: "🧤", unlockLevel: 24, bonuses: [{ base: 3,  label: " pkt Wiedzy", flat: true }] },
  { id: "d25", name: "Mistyczne Dłonie Farmy",  slot: "dlonie", icon: "✨", unlockLevel: 25, bonuses: [{ base: 3,  label: " pkt Wiedzy", flat: true }, { base: 2, label: " pkt Zrecznosci", flat: true }] },
  // ─── NOGI (LVL 1–30) ───
  { id: "n1",  name: "Stare Kalosze",           slot: "nogi", icon: "👢", unlockLevel: 1,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }] },
  { id: "n2",  name: "Kalosze Rolnika",         slot: "nogi", icon: "👢", unlockLevel: 3,  bonuses: [{ base: 3,  label: " pkt Wiedzy", flat: true }] },
  { id: "n3",  name: "Buty Polowe",             slot: "nogi", icon: "👢", unlockLevel: 6,  bonuses: [{ base: 5,  label: "% efekt podlewania" }] },
  { id: "n4",  name: "Buty Zbieracza",          slot: "nogi", icon: "👢", unlockLevel: 9,  bonuses: [{ base: 4,  label: " pkt Wiedzy", flat: true }] },
  { id: "n5",  name: "Buty Błotne",             slot: "nogi", icon: "👢", unlockLevel: 12, bonuses: [{ base: 8,  label: "% efekt podlewania" }] },
  { id: "n6",  name: "Ostrogi Hodowcy",         slot: "nogi", icon: "⚡", unlockLevel: 15, bonuses: [{ base: 6,  label: "% reward zwierząt" }] },
  { id: "n7",  name: "Szybkie Kalosze",         slot: "nogi", icon: "👢", unlockLevel: 18, bonuses: [{ base: 6,  label: " pkt Wiedzy", flat: true }] },
  { id: "n8",  name: "Buty Sadownika",          slot: "nogi", icon: "🥾", unlockLevel: 21, bonuses: [{ base: 8,  label: "% speed drzew" }] },
  { id: "n9",  name: "Buty Zaradności",         slot: "nogi", icon: "👢", unlockLevel: 24, bonuses: [{ base: 10, label: "% efekt podlewania" }] },
  { id: "n10", name: "Buty Burzy",              slot: "nogi", icon: "⚡", unlockLevel: 27, bonuses: [{ base: 12, label: " pkt Wiedzy", flat: true }] },
  { id: "n11", name: "Legendarne Kalosze",      slot: "nogi", icon: "👑", unlockLevel: 30, bonuses: [{ base: 10, label: " pkt Wiedzy", flat: true }] },
  // ─── GŁOWA (LVL 1–30) ───
  { id: "g1",  name: "Słomkowy Kapelusz",       slot: "glowa", icon: "👒", unlockLevel: 1,  bonuses: [{ base: 5,  label: "% EXP z upraw" }] },
  { id: "g2",  name: "Kapelusz Rolnika",        slot: "glowa", icon: "👒", unlockLevel: 5,  bonuses: [{ base: 5,  label: "% EXP z upraw" }, { base: 3, label: " pkt Wiedzy", flat: true }] },
  { id: "g3",  name: "Kapelusz Pszczelarza",    slot: "glowa", icon: "🐝", unlockLevel: 10, bonuses: [{ base: 10, label: "% produkcji miodu" }, { base: 5, label: " pkt Wiedzy", flat: true }] },
  { id: "g4",  name: "Czapka Szczęścia",        slot: "glowa", icon: "🍀", unlockLevel: 15, bonuses: [{ base: 5,  label: " pkt Szczescia", flat: true }, { base: 3, label: " pkt Zrecznosci", flat: true }, { base: 5, label: "% EXP" }] },
  { id: "g5",  name: "Korona Sadownika",        slot: "glowa", icon: "👑", unlockLevel: 20, bonuses: [{ base: 10, label: "% speed drzew" }, { base: 5, label: "% reward zwierząt" }, { base: 5, label: " pkt Wiedzy", flat: true }] },
  { id: "g6",  name: "Kapelusz Mistrza Farmy",  slot: "glowa", icon: "🎓", unlockLevel: 25, bonuses: [{ base: 10, label: " pkt Wiedzy", flat: true }, { base: 10, label: "% EXP" }, { base: 3, label: " pkt Zrecznosci", flat: true }] },
  { id: "g7",  name: "Korona Plonopolis",       slot: "glowa", icon: "👑", unlockLevel: 30, bonuses: [{ base: 8,  label: " pkt Wiedzy", flat: true }, { base: 8, label: "% speed drzew" }, { base: 8, label: "% reward zwierząt" }, { base: 5, label: " pkt Zrecznosci", flat: true }] },
];

export const EQUIP_SLOT_META: Record<EquipSlot, { label: string; icon: string; desc: string }> = {
  dlonie: { label: "Dłonie", icon: "🧤", desc: "Rękawice, narzędzia, przedmioty robocze" },
  nogi:   { label: "Nogi",   icon: "👢", desc: "Tempo i szybkość gry" },
  glowa:  { label: "Głowa",  icon: "🪖", desc: "Strategia i inteligencja" },
};

export const DEFAULT_CHAR_EQUIPPED: CharEquipped = { dlonie: null, nogi: null, glowa: null };

// ─── Materiały ze zwierząt: M1..M10 → ID przedmiotu zwierzęcego ───
export const TIER_MATERIAL: Record<number, string> = {
  1: "jajko", 2: "futro_krolika", 3: "mleko", 4: "piora", 5: "welna",
  6: "nawoz_naturalny", 7: "mleko_kozie", 8: "duze_piora", 9: "energia_robocza", 10: "rogi_byka",
};

export const UPG_COLOR = ["#6b7280", "#9ca3af", "#9ca3af", "#9ca3af", "#4ade80", "#4ade80", "#4ade80", "#fbbf24", "#fbbf24", "#fbbf24", "#fbbf24"];

// ─── Bazowe koszty ulepszenia (index = poziom docelowy +1..+10) ───
export const UPGRADE_COST   = [0, 50, 100, 250, 500, 1200, 2500, 5000, 10000, 20000, 40000];
export const UPGRADE_CHANCE = [1, 0.95, 0.90, 0.90, 0.85, 0.80, 0.70, 0.60, 0.45, 0.35, 0.20];
