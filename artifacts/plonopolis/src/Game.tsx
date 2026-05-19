"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { supabase } from "@/lib/supabase";

type RankingPlayer = {
  user_id: string;
  player_name: string;
  guild_name: string;
  level: number;
  money: number;
  missions_completed: number;
  farm_power?: number;
  ranking_score?: number;
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
  barn_items?: Record<string, number> | null;
  fruit_inventory?: Record<string, number> | null;
  market_earned_today?: number | null;
  market_earned_date?: string | null;
  plot_obstacles?: Record<string, { type: string; cost: number }> | null;
  orchard_state?: Record<string, { owned: number; prodStart: number }> | null;
  barn_state?: Record<string, { owned: number; slots: number; prodStart: number }> | null;
};

type CustomerOrderItem = { id: string; qty: number; value: number };
type CustomerOrderBonus = { id?: string; qty: number; type: 'animal' | 'crop' | 'compost' | 'eq_item'; tier?: number };
type CustomerOrderRewards = { gold: number; exp: number; bonus: CustomerOrderBonus[] };
type CustomerOrder = {
  id: string;
  user_id: string;
  customer_type: string;
  items: CustomerOrderItem[];
  rewards: CustomerOrderRewards;
  expires_at: string;
  created_at: string;
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
  category: "system" | "received" | "sent" | "market";
  subject: string;
  body: string;
  read: boolean;
  saved: boolean;
  created_at: string;
};

// ─── TARG GRACZY ────────────────────────────────────────────────────────────
type MarketItemType = "crop" | "compost" | "barn_item" | "fruit" | "honey" | "equipment";
type MarketOffer = {
  id: string;
  seller_id: string;
  seller_name?: string;
  seller_avatar?: number | null;
  item_type: MarketItemType;
  item_key: string;
  item_name: string;
  item_icon: string;
  quantity: number;
  price_per_unit: number;
  duration_hours: number;
  status: "active" | "sold" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
  sold_at?: string | null;
  buyer_id?: string | null;
};
type MarketReturn = {
  id: string;
  user_id: string;
  return_type: "gold" | "item";
  item_key?: string | null;
  item_type?: string | null;
  item_name?: string | null;
  item_icon?: string | null;
  quantity: number;
  gold_amount?: number | null;
  reason: "sold" | "expired" | "cancelled";
  offer_id?: string | null;
  created_at: string;
  claimed: boolean;
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
  compostBonus?: CompostBonus | null;
  expBonusPct?: number;
};

const DEFAULT_LEVEL = 1;
const DEFAULT_XP = 0;
const DEFAULT_XP_TO_NEXT_LEVEL = 12;
const DEFAULT_MONEY = 10;
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 godziny hard-timeout
const DEFAULT_LOCATION = "Startowa Polana";
const DEFAULT_MAP = "farm1";
const MAX_LEVEL = 50;
const MAX_FIELDS = 100;
const FARM_UPGRADE_LEVELS = [5, 10, 15, 20, 25, 30] as const;
const FARM_MUSIC_MAPS = ["farm1","farm5","farm10","farm15","farm20","farm25","farm30"];
const CITY_MUSIC_MAPS = ["city","city_shop","city_market","city_bank","city_townhall","city_liga"];


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
  "/avatary/avatar_m1.png","/avatary/avatar_m2.png","/avatary/avatar_m3.png","/avatary/avatar_m4.png","/avatary/avatar_m5.png",
  "/avatary/avatar_m6.png","/avatary/avatar_m7.png","/avatary/avatar_m8.png","/avatary/avatar_m9.png","/avatary/avatar_m10.png",
];
const SKINS_FEMALE = [
  "/avatary/avatar_f1.png","/avatary/avatar_f2.png","/avatary/avatar_f3.png","/avatary/avatar_f4.png","/avatary/avatar_f5.png",
  "/avatary/avatar_f6.png","/avatary/avatar_f7.png","/avatary/avatar_f8.png","/avatary/avatar_f9.png","/avatary/avatar_f10.png",
];
const EPIC_SKINS: { path: string; name: string; cost: Record<string,number> }[] = [
  { path: "/avatary/avatar_epic1.png", name: "Król Marchewek", cost: { "carrot_good": 500 } },
  { path: "/avatary/avatar_epic2.png", name: "Zielona Moc",    cost: { "carrot_epic": 20 } },
  { path: "/avatary/avatar_epic3.png", name: "Plon Bogów",     cost: { "carrot_legendary": 1 } },
  { path: "/avatary/avatar_epic4.png", name: "Władca Pól",     cost: { "potato_epic": 5, "carrot_epic": 5 } },
  { path: "/avatary/avatar_epic5.png", name: "Legenda Farmy",  cost: { "potato_legendary": 1 } },
];
const EPIC_SKIN_START = 20; // indeksy 20–24
const ALL_SKINS = [...SKINS_MALE, ...SKINS_FEMALE, ...EPIC_SKINS.map(s => s.path)];

// ─── BONUSY STARTOWE AVATARÓW ────────────────────────────────────────────────
const AVATAR_BONUSES: Record<number, Partial<PlayerStatsMap>> = {
  // Mężczyźni (0-9)
  0:  { wiedza:4, opieka:3, szczescie:3 },
  1:  { zrecznosc:5, zaradnosc:3, wiedza:2 },
  2:  { wiedza:6, zaradnosc:2, szczescie:2 },
  3:  { zrecznosc:4, szczescie:4, wiedza:2 },
  4:  { zaradnosc:5, wiedza:3, sadownik:2 },
  5:  { wiedza:5, zrecznosc:3, zaradnosc:2 },
  6:  { sadownik:6, szczescie:2, wiedza:2 },
  7:  { opieka:6, szczescie:2, zaradnosc:2 },
  8:  { szczescie:6, zrecznosc:2, opieka:2 },
  9:  { opieka:4, zrecznosc:3, szczescie:3 },
  // Kobiety (10-19)
  10: { opieka:5, szczescie:3, zaradnosc:2 },
  11: { wiedza:5, zrecznosc:3, zaradnosc:2 },
  12: { sadownik:4, wiedza:3, szczescie:3 },
  13: { zaradnosc:4, wiedza:3, opieka:3 },
  14: { wiedza:6, szczescie:2, zrecznosc:2 },
  15: { wiedza:3, zrecznosc:3, zaradnosc:2, szczescie:2 },
  16: { szczescie:5, zaradnosc:3, sadownik:2 },
  17: { zrecznosc:5, wiedza:3, zaradnosc:2 },
  18: { opieka:6, szczescie:2, zaradnosc:2 },
  19: { wiedza:4, opieka:3, sadownik:3 },
  // Epickie (20-24)
  20: { wiedza:12, szczescie:10, zrecznosc:8 },
  21: { zaradnosc:12, szczescie:10, sadownik:8 },
  22: { wiedza:6, zrecznosc:6, zaradnosc:6, sadownik:6, opieka:3, szczescie:3 },
  23: { zrecznosc:14, wiedza:10, szczescie:6 },
  24: { opieka:14, sadownik:8, szczescie:8 },
};
const AVATAR_META: Record<number, { name: string; style: string }> = {
  0:  { name:"Stary Farmer",              style:"zbalansowany farmer"     },
  1:  { name:"Farmer z widlami",          style:"szybki zbior"            },
  2:  { name:"Farmer z rzodkiewkami",     style:"mistrz upraw"            },
  3:  { name:"Mlody farmer",              style:"szybkosc i lupy"         },
  4:  { name:"Kierowca traktora",         style:"ekonomia"                },
  5:  { name:"Farmer w kombajnie",          style:"specjalista pol"         },
  6:  { name:"Sadownik",                  style:"sad i drzewa"            },
  7:  { name:"Hodowca",                   style:"hodowla zwierzat"        },
  8:  { name:"Chlopiec z kotem",          style:"rzadkie dropy"           },
  9:  { name:"Farmer przy kurach",        style:"poczatkujacy hodowca"    },
  10: { name:"Farmerka z pieskiem",       style:"zwierzeta i szczescie"   },
  11: { name:"Farmerka z motyka",         style:"szybkie farmienie"       },
  12: { name:"Ogrodniczka z kwiatami",    style:"sad i kwiaty"            },
  13: { name:"Kucharka farmy",            style:"wydajna farma"           },
  14: { name:"Farmerka z koszem warzyw",  style:"specjalistka upraw"      },
  15: { name:"Farmerka w stodole",        style:"zbalansowany rozwoj"     },
  16: { name:"Handlarka farmy",           style:"handel i dropy"          },
  17: { name:"Farmerka sadzaca rosliny",  style:"szybki zbior"            },
  18: { name:"Hodowczyni zwierzat",       style:"mistrzyni zwierzat"      },
  19: { name:"Babcia farmerka",           style:"doswiadczona farmerka"   },
  20: { name:"Krol Marchewek",            style:"mistrz upraw"            },
  21: { name:"Zielona Moc",               style:"ekonomia i handel"       },
  22: { name:"Plon Bogow",                style:"idealny balans"          },
  23: { name:"Wladca Pol",                style:"szybki rozwoj"           },
  24: { name:"Legenda Farmy",             style:"mistrz hodowli"          },
};
// Koszt i cooldown zmiany avatara — indeks = numer zmiany (0-based)
// Pierwsze 2 zmiany gratis, potem koszt rośnie
const AVATAR_CHANGE_TIERS: { cost: number; cooldownMs: number }[] = [
  { cost: 0,     cooldownMs: 0                },  // 1. zmiana gratis
  { cost: 0,     cooldownMs: 0                },  // 2. zmiana gratis
  { cost: 5000,  cooldownMs: 1 * 3600 * 1000  },  // 3. zmiana
  { cost: 15000, cooldownMs: 3 * 3600 * 1000  },  // 4. zmiana
];
function getAvatarChangeTier(changeCount: number) {
  if (changeCount < AVATAR_CHANGE_TIERS.length) return AVATAR_CHANGE_TIERS[changeCount];
  return { cost: 50000, cooldownMs: 12 * 3600 * 1000 };
}
function AnimalImg({ id, icon, className }: { id: string; icon: string; className?: string }) {
  const [err, setErr] = React.useState(false);
  if (err) return <span className={className}>{icon}</span>;
  return <img src={`/zwierzeta/${id}.png`} alt={id} onError={() => setErr(true)}
    className={className} style={{ objectFit: "contain" }} draggable={false} />;
}

function getAvatarBonus(skin: number): Partial<PlayerStatsMap> {
  return AVATAR_BONUSES[skin] ?? {};
}
function mergeAvatarBonus(base: PlayerStatsMap, skin: number): PlayerStatsMap {
  const b = getAvatarBonus(skin);
  return {
    wiedza:    (base.wiedza    ?? 0) + (b.wiedza    ?? 0),
    zrecznosc: (base.zrecznosc ?? 0) + (b.zrecznosc ?? 0),
    zaradnosc: (base.zaradnosc ?? 0) + (b.zaradnosc ?? 0),
    sadownik:  (base.sadownik  ?? 0) + (b.sadownik  ?? 0),
    opieka:    (base.opieka    ?? 0) + (b.opieka    ?? 0),
    szczescie: (base.szczescie ?? 0) + (b.szczescie ?? 0),
  };
}

// UWAGA: rate dla "wiedza" i "zaradnosc" muszą być zgodne z WIEDZA_RATE/ZARADNOSC_RATE
// (poniżej w sekcji BALANS WZROSTU UPRAW). Inaczej UI panelu statów pokaże inny %
// niż faktyczny efekt w `getEffectiveGrowthTimeMs`.
const STATS_DEFS = [
  { key: "wiedza",    label: "Wiedza",    icon: "📚", img: "/ekwipunek/skill_wiedza.png",    desc: "Rośliny rosną szybciej", rate: 0.0033, unlockLevel: 1  },
  { key: "zrecznosc", label: "Zręczność", icon: "🎯", img: "/ekwipunek/skill_zrecznosc.png", desc: "Podwójny zbiór",         rate: 0.004,  unlockLevel: 1  },
  { key: "zaradnosc", label: "Zaradność", icon: "💧", img: "/ekwipunek/skill_zaradnosc.png", desc: "Bonus podlewania",        rate: 0.004,  unlockLevel: 1  },
  { key: "sadownik",  label: "Sadownik",  icon: "🌳", img: "/ekwipunek/skill_sadownik.png",  desc: "Zysk z drzew",           rate: 0.005,  unlockLevel: 10 },
  { key: "opieka",    label: "Opieka",    icon: "🐄", img: "/ekwipunek/skill_opieka.png",    desc: "Zdrowsze zwierzęta",     rate: 0.003,  unlockLevel: 3  },
  { key: "szczescie", label: "Szczęście", icon: "🍀", img: "/ekwipunek/skill_szczescie.png", desc: "Jakość plonów, ekwipunek, ulepszenia", rate: 0.0025, unlockLevel: 1  },
];
type StatKey = typeof STATS_DEFS[number]["key"];
type PlayerStatsMap = Record<StatKey, number>;
const DEFAULT_STATS: PlayerStatsMap = { wiedza:0, zrecznosc:0, zaradnosc:0, sadownik:0, opieka:0, szczescie:0 };

type DailyProgress = { date: string; harvests: number; customers: number; expGained: number; moneyGained: number; levelsGained: number; };
const DP_LS_KEY = (uid: string) => `plonopolis_dp_${uid}`;
function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function emptyDP(): DailyProgress { return { date: todayStr(), harvests: 0, customers: 0, expGained: 0, moneyGained: 0, levelsGained: 0 }; }
function loadDP(uid: string): DailyProgress {
  try { const r = localStorage.getItem(DP_LS_KEY(uid)); if (!r) return emptyDP(); const p = JSON.parse(r) as DailyProgress; return p.date === todayStr() ? p : emptyDP(); } catch { return emptyDP(); }
}
function saveDP(uid: string, dp: DailyProgress): void { try { localStorage.setItem(DP_LS_KEY(uid), JSON.stringify(dp)); } catch {} }

interface HiveData {
  level: number;
  bees_progress: number;
  honey_start: number | null;
  suit_durability: number;
  empty_jars: number;
  honey_jars: number;
}
const DEFAULT_HIVE_DATA: HiveData = { level:0, bees_progress:0, honey_start:null, suit_durability:0, empty_jars:0, honey_jars:0 };
const HIVE_MAX_HONEY     = [0, 8, 10, 12, 14, 16];
const HIVE_UPGRADE_BEES  = [0, 20, 30, 40, 50];
const HIVE_SUCCESS_CHANCE= [0, 1.00, 1.00, 1.00, 1.00, 1.00]; // zbiór miodu — zawsze 100%
const HIVE_BEE_ACCEPT_CHANCE = [0, 0.90, 0.80, 0.70, 0.60, 0.50]; // szansa przyjęcia 1 pszczoły wg poziomu ula
const HONEY_MS_PER_PT    = 3_600_000;
const HONEY_JAR_PRICE    = [0, 12, 12, 12, 12, 12];
const HIVE_UNLOCK_LVL    = 10;     // od którego poziomu gracza odblokowany jest ul
const BARN_UNLOCK_LVL    = 3;      // od którego poziomu gracza odblokowana jest stodoła (lvl pierwszego zwierzęcia — Kura)
const SAD_UNLOCK_LVL     = 10;     // od którego poziomu gracza odblokowany jest sad
const HIVE_BUY_COST      = 250;    // koszt zakupu ula (lvl 0 → 1)
const BEE_COST           = 75;     // koszt 1 pszczoły
const HIVE_MIN_BEES_TO_PRODUCE = 5; // ile pszczół musi być żeby ul zaczął produkować miód

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
const WATER_BASE             = 0.05;   // min 5% zawsze z konewki (bez statystyk)
const WATER_MULT_MIN         = 0.10;   // globalny min: konewka nie skróci więcej niż 90%
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
type BarnAnimalState = { owned:number; slots:number; hunger:number; lastFedAt:number; storage:number; prodStart:number; baseProdStart:number; };
type BarnState = Record<string,BarnAnimalState>;
type BarnItems = Record<string,number>;
interface AnimalItemDef { id:string; name:string; icon:string; sellPrice:number; n1:string; n24:string; n5:string; }
interface AnimalFeedDef { cropId:string; name:string; icon:string; points:number; }
interface AnimalDef { id:string; name:string; icon:string; unlockLevel:number; prodMs:number; itemId:string; storageMax:number; startSlots:number; maxSlots:number; buyPrice:number; slotUpgCosts:number[]; feed:AnimalFeedDef[]; }
interface THHitbox { id:string; label:string; x:number; y:number; width:number; height:number; action:string; }
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
// Wagi losowania tieru: 50% słaby, 35% śrni, 15% mocny
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
const JACKPOT_CHANCE = 0.5; // % szansy na jackpot per partia
const MAX_LEGENDARY_EXP_MULT = 50; // cap: base EXP × wszystkie bonusy ≤ base × 50
const ITEM_TIER_RARITY: Array<{ border: string; shadow: string; label: string; dot: string }> = [
  { border: "#22c55e", shadow: "rgba(34,197,94,0.30)",   label: "Standard",   dot: "🟢" }, // I1
  { border: "#38bdf8", shadow: "rgba(56,189,248,0.30)",  label: "Dobry",      dot: "🔵" }, // I2
  { border: "#a78bfa", shadow: "rgba(167,139,250,0.40)", label: "Epic",       dot: "🟣" }, // I3
  { border: "#fb923c", shadow: "rgba(251,146,60,0.40)",  label: "Epic+",      dot: "🟠" }, // I4
  { border: "#fbbf24", shadow: "rgba(251,191,36,0.55)",  label: "Legendarny", dot: "👑" }, // I5
];
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
type CompostBatch = { fill: number; scoreSum: number; cropIds?: string[] };
const KOMPOST_BATCH_SIZE = 100;
const KOMPOST_REWARDS_PER_BATCH = 5;

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
const ACTIVE_USER_KEY = "plonopolis_active_user";
// Klucze localStorage przypisane do sesji gracza (bez userId w nazwie) — czyszczone przy zmianie konta
const PER_SESSION_KEYS = [
  "plonopolis_char_equipped", "plonopolis_item_upg_reg", "plonopolis_owned_eq",
  "plonopolis_extra_eq", "plonopolis_kompost_charges", "plonopolis_kompost_batches",
  "plonopolis_slot_box", "plonopolis_barn", "plonopolis_barn_items",
  "plonopolis_orchard", "plonopolis_fruit_inv",
  "plonopolis_backpack_filter", "plonopolis_backpack_position",
];
function clearPerSessionLocalStorage() {
  try { PER_SESSION_KEYS.forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
}
// Klucz z userId: izolacja danych per-konto nawet przy kilku otwartych kartach
function lsKey(base: string, uid: string): string { return uid ? `${base}_${uid}` : base; }
// Migracja: czyta z nowego klucza (z userId), fallback do starego globalnego (kopiuje + usuwa globalny)
function lsLoadMigrate<T>(base: string, uid: string, parse: (s: string) => T, dflt: () => T): T {
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
  { id:"jajko",           name:"Jajko",           icon:"🥚", sellPrice:40,   n1:"jajko",         n24:"jajka",        n5:"jajek"          },
  { id:"futro_krolika",   name:"Futro Królika",    icon:"🐇", sellPrice:80,   n1:"futro",         n24:"futra",        n5:"futer"          },
  { id:"mleko",           name:"Mleko",            icon:"🥛", sellPrice:140,  n1:"mleko",         n24:"mleka",        n5:"mleka"          },
  { id:"piora",           name:"Pióra",            icon:"🪶", sellPrice:220,  n1:"pióro",         n24:"pióra",        n5:"piór"           },
  { id:"welna",           name:"Wełna",            icon:"🧶", sellPrice:320,  n1:"wełnę",         n24:"wełny",        n5:"wełny"          },
  { id:"nawoz_naturalny", name:"Nawóz Naturalny",  icon:"💩", sellPrice:450,  n1:"nawóz",         n24:"nawozy",       n5:"nawozów"        },
  { id:"mleko_kozie",     name:"Mleko Kozie",      icon:"🥛", sellPrice:650,  n1:"mleko kozie",   n24:"mleka koziego",n5:"mleka koziego"  },
  { id:"duze_piora",      name:"Duże Pióra",       icon:"🪶", sellPrice:900,  n1:"duże pióro",    n24:"duże pióra",   n5:"dużych piór"    },
  { id:"energia_robocza", name:"Energia Robocza",  icon:"⚡", sellPrice:1400, n1:"energię",       n24:"energie",      n5:"energii"        },
  { id:"rogi_byka",       name:"Rogi Byka",        icon:"🦴", sellPrice:2500, n1:"róg",           n24:"rogi",         n5:"rogów"          },
];
function plItem(n: number, item: AnimalItemDef): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (abs === 1) return item.n1;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return item.n24;
  return item.n5;
}
const ANIMALS: AnimalDef[] = [
  { id:"kura",   name:"Kura",    icon:"🐔", unlockLevel:3,  prodMs:4*3600000,  itemId:"jajko",           storageMax:1, startSlots:2, maxSlots:24, buyPrice:600,
    slotUpgCosts:barnSlotCosts(600,22),
    feed:[{cropId:"carrot",name:"Marchew",icon:"🥕",points:10},{cropId:"potato",name:"Ziemniak",icon:"🥔",points:15}] },
  { id:"krolik", name:"Królik",  icon:"🐇", unlockLevel:5,  prodMs:8*3600000,  itemId:"futro_krolika",   storageMax:1, startSlots:2, maxSlots:20, buyPrice:1800,
    slotUpgCosts:barnSlotCosts(1800,18),
    feed:[{cropId:"carrot",name:"Marchew",icon:"🥕",points:12},{cropId:"lettuce",name:"Sałata",icon:"🥬",points:18}] },
  { id:"krowa",  name:"Krowa",   icon:"🐄", unlockLevel:7,  prodMs:12*3600000, itemId:"mleko",           storageMax:1, startSlots:1, maxSlots:16, buyPrice:4500,
    slotUpgCosts:barnSlotCosts(4500,15),
    feed:[{cropId:"lettuce",name:"Sałata",icon:"🥬",points:15},{cropId:"rapeseed",name:"Rzepak",icon:"🌾",points:30}] },
  { id:"kaczka", name:"Kaczka",  icon:"🦆", unlockLevel:9,  prodMs:16*3600000, itemId:"piora",           storageMax:1, startSlots:1, maxSlots:16, buyPrice:9000,
    slotUpgCosts:barnSlotCosts(9000,15),
    feed:[{cropId:"radish",name:"Rzodkiewka",icon:"🌱",points:15},{cropId:"sunflower",name:"Słonecznik",icon:"🌻",points:35}] },
  { id:"owca",   name:"Owca",    icon:"🐑", unlockLevel:11, prodMs:20*3600000, itemId:"welna",           storageMax:1, startSlots:1, maxSlots:12, buyPrice:18000,
    slotUpgCosts:barnSlotCosts(18000,11),
    feed:[{cropId:"cabbage",name:"Kapusta",icon:"🥦",points:20},{cropId:"rapeseed",name:"Rzepak",icon:"🌾",points:35}] },
  { id:"swinia", name:"Świnia",  icon:"🐖", unlockLevel:13, prodMs:24*3600000, itemId:"nawoz_naturalny", storageMax:1, startSlots:1, maxSlots:10, buyPrice:35000,
    slotUpgCosts:barnSlotCosts(35000,9),
    feed:[{cropId:"tomato",name:"Pomidor",icon:"🍅",points:20},{cropId:"pumpkin",name:"Dynia",icon:"🎃",points:40}] },
  { id:"koza",   name:"Koza",    icon:"🐐", unlockLevel:15, prodMs:30*3600000, itemId:"mleko_kozie",     storageMax:1, startSlots:1, maxSlots:8,  buyPrice:65000,
    slotUpgCosts:barnSlotCosts(65000,7),
    feed:[{cropId:"grape",name:"Winogrono",icon:"🍇",points:40},{cropId:"asparagus",name:"Szparagi",icon:"🌿",points:60}] },
  { id:"indyk",  name:"Indyk",   icon:"🦃", unlockLevel:17, prodMs:36*3600000, itemId:"duze_piora",      storageMax:1, startSlots:1, maxSlots:8,  buyPrice:120000,
    slotUpgCosts:barnSlotCosts(120000,7),
    feed:[{cropId:"sunflower",name:"Słonecznik",icon:"🌻",points:35},{cropId:"chili",name:"Papryczka chili",icon:"🌶️",points:50}] },
  { id:"kon",    name:"Koń",     icon:"🐎", unlockLevel:20, prodMs:48*3600000, itemId:"energia_robocza", storageMax:1, startSlots:1, maxSlots:6,  buyPrice:250000,
    slotUpgCosts:barnSlotCosts(250000,5),
    feed:[{cropId:"rapeseed",name:"Rzepak",icon:"🌾",points:50},{cropId:"asparagus",name:"Szparagi",icon:"🌿",points:70}] },
  { id:"byk",    name:"Byk",     icon:"🐂", unlockLevel:25, prodMs:72*3600000, itemId:"rogi_byka",       storageMax:1, startSlots:1, maxSlots:4,  buyPrice:600000,
    slotUpgCosts:barnSlotCosts(600000,3),
    feed:[{cropId:"pumpkin",name:"Dynia",icon:"🎃",points:50},{cropId:"asparagus",name:"Szparagi",icon:"🌿",points:80}] },
];
function defaultBarnState(): BarnState {
  const s: BarnState = {};
  ANIMALS.forEach(a => { s[a.id] = { owned:0, slots:a.startSlots, hunger:80, lastFedAt:0, storage:0, prodStart:0, baseProdStart:0 }; });
  return s;
}

function computeFarmPower(
  stats: PlayerStatsMap,
  equipped: CharEquipped,
  hiveLevel: number,
  orchard: OrchardState,
  barn: BarnState,
): number {
  const eqPow = (Object.values(equipped) as ({id:string;upg:number}|null)[]).reduce((s, eq) => {
    if (!eq) return s;
    const d = CHAR_EQUIP_ITEMS.find(it => it.id === eq.id);
    const l = d?.unlockLevel ?? 1;
    const u = eq.upg ?? 0;
    return s + l * 8 + u * u * 4;
  }, 0);
  const orchPow = TREES.reduce((s, t) => s + Math.round(Math.sqrt(t.buyPrice) * 2) * (orchard[t.id]?.owned ?? 0), 0);
  const barnPow = ANIMALS.reduce((s, a) => s + Math.round(Math.sqrt(a.buyPrice) * 2.5) * (barn[a.id]?.owned ?? 0), 0);
  return Math.round(
    Object.values(stats).reduce((s: number, v: unknown) => s + (v as number), 0) * 3
    + hiveLevel * hiveLevel * 20
    + eqPow + orchPow + barnPow
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SAD — drzewa owocowe (cykliczna produkcja owoców z lossowaną jakością)
// ═══════════════════════════════════════════════════════════════════════
type FruitQuality = "zwykly" | "soczysty" | "zloty" | "zgnile";
const FRUIT_QUALITY_DEFS: Record<FruitQuality, { label:string; mult:number; color:string; icon:string; baseChance:number }> = {
  zwykly:   { label:"Zwykły",   mult:1, color:"#86efac", icon:"",   baseChance:0.78 },
  soczysty: { label:"Soczysty", mult:2, color:"#22d3ee", icon:"💧", baseChance:0.12 },
  zloty:    { label:"Złoty",    mult:5, color:"#fde047", icon:"✨", baseChance:0.03 },
  zgnile:   { label:"Zgniłe",   mult:0, color:"#6b7280", icon:"",   baseChance:0.10 },
};
// luckPct = bonus % (np. ze skilla Szczęście + eq "% bonus drop")
function rollFruitQuality(luckPct: number = 0): FruitQuality {
  const r = Math.random();
  // zgniłe: stałe 10% — nie zależy od szczęścia
  const zgnileChance = FRUIT_QUALITY_DEFS.zgnile.baseChance;
  if (r < zgnileChance) return "zgnile";
  const lf = 1 + Math.max(0, luckPct) / 100;
  const zlotyChance    = Math.min(0.50, FRUIT_QUALITY_DEFS.zloty.baseChance * lf);
  const soczystyChance = Math.min(0.60, FRUIT_QUALITY_DEFS.soczysty.baseChance * lf);
  const rr = (r - zgnileChance) / (1 - zgnileChance);
  if (rr < zlotyChance) return "zloty";
  if (rr < zlotyChance + soczystyChance) return "soczysty";
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
  TREES.forEach(t => { s[t.id] = { owned:0, prodStart:0, storage:{ zwykly:0, soczysty:0, zloty:0, zgnile:0 } }; });
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
        zgnile:   typeof s.storage?.zgnile   === "number" ? s.storage.zgnile   : 0,
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
function getStatRank(val: number): { name: string; color: string; prevT: number; nextT: number } {
  if (val >= 75) return { name: "Legenda",    color: "text-yellow-300",  prevT: 75, nextT: 100 };
  if (val >= 50) return { name: "Mistrz",     color: "text-purple-300",  prevT: 50, nextT: 75  };
  if (val >= 25) return { name: "Ekspert",    color: "text-blue-300",    prevT: 25, nextT: 50  };
  if (val >= 10) return { name: "Rolnik",     color: "text-green-300",   prevT: 10, nextT: 25  };
  return               { name: "Nowicjusz",  color: "text-[#8b6a3e]",   prevT: 0,  nextT: 10  };
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
function loadAvatarDataLS(userId: string): { skin: number; stats: PlayerStatsMap; fsp: number; prevLevel: number; changeCount: number; lastChangeAt: number } {
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
function saveAvatarDataLS(userId: string, skin: number, stats: PlayerStatsMap, fsp: number, prevLevel: number, changeCount?: number, lastChangeAt?: number) {
  localStorage.setItem(`plonopolis_skin_${userId}`, String(skin));
  localStorage.setItem(`plonopolis_stats_${userId}`, JSON.stringify(stats));
  localStorage.setItem(`plonopolis_fsp_${userId}`, String(fsp));
  localStorage.setItem(`plonopolis_prevlv_${userId}`, String(prevLevel));
  if (changeCount !== undefined) localStorage.setItem(`plonopolis_avatar_changes_${userId}`, String(changeCount));
  if (lastChangeAt !== undefined) localStorage.setItem(`plonopolis_avatar_last_change_${userId}`, String(lastChangeAt));
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
    spritePath: "/uprawy/carrot_icon_transparent.png",
  },
  {
    id: "carrot",
    name: "Marchew",
    unlockLevel: 1,
    growthTimeMs: 3 * 60_000,
    yieldAmount: 2,
    expReward: 6,
    spritePath: "/uprawy/carrot_icon_transparent.png",
    epicSpritePath: "/uprawy/carrot_epic.png",
    rottenSpritePath: "/uprawy/carrot_rotten.png",
    legendarySpritePath: "/uprawy/carrot_legendary.png",
  },
  {
    id: "potato",
    name: "Ziemniak",
    unlockLevel: 2,
    growthTimeMs: 4 * 60_000,
    yieldAmount: 2,
    expReward: 8,
    spritePath: "/uprawy/potato.png",
    epicSpritePath: "/uprawy/potato_epic.png",
    rottenSpritePath: "/uprawy/potato_rotten.png",
    legendarySpritePath: "/uprawy/potato_legendary.png",
  },
  {
    id: "tomato",
    name: "Pomidor",
    unlockLevel: 3,
    growthTimeMs: 5 * 60_000,
    yieldAmount: 2,
    expReward: 10,
    spritePath: "/uprawy/tomato.png",
    epicSpritePath: "/uprawy/tomato_epic.png",
    rottenSpritePath: "/uprawy/tomato_rotten.png",
    legendarySpritePath: "/uprawy/tomato_legendary.png",
  },
  {
    id: "cucumber",
    name: "Ogórek",
    unlockLevel: 4,
    growthTimeMs: 7 * 60_000,
    yieldAmount: 2,
    expReward: 14,
    spritePath: "/uprawy/cucumber.png",
    epicSpritePath: "/uprawy/cucumber_epic.png",
    rottenSpritePath: "/uprawy/cucumber_rotten.png",
    legendarySpritePath: "/uprawy/cucumber_legendary.png",
  },
  {
    id: "onion",
    name: "Cebula",
    unlockLevel: 5,
    growthTimeMs: 10 * 60_000,
    yieldAmount: 2,
    expReward: 20,
    spritePath: "/uprawy/onion.png",
    epicSpritePath: "/uprawy/onion_epic.png",
    rottenSpritePath: "/uprawy/onion_rotten.png",
    legendarySpritePath: "/uprawy/onion_legendary.png",
  },
  {
    id: "garlic",
    name: "Czosnek",
    unlockLevel: 6,
    growthTimeMs: 14 * 60_000,
    yieldAmount: 2,
    expReward: 28,
    spritePath: "/uprawy/garlic.png",
    epicSpritePath: "/uprawy/garlic_epic.png",
    rottenSpritePath: "/uprawy/garlic_rotten.png",
    legendarySpritePath: "/uprawy/garlic_legendary.png",
  },
  {
    id: "lettuce",
    name: "Sałata",
    unlockLevel: 7,
    growthTimeMs: 18 * 60_000,
    yieldAmount: 3,
    expReward: 36,
    spritePath: "/uprawy/lettuce.png",
    epicSpritePath: "/uprawy/lettuce_epic.png",
    rottenSpritePath: "/uprawy/lettuce_rotten.png",
    legendarySpritePath: "/uprawy/lettuce_legendary.png",
  },
  {
    id: "radish",
    name: "Rzodkiewka",
    unlockLevel: 8,
    growthTimeMs: 24 * 60_000,
    yieldAmount: 3,
    expReward: 48,
    spritePath: "/uprawy/radish.png",
    epicSpritePath: "/uprawy/radish_epic.png",
    rottenSpritePath: "/uprawy/radish_rotten.png",
    legendarySpritePath: "/uprawy/radish_legendary.png",
  },
  {
    id: "beet",
    name: "Burak",
    unlockLevel: 9,
    growthTimeMs: 32 * 60_000,
    yieldAmount: 3,
    expReward: 64,
    spritePath: "/uprawy/beet.png",
    epicSpritePath: "/uprawy/beet_epic.png",
    rottenSpritePath: "/uprawy/beet_rotten.png",
    legendarySpritePath: "/uprawy/beet_legendary.png",
  },
  {
    id: "pepper",
    name: "Papryka",
    unlockLevel: 10,
    growthTimeMs: 42 * 60_000,
    yieldAmount: 3,
    expReward: 84,
    spritePath: "/uprawy/pepper.png",
    epicSpritePath: "/uprawy/pepper_epic.png",
    rottenSpritePath: "/uprawy/pepper_rotten.png",
    legendarySpritePath: "/uprawy/pepper_legendary.png",
  },
  {
    id: "cabbage",
    name: "Kapusta",
    unlockLevel: 11,
    growthTimeMs: 55 * 60_000,
    yieldAmount: 3,
    expReward: 110,
    spritePath: "/uprawy/cabbage.png",
    epicSpritePath: "/uprawy/cabbage_epic.png",
    rottenSpritePath: "/uprawy/cabbage_rotten.png",
    legendarySpritePath: "/uprawy/cabbage_legendary.png",
  },
  {
    id: "broccoli",
    name: "Brokuł",
    unlockLevel: 12,
    growthTimeMs: 72 * 60_000,
    yieldAmount: 3,
    expReward: 144,
    spritePath: "/uprawy/broccoli.png",
    epicSpritePath: "/uprawy/broccoli_epic.png",
    rottenSpritePath: "/uprawy/broccoli_rotten.png",
    legendarySpritePath: "/uprawy/broccoli_legendary.png",
  },
  {
    id: "cauliflower",
    name: "Kalafior",
    unlockLevel: 13,
    growthTimeMs: 95 * 60_000,
    yieldAmount: 3,
    expReward: 190,
    spritePath: "/uprawy/cauliflower.png",
    epicSpritePath: "/uprawy/cauliflower_epic.png",
    rottenSpritePath: "/uprawy/cauliflower_rotten.png",
    legendarySpritePath: "/uprawy/cauliflower_legendary.png",
  },
  {
    id: "strawberry",
    name: "Truskawka",
    unlockLevel: 14,
    growthTimeMs: 125 * 60_000,
    yieldAmount: 3,
    expReward: 250,
    spritePath: "/uprawy/strawberry.png",
    epicSpritePath: "/uprawy/strawberry_epic.png",
    rottenSpritePath: "/uprawy/strawberry_rotten.png",
    legendarySpritePath: "/uprawy/strawberry_legendary.png",
  },
  {
    id: "raspberry",
    name: "Malina",
    unlockLevel: 15,
    growthTimeMs: 165 * 60_000,
    yieldAmount: 3,
    expReward: 330,
    spritePath: "/uprawy/raspberry.png",
    epicSpritePath: "/uprawy/raspberry_epic.png",
    rottenSpritePath: "/uprawy/raspberry_rotten.png",
    legendarySpritePath: "/uprawy/raspberry_legendary.png",
  },
  {
    id: "blueberry",
    name: "Borówka",
    unlockLevel: 16,
    growthTimeMs: 215 * 60_000,
    yieldAmount: 3,
    expReward: 430,
    spritePath: "/uprawy/blueberry.png",
    epicSpritePath: "/uprawy/blueberry_epic.png",
    rottenSpritePath: "/uprawy/blueberry_rotten.png",
    legendarySpritePath: "/uprawy/blueberry_legendary.png",
  },
  {
    id: "eggplant",
    name: "Bakłażan",
    unlockLevel: 17,
    growthTimeMs: 280 * 60_000,
    yieldAmount: 3,
    expReward: 560,
    spritePath: "/uprawy/eggplant.png",
    epicSpritePath: "/uprawy/eggplant_epic.png",
    rottenSpritePath: "/uprawy/eggplant_rotten.png",
    legendarySpritePath: "/uprawy/eggplant_legendary.png",
  },
  {
    id: "zucchini",
    name: "Cukinia",
    unlockLevel: 18,
    growthTimeMs: 360 * 60_000,
    yieldAmount: 3,
    expReward: 720,
    spritePath: "/uprawy/zucchini.png",
    epicSpritePath: "/uprawy/zucchini_epic.png",
    rottenSpritePath: "/uprawy/zucchini_rotten.png",
    legendarySpritePath: "/uprawy/zucchini_legendary.png",
  },
  {
    id: "watermelon",
    name: "Arbuz",
    unlockLevel: 19,
    growthTimeMs: 435 * 60_000,
    yieldAmount: 3,
    expReward: 870,
    spritePath: "/uprawy/watermelon.png",
    epicSpritePath: "/uprawy/watermelon_epic.png",
    rottenSpritePath: "/uprawy/watermelon_rotten.png",
    legendarySpritePath: "/uprawy/watermelon_legendary.png",
  },
  {
    id: "grape",
    name: "Winogrono",
    unlockLevel: 20,
    growthTimeMs: 500 * 60_000,
    yieldAmount: 3,
    expReward: 1000,
    spritePath: "/uprawy/grape.png",
    epicSpritePath: "/uprawy/grape_epic.png",
    rottenSpritePath: "/uprawy/grape_rotten.png",
    legendarySpritePath: "/uprawy/grape_legendary.png",
  },
  {
    id: "pumpkin",
    name: "Dynia",
    unlockLevel: 21,
    growthTimeMs: 540 * 60_000,
    yieldAmount: 3,
    expReward: 1080,
    spritePath: "/uprawy/pumpkin.png",
    epicSpritePath: "/uprawy/pumpkin_epic.png",
    rottenSpritePath: "/uprawy/pumpkin_rotten.png",
    legendarySpritePath: "/uprawy/pumpkin_legendary.png",
  },
  {
    id: "rapeseed",
    name: "Rzepak",
    unlockLevel: 22,
    growthTimeMs: 580 * 60_000,
    yieldAmount: 3,
    expReward: 1150,
    spritePath: "/uprawy/rapeseed.png",
    epicSpritePath: "/uprawy/rapeseed_epic.png",
    rottenSpritePath: "/uprawy/rapeseed_rotten.png",
    legendarySpritePath: "/uprawy/rapeseed_legendary.png",
  },
  {
    id: "sunflower",
    name: "Słonecznik",
    unlockLevel: 23,
    growthTimeMs: 620 * 60_000,
    yieldAmount: 3,
    expReward: 1240,
    spritePath: "/uprawy/sunflower.png",
    epicSpritePath: "/uprawy/sunflower_epic.png",
    rottenSpritePath: "/uprawy/sunflower_rotten.png",
    legendarySpritePath: "/uprawy/sunflower_legendary.png",
  },
  {
    id: "chili",
    name: "Papryczka chili",
    unlockLevel: 24,
    growthTimeMs: 660 * 60_000,
    yieldAmount: 3,
    expReward: 1320,
    spritePath: "/uprawy/chili.png",
    epicSpritePath: "/uprawy/chili_epic.png",
    rottenSpritePath: "/uprawy/chili_rotten.png",
    legendarySpritePath: "/uprawy/chili_legendary.png",
  },
  {
    id: "asparagus",
    name: "Szparagi",
    unlockLevel: 25,
    growthTimeMs: 720 * 60_000,
    yieldAmount: 3,
    expReward: 1440,
    spritePath: "/uprawy/asparagus.png",
    epicSpritePath: "/uprawy/asparagus_epic.png",
    rottenSpritePath: "/uprawy/asparagus_rotten.png",
    legendarySpritePath: "/uprawy/asparagus_legendary.png",
  },
];

// ── Dzienne promocje deterministyczne (seed z UTC-dnia) ──────────────────────
function getPolandDayNumber(): number {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }); // 'YYYY-MM-DD'
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
function getMsToPolandMidnight(): number {
  const warsawStr = new Date().toLocaleString('sv', { timeZone: 'Europe/Warsaw' }); // 'YYYY-MM-DD HH:mm:ss'
  const timePart = warsawStr.split(' ')[1];
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return 86400000 - (hh * 3600 + mm * 60 + ss) * 1000;
}
function getDailyPromos(): { normal: string[]; super_: string[] } {
  const day = getPolandDayNumber();
  const eligible = CROPS.filter(c => c.id !== "test_nasiono");
  const arr = [...eligible];
  for (let i = arr.length - 1; i > 0; i--) {
    const x = Math.sin(day * 9301 + i * 49297) * 233280;
    const j = Math.floor((x - Math.floor(x)) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { normal: arr.slice(0,3).map(c=>c.id), super_: [arr[3].id] };
}
function formatShopCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

const FARM_PLOTS: FarmPlot[] = Array.from({ length: MAX_FIELDS }, (_, index) => ({
  id: index + 1,
  left: "0%",
  top: "0%",
  width: "0%",
  height: "0%",
}));

// Grid 10×10 — pola numerowane wierszami od lewej do prawej, z góry na dół
// Hitboxy pól — synchronizowane z edit-mode (fhOffsetX/Y/CellW/H)
// offsetX=16.83, offsetY=4.15, cellW=6.59, cellH=9.01
const _FH_OX = 16.83, _FH_OY = 4.15, _FH_CW = 6.59, _FH_CH = 9.01;
const _COLS = Array.from({length:10},(_,i)=>parseFloat((_FH_OX+i*_FH_CW).toFixed(2)));
const _ROWS = Array.from({length:10},(_,i)=>parseFloat((_FH_OY+i*_FH_CH).toFixed(2)));
const FIELD_VIEW_PLOTS: FieldViewPlotLayout[] = Array.from({ length: 100 }, (_, i) => {
  const row = Math.floor(i / 10);
  const col = i % 10;
  return {
    id: i + 1,
    left: `${_COLS[col]}%`,
    top: `${_ROWS[row]}%`,
    width: `${_FH_CW}%`,
    height: `${_FH_CH}%`,
  };
});

// Typy i koszty przeszkód (pola 21–100)
const OBSTACLE_DEFS: Record<string, { name: string; icon: string; color: string }> = {
  chwasty:  { name: "Chwasty",    icon: "🌿", color: "#86efac" },
  kamienie: { name: "Kamienie",   icon: "🪨", color: "#d1d5db" },
  maly_pien:{ name: "Mały pień",  icon: "🪵", color: "#d97706" },
  duzy_pien:{ name: "Duży pień",  icon: "🌲", color: "#a16207" },
  kret:     { name: "Kret",       icon: "🐾", color: "#a8a29e" },
};

const XP_TABLE: Record<number, number> = {
  // lvl 1-7: szybki start (30-90 min do lvl 3 z podstawowymi uprawami)
  1:           12,
  2:          150,
  3:          250,
  4:          400,
  5:          600,
  6:          900,
  7:         1400,
  // lvl 8+: steeply steeper — progression celowo wolniejszy
  8:         2200,
  9:         3500,
  10:        5500,   // kilka godzin od startu
  11:        9000,
  12:       14000,
  13:       22000,
  14:       34000,
  15:       52000,
  16:       80000,
  17:      120000,
  18:      180000,
  19:      270000,
  20:      400000,   // długoterminowy midgame
  21:      600000,
  22:      850000,
  23:     1200000,
  24:     1700000,
  25:     2400000,
  26:     3300000,
  27:     4500000,
  28:     6200000,
  29:     8500000,
  30:    11500000,   // realny endgame
  31:    15500000,
  32:    21000000,
  33:    28000000,
  34:    38000000,
  35:    51000000,
  36:    69000000,
  37:    93000000,
  38:   125000000,
  39:   170000000,
  40:   230000000,
  41:   310000000,
  42:   420000000,
  43:   570000000,
  44:   760000000,
  45:  1000000000,
  46:  1350000000,
  47:  1800000000,
  48:  2400000000,
  49:  3200000000,
  50:  9999999999,
};

function getXpForLevel(level: number) {
  return XP_TABLE[level] ?? 999999999;
}

function getDefaultUnlockedPlots() {
  // Pola 1–20 odblokowane od startu
  return Array.from({ length: 20 }, (_, i) => i + 1);
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

function getMapForLevel(level: number | null | undefined) {
  const safeLevel = level ?? DEFAULT_LEVEL;

  if (safeLevel >= 30) return "farm30";
  if (safeLevel >= 25) return "farm25";
  if (safeLevel >= 20) return "farm20";
  if (safeLevel >= 15) return "farm15";
  if (safeLevel >= 10) return "farm10";
  if (safeLevel >= 3) return "farm5";

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

const BASE_W = 1920;
const BASE_H = 1280;
// Ratusz: 4096×1536 grafika, skalowanie do BASE_H → maxCamX i centrum
const TH_IMAGE_W = 4096;
const TH_IMAGE_H = 1536;
const TH_SCALE = Math.min(BASE_H / TH_IMAGE_H, 1);
const TH_MAX_CAM_X = Math.max(0, Math.round(TH_IMAGE_W * TH_SCALE) - BASE_W);
const TH_CENTER_CAM_X = Math.round(TH_MAX_CAM_X / 2);
const FARM_MAP_W = 2560;
const FARM_MAP_H = 1440;
// Nowe grafiki farmy 4096×1536 — logika identyczna jak Ratusz
const FARM_IMG_W = 4096;
const FARM_IMG_H = 1536;
const FARM_SCALE = Math.min(BASE_H / FARM_IMG_H, 1);           // ≈ 0.8333
const FARM_RENDERED_W = Math.round(FARM_IMG_W * FARM_SCALE);   // ≈ 3413
const FARM_MAX_PAN = Math.max(0, FARM_RENDERED_W - BASE_W);    // ≈ 1493
const FARM_CENTER_PAN = -Math.round(FARM_MAX_PAN / 2);         // ≈ -747

export default function Page() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [ready, setReady] = useState(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  // Auto-ukrywanie powiadomień po 6 sekundach (success/info), 8s dla error
  React.useEffect(() => {
    if (!message) return;
    const ms = message.type === 'error' ? 8000 : 6000;
    const t = setTimeout(() => setMessage(null), ms);
    return () => clearTimeout(t);
  }, [message]);
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
  const [plotObstacles, setPlotObstacles] = useState<Record<string, { type: string; cost: number }>>({});
  const [plotToBuy, setPlotToBuy] = useState<number | null>(null);
  const [isFieldViewOpen, setIsFieldViewOpen] = useState(false);
  const [fieldHitboxEditMode, setFieldHitboxEditMode] = React.useState(false);
  const [fhOffsetX, setFhOffsetX] = React.useState(16.83);
  const [fhOffsetY, setFhOffsetY] = React.useState(4.15);
  const [fhCellW, setFhCellW] = React.useState(6.59);
  const [fhCellH, setFhCellH] = React.useState(9.01);
  const fhCols = Array.from({length:10},(_,i)=>parseFloat((fhOffsetX+i*fhCellW).toFixed(2)));
  const fhRows = Array.from({length:10},(_,i)=>parseFloat((fhOffsetY+i*fhCellH).toFixed(2)));
  const [fhLockAxis, setFhLockAxis] = React.useState<"none"|"x"|"y">("none");
  const fhHoldRef = React.useRef<ReturnType<typeof setInterval>|null>(null);
  const fhStopHold = () => { if (fhHoldRef.current) { clearInterval(fhHoldRef.current); fhHoldRef.current = null; } };
  const fhStartHold = (fn: () => void) => { fn(); fhHoldRef.current = setInterval(fn, 80); };
  const fhContainerRef = React.useRef<HTMLDivElement>(null);
  const fhDragRef = React.useRef<{startMouseX:number,startMouseY:number,startOffsetX:number,startOffsetY:number}|null>(null);
  const fieldViewScrollRef = React.useRef<HTMLDivElement>(null);
  const fieldScrollDragRef = React.useRef<{active:boolean,startX:number,startY:number,scrollLeft:number,scrollTop:number,moved:boolean}|null>(null);
  const fhResizeRef = React.useRef<{startMouseX:number,startMouseY:number,startW:number,startH:number}|null>(null);
  const handleFhMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!fhContainerRef.current) return;
    const rect = fhContainerRef.current.getBoundingClientRect();
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;
    if (fhDragRef.current) {
      const { startMouseX, startMouseY, startOffsetX, startOffsetY } = fhDragRef.current;
      if (fhLockAxis !== "y") setFhOffsetX(parseFloat((startOffsetX + (pctX - startMouseX)).toFixed(2)));
      if (fhLockAxis !== "x") setFhOffsetY(parseFloat((startOffsetY + (pctY - startMouseY)).toFixed(2)));
    }
    if (fhResizeRef.current) {
      const { startMouseX, startMouseY, startW, startH } = fhResizeRef.current;
      setFhCellW(Math.max(1, parseFloat((startW+(pctX-startMouseX)).toFixed(2))));
      setFhCellH(Math.max(1, parseFloat((startH+(pctY-startMouseY)).toFixed(2))));
    }
  };
  const handleFhMouseUp = () => { fhDragRef.current = null; fhResizeRef.current = null; };

  // ── Edytor pozycji przycisków narzędzi (konewka/zbierz) na obrazie pola ──
  const [fvToolEditMode, setFvToolEditMode] = React.useState(false);
  const [fvKonewkaPos, setFvKonewkaPos] = React.useState({ l: 58, t: 560, w: 192, h: 179 });
  const [fvZbierzPos, setFvZbierzPos] = React.useState({ l: 58, t: 760, w: 190, h: 176 });
  const [fvNasonaPos, setFvNasonaPos] = React.useState({ l: 58, t: 360, w: 192, h: 179 });
  const [fvKompostPos, setFvKompostPos] = React.useState({ l: 58, t: 160, w: 192, h: 179 });
  const [fvSeedPickerOpen, setFvSeedPickerOpen] = React.useState(false);
  const [fvCompostPickerOpen, setFvCompostPickerOpen] = React.useState(false);
  const fvToolDragRef = React.useRef<{ btn: "konewka"|"zbierz"|"nasiona"|"kompost", mode: "move"|"resize", startMX: number, startMY: number, startL: number, startT: number, startW: number, startH: number } | null>(null);
  React.useEffect(() => {
    if (!fvToolEditMode || !isFieldViewOpen) return;
    const handleMove = (e: MouseEvent) => {
      if (!fvToolDragRef.current) return;
      const d = fvToolDragRef.current;
      const setter = d.btn === "konewka" ? setFvKonewkaPos : d.btn === "zbierz" ? setFvZbierzPos : d.btn === "nasiona" ? setFvNasonaPos : setFvKompostPos;
      if (d.mode === "move") {
        setter({
          l: Math.round(Math.max(0, d.startL + (e.clientX - d.startMX))),
          t: Math.round(Math.max(0, d.startT + (e.clientY - d.startMY))),
          w: d.startW,
          h: d.startH,
        });
      } else {
        setter(prev => ({
          ...prev,
          w: Math.round(Math.max(40, d.startW + (e.clientX - d.startMX))),
          h: Math.round(Math.max(40, d.startH + (e.clientY - d.startMY))),
        }));
      }
    };
    const handleUp = () => { fvToolDragRef.current = null; };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [fvToolEditMode, isFieldViewOpen]);
  // Globalne mouseup — kończy drag-to-plant
  React.useEffect(() => {
    const onUp = () => {
      if (isDraggingPlantRef.current) {
        isDraggingPlantRef.current = false;
        dragEndedRef.current = true;
        dragPlantedFieldsRef.current.clear();
      }
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);
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
  const sessionTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs do fresh state — używane w setTimeout callbackach (closure capture by stary state)
  const seedInventoryRef = React.useRef<SeedInventory>({});
  const plotCropsRef = React.useRef<Record<number, PlotCropState>>({});
  // Drag-to-plant refs
  const isDraggingPlantRef = React.useRef(false);
  const dragPlantedFieldsRef = React.useRef<Set<number>>(new Set());
  const dragEndedRef = React.useRef(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [gameScale, setGameScale] = useState(() =>
    typeof window !== "undefined" ? Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H) : 1
  );
  const gameScaleRef = React.useRef(gameScale);
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
  const [rankingSort, setRankingSort] = useState<"level"|"money"|"farmpower">("farmpower");
  const [rankingSearch, setRankingSearch] = useState("");
  const [rankingHighlightMe, setRankingHighlightMe] = useState(false);
  const [showGildiaPanel, setShowGildiaPanel] = useState(false);
  const [showMisjePanel, setShowMisjePanel] = useState(false);
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  const [messageTab, setMessageTab] = useState<"systemowe"|"otrzymane"|"wyslane"|"targ">("systemowe");
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [gameMessages, setGameMessages] = useState<GameMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMarketCount, setUnreadMarketCount] = useState(0);
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
  const [hoveredHiveLock, setHoveredHiveLock] = React.useState(false);
  const [hoveredBarnLock, setHoveredBarnLock] = React.useState(false);
  const [hoveredSadLock, setHoveredSadLock] = React.useState(false);
  const [hoveredStodola, setHoveredStodola] = React.useState(false);
  const [hoveredUl, setHoveredUl] = React.useState(false);
  const [hoveredSad, setHoveredSad] = React.useState(false);
  const [hoveredLada, setHoveredLada] = React.useState(false);
  const [hoveredDom, setHoveredDom] = React.useState(false);
  const [hoveredKompostownik, setHoveredKompostownik] = React.useState(false);
  const [hoveredPolaUprawne, setHoveredPolaUprawne] = React.useState(false);
  const [hoveredDoMiasta, setHoveredDoMiasta] = React.useState(false);
  const [hoveredNaFarme, setHoveredNaFarme] = React.useState(false);
  const [hoveredSklep, setHoveredSklep] = React.useState(false);
  const [hoveredTarg, setHoveredTarg] = React.useState(false);
  const [hoveredBank, setHoveredBank] = React.useState(false);
  const [hoveredRatusz, setHoveredRatusz] = React.useState(false);
  const [hoveredLiga, setHoveredLiga] = React.useState(false);
  const [townHallCamX, setTownHallCamX] = React.useState(0);
  const thDragRef = React.useRef<{startX:number; startCamX:number} | null>(null);
  const [thHitboxEditMode, setThHitboxEditMode] = React.useState(false);
  const [thMouseOnPanorama, setThMouseOnPanorama] = React.useState({x:0, y:0});
  const [townHallHitboxes, setTownHallHitboxes] = React.useState<THHitbox[]>([
    { id:"ranking", label:"Ranking",      x:259,  y:347, width:716, height:839, action:"ranking" },
    { id:"club",    label:"Klub Rolnika", x:1305, y:542, width:1489, height:807, action:"club"  },
    { id:"event",   label:"Event",        x:3075, y:354, width:798, height:791, action:"event"  },
  ]);
  const thContainerRef = React.useRef<HTMLDivElement>(null);
  const thHbDragRef = React.useRef<{hbId:string; startX:number; startY:number; startHbX:number; startHbY:number; mode:"move"|"resize"; startW:number; startH:number} | null>(null);
  const [thTextEditMode, setThTextEditMode] = React.useState(false);
  const [thShowPreviewRanking, setThShowPreviewRanking] = React.useState(true);
  const [rankingTextLayout, setRankingTextLayout] = React.useState({ startX:0, startY:22, rowHeight:89, nameX:165, scoreRight:28, fontSize:28 });
  const thTextDragRef = React.useRef<{prop:"startX"|"startY"|"rowHeight"|"nameX"|"scoreRight"; startMX:number; startMY:number; startVal:number} | null>(null);
  const [hoveredSickle, setHoveredSickle] = React.useState(false);
  const [avatarSkin, setAvatarSkin] = React.useState<number>(-1);
  const [showSkinModal, setShowSkinModal] = React.useState(false);
  const [showAvatarHover, setShowAvatarHover] = React.useState(false);
  const [unlockedEpicAvatars, setUnlockedEpicAvatars] = React.useState<number[]>([]);
  const [skinTab, setSkinTab] = React.useState<"mezczyzni"|"kobiety"|"wszystkie"|"epickie">("mezczyzni");
  const [epicPurchaseTarget, setEpicPurchaseTarget] = React.useState<number|null>(null);
  const [hoveredEpicSkin, setHoveredEpicSkin] = React.useState<number|null>(null);
  const [hoveredNormalSkin, setHoveredNormalSkin] = React.useState<number|null>(null);

  // ── Strażnik tooltipów stref: co 500ms sprawdza :hover, czyści "przyklejone" tooltipy ──
  React.useEffect(() => {
    const zoneSetters: Array<[string, React.Dispatch<React.SetStateAction<boolean>>]> = [
      ["doMiasta",     setHoveredDoMiasta],
      ["naFarme",      setHoveredNaFarme],
      ["dom",          setHoveredDom],
      ["stodola",      setHoveredStodola],
      ["ul",           setHoveredUl],
      ["sad",          setHoveredSad],
      ["lada",         setHoveredLada],
      ["kompostownik", setHoveredKompostownik],
      ["polaUprawne",  setHoveredPolaUprawne],
      ["sklep",        setHoveredSklep],
      ["targ",         setHoveredTarg],
      ["bank",         setHoveredBank],
      ["ratusz",       setHoveredRatusz],
      ["hiveLock",     setHoveredHiveLock],
      ["barnLock",     setHoveredBarnLock],
      ["sadLock",      setHoveredSadLock],
      ["sickle",       setHoveredSickle],
    ];
    const id = setInterval(() => {
      for (const [zone, setter] of zoneSetters) {
        const el = document.querySelector<Element>(`[data-zone="${zone}"]`);
        if (!el || !el.matches(":hover")) setter(false);
      }
    }, 500);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [playerStats, setPlayerStats] = React.useState<PlayerStatsMap>({ ...DEFAULT_STATS });
  const [freeSkillPoints, setFreeSkillPoints] = React.useState(3);
  const [statFlash, setStatFlash] = React.useState<string|null>(null);
  const [avatarChangeCount, setAvatarChangeCount] = React.useState(0);
  const [lastAvatarChangeAt, setLastAvatarChangeAt] = React.useState(0);
  const effectiveStats = React.useMemo(() => mergeAvatarBonus(playerStats, avatarSkin), [playerStats, avatarSkin]);
  const [dailyProgress, setDailyProgress] = React.useState<DailyProgress>(emptyDP());
  const [statUpgradeAmount, setStatUpgradeAmount] = React.useState<1|5|10>(1);
  const [showDomModal, setShowDomModal] = React.useState(false);
  const [showStodolaModal, setShowStodolaModal] = React.useState(false);
  const [showSadModal, setShowSadModal] = React.useState(false);
  const [showUlModal, setShowUlModal] = React.useState(false);
  const [showLadaModal, setShowLadaModal] = React.useState(false);
  const [showLadaInfo, setShowLadaInfo] = React.useState(false);
  const [customerLootDrop, setCustomerLootDrop] = React.useState<null | { gold: number; exp: number; bonus: CustomerOrderBonus[]; customerName: string; customerIcon: string }>(null);
  const [lootHoverIdx, setLootHoverIdx] = React.useState<number | null>(null);
  const ladaInfoCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openLadaInfo = React.useCallback(() => {
    if (ladaInfoCloseTimer.current) { clearTimeout(ladaInfoCloseTimer.current); ladaInfoCloseTimer.current = null; }
    setShowLadaInfo(true);
  }, []);
  const scheduleCloseLadaInfo = React.useCallback(() => {
    if (ladaInfoCloseTimer.current) clearTimeout(ladaInfoCloseTimer.current);
    ladaInfoCloseTimer.current = setTimeout(() => { setShowLadaInfo(false); ladaInfoCloseTimer.current = null; }, 180);
  }, []);
  // Lada NPC — zamówienia klientów
  const [customerOrders, setCustomerOrders] = React.useState<CustomerOrder[]>([]);
  const [currentCustomerIdx, setCurrentCustomerIdx] = React.useState(0);
  const [customerSelling, setCustomerSelling] = React.useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = React.useState(false);
  const [customerNow, setCustomerNow] = React.useState(Date.now());
  const [nextSpawnAt, setNextSpawnAt] = React.useState<number | null>(null);
  const lastAutoTickAtRef = React.useRef(0);
  const [hiveData, setHiveData] = React.useState<HiveData>({ ...DEFAULT_HIVE_DATA });
  const [hiveNow, setHiveNow] = React.useState(Date.now());
  const [showTestModal, setShowTestModal] = React.useState(false);
  const OWNER_ID = "c68b84c6-335a-4832-af86-477bcb09fc16"; // właściciel gry (do przyszłego użycia)
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const [navEditMode, setNavEditMode] = React.useState(false);
  // pozycje etykiet (niezależne od hitboxów)
  const [navLabelPos, setNavLabelPos] = React.useState<Record<string,{left:number,top:number}>>({
    dom:         {left:26.7, top:25.1},
    stodola:     {left:56.6, top:65.6},
    doMiasta:    {left:77.4, top:11.3},
    polaUprawne: {left:55.4, top:29.8},
    ul:          {left:78.6, top:81.1},
    lada:        {left:22.3, top:62.6},
    kompostownik:{left:80.1, top:32.7},
    sad:         {left:35.4, top:82.2},
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
    dom:         {left:18.9, top:12.6, width:13.7, height:30.0},
    stodola:     {left:47.7, top:56.9, width:18.8, height:27.0},
    doMiasta:    {left:69.2, top:0.0,  width:15.4, height:17.3},
    polaUprawne: {left:43.4, top:15.3, width:24.3, height:32.8},
    ul:          {left:71.1, top:72.0, width:15.8, height:22.4},
    lada:        {left:17.3, top:51.5, width:9.8,  height:19.8},
    kompostownik:{left:75.7, top:23.5, width:9.6,  height:19.7},
    sad:         {left:28.0, top:71.8, width:14.7, height:28.6},
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
  const [ligaTab, setLigaTab] = React.useState<"ranking"|"wyzwanie"|"nagrody">("ranking");
  const [cityNavEditMode, setCityNavEditMode] = React.useState(false);
  const [cityHitboxEditMode, setCityHitboxEditMode] = React.useState(false);
  const [cityHitboxPos, setCityHitboxPos] = React.useState<Record<string,{left:number,top:number,width:number,height:number}>>({
    naFarme: {left:6.6,  top:71.0, width:16.6, height:23.9},
    sklep:   {left:5.5,  top:35.1, width:14.7, height:34.2},
    targ:    {left:21.6, top:41.3, width:20.4, height:26.9},
    bank:    {left:59.0, top:39.6, width:12.1, height:27.3},
    ratusz:  {left:42.3, top:5.1,  width:12.0, height:49.8},
    liga:    {left:75.5, top:19.1, width:23.1, height:58.5},
  });
  const [cityLabelPos, setCityLabelPos] = React.useState<Record<string,{left:number,top:number}>>({
    naFarme: {left:15.4, top:83.0},
    sklep:   {left:12.6, top:54.5},
    targ:    {left:32.1, top:54.8},
    bank:    {left:64.3, top:52.1},
    ratusz:  {left:47.5, top:45.3},
    liga:    {left:85.2, top:55.2},
  });
  const cityHitboxDragRef = React.useRef<{type:"move"|"resize",id:string,startX:number,startY:number,startPos:{left:number,top:number,width:number,height:number}}|null>(null);
  const cityLabelDragRef = React.useRef<{id:string,startX:number,startY:number,startPos:{left:number,top:number}}|null>(null);
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const dh = cityHitboxDragRef.current;
      if (dh && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        const cityDragScaleX = BASE_W / FARM_RENDERED_W;
        const dx = ((e.clientX - dh.startX) / rect.width) * 100 * cityDragScaleX;
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
        const cityDragScaleX = BASE_W / FARM_RENDERED_W;
        const dx = ((e.clientX - dl.startX) / rect.width) * 100 * cityDragScaleX;
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
  const [promoCountdown, setPromoCountdown] = React.useState(() => formatShopCountdown(getMsToPolandMidnight()));
  const dailyPromos = React.useMemo(() => getDailyPromos(), []);
  const [domTab, setDomTab] = React.useState<"profil"|"eq"|"plecak">("profil");
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
  const [charEquipped, setCharEquipped] = React.useState<CharEquipped>({ ...DEFAULT_CHAR_EQUIPPED });
  const [equippingSlot, setEquippingSlot] = React.useState<EquipSlot | null>(null);
  const [selectedExtraUid, setSelectedExtraUid] = React.useState<string | null>(null);
  const [eqFilter, setEqFilter] = React.useState<EquipSlot | "">("");
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = React.useState<EquipSlot | null>(null);
  const [itemUpgRegistry, setItemUpgRegistry] = React.useState<Record<string,number>>({});
  const saveCharEquipped = (next: CharEquipped) => { setCharEquipped(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(CHAR_EQUIP_KEY, uid), JSON.stringify(next)); } catch { /* ignore */ } };
  const saveItemUpg = (reg: Record<string,number>) => { setItemUpgRegistry(reg); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(ITEM_UPG_KEY, uid), JSON.stringify(reg)); } catch { /* ignore */ } };
  const getItemUpg = (id: string) => itemUpgRegistry[id] ?? 0;
  // ─── Ekwipunek: zdobyte przedmioty (gracz musi je zdobyć by je mieć) ───
  const [ownedEqItems, setOwnedEqItems] = React.useState<Record<string, true>>({});
  const saveOwnedEqItems = (next: Record<string, true>) => { setOwnedEqItems(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(OWNED_EQ_KEY, uid), JSON.stringify(next)); } catch {} };
  // ─── Ekwipunek Dodatkowy: nadmiarowe duplikaty (przyszłość: handel/ulepszenia/sprzedaż) ───
  type ExtraEqEntry = { uid: string; id: string; upg: number };
  const [extraEqItems, setExtraEqItems] = React.useState<ExtraEqEntry[]>([]);
  const saveExtraEqItems = (next: ExtraEqEntry[]) => { setExtraEqItems(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(EXTRA_EQ_KEY, uid), JSON.stringify(next)); } catch {} };
  const makeExtraUid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  // ─── Kompostownik ───
  const [kompostBatch, setKompostBatch] = React.useState<CompostBatch>({ fill: 0, scoreSum: 0, cropIds: [] });
  // Flaga przeciw race conditions: blokuje równoległe deposit/claim (np. szybkie podwójne kliknięcia)
  const kompostBusyRef = React.useRef(false);
  const saveKompostBatch = (batch: CompostBatch) => {
    const uid = profile?.id ?? "";
    const clean: CompostBatch = {
      fill: Math.max(0, Math.min(KOMPOST_BATCH_SIZE, Math.floor(batch.fill))),
      scoreSum: Math.max(0, batch.scoreSum),
      cropIds: Array.isArray(batch.cropIds) ? batch.cropIds : [],
    };
    setKompostBatch(clean);
    if (uid) try {
      localStorage.setItem(lsKey(KOMPOST_BATCHES_KEY, uid), JSON.stringify(clean));
      localStorage.removeItem(lsKey(KOMPOST_KEY, uid));
      localStorage.removeItem(KOMPOST_KEY);
    } catch {}
  };
  const [showKompostModal, setShowKompostModal] = React.useState(false);
  type KompostRewardEntry =
    | { kind:"item"; itemId: string; itemName: string; itemIcon: string }
    | { kind:"compost"; compostType: CompostType; value: number };
  const [kompostRewards, setKompostRewards] = React.useState<KompostRewardEntry[] | null>(null);
  const [kompostDropHistory, setKompostDropHistory] = React.useState<Array<{label: string; color: string; icon: string; ts: number; count: number}>>([]);
  const [showKompostHistory, setShowKompostHistory] = React.useState(false);
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
  const [kompostTierHoverTip, setKompostTierHoverTip] = React.useState<{ x: number; y: number; node: React.ReactNode; color: string } | null>(null);
  const [showKompostHelp, setShowKompostHelp] = React.useState(false);
  const [seedPickerTip, setSeedPickerTip] = React.useState<{ x: number; y: number; node: React.ReactNode; color: string } | null>(null);
  const [cardTip, setCardTip] = React.useState<React.ReactNode>(null);
  const [avatarTipVisible, setAvatarTipVisible] = React.useState(false);
  const [avatarTipPos, setAvatarTipPos] = React.useState({ x: 0, y: 0 });
  const loginPanelPos = { left: 738, top: 424, width: 457 };
  const [kompostQty, setKompostQty] = React.useState<1|5|10|100|"max">(1);
  const [kompostFilter, setKompostFilter] = React.useState<"rotten"|"good"|"epic"|"legendary"|"all">("rotten");
  const [compostNotice, setCompostNotice] = React.useState<{ type: CompostType; value: number; plotId: number } | null>(null);
  const [slotBoxCustom, setSlotBoxCustom] = React.useState<Record<string,{top:number,left:number,width:number,height:number}>>({ ...DEFAULT_SLOT_BOX });
  const [editSlotBox, setEditSlotBox] = React.useState(false);
  const saveSlotBox = (v: Record<string,{top:number,left:number,width:number,height:number}>) => {
    setSlotBoxCustom(v); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(SLOT_BOX_KEY, uid), JSON.stringify(v)); } catch { /* ignore */ }
  };
  const [barnNow, setBarnNow] = React.useState(Date.now());
  const [panX, setPanX] = React.useState(0);
  const [panY, setPanY] = React.useState(0);
  const [isPanDragging, setIsPanDragging] = React.useState(false);
  const panDragRef = React.useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false });
  const [barnState, setBarnState_] = React.useState<BarnState>(defaultBarnState());
  const barnStateRef = React.useRef<BarnState>(barnState);
  const [barnItems, setBarnItems_] = React.useState<BarnItems>({});
  const [selectedAnimal, setSelectedAnimal] = React.useState<string|null>(null);
  const saveBarnState = (next: BarnState) => { barnStateRef.current = next; setBarnState_(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(BARN_STATE_KEY, uid), JSON.stringify(next)); } catch {} };
  const saveBarnItems = (next: BarnItems) => { setBarnItems_(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(BARN_ITEMS_KEY, uid), JSON.stringify(next)); } catch {} };
  // SAD — state + persystencja
  const [orchardState, setOrchardState_] = React.useState<OrchardState>(defaultOrchardState());
  const saveOrchardState = (next: OrchardState) => { setOrchardState_(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(ORCHARD_STATE_KEY, uid), JSON.stringify(next)); } catch {} };
  const [orchardError, setOrchardError] = React.useState("");
  // Owoce zebrane (Record<"fruitId_quality", number>) — osobny inventory bo sprzedaż per quality, w przyszłości też crafting/gildie
  const FRUIT_INV_KEY = "plonopolis_fruit_inv";
  const [fruitInventory, setFruitInventory_] = React.useState<Record<string,number>>({});
  const saveFruitInventory = (next: Record<string,number>) => { setFruitInventory_(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(FRUIT_INV_KEY, uid), JSON.stringify(next)); } catch {} };
  // ─── TARG GRACZY: stan ───────────────────────────────────────────────────────
  const [showMarketModal, setShowMarketModal] = React.useState(false);
  const [marketTab, setMarketTab] = React.useState<"browse"|"my_offers"|"returns">("browse");
  const [marketBrowse, setMarketBrowse] = React.useState<MarketOffer[]>([]);
  const [myMarketOffers, setMyMarketOffers] = React.useState<MarketOffer[]>([]);
  const [marketReturns, setMarketReturns] = React.useState<MarketReturn[]>([]);
  const [marketLoading, setMarketLoading] = React.useState(false);
  const [marketBrowseFilter, setMarketBrowseFilter] = React.useState<MarketItemType|"all">("crop");
  const [marketSearch, setMarketSearch] = React.useState("");
  const [marketQualityFilter, setMarketQualityFilter] = React.useState<string>("all");
  const [marketSort, setMarketSort] = React.useState<"price_asc"|"price_desc"|"qty_desc"|"expires_asc"|"newest"|"unit_asc">("newest");
  const [marketTierFilter, setMarketTierFilter] = React.useState<"all"|"1"|"2"|"3"|"4"|"5">("all");
  const [marketMyLevelOnly, setMarketMyLevelOnly] = React.useState(false);
  const [pendingReturnCount, setPendingReturnCount] = React.useState(0);
  const [createOfferOpen, setCreateOfferOpen] = React.useState(false);
  const [coItemType, setCoItemType] = React.useState<MarketItemType>("crop");
  const [coItemKey, setCoItemKey] = React.useState("");
  const [coQty, setCoQty] = React.useState(1);
  const [coPrice, setCoPrice] = React.useState<number>(10);
  const [coPriceStr, setCoPriceStr] = React.useState("10");
  const [coDuration, setCoDuration] = React.useState<24|48|72>(24);
  const [coLoading, setCoLoading] = React.useState(false);
  const [buyingOfferId, setBuyingOfferId] = React.useState<string|null>(null);
  const [buyQtyMap, setBuyQtyMap] = React.useState<Record<string, number>>({});
  const [cancellingOfferId, setCancellingOfferId] = React.useState<string|null>(null);
  const [claimingReturns, setClaimingReturns] = React.useState(false);
  const [marketPickerOpen, setMarketPickerOpen] = React.useState(false);
  const [marketPickerSearch, setMarketPickerSearch] = React.useState("");
  const [marketPickerFilter, setMarketPickerFilter] = React.useState<MarketItemType>("crop");
  React.useEffect(() => {
    const t = setInterval(() => setBarnNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (marketPickerOpen) { setMarketPickerOpen(false); return; }
      if (showMarketModal) { setShowMarketModal(false); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marketPickerOpen, showMarketModal]);
  React.useEffect(() => {
    let changed = false;
    const next: BarnState = {};
    const opiekaPts = effectiveStats.opieka;
    const bonusChance = opiekaPts * 0.0015; // +0.15%/pkt
    const bonusMessages: string[] = [];
    const freshBarn = barnStateRef.current;
    ANIMALS.forEach(a => {
      const st = freshBarn[a.id] ?? { owned:0, slots:a.startSlots, hunger:80, lastFedAt:0, storage:0, prodStart:0, baseProdStart:0 };
      if (st.owned === 0) { next[a.id] = st; return; }
      let ns = { ...st };
      // storageMax=1 oznacza max 1 cykl — po 1 cyklu timer staje; owned mnoży ilość produktów przy odbiorze
      if (ns.storage >= a.storageMax) { ns.prodStart = 0; next[a.id] = ns; return; }
      if (ns.prodStart === 0) { ns.prodStart = barnNow; changed = true; next[a.id] = ns; return; }
      const h = barnCurrentHunger(ns, opiekaPts);
      const effMs = barnEffProdMs(a, h);
      const elapsed = barnNow - ns.prodStart;
      if (elapsed >= effMs) {
        const freeSlots = a.storageMax - ns.storage;
        const fullCycles = Math.min(Math.floor(elapsed / effMs), freeSlots);
        let cyclesToAdd = fullCycles;
        // Bonus opieki: szansa na dodatkowy produkt przy odbiorze (nie dodatkowy cykl)
        if (bonusChance > 0) {
          for (let i = 0; i < fullCycles; i++) {
            if (ns.storage + cyclesToAdd >= a.storageMax) break;
            if (Math.random() < bonusChance) {
              cyclesToAdd += 1;
              const item = ANIMAL_ITEMS.find(i => i.id === a.itemId);
              if (item) bonusMessages.push(`${a.icon} ${a.name} dała bonus ${item.name}! ${item.icon}`);
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
    const sadownikBonus = calcStatEffect(effectiveStats.sadownik, 0.005) / 100;
    // Szczęście + eq "% bonus drop" → szansa na rare/golden
    const luckPct = calcStatEffect(effectiveStats.szczescie, 0.0025) + getEquipBonusPct("% bonus drop", charEquipped);
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
        const totalStored = ns.storage.zwykly + ns.storage.soczysty + ns.storage.zloty + (ns.storage.zgnile ?? 0);
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
  const skinDbSyncedRef = React.useRef(false);
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
  const farmPowerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const farmAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const cityAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [musicVolume, setMusicVolume] = React.useState(0.4);
  const [musicMuted, setMusicMuted] = React.useState(false);
  const BACKPACK_POSITION_STORAGE_KEY = "plonopolis_backpack_position";

  function isPlotUnlocked(plotId: number) {
    return unlockedPlots.includes(plotId);
  }

  function getPlotUnlockCost(plotId: number) {
    // Koszty startowych pól 1–20: darmowe (zawsze odblokowane)
    if (plotId <= 20) return 0;
    // Pola 21–100: koszt z losowych przeszkód (załadowany z Supabase)
    return plotObstacles[String(plotId)]?.cost ?? 0;
  }

  function getPlotObstacleType(plotId: number): string | null {
    if (plotId <= 20) return null;
    return plotObstacles[String(plotId)]?.type ?? null;
  }

  function resetLocalGameState() {
    // Wyczyść localStorage kluczy przypisanych do sesji (stodoła, sad, ekwipunek, kompost...)
    clearPerSessionLocalStorage();
    try { localStorage.removeItem(ACTIVE_USER_KEY); } catch { /* ignore */ }
    // Resetuj React state
    setProfile(null);
    setSelectedPlotId(null);
    setUnlockedPlots(getDefaultUnlockedPlots());
    setPlotObstacles({});
    setPlotCrops({});
    setSeedInventory(getDefaultSeedInventory());
    setPlotToBuy(null);
    setIsFieldViewOpen(false);
    setSelectedSeedId(null);
    setSelectedTool(null);
    setIsDraggingBackpack(false);
    // Resetuj stany ekwipunku, stodoły, sadu, kompostu
    setCharEquipped({ ...DEFAULT_CHAR_EQUIPPED });
    setItemUpgRegistry({});
    setOwnedEqItems({});
    setExtraEqItems([]);
    setBarnState_(defaultBarnState());
    setBarnItems_({});
    setOrchardState_(defaultOrchardState());
    setFruitInventory_({});
  }

  async function applyProfileState(rawProfile: unknown) {
    if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
      setProfile(null);
      setUnlockedPlots(getDefaultUnlockedPlots());
      setPlotCrops({});
      setSeedInventory(getDefaultSeedInventory());
      return null;
    }

    const source = rawProfile as Profile;

    // Wykryj zmianę konta — jeśli inny userId niż poprzednio, wyczyść dane z localStorage
    try {
      const lastUserId = localStorage.getItem(ACTIVE_USER_KEY);
      if (lastUserId && lastUserId !== source.id) {
        // Nowe konto na tym urządzeniu → usuń dane poprzedniego gracza
        clearPerSessionLocalStorage();
        setCharEquipped({ ...DEFAULT_CHAR_EQUIPPED });
        setItemUpgRegistry({});
        setOwnedEqItems({});
        setExtraEqItems([]);
        setBarnState_(defaultBarnState());
        setBarnItems_({});
        setOrchardState_(defaultOrchardState());
        setFruitInventory_({});
      }
      localStorage.setItem(ACTIVE_USER_KEY, source.id);
    } catch { /* ignore */ }

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
    // Przeszkody pól — zawsze z DB (losowane na serwerze przy rejestracji)
    if (source.plot_obstacles && typeof source.plot_obstacles === "object" && !Array.isArray(source.plot_obstacles)) {
      setPlotObstacles(source.plot_obstacles as Record<string, { type: string; cost: number }>);
    }

    // Migracja: jeśli DB ma stare klucze (np. "carrot"), zapisz do DB nowe ("carrot_good")
    const _rawInv = source.seed_inventory as Record<string, unknown> | null | undefined;
    const _needsMigration = !!_rawInv && Object.keys(_rawInv).some(k => {
      const { quality } = parseQualityKey(k);
      return quality === null && CROPS.some(c => c.id === k);
    });
    const _migratedInv = parseSeedInventory(source.seed_inventory);
    setSeedInventory(_migratedInv);

    // Synchronizacja barn_items / fruit_inventory z bazy (źródło prawdy są RPC sync_*)
    // Bez tego bonusy z Lady NPC (np. rogi byka) nie pojawiają się w stodole/plecaku
    // bo lokalny stan był tylko z localStorage.
    if (source.barn_items && typeof source.barn_items === "object" && !Array.isArray(source.barn_items)) {
      saveBarnItems(source.barn_items as BarnItems);
    }
    if (source.fruit_inventory && typeof source.fruit_inventory === "object" && !Array.isArray(source.fruit_inventory)) {
      saveFruitInventory(source.fruit_inventory as Record<string, number>);
    }

    const _rawHive = source.hive_data as Record<string,unknown> | null | undefined;
    const _hiveSavedStart = typeof _rawHive?.honey_start === "number" ? _rawHive.honey_start : null;
    // FIX: honey_start = NULL dopóki gracz nie kupi pierwszej pszczoły.
    // Pszczoły są warunkiem produkcji — ul bez pszczół nic nie robi.
    const _parsedHive: HiveData = {
      level:           typeof _rawHive?.level === "number" ? Math.max(0,Math.min(5,_rawHive.level)) : 0,
      bees_progress:   typeof _rawHive?.bees_progress === "number" ? _rawHive.bees_progress : 0,
      honey_start:     _hiveSavedStart,
      suit_durability: typeof _rawHive?.suit_durability === "number" ? _rawHive.suit_durability : 0,
      empty_jars:      typeof _rawHive?.empty_jars === "number" ? _rawHive.empty_jars : 0,
      honey_jars:      typeof _rawHive?.honey_jars === "number" ? _rawHive.honey_jars : 0,
    };
    setHiveData(_parsedHive);
    if (_needsMigration && source.id) {
      await supabase.from("profiles").update({ seed_inventory: _migratedInv }).eq("id", source.id);
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
      setAvatarChangeCount(d.changeCount);
      setLastAvatarChangeAt(d.lastChangeAt);
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
      saveAvatarDataLS(source.id, skin, stats, fsp, prevLevel, d.changeCount, d.lastChangeAt);
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

    // Załaduj dane z localStorage per-userId (izolacja kont — każde konto ma swoje klucze)
    const uid = source.id;
    setCharEquipped(lsLoadMigrate(CHAR_EQUIP_KEY, uid, s => migrateCharEquipped(JSON.parse(s)), () => ({ ...DEFAULT_CHAR_EQUIPPED })));
    setItemUpgRegistry(lsLoadMigrate(ITEM_UPG_KEY, uid, s => JSON.parse(s) as Record<string,number>, () => ({})));
    setOwnedEqItems(lsLoadMigrate(OWNED_EQ_KEY, uid, s => JSON.parse(s) as Record<string,true>, () => ({})));
    setExtraEqItems(lsLoadMigrate(EXTRA_EQ_KEY, uid, s => { const p = JSON.parse(s); return Array.isArray(p) ? p as ExtraEqEntry[] : []; }, () => []));
    setSlotBoxCustom(lsLoadMigrate(SLOT_BOX_KEY, uid, s => JSON.parse(s) as Record<string,{top:number;left:number;width:number;height:number}>, () => ({ ...DEFAULT_SLOT_BOX })));
    // Barn: ładuj z localStorage, nadpisz owned/slots/prodStart z DB (DB autorytarne dla timingów)
    const _lsBarn = lsLoadMigrate(BARN_STATE_KEY, uid, s => { const p = JSON.parse(s); return { ...defaultBarnState(), ...p } as BarnState; }, defaultBarnState);
    const _dbBarn = source.barn_state as Record<string, { owned: number; slots: number; prodStart: number }> | null | undefined;
    // _dbBarnIsSet = true gdy admin ustawił barn_state (nawet na {}); null = nowe konto bez danych
    const _dbBarnIsSet = _dbBarn !== null && _dbBarn !== undefined;
    const _dbBarnHasData = _dbBarnIsSet && Object.values(_dbBarn).some(v => ((v as { owned?: number })?.owned ?? 0) > 0);
    if (_dbBarnHasData) {
      // DB ma zwierzęta — nadpisz localStorage danymi z bazy
      ANIMALS.forEach(a => { const d = (_dbBarn as Record<string,{owned:number;slots:number;prodStart:number}>)[a.id]; if (d) { if (typeof d.owned === "number") _lsBarn[a.id].owned = d.owned; if (typeof d.slots === "number") _lsBarn[a.id].slots = d.slots; if (typeof d.prodStart === "number" && d.prodStart > 0) { _lsBarn[a.id].prodStart = d.prodStart; _lsBarn[a.id].baseProdStart = d.prodStart; } } });
    } else if (_dbBarnIsSet) {
      // DB ma pusty {} (reset admina) — wyzeruj owned w localStorage zamiast re-synchronizować
      ANIMALS.forEach(a => { _lsBarn[a.id] = { ..._lsBarn[a.id], owned: 0, prodStart: 0, baseProdStart: 0, storage: 0 }; });
    } else if (uid) {
      // DB null = nowe konto bez barn_state — synchronizuj ze stanu lokalnego
      ANIMALS.forEach(a => { const st = _lsBarn[a.id]; if (st && st.owned > 0) void supabase.rpc("sync_barn_owned", { p_user_id: uid, p_animal_id: a.id, p_new_owned: st.owned, p_new_slots: st.slots }); });
    }
    barnStateRef.current = _lsBarn;
    setBarnState_(_lsBarn);
    // Sad: ładuj z localStorage, nadpisz owned/prodStart z DB (DB autorytarne dla timingów)
    const _lsOrch = lsLoadMigrate(ORCHARD_STATE_KEY, uid, s => migrateOrchardState(JSON.parse(s)), defaultOrchardState);
    const _dbOrch = source.orchard_state as Record<string, { owned: number; prodStart: number }> | null | undefined;
    const _dbOrchHasData = !!(_dbOrch && Object.values(_dbOrch).some(v => ((v as { owned?: number })?.owned ?? 0) > 0));
    if (_dbOrchHasData) {
      TREES.forEach(t => { const d = (_dbOrch as Record<string,{owned:number;prodStart:number}>)[t.id]; if (d) { if (typeof d.owned === "number") _lsOrch[t.id].owned = d.owned; if (typeof d.prodStart === "number" && d.prodStart > 0) _lsOrch[t.id].prodStart = d.prodStart; } });
    } else if (uid) {
      TREES.forEach(t => { const st = _lsOrch[t.id]; if (st && st.owned > 0) void supabase.rpc("sync_orchard_owned", { p_user_id: uid, p_tree_id: t.id, p_new_owned: st.owned }); });
    }
    setOrchardState_(_lsOrch);
    setDailyProgress(loadDP(uid));
    // Kompost: ładuj pojedynczą partię (nowy format) lub migruj stary format tablicowy
    const loadedBatch = lsLoadMigrate(KOMPOST_BATCHES_KEY, uid, s => {
      const parsed = JSON.parse(s);
      // Nowy format: pojedynczy obiekt { fill, scoreSum, cropIds }
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object" && "fill" in parsed) {
        const b = parsed as {fill?:unknown;scoreSum?:unknown;cropIds?:unknown};
        return {
          fill: Math.max(0, Math.min(KOMPOST_BATCH_SIZE, Math.floor(Number(b.fill) || 0))),
          scoreSum: Math.max(0, Number(b.scoreSum) || 0),
          cropIds: Array.isArray(b.cropIds) ? (b.cropIds as unknown[]).filter((x): x is string => typeof x === "string") : [],
        } as CompostBatch;
      }
      // Stary format: tablica partii → sumujemy do jednej dużej partii
      if (Array.isArray(parsed)) {
        const arr = parsed as Array<{fill?:unknown;scoreSum?:unknown;cropIds?:unknown}>;
        const totalFill = arr.reduce((s, b) => s + Math.max(0, Math.min(10, Math.floor(Number(b?.fill) || 0))), 0);
        const totalScore = arr.reduce((s, b) => s + Math.max(0, Number(b?.scoreSum) || 0), 0);
        const allCropIds = Array.from(new Set(arr.flatMap(b => Array.isArray(b?.cropIds) ? (b.cropIds as unknown[]).filter((x): x is string => typeof x === "string") : [])));
        return { fill: Math.min(KOMPOST_BATCH_SIZE, totalFill), scoreSum: totalScore, cropIds: allCropIds } as CompostBatch;
      }
      return { fill: 0, scoreSum: 0, cropIds: [] } as CompostBatch;
    }, () => ({ fill: 0, scoreSum: 0, cropIds: [] } as CompostBatch));
    // Migracja legacy flat counter
    try {
      const legacyKey = lsKey(KOMPOST_KEY, uid);
      const sOld = localStorage.getItem(legacyKey) ?? (uid ? localStorage.getItem(KOMPOST_KEY) : null);
      if (sOld) {
        const pending = Math.max(0, Math.floor(Number(sOld) || 0));
        if (pending > 0) loadedBatch.fill = Math.min(KOMPOST_BATCH_SIZE, loadedBatch.fill + pending);
        localStorage.removeItem(legacyKey); localStorage.removeItem(KOMPOST_KEY);
      }
    } catch {}
    setKompostBatch(loadedBatch);

    return nextProfile;
  }

  function extractRpcProfile(data: unknown) {
    return Array.isArray(data) ? data[0] : data;
  }

  const displayLocation = profile?.location ?? DEFAULT_LOCATION;
  // Symulacja client-side poziomowania dla wyświetlania.
  // Potrzebna gdy profile.xp > getXpForLevel(level) — np. po zmianie tabeli XP między zbiorami.
  // SQL zaktualizuje DB przy następnym zbiorze; client pokazuje stan "jak po aktualizacji".
  {
    // blok tylko dla type-narrowing — wartości trafiają do zmiennych zewnętrznych poniżej
  }
  const _rawLevel = profile?.level ?? DEFAULT_LEVEL;
  const _rawXp    = profile?.xp    ?? DEFAULT_XP;
  let _simLevel   = _rawLevel;
  let _simXp      = _rawXp;
  let _simToNext  = _simLevel > 0 ? getXpForLevel(_simLevel) : DEFAULT_XP_TO_NEXT_LEVEL;
  while (_simLevel < MAX_LEVEL && _simToNext > 0 && _simXp >= _simToNext) {
    _simXp    -= _simToNext;
    _simLevel += 1;
    _simToNext = getXpForLevel(_simLevel);
  }
  const displayLevel       = _simLevel;
  const displayXp          = _simXp;
  const displayXpToNextLevel = _simLevel >= MAX_LEVEL ? 0 : _simToNext;
  const displayMoney = profile?.money ?? DEFAULT_MONEY;
  const currentMap = profile?.current_map ?? getMapForLevel(profile?.level);
  const isOnFarmMap = !!profile && currentMap.startsWith("farm");
  const isOnCityMap = !!profile && currentMap === "city";
  const isOnPanMap = isOnFarmMap || isOnCityMap;
  const backgroundMap = getDisplayBackgroundMap(currentMap);
  // Per-mapowe pozycje hitboxów i etykiet — klucz to backgroundMap
  const FARM_HITBOX_OVERRIDES: Record<string, Record<string,{left:number,top:number,width:number,height:number}>> = {
    farm5: {
      dom:         {left:21.2, top:11.5, width:13.7, height:30.0},
      stodola:     {left:46.9, top:49.5, width:18.8, height:27.0},
      doMiasta:    {left:69.2, top:0.0,  width:15.4, height:17.3},
      polaUprawne: {left:43.0, top:8.5,  width:24.3, height:32.8},
      ul:          {left:72.1, top:67.9, width:15.8, height:22.4},
      lada:        {left:19.0, top:48.1, width:9.8,  height:19.8},
      kompostownik:{left:74.6, top:17.7, width:9.6,  height:19.7},
      sad:         {left:27.0, top:68.7, width:14.7, height:28.6},
    },
    farm10: {
      dom:         {left:18.4, top:11.5, width:13.7, height:30.0},
      stodola:     {left:47.0, top:57.5, width:18.8, height:27.0},
      doMiasta:    {left:63.3, top:0.1,  width:12.6, height:13.4},
      polaUprawne: {left:42.6, top:13.6, width:20.0, height:30.9},
      ul:          {left:73.7, top:69.6, width:12.6, height:25.2},
      lada:        {left:14.5, top:48.7, width:12.5, height:20.5},
      kompostownik:{left:70.8, top:17.2, width:9.7,  height:19.8},
      sad:         {left:16.1, top:76.8, width:18.7, height:19.0},
    },
    farm15: {
      dom:         {left:17.0, top:10.0, width:13.7, height:30.0},
      stodola:     {left:45.2, top:55.8, width:18.8, height:27.0},
      doMiasta:    {left:64.7, top:0.0,  width:12.6, height:13.4},
      polaUprawne: {left:41.9, top:11.7, width:22.2, height:31.0},
      ul:          {left:74.1, top:69.6, width:12.6, height:25.2},
      lada:        {left:13.8, top:47.0, width:12.5, height:20.5},
      kompostownik:{left:73.5, top:18.1, width:11.0, height:28.5},
      sad:         {left:11.9, top:74.0, width:20.8, height:21.2},
    },
    farm20: {
      dom:         {left:22.4, top:9.6,  width:13.7, height:30.0},
      stodola:     {left:42.3, top:57.4, width:19.6, height:29.1},
      doMiasta:    {left:64.5, top:0.0,  width:12.6, height:13.4},
      polaUprawne: {left:45.1, top:13.7, width:22.2, height:31.0},
      ul:          {left:74.0, top:67.3, width:12.6, height:25.2},
      lada:        {left:17.7, top:46.2, width:12.5, height:20.5},
      kompostownik:{left:73.5, top:18.1, width:11.0, height:20.5},
      sad:         {left:10.7, top:73.0, width:20.8, height:21.2},
    },
    farm25: {
      dom:         {left:14.3, top:17.0, width:17.3, height:26.1},
      stodola:     {left:43.0, top:58.0, width:19.6, height:29.1},
      doMiasta:    {left:65.4, top:0.0,  width:12.6, height:13.4},
      polaUprawne: {left:41.1, top:13.8, width:25.7, height:30.6},
      ul:          {left:75.8, top:66.7, width:12.6, height:25.2},
      lada:        {left:13.3, top:54.1, width:12.5, height:20.5},
      kompostownik:{left:73.2, top:23.7, width:11.0, height:20.5},
      sad:         {left:11.5, top:78.2, width:20.8, height:21.2},
    },
    farm30: {
      dom:         {left:14.2, top:17.2, width:18.2, height:26.1},
      stodola:     {left:41.9, top:55.8, width:20.2, height:29.8},
      doMiasta:    {left:65.4, top:0.0,  width:13.3, height:13.9},
      polaUprawne: {left:38.9, top:16.0, width:28.2, height:28.0},
      ul:          {left:75.0, top:64.7, width:14.4, height:25.8},
      lada:        {left:13.6, top:54.2, width:15.5, height:20.0},
      kompostownik:{left:73.1, top:20.7, width:13.3, height:23.4},
      sad:         {left:11.5, top:78.1, width:20.8, height:21.2},
    },
  };
  const FARM_LABEL_OVERRIDES: Record<string, Record<string,{left:number,top:number}>> = {
    farm5: {
      dom:         {left:28.7, top:25.3},
      stodola:     {left:57.2, top:62.7},
      doMiasta:    {left:77.4, top:11.3},
      polaUprawne: {left:55.1, top:22.6},
      ul:          {left:79.8, top:81.6},
      lada:        {left:23.6, top:57.9},
      kompostownik:{left:78.7, top:27.5},
      sad:         {left:33.8, top:80.5},
    },
    farm10: {
      dom:         {left:26.0, top:24.0},
      stodola:     {left:57.2, top:62.7},
      doMiasta:    {left:69.2, top:10.3},
      polaUprawne: {left:52.1, top:26.3},
      ul:          {left:79.8, top:84.8},
      lada:        {left:21.0, top:52.9},
      kompostownik:{left:74.9, top:26.7},
      sad:         {left:26.9, top:83.8},
    },
    farm15: {
      dom:         {left:26.0, top:24.0},
      stodola:     {left:55.2, top:63.6},
      doMiasta:    {left:70.2, top:10.3},
      polaUprawne: {left:53.9, top:27.2},
      ul:          {left:80.2, top:85.2},
      lada:        {left:20.2, top:61.5},
      kompostownik:{left:78.3, top:27.9},
      sad:         {left:22.3, top:84.1},
    },
    farm20: {
      dom:         {left:26.0, top:24.0},
      stodola:     {left:51.6, top:65.9},
      doMiasta:    {left:70.2, top:10.3},
      polaUprawne: {left:53.9, top:27.2},
      ul:          {left:80.2, top:85.2},
      lada:        {left:20.2, top:61.5},
      kompostownik:{left:78.3, top:27.9},
      sad:         {left:22.3, top:84.1},
    },
    farm25: {
      dom:         {left:25.1, top:26.9},
      stodola:     {left:51.6, top:65.9},
      doMiasta:    {left:71.2, top:10.4},
      polaUprawne: {left:52.3, top:27.0},
      ul:          {left:81.2, top:75.3},
      lada:        {left:19.6, top:59.1},
      kompostownik:{left:78.4, top:33.0},
      sad:         {left:20.0, top:87.8},
    },
    farm30: {
      dom:         {left:25.1, top:26.9},
      stodola:     {left:51.6, top:65.9},
      doMiasta:    {left:71.2, top:10.4},
      polaUprawne: {left:52.3, top:27.0},
      ul:          {left:81.2, top:75.3},
      lada:        {left:21.5, top:58.6},
      kompostownik:{left:78.4, top:33.0},
      sad:         {left:20.0, top:87.8},
    },
  };
  const activeHitboxPos = FARM_HITBOX_OVERRIDES[backgroundMap] ?? navHitboxPos;
  const activeLabelPos  = FARM_LABEL_OVERRIDES[backgroundMap]  ?? navLabelPos;
  React.useEffect(() => {
    if ((currentMap === "city_townhall" || currentMap === "city_liga") && rankingData.length === 0 && !rankingLoading) {
      void loadRanking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMap]);

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

    let row = Math.floor((current - 1) / 10);
    let col = (current - 1) % 10;

    if (direction === "up" && row > 0) row -= 1;
    if (direction === "down" && row < 9) row += 1;
    if (direction === "left" && col > 0) col -= 1;
    if (direction === "right" && col < 9) col += 1;

    const nextPlotId = row * 10 + col + 1;
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
    const wiedzaEffective = effectiveStats.wiedza + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
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
      const zaradnoscBonus = calcStatEffect(effectiveStats.zaradnosc, ZARADNOSC_RATE) / 100;
      // Bonus z eq: % efekt podlewania + % efekt wody (addytywny, nie mnożnik)
      const waterEqPct = (getEquipBonusPct("% efekt podlewania", charEquipped) + getEquipBonusPct("% efekt wody", charEquipped)) / 100;
      const totalWaterReduction = WATER_BASE + zaradnoscBonus + waterEqPct; // addytywny, bez capa
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
      "carrot": "/uprawy/carrot",
      "test_nasiono": "/uprawy/carrot",
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

    await applyProfileState(extractRpcProfile(data));

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

    const _zaradBonus = calcStatEffect(effectiveStats.zaradnosc, ZARADNOSC_RATE) / 100;
    const _waterEqPct = (getEquipBonusPct("% efekt podlewania", charEquipped) + getEquipBonusPct("% efekt wody", charEquipped)) / 100;
    const _zaradPct = (WATER_BASE + _zaradBonus + _waterEqPct) * 100;
    setMessage({
      type: "success",
      title: "Podlano pole 💧",
      text: _zaradPct > 0
        ? `${crop.name} urośnie o ${_zaradPct.toFixed(1)}% szybciej (min 5% + Zaradność ${effectiveStats.zaradnosc}/100 + ekwipunek).`
        : `${crop.name} podlana. Rozwijaj Zaradnosc, aby przyspieszac wzrost.`,
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

    const amount = seedInventoryRef.current[effectiveSeedId] ?? 0;
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

    // Optymistyczne odliczenie nasiona — natychmiast, zanim timer ruszy.
    // Blokuje race condition gdy gracz szybko klika różne pola.
    setSeedInventory(prev => ({ ...prev, [effectiveSeedId]: (prev[effectiveSeedId] ?? 0) - 1 }));
    seedInventoryRef.current = { ...seedInventoryRef.current, [effectiveSeedId]: (seedInventoryRef.current[effectiveSeedId] ?? 0) - 1 };

    // Gdy skończyły się nasiona — odznacz automatycznie
    if ((seedInventoryRef.current[effectiveSeedId] ?? 0) <= 0 && selectedSeedId === effectiveSeedId) {
      setSelectedSeedId(null);
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

  // Akcja na polu podczas przeciągania — cicha wersja bez komunikatów błędów
  function tryApplyFieldAction(plotId: number) {
    if (!isDraggingPlantRef.current) return;
    if (dragPlantedFieldsRef.current.has(plotId)) return;
    if (!isPlotUnlocked(plotId)) return;
    if (pendingFieldActions[plotId]) return;
    const plot = getPlotCrop(plotId);

    // Konewka
    if (selectedTool === "watering_can") {
      if (!plot.cropId || plot.watered || isCropReady(plotId)) return;
      dragPlantedFieldsRef.current.add(plotId);
      void handleWaterPlot(plotId);
      return;
    }
    // Sierp
    if (selectedTool === "sickle") {
      if (!plot.cropId || !isCropReady(plotId)) return;
      dragPlantedFieldsRef.current.add(plotId);
      void handleHarvestPlot(plotId);
      return;
    }
    // Kompost
    if (selectedSeedId && isCompostKey(selectedSeedId)) {
      if (plot.cropId || plot.compostBonus) return;
      if ((seedInventoryRef.current[selectedSeedId] ?? 0) <= 0) { isDraggingPlantRef.current = false; return; }
      dragPlantedFieldsRef.current.add(plotId);
      void applyCompostToPlot(plotId, selectedSeedId);
      return;
    }
    // Nasiono
    if (selectedSeedId) {
      if (plot.cropId) return;
      if ((seedInventoryRef.current[selectedSeedId] ?? 0) <= 0) { isDraggingPlantRef.current = false; return; }
      dragPlantedFieldsRef.current.add(plotId);
      void handlePlantFromSelectedSeed(plotId);
      return;
    }
    // Brak narzędzia/nasiona — zbierz gotowy plon
    if (plot.cropId && isCropReady(plotId)) {
      dragPlantedFieldsRef.current.add(plotId);
      void handleHarvestPlot(plotId);
    }
  }

  async function executePlantRpc(plotId: number, effectiveSeedId: string, _baseCropId: string, _seedQuality: string | null) {
    // Sprzątanie pendingActions niezależnie od wyniku — try/finally zawsze odpala
    const _clearPending = () => setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });

    // Przywrócenie optymistycznie odliczonego nasiona przy błędzie
    const _restoreSeed = () => {
      setSeedInventory(prev => ({ ...prev, [effectiveSeedId]: (prev[effectiveSeedId] ?? 0) + 1 }));
      seedInventoryRef.current = { ...seedInventoryRef.current, [effectiveSeedId]: (seedInventoryRef.current[effectiveSeedId] ?? 0) + 1 };
    };

    try {
      if (!profile) { _restoreSeed(); return; }
      const crop = CROPS.find((item) => item.id === _baseCropId);
      if (!crop) { _restoreSeed(); return; }
      // Re-walidacja po upływie timera (gracz mógł w międzyczasie coś zmienić)
      // Używamy refs do FRESH state zamiast captured closures
      const _freshPlot: PlotCropState | undefined = plotCropsRef.current[plotId];
      if (_freshPlot?.cropId) {
        setMessage({ type: "info", title: "Pole zajęte", text: "Pole zostało zajęte zanim akcja się zakończyła." });
        _restoreSeed();
        return;
      }
      const _freshInv = seedInventoryRef.current;
      const _freshAmount = _freshInv[effectiveSeedId] ?? 0;
      if (_freshAmount < 0) {
        setMessage({ type: "info", title: "Brak nasion", text: "W międzyczasie skończyły się nasiona." });
        // Nie przywracamy — nasiono już zostało odliczone, inny plot je "zużył"
        return;
      }

      // Migracja formatu inwentarza (tylko dla starych kluczy bez sufiksu jakości, np. "carrot").
      // Nasiona w nowym formacie (np. "carrot_legendary") pomijają ten update —
      // ślepy zapis równoległy nadpisywałby stan DB po poprzednim atomicznym game_plant_crop.
      const _needsMigration = !effectiveSeedId.includes("_");
      if (_needsMigration && profile.id) {
        const _invForDb = { ..._freshInv, [effectiveSeedId]: (_freshAmount + 1) };
        await supabase
          .from("profiles")
          .update({ seed_inventory: serializeSeedInventory(_invForDb) })
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
        _restoreSeed();
        // Pole nie jest odblokowane w DB — zsynchronizuj lokalny stan z DB
        if (error.message?.includes("nie jest odblokowane") && profile?.id) {
          const { data: freshRow } = await supabase
            .from("profiles")
            .select("unlocked_plots, plot_obstacles")
            .eq("id", profile.id)
            .single();
          if (freshRow) {
            setUnlockedPlots(parseUnlockedPlots(freshRow.unlocked_plots));
            if (freshRow.plot_obstacles && typeof freshRow.plot_obstacles === "object") {
              setPlotObstacles(freshRow.plot_obstacles as Record<string, { type: string; cost: number }>);
            }
          } else {
            // Brak odpowiedzi — usuń pole z lokalnych odblokowanych
            setUnlockedPlots(prev => prev.filter(id => id !== plotId));
          }
          setMessage({
            type: "error",
            title: "Pole nie jest odblokowane",
            text: `Pole #${plotId} nie jest odblokowane w bazie danych. Stan lokalny został zsynchronizowany — kliknij pole, aby je odblokować.`,
          });
          return;
        }
        setMessage({
          type: "error",
          title: "Błąd sadzenia",
          text: error.message,
        });
        return;
      }

      await applyProfileState(extractRpcProfile(data));
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
    // Poziom 1 → 20 pól; każdy poziom +2 pola; max 100
    return Math.min(20 + Math.max(level - 1, 0) * 2, MAX_FIELDS);
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
    if (!isFarmMap || !profile) {
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
  }, [currentMap, musicVolume, musicMuted, profile]);

  // ─── City music (zapamiętuje pozycję przy zmianie mapy) ───
  useEffect(() => {
    const isCityMap = (CITY_MUSIC_MAPS as string[]).indexOf(currentMap) !== -1;
    if (!isCityMap || !profile) {
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
  }, [currentMap, musicVolume, musicMuted, profile]);

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
      const [{ count: rcvCount }, { count: mktCount }] = await Promise.all([
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("to_user_id", profile.id)
          .eq("read", false)
          .eq("type", "received")
          .not("subject", "ilike", "Targ%")
          .not("subject", "ilike", "🏪%"),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("to_user_id", profile.id)
          .eq("read", false)
          .eq("type", "received")
          .or("subject.ilike.Targ%,subject.ilike.🏪%"),
      ]);
      if (typeof rcvCount === "number") setUnreadCount(rcvCount);
      if (typeof mktCount === "number") setUnreadMarketCount(mktCount);
    }, 30000);
    return () => clearInterval(interval);
  }, [profile?.id]);
  // ─── Oznacz jako przeczytane gdy gracz patrzy na zakładkę Otrzymane lub Targ ───
  useEffect(() => {
    if (showMessagePanel && messageTab === "otrzymane") void markAsRead("received");
    if (showMessagePanel && messageTab === "targ")     void markAsRead("market");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMessagePanel, messageTab]);

  // ─── Zapis Mocy farmy do bazy (debounce 1.5s) ───
  useEffect(() => {
    if (!profile?.id) return;
    if (farmPowerTimerRef.current) clearTimeout(farmPowerTimerRef.current);
    farmPowerTimerRef.current = setTimeout(async () => {
      const fp = computeFarmPower(playerStats, charEquipped, hiveData.level, orchardState, barnState);
      await supabase.from("profiles").update({ farm_power: fp }).eq("id", profile.id);
    }, 1500);
    return () => { if (farmPowerTimerRef.current) clearTimeout(farmPowerTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerStats, charEquipped, hiveData.level, orchardState, barnState, profile?.id]);


  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          // Sprawdź czas poprzedniej sesji (hard 2h timeout)
          let storedStart: number | null = null;
          try { storedStart = Number(sessionStorage.getItem("plono_session_start")) || null; } catch { /* ignore */ }
          if (storedStart && Date.now() - storedStart >= SESSION_DURATION_MS) {
            // Sesja przeterminowana — wyloguj bez ładowania profilu
            await supabase.auth.signOut();
            if (mounted) setReady(true);
            return;
          }
          await loadProfile(session.user.id);
          if (mounted) startSessionTimer(storedStart ?? undefined);
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

  // ─── Sync skina do DB raz na sesję (żeby ranking widział avatara) ───
  useEffect(() => {
    if (!profile?.id || avatarSkin < 0 || skinDbSyncedRef.current) return;
    skinDbSyncedRef.current = true;
    supabase.rpc("game_sync_skin", { p_skin: avatarSkin }).then(({ error }) => {
      if (error) console.error("[skin-sync] game_sync_skin error:", error.message, error.code);
      else console.log("[skin-sync] OK, skin =", avatarSkin);
    });
  }, [profile?.id, avatarSkin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { gameScaleRef.current = gameScale; }, [gameScale]);


  function toGameCoords(clientX: number, clientY: number) {
    const s = gameScaleRef.current;
    return {
      x: BASE_W / 2 + (clientX - window.innerWidth / 2) / s,
      y: BASE_H / 2 + (clientY - window.innerHeight / 2) / s,
    };
  }

  useEffect(() => {
    const checkScreen = () => {
      const isSmall = window.innerWidth < 1024;
      setIsDesktop(!isSmall);
      const s = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
      setGameScale(s);
      gameScaleRef.current = s;
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);

    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // ─── Licznik czasu sesji (aktualizacja co sekundę) ────────────────────
  useEffect(() => {
    const tick = () => {
      let stored: number | null = null;
      try { stored = Number(sessionStorage.getItem("plono_session_start")) || null; } catch { /* ignore */ }
      if (!stored) { setSessionTimeLeft(null); return; }
      const remaining = Math.max(0, SESSION_DURATION_MS - (Date.now() - stored));
      setSessionTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
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

      if (plotToBuy !== null) {
        if (key === "enter" || key === " ") void confirmBuyPlot();
        if (key === "escape") setPlotToBuy(null);
        return;
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
  }, [isFieldViewOpen, selectedPlotId, unlockedPlots, displayLevel, plotCrops, selectedTool, selectedSeedId, plotToBuy]);

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
    if (!showLadaModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Najpierw zamknij info-panel jeśli otwarty, w przeciwnym razie zamknij cały modal
      if (showLadaInfo) setShowLadaInfo(false);
      else setShowLadaModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showLadaModal, showLadaInfo]);
  React.useEffect(() => {
    if (!customerLootDrop) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter") { setCustomerLootDrop(null); setLootHoverIdx(null); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [customerLootDrop]);
  React.useEffect(() => {
    if (!showShopModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowShopModal(false); setShopCart({}); setShopError(""); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showShopModal]);
  React.useEffect(() => {
    const iv = setInterval(() => setPromoCountdown(formatShopCountdown(getMsToPolandMidnight())), 1000);
    return () => clearInterval(iv);
  }, []);
  React.useEffect(() => {
    if (!showUlModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowUlModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showUlModal]);
  React.useEffect(() => {
    if (currentMap !== "city_townhall") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showRankingPanel) { setShowRankingPanel(false); return; }
      handleChangeMap("city");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentMap, showRankingPanel]);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHoveredSickle(false);
        setHoveredWateringCan(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
      const _gc = toGameCoords(event.clientX, event.clientY);
      const nextX = Math.max(-8, Math.min(BASE_W - panelWidth - 16, _gc.x - dragOffset.x));
      const nextY = Math.max(-8, Math.min(BASE_H - panelHeight - 16, _gc.y - dragOffset.y));
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

  // ─── LADA NPC: helpery + handlery ────────────────────────────────────
  // Scala duplikaty w items zamówienia (np. 10× marchew_good + 29× marchew_good → 39× marchew_good)
  function mergeOrderItems<T extends { id: string; qty: number; value: number | string }>(items: T[]): T[] {
    const map = new Map<string, T>();
    for (const it of items) {
      const ex = map.get(it.id);
      if (ex) {
        ex.qty = (ex.qty || 0) + (it.qty || 0);
        ex.value = Number(ex.value || 0) + Number(it.value || 0);
      } else {
        map.set(it.id, { ...it, qty: it.qty || 0, value: Number(it.value || 0) } as T);
      }
    }
    return Array.from(map.values());
  }

  function getOrderItemDisplay(id: string): { name: string; icon: string; spritePath?: string } {
    if (id === 'honey_jar') return { name: 'Słoik miodu', icon: '🍯' };
    const ai = ANIMAL_ITEMS.find(a => a.id === id);
    if (ai) return { name: ai.name, icon: ai.icon };
    const cropM = id.match(/^(.+)_(good|epic|legendary)$/);
    if (cropM) {
      const crop = CROPS.find(c => c.id === cropM[1]);
      const qLabel = cropM[2] === 'good' ? ' (zwykła)' : cropM[2] === 'epic' ? ' (epicka)' : ' (legendarna)';
      if (crop) {
        const sprite = cropM[2] === 'legendary' ? (crop.legendarySpritePath ?? crop.epicSpritePath ?? crop.spritePath)
                     : cropM[2] === 'epic'      ? (crop.epicSpritePath ?? crop.spritePath)
                     : crop.spritePath;
        return { name: crop.name + qLabel, icon: '🌱', spritePath: sprite };
      }
    }
    const fruitM = id.match(/^(.+)_(zwykly|soczysty|zloty|zgnile)$/);
    if (fruitM) {
      const tree = TREES.find(t => t.fruitId === fruitM[1]);
      const qd = FRUIT_QUALITY_DEFS[fruitM[2] as FruitQuality];
      if (tree) return { name: `${tree.fruitName}${qd?.label ? ' ' + qd.label : ''}`, icon: tree.fruitIcon };
    }
    if (isCompostKey(id)) {
      const t = compostTypeFromKey(id);
      const v = compostValueFromKey(id);
      if (t) {
        const def = COMPOST_DEFS[t];
        return { name: `${def.tierName(v)} ${def.name}`, icon: def.icon };
      }
    }
    const eq = CHAR_EQUIP_ITEMS.find(i => i.id === id);
    if (eq) return { name: eq.name, icon: eq.icon };
    if (id.startsWith('eq_tier_')) {
      const tier = Number(id.split('_').pop()) || 0;
      const minL = tier * 5 + 1, maxL = tier * 5 + 5;
      return { name: `Tajemniczy przedmiot (lvl ${minL}-${maxL})`, icon: '🎁' };
    }
    return { name: id, icon: '📦' };
  }

  function getCustomerDisplay(type: string): { name: string; icon: string } {
    if (type === 'neighbor')              return { name: 'Sąsiad',                  icon: '🧑‍🌾' };
    if (type === 'village_guest')         return { name: 'Gość ze wsi',             icon: '🧓' };
    if (type === 'small_market')          return { name: 'Mały targ',               icon: '🏪' };
    if (type === 'village_shop')          return { name: 'Sklep wiejski',           icon: '🏬' };
    if (type === 'restaurant')            return { name: 'Restauracja',             icon: '🍽️' };
    if (type === 'wholesaler')            return { name: 'Hurtownia',               icon: '🏢' };
    if (type === 'market_chain')          return { name: 'Sieć handlowa',           icon: '🏛️' };
    if (type === 'distribution_center')   return { name: 'Centrum dystrybucji',     icon: '🏗️' };
    if (type === 'international_contract')return { name: 'Kontrakt międzynarodowy', icon: '🌍' };
    return { name: type, icon: '👤' };
  }

  async function refreshCustomerOrders(opts?: { tick?: boolean }) {
    if (!profile?.id) return;
    setCustomerLoading(true);
    try {
      if (opts?.tick) {
        const { data: tickData } = await supabase.rpc("tick_customer_orders", { p_user_id: profile.id });
        if (tickData?.next_spawn_at) {
          setNextSpawnAt(new Date(tickData.next_spawn_at).getTime());
        }
      }
      const { data, error } = await supabase
        .from("customer_orders")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: true });
      if (!error && data) {
        setCustomerOrders(data as CustomerOrder[]);
        setCurrentCustomerIdx(idx => (data.length === 0 ? 0 : idx >= data.length ? 0 : idx));
      }
    } finally {
      setCustomerLoading(false);
    }
  }

  async function completeCustomerOrder(orderId: string) {
    if (!profile?.id || customerSelling) return;
    setCustomerSelling(orderId);
    const { data, error } = await supabase.rpc("complete_customer_order", {
      p_user_id: profile.id,
      p_order_id: orderId,
    });
    setCustomerSelling(null);
    if (error || !data?.ok) {
      const rawMsg = error?.message ?? data?.reason ?? "";
      let polishMsg = "Brak wymaganych przedmiotów lub zamówienie wygasło.";
      // insufficient: <item_id> (have X, need Y)
      const mIns = rawMsg.match(/insufficient:\s*([a-z0-9_]+)\s*\(have\s*(\d+),\s*need\s*(\d+)\)/i);
      if (mIns) {
        const d = getOrderItemDisplay(mIns[1]);
        polishMsg = `Brakuje: ${d.icon} ${d.name} — masz ${mIns[2]}, potrzebujesz ${mIns[3]}.`;
      } else if (/expired|wyga/i.test(rawMsg)) {
        polishMsg = "Zamówienie wygasło — klient już odszedł.";
      } else if (/not[\s_-]*found|nie\s*znalezion|no\s*such/i.test(rawMsg)) {
        polishMsg = "Zamówienie nie istnieje (mogło już zostać zrealizowane lub usunięte).";
      } else if (/already.*(complet|fulfill)|już.*(zrealiz|wykonan)/i.test(rawMsg)) {
        polishMsg = "To zamówienie zostało już zrealizowane.";
      } else if (rawMsg) {
        polishMsg = rawMsg;
      }
      setMessage({
        type: "error",
        title: "Nie udało się zrealizować zamówienia",
        text: polishMsg,
      });
      void refreshCustomerOrders();
      return;
    }
    // Obsługa bonusów typu eq_item: SQL zwraca {type:'eq_item', tier:N, qty:1} bez id.
    // Frontend losuje konkretny przedmiot z CHAR_EQUIP_ITEMS po tier+playerLvl,
    // dodaje do owned/extra (tak samo jak w kompostowniku) i podmienia bonus.id.
    const bonusList: CustomerOrderBonus[] = Array.isArray(data.bonus) ? [...data.bonus] : [];
    const eqBonuses = bonusList.filter(b => b.type === 'eq_item');
    if (eqBonuses.length > 0) {
      const playerLvl = profile.level ?? 1;
      let owned = { ...ownedEqItems };
      let extras = [...extraEqItems];
      for (const b of eqBonuses) {
        const tier = Math.max(0, Math.min(4, b.tier ?? 0));
        let pool: typeof CHAR_EQUIP_ITEMS = [];
        for (let t = tier; t >= 0; t--) {
          const minLvl = t * 5 + 1, maxLvl = t * 5 + 5;
          pool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= minLvl && it.unlockLevel <= maxLvl && it.unlockLevel <= playerLvl);
          if (pool.length > 0) break;
        }
        if (pool.length === 0) {
          b.id = `eq_tier_${tier}`; // brak puli — pokaż placeholder w toaście
          continue;
        }
        const item = pool[Math.floor(Math.random() * pool.length)];
        if (!owned[item.id]) {
          owned = { ...owned, [item.id]: true as const };
        } else {
          extras = [...extras, { uid: makeExtraUid(), id: item.id, upg: 0 }];
        }
        b.id = item.id;
      }
      saveOwnedEqItems(owned);
      saveExtraEqItems(extras);
    }
    if ((data.exp ?? 0) > 0) {
      await handleAddExp(data.exp);
    } else {
      await loadProfile(profile.id);
    }
    // ─── Historia postępu: klient ───
    if (profile?.id) {
      const _dp = loadDP(profile.id);
      _dp.customers += 1;
      _dp.expGained += Number(data.exp) || 0;
      _dp.moneyGained += Number(data.gold) || 0;
      saveDP(profile.id, _dp);
      setDailyProgress({ ..._dp });
    }
    // Jeśli klient dał dodatkowy bonus → pokaż średni modal z dropem (z tooltipami)
    if (bonusList.length > 0) {
      const order = customerOrders.find(o => o.id === orderId);
      const cd = order ? getCustomerDisplay(order.customer_type) : { name: 'Klient', icon: '👤' };
      setCustomerLootDrop({
        gold: Number(data.gold) || 0,
        exp: Number(data.exp) || 0,
        bonus: bonusList,
        customerName: cd.name,
        customerIcon: cd.icon,
      });
    } else {
      setMessage({
        type: "success",
        title: `🤝 Sprzedano! +${Number(data.gold).toFixed(0)} zł, +${data.exp} EXP`,
        text: "",
      });
    }
    void refreshCustomerOrders();
  }

  React.useEffect(() => {
    if (!showLadaModal || !profile?.id) return;
    void refreshCustomerOrders({ tick: true });
    const tickT = setInterval(() => void refreshCustomerOrders({ tick: true }), 5 * 60 * 1000);
    const nowT = setInterval(() => setCustomerNow(Date.now()), 1000);
    return () => { clearInterval(tickT); clearInterval(nowT); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLadaModal, profile?.id]);

  // Auto-tick natychmiast po zerowaniu countdownu spawnu (z throttle 3s)
  React.useEffect(() => {
    if (!showLadaModal || !profile?.id || nextSpawnAt === null || customerLoading) return;
    if (customerNow < nextSpawnAt) return;
    if (Date.now() - lastAutoTickAtRef.current < 3000) return;
    lastAutoTickAtRef.current = Date.now();
    void refreshCustomerOrders({ tick: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerNow, nextSpawnAt, showLadaModal, profile?.id, customerLoading]);

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
      options: { data: { login } },
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

    // Nadpisz login w profilu — trigger tworzy go z emailem, tu ustawiamy właściwy login gracza
    const { error: loginUpdateError } = await supabase
      .from("profiles")
      .update({ login })
      .eq("id", userId);

    if (loginUpdateError) {
      setMessage({
        type: "error",
        title: "Błąd ustawiania loginu",
        text: loginUpdateError.message,
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

    if (!identifier.includes("@")) {
      setMessage({
        type: "error",
        title: "Wymagany adres email",
        text: "Zaloguj się adresem email. Logowanie loginem zostało wyłączone ze względów bezpieczeństwa.",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
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

    startSessionTimer();
    setLoginForm({ identifier: "", password: "" });
    setMessage({
      type: "success",
      title: "Witaj ponownie",
      text: "Sesja gracza została wczytana.",
    });
  }

  function startSessionTimer(startedAt?: number) {
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    const now = Date.now();
    const loginAt = startedAt ?? now;
    try { sessionStorage.setItem("plono_session_start", String(loginAt)); } catch { /* ignore */ }
    const remaining = SESSION_DURATION_MS - (now - loginAt);
    if (remaining <= 0) { void autoLogout(); return; }
    sessionTimeoutRef.current = setTimeout(() => { void autoLogout(); }, remaining);
  }

  function clearSessionTimer() {
    if (sessionTimeoutRef.current) { clearTimeout(sessionTimeoutRef.current); sessionTimeoutRef.current = null; }
    try { sessionStorage.removeItem("plono_session_start"); } catch { /* ignore */ }
  }

  async function autoLogout() {
    clearSessionTimer();
    await supabase.auth.signOut();
    resetLocalGameState();
    setMessage({
      type: "info",
      title: "Sesja wygasła",
      text: "Twoja 2-godzinna sesja dobiegła końca. Zaloguj się ponownie.",
    });
  }

  async function handleLogout() {
    clearSessionTimer();
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
    // Zawsze używamy nowego formatu z sufiksem jakości — zapobiega rozbieżności client/DB
    const goodKeys: string[] = CROPS.filter(c => c.id !== "test_nasiono").map(c => `${c.id}_good`);
    const qualityKeys: string[] = CROPS.filter(c => c.id !== "test_nasiono" && c.epicSpritePath).flatMap(c => [`${c.id}_epic`, `${c.id}_rotten`, `${c.id}_legendary`]);
    const allKeys = [...goodKeys, ...qualityKeys];
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

  async function handleAddBarnItems(amount: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("test_add_barn_items", { p_user_id: profile.id, p_amount: amount });
    if (!error && data) {
      await loadProfile(profile.id);
      setMessage({ type: "success", title: "Dodano produkty!", text: `+${amount} × ${ANIMAL_ITEMS.length} rodzajów produktów ze zwierząt.` });
    } else {
      setMessage({ type: "error", title: "Błąd", text: error?.message ?? "Nieznany błąd — sprawdź czy uruchomiono sql_test_add_barn_items.sql w Supabase SQL Editor." });
    }
  }

  async function handleAddFruits(amount: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("test_add_fruits", { p_user_id: profile.id, p_amount: amount });
    if (!error && data) {
      await loadProfile(profile.id);
      setMessage({ type: "success", title: "Dodano owoce!", text: `+${amount} × ${TREES.length} gatunków × 4 jakości (zwykły/soczysty/złoty/zgniłe).` });
    } else {
      setMessage({ type: "error", title: "Błąd", text: error?.message ?? "Nieznany błąd — sprawdź czy uruchomiono test_add_fruits w Supabase SQL Editor." });
    }
  }

  async function handleAvatarSelect(idx: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("game_change_avatar_skin", { p_avatar_skin: idx });
    if (error) { setMessage({ type: "error", title: "Błąd zmiany avatara", text: error.message }); return; }
    const response = data as {
      ok?: boolean;
      error?: string;
      remaining_ms?: number;
      spent?: number;
      avatar_skin?: number;
      avatar_change_count?: number;
      last_avatar_change_at?: number;
    } | null;
    if (response?.ok === false) {
      if (typeof response.remaining_ms === "number") {
        const totalMins = Math.ceil(response.remaining_ms / 60000);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const timeStr = hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;
        setMessage({ type: "error", title: "Cooldown aktywny", text: `Następna zmiana avatara dostępna za ${timeStr}.` });
      } else {
        setMessage({ type: "error", title: "Błąd zmiany avatara", text: response.error ?? "Nieznany błąd." });
      }
      return;
    }
    const newSkin = response?.avatar_skin ?? idx;
    const newChangeCount = typeof response?.avatar_change_count === "number"
      ? response.avatar_change_count
      : avatarChangeCount;
    const newLastChangeAt = typeof response?.last_avatar_change_at === "number"
      ? response.last_avatar_change_at
      : lastAvatarChangeAt;
    setAvatarSkin(newSkin);
    setAvatarChangeCount(newChangeCount);
    setLastAvatarChangeAt(newLastChangeAt);
    saveAvatarDataLS(
      profile.id,
      newSkin,
      playerStats,
      freeSkillPoints,
      prevLevelRef.current,
      newChangeCount,
      newLastChangeAt,
    );
    await loadProfile(profile.id);
    setShowSkinModal(false);
  }

  async function handleAddHoneyJars(amount: number) {
    if (!profile?.id) return;
    const newHive: HiveData = { ...hiveData, honey_jars: hiveData.honey_jars + amount };
    const { error } = await supabase.from("profiles").update({ hive_data: newHive }).eq("id", profile.id);
    if (!error) {
      setHiveData(newHive);
      await loadProfile(profile.id);
      setMessage({ type: "success", title: "🍯 Dodano słoiki miodu!", text: `+${amount} słoików miodu (razem: ${newHive.honey_jars}).` });
    } else {
      setMessage({ type: "error", title: "Błąd", text: error.message });
    }
  }

  async function handleResetAccount() {
    if (!profile?.id) return;
    if (!confirm(
      "⚠️ RESET KONTA — wszystko wraca do stanu nowego gracza:\n" +
      "• Poziom, XP, pieniądze, mapa\n" +
      "• Uprawy, nasiona, kompost (plecak + kompostownik)\n" +
      "• Stodoła: zwierzęta, sloty, produkty (jajka, mleko, futra…)\n" +
      "• Sad: drzewa i owoce wszystkich jakości\n" +
      "• Ul: poziom, pszczoły, słoiki, miód, strój pszczelarza\n" +
      "• Statystyki, punkty umiejętności, avatar, ekwipunek, epickie skiny\n\n" +
      "Kontynuować?"
    )) return;
    if (!confirm("Ostatnie potwierdzenie — na pewno chcesz zresetować całe konto?")) return;
    const xpNeeded = getXpForLevel(1);
    const freshHive: HiveData = { ...DEFAULT_HIVE_DATA };
    const freshBarnState = defaultBarnState();
    const freshOrchardState = defaultOrchardState();
    const freshUnlockedPlots = Array.from({ length: 20 }, (_, i) => i + 1);
    const { error } = await supabase.from("profiles").update({
      level: 1, xp: 0, xp_to_next_level: xpNeeded, money: 10,
      location: "farm1", current_map: "farm1",
      unlocked_plots: freshUnlockedPlots, plot_crops: {}, seed_inventory: {},
      avatar_skin: -1, player_stats: {}, free_skill_points: 3, prev_level: 1,
      equipment_slots: 1, equipment: [], unlocked_epic_avatars: [],
      hive_data: freshHive,
    }).eq("id", profile.id);
    // barn_items / fruit_inventory mają trigger blokujący direct update — używamy dedykowanych RPC
    // plot_obstacles resetujemy przez dedykowaną RPC (generuje nowe losowe przeszkody)
    await Promise.all([
      supabase.rpc("sync_barn_items", { p_user_id: profile.id, p_items: {} }),
      supabase.rpc("sync_fruit_inventory", { p_user_id: profile.id, p_items: {} }),
      supabase.rpc("game_reset_plot_obstacles", { p_user_id: profile.id }),
    ]);
    if (!error) {
      lastLoadedUserIdRef.current = null;
      setEquipmentSlots(1); setEquipment([]);
      setUnlockedEpicAvatars([]);
      setUnlockedPlots(freshUnlockedPlots);
      setPlotObstacles({});
      setPlayerStats({ ...DEFAULT_STATS }); setFreeSkillPoints(3); setAvatarSkin(-1);
      setAvatarChangeCount(0); setLastAvatarChangeAt(0);
      saveAvatarDataLS(profile.id, -1, { ...DEFAULT_STATS }, 3, 1, 0, 0);
      // Czyszczenie LS ekwipunku — bez tego applyProfileState przywróciłby stary stan z cache
      saveCharEquipped({ ...DEFAULT_CHAR_EQUIPPED });
      saveItemUpg({});
      saveOwnedEqItems({});
      saveExtraEqItems([]);
      // Zwierzęta / sad / ul / kompostownik / produkty — local + state
      setHiveData(freshHive);
      saveBarnItems({});
      saveBarnState(freshBarnState);
      saveOrchardState(freshOrchardState);
      saveFruitInventory({});
      saveKompostBatch({ fill: 0, scoreSum: 0, cropIds: [] });
      try { localStorage.removeItem(KOMPOST_KEY); } catch {}
      await loadProfile(profile.id);
      setMessage({ type: "success", title: "🗑️ Konto zresetowane", text: "Wszystko wróciło do stanu nowego gracza." });
    } else {
      setMessage({ type: "error", title: "Błąd resetu", text: error.message });
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
      // Brak danych przeszkody — sprawdź w DB czy pole jest faktycznie odblokowane
      if (error.message?.includes("Brak danych przeszkody") && profile?.id) {
        const { data: freshRow } = await supabase
          .from("profiles")
          .select("unlocked_plots, plot_obstacles")
          .eq("id", profile.id)
          .single();
        if (freshRow) {
          const freshUnlocked = parseUnlockedPlots(freshRow.unlocked_plots);
          setUnlockedPlots(freshUnlocked);
          if (freshRow.plot_obstacles && typeof freshRow.plot_obstacles === "object") {
            setPlotObstacles(freshRow.plot_obstacles as Record<string, { type: string; cost: number }>);
          }
          setPlotToBuy(null);
          setSelectedPlotId(null);
          if (freshUnlocked.includes(plotId)) {
            setMessage({ type: "info", title: "Stan zsynchronizowany", text: `Pole #${plotId} jest już odblokowane — stan lokalny został naprawiony.` });
          } else {
            setMessage({ type: "error", title: "Nie można odblokować pola", text: `Pole #${plotId} nie ma danych przeszkody w bazie. Skontaktuj się z administratorem lub zresetuj przeszkody w ustawieniach.` });
          }
        } else {
          setMessage({ type: "error", title: "Błąd zakupu pola", text: error.message });
        }
        return;
      }
      setMessage({
        type: "error",
        title: "Błąd zakupu pola",
        text: error.message,
      });
      return;
    }

    await applyProfileState(extractRpcProfile(data));

    setPlotToBuy(null);
    setSelectedPlotId(plotId);

    const _ot = getPlotObstacleType(plotId);
    const _od = _ot ? OBSTACLE_DEFS[_ot] : null;
    setMessage({
      type: "success",
      title: "Pole odblokowane",
      text: `Usunięto ${_od ? `${_od.icon} ${_od.name}` : "przeszkodę"} z pola #${plotId} za ${plotCost} PLN.`,
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
    seedInventoryRef.current = { ...seedInventoryRef.current, [compostKey]: (seedInventoryRef.current[compostKey] ?? 0) - 1 };
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

      const batch: CompostBatch = { fill: kompostBatch.fill, scoreSum: kompostBatch.scoreSum, cropIds: Array.isArray(kompostBatch.cropIds) ? [...kompostBatch.cropIds] : [] };
      const room = KOMPOST_BATCH_SIZE - batch.fill;
      if (room <= 0) return;
      const added = Math.min(Math.min(count, have), room);
      if (added <= 0) return;
      batch.fill += added;
      batch.scoreSum += added * valuePerCrop;
      if (!batch.cropIds) batch.cropIds = [];
      if (baseCropId && !batch.cropIds.includes(baseCropId)) batch.cropIds.push(baseCropId);

      const nextInv = { ...seedInventory };
      nextInv[seedKey] = have - added;
      if (nextInv[seedKey] <= 0) delete nextInv[seedKey];
      setSeedInventory(nextInv);
      saveKompostBatch(batch);
      if (profile?.id) {
        await supabase.from("profiles").update({ seed_inventory: nextInv }).eq("id", profile.id);
      }
    } finally {
      kompostBusyRef.current = false;
    }
  }

  // ─── KOMPOSTOWNIK: wrzuć zgniłe owoce → +1 do bieżącej partii (score: cena owocu × 0.25) ───
  async function depositFruitToCompost(fruitKey: string, count: number = 1) {
    if (kompostBusyRef.current) return;
    kompostBusyRef.current = true;
    try {
      const have = fruitInventory[fruitKey] ?? 0;
      if (have <= 0) return;
      // Parsuj fruitId z klucza np. "jablko_zgnile" → fruitId="jablko"
      const lastU = fruitKey.lastIndexOf("_");
      const fruitId = fruitKey.slice(0, lastU);
      const tree = TREES.find(t => t.fruitId === fruitId);
      // Score = cena owocu × 0.25 (jak "rotten" uprawa — najsłabszy kompost)
      const valuePerFruit = tree ? tree.pricePerFruit * COMPOST_RARITY_MULT.rotten : 1.0;

      const batch: CompostBatch = { fill: kompostBatch.fill, scoreSum: kompostBatch.scoreSum, cropIds: Array.isArray(kompostBatch.cropIds) ? [...kompostBatch.cropIds] : [] };
      const room = KOMPOST_BATCH_SIZE - batch.fill;
      if (room <= 0) return;
      const added = Math.min(Math.min(count, have), room);
      if (added <= 0) return;
      batch.fill += added;
      batch.scoreSum += added * valuePerFruit;
      if (!batch.cropIds) batch.cropIds = [];
      const fruitSpeciesKey = `fruit_${fruitId}`;
      if (!batch.cropIds.includes(fruitSpeciesKey)) batch.cropIds.push(fruitSpeciesKey);

      const nextInv = { ...fruitInventory };
      nextInv[fruitKey] = have - added;
      if (nextInv[fruitKey] <= 0) delete nextInv[fruitKey];
      saveFruitInventory(nextInv);
      saveKompostBatch(batch);
      if (profile?.id) {
        await supabase.rpc("sync_fruit_inventory", { p_user_id: profile.id, p_items: nextInv });
      }
    } finally {
      kompostBusyRef.current = false;
    }
  }

  // ─── KOMPOSTOWNIK: odbierz nagrody — partia (fill=100) = 5 nagród z TIEREM zależnym od score ───
  async function claimKompostReward() {
    if (kompostBusyRef.current) return;
    kompostBusyRef.current = true;
    try {
    const batch = kompostBatch;
    if (batch.fill < KOMPOST_BATCH_SIZE) return;
    const playerLvl = profile?.level ?? 1;
    const rewards: KompostRewardEntry[] = [];
    let inv = { ...seedInventory };
    let owned = { ...ownedEqItems };
    let upgReg = { ...itemUpgRegistry };
    let extras = [...extraEqItems];
    const newHistoryEntries: Array<{label: string; color: string; icon: string; ts?: number; count?: number}> = [];

    const score = batch.scoreSum / KOMPOST_BATCH_SIZE;
    const quality = getCompostQualityFromScore(score);
    // Bonus różnorodności z tej partii
    const diversityCount = (batch.cropIds ?? []).length;
    const diversityItemBonus = Math.min(5, Math.floor(diversityCount / 2));
    const diversityTierBoost = diversityCount >= 6;
    const _luckItemBonus = Math.min(5, (effectiveStats.szczescie ?? 0) * 0.05);
    const itemDropChance = 10 + diversityItemBonus + _luckItemBonus;

    for (let rIdx = 0; rIdx < KOMPOST_REWARDS_PER_BATCH; rIdx++) {
      // Jackpot 0.5% — legendarny item bez względu na jakość partii
      if (Math.random() * 100 < JACKPOT_CHANCE) {
        const jackpotPool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= 21 && it.unlockLevel <= playerLvl);
        const jpFallback = jackpotPool.length > 0 ? jackpotPool : CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel <= playerLvl);
        if (jpFallback.length > 0) {
          const item = jpFallback[Math.floor(Math.random() * jpFallback.length)];
          if (!owned[item.id]) { owned = { ...owned, [item.id]: true as const }; }
          else { extras = [...extras, { uid: makeExtraUid(), id: item.id, upg: 0 }]; }
          rewards.push({ kind:"item", itemId: item.id, itemName: item.name, itemIcon: item.icon });
          newHistoryEntries.push({ label: `JACKPOT! ${item.name}`, color: "#fbbf24", icon: "✨", ts: Date.now(), count: 1 });
          continue;
        }
      }

      const roll = Math.random() * 100;
      if (roll < itemDropChance) {
        let rolledTierIdx = rollFromChances(ITEM_TIER_BY_QUALITY[quality]);
        if (diversityTierBoost && rolledTierIdx < 4 && Math.random() < 0.30) rolledTierIdx += 1;
        const minLvl = rolledTierIdx * 5 + 1;
        const maxLvl = rolledTierIdx * 5 + 5;
        let pool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= minLvl && it.unlockLevel <= maxLvl && it.unlockLevel <= playerLvl);
        if (pool.length === 0) {
          for (let t = rolledTierIdx - 1; t >= 0; t--) {
            pool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= t*5+1 && it.unlockLevel <= t*5+5 && it.unlockLevel <= playerLvl);
            if (pool.length > 0) break;
          }
        }
        if (pool.length > 0) {
          const item = pool[Math.floor(Math.random() * pool.length)];
          const rarityDef = ITEM_TIER_RARITY[Math.min(4, rolledTierIdx)];
          if (!owned[item.id]) { owned = { ...owned, [item.id]: true as const }; }
          else { extras = [...extras, { uid: makeExtraUid(), id: item.id, upg: 0 }]; }
          rewards.push({ kind:"item", itemId: item.id, itemName: item.name, itemIcon: item.icon });
          newHistoryEntries.push({ label: item.name, color: rarityDef.border, icon: item.icon, ts: Date.now(), count: 1 });
          continue;
        }
        // Brak dostępnego przedmiotu → fallback do kompostu
      }
      // Kompost growth/yield/exp — równe szanse, tier deterministyczny wg jakości
      let compostType: CompostType;
      const r2 = Math.random() * 100;
      if (r2 < 33.3) compostType = "growth";
      else if (r2 < 66.6) compostType = "yield";
      else compostType = "exp";
      const compostTierIdx = COMPOST_TIER_FIXED_BY_QUALITY[quality];
      const value = COMPOST_DEFS[compostType].bonusValues[compostTierIdx];
      const key = compostKeyFor(compostType, value);
      inv = { ...inv, [key]: (inv[key] ?? 0) + 1 };
      rewards.push({ kind:"compost", compostType, value });
      const cDef = COMPOST_DEFS[compostType];
      const tColor = compostTierIdx === 0 ? "#9ca3af" : compostTierIdx === 1 ? "#22c55e" : "#a78bfa";
      newHistoryEntries.push({ label: `${cDef.name} (${cDef.tierName(value)})`, color: tColor, icon: cDef.icon, ts: Date.now(), count: 1 });
    }

    // Reset partii po odebraniu
    const emptyBatch: CompostBatch = { fill: 0, scoreSum: 0, cropIds: [] };
    seedInventoryRef.current = inv;
    setSeedInventory(inv);
    saveOwnedEqItems(owned);
    saveItemUpg(upgReg);
    saveExtraEqItems(extras);
    saveKompostBatch(emptyBatch);
    if (profile?.id) {
      await supabase.from("profiles").update({ seed_inventory: inv }).eq("id", profile.id);
    }
    setKompostDropHistory(prev => {
      const now = Date.now();
      const WINDOW = 15 * 60 * 1000;
      let updated = prev.filter(e => now - e.ts <= WINDOW);
      for (const ne of newHistoryEntries) {
        const idx = updated.findIndex(e => e.label === ne.label);
        if (idx !== -1) {
          updated = [{ ...updated[idx], count: updated[idx].count + 1, ts: now }, ...updated.filter((_, i) => i !== idx)];
        } else {
          updated = [{ ...ne, ts: ne.ts ?? Date.now(), count: ne.count ?? 1 }, ...updated];
        }
      }
      return updated;
    });
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

    const effectiveGrowMs = getEffectiveGrowthTimeMs(plotId);
    // Jakość zasadzonego nasiona (z pola w DB — decyduje o ścieżce EXP i popup)
    const _plantedQualityRaw = getPlotCrop(plotId).plantedQuality ?? "good";
    const _plantedQuality = (["good","epic","rotten","legendary"].includes(_plantedQualityRaw) ? _plantedQualityRaw : "good") as "good"|"epic"|"rotten"|"legendary";

    // ─── Legendarny drop: SQL liczy server-side (eliminuje race condition) ───
    // _legExpMult usuwamy — SQL zwraca legendary_exp_mult w odpowiedzi RPC

    // ─── Epicki EXP — SQL oblicza ×3-6 server-side (uwzględnia rotten roll → 0 EXP) ───

    // ─── Parametry bonusów do RPC (atomicznie po stronie SQL — anti-race) ───
    // Dla legendarnych: zerujemy compost/extra/bonusDrop (klient sam aplikuje legendarny dropy).
    const _plotPreRpc = getPlotCrop(plotId);
    const _compostBonusForRpc = _plotPreRpc.compostBonus ?? null;
    const _compostYieldExtraForRpc = (_plantedQuality !== "legendary" && _compostBonusForRpc?.type === "yield")
      ? (_compostBonusForRpc.value ?? 0)
      : 0;
    const _extraHarvestPctForRpc = _plantedQuality !== "legendary" ? (_snapBonuses?.extraHarvestPct ?? 0) : 0;
    const _bonusDropPctForRpc    = _plantedQuality !== "legendary" ? (_snapBonuses?.bonusDropPct ?? 0) : 0;
    // Łączny % bonus EXP (eq + kompost Nauki) — SQL aplikuje atomicznie, eliminuje race condition
    // klient-side profiles.update przy "Zbierz wszystko".
    const _expEqPctForRpc     = _snapBonuses?.expPct ?? 0;
    const _compostExpPctForRpc = (_compostBonusForRpc?.type === "exp") ? (_compostBonusForRpc.value ?? 0) : 0;
    const _expBonusPctForRpc  = _expEqPctForRpc + _compostExpPctForRpc;

    const { data, error } = await supabase.rpc("game_harvest_plot", {
      p_plot_id: plotId,
      p_effective_grow_ms: effectiveGrowMs,
      p_zrecznosc: effectiveStats.zrecznosc ?? 0,
      p_planted_quality: _plantedQuality,
      // 0 = SQL decyduje (legendarny i epic EXP mult generowany server-side)
      p_exp_mult_override: 0,
      // Atomicznie po stronie SQL (eliminuje race condition przy zbiorze wielu pól naraz)
      p_compost_yield_extra: _compostYieldExtraForRpc,
      p_extra_harvest_pct:   _extraHarvestPctForRpc,
      p_bonus_drop_pct:      _bonusDropPctForRpc,
      p_szczescie:           effectiveStats.szczescie ?? 0,
      // Bonus EXP atomicznie — SQL zwraca exp_gained (fix: inflated popup przy "Zbierz wszystko")
      p_exp_bonus_pct:       _expBonusPctForRpc,
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

    // Buduj nextInventory ze zwróconego przez SQL inventory (źródło prawdy dla WSZYSTKICH typów).
    // Legendarny drop obliczany server-side — eliminuje race condition klient-side przy
    // masowym zbiorze (każdy równoległy harvest ma własny FOR UPDATE lock w SQL).
    const _rawNext: Record<string, number> = {};
    for (const [_k, _v] of Object.entries(rpcInv)) {
      if (typeof _v === "number") _rawNext[_k] = _v;
    }
    // Migracja: usuń stare klucze bez sufiksu jakości (np. "carrot" → "carrot_good")
    const nextInventory: Record<string, number> = parseSeedInventory(_rawNext);

    // ─── Bonus z kompostu (zachowany — używany do EXP bonus i notice) ───
    const _compostBonusOnPlot = plot.compostBonus ?? null;

    // ─── Wartości zwrócone przez RPC (atomicznie aplikowane przez SQL) ───
    // SQL jest źródłem prawdy dla WSZYSTKICH typów nasion (good / epic / rotten / legendary).
    // gained_* = dokładnie to, co SQL dodał do DB w tej transakcji.
    const _gainedGood      = (typeof (_rpcWrapper as { gained_good?: unknown }).gained_good      === "number") ? (_rpcWrapper as { gained_good: number }).gained_good           : 0;
    const _gainedEpic      = (typeof (_rpcWrapper as { gained_epic?: unknown }).gained_epic      === "number") ? (_rpcWrapper as { gained_epic: number }).gained_epic           : 0;
    const _gainedRotten    = (typeof (_rpcWrapper as { gained_rotten?: unknown }).gained_rotten  === "number") ? (_rpcWrapper as { gained_rotten: number }).gained_rotten       : 0;
    const _gainedLegendary = (typeof (_rpcWrapper as { gained_legendary?: unknown }).gained_legendary === "number") ? (_rpcWrapper as { gained_legendary: number }).gained_legendary : 0;
    const _totalYield      = _gainedGood + _gainedEpic + _gainedRotten + _gainedLegendary;

    // Zastosuj wynik RPC (XP, poziom, pola) — profil z poprawnym parserem wrappera
    const nextProfile = await applyProfileState(harvestRpcProfile);
    // Synchronizacja stanu klienta z DB.
    // Używamy Math.max per klucz (nie absolutnego przypisania), żeby równoległe żniwa
    // nie nadpisywały się wzajemnie mniejszą wartością (race condition przy masowym zbiorze).
    setSeedInventory(prev => {
      const _merged: Record<string, number> = { ...prev };
      for (const [_k, _v] of Object.entries(nextInventory)) {
        if (typeof _v === "number") _merged[_k] = Math.max(_merged[_k] ?? 0, _v);
      }
      seedInventoryRef.current = _merged; // ref zawsze = najnowszy stan
      return _merged;
    });
    // SQL jest źródłem prawdy dla WSZYSTKICH typów (w tym legendarnych).
    // NIE nadpisujemy DB pełnym obiektem — chroni przed race condition przy masowym zbiorze.

    // EXP tego pola — SQL zwraca dokładną wartość (base × mult × bonus%).
    // NIE używamy diffu rpcProf.xp - prevXp: przy "Zbierz wszystko" xp akumuluje się
    // w każdym kolejnym RPC (FOR UPDATE serializacja) → diff byłby coraz większy.
    // SQL sam aplikuje cap (legendarny ≤ exp_reward × 50) i bonus EXP atomicznie.
    const _expGainedRpc = (typeof (_rpcWrapper as { exp_gained?: unknown }).exp_gained === "number")
      ? (_rpcWrapper as { exp_gained: number }).exp_gained
      : null;
    const actualExp = _expGainedRpc !== null
      ? Math.max(0, _expGainedRpc)
      : Math.max(0, crop.expReward);

    // ─── Powiadomienie o aktywacji kompostu ───
    if (_compostBonusOnPlot) {
      setCompostNotice({ type: _compostBonusOnPlot.type, value: _compostBonusOnPlot.value, plotId });
      setTimeout(() => setCompostNotice(null), 5000);
    }

    // Dodaj do logu zbiorów — wyłącznie gained_* z RPC (SQL jest źródłem prawdy).
    // Dotyczy WSZYSTKICH typów nasion: good / epic / rotten / legendary.
    // Eliminuje rozbieżności przy równoległym "Zbierz wszystko" (brak diff/snapshot).
    {
      const _now2 = Date.now();
      const _legExpMultRpc = (typeof (_rpcWrapper as { legendary_exp_mult?: unknown }).legendary_exp_mult === "number")
        ? (_rpcWrapper as { legendary_exp_mult: number }).legendary_exp_mult : 0;
      const _qualGainedRpc: Record<CropQuality, number> = {
        good:      Math.max(0, _gainedGood),
        epic:      Math.max(0, _gainedEpic),
        rotten:    Math.max(0, _gainedRotten),
        legendary: Math.max(0, _gainedLegendary),
      };
      const _diffQuals = (["rotten","good","epic","legendary"] as CropQuality[]).filter(_q => _qualGainedRpc[_q] > 0);
      const _logEvents = _diffQuals.map((_q, _idx) => {
        const _isFirst = _idx === 0;
        const _bonusSrc = _isFirst
          ? (_plantedQuality === "legendary" && _legExpMultRpc > 0
              ? `🌟 ×${_legExpMultRpc} EXP`
              : _zrecznoscionTriggered ? "Zręczność 🎯" : null)
          : null;
        return {
          id: ++harvestEventIdRef.current,
          cropId: crop.id,
          cropName: crop.name,
          baseAmount: _qualGainedRpc[_q],
          bonusAmount: 0,
          bonusSource: _bonusSrc,
          baseExp: _isFirst ? actualExp : 0,
          timestamp: _now2,
          quality: _q,
          compostBonus: _isFirst ? (_compostBonusOnPlot ?? null) : null,
          expBonusPct: _isFirst ? _expBonusPctForRpc : 0,
        };
      });
      setHarvestLog(prev => [
        ...prev.filter(e => _now2 - e.timestamp < 25000),
        ..._logEvents,
      ]);
    }
    // ─── Historia postępu: zbiór ───
    if (profile?.id) {
      const _rpcLvl = rpcProf?.level ?? previousLevel;
      const _dp = loadDP(profile.id);
      _dp.harvests += 1;
      _dp.expGained += actualExp;
      _dp.levelsGained += Math.max(0, _rpcLvl - previousLevel);
      saveDP(profile.id, _dp);
      setDailyProgress({ ..._dp });
    }
  }

  // ─── TARG GRACZY: helpery ─────────────────────────────────────────────────
  function marketMinPrice(type: string, key: string, upg?: number): number {
    if (type === "equipment") {
      const eItem = CHAR_EQUIP_ITEMS.find(i => i.id === key);
      if (!eItem) return 1;
      const tier = getItemTierIndex(eItem.unlockLevel);
      if (tier <= 3) return 1;
      const baseMin: Record<number, number> = { 4: 3000, 5: 6000, 6: 12000, 7: 25000, 8: 50000 };
      const base = baseMin[Math.min(tier, 8)] ?? 1;
      const upgMults = [1.0, 1.03, 1.07, 1.12, 1.17, 1.23, 1.35, 1.5, 2.0, 2.5, 3.4];
      const mult = upgMults[Math.min(upg ?? 0, 10)] ?? 3.4;
      return Math.round(base * mult);
    }
    return 1;
  }
  function marketItemLabel(type: string, key: string): { name: string; icon: string } {
    if (type === "crop") {
      const { baseCropId, quality } = parseQualityKey(key);
      const crop = CROPS.find(c => c.id === baseCropId);
      const qDef = quality ? CROP_QUALITY_DEFS[quality] : null;
      return { name: `${crop?.name ?? baseCropId} (${qDef?.label ?? quality ?? ""})`, icon: qDef?.badge ?? "" };
    }
    if (type === "compost") {
      const ct = compostTypeFromKey(key);
      const val = compostValueFromKey(key);
      if (ct) { const def = COMPOST_DEFS[ct]; return { name: `${def.name} (${def.tierName(val)})`, icon: def.icon }; }
      return { name: key, icon: "🌿" };
    }
    if (type === "barn_item") {
      const ai = ANIMAL_ITEMS.find(a => a.id === key);
      return { name: ai?.name ?? key, icon: ai?.icon ?? "🐾" };
    }
    if (type === "fruit") {
      const qualSuffix = (["_zloty","_soczysty","_zgnile","_zwykly"] as const).find(s => key.endsWith(s));
      if (qualSuffix) {
        const treeId = key.slice(0, -qualSuffix.length);
        const tree = TREES.find(t => t.id === treeId);
        const qDef = FRUIT_QUALITY_DEFS[qualSuffix.slice(1) as FruitQuality];
        return { name: `${tree?.fruitName ?? treeId} (${qDef?.label ?? ""})`, icon: (tree?.fruitIcon ?? "🍎") + (qDef?.icon ?? "") };
      }
      return { name: key, icon: "🍎" };
    }
    if (type === "honey") return { name: "Słoik miodu", icon: "🍯" };
    if (type === "equipment") {
      const eItem = CHAR_EQUIP_ITEMS.find(i => i.id === key);
      return { name: eItem?.name ?? key, icon: eItem?.icon ?? "⚔️" };
    }
    return { name: key, icon: "📦" };
  }
  function getMarketItemImg(type: MarketItemType, key: string): string | null {
    if (type === "crop") {
      const { baseCropId, quality } = parseQualityKey(key);
      const crop = CROPS.find(c => c.id === baseCropId);
      if (!crop) return null;
      if (quality === "legendary" && crop.legendarySpritePath) return crop.legendarySpritePath;
      if (quality === "epic"      && crop.epicSpritePath)      return crop.epicSpritePath;
      if (quality === "rotten"    && crop.rottenSpritePath)    return crop.rottenSpritePath;
      return crop.spritePath;
    }
    if (type === "barn_item") return `/przedmioty/item_${key}.png`;
    if (type === "honey")     return `/przedmioty/jar_honey.png`;
    return null;
  }
  function buildSellableItems() {
    const items: { type: MarketItemType; key: string; name: string; icon: string; imgPath: string | null; qty: number; minPrice: number }[] = [];
    Object.entries(seedInventory).forEach(([key, qty]) => {
      if ((qty as number) <= 0) return;
      const iType: MarketItemType = isCompostKey(key) ? "compost" : "crop";
      const { name, icon } = marketItemLabel(iType, key);
      items.push({ type: iType, key, name, icon, imgPath: getMarketItemImg(iType, key), qty: qty as number, minPrice: marketMinPrice(iType, key) });
    });
    Object.entries(barnItems).forEach(([key, qty]) => {
      if ((qty as number) <= 0) return;
      const { name, icon } = marketItemLabel("barn_item", key);
      items.push({ type: "barn_item", key, name, icon, imgPath: getMarketItemImg("barn_item", key), qty: qty as number, minPrice: 1 });
    });
    Object.entries(fruitInventory).forEach(([key, qty]) => {
      if ((qty as number) <= 0) return;
      const { name, icon } = marketItemLabel("fruit", key);
      items.push({ type: "fruit", key, name, icon, imgPath: null, qty: qty as number, minPrice: marketMinPrice("fruit", key) });
    });
    const honeyJars = typeof (profile?.hive_data as Record<string,unknown> | null | undefined)?.honey_jars === "number"
      ? (profile!.hive_data as Record<string,unknown>).honey_jars as number : 0;
    if (honeyJars > 0) {
      items.push({ type: "honey", key: "honey_jar", name: "Słoik miodu", icon: "🍯", imgPath: getMarketItemImg("honey", "honey_jar"), qty: honeyJars, minPrice: 1 });
    }
    const equippedIds = new Set(
      (Object.values(charEquipped) as ({ id: string; upg: number } | null)[])
        .filter(Boolean).map(e => e!.id)
    );
    CHAR_EQUIP_ITEMS
      .filter(item => ownedEqItems[item.id] && !equippedIds.has(item.id))
      .forEach(item => {
        items.push({ type: "equipment", key: item.id, name: item.name, icon: item.icon, imgPath: null, qty: 1, minPrice: marketMinPrice("equipment", item.id, getItemUpg(item.id)) });
      });
    return items;
  }
  async function loadMarketData() {
    if (!profile) return;
    setMarketLoading(true);
    try {
      const filterParam = marketBrowseFilter === "all" ? null : marketBrowseFilter;
      const [browseRes, myOffersRes, returnsRes] = await Promise.all([
        supabase.rpc("market_browse", { p_item_type: filterParam }),
        supabase.rpc("market_get_my_offers"),
        supabase.rpc("market_get_returns"),
      ]);
      if (browseRes.data) setMarketBrowse(Array.isArray(browseRes.data) ? browseRes.data as MarketOffer[] : []);
      if (myOffersRes.data) setMyMarketOffers(Array.isArray(myOffersRes.data) ? myOffersRes.data as MarketOffer[] : []);
      if (returnsRes.data) {
        const ret = Array.isArray(returnsRes.data) ? returnsRes.data as MarketReturn[] : [];
        setMarketReturns(ret);
        setPendingReturnCount(ret.length);
      }
    } finally {
      setMarketLoading(false);
    }
  }
  async function handleMarketBrowseFilter(filter: MarketItemType | "all") {
    setMarketBrowseFilter(filter);
    setMarketLoading(true);
    try {
      const { data } = await supabase.rpc("market_browse", { p_item_type: filter === "all" ? null : filter });
      setMarketBrowse(Array.isArray(data) ? data as MarketOffer[] : []);
    } finally {
      setMarketLoading(false);
    }
  }
  function getItemUnlockLevel(type: MarketItemType, key: string): number {
    if (type === "crop") { const { baseCropId } = parseQualityKey(key); return CROPS.find(c => c.id === baseCropId)?.unlockLevel ?? 1; }
    if (type === "equipment") { return CHAR_EQUIP_ITEMS.find(i => i.id === key)?.unlockLevel ?? 1; }
    if (type === "barn_item" || type === "honey") { return ANIMALS.find(a => a.itemId === key || a.id === key)?.unlockLevel ?? 1; }
    if (type === "fruit") { return TREES.find(t => t.fruitId === key)?.unlockLevel ?? 1; }
    return 1;
  }
  async function handleCreateOffer() {
    if (!profile || !coItemKey) return;
    const minP = marketMinPrice(coItemType, coItemKey, coItemType === "equipment" ? getItemUpg(coItemKey) : undefined);
    if (coPrice < minP) { setMessage({ type: "error", title: "Zbyt niska cena", text: `Minimalna cena: ${minP} zł/szt.` }); return; }
    if (coQty <= 0) { setMessage({ type: "error", title: "Błąd", text: "Ilość musi być dodatnia." }); return; }
    setCoLoading(true);
    const { name, icon } = marketItemLabel(coItemType, coItemKey);
    const { data, error } = await supabase.rpc("market_create_offer", {
      p_item_type: coItemType, p_item_key: coItemKey, p_item_name: name, p_item_icon: icon,
      p_quantity: coQty, p_price_per_unit: coPrice, p_duration_hours: coDuration,
      p_unlock_level: getItemUnlockLevel(coItemType, coItemKey),
    });
    setCoLoading(false);
    if (error) { setMessage({ type: "error", title: "Błąd wystawienia", text: error.message }); return; }
    const result = data as { error?: string; success?: boolean };
    if (result?.error) { setMessage({ type: "error", title: "Błąd wystawienia", text: result.error }); return; }
    if (coItemType === "equipment") {
      const next = { ...ownedEqItems } as Record<string, true>;
      delete next[coItemKey];
      saveOwnedEqItems(next);
    }
    setMessage({ type: "success", title: "Oferta wystawiona!", text: `${name} ×${coQty} za ${coPrice} zł/szt.` });
    setCreateOfferOpen(false); setCoItemKey(""); setCoQty(1); setCoPrice(10); setCoPriceStr("10"); setCoDuration(24);
    await Promise.all([loadProfile(), loadMarketData()]);
  }
  async function handleBuyOffer(offerId: string, qty: number) {
    if (!profile) return;
    setBuyingOfferId(offerId);
    const { data, error } = await supabase.rpc("market_buy_offer", { p_offer_id: offerId, p_quantity: qty });
    setBuyingOfferId(null);
    if (error) { setMessage({ type: "error", title: "Błąd zakupu", text: error.message }); return; }
    const result = data as { error?: string; success?: boolean; item_name?: string; item_type?: string; item_key?: string; quantity?: number; paid?: number };
    if (result?.error) { setMessage({ type: "error", title: "Błąd zakupu", text: result.error }); return; }
    setBuyQtyMap(prev => { const n = { ...prev }; delete n[offerId]; return n; });
    if (result?.item_type === "equipment" && result.item_key) {
      saveOwnedEqItems({ ...ownedEqItems, [result.item_key]: true });
    }
    setMessage({ type: "success", title: "Zakup udany!", text: `Kupiono: ${result.item_name} ×${result.quantity} za ${result.paid?.toLocaleString("pl-PL")} zł.` });
    await Promise.all([loadProfile(), loadMarketData()]);
  }
  async function handleCancelOffer(offerId: string) {
    if (!profile) return;
    setCancellingOfferId(offerId);
    const { data, error } = await supabase.rpc("market_cancel_offer", { p_offer_id: offerId });
    setCancellingOfferId(null);
    if (error) { setMessage({ type: "error", title: "Błąd anulowania", text: error.message }); return; }
    const result = data as { error?: string; success?: boolean };
    if (result?.error) { setMessage({ type: "error", title: "Błąd anulowania", text: result.error }); return; }
    setMessage({ type: "success", title: "Oferta anulowana", text: "Przedmiot trafi do zakładki Do Odbioru." });
    await loadMarketData();
  }
  async function handleClaimAllReturns() {
    if (!profile) return;
    setClaimingReturns(true);
    const { data, error } = await supabase.rpc("market_claim_all_returns");
    setClaimingReturns(false);
    if (error) { setMessage({ type: "error", title: "Błąd odbioru", text: error.message }); return; }
    const result = data as { error?: string; success?: boolean; gold_claimed?: number; items_claimed?: number; equipment_keys?: string[] };
    if (result?.error) { setMessage({ type: "error", title: "Błąd odbioru", text: result.error }); return; }
    if (result?.equipment_keys && result.equipment_keys.length > 0) {
      const next = { ...ownedEqItems };
      result.equipment_keys.forEach(k => { next[k] = true; });
      saveOwnedEqItems(next);
    }
    let claimMsg = "";
    if ((result.gold_claimed ?? 0) > 0) claimMsg += `+${result.gold_claimed?.toLocaleString("pl-PL")} zł. `;
    if ((result.items_claimed ?? 0) > 0) claimMsg += `Odebrano ${result.items_claimed} szt. przedmiotów.`;
    setMessage({ type: "success", title: "Odebrano!", text: claimMsg || "Odebrano wszystko z targu." });
    await Promise.all([loadProfile(), loadMarketData()]);
  }

  async function handleChangeMap(targetMap: string) {
      if (!profile) return;

      // Reset pan przy zmianie mapy (farma/miasto → środek, reszta → 0)
      setPanX((targetMap.startsWith("farm") || targetMap === "city") ? FARM_CENTER_PAN : 0); setPanY(0); setIsPanDragging(false);
      panDragRef.current = { active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false };

      // Reset wszystkich hover-stanów — mapa znika zanim onMouseLeave zdąży zadziałać
      setHoveredBarnLock(false);
      setHoveredHiveLock(false);
      setHoveredSadLock(false);
      setHoveredWateringCan(false);
      setHoveredSickle(false);

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

      await applyProfileState(extractRpcProfile(rpcData));
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
      category: "sent" as const,
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
    // Wiadomości z targu (subject startsWith "Targ") trafiają do kategorii "market"
    const isMarketSubject = (subject: string) =>
      subject?.startsWith("Targ") || subject?.startsWith("🏪") || subject?.startsWith("targ");

    const inboxMessages = ((inboxData ?? []).filter(
      m => m.type === "received" || m.type === "system"
    ) as GameMessage[]).map(m => ({
      ...m,
      category: (m.type === "system"
        ? "system"
        : isMarketSubject(m.subject ?? "")
          ? "market"
          : "received") as GameMessage["category"],
      from_avatar_skin: senderAvatarMap[m.from_user_id ?? ""] ?? 0,
    }));

    const combined: GameMessage[] = [
      ...inboxMessages,
      ...sentMessages.map(m => ({ ...m, category: "sent" as const })),
      ...((sysData ?? []).filter(s => !inboxMessages.some(d => d.id === s.id)) as GameMessage[]).map(s => ({ ...s, category: "system" as const })),
    ];
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setGameMessages(combined);
    setUnreadCount(combined.filter(m => !m.read && m.to_user_id === profile.id && m.category === "received").length);
    setUnreadMarketCount(combined.filter(m => !m.read && m.to_user_id === profile.id && m.category === "market").length);
    setMessagesLoading(false);
  }

  async function searchPlayers(q: string) {
    if (q.trim().length < 2) { setRecipientSuggestions([]); return; }
    const { data, error } = await supabase.rpc("search_message_recipients", {
      p_query: q.trim(),
      p_limit: 8,
    });
    if (error) { setRecipientSuggestions([]); return; }
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
    const blockedByRecipient = ((recipientProfile as {blocked_users?:string[]|null})?.blocked_users ?? []).includes(profile.id);
    if (blockedByRecipient) {
      setComposeSending(false);
      setComposeError("Ta osoba cię zablokowała.");
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
    if (error) { setComposeError(error.message); return; }
    await loadProfile(profile.id);
    setMessageCooldowns(prev => ({ ...prev, [recipientResolved.id]: Date.now() }));
    setShowCompose(false);
    setComposeRecipient("");
    setComposeSubject("");
    setComposeBody("");
    setRecipientResolved(null);
    setRecipientSuggestions([]);
    void loadMessages();
  }

  function openBlankCompose() {
    setRecipientResolved(null);
    setComposeRecipient("");
    setRecipientSuggestions([]);
    setComposeSubject("");
    setComposeBody("");
    setComposeError("");
    setComposeSending(false);
    setShowCompose(true);
    setShowMessagePanel(true);
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

  async function markAsRead(category: "received" | "market" = "received") {
    if (!profile) return;
    const unreadIds = gameMessages
      .filter(m => !m.read && m.to_user_id === profile.id && m.category === category)
      .map(m => m.id);
    if (unreadIds.length === 0) return;
    await supabase.from("messages").update({ read: true }).in("id", unreadIds);
    setGameMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, read: true } : m));
    if (category === "received") setUnreadCount(0);
    else setUnreadMarketCount(0);
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
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative", background: "#000" }}>
      {/* Ambient backdrop — rozmyte tło farmy/miasta zasłania czarne paski po bokach */}
      {(isOnFarmMap || isOnCityMap) && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          backgroundImage: `url(/mapy/${backgroundMap}.png)`,
          backgroundSize: "cover", backgroundPosition: "center",
          filter: "blur(18px) brightness(0.45)",
          transform: "scale(1.12)",
        }} />
      )}
        <main
          className="overflow-hidden"
          style={{ width: BASE_W, height: BASE_H, transform: `scale(${gameScale})`, transformOrigin: "center center", position: "absolute", top: "50%", left: "50%", marginLeft: -BASE_W / 2, marginTop: -BASE_H / 2, zIndex: 1 }}
          onMouseMove={(e) => { const gc = toGameCoords(e.clientX, e.clientY); setMousePos(gc); }}
        >
        <div
          ref={mapContainerRef}
          className="relative overflow-hidden"
          style={{ width: "100%", height: "100%", cursor: isOnPanMap ? "grab" : undefined, userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
          onDragStart={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            if (!isOnPanMap || e.button !== 0) return;
            const tgt = e.target as HTMLElement;
            if (tgt.closest('[data-no-map-drag], button, [role="button"], a, input, textarea, select')) return;
            e.preventDefault();
            panDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY, moved: false };
          }}
          onMouseMove={(e) => {
            if (!panDragRef.current.active || panDragRef.current.moved) return;
            const dx = e.clientX - panDragRef.current.startX;
            if (Math.abs(dx) > 4) {
              panDragRef.current.moved = true;
              document.body.classList.add("plono-dragging");
              setPanX(Math.max(-FARM_MAX_PAN, Math.min(0, panDragRef.current.startPanX + dx / gameScale)));
              setIsPanDragging(true);
            }
          }}
          onMouseUp={() => {
            document.body.classList.remove("plono-dragging");
            panDragRef.current.active = false;
            setIsPanDragging(false);
            if (panDragRef.current.moved) { setTimeout(() => { panDragRef.current.moved = false; }, 100); }
          }}
          onMouseLeave={() => {
            document.body.classList.remove("plono-dragging");
            panDragRef.current.active = false;
            setIsPanDragging(false);
            panDragRef.current.moved = false;
          }}
          onClickCapture={(e) => {
            if (panDragRef.current.moved) { e.stopPropagation(); panDragRef.current.moved = false; }
          }}
        >
        {/* Tło mapy — przesuwa się wraz z panowaniem */}
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: isOnPanMap ? `${FARM_IMG_W}px` : "100%",
          height: isOnPanMap ? `${FARM_IMG_H}px` : "100%",
          transform: isOnPanMap ? `translateX(${panX}px) scale(${FARM_SCALE})` : undefined,
          transformOrigin: isOnPanMap ? "top left" : undefined,
          willChange: isOnPanMap ? "transform" : undefined,
        }}>
          <img
            src={profile ? `/mapy/${backgroundMap}.png` : "/mapy/assetsmain-lobby.png"}
            alt="Mapa gry"
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
            draggable={false}
            style={isOnPanMap ? {imageRendering:"pixelated", width: FARM_IMG_W, height: FARM_IMG_H} : {}}
          />
        </div>
        {/* Overlay ładowania — statyczny (nie przesuwa się) */}
        {isMapLoading && (
          <div className="pointer-events-none absolute inset-0 z-[200] flex flex-col items-center justify-center gap-8">
            <div className="w-[1280px] overflow-hidden rounded-full border-2 border-[#8b6a3e]/80 bg-black/70 backdrop-blur-sm shadow-2xl">
              <div className="h-10 rounded-full bg-gradient-to-r from-[#c9952f] via-[#f2ca69] to-[#c9952f] animate-pulse" style={{width:"100%"}} />
            </div>
            <p className="text-6xl font-black text-[#f9e7b2] drop-shadow-lg tracking-wide order-first">Ładowanie mapy...</p>
          </div>
        )}
        {/* Overlay kursora grabbing podczas przeciągania */}
        {isPanDragging && (
          <div
            style={{ position: "absolute", inset: 0, zIndex: 99999, cursor: "grabbing", userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
            onDragStart={(e) => e.preventDefault()}
            onMouseMove={(e) => {
              const dx = e.clientX - panDragRef.current.startX;
              setPanX(Math.max(-FARM_MAX_PAN, Math.min(0, panDragRef.current.startPanX + dx / gameScale)));
            }}
            onMouseUp={() => {
              document.body.classList.remove("plono-dragging");
              panDragRef.current.active = false;
              setIsPanDragging(false);
              if (panDragRef.current.moved) { setTimeout(() => { panDragRef.current.moved = false; }, 100); }
            }}
          />
        )}

        <div className="relative z-[1] h-full w-full">
          {profile && !isFieldViewOpen && (isOnFarmMap || currentMap === "city") && (
            <>
              <div className="fixed right-4 top-4 z-[90] flex flex-col items-end gap-1.5">
                <button
                  onClick={handleLogout}
                  className="rounded-2xl border border-red-400/40 bg-red-950/40 px-5 py-2.5 text-base font-bold text-red-100 backdrop-blur-sm transition hover:bg-red-950/60"
                >
                  Wyloguj
                </button>
                {sessionTimeLeft !== null && (() => {
                  const totalSec = Math.ceil(sessionTimeLeft / 1000);
                  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
                  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
                  const ss = String(totalSec % 60).padStart(2, "0");
                  const warn = sessionTimeLeft < 10 * 60 * 1000; // czerwono < 10 min
                  return (
                    <div title="Czas do automatycznego wylogowania" className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 backdrop-blur-sm text-sm font-bold tabular-nums cursor-default ${warn ? "border-red-500/60 bg-red-950/50 text-red-300" : "border-[#8b6a3e]/50 bg-[rgba(20,12,8,0.75)] text-[#d8ba7a]"}`}>
                      <span className={warn ? "animate-pulse" : ""}>⏱</span>
                      <span>{hh}:{mm}:{ss}</span>
                    </div>
                  );
                })()}
              </div>

              {/* ═══ TESTY GRY BUTTON ═══ */}
              <style>{`
                @keyframes arrowBlink{0%,100%{opacity:0;transform:translateX(-6px)}50%{opacity:1;transform:translateX(0)}}
                @keyframes legendaryPulse{0%,100%{box-shadow:0 0 6px 2px rgba(245,158,11,0.55),0 0 14px 4px rgba(245,158,11,0.2);transform:scale(1)}50%{box-shadow:0 0 18px 7px rgba(245,158,11,0.9),0 0 36px 12px rgba(245,158,11,0.4);transform:scale(1.02)}}
                @keyframes legendaryShimmer{0%{opacity:0;transform:translateX(-120%) rotate(20deg)}60%{opacity:0.55}100%{opacity:0;transform:translateX(120%) rotate(20deg)}}

              `}</style>
              <div className="fixed right-4 bottom-6 z-[92] flex items-center gap-2">
                <span className="text-4xl font-black text-orange-400 select-none" style={{animation:"arrowBlink 1.1s ease-in-out infinite",display:"inline-block"}}>➤</span>
                <button onClick={() => setShowTestModal(true)}
                  className="relative flex items-center gap-2 rounded-2xl border border-orange-500/70 bg-[rgba(38,14,4,0.92)] px-8 py-4 font-black text-orange-300 shadow-2xl backdrop-blur-sm transition hover:border-orange-400 hover:text-orange-200">
                  <span className="animate-pulse text-3xl">🧪</span>
                  <span className="text-lg">Testy</span>
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 rounded-full bg-orange-500 animate-ping" />
                </button>
              </div>


              {/* ═══ MUZYKA ═══ */}
              <div className="fixed right-4 z-[92]" style={{ top: "300px" }}>
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
                      <img src="/ui/mail.png" alt="Wiadomości" className="h-[128px] w-[128px] object-contain" style={{imageRendering:"pixelated"}} />
                      {(unreadCount + unreadMarketCount) > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg">
                          {(unreadCount + unreadMarketCount) > 9 ? "9+" : (unreadCount + unreadMarketCount)}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}


          {profile && (
            <>
              {/* ═══ WARSTWA FARMY — przesuwa się z mapą (drag-to-pan) ═══ */}
              {isOnFarmMap && (
                <div className="pointer-events-none" style={{
                  position:"absolute", top:0, left:0,
                  width:`${FARM_IMG_W}px`, height:`${FARM_IMG_H}px`,
                  transform:`translateX(${panX}px) scale(${FARM_SCALE})`,
                  transformOrigin:"top left",
                  zIndex:20,
                }}>
                  {isOnFarmMap && (
  <button
    type="button"
    data-no-map-drag="true"
    onClick={() => {
      setHoveredPolaUprawne(false);
      setIsFieldViewOpen(true);
      setSelectedPlotId((prev) => prev ?? 1);
    }}
    onMouseEnter={() => setHoveredPolaUprawne(true)}
    onMouseLeave={() => setHoveredPolaUprawne(false)}
    data-zone="polaUprawne"
    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
    style={{
      left: `${activeHitboxPos.polaUprawne.left}%`,
      top: `${activeHitboxPos.polaUprawne.top}%`,
      width: `${activeHitboxPos.polaUprawne.width}%`,
      height: `${activeHitboxPos.polaUprawne.height}%`,
      zIndex: 4,
    }}
    title=""
  />
)}

                  {currentMap.startsWith("farm") && (
                      <>
                        {/* Dom — na drzwiach domu */}
                        <button
                          type="button"
                          data-no-map-drag="true"
                          onClick={() => { setHoveredDom(false); setShowDomModal(true); setDomTab("profil"); }}
                          title=""
                          onMouseEnter={() => setHoveredDom(true)}
                          onMouseLeave={() => setHoveredDom(false)}
                          data-zone="dom"
                          className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                          style={{ left:`${activeHitboxPos.dom.left}%`, top:`${activeHitboxPos.dom.top}%`, width:`${activeHitboxPos.dom.width}%`, height:`${activeHitboxPos.dom.height}%`, zIndex: 20 }}
                        />
                        {/* Stodoła */}
                        {(() => {
                          const _playerLvl = profile?.level ?? 1;
                          const _barnUnlocked = _playerLvl >= BARN_UNLOCK_LVL;
                          return (
                            <button
                              type="button"
                              data-no-map-drag="true"
                              title=""
                              onMouseEnter={() => { if (_barnUnlocked) setHoveredStodola(true); else setHoveredBarnLock(true); }}
                              onMouseLeave={() => { setHoveredBarnLock(false); setHoveredStodola(false); }}
                              data-zone={_barnUnlocked ? "stodola" : "barnLock"}
                              onClick={() => {
                                if (!_barnUnlocked) {
                                  setHoveredBarnLock(false);
                                  setMessage({ type:"error", title:"🔒 Stodoła zablokowana", text:`Stodoła odblokowuje się od ${BARN_UNLOCK_LVL} poziomu (masz ${_playerLvl}).` });
                                  return;
                                }
                                setHoveredBarnLock(false);
                                setShowStodolaModal(true);
                              }}
                              className={`pointer-events-auto absolute transition-all duration-300 ${_barnUnlocked ? "hover:scale-105" : "cursor-not-allowed"}`}
                              style={{ left:`${activeHitboxPos.stodola.left}%`, top:`${activeHitboxPos.stodola.top}%`, width:`${activeHitboxPos.stodola.width}%`, height:`${activeHitboxPos.stodola.height}%`, zIndex: 20 }}
                            />
                          );
                        })()}
                      {/* Do miasta */}
                      <button
                        type="button"
                        data-no-map-drag="true"
                        onClick={() => handleChangeMap("city")}
                        title=""
                        onMouseEnter={() => setHoveredDoMiasta(true)}
                        onMouseLeave={() => setHoveredDoMiasta(false)}
                        data-zone="doMiasta"
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${activeHitboxPos.doMiasta.left}%`, top:`${activeHitboxPos.doMiasta.top}%`, width:`${activeHitboxPos.doMiasta.width}%`, height:`${activeHitboxPos.doMiasta.height}%`, zIndex: 20 }}
                      />
                      {/* Ul */}
                      {(() => {
                        const _playerLvl = profile?.level ?? 1;
                        const _hiveUnlocked = _playerLvl >= HIVE_UNLOCK_LVL;
                        return (
                          <button
                            type="button"
                            data-no-map-drag="true"
                            title=""
                            onMouseEnter={() => { if (_hiveUnlocked) setHoveredUl(true); else setHoveredHiveLock(true); }}
                            onMouseLeave={() => { setHoveredHiveLock(false); setHoveredUl(false); }}
                            data-zone={_hiveUnlocked ? "ul" : "hiveLock"}
                            onClick={() => {
                              if (!_hiveUnlocked) {
                                setHoveredHiveLock(false);
                                setMessage({ type:"error", title:"🔒 Ul zablokowany", text:`Ul odblokowuje się od ${HIVE_UNLOCK_LVL} poziomu (masz ${_playerLvl}).` });
                                return;
                              }
                              setHoveredHiveLock(false);
                              setShowUlModal(true);
                            }}
                            className={`pointer-events-auto absolute transition-all duration-300 ${_hiveUnlocked ? "hover:scale-105" : "cursor-not-allowed"}`}
                            style={{ left:`${activeHitboxPos.ul.left}%`, top:`${activeHitboxPos.ul.top}%`, width:`${activeHitboxPos.ul.width}%`, height:`${activeHitboxPos.ul.height}%`, zIndex: 20 }}
                          />
                        );
                      })()}
                      {/* Lada dla klientów — sprzedaż słoików miodu */}
                      <button
                        type="button"
                        data-no-map-drag="true"
                        title=""
                        onMouseEnter={() => setHoveredLada(true)}
                        onMouseLeave={() => setHoveredLada(false)}
                        data-zone="lada"
                        onClick={() => { setHoveredLada(false); setCurrentCustomerIdx(0); setShowLadaModal(true); }}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${activeHitboxPos.lada.left}%`, top:`${activeHitboxPos.lada.top}%`, width:`${activeHitboxPos.lada.width}%`, height:`${activeHitboxPos.lada.height}%`, zIndex: 20 }}
                      />
                      {/* Kompostownik */}
                      <button
                        type="button"
                        data-no-map-drag="true"
                        title=""
                        onMouseEnter={() => setHoveredKompostownik(true)}
                        onMouseLeave={() => setHoveredKompostownik(false)}
                        data-zone="kompostownik"
                        onClick={() => { setHoveredKompostownik(false); setShowKompostModal(true); }}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left:`${activeHitboxPos.kompostownik.left}%`, top:`${activeHitboxPos.kompostownik.top}%`, width:`${activeHitboxPos.kompostownik.width}%`, height:`${activeHitboxPos.kompostownik.height}%`, zIndex: 20 }}
                      />
                      {/* Sad */}
                      {(() => {
                        const _playerLvl = profile?.level ?? 1;
                        const _sadUnlocked = _playerLvl >= SAD_UNLOCK_LVL;
                        return (
                          <button
                            type="button"
                            data-no-map-drag="true"
                            title=""
                            onMouseEnter={() => { if (_sadUnlocked) setHoveredSad(true); else setHoveredSadLock(true); }}
                            onMouseLeave={() => { setHoveredSadLock(false); setHoveredSad(false); }}
                            data-zone={_sadUnlocked ? "sad" : "sadLock"}
                            onClick={() => {
                              if (!_sadUnlocked) {
                                setHoveredSadLock(false);
                                setMessage({ type:"error", title:"🔒 Sad zablokowany", text:`Sad odblokowuje się od ${SAD_UNLOCK_LVL} poziomu (masz ${_playerLvl}).` });
                                return;
                              }
                              setHoveredSadLock(false);
                              setShowSadModal(true);
                            }}
                            className={`pointer-events-auto absolute transition-all duration-300 ${_sadUnlocked ? "hover:scale-105" : "cursor-not-allowed"}`}
                            style={{ left:`${activeHitboxPos.sad.left}%`, top:`${activeHitboxPos.sad.top}%`, width:`${activeHitboxPos.sad.width}%`, height:`${activeHitboxPos.sad.height}%`, zIndex: 20 }}
                          />
                        );
                      })()}
                      {/* Etykiety nawigacyjne — niezależne od hitboxów */}
                      {(["dom","stodola","doMiasta","polaUprawne","ul","lada","kompostownik","sad"] as const).map(id => {
                        const labels: Record<string,string> = {dom:"Dom",stodola:"Stodoła",doMiasta:"Do miasta",polaUprawne:"Pola uprawne",ul:"Ul",lada:"Lada",kompostownik:"Kompostownik",sad:"Sad"};
                        const lp = activeLabelPos[id];
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
                        const lp = activeLabelPos[nb.id];
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
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-sky-500 bg-black/95 p-4 pointer-events-auto shadow-2xl" style={{zIndex:200,minWidth:420}}>
                        <div className="font-black text-sky-300 text-sm mb-3 text-center tracking-wide">🏷 ETYKIETY — pozycje (do podania mi)</div>
                        <table className="w-full text-[11px] text-sky-100 border-collapse">
                          <thead><tr className="text-sky-400 text-[10px]"><th className="text-left pb-1 pr-3">nazwa</th><th className="pb-1 pr-3">left %</th><th className="pb-1">top %</th></tr></thead>
                          <tbody>
                            {Object.entries(activeLabelPos).map(([id,lp]) => (
                              <tr key={id} className="border-t border-sky-900">
                                <td className="pr-3 py-0.5 font-bold text-sky-300">{id}</td>
                                <td className="pr-3 py-0.5 text-center font-mono text-yellow-300">{lp.left.toFixed(1)}</td>
                                <td className="py-0.5 text-center font-mono text-yellow-300">{lp.top.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-orange-500 bg-black/95 p-4 pointer-events-auto shadow-2xl" style={{zIndex:200,minWidth:500}}>
                        <div className="font-black text-orange-300 text-sm mb-3 text-center tracking-wide">🎯 HITBOXY — pozycje (do podania mi)</div>
                        <table className="w-full text-[11px] text-orange-100 border-collapse">
                          <thead><tr className="text-orange-400 text-[10px]"><th className="text-left pb-1 pr-3">nazwa</th><th className="pb-1 pr-3">left %</th><th className="pb-1 pr-3">top %</th><th className="pb-1 pr-3">width %</th><th className="pb-1">height %</th></tr></thead>
                          <tbody>
                            {Object.entries(navHitboxPos).map(([id,hp]) => (
                              <tr key={id} className="border-t border-orange-900">
                                <td className="pr-3 py-0.5 font-bold text-orange-300">{id}</td>
                                <td className="pr-3 py-0.5 text-center font-mono text-yellow-300">{hp.left.toFixed(1)}</td>
                                <td className="pr-3 py-0.5 text-center font-mono text-yellow-300">{hp.top.toFixed(1)}</td>
                                <td className="pr-3 py-0.5 text-center font-mono text-green-300">{hp.width.toFixed(1)}</td>
                                <td className="py-0.5 text-center font-mono text-green-300">{hp.height.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* ═══ WARSTWA MIASTA — przesuwa się z mapą (drag-to-pan) ═══ */}
              {isOnCityMap && (
                <div
                  className="pointer-events-none"
                  style={{
                    position: "absolute", top: 0, left: 0,
                    width: `${FARM_IMG_W}px`, height: `${FARM_IMG_H}px`,
                    transform: `translateX(${panX}px) scale(${FARM_SCALE})`,
                    transformOrigin: "top left",
                    zIndex: 20,
                  }}
                >
                  {/* ── Hitboxy ── */}
                  <button
                    type="button"
                    onClick={() => handleChangeMap(getMapForLevel(profile?.level))}
                    onMouseEnter={() => setHoveredNaFarme(true)}
                    onMouseLeave={() => setHoveredNaFarme(false)}
                    data-no-map-drag="true"
                    data-zone="naFarme"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.naFarme.left}%`, top:`${cityHitboxPos.naFarme.top}%`, width:`${cityHitboxPos.naFarme.width}%`, height:`${cityHitboxPos.naFarme.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => { setShopTab("nasiona"); setShowShopModal(true); }}
                    onMouseEnter={() => setHoveredSklep(true)}
                    onMouseLeave={() => setHoveredSklep(false)}
                    data-no-map-drag="true"
                    data-zone="sklep"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.sklep.left}%`, top:`${cityHitboxPos.sklep.top}%`, width:`${cityHitboxPos.sklep.width}%`, height:`${cityHitboxPos.sklep.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => { setShowMarketModal(true); setMarketTab("browse"); void loadMarketData(); }}
                    onMouseEnter={() => setHoveredTarg(true)}
                    onMouseLeave={() => setHoveredTarg(false)}
                    data-no-map-drag="true"
                    data-zone="targ"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.targ.left}%`, top:`${cityHitboxPos.targ.top}%`, width:`${cityHitboxPos.targ.width}%`, height:`${cityHitboxPos.targ.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => handleChangeMap("city_bank")}
                    onMouseEnter={() => setHoveredBank(true)}
                    onMouseLeave={() => setHoveredBank(false)}
                    data-no-map-drag="true"
                    data-zone="bank"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.bank.left}%`, top:`${cityHitboxPos.bank.top}%`, width:`${cityHitboxPos.bank.width}%`, height:`${cityHitboxPos.bank.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => { handleChangeMap("city_townhall"); setTownHallCamX(TH_CENTER_CAM_X); }}
                    onMouseEnter={() => setHoveredRatusz(true)}
                    onMouseLeave={() => setHoveredRatusz(false)}
                    data-no-map-drag="true"
                    data-zone="ratusz"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.ratusz.left}%`, top:`${cityHitboxPos.ratusz.top}%`, width:`${cityHitboxPos.ratusz.width}%`, height:`${cityHitboxPos.ratusz.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => handleChangeMap("city_liga")}
                    onMouseEnter={() => setHoveredLiga(true)}
                    onMouseLeave={() => setHoveredLiga(false)}
                    data-no-map-drag="true"
                    data-zone="liga"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.liga.left}%`, top:`${cityHitboxPos.liga.top}%`, width:`${cityHitboxPos.liga.width}%`, height:`${cityHitboxPos.liga.height}%` }}
                    title=""
                  />
                  {/* ── Etykiety ── */}
                  {([
                    {id:"naFarme", name:"Na farmę"},
                    {id:"sklep",   name:"Sklep"},
                    {id:"targ",    name:"Targ"},
                    {id:"bank",    name:"Bank"},
                    {id:"ratusz",  name:"Ratusz"},
                    {id:"liga",    name:"Liga Farmerów"},
                  ] as Array<{id:string,name:string}>).map(b => {
                    const lp = cityLabelPos[b.id];
                    return (
                      <span
                        key={b.id}
                        className={`absolute rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl -translate-x-1/2 ${cityNavEditMode ? "pointer-events-auto cursor-move outline outline-2 outline-sky-400/80 select-none" : "pointer-events-none"}`}
                        style={{left:`${lp.left}%`,top:`${lp.top}%`}}
                        onMouseDown={cityNavEditMode ? (e => { e.preventDefault(); e.stopPropagation(); cityLabelDragRef.current = {id:b.id,startX:e.clientX,startY:e.clientY,startPos:{...lp}}; }) : undefined}
                      >
                        {b.name}
                        {cityNavEditMode && (
                          <span className="block text-center text-[11px] font-normal text-sky-300 leading-tight mt-1 whitespace-nowrap">
                            {lp.left.toFixed(1)}% {lp.top.toFixed(1)}%
                          </span>
                        )}
                      </span>
                    );
                  })}
                  {/* ══ PANEL KOORDYNATÓW ETYKIET ══ */}
                  {cityNavEditMode && (
                    <div className="absolute inset-0 pointer-events-none" style={{zIndex:56}}>
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
                        {id:"liga",    name:"Liga Farmerów"},
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
                </div>
              )}
              {/* ═══ WARSTWA STATYCZNA — miasto i inne lokacje (bez panu) ═══ */}
              <div className="absolute inset-0 z-20 pointer-events-none">

                  {/* ── DEV: panel edytora farmy ── */}
                  {isOnFarmMap && profile && (
                    <div className="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 flex gap-2 z-[200]" style={{zIndex:200}}>
                      <button
                        type="button"
                        onClick={() => { setNavEditMode(p => !p); setHitboxEditMode(false); }}
                        className={`rounded-lg border px-3 py-1 text-[11px] font-black shadow transition ${navEditMode ? "border-sky-400 bg-sky-900/90 text-sky-200" : "border-sky-700/60 bg-black/80 text-sky-400 hover:bg-sky-950"}`}
                      >
                        {navEditMode ? "✅ Etykiety ON" : "🏷 Edytuj etykiety"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setHitboxEditMode(p => !p); setNavEditMode(false); }}
                        className={`rounded-lg border px-3 py-1 text-[11px] font-black shadow transition ${hitboxEditMode ? "border-orange-400 bg-orange-900/90 text-orange-200" : "border-orange-700/60 bg-black/80 text-orange-400 hover:bg-orange-950"}`}
                      >
                        {hitboxEditMode ? "✅ Hitboxy ON" : "🎯 Edytuj hitboxy"}
                      </button>
                    </div>
                  )}

                  {/* ─── Strzałki nawigacji farmy ─── */}
                  <style>{`@keyframes thArrowPulse { 0%,100%{opacity:0.5;transform:translateY(-50%) scale(1)} 50%{opacity:1;transform:translateY(-50%) scale(1.25)} }`}</style>
                  {isOnFarmMap && (
                    <>
                      {panX < 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPanX(prev => Math.min(0, prev + Math.round(BASE_W * 0.5))); }}
                          className="pointer-events-auto absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                          style={{ left:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                          aria-label="Przewiń w lewo"
                        >‹</button>
                      )}
                      {panX > -FARM_MAX_PAN && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPanX(prev => Math.max(-FARM_MAX_PAN, prev - Math.round(BASE_W * 0.5))); }}
                          className="pointer-events-auto absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                          style={{ right:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite 0.4s", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                          aria-label="Przewiń w prawo"
                        >›</button>
                      )}
                      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                        {Array.from({length: 3}).map((_,i) => {
                          const segW = FARM_MAX_PAN / 2;
                          const active = Math.round(-panX / segW) === i;
                          return <div key={i} className={`h-1.5 rounded-full transition-all ${active ? "w-6 bg-amber-400" : "w-2 bg-white/20"}`} />;
                        })}
                      </div>
                    </>
                  )}

                  {currentMap === "city" && (
                    <>
                      {/* ── DEV: przyciski toggle edytora miasta ── */}
                      <div className="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 flex gap-2" style={{zIndex:200}}>
                        <button
                          type="button"
                          onClick={() => { setCityNavEditMode(p => !p); setCityHitboxEditMode(false); }}
                          className={`rounded-lg border px-3 py-1 text-[11px] font-black shadow transition ${cityNavEditMode ? "border-sky-400 bg-sky-900/90 text-sky-200" : "border-sky-700/60 bg-black/80 text-sky-400 hover:bg-sky-950"}`}
                        >
                          {cityNavEditMode ? "✅ Etykiety ON" : "🏷 Edytuj etykiety"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCityHitboxEditMode(p => !p); setCityNavEditMode(false); }}
                          className={`rounded-lg border px-3 py-1 text-[11px] font-black shadow transition ${cityHitboxEditMode ? "border-orange-400 bg-orange-900/90 text-orange-200" : "border-orange-700/60 bg-black/80 text-orange-400 hover:bg-orange-950"}`}
                        >
                          {cityHitboxEditMode ? "✅ Hitboxy ON" : "🎯 Edytuj hitboxy"}
                        </button>
                      </div>
                      {/* ─── Strzałki nawigacji miasta ─── */}
                      {panX < 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPanX(prev => Math.min(0, prev + Math.round(BASE_W * 0.5))); }}
                          className="pointer-events-auto absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                          style={{ left:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                          aria-label="Przewiń w lewo"
                        >‹</button>
                      )}
                      {panX > -FARM_MAX_PAN && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPanX(prev => Math.max(-FARM_MAX_PAN, prev - Math.round(BASE_W * 0.5))); }}
                          className="pointer-events-auto absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                          style={{ right:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite 0.4s", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                          aria-label="Przewiń w prawo"
                        >›</button>
                      )}
                      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                        {Array.from({length: 3}).map((_,i) => {
                          const segW = FARM_MAX_PAN / 2;
                          const active = Math.round(-panX / segW) === i;
                          return <div key={i} className={`h-1.5 rounded-full transition-all ${active ? "w-6 bg-amber-400" : "w-2 bg-white/20"}`} />;
                        })}
                      </div>
                    </>
                  )}

                  {/* ═══ RATUSZ ═══ */}
                    {currentMap === "city_townhall" && (() => {
                        const imageW = 4096;
                        const imageH = 1536;
                        const townHallScale = Math.min(BASE_H / imageH, 1);
                        const renderedW = Math.round(imageW * townHallScale);
                        const TH_W = imageW;
                        const maxCamX = Math.max(0, renderedW - BASE_W);
                        const triggerHitbox = (action: string) => {
                          if (action === "ranking") { void loadRanking(); setShowRankingPanel(true); }
                          else if (action === "club") setShowGildiaPanel(true);
                          else if (action === "event") setShowMisjePanel(true);
                        };
                        const hbIcon = (action: string) => action === "ranking" ? "🏆" : action === "club" ? "⚔️" : "📜";
                        return (
                        <div
                          ref={thContainerRef}
                          className="pointer-events-auto absolute inset-0 overflow-hidden select-none"
                          style={{ cursor: thHitboxEditMode ? "default" : thDragRef.current ? "grabbing" : "grab" }}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            if (thHitboxEditMode) return;
                            thDragRef.current = { startX: e.clientX / gameScale, startCamX: townHallCamX };
                          }}
                          onMouseMove={(e) => {
                            const rect = thContainerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setThMouseOnPanorama({
                                x: Math.round(((e.clientX - rect.left) / gameScale + townHallCamX) / townHallScale),
                                y: Math.round((e.clientY - rect.top) / gameScale / townHallScale),
                              });
                            }
                            const txtDrag = thTextDragRef.current;
                            if (txtDrag) {
                              const dmx = (e.clientX - txtDrag.startMX) / gameScale / townHallScale;
                              const dmy = (e.clientY - txtDrag.startMY) / gameScale / townHallScale;
                              setRankingTextLayout(prev => {
                                if (txtDrag.prop === "startX")     return { ...prev, startX:     Math.max(0,  Math.round(txtDrag.startVal + dmx)) };
                                if (txtDrag.prop === "nameX")      return { ...prev, nameX:      Math.max(20, Math.round(txtDrag.startVal + dmx)) };
                                if (txtDrag.prop === "scoreRight") return { ...prev, scoreRight: Math.max(0,  Math.round(txtDrag.startVal - dmx)) };
                                if (txtDrag.prop === "startY")     return { ...prev, startY:     Math.max(0,  Math.round(txtDrag.startVal + dmy)) };
                                if (txtDrag.prop === "rowHeight")  return { ...prev, rowHeight:  Math.max(20, Math.round(txtDrag.startVal + dmy)) };
                                return prev;
                              });
                              return;
                            }
                            const hbDrag = thHbDragRef.current;
                            if (hbDrag) {
                              const dx = (e.clientX - hbDrag.startX) / gameScale / townHallScale;
                              const dy = (e.clientY - hbDrag.startY) / gameScale / townHallScale;
                              setTownHallHitboxes(prev => prev.map(hb => {
                                if (hb.id !== hbDrag.hbId) return hb;
                                if (hbDrag.mode === "move")   return { ...hb, x: Math.max(0, Math.round(hbDrag.startHbX + dx)), y: Math.max(0, Math.round(hbDrag.startHbY + dy)) };
                                return { ...hb, width: Math.max(80, Math.round(hbDrag.startW + dx)), height: Math.max(40, Math.round(hbDrag.startH + dy)) };
                              }));
                              return;
                            }
                            if (thDragRef.current) {
                              const dx2 = e.clientX / gameScale - thDragRef.current.startX;
                              setTownHallCamX(Math.max(0, Math.min(maxCamX, thDragRef.current.startCamX - dx2)));
                            }
                          }}
                          onMouseUp={() => { thDragRef.current = null; thHbDragRef.current = null; thTextDragRef.current = null; }}
                          onMouseLeave={() => { thDragRef.current = null; thHbDragRef.current = null; thTextDragRef.current = null; }}
                        >
                          {/* Panorama — przesuwa się z kamerą */}
                          <div
                            className="absolute top-0"
                            style={{ width: TH_W, height: imageH, transform: `translateX(-${townHallCamX}px) scale(${townHallScale})`, transformOrigin: "top left", backgroundImage: "url('/mapy/city_townhall.png')", backgroundSize: `${imageW}px ${imageH}px`, backgroundRepeat: "no-repeat", imageRendering: "pixelated" }}
                          >
                            {townHallHitboxes.map(hb => {
                              if (thHitboxEditMode && !(hb.action === "ranking" && thTextEditMode)) {
                                const dragging = thHbDragRef.current?.hbId === hb.id;
                                return (
                                  <div
                                    key={hb.id}
                                    className="absolute flex items-center justify-center cursor-move"
                                    style={{ left: hb.x, top: hb.y, width: hb.width, height: hb.height, border: `2px solid ${dragging ? "#f97316" : "#fb923c"}`, background: dragging ? "rgba(249,115,22,0.25)" : "rgba(194,65,12,0.18)" }}
                                    onMouseDown={(e) => {
                                      if (e.button !== 0) return;
                                      e.stopPropagation(); e.preventDefault();
                                      thHbDragRef.current = { hbId: hb.id, startX: e.clientX, startY: e.clientY, startHbX: hb.x, startHbY: hb.y, mode: "move", startW: hb.width, startH: hb.height };
                                    }}
                                  >
                                    <span className="text-orange-200 font-bold text-sm pointer-events-none">{hb.label}</span>
                                    <span className="text-[10px] text-orange-300/70 ml-2 pointer-events-none">({hb.x},{hb.y})</span>
                                    <div
                                      className="absolute bottom-0 right-0 w-4 h-4 bg-orange-500 cursor-se-resize"
                                      style={{ borderTopLeftRadius: 3 }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation(); e.preventDefault();
                                        thHbDragRef.current = { hbId: hb.id, startX: e.clientX, startY: e.clientY, startHbX: hb.x, startHbY: hb.y, mode: "resize", startW: hb.width, startH: hb.height };
                                      }}
                                    />
                                  </div>
                                );
                              }

                              const hbStyle: React.CSSProperties = {
                                left: hb.x, top: hb.y, width: hb.width, height: hb.height,
                                border: "1px solid rgba(255,215,120,0.18)",
                                background: "transparent",
                                transition: "all 0.18s ease",
                              };
                              const onHover = (e: React.MouseEvent<HTMLDivElement>, enter: boolean) => {
                                const el = e.currentTarget as HTMLDivElement;
                                el.style.background = enter ? "rgba(255,215,120,0.05)" : "transparent";
                                el.style.boxShadow = enter ? "0 0 18px rgba(255,215,120,0.22)" : "none";
                              };

                              if (hb.action === "ranking") {
                                const miniRanking = [...rankingData]
                                  .sort((a, b) => (b.farm_power ?? 0) - (a.farm_power ?? 0))
                                  .slice(0, 9);
                                const rtl = rankingTextLayout;
                                const shadow = "0 1px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)";
                                type RankEntry = { name:string; score:string; color:string; weight:number };
                                const renderRankingRows = (entries: RankEntry[]) => entries.map((p, i) => (
                                  <div key={`r-${i}`} style={{ position:"absolute", top: rtl.startY + i*rtl.rowHeight, left: rtl.startX, right:0, height: rtl.rowHeight, display:"flex", alignItems:"center", pointerEvents:"none" }}>
                                    <span style={{ width: rtl.nameX - rtl.startX, textAlign:"right", fontSize:rtl.fontSize, color:p.color, fontWeight:900, textShadow:shadow, flexShrink:0 }}>{i+1}.</span>
                                    <span style={{ flex:1, marginLeft:8, fontSize:rtl.fontSize, color:p.color, fontWeight:p.weight, textShadow:shadow, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{p.name}</span>
                                    <span style={{ flexShrink:0, marginRight:rtl.scoreRight, fontSize:Math.round(rtl.fontSize*0.9), color:p.color, fontFamily:"monospace", fontWeight:700, textShadow:shadow }}>{p.score}</span>
                                  </div>
                                ));
                                const PREVIEW = [
                                  { name:"PrzykładowyNick", score:"12 345" }, { name:"FarmerTest",     score:"8 901"  },
                                  { name:"Gracz123",        score:"4 567"  }, { name:"RolnikPro",      score:"2 110"  },
                                  { name:"WioskaX",         score:"1 890"  }, { name:"Farmer99",       score:"1 245"  },
                                  { name:"PolowyKról",      score:"987"    }, { name:"StartingUp",     score:"432"    },
                                  { name:"Nowicjusz",       score:"100"    },
                                ];
                                const rankColor = (i: number) => i===0?"#fbbf24":i===1?"#d1d5db":i===2?"#c97c3a":"rgba(255,235,180,0.85)";
                                const rankWeight = (i: number) => i===0?900:i<3?700:600;
                                const previewEntries: RankEntry[] = PREVIEW.map((p, i) => ({ name:p.name, score:p.score, color:rankColor(i), weight:rankWeight(i) }));
                                const realEntries: RankEntry[] = miniRanking.map((p, i) => ({ name:p.player_name, score:(p.farm_power??0).toLocaleString("pl-PL"), color:rankColor(i), weight:rankWeight(i) }));
                                const startDrag = (prop: "startX"|"startY"|"rowHeight"|"nameX"|"scoreRight", val: number) => ({
                                  onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); thTextDragRef.current = { prop, startMX: e.clientX, startMY: e.clientY, startVal: val }; },
                                  onClick: (e: React.MouseEvent) => e.stopPropagation(),
                                });
                                const lbl = (_txt: string, extra?: React.CSSProperties) => ({
                                  fontSize:10, color:"#ffd76a", fontFamily:"monospace", fontWeight:"bold" as const,
                                  textShadow:"0 2px 4px #000", background:"rgba(0,0,0,0.72)",
                                  border:"1px solid rgba(255,215,106,0.5)", borderRadius:3,
                                  padding:"1px 5px", whiteSpace:"nowrap" as const, pointerEvents:"none" as const,
                                  ...extra,
                                });
                                return (
                                  <div
                                    key={hb.id}
                                    className="absolute overflow-hidden"
                                    style={{ ...hbStyle, cursor: thTextEditMode ? "default" : "pointer" }}
                                    onClick={thTextEditMode ? undefined : () => triggerHitbox(hb.action)}
                                    onMouseEnter={(e) => { if (!thTextEditMode) onHover(e, true); }}
                                    onMouseLeave={(e) => { if (!thTextEditMode) onHover(e, false); }}
                                  >
                                    {/* ── Overlay edycji tekstu ── */}
                                    {thTextEditMode && (
                                      <div className="absolute inset-0" style={{ overflow:"hidden", pointerEvents:"auto", background:"rgba(0,0,0,0.55)", zIndex:999 }}>

                                        {/* ── Poziome linie wierszy ── */}
                                        {Array.from({ length: 9 }).map((_, i) => (
                                          <div key={`rg-${i}`} style={{ position:"absolute", left:0, right:0, top: rtl.startY + i*rtl.rowHeight, height:rtl.rowHeight, borderTop:`${i===0?"2px solid":"1px solid"} rgba(255,215,106,${i===0?0.85:0.4})`, boxSizing:"border-box", pointerEvents:"none" }} />
                                        ))}
                                        <div style={{ position:"absolute", left:0, right:0, top: rtl.startY+9*rtl.rowHeight, height:2, background:"rgba(255,215,106,0.4)", pointerEvents:"none" }} />

                                        {/* ── Podgląd wpisów (preview lub prawdziwe dane) ── */}
                                        {renderRankingRows(thShowPreviewRanking ? previewEntries : realEntries)}

                                        {/* ── Pionowa linia startX (biała) — przeciągalna ── */}
                                        <div style={{ position:"absolute", top:0, bottom:0, left: rtl.startX, width:3, background:"rgba(255,255,255,0.7)", cursor:"ew-resize", zIndex:12 }} {...startDrag("startX", rtl.startX)}>
                                          <span style={{ ...lbl(""), position:"absolute", top:12, left:4 }}>startX={rtl.startX}</span>
                                        </div>

                                        {/* ── Pionowa linia nameX (złota) — przeciągalna ── */}
                                        <div style={{ position:"absolute", top:0, bottom:0, left: rtl.nameX, width:3, background:"rgba(255,215,106,0.9)", cursor:"ew-resize", zIndex:11 }} {...startDrag("nameX", rtl.nameX)}>
                                          <span style={{ ...lbl(""), position:"absolute", top:40, left:4 }}>Nr | Nick<br/>nameX={rtl.nameX}</span>
                                        </div>
                                        {/* Nagłówki Nr / Nick */}
                                        <div style={{ position:"absolute", top:4, left: rtl.startX, width: rtl.nameX - rtl.startX, display:"flex", justifyContent:"center", pointerEvents:"none" }}>
                                          <span style={lbl("")}>Nr</span>
                                        </div>
                                        <div style={{ position:"absolute", top:4, left: rtl.nameX+6, pointerEvents:"none" }}>
                                          <span style={lbl("")}>Nick</span>
                                        </div>

                                        {/* ── Pionowa linia scoreRight (zielona) — przeciągalna ── */}
                                        <div style={{ position:"absolute", top:0, bottom:0, right: rtl.scoreRight, width:3, background:"rgba(100,255,150,0.9)", cursor:"ew-resize", zIndex:11 }} {...startDrag("scoreRight", rtl.scoreRight)}>
                                          <span style={{ ...lbl(""), position:"absolute", top:40, right:4, color:"#86efac", border:"1px solid rgba(100,255,150,0.5)" }}>Moc farmy<br/>right={rtl.scoreRight}</span>
                                        </div>
                                        <div style={{ position:"absolute", top:4, right: rtl.scoreRight+6, pointerEvents:"none" }}>
                                          <span style={{ ...lbl(""), color:"#86efac", border:"1px solid rgba(100,255,150,0.5)" }}>Moc farmy</span>
                                        </div>

                                        {/* ── startY — belka — przeciągalna pionowo ── */}
                                        <div style={{ position:"absolute", left:0, right:0, top: rtl.startY-6, height:12, background:"rgba(255,180,0,0.9)", cursor:"ns-resize", display:"flex", alignItems:"center", justifyContent:"center", zIndex:13 }} {...startDrag("startY", rtl.startY)}>
                                          <span style={{ fontSize:12, color:"#fff", fontFamily:"monospace", fontWeight:"bold", textShadow:"0 1px 3px #000", pointerEvents:"none" }}>⬆⬇ StartY = {rtl.startY}</span>
                                        </div>

                                        {/* ── rowHeight — belka na końcu 1. wiersza — przeciągalna ── */}
                                        <div style={{ position:"absolute", left:0, right:0, top: rtl.startY+rtl.rowHeight-6, height:12, background:"rgba(200,70,10,0.9)", cursor:"ns-resize", display:"flex", alignItems:"center", justifyContent:"center", zIndex:13 }} {...startDrag("rowHeight", rtl.rowHeight)}>
                                          <span style={{ fontSize:12, color:"#fed7aa", fontFamily:"monospace", fontWeight:"bold", textShadow:"0 1px 3px #000", pointerEvents:"none" }}>⬆⬇ RowHeight = {rtl.rowHeight}</span>
                                        </div>

                                        {/* ── Przełącznik preview/prawdziwe dane ── */}
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setThShowPreviewRanking(p => !p); }}
                                          style={{ position:"absolute", bottom:8, right:8, fontSize:11, fontFamily:"monospace", fontWeight:"bold", color: thShowPreviewRanking ? "#ffd76a" : "#86efac", background:"rgba(0,0,0,0.75)", border:`1px solid ${thShowPreviewRanking ? "rgba(255,215,106,0.6)" : "rgba(100,255,150,0.6)"}`, borderRadius:4, padding:"3px 8px", cursor:"pointer", zIndex:14 }}
                                        >
                                          {thShowPreviewRanking ? "👁️ Dane testowe" : "👁️ Prawdziwe dane"}
                                        </button>
                                      </div>
                                    )}
                                    {/* ── Treść rankingu (normalny tryb) ── */}
                                    {!thTextEditMode && (
                                      <div className="absolute inset-0 pointer-events-none" style={{ overflow:"hidden" }}>
                                        {rankingLoading ? (
                                          <span style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", color:"rgba(255,235,160,0.5)", fontSize:rtl.fontSize, textShadow:shadow }}>Ładowanie rankingu...</span>
                                        ) : miniRanking.length === 0 ? (
                                          <span style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", color:"rgba(255,235,160,0.4)", fontSize:rtl.fontSize, textShadow:shadow }}>Brak danych rankingu</span>
                                        ) : renderRankingRows(realEntries)}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={hb.id}
                                  className="absolute cursor-pointer"
                                  style={hbStyle}
                                  onClick={() => triggerHitbox(hb.action)}
                                  onMouseEnter={(e) => onHover(e, true)}
                                  onMouseLeave={(e) => onHover(e, false)}
                                />
                              );
                            })}
                          </div>

                          {/* ─── Przyciski stałe (viewport) ─── */}
                          <button
                            type="button"
                            onClick={() => { handleChangeMap("city"); setThHitboxEditMode(false); }}
                            className="absolute left-4 top-4 rounded-2xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-base font-black text-[#f3e6c8] shadow-2xl backdrop-blur-sm transition hover:border-yellow-400/60 z-10"
                          >
                            ← Wróć do miasta
                          </button>

                          <button
                            type="button"
                            onClick={() => { setThHitboxEditMode(prev => !prev); setThTextEditMode(false); }}
                            className={`absolute left-4 top-20 rounded-2xl border px-5 py-2.5 text-sm font-black shadow-2xl backdrop-blur-sm transition z-10 ${thHitboxEditMode ? "border-orange-400 bg-[rgba(120,50,10,0.95)] text-orange-200 hover:brightness-110" : "border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] text-[#f3e6c8] hover:border-yellow-400/60"}`}
                          >
                            {thHitboxEditMode ? "✅ Zakończ edycję" : "🛠️ Edytuj hitboxy"}
                          </button>

                          {thHitboxEditMode && (
                            <button
                              type="button"
                              onClick={() => setThTextEditMode(prev => !prev)}
                              className={`absolute left-4 rounded-2xl border px-5 py-2.5 text-sm font-black shadow-2xl backdrop-blur-sm transition z-10 ${thTextEditMode ? "border-blue-400 bg-[rgba(10,30,80,0.95)] text-blue-200 hover:brightness-110" : "border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] text-[#f3e6c8] hover:border-blue-400/60"}`}
                              style={{ top: 136 }}
                            >
                              {thTextEditMode ? "✅ Zakończ edycję tekstu" : "✏️ Edytuj tekst rankingu"}
                            </button>
                          )}

                          {/* ─── Panel edycji ─── */}
                          {thHitboxEditMode && (
                            <div className="absolute left-4 z-20 w-72 rounded-2xl border border-orange-500/60 bg-[rgba(20,10,2,0.96)] p-4 text-xs text-orange-100 shadow-2xl backdrop-blur-sm space-y-3" style={{ top: thTextEditMode ? 196 : 168 }}>
                              <div className="font-black text-orange-300 text-sm">🛠️ Tryb edycji hitboxów</div>

                              {/* Pozycja myszy */}
                              <div className="flex gap-2 items-center bg-black/30 rounded-lg px-3 py-1.5">
                                <span className="text-orange-400 font-bold">Mysz:</span>
                                <span className="font-mono">{thMouseOnPanorama.x}, {thMouseOnPanorama.y}</span>
                              </div>

                              {/* Lista hitboxów */}
                              <div className="space-y-2">
                                {townHallHitboxes.map(hb => (
                                  <div key={hb.id} className="bg-black/30 rounded-lg px-3 py-2 space-y-0.5">
                                    <div className="font-black text-orange-200">{hb.label}</div>
                                    <div className="font-mono text-orange-100/80">x={hb.x}  y={hb.y}</div>
                                    <div className="font-mono text-orange-100/80">w={hb.width}  h={hb.height}</div>
                                  </div>
                                ))}
                              </div>

                              {/* Kopiuj hitboxy JSON */}
                              <button
                                type="button"
                                className="w-full rounded-xl border border-orange-500/60 bg-orange-900/40 py-2 font-black text-orange-200 hover:brightness-110 transition"
                                onClick={() => { void navigator.clipboard.writeText("const townHallHitboxes = " + JSON.stringify(townHallHitboxes, null, 2) + ";"); }}
                              >
                                📋 Kopiuj JSON hitboxów
                              </button>

                              {/* ── Sekcja layoutu tekstu ── */}
                              {thTextEditMode && (
                                <div className="border-t border-blue-500/30 pt-3 space-y-2">
                                  <div className="font-black text-blue-300 text-sm">✏️ Layout tekstu rankingu</div>
                                  <div className="text-blue-200/60 text-[10px]">Przeciągnij linie na tablicy lub użyj ±</div>
                                  {(Object.entries(rankingTextLayout) as [keyof typeof rankingTextLayout, number][]).map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between bg-black/30 rounded-lg px-2 py-1">
                                      <span className="text-blue-200 font-mono w-24">{k}</span>
                                      <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => setRankingTextLayout(prev => ({ ...prev, [k]: Math.max(0, prev[k] - 1) }))} className="text-blue-300 w-5 text-center hover:text-white font-bold">−</button>
                                        <span className="font-mono text-blue-100 w-10 text-center">{v}</span>
                                        <button type="button" onClick={() => setRankingTextLayout(prev => ({ ...prev, [k]: prev[k] + 1 }))} className="text-blue-300 w-5 text-center hover:text-white font-bold">+</button>
                                      </div>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    className={`w-full rounded-xl border py-2 font-black hover:brightness-110 transition ${thShowPreviewRanking ? "border-amber-500/60 bg-amber-900/40 text-amber-200" : "border-green-500/60 bg-green-900/40 text-green-200"}`}
                                    onClick={() => setThShowPreviewRanking(p => !p)}
                                  >
                                    {thShowPreviewRanking ? "👁️ Dane testowe (kliknij → prawdziwe)" : "👁️ Prawdziwe dane (kliknij → testowe)"}
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full rounded-xl border border-blue-500/60 bg-blue-900/40 py-2 font-black text-blue-200 hover:brightness-110 transition"
                                    onClick={() => { void navigator.clipboard.writeText("const rankingTextLayout = " + JSON.stringify(rankingTextLayout, null, 2) + ";"); }}
                                  >
                                    📋 Kopiuj layout
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ─── Strzałki nawigacji ─── */}
                          {townHallCamX > 0 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setTownHallCamX(prev => Math.max(0, prev - Math.round(BASE_W * 0.5))); }}
                              className="absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                              style={{ left:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                              aria-label="Przewiń w lewo"
                            >‹</button>
                          )}
                          {townHallCamX < maxCamX && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setTownHallCamX(prev => Math.min(maxCamX, prev + Math.round(BASE_W * 0.5))); }}
                              className="absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                              style={{ right:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite 0.4s", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                              aria-label="Przewiń w prawo"
                            >›</button>
                          )}
                          <style>{`@keyframes thArrowPulse { 0%,100%{opacity:0.5;transform:translateY(-50%) scale(1)} 50%{opacity:1;transform:translateY(-50%) scale(1.25)} }`}</style>

                          {/* Wskaźnik pozycji kamery */}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
                            {Array.from({length: 3}).map((_,i) => {
                              const segW = maxCamX / 2;
                              const active = Math.round(townHallCamX / segW) === i;
                              return <div key={i} className={`h-1.5 rounded-full transition-all ${active ? "w-6 bg-amber-400" : "w-2 bg-white/20"}`} />;
                            })}
                          </div>
                        </div>
                        );
                      })()}

                  {/* ═══ LIGA FARMERÓW ═══ */}
                  {currentMap === "city_liga" && (() => {
                    const myFP = computeFarmPower(playerStats, charEquipped, hiveData.level, orchardState, barnState);
                    const sorted = [...rankingData].sort((a,b) => (b.farm_power??0)-(a.farm_power??0));
                    const myRank = sorted.findIndex(p => p.user_id === profile?.id);
                    const total = sorted.length;
                    function getLigaTier(rank: number, tot: number): {name:string;color:string;icon:string;bg:string;border:string} {
                      if (tot === 0 || rank < 0) return {name:"Liga Drewna",color:"#9ca3af",icon:"🌿",bg:"rgba(20,20,20,0.7)",border:"#374151"};
                      if (rank === 0) return {name:"Liga Mistrzów",color:"#f97316",icon:"🏆",bg:"rgba(50,20,5,0.85)",border:"#f97316"};
                      const pct = rank / tot;
                      if (pct <= 0.10) return {name:"Liga Złota",color:"#f2ca69",icon:"🥇",bg:"rgba(45,30,0,0.85)",border:"#f2ca69"};
                      if (pct <= 0.30) return {name:"Liga Srebrna",color:"#94a3b8",icon:"🥈",bg:"rgba(25,30,40,0.85)",border:"#94a3b8"};
                      if (pct <= 0.60) return {name:"Liga Brązowa",color:"#c9952f",icon:"🥉",bg:"rgba(40,22,5,0.85)",border:"#c9952f"};
                      return {name:"Liga Drewna",color:"#9ca3af",icon:"🌿",bg:"rgba(20,20,20,0.7)",border:"#374151"};
                    }
                    const myTier = getLigaTier(myRank, total);
                    const TABS = [{id:"ranking",label:"🏆 Ranking"},{id:"wyzwanie",label:"⚔️ Wyzwanie"},{id:"nagrody",label:"🎁 Ligi & Nagrody"}] as const;
                    return (
                      <div className="pointer-events-auto absolute inset-0 overflow-hidden flex flex-col" style={{background:"linear-gradient(180deg,rgba(6,18,6,0.97) 0%,rgba(12,7,2,0.97) 100%)"}}>
                        {/* Header */}
                        <div className="shrink-0 flex items-center justify-between px-10 pt-6 pb-4 border-b border-green-900/40">
                          <div className="flex items-center gap-5">
                            <span className="text-5xl drop-shadow-[0_0_16px_rgba(34,197,94,0.6)]">🌾</span>
                            <div>
                              <p className="text-xs uppercase tracking-[0.35em] text-green-600/70">Miasto · Rywalizacja</p>
                              <h1 className="text-3xl font-black text-[#f9e7b2] leading-tight">Liga Farmerów</h1>
                            </div>
                          </div>
                          {/* Moja liga + moc */}
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs text-[#8b6a3e] uppercase tracking-widest">Moja Moc Farmy</p>
                              <p className="text-2xl font-black text-yellow-300 tabular-nums">⭐ {myFP.toLocaleString("pl-PL")}</p>
                            </div>
                            <div className="flex flex-col items-center justify-center rounded-2xl px-5 py-3 border text-center" style={{background:myTier.bg,borderColor:myTier.border}}>
                              <span className="text-2xl leading-none">{myTier.icon}</span>
                              <p className="mt-1 text-sm font-black whitespace-nowrap" style={{color:myTier.color}}>{myTier.name}</p>
                              {myRank >= 0 && <p className="text-[11px] text-white/50 mt-0.5">#{myRank+1} z {total}</p>}
                            </div>
                            <button type="button" onClick={() => { void handleChangeMap("city"); }}
                              className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-3 text-sm font-black text-[#2f1b0c] shadow-lg hover:brightness-105 transition">
                              ← Miasto
                            </button>
                          </div>
                        </div>
                        {/* Tabs */}
                        <div className="shrink-0 flex gap-1 px-10 py-3 border-b border-green-900/30">
                          {TABS.map(t => (
                            <button key={t.id} type="button" onClick={() => setLigaTab(t.id)}
                              className={`rounded-xl px-5 py-2 text-sm font-bold transition ${ligaTab===t.id ? "bg-green-900/70 text-green-300 border border-green-700/60" : "text-[#8b6a3e] hover:text-[#f3e6c8] hover:bg-white/5"}`}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-10 py-6">
                          {/* ─── TAB: RANKING ─── */}
                          {ligaTab === "ranking" && (
                            <div>
                              {rankingLoading ? (
                                <div className="flex items-center justify-center h-48 text-[#8b6a3e]">
                                  <span className="animate-pulse text-2xl">Ładowanie rankingu…</span>
                                </div>
                              ) : sorted.length === 0 ? (
                                <p className="text-center text-[#8b6a3e] py-16">Brak graczy w rankingu.</p>
                              ) : (
                                <div className="space-y-2">
                                  {sorted.map((p, i) => {
                                    const isMe = p.user_id === profile?.id;
                                    const tier = getLigaTier(i, total);
                                    const fp = p.farm_power ?? 0;
                                    const maxFP = (sorted[0]?.farm_power ?? 1) || 1;
                                    const barW = Math.round((fp / maxFP) * 100);
                                    return (
                                      <div key={p.user_id} className={`flex items-center gap-4 rounded-2xl border px-5 py-3 transition ${isMe ? "border-yellow-500/60 bg-yellow-500/10" : "border-[#8b6a3e]/20 bg-white/3 hover:bg-white/5"}`}>
                                        <span className="w-8 text-center font-black text-[#d8ba7a] text-lg shrink-0">
                                          {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                                        </span>
                                        <img src={ALL_SKINS[isMe?(avatarSkin>=0?avatarSkin:0):((p.avatar_skin??-1)>=0?(p.avatar_skin??0):0)]??ALL_SKINS[0]}
                                          alt={p.player_name} className="h-12 w-12 rounded-full border-2 object-cover shrink-0"
                                          style={{borderColor:tier.border,imageRendering:"pixelated"}} />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className={`font-bold truncate ${isMe?"text-yellow-200":"text-[#f3e6c8]"}`}>{p.player_name}</span>
                                            <span className="text-xs shrink-0" style={{color:tier.color}}>{tier.icon} {tier.name}</span>
                                          </div>
                                          <div className="mt-1 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{width:`${barW}%`,background:`linear-gradient(90deg,${tier.color}80,${tier.color})`}} />
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <p className={`font-black tabular-nums text-lg ${isMe?"text-yellow-300":"text-[#f2ca69]"}`}>⭐ {fp.toLocaleString("pl-PL")}</p>
                                          <p className="text-xs text-[#8b6a3e]">Poz. {i+1}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {/* ─── TAB: WYZWANIE ─── */}
                          {ligaTab === "wyzwanie" && (
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-green-600/60 mb-4">Wybierz przeciwnika i porównaj rancza</p>
                              {rankingLoading ? (
                                <div className="flex items-center justify-center h-48 text-[#8b6a3e]"><span className="animate-pulse text-2xl">Ładowanie…</span></div>
                              ) : (
                                <div className="space-y-3">
                                  {sorted.filter(p => p.user_id !== profile?.id).map((opp, i) => {
                                    const oppFP = opp.farm_power ?? 0;
                                    const winChance = oppFP === 0 ? 99 : Math.min(99, Math.max(1, Math.round(myFP / (myFP + oppFP) * 100)));
                                    const chanceColor = winChance >= 60 ? "#4ade80" : winChance >= 40 ? "#f2ca69" : "#f87171";
                                    const tier = getLigaTier(sorted.findIndex(s=>s.user_id===opp.user_id), total);
                                    return (
                                      <div key={opp.user_id} className="flex items-center gap-4 rounded-2xl border border-[#8b6a3e]/20 bg-white/3 px-5 py-4 hover:bg-white/5 transition">
                                        <span className="w-6 text-center text-sm text-[#8b6a3e] shrink-0">{i+1}</span>
                                        <img src={ALL_SKINS[((opp.avatar_skin??-1)>=0?(opp.avatar_skin??0):0)]??ALL_SKINS[0]}
                                          alt={opp.player_name} className="h-12 w-12 rounded-full border-2 object-cover shrink-0"
                                          style={{borderColor:tier.border,imageRendering:"pixelated"}} />
                                        <div className="flex-1 min-w-0">
                                          <p className="font-bold text-[#f3e6c8] truncate">{opp.player_name}</p>
                                          <p className="text-xs mt-0.5" style={{color:tier.color}}>{tier.icon} {tier.name} · ⭐ {(opp.farm_power??0).toLocaleString("pl-PL")} Mocy</p>
                                        </div>
                                        <div className="text-right shrink-0 mr-3">
                                          <p className="text-xs text-[#8b6a3e]">Szansa zwycięstwa</p>
                                          <p className="text-2xl font-black tabular-nums" style={{color:chanceColor}}>{winChance}%</p>
                                        </div>
                                        <button type="button"
                                          onClick={() => setMessage({type:"info",title:"Liga Farmerów",text:`Wyzwania sezonowe pojawią się w następnym sezonie. Twoja Moc Farmy to ${myFP.toLocaleString("pl-PL")} vs ${(opp.farm_power??0).toLocaleString("pl-PL")} ${opp.player_name}.`})}
                                          className="shrink-0 rounded-xl border border-green-700/60 bg-green-900/40 px-4 py-2 text-sm font-bold text-green-300 hover:bg-green-800/60 transition whitespace-nowrap">
                                          Rzuć wyzwanie
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {/* ─── TAB: NAGRODY ─── */}
                          {ligaTab === "nagrody" && (
                            <div className="space-y-5">
                              <p className="text-xs uppercase tracking-[0.3em] text-green-600/60 mb-2">Nagrody sezonowe przyznawane na koniec sezonu</p>
                              {([
                                {tier:"Liga Drewna",icon:"🌿",color:"#9ca3af",border:"#374151",bg:"rgba(20,20,20,0.7)",desc:"Idealna dla nowych farmerów.",rewards:["Mała ilość XP","Garść złota","Podstawowy ulepszacz upraw"],goal:"Zdobądź pierwsze doświadczenie w rywalizacji."},
                                {tier:"Liga Brązowa",icon:"🥉",color:"#c9952f",border:"#c9952f",bg:"rgba(40,22,5,0.8)",desc:"Dla aktywnych farmerów.",rewards:["Dobra ilość XP","Lepsze złoto","Boostery prędkości upraw","Rzadkie nasiona"],goal:"Regularnie zbieraj plony i obsługuj klientów."},
                                {tier:"Liga Srebrna",icon:"🥈",color:"#94a3b8",border:"#94a3b8",bg:"rgba(25,30,40,0.8)",desc:"Dla doświadczonych farmerów.",rewards:["Duża ilość XP","Boostery do klientów","Rzadkie i epiczne nasiona","Unikalny tytuł sezonu"],goal:"Rozwijaj farmę i wspinaj się w rankingu."},
                                {tier:"Liga Złota",icon:"🥇",color:"#f2ca69",border:"#f2ca69",bg:"rgba(45,30,0,0.85)",desc:"Dla najlepszych farmerów.",rewards:["Ogromna ilość XP","Legendarne uprawy","Bardzo rzadkie ulepszacze","Specjalny avatar sezonowy","Tytuł przy nicku: np. Mistrz Zbiorów"],goal:"Bądź w top 10% graczy serwera."},
                                {tier:"Liga Mistrzów",icon:"🏆",color:"#f97316",border:"#f97316",bg:"rgba(50,20,5,0.9)",desc:"Tylko dla absolutnej elity.",rewards:["Legendarny avatar z animowaną ramką","Unikalny kolor jednej litery nicku (token: 🎨 Farba Farmera)","Tytuł: Legenda Plonopolis / Cesarz Plonów","Nagroda do targu: token sprzedawalny innym graczom"],goal:"Zajmij pierwsze miejsca w globalnym rankingu."},
                              ] as Array<{tier:string;icon:string;color:string;border:string;bg:string;desc:string;rewards:string[];goal:string}>).map(lt => (
                                <div key={lt.tier} className="rounded-[20px] border p-6" style={{background:lt.bg,borderColor:lt.border}}>
                                  <div className="flex items-center gap-3 mb-3">
                                    <span className="text-3xl">{lt.icon}</span>
                                    <div>
                                      <h3 className="text-xl font-black" style={{color:lt.color}}>{lt.tier}</h3>
                                      <p className="text-sm text-[#8b6a3e]">{lt.desc}</p>
                                    </div>
                                  </div>
                                  <ul className="space-y-1 mb-3">
                                    {lt.rewards.map(r => (
                                      <li key={r} className="flex items-center gap-2 text-sm text-[#dfcfab]">
                                        <span style={{color:lt.color}}>✦</span> {r}
                                      </li>
                                    ))}
                                  </ul>
                                  <p className="text-xs text-[#8b6a3e] italic">Cel: {lt.goal}</p>
                                </div>
                              ))}
                              <div className="rounded-2xl border border-green-900/40 bg-green-950/30 p-5 text-sm text-green-300/70 text-center">
                                System sezonowy pojawi się w jednym z kolejnych aktualizacji Plonopolis. Buduj Moc Farmy już teraz!
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                                          {/* ═══ INNE LOKACJE MIEJSKIE ═══ */}
                    {currentMap !== "city" && currentMap !== "city_townhall" && currentMap !== "city_liga" && currentMap.startsWith("city_") && (
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
            </>
          )}
          <div className="relative" style={{ width: BASE_W, height: BASE_H }}>
            {!profile ? (
              <>
                <div style={{ position: "absolute", left: loginPanelPos.left, top: loginPanelPos.top, width: loginPanelPos.width }}>
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
                            type="email"
                            placeholder="adres@email.pl"
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
                </div>
              </>
            ) : (
              <div className="relative min-h-screen w-full px-4 pt-8 md:px-8">


                {(isOnFarmMap || currentMap === "city_shop" || currentMap === "city_market") && (
                <div className={`fixed left-4 top-4 z-[95] transition-opacity duration-150 ${isFieldViewOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}>
                  <div className="flex flex-col items-start">
                    {/* Avatar gracza — kliknięcie otwiera Dom */}
                    <button
                      type="button"
                      onClick={() => { setShowDomModal(true); setDomTab("profil"); }}
                      onMouseEnter={() => setAvatarTipVisible(true)}
                      onMouseLeave={() => setAvatarTipVisible(false)}
                      onMouseMove={e => setAvatarTipPos(toGameCoords(e.clientX, e.clientY))}
                      className="flex shrink-0 items-center justify-center rounded-2xl border border-[#8b6a3e] bg-[rgba(38,24,14,0.94)] shadow-2xl backdrop-blur-sm transition hover:border-yellow-400/60 hover:bg-[rgba(58,34,18,0.98)] overflow-hidden"
                      aria-label="Otwórz profil"
                    >
                      {avatarSkin >= 0
                        ? <img src={ALL_SKINS[avatarSkin]} alt="Avatar" className="h-[134px] w-[134px] object-cover" style={{imageRendering:"pixelated"}} />
                        : <span className="flex h-[134px] w-[134px] flex-col items-center justify-center gap-0.5 animate-pulse">
                            <span className="text-[#f9e7b2] text-[11px] font-black leading-tight text-center">Wybierz Avatar</span>
                            <span className="text-[#c9952f] text-[10px] font-bold">(kliknij)</span>
                          </span>}
                    </button>
                    <p className="mt-1 w-[134px] truncate text-center text-[16px] font-black text-[#d8ba7a] drop-shadow">{profile?.login ?? ""}</p>
                    {/* Panel plecaka — przeniesiony do Dom → zakładka Plecak */}
                    <div className="hidden">
                      <div
                        className={`max-h-[80vh] w-[440px] overflow-y-auto rounded-[24px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.88)] p-4 text-[#f3e6c8] shadow-2xl backdrop-blur-sm transition-all duration-150 ease-out ${
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
                            {(["uprawy","owoce","przedmioty"] as const).map(tab => (
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
                                          if (!crop) return null;
                                          const _qDef2 = _bQuality ? CROP_QUALITY_DEFS[_bQuality] : null;
                                          const _isRotten = _bQuality === "rotten";
                                          const _qualitySprite = _bQuality === "epic" && crop.epicSpritePath ? crop.epicSpritePath
      : _bQuality === "rotten" && crop.rottenSpritePath ? crop.rottenSpritePath
      : _bQuality === "legendary" && crop.legendarySpritePath ? crop.legendarySpritePath
      : crop.spritePath;
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
                            <div className="mt-3">
                              {(() => {
                                const ownedAnimals = ANIMAL_ITEMS.filter(it => (barnItems[it.id] ?? 0) > 0);
                                const hasEmptyJars = hiveData.empty_jars > 0;
                                const hasHoneyJars = hiveData.honey_jars > 0;
                                const hasSuit = hiveData.suit_durability > 0;
                                const compostKeys = Object.keys(seedInventory).filter(k => isCompostKey(k) && (seedInventory[k] ?? 0) > 0);
                                const hasAny = ownedAnimals.length > 0 || hasEmptyJars || hasHoneyJars || hasSuit || compostKeys.length > 0;
                                if (!hasAny) return (
                                  <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                                    Plecak jest pusty.
                                  </div>
                                );
                                return (
                                  <div className="grid grid-cols-4 gap-2">
                                    {ownedAnimals.map(it => {
                                      const animal = ANIMALS.find(a => a.itemId === it.id);
                                      const cnt = barnItems[it.id] ?? 0;
                                      return (
                                        <div key={it.id} className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default"
                                          onMouseEnter={() => setCardTip(<><p className="text-[20px] font-black text-[#f9e7b2]">{it.name}</p>{animal && <><p className="text-[18px] text-amber-300 mt-1">{animal.icon} Z {({'kura':'kury','krolik':'królika','krowa':'krowy','kaczka':'kaczki','owca':'owcy','swinia':'świni','koza':'kozy','indyk':'indyka','kon':'konia','byk':'byka'} as Record<string,string>)[animal.id] ?? animal.name.toLowerCase()}</p><p className="text-[17px] text-[#8b6a3e] mt-0.5">1 zbiór: {animal.prodMs/3600000}h</p></>}</>)}
                                          onMouseLeave={() => setCardTip(null)}>
                                          <div className="relative h-16 w-16 flex items-center justify-center">
                                            
                                            <img src={`/przedmioty/item_${it.id}.png`} alt={it.name} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[180%] w-[180%] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}} />
                                          </div>
                                          
                                          <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{cnt}</span>
                                        </div>
                                      );
                                    })}
                                    {hasEmptyJars && (
                                      <div className="group relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default">
                                        <img src="/przedmioty/jar_empty.png" alt="Słoik" className="h-12 w-12 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                        <p className="mt-1 text-center text-[9px] font-bold text-[#dfcfab] leading-tight px-1">Puste słoiki</p>
                                        <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{hiveData.empty_jars}</span>
                                      </div>
                                    )}
                                    {hasHoneyJars && (
                                      <div className="group relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-amber-600/50 bg-[rgba(30,18,5,0.65)] cursor-default">
                                        <img src="/przedmioty/jar_honey.png" alt="Miód" className="h-12 w-12 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                        <p className="mt-1 text-center text-[9px] font-bold text-amber-300 leading-tight px-1">Miód</p>
                                        <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{hiveData.honey_jars}</span>
                                      </div>
                                    )}
                                    {hasSuit && (
                                      <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default"
                                        onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-[#f9e7b2]">Strój pszczelarza</p><p className="text-[11px] text-amber-300 mt-0.5">{hiveData.suit_durability} zbiorów pozostało</p><p className="text-[10px] text-[#8b6a3e] mt-0.5">Kup nowy w Sklepie → Przedmioty</p></>)}
                                        onMouseLeave={() => setCardTip(null)}>
                                        <img src="/przedmioty/beekeeper_suit.png" alt="Strój" className="h-10 w-10 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                        <p className="mt-0.5 text-center text-[9px] font-bold text-[#dfcfab] leading-tight px-1">Strój</p>
                                        <div className="mt-0.5 h-1 w-10 rounded-full bg-black/40 overflow-hidden">
                                          <div className="h-full rounded-full" style={{ width:`${hiveData.suit_durability}%`, background: hiveData.suit_durability > 30 ? "#22c55e" : "#ef4444" }} />
                                        </div>
                                      </div>
                                    )}
                                    {compostKeys
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
                                        const tierColor = tierIdx === 0 ? "#9ca3af" : tierIdx === 1 ? "#22c55e" : "#a78bfa";
                                        const isSel = selectedSeedId === cid;
                                        return (
                                          <div key={cid}
                                            draggable
                                            onDragStart={() => { setDraggedSeedId(cid); setSelectedSeedId(cid); setSelectedTool(null); }}
                                            onDragEnd={() => setDraggedSeedId(null)}
                                            onClick={() => { setSelectedSeedId(prev => prev === cid ? null : cid); setSelectedTool(null); }}
                                            onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-emerald-200">{def.icon} {def.name} <span style={{color: tierColor}}>({def.tierName(value)})</span></p><p className="text-[10px] text-emerald-300/80 mt-0.5">{def.desc}</p><p className="text-[11px] font-black mt-1" style={{color: tierColor}}>Bonus: {def.bonusLabel(value)}</p><p className="text-[10px] text-amber-300 mt-1">↗ Przeciągnij lub kliknij i wybierz puste pole</p></>)}
                                            onMouseLeave={() => setCardTip(null)}
                                            className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border cursor-pointer active:cursor-grabbing transition"
                                            style={isSel
                                              ? { borderColor: tierColor, background: "rgba(60,40,5,0.4)", boxShadow: `0 0 12px ${tierColor}66` }
                                              : { borderColor: "rgba(6,95,70,0.5)", background: "rgba(6,78,59,0.3)" }}>
                                            <span className="text-4xl leading-none">{def.icon}</span>
                                            <p className="mt-0.5 text-center text-[9px] font-bold leading-tight px-1" style={{color: tierColor}}>{def.tierName(value)}</p>
                                            {isSel && <p className="text-[8px] font-black text-amber-300">✓ zaznaczony</p>}
                                            <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">×{cnt}</span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* ZAKŁADKA: OWOCE */}
                          {backpackTab === "owoce" && (() => {
                            const entries = Object.entries(fruitInventory).filter(([,c]) => Number(c) > 0);
                            if (entries.length === 0) {
                              return (
                                <div className="mt-3 rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                                  Plecak jest pusty.
                                </div>
                              );
                            }
                            const _qOrd: Record<string, number> = { zgnile: 0, zwykly: 1, soczysty: 2, zloty: 3 };
                            const sorted = [...entries].sort(([aKey], [bKey]) => {
                              const aU = aKey.lastIndexOf("_"); const aFid = aKey.slice(0, aU); const aQ = aKey.slice(aU + 1);
                              const bU = bKey.lastIndexOf("_"); const bFid = bKey.slice(0, bU); const bQ = bKey.slice(bU + 1);
                              const aLv = TREES.find(t => t.fruitId === aFid)?.unlockLevel ?? 999;
                              const bLv = TREES.find(t => t.fruitId === bFid)?.unlockLevel ?? 999;
                              if (aLv !== bLv) return aLv - bLv;
                              return (_qOrd[aQ] ?? 0) - (_qOrd[bQ] ?? 0);
                            });
                            return (
                              <div className="mt-3 grid grid-cols-4 gap-2">
                                {sorted.map(([key, cnt]) => {
                                  const lastU = key.lastIndexOf("_");
                                  const fid = key.slice(0, lastU); const q = key.slice(lastU + 1) as FruitQuality;
                                  const tree = TREES.find(t => t.fruitId === fid);
                                  if (!tree) return null;
                                  const isZgnile = q === "zgnile";
                                  const qLabel = isZgnile ? "Zgniłe" : q === "zwykly" ? "Zwykłe" : q === "soczysty" ? "Soczysty" : "Złote";
                                  const borderColor = isZgnile ? "#ffffff" : q === "zwykly" ? "#ffffff" : q === "soczysty" ? "#22c55e" : "#f59e0b";
                                  const bgColor = isZgnile ? "rgba(255,255,255,0.05)" : q === "zwykly" ? "rgba(255,255,255,0.05)" : q === "soczysty" ? "rgba(20,80,30,0.5)" : "rgba(80,50,5,0.5)";
                                  const labelColor = isZgnile ? "#ffffff" : q === "zwykly" ? "#dfcfab" : q === "soczysty" ? "#22c55e" : "#f59e0b";
                                  return (
                                    <div key={key} className={`relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border ${isZgnile ? "cursor-not-allowed" : "cursor-default"}`}
                                      style={{ borderColor, background: bgColor, ...(q === "zloty" ? { animation: "legendaryPulse 2s ease-in-out infinite" } : {}) }}
                                      onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-[#f9e7b2]">{tree.fruitIcon} {tree.fruitName}</p><p className="text-[11px] mt-0.5" style={{color: labelColor}}>{qLabel}</p><p className="text-[10px] text-[#8b6a3e] mt-0.5">Masz: {Number(cnt)} szt.</p>{isZgnile && <p className="text-[10px] text-amber-400 mt-0.5 font-bold">Nie do sprzedaży — wrzuć do kompostu</p>}</>)}
                                      onMouseLeave={() => setCardTip(null)}>
                                      {isZgnile && <span className="absolute top-1 left-1 text-[10px] leading-none">⚠️</span>}
                                      {q === "zloty" && (
                                        <span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                          <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                        </span>
                                      )}
                                      <div className="relative h-16 w-16 flex items-center justify-center">
                                        <span className="text-4xl leading-none">{tree.fruitIcon}</span>
                                        <img src={`/owoce/owoc_${fid}.png`} alt={tree.fruitName} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[180%] w-[180%] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}} />
                                      </div>
                                      <p className="mt-0.5 text-center text-[9px] font-bold leading-tight px-1" style={{color: labelColor}}>{qLabel}</p>
                                      <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{Number(cnt)}</span>
                                    </div>
                                  );
                                })}
                                <p className="col-span-4 mt-1 text-[10px] text-[#8b6a3e] text-center">Sprzedasz owoce w Sadzie (przycisk „Sprzedaj wszystkie"). Zgniłe idą do kompostu.</p>
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
                <div className="flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-[1631px] flex-col rounded-[28px] border border-[#8b6a3e] bg-[rgba(22,13,8,0.98)] shadow-2xl">

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
                    <button onClick={() => setRankingSort("farmpower")}
                      className={rankingSort==="farmpower" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
                      Moc farmy
                    </button>
                    <button onClick={() => setRankingSort("level")}
                      className={rankingSort==="level" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
                      Poziom
                    </button>
                    <button onClick={() => setRankingSort("money")}
                      className={rankingSort==="money" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
                      Pieniądze
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
                            <th className="py-3 text-right">Moc farmy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...rankingData].sort((a,b) => {
                            if (rankingSort==="level") return (b.ranking_score ?? 0)-(a.ranking_score ?? 0);
                            if (rankingSort==="money") return b.money-a.money;
                            return (b.farm_power ?? 0)-(a.farm_power ?? 0);
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
                              <td className="py-3 text-right">
                                <span className={`font-bold ${isMe ? "text-yellow-300" : "text-[#f3e6c8]"}`}>
                                  {(p.farm_power ?? 0).toLocaleString("pl-PL")}
                                </span>
                              </td>
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
              <div className="flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-4xl flex-col rounded-[28px] border border-[#8b6a3e] bg-[rgba(22,13,8,0.98)] shadow-2xl">

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
                      onClick={openBlankCompose}
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
                    { key: "otrzymane", label: "Otrzymane", icon: "📥" },
                    { key: "wyslane",   label: "Wysłane",   icon: "📤" },
                    { key: "targ",      label: "Targ",      icon: "🏪" },
                  ] as const).map(tab => (
                    <button key={tab.key} onClick={() => { setMessageTab(tab.key); setSelectedMsgIds(new Set()); }}
                      className={`flex items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] transition border-b-2 ${messageTab === tab.key ? "border-[#d8ba7a] text-[#f9e7b2] bg-[rgba(80,50,20,0.3)]" : "border-transparent text-[#8b6a3e] hover:text-[#dfcfab]"}`}>
                      {tab.icon} {tab.label}
                      {tab.key === "otrzymane" && unreadCount > 0 && (
                        <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">{unreadCount}</span>
                      )}
                      {tab.key === "targ" && unreadMarketCount > 0 && (
                        <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-white">{unreadMarketCount}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Treść */}
                <div className="flex-1 overflow-y-auto p-5">
                  {showCompose ? (
                    <div className="relative z-10 flex h-full flex-col gap-4 pointer-events-auto">
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
                      if (messageTab === "systemowe") return m.category === "system";
                      if (messageTab === "otrzymane") return m.category === "received";
                      if (messageTab === "wyslane")   return m.category === "sent";
                      if (messageTab === "targ")      return m.category === "market";
                      return false;
                    });
                    const emptyIcon = messageTab === "systemowe" ? "🔔" : messageTab === "otrzymane" ? "📥" : messageTab === "targ" ? "🏪" : "📤";
                    if (filtered.length === 0) return (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#8b6a3e]">
                        <span className="text-7xl opacity-40">{emptyIcon}</span>
                        <p className="text-base">{messageTab === "targ" ? "Brak powiadomień handlowych" : "Brak wiadomości"}</p>
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
                            className={`relative rounded-2xl border p-5 transition ${selectedMsgIds.has(msg.id) ? "border-yellow-400/50 bg-yellow-900/10" : !msg.read && msg.category !== "sent" ? (msg.category === "market" ? "border-amber-500/60 bg-[rgba(80,45,5,0.45)]" : "border-[#d8ba7a]/60 bg-[rgba(80,50,15,0.45)]") : "border-[#8b6a3e]/40 bg-black/20"}`}>

                            {/* Checkbox zaznaczania */}
                            {msg.category !== "system" && (
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

                            {/* Received / System / Market: Od kogo → Tytuł → Treść */}
                            {(msg.category === "received" || msg.category === "system" || msg.category === "market") && (<>
                              <div className="mb-2 flex items-center gap-3">
                                {msg.category === "system" ? (
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#8b6a3e]/50 bg-black/30 text-xl">🔧</span>
                                ) : msg.category === "market" ? (
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-600/60 bg-amber-950/40 text-xl">🏪</span>
                                ) : (
                                  <img
                                    src={ALL_SKINS[msg.from_avatar_skin ?? 0] ?? ALL_SKINS[0]}
                                    alt={msg.from_username ?? ""}
                                    className="h-10 w-10 shrink-0 rounded-full object-cover border border-[#8b6a3e]/60"
                                    style={{imageRendering:"pixelated"}}
                                  />
                                )}
                                <div>
                                  <p className={`text-xs font-bold ${msg.category === "system" ? "text-red-400 tracking-wide uppercase" : msg.category === "market" ? "text-amber-400 tracking-wide uppercase" : "text-[#8b6a3e]"}`}>
                                    {msg.category === "system" ? "⚙️ System Plonopolis" : msg.category === "market" ? "🏪 System Targu" : (msg.from_username ?? "Nieznany")}
                                  </p>
                                  <p className={`text-lg font-black ${!msg.read ? "text-[#f9e7b2]" : "text-[#dfcfab]"}`}>
                                    {msg.subject || "(bez tytułu)"}
                                  </p>
                                </div>
                              </div>
                              <p className={`text-base leading-relaxed whitespace-pre-wrap ${msg.category === "system" ? "text-white" : msg.category === "market" ? "text-amber-100/90" : "text-[#dfcfab]/90"}`}>{msg.body}</p>
                            </>)}

                            {/* Sent: Od kogo (ja) → Do kogo → Tytuł → Treść */}
                            {msg.category === "sent" && (<>
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

                            {/* Akcje — Targ: tylko Usuń */}
                            {msg.category === "market" && (
                              <div className="mt-4 flex justify-end border-t border-[#8b6a3e]/20 pt-4">
                                <button type="button"
                                  onClick={() => void deleteMessage(msg.id)}
                                  className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-950/50 hover:border-red-500/60">
                                  🗑️ Usuń
                                </button>
                              </div>
                            )}
                            {/* Akcje — Otrzymane: Zapisz / Blokuj / Odpowiedz / Usuń */}
                            {msg.category === "received" && (
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
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4" style={{ zIndex: 9999 }}>
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
                              <img src="/ui/systemikona.png" alt="Plonopolis" className="h-32 w-32 object-contain" style={{imageRendering:"pixelated"}} />
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
                                <img src="/ui/systemikona.png" alt="" className="h-8 w-8 object-contain" style={{imageRendering:"pixelated"}} />
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
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-300">🐄 Dodaj produkty ze zwierząt (każdy rodzaj)</p>
                    <div className="flex flex-wrap gap-2">
                      {[5,10,50].map(amt => (
                        <button key={amt} onClick={() => handleAddBarnItems(amt)}
                          className="rounded-xl border border-orange-500/60 bg-orange-900/30 px-3 py-2 text-xs font-black text-orange-200 hover:bg-orange-900/50">
                          +{amt} każdy
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-[#8b6a3e]">🥚 jajka · 🐇 futra · 🥛 mleko · 🪶 pióra · 🧶 wełna · 💩 nawóz · 🥛 mleko kozie · 🪶 duże pióra · ⚡ energia · 🦴 rogi byka</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-pink-300">🍎 Dodaj owoce z sadu (każdy rodzaj × 4 jakości)</p>
                    <div className="flex flex-wrap gap-2">
                      {[5,10,50].map(amt => (
                        <button key={amt} onClick={() => handleAddFruits(amt)}
                          className="rounded-xl border border-pink-500/60 bg-pink-900/30 px-3 py-2 text-xs font-black text-pink-200 hover:bg-pink-900/50">
                          +{amt} każdy
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-[#8b6a3e]">🍎 jabłko · 🍐 gruszka · 🟣 śliwka · 🍒 wiśnia · 🍒 czereśnia · 🍑 brzoskwinia · 🟠 morela · 🍊 pomarańcza · 🍋 cytryna (zwykły / soczysty / złoty)</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">🍯 Dodaj słoiki miodu</p>
                    <div className="flex flex-wrap gap-2">
                      {[5,10,50].map(amt => (
                        <button key={amt} onClick={() => handleAddHoneyJars(amt)}
                          className="rounded-xl border border-amber-500/60 bg-amber-900/30 px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-900/50">
                          +{amt} 🍯
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
              <div className="relative flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-[1500px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl">
                <button onClick={() => { setShowShopModal(false); setShopCart({}); setShopError(""); }} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] hover:text-red-300">✕</button>
                {/* Sidebar — kategorie sklepu */}
                <div className="flex w-[308px] shrink-0 flex-col border-r border-[#8b6a3e]/30 bg-black/20">
                  <div className="flex flex-col gap-3 p-6 pt-14">
                    <p className="mb-3 text-[17px] font-black uppercase tracking-widest text-[#8b6a3e]">Sklep</p>
                    {(["nasiona","zwierzeta","drzewa","przedmioty"] as const).map(tab => (
                      <button key={tab} onClick={() => setShopTab(tab)}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[20px] font-bold transition ${
                          shopTab === tab ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"
                        }`}>
                        {tab === "nasiona" ? "Nasiona" : tab === "zwierzeta" ? "Zwierzęta" : tab === "drzewa" ? "Drzewa" : "Przedmioty"}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1" />
                  {/* Kasa gracza */}
                  <div className="border-t border-[#8b6a3e]/30 px-5 pt-5 pb-8">
                    <p className="text-sm text-[#8b6a3e] uppercase tracking-widest mb-1">Kasa</p>
                    <p className="text-2xl font-black text-[#f9e7b2]">{Number(displayMoney).toFixed(2)}</p>
                  </div>
                </div>
                {/* Content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-5 text-[#dfcfab]">
                    {shopTab === "nasiona" && (
                      <div>
                        {/* Lista wszystkich upraw — siatka 3 kolumny */}
                        <div className="grid grid-cols-3 gap-2">
                          {CROPS.filter(c => c.id !== "test_nasiono").map(crop => {
                            const locked = displayLevel < crop.unlockLevel;
                            const basePrice = CROP_PRICES[crop.id] ?? 0;
                            const isSuper = dailyPromos.super_.includes(crop.id);
                            const isNormal = dailyPromos.normal.includes(crop.id);
                            const disc = isSuper ? 0.8 : isNormal ? 0.9 : 1;
                            const effPrice = Math.round(basePrice * disc * 100) / 100;
                            const qty = shopCart[crop.id] ?? 0;
                            const owned = seedInventory[crop.id + "_good"] ?? 0;
                            const maxBuy = effPrice > 0 ? Math.floor(displayMoney / effPrice) : 0;
                            return (
                              <div key={crop.id} className={`flex flex-col rounded-xl border p-3 transition-all ${locked && isSuper ? "border-green-700/30 bg-green-900/5 opacity-60" : locked && isNormal ? "border-amber-700/30 bg-amber-900/5 opacity-60" : locked ? "border-[#374151]/30 bg-black/10 opacity-50" : isSuper && qty === 0 ? "promo-super bg-green-900/10" : isNormal && qty === 0 ? "promo-normal bg-amber-900/10" : qty > 0 ? "border-yellow-500/40 bg-yellow-900/10" : "border-[#8b6a3e]/30 bg-black/15"}`}>
                                {/* Górny rząd: promo lewo | nazwa środek | cena prawo */}
                                <div className="grid grid-cols-[1fr_auto_1fr] items-start w-full mb-2 gap-1">
                                  {/* Lewa: lock + promocja + czas */}
                                  <div className="flex flex-col gap-0.5 items-start">
                                    {locked && <span className="rounded-full bg-[#1f2937]/80 border border-[#374151]/60 px-1.5 py-0.5 text-[9px] font-black text-[#9ca3af]">🔒 Lvl {crop.unlockLevel}</span>}
                                    {isSuper && (
                                      <>
                                        <span className="rounded-full bg-green-900/40 border border-green-500/40 px-1.5 py-0.5 text-[9px] font-black text-green-300">⭐ -20%</span>
                                        {!locked && <span className="text-[13px] text-green-400/80 font-black">{promoCountdown}</span>}
                                      </>
                                    )}
                                    {isNormal && (
                                      <>
                                        <span className="rounded-full bg-amber-900/40 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-black text-amber-300">🔥 -10%</span>
                                        {!locked && <span className="text-[13px] text-amber-400/80 font-black">{promoCountdown}</span>}
                                      </>
                                    )}
                                  </div>
                                  {/* Środek: nazwa */}
                                  <p className={`text-[15px] font-black leading-tight text-center ${locked ? "text-[#6b7280]" : "text-[#f9e7b2]"}`}>{crop.name}</p>
                                  {/* Prawa: cena */}
                                  <div className="flex flex-col items-end">
                                    {(isNormal || isSuper) ? (
                                      <>
                                        <p className="text-[11px] text-[#8b6a3e] line-through leading-tight">{basePrice.toFixed(2)} 💰</p>
                                        <p className={`text-[15px] font-black leading-tight ${isSuper ? "text-green-300" : "text-amber-300"}`}>{effPrice.toFixed(2)} 💰</p>
                                      </>
                                    ) : (
                                      <p className="text-[15px] font-black text-[#8b6a3e] leading-tight">{effPrice.toFixed(2)} 💰</p>
                                    )}
                                  </div>
                                </div>
                                {/* Ikona wyśrodkowana */}
                                <div className="flex justify-center w-full mb-2">
                                  <img src={crop.spritePath} alt={crop.name} className="h-[96px] w-[96px] object-contain" style={{imageRendering:"pixelated"}} />
                                </div>
                                {/* Masz — dół wycentrowane */}
                                <p className="text-[16px] font-bold text-emerald-400 text-center mb-2">Masz: {owned}</p>
                                {/* Kontrolki ilości */}
                                {!locked && (
                                  <div className="flex items-center gap-1 w-full">
                                    <button onClick={() => setShopCart(c => ({...c,[crop.id]:Math.max(0,(c[crop.id]??0)-1)}))} className="h-7 w-7 shrink-0 rounded-md border border-[#8b6a3e]/40 bg-black/30 text-base font-black text-[#f9e7b2] hover:bg-red-900/30 hover:border-red-500/40 active:scale-75 active:bg-red-900/50 transition-all duration-75">−</button>
                                    <input type="number" min={0} value={qty} onChange={e => setShopCart(c => ({...c,[crop.id]:Math.max(0,Number(e.target.value))}))} className="min-w-0 flex-1 rounded-md border border-[#8b6a3e]/40 bg-black/30 px-1 py-1 text-center text-sm font-bold text-[#f9e7b2] focus:outline-none focus:border-yellow-400/60" />
                                    <button onClick={() => setShopCart(c => ({...c,[crop.id]:(c[crop.id]??0)+1}))} className="h-7 w-7 shrink-0 rounded-md border border-[#8b6a3e]/40 bg-black/30 text-base font-black text-[#f9e7b2] hover:bg-emerald-900/30 hover:border-emerald-500/40 active:scale-75 active:bg-emerald-900/50 transition-all duration-75">+</button>
                                    <button onClick={() => setShopCart(c => ({...c,[crop.id]:maxBuy}))} disabled={maxBuy === 0} className={`shrink-0 rounded-md border px-1.5 py-1 text-[9px] font-black transition-all duration-75 ${maxBuy > 0 ? "border-amber-500/50 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 active:scale-90" : "border-[#374151]/30 bg-black/10 text-[#6b7280] cursor-not-allowed"}`}>MAX</button>
                                    <button onClick={() => setShopCart(c => ({...c,[crop.id]:0}))} disabled={qty === 0} className={`shrink-0 rounded-md border px-1.5 py-1 text-[9px] font-black transition-all duration-75 ${qty > 0 ? "border-red-500/50 bg-red-900/20 text-red-300 hover:bg-red-900/40 active:scale-90" : "border-[#374151]/30 bg-black/10 text-[#6b7280] cursor-not-allowed"}`}>0</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {shopTab === "przedmioty" && (() => {
                      const SHOP_ITEMS = [
                        { id:"beekeeper_suit", label:"Strój pszczelarza", img:"/przedmioty/beekeeper_suit.png", desc:"100 zbiorów miodu", price:150, qty:100, type:"suit" as const },
                        { id:"jar_empty_1",    label:"Słoik × 1",         img:"/przedmioty/jar_pack_1.png",     desc:"1 sztuka",       price:4,   qty:1,   type:"jar" as const },
                        { id:"jar_empty_8",    label:"Słoik × 8",         img:"/przedmioty/jar_pack_8.png",     desc:"8 sztuk",        price:30,  qty:8,   type:"jar" as const },
                        { id:"jar_empty_15",   label:"Słoik × 15",        img:"/przedmioty/jar_pack_15.png",    desc:"15 sztuk",       price:55,  qty:15,  type:"jar" as const },
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
                        const { data, error } = await supabase.rpc("buy_barn_animal", { p_user_id: profile.id, p_animal_id: a.id });
                        if (error) { setMessage({type:"error",title:"Błąd zakupu!",text:error.message}); return; }
                        const response = data as { ok?: boolean; error?: string } | null;
                        if (response?.ok === false) { setMessage({type:"error",title:"Błąd zakupu!",text:response.error ?? "Operacja nie powiodła się."}); return; }
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
                            const needSlot = !locked && owned >= slots && slots < a.maxSlots;
                            const atMax = !locked && owned >= slots && slots >= a.maxSlots;
                            const noSlot = needSlot || atMax;
                            const tooPoor = !locked && !noSlot && displayMoney < a.buyPrice;
                            const canBuy = !locked && !noSlot && !tooPoor;
                            return (
                              <div key={a.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${locked ? "border-[#374151]/40 bg-black/10 opacity-60" : "border-[#8b6a3e]/40 bg-black/20"}`}>
                                <div className="flex h-[64px] w-[64px] items-center justify-center rounded-xl border border-[#8b6a3e]/40 bg-black/30 text-4xl overflow-hidden">
                                  <AnimalImg id={a.id} icon={a.icon} className="h-full w-full" /></div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-black text-[#f9e7b2]">{a.name}</p>
                                    <span className="rounded-full border border-[#8b6a3e]/40 bg-black/30 px-2 py-0.5 text-[10px] font-bold text-[#dfcfab]">LVL {a.unlockLevel}</span>
                                    {locked && <span className="rounded-full border border-red-500/40 bg-red-900/20 px-2 py-0.5 text-[10px] font-bold text-red-300">🔒 Zablokowane</span>}
                                  </div>
                                  <p className="mt-1 text-[11px] text-[#8b6a3e]">
                                    {canBuy
                                      ? <>{item?.icon} <span className="text-[#dfcfab] font-bold">Produkcja po zakupie: {owned+1} {item ? plItem(owned+1, item) : "szt."} co {a.prodMs/3600000}h</span></>
                                      : <>{item?.icon} <span className="text-[#dfcfab] font-bold">Produkcja: {owned > 0 ? `${owned} ${item ? plItem(owned, item) : "szt."}` : `1 ${item ? item.n1 : "szt."} / szt.`} co {a.prodMs/3600000}h</span></>
                                    }
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[#8b6a3e]">
                                    {canBuy
                                      ? <>Magazyn po zakupie: <span className="text-[#dfcfab] font-bold">{owned+1} {item ? plItem(owned+1, item) : "szt."}</span></>
                                      : owned > 0 ? <>Magazyn: <span className="text-[#dfcfab] font-bold">{owned} {item ? plItem(owned, item) : "szt."}</span></> : null
                                    }
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[#8b6a3e]">
                                    Karma: {a.feed.map(f => `${f.icon} ${f.name}`).join(" lub ")}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[#8b6a3e]">
                                    Posiadasz: <span className={`font-black ${owned > 0 ? "text-emerald-300" : "text-[#dfcfab]"}`}>{owned}/{slots}</span>
                                    <span className="text-[#6b7280]"> (max {a.maxSlots})</span>
                                    {" · "}Sprzedaż: <span className="text-amber-300 font-bold">{item?.sellPrice.toLocaleString()} 💰/szt</span>
                                  </p>
                                  {needSlot && (
                                    <p className="mt-0.5 text-[10px] text-amber-300/80">🏗️ Sloty pełne — kup więcej w Stodole (do {a.maxSlots} szt.)</p>
                                  )}
                                  {atMax && (
                                    <p className="mt-0.5 text-[10px] text-[#6b7280]">✦ Osiągnięto maksimum {a.maxSlots} {a.name.toLowerCase()}.</p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <p className="text-base font-black text-amber-400">{a.buyPrice.toLocaleString()} 💰</p>
                                  <button
                                    disabled={!canBuy}
                                    onClick={() => void handleBuyAnimalShop(a)}
                                    className={`rounded-xl border px-4 py-2 text-sm font-black transition ${canBuy ? "border-emerald-500/60 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/50" : "cursor-not-allowed border-[#374151] bg-black/20 text-[#6b7280]"}`}>
                                    {locked ? `🔒 LVL ${a.unlockLevel}` : atMax ? "Maks. zwierząt" : needSlot ? "🏗️ Kup slot" : tooPoor ? "Za mało 💰" : "🛒 Kup"}
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
                                        const { data, error } = await supabase.rpc("buy_orchard_tree", { p_user_id: profile.id, p_tree_id: t.id });
                                        if (error) { setOrchardError("Błąd zakupu: " + error.message); return; }
                                        const response = data as { ok?: boolean; error?: string } | null;
                                        if (response?.ok === false) { setOrchardError(response.error ?? "Nie udało się kupić drzewa."); return; }
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
                </div>
              {shopTab === "nasiona" && (() => {
                const cartEntries = Object.entries(shopCart).filter(([,v]) => (v as number) > 0);
                const total = Math.round(cartEntries.reduce((s, [id, qty]) => {
                  const bp = CROP_PRICES[id] ?? 0;
                  const disc = dailyPromos.super_.includes(id) ? 0.8 : dailyPromos.normal.includes(id) ? 0.9 : 1;
                  return s + bp * disc * (qty as number);
                }, 0) * 100) / 100;
                const totalItems = cartEntries.reduce((s, [,v]) => s + (v as number), 0);
                const canAfford = displayMoney >= total;
                return (
                  <div className="flex w-[268px] shrink-0 flex-col border-l border-[#8b6a3e]/30 bg-black/20">
                    <div className="px-4 py-3 border-b border-[#8b6a3e]/30 shrink-0">
                      <p className="text-[18px] font-black uppercase tracking-wider text-[#d8ba7a]">Koszyk</p>
                      {cartEntries.length === 0 && <p className="mt-1.5 text-[17px] text-[#8b6a3e]">Koszyk jest pusty</p>}
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                      {cartEntries.map(([id, qty]) => {
                        const crop = CROPS.find(c => c.id === id);
                        const bp = CROP_PRICES[id] ?? 0;
                        const disc = dailyPromos.super_.includes(id) ? 0.8 : dailyPromos.normal.includes(id) ? 0.9 : 1;
                        const ep = Math.round(bp * disc * 100) / 100;
                        return (
                          <div key={id} className="flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5 border border-[#8b6a3e]/20">
                            <img src={crop?.spritePath} alt={crop?.name} className="h-9 w-9 object-contain shrink-0" style={{imageRendering:"pixelated"}} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[17px] font-bold text-[#f9e7b2] truncate">{crop?.name}</p>
                              <p className="text-[15px] text-[#8b6a3e]">{qty as number} x {ep.toFixed(2)} 💰</p>
                            </div>
                            <p className="text-[18px] font-black text-yellow-300 shrink-0">{(ep * (qty as number)).toFixed(2)}</p>
                            <button onClick={() => setShopCart(c => { const n = {...c}; delete n[id]; return n; })} className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-red-500/40 bg-red-900/20 text-red-300 hover:bg-red-900/50 hover:text-red-200 transition-all text-[13px] font-black">×</button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-[#8b6a3e]/30 p-3 shrink-0">
                      {shopError && <p className="mb-2 rounded-lg bg-red-900/40 px-2 py-1 text-[18px] text-red-300">{shopError}</p>}
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[17px] text-[#8b6a3e]">Suma ({totalItems} szt.)</p>
                        <p className={`text-[21px] font-black ${canAfford || total === 0 ? "text-[#f9e7b2]" : "text-red-400"}`}>{total.toFixed(2)} 💰</p>
                      </div>
                      {!canAfford && total > 0 && <p className="text-[15px] text-red-400 mb-2">Za malo srodkow!</p>}
                      <button
                        disabled={total === 0 || !canAfford}
                        onClick={() => {
                          if (!profile?.id || total === 0 || !canAfford) return;
                          setShopError("");
                          void (async () => {
                            const p_items = Object.entries(shopCart)
                              .filter(([, qty]) => (qty as number) > 0)
                              .map(([key, qty]) => {
                                let crop_id = key;
                                let quality = "good";
                                for (const q of ["epic","legendary","rotten","good"]) {
                                  if (key.endsWith(`_${q}`)) { crop_id = key.slice(0, -(q.length + 1)); quality = q; break; }
                                }
                                return { crop_id, quality, qty: qty as number };
                              });
                            const { data, error } = await supabase.rpc("buy_shop_seeds", { p_user_id: profile.id, p_items });
                            if (error) { setShopError("Blad: " + error.message); return; }
                            const response = data as { ok?: boolean; error?: string } | null;
                            if (response?.ok === false) { setShopError("Blad: " + (response.error ?? "Operacja nie powiodła się.")); return; }
                            setShopCart({});
                            setShopError("");
                            await loadProfile(profile.id);
                          })();
                        }}
                        className={`w-full rounded-xl py-2 font-black text-[21px] transition-all active:scale-95 ${total > 0 && canAfford ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
                      >Kup ({totalItems} szt.)</button>
                      <button onClick={() => setShopCart({})} className="mt-1 w-full rounded-lg py-1 text-[15px] text-[#8b6a3e] hover:text-red-300 transition-colors">Wyczysc koszyk</button>
                    </div>
                  </div>
                );
              })()}
            </div>
            </div>
          )}

          {/* ═══ DOM MODAL ═══ */}
          {showDomModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="relative flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-[1650px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl">

                {/* ─ Zamknij ─ */}
                <button onClick={() => setShowDomModal(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>

                {/* ─ Sidebar ─ */}
                <div className="flex w-[264px] shrink-0 flex-col gap-3 border-r border-[#8b6a3e]/30 bg-black/20 p-8 pt-20 overflow-y-auto">
                  <p className="mb-4 text-sm font-black uppercase tracking-widest text-[#8b6a3e]">🏠 Dom gracza</p>
                  {(["profil","eq","plecak"] as const).map(tab => (
                    <button key={tab} onClick={() => setDomTab(tab)}
                      className={`flex items-center gap-3 rounded-xl px-5 py-4 text-xl font-bold transition ${
                        domTab === tab ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"
                      }`}>
                      {tab === "profil" ? "👤" : tab === "eq" ? "⚔️" : "🎒"}
                      {tab === "profil" ? "Profil" : tab === "eq" ? "Ekwipunek" : "Plecak"}
                    </button>
                  ))}
                </div>

                {/* ─ Zawartość ─ */}
                <div className="flex-1 min-h-0 overflow-y-auto p-9 pt-8 text-[#dfcfab]">

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
                        <div className="w-full text-center">
                          <p className="text-xl font-black text-[#f9e7b2]">{profile?.login}</p>
                          {freeSkillPoints > 0 && (
                            <span className="mt-1 inline-block rounded-lg bg-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-300">+{freeSkillPoints} pkt do rozdania</span>
                          )}
                        </div>
                        <div className="w-full rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[#8b6a3e]">Poziom</span>
                            <span className="font-black text-[#f9e7b2]">⭐ {displayLevel}</span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-[#8b6a3e]">EXP</span>
                              <span className="text-[#dfcfab] tabular-nums">{displayXp.toLocaleString("pl-PL")} / {displayXpToNextLevel.toLocaleString("pl-PL")}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-black/50 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-400 transition-all" style={{ width:`${displayXpToNextLevel > 0 ? Math.min(100, Math.round(displayXp / displayXpToNextLevel * 100)) : 100}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#8b6a3e]">PLN</span>
                            <span className="font-bold text-green-300 tabular-nums">{Number(displayMoney).toLocaleString("pl-PL")} zł</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-[#8b6a3e]/20 pt-2">
                            <span className="text-[#8b6a3e]">Moc farmy</span>
                            <span className="font-black text-yellow-300 tabular-nums">{computeFarmPower(playerStats, charEquipped, hiveData.level, orchardState, barnState)}</span>
                          </div>
                        </div>
                        <div className="w-full rounded-xl border border-[#8b6a3e]/20 bg-black/15 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#8b6a3e] mb-2">Twoje osiągnięcia</p>
                          {(() => {
                            const systems = [
                              { label:"Zwierzęta", val:Object.values(barnState as Record<string,{owned:number}>).reduce((s,a)=>s+a.owned,0) },
                              { label:"Drzewa",    val:Object.values(orchardState as Record<string,{owned:number}>).reduce((s,t)=>s+t.owned,0) },
                              { label:"Pszczoły",  val:hiveData.level },
                            ];
                            const top = [...systems].sort((a,b)=>b.val-a.val)[0];
                            const statLabels: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zręczność",zaradnosc:"Zaradność",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczęście" };
                            const _statEntries = Object.entries(playerStats) as [string,number][];
                            const bestStat = _statEntries.length > 0 ? _statEntries.reduce((a,b)=>a[1]>=b[1]?a:b) : ["wiedza",0] as [string,number];
                            return (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-[#8b6a3e]">Najsilniejszy system</span>
                                  <span className="text-[11px] font-bold text-[#dfcfab]">{top.label} ({top.val})</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-[#8b6a3e]">Najwyższy stat</span>
                                  <span className="text-[11px] font-bold text-[#dfcfab]">{statLabels[bestStat[0]]??bestStat[0]} ({bestStat[1]})</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-[#8b6a3e]">Aktywność dziś</span>
                                  <span className="text-[11px] font-bold text-[#dfcfab]">{dailyProgress.harvests + dailyProgress.customers} akcji</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Prawa kolumna: statystyki */}
                      <div className="flex-1">
                        {/* ─── Moc farmy + bonusy summary ─── */}
                        {(() => {
                          const _wB  = Math.min(25, calcStatEffect(effectiveStats.wiedza, WIEDZA_RATE));
                          const _zaB = calcStatEffect(effectiveStats.zaradnosc, ZARADNOSC_RATE);
                          const _zrB = calcStatEffect(effectiveStats.zrecznosc, 0.004);
                          const _saB = calcStatEffect(effectiveStats.sadownik, 0.005);
                          const _opB = Math.min(90, effectiveStats.opieka * 0.3);
                          const _shB = calcStatEffect(effectiveStats.szczescie, 0.0025);
                          const _fp = computeFarmPower(playerStats, charEquipped, hiveData.level, orchardState, barnState);
                          const _statsPow = Math.round(Object.values(playerStats).reduce((s: number, v: unknown) => s + (v as number), 0) * 3);
                          const _eqB = (Object.values(charEquipped) as ({id:string;upg:number}|null)[]).reduce((s, eq) => { if (!eq) return s; const d = CHAR_EQUIP_ITEMS.find(it => it.id === eq.id); return s + (d?.unlockLevel ?? 1) * 8 + (eq.upg ?? 0) * (eq.upg ?? 0) * 4; }, 0);
                          const _hivB = Math.round(hiveData.level * hiveData.level * 20);
                          const _orchB = TREES.reduce((s, t) => s + Math.round(Math.sqrt(t.buyPrice) * 2) * (orchardState[t.id]?.owned ?? 0), 0);
                          const _barnB = ANIMALS.reduce((s, a) => s + Math.round(Math.sqrt(a.buyPrice) * 2.5) * (barnState[a.id]?.owned ?? 0), 0);
                          const _farmRank = _fp >= 15000 ? "Legenda Plonopolis" : _fp >= 7500 ? "Magnat" : _fp >= 3500 ? "Farmer Premium" : _fp >= 1500 ? "Gospodarz" : _fp >= 500 ? "Rolnik" : "Nowicjusz";
                          const _farmRankC = _fp >= 15000 ? "text-purple-300" : _fp >= 7500 ? "text-yellow-300" : _fp >= 3500 ? "text-orange-300" : _fp >= 1500 ? "text-green-300" : _fp >= 500 ? "text-blue-300" : "text-[#8b6a3e]";
                          return (
                            <div className="mb-4 rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-950/20 to-black/20 p-4">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-base font-black text-[#f9e7b2]">🏆 Moc farmy</p>
                                <span className="text-2xl font-black text-yellow-300 tabular-nums">{_fp}</span>
                              </div>
                              <p className="text-xs mb-3"><span className="text-[#8b6a3e]">Ranga: </span><span className={`font-black ${_farmRankC}`}>{_farmRank}</span></p>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { icon:"🌱", label:"Wzrost",    val:`−${_wB.toFixed(1)}%`,  c:"text-green-300"  },
                                  { icon:"💧", label:"Podlanie",  val:`−${_zaB.toFixed(1)}%`, c:"text-cyan-300"   },
                                  { icon:"🎯", label:"Zbiór x2",  val:`+${_zrB.toFixed(1)}%`, c:"text-yellow-300" },
                                  { icon:"🌳", label:"Sad",       val:`+${_saB.toFixed(1)}%`, c:"text-emerald-300"},
                                  { icon:"🐄", label:"Zwierzęta", val:`−${_opB.toFixed(1)}%`, c:"text-orange-300" },
                                  { icon:"🍀", label:"Drop",      val:`+${_shB.toFixed(1)}%`, c:"text-green-300"  },
                                ].map(b => (
                                  <span key={b.label} className="flex items-center gap-1 rounded-lg bg-black/30 px-3 py-1.5 text-xs font-medium">
                                    <span className="text-[#8b6a3e]">{b.icon} {b.label}</span>
                                    <span className={`font-bold ${b.c}`}>{b.val}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="mt-2 grid grid-cols-5 gap-1.5 text-center">
                                {([
                                  { label:"Staty",   val:_statsPow },
                                  { label:"Ekwip.",  val:_eqB      },
                                  { label:"Ul",      val:_hivB     },
                                  { label:"Sad",     val:_orchB    },
                                  { label:"Zwierz.", val:_barnB    },
                                ] as {label:string;val:number}[]).map(c => (
                                  <div key={c.label} className="rounded-lg bg-black/30 py-1.5">
                                    <div className="text-[10px] text-[#8b6a3e]">{c.label}</div>
                                    <div className="text-xs font-black text-yellow-200 tabular-nums">{c.val}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* ─── Historia postępu: dziś ─── */}
                        <div className="mb-4 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/15 to-black/20 p-4">
                          <p className="text-sm font-black text-[#f9e7b2] mb-2">📈 Dziś</p>
                          {(dailyProgress.harvests === 0 && dailyProgress.customers === 0 && dailyProgress.expGained === 0 && dailyProgress.levelsGained === 0) ? (
                            <div className="space-y-2">
                              <p className="text-[11px] text-[#8b6a3e] mb-1">Propozycje na dziś:</p>
                              {([
                                { text:"Zbierz pierwszą uprawę" },
                                { text:"Zrealizuj zamówienie klienta" },
                                { text:"Użyj kompostu na polu" },
                              ] as {text:string}[]).map(t => (
                                <div key={t.text} className="flex items-center gap-2 text-xs text-[#8b6a3e]">
                                  <span className="shrink-0 text-sm">☐</span>
                                  <span>{t.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {dailyProgress.levelsGained > 0 && <span className="flex items-center gap-1 rounded-lg bg-yellow-900/30 border border-yellow-500/30 px-3 py-1.5 text-xs font-bold text-yellow-300">+{dailyProgress.levelsGained} lvl</span>}
                              {dailyProgress.expGained > 0 && <span className="flex items-center gap-1 rounded-lg bg-blue-900/30 border border-blue-500/30 px-3 py-1.5 text-xs font-bold text-blue-300">+{dailyProgress.expGained.toLocaleString("pl-PL")} EXP</span>}
                              {dailyProgress.moneyGained > 0 && <span className="flex items-center gap-1 rounded-lg bg-green-900/30 border border-green-500/30 px-3 py-1.5 text-xs font-bold text-green-300">+{dailyProgress.moneyGained.toLocaleString("pl-PL")} zł</span>}
                              {dailyProgress.customers > 0 && <span className="flex items-center gap-1 rounded-lg bg-purple-900/30 border border-purple-500/30 px-3 py-1.5 text-xs font-bold text-purple-300">+{dailyProgress.customers} klientów</span>}
                              {dailyProgress.harvests > 0 && <span className="flex items-center gap-1 rounded-lg bg-[#8b6a3e]/30 border border-[#8b6a3e]/50 px-3 py-1.5 text-xs font-bold text-[#dfcfab]">+{dailyProgress.harvests} zbiorów</span>}
                            </div>
                          )}
                        </div>

                        {/* ─── Nagłówek + selector ─── */}
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-base font-black text-[#f9e7b2]">🧙 Statystyki</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[#8b6a3e]">Dodaj:</span>
                            {([1,5,10] as const).map(n => (
                              <button key={n} onClick={() => setStatUpgradeAmount(n)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                                  statUpgradeAmount === n ? "border-yellow-400 bg-yellow-500/30 text-yellow-200" : "border-[#8b6a3e]/40 bg-black/20 text-[#8b6a3e] hover:border-yellow-600/60 hover:text-yellow-400"
                                }`}>+{n}</button>
                            ))}
                          </div>
                        </div>

                        {/* ─── Karty statystyk ─── */}
                        <div className="space-y-2">
                          {STATS_DEFS.map(def => {
                            const val = playerStats[def.key];
                            const _avBonus = (getAvatarBonus(avatarSkin)[def.key as keyof PlayerStatsMap] ?? 0) as number;
                            const effVal = val + _avBonus;
                            const eff = calcStatEffect(effVal, def.rate);
                            const isLocked = displayLevel < def.unlockLevel;
                            const actualFreeAmt = Math.min(statUpgradeAmount, freeSkillPoints, Math.max(0, 100 - val));
                            const canFree = actualFreeAmt > 0 && !isLocked;
                            let multiCost2 = 0; let actualBuyAmt2 = 0;
                            for (let _i = 0; _i < statUpgradeAmount; _i++) { if (val + _i >= 100) break; multiCost2 += getStatUpgradeCost(val + _i + 1); actualBuyAmt2++; }
                            const canBuy2 = !canFree && !isLocked && displayMoney >= multiCost2 && val < 100 && actualBuyAmt2 > 0;
                            const canUp2 = !isLocked && val < 100 && (canFree || canBuy2);
                            const rank = getStatRank(val);
                            const rankBarFill = rank.nextT > rank.prevT ? Math.round((val - rank.prevT) / (rank.nextT - rank.prevT) * 100) : 100;
                            const nextPtBonus = val < 100
                              ? def.key === "opieka"
                                ? (Math.min(90, (val+1)*0.3) - Math.min(90, val*0.3)).toFixed(2)
                                : (calcStatEffect(val+1, def.rate) - eff).toFixed(2)
                              : "0.00";
                            const bonusStr = def.key === "wiedza"    ? `−${Math.min(25, eff).toFixed(1)}% wzrostu`
                              : def.key === "zrecznosc"  ? `+${eff.toFixed(1)}% szansa`
                              : def.key === "zaradnosc"  ? `−${eff.toFixed(1)}% podlanie`
                              : def.key === "sadownik"   ? `+${eff.toFixed(1)}% drzewa`
                              : def.key === "opieka"     ? `−${Math.min(90, effVal*0.3).toFixed(1)}% głód`
                              : `+${eff.toFixed(1)}% drop`;
                            const isFlashing = statFlash === def.key;
                            return (
                              <div key={def.key}
                                className={`rounded-xl border p-3 transition-all duration-300 ${
                                  isFlashing  ? "border-yellow-400 bg-yellow-500/10 shadow-lg shadow-yellow-500/10"
                                  : isLocked  ? "border-[#8b6a3e]/20 bg-black/10 opacity-60"
                                  : "border-[#8b6a3e]/40 bg-black/20 hover:border-[#8b6a3e]/70"
                                }`}>
                                <div className="flex items-center gap-3">
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[15px] font-black text-[#f9e7b2]">{def.label}</span>
                                      {isLocked
                                        ? <span className="text-[10px] font-bold text-orange-400 bg-orange-900/30 rounded px-1.5 py-0.5">🔒 lvl {def.unlockLevel}</span>
                                        : <span className={`text-[10px] font-bold ${rank.color} bg-black/30 rounded px-1.5 py-0.5`}>{rank.name}</span>
                                      }
                                      {effVal > 0 && (
                                        <span className="text-sm font-bold text-green-200 ml-auto tabular-nums">{bonusStr}</span>
                                      )}
                                    </div>
                                    {isLocked ? (
                                      <div className="mt-0.5 space-y-0.5">
                                        <p className="text-[11px] text-[#8b6a3e]">Ulepszanie odblokuje sie na poziomie {def.unlockLevel}</p>
                                        {_avBonus > 0 && <p className="text-[11px] font-bold text-amber-400">+{_avBonus} z avatara — juz aktywne!</p>}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="mt-1 relative h-2 w-full">
                                          <div className="absolute inset-0 overflow-hidden rounded-full bg-black/40">
                                            <div className="h-full rounded-full bg-gradient-to-r from-[#8b6a3e] to-[#f9e7b2] transition-all duration-500"
                                              style={{ width:`${rankBarFill}%` }} />
                                          </div>
                                          {[25,50,75].map(pct => (
                                            <div key={pct} className="absolute top-0 bottom-0 w-px bg-black/60 z-10" style={{ left:`${pct}%` }} />
                                          ))}
                                        </div>
                                        <div className="flex justify-between mt-0.5 px-0">
                                          {[0,25,50,75,100].map(t => (
                                            <span key={t} className="text-[9px] text-[#6b4e2e] tabular-nums">{t}</span>
                                          ))}
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                          <span className="text-[11px] text-[#9b7a4e]">{def.desc} · {val}/100{_avBonus > 0 ? <span className="text-amber-400 font-bold"> +{_avBonus} avatar</span> : null}</span>
                                          {val < 100
                                            ? <span className="text-[11px] text-[#9b7a4e]">+1 pkt → <span className="text-green-300 font-bold">+{nextPtBonus}%</span></span>
                                            : <span className="text-[11px] font-bold text-yellow-400">MAX</span>
                                          }
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {/* Przycisk */}
                                  {!isLocked && (
                                    <button disabled={!canUp2}
                                      onClick={() => {
                                        if (!profile?.id) return;
                                        if (canFree) {
                                          const next = { ...playerStats, [def.key]: val + actualFreeAmt };
                                          const nextFsp = freeSkillPoints - actualFreeAmt;
                                          setFreeSkillPoints(nextFsp); setPlayerStats(next);
                                          saveAvatarData(profile.id, avatarSkin, next, nextFsp, prevLevelRef.current);
                                          setStatFlash(def.key); setTimeout(() => setStatFlash(null), 700);
                                        } else if (canBuy2) {
                                          const next = { ...playerStats, [def.key]: val + actualBuyAmt2 };
                                          void (async () => {
                                            const { error } = await supabase.from("profiles").update({ money: displayMoney - multiCost2 }).eq("id", profile.id);
                                            if (!error) { await loadProfile(profile.id); setPlayerStats(next); saveAvatarData(profile.id, avatarSkin, next, freeSkillPoints, prevLevelRef.current); }
                                          })();
                                          setStatFlash(def.key); setTimeout(() => setStatFlash(null), 700);
                                        }
                                      }}
                                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition whitespace-nowrap border ${
                                        canFree  ? "border-yellow-500/50 bg-yellow-500/25 text-yellow-200 hover:bg-yellow-500/40"
                                        : canBuy2 ? "border-green-700/50 bg-green-900/35 text-green-200 hover:bg-green-800/50"
                                        : val >= 100 ? "border-[#8b6a3e]/20 cursor-not-allowed opacity-30 bg-black/20 text-[#8b6a3e]"
                                        : "border-[#8b6a3e]/20 cursor-not-allowed opacity-40 bg-black/20 text-[#8b6a3e]"
                                      }`}>
                                      {canFree ? `▲ +${actualFreeAmt} pkt` : val >= 100 ? "MAX" : `${multiCost2.toLocaleString("pl-PL")} 💰`}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* ─── Reset ─── */}
                        <button className="mt-3 block ml-auto rounded-lg border border-red-400/20 bg-red-950/15 px-3 py-1.5 text-[11px] font-bold text-red-400/60 transition hover:border-red-400/50 hover:text-red-300 hover:bg-red-950/40"
                          onClick={() => {
                            if (!profile?.id) return;
                            if (!confirm("Resetować wszystkie statystyki za 50 000 💰?")) return;
                            void (async () => {
                              const { data, error } = await supabase.rpc("game_reset_player_stats");
                              if (error) { setMessage({ type: "error", title: "Błąd resetu statystyk", text: error.message }); return; }
                              const response = data as {
                                ok?: boolean;
                                error?: string;
                                spent?: number;
                                player_stats?: PlayerStatsMap;
                                free_skill_points?: number;
                              } | null;
                              if (response?.ok === false) { setMessage({ type: "error", title: "Błąd resetu statystyk", text: response.error ?? "Nieznany błąd." }); return; }
                              const newStats = response?.player_stats ?? { ...DEFAULT_STATS };
                              const newFsp = typeof response?.free_skill_points === "number" ? response.free_skill_points : freeSkillPoints;
                              setPlayerStats(newStats);
                              setFreeSkillPoints(newFsp);
                              saveAvatarDataLS(profile.id, avatarSkin, newStats, newFsp, prevLevelRef.current);
                              await loadProfile(profile.id);
                              setMessage({ type: "success", title: "Statystyki zresetowane", text: `Odzyskano ${response?.spent ?? 0} punktów umiejętności.` });
                            })();
                          }}>🔄 Reset statystyk (50 000 💰)</button>
                      </div>
                    </div>
                  )}

                  {/* ════ KOSMETYKA ════ */}
                  {/* ════ EKWIPUNEK ════ */}
                  {domTab === "eq" && (() => {
                    const SLOT_BOX = slotBoxCustom;
                    const handleUpg = async (slot: EquipSlot, eqD: { id: string; upg: number }) => {
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
                      const { error: me } = await supabase.from("profiles").update({ money: displayMoney - cost }).eq("id", profile!.id);
                      if (me) return;
                      // Odejmij materiały lokalnie
                      if (mats.length > 0) {
                        const newBarn = { ...barnItems };
                        mats.forEach(m => { newBarn[m.matId] = (newBarn[m.matId] ?? 0) - m.qty; });
                        saveBarnItems(newBarn);
                      }
                      const _luckUpgBonus = Math.min(0.05, (effectiveStats.szczescie ?? 0) * 0.0005);
                      const ok = Math.random() < Math.min(1, UPGRADE_CHANCE[nextU] + _luckUpgBonus);
                      let fu;
                      if (ok) { fu = nextU; setMessage({ type:"success", title:`✨ +${nextU} udane!`, text:`Koszt: ${cost.toLocaleString()} 💰` }); }
                      else if (eqD.upg <= 6) { fu = eqD.upg; setMessage({ type:"error", title:"Nie powiodło się.", text:`Item pozostaje na +${eqD.upg}.` }); }
                      else { fu = eqD.upg-1; setMessage({ type:"error", title:`⬇ Item cofa się do +${eqD.upg-1}!`, text:"Ulepszenie nie powiodło się." }); }
                      saveCharEquipped({ ...charEquipped, [slot]: { id: eqD.id, upg: fu } });
                      saveItemUpg({ ...itemUpgRegistry, [eqD.id]: fu });
                      await loadProfile(profile!.id);
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
                            <img src="/ekwipunek/ekwip_postac.png" alt="Postać" draggable={false}
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
                            if (!eqD) return null;
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
                                      ? <p className="text-[11px] font-bold text-[#f9e7b2] mt-1">+{upg} → +{upg+1} · {Math.round(Math.min(100, (UPGRADE_CHANCE[upg+1] + Math.min(0.05, (effectiveStats.szczescie ?? 0) * 0.0005)) * 100))}% szansy</p>
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
                                      <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[999] hidden group-hover:flex flex-col gap-1 min-w-[145px] max-w-[187px] rounded-xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-2.5 py-1.5 shadow-2xl text-left">
                                        <p className="text-[10px] font-black text-[#f9e7b2] leading-tight">{item.icon} {item.name}</p>
                                        <p className="text-[9px] text-[#8b6a3e]">{slotIcon} {EQUIP_SLOT_META[sl].label} · poziom <span className="font-bold text-[#dfcfab]">{item.unlockLevel}</span></p>
                                        <div className="h-px bg-[#8b6a3e]/30 my-0.5" />
                                        <p className="text-[9px] text-cyan-300 font-bold">{bonusLine(item.bonuses, curUpg)}</p>
                                        {curUpg > 0 && <p className="text-[9px] font-black" style={{color:uc}}>Ulepszenie: +{curUpg}</p>}
                                        {isOn && <p className="text-[9px] text-green-400 font-bold">✓ Założone</p>}
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
                              const _luckUpgBonusEx = Math.min(0.05, (effectiveStats.szczescie ?? 0) * 0.0005);
                              const ok = Math.random() < Math.min(1, UPGRADE_CHANCE[nextU] + _luckUpgBonusEx);
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
                                        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[999] hidden group-hover:flex flex-col gap-1 min-w-[145px] max-w-[187px] rounded-xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-2.5 py-1.5 shadow-2xl text-left">
                                          <p className="text-[10px] font-black text-[#f9e7b2] leading-tight">{item.icon} {item.name}</p>
                                          <p className="text-[9px] text-[#8b6a3e]">{slotIcon} {EQUIP_SLOT_META[item.slot].label} · poziom <span className="font-bold text-[#dfcfab]">{item.unlockLevel}</span></p>
                                          <div className="h-px bg-[#8b6a3e]/30 my-0.5" />
                                          <p className="text-[9px] text-cyan-300 font-bold">{bonusLine(item.bonuses, entry.upg)}</p>
                                          <p className="text-[9px] font-black" style={{color:uc}}>Ulepszenie: +{entry.upg}</p>
                                          <p className="text-[9px] text-[#8b6a3e]/80 italic">Kliknij, by ulepszyć lub zamienić</p>
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

                  {/* ════ PLECAK ════ */}
                  {domTab === "plecak" && (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-2xl font-black text-[#f9e7b2]">🎒 Plecak</p>
                        <button type="button"
                          onClick={() => { setSelectedSeedId(null); setSelectedTool(null); }}
                          className="rounded-full border border-[#8b6a3e] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#dfcfab] transition hover:bg-[rgba(80,58,28,0.65)]">
                          Wyczyść wybór
                        </button>
                      </div>
                      <div className="flex gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1 mb-4">
                        {(["uprawy","owoce","przedmioty"] as const).map(tab => (
                          <button key={tab} type="button" onClick={() => setBackpackTab(tab)}
                            className={`flex-1 rounded-lg py-2 text-sm font-bold uppercase tracking-[0.15em] transition ${backpackTab === tab ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "text-[#dfcfab] hover:bg-white/5"}`}>
                            {tab === "uprawy" ? "🌾 Uprawy" : tab === "przedmioty" ? "🎒 Przedmioty" : "🍎 Owoce"}
                          </button>
                        ))}
                      </div>

                      {backpackTab === "uprawy" && (
                        <>
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-xs text-[#8b6a3e] uppercase tracking-[0.15em] shrink-0">Filtr:</span>
                            <div className="flex flex-1 gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1">
                              {BACKPACK_FILTER_OPTS.map(opt => (
                                <button key={opt.id} type="button" onClick={() => setBackpackSort(opt.id)}
                                  className={`flex-1 rounded-lg py-1 text-[10px] font-bold uppercase tracking-[0.05em] transition ${backpackSort === opt.id ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "hover:bg-white/5"}`}
                                  style={backpackSort === opt.id ? undefined : { color: opt.color }}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {(() => {
                            const allCrops = (Object.entries(seedInventory).filter(([k, amount]) => Number(amount) > 0 && !isCompostKey(k)) as Array<[string, number]>);
                            const filtered = backpackSort === "all" ? allCrops : allCrops.filter(([k]) => { const q = parseQualityKey(k).quality ?? "good"; return q === backpackSort; });
                            if (allCrops.length === 0) return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Plecak jest pusty.</div>;
                            if (filtered.length === 0) { const fLabel = BACKPACK_FILTER_OPTS.find(o => o.id === backpackSort)?.label ?? ""; return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Brak upraw o jakości „{fLabel}". Zmień filtr.</div>; }
                            const sorted = [...filtered].sort(([aId], [bId]) => {
                              const { baseCropId: aC, quality: aQ } = parseQualityKey(aId);
                              const { baseCropId: bC, quality: bQ } = parseQualityKey(bId);
                              const aLv = CROPS.find(c => c.id === aC)?.unlockLevel ?? 999;
                              const bLv = CROPS.find(c => c.id === bC)?.unlockLevel ?? 999;
                              if (aLv !== bLv) return aLv - bLv;
                              const qOrd: Record<string,number> = {rotten:0,good:1,epic:2,legendary:3};
                              return (qOrd[aQ ?? "good"] ?? 1) - (qOrd[bQ ?? "good"] ?? 1);
                            });
                            return (
                              <div className="grid grid-cols-5 gap-2">
                                {sorted.map(([seedId, amount]) => {
                                  const { baseCropId, quality } = parseQualityKey(seedId);
                                  const crop = CROPS.find(c => c.id === baseCropId);
                                  if (!crop) return null;
                                  const qDef = quality ? CROP_QUALITY_DEFS[quality] : null;
                                  const isRotten = quality === "rotten";
                                  const sprite = quality === "epic" && crop.epicSpritePath ? crop.epicSpritePath : quality === "rotten" && crop.rottenSpritePath ? crop.rottenSpritePath : quality === "legendary" && crop.legendarySpritePath ? crop.legendarySpritePath : crop.spritePath;
                                  return (
                                    <button key={seedId} draggable
                                      onDragStart={() => { setDraggedSeedId(seedId); setSelectedSeedId(seedId); setSelectedTool(null); }}
                                      onDragEnd={() => setDraggedSeedId(null)}
                                      type="button"
                                      onClick={() => { setSelectedSeedId(prev => prev === seedId ? null : seedId); setSelectedTool(null); }}
                                      onMouseEnter={() => { setHoveredCrop(crop); setHoveredSeedQuality(quality as "rotten"|"good"|"epic"|"legendary"|null); }}
                                      onMouseLeave={() => { setHoveredCrop(null); setHoveredSeedQuality(null); }}
                                      className={`group relative flex h-24 w-24 items-center justify-center rounded-xl border transition ${isRotten ? "cursor-not-allowed" : ""}`}
                                      style={selectedSeedId === seedId
                                        ? { borderColor: "#f6d860", background: "rgba(60,40,5,0.4)", boxShadow: "0 0 12px rgba(255,220,120,0.22)" }
                                        : quality === "legendary"
                                          ? { borderColor: qDef!.borderColor, background: qDef!.bgColor, animation: "legendaryPulse 2s ease-in-out infinite" }
                                          : qDef
                                            ? { borderColor: qDef.borderColor, background: qDef.bgColor }
                                            : { borderColor: "#8b6a3e", background: "rgba(20,12,8,0.65)" }}>
                                      <img src={sprite} alt={crop.name} className="absolute inset-0 h-full w-full object-contain rounded-xl" style={{ imageRendering: "pixelated" }} />
                                      {quality === "legendary" && (
                                        <span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                          <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                        </span>
                                      )}
                                      <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{amount}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {backpackTab === "przedmioty" && (
                        <div>
                          {(() => {
                            const ownedAnimals = ANIMAL_ITEMS.filter(it => (barnItems[it.id] ?? 0) > 0);
                            const hasEmptyJars = hiveData.empty_jars > 0;
                            const hasHoneyJars = hiveData.honey_jars > 0;
                            const hasSuit = hiveData.suit_durability > 0;
                            const compostKeys = Object.keys(seedInventory).filter(k => isCompostKey(k) && (seedInventory[k] ?? 0) > 0);
                            const hasAny = ownedAnimals.length > 0 || hasEmptyJars || hasHoneyJars || hasSuit || compostKeys.length > 0;
                            if (!hasAny) return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Plecak jest pusty.</div>;
                            return (
                              <div className="grid grid-cols-5 gap-2">
                                {ownedAnimals.map(it => {
                                  const animal = ANIMALS.find(a => a.itemId === it.id);
                                  const cnt = barnItems[it.id] ?? 0;
                                  return (
                                    <div key={it.id} className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default"
                                      onMouseEnter={() => setCardTip(<><p className="text-[20px] font-black text-[#f9e7b2]">{it.name}</p>{animal && <><p className="text-[18px] text-amber-300 mt-1">{animal.icon}</p><p className="text-[17px] text-[#8b6a3e] mt-0.5">1 zbiór: {animal.prodMs/3600000}h</p></>}</>)}
                                      onMouseLeave={() => setCardTip(null)}>
                                      <div className="relative h-16 w-16 flex items-center justify-center">
                                        <img src={`/przedmioty/item_${it.id}.png`} alt={it.name} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[180%] w-[180%] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}} />
                                      </div>
                                      <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{cnt}</span>
                                    </div>
                                  );
                                })}
                                {hasEmptyJars && (<div className="group relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default"><img src="/przedmioty/jar_empty.png" alt="Słoik" className="h-12 w-12 object-contain" style={{imageRendering:"pixelated"}} /><p className="mt-1 text-center text-[9px] font-bold text-[#dfcfab] leading-tight px-1">Puste słoiki</p><span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{hiveData.empty_jars}</span></div>)}
                                {hasHoneyJars && (<div className="group relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-amber-600/50 bg-[rgba(30,18,5,0.65)] cursor-default"><img src="/przedmioty/jar_honey.png" alt="Miód" className="h-12 w-12 object-contain" style={{imageRendering:"pixelated"}} /><p className="mt-1 text-center text-[9px] font-bold text-amber-300 leading-tight px-1">Miód</p><span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{hiveData.honey_jars}</span></div>)}
                                {hasSuit && (<div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default" onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-[#f9e7b2]">Strój pszczelarza</p><p className="text-[11px] text-amber-300 mt-0.5">{hiveData.suit_durability} zbiorów pozostało</p></>)} onMouseLeave={() => setCardTip(null)}><img src="/przedmioty/beekeeper_suit.png" alt="Strój" className="h-10 w-10 object-contain" style={{imageRendering:"pixelated"}} /><p className="mt-0.5 text-center text-[9px] font-bold text-[#dfcfab] leading-tight px-1">Strój</p><div className="mt-0.5 h-1 w-10 rounded-full bg-black/40 overflow-hidden"><div className="h-full rounded-full" style={{ width:`${hiveData.suit_durability}%`, background: hiveData.suit_durability > 30 ? "#22c55e" : "#ef4444" }} /></div></div>)}
                                {compostKeys.sort((a,b) => { const ta = compostTypeFromKey(a) ?? "growth"; const tb = compostTypeFromKey(b) ?? "growth"; const order: Record<CompostType, number> = { growth:0, yield:1, exp:2 }; if (order[ta] !== order[tb]) return order[ta] - order[tb]; return compostValueFromKey(a) - compostValueFromKey(b); }).map(cid => {
                                  const cnt = seedInventory[cid]; const t = compostTypeFromKey(cid)!; const def = COMPOST_DEFS[t]; const value = compostValueFromKey(cid);
                                  const tierIdx = def.bonusValues.indexOf(value); const tierColor = tierIdx === 0 ? "#9ca3af" : tierIdx === 1 ? "#22c55e" : "#a78bfa"; const isSel = selectedSeedId === cid;
                                  return (
                                    <div key={cid} draggable onDragStart={() => { setDraggedSeedId(cid); setSelectedSeedId(cid); setSelectedTool(null); }} onDragEnd={() => setDraggedSeedId(null)}
                                      onClick={() => { setSelectedSeedId(prev => prev === cid ? null : cid); setSelectedTool(null); }}
                                      onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-emerald-200">{def.icon} {def.name} <span style={{color: tierColor}}>({def.tierName(value)})</span></p><p className="text-[10px] text-emerald-300/80 mt-0.5">{def.desc}</p><p className="text-[11px] font-black mt-1" style={{color: tierColor}}>Bonus: {def.bonusLabel(value)}</p></>)}
                                      onMouseLeave={() => setCardTip(null)}
                                      className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border cursor-pointer transition"
                                      style={isSel ? { borderColor: tierColor, background: "rgba(60,40,5,0.4)", boxShadow: `0 0 12px ${tierColor}66` } : { borderColor: "rgba(6,95,70,0.5)", background: "rgba(6,78,59,0.3)" }}>
                                      <span className="text-4xl leading-none">{def.icon}</span>
                                      <p className="mt-0.5 text-center text-[9px] font-bold leading-tight px-1" style={{color: tierColor}}>{def.tierName(value)}</p>
                                      {isSel && <p className="text-[8px] font-black text-amber-300">✓ zaznaczony</p>}
                                      <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">×{cnt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {backpackTab === "owoce" && (() => {
                        const entries = Object.entries(fruitInventory).filter(([,c]) => Number(c) > 0);
                        if (entries.length === 0) return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Plecak jest pusty.</div>;
                        const _qOrd: Record<string, number> = { zgnile: 0, zwykly: 1, soczysty: 2, zloty: 3 };
                        const sorted = [...entries].sort(([aKey], [bKey]) => {
                          const aU = aKey.lastIndexOf("_"); const aFid = aKey.slice(0, aU); const aQ = aKey.slice(aU + 1);
                          const bU = bKey.lastIndexOf("_"); const bFid = bKey.slice(0, bU); const bQ = bKey.slice(bU + 1);
                          const aLv = TREES.find(t => t.fruitId === aFid)?.unlockLevel ?? 999;
                          const bLv = TREES.find(t => t.fruitId === bFid)?.unlockLevel ?? 999;
                          if (aLv !== bLv) return aLv - bLv;
                          return (_qOrd[aQ] ?? 0) - (_qOrd[bQ] ?? 0);
                        });
                        return (
                          <div className="grid grid-cols-5 gap-2">
                            {sorted.map(([key, cnt]) => {
                              const lastU = key.lastIndexOf("_"); const fid = key.slice(0, lastU); const q = key.slice(lastU + 1) as FruitQuality;
                              const tree = TREES.find(t => t.fruitId === fid); if (!tree) return null;
                              const isZgnile = q === "zgnile";
                              const qLabel = isZgnile ? "Zgniłe" : q === "zwykly" ? "Zwykłe" : q === "soczysty" ? "Soczysty" : "Złote";
                              const borderColor = isZgnile ? "#ffffff" : q === "zwykly" ? "#ffffff" : q === "soczysty" ? "#22c55e" : "#f59e0b";
                              const bgColor = isZgnile ? "rgba(255,255,255,0.05)" : q === "zwykly" ? "rgba(255,255,255,0.05)" : q === "soczysty" ? "rgba(20,80,30,0.5)" : "rgba(80,50,5,0.5)";
                              const labelColor = isZgnile ? "#ffffff" : q === "zwykly" ? "#dfcfab" : q === "soczysty" ? "#22c55e" : "#f59e0b";
                              return (
                                <div key={key} className={`relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border ${isZgnile ? "cursor-not-allowed" : "cursor-default"}`}
                                  style={{ borderColor, background: bgColor, ...(q === "zloty" ? { animation: "legendaryPulse 2s ease-in-out infinite" } : {}) }}
                                  onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-[#f9e7b2]">{tree.fruitIcon} {tree.fruitName}</p><p className="text-[11px] mt-0.5" style={{color: labelColor}}>{qLabel}</p><p className="text-[10px] text-[#8b6a3e] mt-0.5">Masz: {Number(cnt)} szt.</p>{isZgnile && <p className="text-[10px] text-amber-400 mt-0.5 font-bold">Nie do sprzedaży — wrzuć do kompostu</p>}</>)}
                                  onMouseLeave={() => setCardTip(null)}>
                                  {isZgnile && <span className="absolute top-1 left-1 text-[10px] leading-none">⚠️</span>}
                                  {q === "zloty" && (<span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden"><span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} /></span>)}
                                  <div className="relative h-16 w-16 flex items-center justify-center">
                                    <span className="text-4xl leading-none">{tree.fruitIcon}</span>
                                    <img src={`/owoce/owoc_${fid}.png`} alt={tree.fruitName} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[180%] w-[180%] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}} />
                                  </div>
                                  <p className="mt-0.5 text-center text-[9px] font-bold leading-tight px-1" style={{color: labelColor}}>{qLabel}</p>
                                  <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{Number(cnt)}</span>
                                </div>
                              );
                            })}
                            <p className="col-span-5 mt-1 text-[10px] text-[#8b6a3e] text-center">Sprzedasz owoce w Sadzie (przycisk „Sprzedaj wszystkie"). Zgniłe idą do kompostu.</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* ═══ KOMPOSTOWNIK MODAL ═══ */}
          {showKompostModal && (() => {
            const batch = kompostBatch;
            const isReady = batch.fill >= KOMPOST_BATCH_SIZE;
            const fillPct = Math.min(100, (batch.fill / KOMPOST_BATCH_SIZE) * 100);
            const currentScore = batch.fill > 0 ? batch.scoreSum / batch.fill : 0;
            const currentQuality = getCompostQualityFromScore(currentScore);
            const currentQualityDef = getCompostQualityDef(currentQuality);
            const batchFull = isReady;
            const milestoneGlow = batch.fill >= 75 ? "#fbbf24" : batch.fill >= 50 ? "#a78bfa" : batch.fill >= 25 ? "#22c55e" : null;
            const diversityCountUI = (batch.cropIds ?? []).length;
            const diversityItemBonusUI = Math.min(5, Math.floor(diversityCountUI / 2));
            const diversityTierBoostUI = diversityCountUI >= 6;
            const _luckItemBonusUI = Math.min(5, (effectiveStats.szczescie ?? 0) * 0.05);
            const itemDropChancePct = parseFloat((10 + diversityItemBonusUI + _luckItemBonusUI).toFixed(1));
            const currentTierChances = ITEM_TIER_BY_QUALITY[currentQuality];
            const QTY_OPTIONS: Array<1|5|10|100|"max"> = [1,5,10,100,"max"];
            const FILTER_OPTIONS: Array<{ id: typeof kompostFilter; label: string; color: string }> = [
              { id:"rotten",    label:"Popsute",     color:"#ffffff" },
              { id:"good",      label:"Standardowe", color:"#dfcfab" },
              { id:"epic",      label:"Epickie",     color:"#a78bfa" },
              { id:"legendary", label:"Legendarne",  color:"#fbbf24" },
              { id:"all",       label:"Wszystkie",   color:"#6ee7b7" },
            ];
            return (
              <div className="fixed inset-0 z-[300] flex items-start justify-center gap-3 bg-black/75 p-4 backdrop-blur-sm">
                {/* Panel historii */}
                <div className="flex flex-col items-stretch gap-2 pt-0" style={{ width: 290, flexShrink: 0 }}>
                  <button
                    onClick={() => setShowKompostHistory(v => !v)}
                    className="flex items-center gap-2 rounded-xl border border-[#8b6a3e]/60 bg-[rgba(14,8,4,0.95)] px-4 py-2.5 text-[20px] font-black text-[#dfcfab] shadow-lg hover:border-[#dfcfab]/50 transition">
                    📜 Ostatnie nagrody
                    {kompostDropHistory.length > 0 && <span className="rounded-full bg-[#8b6a3e] px-2 text-[18px] text-white">{kompostDropHistory.reduce((s, e) => s + e.count, 0)}</span>}
                    <span className="ml-auto opacity-50 text-[18px]">{showKompostHistory ? "▲" : "▼"}</span>
                  </button>
                  {showKompostHistory && (
                    <div className="w-full rounded-xl border border-[#8b6a3e]/50 bg-[rgba(14,8,4,0.97)] p-4 shadow-xl">
                      {kompostDropHistory.length === 0
                        ? <p className="text-[18px] text-[#8b6a3e]/60 italic">Brak historii w tej sesji.</p>
                        : <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                            {kompostDropHistory.map((h, i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <p className="text-[20px] font-bold leading-snug truncate" style={{ color: h.color }}>{h.icon} {h.label}</p>
                                {h.count > 1 && <span className="shrink-0 rounded-full bg-white/10 px-2 text-[18px] font-black" style={{ color: h.color }}>x{h.count}</span>}
                              </div>
                            ))}
                          </div>
                      }
                    </div>
                  )}
                </div>
                <div
                  className="relative w-full max-w-[920px] max-h-[calc(100vh-40px)] overflow-hidden rounded-[28px] border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.98)] shadow-2xl flex flex-col transition-all duration-700"
                  style={milestoneGlow ? { boxShadow: `0 0 50px ${milestoneGlow}55, 0 0 100px ${milestoneGlow}22` } : undefined}>
                  <button onClick={() => { setShowKompostModal(false); setKompostRewards(null); setShowKompostHelp(false); }} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>
                  {/* Przycisk pomocy ? */}
                  <button
                    onMouseEnter={() => setShowKompostHelp(true)}
                    onMouseLeave={() => setShowKompostHelp(false)}
                    className="absolute right-16 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#8b6a3e] font-black text-[16px] transition hover:border-emerald-500/60 hover:text-emerald-300 select-none">
                    ?
                  </button>
                  {showKompostHelp && (
                    <div className="absolute right-14 top-14 z-50 w-[480px] rounded-2xl border border-[#8b6a3e]/60 bg-[rgba(10,6,2,0.98)] p-5 shadow-2xl text-[#dfcfab] pointer-events-none"
                      style={{ boxShadow: "0 0 40px rgba(34,197,94,0.15)" }}>
                      <p className="text-[14px] font-black text-emerald-300 mb-3">🌿 Jak działa Kompostownik?</p>

                      {/* Zasady */}
                      <div className="text-[12px] text-[#dfcfab]/90 leading-relaxed mb-3 flex flex-col gap-1">
                        <p>• Wrzuć <span className="font-black text-white">100 upraw lub zgniłych owoców</span> aby zapełnić partię.</p>
                        <p>• Im lepsze wrzutki, tym wyższy <span className="font-black text-amber-300">score</span> partii = lepsze nagrody.</p>
                        <p>• Za pełną partię losowane jest <span className="font-black text-yellow-300">5 nagród</span> jednocześnie.</p>
                        <p>• <span className="font-black text-purple-300">Różnorodność</span> gatunków w jednej partii zwiększa szansę na ekwipunek (+1% co 2 gatunki, maks +5%; 6+ gatunków = bonus tier).</p>
                        <p>• <span className="font-black text-yellow-300">Jackpot 0.5%</span> per losowanie — legendarny item niezależnie od jakości.</p>
                      </div>

                      {/* Tabela rzadkości */}
                      <p className="text-[11px] font-black text-[#8b6a3e]/80 uppercase tracking-wider mb-1.5">Mnożnik rzadkości wrzutu</p>
                      <div className="grid grid-cols-4 gap-1 mb-3 text-center">
                        {([["🟫 Zgniłe","×0.25","#9ca3af"],["🟢 Dobre","×1.0","#86efac"],["🟣 Epickie","×2.5","#c4b5fd"],["🌟 Legendarne","×5.0","#fbbf24"]] as const).map(([label, mult, color]) => (
                          <div key={label} className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
                            <p className="text-[11px] font-bold leading-tight" style={{ color }}>{label}</p>
                            <p className="text-[14px] font-black mt-0.5" style={{ color }}>{mult}</p>
                          </div>
                        ))}
                      </div>

                      {/* Tabela upraw - przykładowe */}
                      <p className="text-[11px] font-black text-[#8b6a3e]/80 uppercase tracking-wider mb-1.5">Score upraw (dobre × mnożnik)</p>
                      <div className="grid grid-cols-5 gap-x-2 gap-y-0.5 text-[11px] mb-3">
                        <span className="font-black text-[#8b6a3e]/70">Uprawa</span>
                        <span className="font-black text-[#9ca3af] text-center">Zgn.</span>
                        <span className="font-black text-[#86efac] text-center">Dob.</span>
                        <span className="font-black text-[#c4b5fd] text-center">Epic</span>
                        <span className="font-black text-[#fbbf24] text-center">Leg.</span>
                        {([
                          ["🥕 Marchew",  "0.25","1.0","2.5","5.0"],
                          ["🧅 Cebula",   "0.45","1.8","4.5","9.0"],
                          ["🧄 Czosnek",  "0.50","2.0","5.0","10.0"],
                          ["🫑 Papryka",  "0.70","2.8","7.0","14.0"],
                          ["🍓 Truskaw.", "0.90","3.6","9.0","18.0"],
                          ["🍇 Winog.",   "1.20","4.8","12.0","24.0"],
                          ["🌻 Słonecz.", "1.35","5.4","13.5","27.0"],
                          ["🌿 Szparagi", "1.50","6.0","15.0","30.0"],
                        ] as const).map(([name, a, b, c, d]) => (
                          <React.Fragment key={name}>
                            <span className="text-[#dfcfab]/80 truncate">{name}</span>
                            <span className="text-center text-[#9ca3af]">{a}</span>
                            <span className="text-center text-[#86efac]">{b}</span>
                            <span className="text-center text-[#c4b5fd]">{c}</span>
                            <span className="text-center text-[#fbbf24]">{d}</span>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Tabela owoców */}
                      <p className="text-[11px] font-black text-[#8b6a3e]/80 uppercase tracking-wider mb-1.5">Score zgniłych owoców (cena × 0.25)</p>
                      <div className="grid grid-cols-3 gap-1 text-[11px]">
                        {([
                          ["🍎 Jabłko","5.0"],["🍐 Gruszka","8.75"],["🟣 Śliwka","13.75"],
                          ["🍒 Wiśnia","20.0"],["🍑 Brzoskw.","37.5"],["🍊 Pomarań.","80.0"],
                          ["🍋 Cytryna","125.0"],
                        ] as const).map(([name, score]) => (
                          <div key={name} className="flex justify-between rounded bg-white/5 px-2 py-0.5">
                            <span className="text-[#dfcfab]/80">{name}</span>
                            <span className="font-black text-emerald-300">{score}</span>
                          </div>
                        ))}
                      </div>

                      {/* Progi jakości */}
                      <p className="text-[11px] font-black text-[#8b6a3e]/80 uppercase tracking-wider mt-3 mb-1.5">Progi jakości partii (avg score)</p>
                      <div className="flex gap-2 flex-wrap text-[11px]">
                        {([["🌟 Leg.","≥15","#fbbf24"],["🟣 B.dobry","≥9","#a78bfa"],["🟢 Dobry","≥5","#6ee7b7"],["⚪ Słaby","<5","#9ca3af"]] as const).map(([label, val, color]) => (
                          <div key={label} className="rounded-lg border px-2.5 py-1 bg-white/5" style={{ borderColor: color + "60" }}>
                            <span className="font-black" style={{ color }}>{label}</span>
                            <span className="ml-1.5 text-[#dfcfab]/60">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-6 pt-6 pb-4 border-b border-[#8b6a3e]/30">
                    {/* Nagłówek */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-4xl">🌿</span>
                      <div className="flex-1">
                        <h2 className="text-2xl font-black text-[#dfcfab]">Kompostownik</h2>
                        <p className="text-sm font-bold text-[#8b6a3e] mt-0.5">Zapełnij partię 100 wrzutami — im lepsze uprawy, tym silniejsze nagrody. Za każdą pełną partię: 5 nagród.</p>
                      </div>
                    </div>

                    {/* ── Wielki pasek postępu ── */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-black text-[#dfcfab]">Partia</span>
                        <span className="font-black text-[#dfcfab]">{batch.fill} / {KOMPOST_BATCH_SIZE}</span>
                      </div>
                      <div
                        className="relative h-7 rounded-full bg-black/50 border border-[#8b6a3e]/40 overflow-hidden"
                        style={milestoneGlow ? { boxShadow: `inset 0 0 16px ${milestoneGlow}44` } : undefined}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${fillPct}%`,
                            background: isReady
                              ? `linear-gradient(to right, #f59e0b, #fbbf24, #fde68a)`
                              : batch.fill >= 75 ? `linear-gradient(to right, #a78bfa, #fbbf24)`
                              : batch.fill >= 50 ? `linear-gradient(to right, #22c55e, #a78bfa)`
                              : batch.fill >= 25 ? `linear-gradient(to right, #166534, #22c55e)`
                              : `linear-gradient(to right, ${currentQualityDef.border}, ${currentQualityDef.color})`,
                          }} />
                        {/* Milestone ticks */}
                        {[25, 50, 75].map(m => (
                          <div key={m} className="absolute top-0 bottom-0 w-px" style={{ left: `${m}%`, background: batch.fill >= m ? "rgba(255,255,255,0.6)" : "rgba(139,106,62,0.4)" }} />
                        ))}
                        {isReady && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[13px] font-black text-white drop-shadow-lg tracking-wide">✨ GOTOWA DO ODBIORU!</span>
                          </div>
                        )}
                      </div>
                      {/* Milestone labels */}
                      <div className="flex justify-between text-[12px] font-bold mt-1 px-0.5">
                        <span className="text-[#8b6a3e]/60">0</span>
                        <span style={{ color: batch.fill >= 25 ? "#22c55e" : "#8b6a3e99" }}>25 🟢</span>
                        <span style={{ color: batch.fill >= 50 ? "#a78bfa" : "#8b6a3e99" }}>50 🟣</span>
                        <span style={{ color: batch.fill >= 75 ? "#fbbf24" : "#8b6a3e99" }}>75 🟡</span>
                        <span style={{ color: isReady ? "#fbbf24" : "#8b6a3e99" }}>100 ✨</span>
                      </div>
                    </div>

                    {/* Jakość + statystyki */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 rounded-xl border bg-black/20 px-3 py-2" style={{ borderColor: currentQualityDef.border + "60" }}>
                        <span className="text-[11px] font-bold text-[#8b6a3e]/80 uppercase tracking-wider block mb-0.5">Jakość partii</span>
                        <span className="text-[15px] font-black" style={{ color: currentQualityDef.color }}>{batch.fill > 0 ? currentQualityDef.label : "—"}</span>
                      </div>
                      <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2 text-center">
                        <span className="text-[11px] font-bold text-[#8b6a3e]/80 uppercase tracking-wider block mb-0.5">Moc</span>
                        <span className="text-[15px] font-black text-[#dfcfab]">{batch.fill > 0 ? currentScore.toFixed(1) : "—"}</span>
                      </div>
                      <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2 text-center">
                        <span className="text-[11px] font-bold text-[#8b6a3e]/80 uppercase tracking-wider block mb-0.5">Gatunki</span>
                        <span className="text-[15px] font-black" style={{ color: diversityCountUI >= 6 ? "#a78bfa" : diversityCountUI >= 2 ? "#22c55e" : "#8b6a3e" }}>{diversityCountUI}/10</span>
                      </div>
                      <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2 text-center">
                        <span className="text-[11px] font-bold text-[#8b6a3e]/80 uppercase tracking-wider block mb-0.5">Szansa item</span>
                        <span className="text-[15px] font-black text-amber-300">{itemDropChancePct}%</span>
                      </div>
                    </div>

                    {/* Prognoza nagród — 3 sekcje */}
                    <div className="mb-3 rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-3 pt-3 pb-2 flex flex-col gap-2">
                      <p className="text-[12px] font-black text-[#dfcfab]/80 uppercase tracking-wider">Możliwe nagrody <span className="normal-case font-bold text-[#8b6a3e]">(per losowanie, 5 losowań na partię)</span></p>

                      {/* Blok 1 — Kompost */}
                      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[15px]">🌱</span>
                          <span className="text-[15px] font-black text-emerald-300">Kompost</span>
                          <span className="ml-auto text-[17px] font-black text-emerald-300">{100 - itemDropChancePct}%</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(["growth","yield","exp"] as const).map(ct => {
                            const cTierIdx = COMPOST_TIER_FIXED_BY_QUALITY[currentQuality];
                            const cColor = cTierIdx === 0 ? "#9ca3af" : cTierIdx === 1 ? "#22c55e" : "#a78bfa";
                            return <span key={ct} className="text-[13px] font-black" style={{ color: cColor }}>{COMPOST_DEFS[ct].icon} {COMPOST_DEFS[ct].tierName(COMPOST_DEFS[ct].bonusValues[cTierIdx])}</span>;
                          })}
                          {diversityTierBoostUI && <span className="text-[12px] text-purple-400 font-black">· +tier boost (6+ gatunków)</span>}
                        </div>
                      </div>

                      {/* Blok 2 — Ekwipunek */}
                      <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[15px]">⚔️</span>
                          <span className="text-[15px] font-black text-amber-300">Ekwipunek</span>
                          <span className="ml-auto text-[17px] font-black text-amber-300">{itemDropChancePct}%</span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {currentTierChances.map((chance, i) => chance > 0 && (
                            <div
                              key={i}
                              className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 cursor-help hover:scale-105 transition"
                              style={{ background: `${ITEM_TIER_RARITY[i].border}18`, border: `1px solid ${ITEM_TIER_RARITY[i].border}70`, boxShadow: `0 0 6px ${ITEM_TIER_RARITY[i].shadow}` }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const minLvl = i * 5 + 1; const maxLvl = i * 5 + 5;
                                const tierItems = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= minLvl && it.unlockLevel <= maxLvl);
                                const rarity = ITEM_TIER_RARITY[i];
                                const tipNode = (
                                  <>
                                    <p className="text-[15px] font-black mb-2" style={{ color: rarity.border }}>{rarity.dot} I{i+1} — {rarity.label} (lvl {minLvl}–{maxLvl})</p>
                                    <p className="text-[12px] font-bold text-[#8b6a3e]/70 mb-1.5 uppercase tracking-wider">Mozliwe nagrody ({tierItems.length}):</p>
                                    <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 320 }}>
                                      {tierItems.map(it => (<p key={it.id} className="text-[13px] text-[#dfcfab] leading-snug">{it.icon} {it.name}</p>))}
                                    </div>
                                  </>
                                );
                                const _tc0 = toGameCoords(rect.left + rect.width / 2, rect.bottom);
                                setKompostTierHoverTip({ x: _tc0.x, y: _tc0.y, node: tipNode, color: rarity.border });
                              }}
                              onMouseLeave={() => setKompostTierHoverTip(null)}>
                              <span className="text-[16px] leading-none">{ITEM_TIER_RARITY[i].dot}</span>
                              <span className="text-[14px] font-black" style={{ color: ITEM_TIER_RARITY[i].border }}>{chance}%</span>
                              <span className="text-[11px] font-bold" style={{ color: ITEM_TIER_RARITY[i].border }}>{ITEM_TIER_RARITY[i].label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Blok 3 — Jackpot */}
                      <div className="rounded-lg border border-yellow-600/40 bg-yellow-950/30 px-3 py-2 flex items-center gap-2">
                        <span className="text-[15px]">✨</span>
                        <span className="text-[15px] font-black text-yellow-300">Jackpot</span>
                        <span className="text-[12px] font-bold text-yellow-200/70 flex-1">— legendarny item (niezależnie od jakości partii)</span>
                        <span className="text-[17px] font-black text-yellow-300">{JACKPOT_CHANCE}%</span>
                      </div>
                    </div>

                    {/* Przycisk odbioru */}
                    <button
                      onClick={() => { if (isReady) void claimKompostReward(); }}
                      disabled={!isReady}
                      className={`w-full rounded-2xl border-2 px-6 py-3 text-base font-black transition shadow-lg ${
                        isReady
                          ? "border-yellow-400/80 bg-gradient-to-r from-yellow-600 to-amber-500 text-white hover:scale-[1.02] shadow-yellow-500/30 animate-pulse cursor-pointer"
                          : "border-[#8b6a3e]/30 bg-black/30 text-[#8b6a3e]/40 shadow-none cursor-not-allowed"
                      }`}>
                      {isReady
                        ? `🎲 Odbierz 5 nagród! (partia gotowa)`
                        : `🎲 Jeszcze ${KOMPOST_BATCH_SIZE - batch.fill} wrzutów do odbioru`}
                    </button>
                  </div>

                  {/* Sticky controls — pasek ilości + filtr (NIE scrolluje się z uprawami) */}
                  <div className="px-6 pt-3 pb-2 border-b border-[#8b6a3e]/30 bg-[rgba(14,8,4,0.85)]">
                    {/* Wybór ilości */}
                    <div className="mb-2">
                      <p className="text-[11px] text-[#8b6a3e] mb-1">Ilość przy kliknięciu:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {QTY_OPTIONS.map(q => (
                          <button
                            key={String(q)}
                            onClick={() => setKompostQty(q)}
                            className={`px-3 py-1 rounded-lg text-xs font-black border transition ${kompostQty === q ? "border-yellow-400/60 bg-yellow-500/20 text-yellow-200" : "border-[#8b6a3e]/40 bg-black/20 text-[#dfcfab] hover:border-[#dfcfab]/40"}`}>
                            {q === "max" ? "Max" : q}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Filtr jakości */}
                    <div>
                      <p className="text-[11px] text-[#8b6a3e] mb-1">Filtruj uprawy:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {FILTER_OPTIONS.map(f => (
                          <button
                            key={f.id}
                            onClick={() => setKompostFilter(f.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-black border transition ${kompostFilter === f.id ? "bg-yellow-500/20 text-yellow-200" : "bg-black/20 text-[#dfcfab] hover:bg-[#8b6a3e]/20"}`}
                            style={{ borderColor: kompostFilter === f.id ? f.color : "rgba(139,106,62,0.4)" }}>
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
                          <div className="rounded-2xl border border-dashed border-[#8b6a3e]/40 bg-black/20 p-8 text-center">
                            <p className="text-4xl mb-3">🥕</p>
                            <p className="text-sm font-bold text-[#dfcfab]">{kompostFilter === "all" ? "Brak upraw do kompostowania" : `Brak upraw z filtrem „${FILTER_OPTIONS.find(f=>f.id===kompostFilter)?.label}"`}</p>
                            <p className="text-[11px] text-[#8b6a3e]/70 mt-1">Zmień filtr lub zbierz uprawy z pola.</p>
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
                                disabled={batchFull}
                                title={batchFull ? "Partia pełna — odbierz nagrody" : `Wrzuć ${qty} szt.`}
                                className="group relative flex flex-col items-center justify-center aspect-square rounded-xl border border-[#8b6a3e]/50 bg-black/30 hover:border-[#dfcfab]/60 hover:bg-[#8b6a3e]/20 hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed p-1"
                                style={qDef ? { borderColor: qDef.borderColor + "88" } : undefined}>
                                {sprite ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={sprite} alt={crop.name} className="w-24 h-24 object-contain" />
                                ) : (
                                  <span className="text-5xl">🌱</span>
                                )}
                                <span className="mt-0.5 text-[10px] font-bold text-[#dfcfab] truncate w-full text-center">{crop.name}</span>
                                {qDef && <span className="text-[9px] font-black" style={{ color: qDef.borderColor }}>{qDef.label}</span>}
                                <span className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[10px] font-black text-[#dfcfab]">×{amount}</span>
                                <span className="absolute bottom-1 right-1 rounded bg-[#8b6a3e]/80 px-1 text-[9px] font-black text-white">+{qty}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Zgniłe owoce */}
                    {(() => {
                      const zgnileEntries = (Object.entries(fruitInventory).filter(
                        ([k, amt]) => Number(amt) > 0 && k.endsWith("_zgnile")
                      ) as Array<[string, number]>);
                      if (zgnileEntries.length === 0) return null;
                      const sortedFruits = [...zgnileEntries].sort(([aKey], [bKey]) => {
                        const aFid = aKey.slice(0, aKey.lastIndexOf("_"));
                        const bFid = bKey.slice(0, bKey.lastIndexOf("_"));
                        const aLv = TREES.find(t => t.fruitId === aFid)?.unlockLevel ?? 999;
                        const bLv = TREES.find(t => t.fruitId === bFid)?.unlockLevel ?? 999;
                        return aLv - bLv;
                      });
                      return (
                        <div className="mt-4">
                          <p className="text-[11px] font-bold text-gray-400 mb-2">🍂 Zgniłe owoce (nie do sprzedaży)</p>
                          <div className="grid grid-cols-5 gap-2">
                            {sortedFruits.map(([fruitKey, amount]) => {
                              const fid = fruitKey.slice(0, fruitKey.lastIndexOf("_"));
                              const tree = TREES.find(t => t.fruitId === fid);
                              if (!tree) return null;
                              const qty = kompostQty === "max" ? amount : Math.min(kompostQty, amount);
                              return (
                                <button
                                  key={fruitKey}
                                  onClick={() => void depositFruitToCompost(fruitKey, qty)}
                                  disabled={batchFull}
                                  title={batchFull ? "Partia pełna — odbierz nagrody" : `Wrzuć ${qty} szt.`}
                                  className="group relative flex flex-col items-center justify-center aspect-square rounded-xl border border-white/40 bg-white/5 hover:border-white/70 hover:bg-white/10 hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed p-1">
                                  <span className="text-5xl">{tree.fruitIcon}</span>
                                  <span className="mt-0.5 text-[10px] font-bold text-white truncate w-full text-center">{tree.fruitName}</span>
                                  <span className="text-[9px] font-black text-white">Zgniłe</span>
                                  <span className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[10px] font-black text-gray-300">×{amount}</span>
                                  <span className="absolute bottom-1 right-1 rounded bg-gray-700/80 px-1 text-[9px] font-black text-white">+{qty}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="px-6 py-3 border-t border-[#8b6a3e]/30 text-center">
                    <p className="text-[11px] text-[#8b6a3e]/70">
                      Rodzaje kompostu: ⚡ Wzrost (-5/10/15% czasu) · 🌾 Urodzaj (+1/2/3 plon) · ⭐ Nauka (+10/20/30% EXP)
                    </p>
                  </div>
                </div>

                {/* Panel nagród (overlay) */}
                {kompostRewards && (
                  <div className="absolute inset-0 z-[10] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-[720px] max-h-[88vh] overflow-hidden rounded-[24px] border-2 border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl flex flex-col">
                      <div className="px-6 pt-5 pb-3 border-b border-[#8b6a3e]/30 text-center">
                        <div className="text-5xl mb-2">🎁</div>
                        <h3 className="text-[32px] font-black text-[#dfcfab]">Zdobyłeś {kompostRewards.length} {kompostRewards.length === 1 ? "nagrodę" : kompostRewards.length < 5 ? "nagrody" : "nagród"}!</h3>
                        <p className="text-[16px] text-[#8b6a3e] mt-1">Najedź na nagrodę, aby zobaczyć szczegóły.</p>
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
                                  const itemTierIdx = it ? Math.min(4, Math.floor((it.unlockLevel - 1) / 5)) : 0;
                                  const rarityDef = ITEM_TIER_RARITY[itemTierIdx];
                                  const tipNode = (
                                    <>
                                      <p className="text-[17px] font-black" style={{ color: rarityDef.border }}>Przedmiot — {rarityDef.label}</p>
                                      <p className="text-[15px] font-bold text-amber-100">{r.itemIcon} {r.itemName}</p>
                                      {it && <p className="text-[14px] text-amber-300/80">Poziom: {it.unlockLevel} · Slot: {EQUIP_SLOT_META[it.slot]?.label}</p>}
                                      {it && <p className="text-[14px] text-cyan-300">{bonusLine(it.bonuses, 0)}</p>}
                                      <p className="text-[14px] text-emerald-300 mt-1">Trafil do Twojego ekwipunku</p>
                                    </>
                                  );
                                  const showTip = (e: React.MouseEvent<HTMLDivElement>) => {
                                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                    const _tc1 = toGameCoords(rect.left + rect.width / 2, rect.top);
                                  setKompostHoverTip({ x: _tc1.x, y: _tc1.y, node: tipNode, color: rarityDef.border });
                                  };
                                  return (
                                    <div
                                      key={i}
                                      onMouseEnter={showTip}
                                      onMouseMove={showTip}
                                      onMouseLeave={() => setKompostHoverTip(null)}
                                      className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 p-2 transition cursor-help hover:brightness-110"
                                      style={{ borderColor: rarityDef.border, background: `rgba(0,0,0,0.5)`, boxShadow: `0 0 12px ${rarityDef.shadow}` }}>
                                      <span className="text-3xl">{r.itemIcon}</span>
                                      <span className="mt-1 text-[10px] font-black truncate w-full text-center" style={{ color: rarityDef.border }}>{r.itemName}</span>
                                      <span className="text-[8px] font-bold opacity-70" style={{ color: rarityDef.border }}>{rarityDef.label}</span>
                                      {g.count > 1 && <span className="absolute top-1 right-1 rounded bg-black/70 border px-1 text-[10px] font-black text-white" style={{ borderColor: rarityDef.border }}>×{g.count}</span>}
                                    </div>
                                  );
                                }
                                const def = COMPOST_DEFS[r.compostType];
                                const tierIdx = def.bonusValues.indexOf(r.value);
                                const tierColor = tierIdx === 0 ? "#9ca3af" : tierIdx === 1 ? "#22c55e" : "#a78bfa";
                                const tipNode = (
                                  <>
                                    <p className="text-[17px] font-black text-emerald-200">{def.icon} {def.name}</p>
                                    <p className="text-[14px] text-emerald-300/80">{def.desc}</p>
                                    <p className="text-[15px] font-black mt-1" style={{ color: tierColor }}>Tier: {def.tierName(r.value)}</p>
                                    <p className="text-[15px] font-black" style={{ color: tierColor }}>Bonus: {def.bonusLabel(r.value)}</p>
                                    <p className="text-[14px] text-amber-300 mt-1">Przeciagnij na pole z uprawa w plecaku</p>
                                  </>
                                );
                                const showTip = (e: React.MouseEvent<HTMLDivElement>) => {
                                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                  const _tc2 = toGameCoords(rect.left + rect.width / 2, rect.top);
                                  setKompostHoverTip({ x: _tc2.x, y: _tc2.y, node: tipNode, color: tierColor });
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
                      <div className="px-6 py-3 border-t border-[#8b6a3e]/30 flex justify-center">
                        <button
                          onClick={() => { setKompostRewards(null); setKompostHoverTip(null); }}
                          className="rounded-2xl border-2 border-yellow-400/70 bg-gradient-to-r from-yellow-600 to-amber-500 px-8 py-2 text-sm font-black text-white hover:scale-105 transition shadow-lg shadow-yellow-500/20">
                          Świetnie!
                        </button>
                      </div>
                    </div>
                    {/* Fixed-position tooltip — poza overflow-hidden panelu */}
                    {kompostHoverTip && (() => {
                      const TIP_W = 336;
                      const TIP_H_EST = 182;
                      const margin = 10;
                      const vw = BASE_W;
                      const vh = BASE_H;
                      let left = kompostHoverTip.x - TIP_W / 2;
                      left = Math.max(margin, Math.min(vw - TIP_W - margin, left));
                      let top = kompostHoverTip.y - TIP_H_EST - 12;
                      const placeBelow = top < margin;
                      if (placeBelow) top = kompostHoverTip.y + 70;
                      top = Math.max(margin, Math.min(vh - TIP_H_EST - margin, top));
                      return (
                        <div
                          className="pointer-events-none fixed z-[9999] flex flex-col gap-1.5 rounded-xl border-2 px-4 py-3 shadow-2xl text-left bg-[rgba(8,18,12,0.98)]"
                          style={{ left, top, width: TIP_W, borderColor: kompostHoverTip.color }}>
                          {kompostHoverTip.node}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {/* Tier tooltip — widoczny zawsze, nie tylko gdy panel nagród otwarty */}
                {kompostTierHoverTip && (() => {
                  const TIP_W = 308;
                  const TIP_H_EST = 420;
                  const margin = 10;
                  const vw = BASE_W;
                  const vh = BASE_H;
                  let left = kompostTierHoverTip.x - TIP_W / 2;
                  left = Math.max(margin, Math.min(vw - TIP_W - margin, left));
                  let top = kompostTierHoverTip.y + 8;
                  top = Math.max(margin, Math.min(vh - TIP_H_EST - margin, top));
                  return (
                    <div
                      className="pointer-events-none fixed z-[9999] flex flex-col gap-1 rounded-xl border-2 px-4 py-3.5 shadow-2xl text-left bg-[rgba(8,18,12,0.98)]"
                      style={{ left, top, width: TIP_W, borderColor: kompostTierHoverTip.color }}>
                      {kompostTierHoverTip.node}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Fixed avatar tooltip — śledzi kursor */}
          {avatarTipVisible && (
            <div
              className="pointer-events-none fixed z-[9999]"
              style={{ left: avatarTipPos.x + 16, top: avatarTipPos.y + 16 }}
            >
              <div className="rounded-[14px] border border-[#8b6a3e] bg-[rgba(18,10,4,0.97)] px-4 py-3 shadow-xl backdrop-blur-sm w-[240px]">
                <p className="mb-2 text-[15px] font-black leading-tight text-[#f9e7b2]">{profile?.login ?? "—"}</p>
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8b6a3e]">Avatar</span>
                    <span className="text-right font-bold text-[#d8ba7a]">
                      {avatarSkin < 0 ? "Brak" : (AVATAR_META[avatarSkin]?.name ?? "—")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8b6a3e]">Doświadczenie</span>
                    <span className="font-bold text-[#d8ba7a]">{displayXp}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8b6a3e]">Kolejny poziom</span>
                    <span className="font-bold text-[#d8ba7a]">{displayXpToNextLevel > 0 ? displayXpToNextLevel : "MAX"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fixed card tooltip — owoce, przedmioty, kompost — nad kursorem */}
          {cardTip && (
            <div
              className="pointer-events-none fixed z-[9999] flex flex-col items-center"
              style={{ left: mousePos.x, top: mousePos.y - 14, transform: "translate(-50%, -100%)" }}>
              <div className="rounded-xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-5 py-[13px] text-center shadow-2xl max-w-[370px]">
                {cardTip}
              </div>
              <div className="h-2 w-2 rotate-45 border-r border-b border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] -mt-1" />
            </div>
          )}

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
            const honeyStarted = hiveData.honey_start != null;
            const canCollect = honeyStarted && honeyAvailable > 0 && hiveData.empty_jars > 0 && hiveData.suit_durability > 0;
            const suitPct = Math.round((hiveData.suit_durability / 100) * 100);
            const hiveBonusPct = hlvl * 2;
            const hiveImg = `/ul/ul_${hlvl}.png`;
            const playerMoney = profile?.money ?? 0;
            const buyHive = async () => {
              if (!profile?.id) return;
              if (playerMoney < HIVE_BUY_COST) {
                setMessage({ type:"error", title:"Brak pieniędzy", text:`Potrzebujesz ${HIVE_BUY_COST} zł żeby kupić ul.` });
                return;
              }
              const { data, error } = await supabase.rpc("buy_hive", { p_user_id: profile.id });
              if (error || !data?.ok) {
                setMessage({ type:"error", title:"Nie udało się kupić ula", text: data?.error || error?.message || "Spróbuj ponownie." });
                await loadProfile(profile.id);
                return;
              }
              setHiveData(data.hive_data as HiveData);
              await loadProfile(profile.id);
              setMessage({ type:"success", title:"🍯 Ul kupiony!", text:`Kup minimum ${HIVE_MIN_BEES_TO_PRODUCE} pszczół żeby ul ruszył z produkcją miodu.` });
            };
            const addBees = async (n: number) => {
              if (!profile?.id) return;
              const add = Math.min(n, beesNeeded - beesProgress);
              if (add <= 0) return;
              const cost = add * BEE_COST;
              if (playerMoney < cost) {
                setMessage({ type:"error", title:"Brak pieniędzy", text:`Potrzebujesz ${cost} zł na ${add} ${add === 1 ? "pszczołę" : add < 5 ? "pszczoły" : "pszczół"}.` });
                return;
              }
              const { data, error } = await supabase.rpc("add_hive_bees", { p_user_id: profile.id, p_amount: add });
              if (error || !data?.ok) {
                setMessage({ type:"error", title:"Nie udało się kupić pszczół", text: data?.error || error?.message || "Spróbuj ponownie." });
                await loadProfile(profile.id);
                return;
              }
              setHiveData(data.hive_data as HiveData);
              await loadProfile(profile.id);
              // Feedback o wyniku losowania (przyjęte vs. zginęły)
              const _attempted = data.bees_attempted ?? add;
              const _accepted  = data.bees_accepted  ?? _attempted;
              const _rejected  = data.bees_rejected  ?? 0;
              const _lostMoney = _rejected * BEE_COST;
              if (_rejected === 0) {
                if (_accepted === 1) {
                  setMessage({ type:"success", title:`🐝 Pszczoła przyjęta!`, text:`Powodzenie — wleciała prosto do ula.` });
                } else {
                  setMessage({ type:"success", title:`🐝 Wszystkie ${_accepted} ${_accepted < 5 ? "pszczoły przyjęte" : "pszczół przyjęte"}!`, text:`Świetna robota — żadna nie zginęła.` });
                }
              } else if (_accepted === 0) {
                if (_rejected === 1) {
                  setMessage({ type:"error", title:`💀 Pszczoła nie przyjęła się, zginęła!`, text:`Straciłeś ${_lostMoney} zł. Pech! (szansa przyjęcia: ${data.chance_pct}%)` });
                } else {
                  setMessage({ type:"error", title:`💀 Wszystkie ${_rejected} ${_rejected < 5 ? "pszczoły zginęły" : "pszczół zginęło"}!`, text:`Straciłeś ${_lostMoney} zł. Pech! (szansa przyjęcia: ${data.chance_pct}%)` });
                }
              } else {
                setMessage({ type:"error", title:`🐝 Przyjęto ${_accepted}/${_attempted} pszczół`, text:`${_rejected} ${_rejected === 1 ? "zginęła" : "zginęło"} — straciłeś ${_lostMoney} zł. (szansa przyjęcia: ${data.chance_pct}%)` });
              }
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
                setMessage({ type:"error", title: msg, text: "Synchronizuję stan ula z bazą..." });
                // FIX: synchronizacja UI z bazą po błędzie (np. po nieudanym zbiorze
                // honey_start został zresetowany w bazie, ale UI wciąż pokazuje 8/8).
                await loadProfile(profile.id);
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
                <div className="relative flex w-full max-w-[650px] max-h-[calc(100vh-40px)] flex-col rounded-[28px] border border-amber-600/60 bg-[rgba(14,8,4,0.98)] p-8 shadow-2xl gap-5 overflow-y-auto">
                  <button onClick={() => setShowUlModal(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">🍯</span>
                    <div>
                      <h2 className="text-2xl font-black text-[#f9e7b2]">{hlvl === 0 ? "Ul — brak (kup, by zacząć)" : `Ul — poziom ${hlvl}`}</h2>
                      <p className="text-sm text-amber-400/80">{hlvl === 0 ? "Najpierw kup ul, potem pszczoły — i ruszysz z produkcją miodu." : `Pszczoły przyspieszają wzrost o ${hiveBonusPct}%`}</p>
                    </div>
                  </div>
                  {/* Obraz ula (tylko gdy istnieje) */}
                  {hlvl > 0 && (
                    <div className="flex justify-center">
                      <img src={hiveImg} alt={`Ul poziom ${hlvl}`} className="h-36 object-contain" style={{imageRendering:"pixelated"}} onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }} />
                    </div>
                  )}
                  {hlvl === 0 && (
                    <div className="flex justify-center items-center h-36 rounded-2xl border-2 border-dashed border-[#8b6a3e]/40 bg-black/20">
                      <span className="text-6xl opacity-40">🪧</span>
                    </div>
                  )}
                  {/* Sekcja zakupu ula (tylko lvl 0) */}
                  {hlvl === 0 && (
                    <div className="rounded-2xl border border-amber-600/40 bg-amber-900/10 p-5 flex flex-col gap-3">
                      <div>
                        <p className="text-base font-black text-[#f9e7b2]">Kup ul (poziom 1)</p>
                        <p className="text-xs text-[#dfcfab]/80 mt-1">Po zakupie ula musisz dokupić minimum {HIVE_MIN_BEES_TO_PRODUCE} pszczół ({HIVE_MIN_BEES_TO_PRODUCE * BEE_COST} zł), żeby uruchomić produkcję miodu.</p>
                      </div>
                      <button
                        disabled={playerMoney < HIVE_BUY_COST}
                        onClick={() => { void buyHive(); }}
                        className={`w-full rounded-xl py-3 text-sm font-black transition ${playerMoney >= HIVE_BUY_COST ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
                      >
                        {playerMoney >= HIVE_BUY_COST ? `🍯 Kup ul (${HIVE_BUY_COST} zł)` : `🚫 Brak pieniędzy (${HIVE_BUY_COST} zł)`}
                      </button>
                    </div>
                  )}
                  {/* Miód */}
                  {hlvl > 0 && (
                  <div className="rounded-2xl border border-amber-600/30 bg-black/30 p-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[#dfcfab] font-bold">🍯 Miód</span>
                      <span className="text-amber-300 font-black">{honeyAvailable} / {maxHoney}</span>
                    </div>
                    <div className="h-3 rounded-full bg-black/40 border border-amber-700/30 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all" style={{ width:`${maxHoney > 0 ? (honeyAvailable/maxHoney*100) : 0}%` }} />
                    </div>
                    {honeyStarted ? (
                      <p className="mt-2 text-xs text-[#8b6a3e]">Następny słoik za: <span className="text-amber-300 font-bold">{timerStr}</span></p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-400/90 font-bold">🐝 Ul jeszcze nie produkuje — kup minimum {HIVE_MIN_BEES_TO_PRODUCE} pszczół żeby ruszyć z produkcją miodu!</p>
                    )}
                  </div>
                  )}
                  {/* Zasoby */}
                  {hlvl > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3 flex items-center gap-3">
                      <img src="/przedmioty/jar_empty.png" alt="Słoiki" className="w-8 h-8 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0";}} />
                      <div>
                        <p className="text-xs text-[#8b6a3e]">Puste słoiki</p>
                        <p className="font-black text-[#f9e7b2]">{hiveData.empty_jars}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3 flex items-center gap-3">
                      <img src="/przedmioty/jar_honey.png" alt="Miód" className="w-8 h-8 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0";}} />
                      <div>
                        <p className="text-xs text-[#8b6a3e]">Słoiki z miodem</p>
                        <p className="font-black text-[#f9e7b2]">{hiveData.honey_jars}</p>
                      </div>
                    </div>
                  </div>
                  )}
                  {/* Strój pszczelarza */}
                  {hlvl > 0 && (
                  <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <img src="/przedmioty/beekeeper_suit.png" alt="Strój" className="w-8 h-8 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
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
                  )}
                  {/* Przycisk zbioru */}
                  {hlvl > 0 && (
                  <button
                    disabled={!canCollect}
                    onClick={() => { void collectHoney(); }}
                    className={`w-full rounded-xl py-3 text-sm font-black transition ${canCollect ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
                  >
                    {!honeyStarted ? `🐝 Kup minimum ${HIVE_MIN_BEES_TO_PRODUCE} pszczół` : !canCollect && hiveData.suit_durability <= 0 ? "🚫 Brak stroju pszczelarza" : !canCollect && hiveData.empty_jars <= 0 ? "🚫 Brak słoików" : !canCollect ? "🕐 Poczekaj na miód" : `🍯 Zbierz miód (${Math.min(honeyAvailable, hiveData.empty_jars)} słoiki)`}
                  </button>
                  )}
                  {/* Ulepszanie ula */}
                  {hlvl >= 1 && hlvl < 5 && (
                    <div className="rounded-2xl border border-amber-600/30 bg-black/30 p-4">
                      <p className="text-sm font-bold text-[#dfcfab] mb-1">🐝 Dokup pszczoły ({beesProgress}/{beesNeeded})</p>
                      <p className="text-xs text-amber-400/80 mb-1">Cena: <span className="font-black text-yellow-200">{BEE_COST} zł</span> za 1 pszczołę</p>
                      <p className={`text-xs mb-2 font-bold ${(HIVE_BEE_ACCEPT_CHANCE[hlvl] ?? 0) >= 0.8 ? "text-green-400" : (HIVE_BEE_ACCEPT_CHANCE[hlvl] ?? 0) >= 0.6 ? "text-yellow-300" : "text-red-400"}`}>
                        Szansa przyjęcia pszczoły: <span className="font-black">{Math.round((HIVE_BEE_ACCEPT_CHANCE[hlvl] ?? 0) * 100)}%</span>
                      </p>
                      <p className="text-xs text-red-400/80 mb-2">⚠️ Pszczoła która nie zostanie przyjęta — ginie, a kasa przepada.</p>
                      <div className="h-2 rounded-full bg-black/40 overflow-hidden mb-3">
                        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width:`${beesNeeded > 0 ? (beesProgress/beesNeeded*100) : 0}%` }} />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {[1,5,10].map(n => {
                          const _add = Math.min(n, beesNeeded - beesProgress);
                          const _cost = _add * BEE_COST;
                          const _disabled = beesProgress >= beesNeeded || playerMoney < _cost || _add <= 0;
                          return (
                            <button key={n} disabled={_disabled} onClick={() => { void addBees(n); }}
                              title={`Koszt: ${_cost} zł`}
                              className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-800/30 disabled:opacity-40 disabled:cursor-not-allowed">
                              +{n} 🐝 ({n * BEE_COST}zł)
                            </button>
                          );
                        })}
                        {(() => {
                          const _addMax = beesNeeded - beesProgress;
                          const _costMax = _addMax * BEE_COST;
                          const _disabledMax = _addMax <= 0 || playerMoney < _costMax;
                          return (
                            <button disabled={_disabledMax} onClick={() => { void addBees(_addMax); }}
                              title={`Koszt: ${_costMax} zł`}
                              className="rounded-lg border border-amber-500/60 bg-amber-700/20 px-3 py-2 text-xs font-bold text-yellow-200 hover:bg-amber-700/30 disabled:opacity-40 disabled:cursor-not-allowed">
                              MAX 🐝 ({_costMax}zł)
                            </button>
                          );
                        })()}
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
              const order = customerOrders[currentCustomerIdx] ?? null;
              const totalOrders = customerOrders.length;
              const goNext = () => setCurrentCustomerIdx(i => totalOrders === 0 ? 0 : (i + 1) % totalOrders);
              const goPrev = () => setCurrentCustomerIdx(i => totalOrders === 0 ? 0 : (i - 1 + totalOrders) % totalOrders);

              const haveFor = (id: string): number => {
                if (id === 'honey_jar') return hiveData.honey_jars;
                if (/_(good|epic|legendary)$/.test(id)) return seedInventory[id] ?? 0;
                if (/_(zwykly|soczysty|zloty|zgnile)$/.test(id)) return fruitInventory[id] ?? 0;
                return barnItems[id] ?? 0;
              };
              const mergedItems = order ? mergeOrderItems(order.items) : [];
              const canFulfill = order ? mergedItems.every(it => haveFor(it.id) >= it.qty) : false;

              const timeLeft = order ? Math.max(0, new Date(order.expires_at).getTime() - customerNow) : 0;
              const minLeft = Math.floor(timeLeft / 60000);
              const secLeft = Math.floor((timeLeft % 60000) / 1000);
              const isExpired = order && timeLeft <= 0;

              const customer = order ? getCustomerDisplay(order.customer_type) : null;

              return (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                  <div className="relative flex w-full max-w-[640px] max-h-[calc(100vh-40px)] flex-col rounded-[28px] border border-amber-600/60 bg-[rgba(14,8,4,0.98)] shadow-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowLadaInfo(v => !v)}
                      className={`absolute left-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border font-black transition hover:scale-110 ${showLadaInfo ? 'border-amber-300 bg-amber-900/60 text-amber-200' : 'border-amber-500/70 bg-black/40 text-amber-300 hover:border-amber-300 hover:text-amber-200'}`}
                      title="Pomoc — jak działa lada?"
                    >?</button>
                    <button onClick={() => setShowLadaModal(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>

                    <div className="px-6 pt-6 pb-4 border-b border-amber-700/30">
                      <h2 className="text-3xl font-black text-[#f9e7b2] text-center">Lada dla klientów</h2>
                    </div>

                    {/* Pasek: czas do następnego klienta */}
                    {nextSpawnAt !== null && (() => {
                      const left = Math.max(0, nextSpawnAt - customerNow);
                      const m = Math.floor(left / 60000);
                      const s = Math.floor((left % 60000) / 1000);
                      const isReady = left <= 0;
                      return (
                        <div className={`px-5 py-2 text-center text-xs font-bold border-b ${isReady ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-300' : 'border-amber-700/20 bg-black/20 text-[#dfcfab]'}`}>
                          {isReady
                            ? '✨ Nowy klient lada chwila — odśwież listę!'
                            : <>👥 Nowy klient za: <span className="font-black text-amber-400">{m > 0 ? `${m}min ` : ''}{s}s</span></>}
                        </div>
                      );
                    })()}

                    <div className="flex-1 overflow-y-auto p-5">
                      {showLadaInfo ? (
                        <div className="space-y-4 text-[#dfcfab]">
                          <div>
                            <p className="text-base font-black text-amber-300 mb-2">Lada dla klientów</p>
                            <p className="text-[13px] text-[#bfa274] leading-relaxed mb-2">Klienci NPC odwiedzają Twoją farmę i chcą kupić różne produkty:</p>
                            <ul className="text-[13px] text-[#dfcfab] space-y-0.5 list-none mb-3">
                              <li>🌱 uprawy,</li>
                              <li>🍎 owoce z sadu,</li>
                              <li>🐔 produkty zwierzęce,</li>
                              <li>🍯 miód.</li>
                            </ul>
                            <p className="text-[13px] text-[#bfa274] leading-relaxed mb-1">Każde zamówienie ma limit czasu. Po jego wykonaniu dostajesz:</p>
                            <ul className="text-[13px] text-[#dfcfab] space-y-0.5 list-none">
                              <li>💰 złoto,</li>
                              <li>⭐ EXP,</li>
                              <li>🎁 czasem bonusowy przedmiot.</li>
                            </ul>
                          </div>

                          <div>
                            <p className="text-sm font-black text-amber-300 mb-2">👥 Typy klientów</p>
                            <p className="text-[12px] text-[#8b6a3e] mb-2">Im wyższy poziom gracza, tym większe i lepsze zamówienia.</p>
                            <div className="space-y-1 text-[12px]">
                              <div className="grid grid-cols-[1fr_66px_112px_44px] gap-x-3 px-2.5 py-1 text-[#8b6a3e] font-bold text-[11px] uppercase tracking-wider">
                                <span>Klient</span><span className="text-center">Produkty</span><span className="text-center">Bonus nagród</span><span className="text-center">Czas</span>
                              </div>
                              {[
                                { i:'🧑‍🌾', n:'Sąsiad',                   it:'1',      m:'×1.00', t:'12h' },
                                { i:'🧓',   n:'Gość ze wsi',             it:'1–2',    m:'×1.15', t:'16h' },
                                { i:'🏪',   n:'Mały targ',               it:'2–3',    m:'×1.35', t:'20h' },
                                { i:'🏬',   n:'Sklep wiejski',           it:'3–4',    m:'×1.60', t:'24h' },
                                { i:'🍽️',  n:'Restauracja',             it:'4–5',    m:'×2.00', t:'30h' },
                                { i:'🏢',   n:'Hurtownia',               it:'5–6',    m:'×2.50', t:'36h' },
                                { i:'🏛️',  n:'Sieć handlowa',           it:'6–8',    m:'×3.20', t:'42h' },
                                { i:'🏗️',  n:'Centrum dystrybucji',     it:'7–9',    m:'×4.00', t:'48h' },
                                { i:'🌍',   n:'Kontrakt międzynarodowy', it:'8–10',   m:'×5.00', t:'48h' },
                              ].map(c => (
                                <div key={c.n} className="grid grid-cols-[1fr_66px_112px_44px] gap-x-3 items-center rounded-lg border border-amber-700/30 bg-black/25 px-2.5 py-1.5">
                                  <span className="font-bold text-[#f9e7b2] truncate">{c.i} {c.n}</span>
                                  <span className="text-[#bfa274] text-center">{c.it}</span>
                                  <span className="text-amber-300 font-bold text-center">{c.m}</span>
                                  <span className="text-[#8b6a3e] text-center">{c.t}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-black text-amber-300 mb-2">💰 Nagrody</p>
                            <p className="text-[12px] text-[#bfa274] font-bold mb-1">Podstawowe</p>
                            <ul className="text-[12.5px] space-y-1 list-disc list-inside text-[#dfcfab] mb-2">
                              <li>💰 Gold = wartość produktów × bonus klienta</li>
                              <li>⭐ EXP = dodatkowa nagroda za wykonanie zamówienia</li>
                            </ul>
                            <p className="text-[12px] text-[#bfa274] font-bold mb-1">Bonusy (losowo)</p>
                            <p className="text-[12px] text-[#8b6a3e] mb-1">Niektórzy klienci mogą dać dodatkowo:</p>
                            <ul className="text-[12.5px] space-y-0.5 list-none text-[#dfcfab]">
                              <li>🌿 kompost,</li>
                              <li>🐔 produkty zwierząt,</li>
                              <li>🍎 rzadkie owoce,</li>
                              <li>🎒 materiały do ulepszania,</li>
                              <li>✨ rzadkie przedmioty.</li>
                            </ul>
                            <p className="text-[11px] text-[#8b6a3e] mt-1.5">Im większy klient, tym większa szansa na bonus.</p>
                          </div>

                          <div>
                            <p className="text-sm font-black text-amber-300 mb-2">⭐ Jakości produktów</p>
                            <div className="space-y-1.5 text-[12.5px]">
                              <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/15 px-2.5 py-1.5">
                                <p className="font-bold text-emerald-300 mb-0.5">🌱 Uprawy</p>
                                <p className="text-[#bfa274]">zwykła, epicka, legendarna.</p>
                              </div>
                              <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/15 px-2.5 py-1.5">
                                <p className="font-bold text-emerald-300 mb-0.5">🍎 Owoce</p>
                                <p className="text-[#bfa274]">zwykły, soczysty, złoty.</p>
                              </div>
                            </div>
                            <p className="text-[11px] text-[#8b6a3e] mt-1.5">Klient może wymagać konkretnej jakości produktu.</p>
                          </div>

                          <div>
                            <p className="text-sm font-black text-amber-300 mb-2">📋 Jak wykonać zamówienie?</p>
                            <ol className="text-[12.5px] space-y-1 list-decimal list-inside text-[#dfcfab]">
                              <li>Zbierz wymagane produkty.</li>
                              <li>Kliknij 🤝 „Zrealizuj".</li>
                              <li>Produkty znikają z magazynu.</li>
                              <li>Otrzymujesz nagrody.</li>
                            </ol>
                            <p className="text-[12px] text-[#bfa274] mt-2">⏰ Jeśli czas minie — klient odejdzie.</p>
                            <p className="text-[12px] text-[#bfa274] mt-1">Nowi klienci pojawiają się automatycznie po pewnym czasie.</p>
                          </div>
                        </div>
                      ) : customerLoading && customerOrders.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-3xl mb-2">⏳</p>
                          <p className="text-[#dfcfab] text-sm">Sprawdzam zamówienia...</p>
                        </div>
                      ) : customerOrders.length === 0 ? (
                        <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-6 text-center">
                          <p className="text-3xl mb-2">🪹</p>
                          <p className="text-[#dfcfab] text-sm font-bold">Brak klientów.</p>
                          <p className="text-xs text-[#8b6a3e]/80 mt-1">Nowi klienci pojawią się za kilka minut. Zajrzyj później!</p>
                        </div>
                      ) : order && customer && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <button onClick={goPrev} disabled={totalOrders <= 1} className="w-12 h-12 shrink-0 rounded-full border border-amber-600/50 bg-black/30 text-amber-400 text-2xl font-black hover:bg-amber-900/30 disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                            <div className="flex-1 min-w-0 text-center">
                              <p className="text-[10px] uppercase tracking-widest text-[#8b6a3e]">Klient {currentCustomerIdx + 1} z {totalOrders}</p>
                              <p className="text-base font-black text-[#f9e7b2] truncate">{customer.icon} {customer.name}</p>
                            </div>
                            <button onClick={goNext} disabled={totalOrders <= 1} className="w-12 h-12 shrink-0 rounded-full border border-amber-600/50 bg-black/30 text-amber-400 text-2xl font-black hover:bg-amber-900/30 disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                          </div>

                          <div className="flex items-center justify-center gap-2 text-xs">
                            <span className="text-[#8b6a3e]">⏱ Pozostało:</span>
                            <span className={`font-black ${timeLeft < 60000 ? 'text-red-400' : 'text-amber-400'}`}>
                              {isExpired ? 'Wygasło' : `${minLeft > 0 ? minLeft + 'min ' : ''}${secLeft}s`}
                            </span>
                          </div>

                          <div className="rounded-xl border border-amber-600/40 bg-black/30 p-4">
                            <p className="text-xs uppercase tracking-widest text-amber-400 mb-3 font-black">📦 Klient potrzebuje:</p>
                            <div className="space-y-2">
                              {mergedItems.map((it, idx) => {
                                const have = haveFor(it.id);
                                const ok = have >= it.qty;
                                const d = getOrderItemDisplay(it.id);
                                return (
                                  <div key={idx} className={`flex items-center justify-between rounded-lg border p-2.5 ${ok ? 'border-emerald-600/40 bg-emerald-950/20' : 'border-red-600/40 bg-red-950/10'}`}>
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-lg shrink-0">{ok ? '✅' : '❌'}</span>
                                      {d.spritePath ? (
                                        <img src={d.spritePath} alt={d.name} className="w-7 h-7 object-contain shrink-0 drop-shadow" style={{ imageRendering: 'pixelated' }} />
                                      ) : (
                                        <span className="text-xl shrink-0">{d.icon}</span>
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-sm font-black text-[#f9e7b2] truncate">{it.qty}× {d.name}</p>
                                        <p className="text-[10px] text-[#8b6a3e]">Masz: {have}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="rounded-xl border border-amber-600/40 bg-black/30 p-4">
                            <p className="text-xs uppercase tracking-widest text-amber-400 mb-3 font-black">🎁 Nagroda:</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-lg border border-yellow-500/40 bg-yellow-950/20 p-2 text-center">
                                <p className="text-base font-black text-yellow-300">{Number(order.rewards.gold).toFixed(0)} zł</p>
                              </div>
                              <div className="rounded-lg border border-blue-500/40 bg-blue-950/20 p-2 text-center">
                                <p className="text-base font-black text-blue-300">+{order.rewards.exp} EXP</p>
                              </div>
                            </div>
                            {order.rewards.bonus && order.rewards.bonus.length > 0 && (
                              <div className="mt-2 rounded-lg border border-purple-500/40 bg-purple-950/20 p-2">
                                <p className="text-[10px] uppercase tracking-widest text-purple-300 mb-1 font-black">🎁 Bonus dodatkowy:</p>
                                {order.rewards.bonus.map((b, idx) => {
                                  const lookupId = b.id ?? (b.type === 'eq_item' ? `eq_tier_${b.tier ?? 0}` : '');
                                  const d = getOrderItemDisplay(lookupId);
                                  return (
                                    <p key={idx} className="text-xs font-bold text-purple-200 flex items-center gap-1">
                                      <span>+{b.qty}×</span>
                                      {d.spritePath ? (
                                        <img src={d.spritePath} alt={d.name} className="w-4 h-4 object-contain inline-block" style={{ imageRendering: 'pixelated' }} />
                                      ) : (
                                        <span>{d.icon}</span>
                                      )}
                                      <span>{d.name}</span>
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>

                    <div className="border-t border-amber-700/30 p-4 space-y-2">
                      {order && customer && (
                        <button
                          onClick={() => { void completeCustomerOrder(order.id); }}
                          disabled={!canFulfill || customerSelling === order.id || !!isExpired}
                          className="w-full rounded-xl py-3 text-base font-black transition border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {customerSelling === order.id ? '⏳ Realizuję...' : isExpired ? '⏱ Zamówienie wygasło' : !canFulfill ? '❌ Brak wymaganych produktów' : '🤝 Zrealizuj zamówienie'}
                        </button>
                      )}
                      <button onClick={() => setShowLadaModal(false)} className="w-full rounded-xl border border-[#8b6a3e]/50 bg-black/30 py-2.5 text-sm font-bold text-[#f3e6c8] transition hover:border-[#d4a64f]/60 hover:bg-black/50">
                        ✕ Zamknij
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

          {customerLootDrop && (() => {
            const drop = customerLootDrop;
            const hovered = lootHoverIdx !== null ? drop.bonus[lootHoverIdx] : null;
            // Tooltip dla aktualnie podświetlonego przedmiotu
            const renderTooltip = (b: CustomerOrderBonus) => {
              const lookupId = b.id ?? (b.type === 'eq_item' ? `eq_tier_${b.tier ?? 0}` : '');
              const d = getOrderItemDisplay(lookupId);
              // Ekwipunek postaci
              const eq = lookupId ? CHAR_EQUIP_ITEMS.find(i => i.id === lookupId) : null;
              if (eq) {
                const slotMeta = EQUIP_SLOT_META[eq.slot];
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{eq.icon}</span>
                      <div>
                        <p className="text-base font-black text-amber-200">{eq.name}</p>
                        <p className="text-[11px] text-[#bfa274]">Ekwipunek · {slotMeta?.icon ?? '🎽'} {slotMeta?.label ?? eq.slot}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#8b6a3e]">Wymagany lvl: <span className="text-amber-300">{eq.unlockLevel}</span></p>
                    {eq.bonuses.length > 0 && (
                      <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2">
                        <p className="text-[10px] uppercase tracking-widest text-emerald-300 mb-1 font-black">Bonusy (na +0)</p>
                        <p className="text-[12px] text-emerald-100 leading-relaxed">{bonusLine(eq.bonuses, 0)}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-[#8b6a3e] italic">Można ulepszać u rzemieślnika do +10.</p>
                  </div>
                );
              }
              // Tajemniczy przedmiot ekwipunku (placeholder)
              if (lookupId.startsWith('eq_tier_')) {
                const tier = Number(lookupId.split('_').pop()) || 0;
                const minL = tier * 5 + 1, maxL = tier * 5 + 5;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎁</span>
                      <p className="text-base font-black text-amber-200">Tajemniczy przedmiot</p>
                    </div>
                    <p className="text-[12px] text-[#dfcfab]">Element ekwipunku z poziomu <span className="text-amber-300 font-bold">{minL}–{maxL}</span> — odblokuje się gdy osiągniesz odpowiedni poziom.</p>
                  </div>
                );
              }
              // Artykuł zwierzęcy
              const ai = ANIMAL_ITEMS.find(a => a.id === lookupId);
              if (ai) {
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{ai.icon}</span>
                      <div>
                        <p className="text-base font-black text-amber-200">{ai.name}</p>
                        <p className="text-[11px] text-[#bfa274]">Artykuł zwierzęcy</p>
                      </div>
                    </div>
                    <p className="text-[12px] text-[#dfcfab]">Wartość sprzedaży: <span className="text-yellow-300 font-bold">{ai.sellPrice} zł</span></p>
                    <p className="text-[10px] text-[#8b6a3e] italic">Trafia do magazynu w stodole.</p>
                  </div>
                );
              }
              // Słoik miodu
              if (lookupId === 'honey_jar') {
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🍯</span>
                      <p className="text-base font-black text-amber-200">Słoik miodu</p>
                    </div>
                    <p className="text-[12px] text-[#dfcfab]">Cenny produkt z ula. Można go sprzedać klientom za dobrą cenę.</p>
                  </div>
                );
              }
              // Kompost
              if (isCompostKey(lookupId)) {
                const t = compostTypeFromKey(lookupId);
                const v = compostValueFromKey(lookupId);
                if (t) {
                  const def = COMPOST_DEFS[t];
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{def.icon}</span>
                        <div>
                          <p className="text-base font-black text-amber-200">{def.tierName(v)} {def.name}</p>
                          <p className="text-[11px] text-[#bfa274]">Kompost</p>
                        </div>
                      </div>
                      <p className="text-[12px] text-[#dfcfab]">{def.desc}</p>
                      <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2">
                        <p className="text-[12px] text-emerald-200 font-bold">{def.effectLabel}: {def.bonusLabel(v)}</p>
                      </div>
                    </div>
                  );
                }
              }
              // Uprawa
              const cropM = lookupId.match(/^(.+)_(good|epic|legendary)$/);
              if (cropM) {
                const crop = CROPS.find(c => c.id === cropM[1]);
                if (crop) {
                  const qLabel = cropM[2] === 'good' ? 'zwykła' : cropM[2] === 'epic' ? 'epicka' : 'legendarna';
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {d.spritePath ? (
                          <img src={d.spritePath} alt={d.name} className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated' }} />
                        ) : (
                          <span className="text-2xl">🌱</span>
                        )}
                        <div>
                          <p className="text-base font-black text-amber-200">{crop.name}</p>
                          <p className="text-[11px] text-[#bfa274]">Uprawa · jakość: <span className="text-amber-300">{qLabel}</span></p>
                        </div>
                      </div>
                      <p className="text-[12px] text-[#dfcfab]">Trafia do twojego magazynu plonów.</p>
                    </div>
                  );
                }
              }
              // Owoc
              const fruitM = lookupId.match(/^(.+)_(zwykly|soczysty|zloty|zgnile)$/);
              if (fruitM) {
                const tree = TREES.find(t => t.fruitId === fruitM[1]);
                const qd = FRUIT_QUALITY_DEFS[fruitM[2] as FruitQuality];
                if (tree) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{tree.fruitIcon}</span>
                        <div>
                          <p className="text-base font-black text-amber-200">{tree.fruitName}{qd?.label ? ' ' + qd.label : ''}</p>
                          <p className="text-[11px] text-[#bfa274]">Owoc z drzewa: {tree.name}</p>
                        </div>
                      </div>
                      <p className="text-[12px] text-[#dfcfab]">Trafia do magazynu owoców w sadzie.</p>
                    </div>
                  );
                }
              }
              // Fallback
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{d.icon}</span>
                    <p className="text-base font-black text-amber-200">{d.name}</p>
                  </div>
                </div>
              );
            };

            return (
              <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-500/70 bg-[rgba(20,12,5,0.99)] p-6 shadow-2xl">
                  <button
                    onClick={() => { setCustomerLootDrop(null); setLootHoverIdx(null); }}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300"
                  >✕</button>

                  <div className="text-center mb-4">
                    <p className="text-3xl mb-1">🎁</p>
                    <p className="text-lg font-black text-amber-300">Klient zostawił Ci prezent!</p>
                    <p className="text-[12px] text-[#bfa274]">{drop.customerIcon} {drop.customerName} dorzucił dodatkowy bonus do zapłaty</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl border border-yellow-500/50 bg-yellow-950/30 p-2.5 text-center">
                      <p className="text-xl">💰</p>
                      <p className="text-[10px] uppercase text-yellow-400/80 font-black">Złoto</p>
                      <p className="text-base font-black text-yellow-300">+{drop.gold.toFixed(0)} zł</p>
                    </div>
                    <div className="rounded-xl border border-blue-500/50 bg-blue-950/30 p-2.5 text-center">
                      <p className="text-xl">⭐</p>
                      <p className="text-[10px] uppercase text-blue-400/80 font-black">EXP</p>
                      <p className="text-base font-black text-blue-300">+{drop.exp}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-purple-500/60 bg-purple-950/25 p-3 mb-4">
                    <p className="text-[11px] uppercase tracking-widest text-purple-300 mb-2 font-black text-center">🎁 Dodatkowy bonus</p>
                    <div className={`grid gap-2 ${drop.bonus.length === 1 ? 'grid-cols-1' : drop.bonus.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {drop.bonus.map((b, idx) => {
                        const lookupId = b.id ?? (b.type === 'eq_item' ? `eq_tier_${b.tier ?? 0}` : '');
                        const d = getOrderItemDisplay(lookupId);
                        const isHovered = lootHoverIdx === idx;
                        return (
                          <div
                            key={idx}
                            onMouseEnter={() => setLootHoverIdx(idx)}
                            onMouseLeave={() => setLootHoverIdx(prev => prev === idx ? null : prev)}
                            className={`relative rounded-xl border-2 p-3 text-center cursor-help transition-colors ${isHovered ? 'border-amber-300 bg-purple-900/50 shadow-lg shadow-amber-500/20' : 'border-purple-600/40 bg-purple-950/30 hover:border-purple-400/60'}`}
                          >
                            <div className="flex items-center justify-center mb-1 h-12">
                              {d.spritePath ? (
                                <img src={d.spritePath} alt={d.name} className="w-12 h-12 object-contain drop-shadow" style={{ imageRendering: 'pixelated' }} />
                              ) : (
                                <span className="text-4xl">{d.icon}</span>
                              )}
                            </div>
                            <p className="text-[11px] font-black text-purple-100 leading-tight line-clamp-2">{d.name}</p>
                            <p className="text-[10px] text-amber-300 font-bold mt-0.5">×{b.qty}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/60 bg-black/50 p-3 mb-4 text-[#dfcfab] h-[160px] overflow-y-auto">
                    {hovered ? (
                      renderTooltip(hovered)
                    ) : (
                      <p className="text-[12px] text-center text-[#8b6a3e] italic h-full flex items-center justify-center">Najedź myszką na przedmiot, aby zobaczyć szczegóły</p>
                    )}
                  </div>

                  <button
                    onClick={() => { setCustomerLootDrop(null); setLootHoverIdx(null); }}
                    className="w-full rounded-xl py-3 text-base font-black border border-amber-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110 transition"
                  >
                    🤝 Świetnie, dzięki!
                  </button>
                  <p className="text-[10px] text-center text-[#8b6a3e] mt-1.5">Esc lub Enter, aby zamknąć</p>
                </div>
              </div>
            );
          })()}

          {showStodolaModal && (() => {
            const lvl = profile?.level ?? 0;
            const opiekaPts = effectiveStats.opieka;
            const bonusChancePct = (opiekaPts * 0.15).toFixed(1);
            const hungerReducePct = (opiekaPts * 0.3).toFixed(1);
            const handleBuyAnimal = async (a: AnimalDef) => {
              if (!profile?.id) return;
              const st = barnState[a.id];
              if (!st) return;
              if (lvl < a.unlockLevel) { setMessage({type:"error",title:"Za niski poziom!",text:`${a.name} odblokujesz na LVL ${a.unlockLevel}.`}); return; }
              if (displayMoney < a.buyPrice) { setMessage({type:"error",title:"Za mało złota!",text:`Potrzebujesz ${a.buyPrice.toLocaleString()} 💰`}); return; }
              if (st.owned >= st.slots) { setMessage({type:"error",title:"Brak miejsca!",text:`Kup więcej slotów dla ${a.name}.`}); return; }
              const { data, error } = await supabase.rpc("buy_barn_animal", { p_user_id: profile.id, p_animal_id: a.id });
              if (error) { setMessage({type:"error",title:"Błąd zakupu!",text:error.message}); return; }
              const response = data as { ok?: boolean; error?: string } | null;
              if (response?.ok === false) { setMessage({type:"error",title:"Błąd zakupu!",text:response.error ?? "Operacja nie powiodła się."}); return; }
              await loadProfile(profile.id);
              setMessage({type:"success",title:`${a.icon} Kupiono!`,text:`${a.name} dołączyła do zagrody.`});
            };
            const handleBuySlot = async (a: AnimalDef) => {
              if (!profile?.id) return;
              const st = barnState[a.id];
              const upg = st.slots - a.startSlots;
              if (upg >= a.slotUpgCosts.length) { setMessage({type:"info",title:"Maks!",text:`Maksymalna liczba slotów dla ${a.name}.`}); return; }
              const cost = a.slotUpgCosts[upg];
              if (displayMoney < cost) { setMessage({type:"error",title:"Za mało złota!",text:`Potrzebujesz ${cost.toLocaleString()} 💰`}); return; }
              const { data, error } = await supabase.rpc("buy_barn_slot", { p_user_id: profile.id, p_animal_id: a.id });
              if (error) { setMessage({type:"error",title:"Błąd!",text:error.message}); return; }
              const response = data as { ok?: boolean; error?: string; animal_state?: { slots?: number } } | null;
              if (response?.ok === false) { setMessage({type:"error",title:"Błąd!",text:response.error ?? "Operacja nie powiodła się."}); return; }
              const newSlots = response?.animal_state?.slots ?? (st.slots + 1);
              await loadProfile(profile.id);
              setMessage({type:"success",title:"Slot kupiony!",text:`${a.name}: ${newSlots} / ${a.maxSlots}`});
            };
            const handleFeed = async (a: AnimalDef, cropKey: string, points: number, cropName: string, cropIcon: string) => {
              const have = seedInventory[cropKey] ?? 0;
              if (have < 1) { setMessage({type:"error",title:"Brak karmy!",text:`Potrzebujesz ${cropName} (${cropIcon}).`}); return; }
              if (!profile?.id) return;
              const st = barnState[a.id];
              const curH = barnCurrentHunger(st, opiekaPts);
              const newH = Math.min(100, curH + points);
              const { data, error } = await supabase.rpc("feed_barn_animal", { p_user_id: profile.id, p_animal_id: a.id, p_crop_key: cropKey });
              if (error) { setMessage({type:"error",title:"Błąd karmienia!",text:error.message}); return; }
              const response = data as { ok?: boolean; error?: string } | null;
              if (response?.ok === false) { setMessage({type:"error",title:"Błąd karmienia!",text:response.error ?? "Karmienie nie powiodło się."}); return; }
              await loadProfile(profile.id);
              setMessage({type:"success",title:`${a.icon} Nakarmiono!`,text:`+${points} sytości → ${Math.round(newH)}%`});
            };
            const handleCollect = (a: AnimalDef) => {
              if (!profile?.id) return;
              void (async () => {
                const item = ANIMAL_ITEMS.find(i => i.id === a.itemId)!;
                let rpc = await supabase.rpc("collect_animal", { p_user_id: profile.id, p_animal_id: a.id });
                if (rpc.error?.message?.includes("sync_barn_owned")) {
                  const st = barnState[a.id];
                  if (!st || st.owned === 0) { setMessage({type:"error",title:"Błąd!",text:"Brak zwierząt do synchronizacji."}); return; }
                  await supabase.rpc("sync_barn_owned", { p_user_id: profile.id, p_animal_id: a.id, p_new_owned: st.owned, p_new_slots: st.slots });
                  rpc = await supabase.rpc("collect_animal", { p_user_id: profile.id, p_animal_id: a.id });
                }
                if (rpc.error) { setMessage({type:"error",title:"Błąd odbioru!",text:rpc.error.message}); return; }
                const res = rpc.data as { ok: boolean; collected: number; item_id: string; new_prod_start: number; new_barn_items: Record<string,number> };
                if (res.collected === 0) { setMessage({type:"info",title:`${a.icon} Brak produktów`,text:`${a.name} jeszcze pracuje — wróć później.`}); return; }
                saveBarnItems(res.new_barn_items);
                saveBarnState({...barnState, [a.id]: {...barnState[a.id], storage: 0, prodStart: res.new_prod_start, baseProdStart: res.new_prod_start}});
                setMessage({type:"success",title:`${item.icon} Odebrano!`,text:`+${res.collected} ${item.name}`});
              })();
            };
            const handleCollectAll = () => {
              if (!profile?.id) return;
              void (async () => {
                let rpc = await supabase.rpc("collect_all_animals", { p_user_id: profile.id });
                if (rpc.error?.message?.includes("sync_barn_owned")) {
                  for (const a of ANIMALS) {
                    const st = barnState[a.id];
                    if (st && st.owned > 0) await supabase.rpc("sync_barn_owned", { p_user_id: profile.id, p_animal_id: a.id, p_new_owned: st.owned, p_new_slots: st.slots });
                  }
                  rpc = await supabase.rpc("collect_all_animals", { p_user_id: profile.id });
                }
                if (rpc.error) { setMessage({type:"error",title:"Błąd odbioru!",text:rpc.error.message}); return; }
                const res = rpc.data as { ok: boolean; results: Array<{animal_id:string;item_id:string;collected:number;new_prod_start:number}>; total: number; new_barn_items: Record<string,number> };
                if (res.total === 0) { setMessage({type:"info",title:"Nic do odbioru",text:"Żadne zwierzę nie jest jeszcze gotowe."}); return; }
                saveBarnItems(res.new_barn_items);
                const newState = {...barnState};
                res.results.forEach(r => { if (newState[r.animal_id]) newState[r.animal_id] = {...newState[r.animal_id], storage: 0, prodStart: r.new_prod_start, baseProdStart: r.new_prod_start}; });
                saveBarnState(newState);
                setMessage({type:"success",title:"Odebrano wszystko!",text:`+${res.total} produktów. Sprzedaj je w Ladzie dla klientów.`});
              })();
            };
            const selA = selectedAnimal ? ANIMALS.find(a => a.id === selectedAnimal) : null;
            const totalStorage = ANIMALS.reduce((s,a) => { const st = barnState[a.id]; if (!st) return s; const _bps = st.baseProdStart > 0 ? st.baseProdStart : st.prodStart > 0 ? st.prodStart : 0; return s + (_bps > 0 ? Math.min(Math.floor((barnNow - _bps) / a.prodMs), a.storageMax) * st.owned : 0); }, 0);
            return (
              <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                <div className="relative flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-[1450px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl">
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
                      const _bpsS = st.baseProdStart > 0 ? st.baseProdStart : st.prodStart > 0 ? st.prodStart : 0;
                      const hasProd = _bpsS > 0 && Math.floor((barnNow - _bpsS) / a.prodMs) >= 1;
                      return (
                        <button key={a.id} onClick={() => !locked && setSelectedAnimal(a.id)}
                          disabled={locked}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-bold transition text-left ${locked ? "opacity-40 cursor-not-allowed text-[#6b7280]" : selectedAnimal===a.id ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"}`}>
                          <AnimalImg id={a.id} icon={a.icon} className="h-6 w-6 text-xl" />
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
                                  <AnimalImg id={a.id} icon={a.icon} className="h-10 w-10 text-3xl" />
                                  <div className="flex-1">
                                    <p className="text-base font-black text-[#f9e7b2]">{a.name}</p>
                                    <p className="text-[12px] text-[#8b6a3e]">{st.owned} / {st.slots} · {item.icon} {item.name}</p>
                                  </div>
                                  {(() => { const _bpsOv = st.baseProdStart > 0 ? st.baseProdStart : st.prodStart > 0 ? st.prodStart : 0; const cyclesOv = _bpsOv > 0 ? Math.min(Math.floor((barnNow - _bpsOv) / a.prodMs), a.storageMax) : 0; const itemsOv = cyclesOv * st.owned; return itemsOv > 0 ? <span className="rounded-full bg-green-500/20 border border-green-500/40 px-2 py-0.5 text-[11px] font-black text-green-300">{itemsOv}/{st.owned} {item.icon}</span> : null; })()}
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
                      // Server-aligned: use baseProdStart + BASE prodMs (matches collect_animal RPC)
                      const _bps = (st.baseProdStart > 0 ? st.baseProdStart : st.prodStart > 0 ? st.prodStart : 0);
                      const serverCycles = _bps > 0 ? Math.min(Math.floor((barnNow - _bps) / a.prodMs), a.storageMax) : 0;
                      const storageFull = serverCycles >= a.storageMax;
                      const itemsReady = serverCycles * st.owned;
                      const itemsMax = a.storageMax * st.owned;
                      const _cycleStart = _bps > 0 ? _bps + serverCycles * a.prodMs : 0;
                      const remaining = _cycleStart > 0 && !storageFull ? Math.max(0, _cycleStart + a.prodMs - barnNow) : 0;
                      const pct = _cycleStart > 0 ? Math.min(100, ((barnNow - _cycleStart) / a.prodMs) * 100) : 0;
                      void effMs;
                      const nextUpg = st.slots - a.startSlots;
                      const upgCost = nextUpg < a.slotUpgCosts.length ? a.slotUpgCosts[nextUpg] : null;
                      return (
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <button onClick={() => setSelectedAnimal(null)} className="text-[#8b6a3e] hover:text-[#f9e7b2] text-sm transition">← Powrót</button>
                            <AnimalImg id={a.id} icon={a.icon} className="h-10 w-10 text-3xl" />
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
                                    <p className="text-[10px] text-[#8b6a3e]">Magazyn: <span className={itemsReady > 0 ? "text-green-300 font-bold" : ""}>{itemsReady} / {itemsMax} {plItem(itemsMax, item)}</span></p>
                                    <p className="text-[9px] text-[#6b7280]">Produkcja: {st.owned > 0 ? `${st.owned} ${plItem(st.owned, item)}` : `1 ${item.n1} / szt.`} co {a.prodMs/3600000}h</p>
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
                                {itemsReady > 0 && (
                                  <button onClick={() => handleCollect(a)} className="mt-2 w-full rounded-xl border border-green-500/60 bg-green-900/20 py-1.5 text-sm font-bold text-green-300 hover:bg-green-900/40">
                                    ✅ Odbierz {itemsReady} {item.icon}
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
                                  <div className="flex justify-between"><span>Pojemność magazynu</span><span className="font-bold">{Math.max(1,st.owned) * a.storageMax} {plItem(Math.max(1,st.owned) * a.storageMax, item)}</span></div>
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
              if (!profile?.id) return;
              void (async () => {
                setOrchardError("");
                let rpc = await supabase.rpc("harvest_tree", { p_user_id: profile.id, p_tree_id: t.id });
                if (rpc.error?.message?.includes("sync_orchard_owned")) {
                  const cur = orchardState[t.id];
                  if (!cur || cur.owned === 0) { setOrchardError("Brak drzew do zebrania."); return; }
                  await supabase.rpc("sync_orchard_owned", { p_user_id: profile.id, p_tree_id: t.id, p_new_owned: cur.owned });
                  rpc = await supabase.rpc("harvest_tree", { p_user_id: profile.id, p_tree_id: t.id });
                }
                if (rpc.error) { setOrchardError("Błąd zbioru: " + rpc.error.message); return; }
                const res = rpc.data as { ok: boolean; added: Record<string,number>; new_prod_start: number; new_fruit_inventory: Record<string,number> };
                const total = Object.values(res.added ?? {}).reduce<number>((s,v) => s + (Number(v)||0), 0);
                if (total === 0) { setOrchardError(`${t.icon} Drzewo jeszcze rośnie — wróć za chwilę.`); return; }
                saveFruitInventory(res.new_fruit_inventory as Record<string,number>);
                saveOrchardState({ ...orchardState, [t.id]: { ...orchardState[t.id], storage:{ zwykly:0, soczysty:0, zloty:0, zgnile:0 }, prodStart: res.new_prod_start } });
                const a = res.added; const parts: string[] = [];
                if ((a[`${t.fruitId}_zwykly`]   ?? 0) > 0) parts.push(`${a[`${t.fruitId}_zwykly`]} zwykłych`);
                if ((a[`${t.fruitId}_soczysty`] ?? 0) > 0) parts.push(`💧${a[`${t.fruitId}_soczysty`]} soczystych`);
                if ((a[`${t.fruitId}_zloty`]    ?? 0) > 0) parts.push(`✨${a[`${t.fruitId}_zloty`]} złotych`);
                if ((a[`${t.fruitId}_zgnile`]   ?? 0) > 0) parts.push(`🍂${a[`${t.fruitId}_zgnile`]} zgniłych`);
                setMessage({ type:"success", title:`${t.fruitIcon} Zebrano ${total} ${t.fruitName.toLowerCase()}!`, text: parts.join(" · ") });
              })();
            };
            const handleHarvestAll = () => {
              if (!profile?.id) return;
              void (async () => {
                setOrchardError("");
                let rpc = await supabase.rpc("harvest_all_trees", { p_user_id: profile.id });
                if (rpc.error?.message?.includes("sync_orchard_owned")) {
                  for (const t of TREES) {
                    const st = orchardState[t.id];
                    if (st && st.owned > 0) await supabase.rpc("sync_orchard_owned", { p_user_id: profile.id, p_tree_id: t.id, p_new_owned: st.owned });
                  }
                  rpc = await supabase.rpc("harvest_all_trees", { p_user_id: profile.id });
                }
                if (rpc.error) { setOrchardError("Błąd zbioru: " + rpc.error.message); return; }
                const res = rpc.data as { ok: boolean; results: Array<{tree_id:string;added:Record<string,number>;new_prod_start:number}>; added_all: Record<string,number>; new_fruit_inventory: Record<string,number> };
                const totalAll = Object.values(res.added_all ?? {}).reduce<number>((s,v) => s + (Number(v)||0), 0);
                if (totalAll === 0) { setOrchardError("Brak owoców — drzewa jeszcze rosną."); return; }
                saveFruitInventory(res.new_fruit_inventory as Record<string,number>);
                const newOrch = { ...orchardState };
                res.results.forEach(r => { if (newOrch[r.tree_id]) newOrch[r.tree_id] = { ...newOrch[r.tree_id], storage:{ zwykly:0, soczysty:0, zloty:0, zgnile:0 }, prodStart: r.new_prod_start }; });
                saveOrchardState(newOrch);
                const partsAll: string[] = [];
                TREES.forEach(t => { const n = Object.entries(res.added_all ?? {}).filter(([k]) => k.startsWith(t.fruitId+"_")).reduce((s,[,v]) => s+(Number(v)||0), 0); if (n > 0) partsAll.push(`${t.fruitIcon}×${n}`); });
                setMessage({ type:"success", title:`🌳 Zebrano ${totalAll} owoców!`, text: partsAll.join(" · ") });
              })();
            };
            const calcInvValue = () => {
              let v = 0;
              TREES.forEach(t => {
                (["zwykly","soczysty","zloty"] as FruitQuality[]).forEach(q => {
                  const k = `${t.fruitId}_${q}`;
                  const cnt = fruitInventory[k] ?? 0;
                  if (cnt > 0) v += cnt * t.pricePerFruit * FRUIT_QUALITY_DEFS[q].mult;
                });
                // zgniłe: mult=0, nie wliczamy do wartości
              });
              return v;
            };
            const handleSellAll = () => {
              if (!profile?.id) return;
              setOrchardError("");
              void (async () => {
                const { data, error } = await supabase.rpc("sell_fruits", { p_user_id: profile.id });
                if (error) { setOrchardError("Błąd sprzedaży: " + error.message); return; }
                const res = data as { ok: boolean; reason?: string; sold_value: number; new_money: number; new_fruit_inventory: Record<string,number> };
                if (!res.ok) { setOrchardError(res.reason ?? "Brak owoców do sprzedaży (zgniłe owoce nie mają wartości)."); return; }
                saveFruitInventory(res.new_fruit_inventory as Record<string,number>);
                await loadProfile(profile.id);
                setMessage({ type:"success", title:`💰 Sprzedano owoce za ${res.sold_value.toLocaleString()} 💰`, text:"Zgniłe owoce pozostały w plecaku — wrzuć je do kompostu." });
              })();
            };
            const invValue = calcInvValue();
            const invTotal = Object.values(fruitInventory).reduce<number>((s,v) => s + (Number(v) || 0), 0);
            return (
              <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowSadModal(false)}>
                <div className="relative flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-[1100px] flex-col overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(28,16,6,0.98)] shadow-2xl" onClick={e => e.stopPropagation()}>
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
                          const totalStored = st.storage.zwykly + st.storage.soczysty + st.storage.zloty + (st.storage.zgnile ?? 0);
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
                                      {st.storage.zwykly > 0          && <span className="rounded bg-emerald-900/40 border border-emerald-500/40 px-2 py-0.5 font-bold text-emerald-300">{st.storage.zwykly} zwykły</span>}
                                      {st.storage.soczysty > 0         && <span className="rounded bg-cyan-900/40 border border-cyan-500/40 px-2 py-0.5 font-bold text-cyan-300">💧 {st.storage.soczysty} soczysty</span>}
                                      {st.storage.zloty > 0            && <span className="rounded bg-yellow-900/40 border border-yellow-500/40 px-2 py-0.5 font-bold text-yellow-300">✨ {st.storage.zloty} złoty</span>}
                                      {(st.storage.zgnile ?? 0) > 0   && <span className="rounded bg-gray-900/40 border border-gray-600/40 px-2 py-0.5 font-bold text-gray-400">🍂 {st.storage.zgnile} zgniłe</span>}
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
                <h2 className="mb-3 text-center text-lg font-black text-[#f9e7b2]">Wybierz swoją postać</h2>
                {/* Koszt/cooldown zmiany avatara */}
                {(() => {
                  const tier = getAvatarChangeTier(avatarChangeCount);
                  const now = Date.now();
                  const cooldownLeft = tier.cooldownMs > 0 && lastAvatarChangeAt > 0 ? Math.max(0, tier.cooldownMs - (now - lastAvatarChangeAt)) : 0;
                  const cMins = Math.ceil(cooldownLeft / 60000);
                  const cHrs = Math.floor(cMins / 60);
                  const cMinRem = cMins % 60;
                  const timeStr = cHrs > 0 ? `${cHrs}h ${cMinRem}min` : `${cMins}min`;
                  const isFree = tier.cost === 0;
                  const freeLeft = Math.max(0, 2 - avatarChangeCount);
                  return (
                    <div className={`mb-4 mx-auto max-w-md rounded-xl border px-4 py-2 text-center text-xs font-medium ${
                      cooldownLeft > 0 ? "border-red-500/40 bg-red-950/20 text-red-300"
                      : isFree ? "border-green-500/40 bg-green-950/15 text-green-300"
                      : "border-yellow-500/40 bg-yellow-950/15 text-yellow-300"
                    }`}>
                      {cooldownLeft > 0
                        ? `Cooldown — kolejna zmiana za ${timeStr}`
                        : isFree
                          ? `Zmiana avatara bezplatna${freeLeft > 0 ? ` (${freeLeft} gratis pozostalo)` : ""}`
                          : `Zmiana avatara: ${tier.cost.toLocaleString("pl-PL")} zl — posiadasz: ${displayMoney.toLocaleString("pl-PL")} zl`
                      }
                    </div>
                  );
                })()}
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
                      {SKINS_MALE.map((src, i) => {
                        const _b = getAvatarBonus(i);
                        const _e = (Object.entries(_b) as [string,number][]).filter(([,v])=>v>0);
                        const _sl: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zrecznosc",zaradnosc:"Zaradnosc",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczescie" };
                        const _meta = AVATAR_META[i];
                        return (
                          <button key={i} onClick={() => handleAvatarSelect(i)}
                            onMouseEnter={() => setHoveredNormalSkin(i)}
                            onMouseLeave={() => setHoveredNormalSkin(null)}
                            className={`relative flex h-56 w-full items-center justify-center rounded-2xl border-2 overflow-hidden transition ${avatarSkin === i ? "border-yellow-400 shadow-[0_0_16px_rgba(255,200,0,0.4)]" : "border-[#8b6a3e]/50 hover:border-[#8b6a3e]"}`}>
                            <img src={src} alt={`Postac ${i+1}`} className="absolute inset-0 w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Kobiety */}
                {(skinTab === "kobiety" || skinTab === "wszystkie") && (
                  <>
                    {skinTab === "wszystkie" && <p className="mb-3 text-center text-[10px] text-[#8b6a3e] font-bold uppercase tracking-widest">👩 Kobiety</p>}
                    <div className="grid grid-cols-5 gap-2">
                      {SKINS_FEMALE.map((src, i) => {
                        const _idx = i + 10;
                        const _b = getAvatarBonus(_idx);
                        const _e = (Object.entries(_b) as [string,number][]).filter(([,v])=>v>0);
                        const _sl: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zrecznosc",zaradnosc:"Zaradnosc",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczescie" };
                        const _meta = AVATAR_META[_idx];
                        return (
                          <button key={_idx} onClick={() => handleAvatarSelect(_idx)}
                            onMouseEnter={() => setHoveredNormalSkin(_idx)}
                            onMouseLeave={() => setHoveredNormalSkin(null)}
                            className={`relative flex h-56 w-full items-center justify-center rounded-2xl border-2 overflow-hidden transition ${avatarSkin === _idx ? "border-pink-400 shadow-[0_0_16px_rgba(255,100,200,0.4)]" : "border-[#8b6a3e]/50 hover:border-[#8b6a3e]"}`}>
                            <img src={src} alt={`Postac ${i+11}`} className="absolute inset-0 w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Epickie */}
                {(skinTab === "epickie" || skinTab === "wszystkie") && (
                  <>
                    {skinTab === "wszystkie" && <p className="mt-4 mb-3 text-center text-[10px] text-[#8b6a3e] font-bold uppercase tracking-widest">⭐ Epickie</p>}
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
                                void handleAvatarSelect(idx);
                              } else {
                                setEpicPurchaseTarget(idx);
                              }
                            }}
                            onMouseEnter={() => setHoveredEpicSkin(idx)}
                            onMouseLeave={() => setHoveredEpicSkin(null)}
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

          {/* ═══ TOOLTIP EPICKIEGO SKINA ═══ */}
          {hoveredEpicSkin !== null && showSkinModal && (() => {
            const es = EPIC_SKINS[hoveredEpicSkin - EPIC_SKIN_START];
            if (!es) return null;
            const isUnlocked = unlockedEpicAvatars.includes(hoveredEpicSkin);
            const canAfford = Object.entries(es.cost).every(([k,v]) => (seedInventory[k] ?? 0) >= v);
            return (
              <div className="pointer-events-none fixed z-[9999] w-80 rounded-[20px] border border-green-500/70 bg-[rgba(8,25,8,0.98)] p-5 shadow-2xl backdrop-blur-sm"
                style={{ left: mousePos.x + 20, top: Math.max(8, mousePos.y - 200) }}>
                {/* Podgląd skina */}
                <div className="mb-3 flex justify-center">
                  <div className="relative h-32 w-32 overflow-hidden rounded-2xl border-2 border-green-500/60 shadow-[0_0_16px_rgba(34,197,94,0.3)]">
                    <img src={es.path} alt={es.name} className="h-full w-full object-cover" style={{ imageRendering: "pixelated", filter: isUnlocked ? "none" : "grayscale(80%) brightness(0.5)" }} />
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl">🔒</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Nazwa */}
                <p className="mb-1 text-center text-[20px] font-black text-green-300">⭐ {es.name}</p>
                {/* Status */}
                {isUnlocked
                  ? <p className="mb-2 text-center text-[14px] font-bold text-green-400">✓ Odblokowany — kliknij, aby wybrać</p>
                  : <p className="mb-2 text-center text-[14px] text-[#8b6a3e]">Zablokowany — kliknij, aby odblokować</p>
                }
                {/* Bonusy statystyk */}
                {(() => {
                  const _b = getAvatarBonus(hoveredEpicSkin!);
                  const _e = (Object.entries(_b) as [string,number][]).filter(([,v])=>v>0);
                  const _sl: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zrecznosc",zaradnosc:"Zaradnosc",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczescie" };
                  if (!_e.length) return null;
                  return (
                    <div className="mb-2 rounded-xl border border-green-700/40 bg-green-950/20 px-3 py-2">
                      <p className="mb-1.5 text-[12px] font-black uppercase tracking-widest text-green-500">Bonusy statystyk:</p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {_e.map(([k,v]) => <span key={k} className="rounded bg-green-900/40 border border-green-600/30 px-2 py-0.5 text-[13px] font-bold text-green-200">+{v} {_sl[k]??k}</span>)}
                      </div>
                    </div>
                  );
                })()}
                {/* Koszty */}
                {!isUnlocked && (
                  <div className="rounded-xl border border-green-800/40 bg-black/30 p-3">
                    <p className="mb-1.5 text-[13px] font-black uppercase tracking-widest text-green-500">Koszt odblokowania:</p>
                    {Object.entries(es.cost).map(([k, v]) => {
                      const { baseCropId, quality } = parseQualityKey(k);
                      const crop = CROPS.find(c => c.id === baseCropId);
                      const qLabel = quality === "epic" ? "epickich" : quality === "legendary" ? "legendarnych" : "zwykłych";
                      const have = seedInventory[k] ?? 0;
                      const enough = have >= v;
                      return (
                        <div key={k} className={`flex items-center justify-between text-[12px] font-bold ${enough ? "text-green-300" : "text-red-300"}`}>
                          <span>{v}× {crop?.name ?? k} {qLabel}</span>
                          <span className="ml-2 text-[11px] opacity-70">({have}/{v})</span>
                        </div>
                      );
                    })}
                    {canAfford && <p className="mt-1.5 text-center text-[11px] font-black text-green-400">Masz wystarczająco!</p>}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ TOOLTIP NORMALNEGO SKINA (M/K) ═══ */}
          {hoveredNormalSkin !== null && showSkinModal && (() => {
            const _b = getAvatarBonus(hoveredNormalSkin);
            const _e = (Object.entries(_b) as [string,number][]).filter(([,v])=>v>0);
            if (!_e.length) return null;
            const _meta = AVATAR_META[hoveredNormalSkin];
            const isFemale = hoveredNormalSkin >= 10 && hoveredNormalSkin < EPIC_SKIN_START;
            const _sl: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zrecznosc",zaradnosc:"Zaradnosc",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczescie" };
            const borderColor = isFemale ? "border-pink-500/70" : "border-amber-500/70";
            const nameColor = isFemale ? "text-pink-300" : "text-amber-300";
            const badgeBg = isFemale ? "bg-pink-900/40 border-pink-600/30 text-pink-200" : "bg-amber-900/40 border-amber-600/30 text-amber-200";
            return (
              <div className={`pointer-events-none fixed z-[9999] w-64 rounded-[18px] border ${borderColor} bg-[rgba(18,10,2,0.98)] px-4 py-3 text-center shadow-2xl backdrop-blur-sm`}
                style={{ left: Math.min(mousePos.x + 16, BASE_W - 272), top: Math.max(8, mousePos.y - 120) }}>
                {_meta && <p className={`text-[18px] font-black ${nameColor} mb-2`}>{_meta.name}</p>}
                <div className="flex flex-wrap justify-center gap-1.5">
                  {_e.map(([k,v]) => <span key={k} className={`rounded border px-2 py-0.5 text-[15px] font-bold ${badgeBg}`}>+{v} {_sl[k]??k}</span>)}
                </div>
              </div>
            );
          })()}

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
            <div
              className="fixed inset-0 z-[80]"
              style={fvToolEditMode ? { userSelect: "none" } : undefined}
            >
                <div
                  ref={fieldViewScrollRef}
                  className="relative w-full h-full bg-[rgba(20,12,6,0.96)] p-5 overflow-auto select-none"
                  style={{ cursor: fieldScrollDragRef.current?.active && fieldScrollDragRef.current?.moved ? "grabbing" : undefined, userSelect: fieldScrollDragRef.current?.moved ? "none" : undefined }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    const tgt = e.target as HTMLElement;
                    if (tgt.closest('button, [role="button"], a, input, select, textarea')) return;
                    const el = fieldViewScrollRef.current;
                    if (!el) return;
                    fieldScrollDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, moved: false };
                  }}
                  onMouseMove={(e) => {
                    const drag = fieldScrollDragRef.current;
                    if (!drag?.active) return;
                    const el = fieldViewScrollRef.current;
                    if (!el) return;
                    const dx = e.clientX - drag.startX;
                    const dy = e.clientY - drag.startY;
                    if (!drag.moved && Math.sqrt(dx * dx + dy * dy) < 5) return;
                    drag.moved = true;
                    el.scrollLeft = drag.scrollLeft - dx;
                    el.scrollTop = drag.scrollTop - dy;
                  }}
                  onMouseUp={() => { if (fieldScrollDragRef.current) fieldScrollDragRef.current.active = false; }}
                  onMouseLeave={() => { if (fieldScrollDragRef.current) fieldScrollDragRef.current.active = false; }}
                  onClickCapture={(e) => { if (fieldScrollDragRef.current?.moved) { e.stopPropagation(); e.preventDefault(); fieldScrollDragRef.current.moved = false; } }}
                >
                  <button
                    onClick={() => {
                      setIsFieldViewOpen(false);
                      setSelectedPlotId(null);
                      setIsFieldViewCollapsed(false);
                    }}
                    className="absolute right-4 top-4 z-[100] flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-400/70 bg-red-950/70 text-3xl font-black text-red-100 shadow-2xl transition hover:bg-red-800/90 hover:scale-110 active:scale-95"
                    aria-label="Zamknij widok pola"
                  >
                    ✕
                  </button>

                  {/* ─── Przycisk edycji hitboxów narzędzi ─── */}
                  <button
                    type="button"
                    onClick={() => setFvToolEditMode(m => !m)}
                    className={`absolute right-20 top-4 z-[91] flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-xl backdrop-blur-sm transition ${fvToolEditMode ? "border-orange-400 bg-orange-900/80 text-orange-300" : "border-[#8b6a3e]/70 bg-[rgba(22,13,8,0.85)] text-[#dfcfab]"}`}
                  >
                    🎯 {fvToolEditMode ? "Zakończ edycję" : "Edytuj narzędzia"}
                  </button>

                  {/* ─── Panel współrzędnych (widoczny tylko w trybie edycji) ─── */}
                  {fvToolEditMode && (
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] w-[340px] rounded-2xl border border-orange-400/60 bg-[rgba(20,8,2,0.97)] p-5 shadow-2xl backdrop-blur-sm pointer-events-none">
                      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">📐 Współrzędne narzędzi</p>
                      <div className="flex flex-col gap-2">
                        <div className="rounded-xl border border-cyan-400/30 bg-cyan-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cyan-300">🚿 Konewka</p>
                          <p className="font-mono text-xs text-cyan-100">l:<span className="font-black text-white">{fvKonewkaPos.l}</span> t:<span className="font-black text-white">{fvKonewkaPos.t}</span> w:<span className="font-black text-white">{fvKonewkaPos.w}</span> h:<span className="font-black text-white">{fvKonewkaPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-yellow-400/30 bg-yellow-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-yellow-300">⚔️ Sierp</p>
                          <p className="font-mono text-xs text-yellow-100">l:<span className="font-black text-white">{fvZbierzPos.l}</span> t:<span className="font-black text-white">{fvZbierzPos.t}</span> w:<span className="font-black text-white">{fvZbierzPos.w}</span> h:<span className="font-black text-white">{fvZbierzPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-green-400/30 bg-green-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-green-300">🌱 Nasiona</p>
                          <p className="font-mono text-xs text-green-100">l:<span className="font-black text-white">{fvNasonaPos.l}</span> t:<span className="font-black text-white">{fvNasonaPos.t}</span> w:<span className="font-black text-white">{fvNasonaPos.w}</span> h:<span className="font-black text-white">{fvNasonaPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-lime-400/30 bg-lime-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-lime-300">♻️ Kompost</p>
                          <p className="font-mono text-xs text-lime-100">l:<span className="font-black text-white">{fvKompostPos.l}</span> t:<span className="font-black text-white">{fvKompostPos.t}</span> w:<span className="font-black text-white">{fvKompostPos.w}</span> h:<span className="font-black text-white">{fvKompostPos.h}</span></p>
                        </div>
                      </div>
                      <p className="mt-3 text-[9px] text-[#6b7280] text-center">Przeciągnij przycisk aby przesunąć · róg aby zmienić rozmiar</p>
                    </div>
                  )}

                  {/* Konewka */}
                  <button
                    type="button"
                    onClick={() => { if (!fvToolEditMode) { setSelectedTool(prev => prev === "watering_can" ? null : "watering_can"); setSelectedSeedId(null); } }}
                    onMouseEnter={() => { if (!fvToolEditMode) setHoveredWateringCan(true); }}
                    onMouseLeave={() => setHoveredWateringCan(false)}
                    onMouseDown={fvToolEditMode ? (e) => {
                      e.preventDefault();
                      const pos = fvKonewkaPos;
                      fvToolDragRef.current = { btn: "konewka", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h };
                    } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : selectedTool === "watering_can" ? "border-cyan-300 bg-cyan-900/70 shadow-[0_0_20px_rgba(80,200,255,0.5)]" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}`}
                    style={{ left: fvKonewkaPos.l, top: fvKonewkaPos.t, width: fvKonewkaPos.w, height: fvKonewkaPos.h }}
                  >
                    <img src="/ui/watering_can_transparent.png" alt="Konewka" className="h-[50%] w-[50%] object-contain pointer-events-none" style={{ imageRendering: "pixelated" }} />
                    <p className="text-[10px] font-black text-[#f9e7b2] pointer-events-none leading-none mt-0.5">Konewka</p>
                    {fvToolEditMode && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); const pos = fvKonewkaPos; fvToolDragRef.current = { btn: "konewka", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h }; }}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-orange-400/80 rounded-tl"
                      />
                    )}
                  </button>

                  {/* Zbierz */}
                  <button
                    type="button"
                    onClick={() => { if (!fvToolEditMode) { setSelectedTool(prev => prev === "sickle" ? null : "sickle"); setSelectedSeedId(null); setHoveredSickle(false); } }}
                    onMouseEnter={() => { if (!fvToolEditMode) setHoveredSickle(true); }}
                    onMouseLeave={() => setHoveredSickle(false)}
                    data-zone="sickle"
                    onMouseDown={fvToolEditMode ? (e) => {
                      e.preventDefault();
                      const pos = fvZbierzPos;
                      fvToolDragRef.current = { btn: "zbierz", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h };
                    } : (e) => setHoveredSickle(false)}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : selectedTool === "sickle" ? "border-yellow-300 bg-yellow-900/70 shadow-[0_0_20px_rgba(255,220,120,0.5)]" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}`}
                    style={{ left: fvZbierzPos.l, top: fvZbierzPos.t, width: fvZbierzPos.w, height: fvZbierzPos.h }}
                  >
                    <img src="/ui/sierp.png" alt="Zbierz" className="h-[50%] w-[50%] object-contain pointer-events-none" style={{ imageRendering: "pixelated" }} />
                    <p className="text-[10px] font-black text-[#f9e7b2] pointer-events-none leading-none mt-0.5">Zbierz</p>
                    {fvToolEditMode && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); const pos = fvZbierzPos; fvToolDragRef.current = { btn: "zbierz", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h }; }}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-orange-400/80 rounded-tl"
                      />
                    )}
                  </button>

                  {/* ─── Przycisk Nasiona ─── */}
                  <button
                    type="button"
                    onClick={() => {
                      if (fvToolEditMode) return;
                      setFvSeedPickerOpen(prev => !prev);
                      setFvCompostPickerOpen(false);
                    }}
                    onMouseDown={fvToolEditMode ? (e) => {
                      e.preventDefault();
                      const pos = fvNasonaPos;
                      fvToolDragRef.current = { btn: "nasiona", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h };
                    } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : (selectedSeedId && !isCompostKey(selectedSeedId)) ? "border-green-300 bg-green-900/70 shadow-[0_0_20px_rgba(100,220,100,0.5)]" : fvSeedPickerOpen ? "border-green-500 bg-green-950/80" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}`}
                    style={{ left: fvNasonaPos.l, top: fvNasonaPos.t, width: fvNasonaPos.w, height: fvNasonaPos.h }}
                  >
                    {(() => {
                      if (!fvToolEditMode && selectedSeedId && !isCompostKey(selectedSeedId)) {
                        const { baseCropId, quality } = parseQualityKey(selectedSeedId);
                        const crop = CROPS.find(c => c.id === baseCropId);
                        if (crop) {
                          const sprite = quality === "legendary" ? (crop.legendarySpritePath ?? crop.spritePath) : quality === "epic" ? (crop.epicSpritePath ?? crop.spritePath) : quality === "rotten" ? (crop.rottenSpritePath ?? crop.spritePath) : crop.spritePath;
                          const cnt = seedInventory[selectedSeedId] ?? 0;
                          return (
                            <>
                              <img src={sprite} alt={crop.name} className="absolute inset-0 h-full w-full object-contain pointer-events-none rounded-[10px]" style={{ imageRendering: "pixelated" }} />
                              {quality === "legendary" && (
                                <div className="absolute inset-0 rounded-[10px] pointer-events-none animate-pulse" style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.7) 0%, rgba(245,158,11,0.1) 40%, rgba(251,191,36,0.7) 100%)", boxShadow: "inset 0 0 20px rgba(251,191,36,1), 0 0 18px rgba(251,191,36,0.9)" }} />
                              )}
                              {quality === "epic" && (
                                <div className="absolute inset-0 rounded-[10px] pointer-events-none animate-pulse" style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.65) 0%, rgba(139,92,246,0.1) 40%, rgba(167,139,250,0.65) 100%)", boxShadow: "inset 0 0 18px rgba(167,139,250,0.9), 0 0 14px rgba(167,139,250,0.8)" }} />
                              )}
                              <p className="absolute bottom-5 left-0 right-0 text-center text-[9px] font-black text-white pointer-events-none leading-none px-1 truncate drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{crop.name}</p>
                              <p className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-black text-green-300 pointer-events-none leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">×{cnt}</p>
                            </>
                          );
                        }
                      }
                      return (
                        <>
                          <span className="text-3xl pointer-events-none select-none">🌱</span>
                          <p className="text-[10px] font-black text-[#f9e7b2] pointer-events-none leading-none mt-0.5">Nasiona</p>
                        </>
                      );
                    })()}
                    {fvToolEditMode && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); const pos = fvNasonaPos; fvToolDragRef.current = { btn: "nasiona", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h }; }}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-orange-400/80 rounded-tl"
                      />
                    )}
                  </button>

                  {/* ─── Przycisk Kompost ─── */}
                  <button
                    type="button"
                    onClick={() => {
                      if (fvToolEditMode) return;
                      setFvCompostPickerOpen(prev => !prev);
                      setFvSeedPickerOpen(false);
                    }}
                    onMouseDown={fvToolEditMode ? (e) => {
                      e.preventDefault();
                      const pos = fvKompostPos;
                      fvToolDragRef.current = { btn: "kompost", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h };
                    } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : (selectedSeedId && isCompostKey(selectedSeedId)) ? "border-lime-300 bg-lime-900/70 shadow-[0_0_20px_rgba(140,220,60,0.5)]" : fvCompostPickerOpen ? "border-lime-500 bg-lime-950/80" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}`}
                    style={{ left: fvKompostPos.l, top: fvKompostPos.t, width: fvKompostPos.w, height: fvKompostPos.h }}
                  >
                    {(() => {
                      if (!fvToolEditMode && selectedSeedId && isCompostKey(selectedSeedId)) {
                        const cType = compostTypeFromKey(selectedSeedId);
                        const cVal = compostValueFromKey(selectedSeedId);
                        const cDef = cType ? COMPOST_DEFS[cType] : null;
                        const cnt = seedInventory[selectedSeedId] ?? 0;
                        if (cDef) {
                          return (
                            <>
                              <span className="text-3xl pointer-events-none select-none">{cDef.icon}</span>
                              <p className="text-[9px] font-black text-[#f9e7b2] pointer-events-none leading-none mt-0.5 text-center px-1 max-w-full truncate">{cDef.tierName(cVal)}</p>
                              <p className="text-[9px] text-lime-300 pointer-events-none leading-none">×{cnt}</p>
                            </>
                          );
                        }
                      }
                      return (
                        <>
                          <span className="text-3xl pointer-events-none select-none">♻️</span>
                          <p className="text-[10px] font-black text-[#f9e7b2] pointer-events-none leading-none mt-0.5">Kompost</p>
                        </>
                      );
                    })()}
                    {fvToolEditMode && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); const pos = fvKompostPos; fvToolDragRef.current = { btn: "kompost", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h }; }}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-orange-400/80 rounded-tl"
                      />
                    )}
                  </button>

                  {/* ─── Picker: Nasiona ─── */}
                  {fvSeedPickerOpen && !fvToolEditMode && (
                    <div
                      className="fixed inset-0 z-[115] flex items-center justify-center"
                      onClick={() => setFvSeedPickerOpen(false)}
                    >
                      <div
                        className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,6,0.97)] p-5 w-[760px] max-w-[95vw] max-h-[80vh] overflow-y-auto shadow-2xl backdrop-blur-sm"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-[10px] uppercase tracking-[0.25em] text-[#d8ba7a] mb-1">Wybierz uprawę</p>
                        <h3 className="text-xl font-black text-[#f9e7b2] mb-4">🌱 Nasiona w plecaku</h3>
                        {(["legendary","epic","good",null] as (string|null)[]).map(quality => {
                          const entries = Object.entries(seedInventory)
                            .filter(([k, cnt]) => !isCompostKey(k) && cnt > 0 && parseQualityKey(k).quality === quality)
                            .sort(([aId], [bId]) => {
                              const aC = parseQualityKey(aId).baseCropId;
                              const bC = parseQualityKey(bId).baseCropId;
                              const aLv = CROPS.find(c => c.id === aC)?.unlockLevel ?? 999;
                              const bLv = CROPS.find(c => c.id === bC)?.unlockLevel ?? 999;
                              return aLv - bLv;
                            });
                          if (entries.length === 0) return null;
                          const qLabel = quality === "legendary" ? "✨ Legendarne" : quality === "epic" ? "🟣 Epickie" : quality === "good" ? "🟢 Zwykłe" : "📦 Pozostałe";
                          const qColor = quality === "legendary" ? "#fbbf24" : quality === "epic" ? "#a78bfa" : quality === "good" ? "#6ee7b7" : "#8b6a3e";
                          return (
                            <div key={quality ?? "base"} className="mb-4">
                              <p className="text-xs font-black mb-2 uppercase tracking-wider" style={{ color: qColor }}>{qLabel}</p>
                              <div className="grid grid-cols-5 gap-3">
                                {entries.map(([seedId, cnt]) => {
                                  const { baseCropId, quality: q } = parseQualityKey(seedId);
                                  const crop = CROPS.find(c => c.id === baseCropId);
                                  if (!crop) return null;
                                  const sprite = q === "legendary" ? (crop.legendarySpritePath ?? crop.spritePath) : q === "epic" ? (crop.epicSpritePath ?? crop.spritePath) : q === "rotten" ? (crop.rottenSpritePath ?? crop.spritePath) : crop.spritePath;
                                  const isSel = selectedSeedId === seedId;
                                  return (
                                    <div key={seedId} className="flex flex-col items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSeedId(isSel ? null : seedId);
                                          setSelectedTool(null);
                                          setFvSeedPickerOpen(false);
                                          setSeedPickerTip(null);
                                        }}
                                        onMouseEnter={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const tipColor = q === "legendary" ? "#fbbf24" : q === "epic" ? "#a78bfa" : q === "good" ? "#6ee7b7" : "#9ca3af";
                                          const qLabel = q === "legendary" ? "✨ Legendarne" : q === "epic" ? "🟣 Epickie" : q === "good" ? "🟢 Zwykłe" : q === "rotten" ? "🟫 Zgniłe" : "Zwykłe";
                                          // Efektywny czas wzrostu gracza (te same wzory co getEffectiveGrowthTimeMs, bez per-pole)
                                          const _baseMs = crop.growthTimeMs;
                                          const _wiedzaEff = (effectiveStats.wiedza ?? 0) + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
                                          const _wiedzaPctRaw = calcStatEffect(_wiedzaEff, WIEDZA_RATE);
                                          const _wiedzaPct = Math.min((1 - WIEDZA_MULT_MIN) * 100, _wiedzaPctRaw);
                                          const _hivePct = Math.min((1 - HIVE_MULT_MIN) * 100, hiveData.level * 2);
                                          const _equipPct = Math.min((1 - EQUIP_GROWTH_MULT_MIN) * 100, getEquipBonusPct("% speed upraw", charEquipped));
                                          const _wiedzaMult = Math.max(WIEDZA_MULT_MIN, 1 - _wiedzaPct / 100);
                                          const _hiveMult = Math.max(HIVE_MULT_MIN, 1 - _hivePct / 100);
                                          const _equipMult = Math.max(EQUIP_GROWTH_MULT_MIN, 1 - _equipPct / 100);
                                          const _effMs = Math.round(_baseMs * Math.max(GROWTH_GLOBAL_MIN_MULT, _wiedzaMult * _hiveMult * _equipMult));
                                          const _zaradBonus = calcStatEffect(effectiveStats.zaradnosc ?? 0, ZARADNOSC_RATE);
                                          const _waterEqPct = getEquipBonusPct("% efekt podlewania", charEquipped) + getEquipBonusPct("% efekt wody", charEquipped);
                                          const _waterTotalPct = (WATER_BASE * 100) + _zaradBonus + _waterEqPct;
                                          const _withWaterMs = Math.round(_baseMs * Math.max(GROWTH_GLOBAL_MIN_MULT, Math.max(WATER_MULT_MIN, 1 - _waterTotalPct / 100) * _wiedzaMult * _hiveMult * _equipMult));
                                          const _fmt = (ms: number) => { const t = Math.max(0, Math.floor(ms/1000)); const h = Math.floor(t/3600); const m = Math.floor((t%3600)/60); const s = t%60; return h > 0 ? `${h}h ${m}min ${s}s` : m > 0 ? `${m}min ${s}s` : `${s}s`; };
                                          const _savedPct = Math.round(((_baseMs - _effMs) / _baseMs) * 100);
                                          const _showBonus = _wiedzaPct > 0 || _hivePct > 0 || _equipPct > 0;
                                          // Plony i EXP zależne od jakości
                                          const _yieldRange = crop.yieldAmount <= 2 ? "1–3 szt." : "2–5 szt.";
                                          const yieldText = q === "legendary" ? (crop.yieldAmount <= 2 ? "20–60 zw. + 5–12 epic." : "30–80 zw. + 8–18 epic.") : q === "epic" ? (crop.yieldAmount <= 2 ? "10–22 szt." : "14–30 szt.") : q === "rotten" ? `${_yieldRange} 🟫` : _yieldRange;
                                          const expText = q === "legendary" ? (crop.yieldAmount <= 2 ? `${crop.expReward * 10}–${crop.expReward * 20}` : `${crop.expReward * 12}–${crop.expReward * 25}`) : q === "epic" ? `${crop.expReward * 3}–${crop.expReward * 6}` : `${crop.expReward}`;
                                          const tipNode = (
                                            <>
                                              {/* ── HEADER ── */}
                                              <div className="flex items-start justify-between gap-2 mb-2.5">
                                                <div>
                                                  <p className="text-[18px] font-black leading-tight" style={{ color: tipColor }}>{crop.name}</p>
                                                  <p className="text-[13px] font-bold opacity-75 mt-0.5" style={{ color: tipColor }}>{qLabel}</p>
                                                </div>
                                                <span className="text-[13px] font-bold text-[#f9e7b2] bg-black/40 rounded-lg px-2 py-1 whitespace-nowrap mt-0.5">🎒 {cnt}</span>
                                              </div>

                                              {/* ── CZAS WZROSTU ── */}
                                              <div className="mb-2">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[15px] font-black text-emerald-300">🕒 {_fmt(_effMs)}</span>
                                                </div>
                                                {_waterTotalPct > 0 && (
                                                  <p className="text-[12px] text-cyan-300 mt-0.5">💧 Po podlaniu: <span className="font-bold">{_fmt(_withWaterMs)}</span></p>
                                                )}
                                              </div>

                                              {/* ── NAGRODY (legendary) ── */}
                                              {q === "legendary" && (
                                                <div className="rounded-lg border px-3 py-2 mb-2" style={{ borderColor: `${tipColor}55`, background: `${tipColor}0f` }}>
                                                  <p className="text-[12px] font-bold mb-1.5 opacity-60" style={{ color: tipColor }}>🎁 Nagrody (zawsze wszystkie)</p>
                                                  <p className="text-[14px] font-black text-[#dfcfab]">🤎 {crop.yieldAmount <= 2 ? "20–60" : "30–80"} zwykłych</p>
                                                  <p className="text-[14px] font-black text-purple-300">💜 {crop.yieldAmount <= 2 ? "5–12" : "8–18"} epickich</p>
                                                  <p className="text-[14px] font-black text-amber-300">⭐ EXP ×{crop.yieldAmount <= 2 ? "10–20" : "12–25"}</p>
                                                </div>
                                              )}

                                              {/* ── PLON (nie-legendary) ── */}
                                              {q !== "legendary" && (
                                                <div className="flex items-center justify-between mb-1.5">
                                                  <span className="text-[13px] text-[#8b6a3e]/80">🌾 Plon</span>
                                                  <span className="text-[14px] font-black text-white">
                                                    {q === "epic" ? (crop.yieldAmount <= 2 ? "10–22 szt." : "14–30 szt.") : q === "rotten" ? `${crop.yieldAmount <= 2 ? "1–3" : "2–5"} szt. 🟫` : `${crop.yieldAmount <= 2 ? "1–3" : "2–5"} szt.`}
                                                  </span>
                                                </div>
                                              )}

                                              {/* ── EXP ── */}
                                              <div className="flex items-center justify-between mb-2">
                                                <span className="text-[13px] text-[#8b6a3e]/80">📚 EXP</span>
                                                <span className="text-[14px] font-black text-sky-300">
                                                  {q === "legendary"
                                                    ? `+${crop.expReward}–${crop.expReward * 40}`
                                                    : q === "epic"
                                                    ? `+${crop.expReward * 3}–${crop.expReward * 6}`
                                                    : `+${crop.expReward}`}
                                                  {q === "legendary" && <span className="text-[11px] text-sky-400/50 ml-1">cap ×50</span>}
                                                </span>
                                              </div>

                                              {/* ── OPIS JAKOŚCI (epic/rotten) ── */}
                                              {q === "epic" && (
                                                <p className="text-[12px] text-purple-300/80 mb-2">🎲 Każda z {crop.yieldAmount <= 2 ? "10–22" : "14–30"} sztuk losuje jakość osobno + EXP ×3–6</p>
                                              )}
                                              {q === "rotten" && (
                                                <p className="text-[12px] text-[#9ca3af]/70 mb-2">⚠️ Obniżony plon przy zbiorze</p>
                                              )}

                                              {/* ── BONUSY (jedna linia ikon) ── */}
                                              {_showBonus && (
                                                <div className="flex gap-3 text-[12px] text-[#8b6a3e]/60 mt-0.5 border-t border-white/5 pt-1.5">
                                                  {_wiedzaPct > 0 && <span>🧠 −{_wiedzaPct.toFixed(1)}%</span>}
                                                  {_hivePct > 0 && <span>🍯 −{_hivePct.toFixed(1)}%</span>}
                                                  {_equipPct > 0 && <span>🧤 −{parseFloat(_equipPct.toFixed(1))}%</span>}
                                                </div>
                                              )}
                                            </>
                                          );
                                          setSeedPickerTip({ x: rect.left + rect.width / 2, y: rect.top, node: tipNode, color: tipColor });
                                        }}
                                        onMouseLeave={() => setSeedPickerTip(null)}
                                        className="relative w-[112px] h-[112px] rounded-xl border-2 overflow-hidden transition-colors"
                                        style={{ borderColor: isSel ? qColor : "rgba(139,106,62,0.4)", backgroundColor: isSel ? "rgba(30,18,8,0.9)" : "rgba(20,12,6,0.7)", ...(isSel ? { boxShadow: `0 0 14px ${qColor}88` } : {}) }}
                                      >
                                        <img src={sprite} alt={crop.name} className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />
                                        <span className="absolute bottom-1 right-1 min-w-[20px] rounded-md bg-black/80 px-1 py-0.5 text-[11px] font-black leading-none text-[#f9e7b2]">×{cnt}</span>
                                        {isSel && <span className="absolute inset-0 rounded-xl ring-2 ring-inset pointer-events-none" style={{ outlineColor: qColor }} />}
                                      </button>
                                      <p className="text-[11px] font-bold text-[#f9e7b2] text-center leading-tight max-w-[112px] truncate">{crop.name}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {Object.entries(seedInventory).filter(([k, v]) => !isCompostKey(k) && v > 0).length === 0 && (
                          <p className="text-sm text-[#dfcfab] text-center py-6">Brak nasion w plecaku</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setFvSeedPickerOpen(false)}
                          className="mt-3 w-full rounded-xl border border-[#8b6a3e]/60 bg-[rgba(38,24,14,0.7)] py-2 text-sm font-bold text-[#dfcfab] hover:bg-[rgba(58,34,18,0.9)] transition-colors"
                        >Zamknij</button>
                      </div>
                      {/* Tooltip nasiona */}
                      {seedPickerTip && (() => {
                        const TIP_W = 360;
                        const TIP_H_EST = 320;
                        const margin = 12;
                        let left = seedPickerTip.x - TIP_W / 2;
                        left = Math.max(margin, Math.min(window.innerWidth - TIP_W - margin, left));
                        let top = seedPickerTip.y - TIP_H_EST - 14;
                        if (top < margin) top = seedPickerTip.y + 125;
                        return (
                          <div
                            className="pointer-events-none fixed z-[9999] flex flex-col gap-1 rounded-xl border-2 px-4 py-3 shadow-2xl text-left bg-[rgba(8,18,12,0.98)]"
                            style={{ left, top, width: TIP_W, borderColor: seedPickerTip.color }}>
                            {seedPickerTip.node}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ─── Picker: Kompost ─── */}
                  {fvCompostPickerOpen && !fvToolEditMode && (
                    <div
                      className="fixed inset-0 z-[115] flex items-center justify-center"
                      onClick={() => setFvCompostPickerOpen(false)}
                    >
                      <div
                        className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,6,0.97)] p-5 w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl backdrop-blur-sm"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-[10px] uppercase tracking-[0.25em] text-[#d8ba7a] mb-1">Wybierz kompost</p>
                        <h3 className="text-xl font-black text-[#f9e7b2] mb-4">♻️ Kompost w plecaku</h3>
                        {(Object.keys(COMPOST_DEFS) as (keyof typeof COMPOST_DEFS)[]).map(cType => {
                          const def = COMPOST_DEFS[cType];
                          const entries = def.bonusValues.flatMap(val => {
                            const key = compostKeyFor(cType, val);
                            const cnt = seedInventory[key] ?? 0;
                            return cnt > 0 ? [{ key, val, cnt }] : [];
                          });
                          if (entries.length === 0) return null;
                          return (
                            <div key={cType} className="mb-4">
                              <p className="text-xs font-black mb-2 uppercase tracking-wider text-[#d8ba7a]">{def.icon} {def.name}</p>
                              <div className="flex flex-col gap-2">
                                {entries.map(({ key: cKey, val, cnt }) => {
                                  const isSel = selectedSeedId === cKey;
                                  const tierLabel = def.tierName(val);
                                  const bonusLabel = def.bonusLabel(val);
                                  return (
                                    <button
                                      key={cKey}
                                      type="button"
                                      onClick={() => {
                                        setSelectedSeedId(isSel ? null : cKey);
                                        setSelectedTool(null);
                                        setFvCompostPickerOpen(false);
                                      }}
                                      className="flex items-center gap-3 rounded-xl border-2 px-3 py-2 transition-colors text-left"
                                      style={{ borderColor: isSel ? "#86efac" : "rgba(139,106,62,0.4)", backgroundColor: isSel ? "rgba(20,40,10,0.9)" : "rgba(20,12,6,0.7)" }}
                                    >
                                      <span className="text-2xl select-none">{def.icon}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[#f9e7b2] leading-tight">{tierLabel} {def.name}</p>
                                        <p className="text-[11px] text-[#d8ba7a]">{bonusLabel}</p>
                                      </div>
                                      <p className="text-sm font-black text-lime-300 shrink-0">×{cnt}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(COMPOST_DEFS).every(t => (COMPOST_DEFS[t as keyof typeof COMPOST_DEFS].bonusValues.every(v => (seedInventory[compostKeyFor(t as keyof typeof COMPOST_DEFS, v)] ?? 0) === 0))) && (
                          <p className="text-sm text-[#dfcfab] text-center py-6">Brak kompostu w plecaku</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setFvCompostPickerOpen(false)}
                          className="mt-3 w-full rounded-xl border border-[#8b6a3e]/60 bg-[rgba(38,24,14,0.7)] py-2 text-sm font-bold text-[#dfcfab] hover:bg-[rgba(58,34,18,0.9)] transition-colors"
                        >Zamknij</button>
                      </div>
                    </div>
                  )}

                  <div className="mb-4 pr-28">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Widok pola</p>
                    <h2 className="mt-2 text-2xl font-black text-[#f9e7b2]">Twoje pole uprawne</h2>
                    <p className="mt-2 text-sm text-[#dfcfab]">
                      Wybierz uprawę lub kompost przyciskami po prawej, użyj konewki lub sierpa, a potem kliknij pole. Możesz też używać WASD i strzałek.
                    </p>
                  </div>

                  <div>
                  <div
                    ref={fhContainerRef}
                    className="relative overflow-hidden rounded-[20px] border border-[#8b6a3e] bg-black/20 flex-1"
                    onMouseMove={(e) => { if (fieldHitboxEditMode) handleFhMouseMove(e); }}
                    onMouseUp={() => { handleFhMouseUp(); }}
                    onMouseLeave={() => { handleFhMouseUp(); }}
                    style={fieldHitboxEditMode ? { userSelect: "none" } : {}}
                  >
                  <div className="relative mx-auto aspect-[1536/1092] w-full">
                    <img
                      src="/ui/farm-field-view.png"
                      alt="Widok pola 25 slotów"
                      className="h-full w-full object-contain"
                    />

                    <div className="absolute inset-0">
                      {(fieldHitboxEditMode
                        ? Array.from({length:100},(_,i)=>({ id:i+1, left:`${fhCols[i%10].toFixed(1)}%`, top:`${fhRows[Math.floor(i/10)].toFixed(1)}%`, width:`${fhCellW.toFixed(1)}%`, height:`${fhCellH.toFixed(1)}%` }))
                        : FIELD_VIEW_PLOTS
                      ).map((plot) => {
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
                            onDragStart={(e) => e.preventDefault()}
                            onMouseEnter={() => { tryApplyFieldAction(plotId); }}
                            onMouseDown={(e) => {
                              if (e.button !== 0) return;
                              e.preventDefault();
                              if (fieldHitboxEditMode) {
                                if ((e.target as HTMLElement).dataset.resizeHandle) return;
                                const rect = fhContainerRef.current?.getBoundingClientRect();
                                if (!rect) return;
                                const pctX = ((e.clientX - rect.left) / rect.width) * 100;
                                const pctY = ((e.clientY - rect.top) / rect.height) * 100;
                                fhDragRef.current = { startMouseX: pctX, startMouseY: pctY, startOffsetX: fhOffsetX, startOffsetY: fhOffsetY };
                                return;
                              }
                              dragEndedRef.current = false;
                              if (!isUnlocked) return;
                              const _plot = getPlotCrop(plotId);
                              let _started = false;
                              if (selectedTool === "watering_can") {
                                if (_plot.cropId && !_plot.watered && !isCropReady(plotId)) _started = true;
                              } else if (selectedTool === "sickle") {
                                if (_plot.cropId && isCropReady(plotId)) _started = true;
                              } else if (selectedSeedId && isCompostKey(selectedSeedId)) {
                                if (!_plot.cropId && !_plot.compostBonus && (seedInventoryRef.current[selectedSeedId] ?? 0) > 0) _started = true;
                              } else if (selectedSeedId) {
                                if (!_plot.cropId && (seedInventoryRef.current[selectedSeedId] ?? 0) > 0 && !pendingFieldActions[plotId]) _started = true;
                              } else if (_plot.cropId && isCropReady(plotId)) {
                                _started = true;
                              }
                              if (_started) {
                                isDraggingPlantRef.current = true;
                                dragPlantedFieldsRef.current = new Set([plotId]);
                                // Wykonaj akcję na pierwszym polu
                                if (selectedTool === "watering_can") void handleWaterPlot(plotId);
                                else if (selectedTool === "sickle") void handleHarvestPlot(plotId);
                                else if (selectedSeedId && isCompostKey(selectedSeedId)) void applyCompostToPlot(plotId, selectedSeedId);
                                else if (selectedSeedId) void handlePlantFromSelectedSeed(plotId);
                                else void handleHarvestPlot(plotId);
                              }
                            }}
                            onClick={() => {
                              if (fieldHitboxEditMode) return;
                              setSelectedPlotId(plotId);
                              if (!isUnlocked) return;
                              // Akcja już wykonana w onMouseDown (drag) — pomiń
                              if (dragEndedRef.current) { dragEndedRef.current = false; return; }
                              if (selectedTool === "watering_can") { handleWaterPlot(plotId); return; }
                              if (selectedTool === "sickle") { void handleHarvestPlot(plotId); return; }
                              if (selectedSeedId && isCompostKey(selectedSeedId)) { void applyCompostToPlot(plotId, selectedSeedId); return; }
                              if (selectedSeedId) { handlePlantFromSelectedSeed(plotId); return; }
                              if (getPlotCrop(plotId).cropId && isCropReady(plotId)) void handleHarvestPlot(plotId);
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
                              fieldHitboxEditMode
                                ? "cursor-move border-2 border-orange-400/70 bg-orange-900/10"
                                : isUnlocked ? "cursor-pointer hover:scale-[1.02]" : "cursor-pointer opacity-90"
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
                                  const _isReady = isCropReady(plotId);
                                  if (_stagedSrc) {
                                    return (
                                      <img
                                        src={_stagedSrc}
                                        alt={_plantedCrop?.name}
                                        className={`pointer-events-none absolute inset-[8%] h-[84%] w-[84%] object-contain${_isReady ? " animate-pulse" : ""}`}
                                        style={{ imageRendering: "pixelated" }}
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = _plantedCrop?.spritePath ?? "/uprawy/carrot.png"; }}
                                      />
                                    );
                                  }
                                  return (
                                    <div
                                      className={`pointer-events-none absolute inset-[8%]${_isReady ? " animate-pulse" : ""}`}
                                      style={{
                                        backgroundImage: `url('${_plantedCrop?.spritePath ?? "/uprawy/carrot.png"}')`,
                                        backgroundSize: "100% 100%",
                                        backgroundRepeat: "no-repeat",
                                        imageRendering: "pixelated",
                                      }}
                                    />
                                  );
                                })()}

                                {/* Ikona kompostu — lewy górny róg (rozmiar = 💧), duża na środku gdy puste */}
                                {(() => {
                                  const _cb = getPlotCrop(plotId).compostBonus;
                                  if (!_cb) return null;
                                  const _def = COMPOST_DEFS[_cb.type];
                                  const _tIdx = _def.bonusValues.indexOf(_cb.value);
                                  const _tColor = _tIdx === 0 ? "#9ca3af" : _tIdx === 1 ? "#fbbf24" : "#a78bfa";
                                  const _hasCrop = !!getPlotCrop(plotId).cropId;
                                  if (_hasCrop) {
                                    return (
                                      <div
                                        className="pointer-events-none absolute left-0.5 top-0.5 z-10 flex items-center rounded-full px-1 py-0.5 text-[18px] leading-none shadow-lg"
                                        style={{ background: `${_tColor}33`, border: `1px solid ${_tColor}` }}>
                                        <span>{_def.icon}</span>
                                      </div>
                                    );
                                  }
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

                                {/* Kropla podlewania — centrum, 20% mniejsza niż poprzednio */}
                                {getPlotCrop(plotId).watered && (
                                  <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 px-1 py-0.5 text-[14px] leading-none">
                                    💧
                                  </div>
                                )}

                                {/* Badge jakości — prawy górny róg (tylko gdy posadzone) */}
                                {(() => {
                                  const _pq = getPlotCrop(plotId).plantedQuality;
                                  if (!getPlotCrop(plotId).cropId) return null;
                                  if (_pq === "epic") return (
                                    <div className="pointer-events-none absolute right-0.5 top-0.5 z-10 animate-pulse rounded px-0.5 py-px text-[8px] font-black leading-tight tracking-wide"
                                      style={{ background: "rgba(88,28,135,0.70)", border: "1px solid rgba(167,139,250,0.65)", color: "#d8b4fe", textShadow: "0 0 5px rgba(167,139,250,0.9)" }}>
                                      EPIC
                                    </div>
                                  );
                                  if (_pq === "legendary") return (
                                    <div className="pointer-events-none absolute right-0.5 top-0.5 z-10 animate-pulse rounded px-0.5 py-px text-[8px] font-black leading-tight tracking-wide"
                                      style={{ background: "rgba(120,53,15,0.70)", border: "1px solid rgba(251,191,36,0.65)", color: "#fde68a", textShadow: "0 0 5px rgba(251,191,36,0.9)" }}>
                                      Legend
                                    </div>
                                  );
                                  return null;
                                })()}

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
                                <div className="absolute inset-0 flex flex-col items-center justify-center px-0.5 text-center">
                                  {(() => {
                                    const _ot = getPlotObstacleType(plotId);
                                    const _od = _ot ? OBSTACLE_DEFS[_ot] : null;
                                    return _od ? (
                                      <>
                                        <span className="text-[14px] leading-none">{_od.icon}</span>
                                        <span className="mt-0.5 text-[9px] font-bold leading-tight" style={{ color: _od.color }}>{_od.name}</span>
                                        <span className="text-[8px] font-black text-amber-300 leading-none">{plotCost} PLN</span>
                                      </>
                                    ) : (
                                      <span className="text-[9px] font-bold uppercase leading-tight text-[#f5dfb0]">
                                        {plotCost} PLN
                                      </span>
                                    );
                                  })()}
                                </div>
                              </>
                            )}
                            {fieldHitboxEditMode && (
                              <div
                                data-resize-handle="1"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const rect = fhContainerRef.current?.getBoundingClientRect();
                                  if (!rect) return;
                                  const pctX = ((e.clientX - rect.left) / rect.width) * 100;
                                  const pctY = ((e.clientY - rect.top) / rect.height) * 100;
                                  fhResizeRef.current = { startMouseX: pctX, startMouseY: pctY, startW: fhCellW, startH: fhCellH };
                                }}
                                className="absolute bottom-0 right-0 z-50 h-4 w-4 cursor-se-resize rounded-tl-md bg-orange-500 opacity-80 hover:opacity-100"
                                title="Przeciągnij, aby zmienić rozmiar"
                              />
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

                              // Oblicz etykietę — jeśli nie ma żadnej akcjonalnej wskazówki, nie renderuj tooltipa.
                              // "Wybierz nasiono" NIE pojawia się tu: jest obsłużone przez setMessage w confirmSelectedPlot.
                              const _plotReady = getPlotCrop(selectedPlotId).cropId && isCropReady(selectedPlotId);
                              const _hintText = selectedTool === "watering_can"
                                ? "Kliknij pole, aby podlać"
                                : selectedTool === "sickle"
                                ? "Kliknij gotową uprawę, aby zebrać"
                                : selectedSeedId
                                ? `Kliknij pole, aby posadzić ${CROPS.find((c) => c.id === parseQualityKey(selectedSeedId).baseCropId)?.name ?? "roślinę"}`
                                : _plotReady
                                ? "Enter lub kliknij pole, aby zebrać"
                                : null;

                              if (!_hintText) return null;

                              return (
                                <div className="pointer-events-none absolute inset-0">
                                  <div
                                    className="pointer-events-none absolute z-20 rounded-2xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-3 py-2 text-xs font-bold text-[#f3e6c8] shadow-2xl"
                                    style={{
                                      left: `calc(${activePlot.left} + ${activePlot.width} + 0.8%)`,
                                      top: activePlot.top,
                                    }}
                                  >
                                    {_hintText}
                                  </div>
                                </div>
                              );
                            }

                            const _obstType = getPlotObstacleType(selectedPlotId);
                            const _obstDef = _obstType ? OBSTACLE_DEFS[_obstType] : null;
                            // Desynchronizacja: pole nie jest odblokowane lokalnie, ale brak też danych przeszkody
                            const _isStaleState = selectedPlotId > 20 && !_obstType && selectedPlotCost === 0;
                            return (
                              <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/50 px-4">
                                <div className="w-full max-w-md rounded-[28px] border border-[#c79b48] bg-[linear-gradient(180deg,rgba(66,39,17,0.98),rgba(34,20,10,0.98))] p-6 text-[#f7e7bf] shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
                                  {_isStaleState ? (
                                    <>
                                      <p className="text-xs uppercase tracking-[0.35em] text-yellow-400">Desynchronizacja stanu</p>
                                      <h2 className="mt-3 text-2xl font-black text-[#fff1c7]">Pole #{selectedPlotId}</h2>
                                      <p className="mt-2 text-sm text-[#f2ddb0] leading-relaxed">
                                        To pole jest prawdopodobnie już odblokowane w bazie danych, ale lokalny stan gry tego nie wie. Kliknij "Napraw", aby zsynchronizować.
                                      </p>
                                      <div className="mt-6 flex justify-end gap-3">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedPlotId(null)}
                                          className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-5 py-2 text-sm font-bold text-[#f3e6c8] transition hover:bg-[rgba(20,12,8,0.8)]"
                                        >
                                          Anuluj
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!profile?.id) return;
                                            const { data: freshRow } = await supabase
                                              .from("profiles")
                                              .select("unlocked_plots, plot_obstacles")
                                              .eq("id", profile.id)
                                              .single();
                                            if (freshRow) {
                                              const freshUnlocked = parseUnlockedPlots(freshRow.unlocked_plots);
                                              setUnlockedPlots(freshUnlocked);
                                              if (freshRow.plot_obstacles && typeof freshRow.plot_obstacles === "object") {
                                                setPlotObstacles(freshRow.plot_obstacles as Record<string, { type: string; cost: number }>);
                                              }
                                              setSelectedPlotId(null);
                                              if (freshUnlocked.includes(selectedPlotId)) {
                                                setMessage({ type: "info", title: "Stan zsynchronizowany", text: `Pole #${selectedPlotId} jest odblokowane — stan naprawiony.` });
                                              } else {
                                                setMessage({ type: "info", title: "Zsynchronizowano", text: `Pole #${selectedPlotId} nie jest odblokowane w bazie — kliknij je, aby odblokować.` });
                                              }
                                            }
                                          }}
                                          className="rounded-2xl border border-yellow-400/80 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                                        >
                                          Napraw stan pola
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Zablokowane pole</p>
                                      <h2 className="mt-3 text-2xl font-black text-[#fff1c7]">Pole #{selectedPlotId}</h2>
                                      {_obstDef ? (
                                        <p className="mt-2 text-base text-[#f2ddb0]">
                                          Przeszkoda: <span style={{ color: _obstDef.color }} className="font-black">{_obstDef.icon} {_obstDef.name}</span>
                                        </p>
                                      ) : null}
                                      <p className="mt-2 text-base text-[#f2ddb0]">
                                        Koszt usunięcia: <span className="font-black text-amber-300">{selectedPlotCost} PLN</span>
                                      </p>
                                      {displayMoney < selectedPlotCost && (
                                        <p className="mt-2 text-sm text-red-300">Masz za mało pieniędzy na to pole.</p>
                                      )}
                                      <div className="mt-6 flex justify-end gap-3">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedPlotId(null)}
                                          className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-5 py-2 text-sm font-bold text-[#f3e6c8] transition hover:bg-[rgba(20,12,8,0.8)]"
                                        >
                                          Anuluj
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPlotToBuy(selectedPlotId)}
                                          className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                                          disabled={displayMoney < selectedPlotCost}
                                        >
                                          {_obstDef ? `${_obstDef.icon} Usuń: ${selectedPlotCost} PLN` : `Odblokuj: ${selectedPlotCost} PLN`}
                                        </button>
                                      </div>
                                    </>
                                  )}
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
                          {(() => {
                            const _ot2 = getPlotObstacleType(plotToBuy);
                            const _od2 = _ot2 ? OBSTACLE_DEFS[_ot2] : null;
                            const _cost2 = getPlotUnlockCost(plotToBuy);
                            return (
                              <>
                                <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Potwierdzenie usunięcia przeszkody</p>
                                <h2 className="mt-3 text-2xl font-black text-[#fff1c7]">Pole #{plotToBuy}</h2>
                                {_od2 && (
                                  <p className="mt-2 text-base text-[#f2ddb0]">
                                    Przeszkoda: <span style={{ color: _od2.color }} className="font-black">{_od2.icon} {_od2.name}</span>
                                  </p>
                                )}
                                <p className="mt-2 text-base leading-7 text-[#f2ddb0]">
                                  Koszt usunięcia: <span className="font-black text-amber-300">{_cost2} PLN</span>
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
                                    {_od2 ? `${_od2.icon} Usuń` : "Odblokuj"}: {_cost2} PLN
                                  </button>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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

            // ── EXP breakdown per jakość ──────────────────────────────────────
            const _expByQ: Record<string, {label:string;badge:string;count:number;rawExp:number}> = {};
            for (const e of harvestLog) {
              const _qd2 = CROP_QUALITY_DEFS[e.quality];
              const _cd2 = CROPS.find(c => c.id === e.cropId);
              const _perUnit = _cd2 ? _cd2.expReward * _qd2.expMult : 0;
              if (!_expByQ[e.quality]) _expByQ[e.quality] = { label: _qd2.label, badge: _qd2.badge, count: 0, rawExp: 0 };
              _expByQ[e.quality].count += e.baseAmount;
              _expByQ[e.quality].rawExp += e.baseAmount * _perUnit;
            }
            const _rawTotalExp = Math.round(Object.values(_expByQ).reduce((s, g) => s + g.rawExp, 0));
            const _bonusExpAdded = totalExp - _rawTotalExp;
            const _logExpBonusPct = harvestLog.reduce((m, e) => Math.max(m, e.expBonusPct ?? 0), 0);
            const _logCompostExpPct = harvestLog.reduce((m, e) => Math.max(m, e.compostBonus?.type === "exp" ? (e.compostBonus?.value ?? 0) : 0), 0);
            const _logCompostGrowthPct = harvestLog.reduce((m, e) => Math.max(m, e.compostBonus?.type === "growth" ? (e.compostBonus?.value ?? 0) : 0), 0);
            const _logCompostYield = harvestLog.reduce((m, e) => Math.max(m, e.compostBonus?.type === "yield" ? (e.compostBonus?.value ?? 0) : 0), 0);
            const _qualOrder = ["good","epic","legendary","rotten"] as const;

            // ── Aktywne bonusy zbioru (bieżący stan eq + statystyki) ──────────
            const _eqExpPct    = Math.round(getEquipBonusPct("% EXP z upraw", charEquipped) + getEquipBonusPct("% EXP", charEquipped));
            const _eqExtraPct  = Math.round(getEquipBonusPct("% extra harvest", charEquipped));
            const _eqDropPct   = Math.round(getEquipBonusPct("% bonus drop", charEquipped));
            const _eqZbiorPct  = Math.round(getEquipBonusPct("% speed zbioru", charEquipped));
            const _eqUprawPct  = Math.round(getEquipBonusPct("% speed upraw", charEquipped));
            const _eqKompostPct= Math.round(getEquipBonusPct("% efekt kompostu", charEquipped));
            const _eqWiedzaPkt = Math.round(getEquipFlatBonus(" pkt Wiedzy", charEquipped));
            const _stWiedza    = (effectiveStats.wiedza ?? 0) + _eqWiedzaPkt;
            const _stZrecznosc = effectiveStats.zrecznosc ?? 0;
            const _stZaradnosc = effectiveStats.zaradnosc ?? 0;
            const _stSzczescie = effectiveStats.szczescie ?? 0;
            const _hasAnyBonus = _stWiedza > 0 || _stZrecznosc > 0 || _stZaradnosc > 0 || _stSzczescie > 0
              || _eqExpPct > 0 || _eqExtraPct > 0 || _eqDropPct > 0 || _eqZbiorPct > 0
              || _eqUprawPct > 0 || _eqKompostPct > 0 || _logCompostExpPct > 0
              || _logCompostGrowthPct > 0 || _logCompostYield > 0;

            return (
              <div className="fixed bottom-4 right-4 z-[88] w-[min(95vw,600px)] rounded-[18px] border border-[#8b6a3e] bg-[rgba(24,14,6,0.97)] text-[#dfcfab] shadow-2xl backdrop-blur-sm overflow-hidden">
                {/* Nagłówek */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#8b6a3e]/30">
                  <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#d8ba7a]">🎒 Ostatnie zbiory ({harvestCountdown}s)</p>
                  <button onClick={() => setHarvestLog([])} className="rounded-lg bg-[rgba(255,255,255,0.06)] px-3 py-1 text-[10px] text-[#8b6a3e] hover:text-[#d8ba7a] transition-colors">✕ Zamknij</button>
                </div>

                {/* Treść — dwie kolumny */}
                <div className="flex divide-x divide-[#8b6a3e]/20">

                  {/* Lewa: ikony zebranych przedmiotów */}
                  <div className="flex-1 min-w-0 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8b6a3e] mb-3">Zebrano</p>
                    <div className="flex flex-wrap gap-2">
                      {items.map((g, i) => {
                        const _qd = CROP_QUALITY_DEFS[g.quality];
                        const _cropDef = CROPS.find(c => c.id === g.cropId);
                        const _sprite = g.quality === "epic" ? (_cropDef?.epicSpritePath ?? _cropDef?.spritePath)
                                      : g.quality === "rotten" ? (_cropDef?.rottenSpritePath ?? _cropDef?.spritePath)
                                      : g.quality === "legendary" ? (_cropDef?.legendarySpritePath ?? _cropDef?.spritePath)
                                      : _cropDef?.spritePath;
                        const _total = g.baseAmount + g.bonusAmount;
                        const _isExpOnly = g.quality === "legendary" && g.baseAmount === 0;
                        return (
                          <div key={i} className="group relative">
                            <div className="relative h-[76px] w-[76px] cursor-default overflow-hidden rounded-xl border-2 transition-transform duration-150 group-hover:scale-110"
                              style={_isExpOnly
                                ? { borderColor: "#38bdf8", background: "rgba(14,60,100,0.6)" }
                                : g.quality === "legendary"
                                  ? { borderColor: _qd.borderColor, background: _qd.bgColor, animation: "legendaryPulse 2s ease-in-out infinite" }
                                  : { borderColor: _qd.borderColor, background: _qd.bgColor }}>
                              {_isExpOnly
                                ? <span className="flex h-full w-full flex-col items-center justify-center gap-0.5">
                                    <span className="text-[30px] leading-none">⭐</span>
                                    <span className="text-[11px] font-black text-sky-300 leading-none">XP</span>
                                  </span>
                                : _sprite
                                  ? <img src={_sprite} alt={g.cropName} className="h-full w-full object-contain p-1.5" />
                                  : <span className="flex h-full w-full items-center justify-center text-3xl">🌾</span>
                              }
                              {g.quality === "legendary" && !_isExpOnly && (
                                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                                  <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                </span>
                              )}
                              <span className="absolute left-0.5 top-0.5 text-[11px] leading-none drop-shadow">{_isExpOnly ? "✨" : _qd.badge}</span>
                              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[11px] font-black text-white leading-tight">
                                {_total === 0 && g.bonusSource ? g.bonusSource : `×${_total}`}
                              </span>
                            </div>
                            {/* Tooltip */}
                            <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[200] hidden w-44 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(20,10,4,0.98)] p-3 text-xs shadow-2xl group-hover:block">
                              <p className="mb-1 font-black text-[#f9e7b2]">{g.cropName}</p>
                              <p className="mb-1" style={{ color: _qd.borderColor }}>{_qd.badge} {_qd.label}</p>
                              {g.baseAmount > 0 && <p>Zebrano: <span className="font-bold text-yellow-300">+{g.baseAmount} szt.</span></p>}
                              {g.bonusAmount > 0 && <p>Bonus <span className="text-amber-300">({g.bonusSource})</span>: <span className="font-bold text-yellow-300">+{g.bonusAmount} szt.</span></p>}
                              {_isExpOnly && <p className="text-amber-300">🌟 Bonus EXP {g.bonusSource}</p>}
                              <p className="mt-1 border-t border-[#8b6a3e]/40 pt-1 text-sky-300">EXP: +{g.baseExp}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Prawa: rozbicie EXP + aktywne bonusy */}
                  <div className="w-[220px] shrink-0 flex flex-col divide-y divide-[#8b6a3e]/20">

                    {/* Rozbicie EXP */}
                    <div className="p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#8b6a3e] mb-2">Rozbicie EXP</p>
                      <div className="flex flex-col gap-1">
                        {_qualOrder.filter(q => (_expByQ[q]?.count ?? 0) > 0).map(q => {
                          const _qg = _expByQ[q];
                          return (
                            <div key={q} className="flex items-center justify-between text-[11px] gap-1">
                              <span className="text-[#c8b890] truncate">{_qg.badge} {_qg.label}: {_qg.count} szt.</span>
                              <span className={`font-bold shrink-0 ${q === "rotten" ? "text-[#6b7280]" : "text-sky-300"}`}>+{_qg.rawExp}</span>
                            </div>
                          );
                        })}
                        {_bonusExpAdded > 0 && (
                          <div className="flex items-center justify-between text-[11px] gap-1">
                            <span className="text-amber-300 truncate">⭐ Bonus +{_logExpBonusPct}%</span>
                            <span className="font-bold text-amber-300 shrink-0">+{_bonusExpAdded}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-[#8b6a3e]/40 pt-2">
                        <span className="text-[11px] font-black text-[#d8ba7a]">Razem:</span>
                        <span className="text-[16px] font-black text-sky-300">+{totalExp} EXP</span>
                      </div>
                    </div>

                    {/* Aktywne bonusy zbioru */}
                    <div className="p-4 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#8b6a3e] mb-2">Aktywne bonusy</p>
                      {_hasAnyBonus ? (
                        <div className="flex flex-col gap-1 text-[11px]">
                          {_stWiedza > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">📚 Wiedza {_stWiedza} pkt</span>
                              <span className="text-blue-300 shrink-0">-{Math.min(25, Math.round(calcStatEffect(_stWiedza, WIEDZA_RATE)))}% czas</span>
                            </div>
                          )}
                          {_stZrecznosc > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">🎯 Zręczność {_stZrecznosc}</span>
                              <span className="text-emerald-300 shrink-0">{Math.round(calcStatEffect(_stZrecznosc, 0.004))}% ×2</span>
                            </div>
                          )}
                          {_stZaradnosc > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">💧 Zaradność {_stZaradnosc}</span>
                              <span className="text-cyan-300 shrink-0">+{Math.round(calcStatEffect(_stZaradnosc, ZARADNOSC_RATE))}% woda</span>
                            </div>
                          )}
                          {_stSzczescie > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">🍀 Szczęście {_stSzczescie}</span>
                              <span className="text-purple-300 shrink-0">+{Math.round(calcStatEffect(_stSzczescie, 0.0025))}% drop</span>
                            </div>
                          )}
                          {_eqExpPct > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">🧤 EXP z upraw</span>
                              <span className="text-amber-300 shrink-0">+{_eqExpPct}%</span>
                            </div>
                          )}
                          {_eqExtraPct > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">🌾 Bonus plon</span>
                              <span className="text-amber-300 shrink-0">+{_eqExtraPct}%</span>
                            </div>
                          )}
                          {_eqDropPct > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">🍀 Bonus drop</span>
                              <span className="text-amber-300 shrink-0">+{_eqDropPct}%</span>
                            </div>
                          )}
                          {_eqZbiorPct > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">⚡ Speed zbioru</span>
                              <span className="text-amber-300 shrink-0">+{_eqZbiorPct}%</span>
                            </div>
                          )}
                          {_eqUprawPct > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">🌱 Speed upraw</span>
                              <span className="text-amber-300 shrink-0">+{_eqUprawPct}%</span>
                            </div>
                          )}
                          {_eqKompostPct > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">🌿 Efekt kompostu</span>
                              <span className="text-green-300 shrink-0">+{_eqKompostPct}%</span>
                            </div>
                          )}
                          {_logCompostGrowthPct > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">⚡ Kompost Wzrostu</span>
                              <span className="text-green-300 shrink-0">-{_logCompostGrowthPct}% czas</span>
                            </div>
                          )}
                          {_logCompostYield > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">🌾 Kompost Urodzaju</span>
                              <span className="text-green-300 shrink-0">+{_logCompostYield} szt.</span>
                            </div>
                          )}
                          {_logCompostExpPct > 0 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[#c8b890]">⭐ Kompost Nauki</span>
                              <span className="text-green-300 shrink-0">+{_logCompostExpPct}% EXP</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#6b7280] italic">Brak aktywnych bonusów</p>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            );
          })()}

          {message && (() => {
            const isErr = message.type === 'error';
            const isOk = message.type === 'success';
            const colorWrap = isErr
              ? 'border-red-400/60 bg-gradient-to-br from-red-950/95 to-red-900/90 text-red-50 shadow-[0_20px_60px_-10px_rgba(239,68,68,0.4)]'
              : isOk
              ? 'border-emerald-400/60 bg-gradient-to-br from-emerald-950/95 to-emerald-900/90 text-emerald-50 shadow-[0_20px_60px_-10px_rgba(16,185,129,0.4)]'
              : 'border-sky-400/60 bg-gradient-to-br from-sky-950/95 to-sky-900/90 text-sky-50 shadow-[0_20px_60px_-10px_rgba(56,189,248,0.4)]';
            const barColor = isErr ? 'bg-red-400' : isOk ? 'bg-emerald-400' : 'bg-sky-400';
            const icon = isErr ? '⚠️' : isOk ? '✅' : 'ℹ️';
            const durMs = isErr ? 8000 : 6000;
            return (
              <div
                key={`${message.title}-${message.text}`}
                className="fixed top-6 left-1/2 -translate-x-1/2 z-[400] w-[min(92vw,520px)] pointer-events-none"
                style={{ animation: 'plonopolisToastIn 280ms cubic-bezier(0.16,1,0.3,1)' }}
              >
                <div className={`pointer-events-auto relative overflow-hidden rounded-2xl border-2 backdrop-blur-md ${colorWrap}`}>
                  <button
                    onClick={() => setMessage(null)}
                    aria-label="Zamknij powiadomienie"
                    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/80 text-base font-black transition hover:bg-black/60 hover:text-white"
                  >
                    ✕
                  </button>
                  <div className="flex items-start gap-3 px-5 py-4 pr-12">
                    <span className="text-3xl shrink-0 leading-none mt-0.5">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-black leading-tight">{message.title}</p>
                      {message.text && <p className="mt-1.5 text-sm opacity-90 leading-snug">{message.text}</p>}
                    </div>
                  </div>
                  {/* Pasek postępu zanikania */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                    <div
                      className={`h-full ${barColor}`}
                      style={{ animation: `plonopolisToastBar ${durMs}ms linear forwards` }}
                    />
                  </div>
                </div>
                <style>{`
                  @keyframes plonopolisToastIn {
                    from { opacity: 0; transform: translate(-50%, -16px) scale(0.96); }
                    to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
                  }
                  @keyframes plonopolisToastBar {
                    from { width: 100%; }
                    to   { width: 0%; }
                  }
                `}</style>
              </div>
            );
          })()}
        </div>
      </div>
    {/* Tooltip sierpa podążający za kursorem */}
      {hoveredSickle && (
        <div
          className="pointer-events-none fixed z-[10000] w-72 rounded-[18px] border border-yellow-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: Math.min(mousePos.x + 18, BASE_W - 300), top: Math.max(8, mousePos.y - 220) }}
        >
          <p className="mb-1 font-black text-yellow-300">Sierp — Zbierz</p>
          <p className="mb-3 text-[18px] text-[#8b6a3e]">Bonusy aktywne przy zbiorze dojrzałej uprawy</p>
          <p className="mb-1">Szansa na podwójny zbiór <span className="font-bold text-yellow-300">(+{calcStatEffect(effectiveStats.zrecznosc, 0.004).toFixed(1)}%)</span></p>
          <p className="text-[16px] text-[#8b6a3e] mb-2">z Zręczności ({effectiveStats.zrecznosc}/100{effectiveStats.zrecznosc !== playerStats.zrecznosc ? `, w tym +${effectiveStats.zrecznosc - playerStats.zrecznosc} z avatara` : ""})</p>
          <p className="mb-1">Szansa na bonusowy drop <span className="font-bold text-green-300">(+{calcStatEffect(effectiveStats.szczescie, 0.0025).toFixed(1)}%)</span></p>
          <p className="text-[16px] text-[#8b6a3e]">ze Szczęścia ({effectiveStats.szczescie}/100{effectiveStats.szczescie !== playerStats.szczescie ? `, w tym +${effectiveStats.szczescie - playerStats.szczescie} z avatara` : ""})</p>
        </div>
      )}
    {/* Tooltip ula (zablokowany do lvl 10) podążający za kursorem */}
      {hoveredHiveLock && isOnFarmMap && !!profile && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}
        >
          <p className="mb-2 font-black text-amber-300">Ul — zablokowany</p>
          <p className="mb-1">Wymaga: <span className="font-bold text-amber-300">{HIVE_UNLOCK_LVL} poziom gracza</span></p>
          <p className="mt-2 text-[16px] text-[#8b6a3e]">Po odblokowaniu: ul kosztuje {HIVE_BUY_COST} zł, pszczoła {BEE_COST} zł.</p>
        </div>
      )}
    {/* Tooltip stodoły (zablokowanej do lvl 3) podążający za kursorem */}
      {hoveredBarnLock && isOnFarmMap && !!profile && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}
        >
          <p className="mb-2 font-black text-amber-300">Stodoła — zablokowana</p>
          <p className="mb-1">Wymaga: <span className="font-bold text-amber-300">{BARN_UNLOCK_LVL} poziom gracza</span></p>
          <p className="mt-2 text-[16px] text-[#8b6a3e]">Po odblokowaniu: pierwsze zwierzę to Kura (600 zł).</p>
        </div>
      )}
    {/* Tooltip sadu (zablokowanego do lvl 10) podążający za kursorem */}
      {hoveredSadLock && isOnFarmMap && !!profile && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}
        >
          <p className="mb-2 font-black text-amber-300">Sad — zablokowany</p>
          <p className="mb-1">Wymaga: <span className="font-bold text-amber-300">{SAD_UNLOCK_LVL} poziom gracza</span></p>
          <p className="mt-2 text-[16px] text-[#8b6a3e]">Drzewa kupisz w Sklepie → Drzewa.</p>
        </div>
      )}
    {/* Tooltip Stodoła (odblokowana) */}
      {hoveredStodola && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-amber-300">Stodoła</p>
          <p className="mb-1 text-[18px]">Hoduj zwierzęta i zbieraj ich produkty.</p>
          <p className="text-[16px] text-[#8b6a3e]">Kury, świnie, krowy i inne — każde zwierzę daje inne surowce.</p>
        </div>
      )}
    {/* Tooltip Ul (odblokowany) */}
      {hoveredUl && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-amber-300">Ul</p>
          <p className="mb-1 text-[18px]">Hoduj pszczoły i produkuj miód.</p>
          <p className="text-[16px] text-[#8b6a3e]">Miód sprzedasz klientom przy Ladzie lub w Targu w mieście.</p>
        </div>
      )}
    {/* Tooltip Sad (odblokowany) */}
      {hoveredSad && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-amber-300">Sad</p>
          <p className="mb-1 text-[18px]">Uprawiaj drzewa owocowe i zbieraj owoce.</p>
          <p className="text-[16px] text-[#8b6a3e]">Drzewa kupisz w Sklepie — jabłonie, grusze, śliwy i inne.</p>
        </div>
      )}
    {/* Tooltip Lada dla klientów */}
      {hoveredLada && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-amber-300">Lada dla klientów</p>
          <p className="mb-1 text-[18px]">Obsługuj klientów i sprzedawaj miód.</p>
          <p className="text-[16px] text-[#8b6a3e]">Klienci przychodzą regularnie — odpowiadaj na zamówienia i sprzedawaj im swoje produkty.</p>
        </div>
      )}
    {/* Tooltip Dom */}
      {hoveredDom && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-amber-300">Dom gracza</p>
          <p className="mb-1 text-[18px]">Twój profil, statystyki i ekwipunek.</p>
          <p className="text-[16px] text-[#8b6a3e]">Znajdziesz tu poziom, EXP, PLN oraz zarządzanie postacią.</p>
        </div>
      )}
    {/* Tooltip Kompostownik */}
      {hoveredKompostownik && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-green-600 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-green-400">Kompostownik</p>
          <p className="mb-1 text-[18px]">Przetwarzaj odpadki w kompost.</p>
          <p className="mb-1 text-[16px] text-[#8b6a3e]">Kompost przyspiesza wzrost upraw i zwiększa plony na polu.</p>
          <p className="text-[16px] text-green-600">Każde użycie daje % szansę na losowy przedmiot specjalny.</p>
        </div>
      )}
    {/* Tooltip Pola uprawne */}
      {hoveredPolaUprawne && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-lime-600 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-lime-400">Pola uprawne</p>
          <p className="text-[18px]">Sadź, podlewaj i zbieraj plony.</p>
        </div>
      )}
    {/* Tooltip Do miasta */}
      {hoveredDoMiasta && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-sky-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-sky-300">Do miasta</p>
          <p className="mb-1 text-[18px]">Przejdź do centrum Plonopolis.</p>
          <p className="text-[16px] text-[#8b6a3e]">W mieście znajdziesz Sklep, Targ, Bank i Ratusz.</p>
        </div>
      )}
    {/* Tooltips — Miasto */}
      {hoveredNaFarme && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-lime-600 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-lime-400">Na farmę</p>
          <p className="mb-1 text-[18px]">Wróć do swojej farmy.</p>
          <p className="text-[16px] text-[#8b6a3e]">Siej, podlewaj i zbieraj plony na polach uprawnych.</p>
        </div>
      )}
      {hoveredSklep && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-amber-300">Sklep</p>
          <p className="mb-1 text-[18px]">Kup nasiona, drzewa i zwierzęta.</p>
          <p className="text-[16px] text-[#8b6a3e]">Szeroki asortyment nasion każdej jakości, sadzonki drzew owocowych i ekwipunek.</p>
        </div>
      )}
      {hoveredTarg && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-orange-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-orange-300">Targ</p>
          <p className="mb-1 text-[18px]">Sprzedaj swoje plony i owoce.</p>
          <p className="text-[16px] text-[#8b6a3e]">Ceny na targu zmieniają się dynamicznie — sprawdzaj regularnie, by sprzedawać drożej.</p>
        </div>
      )}
      {hoveredBank && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-yellow-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-yellow-300">Bank</p>
          <p className="mb-1 text-[18px]">Zarządzaj swoimi finansami.</p>
          <p className="text-[16px] text-[#8b6a3e]">Lokaty i pożyczki — pomnażaj oszczędności lub finansuj rozwój farmy.</p>
        </div>
      )}
      {hoveredRatusz && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-purple-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-purple-300">Ratusz</p>
          <p className="mb-1 text-[18px]">Rankingi i osiągnięcia graczy.</p>
          <p className="text-[16px] text-[#8b6a3e]">Sprawdź tablicę wyników i porównaj swoje postępy z innymi farmerami Plonopolis.</p>
        </div>
      )}
      {hoveredLiga && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-green-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}>
          <p className="mb-2 font-black text-green-300">Liga Farmerów</p>
          <p className="mb-1 text-[18px]">Rywalizuj z innymi farmerami.</p>
          <p className="text-[16px] text-[#8b6a3e]">Sezony, nagrody i rankingi ligowe — pokaż, że jesteś najlepszym farmerem w Plonopolis.</p>
        </div>
      )}
    {/* Tooltip konewki podążający za kursorem */}
      {hoveredWateringCan && (
        <div
          className="pointer-events-none fixed z-[10000] w-72 rounded-[18px] border border-cyan-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: Math.min(mousePos.x + 18, BASE_W - 300), top: Math.max(8, mousePos.y - 220) }}
        >
          <p className="mb-1 font-black text-cyan-300">Konewka</p>
          <p className="mb-2 text-[18px] text-[#8b6a3e]">Skraca czas wzrostu — min 5% zawsze, rośnie z Zaradnością i ekwipunkiem (addytywnie, bez limitu)</p>
          <p>Skraca czas wzrostu o <span className="font-bold text-cyan-300">{(() => {
            const _zb = calcStatEffect(effectiveStats.zaradnosc, ZARADNOSC_RATE) / 100;
            const _we = (getEquipBonusPct("% efekt podlewania", charEquipped) + getEquipBonusPct("% efekt wody", charEquipped)) / 100;
            return ((WATER_BASE + _zb + _we) * 100).toFixed(1);
          })()}%</span> (twoja Zaradność: {effectiveStats.zaradnosc}/100{effectiveStats.zaradnosc !== playerStats.zaradnosc ? `, w tym +${effectiveStats.zaradnosc - playerStats.zaradnosc} z avatara` : ""})</p>
          <p className="mt-1">Roślinę można podlać <span className="font-bold text-yellow-300">max 1 raz</span></p>
        </div>
      )}
    {/* Tooltip uprawy podążający za kursorem */}
      {hoveredCrop && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-[#8b6a3e] bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
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
            {hoveredSeedQuality === "legendary" ? "Legendarne nasiono — zawsze daje zwykłe + epickie plony i duży bonus EXP!" : hoveredSeedQuality === "epic" ? `Epickie nasiono — każda z ${hoveredCrop.yieldAmount <= 2 ? "10–22" : "14–30"} sztuk losuje jakość osobno + EXP ×3–6` : hoveredSeedQuality === "rotten" ? "Zepsute — nie można zasadzić, nadaje się jedynie jako kompost lub do zadań specjalnych." : "Zwykłe nasiono"}
          </p>
          {hoveredSeedQuality !== "rotten" && <>
            {(() => {
              const _baseMs = hoveredCrop.growthTimeMs;
              // Te same wzory co w getEffectiveGrowthTimeMs (bez bonusów per-pole: woda/kompost)
              const _wiedzaEff   = (effectiveStats.wiedza ?? 0) + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
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
              const _zaradnosc   = effectiveStats.zaradnosc ?? 0;
              const _zaradBonus  = calcStatEffect(_zaradnosc, ZARADNOSC_RATE);
              const _waterEqPct  = getEquipBonusPct("% efekt podlewania", charEquipped) + getEquipBonusPct("% efekt wody", charEquipped);
              const _waterTotalPct = (WATER_BASE * 100) + _zaradBonus + _waterEqPct; // addytywny
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
                <p className="font-black text-amber-300">🌟 Zawsze wszystkie nagrody:</p>
                <p>✅ {hoveredCrop.yieldAmount <= 2 ? "20–60" : "30–80"} zwykłych nasion</p>
                <p>⭐ {hoveredCrop.yieldAmount <= 2 ? "5–12" : "8–18"} epickich nasion</p>
                <p>📚 EXP ×{hoveredCrop.yieldAmount <= 2 ? "10–20" : "12–25"}</p>
              </div>
            ) : hoveredSeedQuality === "epic" ? (
              <div className="mt-1 space-y-0.5 rounded-lg bg-[rgba(34,197,94,0.08)] p-2 text-[13px]">
                <p className="font-black text-green-300">🎲 Każda sztuka losuje jakość osobno</p>
                <p>🌾 {hoveredCrop.yieldAmount <= 2 ? "10–22 szt." : "14–30 szt."} • ⭐ EXP ×3–6</p>
              </div>
            ) : (
              <p className="mt-1">🌾 Zbiór: {`${hoveredCrop.yieldAmount <= 2 ? "1–3" : "2–5"} szt.`}</p>
            )}
            {hoveredSeedQuality !== "legendary" && hoveredSeedQuality !== "epic" && (
              <p className="mt-1">⭐ EXP: +{hoveredCrop.expReward}</p>
            )}
          </>}
        </div>
      )}

      {/* ─── TARG GRACZY: przycisk wejścia — usunięty, otwiera się bezpośrednio ─── */}

      {/* ─── TARG GRACZY: modal ──────────────────────────────────────────────── */}
      {showMarketModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[#8b6a3e] shadow-2xl mx-2"
            style={{ background: `url('/mapy/targ_tlo.png') center/cover no-repeat, rgba(18,10,5,0.98)` }}>
            {/* Nagłówek */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#8b6a3e] bg-[linear-gradient(180deg,rgba(110,73,35,0.97),rgba(76,48,23,0.97))] px-6 py-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#f0d48a] font-bold">Miasto</p>
                <h2 className="text-3xl font-black text-[#f9e7b2]">Targ Graczy</h2>
              </div>
              <button type="button" onClick={() => setShowMarketModal(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#8b6a3e] text-[#f9e7b2] hover:bg-[rgba(80,50,20,0.5)] transition font-black text-2xl">X</button>
            </div>
            {/* Zakładki */}
            <div className="flex shrink-0 gap-1 border-b border-[#8b6a3e]/60 bg-black/60 px-4 pt-3 pb-0">
              {([
                { id: "browse" as const,    label: "Przeglądaj" },
                { id: "my_offers" as const, label: "Moje Oferty" },
                { id: "returns" as const,   label: `Do Odbioru${pendingReturnCount > 0 ? ` (${pendingReturnCount})` : ""}` },
              ]).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMarketTab(t.id)}
                  className={`rounded-t-xl px-5 py-2.5 text-base font-bold transition ${marketTab === t.id ? "bg-[#8b6a3e] text-[#f9e7b2]" : "text-[#f0d48a] hover:bg-white/10"} ${t.id === "returns" && pendingReturnCount > 0 ? "!text-[#fbbf24]" : ""}`}
                >
                  {t.label}
                </button>
              ))}
              <button type="button" onClick={() => void loadMarketData()} disabled={marketLoading} className="ml-auto mb-1 rounded-xl border border-[#8b6a3e]/70 bg-black/30 px-4 py-1.5 text-sm font-bold text-[#f0d48a] hover:bg-white/10 transition disabled:opacity-40">
                {marketLoading ? "Wczytuję..." : "Odswież"}
              </button>
            </div>

            {/* Treść */}
            <div className="flex-1 overflow-y-auto p-4 bg-[rgba(12,7,3,0.80)]">

              {/* ── PRZEGLĄDAJ ── */}
              {marketTab === "browse" && (() => {
                const playerLvl = profile?.level ?? 1;
                const getOfferUnlockLevel = (o: MarketOffer): number => getItemUnlockLevel(o.item_type, o.item_key);
                const tierGroup = (lvl: number): string => {
                  if (lvl <= 5)  return "1";
                  if (lvl <= 10) return "2";
                  if (lvl <= 15) return "3";
                  if (lvl <= 20) return "4";
                  return "5";
                };
                const filteredMarketBrowse = marketBrowse.filter(o => {
                  if (marketSearch.trim()) {
                    const q = marketSearch.trim().toLowerCase();
                    if (!o.item_name.toLowerCase().includes(q)) return false;
                  }
                  if (marketQualityFilter !== "all") {
                    if (o.item_type === "crop") {
                      const { quality } = parseQualityKey(o.item_key);
                      if (quality !== marketQualityFilter) return false;
                    } else if (o.item_type === "fruit") {
                      const lastU = o.item_key.lastIndexOf("_");
                      const q = lastU >= 0 ? o.item_key.slice(lastU + 1) : "";
                      if (q !== marketQualityFilter) return false;
                    } else if (o.item_type === "compost") {
                      const ct = compostTypeFromKey(o.item_key);
                      if (ct !== marketQualityFilter) return false;
                    }
                  }
                  if (marketTierFilter !== "all") {
                    const ul = getOfferUnlockLevel(o);
                    if (tierGroup(ul) !== marketTierFilter) return false;
                  }
                  if (getOfferUnlockLevel(o) > playerLvl) return false;
                  return true;
                }).sort((a, b) => {
                  switch (marketSort) {
                    case "price_asc":  return a.price_per_unit - b.price_per_unit;
                    case "price_desc": return b.price_per_unit - a.price_per_unit;
                    case "qty_desc":   return b.quantity - a.quantity;
                    case "expires_asc": return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
                    case "newest":     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    case "unit_asc":   return a.price_per_unit - b.price_per_unit;
                    default:           return 0;
                  }
                });
                return (
                <div>
                  {/* Kategorie */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {([
                      { id: "crop" as const,       label: "Uprawy" },
                      { id: "compost" as const,    label: "Kompost" },
                      { id: "barn_item" as const,  label: "Zwierzeta" },
                      { id: "fruit" as const,      label: "Owoce" },
                      { id: "honey" as const,      label: "Miod" },
                      { id: "equipment" as const,  label: "Ekwipunek" },
                    ]).map(f => (
                      <button key={f.id} type="button"
                        onClick={() => { setMarketSearch(""); setMarketQualityFilter("all"); setMarketTierFilter("all"); setMarketMyLevelOnly(false); void handleMarketBrowseFilter(f.id); }}
                        className={`rounded-xl px-4 py-1.5 text-sm font-bold transition ${marketBrowseFilter === f.id ? "bg-[#8b6a3e] text-[#f9e7b2]" : "border border-[#c9a96e]/70 bg-black/40 text-[#f0d48a] hover:bg-black/60"}`}
                      >{f.label}</button>
                    ))}
                  </div>

                  {/* Wyszukiwarka */}
                  <div className="mb-3 relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b6a3e] text-base">🔍</span>
                    <input
                      type="text"
                      value={marketSearch}
                      onChange={e => setMarketSearch(e.target.value)}
                      placeholder="Szukaj przedmiotu..."
                      className="w-full rounded-xl border border-[#8b6a3e]/70 bg-black/50 pl-9 pr-4 py-2.5 text-sm text-[#f3e6c8] placeholder-[#8b6a3e] outline-none focus:border-[#d8ba7a]/60"
                    />
                  </div>

                  {/* Filtry jakości (kontekstowe) + sortowanie */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {(() => {
                      const qualOpts: { id: string; label: string }[] | null =
                        marketBrowseFilter === "crop" ? [
                          { id:"all",       label:"Wszystkie" },
                          { id:"rotten",    label:"⚪ Popsute" },
                          { id:"good",      label:"🟢 Zwykłe" },
                          { id:"epic",      label:"🟣 Epickie" },
                          { id:"legendary", label:"👑 Legen." },
                        ] : marketBrowseFilter === "fruit" ? [
                          { id:"all",      label:"Wszystkie" },
                          { id:"zgnile",   label:"🍂 Zgniłe" },
                          { id:"zwykle",   label:"🍎 Zwykłe" },
                          { id:"soczyste", label:"💧 Soczyste" },
                          { id:"zlote",    label:"✨ Złote" },
                        ] : marketBrowseFilter === "compost" ? [
                          { id:"all",    label:"Wszystkie" },
                          { id:"growth", label:"⚡ Wzrostu" },
                          { id:"yield",  label:"🌾 Urodzaju" },
                          { id:"exp",    label:"⭐ Nauki" },
                        ] : null;
                      return qualOpts ? (
                        <>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">Jakość:</span>
                          {qualOpts.map(q => (
                            <button key={q.id} type="button"
                              onClick={() => setMarketQualityFilter(q.id)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${marketQualityFilter === q.id ? "bg-[#8b6a3e] text-[#f9e7b2]" : "border border-[#c9a96e]/50 bg-black/40 text-[#f0d48a] hover:bg-black/60"}`}
                            >{q.label}</button>
                          ))}
                        </>
                      ) : null;
                    })()}
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">Sortuj:</span>
                      <select
                        value={marketSort}
                        onChange={e => setMarketSort(e.target.value as typeof marketSort)}
                        className="rounded-lg border border-[#8b6a3e]/70 bg-[rgba(17,10,6,0.85)] px-2 py-1.5 text-xs font-bold text-[#f0d48a] outline-none cursor-pointer"
                      >
                        <option value="newest">Najnowsze</option>
                        <option value="price_asc">Cena rosnaco</option>
                        <option value="price_desc">Cena malejaco</option>
                        <option value="qty_desc">Ilosc</option>
                        <option value="expires_asc">Czas konca</option>
                        <option value="unit_asc">Najtansze/szt.</option>
                      </select>
                    </div>
                  </div>

                  {/* Filtr tierów + mój poziom */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">Poziom:</span>
                    {([
                      { id: "all" as const, label: "Wszystkie" },
                      { id: "1" as const,   label: "Lv 1–5" },
                      { id: "2" as const,   label: "Lv 6–10" },
                      { id: "3" as const,   label: "Lv 11–15" },
                      { id: "4" as const,   label: "Lv 16–20" },
                      { id: "5" as const,   label: "Lv 21–25" },
                    ]).map(t => (
                      <button key={t.id} type="button"
                        onClick={() => setMarketTierFilter(t.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${marketTierFilter === t.id ? "bg-[#8b6a3e] text-[#f9e7b2]" : "border border-[#c9a96e]/50 bg-black/40 text-[#f0d48a] hover:bg-black/60"}`}
                      >{t.label}</button>
                    ))}
                  </div>

                  {marketLoading && <p className="py-10 text-center text-base font-bold text-[#f0d48a]">Wczytuję oferty...</p>}
                  {!marketLoading && filteredMarketBrowse.length === 0 && (
                    <div className="rounded-2xl border border-[#8b6a3e]/60 bg-black/60 p-10 text-center text-base font-bold text-[#f0d48a]">
                      {marketBrowse.length === 0 ? "Brak aktywnych ofert w tej kategorii." : "Brak ofert pasujacych do filtrow."}
                    </div>
                  )}
                  {!marketLoading && filteredMarketBrowse.length > 0 && (
                    <div className="space-y-2">
                      {filteredMarketBrowse.map(offer => {
                        const isOwn = offer.seller_id === profile?.id;
                        const timeLeft = Math.max(0, new Date(offer.expires_at).getTime() - Date.now());
                        const hoursLeft = Math.floor(timeLeft / 3600000);
                        const minsLeft  = Math.floor((timeLeft % 3600000) / 60000);
                        const buyQty = Math.min(buyQtyMap[offer.id] ?? 1, offer.quantity);
                        const buyTotal = offer.price_per_unit * buyQty;
                        return (
                          <div key={offer.id} className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/60 bg-black/65 px-4 py-3">
                            <span className="text-2xl shrink-0">{offer.item_icon || "📦"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-bold text-[#f9e7b2] truncate">{offer.item_name}</p>
                              <p className="text-sm font-medium text-[#f0d48a]">{offer.quantity} szt. &middot; {offer.price_per_unit.toLocaleString("pl-PL")} zł/szt.</p>
                              <p className="text-sm text-[#c9a96e]">{offer.seller_name ?? "Nieznany"} &middot; wygasa za {hoursLeft > 0 ? `${hoursLeft}h ` : ""}{minsLeft}min</p>
                            </div>
                            {isOwn ? (
                              <span className="rounded-lg border border-[#c9a96e]/60 bg-black/40 px-3 py-1 text-sm font-bold text-[#c9a96e] shrink-0">Twoja</span>
                            ) : (
                              <div className="flex shrink-0 items-center gap-1.5">
                                {/* Stepper ilości */}
                                {offer.quantity > 1 && (
                                  <div className="flex items-center rounded-xl border border-[#8b6a3e]/60 bg-black/40 overflow-hidden">
                                    <button type="button"
                                      onClick={() => setBuyQtyMap(prev => ({ ...prev, [offer.id]: Math.max(1, (prev[offer.id] ?? 1) - 1) }))}
                                      className="px-2 py-1.5 text-base font-black text-[#f0d48a] hover:bg-white/10 transition disabled:opacity-40"
                                      disabled={buyQty <= 1}
                                    >−</button>
                                    <input
                                      type="number" min={1} max={offer.quantity}
                                      value={buyQty}
                                      onChange={e => setBuyQtyMap(prev => ({ ...prev, [offer.id]: Math.min(offer.quantity, Math.max(1, parseInt(e.target.value) || 1)) }))}
                                      className="w-12 bg-transparent text-center text-sm font-bold text-[#f9e7b2] outline-none"
                                    />
                                    <button type="button"
                                      onClick={() => setBuyQtyMap(prev => ({ ...prev, [offer.id]: Math.min(offer.quantity, (prev[offer.id] ?? 1) + 1) }))}
                                      className="px-2 py-1.5 text-base font-black text-[#f0d48a] hover:bg-white/10 transition disabled:opacity-40"
                                      disabled={buyQty >= offer.quantity}
                                    >+</button>
                                  </div>
                                )}
                                <div className="flex flex-col items-end gap-0.5">
                                  <button type="button" disabled={buyingOfferId === offer.id}
                                    onClick={() => void handleBuyOffer(offer.id, buyQty)}
                                    className="rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-2 text-sm font-black text-[#2f1b0c] shadow hover:brightness-110 transition disabled:opacity-50"
                                  >{buyingOfferId === offer.id ? "..." : "Kup"}</button>
                                  <p className="text-xs font-bold text-[#ffe082]">{buyTotal.toLocaleString("pl-PL")} zł</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })()}

              {/* ── MOJE OFERTY ── */}
              {marketTab === "my_offers" && (() => {
                const activeOffers  = myMarketOffers.filter(o => o.status === "active");
                const historyOffers = myMarketOffers.filter(o => o.status !== "active");
                const lvl = profile?.level ?? 1;
                const maxOffers = lvl >= 25 ? 10 : lvl >= 20 ? 8 : lvl >= 10 ? 5 : 3;
                // Anti-boost: limity
                const getActiveValLimit = (l: number): number | null => {
                  if (l >= 25) return null;
                  if (l >= 20) return 500000; if (l >= 15) return 150000;
                  if (l >= 10) return 50000;  if (l >= 7)  return 10000;
                  if (l >= 5)  return 5000;   if (l >= 3)  return 2500;
                  return 1000;
                };
                const getDailyLimit = (l: number): number | null => {
                  if (l >= 25) return null;
                  if (l >= 20) return 750000; if (l >= 15) return 300000;
                  if (l >= 10) return 100000; if (l >= 7)  return 25000;
                  if (l >= 5)  return 10000;  if (l >= 3)  return 5000;
                  return 2000;
                };
                const activeValLimit = getActiveValLimit(lvl);
                const dailyLimit     = getDailyLimit(lvl);
                const activeVal      = activeOffers.reduce((s, o) => s + o.quantity * o.price_per_unit, 0);
                // Dzienny zarobek — z profilu (SQL resetuje przy tworzeniu oferty o północy Warsaw)
                const todayPl = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" })).toISOString().slice(0, 10);
                const earnedDateOk = profile?.market_earned_date === todayPl;
                const earnedToday  = earnedDateOk ? (profile?.market_earned_today ?? 0) : 0;
                const dailyBlocked = dailyLimit !== null && earnedToday >= dailyLimit;
                const canAddOffer  = activeOffers.length < maxOffers && !dailyBlocked;
                const fmtK = (n: number) => n >= 1000 ? `${(n/1000).toLocaleString("pl-PL", {maximumFractionDigits:0})}k` : n.toLocaleString("pl-PL");
                return (
                  <div>
                    {/* ── MMO HUD: karty limitów ── */}
                    {(() => {
                      const slotPct   = Math.min(100, (activeOffers.length / maxOffers) * 100);
                      const valPct    = activeValLimit ? Math.min(100, (activeVal / activeValLimit) * 100) : 0;
                      const earnPct   = dailyLimit     ? Math.min(100, (earnedToday / dailyLimit) * 100)   : 0;
                      const slotCrit  = slotPct  >= 92;
                      const valCrit   = valPct   >= 92;
                      const earnCrit  = earnPct  >= 92;
                      const fmtFull   = (n: number) => n.toLocaleString("pl-PL");
                      // Czas do resetu o polnocy Warsaw
                      const nowWaw    = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
                      const midnight  = new Date(nowWaw); midnight.setHours(24, 0, 0, 0);
                      const secsLeft  = Math.max(0, Math.floor((midnight.getTime() - nowWaw.getTime()) / 1000));
                      const hh        = String(Math.floor(secsLeft / 3600)).padStart(2, "0");
                      const mm        = String(Math.floor((secsLeft % 3600) / 60)).padStart(2, "0");
                      const ss        = String(secsLeft % 60).padStart(2, "0");
                      const resetIn   = `${hh}:${mm}:${ss}`;
                      type CardProps = { label: string; cur: string; max: string; pct: number; barColor: string; crit: boolean; tooltip?: string };
                      const Card = ({ label, cur, max, pct, barColor, crit, tooltip }: CardProps) => (
                        <div
                          title={tooltip}
                          className={`relative flex-1 min-w-[120px] rounded-2xl border bg-black/40 p-3 overflow-hidden transition-all duration-300 ${crit ? "border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.4)]" : "border-[#8b6a3e]/50"}`}
                          style={crit ? { animation: "mkt-pulse 1.6s ease-in-out infinite" } : undefined}
                        >
                          <div className="mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#c9a96e]">{label}</span>
                          </div>
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className={`text-lg font-black leading-none ${crit ? "text-red-400" : "text-[#f9e7b2]"}`}>{cur}</span>
                            <span className="text-xs text-[#8b6a3e] font-medium">/ {max}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: crit ? "linear-gradient(90deg,#ef4444,#f97316)" : barColor,
                              }}
                            />
                          </div>
                          {crit && (
                            <div className="mt-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wide">Bliski limitu</div>
                          )}
                        </div>
                      );
                      return (
                        <>
                          <style>{`@keyframes mkt-pulse{0%,100%{box-shadow:0 0 12px rgba(239,68,68,.4)}50%{box-shadow:0 0 22px rgba(239,68,68,.75)}}`}</style>
                          <div className="mb-1 flex gap-2">
                            <Card
                              label="Oferty"
                              cur={String(activeOffers.length)} max={String(maxOffers)}
                              pct={slotPct} crit={slotCrit}
                              barColor="linear-gradient(90deg,#f2ca69,#c9952f)"
                              tooltip="Liczba aktywnych ofert na targu"
                            />
                            <Card
                              label="Wartość ofert"
                              cur={fmtFull(Math.round(activeVal))}
                              max={activeValLimit ? fmtFull(activeValLimit) + " zł" : "∞"}
                              pct={valPct} crit={valCrit}
                              barColor="linear-gradient(90deg,#f59e0b,#d97706)"
                              tooltip={activeValLimit ? `Łączna wartość aktywnych ofert. Limit dla poziomu ${lvl}: ${fmtFull(activeValLimit)} zł` : "Brak limitu wartości na Twoim poziomie"}
                            />
                            <Card
                              label="Zarobek dziś"
                              cur={fmtFull(Math.round(earnedToday))}
                              max={dailyLimit ? fmtFull(dailyLimit) + " zł" : "∞"}
                              pct={earnPct} crit={earnCrit}
                              barColor="linear-gradient(90deg,#22c55e,#16a34a)"
                              tooltip="Zarobek z targu resetuje się codziennie o 00:00 czasu polskiego"
                            />
                          </div>
                          {/* Reset countdown */}
                          <div className="mb-3 flex items-center justify-end gap-2">
                            <span className="text-xs uppercase tracking-widest text-[#8b6a3e] font-semibold">Reset limitu za</span>
                            <span className="rounded-md bg-black/40 border border-[#8b6a3e]/40 px-3 py-1 font-mono text-sm font-bold text-[#f0d48a] tabular-nums">{resetIn}</span>
                          </div>
                          {/* Przycisk Dodaj ofertę */}
                          <div className="mb-4 flex items-center justify-between">
                            <p className="text-xs text-[#8b6a3e]">Poziom {lvl}</p>
                            <button type="button"
                              disabled={!canAddOffer}
                              onClick={() => { setMarketPickerSearch(""); setMarketPickerFilter("crop"); setMarketPickerOpen(true); }}
                              className="rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >+ Dodaj ofertę</button>
                          </div>
                          {dailyBlocked && (
                            <div className="mb-3 rounded-xl border border-red-500/50 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
                              Osiagnales dzienny limit zarobku z targu ({fmtK(dailyLimit!)} zł). Mozesz wystawiac nowe oferty po polnocy czasu polskiego.
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* ── Panel konfiguracji oferty (po wybraniu itemu z pickera) ── */}
                    {createOfferOpen && coItemKey && (() => {
                      const sellable     = buildSellableItems();
                      const selectedItem = sellable.find(i => i.key === coItemKey && i.type === coItemType);
                      const maxQty       = selectedItem?.qty ?? 1;
                      const minP         = marketMinPrice(coItemType, coItemKey, coItemType === "equipment" ? getItemUpg(coItemKey) : undefined);
                      const total        = Math.round(coQty * coPrice * 100) / 100;
                      const tax          = Math.round(total * 0.1 * 100) / 100;
                      const extFee       = coDuration === 48 ? Math.round(total * 0.03 * 100) / 100 : coDuration === 72 ? Math.round(total * 0.07 * 100) / 100 : 0;
                      const sellerGets   = Math.round((total - tax - extFee) * 100) / 100;
                      return (
                        <div className="mb-4 rounded-2xl border border-[#d8ba7a]/40 bg-[rgba(255,255,255,0.03)] p-5 space-y-4">
                          {/* Nagłówek */}
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-black text-[#d8ba7a]">Nowa oferta</p>
                            <div className="flex items-center gap-2">
                              <button type="button"
                                onClick={() => { setMarketPickerOpen(true); }}
                                className="rounded-lg border border-[#8b6a3e]/60 bg-black/20 px-3 py-1.5 text-sm font-bold text-[#dfcfab] hover:bg-white/5 transition"
                              >Zmień przedmiot</button>
                              <button type="button"
                                onClick={() => { setCreateOfferOpen(false); setCoItemKey(""); }}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#8b6a3e]/60 text-[#dfcfab] hover:text-red-300 font-bold transition"
                              >✕</button>
                            </div>
                          </div>
                          {/* Wybrany przedmiot */}
                          <div className="flex items-center gap-4 rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-4 py-3">
                            {selectedItem?.imgPath ? (
                              <img src={selectedItem.imgPath} alt={selectedItem.name} className="h-16 w-16 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                            ) : (
                              <span className="text-5xl shrink-0">{selectedItem?.icon || "📦"}</span>
                            )}
                            <div>
                              <p className="text-base font-bold text-[#f3e6c8]">{selectedItem?.name ?? coItemKey}</p>
                              <p className="text-sm text-[#dfcfab]">Posiadasz: <span className="font-bold text-[#f9e7b2]">{maxQty} szt.</span></p>
                              <p className="text-sm text-[#8b6a3e]">Min. cena: {minP.toLocaleString("pl-PL")} zł/szt.</p>
                            </div>
                          </div>
                          {/* Ilość + cena */}
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="mb-1.5 block text-sm font-bold uppercase tracking-wider text-[#dfcfab]">Ilość (max {maxQty})</label>
                              <input type="number" min={1} max={maxQty} value={coQty}
                                onChange={e => setCoQty(Math.min(maxQty, Math.max(1, parseInt(e.target.value)||1)))}
                                className="w-full rounded-xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.8)] px-3 py-2.5 text-base text-[#f3e6c8] outline-none focus:border-[#d8ba7a]/60"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="mb-1.5 block text-sm font-bold uppercase tracking-wider text-[#dfcfab]">Cena/szt. (min 1 zł)</label>
                              <input type="text" inputMode="decimal" value={coPriceStr}
                                onChange={e => {
                                  const raw = e.target.value.replace(",", ".");
                                  setCoPriceStr(e.target.value);
                                  const parsed = parseFloat(raw);
                                  if (!isNaN(parsed)) setCoPrice(Math.round(parsed * 100) / 100);
                                }}
                                onBlur={() => {
                                  const val = Math.max(1, isNaN(coPrice) ? 1 : coPrice);
                                  setCoPrice(val);
                                  setCoPriceStr(String(val));
                                }}
                                className="w-full rounded-xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.8)] px-3 py-2.5 text-base text-[#f3e6c8] outline-none focus:border-[#d8ba7a]/60"
                              />
                            </div>
                          </div>
                          {/* Czas trwania */}
                          <div>
                            <label className="mb-1.5 block text-sm font-bold uppercase tracking-wider text-[#dfcfab]">Czas trwania</label>
                            <div className="flex gap-2">
                              {([24, 48, 72] as const).map(d => {
                                const dFee = d === 48 ? Math.round(total * 0.03 * 100) / 100 : d === 72 ? Math.round(total * 0.07 * 100) / 100 : 0;
                                const label = d === 24 ? "24h (darmowe)" : d === 48 ? `48h (+${dFee > 0 ? dFee.toLocaleString("pl-PL") : "3%"} zł)` : `72h (+${dFee > 0 ? dFee.toLocaleString("pl-PL") : "7%"} zł)`;
                                return (
                                  <button key={d} type="button" onClick={() => setCoDuration(d)}
                                    className={`flex-1 rounded-xl border py-2.5 text-base font-bold transition ${coDuration === d ? "border-[#f4cf78] bg-[rgba(242,202,105,0.15)] text-[#f9e7b2]" : "border-[#8b6a3e]/40 text-[#dfcfab] hover:bg-white/5"}`}
                                  >{label}</button>
                                );
                              })}
                            </div>
                          </div>
                          {/* Podsumowanie */}
                          <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-4 space-y-1.5">
                            <p className="text-sm text-[#dfcfab]">Łączna cena: <span className="text-base font-bold text-[#f9e7b2]">{total.toLocaleString("pl-PL")} zł</span></p>
                            <p className="text-sm text-[#dfcfab]">Podatek rynku (10%): <span className="font-bold text-[#fca5a5]">-{tax.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</span></p>
                            {extFee > 0 && <p className="text-sm text-[#dfcfab]">Opłata za 48h (5%): <span className="font-bold text-[#fca5a5]">-{extFee.toLocaleString("pl-PL")} zł</span></p>}
                            <div className="mt-1 border-t border-[#8b6a3e]/30 pt-1.5">
                              <p className="text-sm text-[#dfcfab]">Otrzymasz po sprzedaży: <span className="text-lg font-black text-[#86efac]">{sellerGets.toLocaleString("pl-PL")} zł</span></p>
                            </div>
                          </div>
                          {/* Przycisk */}
                          <button type="button"
                            disabled={coLoading || !coItemKey || coQty <= 0 || coPrice < minP}
                            onClick={() => void handleCreateOffer()}
                            className="w-full rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] py-3.5 text-lg font-black text-[#2f1b0c] hover:brightness-110 transition disabled:opacity-50"
                          >{coLoading ? "Wystawianie..." : "Wystaw ofertę"}</button>
                        </div>
                      );
                    })()}

                    {/* Lista aktywnych ofert */}
                    {activeOffers.length === 0 && !createOfferOpen && (
                      <div className="rounded-2xl border border-[#8b6a3e]/60 bg-black/60 p-8 text-center text-base font-bold text-[#f0d48a]">Nie masz aktywnych ofert.</div>
                    )}
                    {activeOffers.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="text-sm font-bold uppercase tracking-wider text-[#c9a96e] mb-1">Aktywne</p>
                        {activeOffers.map(offer => {
                          const timeLeft = Math.max(0, new Date(offer.expires_at).getTime() - Date.now());
                          const hoursLeft = Math.floor(timeLeft / 3600000);
                          const minsLeft  = Math.floor((timeLeft % 3600000) / 60000);
                          return (
                            <div key={offer.id} className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/60 bg-black/65 px-4 py-3">
                              <span className="text-xl shrink-0">{offer.item_icon || "📦"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-bold text-[#f9e7b2] truncate">{offer.item_name}</p>
                                <p className="text-sm font-medium text-[#f0d48a]">{offer.quantity} szt. &middot; {offer.price_per_unit.toLocaleString("pl-PL")} zł/szt.</p>
                                <p className="text-sm text-[#c9a96e]">wygasa za {hoursLeft > 0 ? `${hoursLeft}h ` : ""}{minsLeft}min</p>
                              </div>
                              <button type="button" disabled={cancellingOfferId === offer.id}
                                onClick={() => void handleCancelOffer(offer.id)}
                                className="shrink-0 rounded-xl border border-[#c9a96e]/70 bg-black/40 px-3 py-2 text-sm font-bold text-[#f0d48a] hover:bg-[rgba(80,50,20,0.5)] transition disabled:opacity-50"
                              >{cancellingOfferId === offer.id ? "..." : "Anuluj"}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Historia */}
                    {historyOffers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-bold uppercase tracking-wider text-[#c9a96e] mb-1">Historia</p>
                        {historyOffers.slice(0, 20).map(offer => {
                          const statusColor = offer.status === "sold" ? "#86efac" : offer.status === "expired" ? "#fca5a5" : "#d8ba7a";
                          const statusLabel = offer.status === "sold" ? "Sprzedano" : offer.status === "expired" ? "Wygasła" : "Anulowano";
                          return (
                            <div key={offer.id} className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/40 bg-black/55 px-4 py-2">
                              <span className="text-lg shrink-0">{offer.item_icon || "📦"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-medium text-[#f0d48a] truncate">{offer.item_name}</p>
                                <p className="text-sm text-[#c9a96e]">{offer.quantity} szt. &middot; {offer.price_per_unit.toLocaleString("pl-PL")} zł/szt.</p>
                              </div>
                              <span className="text-sm font-bold shrink-0" style={{ color: statusColor }}>{statusLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── DO ODBIORU ── */}
              {marketTab === "returns" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-base font-medium text-[#f0d48a]">Czeka na odbiór: <span className="font-bold text-[#f9e7b2]">{marketReturns.length}</span></p>
                    {marketReturns.length > 0 && (
                      <button type="button" disabled={claimingReturns}
                        onClick={() => void handleClaimAllReturns()}
                        className="rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-2 text-sm font-black text-[#2f1b0c] hover:brightness-110 transition disabled:opacity-50"
                      >{claimingReturns ? "Odbieram..." : "Odbierz wszystko"}</button>
                    )}
                  </div>
                  {marketReturns.length === 0 && (
                    <div className="rounded-2xl border border-[#8b6a3e]/60 bg-black/60 p-10 text-center text-base font-bold text-[#f0d48a]">
                      Nic tu nie czeka. Sprzedaj coś na targu albo anuluj ofertę.
                    </div>
                  )}
                  {marketReturns.length > 0 && (
                    <div className="space-y-2">
                      {marketReturns.map(ret => {
                        const reasonLabel = ret.reason === "sold" ? "Sprzedano" : ret.reason === "expired" ? "Wygasła" : "Anulowano";
                        const reasonColor = ret.reason === "sold" ? "#86efac" : ret.reason === "expired" ? "#fca5a5" : "#d8ba7a";
                        return (
                          <div key={ret.id} className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/60 bg-black/65 px-4 py-3">
                            <span className="text-2xl shrink-0">{ret.return_type === "gold" ? "💰" : (ret.item_icon || "📦")}</span>
                            <div className="flex-1">
                              {ret.return_type === "gold" ? (
                                <>
                                  <p className="text-base font-bold text-[#f9e7b2]">+{(ret.gold_amount ?? 0).toLocaleString("pl-PL")} zł</p>
                                  <p className="text-sm font-medium" style={{ color: reasonColor }}>{reasonLabel}</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-base font-bold text-[#f9e7b2]">{ret.item_name ?? ret.item_key} x{ret.quantity}</p>
                                  <p className="text-sm font-medium" style={{ color: reasonColor }}>{reasonLabel}</p>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ─── PICKER ITEMÓW TARGU — overlay ponad modalem ─────────────────── */}
      {marketPickerOpen && (() => {
        const sellable = buildSellableItems();
        const filtered = sellable.filter(i => i.type === marketPickerFilter).filter(i => {
          if (!marketPickerSearch.trim()) return true;
          return i.name.toLowerCase().includes(marketPickerSearch.trim().toLowerCase());
        });
        const PICKER_FILTERS: { id: MarketItemType; label: string; icon: string }[] = [
          { id: "crop",      label: "Uprawy",     icon: "🌱" },
          { id: "fruit",     label: "Owoce",      icon: "🍎" },
          { id: "barn_item", label: "Stodoła",    icon: "🐔" },
          { id: "compost",   label: "Kompost",    icon: "🌿" },
          { id: "honey",     label: "Miód",       icon: "🍯" },
          { id: "equipment", label: "Ekwipunek",  icon: "⚔️" },
        ];
        const CROP_QUALITY_GROUPS = [
          { label: "Zepsute",    quality: "rotten",    color: "#6b7280" },
          { label: "Zwykłe",     quality: "good",      color: "#f3e6c8" },
          { label: "Epickie",    quality: "epic",      color: "#a855f7" },
          { label: "Legendarne", quality: "legendary", color: "#f59e0b" },
        ];
        const FRUIT_QUALITY_GROUPS = [
          { label: "Zgnite",    quality: "zgnile",   color: "#6b7280" },
          { label: "Zwykłe",    quality: "zwykly",   color: "#f3e6c8" },
          { label: "Soczyste",  quality: "soczysty", color: "#22c55e" },
          { label: "Złote",     quality: "zloty",    color: "#f59e0b" },
        ];
        const EQ_SLOT_GROUPS = [
          { label: "Głowa",  slot: "glowa",  icon: "👑" },
          { label: "Dłonie", slot: "dlonie", icon: "🧤" },
          { label: "Nogi",   slot: "nogi",   icon: "👢" },
        ];
        function renderPickerTile(item: typeof filtered[0]) {
          return (
            <button
              key={`${item.type}::${item.key}`}
              type="button"
              onClick={() => {
                setCoItemType(item.type);
                setCoItemKey(item.key);
                setCoQty(1);
                setCoPrice(item.minPrice);
                setCoPriceStr(String(item.minPrice));
                setCoDuration(24);
                setMarketPickerOpen(false);
                setCreateOfferOpen(true);
              }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[#8b6a3e]/50 bg-[rgba(255,255,255,0.03)] p-3 text-center transition hover:border-[#f4cf78]/60 hover:bg-[rgba(242,202,105,0.09)] active:scale-95"
            >
              {item.imgPath ? (
                <img src={item.imgPath} alt={item.name} className="h-14 w-14 object-contain" style={{ imageRendering: "pixelated" }} />
              ) : (
                <span className="text-5xl leading-none">{item.icon || "📦"}</span>
              )}
              <p className="text-sm font-bold leading-tight text-[#f3e6c8] line-clamp-2">{item.name}</p>
              <p className="text-xs text-[#dfcfab]">Posiadasz: <span className="font-bold text-[#f9e7b2]">{item.qty}</span></p>
              <p className="text-xs text-[#8b6a3e]">Min: {item.minPrice.toLocaleString("pl-PL")} zł</p>
            </button>
          );
        }
        return (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
           <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#8b6a3e] bg-[rgba(8,4,2,0.98)] shadow-2xl" style={{ height: "90vh" }}>
            {/* Nagłówek z wyszukiwarką */}
            <div className="shrink-0 flex items-center gap-3 border-b border-[#8b6a3e]/60 bg-[rgba(18,10,5,0.98)] px-4 py-3">
              <button
                type="button"
                onClick={() => setMarketPickerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8b6a3e]/60 text-xl font-bold text-[#dfcfab] hover:bg-white/5 transition"
              >←</button>
              <div className="flex-1 relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b6a3e] text-lg">🔍</span>
                <input
                  autoFocus
                  type="text"
                  placeholder="Szukaj przedmiotu..."
                  value={marketPickerSearch}
                  onChange={e => setMarketPickerSearch(e.target.value)}
                  className="w-full rounded-xl border border-[#8b6a3e]/60 bg-black/40 pl-10 pr-4 py-2.5 text-base text-[#f3e6c8] placeholder:text-[#8b6a3e]/70 outline-none focus:border-[#d8ba7a]/70"
                />
              </div>
              <button
                type="button"
                onClick={() => setMarketPickerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8b6a3e]/60 font-bold text-[#dfcfab] hover:text-red-300 transition"
              >✕</button>
            </div>

            {/* Filtry */}
            <div className="shrink-0 flex gap-1.5 overflow-x-auto border-b border-[#8b6a3e]/30 bg-black/20 px-4 py-2.5 scrollbar-hide">
              {PICKER_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMarketPickerFilter(f.id)}
                  className={`shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
                    marketPickerFilter === f.id
                      ? "border-[#f4cf78] bg-[rgba(242,202,105,0.18)] text-[#f9e7b2]"
                      : "border-[#8b6a3e]/40 text-[#dfcfab] hover:bg-white/5 hover:border-[#8b6a3e]/70"
                  }`}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>

            {/* Grid itemów */}
            <div className="flex-1 overflow-y-auto p-4">
              {filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-[#8b6a3e]">
                  <span className="text-6xl">📦</span>
                  <p className="text-xl font-bold text-[#dfcfab]">Brak przedmiotów</p>
                  <p className="text-base">Zmień filtr lub zbierz więcej surowców.</p>
                </div>
              ) : marketPickerFilter === "crop" ? (
                <div className="space-y-5">
                  {CROP_QUALITY_GROUPS.map(group => {
                    const groupItems = filtered.filter(i => parseQualityKey(i.key).quality === group.quality);
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group.quality}>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.label}</p>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                          {groupItems.map(item => renderPickerTile(item))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : marketPickerFilter === "fruit" ? (
                <div className="space-y-5">
                  {FRUIT_QUALITY_GROUPS.map(group => {
                    const groupItems = filtered.filter(i => i.key.endsWith(`_${group.quality}`));
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group.quality}>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.label}</p>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                          {groupItems.map(item => renderPickerTile(item))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : marketPickerFilter === "equipment" ? (
                <div className="space-y-5">
                  {EQ_SLOT_GROUPS.map(group => {
                    const groupItems = filtered.filter(i => {
                      const eItem = CHAR_EQUIP_ITEMS.find(e => e.id === i.key);
                      return eItem?.slot === group.slot;
                    });
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group.slot}>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#f4cf78]">{group.icon} {group.label}</p>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                          {groupItems.map(item => renderPickerTile(item))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {filtered.map(item => renderPickerTile(item))}
                </div>
              )}
            </div>
           </div>
          </div>
        );
      })()}

        </main>
    </div>
  );
}  