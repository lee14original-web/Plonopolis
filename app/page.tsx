"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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
};

type Message = {
  type: "success" | "error" | "info";
  title: string;
  text: string;
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
};

type PlotCropState = {
  cropId: string | null;
  plantedAt: number | null;
  watered: boolean;
};

type SeedInventory = Record<string, number>;

const DEFAULT_LEVEL = 1;
const DEFAULT_XP = 0;
const DEFAULT_XP_TO_NEXT_LEVEL = 100;
const DEFAULT_MONEY = 10;
const DEFAULT_LOCATION = "Startowa Polana";
const DEFAULT_MAP = "farm1";
const MAX_LEVEL = 50;
const MAX_FIELDS = 25;
const FARM_UPGRADE_LEVELS = [5, 10, 15, 20] as const;

const CROPS: Crop[] = [
  {
    id: "carrot",
    name: "Marchew",
    unlockLevel: 1,
    growthTimeMs: 3 * 60_000,
    yieldAmount: 2,
    expReward: 2,
    spritePath: "/carrot_icon_transparent.png",
  },
  {
    id: "potato",
    name: "Ziemniak",
    unlockLevel: 2,
    growthTimeMs: 4 * 60_000,
    yieldAmount: 2,
    expReward: 2,
    spritePath: "/potato.png",
  },
  {
    id: "tomato",
    name: "Pomidor",
    unlockLevel: 3,
    growthTimeMs: 5 * 60_000,
    yieldAmount: 2,
    expReward: 2,
    spritePath: "/tomato.png",
  },
  {
    id: "cucumber",
    name: "Ogórek",
    unlockLevel: 4,
    growthTimeMs: 7 * 60_000,
    yieldAmount: 2,
    expReward: 2,
    spritePath: "/cucumber.png",
  },
  {
    id: "onion",
    name: "Cebula",
    unlockLevel: 5,
    growthTimeMs: 10 * 60_000,
    yieldAmount: 2,
    expReward: 2,
    spritePath: "/onion.png",
  },
  {
    id: "garlic",
    name: "Czosnek",
    unlockLevel: 6,
    growthTimeMs: 14 * 60_000,
    yieldAmount: 2,
    expReward: 2,
    spritePath: "/garlic.png",
  },
  {
    id: "lettuce",
    name: "Sałata",
    unlockLevel: 7,
    growthTimeMs: 18 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/lettuce.png",
  },
  {
    id: "radish",
    name: "Rzodkiewka",
    unlockLevel: 8,
    growthTimeMs: 24 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/radish.png",
  },
  {
    id: "beet",
    name: "Burak",
    unlockLevel: 9,
    growthTimeMs: 32 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/beet.png",
  },
  {
    id: "pepper",
    name: "Papryka",
    unlockLevel: 10,
    growthTimeMs: 42 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/pepper.png",
  },
  {
    id: "cabbage",
    name: "Kapusta",
    unlockLevel: 11,
    growthTimeMs: 55 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/cabbage.png",
  },
  {
    id: "broccoli",
    name: "Brokuł",
    unlockLevel: 12,
    growthTimeMs: 72 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/broccoli.png",
  },
  {
    id: "cauliflower",
    name: "Kalafior",
    unlockLevel: 13,
    growthTimeMs: 95 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/cauliflower.png",
  },
  {
    id: "strawberry",
    name: "Truskawka",
    unlockLevel: 14,
    growthTimeMs: 125 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/strawberry.png",
  },
  {
    id: "raspberry",
    name: "Malina",
    unlockLevel: 15,
    growthTimeMs: 165 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/raspberry.png",
  },
  {
    id: "blueberry",
    name: "Borówka",
    unlockLevel: 16,
    growthTimeMs: 215 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/blueberry.png",
  },
  {
    id: "eggplant",
    name: "Bakłażan",
    unlockLevel: 17,
    growthTimeMs: 280 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/eggplant.png",
  },
  {
    id: "zucchini",
    name: "Cukinia",
    unlockLevel: 18,
    growthTimeMs: 360 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/zucchini.png",
  },
  {
    id: "watermelon",
    name: "Arbuz",
    unlockLevel: 19,
    growthTimeMs: 435 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/watermelon.png",
  },
  {
    id: "grape",
    name: "Winogrono",
    unlockLevel: 20,
    growthTimeMs: 500 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/grape.png",
  },
  {
    id: "pumpkin",
    name: "Dynia",
    unlockLevel: 21,
    growthTimeMs: 540 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/pumpkin.png",
  },
  {
    id: "rapeseed",
    name: "Rzepak",
    unlockLevel: 22,
    growthTimeMs: 580 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/rapeseed.png",
  },
  {
    id: "sunflower",
    name: "Słonecznik",
    unlockLevel: 23,
    growthTimeMs: 620 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/sunflower.png",
  },
  {
    id: "chili",
    name: "Papryczka chili",
    unlockLevel: 24,
    growthTimeMs: 660 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/chili.png",
  },
  {
    id: "asparagus",
    name: "Szparagi",
    unlockLevel: 25,
    growthTimeMs: 720 * 60_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/asparagus.png",
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
  1: 100,
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
  const defaults = getDefaultSeedInventory();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const parsedEntries = Object.entries(value as Record<string, unknown>)
    .map(([seedId, amount]) => {
      if (!CROPS.some((crop) => crop.id === seedId)) return null;
      const safeAmount = Number(amount);
      if (!Number.isFinite(safeAmount) || safeAmount <= 0) return null;
      return [seedId, Math.floor(safeAmount)] as const;
    })
    .filter((entry): entry is readonly [string, number] => entry !== null);

  return {
    ...defaults,
    ...Object.fromEntries(parsedEntries),
  };
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
  const [selectedTool, setSelectedTool] = useState<"watering_can" | null>(null);
  const [, setGrowthTick] = useState(0);
  const [isDesktop, setIsDesktop] = useState(true);
  const [backpackPosition, setBackpackPosition] = useState({ x: 8, y: 0 });
  const [isDraggingBackpack, setIsDraggingBackpack] = useState(false);

  function startDraggingBackpack(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingBackpack(true);
  }
  const [isBackpackOpen, setIsBackpackOpen] = useState(true);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  function isPlotUnlocked(plotId: number) {
    return unlockedPlots.includes(plotId);
  }

  function getPlotUnlockCost(plotId: number) {
    return PLOT_UNLOCK_COSTS[plotId] ?? 0;
  }


  const displayLocation = profile?.location ?? DEFAULT_LOCATION;
  const displayLevel = profile?.level ?? DEFAULT_LEVEL;
  const displayXp = profile?.xp ?? DEFAULT_XP;
  const displayXpToNextLevel = profile?.xp_to_next_level ?? DEFAULT_XP_TO_NEXT_LEVEL;
  const displayMoney = profile?.money ?? DEFAULT_MONEY;
  const currentMap = getMapForLevel(profile?.level);

  const xpPercent = useMemo(() => {
    if (!displayXpToNextLevel || displayXpToNextLevel <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((displayXp / displayXpToNextLevel) * 100)));
  }, [displayXp, displayXpToNextLevel]);

  const moneyFormatted = useMemo(() => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 0,
    }).format(displayMoney);
  }, [displayMoney]);


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
      text: "Wybierz nasiono z plecaka albo kliknij konewkę.",
    });
  }

  function getPlotCrop(plotId: number) {
    return plotCrops[plotId] ?? buildEmptyPlotCrop();
  }


  function getPlantedCrop(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId) return null;
    return CROPS.find((item) => item.id == plot.cropId) ?? null;
  }

  function getEffectiveGrowthTimeMs(plotId: number) {
    const plot = getPlotCrop(plotId);
    const crop = getPlantedCrop(plotId);
    if (!crop) return 0;

    if (plot.watered) {
      return Math.round(crop.growthTimeMs * 0.85);
    }

    return crop.growthTimeMs;
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

    const nextPlotCrops = {
      ...plotCrops,
      [plotId]: {
        ...plot,
        watered: true,
      },
    };

    const error = await persistPlotCrops(nextPlotCrops, profile.id);

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd podlewania",
        text: error.message,
      });
      return;
    }

    setPlotCrops(nextPlotCrops);

    setMessage({
      type: "success",
      title: "Podlano pole",
      text: `${crop.name} będzie rosła o 15% szybciej.`,
    });
  }


  async function handlePlantFromSelectedSeed(plotId: number) {
    if (!profile) return;

    if (!selectedSeedId) {
      setMessage({
        type: "info",
        title: "Brak nasiona",
        text: "Wybierz nasiono z plecaka.",
      });
      return;
    }

    const crop = CROPS.find((item) => item.id === selectedSeedId);
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

    const amount = seedInventory[selectedSeedId] ?? 0;
    if (amount <= 0) {
      setMessage({
        type: "info",
        title: "Brak nasion",
        text: "Nie masz już tych nasion w plecaku.",
      });
      return;
    }

    const nextPlotCrops = {
      ...plotCrops,
      [plotId]: {
        cropId: selectedSeedId,
        plantedAt: Date.now(),
        watered: false,
      },
    };

    const nextSeedInventory = {
      ...seedInventory,
      [selectedSeedId]: Math.max(0, (seedInventory[selectedSeedId] ?? 0) - 1),
    };

    const { error } = await supabase
      .from("profiles")
      .update({
        plot_crops: serializePlotCrops(nextPlotCrops),
        seed_inventory: serializeSeedInventory(nextSeedInventory),
        last_played_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd sadzenia",
        text: error.message,
      });
      return;
    }

    setSeedInventory(nextSeedInventory);
    setPlotCrops(nextPlotCrops);

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
    if (!FARM_UPGRADE_LEVELS.includes(level as (typeof FARM_UPGRADE_LEVELS)[number])) return;

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
    const defaultY = Math.max(24, Math.round((window.innerHeight - 420) / 2));
    setBackpackPosition((prev) => ({ ...prev, y: prev.y || defaultY }));
  }, []);

  useEffect(() => {
    if (!isDraggingBackpack) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextX = Math.max(8, Math.min(window.innerWidth - 230, event.clientX - dragOffset.x));
      const nextY = Math.max(8, Math.min(window.innerHeight - 520, event.clientY - dragOffset.y));
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
  }, [isDraggingBackpack, dragOffset]);

  function startBackpackDrag(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setIsDraggingBackpack(true);
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, login, email, created_at, level, xp, xp_to_next_level, money, location, current_map, last_played_at, unlocked_plots, plot_crops, seed_inventory"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd profilu",
        text: error.message,
      });
      return;
    }

    if (!data) {
      setProfile(null);
      return;
    }

    const nextProfile = {
      ...data,
      level: Math.min(data.level ?? DEFAULT_LEVEL, MAX_LEVEL),
    } as Profile;
    setProfile(nextProfile);
    setUnlockedPlots(parseUnlockedPlots(data.unlocked_plots));
    setPlotCrops(parsePlotCrops(data.plot_crops));
    setSeedInventory(parseSeedInventory(data.seed_inventory));
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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      login,
      email,
      level: DEFAULT_LEVEL,
      xp: DEFAULT_XP,
      xp_to_next_level: getXpForLevel(DEFAULT_LEVEL),
      money: DEFAULT_MONEY,
      location: DEFAULT_LOCATION,
      current_map: getMapForLevel(DEFAULT_LEVEL),
      last_played_at: new Date().toISOString(),
      unlocked_plots: getDefaultUnlockedPlots(),
      plot_crops: {},
      seed_inventory: getDefaultSeedInventory(),
    });

    if (profileError) {
      setMessage({
        type: "error",
        title: "Błąd zapisu profilu",
        text: profileError.message,
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
    setMessage({
      type: "info",
      title: "Wylogowano",
      text: "Sesja została zakończona.",
    });
  }

  async function handleSaveProgress() {
    if (!profile) return;

    const oldLevel = displayLevel;
    const nextXp = displayXp + 15;
    let nextLevel = displayLevel;
    let nextXpStored = nextXp;
    let nextXpToNextLevel = displayXpToNextLevel;
    let nextMoney = displayMoney + 25;

    if (nextXp >= displayXpToNextLevel && nextLevel < MAX_LEVEL) {
      nextLevel = Math.min(nextLevel + 1, MAX_LEVEL);
      nextXpStored = nextXp - displayXpToNextLevel;
      nextXpToNextLevel = getXpForLevel(nextLevel);
      nextMoney += 100;
    }

    if (nextLevel >= MAX_LEVEL) {
      nextLevel = MAX_LEVEL;
      nextXpStored = 0;
      nextXpToNextLevel = 0;
    }

    const nextMap = getMapForLevel(nextLevel);

    const { error } = await supabase
      .from("profiles")
      .update({
        level: nextLevel,
        xp: nextXpStored,
        xp_to_next_level: nextXpToNextLevel,
        money: nextMoney,
        location: displayLocation,
        current_map: nextMap,
        last_played_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd zapisu",
        text: error.message,
      });
      return;
    }

    await loadProfile(profile.id);

    if (nextLevel > oldLevel) {
      showFarmUpgradeModalOnce(profile.id, nextLevel);
    }

    setMessage({
      type: "success",
      title: "Postęp zapisany",
      text: "",
    });
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

    const updatedPlots = normalizeUnlockedPlots([...unlockedPlots, plotId]);
    const { error } = await supabase
      .from("profiles")
      .update({
        money: displayMoney - plotCost,
        seed_inventory: { carrot: 3 },
      unlocked_plots: updatedPlots,
        last_played_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd zakupu pola",
        text: error.message,
      });
      return;
    }

    setUnlockedPlots(updatedPlots);
    setPlotToBuy(null);
    await loadProfile(profile.id);

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
    if (!crop) return;

    if (!isCropReady(plotId)) {
      setMessage({
        type: "info",
        title: "Uprawa jeszcze rośnie",
        text: `${crop.name} będzie gotowa za około ${getRemainingGrowthSeconds(plotId)} s.`,
      });
      return;
    }

    const gainedXp = crop.expReward;
    let nextLevel = displayLevel;
    let nextXp = displayXp + gainedXp;
    let nextXpToNextLevel = displayXpToNextLevel;

    while (nextLevel < MAX_LEVEL && nextXpToNextLevel > 0 && nextXp >= nextXpToNextLevel) {
      nextXp -= nextXpToNextLevel;
      nextLevel = Math.min(nextLevel + 1, MAX_LEVEL);
      nextXpToNextLevel = getXpForLevel(nextLevel);
    }

    if (nextLevel >= MAX_LEVEL) {
      nextLevel = MAX_LEVEL;
      nextXp = 0;
      nextXpToNextLevel = 0;
    }

    const nextPlotCrops = {
      ...plotCrops,
      [plotId]: buildEmptyPlotCrop(),
    };

    const nextSeedInventory = {
      ...seedInventory,
      [crop.id]: (seedInventory[crop.id] ?? 0) + crop.yieldAmount,
    };

    const { error } = await supabase
      .from("profiles")
      .update({
        level: nextLevel,
        xp: nextXp,
        xp_to_next_level: nextXpToNextLevel,
        current_map: getMapForLevel(nextLevel),
        last_played_at: new Date().toISOString(),
        plot_crops: serializePlotCrops(nextPlotCrops),
        seed_inventory: serializeSeedInventory(nextSeedInventory),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd zbioru",
        text: error.message,
      });
      return;
    }

    setSeedInventory(nextSeedInventory);
    setPlotCrops(nextPlotCrops);

    await loadProfile(profile.id);

    setMessage({
      type: "success",
      title: "Zbiory zakończone",
      text: `Zebrano ${crop.yieldAmount} szt. ${crop.name.toLowerCase()} i +${crop.expReward} EXP.`,
    });
  }

  if (!isDesktop) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#1a130d] px-6 text-center text-[#f3e6c8]">
        <div className="max-w-md rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.95)] p-8 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">
            Plonopolis
          </p>

          <h1 className="mt-4 text-3xl font-black text-[#f9e7b2]">
            Tylko komputer 🖥️
          </h1>

          <p className="mt-4 text-sm leading-6 text-[#dfcfab]">
            Gra jest obecnie dostępna tylko na komputerze.
            <br /><br />
            Wersja mobilna pojawi się w przyszłości jako aplikacja.
          </p>

          <div className="mt-6 text-4xl animate-bounce">🌾</div>
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
    <main
      className="h-screen overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: profile
          ? `url('/${currentMap}.png')`
          : "url('/assetsmain-lobby.png')",
      }}
    >
      <div className="min-h-screen">
        {profile && (
          <>
            <div className="absolute right-4 top-4 z-20 flex gap-2">
              <button
                onClick={handleLogout}
                className="rounded-2xl border border-red-400/40 bg-red-950/40 px-4 py-2 font-bold text-red-100 backdrop-blur-sm transition hover:bg-red-950/60"
              >
                Wyloguj
              </button>
            </div>

            <div className="mx-auto flex max-w-5xl justify-center px-4 pt-2">
              <div className="z-10 w-full max-w-3xl rounded-[24px] border border-[#8b6a3e] bg-[rgba(33,20,12,0.88)] px-4 py-2 text-[#f5dfb0] shadow-2xl backdrop-blur-sm">
                <div
                  className={`grid items-center gap-3 ${
                    displayLevel >= MAX_LEVEL ? "md:grid-cols-[auto_auto] justify-center" : "md:grid-cols-[1fr_auto_auto]"
                  }`}
                >
                  {displayLevel < MAX_LEVEL && (
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">
                        <span>EXP do następnego poziomu</span>
                        <span>{xpPercent}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-black/40">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#d9b15c,#f5de8b)]"
                          style={{ width: `${xpPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-[#8b6a3e] bg-black/20 px-4 py-2 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Poziom</p>
                    <p className="text-2xl font-black text-white">{displayLevel}</p>
                    {displayLevel >= MAX_LEVEL && (
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-300">
                        MAX LEVEL
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#8b6a3e] bg-black/20 px-4 py-2 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Pieniądze</p>
                    <p className="text-2xl font-black text-white">{moneyFormatted}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
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
                        tab === "login"
                          ? "bg-[#d4a64f] text-[#2b180c]"
                          : "text-[#f1dfb5] hover:bg-white/5"
                      }`}
                    >
                      Logowanie
                    </button>
                    <button
                      onClick={() => setTab("register")}
                      className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                        tab === "register"
                          ? "bg-[#d4a64f] text-[#2b180c]"
                          : "text-[#f1dfb5] hover:bg-white/5"
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
                          onChange={(e) =>
                            setLoginForm((prev) => ({ ...prev, identifier: e.target.value }))
                          }
                          className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-3 text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">Hasło</label>
                        <input
                          type="password"
                          placeholder="Wpisz hasło"
                          value={loginForm.password}
                          onChange={(e) =>
                            setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                          }
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
                          onChange={(e) =>
                            setRegisterForm((prev) => ({ ...prev, login: e.target.value }))
                          }
                          className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-3 text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">Email</label>
                        <input
                          type="email"
                          placeholder="twoj@email.pl"
                          value={registerForm.email}
                          onChange={(e) =>
                            setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                          }
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
                            onChange={(e) =>
                              setRegisterForm((prev) => ({ ...prev, password: e.target.value }))
                            }
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
                  Po pomyślnym logowaniu wczytujemy sesję gracza. Jeśli konto jest nowe, zaczynasz z 3 darmowymi polami,
                  poziomem 1 i 10 PLN.
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
              <div className="absolute left-56 top-16 z-20">
                <div className="rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.82)] p-4 text-[#f3e6c8] shadow-2xl backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Sesja wczytana</p>
                  <h2 className="mt-2 text-2xl font-black text-[#f9e7b2]">{profile.login}</h2>
                  <p className="mt-2 text-sm text-[#dfcfab]">Mapa: {currentMap}</p>
                  <p className="mt-1 text-sm text-[#dfcfab]">Lokacja: {displayLocation}</p>
                  <p className="mt-1 text-sm text-[#dfcfab]">
                    Pola: {unlockedPlotsCount} / {MAX_FIELDS}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleSaveProgress}
                      className="rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-3 py-2 text-sm font-black text-[#2f1b0c] shadow-lg"
                    >
                      Zapisz
                    </button>

                    <button className="rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-3 py-2 text-sm font-bold text-[#f3e6c8]">
                      Graj
                    </button>
                  </div>
                </div>
              </div>


              <div
                className="fixed left-4 top-4 z-[95]"
                style={{
                  transform: `translate(${backpackPosition.x}px, ${backpackPosition.y}px)`,
                }}
              >
                <div className="flex items-start">
                  <div
                    className={`flex items-start transition-all duration-500 ease-out ${
                      isBackpackOpen
                        ? "translate-x-0 opacity-100"
                        : "-translate-x-[calc(100%-4rem)] opacity-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setIsBackpackOpen((prev) => !prev)}
                      className="mr-2 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#8b6a3e] bg-[rgba(38,24,14,0.94)] text-3xl font-black text-[#f3e6c8] shadow-2xl backdrop-blur-sm transition hover:bg-[rgba(58,34,18,0.98)]"
                      aria-label={isBackpackOpen ? "Zamknij plecak" : "Otwórz plecak"}
                      title={isBackpackOpen ? "Zamknij plecak" : "Otwórz plecak"}
                    >
                      {isBackpackOpen ? "←" : "→"}
                    </button>

                    <div
                      className={`w-[380px] max-h-[80vh] overflow-y-auto rounded-[24px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.88)] p-4 text-[#f3e6c8] shadow-2xl backdrop-blur-sm transition-all duration-500 ease-out ${
                        isBackpackOpen
                          ? "pointer-events-auto scale-100 opacity-100"
                          : "pointer-events-none scale-95 opacity-0"
                      }`}
                    >
                        <div
                          className={`mb-3 flex items-center justify-between ${isDraggingBackpack ? "cursor-grabbing" : "cursor-grab"}`}
                          onMouseDown={(event) => startDraggingBackpack(event)}
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

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTool((prev) => (prev === "watering_can" ? null : "watering_can"));
                            setSelectedSeedId(null);
                          }}
                          className={`mt-3 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                            selectedTool === "watering_can"
                              ? "border-cyan-300 bg-cyan-900/30 shadow-[0_0_24px_rgba(80,200,255,0.25)]"
                              : "border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] hover:bg-[rgba(30,18,10,0.9)]"
                          }`}
                        >
                          <img src="/watering_can_transparent.png" alt="Konewka" className="h-12 w-12 object-contain" style={{ imageRendering: "pixelated" }} />
                          <div>
                            <p className="text-sm font-black text-[#f9e7b2]">Konewka</p>
                            <p className="text-xs text-[#dfcfab]">Podlewa 1 raz, -15% czasu</p>
                          </div>
                        </button>

                        <div className="mt-4">
                          {Object.entries(seedInventory).filter(([, amount]) => amount > 0).length === 0 ? (
                            <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                              Plecak jest pusty.
                            </div>
                          ) : (
                            <div className="grid grid-cols-5 gap-2">
                              {Array.from({ length: 50 }).map((_, index) => {
                                const inventoryItems = Object.entries(seedInventory).filter(([, amount]) => amount > 0);
                                const entry = inventoryItems[index];

                                if (!entry) {
                                  return (
                                    <div
                                      key={`empty-slot-${index}`}
                                      className="h-16 w-16 rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)]"
                                    />
                                  );
                                }

                                const [seedId, amount] = entry;
                                const crop = CROPS.find((item) => item.id === seedId);
                                if (!crop) {
                                  return (
                                    <div
                                      key={`missing-slot-${index}`}
                                      className="h-16 w-16 rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)]"
                                    />
                                  );
                                }

                                return (
                                  <button
                                    key={seedId}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSeedId((prev) => (prev === seedId ? null : seedId));
                                      setSelectedTool(null);
                                    }}
                                    title={`${crop.name} (${amount})`}
                                    className={`relative flex h-16 w-16 items-center justify-center rounded-xl border transition ${
                                      selectedSeedId === seedId
                                        ? "border-yellow-300 bg-yellow-900/20 shadow-[0_0_12px_rgba(255,220,120,0.22)]"
                                        : "border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] hover:bg-[rgba(30,18,10,0.9)]"
                                    }`}
                                  >
                                    <img
                                      src={crop.spritePath}
                                      alt={crop.name}
                                      className="h-10 w-10 object-contain"
                                      style={{ imageRendering: "pixelated" }}
                                    />

                                    <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">
                                      {amount}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              <div className="absolute inset-0 z-20 pointer-events-none">
                <button
                  type="button"
                  onClick={() => {
                    setIsFieldViewOpen(true);
                    setSelectedPlotId((prev) => prev ?? 1);
                  }}
                  className="pointer-events-auto absolute flex items-center justify-center text-2xl font-black text-white transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                  style={{
                    left: "55%",
                    bottom: "240px",
                    width: "45%",
                    height: "150px",
                  }}
                >
                  <div className="relative flex h-full w-full items-center justify-center rounded-xl">
                    <div className="absolute inset-0 rounded-xl bg-yellow-400/20 blur-xl opacity-70 animate-pulse" />
                    <div className="absolute inset-0 rounded-xl transition-all duration-300 hover:bg-yellow-300/20 hover:shadow-[0_0_40px_rgba(255,220,120,0.8)]" />
                    <div className="absolute inset-0 rounded-xl border-2 border-yellow-300/60 hover:border-yellow-200" />
                    <span className="relative drop-shadow-[0_0_10px_rgba(255,220,120,0.9)]">
                      Pola uprawne
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>


        {isFieldViewOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-2 py-2">
            <div className="relative w-full max-w-[1600px] rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.96)] p-5 shadow-2xl backdrop-blur-sm">
              <button
                onClick={() => {
                  setIsFieldViewOpen(false);
                  setSelectedPlotId(null);
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
                          onClick={() => {
                            setSelectedPlotId(plotId);

                            if (!isUnlocked) {
                              return;
                            }

                            if (selectedTool === "watering_can") {
                              handleWaterPlot(plotId);
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
                          title={isUnlocked ? `Pole ${plotId}` : `Pole ${plotId} jest zablokowane`}
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

                              {getPlotCrop(plotId).cropId && (
                                <div
                                  className="absolute inset-[8%] pointer-events-none"
                                  style={{
                                    backgroundImage: "url('/carrot.png')",
                                    backgroundSize: "500% 100%",
                                    backgroundPosition: `${(getGrowthStage(plotId) - 1) * -100}% 0%`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundPositionY: "0%",
                                    imageRendering: "pixelated",
                                  }}
                                />
                              )}

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
                                      : `${getPlantedCrop(plotId)?.name ?? "Uprawa"} • ${getRemainingGrowthSeconds(plotId)} s`}
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
                                <span className="text-[11px] font-bold uppercase text-[#f5dfb0] leading-tight md:text-sm">
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
                                    : selectedSeedId
                                    ? `Kliknij pole, aby posadzić ${CROPS.find((crop) => crop.id === selectedSeedId)?.name ?? "roślinę"}`
                                    : getPlotCrop(selectedPlotId).cropId && isCropReady(selectedPlotId)
                                    ? "Enter lub kliknij pole, aby zebrać"
                                    : "Wybierz nasiono z plecaka albo konewkę"}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
                              <div className="pointer-events-auto w-full max-w-sm rounded-[24px] border border-[#c79b48] bg-[linear-gradient(180deg,rgba(66,39,17,0.98),rgba(34,20,10,0.98))] p-4 text-[#f7e7bf] shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#d8ba7a]">Zablokowane pole</p>
                                    <p className="mt-1 text-lg font-black text-[#fff1c7]">Pole #{selectedPlotId}</p>
                                    <p className="mt-1 text-sm text-[#f2ddb0]">Cena odblokowania: {selectedPlotCost} PLN</p>
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
    </main>
  );
}
