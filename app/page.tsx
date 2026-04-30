"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type RankingPlayer = {
  user_id: string;
  player_name: string;
  guild_name: string;
  level: number;
  money: number;
  missions_completed: number;
  avatar_skin?: number | null;
};

type Profile = {
  id: string;
  login: string;
  email: string;
  created_at?: string;
  level?: number | null;
  xp?: number | null;
  xp_to_next_level?: number | null;
  money?: number | null;
  location?: string | null;
  current_map?: string | null;
  last_played_at?: string | null;
  unlocked_plots?: number[] | null;
  plot_crops?: Record<string, PlotCropState> | null;
  seed_inventory?: Record<string, number> | null;
  avatar_skin?: number | null;
  player_stats?: Record<string, number> | null;
  free_skill_points?: number | null;
  prev_level?: number | null;
  equipment_slots?: number | null;
  equipment?: string[] | null;
  blocked_users?: string[] | null;
  unlocked_epic_avatars?: number[] | null;
  hive_data?: Record<string, unknown> | null;
};

type Message = {
  type: "success" | "error" | "info";
  title: string;
  text: string;
};

type GameMessage = {
  id: string;
  from_user_id: string | null;
  from_username: string | null;
  from_avatar_skin?: number | null;
  to_user_id: string | null;
  to_username: string | null;
  to_avatar_skin?: number | null;
  type: "received" | "sent" | "system";
  subject: string;
  body: string;
  read: boolean;
  saved: boolean;
  created_at: string;
};

type FarmUpgradeModal = {
  level: number;
  title: string;
  text: string;
};

type FarmPlot = {
  id: number;
  left: string;
  top: string;
  width: string;
  height: string;
};

type FieldViewPlotLayout = {
  id: number;
  left: string;
  top: string;
  width: string;
  height: string;
};

type Crop = {
  id: string;
  name: string;
  unlockLevel: number;
  growthTimeMs: number;
  yieldAmount: number;
  expReward: number;
  spritePath: string;
  epicSpritePath?: string;
  rottenSpritePath?: string;
  legendarySpritePath?: string;
};

type CompostType = "growth"|"yield"|"exp";
type CompostBonus = { type: CompostType; value: number };
type PlotCropState = {
  cropId: string | null;
  plantedAt: number | null;
  watered: boolean;
  plantedQuality?: string | null;
  compostBonus?: CompostBonus | null;
};

type SeedInventory = Record<string, number>;
type HarvestEvent = {
  id: number;
  cropName: string;
  cropId: string;
  baseAmount: number;
  bonusAmount: number;
  bonusSource: string | null;
  baseExp: number;
  quality: "rotten" | "good" | "epic" | "legendary";
  timestamp: number;
};

const DEFAULT_LEVEL = 1;
const DEFAULT_XP = 0;
const DEFAULT_XP_TO_NEXT_LEVEL = 12;
const DEFAULT_MONEY = 10;
const DEFAULT_LOCATION = "Startowa Polana";
const DEFAULT_MAP = "farm1";
const MAX_LEVEL = 50;
const MAX_FIELDS = 25;
const FARM_UPGRADE_LEVELS = [5, 10, 15, 20, 25] as const;
const FARM_MUSIC_MAPS = ["farm1","farm5","farm10","farm15","farm20","farm25"];
const CITY_MUSIC_MAPS = ["city","city_shop","city_market","city_bank","city_townhall"];


const CROP_QUALITY_DEFS = {
  rotten:    { label: "Popsuta",    badge: "⚠️", borderColor: "#ffffff", bgColor: "rgba(255,255,255,0.05)", expMult: 0, canPlant: false },
  good:      { label: "Zwykła",     badge: "✅", borderColor: "#ffffff", bgColor: "rgba(255,255,255,0.05)", expMult: 1, canPlant: true  },
  epic:      { label: "Epicka",     badge: "⭐", borderColor: "#22c55e", bgColor: "rgba(20,80,30,0.5)",   expMult: 3, canPlant: true  },
  legendary: { label: "Legendarna", badge: "🌟", borderColor: "#f59e0b", bgColor: "rgba(80,50,5,0.5)",    expMult: 5, canPlant: true  },
} as const;
type CropQuality = keyof typeof CROP_QUALITY_DEFS;

function rollCropQuality(): CropQuality {
  const r = Math.random();
  if (r < 0.15) return "rotten";
  if (r < 0.94) return "good";
  if (r < 0.99) return "epic";
  return "legendary";
}

function getQualityKey(cropId: string, quality: CropQuality) { return `${cropId}_${quality}`; }

function parseQualityKey(key: string): { baseCropId: string; quality: CropQuality | null } {
  for (const q of ["rotten","good","epic","legendary"] as CropQuality[]) {
    if (key.endsWith(`_${q}`)) return { baseCropId: key.slice(0, -(q.length+1)), quality: q };
  }
  return { baseCropId: key, quality: null };
}

const SKINS_MALE = [
  "/avatar_m1.png","/avatar_m2.png","/avatar_m3.png","/avatar_m4.png","/avatar_m5.png",
  "/avatar_m6.png","/avatar_m7.png","/avatar_m8.png","/avatar_m9.png","/avatar_m10.png",
];
const SKINS_FEMALE = [
  "/avatar_f1.png","/avatar_f2.png","/avatar_f3.png","/avatar_f4.png","/avatar_f5.png",
  "/avatar_f6.png","/avatar_f7.png","/avatar_f8.png","/avatar_f9.png","/avatar_f10.png",
];
const EPIC_SKINS: { path: string; name: string; cost: Record<string,number> }[] = [
  { path: "/avatar_epic1.png", name: "Król Marchewek", cost: { "carrot_good": 500 } },
  { path: "/avatar_epic2.png", name: "Zielona Moc",    cost: { "carrot_epic": 20 } },
  { path: "/avatar_epic3.png", name: "Plon Bogów",     cost: { "carrot_legendary": 1 } },
  { path: "/avatar_epic4.png", name: "Władca Pól",     cost: { "potato_epic": 5, "carrot_epic": 5 } },
  { path: "/avatar_epic5.png", name: "Legenda Farmy",  cost: { "potato_legendary": 1 } },
];
const EPIC_SKIN_START = 20; // indeksy 20–24
const ALL_SKINS = [...SKINS_MALE, ...SKINS_FEMALE, ...EPIC_SKINS.map(s => s.path)];

// UWAGA: rate dla "wiedza" i "zaradnosc" muszą być zgodne z WIEDZA_RATE/ZARADNOSC_RATE
// (poniżej w sekcji BALANS WZROSTU UPRAW). Inaczej UI panelu statów pokaże inny %
// niż faktyczny efekt w `getEffectiveGrowthTimeMs`.
const STATS_DEFS = [
  { key: "wiedza",    label: "Wiedza",    icon: "📚", img: "/skill_wiedza.png",    desc: "Rośliny rosną szybciej (max −25%)",   rate: 0.0033 },
  { key: "zrecznosc", label: "Zręczność", icon: "🎯", img: "/skill_zrecznosc.png", desc: "Szansa na podwójny zbiór",            rate: 0.004  },
  { key: "zaradnosc", label: "Zaradność", icon: "💧", img: "/skill_zaradnosc.png", desc: "Przyspieszenie wzrostu po podlaniu (max −30%)", rate: 0.004  },
  { key: "sadownik",  label: "Sadownik",  icon: "🌳", img: "/skill_sadownik.png",  desc: "Większy zysk z drzew",               rate: 0.005  },
  { key: "opieka",    label: "Opieka",    icon: "🐄", img: "/skill_opieka.png",    desc: "Zwierzęta wolniej głodnieją · szansa na bonus",  rate: 0.003  },
  { key: "szczescie", label: "Szczęście", icon: "🍀", img: "/skill_szczescie.png", desc: "Szansa na bonusowy drop",             rate: 0.0025 },
];
type StatKey = typeof STATS_DEFS[number]["key"];
type PlayerStatsMap = Record<StatKey, number>;
const DEFAULT_STATS: PlayerStatsMap = { wiedza:0, zrecznosc:0, zaradnosc:0, sadownik:0, opieka:0, szczescie:0 };

interface HiveData {
  level: number;
  bees_progress: number;
  honey_start: number | null;
  suit_durability: number;
  empty_jars: number;
  honey_jars: number;
}
const DEFAULT_HIVE_DATA: HiveData = { level:1, bees_progress:0, honey_start:null, suit_durability:0, empty_jars:0, honey_jars:0 };
const HIVE_MAX_HONEY     = [0, 8, 10, 12, 14, 16];
const HIVE_UPGRADE_BEES  = [0, 20, 30, 40, 50];
const HIVE_SUCCESS_CHANCE= [0, 0.90, 0.80, 0.70, 0.60, 0.50];
const HONEY_MS_PER_PT    = 3_600_000;
const HONEY_JAR_PRICE    = [0, 8, 9, 11, 13, 15];

// ═══ CZAS AKCJI POLOWYCH (sadzenie/zbiór) ═══
// Bonusy z eq "% speed sadzenia" / "% speed zbioru" skracają je proporcjonalnie (max 80% redukcji).
const BASE_PLANT_MS   = 2000;
const BASE_HARVEST_MS = 2000;

// ═══ BALANS WZROSTU UPRAW (capy bonusów + globalne minimum) ═══
// Każdy bonus mnoży niezależnie. Globalne minimum chroni przed exploit-em multiplikatywności.
// Po zmianie: max teoretyczny stack to -65% czasu wzrostu (globalne min 0.35 = 35% bazowego czasu).
const GROWTH_GLOBAL_MIN_MULT = 0.35; // cap −65% TOTAL (szparagi 12h → min 4h 12min)
const WIEDZA_RATE            = 0.0033; // było 0.005 (lepsze skalowanie do val 100)
const ZARADNOSC_RATE         = 0.004;  // było 0.006 (lepsze skalowanie do val 100)
const WIEDZA_MULT_MIN        = 0.75;   // cap −25% (z Wiedzy)
const HIVE_MULT_MIN          = 0.50;   // cap −50% (faktycznie max −10% przy lvl 5)
const EQUIP_GROWTH_MULT_MIN  = 0.75;   // cap −25% (z eq "% speed upraw")
const COMPOST_MULT_MIN       = 0.80;   // cap −20% (z Kompostu Wzrostu)
const WATER_BONUS_MAX        = 0.30;   // cap +30% (siła bonusu Zaradności + eq wody)
const WATER_MULT_MIN         = 0.70;   // cap −30% (z podlania)
type PendingFieldAction = {
  kind: "plant" | "harvest";
  startMs: number;
  durationMs: number;
  seedId?: string;
  // Snapshot bonusów ekwipunku z chwili KLIKNIĘCIA — chroni przed exploitem
  // przebierania (gracz nie może założyć/zdjąć ciuchów w trakcie timera żeby
  // zmienić wynik akcji). Zbiór: extra harvest / bonus drop / EXP.
  bonusesSnapshot?: {
    extraHarvestPct?: number;
    bonusDropPct?: number;
    expPct?: number;
  };
};

// ═══ EKWIPUNEK POSTACI ═══
type EquipSlot = "dlonie" | "nogi" | "glowa";
interface EquipBonus { base: number; label: string; flat?: boolean; }
interface CharEquipItem {
  id: string; name: string; slot: EquipSlot; icon: string; unlockLevel: number;
  bonuses: EquipBonus[];
}
type CharEquipped = Record<EquipSlot, {id:string;upg:number}|null>;
type BarnAnimalState = { owned:number; slots:number; hunger:number; lastFedAt:number; storage:number; prodStart:number; };
type BarnState = Record<string,BarnAnimalState>;
type BarnItems = Record<string,number>;
interface AnimalItemDef { id:string; name:string; icon:string; sellPrice:number; }
interface AnimalFeedDef { cropId:string; name:string; icon:string; points:number; }
interface AnimalDef { id:string; name:string; icon:string; unlockLevel:number; prodMs:number; itemId:string; storageMax:number; startSlots:number; maxSlots:number; buyPrice:number; slotUpgCosts:number[]; feed:AnimalFeedDef[]; }
// ─── Bazowe koszty ulepszenia (index = poziom docelowy +1..+10) ───
const UPGRADE_COST   = [0,50,100,250,500,1200,2500,5000,10000,20000,40000];
const UPGRADE_CHANCE = [1,0.95,0.90,0.90,0.85,0.80,0.70,0.60,0.45,0.35,0.20];
// ─── Mnożnik ceny zależny od poziomu odblokowania itemu (tier T1..T9) ───
function getItemTierMultiplier(unlockLevel: number): number {
  if (unlockLevel <= 3)  return 1;     // T1
  if (unlockLevel <= 6)  return 1.3;   // T2
  if (unlockLevel <= 9)  return 1.6;   // T3
  if (unlockLevel <= 12) return 2;     // T4
  if (unlockLevel <= 15) return 2.5;   // T5
  if (unlockLevel <= 18) return 3;     // T6
  if (unlockLevel <= 21) return 4;     // T7
  if (unlockLevel <= 25) return 5;     // T8
  return 7;                            // T9 (26-30)
}
// ─── Mnożnik slotu (Głowa = ×1.3, Dłonie/Nogi = ×1) ───
function getSlotMultiplier(slot?: string): number {
  return slot === "glowa" ? 1.3 : 1;
}
function getItemTierLabel(unlockLevel: number): string {
  if (unlockLevel <= 3)  return "T1";
  if (unlockLevel <= 6)  return "T2";
  if (unlockLevel <= 9)  return "T3";
  if (unlockLevel <= 12) return "T4";
  if (unlockLevel <= 15) return "T5";
  if (unlockLevel <= 18) return "T6";
  if (unlockLevel <= 21) return "T7";
  if (unlockLevel <= 25) return "T8";
  return "T9";
}
// Finalny koszt = bazowy × mnożnik tieru × mnożnik slotu (Głowa ×1.3)
function getUpgradeCost(itemId: string, targetUpg: number): number {
  if (targetUpg < 1 || targetUpg > 10) return 0;
  const item = CHAR_EQUIP_ITEMS.find(i => i.id === itemId);
  const tierMult = item ? getItemTierMultiplier(item.unlockLevel) : 1;
  const slotMult = getSlotMultiplier(item?.slot);
  return Math.round(UPGRADE_COST[targetUpg] * tierMult * slotMult);
}
// ─── Aggregator bonusów z założonego ekwipunku (sumuje wszystkie 3 sloty) ───
// Zwraca SUMĘ procentów dla danej etykiety np. "% speed upraw" → 23.5
function getEquipBonusPct(label: string, charEq: Record<string,{id:string;upg:number}|null>): number {
  let total = 0;
  (["dlonie","nogi","glowa"] as const).forEach(slot => {
    const eq = charEq[slot];
    if (!eq) return;
    const item = CHAR_EQUIP_ITEMS.find(i => i.id === eq.id);
    if (!item) return;
    const upg = eq.upg ?? 0;
    item.bonuses.forEach(b => {
      if (b.label === label && !b.flat) {
        total += b.base * (1 + 0.15 * upg);
      }
    });
  });
  return total;
}
// ─── Aggregator FLAT bonusów (np. "+5 pkt Wiedzy") ───
// Zwraca SUMĘ wartości flat dla danej etykiety np. " pkt Wiedzy" → 5
function getEquipFlatBonus(label: string, charEq: Record<string,{id:string;upg:number}|null>): number {
  let total = 0;
  (["dlonie","nogi","glowa"] as const).forEach(slot => {
    const eq = charEq[slot];
    if (!eq) return;
    const item = CHAR_EQUIP_ITEMS.find(i => i.id === eq.id);
    if (!item) return;
    const upg = eq.upg ?? 0;
    item.bonuses.forEach(b => {
      if (b.label === label && b.flat) {
        total += b.base * (1 + 0.15 * upg);
      }
    });
  });
  return total;
}
// ─── Materiały ze zwierząt: M1..M10 → ID przedmiotu zwierzęcego ───
const TIER_MATERIAL: Record<number,string> = {
  1:"jajko", 2:"futro_krolika", 3:"mleko", 4:"piora", 5:"welna",
  6:"nawoz_naturalny", 7:"mleko_kozie", 8:"duze_piora", 9:"energia_robocza", 10:"rogi_byka",
};
// Indeks tieru itemu (1..9) z poziomu odblokowania
function getItemTierIndex(unlockLevel: number): number {
  if (unlockLevel <= 3)  return 1;
  if (unlockLevel <= 6)  return 2;
  if (unlockLevel <= 9)  return 3;
  if (unlockLevel <= 12) return 4;
  if (unlockLevel <= 15) return 5;
  if (unlockLevel <= 18) return 6;
  if (unlockLevel <= 21) return 7;
  if (unlockLevel <= 25) return 8;
  return 9;
}
// Wymagane materiały dla docelowego ulepszenia (+4..+10). +1..+3 = tylko gold.
function getUpgradeMaterials(itemId: string, targetUpg: number): Array<{matId:string; qty:number}> {
  if (targetUpg < 4 || targetUpg > 10) return [];
  const item = CHAR_EQUIP_ITEMS.find(i => i.id === itemId);
  if (!item) return [];
  const tier = getItemTierIndex(item.unlockLevel);
  const current  = TIER_MATERIAL[tier];
  const prev     = tier > 1 ? TIER_MATERIAL[tier-1] : null;
  const prev2    = tier > 2 ? TIER_MATERIAL[tier-2] : null;
  const rareHigh = TIER_MATERIAL[Math.min(tier+1, 10)];
  const out: Array<{matId:string; qty:number}> = [];
  switch (targetUpg) {
    case 4: out.push({matId:current, qty:1}); break;
    case 5: out.push({matId:current, qty:2}); break;
    case 6:
      out.push({matId:current, qty:2});
      if (prev) out.push({matId:prev, qty:1});
      break;
    case 7:
      out.push({matId:current, qty:3});
      if (prev) out.push({matId:prev, qty:2});
      break;
    case 8:
      out.push({matId:current, qty:4});
      if (prev) out.push({matId:prev, qty:2});
      if (prev2) out.push({matId:prev2, qty:1});
      break;
    case 9:
      out.push({matId:current, qty:5});
      if (prev) out.push({matId:prev, qty:3});
      if (prev2) out.push({matId:prev2, qty:2});
      break;
    case 10:
      out.push({matId:current, qty:6});
      if (prev) out.push({matId:prev, qty:4});
      if (rareHigh && rareHigh !== current && (!prev || rareHigh !== prev)) {
        out.push({matId:rareHigh, qty:2});
      }
      break;
  }
  return out;
}
const UPG_COLOR = ["#6b7280","#9ca3af","#9ca3af","#9ca3af","#4ade80","#4ade80","#4ade80","#fbbf24","#fbbf24","#fbbf24","#fbbf24"];
function upgBonusStr(base: number, upg: number, flat?: boolean): string {
  const val = flat ? base + upg : parseFloat((base * (1 + 0.15 * upg)).toFixed(2));
  return val % 1 === 0 ? val.toString() : val.toFixed(2);
}
function bonusLine(bonuses: EquipBonus[], upg: number): string {
  return bonuses.map(b => `+${upgBonusStr(b.base, upg, b.flat)}${b.label}`).join(" · ");
}

// ─── KOMPOST ───
const KOMPOST_PER_REWARD = 10; // ile ładowań = 1 nagroda
const COMPOST_DEFS: Record<CompostType, { id:string; name:string; icon:string; desc:string; effectLabel:string; bonusValues:number[]; bonusLabel:(v:number)=>string; tierName:(v:number)=>string }> = {
  growth: { id:"compost_growth", name:"Kompost Wzrostu",  icon:"⚡", desc:"Przyspiesza wzrost upraw",   effectLabel:"⚡ Szybszy wzrost",   bonusValues:[5,10,15],  bonusLabel:(v)=>`-${v}% czasu wzrostu`, tierName:(v)=>v<=5?"Słaby":v<=10?"Średni":"Mocny" },
  yield:  { id:"compost_yield",  name:"Kompost Urodzaju", icon:"🌾", desc:"Zwiększa plon przy zbiorze", effectLabel:"🌾 Większy plon",     bonusValues:[1,2,3],    bonusLabel:(v)=>`+${v} sztuk plonu`,     tierName:(v)=>v<=1?"Słaby":v<=2?"Średni":"Mocny" },
  exp:    { id:"compost_exp",    name:"Kompost Nauki",    icon:"⭐", desc:"Daje więcej EXP przy zbiorze", effectLabel:"⭐ Więcej EXP",     bonusValues:[10,20,30], bonusLabel:(v)=>`+${v}% EXP`,            tierName:(v)=>v<=10?"Słaby":v<=20?"Średni":"Mocny" },
};
// Wagi losowania tieru: 50% słaby, 35% średni, 15% mocny
const COMPOST_TIER_WEIGHTS = [50, 35, 15];
function isCompostKey(key: string) { return key.startsWith("compost_"); }
function compostTypeFromKey(key: string): CompostType | null {
  if (key.startsWith("compost_growth")) return "growth";
  if (key.startsWith("compost_yield"))  return "yield";
  if (key.startsWith("compost_exp"))    return "exp";
  return null;
}
// Klucz z tierem: "compost_growth_5" → 5, fallback: pierwsza wartość
function compostValueFromKey(key: string): number {
  const t = compostTypeFromKey(key);
  if (!t) return 0;
  const parts = key.split("_");
  const last = parts[parts.length - 1];
  const n = Number(last);
  if (Number.isFinite(n) && COMPOST_DEFS[t].bonusValues.includes(n)) return n;
  return COMPOST_DEFS[t].bonusValues[0];
}
function compostKeyFor(type: CompostType, value: number): string {
  return `${COMPOST_DEFS[type].id}_${value}`;
}
function rollCompostTierIdx(): number {
  const total = COMPOST_TIER_WEIGHTS.reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for (let i = 0; i < COMPOST_TIER_WEIGHTS.length; i++) {
    r -= COMPOST_TIER_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
}

// ─── KOMPOSTOWNIK: SYSTEM SCORE'OWY ───
// Bazowa wartość uprawy do kompostu wg unlockLevel (lvl 1=1.0, +0.2 per lvl, lvl 25=6.0)
const COMPOST_BASE_VALUE_BY_LEVEL: Record<number, number> = {
  1:1.0,  2:1.2,  3:1.4,  4:1.6,  5:1.8,
  6:2.0,  7:2.2,  8:2.4,  9:2.6,  10:2.8,
  11:3.0, 12:3.2, 13:3.4, 14:3.6, 15:3.8,
  16:4.0, 17:4.2, 18:4.4, 19:4.6, 20:4.8,
  21:5.0, 22:5.2, 23:5.4, 24:5.6, 25:6.0,
};
// Mnożnik rzadkości plonu
const COMPOST_RARITY_MULT: Record<"rotten"|"good"|"epic"|"legendary", number> = {
  rotten:    0.25,
  good:      1.00,
  epic:      2.50,
  legendary: 5.00,
};
type CompostQuality = "very_weak" | "weak" | "medium" | "good" | "very_good" | "legendary";
// Klasy jakości kompostu (sortowane od najwyższej do najniższej żeby `>= min` działało)
const COMPOST_QUALITY_DEFS: { id: CompostQuality; min: number; label: string; color: string; border: string }[] = [
  { id:"legendary",  min:15.0, label:"Legendarny",   color:"#fbbf24", border:"#f59e0b" },
  { id:"very_good",  min:9.0,  label:"Bardzo dobry", color:"#a78bfa", border:"#8b5cf6" },
  { id:"good",       min:5.0,  label:"Dobry",        color:"#6ee7b7", border:"#10b981" },
  { id:"medium",     min:2.5,  label:"Średni",       color:"#dfcfab", border:"#a8a29e" },
  { id:"weak",       min:1.0,  label:"Słaby",        color:"#fca5a5", border:"#f87171" },
  { id:"very_weak",  min:0,    label:"Bardzo słaby", color:"#94a3b8", border:"#64748b" },
];
// Tabela szans na tier itemu (5 kolumn: I1=lvl1-5, I2=lvl6-10, I3=lvl11-15, I4=lvl16-20, I5=lvl21-25)
// Sumy w wierszach = 100
const ITEM_TIER_BY_QUALITY: Record<CompostQuality, [number,number,number,number,number]> = {
  very_weak: [90, 10,  0,  0,  0],
  weak:      [70, 25,  5,  0,  0],
  medium:    [45, 35, 17,  3,  0],
  good:      [20, 35, 30, 12,  3],
  very_good: [ 5, 15, 35, 30, 15],
  legendary: [ 0,  5, 20, 40, 35],
};
// Siła kompostu growth/yield/exp wg jakości partii — DETERMINISTYCZNA (0=Słaby, 1=Średni, 2=Mocny)
// Bardzo słaby/Słaby → Słaby (5%/+1/+10%); Średni/Dobry → Średni (10%/+2/+20%); Bardzo dobry/Legendarny → Mocny (15%/+3/+30%)
const COMPOST_TIER_FIXED_BY_QUALITY: Record<CompostQuality, number> = {
  very_weak: 0,
  weak:      0,
  medium:    1,
  good:      1,
  very_good: 2,
  legendary: 2,
};
type CompostBatch = { fill: number; scoreSum: number };
const KOMPOST_MAX_BATCHES = 10;

function getCompostQualityFromScore(score: number): CompostQuality {
  for (const def of COMPOST_QUALITY_DEFS) {
    if (score >= def.min) return def.id;
  }
  return "very_weak";
}
function getCompostQualityDef(quality: CompostQuality) {
  return COMPOST_QUALITY_DEFS.find(d => d.id === quality)!;
}
function rollFromChances(chances: number[]): number {
  let r = Math.random() * 100;
  for (let i = 0; i < chances.length; i++) {
    r -= chances[i];
    if (r < 0) return i;
  }
  return 0;
}

const CHAR_EQUIP_ITEMS: CharEquipItem[] = [
  // ─── DŁONIE (LVL 1–25, jeden per poziom) ───
  { id:"d1",  name:"Spracowane Rękawice",     slot:"dlonie", icon:"🧤", unlockLevel:1,  bonuses:[{base:1,  label:"% speed zbioru"}] },
  { id:"d2",  name:"Rękawice Siewcy",         slot:"dlonie", icon:"🧤", unlockLevel:2,  bonuses:[{base:1,  label:"% speed sadzenia"}] },
  { id:"d3",  name:"Rękawice Rolnika",        slot:"dlonie", icon:"🧤", unlockLevel:3,  bonuses:[{base:2,  label:"% speed zbioru"}] },
  { id:"d4",  name:"Grabie Ogrodnika",        slot:"dlonie", icon:"🌿", unlockLevel:4,  bonuses:[{base:1,  label:"% speed upraw"}] },
  { id:"d5",  name:"Rękawice Ziemi",          slot:"dlonie", icon:"🧤", unlockLevel:5,  bonuses:[{base:2,  label:"% efekt kompostu"}] },
  { id:"d6",  name:"Łopata Polowa",           slot:"dlonie", icon:"🌿", unlockLevel:6,  bonuses:[{base:2,  label:"% speed sadzenia"}] },
  { id:"d7",  name:"Rękawice Urodzaju",       slot:"dlonie", icon:"🧤", unlockLevel:7,  bonuses:[{base:1,  label:"% extra harvest"}] },
  { id:"d8",  name:"Kosz Zbieracza",          slot:"dlonie", icon:"🧺", unlockLevel:8,  bonuses:[{base:2,  label:"% speed zbioru"}] },
  { id:"d9",  name:"Motyka Rolna",            slot:"dlonie", icon:"⛏️", unlockLevel:9,  bonuses:[{base:2,  label:"% speed upraw"}] },
  { id:"d10", name:"Sekator Sadu",            slot:"dlonie", icon:"✂️", unlockLevel:10, bonuses:[{base:3,  label:"% speed drzew"}] },
  { id:"d11", name:"Rękawice Farmera",        slot:"dlonie", icon:"🧤", unlockLevel:11, bonuses:[{base:2,  label:"% EXP z upraw"}] },
  { id:"d12", name:"Rękawice Zbiorów",        slot:"dlonie", icon:"🧤", unlockLevel:12, bonuses:[{base:1,  label:"% extra harvest"}] },
  { id:"d13", name:"Narzędzia Sadownika",     slot:"dlonie", icon:"🔧", unlockLevel:13, bonuses:[{base:4,  label:"% speed drzew"}] },
  { id:"d14", name:"Rękawice Nawadniania",    slot:"dlonie", icon:"🧤", unlockLevel:14, bonuses:[{base:3,  label:"% efekt wody"}] },
  { id:"d15", name:"Rękawice Hodowcy",        slot:"dlonie", icon:"🧤", unlockLevel:15, bonuses:[{base:3,  label:"% reward zwierząt"}] },
  { id:"d16", name:"Srebrny Sekator",         slot:"dlonie", icon:"✂️", unlockLevel:16, bonuses:[{base:5,  label:"% speed drzew"}] },
  { id:"d17", name:"Rękawice Plonów",         slot:"dlonie", icon:"🧤", unlockLevel:17, bonuses:[{base:2,  label:"% extra harvest"}] },
  { id:"d18", name:"Widły Farmera",           slot:"dlonie", icon:"🌿", unlockLevel:18, bonuses:[{base:4,  label:"% EXP z upraw"}] },
  { id:"d19", name:"Narzędzia Mistrza",       slot:"dlonie", icon:"🔧", unlockLevel:19, bonuses:[{base:3,  label:"% speed zbioru"}] },
  { id:"d20", name:"Rękawice Pszczelarza",    slot:"dlonie", icon:"🐝", unlockLevel:20, bonuses:[{base:20, label:"% zużycia stroju"}] },
  { id:"d21", name:"Motyka Obfitości",        slot:"dlonie", icon:"⛏️", unlockLevel:21, bonuses:[{base:2,  label:"% extra harvest"}] },
  { id:"d22", name:"Rękawice Żniwiarza",      slot:"dlonie", icon:"🧤", unlockLevel:22, bonuses:[{base:4,  label:"% speed zbioru"}] },
  { id:"d23", name:"Sekator Premium",         slot:"dlonie", icon:"✂️", unlockLevel:23, bonuses:[{base:6,  label:"% speed drzew"}] },
  { id:"d24", name:"Rękawice Natury",         slot:"dlonie", icon:"🧤", unlockLevel:24, bonuses:[{base:3,  label:"% speed upraw"}] },
  { id:"d25", name:"Mistyczne Dłonie Farmy",  slot:"dlonie", icon:"✨", unlockLevel:25, bonuses:[{base:3, label:"% speed zbioru"},{base:2,label:"% extra harvest"}] },
  // ─── NOGI (LVL 1–30) ───
  { id:"n1",  name:"Stare Kalosze",           slot:"nogi", icon:"👢", unlockLevel:1,  bonuses:[{base:2,  label:"% speed upraw"}] },
  { id:"n2",  name:"Kalosze Rolnika",         slot:"nogi", icon:"👢", unlockLevel:3,  bonuses:[{base:3,  label:"% speed upraw"}] },
  { id:"n3",  name:"Buty Polowe",             slot:"nogi", icon:"👢", unlockLevel:6,  bonuses:[{base:5,  label:"% efekt podlewania"}] },
  { id:"n4",  name:"Buty Zbieracza",          slot:"nogi", icon:"👢", unlockLevel:9,  bonuses:[{base:4,  label:"% speed zbioru"}] },
  { id:"n5",  name:"Buty Błotne",             slot:"nogi", icon:"👢", unlockLevel:12, bonuses:[{base:8,  label:"% efekt podlewania"}] },
  { id:"n6",  name:"Ostrogi Hodowcy",         slot:"nogi", icon:"⚡", unlockLevel:15, bonuses:[{base:6,  label:"% reward zwierząt"}] },
  { id:"n7",  name:"Szybkie Kalosze",         slot:"nogi", icon:"👢", unlockLevel:18, bonuses:[{base:6,  label:"% speed upraw"}] },
  { id:"n8",  name:"Buty Sadownika",          slot:"nogi", icon:"🥾", unlockLevel:21, bonuses:[{base:8,  label:"% speed drzew"}] },
  { id:"n9",  name:"Buty Zaradności",         slot:"nogi", icon:"👢", unlockLevel:24, bonuses:[{base:10, label:"% efekt podlewania"}] },
  { id:"n10", name:"Buty Burzy",              slot:"nogi", icon:"⚡", unlockLevel:27, bonuses:[{base:8, label:"% speed upraw"},{base:4,label:"% speed zbioru"}] },
  { id:"n11", name:"Legendarne Kalosze",      slot:"nogi", icon:"👑", unlockLevel:30, bonuses:[{base:10, label:"% speed upraw"}] },
  // ─── GŁOWA (LVL 1–30) ───
  { id:"g1",  name:"Słomkowy Kapelusz",       slot:"glowa", icon:"👒", unlockLevel:1,  bonuses:[{base:5,  label:"% EXP z upraw"}] },
  { id:"g2",  name:"Kapelusz Rolnika",        slot:"glowa", icon:"👒", unlockLevel:5,  bonuses:[{base:5,  label:"% EXP z upraw"},{base:3,label:"% speed upraw"}] },
  { id:"g3",  name:"Kapelusz Pszczelarza",    slot:"glowa", icon:"🐝", unlockLevel:10, bonuses:[{base:10, label:"% produkcji miodu"},{base:5,label:"% speed upraw"}] },
  { id:"g4",  name:"Czapka Szczęścia",        slot:"glowa", icon:"🍀", unlockLevel:15, bonuses:[{base:5, label:"% bonus drop"},{base:3,label:"% extra harvest"},{base:5,label:"% EXP"}] },
  { id:"g5",  name:"Korona Sadownika",        slot:"glowa", icon:"👑", unlockLevel:20, bonuses:[{base:10,label:"% speed drzew"},{base:5,label:"% reward zwierząt"},{base:5,label:"% speed upraw"}] },
  { id:"g6",  name:"Kapelusz Mistrza Farmy",  slot:"glowa", icon:"🎓", unlockLevel:25, bonuses:[{base:5,label:" pkt Wiedzy",flat:true},{base:10,label:"% EXP"},{base:5,label:"% speed upraw"},{base:3,label:"% extra harvest"}] },
  { id:"g7",  name:"Korona Plonopolis",       slot:"glowa", icon:"👑", unlockLevel:30, bonuses:[{base:8,label:"% speed upraw"},{base:8,label:"% speed drzew"},{base:8,label:"% reward zwierząt"},{base:5,label:"% extra harvest"}] },
];
const EQUIP_SLOT_META: Record<EquipSlot,{label:string;icon:string;desc:string}> = {
  dlonie: { label:"Dłonie", icon:"🧤", desc:"Rękawice, narzędzia, przedmioty robocze" },
  nogi:   { label:"Nogi",   icon:"👢", desc:"Tempo i szybkość gry" },
  glowa:  { label:"Głowa",  icon:"🪖", desc:"Strategia i inteligencja" },
};
const DEFAULT_CHAR_EQUIPPED: CharEquipped = { dlonie:null, nogi:null, glowa:null };
function migrateCharEquipped(raw: unknown): CharEquipped {
  const def = { ...DEFAULT_CHAR_EQUIPPED };
  if (!raw || typeof raw !== "object") return def;
  const r = raw as Record<string,unknown>;
  const parseSlot = (v: unknown): {id:string;upg:number}|null => {
    if (!v) return null;
    if (typeof v === "string") return { id: v, upg: 0 }; // stary format
    if (typeof v === "object" && v !== null && "id" in v) return { id: (v as {id:string;upg:number}).id, upg: (v as {id:string;upg:number}).upg ?? 0 };
    return null;
  };
  return { dlonie: parseSlot(r.dlonie), nogi: parseSlot(r.nogi), glowa: parseSlot(r.glowa) };
}
const CHAR_EQUIP_KEY = "plonopolis_char_equipped";
const ITEM_UPG_KEY   = "plonopolis_item_upg_reg";
const OWNED_EQ_KEY   = "plonopolis_owned_eq";
const EXTRA_EQ_KEY   = "plonopolis_extra_eq";
const KOMPOST_KEY    = "plonopolis_kompost_charges";
const KOMPOST_BATCHES_KEY = "plonopolis_kompost_batches";
const SLOT_BOX_KEY   = "plonopolis_slot_box";
const DEFAULT_SLOT_BOX: Record<string,{top:number,left:number,width:number,height:number}> = {
  glowa:  { top:32, left:7.5, width:22.5, height:31 },
  dlonie: { top:32, left:39, width:22, height:31 },
  nogi:   { top:32, left:70, width:22, height:31 },
};
const BARN_STATE_KEY = "plonopolis_barn";
const BARN_ITEMS_KEY = "plonopolis_barn_items";
const HUNGER_DECAY_PER_MS = 3 / (60 * 60 * 1000); // 3 pkt/h → 0 po ~33h
function barnSlotCosts(buyPrice: number, upgrades: number): number[] {
  const r: number[] = []; let c = Math.round(buyPrice * 0.17);
  for (let i = 0; i < upgrades; i++) { r.push(c); c = Math.round(c * 1.6); } return r;
}
const ANIMAL_ITEMS: AnimalItemDef[] = [
  { id:"jajko",           name:"Jajko",           icon:"🥚", sellPrice:40   },
  { id:"futro_krolika",   name:"Futro Królika",    icon:"🐇", sellPrice:80   },
  { id:"mleko",           name:"Mleko",            icon:"🥛", sellPrice:140  },
  { id:"piora",           name:"Pióra",            icon:"🪶", sellPrice:220  },
  { id:"welna",           name:"Wełna",            icon:"🧶", sellPrice:320  },
  { id:"nawoz_naturalny", name:"Nawóz Naturalny",  icon:"💩", sellPrice:450  },
  { id:"mleko_kozie",     name:"Mleko Kozie",      icon:"🥛", sellPrice:650  },
  { id:"duze_piora",      name:"Duże Pióra",       icon:"🪶", sellPrice:900  },
  { id:"energia_robocza", name:"Energia Robocza",  icon:"⚡", sellPrice:1400 },
  { id:"rogi_byka",       name:"Rogi Byka",        icon:"🦴", sellPrice:2500 },
];
const ANIMALS: AnimalDef[] = [
  { id:"kura",   name:"Kura",    icon:"🐔", unlockLevel:3,  prodMs:4*3600000,  itemId:"jajko",           storageMax:6, startSlots:2, maxSlots:12, buyPrice:600,
    slotUpgCosts:[100,160,260,420,670,1070,1710,2740,4380,7000],
    feed:[{cropId:"carrot",name:"Marchew",icon:"🥕",points:10},{cropId:"potato",name:"Ziemniak",icon:"🥔",points:15}] },
  { id:"krolik", name:"Królik",  icon:"🐇", unlockLevel:5,  prodMs:8*3600000,  itemId:"futro_krolika",   storageMax:5, startSlots:2, maxSlots:10, buyPrice:1800,
    slotUpgCosts:barnSlotCosts(1800,8),
    feed:[{cropId:"carrot",name:"Marchew",icon:"🥕",points:12},{cropId:"lettuce",name:"Sałata",icon:"🥬",points:18}] },
  { id:"krowa",  name:"Krowa",   icon:"🐄", unlockLevel:7,  prodMs:12*3600000, itemId:"mleko",           storageMax:4, startSlots:1, maxSlots:8,  buyPrice:4500,
    slotUpgCosts:barnSlotCosts(4500,7),
    feed:[{cropId:"lettuce",name:"Sałata",icon:"🥬",points:15},{cropId:"rapeseed",name:"Rzepak",icon:"🌾",points:30}] },
  { id:"kaczka", name:"Kaczka",  icon:"🦆", unlockLevel:9,  prodMs:16*3600000, itemId:"piora",           storageMax:4, startSlots:1, maxSlots:8,  buyPrice:9000,
    slotUpgCosts:barnSlotCosts(9000,7),
    feed:[{cropId:"radish",name:"Rzodkiewka",icon:"🌱",points:15},{cropId:"sunflower",name:"Słonecznik",icon:"🌻",points:35}] },
  { id:"owca",   name:"Owca",    icon:"🐑", unlockLevel:11, prodMs:20*3600000, itemId:"welna",           storageMax:3, startSlots:1, maxSlots:6,  buyPrice:18000,
    slotUpgCosts:barnSlotCosts(18000,5),
    feed:[{cropId:"cabbage",name:"Kapusta",icon:"🥦",points:20},{cropId:"rapeseed",name:"Rzepak",icon:"🌾",points:35}] },
  { id:"swinia", name:"Świnia",  icon:"🐖", unlockLevel:13, prodMs:24*3600000, itemId:"nawoz_naturalny", storageMax:3, startSlots:1, maxSlots:5,  buyPrice:35000,
    slotUpgCosts:barnSlotCosts(35000,4),
    feed:[{cropId:"tomato",name:"Pomidor",icon:"🍅",points:20},{cropId:"pumpkin",name:"Dynia",icon:"🎃",points:40}] },
  { id:"koza",   name:"Koza",    icon:"🐐", unlockLevel:15, prodMs:30*3600000, itemId:"mleko_kozie",     storageMax:2, startSlots:1, maxSlots:4,  buyPrice:65000,
    slotUpgCosts:barnSlotCosts(65000,3),
    feed:[{cropId:"grape",name:"Winogrono",icon:"🍇",points:40},{cropId:"asparagus",name:"Szparagi",icon:"🌿",points:60}] },
  { id:"indyk",  name:"Indyk",   icon:"🦃", unlockLevel:17, prodMs:36*3600000, itemId:"duze_piora",      storageMax:2, startSlots:1, maxSlots:4,  buyPrice:120000,
    slotUpgCosts:barnSlotCosts(120000,3),
    feed:[{cropId:"sunflower",name:"Słonecznik",icon:"🌻",points:35},{cropId:"chili",name:"Papryczka chili",icon:"🌶️",points:50}] },
  { id:"kon",    name:"Koń",     icon:"🐎", unlockLevel:20, prodMs:48*3600000, itemId:"energia_robocza", storageMax:2, startSlots:1, maxSlots:3,  buyPrice:250000,
    slotUpgCosts:barnSlotCosts(250000,2),
    feed:[{cropId:"rapeseed",name:"Rzepak",icon:"🌾",points:50},{cropId:"asparagus",name:"Szparagi",icon:"🌿",points:70}] },
  { id:"byk",    name:"Byk",     icon:"🐂", unlockLevel:25, prodMs:72*3600000, itemId:"rogi_byka",       storageMax:1, startSlots:1, maxSlots:2,  buyPrice:600000,
    slotUpgCosts:[25000],
    feed:[{cropId:"pumpkin",name:"Dynia",icon:"🎃",points:50},{cropId:"asparagus",name:"Szparagi",icon:"🌿",points:80}] },
];
function defaultBarnState(): BarnState {
  const s: BarnState = {};
  ANIMALS.forEach(a => { s[a.id] = { owned:0, slots:a.startSlots, hunger:80, lastFedAt:0, storage:0, prodStart:0 }; });
  return s;
}

// ═══════════════════════════════════════════════════════════════════════
// SAD — drzewa owocowe (cykliczna produkcja owoców z lossowaną jakością)
// ═══════════════════════════════════════════════════════════════════════
type FruitQuality = "zwykly" | "soczysty" | "zloty";
const FRUIT_QUALITY_DEFS: Record<FruitQuality, { label:string; mult:number; color:string; icon:string; baseChance:number }> = {
  zwykly:   { label:"Zwykły",   mult:1, color:"#86efac", icon:"",   baseChance:0.85 },
  soczysty: { label:"Soczysty", mult:2, color:"#22d3ee", icon:"💧", baseChance:0.12 },
  zloty:    { label:"Złoty",    mult:5, color:"#fde047", icon:"✨", baseChance:0.03 },
};
// luckPct = bonus % (np. ze skilla Szczęście + eq "% bonus drop")
function rollFruitQuality(luckPct: number = 0): FruitQuality {
  const r = Math.random();
  const lf = 1 + Math.max(0, luckPct) / 100;
  const zlotyChance    = Math.min(0.50, FRUIT_QUALITY_DEFS.zloty.baseChance * lf);
  const soczystyChance = Math.min(0.60, FRUIT_QUALITY_DEFS.soczysty.baseChance * lf);
  if (r < zlotyChance) return "zloty";
  if (r < zlotyChance + soczystyChance) return "soczysty";
  return "zwykly";
}
interface TreeDef {
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
const TREES: TreeDef[] = [
  { id:"jablon",      name:"Jabłoń",      icon:"🍎", unlockLevel:10, fruitId:"jablko",       fruitName:"Jabłko",       fruitIcon:"🍎", growthTimeMs: 4*3600000, dropMin:10, dropMax:14, pricePerFruit:20,  buyPrice:   4500 },
  { id:"grusza",      name:"Grusza",      icon:"🍐", unlockLevel:12, fruitId:"gruszka",      fruitName:"Gruszka",      fruitIcon:"🍐", growthTimeMs: 6*3600000, dropMin: 9, dropMax:12, pricePerFruit:35,  buyPrice:   9000 },
  { id:"sliwa",       name:"Śliwa",       icon:"🟣", unlockLevel:14, fruitId:"sliwka",       fruitName:"Śliwka",       fruitIcon:"🟣", growthTimeMs: 8*3600000, dropMin: 8, dropMax:10, pricePerFruit:55,  buyPrice:  18000 },
  { id:"wisnia",      name:"Wiśnia",      icon:"🍒", unlockLevel:16, fruitId:"wisnia",       fruitName:"Wiśnia",       fruitIcon:"🍒", growthTimeMs:10*3600000, dropMin: 7, dropMax: 9, pricePerFruit:80,  buyPrice:  35000 },
  { id:"czeresnia",   name:"Czereśnia",   icon:"🍒", unlockLevel:18, fruitId:"czeresnia",    fruitName:"Czereśnia",    fruitIcon:"🍒", growthTimeMs:12*3600000, dropMin: 6, dropMax: 8, pricePerFruit:110, buyPrice:  60000 },
  { id:"brzoskwinia", name:"Brzoskwinia", icon:"🍑", unlockLevel:20, fruitId:"brzoskwinia",  fruitName:"Brzoskwinia",  fruitIcon:"🍑", growthTimeMs:14*3600000, dropMin: 5, dropMax: 7, pricePerFruit:150, buyPrice: 100000 },
  { id:"morela",      name:"Morela",      icon:"🟠", unlockLevel:22, fruitId:"morela",       fruitName:"Morela",       fruitIcon:"🟠", growthTimeMs:16*3600000, dropMin: 4, dropMax: 6, pricePerFruit:220, buyPrice: 170000 },
  { id:"pomarancza",  name:"Pomarańcza",  icon:"🍊", unlockLevel:23, fruitId:"pomarancza",   fruitName:"Pomarańcza",   fruitIcon:"🍊", growthTimeMs:18*3600000, dropMin: 3, dropMax: 5, pricePerFruit:320, buyPrice: 260000 },
  { id:"cytryna",     name:"Cytryna",     icon:"🍋", unlockLevel:25, fruitId:"cytryna",      fruitName:"Cytryna",      fruitIcon:"🍋", growthTimeMs:24*3600000, dropMin: 2, dropMax: 4, pricePerFruit:500, buyPrice: 450000 },
];
// Limit drzew = funkcja LVL gracza
function getMaxTreeSlots(level: number): number {
  if (level >= 25) return 8;
  if (level >= 20) return 6;
  if (level >= 15) return 4;
  if (level >= 10) return 2;
  return 0;
}
const ORCHARD_STATE_KEY = "plonopolis_orchard";
type OrchardTreeState = { owned:number; prodStart:number; storage: Record<FruitQuality, number> };
type OrchardState = Record<string, OrchardTreeState>;
function defaultOrchardState(): OrchardState {
  const s: OrchardState = {};
  TREES.forEach(t => { s[t.id] = { owned:0, prodStart:0, storage:{ zwykly:0, soczysty:0, zloty:0 } }; });
  return s;
}
function migrateOrchardState(raw: unknown): OrchardState {
  const def = defaultOrchardState();
  if (!raw || typeof raw !== "object") return def;
  const r = raw as Record<string, unknown>;
  TREES.forEach(t => {
    const v = r[t.id];
    if (!v || typeof v !== "object") return;
    const s = v as { owned?:number; prodStart?:number; storage?:Record<string,number> };
    def[t.id] = {
      owned: typeof s.owned === "number" ? s.owned : 0,
      prodStart: typeof s.prodStart === "number" ? s.prodStart : 0,
      storage: {
        zwykly:   typeof s.storage?.zwykly   === "number" ? s.storage.zwykly   : 0,
        soczysty: typeof s.storage?.soczysty === "number" ? s.storage.soczysty : 0,
        zloty:    typeof s.storage?.zloty    === "number" ? s.storage.zloty    : 0,
      },
    };
  });
  return def;
}
// Łączna liczba drzew w sadzie (sumarycznie ze wszystkich gatunków)
function getOrchardTotalOwned(state: OrchardState): number {
  return TREES.reduce((s, t) => s + (state[t.id]?.owned ?? 0), 0);
}
function barnCurrentHunger(st: BarnAnimalState, opiekaPts: number = 0): number {
  if (!st.lastFedAt) return 50;
  const reduction = Math.min(0.90, opiekaPts * 0.003); // -0.3%/pkt, max -90%
  const decayRate = HUNGER_DECAY_PER_MS * (1 - reduction);
  return Math.max(0, Math.min(100, st.hunger - (Date.now() - st.lastFedAt) * decayRate));
}
function barnHungerStatus(h: number): { label:string; color:string; speedMod:number } {
  if (h >= 80) return { label:"Najedzone 😊", color:"#4ade80", speedMod:-0.10 };
  if (h >= 50) return { label:"Normalne",     color:"#f9e7b2", speedMod:0     };
  if (h >= 20) return { label:"Głodne 😟",    color:"#fbbf24", speedMod:0.10  };
  return               { label:"Wygłodzone 😵",color:"#ef4444", speedMod:0.20  };
}
function barnEffProdMs(a: AnimalDef, h: number): number {
  return Math.round(a.prodMs * (1 + barnHungerStatus(h).speedMod));
}
function barnFmtMs(ms: number): string {
  if (ms <= 0) return "Gotowe!";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function calcStatEffect(val: number, rate: number): number {
  const eff = val <= 50 ? val : 50 + (val - 50) * 0.5;
  return Math.round(eff * rate * 1000) / 10;
}
function getStatUpgradeCost(targetLv: number): number {
  const T: [number,number][] = [[1,25],[5,45],[10,78],[20,960],[30,3000],[40,9400],[50,29000],[60,88000],[70,260000],[80,750000],[90,2100000],[100,6000000]];
  if (targetLv <= 1) return 25;
  if (targetLv >= 100) return 6000000;
  for (let i=1;i<T.length;i++){
    if (targetLv<=T[i][0]){const t=(targetLv-T[i-1][0])/(T[i][0]-T[i-1][0]);return Math.round(T[i-1][1]+t*(T[i][1]-T[i-1][1]));}
  }
  return 6000000;
}
function loadAvatarDataLS(userId: string): { skin: number; stats: PlayerStatsMap; fsp: number; prevLevel: number } {
  const skin = parseInt(localStorage.getItem(`plonopolis_skin_${userId}`) ?? "-1");
  const statsRaw = localStorage.getItem(`plonopolis_stats_${userId}`);
  const stats: PlayerStatsMap = statsRaw ? JSON.parse(statsRaw) : { ...DEFAULT_STATS };
  const fspRaw = localStorage.getItem(`plonopolis_fsp_${userId}`);
  const fsp = fspRaw !== null ? parseInt(fspRaw) : 3;
  const prevLevel = parseInt(localStorage.getItem(`plonopolis_prevlv_${userId}`) ?? "0");
  return { skin, stats, fsp, prevLevel };
}
function saveAvatarDataLS(userId: string, skin: number, stats: PlayerStatsMap, fsp: number, prevLevel: number) {
  localStorage.setItem(`plonopolis_skin_${userId}`, String(skin));
  localStorage.setItem(`plonopolis_stats_${userId}`, JSON.stringify(stats));
  localStorage.setItem(`plonopolis_fsp_${userId}`, String(fsp));
  localStorage.setItem(`plonopolis_prevlv_${userId}`, String(prevLevel));
}
function saveHouseData(userId: string, slots: number, eq: string[]) {
  localStorage.setItem(`plonopolis_eqslots_${userId}`, String(slots));
  localStorage.setItem(`plonopolis_eq_${userId}`, JSON.stringify(eq));
  void supabase.rpc("game_save_house_data", { p_equipment_slots: slots, p_equipment: eq as unknown as Record<string,unknown> });
}
function saveAvatarData(userId: string, skin: number, stats: PlayerStatsMap, fsp: number, prevLevel: number) {
  saveAvatarDataLS(userId, skin, stats, fsp, prevLevel);
  void supabase.rpc("game_save_avatar_data", {
    p_avatar_skin: skin,
    p_player_stats: stats as Record<string, number>,
    p_free_skill_points: fsp,
    p_prev_level: prevLevel,
  });
}

const CROPS: Crop[] = [
  {
    id: "test_nasiono",
    name: "Test Nasiono",
    unlockLevel: 1,
    growthTimeMs: 10_000,
    yieldAmount: 2,
    expReward: 1,
    spritePath: "/carrot_icon_transparent.png",
  },
  {
    id: "carrot",
    name: "Marchew",
    unlockLevel: 1,
    growthTimeMs: 3 * 60_000,
    yieldAmount: 2,
    expReward: 6,
    spritePath: "/carrot_icon_transparent.png",
    epicSpritePath: "/carrot_epic.png",
    rottenSpritePath: "/carrot_rotten.png",
    legendarySpritePath: "/carrot_legendary.png",
  },
  {
    id: "potato",
    name: "Ziemniak",
    unlockLevel: 2,
    growthTimeMs: 4 * 60_000,
    yieldAmount: 2,
    expReward: 8,
    spritePath: "/potato.png",
    epicSpritePath: "/potato_epic.png",
    rottenSpritePath: "/potato_rotten.png",
    legendarySpritePath: "/potato_legendary.png",
  },
  {
    id: "tomato",
    name: "Pomidor",
    unlockLevel: 3,
    growthTimeMs: 5 * 60_000,
    yieldAmount: 2,
    expReward: 10,
    spritePath: "/tomato.png",
    epicSpritePath: "/tomato_epic.png",
    rottenSpritePath: "/tomato_rotten.png",
    legendarySpritePath: "/tomato_legendary.png",
  },
  {
    id: "cucumber",
    name: "Ogórek",
    unlockLevel: 4,
    growthTimeMs: 7 * 60_000,
    yieldAmount: 2,
    expReward: 14,
    spritePath: "/cucumber.png",
    epicSpritePath: "/cucumber_epic.png",
    rottenSpritePath: "/cucumber_rotten.png",
    legendarySpritePath: "/cucumber_legendary.png",
  },
  {
    id: "onion",
    name: "Cebula",
    unlockLevel: 5,
    growthTimeMs: 10 * 60_000,
    yieldAmount: 2,
    expReward: 20,
    spritePath: "/onion.png",
    epicSpritePath: "/onion_epic.png",
    rottenSpritePath: "/onion_rotten.png",
    legendarySpritePath: "/onion_legendary.png",
  },
  {
    id: "garlic",
    name: "Czosnek",
    unlockLevel: 6,
    growthTimeMs: 14 * 60_000,
    yieldAmount: 2,
    expReward: 28,
    spritePath: "/garlic.png",
    epicSpritePath: "/garlic_epic.png",
    rottenSpritePath: "/garlic_rotten.png",
    legendarySpritePath: "/garlic_legendary.png",
  },
  {
    id: "lettuce",
    name: "Sałata",
    unlockLevel: 7,
    growthTimeMs: 18 * 60_000,
    yieldAmount: 3,
    expReward: 36,
    spritePath: "/lettuce.png",
    epicSpritePath: "/lettuce_epic.png",
    rottenSpritePath: "/lettuce_rotten.png",
    legendarySpritePath: "/lettuce_legendary.png",
  },
  {
    id: "radish",
    name: "Rzodkiewka",
    unlockLevel: 8,
    growthTimeMs: 24 * 60_000,
    yieldAmount: 3,
    expReward: 48,
    spritePath: "/radish.png",
    epicSpritePath: "/radish_epic.png",
    rottenSpritePath: "/radish_rotten.png",
    legendarySpritePath: "/radish_legendary.png",
  },
  {
    id: "beet",
    name: "Burak",
    unlockLevel: 9,
    growthTimeMs: 32 * 60_000,
    yieldAmount: 3,
    expReward: 64,
    spritePath: "/beet.png",
    epicSpritePath: "/beet_epic.png",
    rottenSpritePath: "/beet_rotten.png",
    legendarySpritePath: "/beet_legendary.png",
  },
  {
    id: "pepper",
    name: "Papryka",
    unlockLevel: 10,
    growthTimeMs: 42 * 60_000,
    yieldAmount: 3,
    expReward: 84,
    spritePath: "/pepper.png",
    epicSpritePath: "/pepper_epic.png",
    rottenSpritePath: "/pepper_rotten.png",
    legendarySpritePath: "/pepper_legendary.png",
  },
  {
    id: "cabbage",
    name: "Kapusta",
    unlockLevel: 11,
    growthTimeMs: 55 * 60_000,
    yieldAmount: 3,
    expReward: 110,
    spritePath: "/cabbage.png",
    epicSpritePath: "/cabbage_epic.png",
    rottenSpritePath: "/cabbage_rotten.png",
    legendarySpritePath: "/cabbage_legendary.png",
  },
  {
    id: "broccoli",
    name: "Brokuł",
    unlockLevel: 12,
    growthTimeMs: 72 * 60_000,
    yieldAmount: 3,
    expReward: 144,
    spritePath: "/broccoli.png",
    epicSpritePath: "/broccoli_epic.png",
    rottenSpritePath: "/broccoli_rotten.png",
    legendarySpritePath: "/broccoli_legendary.png",
  },
  {
    id: "cauliflower",
    name: "Kalafior",
    unlockLevel: 13,
    growthTimeMs: 95 * 60_000,
    yieldAmount: 3,
    expReward: 190,
    spritePath: "/cauliflower.png",
    epicSpritePath: "/cauliflower_epic.png",
    rottenSpritePath: "/cauliflower_rotten.png",
    legendarySpritePath: "/cauliflower_legendary.png",
  },
  {
    id: "strawberry",
    name: "Truskawka",
    unlockLevel: 14,
    growthTimeMs: 125 * 60_000,
    yieldAmount: 3,
    expReward: 250,
    spritePath: "/strawberry.png",
    epicSpritePath: "/strawberry_epic.png",
    rottenSpritePath: "/strawberry_rotten.png",
    legendarySpritePath: "/strawberry_legendary.png",
  },
  {
    id: "raspberry",
    name: "Malina",
    unlockLevel: 15,
    growthTimeMs: 165 * 60_000,
    yieldAmount: 3,
    expReward: 330,
    spritePath: "/raspberry.png",
    epicSpritePath: "/raspberry_epic.png",
    rottenSpritePath: "/raspberry_rotten.png",
    legendarySpritePath: "/raspberry_legendary.png",
  },
  {
    id: "blueberry",
    name: "Borówka",
    unlockLevel: 16,
    growthTimeMs: 215 * 60_000,
    yieldAmount: 3,
    expReward: 430,
    spritePath: "/blueberry.png",
    epicSpritePath: "/blueberry_epic.png",
    rottenSpritePath: "/blueberry_rotten.png",
    legendarySpritePath: "/blueberry_legendary.png",
  },
  {
    id: "eggplant",
    name: "Bakłażan",
    unlockLevel: 17,
    growthTimeMs: 280 * 60_000,
    yieldAmount: 3,
    expReward: 560,
    spritePath: "/eggplant.png",
    epicSpritePath: "/eggplant_epic.png",
    rottenSpritePath: "/eggplant_rotten.png",
    legendarySpritePath: "/eggplant_legendary.png",
  },
  {
    id: "zucchini",
    name: "Cukinia",
    unlockLevel: 18,
    growthTimeMs: 360 * 60_000,
    yieldAmount: 3,
    expReward: 720,
    spritePath: "/zucchini.png",
    epicSpritePath: "/zucchini_epic.png",
    rottenSpritePath: "/zucchini_rotten.png",
    legendarySpritePath: "/zucchini_legendary.png",
  },
  {
    id: "watermelon",
    name: "Arbuz",
    unlockLevel: 19,
    growthTimeMs: 435 * 60_000,
    yieldAmount: 3,
    expReward: 870,
    spritePath: "/watermelon.png",
    epicSpritePath: "/watermelon_epic.png",
    rottenSpritePath: "/watermelon_rotten.png",
    legendarySpritePath: "/watermelon_legendary.png",
  },
  {
    id: "grape",
    name: "Winogrono",
    unlockLevel: 20,
    growthTimeMs: 500 * 60_000,
    yieldAmount: 3,
    expReward: 1000,
    spritePath: "/grape.png",
    epicSpritePath: "/grape_epic.png",
    rottenSpritePath: "/grape_rotten.png",
    legendarySpritePath: "/grape_legendary.png",
  },
  {
    id: "pumpkin",
    name: "Dynia",
    unlockLevel: 21,
    growthTimeMs: 540 * 60_000,
    yieldAmount: 3,
    expReward: 1080,
    spritePath: "/pumpkin.png",
    epicSpritePath: "/pumpkin_epic.png",
    rottenSpritePath: "/pumpkin_rotten.png",
    legendarySpritePath: "/pumpkin_legendary.png",
  },
  {
    id: "rapeseed",
    name: "Rzepak",
    unlockLevel: 22,
    growthTimeMs: 580 * 60_000,
    yieldAmount: 3,
    expReward: 1150,
    spritePath: "/rapeseed.png",
    epicSpritePath: "/rapeseed_epic.png",
    rottenSpritePath: "/rapeseed_rotten.png",
    legendarySpritePath: "/rapeseed_legendary.png",
  },
  {
    id: "sunflower",
    name: "Słonecznik",
    unlockLevel: 23,
    growthTimeMs: 620 * 60_000,
    yieldAmount: 3,
    expReward: 1240,
    spritePath: "/sunflower.png",
    epicSpritePath: "/sunflower_epic.png",
    rottenSpritePath: "/sunflower_rotten.png",
    legendarySpritePath: "/sunflower_legendary.png",
  },
  {
    id: "chili",
    name: "Papryczka chili",
    unlockLevel: 24,
    growthTimeMs: 660 * 60_000,
    yieldAmount: 3,
    expReward: 1320,
    spritePath: "/chili.png",
    epicSpritePath: "/chili_epic.png",
    rottenSpritePath: "/chili_rotten.png",
    legendarySpritePath: "/chili_legendary.png",
  },
  {
    id: "asparagus",
    name: "Szparagi",
    unlockLevel: 25,
    growthTimeMs: 720 * 60_000,
    yieldAmount: 3,
    expReward: 1440,
    spritePath: "/asparagus.png",
    epicSpritePath: "/asparagus_epic.png",
    rottenSpritePath: "/asparagus_rotten.png",
    legendarySpritePath: "/asparagus_legendary.png",
  },
];

const FARM_PLOTS: FarmPlot[] = Array.from({ length: MAX_FIELDS }, (_, index) => ({
  id: index + 1,
  left: "0%",
  top: "0%",
  width: "0%",
  height: "0%",
}));

const FIELD_VIEW_PLOTS: FieldViewPlotLayout[] = [
  { id: 1, left: "10.5%", top: "10.0%", width: "12.5%", height: "10.0%" },
  { id: 2, left: "27.2%", top: "10.0%", width: "12.5%", height: "10.0%" },
  { id: 3, left: "43.9%", top: "10.0%", width: "12.5%", height: "10.0%" },
  { id: 4, left: "60.6%", top: "10.0%", width: "12.5%", height: "10.0%" },
  { id: 5, left: "77.3%", top: "10.0%", width: "12.5%", height: "10.0%" },

  { id: 6, left: "10.5%", top: "26.4%", width: "12.5%", height: "10.0%" },
  { id: 7, left: "27.2%", top: "26.4%", width: "12.5%", height: "10.0%" },
  { id: 8, left: "43.9%", top: "26.4%", width: "12.5%", height: "10.0%" },
  { id: 9, left: "60.6%", top: "26.4%", width: "12.5%", height: "10.0%" },
  { id: 10, left: "77.3%", top: "26.4%", width: "12.5%", height: "10.0%" },

  { id: 11, left: "10.5%", top: "41.9%", width: "12.5%", height: "10.0%" },
  { id: 12, left: "27.2%", top: "41.9%", width: "12.5%", height: "10.0%" },
  { id: 13, left: "43.9%", top: "41.9%", width: "12.5%", height: "10.0%" },
  { id: 14, left: "60.6%", top: "41.9%", width: "12.5%", height: "10.0%" },
  { id: 15, left: "77.3%", top: "41.9%", width: "12.5%", height: "10.0%" },

  { id: 16, left: "10.5%", top: "58.4%", width: "12.5%", height: "10.0%" },
  { id: 17, left: "27.2%", top: "58.4%", width: "12.5%", height: "10.0%" },
  { id: 18, left: "43.9%", top: "58.4%", width: "12.5%", height: "10.0%" },
  { id: 19, left: "60.6%", top: "58.4%", width: "12.5%", height: "10.0%" },
  { id: 20, left: "77.3%", top: "58.4%", width: "12.5%", height: "10.0%" },

  { id: 21, left: "10.5%", top: "75.0%", width: "12.5%", height: "10.0%" },
  { id: 22, left: "27.2%", top: "75.0%", width: "12.5%", height: "10.0%" },
  { id: 23, left: "43.9%", top: "75.0%", width: "12.5%", height: "10.0%" },
  { id: 24, left: "60.6%", top: "75.0%", width: "12.5%", height: "10.0%" },
  { id: 25, left: "77.3%", top: "75.0%", width: "12.5%", height: "10.0%" },
];

const PLOT_UNLOCK_COSTS: Record<number, number> = {
  4: 100,
  5: 150,
  6: 200,
  7: 250,
  8: 300,
  9: 350,
  10: 400,
  11: 500,
  12: 600,
  13: 700,
  14: 800,
  15: 1000,
  16: 1200,
  17: 1400,
  18: 1600,
  19: 1800,
  20: 2000,
  21: 2300,
  22: 2600,
  23: 3000,
  24: 3500,
  25: 4000,
};

const XP_TABLE: Record<number, number> = {
  1: 12,
  2: 140,
  3: 180,
  4: 250,
  5: 330,
  6: 450,
  7: 600,
  8: 800,
  9: 1100,
  10: 1500,
  11: 2000,
  12: 2700,
  13: 3600,
  14: 5000,
  15: 7000,
  16: 9000,
  17: 12000,
  18: 16000,
  19: 22000,
  20: 30000,
  21: 40000,
  22: 55000,
  23: 75000,
  24: 100000,
  25: 135000,
  26: 180000,
  27: 240000,
  28: 320000,
  29: 420000,
  30: 550000,
  31: 720000,
  32: 950000,
  33: 1250000,
  34: 1650000,
  35: 2200000,
  36: 2900000,
  37: 3800000,
  38: 5000000,
  39: 6500000,
  40: 8500000,
  41: 11000000,
  42: 14500000,
  43: 19000000,
  44: 25000000,
  45: 33000000,
  46: 43000000,
  47: 56000000,
  48: 73000000,
  49: 95000000,
  50: 120000000,
};

function getXpForLevel(level: number) {
  return XP_TABLE[level] ?? 999999999;
}

function getFarmUpgradeStorageKey(userId: string, level: number) {
  return `plonopolis_farm_upgrade_seen_${userId}_${level}`;
}

function getDefaultUnlockedPlots() {
  return [1, 2, 3];
}

function normalizeUnlockedPlots(plots: number[]) {
  return Array.from(new Set([...getDefaultUnlockedPlots(), ...plots]))
    .filter((plotId) => Number.isInteger(plotId) && plotId >= 1 && plotId <= MAX_FIELDS)
    .sort((a, b) => a - b);
}

function parseUnlockedPlots(value: unknown) {
  if (!Array.isArray(value)) return getDefaultUnlockedPlots();
  return normalizeUnlockedPlots(value.map((item) => Number(item)));
}

function buildEmptyPlotCrop(): PlotCropState {
  return {
    cropId: null,
    plantedAt: null,
    watered: false,
  };
}

function parsePlotCrops(value: unknown): Record<number, PlotCropState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const entries = Object.entries(value as Record<string, unknown>);
  const parsedEntries: Array<readonly [number, PlotCropState]> = [];

  for (const [key, rawValue] of entries) {
    const plotId = Number(key);
    if (!Number.isInteger(plotId) || plotId < 1 || plotId > MAX_FIELDS) continue;

    const item = rawValue as Partial<PlotCropState> | null;
    let _compostBonus: CompostBonus | null = null;
    if (item && (item as { compostBonus?: unknown }).compostBonus && typeof (item as { compostBonus?: unknown }).compostBonus === "object") {
      const cb = (item as { compostBonus: { type?: unknown; value?: unknown } }).compostBonus;
      const ct = cb.type;
      const cv = cb.value;
      if ((ct === "growth" || ct === "yield" || ct === "exp") && typeof cv === "number" && cv > 0) {
        _compostBonus = { type: ct as CompostType, value: cv };
      }
    }
    parsedEntries.push([
      plotId,
      {
        cropId: typeof item?.cropId === "string" ? item.cropId : null,
        plantedAt: typeof item?.plantedAt === "number" ? item.plantedAt : null,
        watered: Boolean(item?.watered),
        plantedQuality: typeof item?.plantedQuality === "string" ? item.plantedQuality : null,
        compostBonus: _compostBonus,
      },
    ] as const);
  }

  return Object.fromEntries(parsedEntries);
}

function serializePlotCrops(value: Record<number, PlotCropState>) {
  return Object.fromEntries(
    Object.entries(value)
      // Zachowuj pola z uprawą LUB z aktywnym kompostem (kompost na puste pole musi przeżyć w bazie)
      .filter(([, plot]) => Boolean(plot?.cropId) || Boolean(plot?.compostBonus))
      .map(([plotId, plot]) => [
        plotId,
        {
          cropId: plot.cropId,
          plantedAt: plot.plantedAt,
          watered: Boolean(plot.watered),
          plantedQuality: plot.plantedQuality ?? null,
          compostBonus: plot.compostBonus ?? null,
        },
      ])
  );
}

function getDefaultSeedInventory(): SeedInventory {
  return {};
}

function parseSeedInventory(value: unknown): SeedInventory {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const merged: Record<string, number> = {};

  for (const [seedId, amount] of Object.entries(value as Record<string, unknown>)) {
    const safeAmount = Math.floor(Number(amount));
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) continue;
    // Kompost — zachowujemy klucze; migracja starych ("compost_growth") → tier 1 ("compost_growth_5")
    if (isCompostKey(seedId)) {
      const ct = compostTypeFromKey(seedId);
      const parts = seedId.split("_");
      const lastNum = Number(parts[parts.length - 1]);
      const hasTier = ct ? COMPOST_DEFS[ct].bonusValues.includes(lastNum) : false;
      const normalizedKey = (ct && !hasTier)
        ? `${COMPOST_DEFS[ct].id}_${COMPOST_DEFS[ct].bonusValues[0]}`
        : seedId;
      merged[normalizedKey] = (merged[normalizedKey] ?? 0) + safeAmount;
      continue;
    }
    const { baseCropId, quality } = parseQualityKey(seedId);
    if (!CROPS.some((crop) => crop.id === baseCropId)) continue;
    // Migracja: stary klucz bez jakości (np. "carrot") → "carrot_good"
    const normalizedKey = quality === null ? `${seedId}_good` : seedId;
    merged[normalizedKey] = (merged[normalizedKey] ?? 0) + safeAmount;
  }

  return merged;
}

function serializeSeedInventory(value: SeedInventory) {
  return Object.fromEntries(
    Object.entries(value)
      .map(([seedId, amount]) => [seedId, Math.max(0, Math.floor(Number(amount) || 0))] as const)
      .filter(([, amount]) => amount > 0)
  );
}

function getFarmUpgradeMessage(level: number): FarmUpgradeModal | null {
  if (level === 5) {
    return {
      level,
      title: "Farma ulepszona!",
      text: "Twoje gospodarstwo rozrosło się! Odblokowano nowy wygląd farmy.",
    };
  }

  if (level === 10) {
    return {
      level,
      title: "Nowy poziom farmy!",
      text: "Twoja farma wygląda teraz jeszcze lepiej. Kolejne ulepszenia przed Tobą!",
    };
  }

  if (level === 15) {
    return {
      level,
      title: "Rozbudowa farmy!",
      text: "Twoje gospodarstwo staje się coraz większe i bardziej zaawansowane.",
    };
  }

  if (level === 20) {
    return {
      level,
      title: "Zaawansowana farma!",
      text: "Twoja farma osiągnęła nowy poziom rozwoju!",
    };
  }

  return null;
}

function getMapForLevel(level: number | null | undefined) {
  const safeLevel = level ?? DEFAULT_LEVEL;

  if (safeLevel >= 25) return "farm25";
  if (safeLevel >= 20) return "farm20";
  if (safeLevel >= 15) return "farm15";
  if (safeLevel >= 10) return "farm10";
  if (safeLevel >= 5) return "farm5";

  return DEFAULT_MAP;
}

function getDisplayBackgroundMap(mapId: string | null | undefined) {
  if (!mapId) return DEFAULT_MAP;
  return mapId;
}

function getMapDisplayName(mapId: string | null | undefined) {
  switch (mapId) {
    case "city":
      return "Miasto";
    case "city_shop":
      return "Sklep";
    case "city_market":
      return "Targ";
    case "city_bank":
      return "Bank";
    case "city_townhall":
      return "Ratusz";
    case "farm5":
    case "farm10":
    case "farm15":
    case "farm20":
    case "farm25":
    case "farm1":
      return "Farma";
    default:
      return mapId ?? "Mapa";
  }
}

export default function Page() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [farmUpgradeModal, setFarmUpgradeModal] = useState<FarmUpgradeModal | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [registerForm, setRegisterForm] = useState({
    login: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
  });

  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(1);
  const [unlockedPlots, setUnlockedPlots] = useState<number[]>(getDefaultUnlockedPlots());
  const [plotToBuy, setPlotToBuy] = useState<number | null>(null);
  const [isFieldViewOpen, setIsFieldViewOpen] = useState(false);
  const [plotCrops, setPlotCrops] = useState<Record<number, PlotCropState>>({});
  const [seedInventory, setSeedInventory] = useState<SeedInventory>(getDefaultSeedInventory());
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<"watering_can" | "sickle" | null>(null);
  const [, setGrowthTick] = useState(0);
  // Akcje polowe w toku (sadzenie/zbiór z paskiem postępu)
  const [pendingFieldActions, setPendingFieldActions] = useState<Record<number, PendingFieldAction>>({});
  const [, setPendingTick] = useState(0);
  // Mapa plotId → setTimeout id (do anulowania przy unmount)
  const fieldActionTimeoutsRef = React.useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Refs do fresh state — używane w setTimeout callbackach (closure capture by stary state)
  const seedInventoryRef = React.useRef<SeedInventory>({});
  const plotCropsRef = React.useRef<Record<number, PlotCropState>>({});
  const [isDesktop, setIsDesktop] = useState(true);
  const [backpackPosition, setBackpackPosition] = useState({ x: 0, y: 0 });
  const [isDraggingBackpack, setIsDraggingBackpack] = useState(false);

  const [isBackpackOpen, setIsBackpackOpen] = useState(true);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mousePos, setMousePos] = React.useState({x:0, y:0});
  const [draggedSeedId, setDraggedSeedId] = React.useState<string|null>(null);
  const [isFieldViewCollapsed, setIsFieldViewCollapsed] = React.useState(false);
  const [showRankingPanel, setShowRankingPanel] = useState(false);
  const [rankingData, setRankingData] = useState<RankingPlayer[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingSort, setRankingSort] = useState<"level"|"money"|"missions"|"name">("level");
  const [rankingSearch, setRankingSearch] = useState("");
  const [rankingHighlightMe, setRankingHighlightMe] = useState(false);
  const [showGildiaPanel, setShowGildiaPanel] = useState(false);
  const [showMisjePanel, setShowMisjePanel] = useState(false);
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  const [messageTab, setMessageTab] = useState<"systemowe"|"otrzymane"|"wyslane">("systemowe");
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [gameMessages, setGameMessages] = useState<GameMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [recipientSuggestions, setRecipientSuggestions] = useState<{id:string;username:string}[]>([]);
  const [recipientResolved, setRecipientResolved] = useState<{id:string;username:string}|null>(null);
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [messageCooldowns, setMessageCooldowns] = useState<Record<string,number>>({});
  const [composeCountdownSecs, setComposeCountdownSecs] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredCrop, setHoveredCrop] = useState<typeof CROPS[0] | null>(null);
  const [hoveredSeedQuality, setHoveredSeedQuality] = useState<"rotten"|"good"|"epic"|"legendary"|null>(null);
  const [hoveredWateringCan, setHoveredWateringCan] = React.useState(false);
  const [hoveredSickle, setHoveredSickle] = React.useState(false);
  const [avatarSkin, setAvatarSkin] = React.useState<number>(-1);
  const [showSkinModal, setShowSkinModal] = React.useState(false);
  const [showAvatarHover, setShowAvatarHover] = React.useState(false);
  const [unlockedEpicAvatars, setUnlockedEpicAvatars] = React.useState<number[]>([]);
  const [skinTab, setSkinTab] = React.useState<"mezczyzni"|"kobiety"|"wszystkie"|"epickie">("mezczyzni");
  const [epicPurchaseTarget, setEpicPurchaseTarget] = React.useState<number|null>(null);
  const [playerStats, setPlayerStats] = React.useState<PlayerStatsMap>({ ...DEFAULT_STATS });
  const [freeSkillPoints, setFreeSkillPoints] = React.useState(3);
  const [statUpgradeAmount, setStatUpgradeAmount] = React.useState<1|5|10>(1);
  const [showDomModal, setShowDomModal] = React.useState(false);
  const [showStodolaModal, setShowStodolaModal] = React.useState(false);
  const [showSadModal, setShowSadModal] = React.useState(false);
  const [showUlModal, setShowUlModal] = React.useState(false);
  const [showLadaModal, setShowLadaModal] = React.useState(false);
  const [ladaSellQty, setLadaSellQty] = React.useState(1);
  const [ladaSelling, setLadaSelling] = React.useState(false);
  // Schowek stodoły: ilość do sprzedaży per itemId + flaga "sprzedawanie"
  const [barnSellQtys, setBarnSellQtys] = React.useState<Record<string, number>>({});
  const [barnSelling, setBarnSelling] = React.useState<string | null>(null);
  // Lada — sprzedaż owoców z sadu (klucz: `${fruitId}_${quality}`)
  const [ladaFruitQtys, setLadaFruitQtys] = React.useState<Record<string, number>>({});
  const [ladaFruitSelling, setLadaFruitSelling] = React.useState<string | null>(null);
  const [hiveData, setHiveData] = React.useState<HiveData>({ ...DEFAULT_HIVE_DATA });
  const [hiveNow, setHiveNow] = React.useState(Date.now());
  const [showTestModal, setShowTestModal] = React.useState(false);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const [navEditMode, setNavEditMode] = React.useState(false);
  // pozycje etykiet (niezależne od hitboxów)
  const [navLabelPos, setNavLabelPos] = React.useState<Record<string,{left:number,top:number}>>({
    dom:         {left:20.7, top:22.0},
    stodola:     {left:54.9, top:52.1},
    doMiasta:    {left:51.9, top:89.0},
    polaUprawne: {left:56.8, top:27.1},
    ul:          {left:84.4, top:85.2},
    lada:        {left:17.6, top:61.0},
    kompostownik:{left:83.8, top:17.7},
    sad:         {left:21.2, top:80.4},
  });
  const navLabelDragRef = React.useRef<{id:string,startX:number,startY:number,startPos:{left:number,top:number}}|null>(null);
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = navLabelDragRef.current;
      if (!ds || !mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - ds.startX) / rect.width) * 100;
      const dy = ((e.clientY - ds.startY) / rect.height) * 100;
      setNavLabelPos(prev => ({
        ...prev,
        [ds.id]: {
          left: Math.max(0, Math.min(98, ds.startPos.left + dx)),
          top:  Math.max(0, Math.min(98, ds.startPos.top  + dy)),
        }
      }));
    };
    const onUp = () => { navLabelDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);
  const [hitboxEditMode, setHitboxEditMode] = React.useState(false);
  const [navHitboxPos, setNavHitboxPos] = React.useState<Record<string,{left:number,top:number,width:number,height:number}>>({
    dom:         {left:6.8,  top:11.1, width:29.9, height:28.1},
    stodola:     {left:40.5, top:50.7, width:29.7, height:28.1},
    doMiasta:    {left:36.1, top:82.8, width:31.4, height:15.9},
    polaUprawne: {left:41.9, top:15.7, width:29.3, height:27.2},
    ul:          {left:73.2, top:68.7, width:23.1, height:23.9},
    lada:        {left:6.8,  top:44.4, width:21.2, height:20.3},
    kompostownik:{left:73.9, top:16.5, width:19.9, height:24.4},
    sad:         {left:6.0,  top:69.0, width:29.8, height:22.6},
  });
  const navHitboxDragRef = React.useRef<{type:"move"|"resize",id:string,startX:number,startY:number,startPos:{left:number,top:number,width:number,height:number}}|null>(null);
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = navHitboxDragRef.current;
      if (!ds || !mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - ds.startX) / rect.width) * 100;
      const dy = ((e.clientY - ds.startY) / rect.height) * 100;
      setNavHitboxPos(prev => {
        const p = {...prev[ds.id]};
        if (ds.type === "move") {
          p.left = Math.max(0, Math.min(95, ds.startPos.left + dx));
          p.top  = Math.max(0, Math.min(95, ds.startPos.top  + dy));
        } else {
          p.width  = Math.max(3, ds.startPos.width  + dx);
          p.height = Math.max(3, ds.startPos.height + dy);
        }
        return {...prev, [ds.id]: p};
      });
    };
    const onUp = () => { navHitboxDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ══ MIASTO — EDYTOR HITBOXÓW I ETYKIET ══
  const [cityNavEditMode, setCityNavEditMode] = React.useState(false);
  const [cityHitboxEditMode, setCityHitboxEditMode] = React.useState(false);
  const [cityHitboxPos, setCityHitboxPos] = React.useState<Record<string,{left:number,top:number,width:number,height:number}>>({
    naFarme: {left:8.8,  top:71.5, width:25.4, height:24.0},
    sklep:   {left:6.7,  top:37.8, width:25.9, height:30.4},
    targ:    {left:35.5, top:45.4, width:25.6, height:22.0},
    bank:    {left:81.8, top:47.9, width:10.9, height:23.9},
    ratusz:  {left:64.7, top:8.4,  width:15.7, height:49.8},
  });
  const [cityLabelPos, setCityLabelPos] = React.useState<Record<string,{left:number,top:number}>>({
    naFarme: {left:20.9, top:81.8},
    sklep:   {left:27.5, top:56.8},
    targ:    {left:47.6, top:54.2},
    bank:    {left:87.4, top:62.8},
    ratusz:  {left:73.2, top:40.2},
  });
  const cityHitboxDragRef = React.useRef<{type:"move"|"resize",id:string,startX:number,startY:number,startPos:{left:number,top:number,width:number,height:number}}|null>(null);
  const cityLabelDragRef = React.useRef<{id:string,startX:number,startY:number,startPos:{left:number,top:number}}|null>(null);
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const dh = cityHitboxDragRef.current;
      if (dh && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        const dx = ((e.clientX - dh.startX) / rect.width) * 100;
        const dy = ((e.clientY - dh.startY) / rect.height) * 100;
        setCityHitboxPos(prev => {
          const p = {...prev[dh.id]};
          if (dh.type === "move") {
            p.left = Math.max(0, Math.min(95, dh.startPos.left + dx));
            p.top  = Math.max(0, Math.min(95, dh.startPos.top  + dy));
          } else {
            p.width  = Math.max(3, dh.startPos.width  + dx);
            p.height = Math.max(3, dh.startPos.height + dy);
          }
          return {...prev, [dh.id]: p};
        });
      }
      const dl = cityLabelDragRef.current;
      if (dl && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        const dx = ((e.clientX - dl.startX) / rect.width) * 100;
        const dy = ((e.clientY - dl.startY) / rect.height) * 100;
        setCityLabelPos(prev => ({
          ...prev,
          [dl.id]: {
            left: Math.max(0, Math.min(98, dl.startPos.left + dx)),
            top:  Math.max(0, Math.min(98, dl.startPos.top  + dy)),
          }
        }));
      }
    };
    const onUp = () => { cityHitboxDragRef.current = null; cityLabelDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const [showWelcome, setShowWelcome] = React.useState(false);
  const [showShopModal, setShowShopModal] = React.useState(false);
  const [shopTab, setShopTab] = React.useState<"nasiona"|"zwierzeta"|"drzewa"|"przedmioty">("nasiona");
  const [shopCart, setShopCart] = React.useState<Record<string,number>>({});
  const [shopError, setShopError] = React.useState("");
  const [domTab, setDomTab] = React.useState<"profil"|"eq">("profil");
    const [backpackTab, setBackpackTab] = React.useState<"uprawy"|"przedmioty"|"owoce">("uprawy");
    type BackpackQualityFilter = "rotten"|"good"|"epic"|"legendary"|"all";
    const [backpackSort, setBackpackSort] = React.useState<BackpackQualityFilter>(() => {
      if (typeof window === "undefined") return "good";
      const saved = window.localStorage.getItem("plonopolis_backpack_filter");
      if (saved === "rotten" || saved === "good" || saved === "epic" || saved === "legendary" || saved === "all") return saved;
      return "good";
    });
    React.useEffect(() => {
      if (typeof window !== "undefined") window.localStorage.setItem("plonopolis_backpack_filter", backpackSort);
    }, [backpackSort]);
    const BACKPACK_FILTER_OPTS: Array<{id: BackpackQualityFilter; label: string; short: string; color: string}> = [
      { id:"rotten",    label:"Popsute",    short:"Pop",  color:"#9aa57a" },
      { id:"good",      label:"Standardowe",short:"Std",  color:"#dfcfab" },
      { id:"epic",      label:"Epickie",    short:"Epic", color:"#a78bfa" },
      { id:"legendary", label:"Legendarne", short:"Leg",  color:"#fbbf24" },
      { id:"all",       label:"Wszystkie",  short:"Wsz",  color:"#dfcfab" },
    ];
  const [charEquipped, setCharEquipped] = React.useState<CharEquipped>(() => {
    try { const s = localStorage.getItem(CHAR_EQUIP_KEY); return s ? migrateCharEquipped(JSON.parse(s)) : { ...DEFAULT_CHAR_EQUIPPED }; } catch { return { ...DEFAULT_CHAR_EQUIPPED }; }
  });
  const [equippingSlot, setEquippingSlot] = React.useState<EquipSlot | null>(null);
  const [selectedExtraUid, setSelectedExtraUid] = React.useState<string | null>(null);
  const [eqFilter, setEqFilter] = React.useState<EquipSlot | "">("");
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = React.useState<EquipSlot | null>(null);
  const [itemUpgRegistry, setItemUpgRegistry] = React.useState<Record<string,number>>(() => {
    try { const s = localStorage.getItem(ITEM_UPG_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const saveCharEquipped = (next: CharEquipped) => { setCharEquipped(next); try { localStorage.setItem(CHAR_EQUIP_KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const saveItemUpg = (reg: Record<string,number>) => { setItemUpgRegistry(reg); try { localStorage.setItem(ITEM_UPG_KEY, JSON.stringify(reg)); } catch { /* ignore */ } };
  const getItemUpg = (id: string) => itemUpgRegistry[id] ?? 0;
  // ─── Ekwipunek: zdobyte przedmioty (gracz musi je zdobyć by je mieć) ───
  const [ownedEqItems, setOwnedEqItems] = React.useState<Record<string, true>>(() => {
    try { const s = localStorage.getItem(OWNED_EQ_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const saveOwnedEqItems = (next: Record<string, true>) => { setOwnedEqItems(next); try { localStorage.setItem(OWNED_EQ_KEY, JSON.stringify(next)); } catch {} };
  // ─── Ekwipunek Dodatkowy: nadmiarowe duplikaty (przyszłość: handel/ulepszenia/sprzedaż) ───
  type ExtraEqEntry = { uid: string; id: string; upg: number };
  const [extraEqItems, setExtraEqItems] = React.useState<ExtraEqEntry[]>(() => {
    try { const s = localStorage.getItem(EXTRA_EQ_KEY); const p = s ? JSON.parse(s) : []; return Array.isArray(p) ? p : []; } catch { return []; }
  });
  const saveExtraEqItems = (next: ExtraEqEntry[]) => { setExtraEqItems(next); try { localStorage.setItem(EXTRA_EQ_KEY, JSON.stringify(next)); } catch {} };
  const makeExtraUid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  // ─── Kompostownik ───
  const KOMPOST_HARD_CAP = 9999; // legacy — nieużywane w nowym systemie batchowym
  const [kompostBatches, setKompostBatches] = React.useState<CompostBatch[]>(() => {
    try {
      // Najpierw próbuj wczytać nowy format (batches)
      const sNew = localStorage.getItem(KOMPOST_BATCHES_KEY);
      if (sNew) {
        const arr = JSON.parse(sNew);
        if (Array.isArray(arr)) {
          return arr
            .slice(0, KOMPOST_MAX_BATCHES)
            .map((b: { fill?: unknown; scoreSum?: unknown }) => ({
              fill: Math.max(0, Math.min(10, Math.floor(Number(b?.fill) || 0))),
              scoreSum: Math.max(0, Number(b?.scoreSum) || 0),
            }))
            .filter((b: CompostBatch) => b.fill > 0);
        }
      }
      // Migracja ze starego: kompostCharges (płaski licznik) → batches z domyślnym score "Słaby" (1.0 per wrzut)
      // UWAGA: jeśli stare charges > 100 (cap nowego systemu), nadwyżka zostaje w KOMPOST_KEY jako "pending"
      //        i jest dosypywana automatycznie przy każdym deposit/claim (patrz consumePendingLegacyCharges)
      const sOld = localStorage.getItem(KOMPOST_KEY);
      if (sOld) {
        const charges = Math.max(0, Math.floor(Number(sOld) || 0));
        if (charges > 0) {
          const consumeNow = Math.min(charges, KOMPOST_MAX_BATCHES * 10);
          const fullBatches = Math.floor(consumeNow / 10);
          const remainder = consumeNow % 10;
          const batches: CompostBatch[] = [];
          for (let i = 0; i < fullBatches; i++) {
            batches.push({ fill: 10, scoreSum: 10 }); // średnia=1.0 → "Słaby"
          }
          if (batches.length < KOMPOST_MAX_BATCHES && remainder > 0) {
            batches.push({ fill: remainder, scoreSum: remainder });
          }
          // Nadwyżka — zostaw w starym kluczu, dosypiemy ją później kiedy będą wolne sloty
          const leftover = charges - consumeNow;
          try {
            if (leftover > 0) localStorage.setItem(KOMPOST_KEY, String(leftover));
            else localStorage.removeItem(KOMPOST_KEY);
          } catch {}
          return batches;
        }
      }
    } catch {}
    return [];
  });
  // Flaga przeciw race conditions: blokuje równoległe deposit/claim (np. szybkie podwójne kliknięcia)
  const kompostBusyRef = React.useRef(false);
  // Dosyp pozostałe legacy charges (z migracji nadwyżki >100) do zwolnionych slotów. Mutuje przekazaną tablicę.
  const consumePendingLegacyCharges = (batches: CompostBatch[]) => {
    try {
      const sOld = localStorage.getItem(KOMPOST_KEY);
      if (!sOld) return;
      let pending = Math.max(0, Math.floor(Number(sOld) || 0));
      if (pending <= 0) {
        localStorage.removeItem(KOMPOST_KEY);
        return;
      }
      while (pending > 0 && batches.length < KOMPOST_MAX_BATCHES) {
        let last = batches[batches.length - 1];
        if (!last || last.fill >= 10) {
          last = { fill: 0, scoreSum: 0 };
          batches.push(last);
        }
        const room = 10 - last.fill;
        const take = Math.min(pending, room);
        last.fill += take;
        last.scoreSum += take; // legacy = score 1.0 per wrzut
        pending -= take;
      }
      if (pending > 0) localStorage.setItem(KOMPOST_KEY, String(pending));
      else localStorage.removeItem(KOMPOST_KEY);
    } catch {}
  };
  const saveKompostBatches = (batches: CompostBatch[]) => {
    const clean = batches
      .slice(0, KOMPOST_MAX_BATCHES)
      .map(b => ({
        fill: Math.max(0, Math.min(10, Math.floor(b.fill))),
        scoreSum: Math.max(0, b.scoreSum),
      }))
      .filter(b => b.fill > 0);
    setKompostBatches(clean);
    try {
      localStorage.setItem(KOMPOST_BATCHES_KEY, JSON.stringify(clean));
      // Wyczyść stary klucz po pierwszym zapisie nowego formatu
      localStorage.removeItem(KOMPOST_KEY);
    } catch {}
  };
  // Derived: łączne ładowania (suma fill) — dla wyświetlania i kompatybilności
  const kompostCharges = kompostBatches.reduce((s, b) => s + b.fill, 0);
  const [showKompostModal, setShowKompostModal] = React.useState(false);
  type KompostRewardEntry =
    | { kind:"item"; itemId: string; itemName: string; itemIcon: string }
    | { kind:"compost"; compostType: CompostType; value: number };
  const [kompostRewards, setKompostRewards] = React.useState<KompostRewardEntry[] | null>(null);
  // ESC zamyka modal kompostownika (najpierw panel nagród, potem cały modal)
  React.useEffect(() => {
    if (!showKompostModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (kompostRewards) {
        setKompostRewards(null);
      } else {
        setShowKompostModal(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showKompostModal, kompostRewards]);
  const [kompostHoverTip, setKompostHoverTip] = React.useState<{ x: number; y: number; node: React.ReactNode; color: string } | null>(null);
  const [kompostQty, setKompostQty] = React.useState<1|5|10|100|"max">(1);
  const [kompostFilter, setKompostFilter] = React.useState<"rotten"|"good"|"epic"|"legendary"|"all">("rotten");
  const [compostNotice, setCompostNotice] = React.useState<{ type: CompostType; value: number; plotId: number } | null>(null);
  const [slotBoxCustom, setSlotBoxCustom] = React.useState<Record<string,{top:number,left:number,width:number,height:number}>>(() => {
    try { const s = localStorage.getItem(SLOT_BOX_KEY); return s ? JSON.parse(s) : { ...DEFAULT_SLOT_BOX }; } catch { return { ...DEFAULT_SLOT_BOX }; }
  });
  const [editSlotBox, setEditSlotBox] = React.useState(false);
  const saveSlotBox = (v: Record<string,{top:number,left:number,width:number,height:number}>) => {
    setSlotBoxCustom(v); try { localStorage.setItem(SLOT_BOX_KEY, JSON.stringify(v)); } catch { /* ignore */ }
  };
  const [barnNow, setBarnNow] = React.useState(Date.now());
  const [barnState, setBarnState_] = React.useState<BarnState>(() => {
    try { const s = localStorage.getItem(BARN_STATE_KEY); const parsed = s ? JSON.parse(s) : {}; return { ...defaultBarnState(), ...parsed }; } catch { return defaultBarnState(); }
  });
  const [barnItems, setBarnItems_] = React.useState<BarnItems>(() => {
    try { const s = localStorage.getItem(BARN_ITEMS_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [selectedAnimal, setSelectedAnimal] = React.useState<string|null>(null);
  const saveBarnState = (next: BarnState) => { setBarnState_(next); try { localStorage.setItem(BARN_STATE_KEY, JSON.stringify(next)); } catch {} };
  const saveBarnItems = (next: BarnItems) => { setBarnItems_(next); try { localStorage.setItem(BARN_ITEMS_KEY, JSON.stringify(next)); } catch {} };
  // SAD — state + persystencja
  const [orchardState, setOrchardState_] = React.useState<OrchardState>(() => {
    try { const s = localStorage.getItem(ORCHARD_STATE_KEY); return migrateOrchardState(s ? JSON.parse(s) : null); } catch { return defaultOrchardState(); }
  });
  const saveOrchardState = (next: OrchardState) => { setOrchardState_(next); try { localStorage.setItem(ORCHARD_STATE_KEY, JSON.stringify(next)); } catch {} };
  const [orchardError, setOrchardError] = React.useState("");
  // Owoce zebrane (Record<"fruitId_quality", number>) — osobny inventory bo sprzedaż per quality, w przyszłości też crafting/gildie
  const FRUIT_INV_KEY = "plonopolis_fruit_inv";
  const [fruitInventory, setFruitInventory_] = React.useState<Record<string,number>>(() => {
    try { const s = localStorage.getItem(FRUIT_INV_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const saveFruitInventory = (next: Record<string,number>) => { setFruitInventory_(next); try { localStorage.setItem(FRUIT_INV_KEY, JSON.stringify(next)); } catch {} };
  React.useEffect(() => {
    const t = setInterval(() => setBarnNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  React.useEffect(() => {
    let changed = false;
    const next: BarnState = {};
    const opiekaPts = playerStats?.opieka ?? 0;
    const bonusChance = opiekaPts * 0.0015; // +0.15%/pkt
    const bonusMessages: string[] = [];
    ANIMALS.forEach(a => {
      const st = barnState[a.id] ?? { owned:0, slots:a.startSlots, hunger:80, lastFedAt:0, storage:0, prodStart:0 };
      if (st.owned === 0) { next[a.id] = st; return; }
      let ns = { ...st };
      if (ns.storage >= a.storageMax) { ns.prodStart = 0; next[a.id] = ns; return; }
      if (ns.prodStart === 0) { ns.prodStart = barnNow; changed = true; next[a.id] = ns; return; }
      const h = barnCurrentHunger(ns, opiekaPts);
      const effMs = barnEffProdMs(a, h);
      const elapsed = barnNow - ns.prodStart;
      if (elapsed >= effMs) {
        // 1 cykl = 1 jednostka storage. Liczymy ILE pełnych cykli się zmieściło (offline-safe).
        const freeSlots = a.storageMax - ns.storage;
        const fullCycles = Math.min(Math.floor(elapsed / effMs), freeSlots);
        let cyclesToAdd = fullCycles;
        // Bonus opieki: dla każdego cyklu szansa na dodatkowy
        if (bonusChance > 0) {
          for (let i = 0; i < fullCycles; i++) {
            if (ns.storage + cyclesToAdd >= a.storageMax) break;
            if (Math.random() < bonusChance) {
              cyclesToAdd += 1;
              const item = ANIMAL_ITEMS.find(i => i.id === a.itemId);
              if (item) bonusMessages.push(`${a.icon} ${a.name} dała dodatkowy cykl ${item.name}! ${item.icon}`);
            }
          }
        }
        ns.storage = Math.min(a.storageMax, ns.storage + cyclesToAdd);
        if (ns.storage >= a.storageMax) {
          ns.prodStart = 0;
        } else {
          // Zachowaj resztę czasu po pełnych cyklach (nie marnuj postępu)
          ns.prodStart = ns.prodStart + fullCycles * effMs;
        }
        changed = true;
      }
      next[a.id] = ns;
    });
    if (changed) saveBarnState(next);
    if (bonusMessages.length > 0) {
      setMessage({ type:"success", title:"🐄 Bonus Opieki!", text: bonusMessages.join(" · ") });
    }
  }, [barnNow]); // eslint-disable-line react-hooks/exhaustive-deps
  // ─── SAD: cykl produkcji owoców (analogicznie do zwierząt, ale bez głodu) ───
  React.useEffect(() => {
    let changed = false;
    const next: OrchardState = { ...orchardState };
    // Bonus z eq "% speed drzew" przyspiesza wzrost (max -70%)
    const treeSpeedPct = getEquipBonusPct("% speed drzew", charEquipped) / 100;
    const speedMult = Math.max(0.30, 1 - treeSpeedPct);
    // Skill Sadownik (rate 0.005) → mnożnik liczby owoców (więcej owoców z drzewa)
    const sadownikBonus = calcStatEffect(playerStats?.sadownik ?? 0, 0.005) / 100;
    // Szczęście + eq "% bonus drop" → szansa na rare/golden
    const luckPct = calcStatEffect(playerStats?.szczescie ?? 0, 0.0025) + getEquipBonusPct("% bonus drop", charEquipped);
    TREES.forEach(t => {
      const st = next[t.id];
      if (!st || st.owned === 0) return;
      const ns = { ...st, storage: { ...st.storage } };
      const effMs = Math.max(60_000, Math.round(t.growthTimeMs * speedMult));
      if (ns.prodStart === 0) { ns.prodStart = barnNow; changed = true; next[t.id] = ns; return; }
      const elapsed = barnNow - ns.prodStart;
      if (elapsed >= effMs) {
        // Liczba pełnych cykli (offline-safe). Limit storage = ~5 cykli per drzewo (żeby nie nazbierało za dużo).
        const STORAGE_CYCLE_CAP = 5;
        const totalStored = ns.storage.zwykly + ns.storage.soczysty + ns.storage.zloty;
        const avgDropPerCycle = (t.dropMin + t.dropMax) / 2 * ns.owned;
        const freeCycles = Math.max(0, Math.floor((STORAGE_CYCLE_CAP * avgDropPerCycle - totalStored) / Math.max(1, avgDropPerCycle)));
        const fullCycles = Math.min(Math.floor(elapsed / effMs), freeCycles);
        if (fullCycles > 0) {
          for (let c = 0; c < fullCycles; c++) {
            for (let tree = 0; tree < ns.owned; tree++) {
              const baseDrop = t.dropMin + Math.floor(Math.random() * (t.dropMax - t.dropMin + 1));
              const totalDrop = Math.max(1, Math.round(baseDrop * (1 + sadownikBonus)));
              for (let f = 0; f < totalDrop; f++) {
                const q = rollFruitQuality(luckPct);
                ns.storage[q] += 1;
              }
            }
          }
          ns.prodStart = ns.prodStart + fullCycles * effMs;
          changed = true;
        } else if (freeCycles === 0) {
          // Pełny storage — wstrzymaj nowe cykle (jak u zwierząt)
          ns.prodStart = 0;
          changed = true;
        }
      }
      next[t.id] = ns;
    });
    if (changed) saveOrchardState(next);
  }, [barnNow]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const merged: Record<string,number> = { ...itemUpgRegistry };
    let changed = false;
    const ownedNext: Record<string, true> = { ...ownedEqItems };
    let ownedChanged = false;
    (["dlonie","nogi","glowa"] as EquipSlot[]).forEach(slot => {
      const eq = charEquipped[slot];
      if (eq) {
        if (eq.upg > 0 && (merged[eq.id] ?? 0) < eq.upg) { merged[eq.id] = eq.upg; changed = true; }
        if (!ownedNext[eq.id]) { ownedNext[eq.id] = true; ownedChanged = true; }
      }
    });
    if (changed) saveItemUpg(merged);
    if (ownedChanged) saveOwnedEqItems(ownedNext);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [equipmentSlots, setEquipmentSlots] = React.useState(1);
  const [equipment, setEquipment] = React.useState<string[]>([]);
  const prevLevelRef = React.useRef<number>(0);
  const lastLoadedUserIdRef = React.useRef<string | null>(null);
  const EQ_SLOT_COSTS = [0, 5000, 15000, 30000, 60000, 100000, 200000]; // slot 1 free, 2-7 paid
  const CROP_PRICES: Record<string,number> = {
    carrot:3.2,potato:4.8,tomato:6.4,cucumber:9.6,onion:14.4,garlic:19.2,
    lettuce:25.6,radish:35.2,beet:48.0,pepper:64.0,cabbage:88.0,broccoli:120.0,
    cauliflower:160.0,strawberry:208.0,raspberry:272.0,blueberry:352.0,
    eggplant:448.0,zucchini:576.0,watermelon:720.0,grape:880.0,pumpkin:1040.0,
    rapeseed:1200.0,sunflower:1440.0,chili:1760.0,asparagus:2240.0,
  };
  const avatarHoverTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [harvestLog, setHarvestLog] = React.useState<HarvestEvent[]>([]);
  const [harvestCountdown, setHarvestCountdown] = React.useState(25);
  const harvestEventIdRef = React.useRef(0);
  const rankingScrollRef = React.useRef<HTMLDivElement>(null);
  const harvestLogTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const farmAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const cityAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [musicVolume, setMusicVolume] = React.useState(0.4);
  const [musicMuted, setMusicMuted] = React.useState(false);
  const BACKPACK_POSITION_STORAGE_KEY = "plonopolis_backpack_position";

  function isPlotUnlocked(plotId: number) {
    return unlockedPlots.includes(plotId);
  }

  function getPlotUnlockCost(plotId: number) {
    return PLOT_UNLOCK_COSTS[plotId] ?? 0;
  }

  function resetLocalGameState() {
    setProfile(null);
    setSelectedPlotId(null);
    setUnlockedPlots(getDefaultUnlockedPlots());
    setPlotCrops({});
    setSeedInventory(getDefaultSeedInventory());
    setFarmUpgradeModal(null);
    setPlotToBuy(null);
    setIsFieldViewOpen(false);
    setSelectedSeedId(null);
    setSelectedTool(null);
    setIsDraggingBackpack(false);
  }

  function applyProfileState(rawProfile: unknown) {
    if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
      setProfile(null);
      setUnlockedPlots(getDefaultUnlockedPlots());
      setPlotCrops({});
      setSeedInventory(getDefaultSeedInventory());
      return null;
    }

    const source = rawProfile as Profile;

    const nextProfile: Profile = {
      ...source,
      level: Math.min(source.level ?? DEFAULT_LEVEL, MAX_LEVEL),
      xp: source.xp ?? DEFAULT_XP,
      xp_to_next_level: source.xp_to_next_level ?? DEFAULT_XP_TO_NEXT_LEVEL,
      money: source.money ?? DEFAULT_MONEY,
      location: source.location ?? DEFAULT_LOCATION,
      current_map: source.current_map ?? getMapForLevel(source.level),
    };

    setProfile(nextProfile);
    setUnlockedPlots(parseUnlockedPlots(source.unlocked_plots));
    setPlotCrops(parsePlotCrops(source.plot_crops));

    // Migracja: jeśli DB ma stare klucze (np. "carrot"), zapisz do DB nowe ("carrot_good")
    const _rawInv = source.seed_inventory as Record<string, unknown> | null | undefined;
    const _needsMigration = !!_rawInv && Object.keys(_rawInv).some(k => {
      const { quality } = parseQualityKey(k);
      return quality === null && CROPS.some(c => c.id === k);
    });
    const _migratedInv = parseSeedInventory(source.seed_inventory);
    setSeedInventory(_migratedInv);
    const _rawHive = source.hive_data as Record<string,unknown> | null | undefined;
    const _hiveSavedStart = typeof _rawHive?.honey_start === "number" ? _rawHive.honey_start : null;
    const _hiveNow = Date.now();
    const _needsHiveStart = _hiveSavedStart === null && !!source.id;
    const _hiveStart = _needsHiveStart ? _hiveNow : _hiveSavedStart;
    const _parsedHive: HiveData = {
      level:           typeof _rawHive?.level === "number" ? Math.max(1,Math.min(5,_rawHive.level)) : 1,
      bees_progress:   typeof _rawHive?.bees_progress === "number" ? _rawHive.bees_progress : 0,
      honey_start:     _hiveStart,
      suit_durability: typeof _rawHive?.suit_durability === "number" ? _rawHive.suit_durability : 0,
      empty_jars:      typeof _rawHive?.empty_jars === "number" ? _rawHive.empty_jars : 0,
      honey_jars:      typeof _rawHive?.honey_jars === "number" ? _rawHive.honey_jars : 0,
    };
    setHiveData(_parsedHive);
    if (_needsHiveStart) {
      void supabase.from("profiles").update({ hive_data: _parsedHive }).eq("id", source.id!);
    }
    if (_needsMigration && source.id) {
      void supabase.from("profiles").update({ seed_inventory: _migratedInv }).eq("id", source.id);
    }

    if (source.id && lastLoadedUserIdRef.current !== source.id) {
      lastLoadedUserIdRef.current = source.id;
      const d = loadAvatarDataLS(source.id);
      // localStorage = zawsze aktualne (zapis synchroniczny)
      // Supabase = tylko dla nowych urządzeń (brak localStorage)
      const hasSkinLS  = localStorage.getItem(`plonopolis_skin_${source.id}`) !== null;
      const hasStatsLS = localStorage.getItem(`plonopolis_stats_${source.id}`) !== null;
      const hasFspLS   = localStorage.getItem(`plonopolis_fsp_${source.id}`) !== null;
      const hasPrevLS  = localStorage.getItem(`plonopolis_prevlv_${source.id}`) !== null;
      const skin = hasSkinLS ? d.skin
        : (source.avatar_skin !== null && source.avatar_skin !== undefined && source.avatar_skin >= 0)
          ? source.avatar_skin : 0;
      const stats: PlayerStatsMap = hasStatsLS ? d.stats
        : (source.player_stats && typeof source.player_stats === "object" && !Array.isArray(source.player_stats))
          ? source.player_stats as PlayerStatsMap : { ...DEFAULT_STATS };
      const fsp = hasFspLS ? (d.fsp ?? 3)
        : (source.free_skill_points !== null && source.free_skill_points !== undefined)
          ? source.free_skill_points : 3;
      const prevLevel = hasPrevLS ? (d.prevLevel || (source.level ?? 1))
        : (source.prev_level !== null && source.prev_level !== undefined && source.prev_level > 0)
          ? source.prev_level : (source.level ?? 1);
      setAvatarSkin(skin);
      setPlayerStats(stats);
      setFreeSkillPoints(fsp);
      prevLevelRef.current = prevLevel;
      // Ekwipunek
      const hasEqSlotsLS = localStorage.getItem(`plonopolis_eqslots_${source.id}`) !== null;
      const hasEqLS = localStorage.getItem(`plonopolis_eq_${source.id}`) !== null;
      const eqSlots = hasEqSlotsLS
        ? Number(localStorage.getItem(`plonopolis_eqslots_${source.id}`) ?? "1")
        : (source.equipment_slots ?? 1);
      const eq: string[] = hasEqLS
        ? JSON.parse(localStorage.getItem(`plonopolis_eq_${source.id}`) ?? "[]")
        : (Array.isArray(source.equipment) ? source.equipment : []);
      setEquipmentSlots(eqSlots);
      setEquipment(eq);
      localStorage.setItem(`plonopolis_eqslots_${source.id}`, String(eqSlots));
      localStorage.setItem(`plonopolis_eq_${source.id}`, JSON.stringify(eq));
      // Epickie avatary — zawsze z DB (nie z localStorage)
      setUnlockedEpicAvatars(Array.isArray(source.unlocked_epic_avatars) ? source.unlocked_epic_avatars : []);
      // Zawsze aktualizuj localStorage
      saveAvatarDataLS(source.id, skin, stats, fsp, prevLevel);
      // Zsynchronizuj Supabase tylko gdy skin jest prawidłowy (nie zapisuj -1 do bazy)
      if (skin >= 0) {
        void supabase.rpc("game_save_avatar_data", {
          p_avatar_skin: skin,
          p_player_stats: stats as Record<string, number>,
          p_free_skill_points: fsp,
          p_prev_level: prevLevel,
        });
      }
    } else if (source.id) {
      const prevLevel = (source.prev_level !== null && source.prev_level !== undefined && source.prev_level > 0)
        ? source.prev_level : prevLevelRef.current;
      if (prevLevel > prevLevelRef.current) prevLevelRef.current = prevLevel;
    }

    return nextProfile;
  }

  function extractRpcProfile(data: unknown) {
    return Array.isArray(data) ? data[0] : data;
  }

  const displayLocation = profile?.location ?? DEFAULT_LOCATION;
  const displayLevel = profile?.level ?? DEFAULT_LEVEL;
  const displayXp = profile?.xp ?? DEFAULT_XP;
  const displayXpToNextLevel = profile?.xp_to_next_level ?? DEFAULT_XP_TO_NEXT_LEVEL;
  const displayMoney = profile?.money ?? DEFAULT_MONEY;
  const currentMap = profile?.current_map ?? getMapForLevel(profile?.level);
  const isOnFarmMap = currentMap.startsWith("farm");
  const backgroundMap = getDisplayBackgroundMap(currentMap);

  const xpPercent = useMemo(() => {
    if (!displayXpToNextLevel || displayXpToNextLevel <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((displayXp / displayXpToNextLevel) * 100)));
  }, [displayXp, displayXpToNextLevel]);

  const moneyFormatted = useMemo(() => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(displayMoney);
  }, [displayMoney]);

  const moneyFontSize = useMemo(() => {
    const len = moneyFormatted.length;
    if (len > 14) return "text-sm leading-tight";
    if (len > 11) return "text-base leading-tight";
    if (len > 8)  return "text-xl leading-tight";
    return "text-2xl";
  }, [moneyFormatted]);

  const availableCrops = CROPS.filter((crop) => displayLevel >= crop.unlockLevel);
  const cropsInInventory = availableCrops.filter((crop) => (seedInventory[crop.id] ?? 0) > 0);

  function moveSelection(direction: "up" | "down" | "left" | "right") {
    const current = selectedPlotId ?? 1;

    let row = Math.floor((current - 1) / 5);
    let col = (current - 1) % 5;

    if (direction === "up" && row > 0) row -= 1;
    if (direction === "down" && row < 4) row += 1;
    if (direction === "left" && col > 0) col -= 1;
    if (direction === "right" && col < 4) col += 1;

    const nextPlotId = row * 5 + col + 1;
    setSelectedPlotId(nextPlotId);
  }

  function confirmSelectedPlot() {
    if (!selectedPlotId) return;

    if (!isPlotUnlocked(selectedPlotId)) {
      setPlotToBuy(selectedPlotId);
      return;
    }

    if (selectedTool === "watering_can") {
      handleWaterPlot(selectedPlotId);
      return;
    }

    if (selectedTool === "sickle") {
      void handleHarvestPlot(selectedPlotId);
      return;
    }

    if (selectedSeedId) {
      handlePlantFromSelectedSeed(selectedPlotId);
      return;
    }

    const plot = getPlotCrop(selectedPlotId);
    if (plot.cropId && isCropReady(selectedPlotId)) {
      void handleHarvestPlot(selectedPlotId);
      return;
    }

    setMessage({
      type: "info",
      title: `Pole #${selectedPlotId}`,
      text: "Wybierz nasiono z plecaka albo kliknij narzędzie.",
    });
  }

  function getPlotCrop(plotId: number) {
    return plotCrops[plotId] ?? buildEmptyPlotCrop();
  }

  function getPlantedCrop(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId) return null;
    return CROPS.find((item) => item.id === plot.cropId) ?? null;
  }

  function getEffectiveGrowthTimeMs(plotId: number) {
    const plot = getPlotCrop(plotId);
    const crop = getPlantedCrop(plotId);
    if (!crop) return 0;

    // Wiedza efektywna = bazowa + flat bonus z eq (np. Kapelusz Mistrza Farmy +5)
    const wiedzaEffective = (playerStats.wiedza ?? 0) + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
    const wiedzaBonus = calcStatEffect(wiedzaEffective, WIEDZA_RATE) / 100;
    const wiedzaMult = Math.max(WIEDZA_MULT_MIN, 1 - wiedzaBonus);
    const hiveMult = Math.max(HIVE_MULT_MIN, 1 - hiveData.level * 0.02);
    // Bonus kompostu Wzrostu: -5/10/15% czasu wzrostu (× boost z eq "% efekt kompostu")
    const compostBoost = 1 + getEquipBonusPct("% efekt kompostu", charEquipped) / 100;
    const compostMult = (plot.compostBonus?.type === "growth")
      ? Math.max(COMPOST_MULT_MIN, 1 - (plot.compostBonus.value * compostBoost / 100))
      : 1;
    // Bonus z eq: % speed upraw (sumarycznie ze wszystkich slotów)
    const equipGrowthPct = getEquipBonusPct("% speed upraw", charEquipped) / 100;
    const equipGrowthMult = Math.max(EQUIP_GROWTH_MULT_MIN, 1 - equipGrowthPct);
    let totalMult: number;
    if (plot.watered) {
      const zaradnoscBonus = calcStatEffect(playerStats.zaradnosc, ZARADNOSC_RATE) / 100;
      // Bonus z eq: % efekt podlewania + % efekt wody (boost siły zaradności)
      const waterEqPct = (getEquipBonusPct("% efekt podlewania", charEquipped) + getEquipBonusPct("% efekt wody", charEquipped)) / 100;
      const totalWaterReduction = Math.min(WATER_BONUS_MAX, zaradnoscBonus * (1 + waterEqPct));
      const waterMult = Math.max(WATER_MULT_MIN, 1 - totalWaterReduction);
      totalMult = waterMult * wiedzaMult * hiveMult * compostMult * equipGrowthMult;
    } else {
      totalMult = wiedzaMult * hiveMult * compostMult * equipGrowthMult;
    }
    // Globalne minimum: nawet z full buildem nie schodzimy poniżej GROWTH_GLOBAL_MIN_MULT bazowego czasu
    return Math.round(crop.growthTimeMs * Math.max(GROWTH_GLOBAL_MIN_MULT, totalMult));
  }

  function getGrowthProgress(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return 0;

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) return 0;

    const elapsed = Date.now() - plot.plantedAt;
    return Math.max(0, Math.min(1, elapsed / getEffectiveGrowthTimeMs(plotId)));
  }

  function getGrowthStage(plotId: number) {
    const progress = getGrowthProgress(plotId);

    if (progress < 0.2) return 1;
    if (progress < 0.4) return 2;
    if (progress < 0.6) return 3;
    if (progress < 0.8) return 4;
    return 5;
  }

  function isCropReady(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return false;

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) return false;

    return Date.now() - plot.plantedAt >= getEffectiveGrowthTimeMs(plotId);
  }


  function getCropStageSprite(cropId: string, stage: number): string | null {
    const STAGED: Record<string, string> = {
      "carrot": "/carrot",
      "test_nasiono": "/carrot",
    };
    const base = STAGED[cropId];
    if (!base) return null;
    return `${base}_${stage}.gif`;
  }
  function getRemainingGrowthSeconds(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return 0;

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) return 0;

    const remaining = getEffectiveGrowthTimeMs(plotId) - (Date.now() - plot.plantedAt);
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  function formatHMS(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  async function handleWaterPlot(plotId: number) {
    if (!profile) return;

    const plot = getPlotCrop(plotId);
    const crop = getPlantedCrop(plotId);

    if (!crop || !plot.cropId) {
      setMessage({
        type: "info",
        title: "Brak uprawy",
        text: "Najpierw posadź roślinę na tym polu.",
      });
      return;
    }

    if (plot.watered) {
      setMessage({
        type: "info",
        title: "Pole już podlane",
        text: "To pole zostało już podlane.",
      });
      return;
    }

    if (isCropReady(plotId)) {
      setMessage({
        type: "info",
        title: "Uprawa gotowa",
        text: "Ta uprawa jest już gotowa do zbioru.",
      });
      return;
    }

    // Zachowaj bonus kompostu z pola PRZED wywołaniem RPC (na wypadek gdyby serwer go zgubił)
    const _preservedCompostBonus = plot.compostBonus ?? null;

    const { data, error } = await supabase.rpc("game_water_plot", {
      p_plot_id: plotId,
    });

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd podlewania",
        text: error.message,
      });
      return;
    }

    applyProfileState(extractRpcProfile(data));

    // Jeśli serwer zgubił bonus kompostu przy podlewaniu — przywróć go i zapisz
    if (_preservedCompostBonus && profile?.id) {
      setPlotCrops(prev => {
        const _curr = prev[plotId];
        if (!_curr || _curr.compostBonus) return prev;
        const _merged = { ...prev, [plotId]: { ..._curr, compostBonus: _preservedCompostBonus } };
        // Asynchronicznie persystuj scalone plot_crops
        void supabase.from("profiles").update({
          plot_crops: serializePlotCrops(_merged) as unknown as Record<string,unknown>,
        }).eq("id", profile.id);
        return _merged;
      });
    }

    const _zaradBonus = calcStatEffect(playerStats.zaradnosc, ZARADNOSC_RATE) / 100;
    const _waterEqPct = (getEquipBonusPct("% efekt podlewania", charEquipped) + getEquipBonusPct("% efekt wody", charEquipped)) / 100;
    const _zaradPct = Math.min(WATER_BONUS_MAX, _zaradBonus * (1 + _waterEqPct)) * 100;
    setMessage({
      type: "success",
      title: "Podlano pole 💧",
      text: _zaradPct > 0
        ? `${crop.name} urośnie o ${_zaradPct.toFixed(1)}% szybciej (Zaradność ${playerStats.zaradnosc}/100, max ${(WATER_BONUS_MAX*100).toFixed(0)}%).`
        : `${crop.name} podlana. Rozwijaj Zaradność, aby przyspieszać wzrost.`,
    });
  }

  async function handlePlantFromSelectedSeed(plotId: number, overrideSeedId?: string) {
    if (!profile) return;
    const effectiveSeedId = overrideSeedId ?? selectedSeedId;

    if (!effectiveSeedId) {
      setMessage({
        type: "info",
        title: "Brak nasiona",
        text: "Wybierz nasiono z plecaka.",
      });
      return;
    }

    const { baseCropId: _baseCropId, quality: _seedQuality } = parseQualityKey(effectiveSeedId);
      if (_seedQuality === "rotten") {
        setMessage({ type: "info", title: "Nie można posadzić", text: "Zepsuta uprawa nie nadaje się do sadzenia. Może przydać się do kompostu." });
        return;
      }
      const crop = CROPS.find((item) => item.id === _baseCropId);
    if (!crop) return;

    const plot = getPlotCrop(plotId);

    if (plot.cropId) {
      setMessage({
        type: "info",
        title: "Pole zajęte",
        text: "Na tym polu już coś rośnie.",
      });
      return;
    }

    const amount = seedInventory[effectiveSeedId] ?? 0;
    if (amount <= 0) {
      setMessage({
        type: "info",
        title: "Brak nasion",
        text: "Nie masz już tych nasion w plecaku.",
      });
      return;
    }

    // Blokada: na polu już trwa inna akcja
    if (pendingFieldActions[plotId]) {
      setMessage({ type: "info", title: "Akcja w toku", text: "Poczekaj aż zakończy się obecna akcja na polu." });
      return;
    }

    // Czas sadzenia z bonusem eq "% speed sadzenia"
    const _plantSpeedPct = getEquipBonusPct("% speed sadzenia", charEquipped);
    const _plantDurMs = Math.max(400, Math.round(BASE_PLANT_MS * (1 - Math.min(0.8, _plantSpeedPct / 100))));

    // Ustaw timer postępu — RPC wykona się po zakończeniu
    setPendingFieldActions(prev => ({
      ...prev,
      [plotId]: { kind: "plant", startMs: Date.now(), durationMs: _plantDurMs, seedId: effectiveSeedId },
    }));

    const _tid = setTimeout(() => {
      fieldActionTimeoutsRef.current.delete(plotId);
      void executePlantRpc(plotId, effectiveSeedId, _baseCropId, _seedQuality);
    }, _plantDurMs);
    fieldActionTimeoutsRef.current.set(plotId, _tid);
  }

  async function executePlantRpc(plotId: number, effectiveSeedId: string, _baseCropId: string, _seedQuality: string | null) {
    // Sprzątanie pendingActions niezależnie od wyniku — try/finally zawsze odpala
    const _clearPending = () => setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });

    try {
      if (!profile) { return; }
      const crop = CROPS.find((item) => item.id === _baseCropId);
      if (!crop) { return; }
      // Re-walidacja po upływie timera (gracz mógł w międzyczasie coś zmienić)
      // Używamy refs do FRESH state zamiast captured closures
      const _freshPlot: PlotCropState | undefined = plotCropsRef.current[plotId];
      if (_freshPlot?.cropId) {
        setMessage({ type: "info", title: "Pole zajęte", text: "Pole zostało zajęte zanim akcja się zakończyła." });
        return;
      }
      const _freshInv = seedInventoryRef.current;
      const _freshAmount = _freshInv[effectiveSeedId] ?? 0;
      if (_freshAmount <= 0) {
        setMessage({ type: "info", title: "Brak nasion", text: "W międzyczasie skończyły się nasiona." });
        return;
      }

      // Upewnij się że baza ma aktualny (po-migracyjny) format inwentarza
      // zanim serwer spróbuje go odczytać — używamy FRESH ref state
      if (profile.id) {
        await supabase
          .from("profiles")
          .update({ seed_inventory: serializeSeedInventory(_freshInv) })
          .eq("id", profile.id);
      }

      // Zachowaj bonus kompostu z pola PRZED wywołaniem RPC (na wypadek gdyby serwer go zgubił)
      const _preservedCompostBonus = _freshPlot?.compostBonus ?? null;

      const { data, error } = await supabase.rpc("game_plant_crop", {
        p_plot_id: plotId,
        p_crop_id: _baseCropId,
        p_seed_key: effectiveSeedId,
        p_planted_quality: _seedQuality ?? "good",
      });
      if (error) {
        setMessage({
          type: "error",
          title: "Błąd sadzenia",
          text: error.message,
        });
        return;
      }

      applyProfileState(extractRpcProfile(data));
      // Zapisz jakość zasadzonego nasiona (dla EXP przy zbiorze)
      if (typeof window !== "undefined" && profile?.id) {
        const _pqKey = `plonopolis_pq_${profile.id}_${plotId}`;
        localStorage.setItem(_pqKey, _seedQuality ?? "good");
      }

      // Jeśli serwer zgubił bonus kompostu przy sadzeniu — przywróć go i zapisz
      if (_preservedCompostBonus && profile?.id) {
        setPlotCrops(prev => {
          const _curr = prev[plotId];
          if (!_curr || _curr.compostBonus) return prev;
          const _merged = { ...prev, [plotId]: { ..._curr, compostBonus: _preservedCompostBonus } };
          // Asynchronicznie persystuj scalone plot_crops
          void supabase.from("profiles").update({
            plot_crops: serializePlotCrops(_merged) as unknown as Record<string,unknown>,
          }).eq("id", profile.id);
          return _merged;
        });
      }

      setMessage({
        type: "success",
        title: "Posadzono uprawę",
        text: `Posadzono ${crop.name.toLowerCase()} na polu #${plotId}.`,
      });
    } finally {
      _clearPending();
    }
  }

  function getMaxPlotsForLevel(level: number) {
    return Math.min(3 + Math.max(level - 1, 0), MAX_FIELDS);
  }

  function showFarmUpgradeModalOnce(userId: string, level: number) {
    if (Array.prototype.indexOf.call(FARM_UPGRADE_LEVELS, level) === -1) return;

    const modalData = getFarmUpgradeMessage(level);
    if (!modalData) return;

    if (typeof window === "undefined") return;

    const storageKey = getFarmUpgradeStorageKey(userId, level);
    const alreadySeen = window.localStorage.getItem(storageKey);

    if (alreadySeen === "1") return;

    setFarmUpgradeModal(modalData);
  }

  function closeFarmUpgradeModal() {
    if (typeof window !== "undefined" && profile && farmUpgradeModal) {
      const storageKey = getFarmUpgradeStorageKey(profile.id, farmUpgradeModal.level);
      window.localStorage.setItem(storageKey, "1");
    }

    setFarmUpgradeModal(null);
  }

  const unlockedPlotsCount = unlockedPlots.length;

  React.useEffect(() => {
    if (!profile?.id) return;
    const prev = prevLevelRef.current;
    if (!prev || prev === 0) { prevLevelRef.current = displayLevel; return; }
    if (displayLevel > prev) {
      prevLevelRef.current = displayLevel;
      localStorage.setItem(`plonopolis_prevlv_${profile.id}`, String(displayLevel));
    }
  }, [displayLevel, profile?.id]);

  useEffect(() => {
    document.body.style.overflowX = "hidden";
    return () => { document.body.style.overflowX = ""; };
  }, []);

  useEffect(() => {
    if (harvestLog.length === 0) { setHarvestCountdown(25); return; }
    // Reset countdown to 25 whenever new harvest comes in
    setHarvestCountdown(25);
    // Interval: tick every second
    const interval = setInterval(() => {
      setHarvestCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); setHarvestLog([]); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [harvestLog]);

  // ─── Farm music (zapamiętuje pozycję przy zmianie mapy) ───
  useEffect(() => {
    const isFarmMap = (FARM_MUSIC_MAPS as string[]).indexOf(currentMap) !== -1;
    if (!isFarmMap) {
      // Pauza zamiast resetu — przy powrocie wznowi w tym samym miejscu
      if (farmAudioRef.current && !farmAudioRef.current.paused) {
        farmAudioRef.current.pause();
      }
      return;
    }
    if (!farmAudioRef.current) {
      const audio = new Audio("/farm_music.mp3");
      audio.loop = true;
      audio.volume = musicMuted ? 0 : musicVolume;
      farmAudioRef.current = audio;
    }
    farmAudioRef.current.volume = musicMuted ? 0 : musicVolume;
    if (farmAudioRef.current.paused) {
      farmAudioRef.current.play().catch(() => {});
    }
    return () => {};
  }, [currentMap, musicVolume, musicMuted]);

  // ─── City music (zapamiętuje pozycję przy zmianie mapy) ───
  useEffect(() => {
    const isCityMap = (CITY_MUSIC_MAPS as string[]).indexOf(currentMap) !== -1;
    if (!isCityMap) {
      // Pauza zamiast resetu — przy powrocie wznowi w tym samym miejscu
      if (cityAudioRef.current && !cityAudioRef.current.paused) {
        cityAudioRef.current.pause();
      }
      return;
    }
    if (!cityAudioRef.current) {
      const audio = new Audio("/city_music.mp3");
      audio.loop = true;
      audio.volume = musicMuted ? 0 : musicVolume * 0.7;
      cityAudioRef.current = audio;
    }
    cityAudioRef.current.volume = musicMuted ? 0 : musicVolume * 0.7;
    if (cityAudioRef.current.paused) {
      cityAudioRef.current.play().catch(() => {});
    }
    return () => {};
  }, [currentMap, musicVolume, musicMuted]);

  // ─── Countdown timer ───
  useEffect(() => {
    if (composeCountdownSecs <= 0) return;
    const t = setInterval(() => {
      setComposeCountdownSecs(s => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [composeCountdownSecs]);

  // ─── Load blocked users from profile ───
  useEffect(() => {
    if (profile?.blocked_users) setBlockedUsers(profile.blocked_users.filter(Boolean) as string[]);
  }, [profile?.blocked_users]);

  // ─── Auto-polling nieprzeczytanych (co 30s) ───
  useEffect(() => {
    if (!profile?.id) return;
    const interval = setInterval(async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("to_user_id", profile.id)
        .eq("read", false)
        .eq("type", "received");
      if (typeof count === "number") setUnreadCount(count);
    }, 30000);
    return () => clearInterval(interval);
  }, [profile?.id]);
  // ─── Oznacz jako przeczytane gdy gracz patrzy na zakładkę Otrzymane ───
  useEffect(() => {
    if (showMessagePanel && messageTab === "otrzymane") {
      void markAsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMessagePanel, messageTab]);


  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          await loadProfile(session.user.id);
        }
      } catch (error) {
        console.error("BOOTSTRAP ERROR:", error);
        if (mounted) {
          setMessage({
            type: "error",
            title: "Błąd połączenia",
            text: "Nie udało się wczytać sesji gracza.",
          });
        }
      } finally {
        if (mounted) setReady(true);
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  // ─── Powitanie nowego gracza ───
  useEffect(() => {
    if (!profile?.id) return;
    const key = `plonopolis_welcome_${profile.id}`;
    if (!localStorage.getItem(key)) {
      setShowWelcome(true);
    }
  }, [profile?.id]);

  useEffect(() => {
    const checkScreen = () => {
      const isSmall = window.innerWidth < 1024;
      setIsDesktop(!isSmall);
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);

    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!isFieldViewOpen) return;

    const interval = setInterval(() => {
      setGrowthTick((prev) => prev + 1);
    }, 500);

    return () => clearInterval(interval);
  }, [isFieldViewOpen]);

  // Tick dla pasków postępu sadzenia/zbioru — działa tylko gdy są aktywne akcje
  useEffect(() => {
    if (Object.keys(pendingFieldActions).length === 0) return;
    const interval = setInterval(() => {
      setPendingTick(prev => prev + 1);
    }, 60);
    return () => clearInterval(interval);
  }, [pendingFieldActions]);

  // Synchronizuj refs ze świeżym state (dla setTimeout callbackach)
  useEffect(() => { seedInventoryRef.current = seedInventory; }, [seedInventory]);
  useEffect(() => { plotCropsRef.current = plotCrops; }, [plotCrops]);

  // Cleanup wszystkich pending setTimeout przy unmount komponentu
  useEffect(() => {
    return () => {
      fieldActionTimeoutsRef.current.forEach(id => clearTimeout(id));
      fieldActionTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isFieldViewOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "enter",
          " ",
          "escape",
        ].includes(key)
      ) {
        e.preventDefault();
      }

      if (key === "w" || key === "arrowup") {
        moveSelection("up");
      } else if (key === "s" || key === "arrowdown") {
        moveSelection("down");
      } else if (key === "a" || key === "arrowleft") {
        moveSelection("left");
      } else if (key === "d" || key === "arrowright") {
        moveSelection("right");
      } else if (key === "enter" || key === " ") {
        confirmSelectedPlot();
      } else if (key === "escape") {
        setIsFieldViewOpen(false);
        setSelectedPlotId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFieldViewOpen, selectedPlotId, unlockedPlots, displayLevel, plotCrops, selectedTool, selectedSeedId]);

  useEffect(() => {
    if (!showRankingPanel) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowRankingPanel(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showRankingPanel]);

  useEffect(() => {
    if (!showDomModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowDomModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showDomModal]);

  useEffect(() => {
    if (!showSadModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowSadModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSadModal]);
  React.useEffect(() => {
    if (!showStodolaModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowStodolaModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showStodolaModal]);
  React.useEffect(() => {
    if (!showShopModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowShopModal(false); setShopCart({}); setShopError(""); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showShopModal]);
  React.useEffect(() => {
    if (!showUlModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowUlModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showUlModal]);
  React.useEffect(() => {
    if (currentMap !== "city_townhall") return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleChangeMap("city"); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentMap]);
  React.useEffect(() => {
    if (!showUlModal) return;
    const t = setInterval(() => setHiveNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [showUlModal]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedPosition = window.localStorage.getItem(BACKPACK_POSITION_STORAGE_KEY);
    if (!savedPosition) {
      setBackpackPosition({ x: 0, y: 0 });
      return;
    }

    try {
      const parsed = JSON.parse(savedPosition) as { x?: number; y?: number };
      setBackpackPosition({
        x: typeof parsed?.x === "number" ? parsed.x : 0,
        y: typeof parsed?.y === "number" ? parsed.y : 0,
      });
    } catch {
      setBackpackPosition({ x: 0, y: 0 });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BACKPACK_POSITION_STORAGE_KEY, JSON.stringify(backpackPosition));
  }, [backpackPosition]);

  useEffect(() => {
    if (!isDraggingBackpack) return;

    const handlePointerMove = (event: PointerEvent) => {
      const panelWidth = isBackpackOpen ? 460 : 64;
      const panelHeight = isBackpackOpen ? 760 : 64;
      const nextX = Math.max(-8, Math.min(window.innerWidth - panelWidth - 16, event.clientX - dragOffset.x));
      const nextY = Math.max(-8, Math.min(window.innerHeight - panelHeight - 16, event.clientY - dragOffset.y));
      setBackpackPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDraggingBackpack(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingBackpack, dragOffset, isBackpackOpen]);

  function startBackpackDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setIsDraggingBackpack(true);
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }
  async function loadProfile(_userId?: string) {
    const { data, error } = await supabase.rpc("game_get_my_profile");

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd profilu",
        text: error.message,
      });
      return null;
    }

    return applyProfileState(extractRpcProfile(data));
  }

  async function persistPlotCrops(nextPlotCrops: Record<number, PlotCropState>, userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        plot_crops: serializePlotCrops(nextPlotCrops),
        last_played_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return error;
  }

  async function persistSeedInventory(nextSeedInventory: SeedInventory, userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        seed_inventory: serializeSeedInventory(nextSeedInventory),
        last_played_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return error;
  }

  function isEmailValid(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const login = registerForm.login.trim();
    const email = registerForm.email.trim();
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;

    if (!login || !email || !password || !confirmPassword) {
      setMessage({
        type: "error",
        title: "Brak danych",
        text: "Uzupełnij wszystkie pola rejestracji.",
      });
      return;
    }

    if (login.length < 3) {
      setMessage({
        type: "error",
        title: "Login jest za krótki",
        text: "Login powinien mieć minimum 3 znaki.",
      });
      return;
    }

    if (!isEmailValid(email)) {
      setMessage({
        type: "error",
        title: "Nieprawidłowy email",
        text: "Podaj poprawny adres email.",
      });
      return;
    }

    if (password.length < 6) {
      setMessage({
        type: "error",
        title: "Hasło jest za krótkie",
        text: "Hasło powinno mieć minimum 6 znaków.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({
        type: "error",
        title: "Hasła nie są zgodne",
        text: "Pole „hasło” i „powtórz hasło” muszą być identyczne.",
      });
      return;
    }

    const { data: existingLogin, error: existingLoginError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("login", login)
      .limit(1);

    if (existingLoginError) {
      setMessage({
        type: "error",
        title: "Błąd sprawdzania loginu",
        text: existingLoginError.message,
      });
      return;
    }

    if (existingLogin && existingLogin.length > 0) {
      setMessage({
        type: "error",
        title: "Login zajęty",
        text: "Ten login już istnieje. Wybierz inny.",
      });
      return;
    }

    const { data: existingEmail, error: existingEmailError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1);

    if (existingEmailError) {
      setMessage({
        type: "error",
        title: "Błąd sprawdzania emaila",
        text: existingEmailError.message,
      });
      return;
    }

    if (existingEmail && existingEmail.length > 0) {
      setMessage({
        type: "error",
        title: "Email zajęty",
        text: "Na ten adres email konto już zostało utworzone.",
      });
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setMessage({
        type: "error",
        title: "Błąd rejestracji",
        text: signUpError.message,
      });
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      setMessage({
        type: "info",
        title: "Sprawdź pocztę",
        text: "Konto zostało utworzone. Dokończ aktywację z linku w emailu, jeśli masz włączone potwierdzanie adresu.",
      });
      return;
    }

    setUnlockedPlots(getDefaultUnlockedPlots());
    setPlotCrops({});
    setSeedInventory(getDefaultSeedInventory());
    await loadProfile(userId);

    setRegisterForm({
      login: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    setTab("login");
    setMessage({
      type: "success",
      title: "Konto utworzone",
      text: "Nowy gracz startuje z 3 darmowymi polami.",
    });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const identifier = loginForm.identifier.trim();
    const password = loginForm.password;

    if (!identifier || !password) {
      setMessage({
        type: "error",
        title: "Brak danych",
        text: "Podaj email oraz hasło.",
      });
      return;
    }

    if (!isEmailValid(identifier)) {
      setMessage({
        type: "error",
        title: "Nieprawidłowy email",
        text: "Zaloguj się używając adresu email.",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password,
    });

    if (error) {
      setMessage({
        type: "error",
        title: "Błędne logowanie",
        text: error.message,
      });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      await loadProfile(session.user.id);
    }

    setLoginForm({ identifier: "", password: "" });
    setMessage({
      type: "success",
      title: "Witaj ponownie",
      text: "Sesja gracza została wczytana.",
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    resetLocalGameState();
    setMessage({
      type: "info",
      title: "Wylogowano",
      text: "Sesja została zakończona.",
    });
  }

  async function handleAddGold(amount: number) {
    if (!profile?.id) return;
    const { error } = await supabase.from("profiles").update({ money: (profile.money ?? 0) + amount }).eq("id", profile.id);
    if (!error) await loadProfile(profile.id);
  }

  async function handleAddSeeds(amount: number) {
    if (!profile?.id) return;
    const baseCropIds = CROPS.filter(c => c.id !== "test_nasiono").map(c => c.id);
    const qualityKeys: string[] = CROPS.filter(c => c.id !== "test_nasiono" && c.epicSpritePath).flatMap(c => [`${c.id}_epic`, `${c.id}_rotten`, `${c.id}_legendary`]);
    const allKeys = [...baseCropIds, ...qualityKeys];
    const newInv: Record<string,number> = { ...seedInventory };
    for (const id of allKeys) newInv[id] = (newInv[id] ?? 0) + amount;
    const { error } = await supabase.from("profiles").update({ seed_inventory: newInv }).eq("id", profile.id);
    if (!error) await loadProfile(profile.id);
  }

  async function handleAddEpic(amount: number) {
    if (!profile?.id) return;
    const newInv: Record<string,number> = { ...seedInventory };
    CROPS.filter(c => c.id !== "test_nasiono" && c.epicSpritePath).forEach(c => {
      newInv[`${c.id}_epic`] = (newInv[`${c.id}_epic`] ?? 0) + amount;
    });
    const { error } = await supabase.from("profiles").update({ seed_inventory: newInv }).eq("id", profile.id);
    if (!error) await loadProfile(profile.id);
  }

  async function handleAddLegendary(amount: number) {
    if (!profile?.id) return;
    const newInv: Record<string,number> = { ...seedInventory };
    CROPS.filter(c => c.id !== "test_nasiono" && c.legendarySpritePath).forEach(c => {
      newInv[`${c.id}_legendary`] = (newInv[`${c.id}_legendary`] ?? 0) + amount;
    });
    const { error } = await supabase.from("profiles").update({ seed_inventory: newInv }).eq("id", profile.id);
    if (!error) await loadProfile(profile.id);
  }

  async function handleResetAccount() {
    if (!profile?.id) return;
    if (!confirm(
      "⚠️ RESET KONTA — co zostanie zresetowane:\n" +
      "• Poziom, XP, pieniądze\n" +
      "• Uprawy i nasiona\n" +
      "• Statystyki i punkty umiejętności\n" +
      "• Avatar i dom\n\n" +
      "✅ Co NIE zostanie zresetowane:\n" +
      "• Ul i pszczoły\n" +
      "• Słoiki i strój pszczelarza\n" +
      "• Ekwipunek (odzież)\n\n" +
      "Kontynuować?"
    )) return;
    if (!confirm("Ostatnie potwierdzenie — na pewno chcesz zresetować konto?")) return;
    const xpNeeded = getXpForLevel(1);
    const { error } = await supabase.from("profiles").update({
      level: 1, xp: 0, xp_to_next_level: xpNeeded, money: 10,
      location: "farm1", current_map: "farm1",
      unlocked_plots: [1], plot_crops: {}, seed_inventory: {},
      avatar_skin: -1, player_stats: {}, free_skill_points: 3, prev_level: 1,
      equipment_slots: 1, equipment: [], unlocked_epic_avatars: [],
    }).eq("id", profile.id);
    if (!error) {
      lastLoadedUserIdRef.current = null;
      setEquipmentSlots(1); setEquipment([]);
      setUnlockedEpicAvatars([]);
      setPlayerStats({ ...DEFAULT_STATS }); setFreeSkillPoints(3); setAvatarSkin(-1);
      saveAvatarDataLS(profile.id, -1, { ...DEFAULT_STATS }, 3, 1);
      await loadProfile(profile.id);
    }
  }

  async function handleAddExp(amount: number) {
    if (!profile) return;
    const nextXp = displayXp + amount;
    let nextLevel = displayLevel;
    let nextXpStored = nextXp;
    let nextXpToNextLevel = displayXpToNextLevel;
    while (nextXpStored >= nextXpToNextLevel && nextLevel < MAX_LEVEL) {
      nextLevel = Math.min(nextLevel + 1, MAX_LEVEL);
      nextXpStored = nextXpStored - nextXpToNextLevel;
      nextXpToNextLevel = getXpForLevel(nextLevel);
    }
    if (nextLevel >= MAX_LEVEL) { nextLevel = MAX_LEVEL; nextXpStored = 0; nextXpToNextLevel = 0; }
    const nextMap = getMapForLevel(nextLevel);
    const { error } = await supabase.from("profiles").update({
      level: nextLevel, xp: nextXpStored, xp_to_next_level: nextXpToNextLevel,
      location: displayLocation, current_map: nextMap, last_played_at: new Date().toISOString(),
    }).eq("id", profile.id);
    if (error) { setMessage({ type: "error", title: "Błąd zapisu", text: error.message }); return; }
    await loadProfile(profile.id);
    setMessage({ type: "success", title: "EXP dodany!", text: `+${amount.toLocaleString("pl-PL")} EXP` });
  }

  async function handleUnlockPlot(plotId: number) {
    if (!profile) return;

    if (isPlotUnlocked(plotId)) {
      setMessage({
        type: "info",
        title: "Pole już odblokowane",
        text: `Pole #${plotId} jest już dostępne.`,
      });
      return;
    }

    const plotCost = getPlotUnlockCost(plotId);

    if (displayMoney < plotCost) {
      setMessage({
        type: "error",
        title: "Za mało pieniędzy",
        text: `Potrzebujesz ${plotCost} PLN, aby kupić pole #${plotId}.`,
      });
      return;
    }

    const { data, error } = await supabase.rpc("game_unlock_plot", {
      p_plot_id: plotId,
    });

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd zakupu pola",
        text: error.message,
      });
      return;
    }

    applyProfileState(extractRpcProfile(data));

    setPlotToBuy(null);
    setSelectedPlotId(plotId);

    setMessage({
      type: "success",
      title: "Pole odblokowane",
      text: `Kupiono pole #${plotId} za ${plotCost} PLN.`,
    });
  }

  async function confirmBuyPlot() {
    if (!plotToBuy) return;
    await handleUnlockPlot(plotToBuy);
  }

  // ─── KOMPOSTOWNIK: aplikacja kompostu na pole ───
  async function applyCompostToPlot(plotId: number, compostKey: string) {
    const t = compostTypeFromKey(compostKey);
    if (!t) return;
    if (!profile?.id) return;
    if ((seedInventory[compostKey] ?? 0) <= 0) {
      setMessage({ type:"info", title:"Brak kompostu", text:"Nie masz tego kompostu w plecaku." });
      return;
    }
    const plot = getPlotCrop(plotId);
    if (plot.cropId) {
      setMessage({ type:"info", title:"Pole zajęte", text:"Kompost stosuje się na PUSTE pole — przed posadzeniem uprawy." });
      return;
    }
    if (plot.compostBonus) {
      setMessage({ type:"info", title:"Już wzbogacone", text:"To pole ma już aktywny kompost. Posadź na nim uprawę." });
      return;
    }
    // Wartość bonusu jest ZASZYTA w kluczu kompostu (np. compost_growth_15 → 15)
    const value = compostValueFromKey(compostKey);
    const nextPlot: PlotCropState = { ...plot, compostBonus: { type: t, value } };
    const nextPlots = { ...plotCrops, [plotId]: nextPlot };
    setPlotCrops(nextPlots);
    // Update inventory
    const nextInv = { ...seedInventory };
    nextInv[compostKey] = (nextInv[compostKey] ?? 0) - 1;
    const ranOut = nextInv[compostKey] <= 0;
    if (ranOut) delete nextInv[compostKey];
    setSeedInventory(nextInv);
    // Jeśli to ostatni kompost danego rodzaju — zdejmij zaznaczenie
    if (ranOut) setSelectedSeedId(prev => prev === compostKey ? null : prev);
    // Persist
    await supabase.from("profiles").update({
      plot_crops: serializePlotCrops(nextPlots) as unknown as Record<string,unknown>,
      seed_inventory: nextInv,
    }).eq("id", profile.id);
    // Notice
    setCompostNotice({ type: t, value, plotId });
    setTimeout(() => setCompostNotice(null), 5000);
  }

  // ─── KOMPOSTOWNIK: wrzuć plon → +1 do bieżącej partii + dolicz wartość (base × rzadkość) do scoreSum ───
  async function depositCropToCompost(seedKey: string, count: number = 1) {
    if (kompostBusyRef.current) return; // chroni przed double-click race
    kompostBusyRef.current = true;
    try {
      const have = seedInventory[seedKey] ?? 0;
      if (have <= 0) return;
      // Parsuj jakość z klucza (np. "carrot_legendary" → baseCropId="carrot", quality="legendary")
      const { baseCropId, quality } = parseQualityKey(seedKey);
      const cropDef = CROPS.find(c => c.id === baseCropId);
      const baseValue = cropDef ? (COMPOST_BASE_VALUE_BY_LEVEL[cropDef.unlockLevel] ?? 1.0) : 1.0;
      const rarityKey = (quality ?? "good") as keyof typeof COMPOST_RARITY_MULT;
      const rarityMult = COMPOST_RARITY_MULT[rarityKey] ?? 1.0;
      const valuePerCrop = baseValue * rarityMult;

      const batches: CompostBatch[] = kompostBatches.map(b => ({ fill: b.fill, scoreSum: b.scoreSum }));
      let remaining = Math.min(count, have);
      let added = 0;
      while (remaining > 0) {
        let last = batches[batches.length - 1];
        // Jeśli brak partii lub ostatnia jest pełna — utwórz nową (o ile mieści się w cap)
        if (!last || last.fill >= 10) {
          if (batches.length >= KOMPOST_MAX_BATCHES) break;
          last = { fill: 0, scoreSum: 0 };
          batches.push(last);
        }
        const room = 10 - last.fill;
        const take = Math.min(remaining, room);
        last.fill += take;
        last.scoreSum += take * valuePerCrop;
        remaining -= take;
        added += take;
      }
      if (added <= 0) return;

      const nextInv = { ...seedInventory };
      nextInv[seedKey] = have - added;
      if (nextInv[seedKey] <= 0) delete nextInv[seedKey];
      setSeedInventory(nextInv);
      saveKompostBatches(batches);
      if (profile?.id) {
        await supabase.from("profiles").update({ seed_inventory: nextInv }).eq("id", profile.id);
      }
    } finally {
      kompostBusyRef.current = false;
    }
  }

  // ─── KOMPOSTOWNIK: odbierz nagrody — każda gotowa partia (fill=10) = 1 nagroda z TIEREM zależnym od score ───
  async function claimKompostReward() {
    if (kompostBusyRef.current) return; // chroni przed double-click race
    kompostBusyRef.current = true;
    try {
    const readyBatches = kompostBatches.filter(b => b.fill >= 10);
    if (readyBatches.length <= 0) return;
    const playerLvl = profile?.level ?? 1;
    const rewards: KompostRewardEntry[] = [];
    let inv = { ...seedInventory };
    let owned = { ...ownedEqItems };
    let upgReg = { ...itemUpgRegistry };
    let extras = [...extraEqItems];

    for (const batch of readyBatches) {
      const score = batch.scoreSum / 10;
      const quality = getCompostQualityFromScore(score);
      const roll = Math.random() * 100;
      // 10% — przedmiot ekwipunku z TIEREM wg jakości kompostu
      if (roll < 10) {
        const tierIdx = rollFromChances(ITEM_TIER_BY_QUALITY[quality]); // 0..4
        const minLvl = tierIdx * 5 + 1;
        const maxLvl = tierIdx * 5 + 5;
        // Najpierw spróbuj puli w wylosowanym tierze (i ograniczonej do poziomu gracza)
        let pool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= minLvl && it.unlockLevel <= maxLvl && it.unlockLevel <= playerLvl);
        // Fallback w dół: jeśli gracz nie ma jeszcze tego tieru — schodź do niższych
        if (pool.length === 0) {
          for (let t = tierIdx - 1; t >= 0; t--) {
            const altMin = t * 5 + 1;
            const altMax = t * 5 + 5;
            pool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= altMin && it.unlockLevel <= altMax && it.unlockLevel <= playerLvl);
            if (pool.length > 0) break;
          }
        }
        if (pool.length > 0) {
          const item = pool[Math.floor(Math.random() * pool.length)];
          if (!owned[item.id]) {
            owned = { ...owned, [item.id]: true as const };
          } else {
            const newUpg = 0;
            const curUpg = upgReg[item.id] ?? 0;
            if (newUpg > curUpg) {
              extras = [...extras, { uid: makeExtraUid(), id: item.id, upg: curUpg }];
              upgReg = { ...upgReg, [item.id]: newUpg };
            } else {
              extras = [...extras, { uid: makeExtraUid(), id: item.id, upg: newUpg }];
            }
          }
          rewards.push({ kind:"item", itemId: item.id, itemName: item.name, itemIcon: item.icon });
          continue;
        }
        // Brak żadnego dostępnego przedmiotu → fallback do kompostu
      }
      // 90% (lub fallback): kompost growth/yield/exp — równe szanse 30/30/30, TIER deterministyczny wg jakości
      let compostType: CompostType;
      const r2 = Math.random() * 90;
      if (r2 < 30) compostType = "growth";
      else if (r2 < 60) compostType = "yield";
      else compostType = "exp";
      const tierIdx = COMPOST_TIER_FIXED_BY_QUALITY[quality]; // 0=Słaby / 1=Średni / 2=Mocny
      const value = COMPOST_DEFS[compostType].bonusValues[tierIdx];
      const key = compostKeyFor(compostType, value);
      inv = { ...inv, [key]: (inv[key] ?? 0) + 1 };
      rewards.push({ kind:"compost", compostType, value });
    }

    // Usuń skonsumowane partie (pełne); zachowaj niepełne; dosyp pending legacy charges (z migracji nadwyżki)
    const remainingBatches = kompostBatches.filter(b => b.fill < 10);
    consumePendingLegacyCharges(remainingBatches);
    setSeedInventory(inv);
    saveOwnedEqItems(owned);
    saveItemUpg(upgReg);
    saveExtraEqItems(extras);
    saveKompostBatches(remainingBatches);
    if (profile?.id) {
      await supabase.from("profiles").update({ seed_inventory: inv }).eq("id", profile.id);
    }
    setKompostRewards(rewards);
    } finally {
      kompostBusyRef.current = false;
    }
  }

  async function handleHarvestPlot(
    plotId: number,
    _skipTimer: boolean = false,
    _snapBonusesArg?: { extraHarvestPct?: number; bonusDropPct?: number; expPct?: number },
  ) {
    if (!profile) return;

    const plot = getPlotCrop(plotId);
    if (!plot.cropId) {
      setMessage({
        type: "info",
        title: "Puste pole",
        text: "Najpierw coś posadź na tym polu.",
      });
      return;
    }

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) {
      setMessage({
        type: "error",
        title: "Nieznana uprawa",
        text: "Nie udało się rozpoznać uprawy na tym polu.",
      });
      return;
    }

    if (!isCropReady(plotId)) {
      setMessage({
        type: "info",
        title: "Uprawa jeszcze rośnie",
        text: `${crop.name} będzie gotowa za około ${formatHMS(getRemainingGrowthSeconds(plotId))}.`,
      });
      return;
    }

    // ─── Pasek postępu zbioru ───
    if (!_skipTimer) {
      // Blokada: na polu już trwa inna akcja
      if (pendingFieldActions[plotId]) {
        setMessage({ type: "info", title: "Akcja w toku", text: "Poczekaj aż zakończy się obecna akcja na polu." });
        return;
      }
      // Czas zbioru z bonusem eq "% speed zbioru"
      const _harvestSpeedPct = getEquipBonusPct("% speed zbioru", charEquipped);
      const _harvestDurMs = Math.max(400, Math.round(BASE_HARVEST_MS * (1 - Math.min(0.8, _harvestSpeedPct / 100))));
      // SNAPSHOT bonusów eq w momencie kliknięcia — używane po zakończeniu timera.
      // Dzięki temu gracz nie może wyexploitować przebierania w trakcie akcji.
      const _harvestBonusesSnapshot = {
        extraHarvestPct: getEquipBonusPct("% extra harvest", charEquipped),
        bonusDropPct:    getEquipBonusPct("% bonus drop", charEquipped),
        expPct:          getEquipBonusPct("% EXP", charEquipped) + getEquipBonusPct("% EXP z upraw", charEquipped),
      };
      setPendingFieldActions(prev => ({
        ...prev,
        [plotId]: { kind: "harvest", startMs: Date.now(), durationMs: _harvestDurMs, bonusesSnapshot: _harvestBonusesSnapshot },
      }));
      const _tid = setTimeout(() => {
        fieldActionTimeoutsRef.current.delete(plotId);
        // Przekazujemy snapshot BEZPOŚREDNIO (closure-safe) — nie czytamy go z React state,
        // bo setTimeout zamyka się nad starym stanem (sprzed setPendingFieldActions)
        void handleHarvestPlot(plotId, true, _harvestBonusesSnapshot);
      }, _harvestDurMs);
      fieldActionTimeoutsRef.current.set(plotId, _tid);
      return;
    }
    // Timer dobiegł końca — sprawdź FRESH state (gracz mógł zmienić w międzyczasie)
    {
      const _freshPlot = plotCropsRef.current[plotId];
      if (!_freshPlot?.cropId) {
        setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });
        setMessage({ type: "info", title: "Pole opróżnione", text: "Uprawa zniknęła zanim akcja się zakończyła." });
        return;
      }
    }
    // SNAPSHOT bonusów z chwili kliknięcia — przekazany BEZPOŚREDNIO przez parametr
    // (nie z React state, bo setTimeout closure ma stale state). Chroni przed exploitem
    // przebierania w trakcie timera. Brak snapshotu = błąd ścieżki — używamy 0 (bezpieczny default).
    const _snapBonuses = _snapBonusesArg;
    if (!_snapBonuses) {
      console.warn(`[harvest] Brak snapshotu bonusów dla pola ${plotId} — używam zer.`);
    }
    // Zdejmij wskaźnik paska, kontynuuj RPC
    setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });

    const previousLevel = displayLevel;
    const prevXp = displayXp;
    const prevXpToNext = displayXpToNextLevel;

    const effectiveGrowMs = getEffectiveGrowthTimeMs(plotId);
    const prevInventorySnapshot: Record<string, number> = { ...seedInventory };
    // jakość PLONU jest losowana osobno dla każdej sztuki — patrz niżej
    // Jakość ZASADZONEGO nasiona (decyduje o EXP) — z localStorage
    // Jakość ZASADZONEGO nasiona (z pola w DB — bez localStorage)
    const _plantedQualityRaw = getPlotCrop(plotId).plantedQuality ?? "good";
    const _plantedQuality = (["good","epic","rotten","legendary"].includes(_plantedQualityRaw) ? _plantedQualityRaw : "good") as "good"|"epic"|"rotten"|"legendary";
    const _plantedQDef = CROP_QUALITY_DEFS[_plantedQuality as keyof typeof CROP_QUALITY_DEFS] ?? CROP_QUALITY_DEFS["good"];

    // ─── Legendarny drop — losuj PRZED wywołaniem RPC ───
    // 0 = zwykłe (15-100 szt.), 1 = epickie (5-15 szt.), 2 = EXP (15-30x)
    let _legOption = -1;
    let _legExpMult = 0;
    if (_plantedQuality === "legendary") {
      _legOption = Math.floor(Math.random() * 3);
      if (_legOption === 2) {
        _legExpMult = Math.floor(Math.random() * 16) + 15; // 15–30
      }
    }

    // ─── Epicki EXP — losowy mnożnik 3–6x ───
    let _epicExpMult = 0;
    if (_plantedQuality === "epic") {
      _epicExpMult = Math.floor(Math.random() * 4) + 3; // 3–6
    }

    // ─── Parametry bonusów do RPC (atomicznie po stronie SQL — anti-race) ───
    // Dla legendarnych: zerujemy compost/extra/bonusDrop (klient sam aplikuje legendarny dropy).
    const _plotPreRpc = getPlotCrop(plotId);
    const _compostBonusForRpc = _plotPreRpc.compostBonus ?? null;
    const _compostYieldExtraForRpc = (_plantedQuality !== "legendary" && _compostBonusForRpc?.type === "yield")
      ? (_compostBonusForRpc.value ?? 0)
      : 0;
    const _extraHarvestPctForRpc = _plantedQuality !== "legendary" ? (_snapBonuses?.extraHarvestPct ?? 0) : 0;
    const _bonusDropPctForRpc    = _plantedQuality !== "legendary" ? (_snapBonuses?.bonusDropPct ?? 0) : 0;

    const { data, error } = await supabase.rpc("game_harvest_plot", {
      p_plot_id: plotId,
      p_effective_grow_ms: effectiveGrowMs,
      p_zrecznosc: playerStats.zrecznosc ?? 0,
      // Dla legendarnych: zawsze "good" (uprawa bazowa), mult. EXP override osobno
      p_planted_quality: _plantedQuality === "legendary" ? "good" : _plantedQuality,
      // -1 = wymuś 0 EXP (leg. opcja 0/1 — tylko plony); 0 = jakość decyduje; >0 = dokładny mnożnik
      p_exp_mult_override: _plantedQuality === "legendary"
        ? (_legOption === 2 ? _legExpMult : -1)
        : _epicExpMult,
      // Atomicznie po stronie SQL (eliminuje race condition przy zbiorze wielu pól naraz)
      p_compost_yield_extra: _compostYieldExtraForRpc,
      p_extra_harvest_pct:   _extraHarvestPctForRpc,
      p_bonus_drop_pct:      _bonusDropPctForRpc,
    });
    if (error) {
      setMessage({ type: "error", title: "Błąd zbioru", text: error.message });
      return;
    }

    // Nowy format RPC: { profile: {...}, zrecznosc_triggered: bool }
    const _rpcWrapper = data as { profile?: unknown; zrecznosc_triggered?: boolean };
    const harvestRpcProfile = extractRpcProfile(_rpcWrapper.profile ?? data);
    const rpcProf = harvestRpcProfile as Profile;
    const rpcInv = (rpcProf?.seed_inventory && typeof rpcProf.seed_inventory === "object")
      ? rpcProf.seed_inventory as Record<string, number>
      : {};
    const _zrecznoscionTriggered = _rpcWrapper.zrecznosc_triggered ?? false;

    // Buduj nextInventory:
    // - dla legendarnych: SQL nie dodał itemów — startujemy od snapshotu i dodajemy ręcznie
    // - dla nie-legendarnych: SQL już zapisał jakościowe klucze — używamy rpcInv jako bazę
    let nextInventory: Record<string, number>;
    let _totalYield = 0;

    if (_plantedQuality === "legendary") {
      nextInventory = { ...prevInventorySnapshot };
      if (_legOption === 0) {
        // Opcja 1: 15–100 zwykłych
        const _legGood = Math.floor(Math.random() * 86) + 15;
        nextInventory[getQualityKey(crop.id, "good")] = (nextInventory[getQualityKey(crop.id, "good")] ?? 0) + _legGood;
        _totalYield = _legGood;
      } else if (_legOption === 1) {
        // Opcja 2: 5–15 epickich
        const _legEpic = Math.floor(Math.random() * 11) + 5;
        nextInventory[getQualityKey(crop.id, "epic")] = (nextInventory[getQualityKey(crop.id, "epic")] ?? 0) + _legEpic;
        _totalYield = _legEpic;
      } else {
        // Opcja 3: tylko EXP (15–30x) — bez upraw
        _totalYield = 0;
      }
    } else {
      // SQL zapisał jakości per sztuka — buduj z rpcInv (pełne inventory po zbiorze)
      const _rawNext: Record<string, number> = {};
      for (const [_k, _v] of Object.entries(rpcInv)) {
        if (typeof _v === "number") _rawNext[_k] = _v;
      }
      // Migracja: usuń stare klucze bez sufiksu jakości (np. "carrot" → "carrot_good")
      nextInventory = parseSeedInventory(_rawNext);
      // Oblicz łączny zysk (diff) dla _totalYield
      _totalYield = (["rotten","good","epic","legendary"] as CropQuality[]).reduce((_s, _q) => {
        const _key = getQualityKey(crop.id, _q);
        return _s + Math.max(0, (nextInventory[_key] ?? 0) - (prevInventorySnapshot[_key] ?? 0));
      }, 0);
    }

    // ─── Bonus z kompostu (zachowany — używany do EXP bonus i notice) ───
    const _compostBonusOnPlot = plot.compostBonus ?? null;

    // ─── Wartości zwrócone przez RPC (atomicznie aplikowane przez SQL) ───
    // SQL już dodał: bazowy yield + zręczność + compost yield + % extra harvest + % bonus drop.
    // Eliminuje race condition przy zbiorze wielu pól naraz.
    const _gainedGood   = (typeof (_rpcWrapper as { gained_good?: unknown }).gained_good   === "number") ? (_rpcWrapper as { gained_good: number }).gained_good   : 0;
    const _gainedEpic   = (typeof (_rpcWrapper as { gained_epic?: unknown }).gained_epic   === "number") ? (_rpcWrapper as { gained_epic: number }).gained_epic   : 0;
    const _gainedRotten = (typeof (_rpcWrapper as { gained_rotten?: unknown }).gained_rotten === "number") ? (_rpcWrapper as { gained_rotten: number }).gained_rotten : 0;
    if (_plantedQuality !== "legendary") {
      // Dla NIE-legendarnych: SQL jest źródłem prawdy. nextInventory = sparsowany rpcInv.
      // Nie liczymy diff'a względem prevInventorySnapshot (race-prone) — używamy gained_* z RPC.
      _totalYield = _gainedGood + _gainedEpic + _gainedRotten;
    }

    // Zastosuj wynik RPC (XP, poziom, pola) — profil z poprawnym parserem wrappera
    const nextProfile = applyProfileState(harvestRpcProfile);
    // Synchronizacja stanu klienta z DB
    setSeedInventory(nextInventory);
    // Dla LEGENDARNYCH klient sam nadpisał inventory (decyduje o opcji 0/1/2) — zapisz do DB.
    // Dla nie-legendarnych: SQL jest źródłem prawdy, NIE nadpisujemy DB pełnym obiektem
    // (chroni przed race condition przy zbiorze wielu pól naraz).
    if (_plantedQuality === "legendary") {
      await supabase.from("profiles").update({ seed_inventory: nextInventory }).eq("id", profile!.id);
    }

    if (nextProfile && (nextProfile.level ?? DEFAULT_LEVEL) > previousLevel) {
      showFarmUpgradeModalOnce(nextProfile.id, nextProfile.level ?? DEFAULT_LEVEL);
    }

    // Oblicz faktyczny EXP przyznany przez Supabase
    let actualExp = crop.expReward;
    if (rpcProf) {
      if ((rpcProf.level ?? previousLevel) > previousLevel) {
        actualExp = (prevXpToNext - prevXp) + (rpcProf.xp ?? 0);
      } else {
        actualExp = Math.max(0, (rpcProf.xp ?? 0) - prevXp);
      }
    }

    // ─── Bonusy EXP: kompost Nauki + eq (% EXP, % EXP z upraw) ───
    let _bonusExpTotal = 0;
    if (_compostBonusOnPlot?.type === "exp" && actualExp > 0) {
      _bonusExpTotal += Math.round(actualExp * (_compostBonusOnPlot.value / 100));
    }
    // Używamy SNAPSHOTU z chwili kliknięcia (anti-exploit przebierania)
    const _expEqPct = _snapBonuses?.expPct ?? 0;
    if (_expEqPct > 0 && actualExp > 0) {
      _bonusExpTotal += Math.round(actualExp * (_expEqPct / 100));
    }
    if (_bonusExpTotal > 0 && profile?.id) {
      // Pełna obsługa level-upu klient-side (jak handleAddExp)
      const _baseXp = (rpcProf?.xp ?? 0);
      const _baseLevel = (rpcProf?.level ?? previousLevel);
      const _baseXpToNext = (rpcProf?.xp_to_next_level ?? DEFAULT_XP_TO_NEXT_LEVEL);
      let _newXp = _baseXp + _bonusExpTotal;
      let _newLevel = _baseLevel;
      let _newXpToNext = _baseXpToNext;
      while (_newXp >= _newXpToNext && _newLevel < MAX_LEVEL) {
        _newLevel += 1;
        _newXp = _newXp - _newXpToNext;
        _newXpToNext = getXpForLevel(_newLevel);
      }
      if (_newLevel >= MAX_LEVEL) { _newLevel = MAX_LEVEL; _newXp = 0; _newXpToNext = 0; }
      const _updateData: Record<string, unknown> = {
        xp: _newXp,
        level: _newLevel,
        xp_to_next_level: _newXpToNext,
      };
      // Levelup spowodowany bonusem → zmień też mapę (jak po normalnym lvl up)
      if (_newLevel > _baseLevel) {
        _updateData.current_map = getMapForLevel(_newLevel);
        _updateData.location = getMapForLevel(_newLevel);
      }
      await supabase.from("profiles").update(_updateData).eq("id", profile.id);
      setProfile(p => p ? {
        ...p,
        xp: _newXp,
        level: _newLevel,
        xp_to_next_level: _newXpToNext,
        ...(_newLevel > _baseLevel ? { current_map: getMapForLevel(_newLevel), location: getMapForLevel(_newLevel) } : {}),
      } : p);
      actualExp += _bonusExpTotal;
      if (_newLevel > _baseLevel) {
        showFarmUpgradeModalOnce(profile.id, _newLevel);
      }
    }

    // ─── Powiadomienie o aktywacji kompostu ───
    if (_compostBonusOnPlot) {
      setCompostNotice({ type: _compostBonusOnPlot.type, value: _compostBonusOnPlot.value, plotId });
      setTimeout(() => setCompostNotice(null), 5000);
    }

    // Dodaj do logu zbiorów
    if (_plantedQuality === "legendary") {
      const _now = Date.now();
      if (_legOption === 0) {
        // Opcja 1: zwykłe uprawy
        const _legGood = Math.max(0, (nextInventory[getQualityKey(crop.id, "good")] ?? 0) - (prevInventorySnapshot[getQualityKey(crop.id, "good")] ?? 0));
        setHarvestLog(prev => [
          ...prev.filter(e => _now - e.timestamp < 25000),
          { id: ++harvestEventIdRef.current, cropId: crop.id, cropName: crop.name, baseAmount: _legGood, bonusAmount: 0, bonusSource: "🌟 Legendarne", baseExp: actualExp, timestamp: _now, quality: "good" as const },
        ]);
      } else if (_legOption === 1) {
        // Opcja 2: epickie uprawy
        const _legEpic = Math.max(0, (nextInventory[getQualityKey(crop.id, "epic")] ?? 0) - (prevInventorySnapshot[getQualityKey(crop.id, "epic")] ?? 0));
        setHarvestLog(prev => [
          ...prev.filter(e => _now - e.timestamp < 25000),
          { id: ++harvestEventIdRef.current, cropId: crop.id, cropName: crop.name, baseAmount: _legEpic, bonusAmount: 0, bonusSource: "🌟 Legendarne", baseExp: actualExp, timestamp: _now, quality: "epic" as const },
        ]);
      } else {
        // Opcja 3: tylko EXP
        setHarvestLog(prev => [
          ...prev.filter(e => _now - e.timestamp < 25000),
          { id: ++harvestEventIdRef.current, cropId: crop.id, cropName: crop.name, baseAmount: 0, bonusAmount: 0, bonusSource: `×${_legExpMult}`, baseExp: actualExp, timestamp: _now, quality: "legendary" as const },
        ]);
      }
    } else {
      const _now2 = Date.now();
      // Wartości z RPC (atomicznie aplikowane przez SQL) — eliminuje race vs prevSnap.
      const _qualGained: Record<CropQuality, number> = {
        good:      _gainedGood,
        epic:      _gainedEpic,
        rotten:    _gainedRotten,
        legendary: 0,
      };
      const _diffQuals = (["rotten","good","epic","legendary"] as CropQuality[]).filter(_q => _qualGained[_q] > 0);
      const _logEvents = _diffQuals.map((_q, _idx) => {
        return {
          id: ++harvestEventIdRef.current,
          cropId: crop.id,
          cropName: crop.name,
          baseAmount: _qualGained[_q],
          bonusAmount: 0,
          bonusSource: _idx === 0 && _zrecznoscionTriggered ? "Zręczność 🎯" : null,
          baseExp: _idx === 0 ? actualExp : 0,
          timestamp: _now2,
          quality: _q,
        };
      });
      setHarvestLog(prev => [
        ...prev.filter(e => _now2 - e.timestamp < 25000),
        ..._logEvents,
      ]);
    }
  }

  async function handleChangeMap(targetMap: string) {
      if (!profile) return;

      setIsMapLoading(true);

      const { data: rpcData, error } = await supabase.rpc("game_change_map", {
        p_target_map: targetMap,
      });

      if (error) {
        setIsMapLoading(false);
        setMessage({ type: "error", title: "Błąd zmiany mapy", text: error.message });
        return;
      }

      const targetBg = getDisplayBackgroundMap(targetMap);
      await new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = `/${targetBg}.png`;
      });

      applyProfileState(extractRpcProfile(rpcData));
      setIsMapLoading(false);
      setIsFieldViewOpen(false);
      setSelectedPlotId(null);
      setPlotToBuy(null);
    }

  async function loadRanking() {
    setRankingLoading(true);
    const { data: rows, error } = await supabase.rpc("get_player_ranking");
    if (!error && rows) {
      setRankingData((rows as RankingPlayer[]).map(r => ({
        ...r,
        avatar_skin: (r.avatar_skin !== null && r.avatar_skin !== undefined) ? r.avatar_skin : 0,
      })));
    }
    setRankingLoading(false);
  }

  async function loadMessages() {
    if (!profile) return;
    setMessagesLoading(true);
    setMessagesError("");

    // 1. Skrzynka odbiorcza (wiadomości przysłane do mnie)
    const { data: inboxData, error } = await supabase
      .from("messages")
      .select("*")
      .eq("to_user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);

    // 2. Wiadomości systemowe
    const { data: sysData } = await supabase
      .from("messages")
      .select("*")
      .eq("type", "system")
      .order("created_at", { ascending: false })
      .limit(20);

    // 3. Wysłane przeze mnie — pobieramy kopię leżącą u odbiorcy (type="received", from_user_id=my.id)
    //    To daje nam prawdziwe to_user_id = odbiorca
    const { data: sentRaw } = await supabase
      .from("messages")
      .select("*")
      .eq("from_user_id", profile.id)
      .eq("type", "received")
      .order("created_at", { ascending: false })
      .limit(50);

    // 4. Rozwiąż loginy i avatary odbiorców dla wysłanych
    const recipientIds = Array.from(new Set(
      (sentRaw ?? []).map(m => m.to_user_id).filter(Boolean) as string[]
    ));
    const recipientLoginMap: Record<string, string> = {};
    const recipientAvatarMap: Record<string, number> = {};
    if (recipientIds.length > 0) {
      const { data: rProfiles } = await supabase
        .from("profiles")
        .select("id, username, login, avatar_skin")
        .in("id", recipientIds);
      (rProfiles ?? []).forEach((p: { id: string; username?: string | null; login: string; avatar_skin: number | null }) => {
        recipientLoginMap[p.id] = p.username ?? p.login;
        if (p.avatar_skin !== null && p.avatar_skin !== undefined) recipientAvatarMap[p.id] = p.avatar_skin;
      });
    }

    // 4b. Avatar nadawców dla otrzymanych wiadomości
    const senderIds = Array.from(new Set(
      (inboxData ?? []).map((m: { from_user_id: string | null }) => m.from_user_id).filter(Boolean) as string[]
    ));
    const senderAvatarMap: Record<string, number> = {};
    if (senderIds.length > 0) {
      const { data: sProfiles } = await supabase
        .from("profiles")
        .select("id, avatar_skin")
        .in("id", senderIds);
      (sProfiles ?? []).forEach((p: { id: string; avatar_skin: number | null }) => {
        if (p.avatar_skin !== null && p.avatar_skin !== undefined) senderAvatarMap[p.id] = p.avatar_skin;
      });
    }

    const sentMessages: GameMessage[] = (sentRaw ?? []).map(m => ({
      ...m,
      type: "sent" as const,
      // Priorytet: to_username z DB (nowe wiadomości), fallback: lookup z profiles (stare)
      to_username: (m.to_username as string | null) ?? recipientLoginMap[m.to_user_id ?? ""] ?? null,
      from_avatar_skin: avatarSkin >= 0 ? avatarSkin : 0,
      to_avatar_skin: recipientAvatarMap[m.to_user_id ?? ""] ?? 0,
    }));

    if (error) {
      console.error("[loadMessages] błąd:", error.message);
      setMessagesError("Błąd ładowania: " + error.message);
      setMessagesLoading(false);
      return;
    }

    // Skrzynka: tylko received i system (pomijamy stare kopie type="sent" przechowywane u nadawcy)
    const inboxMessages = ((inboxData ?? []).filter(
      m => m.type === "received" || m.type === "system"
    ) as GameMessage[]).map(m => ({
      ...m,
      from_avatar_skin: senderAvatarMap[m.from_user_id ?? ""] ?? 0,
    }));

    const combined: GameMessage[] = [
      ...inboxMessages,
      ...sentMessages,
      ...((sysData ?? []).filter(s => !inboxMessages.some(d => d.id === s.id)) as GameMessage[]),
    ];
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setGameMessages(combined);
    setUnreadCount(combined.filter(m => !m.read && m.to_user_id === profile.id && m.type === "received").length);
    setMessagesLoading(false);
  }

  async function searchPlayers(q: string) {
    if (q.trim().length < 2) { setRecipientSuggestions([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id,username")
      .ilike("username", `%${q.trim()}%`)
      .neq("id", profile?.id ?? "")
      .limit(8);
    setRecipientSuggestions((data as {id:string;username:string}[]) ?? []);
  }

  const MESSAGE_COST = 50;
  const MESSAGE_COOLDOWN_MS = 5 * 60 * 1000;

  async function sendMessage() {
    if (!recipientResolved || !profile) return;
    const subject = composeSubject.trim();
    const body = composeBody.trim();
    if (!subject) { setComposeError("Podaj temat wiadomości."); return; }
    if (!body) { setComposeError("Napisz treść wiadomości."); return; }
    if ((profile.money ?? 0) < MESSAGE_COST) {
      setComposeError(`Za mało pieniędzy. Wysłanie kosztuje ${MESSAGE_COST} 💰.`);
      return;
    }
    const lastSent = messageCooldowns[recipientResolved.id] ?? 0;
    const elapsed = Date.now() - lastSent;
    if (elapsed < MESSAGE_COOLDOWN_MS) {
      const secsLeft = Math.ceil((MESSAGE_COOLDOWN_MS - elapsed) / 1000);
      setComposeError(`Możesz napisać do tego gracza za ${secsLeft}s.`);
      setComposeCountdownSecs(secsLeft);
      return;
    }
    setComposeSending(true);
    setComposeError("");
    // Sprawdź czy odbiorca zablokował nadawcę
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("blocked_users")
      .eq("id", recipientResolved.id)
      .single();
    // Pobierz opłatę zawsze
    await supabase.from("profiles").update({ money: (profile.money ?? 0) - MESSAGE_COST }).eq("id", profile.id);
    const blockedByRecipient = ((recipientProfile as {blocked_users?:string[]|null})?.blocked_users ?? []).includes(profile.id);
    if (blockedByRecipient) {
      setComposeSending(false);
      setComposeError("Ta osoba cię zablokowała. Pobrano " + MESSAGE_COST + " 💰.");
      setMessageCooldowns(prev => ({ ...prev, [recipientResolved.id]: Date.now() }));
      return;
    }
    const fromUsername = (profile as {username?:string;login?:string}).username ?? profile.login ?? "Nieznany";
    const { error } = await supabase.rpc("send_game_message", {
      p_to_user_id:    recipientResolved.id,
      p_from_user_id:  profile.id,
      p_from_username: fromUsername,
      p_subject:       subject,
      p_body:          body,
      p_to_username:   recipientResolved.username,
    });
    setComposeSending(false);
    if (error) { setComposeError("Błąd wysyłania: " + error.message); return; }
    setMessageCooldowns(prev => ({ ...prev, [recipientResolved.id]: Date.now() }));
    setShowCompose(false);
    setComposeRecipient("");
    setComposeSubject("");
    setComposeBody("");
    setRecipientResolved(null);
    setRecipientSuggestions([]);
    void loadMessages();
  }

  function openComposeTo(userId: string, username: string) {
    setRecipientResolved({ id: userId, username });
    setComposeRecipient(username);
    setRecipientSuggestions([]);
    setComposeSubject("");
    setComposeBody("");
    setComposeError("");
    setShowCompose(true);
    setShowMessagePanel(true);
  }

  async function toggleSaveMessage(msgId: string, currentSaved: boolean) {
    const { error } = await supabase.from("messages").update({ saved: !currentSaved }).eq("id", msgId);
    if (!error) setGameMessages(prev => prev.map(m => m.id === msgId ? { ...m, saved: !currentSaved } : m));
  }

  async function deleteMessage(msgId: string) {
    if (!confirm("Usunąć tę wiadomość?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", msgId);
    if (error) {
      setMessage({ type: "error", title: "Błąd usuwania", text: "Nie udało się usunąć wiadomości." });
      return;
    }
    setGameMessages(prev => prev.filter(m => m.id !== msgId));
    setSelectedMsgIds(prev => { const n = new Set(prev); n.delete(msgId); return n; });
  }

  async function deleteSelectedMessages(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`Usunąć ${ids.length} zaznaczon${ids.length === 1 ? "ą" : ids.length < 5 ? "e" : "ych"} wiadomość${ids.length === 1 ? "" : ids.length < 5 ? "i" : "i"}?`)) return;
    const { error } = await supabase.from("messages").delete().in("id", ids);
    if (error) {
      setMessage({ type: "error", title: "Błąd usuwania", text: "Nie udało się usunąć zaznaczonych wiadomości." });
      return;
    }
    setGameMessages(prev => prev.filter(m => !ids.includes(m.id)));
    setSelectedMsgIds(new Set());
  }

  async function blockUser(fromUserId: string) {
    if (!profile) return;
    const current = (profile.blocked_users ?? []).filter(Boolean);
    if (current.includes(fromUserId)) return;
    const updated = [...current, fromUserId];
    await supabase.from("profiles").update({ blocked_users: updated }).eq("id", profile.id);
    setBlockedUsers(updated);
  }

  async function unblockUser(fromUserId: string) {
    if (!profile) return;
    const updated = (profile.blocked_users ?? []).filter(id => id !== fromUserId);
    await supabase.from("profiles").update({ blocked_users: updated }).eq("id", profile.id);
    setBlockedUsers(updated);
  }

  async function markAsRead() {
    if (!profile) return;
    const unreadIds = gameMessages
      .filter(m => !m.read && m.to_user_id === profile.id && m.type === "received")
      .map(m => m.id);
    if (unreadIds.length === 0) return;
    await supabase.from("messages").update({ read: true }).in("id", unreadIds);
    setGameMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, read: true } : m));
    setUnreadCount(0);
  }

    if (!isDesktop) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#1a130d] px-6 text-center text-[#f3e6c8]">
        <div className="max-w-md rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.95)] p-8 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Plonopolis</p>

          <h1 className="mt-4 text-3xl font-black text-[#f9e7b2]">Tylko komputer 🖥️</h1>

          <p className="mt-4 text-sm leading-6 text-[#dfcfab]">
            Gra jest obecnie dostępna tylko na komputerze.
            <br />
            <br />
            Wersja mobilna pojawi się w przyszłości jako aplikacja.
          </p>

          <div className="mt-6 animate-bounce text-4xl">🌾</div>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#1a130d] text-[#f3e6c8]">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-wide">Plonopolis</h1>
          <p className="mt-3 text-sm opacity-80">Ładowanie bramy do gospodarstwa...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black" onMouseMove={(e)=>setMousePos({x:e.clientX,y:e.clientY})}>
      <div
        ref={mapContainerRef}
        className="relative overflow-hidden"
        style={{
          aspectRatio: "3 / 2",
          width: "min(100vw, calc(100vh * 1.5))",
          height: "min(100vh, calc(100vw / 1.5))",
        }}
      >
        {/* Tło mapy — zmienia się wraz z poziomem gracza */}
        <img
          src={profile ? `/${backgroundMap}.png` : "/assetsmain-lobby.png"}
          alt="Mapa gry"
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          draggable={false}
          style={{imageRendering:"pixelated"}}
        />
        {isMapLoading && (
          <div className="pointer-events-none absolute inset-0 z-[200] flex flex-col items-center justify-center gap-8">
            <div className="w-[1280px] overflow-hidden rounded-full border-2 border-[#8b6a3e]/80 bg-black/70 backdrop-blur-sm shadow-2xl">
              <div className="h-10 rounded-full bg-gradient-to-r from-[#c9952f] via-[#f2ca69] to-[#c9952f] animate-pulse" style={{width:"100%"}} />
            </div>
            <p className="text-6xl font-black text-[#f9e7b2] drop-shadow-lg tracking-wide order-first">Ładowanie mapy...</p>
          </div>
        )}

        <div className="relative z-[1] h-full w-full">
          {profile && (
            <>
              <div className="fixed right-4 top-4 z-[90] flex gap-2">
                <button
                  onClick={handleLogout}
                  className="rounded-2xl border border-red-400/40 bg-red-950/40 px-4 py-2 font-bold text-red-100 backdrop-blur-sm transition hover:bg-red-950/60"
                >
                  Wyloguj
                </button>
              </div>

              {/* ═══ TESTY GRY BUTTON ═══ */}
              <style>{`
                @keyframes arrowBlink{0%,100%{opacity:0;transform:translateX(-6px)}50%{opacity:1;transform:translateX(0)}}
                @keyframes legendaryPulse{0%,100%{box-shadow:0 0 6px 2px rgba(245,158,11,0.55),0 0 14px 4px rgba(245,158,11,0.2);transform:scale(1)}50%{box-shadow:0 0 18px 7px rgba(245,158,11,0.9),0 0 36px 12px rgba(245,158,11,0.4);transform:scale(1.02)}}
                @keyframes legendaryShimmer{0%{opacity:0;transform:translateX(-120%) rotate(20deg)}60%{opacity:0.55}100%{opacity:0;transform:translateX(120%) rotate(20deg)}}

              `}</style>
              <div className="fixed right-4 z-[92] flex items-center gap-2" style={{ top: "85px" }}>
                <span className="text-3xl font-black text-orange-400 select-none" style={{animation:"arrowBlink 1.1s ease-in-out infinite",display:"inline-block"}}>➤</span>
                <button onClick={() => setShowTestModal(true)}
                  className="relative flex items-center gap-2 rounded-2xl border border-orange-500/70 bg-[rgba(38,14,4,0.92)] px-6 py-3 font-black text-orange-300 shadow-2xl backdrop-blur-sm transition hover:border-orange-400 hover:text-orange-200">
                  <span className="animate-pulse text-2xl">🧪</span>
                  <span className="text-base">Testy</span>
                  <span className="absolute -right-1 -top-1 flex h-3 w-3 rounded-full bg-orange-500 animate-ping" />
                </button>
              </div>

              {/* ═══ EDYTOR BUDYNKÓW + PRZYCISKÓW ═══ */}
              {(isOnFarmMap || currentMap === "city") && (
                <div className="fixed right-4 z-[92] flex flex-col gap-1" style={{ top: "140px" }}>
                  <button
                    type="button"
                    onClick={() => isOnFarmMap ? setNavEditMode(m => !m) : setCityNavEditMode(m => !m)}
                    className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black shadow-xl backdrop-blur-sm transition ${(isOnFarmMap ? navEditMode : cityNavEditMode) ? "border-sky-400 bg-sky-900/80 text-sky-300" : "border-[#8b6a3e]/70 bg-[rgba(22,13,8,0.92)] text-[#dfcfab]"}`}
                  >
                    🖱️ {(isOnFarmMap ? navEditMode : cityNavEditMode) ? "Zakończ etykiety" : "Edytuj etykiety"}
                  </button>
                  <button
                    type="button"
                    onClick={() => isOnFarmMap ? setHitboxEditMode(m => !m) : setCityHitboxEditMode(m => !m)}
                    className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black shadow-xl backdrop-blur-sm transition ${(isOnFarmMap ? hitboxEditMode : cityHitboxEditMode) ? "border-orange-400 bg-orange-900/80 text-orange-300" : "border-[#8b6a3e]/70 bg-[rgba(22,13,8,0.92)] text-[#dfcfab]"}`}
                  >
                    🎯 {(isOnFarmMap ? hitboxEditMode : cityHitboxEditMode) ? "Zakończ hitboxy" : "Edytuj hitboxy"}
                  </button>
                </div>
              )}

              {/* ═══ MUZYKA ═══ */}
              <div className="fixed right-4 z-[92]" style={{ top: "165px" }}>
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#8b6a3e]/70 bg-[rgba(22,13,8,0.92)] px-3 py-3 shadow-2xl backdrop-blur-sm w-[72px]">
                  {/* Ikona dźwięku */}
                  <button
                    type="button"
                    onClick={() => setMusicMuted(m => !m)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#8b6a3e]/50 bg-black/30 text-xl transition hover:border-[#d8ba7a]/50"
                    title={musicMuted ? "Włącz muzykę" : "Wycisz muzykę"}
                  >
                    {musicMuted ? "🔇" : musicVolume < 0.15 ? "🔈" : musicVolume < 0.6 ? "🔉" : "🔊"}
                  </button>

                  {/* Suwak pionowy */}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={musicMuted ? 0 : musicVolume}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      setMusicVolume(v);
                      if (v > 0 && musicMuted) setMusicMuted(false);
                      if (v === 0) setMusicMuted(true);
                    }}
                    className="h-24 w-2 cursor-pointer appearance-none rounded-full bg-[#3a2510] accent-[#d8ba7a]"
                    style={{ writingMode: "vertical-lr", direction: "rtl" }}
                    title="Głośność muzyki"
                  />

                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#8b6a3e]">
                    {musicMuted ? "Wycisz" : `${Math.round((musicMuted ? 0 : musicVolume) * 100)}%`}
                  </p>
                </div>
              </div>

              <div className={`fixed left-1/2 top-4 z-[89] w-full max-w-[700px] -translate-x-1/2 px-4 transition-opacity duration-300 ${isFieldViewOpen ? "opacity-30" : "opacity-100"}`}>
                <div className="z-10 w-full rounded-[24px] border border-[#8b6a3e] bg-[rgba(33,20,12,0.88)] px-4 py-2 text-[#f5dfb0] shadow-2xl backdrop-blur-sm">
                  <div
                    className={`grid items-center gap-3 ${
                      displayLevel >= MAX_LEVEL ? "justify-center grid-cols-[auto_auto]" : "grid-cols-[1fr_auto_auto]"
                    }`}
                  >
                    <div className="rounded-2xl border border-[#8b6a3e] bg-black/20 px-4 py-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-center">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Poziom:</p>
                          <p className="text-2xl font-black text-white">{displayLevel}</p>
                          {displayLevel >= MAX_LEVEL && (
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-300">
                              MAX LEVEL
                            </p>
                          )}
                        </div>

                        <div className="min-w-[210px] flex-1">
                          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.15em] text-[#d8ba7a]">
                            <span>
                              EXP {displayXp} / {displayXpToNextLevel}
                            </span>
                            <span>{xpPercent}%</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-black/40">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#d9b15c,#f5de8b)]"
                              style={{ width: `${xpPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#8b6a3e] bg-black/20 px-4 py-2 text-center shrink-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Pieniądze</p>
                      <p className={`font-black text-white tabular-nums whitespace-nowrap ${moneyFontSize}`}>{moneyFormatted}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowMessagePanel(true); void loadMessages(); }}
                      className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#8b6a3e] bg-black/20 transition hover:bg-[rgba(80,50,20,0.4)]"
                      title="Wiadomości"
                    >
                      <img src="/mail.png" alt="Wiadomości" className="h-[128px] w-[128px] object-contain" style={{imageRendering:"pixelated"}} />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}


          {profile && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {isOnFarmMap && (
  <button
    type="button"
    onClick={() => {
      setIsFieldViewOpen(true);
      setSelectedPlotId((prev) => prev ?? 1);
    }}
    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
    style={{
      left: `${navHitboxPos.polaUprawne.left}%`,
      top: `${navHitboxPos.polaUprawne.top}%`,
      width: `${navHitboxPos.polaUprawne.width}%`,
      height: `${navHitboxPos.polaUprawne.height}%`,
      zIndex: 4,
    }}
    title="Pola uprawne"
  />
)}

                  {currentMap.startsWith("farm") && (
                      <>
                        {/* Dom — na drzwiach domu */}
                        <button
                          type="button"
                          onClick={() => { setShowDomModal(true); setDomTab("profil"); }}
                          title="Dom gracza"
                          className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                          style={{ left:`${navHitboxPos.dom.left}%`, top:`${navHitboxPos.dom.top}%`, width:`${navHitboxPos.dom.width}%`, height:`${navHitboxPos.dom.height}%`, zIndex: 20 }}
                        />
                        {/* Stodoła */}
                        <button
                          type="button"
                          onClick={() => setShowStodolaModal(true)}
                          title="Stodoła"
                          className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                          style={{ left:`${navHitboxPos.stodola.left}%`, top:`${navHitboxPos.stodola.top}%`, width:`${navHitboxPos.stodola.width}%`, height:`${navHitboxPos.stodola.height}%`, zIndex: 20 }}
                        />
                      {/* Do miasta */}
                      <button
                        type="button"
                        onClick={() => handleChangeMap("city")}
                        title="Do miasta"
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${navHitboxPos.doMiasta.left}%`, top:`${navHitboxPos.doMiasta.top}%`, width:`${navHitboxPos.doMiasta.width}%`, height:`${navHitboxPos.doMiasta.height}%`, zIndex: 20 }}
                      />
                      {/* Ul */}
                      <button
                        type="button"
                        title="Ul"
                        onClick={() => setShowUlModal(true)}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${navHitboxPos.ul.left}%`, top:`${navHitboxPos.ul.top}%`, width:`${navHitboxPos.ul.width}%`, height:`${navHitboxPos.ul.height}%`, zIndex: 20 }}
                      />
                      {/* Lada dla klientów — sprzedaż słoików miodu */}
                      <button
                        type="button"
                        title="Lada"
                        onClick={() => { setLadaSellQty(1); setLadaSelling(false); setShowLadaModal(true); }}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${navHitboxPos.lada.left}%`, top:`${navHitboxPos.lada.top}%`, width:`${navHitboxPos.lada.width}%`, height:`${navHitboxPos.lada.height}%`, zIndex: 20 }}
                      />
                      {/* Kompostownik */}
                      <button
                        type="button"
                        title="Kompostownik"
                        onClick={() => setShowKompostModal(true)}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${navHitboxPos.kompostownik.left}%`, top:`${navHitboxPos.kompostownik.top}%`, width:`${navHitboxPos.kompostownik.width}%`, height:`${navHitboxPos.kompostownik.height}%`, zIndex: 20 }}
                      />
                      {/* Sad */}
                      <button
                        type="button"
                        title="Sad"
                        onClick={() => setShowSadModal(true)}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${navHitboxPos.sad.left}%`, top:`${navHitboxPos.sad.top}%`, width:`${navHitboxPos.sad.width}%`, height:`${navHitboxPos.sad.height}%`, zIndex: 20 }}
                      />
                      {/* Etykiety nawigacyjne — niezależne od hitboxów */}
                      {(["dom","stodola","doMiasta","polaUprawne","ul","lada","kompostownik","sad"] as const).map(id => {
                        const labels: Record<string,string> = {dom:"Dom",stodola:"Stodoła",doMiasta:"Do miasta",polaUprawne:"Pola uprawne",ul:"Ul",lada:"Lada",kompostownik:"Kompostownik",sad:"Sad"};
                        const lp = navLabelPos[id];
                        return (
                          <div key={`lbl${id}`} className="pointer-events-none absolute select-none"
                            style={{left:`${lp.left}%`, top:`${lp.top}%`, transform:"translateX(-50%)", zIndex:22}}>
                            <span className="rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl whitespace-nowrap">
                              {labels[id]}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* ══ EDYTOR ETYKIET NAWIGACYJNYCH ══ */}
                  {navEditMode && isOnFarmMap && (
                    <div className="absolute inset-0 pointer-events-none" style={{zIndex:56}}>
                      {([
                        {id:"dom",          name:"Dom"},
                        {id:"stodola",      name:"Stodoła"},
                        {id:"doMiasta",     name:"Do miasta"},
                        {id:"polaUprawne",  name:"Pola uprawne"},
                        {id:"ul",           name:"Ul"},
                        {id:"lada",         name:"Lada"},
                        {id:"kompostownik", name:"Kompostownik"},
                        {id:"sad",          name:"Sad"},
                      ] as Array<{id:string,name:string}>).map(nb => {
                        const lp = navLabelPos[nb.id];
                        return (
                          <div key={`nle${nb.id}`}
                            className="absolute cursor-move pointer-events-auto select-none"
                            style={{
                              left:`${lp.left}%`, top:`${lp.top}%`,
                              transform:"translateX(-50%)",
                              border:"2px dashed #38bdf8",
                              background:"rgba(56,189,248,0.18)",
                              borderRadius:8, padding:"2px 4px",
                              userSelect:"none",
                            }}
                            onMouseDown={e => { e.preventDefault(); navLabelDragRef.current = {id:nb.id,startX:e.clientX,startY:e.clientY,startPos:{...lp}}; }}
                          >
                            <span className="block text-[9px] font-black text-sky-200 whitespace-nowrap leading-none text-center" style={{background:"rgba(0,0,0,0.7)",padding:"1px 3px",borderRadius:4}}>
                              {nb.name}<br/>
                              <span className="text-sky-400">{lp.left.toFixed(1)}% {lp.top.toFixed(1)}%</span>
                            </span>
                          </div>
                        );
                      })}
                      <div className="absolute bottom-2 right-2 rounded-xl border border-sky-600 bg-black/90 p-2 text-[10px] text-sky-200 max-w-[230px] pointer-events-auto" style={{zIndex:60}}>
                        <div className="font-black text-sky-400 mb-1">📋 Pozycje etykiet:</div>
                        {Object.entries(navLabelPos).map(([id,lp]) => <div key={id}>{id}: left={lp.left.toFixed(1)}% top={lp.top.toFixed(1)}%</div>)}
                      </div>
                    </div>
                  )}

                  {/* ══ EDYTOR HITBOXÓW ══ */}
                  {hitboxEditMode && isOnFarmMap && (
                    <div className="absolute inset-0 pointer-events-none" style={{zIndex:57}}>
                      {([
                        {id:"dom",          name:"Dom"},
                        {id:"stodola",      name:"Stodoła"},
                        {id:"doMiasta",     name:"Do miasta"},
                        {id:"polaUprawne",  name:"Pola uprawne"},
                        {id:"ul",           name:"Ul"},
                        {id:"lada",         name:"Lada"},
                        {id:"kompostownik", name:"Kompostownik"},
                        {id:"sad",          name:"Sad"},
                      ] as Array<{id:string,name:string}>).map(nb => {
                        const hp = navHitboxPos[nb.id];
                        return (
                          <div key={`hbe${nb.id}`}
                            className="absolute cursor-move pointer-events-auto select-none"
                            style={{
                              left:`${hp.left}%`, top:`${hp.top}%`,
                              width:`${hp.width}%`, height:`${hp.height}%`,
                              border:"2px dashed #f97316",
                              background:"rgba(249,115,22,0.15)",
                              borderRadius:4,
                              userSelect:"none",
                              boxSizing:"border-box",
                            }}
                            onMouseDown={e => { e.preventDefault(); navHitboxDragRef.current = {type:"move",id:nb.id,startX:e.clientX,startY:e.clientY,startPos:{...hp}}; }}
                          >
                            <span className="block text-[9px] font-black text-orange-200 whitespace-nowrap leading-none" style={{background:"rgba(0,0,0,0.75)",padding:"1px 4px",borderRadius:3,display:"inline-block"}}>
                              {nb.name} · {hp.left.toFixed(1)}% {hp.top.toFixed(1)}% · {hp.width.toFixed(1)}×{hp.height.toFixed(1)}
                            </span>
                            {/* uchwyt rozmiaru */}
                            <div
                              className="absolute bottom-0 right-0 cursor-se-resize pointer-events-auto"
                              style={{width:14,height:14,background:"#f97316",borderRadius:"3px 0 3px 0"}}
                              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); navHitboxDragRef.current = {type:"resize",id:nb.id,startX:e.clientX,startY:e.clientY,startPos:{...hp}}; }}
                            />
                          </div>
                        );
                      })}
                      <div className="absolute bottom-2 left-2 rounded-xl border border-orange-600 bg-black/90 p-2 text-[10px] text-orange-200 max-w-[270px] pointer-events-auto" style={{zIndex:60}}>
                        <div className="font-black text-orange-400 mb-1">📋 Pozycje hitboxów:</div>
                        {Object.entries(navHitboxPos).map(([id,hp]) => (
                          <div key={id}>{id}: {hp.left.toFixed(1)}% {hp.top.toFixed(1)}% {hp.width.toFixed(1)}%×{hp.height.toFixed(1)}%</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentMap === "city" && (
                    <>
                      {/* ── Hitboxy ── */}
                      <button
                        type="button"
                        onClick={() => handleChangeMap(getMapForLevel(profile?.level))}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${cityHitboxPos.naFarme.left}%`, top:`${cityHitboxPos.naFarme.top}%`, width:`${cityHitboxPos.naFarme.width}%`, height:`${cityHitboxPos.naFarme.height}%` }}
                        title="Na farmę"
                      />
                      <button
                        type="button"
                        onClick={() => { setShopTab("nasiona"); setShowShopModal(true); }}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${cityHitboxPos.sklep.left}%`, top:`${cityHitboxPos.sklep.top}%`, width:`${cityHitboxPos.sklep.width}%`, height:`${cityHitboxPos.sklep.height}%` }}
                        title="Sklep"
                      />
                      <button
                        type="button"
                        onClick={() => handleChangeMap("city_market")}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${cityHitboxPos.targ.left}%`, top:`${cityHitboxPos.targ.top}%`, width:`${cityHitboxPos.targ.width}%`, height:`${cityHitboxPos.targ.height}%` }}
                        title="Targ"
                      />
                      <button
                        type="button"
                        onClick={() => handleChangeMap("city_bank")}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${cityHitboxPos.bank.left}%`, top:`${cityHitboxPos.bank.top}%`, width:`${cityHitboxPos.bank.width}%`, height:`${cityHitboxPos.bank.height}%` }}
                        title="Bank"
                      />
                      <button
                        type="button"
                        onClick={() => handleChangeMap("city_townhall")}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${cityHitboxPos.ratusz.left}%`, top:`${cityHitboxPos.ratusz.top}%`, width:`${cityHitboxPos.ratusz.width}%`, height:`${cityHitboxPos.ratusz.height}%` }}
                        title="Ratusz"
                      />
                      {/* ── Etykiety ── */}
                      {([
                        {id:"naFarme", name:"Na farmę"},
                        {id:"sklep",   name:"Sklep"},
                        {id:"targ",    name:"Targ"},
                        {id:"bank",    name:"Bank"},
                        {id:"ratusz",  name:"Ratusz"},
                      ] as Array<{id:string,name:string}>).map(b => {
                        const lp = cityLabelPos[b.id];
                        return (
                          <span key={b.id} className="pointer-events-none absolute rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl -translate-x-1/2" style={{left:`${lp.left}%`,top:`${lp.top}%`}}>
                            {b.name}
                          </span>
                        );
                      })}

                      {/* ══ EDYTOR ETYKIET MIASTA ══ */}
                      {cityNavEditMode && (
                        <div className="absolute inset-0 pointer-events-none" style={{zIndex:56}}>
                          {([
                            {id:"naFarme", name:"Na farmę"},
                            {id:"sklep",   name:"Sklep"},
                            {id:"targ",    name:"Targ"},
                            {id:"bank",    name:"Bank"},
                            {id:"ratusz",  name:"Ratusz"},
                          ] as Array<{id:string,name:string}>).map(b => {
                            const lp = cityLabelPos[b.id];
                            return (
                              <div key={`cle${b.id}`}
                                className="absolute cursor-move pointer-events-auto select-none"
                                style={{ left:`${lp.left}%`, top:`${lp.top}%`, transform:"translateX(-50%)", border:"2px dashed #38bdf8", background:"rgba(56,189,248,0.18)", borderRadius:8, padding:"2px 4px", userSelect:"none" }}
                                onMouseDown={e => { e.preventDefault(); cityLabelDragRef.current = {id:b.id,startX:e.clientX,startY:e.clientY,startPos:{...lp}}; }}
                              >
                                <span className="block text-[9px] font-black text-sky-200 whitespace-nowrap leading-none text-center" style={{background:"rgba(0,0,0,0.7)",padding:"1px 3px",borderRadius:4}}>
                                  {b.name}<br/>
                                  <span className="text-sky-400">{lp.left.toFixed(1)}% {lp.top.toFixed(1)}%</span>
                                </span>
                              </div>
                            );
                          })}
                          <div className="absolute bottom-2 right-2 rounded-xl border border-sky-600 bg-black/90 p-2 text-[10px] text-sky-200 max-w-[230px] pointer-events-auto" style={{zIndex:60}}>
                            <div className="font-black text-sky-400 mb-1">📋 Pozycje etykiet (miasto):</div>
                            {Object.entries(cityLabelPos).map(([id,lp]) => <div key={id}>{id}: left={lp.left.toFixed(1)}% top={lp.top.toFixed(1)}%</div>)}
                          </div>
                        </div>
                      )}

                      {/* ══ EDYTOR HITBOXÓW MIASTA ══ */}
                      {cityHitboxEditMode && (
                        <div className="absolute inset-0 pointer-events-none" style={{zIndex:57}}>
                          {([
                            {id:"naFarme", name:"Na farmę"},
                            {id:"sklep",   name:"Sklep"},
                            {id:"targ",    name:"Targ"},
                            {id:"bank",    name:"Bank"},
                            {id:"ratusz",  name:"Ratusz"},
                          ] as Array<{id:string,name:string}>).map(b => {
                            const hp = cityHitboxPos[b.id];
                            return (
                              <div key={`che${b.id}`}
                                className="absolute cursor-move pointer-events-auto select-none"
                                style={{ left:`${hp.left}%`, top:`${hp.top}%`, width:`${hp.width}%`, height:`${hp.height}%`, border:"2px dashed #f97316", background:"rgba(249,115,22,0.15)", borderRadius:4, userSelect:"none", boxSizing:"border-box" }}
                                onMouseDown={e => { e.preventDefault(); cityHitboxDragRef.current = {type:"move",id:b.id,startX:e.clientX,startY:e.clientY,startPos:{...hp}}; }}
                              >
                                <span className="block text-[9px] font-black text-orange-200 whitespace-nowrap leading-none" style={{background:"rgba(0,0,0,0.75)",padding:"1px 4px",borderRadius:3,display:"inline-block"}}>
                                  {b.name} · {hp.left.toFixed(1)}% {hp.top.toFixed(1)}% · {hp.width.toFixed(1)}×{hp.height.toFixed(1)}
                                </span>
                                <div
                                  className="absolute bottom-0 right-0 cursor-se-resize pointer-events-auto"
                                  style={{width:14,height:14,background:"#f97316",borderRadius:"3px 0 3px 0"}}
                                  onMouseDown={e => { e.preventDefault(); e.stopPropagation(); cityHitboxDragRef.current = {type:"resize",id:b.id,startX:e.clientX,startY:e.clientY,startPos:{...hp}}; }}
                                />
                              </div>
                            );
                          })}
                          <div className="absolute bottom-2 left-2 rounded-xl border border-orange-600 bg-black/90 p-2 text-[10px] text-orange-200 max-w-[270px] pointer-events-auto" style={{zIndex:60}}>
                            <div className="font-black text-orange-400 mb-1">📋 Pozycje hitboxów (miasto):</div>
                            {Object.entries(cityHitboxPos).map(([id,hp]) => (
                              <div key={id}>{id}: {hp.left.toFixed(1)}% {hp.top.toFixed(1)}% {hp.width.toFixed(1)}%×{hp.height.toFixed(1)}%</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ═══ RATUSZ ═══ */}
                    {currentMap === "city_townhall" && (
                        <div className="pointer-events-auto absolute inset-0">

                          {/* Wróć do miasta */}
                          <button
                            type="button"
                            onClick={() => handleChangeMap("city")}
                            className="absolute left-4 top-4 rounded-2xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-base font-black text-[#f3e6c8] shadow-2xl backdrop-blur-sm transition hover:border-yellow-400/60"
                          >
                            ← Wróć do miasta
                          </button>

                          {/* Ranking */}
                          <button
                            type="button"
                            onClick={() => { void loadRanking(); setShowRankingPanel(true); }}
                            className="absolute flex flex-col items-center gap-1 rounded-2xl border-2 border-[#f4cf78]/50 bg-[rgba(18,11,5,0.93)] px-6 py-4 font-black text-[#f9e7b2] shadow-2xl backdrop-blur-sm transition hover:border-yellow-400 hover:brightness-110"
                            style={{ left: "16%", top: "55%", width: "14%" }}
                          >
                            <span className="text-3xl">🏆</span>
                            <span className="text-base">Ranking</span>
                          </button>

                          {/* Gildia */}
                          <button
                            type="button"
                            onClick={() => setShowGildiaPanel(true)}
                            className="absolute flex flex-col items-center gap-1 rounded-2xl border-2 border-[#f4cf78]/50 bg-[rgba(18,11,5,0.93)] px-6 py-4 font-black text-[#f9e7b2] shadow-2xl backdrop-blur-sm transition hover:border-yellow-400 hover:brightness-110"
                            style={{ left: "43%", top: "55%", width: "14%" }}
                          >
                            <span className="text-3xl">⚔️</span>
                            <span className="text-base">Gildia</span>
                          </button>

                          {/* Misje */}
                          <button
                            type="button"
                            onClick={() => setShowMisjePanel(true)}
                            className="absolute flex flex-col items-center gap-1 rounded-2xl border-2 border-[#f4cf78]/50 bg-[rgba(18,11,5,0.93)] px-6 py-4 font-black text-[#f9e7b2] shadow-2xl backdrop-blur-sm transition hover:border-yellow-400 hover:brightness-110"
                            style={{ left: "70%", top: "55%", width: "14%" }}
                          >
                            <span className="text-3xl">📜</span>
                            <span className="text-base">Misje</span>
                          </button>

                        </div>
                      )}

                                          {/* ═══ INNE LOKACJE MIEJSKIE ═══ */}
                    {currentMap !== "city" && currentMap !== "city_townhall" && currentMap.startsWith("city_") && (
                      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center px-4">
                        <div className="w-full max-w-2xl rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.9)] p-8 text-center text-[#f3e6c8] shadow-2xl backdrop-blur-sm">
                          <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Miasto</p>
                          <h2 className="mt-3 text-4xl font-black text-[#f9e7b2]">{getMapDisplayName(currentMap)}</h2>
                          <p className="mt-4 text-base leading-7 text-[#dfcfab]">
                            Ta lokacja jest już podpięta do świata gry, ale jej zawartość dodamy w kolejnym etapie.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleChangeMap("city")}
                            className="mt-6 rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-3 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                          >
                            Wróć do miasta
                          </button>
                        </div>
                      </div>
                    )}
                </div>
          )}
          <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-4">
            {!profile ? (
              <div className="grid w-full max-w-5xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.88)] shadow-2xl backdrop-blur-sm">
                  <div className="border-b border-[#8b6a3e] bg-[linear-gradient(180deg,rgba(110,73,35,0.95),rgba(76,48,23,0.95))] px-6 py-5 text-[#f9e7b2]">
                    <p className="text-xs uppercase tracking-[0.35em] opacity-80">Przeglądarkowa gra farmerska</p>
                    <h1 className="mt-2 text-4xl font-black tracking-wide">Plonopolis</h1>
                    <p className="mt-2 text-sm text-[#f2ddb0]">
                      Zaloguj się do swojego gospodarstwa albo utwórz nowe konto.
                    </p>
                  </div>

                  <div className="p-6 md:p-8">
                    <div className="mb-6 grid grid-cols-2 rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-1">
                      <button
                        onClick={() => setTab("login")}
                        className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                          tab === "login" ? "bg-[#d4a64f] text-[#2b180c]" : "text-[#f1dfb5] hover:bg-white/5"
                        }`}
                      >
                        Logowanie
                      </button>
                      <button
                        onClick={() => setTab("register")}
                        className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                          tab === "register" ? "bg-[#d4a64f] text-[#2b180c]" : "text-[#f1dfb5] hover:bg-white/5"
                        }`}
                      >
                        Rejestracja
                      </button>
                    </div>

                    {tab === "login" ? (
                      <form onSubmit={handleLogin} className="space-y-5 text-[#f3e6c8]">
                        <div>
                          <label className="mb-2 block text-sm font-semibold">Email</label>
                          <input
                            type="text"
                            placeholder="twoj@email.pl"
                            value={loginForm.identifier}
                            onChange={(e) => setLoginForm((prev) => ({ ...prev, identifier: e.target.value }))}
                            className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-3 text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold">Hasło</label>
                          <input
                            type="password"
                            placeholder="Wpisz hasło"
                            value={loginForm.password}
                            onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                            className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-3 text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-3 text-base font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                        >
                          Zaloguj i wczytaj sesję
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleRegister} className="space-y-5 text-[#f3e6c8]">
                        <div>
                          <label className="mb-2 block text-sm font-semibold">Login</label>
                          <input
                            type="text"
                            placeholder="Unikalny login"
                            value={registerForm.login}
                            onChange={(e) => setRegisterForm((prev) => ({ ...prev, login: e.target.value }))}
                            className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-3 text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold">Email</label>
                          <input
                            type="email"
                            placeholder="twoj@email.pl"
                            value={registerForm.email}
                            onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                            className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-3 text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                          />
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-semibold">Hasło</label>
                            <input
                              type="password"
                              placeholder="Minimum 6 znaków"
                              value={registerForm.password}
                              onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                              className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-3 text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold">Powtórz hasło</label>
                            <input
                              type="password"
                              placeholder="Powtórz hasło"
                              value={registerForm.confirmPassword}
                              onChange={(e) =>
                                setRegisterForm((prev) => ({
                                  ...prev,
                                  confirmPassword: e.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-3 text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-3 text-base font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                        >
                          Utwórz konto
                        </button>
                      </form>
                    )}
                  </div>
                </section>

                <aside className="rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.82)] p-6 text-[#f3e6c8] shadow-2xl backdrop-blur-sm">
                  <div className="inline-block rounded-full border border-[#d4a64f]/50 bg-[#d4a64f]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#f5d57f]">
                    Sesja gracza
                  </div>

                  <h2 className="mt-4 text-3xl font-black text-[#f9e7b2]">Nowy gracz startuje od zera</h2>
                  <p className="mt-3 text-sm leading-6 text-[#dfcfab]">
                    Po pomyślnym logowaniu wczytujemy sesję gracza. Jeśli konto jest nowe, zaczynasz z 3 darmowymi
                    polami, poziomem 1 i 10 PLN.
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)] p-4">
                      <p className="font-bold text-[#f9e7b2]">Nowy gracz</p>
                      <p className="mt-2 text-sm text-[#dfcfab]">Poziom 1 • 0 / 100 EXP • 10 PLN</p>
                      <p className="mt-2 text-sm text-[#dfcfab]">Darmowe pola: 3</p>
                      <p className="mt-2 text-sm text-[#dfcfab]">Lokacja: Startowa Polana</p>
                    </div>

                    <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)] p-4">
                      <p className="font-bold text-[#f9e7b2]">Klikane pola</p>
                      <p className="mt-2 text-sm text-[#dfcfab]">
                        Kliknij podświetlone pole na mapie, aby otworzyć menu pola.
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="relative min-h-screen w-full px-4 pt-8 md:px-8">


                {(isOnFarmMap || currentMap === "city_shop" || currentMap === "city_market") && (
                <div className="fixed left-4 top-4 z-[95]">
                  <div className="flex flex-col items-start">
                    {/* Górny rząd: przycisk plecaka + avatar */}
                    <div className="flex flex-row items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBackpackOpen((prev) => !prev)}
                      className="flex shrink-0 items-center justify-center rounded-2xl border border-[#8b6a3e] bg-[rgba(38,24,14,0.94)] text-3xl font-black text-[#f3e6c8] shadow-2xl backdrop-blur-sm transition hover:bg-[rgba(58,34,18,0.98)]"
                      aria-label={isBackpackOpen ? "Zamknij plecak" : "Otwórz plecak"}
                      title={isBackpackOpen ? "Zamknij plecak" : "Otwórz plecak"}
                    >
                      <img src={isBackpackOpen ? "/backpack-open.png" : "/backpack.png"} alt="Plecak" className="h-[128px] w-[128px] object-contain" style={{imageRendering:"pixelated"}} />
                    </button>
                    {/* Avatar gracza — po prawej od plecaka, nie rusza się przy otwarciu */}
                    <div className="group relative flex flex-col items-center gap-1 cursor-default select-none">
                      <div className="flex h-[128px] w-[128px] items-center justify-center rounded-2xl border border-[#8b6a3e] bg-[rgba(38,24,14,0.94)] overflow-hidden shadow-2xl backdrop-blur-sm">
                        {avatarSkin >= 0
                          ? <img src={ALL_SKINS[avatarSkin]} alt="Avatar" className="w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                          : <span className="flex flex-col items-center justify-center gap-0.5 animate-pulse">
                              <span className="text-[#f9e7b2] text-[11px] font-black leading-tight text-center">Wybierz Avatar</span>
                              <span className="text-[#c9952f] text-[10px] font-bold">(kliknij Dom)</span>
                            </span>}
                      </div>
                      <p className="max-w-[128px] truncate text-[13px] font-bold text-[#d8ba7a] drop-shadow">{profile?.login ?? ""}</p>
                      <div className="pointer-events-none absolute left-full top-0 ml-2 hidden group-hover:block z-[200]">
                        <div className="rounded-[14px] border border-[#8b6a3e] bg-[rgba(28,16,8,0.97)] px-3 py-2 text-[13px] text-[#dfcfab] shadow-xl whitespace-nowrap">
                          💡 Avatar można zmienić w <span className="font-bold text-[#d8ba7a]">„Dom"</span>
                        </div>
                      </div>
                    </div>
                    </div>
                    {/* Panel plecaka — rozsuwa się w dół, nie przesuwa avatara */}
                    <div
                      className={`mt-[1.5vh] origin-left overflow-hidden transition-all duration-500 ease-out ${
                        isBackpackOpen ? "max-w-[440px] translate-x-0 opacity-100" : "max-w-0 -translate-x-4 opacity-0"
                      }`}
                    >
                      <div
                        className={`max-h-[80vh] w-[440px] overflow-y-auto rounded-[24px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.88)] p-4 text-[#f3e6c8] shadow-2xl backdrop-blur-sm transition-all duration-500 ease-out ${
                          isBackpackOpen ? "pointer-events-auto scale-100" : "pointer-events-none scale-95"
                        }`}
                      >
                        <div
                          className="mb-3 flex items-center justify-between"
                        >
                          <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Plecak</p>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSeedId(null);
                              setSelectedTool(null);
                            }}
                            className="rounded-full border border-[#8b6a3e] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#dfcfab] transition hover:bg-[rgba(80,58,28,0.65)]"
                          >
                            Wyczyść wybór
                          </button>
                        </div>

                        {/* Zakładki Uprawy / Przedmioty */}
                          <div className="mt-3 flex gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1">
                            {(["uprawy","przedmioty","owoce"] as const).map(tab => (
                              <button
                                key={tab}
                                type="button"
                                onClick={() => setBackpackTab(tab)}
                                className={`flex-1 rounded-lg py-1.5 text-xs font-bold uppercase tracking-[0.15em] transition ${backpackTab === tab ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "text-[#dfcfab] hover:bg-white/5"}`}
                              >
                                {tab === "uprawy" ? "🌾 Uprawy" : tab === "przedmioty" ? "🎒 Przedmioty" : "🍎 Owoce"}
                              </button>
                            ))}
                          </div>

                          {/* ZAKŁADKA: UPRAWY */}
                          {backpackTab === "uprawy" && (
                            <>
                              <div className="mt-3 grid w-full grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTool((prev) => (prev === "watering_can" ? null : "watering_can"));
                                    setSelectedSeedId(null);
                                  }}
                                  onMouseEnter={() => setHoveredWateringCan(true)}
                                  onMouseLeave={() => setHoveredWateringCan(false)}
                                  className={`flex min-h-[59px] flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-2 text-center transition ${selectedTool === "watering_can" ? "border-cyan-300 bg-cyan-900/30 shadow-[0_0_24px_rgba(80,200,255,0.25)]" : "border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] hover:bg-[rgba(30,18,10,0.9)]"}`}
                                >
                                  <img src="/watering_can_transparent.png" alt="Konewka" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                                  <div className="text-center">
                                    <p className="text-sm font-black text-[#f9e7b2]">Konewka</p>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onMouseEnter={() => setHoveredSickle(true)}
                                  onMouseLeave={() => setHoveredSickle(false)}
                                  onClick={() => {
                                    setSelectedTool((prev) => (prev === "sickle" ? null : "sickle"));
                                    setSelectedSeedId(null);
                                  }}
                                  className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center transition ${selectedTool === "sickle" ? "border-yellow-300 bg-yellow-900/30 shadow-[0_0_24px_rgba(255,220,120,0.25)]" : "border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] hover:bg-[rgba(30,18,10,0.9)]"}`}
                                >
                                  <img src="/sierp.png" alt="Zbierz" className="h-12 w-12 object-contain" style={{ imageRendering: "pixelated" }} />
                                  <div className="text-center">
                                    <p className="text-sm font-black text-[#f9e7b2]">Zbierz</p>
                                    <p className="text-xs text-[#dfcfab]">Zbiór gotowej uprawy</p>
                                  </div>
                                </button>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <span className="text-xs text-[#8b6a3e] uppercase tracking-[0.15em] shrink-0">Filtr:</span>
                                <div className="flex flex-1 gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1">
                                  {BACKPACK_FILTER_OPTS.map(opt => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setBackpackSort(opt.id)}
                                      className={`flex-1 rounded-lg py-1 text-[10px] font-bold uppercase tracking-[0.05em] transition ${backpackSort === opt.id ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "hover:bg-white/5"}`}
                                      style={backpackSort === opt.id ? undefined : { color: opt.color }}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-3">
                                {(() => {
                                  const allCrops = (Object.entries(seedInventory).filter(
                                    ([k, amount]) => Number(amount) > 0 && !isCompostKey(k)
                                  ) as Array<[string, number]>);
                                  const filtered = backpackSort === "all"
                                    ? allCrops
                                    : allCrops.filter(([k]) => {
                                        const q = parseQualityKey(k).quality ?? "good";
                                        return q === backpackSort;
                                      });
                                  if (allCrops.length === 0) {
                                    return (
                                      <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                                        Plecak jest pusty.
                                      </div>
                                    );
                                  }
                                  if (filtered.length === 0) {
                                    const fLabel = BACKPACK_FILTER_OPTS.find(o => o.id === backpackSort)?.label ?? "";
                                    return (
                                      <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                                        Brak upraw o jakości „{fLabel}". Zmień filtr powyżej.
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="grid grid-cols-4 gap-2">
                                      {(() => {
                                        const sorted = [...filtered].sort(([aId], [bId]) => {
                                          const { baseCropId: _aCrop, quality: _aQ } = parseQualityKey(aId);
                                          const { baseCropId: _bCrop, quality: _bQ } = parseQualityKey(bId);
                                          const aLv = CROPS.find(c => c.id === _aCrop)?.unlockLevel ?? 999;
                                          const bLv = CROPS.find(c => c.id === _bCrop)?.unlockLevel ?? 999;
                                          if (aLv !== bLv) return aLv - bLv;
                                          const _qOrder: Record<string,number> = {rotten:0,good:1,epic:2,legendary:3};
                                          return (_qOrder[_aQ ?? "good"] ?? 1) - (_qOrder[_bQ ?? "good"] ?? 1);
                                        });
                                        return sorted.map(([seedId, amount]) => {
                                        const { baseCropId: _bCropId, quality: _bQuality } = parseQualityKey(seedId);
                                          const crop = CROPS.find((item) => item.id === _bCropId);
                                          const _qDef2 = _bQuality ? CROP_QUALITY_DEFS[_bQuality] : null;
                                          const _isRotten = _bQuality === "rotten";
                                          const _qualitySprite = _bQuality === "epic" && crop.epicSpritePath ? crop.epicSpritePath
      : _bQuality === "rotten" && crop.rottenSpritePath ? crop.rottenSpritePath
      : _bQuality === "legendary" && crop.legendarySpritePath ? crop.legendarySpritePath
      : crop.spritePath;
                                        if (!crop) return null;
                                        return (
                                          <button
                                            key={seedId}
                                            draggable
                                            onDragStart={() => { setDraggedSeedId(seedId); setSelectedSeedId(seedId); setSelectedTool(null); }}
                                            onDragEnd={() => setDraggedSeedId(null)}
                                            type="button"
                                            onClick={() => {
                                              setSelectedSeedId((prev) => (prev === seedId ? null : seedId));
                                              setSelectedTool(null);
                                            }}
                                            onMouseEnter={() => { setHoveredCrop(crop); setHoveredSeedQuality(_bQuality as "rotten"|"good"|"epic"|"legendary"|null); }}
                                            onMouseLeave={() => { setHoveredCrop(null); setHoveredSeedQuality(null); }}
                                            className={`group relative flex h-24 w-24 items-center justify-center rounded-xl border transition ${_isRotten ? "cursor-not-allowed" : ""}`}
                                            style={selectedSeedId === seedId
                                              ? { borderColor: "#f6d860", background: "rgba(60,40,5,0.4)", boxShadow: "0 0 12px rgba(255,220,120,0.22)" }
                                              : _bQuality === "legendary"
                                                ? { borderColor: _qDef2!.borderColor, background: _qDef2!.bgColor, animation: "legendaryPulse 2s ease-in-out infinite" }
                                                : _qDef2
                                                  ? { borderColor: _qDef2.borderColor, background: _qDef2.bgColor }
                                                  : { borderColor: "#8b6a3e", background: "rgba(20,12,8,0.65)" }}
                                          >
                                            <img src={_qualitySprite} alt={crop.name} className="absolute inset-0 h-full w-full object-contain rounded-xl" style={{ imageRendering: "pixelated" }} />
                                            {_bQuality === "legendary" && (
                                              <span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                                <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                              </span>
                                            )}
                                            <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">
                                              {amount}
                                            </span>
                                          </button>
                                        );
                                      });
                                      })()}
                                    </div>
                                  );
                                })()}
                              </div>
                            </>
                          )}

                          {backpackTab === "przedmioty" && (
                            <div className="mt-2 flex flex-col gap-2">
                              {/* Puste słoiki */}
                              {hiveData.empty_jars > 0 && (
                                <div className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2">
                                  <img src="/jar_empty.png" alt="Słoik" className="w-16 h-16 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                  <div className="flex-1">
                                    <p className="text-xs font-bold text-[#f9e7b2]">Puste słoiki</p>
                                    <p className="text-[10px] text-[#8b6a3e]">Do zbierania miodu</p>
                                  </div>
                                  <span className="text-base font-black text-amber-300">×{hiveData.empty_jars}</span>
                                </div>
                              )}
                              {/* Słoiki z miodem */}
                              {hiveData.honey_jars > 0 && (
                                <div className="flex items-center gap-3 rounded-xl border border-amber-600/40 bg-black/20 px-3 py-2">
                                  <img src="/jar_honey.png" alt="Miód" className="w-16 h-16 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                  <div className="flex-1">
                                    <p className="text-xs font-bold text-[#f9e7b2]">Słoiki z miodem</p>
                                    <p className="text-[10px] text-[#8b6a3e]">Sprzedaj w Ladzie</p>
                                  </div>
                                  <span className="text-base font-black text-amber-300">×{hiveData.honey_jars}</span>
                                </div>
                              )}
                              {/* Strój pszczelarza */}
                              {hiveData.suit_durability > 0 && (
                                <div className="group relative flex items-center gap-3 rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2 cursor-default">
                                  <img src="/beekeeper_suit.png" alt="Strój" className="w-16 h-16 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                  <div className="flex-1">
                                    <p className="text-xs font-bold text-[#f9e7b2]">Strój pszczelarza</p>
                                    <div className="mt-1 h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                                      <div className="h-full rounded-full transition-all" style={{ width:`${hiveData.suit_durability}%`, background: hiveData.suit_durability > 30 ? "#22c55e" : "#ef4444" }} />
                                    </div>
                                  </div>
                                  <span className="text-xs font-black" style={{color: hiveData.suit_durability > 30 ? "#86efac" : "#fca5a5"}}>{hiveData.suit_durability}/100</span>
                                  {/* Tooltip */}
                                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50">
                                    <div className="rounded-xl border border-[#8b6a3e]/60 bg-[rgba(14,8,4,0.97)] px-3 py-2 text-center shadow-xl whitespace-nowrap">
                                      <p className="text-xs font-black text-[#f9e7b2]">Strój pszczelarza</p>
                                      <p className="text-[11px] text-amber-300 mt-0.5">{hiveData.suit_durability} zbiorów pozostało</p>
                                      <p className="text-[10px] text-[#8b6a3e] mt-0.5">Kup nowy w Sklepie → Przedmioty</p>
                                    </div>
                                    <div className="h-2 w-2 rotate-45 border-r border-b border-[#8b6a3e]/60 bg-[rgba(14,8,4,0.97)] -mt-1" />
                                  </div>
                                </div>
                              )}
                              {/* Kompost — przeciągalny na pola (z zaszytą wartością tieru) */}
                              {Object.keys(seedInventory)
                                .filter(k => isCompostKey(k) && (seedInventory[k] ?? 0) > 0)
                                .sort((a,b) => {
                                  const ta = compostTypeFromKey(a) ?? "growth";
                                  const tb = compostTypeFromKey(b) ?? "growth";
                                  const order: Record<CompostType, number> = { growth:0, yield:1, exp:2 };
                                  if (order[ta] !== order[tb]) return order[ta] - order[tb];
                                  return compostValueFromKey(a) - compostValueFromKey(b);
                                })
                                .map(cid => {
                                  const cnt = seedInventory[cid];
                                  const t = compostTypeFromKey(cid)!;
                                  const def = COMPOST_DEFS[t];
                                  const value = compostValueFromKey(cid);
                                  const tierIdx = def.bonusValues.indexOf(value);
                                  const tierColor = tierIdx === 0 ? "#9ca3af" : tierIdx === 1 ? "#fbbf24" : "#a78bfa";
                                  const isSel = selectedSeedId === cid;
                                  return (
                                    <div key={cid}
                                      draggable
                                      onDragStart={() => { setDraggedSeedId(cid); setSelectedSeedId(cid); setSelectedTool(null); }}
                                      onDragEnd={() => setDraggedSeedId(null)}
                                      onClick={() => { setSelectedSeedId(prev => prev === cid ? null : cid); setSelectedTool(null); }}
                                      className="group relative flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer active:cursor-grabbing transition"
                                      style={isSel
                                        ? { borderColor: tierColor, background: "rgba(60,40,5,0.4)", boxShadow: `0 0 12px ${tierColor}66` }
                                        : { borderColor: "rgba(6,95,70,0.5)", background: "rgba(6,78,59,0.3)" }}>
                                      <span className="text-3xl">{def.icon}</span>
                                      <div className="flex-1">
                                        <p className="text-xs font-bold text-emerald-200">{def.name} <span className="font-black" style={{color: tierColor}}>· {def.tierName(value)}</span></p>
                                        <p className="text-[10px]" style={{color: tierColor}}>{def.bonusLabel(value)}</p>
                                        {isSel && <p className="text-[9px] font-black text-amber-300 mt-0.5">✓ ZAZNACZONY · klik w pole = nałóż</p>}
                                      </div>
                                      <span className="text-base font-black text-emerald-300">×{cnt}</span>
                                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50">
                                        <div className="rounded-xl border border-emerald-600/60 bg-[rgba(8,16,10,0.97)] px-3 py-2 text-center shadow-xl whitespace-nowrap">
                                          <p className="text-xs font-black text-emerald-200">{def.icon} {def.name} <span style={{color: tierColor}}>({def.tierName(value)})</span></p>
                                          <p className="text-[10px] text-emerald-300/80 mt-0.5">{def.desc}</p>
                                          <p className="text-[11px] font-black mt-1" style={{color: tierColor}}>Bonus: {def.bonusLabel(value)}</p>
                                          <p className="text-[10px] text-amber-300 mt-1">↗ Przeciągnij lub kliknij i wybierz puste pole</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              {hiveData.empty_jars === 0 && hiveData.honey_jars === 0 && hiveData.suit_durability === 0 && !Object.keys(seedInventory).some(k => isCompostKey(k) && (seedInventory[k] ?? 0) > 0) && (
                                <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-4 text-center text-sm text-[#dfcfab]">
                                  <p className="text-2xl mb-2">🎒</p>
                                  <p>Brak przedmiotów.</p>
                                  <p className="mt-1 text-xs text-[#8b6a3e]">Kup słoiki i strój pszczelarza w Sklepie lub zdobądź kompost w Kompostowniku.</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ZAKŁADKA: OWOCE */}
                          {backpackTab === "owoce" && (() => {
                            const entries = Object.entries(fruitInventory).filter(([,c]) => Number(c) > 0);
                            if (entries.length === 0) {
                              return (
                                <div className="mt-3 rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-4 text-center text-sm text-[#dfcfab]">
                                  <p className="text-2xl mb-2">🍎</p>
                                  <p>Brak owoców w plecaku.</p>
                                  <p className="mt-1 text-xs text-[#8b6a3e]">Kup drzewa w Sklepie → 🌳 Drzewa, a potem zbierz owoce w Sadzie.</p>
                                </div>
                              );
                            }
                            const grouped: Record<string, { zwykly:number; soczysty:number; zloty:number }> = {};
                            entries.forEach(([k,c]) => {
                              const lastUnd = k.lastIndexOf("_");
                              const fid = k.slice(0,lastUnd); const q = k.slice(lastUnd+1) as FruitQuality;
                              if (!grouped[fid]) grouped[fid] = { zwykly:0, soczysty:0, zloty:0 };
                              grouped[fid][q] = Number(c);
                            });
                            return (
                              <div className="mt-3 flex flex-col gap-2">
                                {Object.entries(grouped).map(([fid,q]) => {
                                  const tree = TREES.find(t => t.fruitId === fid); if (!tree) return null;
                                  const total = q.zwykly + q.soczysty + q.zloty;
                                  const value = q.zwykly * tree.pricePerFruit + q.soczysty * tree.pricePerFruit * 2 + q.zloty * tree.pricePerFruit * 5;
                                  return (
                                    <div key={fid} className="rounded-xl border border-[#8b6a3e]/40 bg-black/25 px-3 py-2">
                                      <div className="flex items-center gap-3">
                                        <span className="text-3xl">{tree.fruitIcon}</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-black text-[#f9e7b2]">{tree.fruitName} <span className="text-[10px] font-normal text-[#8b6a3e]">×{total}</span></p>
                                          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                                            {q.zwykly>0   && <span className="rounded bg-emerald-900/40 border border-emerald-500/40 px-1.5 py-0.5 font-bold text-emerald-300">{q.zwykly}×zwykły</span>}
                                            {q.soczysty>0 && <span className="rounded bg-cyan-900/40 border border-cyan-500/40 px-1.5 py-0.5 font-bold text-cyan-300">💧{q.soczysty}×soczysty</span>}
                                            {q.zloty>0    && <span className="rounded bg-yellow-900/40 border border-yellow-500/40 px-1.5 py-0.5 font-bold text-yellow-300">✨{q.zloty}×złoty</span>}
                                          </div>
                                        </div>
                                        <span className="text-xs font-black text-amber-300 shrink-0">~{value.toLocaleString()}💰</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                <p className="mt-1 text-[10px] text-[#8b6a3e] text-center">Sprzedasz owoce w Sadzie (przycisk „Sprzedaj wszystkie").</p>
                              </div>
                            );
                          })()}

                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ MODAL WYBORU SKINA ═══ */}
          {/* ═══ TEST MODAL ═══ */}
          {/* ═══ MODAL RANKINGU ═══ */}
            {showRankingPanel && (
              <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                <div className="flex h-[90vh] w-full max-w-[1631px] flex-col rounded-[28px] border border-[#8b6a3e] bg-[rgba(22,13,8,0.98)] shadow-2xl">

                  {/* Header */}
                  <div className="flex shrink-0 items-center justify-between border-b border-[#8b6a3e]/40 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🏆</span>
                      <div>
                        <h2 className="text-2xl font-black text-[#f9e7b2]">Ranking graczy</h2>
                        <p className="text-xs text-[#8b6a3e]">Wszyscy gracze Plonopolis</p>
                      </div>
                    </div>
                    <button onClick={() => setShowRankingPanel(false)}
                      className="rounded-xl border border-[#8b6a3e]/50 bg-black/30 px-4 py-2 text-sm font-bold text-[#f3e6c8] transition hover:border-red-400/50 hover:text-red-300">
                      ✕ Zamknij
                    </button>
                  </div>

                  {/* Sort tabs + search + znajdź mnie */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#8b6a3e]/30 px-6 py-3">
                    <button onClick={() => setRankingSort("level")}
                      className={rankingSort==="level" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
                      Poziom
                    </button>
                    <button onClick={() => setRankingSort("money")}
                      className={rankingSort==="money" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
                      Pieniądze
                    </button>
                    <button onClick={() => setRankingSort("missions")}
                      className={rankingSort==="missions" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
                      Misje
                    </button>
                    <button onClick={() => setRankingSort("name")}
                      className={rankingSort==="name" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
                      Nazwa
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                      <input
                        type="text"
                        value={rankingSearch}
                        onChange={e => setRankingSearch(e.target.value)}
                        placeholder="🔍 Szukaj nicku..."
                        className="rounded-xl border border-[#8b6a3e]/60 bg-black/30 px-3 py-2 text-sm text-[#f3e6c8] placeholder-[#8b6a3e] outline-none focus:border-[#d4a64f]/80 w-44"
                      />
                      <button
                        onClick={() => {
                          setRankingHighlightMe(v => {
                            const next = !v;
                            if (next) setTimeout(() => {
                              const el = document.getElementById("ranking-me-row");
                              const container = rankingScrollRef.current;
                              if (!el || !container) return;
                              let elTop = 0;
                              let node: HTMLElement | null = el as HTMLElement;
                              while (node && node !== container) { elTop += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
                              container.scrollTop = elTop - container.clientHeight / 2 + el.offsetHeight / 2;
                            }, 120);
                            return next;
                          });
                        }}
                        className={`rounded-xl px-4 py-2 text-sm font-bold transition border ${rankingHighlightMe ? "border-yellow-400 bg-yellow-500/20 text-yellow-300" : "border-[#8b6a3e]/50 bg-black/20 text-[#f1dfb5] hover:bg-white/5"}`}>
                        🎯 Znajdź mnie
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  <div ref={rankingScrollRef} className="flex-1 overflow-y-auto px-6 py-4">
                    {rankingLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <div className="mb-3 text-4xl animate-spin">⚙️</div>
                          <p className="text-[#8b6a3e]">Ładowanie rankingu...</p>
                        </div>
                      </div>
                    ) : (
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-[#8b6a3e]/40 text-left text-xs uppercase tracking-widest text-[#8b6a3e]">
                            <th className="py-3 pr-4 w-10">#</th>
                            <th className="py-3 pr-4">Gracz</th>
                            <th className="py-3 pr-4">Gildia</th>
                            <th className="py-3 pr-4 text-right">Poziom</th>
                            <th className="py-3 pr-4 text-right">Pieniądze</th>
                            <th className="py-3 text-right">Misje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...rankingData].sort((a,b) => {
                            if (rankingSort==="level") return b.level-a.level||b.money-a.money;
                            if (rankingSort==="money") return b.money-a.money;
                            if (rankingSort==="missions") return b.missions_completed-a.missions_completed;
                            return a.player_name.localeCompare(b.player_name,"pl");
                          }).filter(p => rankingSearch.trim()==="" || p.player_name.toLowerCase().includes(rankingSearch.trim().toLowerCase())).map((p,i) => {
                            const isMe = p.user_id === profile?.id;
                            const highlighted = rankingHighlightMe && isMe;
                            return (
                            <tr key={i} id={isMe ? "ranking-me-row" : undefined} className={`border-b border-[#8b6a3e]/20 transition ${highlighted ? "bg-yellow-500/20 outline outline-2 outline-yellow-400/60" : "hover:bg-white/5"}`}>
                              <td className="py-3 pr-4 font-black text-[#d8ba7a]">
                                {i===0 ? "🥇" : i===1 ? "🥈" : i===2 ? "🥉" : i+1}
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={ALL_SKINS[isMe ? (avatarSkin >= 0 ? avatarSkin : 0) : ((p.avatar_skin ?? -1) >= 0 ? (p.avatar_skin ?? 0) : 0)] ?? ALL_SKINS[0]}
                                    alt={p.player_name}
                                    className="h-[62px] w-[62px] shrink-0 rounded-full object-cover border-2 border-[#8b6a3e]/60"
                                    style={{imageRendering:"pixelated"}}
                                  />
                                  <span className={`text-base font-bold ${highlighted ? "text-yellow-200" : "text-[#f3e6c8]"}`}>{p.player_name}</span>
                                  {!isMe && (<button type="button" onClick={() => openComposeTo(p.user_id, p.player_name)} className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#8b6a3e]/50 bg-black/20 text-sm transition hover:border-[#d8ba7a]/70 hover:bg-[rgba(80,50,10,0.5)]" title={`Wyślij wiadomość do ${p.player_name}`}>✉️</button>)}
                                </div>
                              </td>
                              <td className="py-3 pr-4 italic text-[#8b6a3e]">{p.guild_name}</td>
                              <td className="py-3 pr-4 text-right font-black text-[#f2ca69]">⭐ {p.level}</td>
                              <td className="py-3 pr-4 text-right text-[#a8e890]">
                                {new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN",minimumFractionDigits:0}).format(p.money)}
                              </td>
                              <td className="py-3 text-right text-[#f3e6c8]">{p.missions_completed}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="shrink-0 border-t border-[#8b6a3e]/30 px-6 py-3 text-center text-xs text-[#8b6a3e]">
                    Łącznie graczy: {rankingData.length}
                  </div>

                </div>
              </div>
            )}

          {/* ═══ MODAL WIADOMOŚCI ═══ */}
          {showMessagePanel && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="flex h-[92vh] w-full max-w-4xl flex-col rounded-[28px] border border-[#8b6a3e] bg-[rgba(22,13,8,0.98)] shadow-2xl">

                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-[#8b6a3e]/40 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">📬</span>
                    <div>
                      <h2 className="text-3xl font-black text-[#f9e7b2]">Wiadomości</h2>
                      <p className="text-sm text-[#8b6a3e]">Skrzynka gracza Plonopolis</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadMessages()}
                      className="rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-4 py-2 text-base font-bold text-[#8b6a3e] transition hover:border-[#d8ba7a]/50 hover:text-[#dfcfab]"
                      title="Odśwież skrzynkę"
                    >
                      🔄
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCompose(c => !c); setComposeError(""); }}
                      className="rounded-xl border border-[#d8ba7a]/70 bg-[rgba(80,50,10,0.5)] px-5 py-2 text-base font-bold text-[#f9e7b2] transition hover:bg-[rgba(100,70,15,0.7)]">
                      ✉️ Nowa +
                    </button>
                    <button onClick={() => { setShowMessagePanel(false); setShowCompose(false); }}
                      className="rounded-xl border border-[#8b6a3e]/50 bg-black/30 px-5 py-2 text-base font-bold text-[#f3e6c8] transition hover:border-red-400/50 hover:text-red-300">
                      ✕ Zamknij
                    </button>
                  </div>
                </div>

                {/* Zakładki */}
                <div className="flex shrink-0 gap-1 border-b border-[#8b6a3e]/30 bg-black/20 px-4 pt-3 pb-0">
                  {([
                    { key: "systemowe", label: "Systemowe", icon: "🔔" },
                    { key: "otrzymane", label: "Otrzymane", icon: "📩" },
                    { key: "wyslane",   label: "Wysłane",   icon: "📤" },
                  ] as const).map(tab => (
                    <button key={tab.key} onClick={() => { setMessageTab(tab.key); setSelectedMsgIds(new Set()); }}
                      className={`flex items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] transition border-b-2 ${messageTab === tab.key ? "border-[#d8ba7a] text-[#f9e7b2] bg-[rgba(80,50,20,0.3)]" : "border-transparent text-[#8b6a3e] hover:text-[#dfcfab]"}`}>
                      {tab.icon} {tab.label}
                      {tab.key === "otrzymane" && unreadCount > 0 && (
                        <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">{unreadCount}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Treść */}
                <div className="flex-1 overflow-y-auto p-5">
                  {showCompose ? (
                    <div className="flex h-full flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">✉️</span>
                        <h3 className="text-xl font-black text-[#f9e7b2]">Nowa wiadomość</h3>
                      </div>

                      {/* Odbiorca z autouzupełnianiem */}
                      <div className="relative">
                        <label className="mb-1 block text-sm font-bold uppercase tracking-wider text-[#8b6a3e]">Do (login gracza)</label>
                        <input
                          type="text"
                          value={composeRecipient}
                          onChange={e => {
                            const v = e.target.value;
                            setComposeRecipient(v);
                            setRecipientResolved(null);
                            void searchPlayers(v);
                          }}
                          placeholder="Wpisz login gracza..."
                          className="w-full rounded-xl border border-[#8b6a3e]/60 bg-black/30 px-4 py-3 text-base text-[#f3e6c8] placeholder:text-[#8b6a3e]/60 outline-none focus:border-[#d8ba7a]/70"
                        />
                        {/* Lista podpowiedzi */}
                        {recipientSuggestions.length > 0 && !recipientResolved && (
                          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-[#8b6a3e]/60 bg-[rgba(22,13,8,0.98)] shadow-2xl">
                            {recipientSuggestions.map(s => (
                              <button key={s.id} type="button"
                                onClick={() => { setRecipientResolved(s); setComposeRecipient(s.username); setRecipientSuggestions([]); }}
                                className="flex w-full items-center gap-2 px-5 py-3 text-left text-base text-[#dfcfab] transition hover:bg-[rgba(80,50,10,0.5)]">
                                <span className="text-lg">👤</span> {s.username}
                              </button>
                            ))}
                          </div>
                        )}
                        {recipientResolved && (
                          <p className="mt-1 text-sm font-bold text-green-400">✔ Gracz znaleziony: {recipientResolved.username}</p>
                        )}
                        {composeRecipient.length >= 2 && recipientSuggestions.length === 0 && !recipientResolved && (
                          <p className="mt-1 text-sm text-red-400">Nie znaleziono gracza o podanym loginie.</p>
                        )}
                      </div>

                      {/* Temat */}
                      <div>
                        <label className="mb-1 block text-sm font-bold uppercase tracking-wider text-[#8b6a3e]">Temat</label>
                        <input
                          type="text"
                          value={composeSubject}
                          onChange={e => setComposeSubject(e.target.value)}
                          maxLength={120}
                          placeholder="Temat wiadomości..."
                          className="w-full rounded-xl border border-[#8b6a3e]/60 bg-black/30 px-4 py-3 text-base text-[#f3e6c8] placeholder:text-[#8b6a3e]/60 outline-none focus:border-[#d8ba7a]/70"
                        />
                      </div>

                      {/* Treść */}
                      <div className="flex flex-1 flex-col">
                        <label className="mb-1 block text-sm font-bold uppercase tracking-wider text-[#8b6a3e]">Treść</label>
                        <textarea
                          value={composeBody}
                          onChange={e => setComposeBody(e.target.value)}
                          maxLength={2000}
                          placeholder="Napisz wiadomość..."
                          className="flex-1 resize-none rounded-xl border border-[#8b6a3e]/60 bg-black/30 px-4 py-3 text-base text-[#f3e6c8] placeholder:text-[#8b6a3e]/60 outline-none focus:border-[#d8ba7a]/70 min-h-[140px]"
                        />
                        <p className="mt-1 text-right text-sm text-[#8b6a3e]">{composeBody.length}/2000</p>
                      </div>

                      {/* Koszt i cooldown */}
                      <div className="flex items-center gap-2 rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-4 py-3">
                        <span className="text-base">💰</span>
                        <p className="text-sm text-[#8b6a3e]">Koszt wysłania: <span className="font-black text-[#f2ca69]">50 💰</span></p>
                        {recipientResolved && composeCountdownSecs > 0 && (
                          <span className="ml-auto rounded-lg bg-red-950/40 px-2 py-0.5 text-sm font-black text-red-400">
                            ⏱ Odblokuj za: {Math.floor(composeCountdownSecs/60)}:{String(composeCountdownSecs%60).padStart(2,"0")}
                          </span>
                        )}
                      </div>
                      {composeError && <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm font-bold text-red-400">{composeError}</p>}
                      <button
                        type="button"
                        disabled={!recipientResolved || composeSending}
                        onClick={() => void sendMessage()}
                        className="rounded-xl border border-[#d8ba7a]/70 bg-[linear-gradient(180deg,#d9a93a,#a06e18)] px-6 py-3 text-base font-black text-[#1a0e00] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {composeSending ? "Wysyłanie..." : "📤 Wyślij wiadomość"}
                      </button>
                    </div>
                  ) : (<>
                  {messagesError && (
                    <div className="mb-3 rounded-xl border border-red-500/50 bg-red-950/30 px-4 py-3">
                      <p className="text-sm font-bold text-red-400">⚠️ {messagesError}</p>
                      <p className="mt-1 text-xs text-red-400/70">Sprawdź konsolę przeglądarki (F12) po więcej szczegółów.</p>
                    </div>
                  )}
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="animate-pulse text-base text-[#8b6a3e]">Ładowanie wiadomości...</p>
                    </div>
                  ) : (() => {
                    const filtered = gameMessages.filter(m => {
                      if (messageTab === "systemowe") return m.type === "system";
                      if (messageTab === "otrzymane") return m.type === "received";
                      if (messageTab === "wyslane")   return m.type === "sent";
                      return false;
                    });
                    if (filtered.length === 0) return (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#8b6a3e]">
                        <span className="text-7xl opacity-40">{messageTab === "systemowe" ? "🔔" : messageTab === "otrzymane" ? "📩" : "📤"}</span>
                        <p className="text-base">Brak wiadomości</p>
                      </div>
                    );
                    const selectable = messageTab !== "systemowe";
                    const selectableIds = filtered.map(m => m.id);
                    const allSelected = selectable && selectableIds.length > 0 && selectableIds.every(id => selectedMsgIds.has(id));
                    const selectedInTab = selectableIds.filter(id => selectedMsgIds.has(id));
                    return (
                      <div className="space-y-3">
                        {/* ─ Toolbar zaznaczania ─ */}
                        {selectable && (
                          <div className="mb-1 flex items-center gap-3 rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-4 py-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#dfcfab] select-none">
                              <input type="checkbox" checked={allSelected} onChange={() => {
                                if (allSelected) setSelectedMsgIds(prev => { const n = new Set(prev); selectableIds.forEach(id => n.delete(id)); return n; });
                                else setSelectedMsgIds(prev => { const n = new Set(prev); selectableIds.forEach(id => n.add(id)); return n; });
                              }} className="h-4 w-4 accent-yellow-400 cursor-pointer" />
                              {allSelected ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                            </label>
                            {selectedInTab.length > 0 && (
                              <>
                                <span className="text-xs text-[#8b6a3e]">Zaznaczono: <span className="font-bold text-yellow-300">{selectedInTab.length}</span></span>
                                <button type="button"
                                  onClick={() => void deleteSelectedMessages(selectedInTab)}
                                  className="ml-auto rounded-lg border border-red-600/50 bg-red-950/30 px-4 py-1.5 text-sm font-bold text-red-300 transition hover:bg-red-950/60">
                                  🗑️ Usuń zaznaczone ({selectedInTab.length})
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        {filtered.map(msg => (
                          <div key={msg.id}
                            className={`relative rounded-2xl border p-5 transition ${selectedMsgIds.has(msg.id) ? "border-yellow-400/50 bg-yellow-900/10" : !msg.read && msg.type !== "sent" ? "border-[#d8ba7a]/60 bg-[rgba(80,50,15,0.45)]" : "border-[#8b6a3e]/40 bg-black/20"}`}>

                            {/* Checkbox zaznaczania */}
                            {msg.type !== "system" && (
                              <input type="checkbox"
                                checked={selectedMsgIds.has(msg.id)}
                                onChange={() => setSelectedMsgIds(prev => { const n = new Set(prev); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n; })}
                                className="absolute right-4 top-4 h-5 w-5 accent-yellow-400 cursor-pointer"
                              />
                            )}
                            {/* Data */}
                            <p className="mb-2 text-xs text-[#8b6a3e]">
                              {new Date(msg.created_at).toLocaleDateString("pl-PL", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                            </p>

                            {/* Received / System: Od kogo → Tytuł → Treść */}
                            {(msg.type === "received" || msg.type === "system") && (<>
                              <div className="mb-2 flex items-center gap-3">
                                {msg.type === "system" ? (
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#8b6a3e]/50 bg-black/30 text-xl">🔧</span>
                                ) : (
                                  <img
                                    src={ALL_SKINS[msg.from_avatar_skin ?? 0] ?? ALL_SKINS[0]}
                                    alt={msg.from_username ?? ""}
                                    className="h-10 w-10 shrink-0 rounded-full object-cover border border-[#8b6a3e]/60"
                                    style={{imageRendering:"pixelated"}}
                                  />
                                )}
                                <div>
                                  <p className={`text-xs font-bold ${msg.type === "system" ? "text-red-400 tracking-wide uppercase" : "text-[#8b6a3e]"}`}>
                                    {msg.type === "system" ? "⚙️ System Plonopolis" : (msg.from_username ?? "Nieznany")}
                                  </p>
                                  <p className={`text-lg font-black ${!msg.read ? "text-[#f9e7b2]" : "text-[#dfcfab]"}`}>
                                    {msg.subject || "(bez tytułu)"}
                                  </p>
                                </div>
                              </div>
                              <p className={`text-base leading-relaxed whitespace-pre-wrap ${msg.type === "system" ? "text-white" : "text-[#dfcfab]/90"}`}>{msg.body}</p>
                            </>)}

                            {/* Sent: Od kogo (ja) → Do kogo → Tytuł → Treść */}
                            {msg.type === "sent" && (<>
                              <div className="mb-2 flex items-center gap-3">
                                <div className="flex shrink-0 flex-col items-center gap-1">
                                  <img
                                    src={ALL_SKINS[msg.from_avatar_skin ?? avatarSkin ?? 0] ?? ALL_SKINS[0]}
                                    alt={msg.from_username ?? profile?.login ?? "Ty"}
                                    className="h-10 w-10 rounded-full object-cover border border-[#8b6a3e]/60"
                                    style={{imageRendering:"pixelated"}}
                                    title="Ty"
                                  />
                                  <span className="text-[9px] text-[#8b6a3e]">Ty</span>
                                </div>
                                <span className="text-[#8b6a3e]">→</span>
                                <div className="flex shrink-0 flex-col items-center gap-1">
                                  <img
                                    src={ALL_SKINS[msg.to_avatar_skin ?? 0] ?? ALL_SKINS[0]}
                                    alt={msg.to_username ?? "Odbiorca"}
                                    className="h-10 w-10 rounded-full object-cover border border-[#8b6a3e]/60"
                                    style={{imageRendering:"pixelated"}}
                                    title={msg.to_username ?? "Odbiorca"}
                                  />
                                  <span className="text-[9px] text-[#8b6a3e]">{msg.to_username ?? "?"}</span>
                                </div>
                                <div className="ml-1">
                                  <p className="text-xs text-[#8b6a3e]">
                                    <span className="font-bold text-[#d8ba7a]">{msg.from_username ?? profile?.login ?? "Ty"}</span>
                                    {" → "}
                                    <span className="font-bold text-[#d8ba7a]">{msg.to_username ?? "Nieznany"}</span>
                                  </p>
                                  <p className="text-lg font-black text-[#dfcfab]">{msg.subject || "(bez tytułu)"}</p>
                                </div>
                              </div>
                              <p className="text-base leading-relaxed text-[#dfcfab]/90 whitespace-pre-wrap">{msg.body}</p>
                            </>)}

                            {/* Akcje (tylko received) */}
                            {msg.type === "received" && (
                              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#8b6a3e]/20 pt-4">
                                <button type="button"
                                  onClick={() => void toggleSaveMessage(msg.id, msg.saved)}
                                  className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${msg.saved ? "border-green-600/60 bg-green-950/40 text-green-300 hover:bg-green-950/60" : "border-[#8b6a3e]/50 bg-black/20 text-[#8b6a3e] hover:border-[#d8ba7a]/50 hover:text-[#dfcfab]"}`}>
                                  {msg.saved ? "✔ Zapisano" : "💾 Zapisz"}
                                </button>
                                {msg.from_user_id && (
                                  blockedUsers.includes(msg.from_user_id) ? (
                                    <button type="button"
                                      onClick={() => void unblockUser(msg.from_user_id!)}
                                      className="rounded-lg border border-blue-600/60 bg-blue-950/30 px-4 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-950/50">
                                      ✅ Odblokuj
                                    </button>
                                  ) : (
                                    <button type="button"
                                      onClick={() => void blockUser(msg.from_user_id!)}
                                      className="rounded-lg border border-red-600/50 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-950/40">
                                      🚫 Blokuj
                                    </button>
                                  )
                                )}
                                {msg.from_user_id && !blockedUsers.includes(msg.from_user_id) && (
                                  <button type="button"
                                    onClick={() => openComposeTo(msg.from_user_id!, msg.from_username ?? "")}
                                    className="rounded-lg border border-[#8b6a3e]/50 bg-black/20 px-4 py-2 text-sm font-bold text-[#8b6a3e] transition hover:border-[#d8ba7a]/50 hover:text-[#dfcfab]">
                                    ↩️ Odpowiedz
                                  </button>
                                )}
                                <button type="button"
                                  onClick={() => void deleteMessage(msg.id)}
                                  className="ml-auto rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-950/50 hover:border-red-500/60">
                                  🗑️ Usuń
                                </button>
                              </div>
                            )}
                            {/* Akcje (tylko sent) */}
                            {msg.type === "sent" && (
                              <div className="mt-4 flex justify-end border-t border-[#8b6a3e]/20 pt-4">
                                <button type="button"
                                  onClick={() => void deleteMessage(msg.id)}
                                  className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-950/50 hover:border-red-500/60">
                                  🗑️ Usuń
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  </>)}
                </div>

              </div>
            </div>
          )}

                      {/* ─── Modal powitalny dla nowego gracza ─── */}
                      {showWelcome && (
                        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 p-4">
                          <div className="relative w-full max-w-[680px] rounded-[28px] border-2 border-[#d8ba7a]/60 bg-[rgba(10,6,2,0.97)] p-8 shadow-2xl text-[#dfcfab]">
                            {/* Zamknij */}
                            <button
                              onClick={() => {
                                localStorage.setItem(`plonopolis_welcome_${profile?.id}`, "1");
                                setShowWelcome(false);
                              }}
                              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] hover:text-red-300 transition"
                            >✕</button>
                            {/* Nagłówek */}
                            <div className="mb-5 flex flex-col items-center gap-3">
                              <img src="/systemikona.png" alt="Plonopolis" className="h-32 w-32 object-contain" style={{imageRendering:"pixelated"}} />
                              <p className="text-[19px] font-black uppercase tracking-[0.2em] text-[#d8ba7a]">[ WIADOMOŚĆ SYSTEMOWA ]</p>
                              <h2 className="text-center text-[41px] font-black text-[#f9e7b2]">Witaj w Plonopolis.</h2>
                            </div>
                            {/* Treść */}
                            <div className="space-y-3 text-[22px] leading-relaxed text-[#dfcfab]/90">
                              <p>Rozpoczynasz na niewielkiej farmie, którą stopniowo rozbudujesz. Siej, podlewaj i zbieraj plony, zdobywając doświadczenie oraz środki na rozwój.</p>
                              <p>Wraz z poziomem odblokujesz nowe pola, ulepszenia oraz kolejne możliwości rozwoju. Twoja farma i postać będą się rozwijać, dając dostęp do coraz lepszych efektów i bonusów.</p>
                              <p>Poza farmą czekają także dodatkowe systemy, takie jak ranking i rywalizacja z innymi.</p>
                              <p>Rozwijaj się we własnym tempie i buduj swoje gospodarstwo.</p>
                            </div>
                            {/* Stopka */}
                            <div className="mt-6 flex items-center justify-between border-t border-[#8b6a3e]/30 pt-4">
                              <div className="flex items-center gap-2 text-[19px] text-[#8b6a3e]">
                                <img src="/systemikona.png" alt="" className="h-8 w-8 object-contain" style={{imageRendering:"pixelated"}} />
                                <span>System Plonopolis</span>
                              </div>
                              <button
                                onClick={() => {
                                  localStorage.setItem(`plonopolis_welcome_${profile?.id}`, "1");
                                  setShowWelcome(false);
                                }}
                                className="rounded-xl border border-[#d8ba7a]/50 bg-[rgba(80,55,10,0.5)] px-5 py-2 text-[22px] font-black text-[#f9e7b2] transition hover:bg-[rgba(120,85,15,0.6)] hover:border-[#d8ba7a]"
                              >
                                Rozumiem →
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {showTestModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4">
              <div className="relative w-full max-w-[600px] rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] p-6 shadow-2xl text-[#dfcfab]">
                <button onClick={() => setShowTestModal(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] hover:text-red-300">✕</button>
                <p className="mb-1 text-xs uppercase tracking-widest text-[#d8ba7a]">Panel deweloperski</p>
                <h2 className="mb-5 text-2xl font-black text-[#f9e7b2]">🧪 Testy gry</h2>
                <p className="mb-1 text-xs text-[#8b6a3e]">Mapa: {currentMap} | Lokacja: {displayLocation} | Pola: {unlockedPlotsCount}/{MAX_FIELDS}</p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">➕ Dodaj EXP</p>
                    <div className="flex flex-wrap gap-2">
                      {[250,1000,25000,500000].map(amt => (
                        <button key={amt} onClick={() => handleAddExp(amt)}
                          className="rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-3 py-2 text-xs font-black text-[#2f1b0c]">
                          +{amt.toLocaleString("pl-PL")} EXP
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">💰 Dodaj Gold</p>
                    <div className="flex flex-wrap gap-2">
                      {[1000,10000,250000,999999999].map(amt => (
                        <button key={amt} onClick={() => handleAddGold(amt)}
                          className="rounded-xl border border-yellow-500/60 bg-yellow-900/30 px-3 py-2 text-xs font-black text-yellow-200 hover:bg-yellow-900/50">
                          +{amt >= 1000000 ? amt.toLocaleString("pl-PL") : amt.toLocaleString("pl-PL")} 💰
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">🌱 Dodaj nasiona (każdy rodzaj)</p>
                    <div className="flex flex-wrap gap-2">
                      {[10,50,100].map(amt => (
                        <button key={amt} onClick={() => handleAddSeeds(amt)}
                          className="rounded-xl border border-green-500/60 bg-green-900/30 px-3 py-2 text-xs font-black text-green-200 hover:bg-green-900/50">
                          +{amt} każdy
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">⭐ Dodaj epickie nasiona</p>
                    <div className="flex flex-wrap gap-2">
                      {[1,5,10].map(amt => (
                        <button key={amt} onClick={() => handleAddEpic(amt)}
                          className="rounded-xl border border-emerald-500/60 bg-emerald-900/30 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-900/50">
                          +{amt} ⭐
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-400">👑 Dodaj legendarne nasiona</p>
                    <div className="flex flex-wrap gap-2">
                      {[1,5,10].map(amt => (
                        <button key={amt} onClick={() => handleAddLegendary(amt)}
                          className="rounded-xl border border-purple-500/60 bg-purple-900/30 px-3 py-2 text-xs font-black text-purple-200 hover:bg-purple-900/50">
                          +{amt} 👑
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-green-400">⭐ Epickie avatary</p>
                    <button
                      onClick={async () => {
                        if (!profile?.id) return;
                        const allEpicIds = EPIC_SKINS.map((_, i) => EPIC_SKIN_START + i);
                        const { error } = await supabase.from("profiles").update({ unlocked_epic_avatars: allEpicIds }).eq("id", profile.id);
                        if (!error) setUnlockedEpicAvatars(allEpicIds);
                      }}
                      className="rounded-xl border border-green-500/60 bg-green-900/30 px-4 py-2 text-xs font-black text-green-200 hover:bg-green-900/50">
                      🔓 Odblokuj wszystkie epickie avatary
                    </button>
                  </div>
                  <div className="pt-2 border-t border-[#8b6a3e]/30">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-400">⚠️ Niebezpieczne</p>
                    <button onClick={handleResetAccount}
                      className="rounded-xl border border-red-500/60 bg-red-950/40 px-4 py-2 text-xs font-black text-red-300 hover:bg-red-950/70">
                      🗑️ Zresetuj całe konto
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SHOP MODAL ═══ */}
          {showShopModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="relative flex h-[90vh] w-full max-w-[1500px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl">
                <button onClick={() => { setShowShopModal(false); setShopCart({}); setShopError(""); }} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] hover:text-red-300">✕</button>
                {/* Sidebar — kategorie sklepu */}
                <div className="flex w-[308px] shrink-0 flex-col border-r border-[#8b6a3e]/30 bg-black/20">
                  <div className="flex flex-col gap-3 p-6 pt-14">
                    <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-[#8b6a3e]">🏪 Sklep</p>
                    {(["nasiona","zwierzeta","drzewa","przedmioty"] as const).map(tab => (
                      <button key={tab} onClick={() => setShopTab(tab)}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${
                          shopTab === tab ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"
                        }`}>
                        <span className="text-2xl leading-none">{tab === "nasiona" ? "🌱" : tab === "zwierzeta" ? "🐄" : tab === "drzewa" ? "🌳" : "🧰"}</span>
                        {tab === "nasiona" ? "Nasiona" : tab === "zwierzeta" ? "Zwierzęta" : tab === "drzewa" ? "Drzewa" : "Przedmioty"}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1" />
                  {/* Kasa gracza */}
                  <div className="border-t border-[#8b6a3e]/30 p-3">
                    <p className="text-[9px] text-[#8b6a3e] uppercase tracking-widest">💰 Kasa</p>
                    <p className="text-sm font-black text-[#f9e7b2]">{Number(displayMoney).toFixed(2)} 💰</p>
                  </div>
                </div>
                {/* Content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-5 text-[#dfcfab]">
                    {shopTab === "nasiona" && (
                      <div>
                        <p className="mb-4 text-base font-black text-[#f9e7b2]">🌱 Nasiona do kupienia</p>
                        <div className="space-y-2">
                          {CROPS.filter(c => c.id !== "test_nasiono" && displayLevel >= c.unlockLevel).map(crop => {
                            const price = CROP_PRICES[crop.id] ?? 0;
                            const qty = shopCart[crop.id] ?? 0;
                            return (
                              <div key={crop.id} className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-4 py-2">
                                <img src={crop.spritePath} alt={crop.name} className="h-[60px] w-[60px] object-contain" style={{imageRendering:"pixelated"}} />
                                <div className="flex-1">
                                  <p className="font-bold text-[#f9e7b2]">{crop.name}</p>
                                  <p className="text-xs text-[#8b6a3e]">{price.toFixed(2)} 💰 / szt.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setShopCart(c => ({...c,[crop.id]:Math.max(0,(c[crop.id]??0)-1)}))} className="h-7 w-7 rounded-lg border border-[#8b6a3e]/40 bg-black/30 text-[#f9e7b2] hover:bg-black/60">−</button>
                                  <input type="number" min={0} value={qty} onChange={e => setShopCart(c => ({...c,[crop.id]:Math.max(0,Number(e.target.value))}))} className="w-16 rounded-lg border border-[#8b6a3e]/40 bg-black/30 px-2 py-1 text-center text-sm text-[#f9e7b2] focus:outline-none focus:border-yellow-400/60" />
                                  <button onClick={() => setShopCart(c => ({...c,[crop.id]:(c[crop.id]??0)+1}))} className="h-7 w-7 rounded-lg border border-[#8b6a3e]/40 bg-black/30 text-[#f9e7b2] hover:bg-black/60">+</button>
                                </div>
                                <p className="w-24 text-right text-sm font-bold text-yellow-200">{(price * qty).toFixed(2)} 💰</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {shopTab === "przedmioty" && (() => {
                      const SHOP_ITEMS = [
                        { id:"beekeeper_suit", label:"Strój pszczelarza", img:"/beekeeper_suit.png", desc:"100 zbiorów miodu", price:150, qty:100, type:"suit" as const },
                        { id:"jar_empty_1",    label:"Słoik × 1",         img:"/jar_pack_1.png",     desc:"1 sztuka",       price:4,   qty:1,   type:"jar" as const },
                        { id:"jar_empty_8",    label:"Słoik × 8",         img:"/jar_pack_8.png",     desc:"8 sztuk",        price:30,  qty:8,   type:"jar" as const },
                        { id:"jar_empty_15",   label:"Słoik × 15",        img:"/jar_pack_15.png",    desc:"15 sztuk",       price:55,  qty:15,  type:"jar" as const },
                      ];
                      return (
                        <div className="flex flex-col gap-3 p-4 overflow-y-auto">
                          {SHOP_ITEMS.map(item => {
                            const canAfford = displayMoney >= item.price;
                            return (
                              <div key={item.id} className="flex items-center gap-4 rounded-2xl border border-[#8b6a3e]/40 bg-black/20 p-4">
                                <img src={item.img} alt={item.label} className="w-[84px] h-[84px] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                <div className="flex-1">
                                  <p className="font-black text-[#f9e7b2]">{item.label}</p>
                                  <p className="text-xs text-[#8b6a3e]">{item.desc}</p>
                                  <p className="mt-1 text-sm font-bold text-yellow-300">{item.price.toFixed(2)} 💰</p>
                                </div>
                                <button
                                  disabled={!canAfford || !profile?.id}
                                  onClick={() => {
                                    if (!profile?.id || !canAfford) return;
                                    void (async () => {
                                      const newHive: HiveData = { ...hiveData };
                                      if (item.type === "suit") newHive.suit_durability = hiveData.suit_durability + 100;
                                      else newHive.empty_jars = hiveData.empty_jars + item.qty;
                                      const { error } = await supabase.from("profiles").update({
                                        money: Math.round((displayMoney - item.price) * 100) / 100,
                                        hive_data: newHive,
                                      }).eq("id", profile.id);
                                      if (!error) { setHiveData(newHive); await loadProfile(profile.id); }
                                    })();
                                  }}
                                  className={`rounded-xl px-4 py-2 text-sm font-black transition ${canAfford ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
                                >Kup</button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {shopTab === "zwierzeta" && (() => {
                      const lvl = profile?.level ?? 1;
                      const handleBuyAnimalShop = async (a: AnimalDef) => {
                        if (!profile?.id) return;
                        const st = barnState[a.id];
                        if (!st) return;
                        if (lvl < a.unlockLevel) { setMessage({type:"error",title:"Za niski poziom!",text:`${a.name} odblokujesz na LVL ${a.unlockLevel}.`}); return; }
                        if (displayMoney < a.buyPrice) { setMessage({type:"error",title:"Za mało złota!",text:`Potrzebujesz ${a.buyPrice.toLocaleString()} 💰`}); return; }
                        if (st.owned >= st.slots) { setMessage({type:"error",title:"Brak miejsca w stodole!",text:`Kup więcej slotów dla ${a.name} w Stodole.`}); return; }
                        const {error} = await supabase.from("profiles").update({money: displayMoney - a.buyPrice}).eq("id", profile.id);
                        if (error) return;
                        saveBarnState({...barnState, [a.id]: {...st, owned: st.owned+1}});
                        await loadProfile(profile.id);
                        setMessage({type:"success",title:`${a.icon} Kupiono!`,text:`${a.name} dołączyła do zagrody.`});
                      };
                      return (
                        <div className="flex flex-col gap-2 p-3 overflow-y-auto">
                          <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">🐄 Zwierzęta hodowlane</p>
                            <p className="mt-1 text-sm font-bold text-[#f9e7b2]">Każde zwierzę ma własne sloty w Stodole.</p>
                            <p className="mt-1 text-[11px] text-[#8b6a3e]">Po zakupie zwierzę pojawi się w zagrodzie. Sloty kupujesz w Stodole (przycisk 🏗️).</p>
                          </div>
                          {ANIMALS.map(a => {
                            const st = barnState[a.id];
                            const owned = st?.owned ?? 0;
                            const slots = st?.slots ?? a.startSlots;
                            const item = ANIMAL_ITEMS.find(i => i.id === a.itemId);
                            const locked = lvl < a.unlockLevel;
                            const noSlot = !locked && owned >= slots;
                            const tooPoor = !locked && !noSlot && displayMoney < a.buyPrice;
                            const canBuy = !locked && !noSlot && !tooPoor;
                            return (
                              <div key={a.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${locked ? "border-[#374151]/40 bg-black/10 opacity-60" : "border-[#8b6a3e]/40 bg-black/20"}`}>
                                <div className="flex h-[64px] w-[64px] items-center justify-center rounded-xl border border-[#8b6a3e]/40 bg-black/30 text-4xl">{a.icon}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-black text-[#f9e7b2]">{a.name}</p>
                                    <span className="rounded-full border border-[#8b6a3e]/40 bg-black/30 px-2 py-0.5 text-[10px] font-bold text-[#dfcfab]">LVL {a.unlockLevel}</span>
                                    {locked && <span className="rounded-full border border-red-500/40 bg-red-900/20 px-2 py-0.5 text-[10px] font-bold text-red-300">🔒 Zablokowane</span>}
                                  </div>
                                  <p className="mt-1 text-[11px] text-[#8b6a3e]">
                                    Produkuje: <span className="text-[#dfcfab] font-bold">{item?.icon} {item?.name}</span>
                                    {" · "}Czas: <span className="text-[#dfcfab] font-bold">{a.prodMs/3600000}h</span>
                                    {" · "}Magazyn: <span className="text-[#dfcfab] font-bold">{a.storageMax} cykli</span>
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[#8b6a3e]">
                                    Karma: {a.feed.map(f => `${f.icon} ${f.name}`).join(" lub ")}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[#8b6a3e]">
                                    Posiadasz: <span className={`font-black ${owned > 0 ? "text-emerald-300" : "text-[#dfcfab]"}`}>{owned}/{slots}</span>
                                    {" · "}Sprzedaż: <span className="text-amber-300 font-bold">{item?.sellPrice.toLocaleString()} 💰/szt</span>
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <p className="text-base font-black text-amber-400">{a.buyPrice.toLocaleString()} 💰</p>
                                  <button
                                    disabled={!canBuy}
                                    onClick={() => void handleBuyAnimalShop(a)}
                                    className={`rounded-xl border px-4 py-2 text-sm font-black transition ${canBuy ? "border-emerald-500/60 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/50" : "cursor-not-allowed border-[#374151] bg-black/20 text-[#6b7280]"}`}>
                                    {locked ? `🔒 LVL ${a.unlockLevel}` : noSlot ? "Brak slotów" : tooPoor ? "Za mało 💰" : "🛒 Kup"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {shopTab === "drzewa" && (() => {
                      const lvl = profile?.level ?? 1;
                      const maxSlots = getMaxTreeSlots(lvl);
                      const owned = getOrchardTotalOwned(orchardState);
                      const free = maxSlots - owned;
                      return (
                        <div className="flex flex-col gap-2 p-3">
                          <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">🌳 Sad — twoje miejsca</p>
                            <p className="mt-1 text-sm font-bold text-[#f9e7b2]">{owned} / {maxSlots} <span className="text-xs font-normal text-[#8b6a3e]">drzew (limit od poziomu: 10→2, 15→4, 20→6, 25→8)</span></p>
                            {maxSlots === 0 && <p className="mt-1 text-[11px] text-amber-300">Pierwsze miejsca odblokujesz na poziomie 10.</p>}
                            {free === 0 && maxSlots > 0 && <p className="mt-1 text-[11px] text-red-300">Wszystkie miejsca zajęte. Zwiększ poziom aby kupić więcej drzew.</p>}
                          </div>
                          {TREES.map(t => {
                            const locked = lvl < t.unlockLevel;
                            const canBuy = !locked && free > 0 && (profile?.money ?? 0) >= t.buyPrice;
                            const ownedHere = orchardState[t.id]?.owned ?? 0;
                            const avgDrop = ((t.dropMin + t.dropMax) / 2).toFixed(1);
                            const avgEarn = Math.round(((t.dropMin + t.dropMax) / 2) * t.pricePerFruit);
                            return (
                              <div key={t.id} className={`flex items-center gap-3 rounded-xl border bg-black/30 p-3 ${locked ? "border-[#8b6a3e]/20 opacity-60" : "border-[#8b6a3e]/50"}`}>
                                <div className="text-3xl shrink-0">{t.icon}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-black text-[#f9e7b2]">{t.name}</p>
                                    {ownedHere > 0 && <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black text-emerald-300">×{ownedHere} w sadzie</span>}
                                    {locked && <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-black text-red-300">🔒 LVL {t.unlockLevel}</span>}
                                  </div>
                                  <p className="text-[11px] text-[#dfcfab]">Owoc: {t.fruitIcon} {t.fruitName} · Drop: {t.dropMin}–{t.dropMax}/cykl · Cykl: {Math.round(t.growthTimeMs/3600000)}h · Cena owocu: {t.pricePerFruit}💰</p>
                                  <p className="text-[10px] text-[#8b6a3e]">Średnio ~{avgDrop} owoców → ~{avgEarn}💰 / cykl (przy zwykłych)</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-black text-[#f9e7b2]">{t.buyPrice}💰</p>
                                  <button
                                    disabled={!canBuy}
                                    onClick={() => {
                                      if (!profile?.id || !canBuy) return;
                                      setOrchardError("");
                                      void (async () => {
                                        const newMoney = (profile.money ?? 0) - t.buyPrice;
                                        const { error } = await supabase.from("profiles").update({ money: Math.round(newMoney * 100) / 100 }).eq("id", profile.id);
                                        if (error) { setOrchardError("Błąd zakupu: " + error.message); return; }
                                        const cur = orchardState[t.id] ?? { owned:0, prodStart:0, storage:{ zwykly:0, soczysty:0, zloty:0 } };
                                        saveOrchardState({ ...orchardState, [t.id]: { ...cur, owned: cur.owned + 1, prodStart: cur.prodStart || Date.now() } });
                                        await loadProfile(profile.id);
                                        setMessage({ type:"success", title:`${t.icon} Posadzono ${t.name}!`, text:`Pierwsze owoce za ${Math.round(t.growthTimeMs/3600000)}h.` });
                                      })();
                                    }}
                                    className={`mt-1 rounded-lg px-3 py-1 text-xs font-black ${canBuy ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
                                  >Kup</button>
                                </div>
                              </div>
                            );
                          })}
                          {orchardError && <p className="rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-300">{orchardError}</p>}
                        </div>
                      );
                    })()}
                  </div>
                  {/* Summary bar */}
                  {shopTab === "nasiona" && (() => {
                    const total = Object.entries(shopCart).reduce((s,[id,qty]) => s + (CROP_PRICES[id]??0)*(qty as number), 0);
                    const totalItems = Object.values(shopCart).reduce((s:number,v) => s+(v as number), 0);
                    const canAfford = displayMoney >= total;
                    return (
                      <div className="shrink-0 border-t border-[#8b6a3e]/40 bg-black/30 p-4">
                        {shopError && <p className="mb-2 rounded-lg bg-red-900/40 px-3 py-1.5 text-xs text-red-300">{shopError}</p>}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-[#8b6a3e]">Podsumowanie zamówienia:</p>
                            <p className="text-lg font-black text-[#f9e7b2]">{total.toFixed(2)} 💰 <span className="text-xs font-normal text-[#8b6a3e]">({totalItems} szt.)</span></p>
                            {!canAfford && total > 0 && <p className="text-xs text-red-400">Niewystarczające środki!</p>}
                          </div>
                          <button
                            disabled={total === 0 || !canAfford}
                            onClick={() => {
                              if (!profile?.id || total === 0 || !canAfford) return;
                              setShopError("");
                              void (async () => {
                                const newInv: Record<string,number> = {...seedInventory};
                                for (const [id,qty] of Object.entries(shopCart)) { if ((qty as number) > 0) newInv[id] = (newInv[id]??0) + (qty as number); }
                                const { error } = await supabase.from("profiles").update({ money: Math.round((displayMoney - total) * 100) / 100, seed_inventory: newInv }).eq("id", profile.id);
                                if (!error) { setShopCart({}); setShopError(""); await loadProfile(profile.id); }
                                else { setShopError("Błąd zakupu: " + error.message); }
                              })();
                            }}
                            className={`rounded-2xl px-6 py-3 font-black transition ${
                              total > 0 && canAfford ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"
                            }`}
                          >✅ Zatwierdź zakup</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {/* ═══ PANEL PLECAKA (prawy) ═══ */}
                <div className="flex w-[300px] shrink-0 flex-col border-l border-[#8b6a3e]/30 bg-[rgba(20,12,8,0.6)]">
                  <div className="flex items-center border-b border-[#8b6a3e]/30 px-4 py-3 pt-5">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">🎒 Plecak</p>
                  </div>
                  <div className="px-3 pt-3">
                    <div className="flex gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1">
                      {(["uprawy","przedmioty","owoce"] as const).map(tab => (
                        <button key={tab} type="button" onClick={() => setBackpackTab(tab)}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-bold uppercase tracking-[0.15em] transition ${backpackTab === tab ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "text-[#dfcfab] hover:bg-white/5"}`}>
                          {tab === "uprawy" ? "🌾 Uprawy" : tab === "przedmioty" ? "🎒 Przedmioty" : "🍎 Owoce"}
                        </button>
                      ))}
                    </div>
                    {backpackTab === "uprawy" && (
                      <div className="mt-2 flex gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1">
                        {BACKPACK_FILTER_OPTS.map(opt => (
                          <button key={opt.id} type="button" onClick={() => setBackpackSort(opt.id)}
                            title={opt.label}
                            className={`flex-1 rounded-lg py-1 text-[10px] font-bold uppercase tracking-[0.05em] transition ${backpackSort === opt.id ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "hover:bg-white/5"}`}
                            style={backpackSort === opt.id ? undefined : { color: opt.color }}>
                            {opt.short}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    {backpackTab === "uprawy" && (() => {
                      const allCrops = Object.entries(seedInventory).filter(([k,amt]) => Number(amt) > 0 && !isCompostKey(k)) as Array<[string,number]>;
                      const filtered = backpackSort === "all"
                        ? allCrops
                        : allCrops.filter(([k]) => (parseQualityKey(k).quality ?? "good") === backpackSort);
                      if (allCrops.length === 0) {
                        return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Plecak jest pusty.</div>;
                      }
                      if (filtered.length === 0) {
                        const fLabel = BACKPACK_FILTER_OPTS.find(o => o.id === backpackSort)?.label ?? "";
                        return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Brak upraw „{fLabel}".</div>;
                      }
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          {(() => {
                            return [...filtered].sort(([aId],[bId]) => {
                              const {baseCropId:_aC,quality:_aQ}=parseQualityKey(aId);
                              const {baseCropId:_bC,quality:_bQ}=parseQualityKey(bId);
                              const aLv=CROPS.find(c=>c.id===_aC)?.unlockLevel??999;
                              const bLv=CROPS.find(c=>c.id===_bC)?.unlockLevel??999;
                              if (aLv !== bLv) return aLv - bLv;
                              const qo:Record<string,number>={rotten:0,good:1,epic:2,legendary:3};
                              return (qo[_aQ??"good"]??1)-(qo[_bQ??"good"]??1);
                            }).map(([seedId,amount]) => {
                                const {baseCropId:_bc,quality:_bq}=parseQualityKey(seedId);
                                const crop=CROPS.find(c=>c.id===_bc);
                                if(!crop)return null;
                                const _qd=_bq?CROP_QUALITY_DEFS[_bq]:null;
                                const spr=_bq==="epic"&&crop.epicSpritePath?crop.epicSpritePath:_bq==="rotten"&&crop.rottenSpritePath?crop.rottenSpritePath:_bq==="legendary"&&crop.legendarySpritePath?crop.legendarySpritePath:crop.spritePath;
                                return (
                                  <button key={seedId} type="button"
                                    onClick={()=>{setSelectedSeedId(p=>p===seedId?null:seedId);setSelectedTool(null);}}
                                    className={`relative flex h-20 w-full items-center justify-center rounded-xl border transition ${_bq==="rotten"?"cursor-not-allowed":""}`}
                                    style={selectedSeedId===seedId?{borderColor:"#f6d860",background:"rgba(60,40,5,0.4)",boxShadow:"0 0 12px rgba(255,220,120,0.22)"}:_bq==="legendary"?{borderColor:_qd!.borderColor,background:_qd!.bgColor,animation:"legendaryPulse 2s ease-in-out infinite"}:_qd?{borderColor:_qd.borderColor,background:_qd.bgColor}:{borderColor:"#8b6a3e",background:"rgba(20,12,8,0.65)"}}>
                                    <img src={spr} alt={crop.name} className="absolute inset-0 h-full w-full object-contain rounded-xl" style={{imageRendering:"pixelated"}}/>
                                    {_bq==="legendary"&&<span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden"><span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{animation:"legendaryShimmer 2.4s ease-in-out infinite"}}/></span>}
                                    <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{amount}</span>
                                  </button>
                                );
                              });
                          })()}
                        </div>
                      );
                    })()}
                    {backpackTab === "przedmioty" && (
                      <div className="flex flex-col gap-2 mt-1">
                        {hiveData.empty_jars > 0 && (
                          <div className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2">
                            <img src="/jar_empty.png" alt="Słoik" className="w-16 h-16 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-[#f9e7b2]">Puste słoiki</p>
                              <p className="text-[10px] text-[#8b6a3e]">Do zbierania miodu</p>
                            </div>
                            <span className="text-base font-black text-amber-300">×{hiveData.empty_jars}</span>
                          </div>
                        )}
                        {hiveData.honey_jars > 0 && (
                          <div className="flex items-center gap-3 rounded-xl border border-amber-600/40 bg-black/20 px-3 py-2">
                            <img src="/jar_honey.png" alt="Miód" className="w-16 h-16 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-[#f9e7b2]">Słoiki z miodem</p>
                              <p className="text-[10px] text-[#8b6a3e]">Sprzedaj w Ladzie</p>
                            </div>
                            <span className="text-base font-black text-amber-300">×{hiveData.honey_jars}</span>
                          </div>
                        )}
                        {hiveData.suit_durability > 0 && (
                          <div className="group relative flex items-center gap-3 rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2 cursor-default">
                            <img src="/beekeeper_suit.png" alt="Strój" className="w-16 h-16 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-[#f9e7b2]">Strój pszczelarza</p>
                              <div className="mt-1 h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width:`${hiveData.suit_durability}%`, background: hiveData.suit_durability > 30 ? "#22c55e" : "#ef4444" }} />
                              </div>
                            </div>
                            <span className="text-xs font-black" style={{color: hiveData.suit_durability > 30 ? "#86efac" : "#fca5a5"}}>{hiveData.suit_durability}/100</span>
                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50">
                              <div className="rounded-xl border border-[#8b6a3e]/60 bg-[rgba(14,8,4,0.97)] px-3 py-2 text-center shadow-xl whitespace-nowrap">
                                <p className="text-xs font-black text-[#f9e7b2]">Strój pszczelarza</p>
                                <p className="text-[11px] text-amber-300 mt-0.5">{hiveData.suit_durability} zbiorów pozostało</p>
                                <p className="text-[10px] text-[#8b6a3e] mt-0.5">Kup nowy w Sklepie → Przedmioty</p>
                              </div>
                              <div className="h-2 w-2 rotate-45 border-r border-b border-[#8b6a3e]/60 bg-[rgba(14,8,4,0.97)] -mt-1" />
                            </div>
                          </div>
                        )}
                        {/* Kompost — przeciągalny na pola (z zaszytą wartością tieru) */}
                        {Object.keys(seedInventory)
                          .filter(k => isCompostKey(k) && (seedInventory[k] ?? 0) > 0)
                          .sort((a,b) => {
                            const ta = compostTypeFromKey(a) ?? "growth";
                            const tb = compostTypeFromKey(b) ?? "growth";
                            const order: Record<CompostType, number> = { growth:0, yield:1, exp:2 };
                            if (order[ta] !== order[tb]) return order[ta] - order[tb];
                            return compostValueFromKey(a) - compostValueFromKey(b);
                          })
                          .map(cid => {
                            const cnt = seedInventory[cid];
                            const t = compostTypeFromKey(cid)!;
                            const def = COMPOST_DEFS[t];
                            const value = compostValueFromKey(cid);
                            const tierIdx = def.bonusValues.indexOf(value);
                            const tierColor = tierIdx === 0 ? "#9ca3af" : tierIdx === 1 ? "#fbbf24" : "#a78bfa";
                            const isSel = selectedSeedId === cid;
                            return (
                              <div key={cid}
                                draggable
                                onDragStart={() => { setDraggedSeedId(cid); setSelectedSeedId(cid); setSelectedTool(null); }}
                                onDragEnd={() => setDraggedSeedId(null)}
                                onClick={() => { setSelectedSeedId(prev => prev === cid ? null : cid); setSelectedTool(null); }}
                                className="group relative flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer active:cursor-grabbing transition"
                                style={isSel
                                  ? { borderColor: tierColor, background: "rgba(60,40,5,0.4)", boxShadow: `0 0 12px ${tierColor}66` }
                                  : { borderColor: "rgba(6,95,70,0.5)", background: "rgba(6,78,59,0.3)" }}>
                                <span className="text-3xl">{def.icon}</span>
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-emerald-200">{def.name} <span className="font-black" style={{color: tierColor}}>· {def.tierName(value)}</span></p>
                                  <p className="text-[10px]" style={{color: tierColor}}>{def.bonusLabel(value)}</p>
                                  {isSel && <p className="text-[9px] font-black text-amber-300 mt-0.5">✓ ZAZNACZONY</p>}
                                </div>
                                <span className="text-base font-black text-emerald-300">×{cnt}</span>
                                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50">
                                  <div className="rounded-xl border border-emerald-600/60 bg-[rgba(8,16,10,0.97)] px-3 py-2 text-center shadow-xl whitespace-nowrap">
                                    <p className="text-xs font-black text-emerald-200">{def.icon} {def.name} <span style={{color: tierColor}}>({def.tierName(value)})</span></p>
                                    <p className="text-[10px] text-emerald-300/80 mt-0.5">{def.desc}</p>
                                    <p className="text-[11px] font-black mt-1" style={{color: tierColor}}>Bonus: {def.bonusLabel(value)}</p>
                                    <p className="text-[10px] text-amber-300 mt-1">↗ Przeciągnij lub kliknij i wybierz puste pole</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        {hiveData.empty_jars === 0 && hiveData.honey_jars === 0 && hiveData.suit_durability === 0 && !Object.keys(seedInventory).some(k => isCompostKey(k) && (seedInventory[k] ?? 0) > 0) && (
                          <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-4 text-center text-sm text-[#dfcfab]">
                            <p className="text-2xl mb-2">🎒</p>
                            <p>Brak przedmiotów.</p>
                            <p className="mt-1 text-xs text-[#8b6a3e]">Kup słoiki i strój pszczelarza w Sklepie lub zdobądź kompost w Kompostowniku.</p>
                          </div>
                        )}
                      </div>
                    )}
                    {backpackTab === "owoce" && (() => {
                      const entries = Object.entries(fruitInventory).filter(([,c]) => Number(c) > 0);
                      if (entries.length === 0) {
                        return (
                          <div className="mt-1 rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-center text-xs text-[#dfcfab]">
                            <p className="text-2xl mb-1">🍎</p>
                            <p>Brak owoców w plecaku.</p>
                            <p className="mt-1 text-[10px] text-[#8b6a3e]">Posadź drzewa w Sklepie i zbieraj w Sadzie.</p>
                          </div>
                        );
                      }
                      const grouped: Record<string, { zwykly:number; soczysty:number; zloty:number }> = {};
                      entries.forEach(([k,c]) => {
                        const lastUnd = k.lastIndexOf("_");
                        const fid = k.slice(0,lastUnd); const q = k.slice(lastUnd+1) as FruitQuality;
                        if (!grouped[fid]) grouped[fid] = { zwykly:0, soczysty:0, zloty:0 };
                        grouped[fid][q] = Number(c);
                      });
                      return (
                        <div className="flex flex-col gap-2 mt-1">
                          {Object.entries(grouped).map(([fid,q]) => {
                            const tree = TREES.find(t => t.fruitId === fid); if (!tree) return null;
                            const total = q.zwykly + q.soczysty + q.zloty;
                            const value = q.zwykly * tree.pricePerFruit + q.soczysty * tree.pricePerFruit * 2 + q.zloty * tree.pricePerFruit * 5;
                            return (
                              <div key={fid} className="rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{tree.fruitIcon}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-[#f9e7b2] truncate">{tree.fruitName} <span className="text-[10px] font-normal text-[#8b6a3e]">×{total}</span></p>
                                    <div className="mt-0.5 flex flex-wrap gap-1 text-[9px]">
                                      {q.zwykly>0   && <span className="rounded bg-emerald-900/40 border border-emerald-500/40 px-1 py-0.5 font-bold text-emerald-300">{q.zwykly}</span>}
                                      {q.soczysty>0 && <span className="rounded bg-cyan-900/40 border border-cyan-500/40 px-1 py-0.5 font-bold text-cyan-300">💧{q.soczysty}</span>}
                                      {q.zloty>0    && <span className="rounded bg-yellow-900/40 border border-yellow-500/40 px-1 py-0.5 font-bold text-yellow-300">✨{q.zloty}</span>}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-black text-amber-300 shrink-0">~{value.toLocaleString()}💰</span>
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-[9px] text-[#8b6a3e] text-center mt-1">Sprzedaż w Sadzie</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ DOM MODAL ═══ */}
          {showDomModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="relative flex h-[92vh] w-full max-w-[1650px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl">

                {/* ─ Zamknij ─ */}
                <button onClick={() => setShowDomModal(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>

                {/* ─ Sidebar ─ */}
                <div className="flex w-[264px] shrink-0 flex-col gap-3 border-r border-[#8b6a3e]/30 bg-black/20 p-8 pt-20">
                  <p className="mb-4 text-sm font-black uppercase tracking-widest text-[#8b6a3e]">🏠 Dom gracza</p>
                  {(["profil","eq"] as const).map(tab => (
                    <button key={tab} onClick={() => setDomTab(tab)}
                      className={`flex items-center gap-3 rounded-xl px-5 py-4 text-xl font-bold transition ${
                        domTab === tab ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"
                      }`}>
                      {tab === "profil" ? "👤" : "⚔️"}
                      {tab === "profil" ? "Profil" : "Ekwipunek"}
                    </button>
                  ))}
                </div>

                {/* ─ Zawartość ─ */}
                <div className="flex-1 overflow-y-auto p-9 pt-8 text-[#dfcfab]">

                  {/* ════ PROFIL ════ */}
                  {domTab === "profil" && (
                    <div className="flex gap-9">
                      {/* Lewa kolumna: avatar */}
                      <div className="flex w-72 shrink-0 flex-col items-center gap-6">
                        <button onClick={() => { setShowDomModal(false); setShowSkinModal(true); }}
                          className="flex h-56 w-56 items-center justify-center rounded-[28px] border-2 border-[#8b6a3e] bg-[rgba(38,24,14,0.8)] shadow-xl transition hover:border-yellow-400/60 overflow-hidden">
                          {avatarSkin >= 0
                            ? <img src={ALL_SKINS[avatarSkin]} alt="Avatar" className="w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                            : <span className="flex flex-col items-center justify-center gap-1 animate-pulse">
                                <span className="text-[#f9e7b2] text-xl font-black leading-tight text-center">Wybierz Avatar</span>
                                <span className="text-[#c9952f] text-sm font-bold">(kliknij)</span>
                              </span>}
                        </button>
                        <div className="text-center">
                          <p className="text-xl font-black text-[#f9e7b2]">{profile?.login}</p>
                          <p className="text-sm text-[#8b6a3e]">Poziom {displayLevel}</p>
                          <p className="mt-1 text-sm text-[#8b6a3e]">{Number(displayMoney).toFixed(2)} 💰</p>
                        </div>
                        {freeSkillPoints > 0 && (
                          <span className="rounded-xl bg-yellow-500/20 px-4 py-2 text-sm font-bold text-yellow-300">+{freeSkillPoints} pkt do rozdania</span>
                        )}
                      </div>

                      {/* Prawa kolumna: statystyki */}
                      <div className="flex-1">
                        <div className="mb-6 flex items-center justify-between">
                          <p className="text-xl font-black text-[#f9e7b2]">🧙 Statystyki gracza</p>
                          <div className="flex items-center gap-2 mr-8">
                            <span className="text-sm text-[#8b6a3e]">Dodaj:</span>
                            {([1,5,10] as const).map(n => (
                              <button key={n} onClick={() => setStatUpgradeAmount(n)}
                                className={`rounded-lg px-3 py-1 text-sm font-bold border transition ${
                                  statUpgradeAmount === n ? "border-yellow-400 bg-yellow-500/30 text-yellow-200" : "border-[#8b6a3e]/40 bg-black/20 text-[#8b6a3e] hover:border-yellow-600/60 hover:text-yellow-400"
                                }`}>+{n}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-5">
                          {STATS_DEFS.map(def => {
                            const val = playerStats[def.key];
                            const eff = calcStatEffect(val, def.rate);
                            const actualFreeAmt = Math.min(statUpgradeAmount, freeSkillPoints, Math.max(0, 100 - val));
                            const canFree = actualFreeAmt > 0;
                            let multiCost2 = 0; let actualBuyAmt2 = 0;
                            for (let _i = 0; _i < statUpgradeAmount; _i++) { if (val + _i >= 100) break; multiCost2 += getStatUpgradeCost(val + _i + 1); actualBuyAmt2++; }
                            const canBuy2 = !canFree && displayMoney >= multiCost2 && val < 100 && actualBuyAmt2 > 0;
                            const canUp2 = val < 100 && (canFree || canBuy2);
                            return (
                              <div key={def.key} className="rounded-xl border border-[#8b6a3e]/40 bg-black/20 p-5">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-2 text-base font-bold text-[#f9e7b2]">
                                    <img src={def.img} alt={def.label} className="w-32 h-32 object-contain" style={{imageRendering:"pixelated"}} onError={e => { (e.currentTarget as HTMLImageElement).style.display="none"; (e.currentTarget.nextSibling as HTMLElement).style.display="inline"; }} />
                                    <span style={{display:"none"}}>{def.icon}</span>
                                    {def.label}
                                  </span>
                                  <span className="text-sm text-[#8b6a3e]">{val}/100</span>
                                </div>
                                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-black/40">
                                  <div className="h-full rounded-full bg-gradient-to-r from-[#8b6a3e] to-[#f9e7b2]" style={{ width: `${val}%` }} />
                                </div>
                                {def.key === "opieka" && val > 0 && (
                                  <div className="mt-2 rounded-lg border border-green-500/20 bg-green-950/20 px-3 py-1.5 flex flex-col gap-0.5">
                                    <p className="text-[11px] text-green-300 font-bold">🐄 Efekty Opieki przy {val} pkt:</p>
                                    <p className="text-[11px] text-[#dfcfab]">🌿 Głód spada wolniej o <span className="font-bold text-green-300">{Math.min(90, val * 0.3).toFixed(1)}%</span></p>
                                    <p className="text-[11px] text-[#dfcfab]">📦 Szansa na bonus produkt: <span className="font-bold text-yellow-300">+{(val * 0.15).toFixed(1)}%</span></p>
                                  </div>
                                )}
                                <div className="mt-3 flex items-center justify-between">
                                  <span className="text-sm opacity-70">{def.desc}</span>
                                  <button disabled={!canUp2}
                                    onClick={() => {
                                      if (!profile?.id) return;
                                      if (canFree) {
                                        const next = { ...playerStats, [def.key]: val + actualFreeAmt };
                                        const nextFsp = freeSkillPoints - actualFreeAmt;
                                        setFreeSkillPoints(nextFsp); setPlayerStats(next);
                                        saveAvatarData(profile.id, avatarSkin, next, nextFsp, prevLevelRef.current);
                                      } else if (canBuy2) {
                                        const next = { ...playerStats, [def.key]: val + actualBuyAmt2 };
                                        void (async () => {
                                          const { error } = await supabase.from("profiles").update({ money: displayMoney - multiCost2 }).eq("id", profile.id);
                                          if (!error) { await loadProfile(profile.id); setPlayerStats(next); saveAvatarData(profile.id, avatarSkin, next, freeSkillPoints, prevLevelRef.current); }
                                        })();
                                      }
                                    }}
                                    className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                                      canFree ? "bg-yellow-500/30 text-yellow-200 hover:bg-yellow-500/50"
                                      : canBuy2 ? "bg-green-900/40 text-green-200 hover:bg-green-800/60"
                                      : val < 100 && actualBuyAmt2 > 0 ? "cursor-not-allowed opacity-50 bg-black/20 text-[#8b6a3e]"
                                      : "cursor-not-allowed opacity-30 bg-black/20 text-[#8b6a3e]"
                                    }`}>
                                    {canFree ? `▲ +${actualFreeAmt} Free` : val >= 100 ? "MAX" : `${multiCost2.toLocaleString("pl-PL")} 💰`}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Reset */}
                        <button className="mt-4 w-full rounded-xl border border-red-400/30 bg-red-950/30 py-2 text-xs font-bold text-red-300 transition hover:bg-red-950/60"
                          onClick={() => {
                            if (!profile?.id) return;
                            const resetCost = 50000;
                            if (displayMoney < resetCost) { alert("Potrzebujesz 50 000 💰 aby zresetować statystyki."); return; }
                            if (!confirm("Resetować wszystkie statystyki za 50 000 💰?")) return;
                            void (async () => {
                              const { error } = await supabase.from("profiles").update({ money: displayMoney - resetCost }).eq("id", profile.id);
                              if (!error) {
                                const totalSpent = Object.values(playerStats).reduce((s: number, v: unknown) => s + (v as number), 0);
                                const nextFsp = freeSkillPoints + totalSpent;
                                setPlayerStats({ ...DEFAULT_STATS }); setFreeSkillPoints(nextFsp);
                                saveAvatarData(profile.id, avatarSkin, { ...DEFAULT_STATS }, nextFsp, prevLevelRef.current);
                                await loadProfile(profile.id);
                              }
                            })();
                          }}>🔄 Reset statystyk (50 000 💰)</button>
                      </div>
                    </div>
                  )}

                  {/* ════ KOSMETYKA ════ */}
                  {/* ════ EKWIPUNEK ════ */}
                  {domTab === "eq" && (() => {
                    const SLOT_BOX = slotBoxCustom;
                    const handleUpg = async (slot, eqD) => {
                      const nextU = eqD.upg+1; const cost = getUpgradeCost(eqD.id, nextU);
                      if (displayMoney < cost) { setMessage({ type:"error", title:"Za mało złota!", text:`Potrzebujesz ${cost.toLocaleString()} 💰` }); return; }
                      // Sprawdź materiały (od +4)
                      const mats = getUpgradeMaterials(eqD.id, nextU);
                      const missing = mats.filter(m => (barnItems[m.matId] ?? 0) < m.qty);
                      if (missing.length > 0) {
                        const txt = missing.map(m => {
                          const md = ANIMAL_ITEMS.find(i => i.id === m.matId);
                          const have = barnItems[m.matId] ?? 0;
                          return `${md?.icon ?? "•"} ${md?.name ?? m.matId}: ${have}/${m.qty}`;
                        }).join("\n");
                        setMessage({ type:"error", title:"Brak materiałów!", text:txt });
                        return;
                      }
                      const { error: me } = await supabase.from("profiles").update({ money: displayMoney - cost }).eq("id", profile.id);
                      if (me) return;
                      // Odejmij materiały lokalnie
                      if (mats.length > 0) {
                        const newBarn = { ...barnItems };
                        mats.forEach(m => { newBarn[m.matId] = (newBarn[m.matId] ?? 0) - m.qty; });
                        saveBarnItems(newBarn);
                      }
                      const ok = Math.random() < UPGRADE_CHANCE[nextU];
                      let fu;
                      if (ok) { fu = nextU; setMessage({ type:"success", title:`✨ +${nextU} udane!`, text:`Koszt: ${cost.toLocaleString()} 💰` }); }
                      else if (eqD.upg <= 6) { fu = eqD.upg; setMessage({ type:"error", title:"Nie powiodło się.", text:`Item pozostaje na +${eqD.upg}.` }); }
                      else { fu = eqD.upg-1; setMessage({ type:"error", title:`⬇ Item cofa się do +${eqD.upg-1}!`, text:"Ulepszenie nie powiodło się." }); }
                      saveCharEquipped({ ...charEquipped, [slot]: { id: eqD.id, upg: fu } });
                      saveItemUpg({ ...itemUpgRegistry, [eqD.id]: fu });
                      await loadProfile(profile.id);
                    };
                    return (
                      <div>
                        {/* Tytuł + przycisk edycji hitboxów */}
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xl font-black text-[#f9e7b2]">⚔️ Ekwipunek gracza</p>
                          <button
                            onClick={() => setEditSlotBox(v => !v)}
                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${editSlotBox ? "border-orange-400 bg-orange-900/50 text-orange-300" : "border-[#8b6a3e]/60 bg-black/30 text-[#dfcfab] hover:border-orange-400/60 hover:text-orange-200"}`}>
                            🎯 {editSlotBox ? "Zakończ edycję" : "Edytuj hitboxy"}
                          </button>
                        </div>

                        {/* Panel edycji hitboxów */}
                        {editSlotBox && (
                          <div className="mb-3 rounded-xl border border-orange-400/40 bg-orange-950/30 p-3">
                            <p className="text-[10px] text-orange-300 uppercase tracking-widest mb-2">📐 Pozycje hitboxów (wartości w %)</p>
                            <div className="flex flex-wrap gap-4">
                              {(["glowa","dlonie","nogi"] as EquipSlot[]).map(sl => {
                                const b = slotBoxCustom[sl];
                                const lbl = { glowa:"👑 Głowa", dlonie:"🧤 Dłonie", nogi:"👢 Nogi" }[sl];
                                const upd = (field: string, val: string) => {
                                  const num = parseFloat(val);
                                  if (isNaN(num)) return;
                                  saveSlotBox({ ...slotBoxCustom, [sl]: { ...slotBoxCustom[sl], [field]: num } });
                                };
                                return (
                                  <div key={sl} className="flex flex-col gap-1 min-w-[160px]">
                                    <p className="text-[11px] font-black text-orange-200">{lbl}</p>
                                    {(["top","left","width","height"] as const).map(field => (
                                      <div key={field} className="flex items-center gap-2">
                                        <span className="text-[10px] text-[#8b6a3e] w-12">{field}</span>
                                        <input
                                          type="number" step="0.5" min="0" max="100"
                                          defaultValue={b[field]}
                                          onBlur={e => upd(field, e.target.value)}
                                          onKeyDown={e => { if (e.key === "Enter") upd(field, (e.target as HTMLInputElement).value); }}
                                          className="w-20 rounded border border-orange-400/40 bg-black/40 px-2 py-0.5 text-[11px] text-orange-100 outline-none focus:border-orange-400"
                                        />
                                        <span className="text-[10px] text-[#6b7280]">%</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button onClick={() => saveSlotBox({ ...DEFAULT_SLOT_BOX })}
                                className="rounded-lg border border-[#8b6a3e]/50 px-3 py-1 text-[10px] text-[#dfcfab] hover:bg-white/5">
                                ↺ Resetuj domyślne
                              </button>
                              <p className="text-[9px] text-[#6b7280] self-center">Zmiany zapisywane natychmiast. Enter lub kliknij poza pole.</p>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-3">
                          {/* Grafika postaci z hitboxami — plik: public/ekwip_postac.png */}
                          <div className="relative w-full rounded-xl overflow-hidden border border-[#8b6a3e]/30" style={{ aspectRatio:"1536/1024", background:"rgba(10,6,2,0.6)" }}>
                            <img src="/ekwip_postac.png" alt="Postać" draggable={false}
                              className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none" />
                            {(["glowa","dlonie","nogi"] as EquipSlot[]).map(slot => {
                              const box = SLOT_BOX[slot];
                              const eqD = charEquipped[slot];
                              const eItem = eqD ? CHAR_EQUIP_ITEMS.find(i => i.id === eqD.id) : null;
                              const upg = eqD?.upg ?? 0;
                              const uc = UPG_COLOR[upg] ?? "#6b7280";
                              const isOver = dragOverSlot === slot;
                              const isSel = equippingSlot === slot;
                              return (
                                <div key={slot}
                                  className="absolute rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition-all"
                                  style={{
                                    top:`${box.top}%`, left:`${box.left}%`, width:`${box.width}%`, height:`${box.height}%`,
                                    border:`2px ${isOver?"dashed":"solid"} ${isOver?"#fbbf24":isSel?"#fff":eqD?uc:"#8b6a3e"}`,
                                    background:isOver?"rgba(251,191,36,0.18)":isSel?"rgba(255,255,255,0.08)":eqD?"rgba(60,40,5,0.55)":"rgba(0,0,0,0.35)",
                                  }}
                                  onDragOver={e => { e.preventDefault(); setDragOverSlot(slot); }}
                                  onDragLeave={() => setDragOverSlot(null)}
                                  onDrop={e => {
                                    e.preventDefault(); setDragOverSlot(null);
                                    if (!draggedItemId) return;
                                    const di = CHAR_EQUIP_ITEMS.find(i => i.id === draggedItemId);
                                    if (!di || di.slot !== slot || (profile?.level??0) < di.unlockLevel) return;
                                    const existing = charEquipped[slot];
                                    saveCharEquipped({ ...charEquipped, [slot]: existing?.id === di.id ? null : { id: di.id, upg: getItemUpg(di.id) } });
                                    setDraggedItemId(null);
                                  }}
                                  onClick={() => { const next = isSel ? null : slot; setEquippingSlot(next); if (next) setEqFilter(next); }}
                                >
                                  {eItem ? (
                                    <>
                                      <span className="text-xl leading-none">{eItem.icon}</span>
                                      <span className="text-[30px] font-black mt-0.5" style={{ color:uc }}>+{upg}</span>
                                      <span className="text-[40px] text-[#f9e7b2] leading-tight text-center px-0.5 truncate w-full">{eItem.name.split(" ")[0]}</span>
                                    </>
                                  ) : (
                                    <span className="text-[9px] text-[#8b6a3e] text-center leading-tight">{EQUIP_SLOT_META[slot].icon} {EQUIP_SLOT_META[slot].label}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* Panel ulepszania wybranego slotu */}
                          {equippingSlot && charEquipped[equippingSlot] && (() => {
                            const slot = equippingSlot;
                            const eqD = charEquipped[slot];
                            const eItem = CHAR_EQUIP_ITEMS.find(i => i.id === eqD.id);
                            if (!eItem) return null;
                            const upg = eqD.upg; const uc = UPG_COLOR[upg]??"#6b7280";
                            return (
                              <div className="rounded-xl border border-[#8b6a3e]/50 bg-black/25 px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-base">{eItem.icon}</span>
                                      <p className="text-xs font-bold text-[#f9e7b2] truncate">{eItem.name}</p>
                                      <span className="text-[11px] font-black px-1.5 rounded" style={{ background:uc+"33", color:uc }}>+{upg}</span>
                                    </div>
                                    <p className="text-[10px] text-cyan-300 mt-0.5">{bonusLine(eItem.bonuses, upg)}</p>
                                    {upg < 10
                                      ? <p className="text-[11px] font-bold text-[#f9e7b2] mt-1">+{upg} → +{upg+1} · {Math.round(UPGRADE_CHANCE[upg+1]*100)}% szansy</p>
                                      : <p className="text-[11px] font-black mt-1" style={{ color:UPG_COLOR[10] }}>✦ MAKS +10 ✦</p>}
                                    {upg > 6 && upg < 10 && <p className="text-[10px] text-red-400">⚠ Fail: cofa do +{upg-1}</p>}
                                    {upg < 10 && (() => {
                                      const matsNeeded = getUpgradeMaterials(eqD.id, upg+1);
                                      if (matsNeeded.length === 0) return null;
                                      return (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {matsNeeded.map(m => {
                                            const md = ANIMAL_ITEMS.find(i => i.id === m.matId);
                                            const have = barnItems[m.matId] ?? 0;
                                            const enough = have >= m.qty;
                                            return (
                                              <span key={m.matId} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${enough ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50" : "bg-red-900/40 text-red-300 border border-red-700/50"}`}>
                                                {md?.icon ?? "•"} {have}/{m.qty}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-col gap-1 shrink-0">
                                    {upg < 10 && (() => {
                                      const matsNeeded = getUpgradeMaterials(eqD.id, upg+1);
                                      const matsOk = matsNeeded.every(m => (barnItems[m.matId] ?? 0) >= m.qty);
                                      return (
                                      <button type="button" onClick={() => handleUpg(slot, eqD)}
                                        disabled={!matsOk}
                                        className="rounded-xl border border-amber-500/60 bg-amber-900/20 px-2 py-1 text-xs font-bold text-amber-300 hover:bg-amber-900/40 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                                        ⚒ {getUpgradeCost(eqD.id, upg+1).toLocaleString()} 💰
                                      </button>
                                      );
                                    })()}
                                    <button type="button" onClick={() => { saveCharEquipped({ ...charEquipped, [slot]: null }); setEquippingSlot(null); }}
                                      className="rounded-xl border border-red-500/50 px-2 py-1 text-[10px] text-red-400 hover:bg-red-900/30">Zdejmij</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* Lista itemów — filtry + siatka */}
                          <div>
                            {/* Tabs filtrów */}
                            <div className="flex gap-1.5 mb-3 flex-wrap">
                              {([["","Wszystkie","⚔️"],["glowa","Głowa","👑"],["dlonie","Dłonie","🧤"],["nogi","Nogi","👢"]] as [EquipSlot|"",string,string][]).map(([val,lbl,ico]) => (
                                <button key={val} onClick={() => setEqFilter(val)}
                                  className={`flex items-center gap-1 rounded-lg border px-3 py-1 text-[11px] font-bold transition ${eqFilter===val?"border-yellow-400/70 bg-yellow-500/15 text-yellow-200":"border-[#8b6a3e]/50 bg-black/20 text-[#dfcfab] hover:border-[#8b6a3e] hover:bg-white/5"}`}>
                                  {ico} {lbl}
                                </button>
                              ))}
                            </div>
                            {/* Siatka kwadratowych slotów */}
                            <div className="grid grid-cols-5 gap-2">
                              {(() => {
                                const ownedList = CHAR_EQUIP_ITEMS
                                  .filter(i => !eqFilter || i.slot === eqFilter)
                                  .filter(i => ownedEqItems[i.id])
                                  .sort((a,b) => {
                                    // 1) wg poziomu rosnąco
                                    if (a.unlockLevel !== b.unlockLevel) return a.unlockLevel - b.unlockLevel;
                                    // 2) wg mocy ulepszenia malejąco (najmocniejsze wyżej w grupie tego samego poziomu)
                                    const aOn = charEquipped[a.slot]?.id === a.id;
                                    const bOn = charEquipped[b.slot]?.id === b.id;
                                    const aUpg = aOn ? (charEquipped[a.slot]?.upg ?? getItemUpg(a.id)) : getItemUpg(a.id);
                                    const bUpg = bOn ? (charEquipped[b.slot]?.upg ?? getItemUpg(b.id)) : getItemUpg(b.id);
                                    return bUpg - aUpg;
                                  });
                                if (ownedList.length === 0) {
                                  return (
                                    <div className="col-span-5 rounded-xl border border-dashed border-[#8b6a3e]/50 bg-black/20 p-6 text-center">
                                      <p className="text-3xl mb-2 opacity-60">🎒</p>
                                      <p className="text-sm font-bold text-[#dfcfab]">Brak zdobytych przedmiotów</p>
                                      <p className="text-[11px] text-[#8b6a3e] mt-1">Zdobądź przedmioty w Kompostowniku — jest 10% szans na losowy item z Twojego poziomu lub niższego.</p>
                                    </div>
                                  );
                                }
                                return ownedList.map(item => {
                                  const sl = item.slot;
                                  const isOn = charEquipped[sl]?.id === item.id;
                                  const regUpg = getItemUpg(item.id);
                                  const curUpg = isOn ? (charEquipped[sl]?.upg ?? regUpg) : regUpg;
                                  const uc = curUpg > 0 ? (UPG_COLOR[curUpg]??"#6b7280") : "#8b6a3e";
                                  const isDragging = draggedItemId === item.id;
                                  const slotIcon = ({glowa:"👑",dlonie:"🧤",nogi:"👢"} as Record<string,string>)[sl];
                                  return (
                                    <div key={item.id}
                                      draggable
                                      onDragStart={() => setDraggedItemId(item.id)}
                                      onDragEnd={() => setDraggedItemId(null)}
                                      onClick={() => { const nowOn = !isOn; saveCharEquipped({...charEquipped, [sl]: nowOn ? {id:item.id, upg:getItemUpg(item.id)} : null}); setEquippingSlot(nowOn ? sl : null); }}
                                      className={`group relative flex flex-col items-center justify-center aspect-square rounded-xl border transition select-none ${isDragging?"opacity-40 cursor-grabbing":"cursor-pointer hover:brightness-125"}`}
                                      style={{ borderColor:isOn?uc:"#8b6a3e", background:isOn?"rgba(60,40,5,0.55)":"rgba(10,6,2,0.55)", boxShadow:isOn?`0 0 8px ${uc}44`:"none" }}>
                                      <span className="absolute top-1 left-1 text-[8px] opacity-40">{slotIcon}</span>
                                      <span className="text-2xl leading-none">{item.icon}</span>
                                      <span className="mt-0.5 px-0.5 text-[8px] leading-tight truncate w-full text-center" style={{color:isOn?uc:"#9ca3af"}}>
                                        {item.name.split(" ")[0]}
                                      </span>
                                      {isOn && <span className="absolute top-1 right-1 rounded text-[8px] font-black px-0.5" style={{background:uc+"33",color:uc}}>✓{curUpg>0?` +${curUpg}`:""}</span>}
                                      {!isOn && curUpg>0 && <span className="absolute top-1 right-1 rounded text-[8px] font-black px-0.5" style={{background:uc+"22",color:uc}}>+{curUpg}</span>}
                                      {/* Tooltip */}
                                      <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[999] hidden group-hover:flex flex-col gap-1 min-w-[170px] max-w-[220px] rounded-xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-3 py-2 shadow-2xl text-left">
                                        <p className="text-[12px] font-black text-[#f9e7b2] leading-tight">{item.icon} {item.name}</p>
                                        <p className="text-[10px] text-[#8b6a3e]">{slotIcon} {EQUIP_SLOT_META[sl].label} · poziom <span className="font-bold text-[#dfcfab]">{item.unlockLevel}</span></p>
                                        <div className="h-px bg-[#8b6a3e]/30 my-0.5" />
                                        <p className="text-[11px] text-cyan-300 font-bold">{bonusLine(item.bonuses, curUpg)}</p>
                                        {curUpg > 0 && <p className="text-[10px] font-black" style={{color:uc}}>Ulepszenie: +{curUpg}</p>}
                                        {isOn && <p className="text-[10px] text-green-400 font-bold">✓ Założone</p>}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                          {/* ═══ EKWIPUNEK DODATKOWY (duplikaty) ═══ */}
                          {(() => {
                            const visibleExtras = (eqFilter
                              ? extraEqItems.filter(e => {
                                  const it = CHAR_EQUIP_ITEMS.find(i => i.id === e.id);
                                  return it && it.slot === eqFilter;
                                })
                              : extraEqItems
                            ).slice().sort((a, b) => {
                              // 1) wg poziomu rosnąco
                              const ia = CHAR_EQUIP_ITEMS.find(i => i.id === a.id);
                              const ib = CHAR_EQUIP_ITEMS.find(i => i.id === b.id);
                              const la = ia?.unlockLevel ?? 0;
                              const lb = ib?.unlockLevel ?? 0;
                              if (la !== lb) return la - lb;
                              // 2) wg mocy ulepszenia malejąco
                              return (b.upg ?? 0) - (a.upg ?? 0);
                            });
                            const handleUpgExtra = async (entry: ExtraEqEntry) => {
                              const nextU = entry.upg + 1;
                              const cost = getUpgradeCost(entry.id, nextU);
                              if (displayMoney < cost) { setMessage({ type:"error", title:"Za mało złota!", text:`Potrzebujesz ${cost.toLocaleString()} 💰` }); return; }
                              if (!profile?.id) return;
                              // Sprawdź materiały (od +4)
                              const mats = getUpgradeMaterials(entry.id, nextU);
                              const missing = mats.filter(m => (barnItems[m.matId] ?? 0) < m.qty);
                              if (missing.length > 0) {
                                const txt = missing.map(m => {
                                  const md = ANIMAL_ITEMS.find(i => i.id === m.matId);
                                  const have = barnItems[m.matId] ?? 0;
                                  return `${md?.icon ?? "•"} ${md?.name ?? m.matId}: ${have}/${m.qty}`;
                                }).join("\n");
                                setMessage({ type:"error", title:"Brak materiałów!", text:txt });
                                return;
                              }
                              const { error: me } = await supabase.from("profiles").update({ money: displayMoney - cost }).eq("id", profile.id);
                              if (me) return;
                              if (mats.length > 0) {
                                const newBarn = { ...barnItems };
                                mats.forEach(m => { newBarn[m.matId] = (newBarn[m.matId] ?? 0) - m.qty; });
                                saveBarnItems(newBarn);
                              }
                              const ok = Math.random() < UPGRADE_CHANCE[nextU];
                              let fu: number;
                              if (ok) { fu = nextU; setMessage({ type:"success", title:`✨ +${nextU} udane!`, text:`Koszt: ${cost.toLocaleString()} 💰` }); }
                              else if (entry.upg <= 6) { fu = entry.upg; setMessage({ type:"error", title:"Nie powiodło się.", text:`Item pozostaje na +${entry.upg}.` }); }
                              else { fu = entry.upg - 1; setMessage({ type:"error", title:`⬇ Item cofa się do +${entry.upg-1}!`, text:"Ulepszenie nie powiodło się." }); }
                              saveExtraEqItems(extraEqItems.map(e => e.uid === entry.uid ? { ...e, upg: fu } : e));
                              await loadProfile(profile.id);
                            };
                            const handleSwapExtra = (entry: ExtraEqEntry) => {
                              const mainUpg = itemUpgRegistry[entry.id] ?? 0;
                              if (mainUpg === entry.upg) return;
                              saveItemUpg({ ...itemUpgRegistry, [entry.id]: entry.upg });
                              saveExtraEqItems(extraEqItems.map(e => e.uid === entry.uid ? { ...e, upg: mainUpg } : e));
                              const it = CHAR_EQUIP_ITEMS.find(i => i.id === entry.id);
                              if (it && charEquipped[it.slot]?.id === entry.id) {
                                saveCharEquipped({ ...charEquipped, [it.slot]: { id: entry.id, upg: entry.upg } });
                              }
                              setMessage({ type:"success", title:"🔄 Zamieniono!", text:`Główny: +${entry.upg} ↔ Dodatkowy: +${mainUpg}` });
                            };
                            return (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-black uppercase tracking-widest text-[#8b6a3e]">📦 Ekwipunek Dodatkowy{eqFilter && <span className="ml-1 text-[#dfcfab]/70">· {({glowa:"👑 Głowa",dlonie:"🧤 Dłonie",nogi:"👢 Nogi"} as Record<string,string>)[eqFilter]}</span>}</p>
                              <p className="text-[10px] text-[#8b6a3e]/80">{visibleExtras.length}{eqFilter ? ` / ${extraEqItems.length}` : ""} {visibleExtras.length === 1 ? "przedmiot" : visibleExtras.length < 5 ? "przedmioty" : "przedmiotów"}</p>
                            </div>
                            {extraEqItems.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[#8b6a3e]/40 bg-black/15 p-4 text-center">
                                <p className="text-[11px] text-[#8b6a3e]">Tutaj trafiają duplikaty przedmiotów. Lepsze ulepszenie zostaje w głównym ekwipunku, słabsze (lub równe) wpada tutaj.</p>
                                <p className="text-[10px] text-[#6b7280] mt-1">Kliknij przedmiot, by go ulepszyć lub zamienić ze sztuką w głównym ekwipunku.</p>
                              </div>
                            ) : visibleExtras.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[#8b6a3e]/40 bg-black/15 p-4 text-center">
                                <p className="text-[11px] text-[#8b6a3e]">Brak duplikatów dla wybranego slotu.</p>
                                <p className="text-[10px] text-[#6b7280] mt-1">Wybierz „Wszystkie" w filtrze powyżej, by zobaczyć całość.</p>
                              </div>
                            ) : (
                              <>
                                {/* Panel akcji wybranego duplikatu */}
                                {selectedExtraUid && (() => {
                                  const entry = extraEqItems.find(e => e.uid === selectedExtraUid);
                                  if (!entry) return null;
                                  const item = CHAR_EQUIP_ITEMS.find(i => i.id === entry.id);
                                  if (!item) return null;
                                  const upg = entry.upg;
                                  const uc = upg > 0 ? (UPG_COLOR[upg] ?? "#6b7280") : "#8b6a3e";
                                  const mainUpg = itemUpgRegistry[item.id] ?? 0;
                                  return (
                                    <div className="mb-2 rounded-xl border border-[#8b6a3e]/50 bg-black/25 px-3 py-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-base">{item.icon}</span>
                                            <p className="text-xs font-bold text-[#f9e7b2] truncate">{item.name}</p>
                                            <span className="text-[11px] font-black px-1.5 rounded" style={{ background:uc+"33", color:uc }}>+{upg}</span>
                                            <span className="text-[10px] text-[#8b6a3e]">vs główny: <span className="font-black text-[#dfcfab]">+{mainUpg}</span></span>
                                          </div>
                                          <p className="text-[10px] text-cyan-300 mt-0.5">{bonusLine(item.bonuses, upg)}</p>
                                          {upg < 10
                                            ? <p className="text-[11px] font-bold text-[#f9e7b2] mt-1">+{upg} → +{upg+1} · {Math.round(UPGRADE_CHANCE[upg+1]*100)}% szansy</p>
                                            : <p className="text-[11px] font-black mt-1" style={{ color:UPG_COLOR[10] }}>✦ MAKS +10 ✦</p>}
                                          {upg > 6 && upg < 10 && <p className="text-[10px] text-red-400">⚠ Fail: cofa do +{upg-1}</p>}
                                        </div>
                                        <div className="flex flex-col gap-1 shrink-0">
                                          {upg < 10 && (() => {
                                            const matsNeeded = getUpgradeMaterials(entry.id, upg+1);
                                            const matsOk = matsNeeded.every(m => (barnItems[m.matId] ?? 0) >= m.qty);
                                            return (
                                            <button type="button" onClick={() => handleUpgExtra(entry)}
                                              disabled={!matsOk}
                                              className="rounded-xl border border-amber-500/60 bg-amber-900/20 px-2 py-1 text-xs font-bold text-amber-300 hover:bg-amber-900/40 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                                              ⚒ {getUpgradeCost(entry.id, upg+1).toLocaleString()} 💰
                                            </button>
                                            );
                                          })()}
                                          {upg < 10 && (() => {
                                            const matsNeeded = getUpgradeMaterials(entry.id, upg+1);
                                            if (matsNeeded.length === 0) return null;
                                            return (
                                              <div className="flex flex-wrap gap-0.5 justify-end">
                                                {matsNeeded.map(m => {
                                                  const md = ANIMAL_ITEMS.find(i => i.id === m.matId);
                                                  const have = barnItems[m.matId] ?? 0;
                                                  const enough = have >= m.qty;
                                                  return (
                                                    <span key={m.matId} className={`text-[9px] font-bold px-1 py-0.5 rounded ${enough ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"}`}>
                                                      {md?.icon ?? "•"}{have}/{m.qty}
                                                    </span>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })()}
                                          <button type="button" onClick={() => handleSwapExtra(entry)}
                                            disabled={mainUpg === upg}
                                            title={mainUpg === upg ? "Identyczne ulepszenia — zamiana bez efektu" : "Przenieś do głównego ekwipunku"}
                                            className="rounded-xl border border-cyan-500/60 bg-cyan-900/20 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                                            🔄 Zamień (+{mainUpg})
                                          </button>
                                          <button type="button" onClick={() => setSelectedExtraUid(null)}
                                            className="rounded-xl border border-[#8b6a3e]/50 px-2 py-1 text-[10px] text-[#dfcfab] hover:bg-white/5">
                                            Zamknij
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                                <div className="grid grid-cols-5 gap-2">
                                  {visibleExtras.map(entry => {
                                    const item = CHAR_EQUIP_ITEMS.find(i => i.id === entry.id);
                                    if (!item) return null;
                                    const uc = entry.upg > 0 ? (UPG_COLOR[entry.upg] ?? "#6b7280") : "#8b6a3e";
                                    const slotIcon = ({glowa:"👑",dlonie:"🧤",nogi:"👢"} as Record<string,string>)[item.slot];
                                    const isSel = selectedExtraUid === entry.uid;
                                    return (
                                      <div key={entry.uid}
                                        onClick={() => setSelectedExtraUid(isSel ? null : entry.uid)}
                                        className="group relative flex flex-col items-center justify-center aspect-square rounded-xl border transition select-none cursor-pointer hover:brightness-125"
                                        style={{ borderColor: isSel ? "#fbbf24" : "#8b6a3e", background: isSel ? "rgba(60,40,5,0.55)" : "rgba(10,6,2,0.55)", boxShadow: isSel ? "0 0 8px rgba(251,191,36,0.55)" : "none", opacity: isSel ? 1 : 0.92 }}>
                                        <span className="absolute top-1 left-1 text-[8px] opacity-40">{slotIcon}</span>
                                        <span className="text-2xl leading-none">{item.icon}</span>
                                        <span className="mt-0.5 px-0.5 text-[8px] leading-tight truncate w-full text-center" style={{color: isSel ? "#f9e7b2" : "#9ca3af"}}>
                                          {item.name.split(" ")[0]}
                                        </span>
                                        <span className="absolute top-1 right-1 rounded text-[8px] font-black px-0.5" style={{background:uc+"22",color:uc}}>+{entry.upg}</span>
                                        {/* Tooltip */}
                                        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[999] hidden group-hover:flex flex-col gap-1 min-w-[170px] max-w-[220px] rounded-xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-3 py-2 shadow-2xl text-left">
                                          <p className="text-[12px] font-black text-[#f9e7b2] leading-tight">{item.icon} {item.name}</p>
                                          <p className="text-[10px] text-[#8b6a3e]">{slotIcon} {EQUIP_SLOT_META[item.slot].label} · poziom <span className="font-bold text-[#dfcfab]">{item.unlockLevel}</span></p>
                                          <div className="h-px bg-[#8b6a3e]/30 my-0.5" />
                                          <p className="text-[11px] text-cyan-300 font-bold">{bonusLine(item.bonuses, entry.upg)}</p>
                                          <p className="text-[10px] font-black" style={{color:uc}}>Ulepszenie: +{entry.upg}</p>
                                          <p className="text-[10px] text-[#8b6a3e]/80 italic">Kliknij, by ulepszyć lub zamienić</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            </div>
          )}

          {/* ═══ KOMPOSTOWNIK MODAL ═══ */}
          {showKompostModal && (() => {
            const readyBatchesUI = kompostBatches.filter(b => b.fill >= 10);
            const readyRewards = readyBatchesUI.length;
            // Aktualnie zapełniana partia (pierwsza niepełna lub pusta jeśli wszystkie pełne / brak)
            const currentBatch = kompostBatches.find(b => b.fill < 10) ?? { fill: 0, scoreSum: 0 };
            const currentScore = currentBatch.fill > 0 ? currentBatch.scoreSum / currentBatch.fill : 0;
            const currentQuality = getCompostQualityFromScore(currentScore);
            const currentQualityDef = getCompostQualityDef(currentQuality);
            const totalBatchesUsed = kompostBatches.length;
            const batchSlotsFull = totalBatchesUsed >= KOMPOST_MAX_BATCHES && (kompostBatches[kompostBatches.length - 1]?.fill ?? 0) >= 10;
            const QTY_OPTIONS: Array<1|5|10|100|"max"> = [1,5,10,100,"max"];
            const FILTER_OPTIONS: Array<{ id: typeof kompostFilter; label: string; color: string }> = [
              { id:"rotten",    label:"Popsute",     color:"#ffffff" },
              { id:"good",      label:"Standardowe", color:"#dfcfab" },
              { id:"epic",      label:"Epickie",     color:"#a78bfa" },
              { id:"legendary", label:"Legendarne",  color:"#fbbf24" },
              { id:"all",       label:"Wszystkie",   color:"#6ee7b7" },
            ];
            return (
              <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                <div className="relative w-full max-w-[920px] h-[92vh] overflow-hidden rounded-[28px] border border-emerald-700/60 bg-[rgba(10,18,12,0.98)] shadow-2xl flex flex-col">
                  <button onClick={() => { setShowKompostModal(false); setKompostRewards(null); }} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-emerald-700/60 bg-black/40 text-emerald-200 transition hover:border-red-400/60 hover:text-red-300">✕</button>

                  <div className="px-6 pt-6 pb-3 border-b border-emerald-800/40">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">🌿</span>
                      <div className="flex-1">
                        <h2 className="text-2xl font-black text-emerald-200">Kompostownik</h2>
                        <p className="text-xs text-emerald-400/70 mt-0.5">Wrzucaj uprawy — każde 10 wrzutów = 1 partia. Jakość nagrody zależy od średniej wartości plonów.</p>
                      </div>
                    </div>
                    {/* Pasek aktualnej partii + jakość + score */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-emerald-300">Aktualna partia</span>
                        <span className="font-black text-emerald-200">
                          Zapełnienie: {currentBatch.fill} / 10
                          {readyRewards > 0 && <span className="ml-2 text-amber-300">+ {readyRewards} gotowych</span>}
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-emerald-950/60 border border-emerald-800/50 overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${(currentBatch.fill / 10) * 100}%`, background: `linear-gradient(to right, ${currentQualityDef.border}, ${currentQualityDef.color})` }} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1">
                        <span className="text-emerald-500/70">Score: <span className="font-black" style={{ color: currentQualityDef.color }}>{currentBatch.fill > 0 ? currentScore.toFixed(2) : "—"}</span></span>
                        <span className="font-bold" style={{ color: currentQualityDef.color }}>Jakość: {currentBatch.fill > 0 ? currentQualityDef.label : "—"}</span>
                      </div>
                      {/* Slots wszystkich partii (10 kropek) */}
                      <div className="mt-2 flex items-center gap-1">
                        {Array.from({ length: KOMPOST_MAX_BATCHES }).map((_, i) => {
                          const b = kompostBatches[i];
                          const isReady = !!b && b.fill >= 10;
                          const isPartial = !!b && b.fill > 0 && b.fill < 10;
                          const score = b && b.fill > 0 ? b.scoreSum / b.fill : 0;
                          const q = getCompostQualityDef(getCompostQualityFromScore(score));
                          const bg = isReady ? q.color : isPartial ? q.border : "#1f2937";
                          const ttl = b ? `Partia ${i+1}: ${b.fill}/10 · score ${score.toFixed(2)} · ${q.label}` : `Partia ${i+1}: pusta`;
                          return <div key={i} title={ttl} className="flex-1 h-2 rounded-sm border border-emerald-900/60" style={{ background: bg, opacity: b ? 1 : 0.4 }} />;
                        })}
                      </div>
                      <p className="text-[10px] text-emerald-500/70 mt-1">Partie: {totalBatchesUsed} / {KOMPOST_MAX_BATCHES} · łączne wrzuty: {kompostCharges}{batchSlotsFull && <span className="ml-2 text-red-300">(odbierz nagrody, by wrzucać dalej)</span>}</p>
                    </div>
                    {/* Przycisk odbioru nagród — zawsze widoczny żeby uniknąć layout shift */}
                    <button
                      onClick={() => { if (readyRewards > 0) void claimKompostReward(); }}
                      disabled={readyRewards === 0}
                      className={`mt-3 w-full rounded-2xl border-2 px-6 py-3 text-base font-black transition shadow-lg ${
                        readyRewards > 0
                          ? "border-emerald-400 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:scale-[1.02] shadow-emerald-500/30 animate-pulse cursor-pointer"
                          : "border-emerald-900/50 bg-emerald-950/30 text-emerald-700/60 shadow-none cursor-not-allowed"
                      }`}>
                      {readyRewards > 0
                        ? `🎲 Odbierz ${readyRewards} ${readyRewards === 1 ? "nagrodę" : readyRewards < 5 ? "nagrody" : "nagród"}`
                        : `🎲 Brak gotowych nagród`}
                    </button>
                  </div>

                  {/* Sticky controls — pasek ilości + filtr (NIE scrolluje się z uprawami) */}
                  <div className="px-6 pt-3 pb-2 border-b border-emerald-800/30 bg-[rgba(8,16,10,0.85)]">
                    {/* Wybór ilości */}
                    <div className="mb-2">
                      <p className="text-[11px] text-emerald-400/80 mb-1">Ilość przy kliknięciu:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {QTY_OPTIONS.map(q => (
                          <button
                            key={String(q)}
                            onClick={() => setKompostQty(q)}
                            className={`px-3 py-1 rounded-lg text-xs font-black border transition ${kompostQty === q ? "border-emerald-300 bg-emerald-700/60 text-white" : "border-emerald-800/60 bg-emerald-950/40 text-emerald-300 hover:border-emerald-500/60"}`}>
                            {q === "max" ? "Max" : q}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Filtr jakości */}
                    <div>
                      <p className="text-[11px] text-emerald-400/80 mb-1">Filtruj uprawy:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {FILTER_OPTIONS.map(f => (
                          <button
                            key={f.id}
                            onClick={() => setKompostFilter(f.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-black border transition ${kompostFilter === f.id ? "bg-emerald-700/60 text-white" : "bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40"}`}
                            style={{ borderColor: kompostFilter === f.id ? f.color : "rgba(8,80,40,0.6)" }}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {/* Siatka upraw */}
                    {(() => {
                      let cropEntries = (Object.entries(seedInventory).filter(
                        ([k, amt]) => Number(amt) > 0 && !isCompostKey(k)
                      ) as Array<[string, number]>);
                      if (kompostFilter !== "all") {
                        cropEntries = cropEntries.filter(([k]) => parseQualityKey(k).quality === kompostFilter);
                      }
                      if (cropEntries.length === 0) {
                        return (
                          <div className="rounded-2xl border border-dashed border-emerald-800/50 bg-black/20 p-8 text-center">
                            <p className="text-4xl mb-3">🥕</p>
                            <p className="text-sm font-bold text-emerald-200">{kompostFilter === "all" ? "Brak upraw do kompostowania" : `Brak upraw z filtrem „${FILTER_OPTIONS.find(f=>f.id===kompostFilter)?.label}"`}</p>
                            <p className="text-[11px] text-emerald-400/70 mt-1">Zmień filtr lub zbierz uprawy z pola.</p>
                          </div>
                        );
                      }
                      const sorted = [...cropEntries].sort(([aId], [bId]) => {
                        const a = parseQualityKey(aId);
                        const b = parseQualityKey(bId);
                        const aLv = CROPS.find(c => c.id === a.baseCropId)?.unlockLevel ?? 999;
                        const bLv = CROPS.find(c => c.id === b.baseCropId)?.unlockLevel ?? 999;
                        return aLv !== bLv ? aLv - bLv : (a.quality ?? "").localeCompare(b.quality ?? "");
                      });
                      return (
                        <div className="grid grid-cols-5 gap-2">
                          {sorted.map(([seedKey, amount]) => {
                            const { baseCropId, quality } = parseQualityKey(seedKey);
                            const crop = CROPS.find(c => c.id === baseCropId);
                            if (!crop) return null;
                            const qDef = quality ? CROP_QUALITY_DEFS[quality] : null;
                            const sprite = quality === "epic" && crop.epicSpritePath ? crop.epicSpritePath
                              : quality === "rotten" && crop.rottenSpritePath ? crop.rottenSpritePath
                              : quality === "legendary" && crop.legendarySpritePath ? crop.legendarySpritePath
                              : crop.spritePath;
                            const qty = kompostQty === "max" ? amount : Math.min(kompostQty, amount);
                            return (
                              <button
                                key={seedKey}
                                onClick={() => void depositCropToCompost(seedKey, qty)}
                                disabled={batchSlotsFull}
                                title={batchSlotsFull ? "Wszystkie partie pełne — odbierz nagrody" : `Wrzuć ${qty} szt.`}
                                className="group relative flex flex-col items-center justify-center aspect-square rounded-xl border border-emerald-800/60 bg-emerald-950/40 hover:border-emerald-400 hover:bg-emerald-900/50 hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed p-2"
                                style={qDef ? { borderColor: qDef.borderColor + "88" } : undefined}>
                                {sprite ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={sprite} alt={crop.name} className="w-10 h-10 object-contain" />
                                ) : (
                                  <span className="text-3xl">🌱</span>
                                )}
                                <span className="mt-1 text-[10px] font-bold text-emerald-200 truncate w-full text-center">{crop.name}</span>
                                {qDef && <span className="text-[9px] font-black" style={{ color: qDef.borderColor }}>{qDef.label}</span>}
                                <span className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[10px] font-black text-emerald-200">×{amount}</span>
                                <span className="absolute bottom-1 right-1 rounded bg-emerald-700/80 px-1 text-[9px] font-black text-white">+{qty}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="px-6 py-3 border-t border-emerald-800/40 text-center">
                    <p className="text-[11px] text-emerald-500/70">
                      Rodzaje kompostu: ⚡ Wzrost (-5/10/15% czasu) · 🌾 Urodzaj (+1/2/3 plon) · ⭐ Nauka (+10/20/30% EXP)
                    </p>
                  </div>
                </div>

                {/* Panel nagród (overlay) */}
                {kompostRewards && (
                  <div className="absolute inset-0 z-[10] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-[720px] max-h-[88vh] overflow-hidden rounded-[24px] border-2 border-emerald-400/70 bg-[rgba(8,18,12,0.98)] shadow-2xl shadow-emerald-500/30 flex flex-col">
                      <div className="px-6 pt-5 pb-3 border-b border-emerald-800/40 text-center">
                        <div className="text-5xl mb-2">🎁</div>
                        <h3 className="text-2xl font-black text-emerald-200">Zdobyłeś {kompostRewards.length} {kompostRewards.length === 1 ? "nagrodę" : kompostRewards.length < 5 ? "nagrody" : "nagród"}!</h3>
                        <p className="text-xs text-emerald-400/70 mt-1">Najedź na nagrodę, aby zobaczyć szczegóły.</p>
                      </div>
                      <div className="flex-1 overflow-y-auto px-6 py-4">
                        {(() => {
                          const grouped = new Map<string, { entry: KompostRewardEntry; count: number }>();
                          for (const r of kompostRewards) {
                            const key = r.kind === "item" ? `i:${r.itemId}` : `c:${r.compostType}:${r.value}`;
                            const ex = grouped.get(key);
                            if (ex) ex.count++; else grouped.set(key, { entry: r, count: 1 });
                          }
                          return (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                              {Array.from(grouped.values()).map((g, i) => {
                                const r = g.entry;
                                if (r.kind === "item") {
                                  const it = CHAR_EQUIP_ITEMS.find(x => x.id === r.itemId);
                                  const tipNode = (
                                    <>
                                      <p className="text-xs font-black text-amber-200">🎁 Przedmiot ekwipunku</p>
                                      <p className="text-[11px] font-bold text-amber-100">{r.itemIcon} {r.itemName}</p>
                                      {it && <p className="text-[10px] text-amber-300/80">Poziom: {it.unlockLevel} · Slot: {EQUIP_SLOT_META[it.slot]?.label}</p>}
                                      {it && <p className="text-[10px] text-cyan-300">{bonusLine(it.bonuses, 0)}</p>}
                                      <p className="text-[10px] text-emerald-300 mt-1">✓ Trafił do Twojego ekwipunku</p>
                                    </>
                                  );
                                  const showTip = (e: React.MouseEvent<HTMLDivElement>) => {
                                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                    setKompostHoverTip({ x: rect.left + rect.width / 2, y: rect.top, node: tipNode, color: "#fbbf24" });
                                  };
                                  return (
                                    <div
                                      key={i}
                                      onMouseEnter={showTip}
                                      onMouseMove={showTip}
                                      onMouseLeave={() => setKompostHoverTip(null)}
                                      className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-amber-400/70 bg-amber-950/40 p-2 shadow-lg shadow-amber-500/20 hover:border-amber-300 transition cursor-help">
                                      <span className="text-3xl">{r.itemIcon}</span>
                                      <span className="mt-1 text-[10px] font-black text-amber-200 truncate w-full text-center">{r.itemName}</span>
                                      {g.count > 1 && <span className="absolute top-1 right-1 rounded bg-amber-700 px-1 text-[10px] font-black text-white">×{g.count}</span>}
                                    </div>
                                  );
                                }
                                const def = COMPOST_DEFS[r.compostType];
                                const tierIdx = def.bonusValues.indexOf(r.value);
                                const tierColor = tierIdx === 0 ? "#9ca3af" : tierIdx === 1 ? "#fbbf24" : "#a78bfa";
                                const tipNode = (
                                  <>
                                    <p className="text-xs font-black text-emerald-200">{def.icon} {def.name}</p>
                                    <p className="text-[10px] text-emerald-300/80">{def.desc}</p>
                                    <p className="text-[11px] font-black mt-1" style={{ color: tierColor }}>Tier: {def.tierName(r.value)}</p>
                                    <p className="text-[11px] font-black" style={{ color: tierColor }}>Bonus: {def.bonusLabel(r.value)}</p>
                                    <p className="text-[10px] text-amber-300 mt-1">↗ Przeciągnij na pole z uprawą w plecaku</p>
                                  </>
                                );
                                const showTip = (e: React.MouseEvent<HTMLDivElement>) => {
                                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                  setKompostHoverTip({ x: rect.left + rect.width / 2, y: rect.top, node: tipNode, color: tierColor });
                                };
                                return (
                                  <div
                                    key={i}
                                    onMouseEnter={showTip}
                                    onMouseMove={showTip}
                                    onMouseLeave={() => setKompostHoverTip(null)}
                                    className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 bg-emerald-950/40 p-2 shadow-lg hover:brightness-110 transition cursor-help"
                                    style={{ borderColor: tierColor }}>
                                    <span className="text-3xl">{def.icon}</span>
                                    <span className="mt-1 text-[9px] font-black text-emerald-200 truncate w-full text-center">{def.name.replace("Kompost ","")}</span>
                                    <span className="text-[9px] font-black" style={{ color: tierColor }}>{def.tierName(r.value)}</span>
                                    {g.count > 1 && <span className="absolute top-1 right-1 rounded bg-emerald-700 px-1 text-[10px] font-black text-white">×{g.count}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="px-6 py-3 border-t border-emerald-800/40 flex justify-center">
                        <button
                          onClick={() => { setKompostRewards(null); setKompostHoverTip(null); }}
                          className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 py-2 text-sm font-black text-white hover:scale-105 transition shadow-lg shadow-emerald-500/30">
                          Świetnie!
                        </button>
                      </div>
                    </div>
                    {/* Fixed-position tooltip — poza overflow-hidden panelu */}
                    {kompostHoverTip && (() => {
                      const TIP_W = 240;
                      const TIP_H_EST = 130;
                      const margin = 10;
                      const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
                      const vh = typeof window !== "undefined" ? window.innerHeight : 720;
                      let left = kompostHoverTip.x - TIP_W / 2;
                      left = Math.max(margin, Math.min(vw - TIP_W - margin, left));
                      let top = kompostHoverTip.y - TIP_H_EST - 12;
                      const placeBelow = top < margin;
                      if (placeBelow) top = kompostHoverTip.y + 70;
                      top = Math.max(margin, Math.min(vh - TIP_H_EST - margin, top));
                      return (
                        <div
                          className="pointer-events-none fixed z-[9999] flex flex-col gap-1 rounded-xl border-2 px-3 py-2 shadow-2xl text-left bg-[rgba(8,18,12,0.98)]"
                          style={{ left, top, width: TIP_W, borderColor: kompostHoverTip.color }}>
                          {kompostHoverTip.node}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ POWIADOMIENIE KOMPOSTU ═══ */}
          {compostNotice && (() => {
            const _cnDef = COMPOST_DEFS[compostNotice.type];
            return (
              <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[400] animate-fade-in">
                <div className="rounded-2xl border border-emerald-500/60 bg-[rgba(10,30,15,0.97)] px-5 py-3 shadow-2xl shadow-emerald-500/30 flex items-center gap-3">
                  <span className="text-3xl">{_cnDef.icon}</span>
                  <div>
                    <p className="text-sm font-black text-emerald-200">Kompost aktywowany!</p>
                    <p className="text-xs text-emerald-300/90">
                      {_cnDef.name} · Bonus: {_cnDef.bonusLabel(compostNotice.value)} · Pole #{compostNotice.plotId}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {showUlModal && (() => {
            const hlvl = hiveData.level;
            const maxHoney = HIVE_MAX_HONEY[hlvl] ?? 16;
            const elapsed = hiveData.honey_start != null ? Math.max(0, hiveNow - hiveData.honey_start) : 0;
            const honeyAvailable = hiveData.honey_start != null ? Math.min(Math.floor(elapsed / HONEY_MS_PER_PT), maxHoney) : 0;
            const msToNext = HONEY_MS_PER_PT - (elapsed % HONEY_MS_PER_PT);
            const secToNext = Math.ceil(msToNext / 1000);
            const hh = Math.floor(secToNext / 3600);
            const mm = Math.floor((secToNext % 3600) / 60);
            const ss = secToNext % 60;
            const timerStr = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
            const beesNeeded = HIVE_UPGRADE_BEES[hlvl] ?? 50;
            const beesProgress = Math.min(hiveData.bees_progress, beesNeeded);
            const canCollect = honeyAvailable > 0 && hiveData.empty_jars > 0 && hiveData.suit_durability > 0;
            const suitPct = Math.round((hiveData.suit_durability / 100) * 100);
            const hiveBonusPct = hlvl * 2;
            const hiveImg = `/ul_${hlvl}.png`;
            const addBees = async (n: number) => {
              if (!profile?.id) return;
              const add = Math.min(n, beesNeeded - beesProgress);
              if (add <= 0) return;
              const { data, error } = await supabase.rpc("add_hive_bees", { p_user_id: profile.id, p_amount: add });
              if (!error && data?.ok) setHiveData(data.hive_data as HiveData);
            };
            const collectHoney = async () => {
              if (!profile?.id) return;
              // Bonusy z eq: % produkcji miodu (g3 Kapelusz Pszczelarza), % zużycia stroju (d20 Rękawice Pszczelarza)
              const _honeyBonusPct = getEquipBonusPct("% produkcji miodu", charEquipped);
              const _suitSavePct   = getEquipBonusPct("% zużycia stroju", charEquipped);
              const { data, error } = await supabase.rpc("collect_honey", {
                p_user_id: profile.id,
                p_honey_bonus_pct: _honeyBonusPct,
                p_suit_save_pct:   _suitSavePct,
              });
              if (error || !data?.ok) {
                const msg = data?.error === "no_honey" ? "Poczekaj — miód jeszcze nie jest gotowy!"
                          : data?.error === "no_jars"  ? "Brak pustych słoików!"
                          : data?.error === "no_suit"  ? "Brak stroju pszczelarza!"
                          : "Błąd zbierania miodu — spróbuj ponownie.";
                setMessage({ type:"error", title: msg, text:"" });
                return;
              }
              setHiveData(data.hive_data as HiveData);
              if (data.success) {
                const _bonusInfo = _honeyBonusPct > 0 ? ` (+${_honeyBonusPct.toFixed(0)}% produkcji)` : "";
                setMessage({ type:"success", title:`Zebrano ${data.collected} ${data.collected === 1 ? "słoik" : data.collected < 5 ? "słoiki" : "słoików"} miodu! 🍯${_bonusInfo}`, text:"" });
              }
              else setMessage({ type:"error", title:"Pszczoły były niespokojne — miód się nie udał!", text:"" });
            };
            return (
              <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                <div className="relative flex w-full max-w-[650px] flex-col rounded-[28px] border border-amber-600/60 bg-[rgba(14,8,4,0.98)] p-8 shadow-2xl gap-5">
                  <button onClick={() => setShowUlModal(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">🍯</span>
                    <div>
                      <h2 className="text-2xl font-black text-[#f9e7b2]">Ul — poziom {hlvl}</h2>
                      <p className="text-sm text-amber-400/80">Pszczoły przyspieszają wzrost o {hiveBonusPct}%</p>
                    </div>
                  </div>
                  {/* Obraz ula */}
                  <div className="flex justify-center">
                    <img src={hiveImg} alt={`Ul poziom ${hlvl}`} className="h-36 object-contain" style={{imageRendering:"pixelated"}} onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }} />
                  </div>
                  {/* Miód */}
                  <div className="rounded-2xl border border-amber-600/30 bg-black/30 p-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[#dfcfab] font-bold">🍯 Miód</span>
                      <span className="text-amber-300 font-black">{honeyAvailable} / {maxHoney}</span>
                    </div>
                    <div className="h-3 rounded-full bg-black/40 border border-amber-700/30 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all" style={{ width:`${maxHoney > 0 ? (honeyAvailable/maxHoney*100) : 0}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-[#8b6a3e]">Następny słoik za: <span className="text-amber-300 font-bold">{timerStr}</span></p>
                  </div>
                  {/* Zasoby */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3 flex items-center gap-3">
                      <img src="/jar_empty.png" alt="Słoiki" className="w-8 h-8 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0";}} />
                      <div>
                        <p className="text-xs text-[#8b6a3e]">Puste słoiki</p>
                        <p className="font-black text-[#f9e7b2]">{hiveData.empty_jars}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3 flex items-center gap-3">
                      <img src="/jar_honey.png" alt="Miód" className="w-8 h-8 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0";}} />
                      <div>
                        <p className="text-xs text-[#8b6a3e]">Słoiki z miodem</p>
                        <p className="font-black text-[#f9e7b2]">{hiveData.honey_jars}</p>
                      </div>
                    </div>
                  </div>
                  {/* Strój pszczelarza */}
                  <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <img src="/beekeeper_suit.png" alt="Strój" className="w-8 h-8 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#dfcfab]">Strój pszczelarza</span>
                          <span className={hiveData.suit_durability > 0 ? "text-green-400" : "text-red-400"}>{hiveData.suit_durability}/100</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/40 border border-[#8b6a3e]/30 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width:`${suitPct}%`, background: hiveData.suit_durability > 30 ? "#22c55e" : "#ef4444" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Przycisk zbioru */}
                  <button
                    disabled={!canCollect}
                    onClick={() => { void collectHoney(); }}
                    className={`w-full rounded-xl py-3 text-sm font-black transition ${canCollect ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
                  >
                    {!canCollect && hiveData.suit_durability <= 0 ? "🚫 Brak stroju pszczelarza" : !canCollect && hiveData.empty_jars <= 0 ? "🚫 Brak słoików" : !canCollect ? "🕐 Poczekaj na miód" : `🍯 Zbierz miód (${Math.min(honeyAvailable, hiveData.empty_jars)} słoiki)`}
                  </button>
                  {/* Ulepszanie ula */}
                  {hlvl < 5 && (
                    <div className="rounded-2xl border border-amber-600/30 bg-black/30 p-4">
                      <p className="text-sm font-bold text-[#dfcfab] mb-2">🐝 Dokup pszczoły ({beesProgress}/{beesNeeded})</p>
                      <div className="h-2 rounded-full bg-black/40 overflow-hidden mb-3">
                        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width:`${beesNeeded > 0 ? (beesProgress/beesNeeded*100) : 0}%` }} />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {[1,5,10].map(n => (
                          <button key={n} disabled={beesProgress >= beesNeeded} onClick={() => { void addBees(n); }}
                            className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-800/30 disabled:opacity-40 disabled:cursor-not-allowed">
                            +{n} 🐝
                          </button>
                        ))}
                        <button disabled={beesProgress >= beesNeeded} onClick={() => { void addBees(beesNeeded - beesProgress); }}
                          className="rounded-lg border border-amber-500/60 bg-amber-700/20 px-4 py-2 text-xs font-bold text-yellow-200 hover:bg-amber-700/30 disabled:opacity-40 disabled:cursor-not-allowed">
                          MAX 🐝
                        </button>
                      </div>
                      {beesProgress >= beesNeeded && <p className="mt-2 text-xs text-green-400 font-bold">✅ Ul gotowy do ulepszenia!</p>}
                    </div>
                  )}
                  {hlvl >= 5 && <p className="text-center text-sm text-amber-300 font-bold">✨ Ul osiągnął maksymalny poziom!</p>}
                  <button onClick={() => setShowUlModal(false)} className="w-full rounded-xl border border-[#8b6a3e]/50 bg-black/30 py-3 text-sm font-bold text-[#f3e6c8] transition hover:border-[#d4a64f]/60 hover:bg-black/50">
                    ✕ Zamknij (Esc)
                  </button>
                </div>
              </div>
            );
          })()}

          {showLadaModal && (() => {
            const jarPrice = HONEY_JAR_PRICE[hiveData.level] ?? 8;
            const honeyOwned = hiveData.honey_jars;
            const clampedHoneyQty = Math.min(ladaSellQty, honeyOwned);
            const honeyTotal = clampedHoneyQty * jarPrice;
            const sellHoney = async (qty: number) => {
              if (!profile?.id || qty <= 0 || ladaSelling) return;
              setLadaSelling(true);
              const { data, error } = await supabase.rpc("sell_honey", { p_user_id: profile.id, p_qty: qty });
              if (!error && data?.ok) {
                setHiveData(data.hive_data as HiveData);
                await loadProfile(profile.id);
                setMessage({ type:"success", title:`Sprzedano ${data.sold} ${data.sold === 1 ? "słoik" : data.sold < 5 ? "słoiki" : "słoików"} za ${Number(data.earned).toFixed(2)} zł! 💰`, text:"" });
              } else {
                setMessage({ type:"error", title:"Błąd sprzedaży — spróbuj ponownie.", text:"" });
              }
              setLadaSelling(false);
            };
            // Sprzedaż produktów ze zwierząt (te same dane co w stodole — barnItems)
            const sellAnimalItem = async (itemId: string, qty: number) => {
              if (!profile?.id || qty <= 0 || barnSelling) return;
              const have = barnItems[itemId] ?? 0;
              const realQty = Math.min(qty, have);
              if (realQty <= 0) return;
              const item = ANIMAL_ITEMS.find(i => i.id === itemId);
              if (!item) return;
              setBarnSelling(itemId);
              const earned = item.sellPrice * realQty;
              const { error } = await supabase.from("profiles").update({ money: displayMoney + earned }).eq("id", profile.id);
              if (error) { setBarnSelling(null); setMessage({type:"error",title:"Błąd sprzedaży",text:error.message}); return; }
              const newItems = { ...barnItems };
              newItems[itemId] = have - realQty;
              if (newItems[itemId] <= 0) delete newItems[itemId];
              saveBarnItems(newItems);
              setBarnSellQtys(q => ({ ...q, [itemId]: 1 }));
              await loadProfile(profile.id);
              setBarnSelling(null);
              setMessage({type:"success",title:`${item.icon} Sprzedano!`,text:`+${earned.toLocaleString()} 💰 (${realQty} ${item.name})`});
            };
            const animalItemsToSell = ANIMAL_ITEMS.filter(i => (barnItems[i.id] ?? 0) > 0);
            // Owoce z sadu - per (fruitId, quality)
            const fruitEntriesToSell = Object.entries(fruitInventory)
              .filter(([,c]) => Number(c) > 0)
              .map(([k,c]) => {
                const lastUnd = k.lastIndexOf("_");
                const fruitId = k.slice(0, lastUnd);
                const q = k.slice(lastUnd+1) as FruitQuality;
                const tree = TREES.find(tt => tt.fruitId === fruitId);
                const qd = FRUIT_QUALITY_DEFS[q];
                if (!tree || !qd) return null;
                return { key: k, tree, q, qd, count: Number(c), unitPrice: tree.pricePerFruit * qd.mult };
              })
              .filter((x): x is NonNullable<typeof x> => x !== null);
            const sellFruit = async (key: string, qty: number, unitPrice: number, name: string, icon: string) => {
              if (!profile?.id || qty <= 0 || ladaFruitSelling) return;
              const have = fruitInventory[key] ?? 0;
              const realQty = Math.min(qty, have);
              if (realQty <= 0) return;
              setLadaFruitSelling(key);
              const earned = unitPrice * realQty;
              const newMoney = Math.round((displayMoney + earned) * 100) / 100;
              const { error } = await supabase.from("profiles").update({ money: newMoney }).eq("id", profile.id);
              if (error) { setLadaFruitSelling(null); setMessage({type:"error",title:"Błąd sprzedaży",text:error.message}); return; }
              const newInv = { ...fruitInventory };
              newInv[key] = have - realQty;
              if (newInv[key] <= 0) delete newInv[key];
              saveFruitInventory(newInv);
              setLadaFruitQtys(q => ({ ...q, [key]: 1 }));
              await loadProfile(profile.id);
              setLadaFruitSelling(null);
              setMessage({type:"success",title:`${icon} Sprzedano!`,text:`+${earned.toLocaleString()} 💰 (${realQty} ${name})`});
            };
            const hasAnythingToSell = honeyOwned > 0 || animalItemsToSell.length > 0 || fruitEntriesToSell.length > 0;
            return (
              <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                <div className="relative flex w-full max-w-[640px] max-h-[92vh] flex-col rounded-[28px] border border-amber-600/60 bg-[rgba(14,8,4,0.98)] shadow-2xl overflow-hidden">
                  <button onClick={() => setShowLadaModal(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>

                  {/* Nagłówek (stały) */}
                  <div className="px-6 pt-6 pb-4 border-b border-amber-700/30">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">🛒</span>
                      <div>
                        <h2 className="text-2xl font-black text-[#f9e7b2]">Lada dla klientów</h2>
                        <p className="text-sm text-amber-400/80">Sprzedaj produkty z ula, zagrody i sadu</p>
                      </div>
                    </div>
                  </div>

                  {/* Lista do sprzedaży (scrollowalna) */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {!hasAnythingToSell && (
                      <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-6 text-center">
                        <p className="text-3xl mb-2">🪹</p>
                        <p className="text-[#dfcfab] text-sm font-bold">Nie masz nic do sprzedania.</p>
                        <p className="text-xs text-[#8b6a3e]/80 mt-1">Zbierz miód w Ulu lub produkty w Stodole, a potem wróć tutaj!</p>
                      </div>
                    )}

                    {/* Karta miodu (jak dotychczas — własny qty/sell) */}
                    {honeyOwned > 0 && (
                      <div className="rounded-xl border border-amber-600/40 bg-black/30 p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <img src="/jar_honey.png" alt="Słoik miodu" className="w-12 h-12 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                          <div className="flex-1">
                            <p className="text-base font-black text-[#f9e7b2]">Słoiki z miodem</p>
                            <p className="text-[11px] text-[#8b6a3e]">Posiadasz: <span className="font-bold text-[#dfcfab]">{honeyOwned}</span> · Cena: <span className="font-bold text-amber-400">{jarPrice} zł</span> · Poziom ula {hiveData.level}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <button
                            onClick={() => setLadaSellQty(q => Math.max(1, q - 1))}
                            disabled={ladaSellQty <= 1 || ladaSelling}
                            className="w-8 h-8 rounded-lg border border-[#8b6a3e]/50 bg-black/30 text-[#f3e6c8] font-black text-base hover:bg-black/50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >−</button>
                          <input
                            type="number"
                            min={1}
                            max={honeyOwned}
                            value={ladaSellQty}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v)) setLadaSellQty(Math.max(1, Math.min(honeyOwned, v)));
                            }}
                            disabled={ladaSelling}
                            className="flex-1 min-w-0 rounded-lg border border-[#8b6a3e]/50 bg-black/40 text-center text-[#f9e7b2] font-black text-base py-1 outline-none focus:border-amber-500 disabled:opacity-50"
                          />
                          <button
                            onClick={() => setLadaSellQty(q => Math.min(honeyOwned, q + 1))}
                            disabled={ladaSellQty >= honeyOwned || ladaSelling}
                            className="w-8 h-8 rounded-lg border border-[#8b6a3e]/50 bg-black/30 text-[#f3e6c8] font-black text-base hover:bg-black/50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >+</button>
                          <button
                            onClick={() => setLadaSellQty(honeyOwned)}
                            disabled={ladaSelling}
                            className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-800/30 disabled:opacity-40"
                          >MAX</button>
                        </div>
                        <button
                          onClick={() => { void sellHoney(clampedHoneyQty); }}
                          disabled={clampedHoneyQty <= 0 || ladaSelling}
                          className="w-full rounded-xl py-2.5 text-sm font-black transition border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {ladaSelling ? "⏳ Sprzedaję..." : `🛒 Sprzedaj ${clampedHoneyQty} za ${honeyTotal.toFixed(2)} zł`}
                        </button>
                      </div>
                    )}

                    {/* Karty produktów ze zwierząt — analogicznie jak miód */}
                    {animalItemsToSell.map(i => {
                      const have = barnItems[i.id] ?? 0;
                      const qty = Math.min(barnSellQtys[i.id] ?? 1, have);
                      const value = qty * i.sellPrice;
                      const isSelling = barnSelling === i.id;
                      return (
                        <div key={i.id} className="rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">{i.icon}</span>
                            <div className="flex-1">
                              <p className="text-base font-black text-[#f9e7b2]">{i.name}</p>
                              <p className="text-[11px] text-[#8b6a3e]">Posiadasz: <span className="font-bold text-[#dfcfab]">{have}</span> · Cena: <span className="font-bold text-amber-400">{i.sellPrice.toLocaleString()} 💰</span></p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <button
                              onClick={() => setBarnSellQtys(q => ({ ...q, [i.id]: Math.max(1, (q[i.id] ?? 1) - 1) }))}
                              disabled={qty <= 1 || isSelling}
                              className="w-8 h-8 rounded-lg border border-[#8b6a3e]/50 bg-black/30 text-[#f3e6c8] font-black text-base hover:bg-black/50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >−</button>
                            <input
                              type="number"
                              min={1}
                              max={have}
                              value={qty}
                              onChange={e => {
                                const v = parseInt(e.target.value, 10);
                                if (!isNaN(v)) setBarnSellQtys(q => ({ ...q, [i.id]: Math.max(1, Math.min(have, v)) }));
                              }}
                              disabled={isSelling}
                              className="flex-1 min-w-0 rounded-lg border border-[#8b6a3e]/50 bg-black/40 text-center text-[#f9e7b2] font-black text-base py-1 outline-none focus:border-amber-500 disabled:opacity-50"
                            />
                            <button
                              onClick={() => setBarnSellQtys(q => ({ ...q, [i.id]: Math.min(have, (q[i.id] ?? 1) + 1) }))}
                              disabled={qty >= have || isSelling}
                              className="w-8 h-8 rounded-lg border border-[#8b6a3e]/50 bg-black/30 text-[#f3e6c8] font-black text-base hover:bg-black/50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >+</button>
                            <button
                              onClick={() => setBarnSellQtys(q => ({ ...q, [i.id]: have }))}
                              disabled={isSelling}
                              className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-800/30 disabled:opacity-40"
                            >MAX</button>
                          </div>
                          <button
                            onClick={() => { void sellAnimalItem(i.id, qty); }}
                            disabled={qty <= 0 || isSelling}
                            className="w-full rounded-xl py-2.5 text-sm font-black transition border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isSelling ? "⏳ Sprzedaję..." : `🛒 Sprzedaj ${qty} za ${value.toLocaleString()} 💰`}
                          </button>
                        </div>
                      );
                    })}

                    {/* Karty owoców z sadu — per (fruitId, quality) */}
                    {fruitEntriesToSell.length > 0 && (
                      <div className="rounded-xl border border-emerald-600/30 bg-emerald-950/10 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-300 mb-2">🌳 Owoce z sadu</p>
                        <div className="space-y-2">
                          {fruitEntriesToSell.map(f => {
                            const have = f.count;
                            const qty = Math.min(ladaFruitQtys[f.key] ?? have, have);
                            const value = qty * f.unitPrice;
                            const isSelling = ladaFruitSelling === f.key;
                            const labelName = `${f.tree.fruitName}${f.q !== "zwykly" ? ` (${f.qd.label})` : ""}`;
                            return (
                              <div key={f.key} className="rounded-lg border border-[#8b6a3e]/40 bg-black/30 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-2xl">{f.tree.fruitIcon}</span>
                                  {f.qd.icon && <span className="text-base" style={{color: f.qd.color}}>{f.qd.icon}</span>}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-[#f9e7b2]">{f.tree.fruitName} <span className="text-[11px] font-bold" style={{color: f.qd.color}}>{f.qd.label}</span></p>
                                    <p className="text-[10px] text-[#8b6a3e]">Posiadasz: <span className="font-bold text-[#dfcfab]">{have}</span> · Cena: <span className="font-bold text-amber-400">{f.unitPrice.toLocaleString()} 💰/szt</span></p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <button
                                    onClick={() => setLadaFruitQtys(q => ({ ...q, [f.key]: Math.max(1, (q[f.key] ?? have) - 1) }))}
                                    disabled={qty <= 1 || isSelling}
                                    className="w-8 h-8 rounded-lg border border-[#8b6a3e]/50 bg-black/30 text-[#f3e6c8] font-black text-base hover:bg-black/50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >−</button>
                                  <input
                                    type="number"
                                    min={1}
                                    max={have}
                                    value={qty}
                                    onChange={e => {
                                      const v = parseInt(e.target.value, 10);
                                      if (!isNaN(v)) setLadaFruitQtys(q => ({ ...q, [f.key]: Math.max(1, Math.min(have, v)) }));
                                    }}
                                    disabled={isSelling}
                                    className="flex-1 min-w-0 rounded-lg border border-[#8b6a3e]/50 bg-black/40 text-center text-[#f9e7b2] font-black text-base py-1 outline-none focus:border-amber-500 disabled:opacity-50"
                                  />
                                  <button
                                    onClick={() => setLadaFruitQtys(q => ({ ...q, [f.key]: Math.min(have, (q[f.key] ?? have) + 1) }))}
                                    disabled={qty >= have || isSelling}
                                    className="w-8 h-8 rounded-lg border border-[#8b6a3e]/50 bg-black/30 text-[#f3e6c8] font-black text-base hover:bg-black/50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >+</button>
                                  <button
                                    onClick={() => setLadaFruitQtys(q => ({ ...q, [f.key]: have }))}
                                    disabled={isSelling}
                                    className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-800/30 disabled:opacity-40"
                                  >MAX</button>
                                </div>
                                <button
                                  onClick={() => { void sellFruit(f.key, qty, f.unitPrice, labelName, f.tree.fruitIcon); }}
                                  disabled={qty <= 0 || isSelling}
                                  className="w-full rounded-xl py-2 text-sm font-black transition border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {isSelling ? "⏳ Sprzedaję..." : `🛒 Sprzedaj ${qty} za ${value.toLocaleString()} 💰`}
                                </button>
                              </div>
                            );
                          })}
                          {fruitEntriesToSell.length > 1 && (() => {
                            const totalValue = fruitEntriesToSell.reduce((s,f) => s + f.count * f.unitPrice, 0);
                            const isSellingAll = ladaFruitSelling === "__ALL__";
                            return (
                              <button
                                disabled={isSellingAll || !!ladaFruitSelling}
                                onClick={async () => {
                                  if (!profile?.id || ladaFruitSelling) return;
                                  setLadaFruitSelling("__ALL__");
                                  const newMoney = Math.round((displayMoney + totalValue) * 100) / 100;
                                  const { error } = await supabase.from("profiles").update({ money: newMoney }).eq("id", profile.id);
                                  if (error) { setLadaFruitSelling(null); setMessage({type:"error",title:"Błąd sprzedaży",text:error.message}); return; }
                                  saveFruitInventory({});
                                  setLadaFruitQtys({});
                                  await loadProfile(profile.id);
                                  setLadaFruitSelling(null);
                                  setMessage({type:"success",title:`💰 Sprzedano wszystkie owoce!`,text:`+${totalValue.toLocaleString()} 💰`});
                                }}
                                className="w-full rounded-xl border border-emerald-500/60 bg-emerald-900/30 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-40 disabled:cursor-not-allowed">
                                {isSellingAll ? "⏳ Sprzedaję..." : `💰 Sprzedaj WSZYSTKIE owoce za ${totalValue.toLocaleString()} 💰`}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stopka (stała) */}
                  <div className="border-t border-amber-700/30 p-4">
                    <button onClick={() => setShowLadaModal(false)} className="w-full rounded-xl border border-[#8b6a3e]/50 bg-black/30 py-2.5 text-sm font-bold text-[#f3e6c8] transition hover:border-[#d4a64f]/60 hover:bg-black/50">
                      ✕ Zamknij
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {showStodolaModal && (() => {
            const lvl = profile?.level ?? 0;
            const opiekaPts = playerStats?.opieka ?? 0;
            const bonusChancePct = (opiekaPts * 0.15).toFixed(1);
            const hungerReducePct = (opiekaPts * 0.3).toFixed(1);
            const handleBuyAnimal = async (a: AnimalDef) => {
              const st = barnState[a.id];
              if (displayMoney < a.buyPrice) { setMessage({type:"error",title:"Za mało złota!",text:`Potrzebujesz ${a.buyPrice.toLocaleString()} 💰`}); return; }
              if (st.owned >= st.slots) { setMessage({type:"error",title:"Brak miejsca!",text:`Kup więcej slotów dla ${a.name}.`}); return; }
              const {error} = await supabase.from("profiles").update({money: displayMoney - a.buyPrice}).eq("id", profile.id);
              if (error) return;
              saveBarnState({...barnState, [a.id]: {...st, owned: st.owned+1}});
              await loadProfile(profile.id);
              setMessage({type:"success",title:`${a.icon} Kupiono!`,text:`${a.name} dołączyła do zagrody.`});
            };
            const handleBuySlot = async (a: AnimalDef) => {
              const st = barnState[a.id];
              const upg = st.slots - a.startSlots;
              if (upg >= a.slotUpgCosts.length) { setMessage({type:"info",title:"Maks!",text:`Maksymalna liczba slotów dla ${a.name}.`}); return; }
              const cost = a.slotUpgCosts[upg];
              if (displayMoney < cost) { setMessage({type:"error",title:"Za mało złota!",text:`Potrzebujesz ${cost.toLocaleString()} 💰`}); return; }
              const {error} = await supabase.from("profiles").update({money: displayMoney - cost}).eq("id", profile.id);
              if (error) return;
              saveBarnState({...barnState, [a.id]: {...st, slots: st.slots+1}});
              await loadProfile(profile.id);
              setMessage({type:"success",title:"Slot kupiony!",text:`${a.name}: ${st.slots+1} / ${a.maxSlots}`});
            };
            const handleFeed = async (a: AnimalDef, cropKey: string, points: number, cropName: string, cropIcon: string) => {
              const have = seedInventory[cropKey] ?? 0;
              if (have < 1) { setMessage({type:"error",title:"Brak karmy!",text:`Potrzebujesz ${cropName} (${cropIcon}).`}); return; }
              if (!profile?.id) return;
              const st = barnState[a.id];
              const curH = barnCurrentHunger(st, opiekaPts);
              const newH = Math.min(100, curH + points);
              const newInv: Record<string,number> = { ...seedInventory, [cropKey]: have - 1 };
              setSeedInventory(newInv);
              saveBarnState({...barnState, [a.id]: {...st, hunger: newH, lastFedAt: Date.now()}});
              await supabase.from("profiles").update({ seed_inventory: serializeSeedInventory(newInv) }).eq("id", profile.id);
              setMessage({type:"success",title:`${a.icon} Nakarmiono!`,text:`+${points} sytości → ${Math.round(newH)}%`});
            };
            const handleCollect = (a: AnimalDef) => {
              const st = barnState[a.id];
              if (st.storage === 0 || st.owned === 0) return;
              const item = ANIMAL_ITEMS.find(i => i.id === a.itemId)!;
              // 1 cykl storage = owned sztuk produktu
              const baseCollected = st.storage * st.owned;
              const rewardBonus = getEquipBonusPct("% reward zwierząt", charEquipped) / 100;
              const collected = Math.floor(baseCollected * (1 + rewardBonus));
              const bonusUnits = collected - baseCollected;
              const newItems = {...barnItems, [a.itemId]: (barnItems[a.itemId]??0) + collected};
              saveBarnItems(newItems);
              saveBarnState({...barnState, [a.id]: {...st, storage: 0, prodStart: barnNow}});
              const bonusMsg = bonusUnits > 0 ? ` 🎁 +${bonusUnits} z eq (+${(rewardBonus*100).toFixed(1)}%)` : "";
              setMessage({type:"success",title:`${item.icon} Odebrano!`,text:`+${collected} ${item.name} (${st.storage} cykli × ${st.owned} ${a.name.toLowerCase()})${bonusMsg}`});
            };
            const handleCollectAll = () => {
              let changed = false; const newItems = {...barnItems}; const newState = {...barnState};
              let totalItems = 0;
              const rewardBonus = getEquipBonusPct("% reward zwierząt", charEquipped) / 100;
              ANIMALS.forEach(a => {
                const st = barnState[a.id];
                if (st.storage > 0 && st.owned > 0) {
                  const baseCollected = st.storage * st.owned;
                  const collected = Math.floor(baseCollected * (1 + rewardBonus));
                  newItems[a.itemId] = (newItems[a.itemId]??0) + collected;
                  newState[a.id] = {...st, storage:0, prodStart: barnNow};
                  totalItems += collected;
                  changed = true;
                }
              });
              if (!changed) return;
              saveBarnItems(newItems); saveBarnState(newState);
              setMessage({type:"success",title:"Odebrano wszystko!",text:`+${totalItems} produktów. Sprzedaj je w Ladzie dla klientów.`});
            };
            const selA = selectedAnimal ? ANIMALS.find(a => a.id === selectedAnimal) : null;
            const totalStorage = ANIMALS.reduce((s,a) => s + (barnState[a.id]?.storage??0), 0);
            return (
              <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                <div className="relative flex h-[92vh] w-full max-w-[1450px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl">
                  <button onClick={() => setShowStodolaModal(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>

                  {/* ─ Sidebar ─ */}
                  <div className="flex w-[280px] shrink-0 flex-col gap-1.5 border-r border-[#8b6a3e]/30 bg-black/20 p-4 pt-14 overflow-y-auto">
                    <p className="mb-3 text-base font-black uppercase tracking-widest text-[#d8ba7a]">🏚️ Zagroda</p>
                    <button onClick={() => setSelectedAnimal(null)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-bold transition ${!selectedAnimal ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"}`}>
                      📋 Przegląd
                    </button>
                    <div className="my-1 border-t border-[#8b6a3e]/20" />
                    {ANIMALS.map(a => {
                      const locked = lvl < a.unlockLevel;
                      const st = barnState[a.id];
                      const hasAnimals = st.owned > 0;
                      const hasProd = st.storage > 0;
                      return (
                        <button key={a.id} onClick={() => !locked && setSelectedAnimal(a.id)}
                          disabled={locked}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-bold transition text-left ${locked ? "opacity-40 cursor-not-allowed text-[#6b7280]" : selectedAnimal===a.id ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"}`}>
                          <span className="text-xl">{a.icon}</span>
                          <span className="flex-1 truncate">{a.name}</span>
                          {locked && <span className="text-[11px] text-[#6b7280]">LVL{a.unlockLevel}</span>}
                          {!locked && hasProd && <span className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />}
                          {!locked && hasAnimals && !hasProd && <span className="text-[11px] text-[#8b6a3e]">{st.owned}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* ─ Główna treść ─ */}
                  <div className="flex-1 overflow-y-auto p-6 pt-5 text-[#dfcfab]">

                    {/* ══ EFEKT OPIEKI ══ */}
                  {opiekaPts > 0 && (
                    <div className="mb-3 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-950/20 px-4 py-2">
                      <span className="text-lg">🐄</span>
                      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
                        <p className="text-[11px] font-bold text-green-300">Opieka ({opiekaPts} pkt) aktywna</p>
                        <p className="text-[11px] text-[#dfcfab]">🌿 Głód wolniej spada o <span className="font-bold text-green-300">{hungerReducePct}%</span></p>
                        <p className="text-[11px] text-[#dfcfab]">📦 Szansa na bonus produkt: <span className="font-bold text-yellow-300">+{bonusChancePct}%</span></p>
                      </div>
                    </div>
                  )}

                    {/* ══ PRZEGLĄD ══ */}
                    {!selA && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-2xl font-black text-[#f9e7b2]">🏚️ Twoja zagroda</p>
                          {totalStorage > 0 && (
                            <button onClick={handleCollectAll} className="rounded-xl border border-green-500/60 bg-green-900/20 px-3 py-1.5 text-sm font-bold text-green-300 hover:bg-green-900/40">
                              ✅ Odbierz wszystko
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                          {ANIMALS.filter(a => lvl >= a.unlockLevel).map(a => {
                            const st = barnState[a.id];
                            const item = ANIMAL_ITEMS.find(i => i.id === a.itemId)!;
                            const h = barnCurrentHunger(st, opiekaPts);
                            const hs = barnHungerStatus(h);
                            const effMs = barnEffProdMs(a, h);
                            const remaining = st.prodStart > 0 ? Math.max(0, effMs - (barnNow - st.prodStart)) : 0;
                            const pct = st.prodStart > 0 ? Math.min(100, ((barnNow - st.prodStart) / effMs) * 100) : 0;
                            return (
                              <div key={a.id} onClick={() => setSelectedAnimal(a.id)}
                                className="cursor-pointer rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-3 hover:border-[#d4a64f]/60 transition">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-3xl">{a.icon}</span>
                                  <div className="flex-1">
                                    <p className="text-base font-black text-[#f9e7b2]">{a.name}</p>
                                    <p className="text-[12px] text-[#8b6a3e]">{st.owned} / {st.slots} · {item.icon} {item.name}</p>
                                  </div>
                                  {st.storage > 0 && <span title={`${st.storage} cykli × ${st.owned} ${a.name.toLowerCase()} = ${st.storage * st.owned} ${item.name}`} className="rounded-full bg-green-500/20 border border-green-500/40 px-2 py-0.5 text-[11px] font-black text-green-300">{st.storage}/{a.storageMax} (={st.storage * st.owned}{item.icon})</span>}
                                </div>
                                {st.owned > 0 && (
                                  <>
                                    <div className="h-1.5 w-full rounded-full bg-black/40 mb-1">
                                      <div className="h-full rounded-full bg-amber-400 transition-all" style={{width:`${pct}%`}} />
                                    </div>
                                    <div className="flex justify-between text-[9px] text-[#6b7280]">
                                      <span style={{color:hs.color}}>{hs.label.split(" ")[0]} {Math.round(h)}%</span>
                                      <span>{st.storage >= a.storageMax ? "📦 Pełny" : remaining > 0 ? barnFmtMs(remaining) : "✅ Gotowe"}</span>
                                    </div>
                                  </>
                                )}
                                {st.owned === 0 && <p className="text-[11px] text-amber-300/80 text-center py-1">🛒 Kup w mieście · {a.buyPrice.toLocaleString()} 💰</p>}
                              </div>
                            );
                          })}
                          {ANIMALS.filter(a => lvl < a.unlockLevel).length > 0 && (
                            <div className="rounded-xl border border-[#374151]/40 bg-black/10 p-3 opacity-50 col-span-2 xl:col-span-1">
                              <p className="text-xs text-[#6b7280] text-center">
                                🔒 {ANIMALS.filter(a => lvl < a.unlockLevel).map(a => `${a.icon} LVL${a.unlockLevel}`).join(" · ")}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ══ KARTA ZWIERZĘCIA ══ */}
                    {selA && (() => {
                      const a = selA;
                      const st = barnState[a.id];
                      const item = ANIMAL_ITEMS.find(i => i.id === a.itemId)!;
                      const h = barnCurrentHunger(st, opiekaPts);
                      const hs = barnHungerStatus(h);
                      const effMs = barnEffProdMs(a, h);
                      const remaining = st.prodStart > 0 ? Math.max(0, effMs - (barnNow - st.prodStart)) : 0;
                      const pct = st.prodStart > 0 ? Math.min(100, ((barnNow - st.prodStart) / effMs) * 100) : 0;
                      const storageFull = st.storage >= a.storageMax;
                      const nextUpg = st.slots - a.startSlots;
                      const upgCost = nextUpg < a.slotUpgCosts.length ? a.slotUpgCosts[nextUpg] : null;
                      return (
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <button onClick={() => setSelectedAnimal(null)} className="text-[#8b6a3e] hover:text-[#f9e7b2] text-sm transition">← Powrót</button>
                            <span className="text-3xl">{a.icon}</span>
                            <div>
                              <p className="text-xl font-black text-[#f9e7b2]">{a.name}</p>
                              <p className="text-xs text-[#8b6a3e]">Produkuje: {item.icon} {item.name} · co {a.prodMs/3600000}h · sprzedaż: {item.sellPrice.toLocaleString()} 💰/szt</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {/* Lewa kolumna */}
                            <div className="flex flex-col gap-3">
                              {/* Status produkcji */}
                              <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-4">
                                <p className="text-base font-black uppercase tracking-widest text-[#d8ba7a] mb-2">📊 Produkcja</p>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-2xl">{item.icon}</span>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-[#f9e7b2]">Posiadasz: {st.owned} / {st.slots}</p>
                                    <p className="text-[10px] text-[#8b6a3e]">Storage: {st.storage} / {a.storageMax} cykli {st.storage > 0 && st.owned > 0 && <span className="text-green-300">(= {st.storage * st.owned} {item.icon})</span>}</p>
                                    <p className="text-[9px] text-[#6b7280]">1 cykl = {st.owned} {item.name} ({st.owned} {st.owned === 1 ? "zwierzę" : "zwierząt"})</p>
                                  </div>
                                </div>
                                {st.owned > 0 && (
                                  <>
                                    <div className="h-2 w-full rounded-full bg-black/40 mb-1">
                                      <div className="h-full rounded-full transition-all" style={{width:`${pct}%`, background: storageFull?"#6b7280":"#f59e0b"}} />
                                    </div>
                                    <p className="text-xs text-center" style={{color: storageFull?"#6b7280":remaining===0?"#4ade80":"#f9e7b2"}}>
                                      {storageFull ? "📦 Storage pełny — odbierz produkty" : remaining > 0 ? barnFmtMs(remaining) : "✅ Gotowe do odbioru!"}
                                    </p>
                                  </>
                                )}
                                {st.owned === 0 && <p className="text-xs text-[#6b7280] text-center">Brak zwierząt — kup pierwsze!</p>}
                                {st.storage > 0 && st.owned > 0 && (
                                  <button onClick={() => handleCollect(a)} className="mt-2 w-full rounded-xl border border-green-500/60 bg-green-900/20 py-1.5 text-sm font-bold text-green-300 hover:bg-green-900/40">
                                    ✅ Odbierz {st.storage * st.owned} {item.icon} ({st.storage} cykli × {st.owned})
                                  </button>
                                )}
                              </div>
                              {/* Głód */}
                              <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-4">
                                <p className="text-base font-black uppercase tracking-widest text-[#d8ba7a] mb-2">🌿 Głód</p>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="h-3 flex-1 rounded-full bg-black/40">
                                    <div className="h-full rounded-full transition-all" style={{width:`${h}%`, background:hs.color}} />
                                  </div>
                                  <span className="text-xs font-bold" style={{color:hs.color}}>{Math.round(h)}%</span>
                                </div>
                                <p className="text-[11px] font-bold mb-2" style={{color:hs.color}}>{hs.label}{hs.speedMod!==0 ? ` (${hs.speedMod > 0 ? "+" : ""}${Math.round(hs.speedMod*100)}% czas prod.)` : ""}</p>
                                <p className="text-[10px] text-[#8b6a3e] mb-2">Karma (zepsute nie nadają się!):</p>
                                <div className="flex flex-col gap-1">
                                  {a.feed.map(f => {
                                    const variants: {key:string; label:string; qIcon:string; pts:number; color:string}[] = [
                                      {key:`${f.cropId}_good`,      label:`${f.name}`,          qIcon:"",   pts:f.points,                   color:"#dfcfab"},
                                      {key:`${f.cropId}_epic`,      label:`${f.name} Epicka`,   qIcon:"⭐", pts:Math.round(f.points*1.5),    color:"#4ade80"},
                                      {key:`${f.cropId}_legendary`, label:`${f.name} Legendarna`,qIcon:"🌟",pts:f.points*2,                  color:"#f59e0b"},
                                    ];
                                    return (
                                      <div key={f.cropId}>
                                        <p className="text-[9px] text-[#8b6a3e] uppercase tracking-widest mt-1 mb-0.5">{f.icon} {f.name}</p>
                                        {variants.map(v => {
                                          const have = seedInventory[v.key] ?? 0;
                                          const canUse = have > 0;
                                          return (
                                            <button key={v.key} onClick={() => void handleFeed(a, v.key, v.pts, v.label, f.icon)}
                                              disabled={!canUse}
                                              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-[11px] font-bold transition mb-0.5 ${!canUse ? "opacity-30 cursor-not-allowed border-[#2d2010] text-[#6b7280]" : "border-[#8b6a3e]/60 text-[#dfcfab] hover:border-green-400/60 hover:bg-green-900/20 cursor-pointer"}`}>
                                              <span>{f.icon}{v.qIcon}</span>
                                              <span className="flex-1 text-left" style={{color: canUse ? v.color : undefined}}>{v.label}</span>
                                              <span className="text-green-400 text-[10px]">+{v.pts}</span>
                                              <span className="text-[#6b7280] text-[9px]">{have} szt</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            {/* Prawa kolumna */}
                            <div className="flex flex-col gap-3">
                              {/* Info: kupno przeniesione do miasta */}
                              <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
                                <p className="text-base font-black uppercase tracking-widest text-amber-300 mb-2">🛒 Kup zwierzę</p>
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="text-base font-bold text-[#f9e7b2]">{a.icon} {a.name}</p>
                                    <p className="text-sm text-amber-200/80">Posiadasz: <span className="font-black">{st.owned} / {st.slots}</span></p>
                                  </div>
                                  <span className="text-base font-black text-amber-400">{a.buyPrice.toLocaleString()} 💰</span>
                                </div>
                                <p className="text-sm text-amber-200/90 leading-relaxed">
                                  ➡️ Zwierzęta kupisz w <span className="font-black text-amber-300">mieście → Sklep → zakładka 🐄 Zwierzęta</span>.
                                </p>
                              </div>
                              {/* Ulepszenia slotów */}
                              <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-4">
                                <p className="text-base font-black uppercase tracking-widest text-[#d8ba7a] mb-2">🏗️ Sloty stodoły</p>
                                <p className="text-base font-bold text-[#f9e7b2] mb-1">{st.slots} / {a.maxSlots} slotów</p>
                                <div className="flex gap-1 flex-wrap mb-3">
                                  {Array.from({length: a.maxSlots}).map((_, i) => (
                                    <div key={i} className={`h-3 w-3 rounded-sm border ${i < st.slots ? "border-amber-400 bg-amber-400/30" : "border-[#374151] bg-black/20"}`} />
                                  ))}
                                </div>
                                {upgCost !== null ? (
                                  <button onClick={() => handleBuySlot(a)}
                                    disabled={displayMoney < upgCost}
                                    className={`w-full rounded-xl border py-2 text-sm font-bold transition ${displayMoney < upgCost ? "opacity-50 cursor-not-allowed border-[#374151] text-[#6b7280]" : "border-[#8b6a3e]/60 bg-black/30 text-[#dfcfab] hover:border-amber-400/60 hover:text-amber-200"}`}>
                                    Kup slot · {upgCost.toLocaleString()} 💰
                                  </button>
                                ) : (
                                  <p className="text-xs text-center text-[#4ade80] font-bold">✦ Maks sloty odblokowane ✦</p>
                                )}
                              </div>
                              {/* Tabela produkcji */}
                              <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-3">
                                <p className="text-base font-black uppercase tracking-widest text-[#d8ba7a] mb-2">📈 Info</p>
                                <div className="flex flex-col gap-1 text-[11px] text-[#dfcfab]">
                                  <div className="flex justify-between"><span>Produkuje</span><span className="font-bold">{item.icon} {item.name}</span></div>
                                  <div className="flex justify-between"><span>Czas (normalne)</span><span className="font-bold">{a.prodMs/3600000}h</span></div>
                                  <div className="flex justify-between"><span>Storage max</span><span className="font-bold">{a.storageMax} szt</span></div>
                                  <div className="flex justify-between"><span>Cena sprzedaży</span><span className="font-bold text-amber-400">{item.sellPrice.toLocaleString()} 💰</span></div>
                                  <div className="flex justify-between"><span>Cena zwierzęcia</span><span className="font-bold">{a.buyPrice.toLocaleString()} 💰</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {showSadModal && (() => {
            const lvl = profile?.level ?? 1;
            const maxSlots = getMaxTreeSlots(lvl);
            const ownedTotal = getOrchardTotalOwned(orchardState);
            const ownedTrees = TREES.filter(t => (orchardState[t.id]?.owned ?? 0) > 0);
            const treeSpeedPct = getEquipBonusPct("% speed drzew", charEquipped);
            const sadownikBonus = calcStatEffect(playerStats?.sadownik ?? 0, 0.005);
            const luckPct = calcStatEffect(playerStats?.szczescie ?? 0, 0.0025) + getEquipBonusPct("% bonus drop", charEquipped);
            const fmtTime = (ms: number) => {
              if (ms <= 0) return "Gotowe!";
              const s = Math.floor(ms/1000);
              const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
              return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
            };
            const handleHarvestTree = (t: TreeDef) => {
              const st = orchardState[t.id];
              if (!st) return;
              const total = st.storage.zwykly + st.storage.soczysty + st.storage.zloty;
              if (total === 0) return;
              const inv = { ...fruitInventory };
              (["zwykly","soczysty","zloty"] as const).forEach(q => {
                if (st.storage[q] > 0) {
                  const k = `${t.fruitId}_${q}`;
                  inv[k] = (inv[k] ?? 0) + st.storage[q];
                }
              });
              saveFruitInventory(inv);
              saveOrchardState({ ...orchardState, [t.id]: { ...st, storage:{ zwykly:0, soczysty:0, zloty:0 }, prodStart: Date.now() } });
              const parts: string[] = [];
              if (st.storage.zwykly > 0)   parts.push(`${st.storage.zwykly} zwykłych`);
              if (st.storage.soczysty > 0) parts.push(`💧${st.storage.soczysty} soczystych`);
              if (st.storage.zloty > 0)    parts.push(`✨${st.storage.zloty} złotych`);
              setMessage({ type:"success", title:`${t.fruitIcon} Zebrano ${total} ${t.fruitName.toLowerCase()}!`, text: parts.join(" · ") });
            };
            const handleHarvestAll = () => {
              const inv = { ...fruitInventory };
              const newOrch = { ...orchardState };
              let totalAll = 0; const partsAll: string[] = [];
              TREES.forEach(t => {
                const st = newOrch[t.id]; if (!st) return;
                const total = st.storage.zwykly + st.storage.soczysty + st.storage.zloty;
                if (total === 0) return;
                (["zwykly","soczysty","zloty"] as const).forEach(q => {
                  if (st.storage[q] > 0) { const k = `${t.fruitId}_${q}`; inv[k] = (inv[k] ?? 0) + st.storage[q]; }
                });
                newOrch[t.id] = { ...st, storage:{ zwykly:0, soczysty:0, zloty:0 }, prodStart: Date.now() };
                totalAll += total;
                partsAll.push(`${t.fruitIcon}×${total}`);
              });
              if (totalAll === 0) return;
              saveFruitInventory(inv); saveOrchardState(newOrch);
              setMessage({ type:"success", title:`🌳 Zebrano ${totalAll} owoców!`, text: partsAll.join(" · ") });
            };
            const calcInvValue = () => {
              let v = 0;
              TREES.forEach(t => {
                (["zwykly","soczysty","zloty"] as FruitQuality[]).forEach(q => {
                  const k = `${t.fruitId}_${q}`;
                  const cnt = fruitInventory[k] ?? 0;
                  if (cnt > 0) v += cnt * t.pricePerFruit * FRUIT_QUALITY_DEFS[q].mult;
                });
              });
              return v;
            };
            const handleSellAll = () => {
              if (!profile?.id) return;
              const value = calcInvValue();
              if (value === 0) { setOrchardError("Brak owoców do sprzedaży."); return; }
              setOrchardError("");
              void (async () => {
                const newMoney = (profile.money ?? 0) + value;
                const { error } = await supabase.from("profiles").update({ money: Math.round(newMoney * 100) / 100 }).eq("id", profile.id);
                if (error) { setOrchardError("Błąd sprzedaży: " + error.message); return; }
                saveFruitInventory({});
                await loadProfile(profile.id);
                setMessage({ type:"success", title:`💰 Sprzedano owoce za ${value.toLocaleString()}💰`, text:"Owoce trafiły na rynek." });
              })();
            };
            const invValue = calcInvValue();
            const invTotal = Object.values(fruitInventory).reduce<number>((s,v) => s + (Number(v) || 0), 0);
            return (
              <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowSadModal(false)}>
                <div className="relative max-h-[92vh] w-full max-w-[1100px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(28,16,6,0.98)] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setShowSadModal(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>
                  {/* Header */}
                  <div className="shrink-0 border-b border-[#8b6a3e]/40 px-6 py-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-[#8b6a3e]">🌳 Sad Owocowy</p>
                    <p className="text-xl font-black text-[#f9e7b2]">Twoje drzewa <span className="text-sm font-normal text-[#8b6a3e]">({ownedTotal}/{maxSlots} miejsc)</span></p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                      {treeSpeedPct > 0 && <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 font-bold text-emerald-300">⚡ Eq -{treeSpeedPct.toFixed(1)}% czasu</span>}
                      {sadownikBonus > 0 && <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-bold text-amber-300">🌳 Sadownik +{sadownikBonus.toFixed(1)}% drop</span>}
                      {luckPct > 0 && <span className="rounded-full bg-yellow-500/20 border border-yellow-500/40 px-2 py-0.5 font-bold text-yellow-300">🍀 Szczęście +{luckPct.toFixed(1)}% rare</span>}
                    </div>
                  </div>
                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {ownedTrees.length === 0 ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="text-center max-w-md">
                          <p className="text-5xl mb-3">🌱</p>
                          <p className="text-base font-black text-[#f9e7b2]">Twój sad jest pusty</p>
                          <p className="mt-1 text-sm text-[#8b6a3e]">Kup drzewa w Sklepie → zakładka 🌳 Drzewa.</p>
                          {maxSlots === 0 && <p className="mt-2 text-xs text-amber-300">Pierwsze miejsca odblokujesz na poziomie 10.</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ownedTrees.map(t => {
                          const st = orchardState[t.id];
                          const effMs = Math.max(60_000, Math.round(t.growthTimeMs * Math.max(0.30, 1 - treeSpeedPct/100)));
                          const elapsed = st.prodStart > 0 ? barnNow - st.prodStart : 0;
                          const remaining = Math.max(0, effMs - elapsed);
                          const totalStored = st.storage.zwykly + st.storage.soczysty + st.storage.zloty;
                          const cycleEarnings = (st.storage.zwykly * t.pricePerFruit) + (st.storage.soczysty * t.pricePerFruit * 2) + (st.storage.zloty * t.pricePerFruit * 5);
                          return (
                            <div key={t.id} className="rounded-2xl border border-[#8b6a3e]/50 bg-black/30 p-4">
                              <div className="flex items-center gap-3">
                                <div className="text-4xl">{t.icon}</div>
                                <div className="flex-1">
                                  <p className="text-base font-black text-[#f9e7b2]">{t.name} <span className="text-xs font-normal text-emerald-400">×{st.owned}</span></p>
                                  <p className="text-[11px] text-[#8b6a3e]">Owoc: {t.fruitIcon} {t.fruitName} · Cykl {Math.round(t.growthTimeMs/3600000)}h · Drop {t.dropMin}–{t.dropMax}</p>
                                </div>
                              </div>
                              {/* Status */}
                              <div className="mt-3 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-3">
                                {totalStored === 0 && remaining > 0 && (
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-[#8b6a3e]">⏳ Następny zbiór za</p>
                                    <p className="text-lg font-black text-amber-300 font-mono">{fmtTime(remaining)}</p>
                                    <div className="mt-1 h-1.5 rounded-full bg-black/50 overflow-hidden">
                                      <div className="h-full bg-amber-400 transition-all" style={{ width: `${Math.min(100, (elapsed/effMs)*100)}%` }} />
                                    </div>
                                  </div>
                                )}
                                {totalStored > 0 && (
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-emerald-400">✅ Gotowe do zbioru!</p>
                                    <p className="mt-1 text-base font-black text-[#f9e7b2]">{totalStored} {t.fruitIcon}</p>
                                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                                      {st.storage.zwykly > 0   && <span className="rounded bg-emerald-900/40 border border-emerald-500/40 px-2 py-0.5 font-bold text-emerald-300">{st.storage.zwykly} zwykły</span>}
                                      {st.storage.soczysty > 0 && <span className="rounded bg-cyan-900/40 border border-cyan-500/40 px-2 py-0.5 font-bold text-cyan-300">💧 {st.storage.soczysty} soczysty</span>}
                                      {st.storage.zloty > 0    && <span className="rounded bg-yellow-900/40 border border-yellow-500/40 px-2 py-0.5 font-bold text-yellow-300">✨ {st.storage.zloty} złoty</span>}
                                    </div>
                                    <p className="mt-1 text-[10px] text-amber-400">≈ {cycleEarnings.toLocaleString()}💰 wartości</p>
                                  </div>
                                )}
                              </div>
                              {/* Actions */}
                              <button
                                disabled={totalStored === 0}
                                onClick={() => handleHarvestTree(t)}
                                className={`mt-2 w-full rounded-xl py-2 text-sm font-black transition ${totalStored > 0 ? "border border-emerald-500/60 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/60" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}>
                                ✅ Zbierz {totalStored > 0 ? totalStored : ""}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Info wszystkich drzew (zakupisz w mieście) */}
                    <div className="mt-5 rounded-2xl border border-[#8b6a3e]/40 bg-black/30 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a] mb-3">📜 Wszystkie drzewa <span className="font-normal text-[#8b6a3e] normal-case tracking-normal">— zakupisz w mieście (Sklep → 🌳 Drzewa)</span></p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-[#8b6a3e] border-b border-[#8b6a3e]/30">
                              <th className="text-left py-1.5 pr-2">LVL</th>
                              <th className="text-left py-1.5 pr-2">Drzewo</th>
                              <th className="text-left py-1.5 pr-2">Produkt</th>
                              <th className="text-left py-1.5 pr-2">Czas</th>
                              <th className="text-left py-1.5 pr-2">Drop</th>
                              <th className="text-right py-1.5 pr-2">Cena</th>
                              <th className="text-right py-1.5">Posiadasz</th>
                            </tr>
                          </thead>
                          <tbody>
                            {TREES.map(t => {
                              const ownedHere = orchardState[t.id]?.owned ?? 0;
                              const locked = lvl < t.unlockLevel;
                              return (
                                <tr key={t.id} className={`border-b border-[#8b6a3e]/10 ${locked ? "opacity-50" : ""}`}>
                                  <td className="py-1.5 pr-2 text-[#dfcfab]">{locked && "🔒"}{t.unlockLevel}</td>
                                  <td className="py-1.5 pr-2 font-bold text-[#f9e7b2]">{t.icon} {t.name}</td>
                                  <td className="py-1.5 pr-2 text-[#dfcfab]">{t.fruitIcon} {t.fruitName}</td>
                                  <td className="py-1.5 pr-2 text-[#dfcfab]">{Math.round(t.growthTimeMs/3600000)}h</td>
                                  <td className="py-1.5 pr-2 text-[#dfcfab]">{t.dropMin}–{t.dropMax}</td>
                                  <td className="py-1.5 pr-2 text-right font-bold text-amber-400">{t.buyPrice.toLocaleString()}💰</td>
                                  <td className="py-1.5 text-right">
                                    <span className={`font-black ${ownedHere > 0 ? "text-emerald-300" : "text-[#8b6a3e]"}`}>{ownedHere}/{maxSlots}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-[10px] text-[#8b6a3e]">Limit drzew rośnie z poziomem: 10→2, 15→4, 20→6, 25→8 (łącznie wszystkie drzewa).</p>
                    </div>
                  </div>
                  {/* Footer: inventory + harvest (sprzedaż w Ladzie) */}
                  {(ownedTrees.length > 0 || invTotal > 0) && (
                    <div className="shrink-0 border-t border-[#8b6a3e]/40 bg-black/30 p-4">
                      {orchardError && <p className="mb-2 rounded-lg bg-red-900/40 px-3 py-1.5 text-xs text-red-300">{orchardError}</p>}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-[#8b6a3e]">📦 Magazyn owoców</p>
                          <p className="text-sm font-black text-[#f9e7b2]">{invTotal} owoców · wartość ~{invValue.toLocaleString()}💰</p>
                          {invTotal > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] max-w-[600px]">
                              {Object.entries(fruitInventory).filter(([,c]) => (c as number) > 0).slice(0, 12).map(([k,c]) => {
                                const lastUnd = k.lastIndexOf("_");
                                const fruitId = k.slice(0, lastUnd);
                                const q = k.slice(lastUnd+1) as FruitQuality;
                                const tree = TREES.find(tt => tt.fruitId === fruitId);
                                if (!tree) return null;
                                const qd = FRUIT_QUALITY_DEFS[q];
                                return <span key={k} className="rounded border border-[#8b6a3e]/40 bg-black/40 px-1.5 py-0.5 font-bold" style={{color: qd.color}}>{qd.icon}{tree.fruitIcon}×{c as number}</span>;
                              })}
                              {Object.keys(fruitInventory).filter(k => (fruitInventory[k] ?? 0) > 0).length > 12 && <span className="text-[#8b6a3e]">…</span>}
                            </div>
                          )}
                          {invTotal > 0 && <p className="mt-1 text-[11px] text-amber-300/90">💡 Sprzedaż owoców → <span className="font-black text-amber-300">Lada dla klientów</span> w mieście.</p>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleHarvestAll}
                            className="rounded-xl border border-emerald-500/60 bg-emerald-900/30 px-4 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-900/50">
                            ✅ Zbierz wszystko z drzew
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {showSkinModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowSkinModal(false)}>
              <div className="relative max-h-[90vh] w-full max-w-[1100px] overflow-y-auto rounded-[28px] border border-[#8b6a3e] bg-[rgba(28,16,6,0.98)] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowSkinModal(false)} className="absolute right-4 top-4 text-[#8b6a3e] text-xl hover:text-red-400">✕</button>
                <h2 className="mb-5 text-center text-lg font-black text-[#f9e7b2]">Wybierz swoją postać</h2>
                {/* Zakładki */}
                <div className="mb-6 flex gap-2 justify-center flex-wrap">
                  {(["mezczyzni","kobiety","epickie","wszystkie"] as const).map(tab => (
                    <button key={tab} onClick={() => setSkinTab(tab)}
                      className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition border ${
                        skinTab === tab
                          ? tab === "epickie" ? "border-green-400 bg-green-900/30 text-green-300" : "border-yellow-400 bg-yellow-900/20 text-yellow-200"
                          : "border-[#8b6a3e]/40 text-[#dfcfab] hover:bg-white/5"
                      }`}>
                      {tab === "mezczyzni" ? "👨 Mężczyźni" : tab === "kobiety" ? "👩 Kobiety" : tab === "wszystkie" ? "🌾 Wszystkie" : "⭐ Epickie"}
                    </button>
                  ))}
                </div>

                {/* Mężczyźni */}
                {(skinTab === "mezczyzni" || skinTab === "wszystkie") && (
                  <>
                    {skinTab === "wszystkie" && <p className="mb-3 text-center text-[10px] text-[#8b6a3e] font-bold uppercase tracking-widest">👨 Mężczyźni</p>}
                    <div className={`${skinTab === "wszystkie" ? "mb-4" : ""} grid grid-cols-5 gap-2`}>
                      {SKINS_MALE.map((src, i) => (
                        <button key={i} onClick={() => { setAvatarSkin(i); if (profile?.id) saveAvatarData(profile.id, i, playerStats, freeSkillPoints, prevLevelRef.current); setShowSkinModal(false); }}
                          className={`flex h-56 w-full items-center justify-center rounded-2xl border-2 overflow-hidden transition ${avatarSkin === i ? "border-yellow-400 bg-yellow-900/30 shadow-[0_0_16px_rgba(255,200,0,0.4)]" : "border-[#8b6a3e]/50 bg-black/20 hover:border-[#8b6a3e] hover:bg-black/40"}`}>
                          <img src={src} alt={`Postać ${i+1}`} className="w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Kobiety */}
                {(skinTab === "kobiety" || skinTab === "wszystkie") && (
                  <>
                    {skinTab === "wszystkie" && <p className="mb-3 text-center text-[10px] text-[#8b6a3e] font-bold uppercase tracking-widest">👩 Kobiety</p>}
                    <div className="grid grid-cols-5 gap-2">
                      {SKINS_FEMALE.map((src, i) => (
                        <button key={i+10} onClick={() => { const idx=i+10; setAvatarSkin(idx); if (profile?.id) saveAvatarData(profile.id, idx, playerStats, freeSkillPoints, prevLevelRef.current); setShowSkinModal(false); }}
                          className={`flex h-56 w-full items-center justify-center rounded-2xl border-2 overflow-hidden transition ${avatarSkin === i+10 ? "border-pink-400 bg-pink-900/30 shadow-[0_0_16px_rgba(255,100,200,0.4)]" : "border-[#8b6a3e]/50 bg-black/20 hover:border-[#8b6a3e] hover:bg-black/40"}`}>
                          <img src={src} alt={`Postać ${i+11}`} className="w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Epickie */}
                {skinTab === "epickie" && (
                  <>
                    <p className="mb-4 text-center text-xs text-green-400/80">Kliknij zablokowany avatar, aby go odblokować za odpowiedni koszt z plecaka.</p>
                    <div className="grid grid-cols-5 gap-3">
                      {EPIC_SKINS.map((es, i) => {
                        const idx = EPIC_SKIN_START + i;
                        const isUnlocked = unlockedEpicAvatars.includes(idx);
                        const isActive = avatarSkin === idx;
                        const canAfford = Object.entries(es.cost).every(([k,v]) => (seedInventory[k] ?? 0) >= v);
                        return (
                          <button key={idx}
                            onClick={() => {
                              if (isUnlocked) {
                                setAvatarSkin(idx);
                                if (profile?.id) saveAvatarData(profile.id, idx, playerStats, freeSkillPoints, prevLevelRef.current);
                                setShowSkinModal(false);
                              } else {
                                setEpicPurchaseTarget(idx);
                              }
                            }}
                            className={`relative flex flex-col items-center justify-end rounded-2xl border-2 overflow-hidden transition pb-2 ${
                              isActive ? "border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)] bg-green-900/20"
                              : isUnlocked ? "border-green-500/70 bg-green-950/20 hover:border-green-400"
                              : "border-[#8b6a3e]/40 bg-black/30 hover:border-green-600/50"
                            }`}
                            style={{ minHeight: "220px" }}>
                            {/* Obrazek — szary jeśli zablokowany */}
                            <img
                              src={es.path} alt={es.name}
                              className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                              style={{ imageRendering: "pixelated", filter: isUnlocked ? "none" : "grayscale(100%) brightness(0.45)" }}
                            />
                            {/* Zielona ramka glow dla odblokowanych */}
                            {isUnlocked && !isActive && (
                              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{boxShadow:"inset 0 0 0 2px rgba(34,197,94,0.4)"}} />
                            )}
                            {/* Kłódka / aktywny badge */}
                            <div className="relative z-10 mt-auto w-full px-1">
                              {isActive && (
                                <div className="mb-1 rounded-lg bg-green-500/90 px-2 py-0.5 text-center text-[10px] font-black text-white">✓ Aktywny</div>
                              )}
                              {!isUnlocked && (
                                <div className={`mb-1 rounded-lg px-2 py-0.5 text-center text-[10px] font-black ${canAfford ? "bg-green-700/90 text-green-100" : "bg-black/80 text-[#8b6a3e]"}`}>
                                  🔒 {canAfford ? "Możesz kupić!" : "Zablokowany"}
                                </div>
                              )}
                              <div className="rounded-lg bg-black/70 px-1 py-0.5 text-center text-[10px] font-bold text-[#f9e7b2]">{es.name}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ═══ MODAL ZAKUPU EPICKIEGO AVATARA ═══ */}
          {epicPurchaseTarget !== null && (() => {
            const es = EPIC_SKINS[epicPurchaseTarget - EPIC_SKIN_START];
            if (!es) return null;
            const canAfford = Object.entries(es.cost).every(([k,v]) => (seedInventory[k] ?? 0) >= v);
            const costLabel = (key: string, amt: number) => {
              const { baseCropId, quality } = parseQualityKey(key);
              const crop = CROPS.find(c => c.id === baseCropId);
              const qLabel = quality === "epic" ? " epickich" : quality === "legendary" ? " legendarnych" : " zwykłych";
              return `${amt}× ${crop?.name ?? key}${qLabel}`;
            };
            return (
              <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setEpicPurchaseTarget(null)}>
                <div className="relative w-full max-w-[420px] rounded-[24px] border border-green-500/60 bg-[rgba(10,30,10,0.98)] p-7 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setEpicPurchaseTarget(null)} className="absolute right-4 top-4 text-[#8b6a3e] hover:text-red-400">✕</button>
                  <div className="mb-4 flex justify-center">
                    <div className="relative h-36 w-36 overflow-hidden rounded-2xl border-2 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                      <img src={es.path} alt={es.name} className="h-full w-full object-cover" style={{imageRendering:"pixelated"}} />
                    </div>
                  </div>
                  <h3 className="mb-1 text-center text-lg font-black text-green-300">⭐ {es.name}</h3>
                  <p className="mb-4 text-center text-xs text-[#8b6a3e]">Avatar epicki — odblokuj raz, używaj na zawsze</p>
                  <div className="mb-5 rounded-2xl border border-green-800/50 bg-black/30 p-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-green-400">Koszt odblokowania:</p>
                    {Object.entries(es.cost).map(([k,v]) => {
                      const have = seedInventory[k] ?? 0;
                      const ok = have >= v;
                      return (
                        <div key={k} className={`flex items-center justify-between text-sm font-bold ${ok ? "text-green-300" : "text-red-400"}`}>
                          <span>{costLabel(k, v)}</span>
                          <span className="text-xs opacity-70">({ok ? "✓" : `brak — masz ${have}`})</span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    disabled={!canAfford}
                    onClick={async () => {
                      if (!profile?.id || !canAfford) return;
                      const newInv = { ...seedInventory };
                      Object.entries(es.cost).forEach(([k,v]) => { newInv[k] = (newInv[k] ?? 0) - v; });
                      const newUnlocked = [...unlockedEpicAvatars, epicPurchaseTarget];
                      const { error } = await supabase.from("profiles").update({
                        seed_inventory: newInv,
                        unlocked_epic_avatars: newUnlocked,
                      }).eq("id", profile.id);
                      if (!error) {
                        setSeedInventory(newInv);
                        setUnlockedEpicAvatars(newUnlocked);
                        setEpicPurchaseTarget(null);
                      }
                    }}
                    className={`w-full rounded-2xl py-3 font-black transition text-sm ${canAfford ? "border border-green-400 bg-green-700/40 text-green-200 hover:bg-green-700/60" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}>
                    {canAfford ? "✅ Odblokuj avatar" : "❌ Brak surowców"}
                  </button>
                </div>
              </div>
            );
          })()}

          {isFieldViewOpen && isOnFarmMap && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center px-2 py-2">
                <div className="relative w-full max-w-[1600px] rounded-[28px] border border-[#8b6a3e] bg-[rgba(20,12,6,0.82)] p-5 shadow-2xl backdrop-blur-[2px]">
                  <button
                    onClick={() => {
                      setIsFieldViewOpen(false);
                      setSelectedPlotId(null);
                      setIsFieldViewCollapsed(false);
                    }}
                    className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-red-400/40 bg-red-950/40 text-xl font-bold text-red-100 transition hover:bg-red-950/60"
                    aria-label="Zamknij widok pola"
                  >
                    ×
                  </button>

                  <div className="mb-4 pr-14">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Widok pola</p>
                    <h2 className="mt-2 text-2xl font-black text-[#f9e7b2]">Twoje pole uprawne</h2>
                    <p className="mt-2 text-sm text-[#dfcfab]">
                      Wybierz nasiono z plecaka albo konewkę, a potem kliknij pole. Możesz też używać WASD i strzałek.
                    </p>
                  </div>

                  <div className="relative overflow-hidden rounded-[20px] border border-[#8b6a3e] bg-black/20">
                  <div className="relative mx-auto aspect-[1536/1092] w-full">
                    <img
                      src="/farm-field-view.png"
                      alt="Widok pola 25 slotów"
                      className="h-full w-full object-contain"
                    />

                    <div className="absolute inset-0">
                      {FIELD_VIEW_PLOTS.map((plot) => {
                        const plotId = plot.id;
                        const isUnlocked = isPlotUnlocked(plotId);
                        const isSelected = selectedPlotId === plotId;
                        const plotCost = getPlotUnlockCost(plotId);

                        return (
                          <button
                            key={plotId}
                            type="button"
                            onDragOver={(e)=>e.preventDefault()}
                            onDrop={(e)=>{ e.preventDefault(); if(draggedSeedId && isUnlocked){ if (isCompostKey(draggedSeedId)) { void applyCompostToPlot(plotId, draggedSeedId); } else { void handlePlantFromSelectedSeed(plotId, draggedSeedId); } setDraggedSeedId(null); }}}
                            onClick={() => {
                              setSelectedPlotId(plotId);

                              if (!isUnlocked) {
                                return;
                              }

                              if (selectedTool === "watering_can") {
                                handleWaterPlot(plotId);
                                return;
                              }

                              if (selectedTool === "sickle") {
                                void handleHarvestPlot(plotId);
                                return;
                              }

                              if (selectedSeedId && isCompostKey(selectedSeedId)) {
                                void applyCompostToPlot(plotId, selectedSeedId);
                                return;
                              }

                              if (selectedSeedId) {
                                handlePlantFromSelectedSeed(plotId);
                                return;
                              }

                              if (getPlotCrop(plotId).cropId && isCropReady(plotId)) {
                                void handleHarvestPlot(plotId);
                              }
                            }}
                            title={(() => {
                              if (!isUnlocked) return `Pole ${plotId} jest zablokowane`;
                              const _pc = getPlotCrop(plotId);
                              const _cb = _pc.compostBonus;
                              const _bonusLine = _cb
                                ? `\n🌿 Aktywny kompost: ${COMPOST_DEFS[_cb.type].icon} ${COMPOST_DEFS[_cb.type].name} (${COMPOST_DEFS[_cb.type].tierName(_cb.value)}) — ${COMPOST_DEFS[_cb.type].bonusLabel(_cb.value)}`
                                : "";
                              if (!_pc.cropId) {
                                return `Pole ${plotId} (puste)${_bonusLine}${_cb ? "\n→ Posadź uprawę, aby aktywować bonus." : ""}`;
                              }
                              const _cropName = CROPS.find(c => c.id === _pc.cropId)?.name ?? _pc.cropId;
                              const _qLabel = _pc.plantedQuality === "legendary" ? "Legendarna" : _pc.plantedQuality === "epic" ? "Epicka" : _pc.plantedQuality === "rotten" ? "Zepsuta" : "Zwykła";
                              const _status = isCropReady(plotId) ? " — gotowa do zbioru! 🌾" : " — rośnie...";
                              return `${_cropName} (${_qLabel})${_status}${_bonusLine}`;
                            })()}
                            className={`absolute rounded-xl transition-all duration-300 ${
                              isUnlocked ? "cursor-pointer hover:scale-[1.02]" : "cursor-pointer opacity-90"
                            }`}
                            style={{
                              left: plot.left,
                              top: plot.top,
                              width: plot.width,
                              height: plot.height,
                            }}
                          >
                            {isUnlocked ? (
                              <>
                                <div
                                  className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                                    isSelected
                                      ? "bg-yellow-300/20 shadow-[0_0_32px_rgba(255,220,120,0.8)]"
                                      : "bg-yellow-300/8"
                                  }`}
                                />
                                <div
                                  className={`absolute inset-0 rounded-xl border-2 transition-all duration-300 ${
                                    isSelected
                                      ? "border-yellow-200 shadow-[0_0_24px_rgba(255,220,120,0.7)]"
                                      : "border-yellow-300/55 hover:border-yellow-200 hover:shadow-[0_0_24px_rgba(255,220,120,0.55)]"
                                  }`}
                                />
                                <div className="absolute inset-0 rounded-xl bg-yellow-400/10 opacity-70 blur-md" />

                                {getPlotCrop(plotId).cropId && (() => {
                                  const _plantedCrop = getPlantedCrop(plotId);
                                  const _stage = getGrowthStage(plotId);
                                  const _stagedSrc = _plantedCrop ? getCropStageSprite(_plantedCrop.id, _stage) : null;
                                  if (_stagedSrc) {
                                    return (
                                      <img
                                        src={_stagedSrc}
                                        alt={_plantedCrop?.name}
                                        className="pointer-events-none absolute inset-[8%] h-[84%] w-[84%] object-contain"
                                        style={{ imageRendering: "pixelated" }}
                                      />
                                    );
                                  }
                                  return (
                                    <div
                                      className="pointer-events-none absolute inset-[8%]"
                                      style={{
                                        backgroundImage: `url('${_plantedCrop?.spritePath ?? "/carrot.png"}')`,
                                        backgroundSize: "100% 100%",
                                        backgroundRepeat: "no-repeat",
                                        imageRendering: "pixelated",
                                      }}
                                    />
                                  );
                                })()}

                                {/* Ikona aktywnego kompostu — duża na środku gdy puste, mała w rogu gdy posadzone */}
                                {(() => {
                                  const _cb = getPlotCrop(plotId).compostBonus;
                                  if (!_cb) return null;
                                  const _def = COMPOST_DEFS[_cb.type];
                                  const _tIdx = _def.bonusValues.indexOf(_cb.value);
                                  const _tColor = _tIdx === 0 ? "#9ca3af" : _tIdx === 1 ? "#fbbf24" : "#a78bfa";
                                  const _hasCrop = !!getPlotCrop(plotId).cropId;
                                  if (_hasCrop) {
                                    // Mała badge w lewym górnym rogu (żeby nie kolidowała z 💧 po prawej)
                                    return (
                                      <div
                                        className="pointer-events-none absolute left-1 top-1 z-10 flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[12px] font-black shadow-lg"
                                        style={{ background: `${_tColor}33`, border: `1px solid ${_tColor}`, color: _tColor }}>
                                        <span>{_def.icon}</span>
                                      </div>
                                    );
                                  }
                                  // Duża centralna ikona na pustym polu
                                  return (
                                    <div
                                      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                                      style={{ filter: `drop-shadow(0 0 8px ${_tColor}cc)` }}>
                                      <span className="text-4xl md:text-5xl">{_def.icon}</span>
                                      <span className="mt-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider md:text-[10px]"
                                        style={{ background: "rgba(0,0,0,0.6)", color: _tColor, border: `1px solid ${_tColor}88` }}>
                                        {_def.tierName(_cb.value)}
                                      </span>
                                    </div>
                                  );
                                })()}

                                {getPlotCrop(plotId).watered && (
                                  <div className="absolute right-1 top-1 z-10 rounded-full bg-cyan-500/20 px-1 py-0.5 text-[18px]">
                                    💧
                                  </div>
                                )}

                                {/* Pasek postępu sadzenia/zbioru */}
                                {pendingFieldActions[plotId] && (() => {
                                  const _act = pendingFieldActions[plotId];
                                  const _elapsed = Math.max(0, Date.now() - _act.startMs);
                                  const _pct = Math.min(100, Math.max(0, (_elapsed / _act.durationMs) * 100));
                                  const _isPlant = _act.kind === "plant";
                                  const _color = _isPlant ? "#22d3ee" : "#fbbf24";
                                  const _glow = _isPlant ? "rgba(34,211,238,0.7)" : "rgba(251,191,36,0.7)";
                                  const _label = _isPlant ? "Sadzenie..." : "Zbiór...";
                                  return (
                                    <>
                                      <div className="pointer-events-none absolute inset-0 z-[15] rounded-xl bg-black/35" />
                                      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[16] -translate-x-1/2 -translate-y-1/2 text-center">
                                        <div className="mb-1 text-[10px] font-black uppercase tracking-wider drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]"
                                          style={{ color: _color }}>
                                          {_label}
                                        </div>
                                        <div className="h-1.5 w-[70%] mx-auto overflow-hidden rounded-full border border-black/40 bg-black/60">
                                          <div
                                            className="h-full transition-[width] duration-75 ease-linear"
                                            style={{
                                              width: `${_pct}%`,
                                              background: _color,
                                              boxShadow: `0 0 6px ${_glow}`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}

                                <div className="absolute inset-x-1 bottom-1 z-10 text-center">
                                  {getPlotCrop(plotId).cropId ? (
                                    <span className="rounded-md bg-black/45 px-1 py-0.5 text-[9px] font-bold text-white/90 sm:px-1.5 sm:text-[10px]">
                                      {isCropReady(plotId)
                                        ? `${getPlantedCrop(plotId)?.name ?? "Gotowe"}`
                                        : `${getPlantedCrop(plotId)?.name ?? "Uprawa"} • ${formatHMS(getRemainingGrowthSeconds(plotId))}`}
                                    </span>
                                  ) : (
                                    <span className="text-sm font-black text-white drop-shadow-[0_0_8px_rgba(255,220,120,0.9)] md:text-base">
                                      {plotId}
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div
                                  className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                                    isSelected ? "bg-black/45" : "bg-black/30"
                                  }`}
                                />
                                <div
                                  className={`absolute inset-0 rounded-xl border-2 transition-all duration-300 ${
                                    isSelected ? "border-yellow-200/60" : "border-white/12"
                                  }`}
                                />
                                <div className="absolute inset-0 flex items-center justify-center px-1 text-center">
                                  <span className="text-[11px] font-bold uppercase leading-tight text-[#f5dfb0] md:text-sm">
                                    KOSZT: {plotCost} PLN
                                  </span>
                                </div>
                              </>
                            )}
                          </button>
                        );
                      })}

                      {selectedPlotId && (
                        <>
                          {(() => {
                            const selectedPlotUnlocked = isPlotUnlocked(selectedPlotId);
                            const selectedPlotCost = getPlotUnlockCost(selectedPlotId);

                            if (selectedPlotUnlocked) {
                              const activePlot = FIELD_VIEW_PLOTS.find((plot) => plot.id === selectedPlotId);
                              if (!activePlot) return null;

                              return (
                                <div className="pointer-events-none absolute inset-0">
                                  <div
                                    className="pointer-events-none absolute z-20 rounded-2xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-3 py-2 text-xs font-bold text-[#f3e6c8] shadow-2xl"
                                    style={{
                                      left: `calc(${activePlot.left} + ${activePlot.width} + 0.8%)`,
                                      top: activePlot.top,
                                    }}
                                  >
                                    {selectedTool === "watering_can"
                                      ? "Kliknij pole, aby podlać"
                                      : selectedTool === "sickle"
                                      ? "Kliknij gotową uprawę, aby zebrać"
                                      : selectedSeedId
                                      ? `Kliknij pole, aby posadzić ${
                                          CROPS.find((crop) => crop.id === selectedSeedId)?.name ?? "roślinę"
                                        }`
                                      : getPlotCrop(selectedPlotId).cropId && isCropReady(selectedPlotId)
                                      ? "Enter lub kliknij pole, aby zebrać"
                                      : "Wybierz nasiono z plecaka albo narzędzie"}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
                                <div className="pointer-events-auto w-full max-w-sm rounded-[24px] border border-[#c79b48] bg-[linear-gradient(180deg,rgba(66,39,17,0.98),rgba(34,20,10,0.98))] p-4 text-[#f7e7bf] shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-[11px] uppercase tracking-[0.24em] text-[#d8ba7a]">
                                        Zablokowane pole
                                      </p>
                                      <p className="mt-1 text-lg font-black text-[#fff1c7]">Pole #{selectedPlotId}</p>
                                      <p className="mt-1 text-sm text-[#f2ddb0]">
                                        Cena odblokowania: {selectedPlotCost} PLN
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPlotId(null)}
                                      className="rounded-full border border-[#8b6a3e] px-2 py-1 text-xs font-bold text-[#f3e6c8] transition hover:bg-black/20"
                                      aria-label="Zamknij podpowiedź zakupu pola"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <div className="mt-4">
                                    <button
                                      type="button"
                                      onClick={() => setPlotToBuy(selectedPlotId)}
                                      className="w-full rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-3 py-2 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                                      disabled={displayMoney < selectedPlotCost}
                                    >
                                      Kup: {selectedPlotCost} PLN
                                    </button>
                                    {displayMoney < selectedPlotCost && (
                                      <p className="mt-2 text-[11px] text-red-200">Masz za mało pieniędzy na to pole.</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>

                    {plotToBuy !== null && (
                      <div className="absolute inset-0 z-[95] flex items-center justify-center bg-black/60 px-4">
                        <div className="w-full max-w-md rounded-[28px] border border-[#c79b48] bg-[linear-gradient(180deg,rgba(66,39,17,0.98),rgba(34,20,10,0.98))] p-6 text-[#f7e7bf] shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
                          <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Potwierdzenie zakupu</p>
                          <h2 className="mt-3 text-2xl font-black text-[#fff1c7]">Kupić pole #{plotToBuy}?</h2>
                          <p className="mt-4 text-base leading-7 text-[#f2ddb0]">
                            Czy na pewno chcesz zakupić to pole za {getPlotUnlockCost(plotToBuy)} PLN?
                          </p>

                          <div className="mt-6 flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setPlotToBuy(null)}
                              className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-5 py-2 text-sm font-bold text-[#f3e6c8] transition hover:bg-[rgba(20,12,8,0.8)]"
                            >
                              Anuluj
                            </button>
                            <button
                              type="button"
                              onClick={confirmBuyPlot}
                              className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                            >
                              Kup: {getPlotUnlockCost(plotToBuy)} PLN
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {farmUpgradeModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4">
              <div className="relative w-full max-w-xl rounded-[28px] border border-[#c79b48] bg-[linear-gradient(180deg,rgba(66,39,17,0.98),rgba(34,20,10,0.98))] p-6 text-[#f7e7bf] shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
                <button
                  onClick={closeFarmUpgradeModal}
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#e0b96a]/50 bg-black/20 text-xl font-bold text-[#f8e5b5] transition hover:bg-black/35"
                  aria-label="Zamknij komunikat ulepszenia farmy"
                >
                  ×
                </button>

                <div className="pr-12">
                  <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Ulepszenie farmy</p>
                  <h2 className="mt-3 text-3xl font-black text-[#fff1c7]">{farmUpgradeModal.title}</h2>
                  <p className="mt-4 text-base leading-7 text-[#f2ddb0]">{farmUpgradeModal.text}</p>
                  <p className="mt-4 text-sm font-semibold text-[#d8ba7a]">
                    Osiągnięto poziom {farmUpgradeModal.level}.
                  </p>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={closeFarmUpgradeModal}
                    className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                  >
                    Super
                  </button>
                </div>
              </div>
            </div>
          )}

          {harvestLog.length > 0 && (() => {
            const grouped = harvestLog.reduce<Record<string, { cropId: string; cropName: string; baseAmount: number; bonusAmount: number; bonusSource: string | null; baseExp: number; quality: "rotten"|"good"|"epic"|"legendary" }>>(
              (acc, e) => {
                const _gKey = `${e.cropId}_${e.quality}`; if (!acc[_gKey]) {
                  acc[_gKey] = { cropId: e.cropId, cropName: e.cropName, baseAmount: 0, bonusAmount: 0, bonusSource: e.bonusSource, baseExp: 0, quality: e.quality };
                }
                acc[_gKey].baseAmount += e.baseAmount;
                acc[_gKey].bonusAmount += e.bonusAmount;
                acc[_gKey].baseExp += e.baseExp;
                if (e.bonusSource) acc[_gKey].bonusSource = e.bonusSource;
                return acc;
              }, {}
            );
            const totalExp = harvestLog.reduce((s, e) => s + e.baseExp, 0);
            const items = Object.values(grouped) as Array<{cropId:string;cropName:string;baseAmount:number;bonusAmount:number;bonusSource:string|null;baseExp:number;quality:"rotten"|"good"|"epic"|"legendary"}>;
            return (
              <div className="fixed bottom-20 right-4 z-[88] w-[300px] rounded-[18px] border border-[#8b6a3e] bg-[rgba(24,14,6,0.95)] p-4 text-[#dfcfab] shadow-2xl backdrop-blur-sm">
                <p className="mb-3 text-[12px] font-black uppercase tracking-[0.2em] text-[#d8ba7a]">🎒 Ostatnie zbiory ({harvestCountdown}s)</p>
                {/* Siatka ikon — plecaczek */}
                <div className="flex flex-wrap justify-center gap-3">
                  {items.map((g, i) => {
                    const _qd = CROP_QUALITY_DEFS[g.quality];
                    const _cropDef = CROPS.find(c => c.id === g.cropId);
                    const _sprite = g.quality === "epic" ? (_cropDef?.epicSpritePath ?? _cropDef?.spritePath)
                                  : g.quality === "rotten" ? (_cropDef?.rottenSpritePath ?? _cropDef?.spritePath)
                                  : g.quality === "legendary" ? (_cropDef?.legendarySpritePath ?? _cropDef?.spritePath)
                                  : _cropDef?.spritePath;
                    const _total = g.baseAmount + g.bonusAmount;
                    return (
                      <div key={i} className="group relative">
                        {/* Ikona przedmiotu */}
                        {(() => {
                          const _isExpOnly = g.quality === "legendary" && g.baseAmount === 0;
                          return (
                            <div className="relative h-[68px] w-[68px] cursor-default overflow-hidden rounded-xl border-2 transition-transform duration-150 group-hover:scale-110"
                              style={_isExpOnly
                                ? { borderColor: "#38bdf8", background: "rgba(14,60,100,0.6)" }
                                : g.quality === "legendary"
                                  ? { borderColor: _qd.borderColor, background: _qd.bgColor, animation: "legendaryPulse 2s ease-in-out infinite" }
                                  : { borderColor: _qd.borderColor, background: _qd.bgColor }}>
                              {_isExpOnly
                                ? <span className="flex h-full w-full flex-col items-center justify-center gap-0.5">
                                    <span className="text-[28px] leading-none">⭐</span>
                                    <span className="text-[11px] font-black text-sky-300 leading-none">XP</span>
                                  </span>
                                : _sprite
                                  ? <img src={_sprite} alt={g.cropName} className="h-full w-full object-contain p-1.5" />
                                  : <span className="flex h-full w-full items-center justify-center text-2xl">🌾</span>
                              }
                              {g.quality === "legendary" && !_isExpOnly && (
                                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                                  <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                </span>
                              )}
                              {/* Odznaka jakości — lewy górny róg */}
                              <span className="absolute left-0.5 top-0.5 text-[11px] leading-none drop-shadow">
                                {_isExpOnly ? "✨" : _qd.badge}
                              </span>
                              {/* Ilość — prawy dolny róg */}
                              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[11px] font-black text-white leading-tight">
                                {_total === 0 && g.bonusSource ? g.bonusSource : `×${_total}`}
                              </span>
                            </div>
                          );
                        })()}
                        {/* Tooltip przy hover */}
                        <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[200] hidden w-48 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(20,10,4,0.98)] p-3 text-xs shadow-2xl group-hover:block">
                          <p className="mb-1 font-black text-[#f9e7b2]">{g.cropName}</p>
                          <p className="mb-1" style={{ color: _qd.borderColor }}>{_qd.badge} {_qd.label}</p>
                          {g.baseAmount > 0 && (
                            <p className="text-[#dfcfab]">Zebrano: <span className="font-bold text-yellow-300">+{g.baseAmount} szt.</span></p>
                          )}
                          {g.bonusAmount > 0 && (
                            <p className="text-[#dfcfab]">Bonus <span className="text-amber-300">({g.bonusSource})</span>: <span className="font-bold text-yellow-300">+{g.bonusAmount} szt.</span></p>
                          )}
                          {g.quality === "legendary" && g.baseAmount === 0 && (
                            <p className="text-amber-300">🌟 Bonus EXP {g.bonusSource}</p>
                          )}
                          <p className="mt-1 border-t border-[#8b6a3e]/40 pt-1 text-sky-300">EXP: +{g.baseExp}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 border-t border-[#8b6a3e]/40 pt-2 text-[13px]">
                  <p className="text-[#d8ba7a]">Łącznie EXP: <span className="font-bold text-sky-300">+{totalExp}</span></p>
                </div>
                <button
                  onClick={() => setHarvestLog([])}
                  className="mt-2 w-full rounded-lg bg-[rgba(255,255,255,0.06)] py-1 text-[10px] text-[#8b6a3e] hover:text-[#d8ba7a]"
                >
                  Zamknij
                </button>
              </div>
            );
          })()}

          {message && (
            <div className="fixed bottom-4 left-4 z-50">
              <div
                className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-sm ${
                  message.type === "error"
                    ? "border-red-400/40 bg-red-950/80 text-red-100"
                    : message.type === "success"
                    ? "border-emerald-400/40 bg-emerald-950/80 text-emerald-100"
                    : "border-sky-400/40 bg-sky-950/80 text-sky-100"
                }`}
              >
                <p className="font-semibold">{message.title}</p>
                {message.text && <p className="mt-1 opacity-90">{message.text}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    {/* Tooltip sierpa podążający za kursorem */}
      {hoveredSickle && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-yellow-500 bg-[rgba(28,16,8,0.97)] p-4 text-[17px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}
        >
          <p className="mb-1 font-black text-yellow-300">🌾 Sierp — Zbierz</p>
          <p className="mb-3 text-[14px] text-[#8b6a3e]">Bonusy aktywne przy zbiorze dojrzałej uprawy</p>
          <p className="mb-1">🎯 Szansa na podwójny zbiór <span className="font-bold text-yellow-300">(+{calcStatEffect(playerStats.zrecznosc, 0.004).toFixed(1)}%)</span></p>
          <p className="text-[13px] text-[#8b6a3e] mb-2">z Zręczności ({playerStats.zrecznosc}/100)</p>
          <p className="mb-1">🍀 Szansa na bonusowy drop <span className="font-bold text-green-300">(+{calcStatEffect(playerStats.szczescie, 0.0025).toFixed(1)}%)</span></p>
          <p className="text-[13px] text-[#8b6a3e]">ze Szczęścia ({playerStats.szczescie}/100)</p>
        </div>
      )}
    {/* Tooltip konewki podążający za kursorem */}
      {hoveredWateringCan && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-cyan-500 bg-[rgba(28,16,8,0.97)] p-4 text-[17px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}
        >
          <p className="mb-1 font-black text-cyan-300">💧 Konewka</p>
          <p className="mb-2 text-[14px] text-[#8b6a3e]">Aktywuje bonus Zaradności — im wyższa statystyka, tym szybszy wzrost podlanej uprawy (0–{(WATER_BONUS_MAX*100).toFixed(0)}%)</p>
          <p>⏱ Skraca czas wzrostu o <span className="font-bold text-cyan-300">{(() => {
            const _zb = calcStatEffect(playerStats.zaradnosc, ZARADNOSC_RATE) / 100;
            const _we = (getEquipBonusPct("% efekt podlewania", charEquipped) + getEquipBonusPct("% efekt wody", charEquipped)) / 100;
            return (Math.min(WATER_BONUS_MAX, _zb * (1 + _we)) * 100).toFixed(1);
          })()}%</span> (twoja Zaradność: {playerStats.zaradnosc}/100)</p>
          <p className="mt-1">🚿 Roślinę można podlać <span className="font-bold text-yellow-300">max 1 raz</span></p>
        </div>
      )}
    {/* Tooltip uprawy podążający za kursorem */}
      {hoveredCrop && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-[#8b6a3e] bg-[rgba(28,16,8,0.97)] p-4 text-[17px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}
        >
          <p className="mb-1 font-black text-[#f9e7b2]">
            {hoveredCrop.name}
            {hoveredSeedQuality === "legendary" && <span className="ml-1 text-[14px] font-black text-[#f59e0b]">🌟 Legendarna</span>}
            {hoveredSeedQuality === "epic" && <span className="ml-1 text-[14px] font-black text-[#22c55e]">⭐ Epicka</span>}
            {hoveredSeedQuality === "good" && <span className="ml-1 text-[14px] font-black text-emerald-300">✅ Zwykła</span>}
            {hoveredSeedQuality === "rotten" && <span className="ml-1 text-[14px] font-black text-white">⚠️ Popsuta</span>}
          </p>
          <p className="mb-1 text-[14px] text-[#8b6a3e]">
            {hoveredSeedQuality === "legendary" ? "Legendarne nasiono — po zbiorze losuje 1 z 3 nagród (każda po 33%)!" : hoveredSeedQuality === "epic" ? "Epickie nasiono — wyższy plon i EXP" : hoveredSeedQuality === "rotten" ? "Zepsute — nie można zasadzić, nadaje się jedynie jako kompost lub do zadań specjalnych." : "Zwykłe nasiono"}
          </p>
          {hoveredSeedQuality !== "rotten" && <>
            {(() => {
              const _baseMs = hoveredCrop.growthTimeMs;
              // Te same wzory co w getEffectiveGrowthTimeMs (bez bonusów per-pole: woda/kompost)
              const _wiedzaEff   = (playerStats.wiedza ?? 0) + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
              const _wiedzaPctRaw = calcStatEffect(_wiedzaEff, WIEDZA_RATE); // % redukcji surowy
              const _wiedzaPct   = Math.min((1 - WIEDZA_MULT_MIN) * 100, _wiedzaPctRaw); // cap
              const _hivePct     = Math.min((1 - HIVE_MULT_MIN) * 100, hiveData.level * 2);
              const _equipPct    = Math.min((1 - EQUIP_GROWTH_MULT_MIN) * 100, getEquipBonusPct("% speed upraw", charEquipped));
              const _wiedzaMult  = Math.max(WIEDZA_MULT_MIN, 1 - _wiedzaPct / 100);
              const _hiveMult    = Math.max(HIVE_MULT_MIN, 1 - _hivePct / 100);
              const _equipMult   = Math.max(EQUIP_GROWTH_MULT_MIN, 1 - _equipPct / 100);
              const _totalMultDry = _wiedzaMult * _hiveMult * _equipMult;
              const _effMs       = Math.round(_baseMs * Math.max(GROWTH_GLOBAL_MIN_MULT, _totalMultDry));
              // Bonus z wody (jeśli podlejesz) — orientacyjnie z aktualnymi statami/eq
              const _zaradnosc   = playerStats.zaradnosc ?? 0;
              const _zaradBonus  = calcStatEffect(_zaradnosc, ZARADNOSC_RATE);
              const _waterEqPct  = getEquipBonusPct("% efekt podlewania", charEquipped) + getEquipBonusPct("% efekt wody", charEquipped);
              const _waterTotalPct = Math.min(WATER_BONUS_MAX * 100, _zaradBonus * (1 + _waterEqPct / 100));
              const _waterMult   = Math.max(WATER_MULT_MIN, 1 - _waterTotalPct / 100);
              const _totalMultWet = _waterMult * _wiedzaMult * _hiveMult * _equipMult;
              const _withWaterMs = Math.round(_baseMs * Math.max(GROWTH_GLOBAL_MIN_MULT, _totalMultWet));
              const _hitGlobalMin = _totalMultWet < GROWTH_GLOBAL_MIN_MULT;
              const _fmt = (ms: number) => {
                const _total = Math.max(0, Math.floor(ms / 1000));
                const _h = Math.floor(_total / 3600);
                const _m = Math.floor((_total % 3600) / 60);
                const _sec = _total % 60;
                const parts: string[] = [];
                if (_h > 0) parts.push(`${_h}h`);
                if (_m > 0 || _h > 0) parts.push(`${_m} min`);
                parts.push(`${_sec}s`);
                return parts.join(" ");
              };
              const _saved = _baseMs - _effMs;
              const _savedPct = Math.round((_saved / _baseMs) * 100);
              return (
                <>
                  <div className="mt-1 rounded-lg bg-black/30 p-2 text-[13px]">
                    <p className="font-bold text-[#f9e7b2]">⏱ Twój czas: <span className="text-emerald-300">{_fmt(_effMs)}</span></p>
                    <p className="text-[11px] text-[#8b6a3e]">Bazowo: {_fmt(_baseMs)}{_saved > 0 && <> · oszczędzasz <span className="text-emerald-400 font-bold">{_fmt(_saved)}</span> ({_savedPct}%)</>}</p>
                    {(_wiedzaPct > 0 || _hivePct > 0 || _equipPct > 0) && (
                      <div className="mt-1.5 space-y-0.5 text-[12px]">
                        {_wiedzaPct > 0 && <p>📚 Wiedza ({_wiedzaEff}): <span className="text-emerald-300">−{_wiedzaPct.toFixed(1)}%</span></p>}
                        {_hivePct > 0 && <p>🍯 Ul (poz. {hiveData.level}): <span className="text-emerald-300">−{_hivePct}%</span></p>}
                        {_equipPct > 0 && <p>👕 Ekwipunek (% speed upraw): <span className="text-emerald-300">−{_equipPct}%</span></p>}
                      </div>
                    )}
                    {_waterTotalPct > 0 && (
                      <p className="mt-1.5 text-[12px] text-cyan-300">💧 Z podlaniem: <span className="font-bold">{_fmt(_withWaterMs)}</span> <span className="text-[11px] text-[#8b6a3e]">(dodatkowe −{_waterTotalPct.toFixed(1)}%)</span></p>
                    )}
                    {_hitGlobalMin && (
                      <p className="mt-1 text-[11px] font-bold text-amber-300">⚠️ Globalne minimum {(GROWTH_GLOBAL_MIN_MULT * 100).toFixed(0)}% bazy — bonusy ponad ten próg nie skracają już czasu.</p>
                    )}
                  </div>
                </>
              );
            })()}
            {hoveredSeedQuality === "legendary" ? (
              <div className="mt-1 space-y-0.5 rounded-lg bg-[rgba(245,158,11,0.08)] p-2 text-[13px]">
                <p className="font-black text-amber-300">🎲 Jedna z 3 równych szans:</p>
                <p>✅ 15–100 zwykłych nasion</p>
                <p>⭐ 5–15 epickich nasion</p>
                <p>🌟 EXP ×15–30 (bez plonu)</p>
              </div>
            ) : (
              <p className="mt-1">🌾 Zbiór: {hoveredSeedQuality === "epic" ? "3–10 szt." : `${hoveredCrop.yieldAmount} szt.`}</p>
            )}
            <p className="mt-1">⭐ EXP: +{hoveredSeedQuality === "legendary" ? `${hoveredCrop.expReward}–${hoveredCrop.expReward * 30}` : hoveredSeedQuality === "epic" ? `${hoveredCrop.expReward * 3}–${hoveredCrop.expReward * 6}` : hoveredCrop.expReward}</p>
          </>}
        </div>
      )}
      </main>
  );
}  
