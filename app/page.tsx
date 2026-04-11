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

type PlotCropState = {
  cropId: string | null;
  plantedAt: number | null;
  watered: boolean;
  plantedQuality?: string | null;
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
const FARM_UPGRADE_LEVELS = [5, 10, 15, 20] as const;
const FARM_MUSIC_MAPS = ["farm1","farm5","farm10","farm15","farm20"];
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
  if (r < 0.20) return "rotten";
  if (r < 0.96) return "good";
  return "epic";
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
  { path: "/avatar_epic1.png", name: "Złoty Rolnik",   cost: { "carrot_good": 500 } },
  { path: "/avatar_epic2.png", name: "Zielona Moc",    cost: { "carrot_epic": 20 } },
  { path: "/avatar_epic3.png", name: "Plon Bogów",     cost: { "carrot_legendary": 1 } },
  { path: "/avatar_epic4.png", name: "Władca Pól",     cost: { "potato_epic": 5, "carrot_epic": 5 } },
  { path: "/avatar_epic5.png", name: "Legenda Farmy",  cost: { "potato_legendary": 1 } },
];
const EPIC_SKIN_START = 20; // indeksy 20–24
const ALL_SKINS = [...SKINS_MALE, ...SKINS_FEMALE, ...EPIC_SKINS.map(s => s.path)];

const STATS_DEFS = [
  { key: "wiedza",    label: "Wiedza",    icon: "📚", desc: "Rośliny rosną szybciej",         rate: 0.005  },
  { key: "zrecznosc", label: "Zręczność", icon: "🎯", desc: "Szansa na podwójny zbiór",       rate: 0.004  },
  { key: "zaradnosc", label: "Zaradność", icon: "💧", desc: "Woda daje większy bonus",        rate: 0.008  },
  { key: "sadownik",  label: "Sadownik",  icon: "🌳", desc: "Większy zysk z drzew",           rate: 0.005  },
  { key: "opieka",    label: "Opieka",    icon: "🐄", desc: "Większy zysk ze zwierząt",       rate: 0.005  },
  { key: "szczescie", label: "Szczęście", icon: "🍀", desc: "Szansa na bonusowy drop",         rate: 0.0025 },
] as const;
type StatKey = typeof STATS_DEFS[number]["key"];
type PlayerStatsMap = Record<StatKey, number>;
const DEFAULT_STATS: PlayerStatsMap = { wiedza:0, zrecznosc:0, zaradnosc:0, sadownik:0, opieka:0, szczescie:0 };

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
    parsedEntries.push([
      plotId,
      {
        cropId: typeof item?.cropId === "string" ? item.cropId : null,
        plantedAt: typeof item?.plantedAt === "number" ? item.plantedAt : null,
        watered: Boolean(item?.watered),
        plantedQuality: typeof item?.plantedQuality === "string" ? item.plantedQuality : null,
      },
    ] as const);
  }

  return Object.fromEntries(parsedEntries);
}

function serializePlotCrops(value: Record<number, PlotCropState>) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, plot]) => Boolean(plot?.cropId))
      .map(([plotId, plot]) => [
        plotId,
        {
          cropId: plot.cropId,
          plantedAt: plot.plantedAt,
          watered: Boolean(plot.watered),
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
    const { baseCropId, quality } = parseQualityKey(seedId);
    if (!CROPS.some((crop) => crop.id === baseCropId)) continue;
    const safeAmount = Math.floor(Number(amount));
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) continue;
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
  const [showGildiaPanel, setShowGildiaPanel] = useState(false);
  const [showMisjePanel, setShowMisjePanel] = useState(false);
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  const [messageTab, setMessageTab] = useState<"systemowe"|"otrzymane"|"wyslane">("systemowe");
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
  const [showTestModal, setShowTestModal] = React.useState(false);
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [showShopModal, setShowShopModal] = React.useState(false);
  const [shopTab, setShopTab] = React.useState<"nasiona"|"zwierzeta"|"drzewa">("nasiona");
  const [shopCart, setShopCart] = React.useState<Record<string,number>>({});
  const [shopError, setShopError] = React.useState("");
  const [domTab, setDomTab] = React.useState<"profil"|"eq">("profil");
    const [backpackTab, setBackpackTab] = React.useState<"uprawy"|"przedmioty">("uprawy");
    const [backpackSort, setBackpackSort] = React.useState<"standardowe"|"duzo"|"malo">("standardowe");
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

    const wiedzaBonus = calcStatEffect(playerStats.wiedza, 0.005) / 100;
    const wiedzaMult = Math.max(0.5, 1 - wiedzaBonus);
    if (plot.watered) {
      return Math.round(crop.growthTimeMs * 0.85 * wiedzaMult);
    }

    return Math.round(crop.growthTimeMs * wiedzaMult);
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

    setMessage({
      type: "success",
      title: "Podlano pole",
      text: `${crop.name} będzie rosła o 15% szybciej.`,
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

    setMessage({
      type: "success",
      title: "Posadzono uprawę",
      text: `Posadzono ${crop.name.toLowerCase()} na polu #${plotId}.`,
    });
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

  // ─── Farm music ───
  useEffect(() => {
    const isFarmMap = (FARM_MUSIC_MAPS as string[]).indexOf(currentMap) !== -1;
    if (!isFarmMap) {
      if (farmAudioRef.current) {
        farmAudioRef.current.pause();
        farmAudioRef.current.currentTime = 0;
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
    farmAudioRef.current.play().catch(() => {});
    return () => {};
  }, [currentMap, musicVolume, musicMuted]);

  // ─── City music ───
  useEffect(() => {
    const isCityMap = (CITY_MUSIC_MAPS as string[]).indexOf(currentMap) !== -1;
    if (!isCityMap) {
      if (cityAudioRef.current) {
        cityAudioRef.current.pause();
        cityAudioRef.current.currentTime = 0;
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
    cityAudioRef.current.play().catch(() => {});
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
    if (!confirm("UWAGA: Zresetuje CAŁE konto do stanu startowego. Kontynuować?")) return;
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

  async function handleHarvestPlot(plotId: number) {
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
        text: `${crop.name} będzie gotowa za około ${getRemainingGrowthSeconds(plotId)} s.`,
      });
      return;
    }

    const previousLevel = displayLevel;
    const prevXp = displayXp;
    const prevXpToNext = displayXpToNextLevel;

    const effectiveGrowMs = getEffectiveGrowthTimeMs(plotId);
    const prevInventorySnapshot: Record<string, number> = { ...seedInventory };
    const _harvestQuality = rollCropQuality(); // jakość PLONU (wpada do plecaka)
    // Jakość ZASADZONEGO nasiona (decyduje o EXP) — z localStorage
    // Jakość ZASADZONEGO nasiona (z pola w DB — bez localStorage)
    const _plantedQualityRaw = getPlotCrop(plotId).plantedQuality ?? "good";
    const _plantedQuality = (["good","epic","rotten","legendary"].includes(_plantedQualityRaw) ? _plantedQualityRaw : "good") as "good"|"epic"|"rotten"|"legendary";
    const _plantedQDef = CROP_QUALITY_DEFS[_plantedQuality as keyof typeof CROP_QUALITY_DEFS] ?? CROP_QUALITY_DEFS["good"];
    const _qDef = CROP_QUALITY_DEFS[_harvestQuality]; // używane tylko dla plonu

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

    const { data, error } = await supabase.rpc("game_harvest_plot", {
      p_plot_id: plotId,
      p_effective_grow_ms: effectiveGrowMs,
      p_zrecznosc: playerStats.zrecznosc ?? 0,
      // Dla legendarnych: zawsze "good" (uprawa bazowa), mult. EXP override osobno
      p_planted_quality: _plantedQuality === "legendary" ? "good" : _plantedQuality,
      p_exp_mult_override: _legExpMult > 0 ? _legExpMult : _epicExpMult, // 0 = jakość decyduje; >0 = dokładny mnożnik
    });
    if (error) {
      setMessage({ type: "error", title: "Błąd zbioru", text: error.message });
      return;
    }

    const harvestRpcProfile = extractRpcProfile(data);
    const rpcProf = harvestRpcProfile as Profile;
    const rpcInv = (rpcProf?.seed_inventory && typeof rpcProf.seed_inventory === "object")
      ? rpcProf.seed_inventory as Record<string, number>
      : {};
    // Plon bazowy z konfiguracji (nie z różnicy inventory — zapobiega błędom race condition)
    const _gainedBase = crop.yieldAmount;
    const _epicYield = _plantedQuality === "epic" ? (Math.floor(Math.random() * 8) + 3) : 0;
    const _epicBonus = _plantedQuality === "epic" ? Math.max(0, _epicYield - _gainedBase) : 0;
    // Zręczność bonus: SQL daje 2x plon gdy wylosuje trafienie; wykrywamy po stat > 0 i SQL > base
    const _zrecznosc = playerStats.zrecznosc ?? 0;
    const _sqlYield = Math.max(0, (rpcInv[crop.id] ?? 0) as number);
    const bonusHarvest = _zrecznosc > 0 && _sqlYield > crop.yieldAmount;
    const _bonusAmount = bonusHarvest ? crop.yieldAmount : 0;

    // Buduj inventory z kluczami jakości — na bazie snapshotu sprzed zbioru
    const nextInventory: Record<string, number> = { ...prevInventorySnapshot };
    delete nextInventory[crop.id]; // usuń klucz bazowy dodany przez SQL

    let _totalYield = 0;
    if (_plantedQuality === "legendary") {
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
      const _totalNormal = _gainedBase + _bonusAmount + _epicBonus;
      if (_totalNormal > 0) {
        const qualKey = getQualityKey(crop.id, _harvestQuality);
        nextInventory[qualKey] = (nextInventory[qualKey] ?? 0) + _totalNormal;
      }
      _totalYield = _gainedBase + _bonusAmount + _epicBonus;
    }

    // Zastosuj wynik RPC (XP, poziom, pola) — nadpisze seedInventory kluczem bazowym
    const nextProfile = applyProfileState(harvestRpcProfile);
    // Natychmiast nadpisz seedInventory wersją z kluczami jakości
    setSeedInventory(nextInventory);
    // Zapisz do DB (await — gwarantowane zachowanie jakości)
    await supabase.from("profiles").update({ seed_inventory: nextInventory }).eq("id", profile!.id);

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
      setHarvestLog(prev => [
        ...prev.filter(e => Date.now() - e.timestamp < 25000),
        {
          id: ++harvestEventIdRef.current,
          cropId: crop.id,
          cropName: crop.name,
          baseAmount: _gainedBase + _epicBonus,
          bonusAmount: _bonusAmount,
          bonusSource: bonusHarvest ? "Zręczność 🎯" : null,
          baseExp: actualExp,
          timestamp: Date.now(),
          quality: _harvestQuality,
        },
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
        className="relative overflow-hidden"
        style={{
          aspectRatio: "3 / 2",
          width: "min(100vw, calc(100vh * 1.5))",
          height: "min(100vh, calc(100vw / 1.5))",
        }}
      >
        <img
          src={profile ? `/${backgroundMap}.png` : "/assetsmain-lobby.png"}
          alt="Mapa gry"
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          draggable={false}
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
              <style>{`@keyframes arrowBlink{0%,100%{opacity:0;transform:translateX(-6px)}50%{opacity:1;transform:translateX(0)}}`}</style>
              <div className="fixed right-4 z-[92] flex items-center gap-2" style={{ top: "85px" }}>
                <span className="text-3xl font-black text-orange-400 select-none" style={{animation:"arrowBlink 1.1s ease-in-out infinite",display:"inline-block"}}>➤</span>
                <button onClick={() => setShowTestModal(true)}
                  className="relative flex items-center gap-2 rounded-2xl border border-orange-500/70 bg-[rgba(38,14,4,0.92)] px-6 py-3 font-black text-orange-300 shadow-2xl backdrop-blur-sm transition hover:border-orange-400 hover:text-orange-200">
                  <span className="animate-pulse text-2xl">🧪</span>
                  <span className="text-base">Testy</span>
                  <span className="absolute -right-1 -top-1 flex h-3 w-3 rounded-full bg-orange-500 animate-ping" />
                </button>
              </div>

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
      left: "46%",
      top: "65%",
      width: "38%",
      height: "22%",
      zIndex: 4,
    }}
    title="Pola uprawne"
  >
    <span className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl whitespace-nowrap">
      Pola uprawne
    </span>
  </button>
)}

                  {currentMap.startsWith("farm") && (
                      <>
                        {/* Dom — na drzwiach domu */}
                        <button
                          type="button"
                          onClick={() => { setShowDomModal(true); setDomTab("profil"); }}
                          title="Dom gracza"
                          className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                          style={{ left: "25%", top: "21%", width: "9%", height: "20%", zIndex: 20 }}
                        >
                          <span className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl whitespace-nowrap">
                            Dom
                          </span>
                        </button>
                      {/* Do miasta */}
                      <button
                        type="button"
                        onClick={() => handleChangeMap("city")}
                        title="Do miasta"
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left: "15%", top: "56.5%", width: "12%", height: "16%", zIndex: 20 }}
                      >
                        <span className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl whitespace-nowrap">
                          Do miasta
                        </span>
                      </button>
                    </>
                  )}

                  {currentMap === "city" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleChangeMap(getMapForLevel(profile?.level))}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left: "14%", top: "60%", width: "14%", height: "22%" }}
                        title="Na farmę"
                      >
                        <span className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl">
                          Na farmę
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShopTab("nasiona"); setShowShopModal(true); }}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left: "12%", top: "20%", width: "16%", height: "38%" }}
                        title="Sklep"
                      >
                        <span className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl">
                          Sklep
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleChangeMap("city_market")}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left: "38%", top: "22%", width: "16%", height: "34%" }}
                        title="Targ"
                      >
                        <span className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl">
                          Targ
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleChangeMap("city_bank")}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left: "80%", top: "25%", width: "14%", height: "36%" }}
                        title="Bank"
                      >
                        <span className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl">
                          Bank
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleChangeMap("city_townhall")}
                        className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                        style={{ left: "62%", top: "0%", width: "22%", height: "46%" }}
                        title="Ratusz"
                      >
                        <span className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl">
                          Ratusz
                        </span>
                      </button>
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
                          : <span className="text-5xl">👤</span>}
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
                            {(["uprawy","przedmioty"] as const).map(tab => (
                              <button
                                key={tab}
                                type="button"
                                onClick={() => setBackpackTab(tab)}
                                className={`flex-1 rounded-lg py-1.5 text-xs font-bold uppercase tracking-[0.15em] transition ${backpackTab === tab ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "text-[#dfcfab] hover:bg-white/5"}`}
                              >
                                {tab === "uprawy" ? "🌾 Uprawy" : "🎒 Przedmioty"}
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
                                  {(["standardowe","duzo","malo"] as const).map(s => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => setBackpackSort(s)}
                                      className={`flex-1 rounded-lg py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition ${backpackSort === s ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "text-[#dfcfab] hover:bg-white/5"}`}
                                    >
                                      {s === "standardowe" ? "Standardowe" : s === "duzo" ? "Dużo" : "Mało"}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-3">
                                {Object.entries(seedInventory).filter(([k, amount]) => Number(amount) > 0).length === 0 ? (
                                  <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                                    Plecak jest pusty.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-4 gap-2">
                                    {(() => {
                                      const raw = (Object.entries(seedInventory).filter(
                                        ([k, amount]) => Number(amount) > 0
                                      ) as Array<[string, number]>);
                                      const sorted = [...raw].sort(([aId, aAmt], [bId, bAmt]) => {
                                        const { baseCropId: _aCrop, quality: _aQ } = parseQualityKey(aId);
                                        const { baseCropId: _bCrop, quality: _bQ } = parseQualityKey(bId);
                                        const aLv = CROPS.find(c => c.id === _aCrop)?.unlockLevel ?? 999;
                                        const bLv = CROPS.find(c => c.id === _bCrop)?.unlockLevel ?? 999;
                                        if (backpackSort === "standardowe") {
                                            const _qOrder: Record<string,number> = {rotten:0,good:1,epic:2,legendary:3};
                                            const aqo = _qOrder[_aQ ?? "good"] ?? 1;
                                            const bqo = _qOrder[_bQ ?? "good"] ?? 1;
                                            return aLv !== bLv ? aLv - bLv : aqo - bqo;
                                          }
                                        if (backpackSort === "duzo") return Number(bAmt) - Number(aAmt);
                                        if (backpackSort === "malo") { const diff = Number(aAmt) - Number(bAmt); return diff !== 0 ? diff : aLv - bLv; }
                                        // epickie: epic first (by level), then rest by level
                                        const aEpic = _aQ === "epic" ? 0 : 1;
                                        const bEpic = _bQ === "epic" ? 0 : 1;
                                        if (aEpic !== bEpic) return aEpic - bEpic;
                                        return aLv - bLv;
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
                                              : _qDef2
                                                ? { borderColor: _qDef2.borderColor, background: _qDef2.bgColor }
                                                : { borderColor: "#8b6a3e", background: "rgba(20,12,8,0.65)" }}
                                          >
                                            <img src={_qualitySprite} alt={crop.name} className="absolute inset-0 h-full w-full object-contain rounded-xl" style={{ imageRendering: "pixelated" }} />
                                            {_bQuality === "legendary" && (
                                              <span className="absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-black leading-none" style={{background:"rgba(0,0,0,0.65)",color:"#f9e7b2"}}>👑</span>
                                            )}
                                            <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">
                                              {amount}
                                            </span>
                                          </button>
                                        );
                                      });
                                    })()}
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {/* ZAKŁADKA: PRZEDMIOTY — zarezerwowana na przyszłe przedmioty */}
                          {backpackTab === "przedmioty" && (
                            <div className="mt-4 rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-4 text-center text-sm text-[#dfcfab]">
                              <p className="text-2xl mb-2">🎒</p>
                              <p>Brak przedmiotów.</p>
                              <p className="mt-1 text-xs text-[#8b6a3e]">Przedmioty specjalne pojawią się tutaj w przyszłości.</p>
                            </div>
                          )}
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
                <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-[28px] border border-[#8b6a3e] bg-[rgba(22,13,8,0.98)] shadow-2xl">

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

                  {/* Sort tabs */}
                  <div className="flex shrink-0 gap-2 border-b border-[#8b6a3e]/30 px-6 py-3">
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
                  </div>

                  {/* Table */}
                  <div className="flex-1 overflow-y-auto px-6 py-4">
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
                          }).map((p,i) => (
                            <tr key={i} className="border-b border-[#8b6a3e]/20 transition hover:bg-white/5">
                              <td className="py-3 pr-4 font-black text-[#d8ba7a]">
                                {i===0 ? "🥇" : i===1 ? "🥈" : i===2 ? "🥉" : i+1}
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={ALL_SKINS[p.user_id === profile?.id ? (avatarSkin >= 0 ? avatarSkin : 0) : ((p.avatar_skin ?? -1) >= 0 ? (p.avatar_skin ?? 0) : 0)] ?? ALL_SKINS[0]}
                                    alt={p.player_name}
                                    className="h-9 w-9 shrink-0 rounded-full object-cover border border-[#8b6a3e]/60"
                                    style={{imageRendering:"pixelated"}}
                                  />
                                  <span className="font-bold text-[#f3e6c8]">{p.player_name}</span>
                                  {p.user_id !== profile?.id && (<button type="button" onClick={() => openComposeTo(p.user_id, p.player_name)} className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-[#8b6a3e]/50 bg-black/20 text-xs transition hover:border-[#d8ba7a]/70 hover:bg-[rgba(80,50,10,0.5)]" title={`Wyślij wiadomość do ${p.player_name}`}>✉️</button>)}
                                </div>
                              </td>
                              <td className="py-3 pr-4 italic text-[#8b6a3e]">{p.guild_name}</td>
                              <td className="py-3 pr-4 text-right font-black text-[#f2ca69]">⭐ {p.level}</td>
                              <td className="py-3 pr-4 text-right text-[#a8e890]">
                                {new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN",minimumFractionDigits:0}).format(p.money)}
                              </td>
                              <td className="py-3 text-right text-[#f3e6c8]">{p.missions_completed}</td>
                            </tr>
                          ))}
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
                    <button key={tab.key} onClick={() => setMessageTab(tab.key)}
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
                    return (
                      <div className="space-y-3">
                        {filtered.map(msg => (
                          <div key={msg.id}
                            className={`rounded-2xl border p-5 transition ${!msg.read && msg.type !== "sent" ? "border-[#d8ba7a]/60 bg-[rgba(80,50,15,0.45)]" : "border-[#8b6a3e]/40 bg-black/20"}`}>

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
                                  <p className="text-xs font-bold text-[#8b6a3e]">
                                    {msg.type === "system" ? "System Plonopolis" : (msg.from_username ?? "Nieznany")}
                                  </p>
                                  <p className={`text-lg font-black ${!msg.read ? "text-[#f9e7b2]" : "text-[#dfcfab]"}`}>
                                    {msg.subject || "(bez tytułu)"}
                                  </p>
                                </div>
                              </div>
                              <p className="text-base leading-relaxed text-[#dfcfab]/90 whitespace-pre-wrap">{msg.body}</p>
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
              <div className="relative flex h-[90vh] w-full max-w-[1170px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl">
                <button onClick={() => { setShowShopModal(false); setShopCart({}); setShopError(""); }} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] hover:text-red-300">✕</button>
                {/* Sidebar — kategorie sklepu */}
                <div className="flex w-44 shrink-0 flex-col border-r border-[#8b6a3e]/30 bg-black/20">
                  <div className="flex flex-col gap-2 p-5 pt-14">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#8b6a3e]">🏪 Sklep</p>
                    {(["nasiona","zwierzeta","drzewa"] as const).map(tab => (
                      <button key={tab} onClick={() => setShopTab(tab)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                          shopTab === tab ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"
                        }`}>
                        {tab === "nasiona" ? "🌱" : tab === "zwierzeta" ? "🐄" : "🌳"}
                        {tab === "nasiona" ? "Nasiona" : tab === "zwierzeta" ? "Zwierzęta" : "Drzewa"}
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
                                <img src={crop.spritePath} alt={crop.name} className="h-10 w-10 object-contain" style={{imageRendering:"pixelated"}} />
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
                    {(shopTab === "zwierzeta" || shopTab === "drzewa") && (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <p className="text-4xl mb-4">{shopTab === "zwierzeta" ? "🐄" : "🌳"}</p>
                          <p className="text-base font-black text-[#f9e7b2]">{shopTab === "zwierzeta" ? "Zwierzęta" : "Drzewa"}</p>
                          <p className="mt-2 text-sm text-[#8b6a3e]">Dostępne wkrótce w kolejnej aktualizacji.</p>
                        </div>
                      </div>
                    )}
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
                      {(["uprawy","przedmioty"] as const).map(tab => (
                        <button key={tab} type="button" onClick={() => setBackpackTab(tab)}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-bold uppercase tracking-[0.15em] transition ${backpackTab === tab ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "text-[#dfcfab] hover:bg-white/5"}`}>
                          {tab === "uprawy" ? "🌾 Uprawy" : "🎒 Przedmioty"}
                        </button>
                      ))}
                    </div>
                    {backpackTab === "uprawy" && (
                      <div className="mt-2 flex gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1">
                        {(["standardowe","duzo","malo"] as const).map(s => (
                          <button key={s} type="button" onClick={() => setBackpackSort(s)}
                            className={`flex-1 rounded-lg py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition ${backpackSort === s ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "text-[#dfcfab] hover:bg-white/5"}`}>
                            {s === "standardowe" ? "Std" : s === "duzo" ? "Dużo" : "Mało"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    {backpackTab === "uprawy" && (
                      Object.entries(seedInventory).filter(([,amt]) => Number(amt) > 0).length === 0
                        ? <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Plecak jest pusty.</div>
                        : <div className="grid grid-cols-3 gap-2">
                            {(() => {
                              const raw = Object.entries(seedInventory).filter(([,amt]) => Number(amt) > 0) as Array<[string,number]>;
                              return [...raw].sort(([aId,aAmt],[bId,bAmt]) => {
                                const {baseCropId:_aC,quality:_aQ}=parseQualityKey(aId);
                                const {baseCropId:_bC,quality:_bQ}=parseQualityKey(bId);
                                const aLv=CROPS.find(c=>c.id===_aC)?.unlockLevel??999;
                                const bLv=CROPS.find(c=>c.id===_bC)?.unlockLevel??999;
                                if(backpackSort==="standardowe"){const qo:Record<string,number>={rotten:0,good:1,epic:2,legendary:3};return aLv!==bLv?aLv-bLv:(qo[_aQ??"good"]??1)-(qo[_bQ??"good"]??1);}
                                if(backpackSort==="duzo")return Number(bAmt)-Number(aAmt);
                                if(backpackSort==="malo"){const d=Number(aAmt)-Number(bAmt);return d!==0?d:aLv-bLv;}
                                return aLv-bLv;
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
                                    style={selectedSeedId===seedId?{borderColor:"#f6d860",background:"rgba(60,40,5,0.4)",boxShadow:"0 0 12px rgba(255,220,120,0.22)"}:_qd?{borderColor:_qd.borderColor,background:_qd.bgColor}:{borderColor:"#8b6a3e",background:"rgba(20,12,8,0.65)"}}>
                                    <img src={spr} alt={crop.name} className="absolute inset-0 h-full w-full object-contain rounded-xl" style={{imageRendering:"pixelated"}}/>
                                    {_bq==="legendary"&&<span className="absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-black leading-none" style={{background:"rgba(0,0,0,0.65)",color:"#f9e7b2"}}>👑</span>}
                                    <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{amount}</span>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                    )}
                    {backpackTab === "przedmioty" && (
                      <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-4 text-center text-sm text-[#dfcfab]">
                        <p className="text-2xl mb-2">🎒</p>
                        <p>Brak przedmiotów.</p>
                        <p className="mt-1 text-xs text-[#8b6a3e]">Przedmioty specjalne pojawią się tutaj w przyszłości.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ DOM MODAL ═══ */}
          {showDomModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="relative flex h-[92vh] w-full max-w-[1100px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl">

                {/* ─ Zamknij ─ */}
                <button onClick={() => setShowDomModal(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>

                {/* ─ Sidebar ─ */}
                <div className="flex w-44 shrink-0 flex-col gap-2 border-r border-[#8b6a3e]/30 bg-black/20 p-5 pt-14">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#8b6a3e]">🏠 Dom gracza</p>
                  {(["profil","eq"] as const).map(tab => (
                    <button key={tab} onClick={() => setDomTab(tab)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                        domTab === tab ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"
                      }`}>
                      {tab === "profil" ? "👤" : "⚔️"}
                      {tab === "profil" ? "Profil" : "Ekwipunek"}
                    </button>
                  ))}
                </div>

                {/* ─ Zawartość ─ */}
                <div className="flex-1 overflow-y-auto p-6 pt-5 text-[#dfcfab]">

                  {/* ════ PROFIL ════ */}
                  {domTab === "profil" && (
                    <div className="flex gap-6">
                      {/* Lewa kolumna: avatar */}
                      <div className="flex w-48 shrink-0 flex-col items-center gap-4">
                        <button onClick={() => { setShowDomModal(false); setShowSkinModal(true); }}
                          className="flex h-36 w-36 items-center justify-center rounded-[28px] border-2 border-[#8b6a3e] bg-[rgba(38,24,14,0.8)] shadow-xl transition hover:border-yellow-400/60 overflow-hidden">
                          {avatarSkin >= 0
                            ? <img src={ALL_SKINS[avatarSkin]} alt="Avatar" className="w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                            : <span className="text-8xl">❓</span>}
                        </button>
                        <div className="text-center">
                          <p className="font-black text-[#f9e7b2]">{profile?.login}</p>
                          <p className="text-xs text-[#8b6a3e]">Poziom {displayLevel}</p>
                          <p className="mt-1 text-xs text-[#8b6a3e]">{Number(displayMoney).toFixed(2)} 💰</p>
                        </div>
                        {freeSkillPoints > 0 && (
                          <span className="rounded-xl bg-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-300">+{freeSkillPoints} pkt do rozdania</span>
                        )}
                      </div>

                      {/* Prawa kolumna: statystyki */}
                      <div className="flex-1">
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-base font-black text-[#f9e7b2]">🧙 Statystyki gracza</p>
                          <div className="flex items-center gap-1 mr-8">
                            <span className="text-xs text-[#8b6a3e]">Dodaj:</span>
                            {([1,5,10] as const).map(n => (
                              <button key={n} onClick={() => setStatUpgradeAmount(n)}
                                className={`rounded-lg px-2 py-0.5 text-xs font-bold border transition ${
                                  statUpgradeAmount === n ? "border-yellow-400 bg-yellow-500/30 text-yellow-200" : "border-[#8b6a3e]/40 bg-black/20 text-[#8b6a3e] hover:border-yellow-600/60 hover:text-yellow-400"
                                }`}>+{n}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
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
                              <div key={def.key} className="rounded-xl border border-[#8b6a3e]/40 bg-black/20 p-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[#f9e7b2]">{def.icon} {def.label}</span>
                                  <span className="text-xs text-[#8b6a3e]">{val}/100</span>
                                </div>
                                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/40">
                                  <div className="h-full rounded-full bg-gradient-to-r from-[#8b6a3e] to-[#f9e7b2]" style={{ width: `${val}%` }} />
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-xs opacity-70">{def.desc} (+{eff.toFixed(1)}%)</span>
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
                  {domTab === "eq" && (
                    <div>
                      <p className="mb-1 text-base font-black text-[#f9e7b2]">⚔️ Ekwipunek gracza</p>
                      <p className="mb-5 text-xs text-[#8b6a3e]">Sloty na narzędzia i przedmioty. Slot 1 jest darmowy. Pozostałe wymagają odblokowania.</p>
                      <div className="grid grid-cols-7 gap-3">
                        {Array.from({ length: 7 }).map((_, i) => {
                          const slotNum = i + 1;
                          const isUnlocked = slotNum <= equipmentSlots;
                          const cost = EQ_SLOT_COSTS[i];
                          const canAfford = displayMoney >= cost;
                          const item = equipment[i] ?? null;
                          return (
                            <div key={i} className="flex flex-col items-center gap-2">
                              <button
                                disabled={!isUnlocked}
                                onClick={() => {
                                  if (!isUnlocked && slotNum === equipmentSlots + 1 && canAfford && profile?.id) {
                                    void (async () => {
                                      const { error } = await supabase.from("profiles").update({ money: displayMoney - cost }).eq("id", profile.id);
                                      if (!error) {
                                        const ns = equipmentSlots + 1;
                                        setEquipmentSlots(ns);
                                        saveHouseData(profile.id, ns, equipment);
                                        await loadProfile(profile.id);
                                      }
                                    })();
                                  }
                                }}
                                className={`relative flex h-24 w-full flex-col items-center justify-center rounded-2xl border-2 transition ${
                                  isUnlocked
                                    ? item ? "border-yellow-400/60 bg-yellow-900/10" : "border-[#8b6a3e] bg-[rgba(20,12,8,0.6)] hover:bg-[rgba(30,18,10,0.8)]"
                                    : slotNum === equipmentSlots + 1
                                      ? canAfford ? "border-green-500/60 bg-green-950/30 hover:bg-green-950/50 cursor-pointer" : "border-[#8b6a3e]/30 bg-black/20 cursor-not-allowed opacity-60"
                                      : "border-[#8b6a3e]/20 bg-black/10 cursor-not-allowed opacity-40"
                                }`}
                              >
                                {isUnlocked ? (
                                  item ? (
                                    <span className="text-3xl">{item}</span>
                                  ) : (
                                    <span className="text-2xl opacity-30">＋</span>
                                  )
                                ) : (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-xl">🔒</span>
                                    {slotNum === equipmentSlots + 1 && (
                                      <span className={`text-[10px] font-bold ${canAfford ? "text-green-300" : "text-[#8b6a3e]"}`}>
                                        {cost.toLocaleString("pl-PL")} 💰
                                      </span>
                                    )}
                                  </div>
                                )}
                              </button>
                              <span className={`text-[10px] font-bold ${isUnlocked ? "text-[#8b6a3e]" : "text-[#8b6a3e]/40"}`}>
                                Slot {slotNum}{slotNum === 1 ? " (darmowy)" : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-6 rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-4">
                        <p className="mb-2 text-xs font-black text-[#f9e7b2]">📦 Itemy gracza</p>
                        <p className="text-xs text-[#8b6a3e] opacity-70">Przedmioty zostaną dodane wkrótce. Sloty są gotowe.</p>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {showSkinModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowSkinModal(false)}>
              <div className="relative max-h-[90vh] w-full max-w-[1100px] overflow-y-auto rounded-[28px] border border-[#8b6a3e] bg-[rgba(28,16,6,0.98)] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowSkinModal(false)} className="absolute right-4 top-4 text-[#8b6a3e] text-xl hover:text-red-400">✕</button>
                <h2 className="mb-5 text-center text-lg font-black text-[#f9e7b2]">Wybierz swoją postać</h2>
                {/* Zakładki */}
                <div className="mb-6 flex gap-2 justify-center flex-wrap">
                  {(["mezczyzni","kobiety","wszystkie","epickie"] as const).map(tab => (
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
                            onDrop={(e)=>{ e.preventDefault(); if(draggedSeedId && isUnlocked){ void handlePlantFromSelectedSeed(plotId, draggedSeedId); setDraggedSeedId(null); }}}
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
                              if (!_pc.cropId) return `Pole ${plotId} (puste)`;
                              const _cropName = CROPS.find(c => c.id === _pc.cropId)?.name ?? _pc.cropId;
                              const _qLabel = _pc.plantedQuality === "legendary" ? "Legendarna" : _pc.plantedQuality === "epic" ? "Epicka" : _pc.plantedQuality === "rotten" ? "Zepsuta" : "Zwykła";
                              const _status = isCropReady(plotId) ? " — gotowa do zbioru! 🌾" : " — rośnie...";
                              return `${_cropName} (${_qLabel})${_status}`;
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

                                {getPlotCrop(plotId).watered && (
                                  <div className="absolute right-1 top-1 z-10 rounded-full bg-cyan-500/20 px-1 py-0.5 text-[18px]">
                                    💧
                                  </div>
                                )}

                                <div className="absolute inset-x-1 bottom-1 z-10 text-center">
                                  {getPlotCrop(plotId).cropId ? (
                                    <span className="rounded-md bg-black/45 px-1 py-0.5 text-[9px] font-bold text-white/90 sm:px-1.5 sm:text-[10px]">
                                      {isCropReady(plotId)
                                        ? `${getPlantedCrop(plotId)?.name ?? "Gotowe"}`
                                        : `${getPlantedCrop(plotId)?.name ?? "Uprawa"} • ${getRemainingGrowthSeconds(
                                            plotId
                                          )} s`}
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
            const grouped = harvestLog.reduce<Record<string, { cropName: string; baseAmount: number; bonusAmount: number; bonusSource: string | null; baseExp: number; quality: "rotten"|"good"|"epic"|"legendary" }>>(
              (acc, e) => {
                const _gKey = `${e.cropId}_${e.quality}`; if (!acc[_gKey]) {
                  acc[_gKey] = { cropName: e.cropName, baseAmount: 0, bonusAmount: 0, bonusSource: e.bonusSource, baseExp: 0, quality: e.quality };
                }
                acc[_gKey].baseAmount += e.baseAmount;
                acc[_gKey].bonusAmount += e.bonusAmount;
                acc[_gKey].baseExp += e.baseExp;
                if (e.bonusSource) acc[_gKey].bonusSource = e.bonusSource;
                return acc;
              }, {}
            );
            const totalExp = harvestLog.reduce((s, e) => s + e.baseExp, 0);
            const totalBonusExp = 0;
            return (
              <div className="fixed bottom-20 right-4 z-[88] w-[370px] rounded-[18px] border border-[#8b6a3e] bg-[rgba(24,14,6,0.95)] p-5 text-[16px] text-[#dfcfab] shadow-2xl backdrop-blur-sm">
                <p className="mb-2 text-[13px] font-black uppercase tracking-[0.2em] text-[#d8ba7a]">{`🌾 Ostatnie zbiory (${harvestCountdown}s)`}</p>
                <div className="space-y-2">
                  {(Object.values(grouped) as Array<{cropName:string;baseAmount:number;bonusAmount:number;bonusSource:string|null;baseExp:number;quality:"rotten"|"good"|"epic"|"legendary"}>).map((g, i) => {
                    const _qd = CROP_QUALITY_DEFS[g.quality];
                    return (
                    <div key={i} className="rounded-xl px-3 py-2" style={{background: _qd.bgColor, borderLeft: `3px solid ${_qd.borderColor}`}}>
                      <p className="font-bold text-[#f9e7b2]">
                        {g.cropName}{" "}
                        <span style={{color: _qd.borderColor}} className="text-[10px] font-black">{_qd.badge} {_qd.label}</span>
                      </p>
                      {g.baseAmount > 0 ? (
                        <p className="mt-0.5 text-[#dfcfab]">Zebrano: <span className="font-semibold" style={{color: _qd.borderColor}}>+{g.baseAmount} szt.</span>{g.bonusSource && <span className="ml-1 text-[10px] text-amber-300">({g.bonusSource})</span>}</p>
                      ) : g.quality === "legendary" ? (
                        <p className="mt-0.5 text-[#dfcfab]">🌟 <span className="font-bold text-amber-300">Bonus EXP {g.bonusSource}</span></p>
                      ) : null}
                      {g.bonusAmount > 0 && (
                        <p className="text-[#dfcfab]">Bonus ({g.bonusSource}): <span className="font-semibold text-yellow-300">+{g.bonusAmount} szt.</span></p>
                      )}
                      <p className="mt-0.5 text-[#dfcfab]">EXP: <span className="font-semibold text-sky-300">+{g.baseExp}</span></p>
                    </div>
                    );
                  })}
                </div>
                <div className="mt-3 border-t border-[#8b6a3e]/40 pt-2">
                  <p className="text-[#d8ba7a]">Łącznie EXP: <span className="font-bold text-sky-300">+{totalExp}</span>{totalBonusExp > 0 && <span className="text-yellow-300"> +{totalBonusExp} bonus</span>}</p>
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
    {/* Tooltip konewki podążający za kursorem */}
      {hoveredWateringCan && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-cyan-500 bg-[rgba(28,16,8,0.97)] p-4 text-[17px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}
        >
          <p className="mb-1 font-black text-cyan-300">💧 Konewka</p>
          <p className="mb-2 text-[14px] text-[#8b6a3e]">Narzędzie do podlewania upraw na polu</p>
          <p>⏱ Skraca czas rośnięcia o <span className="font-bold text-cyan-300">15%</span></p>
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
            <p>⏱ {(()=>{ const m=Math.round(hoveredCrop.growthTimeMs/60_000); const h=Math.floor(m/60); const r=m%60; return h>0?(r>0?`${h}h ${r} min`:`${h}h`):`${m} min`; })()}</p>
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
