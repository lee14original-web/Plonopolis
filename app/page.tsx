"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  seed_inventory?: SeedInventory | null;
};

type Message = {
  type: "success" | "error" | "info";
  title: string;
  text: string;
};

type ToolId = "watering_can";

type MapId =
  | "farm1"
  | "farm5"
  | "farm10"
  | "farm15"
  | "farm20"
  | "city"
  | "city_shop"
  | "city_market"
  | "city_bank"
  | "city_townhall";

type MapEntrance = {
  id: string;
  label: string;
  targetMap: MapId;
  left: string;
  top: string;
  width: string;
  height: string;
  description?: string;
};

type GameMapConfig = {
  id: MapId;
  name: string;
  subtitle: string;
  background: string;
  showFarmButton?: boolean;
  entrances: MapEntrance[];
};

const DEFAULT_LEVEL = 1;
const DEFAULT_XP = 0;
const DEFAULT_XP_TO_NEXT_LEVEL = 100;
const DEFAULT_MONEY = 10;
const DEFAULT_LOCATION = "Startowa Polana";
const DEFAULT_MAP: MapId = "farm1";
const MAX_FIELDS = 25;

const CROPS: Crop[] = [
  { id: "carrot", name: "Marchew", unlockLevel: 1, growthTimeMs: 180000, yieldAmount: 2, expReward: 2, spritePath: "/carrot_icon_transparent.png" },
  { id: "potato", name: "Ziemniak", unlockLevel: 2, growthTimeMs: 240000, yieldAmount: 2, expReward: 2, spritePath: "/potato.png" },
  { id: "tomato", name: "Pomidor", unlockLevel: 3, growthTimeMs: 300000, yieldAmount: 2, expReward: 2, spritePath: "/tomato.png" },
  { id: "cucumber", name: "Ogórek", unlockLevel: 4, growthTimeMs: 420000, yieldAmount: 2, expReward: 2, spritePath: "/cucumber.png" },
  { id: "onion", name: "Cebula", unlockLevel: 5, growthTimeMs: 600000, yieldAmount: 2, expReward: 2, spritePath: "/onion.png" },
  { id: "garlic", name: "Czosnek", unlockLevel: 6, growthTimeMs: 840000, yieldAmount: 2, expReward: 2, spritePath: "/garlic.png" },
  { id: "lettuce", name: "Sałata", unlockLevel: 7, growthTimeMs: 1080000, yieldAmount: 3, expReward: 2, spritePath: "/lettuce.png" },
  { id: "radish", name: "Rzodkiewka", unlockLevel: 8, growthTimeMs: 1440000, yieldAmount: 3, expReward: 2, spritePath: "/radish.png" },
  { id: "beet", name: "Burak", unlockLevel: 9, growthTimeMs: 1920000, yieldAmount: 3, expReward: 2, spritePath: "/beet.png" },
  { id: "pepper", name: "Papryka", unlockLevel: 10, growthTimeMs: 2520000, yieldAmount: 3, expReward: 2, spritePath: "/pepper.png" },
  { id: "cabbage", name: "Kapusta", unlockLevel: 11, growthTimeMs: 3300000, yieldAmount: 3, expReward: 2, spritePath: "/cabbage.png" },
  { id: "broccoli", name: "Brokuł", unlockLevel: 12, growthTimeMs: 4320000, yieldAmount: 3, expReward: 2, spritePath: "/broccoli.png" },
  { id: "cauliflower", name: "Kalafior", unlockLevel: 13, growthTimeMs: 5700000, yieldAmount: 3, expReward: 2, spritePath: "/cauliflower.png" },
  { id: "strawberry", name: "Truskawka", unlockLevel: 14, growthTimeMs: 7500000, yieldAmount: 3, expReward: 2, spritePath: "/strawberry.png" },
  { id: "raspberry", name: "Malina", unlockLevel: 15, growthTimeMs: 9900000, yieldAmount: 3, expReward: 2, spritePath: "/raspberry.png" },
  { id: "blueberry", name: "Borówka", unlockLevel: 16, growthTimeMs: 12900000, yieldAmount: 3, expReward: 2, spritePath: "/blueberry.png" },
  { id: "eggplant", name: "Bakłażan", unlockLevel: 17, growthTimeMs: 16800000, yieldAmount: 3, expReward: 2, spritePath: "/eggplant.png" },
  { id: "zucchini", name: "Cukinia", unlockLevel: 18, growthTimeMs: 21600000, yieldAmount: 3, expReward: 2, spritePath: "/zucchini.png" },
  { id: "watermelon", name: "Arbuz", unlockLevel: 19, growthTimeMs: 26100000, yieldAmount: 3, expReward: 2, spritePath: "/watermelon.png" },
  { id: "grape", name: "Winogrono", unlockLevel: 20, growthTimeMs: 30000000, yieldAmount: 3, expReward: 2, spritePath: "/grape.png" },
  { id: "pumpkin", name: "Dynia", unlockLevel: 21, growthTimeMs: 32400000, yieldAmount: 3, expReward: 2, spritePath: "/pumpkin.png" },
  { id: "rapeseed", name: "Rzepak", unlockLevel: 22, growthTimeMs: 34800000, yieldAmount: 3, expReward: 2, spritePath: "/rapeseed.png" },
  { id: "sunflower", name: "Słonecznik", unlockLevel: 23, growthTimeMs: 37200000, yieldAmount: 3, expReward: 2, spritePath: "/sunflower.png" },
  { id: "chili", name: "Papryczka chili", unlockLevel: 24, growthTimeMs: 39600000, yieldAmount: 3, expReward: 2, spritePath: "/chili.png" },
  { id: "asparagus", name: "Szparagi", unlockLevel: 25, growthTimeMs: 43200000, yieldAmount: 3, expReward: 2, spritePath: "/asparagus.png" },
];

const PLOT_UNLOCK_COSTS: Record<number, number> = {
  4: 100, 5: 150, 6: 200, 7: 250, 8: 300,
  9: 350, 10: 400, 11: 500, 12: 600, 13: 700,
  14: 800, 15: 1000, 16: 1200, 17: 1400, 18: 1600,
  19: 1800, 20: 2000, 21: 2300, 22: 2600, 23: 3000,
  24: 3500, 25: 4000,
};

const FIELD_VIEW_PLOTS = Array.from({ length: MAX_FIELDS }, (_, index) => {
  const row = Math.floor(index / 5);
  const col = index % 5;
  return {
    id: index + 1,
    left: `${8 + col * 18}%`,
    top: `${10 + row * 16}%`,
    width: "12%",
    height: "10%",
  };
});

const MAPS: Record<MapId, GameMapConfig> = {
  farm1: {
    id: "farm1",
    name: "Farma",
    subtitle: "Startowa Polana",
    background: "/farm1.png",
    showFarmButton: true,
    entrances: [
      { id: "road-to-city", label: "Do miasta", targetMap: "city", left: "84%", top: "38%", width: "11%", height: "22%", description: "Brama prowadząca do miasta" },
    ],
  },
  farm5: {
    id: "farm5",
    name: "Farma",
    subtitle: "Rozbudowana farma",
    background: "/farm5.png",
    showFarmButton: true,
    entrances: [
      { id: "road-to-city", label: "Do miasta", targetMap: "city", left: "84%", top: "38%", width: "11%", height: "22%", description: "Brama prowadząca do miasta" },
    ],
  },
  farm10: {
    id: "farm10",
    name: "Farma",
    subtitle: "Duża farma",
    background: "/farm10.png",
    showFarmButton: true,
    entrances: [
      { id: "road-to-city", label: "Do miasta", targetMap: "city", left: "84%", top: "38%", width: "11%", height: "22%", description: "Brama prowadząca do miasta" },
    ],
  },
  farm15: {
    id: "farm15",
    name: "Farma",
    subtitle: "Nowoczesna farma",
    background: "/farm15.png",
    showFarmButton: true,
    entrances: [
      { id: "road-to-city", label: "Do miasta", targetMap: "city", left: "84%", top: "38%", width: "11%", height: "22%", description: "Brama prowadząca do miasta" },
    ],
  },
  farm20: {
    id: "farm20",
    name: "Farma",
    subtitle: "Mistrzowska farma",
    background: "/farm20.png",
    showFarmButton: true,
    entrances: [
      { id: "road-to-city", label: "Do miasta", targetMap: "city", left: "84%", top: "38%", width: "11%", height: "22%", description: "Brama prowadząca do miasta" },
    ],
  },
  city: {
    id: "city",
    name: "Miasto",
    subtitle: "Centrum Plonopolis",
    background: "/city.png",
    entrances: [
      { id: "back-to-farm", label: "Powrót na farmę", targetMap: "farm1", left: "2%", top: "44%", width: "11%", height: "20%", description: "Droga prowadząca z powrotem na farmę" },
      { id: "to-shop", label: "Sklep", targetMap: "city_shop", left: "21%", top: "28%", width: "14%", height: "26%", description: "Tu później dodasz zakup nasion" },
      { id: "to-market", label: "Targ", targetMap: "city_market", left: "40%", top: "28%", width: "14%", height: "26%", description: "Miejsce na handel plonami" },
      { id: "to-bank", label: "Bank", targetMap: "city_bank", left: "59%", top: "28%", width: "14%", height: "26%", description: "Tu później możesz dodać sejf i kredyty" },
      { id: "to-townhall", label: "Ratusz", targetMap: "city_townhall", left: "76%", top: "24%", width: "16%", height: "30%", description: "Dobre miejsce na questy i zadania" },
    ],
  },
  city_shop: {
    id: "city_shop",
    name: "Sklep",
    subtitle: "Wkrótce kupowanie nasion przez RPC",
    background: "/city_shop.png",
    entrances: [
      { id: "back-city", label: "Wyjdź do miasta", targetMap: "city", left: "4%", top: "42%", width: "12%", height: "20%", description: "Powrót do centrum miasta" },
    ],
  },
  city_market: {
    id: "city_market",
    name: "Targ",
    subtitle: "Tu później dodasz sprzedaż plonów",
    background: "/city_market.png",
    entrances: [
      { id: "back-city", label: "Wyjdź do miasta", targetMap: "city", left: "4%", top: "42%", width: "12%", height: "20%", description: "Powrót do centrum miasta" },
    ],
  },
  city_bank: {
    id: "city_bank",
    name: "Bank",
    subtitle: "Pusta lokacja do dalszej rozbudowy",
    background: "/city_bank.png",
    entrances: [
      { id: "back-city", label: "Wyjdź do miasta", targetMap: "city", left: "4%", top: "42%", width: "12%", height: "20%", description: "Powrót do centrum miasta" },
    ],
  },
  city_townhall: {
    id: "city_townhall",
    name: "Ratusz",
    subtitle: "Puste miejsce na questy i fabułę",
    background: "/city_townhall.png",
    entrances: [
      { id: "back-city", label: "Wyjdź do miasta", targetMap: "city", left: "4%", top: "42%", width: "12%", height: "20%", description: "Powrót do centrum miasta" },
    ],
  },
};

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
  return { cropId: null, plantedAt: null, watered: false };
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

function getDefaultSeedInventory(): SeedInventory {
  return {};
}

function parseSeedInventory(value: unknown): SeedInventory {
  const defaults = getDefaultSeedInventory();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;

  const parsedEntries = Object.entries(value as Record<string, unknown>)
    .map(([seedId, amount]) => {
      if (!CROPS.some((crop) => crop.id === seedId)) return null;
      const safeAmount = Number(amount);
      if (!Number.isFinite(safeAmount) || safeAmount <= 0) return null;
      return [seedId, Math.floor(safeAmount)] as const;
    })
    .filter((entry): entry is readonly [string, number] => entry !== null);

  return { ...defaults, ...Object.fromEntries(parsedEntries) };
}

function getMapForLevel(level: number | null | undefined): MapId {
  const safeLevel = level ?? DEFAULT_LEVEL;
  if (safeLevel >= 20) return "farm20";
  if (safeLevel >= 15) return "farm15";
  if (safeLevel >= 10) return "farm10";
  if (safeLevel >= 5) return "farm5";
  return DEFAULT_MAP;
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getMessageClasses(type: Message["type"]) {
  if (type === "success") return "border-emerald-500/50 bg-emerald-950/70 text-emerald-100";
  if (type === "error") return "border-red-500/50 bg-red-950/70 text-red-100";
  return "border-sky-500/50 bg-sky-950/70 text-sky-100";
}

export default function Page() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [message, setMessage] = useState<Message | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unlockedPlots, setUnlockedPlots] = useState<number[]>(getDefaultUnlockedPlots());
  const [plotCrops, setPlotCrops] = useState<Record<number, PlotCropState>>({});
  const [seedInventory, setSeedInventory] = useState<SeedInventory>(getDefaultSeedInventory());
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(1);
  const [plotToBuy, setPlotToBuy] = useState<number | null>(null);
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [isFieldViewOpen, setIsFieldViewOpen] = useState(false);
  const [, setGrowthTick] = useState(0);
  const [registerForm, setRegisterForm] = useState({ login: "", email: "", password: "", confirmPassword: "" });
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });

  const displayLevel = profile?.level ?? DEFAULT_LEVEL;
  const displayXp = profile?.xp ?? DEFAULT_XP;
  const displayXpToNextLevel = profile?.xp_to_next_level ?? DEFAULT_XP_TO_NEXT_LEVEL;
  const displayMoney = profile?.money ?? DEFAULT_MONEY;
  const mapId = (profile?.current_map as MapId | undefined) ?? getMapForLevel(profile?.level);
  const activeMap = MAPS[mapId] ?? MAPS[DEFAULT_MAP];
  const availableCrops = CROPS.filter((crop) => displayLevel >= crop.unlockLevel);
  const cropsInInventory = availableCrops.filter((crop) => (seedInventory[crop.id] ?? 0) > 0);

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

  useEffect(() => {
    const interval = window.setInterval(() => setGrowthTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const { data } = await supabase.auth.getSession();
    const sessionUser = data.session?.user ?? null;

    if (sessionUser) {
      await loadProfile();
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadProfile();
      } else {
        setProfile(null);
        setUnlockedPlots(getDefaultUnlockedPlots());
        setPlotCrops({});
        setSeedInventory(getDefaultSeedInventory());
        setSelectedSeedId(null);
        setSelectedTool(null);
      }
    });

    setReady(true);
    return () => authListener.subscription.unsubscribe();
  }

  function isEmailValid(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    return plot.watered ? Math.round(crop.growthTimeMs * 0.85) : crop.growthTimeMs;
  }

  function isCropReady(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return false;
    return Date.now() - plot.plantedAt >= getEffectiveGrowthTimeMs(plotId);
  }

  function getGrowthProgress(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return 0;
    const elapsed = Date.now() - plot.plantedAt;
    return Math.max(0, Math.min(1, elapsed / getEffectiveGrowthTimeMs(plotId)));
  }

  function getRemainingGrowthSeconds(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return 0;
    const remaining = getEffectiveGrowthTimeMs(plotId) - (Date.now() - plot.plantedAt);
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  function isPlotUnlocked(plotId: number) {
    return unlockedPlots.includes(plotId);
  }

  function applyProfileState(data: Profile | null) {
    if (!data) {
      setProfile(null);
      setUnlockedPlots(getDefaultUnlockedPlots());
      setPlotCrops({});
      setSeedInventory(getDefaultSeedInventory());
      return;
    }

    const normalizedLevel = Math.max(DEFAULT_LEVEL, Number(data.level ?? DEFAULT_LEVEL));
    const normalizedCurrentMap =
      typeof data.current_map === "string" && data.current_map in MAPS
        ? (data.current_map as MapId)
        : getMapForLevel(normalizedLevel);

    const nextProfile: Profile = {
      ...data,
      level: normalizedLevel,
      current_map: normalizedCurrentMap,
    };

    setProfile(nextProfile);
    setUnlockedPlots(parseUnlockedPlots(data.unlocked_plots));
    setPlotCrops(parsePlotCrops(data.plot_crops));
    setSeedInventory(parseSeedInventory(data.seed_inventory));
  }

  async function loadProfile() {
    const { data, error } = await supabase.rpc("game_get_my_profile");
    if (error) {
      setMessage({ type: "error", title: "Błąd profilu", text: error.message });
      return;
    }
    applyProfileState(data as Profile | null);
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const login = registerForm.login.trim();
    const email = registerForm.email.trim();
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;

    if (!login || !email || !password || !confirmPassword) {
      setMessage({ type: "error", title: "Brak danych", text: "Uzupełnij wszystkie pola rejestracji." });
      return;
    }
    if (login.length < 3) {
      setMessage({ type: "error", title: "Login za krótki", text: "Login powinien mieć minimum 3 znaki." });
      return;
    }
    if (!isEmailValid(email)) {
      setMessage({ type: "error", title: "Nieprawidłowy email", text: "Podaj poprawny adres email." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "error", title: "Hasło za krótkie", text: "Hasło powinno mieć minimum 6 znaków." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", title: "Hasła różnią się", text: "Pole hasło i powtórz hasło muszą być identyczne." });
      return;
    }

    const { data: loginConflict, error: loginConflictError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("login", login)
      .limit(1);

    if (loginConflictError) {
      setMessage({ type: "error", title: "Błąd sprawdzania loginu", text: loginConflictError.message });
      return;
    }
    if ((loginConflict?.length ?? 0) > 0) {
      setMessage({ type: "error", title: "Login zajęty", text: "Ten login już istnieje." });
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { login },
      },
    });

    if (signUpError) {
      setMessage({ type: "error", title: "Błąd rejestracji", text: signUpError.message });
      return;
    }

    setRegisterForm({ login: "", email: "", password: "", confirmPassword: "" });
    setTab("login");
    setMessage({ type: "success", title: "Konto utworzone", text: "Zarejestrowano konto. Jeśli masz potwierdzanie maila, aktywuj konto i zaloguj się." });
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const identifier = loginForm.identifier.trim();
    const password = loginForm.password;
    if (!identifier || !password) {
      setMessage({ type: "error", title: "Brak danych", text: "Podaj email i hasło." });
      return;
    }
    if (!isEmailValid(identifier)) {
      setMessage({ type: "error", title: "Nieprawidłowy email", text: "Zaloguj się adresem email." });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
    if (error) {
      setMessage({ type: "error", title: "Błędne logowanie", text: error.message });
      return;
    }

    await loadProfile();
    setLoginForm({ identifier: "", password: "" });
    setMessage({ type: "success", title: "Witaj ponownie", text: "Pomyślnie zalogowano do Plonopolis." });
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage({ type: "error", title: "Błąd wylogowania", text: error.message });
      return;
    }
    setIsFieldViewOpen(false);
    setProfile(null);
    setSelectedSeedId(null);
    setSelectedTool(null);
    setMessage({ type: "info", title: "Wylogowano", text: "Do zobaczenia na farmie." });
  }

  async function refreshFromRpc(rpcName: string, params?: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(rpcName, params);
    if (error) throw error;
    applyProfileState(data as Profile | null);
    return data as Profile | null;
  }

  async function handleChangeMap(targetMap: MapId) {
    if (!profile) return;
    const resolvedTargetMap = targetMap === "farm1" ? getMapForLevel(profile.level) : targetMap;
    try {
      await refreshFromRpc("game_change_map", { p_target_map: resolvedTargetMap });
      setMessage({ type: "info", title: "Zmiana lokacji", text: `Przeniesiono do: ${MAPS[resolvedTargetMap].name}.` });
      if (!resolvedTargetMap.startsWith("farm")) {
        setIsFieldViewOpen(false);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Nie udało się zmienić lokacji.";
      setMessage({ type: "error", title: "Błąd przejścia", text: messageText });
    }
  }

  async function handlePlantFromSelectedSeed(plotId: number) {
    if (!profile || !selectedSeedId) return;
    try {
      await refreshFromRpc("game_plant_crop", { p_plot_id: plotId, p_crop_id: selectedSeedId });
      const crop = CROPS.find((item) => item.id === selectedSeedId);
      setMessage({ type: "success", title: "Zasadzono", text: `Na polu #${plotId} zasadzono ${crop?.name?.toLowerCase() ?? "roślinę"}.` });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Nie udało się posadzić rośliny.";
      setMessage({ type: "error", title: "Błąd sadzenia", text: messageText });
    }
  }

  async function handleWaterPlot(plotId: number) {
    if (!profile) return;
    try {
      await refreshFromRpc("game_water_plot", { p_plot_id: plotId });
      setMessage({ type: "success", title: "Podlano", text: `Pole #${plotId} zostało podlane.` });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Nie udało się podlać pola.";
      setMessage({ type: "error", title: "Błąd podlewania", text: messageText });
    }
  }

  async function handleHarvestPlot(plotId: number) {
    if (!profile) return;
    try {
      const beforeCrop = getPlantedCrop(plotId);
      await refreshFromRpc("game_harvest_plot", { p_plot_id: plotId });
      setMessage({ type: "success", title: "Zbiory", text: `Zebrano ${beforeCrop?.name?.toLowerCase() ?? "plony"} z pola #${plotId}.` });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Nie udało się zebrać plonów.";
      setMessage({ type: "error", title: "Błąd zbioru", text: messageText });
    }
  }

  async function handleUnlockPlot(plotId: number) {
    if (!profile) return;
    try {
      await refreshFromRpc("game_unlock_plot", { p_plot_id: plotId });
      setPlotToBuy(null);
      setMessage({ type: "success", title: "Pole odblokowane", text: `Odblokowano pole #${plotId}.` });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Nie udało się odblokować pola.";
      setMessage({ type: "error", title: "Błąd odblokowania", text: messageText });
    }
  }

  async function handlePlotClick(plotId: number) {
    setSelectedPlotId(plotId);

    if (!isPlotUnlocked(plotId)) {
      setPlotToBuy(plotId);
      return;
    }
    if (selectedTool === "watering_can") {
      await handleWaterPlot(plotId);
      return;
    }
    if (selectedSeedId) {
      await handlePlantFromSelectedSeed(plotId);
      return;
    }
    if (getPlotCrop(plotId).cropId && isCropReady(plotId)) {
      await handleHarvestPlot(plotId);
      return;
    }

    setMessage({ type: "info", title: `Pole #${plotId}`, text: "Wybierz nasiono, konewkę albo poczekaj na gotowe plony." });
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1d140d] text-[#f5e6c8]">
        <div className="rounded-[28px] border border-[#8b6a3e] bg-[rgba(39,24,13,0.92)] px-8 py-10 text-center shadow-2xl">
          <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Plonopolis</p>
          <h1 className="mt-4 text-3xl font-black text-[#f8e4b1]">Ładowanie świata...</h1>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-cover bg-center bg-no-repeat px-4 py-10 text-[#f5e6c8]" style={{ backgroundImage: "url('/assetsmain-lobby.png')" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row">
          <section className="flex-1 rounded-[32px] border border-[#8b6a3e] bg-[rgba(34,21,12,0.9)] p-8 shadow-2xl backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.4em] text-[#d8ba7a]">Przeglądarkowa gra farmerska</p>
            <h1 className="mt-4 text-5xl font-black text-[#f9e7b2]">Plonopolis</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#e6d3ae]">
              Farma już działa na RPC, a w tej wersji dochodzi także miasto z przejściem farma–miasto oraz pustymi lokacjami do dalszej rozbudowy.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ["🌱", "Farma", "Sadzenie, podlewanie i zbiory przez RPC"],
                ["🏙️", "Miasto", "Centrum z wejściami do kolejnych budynków"],
                ["🧱", "Rozbudowa", "Sklep, bank i targ gotowe do dalszych funkcji"],
              ].map(([emoji, title, text]) => (
                <div key={title} className="rounded-[24px] border border-[#8b6a3e] bg-[rgba(52,32,19,0.72)] p-5">
                  <div className="text-3xl">{emoji}</div>
                  <h2 className="mt-3 text-xl font-bold text-[#f6e1ad]">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#dcc79d]">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="w-full max-w-md rounded-[32px] border border-[#8b6a3e] bg-[rgba(34,21,12,0.92)] p-6 shadow-2xl backdrop-blur-sm">
            <div className="mb-6 flex rounded-2xl bg-[rgba(80,53,32,0.7)] p-1">
              <button onClick={() => setTab("login")} className={`flex-1 rounded-xl px-4 py-2 font-bold transition ${tab === "login" ? "bg-[#e6c987] text-[#2f1d11]" : "text-[#f3e6c8]"}`}>Logowanie</button>
              <button onClick={() => setTab("register")} className={`flex-1 rounded-xl px-4 py-2 font-bold transition ${tab === "register" ? "bg-[#e6c987] text-[#2f1d11]" : "text-[#f3e6c8]"}`}>Rejestracja</button>
            </div>

            {message && <div className={`mb-4 rounded-2xl border px-4 py-3 ${getMessageClasses(message.type)}`}><p className="font-bold">{message.title}</p><p className="mt-1 text-sm leading-6">{message.text}</p></div>}

            {tab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#dfcfab]">Email</label>
                  <input value={loginForm.identifier} onChange={(e) => setLoginForm((prev) => ({ ...prev, identifier: e.target.value }))} className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(19,12,8,0.85)] px-4 py-3 outline-none" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#dfcfab]">Hasło</label>
                  <input type="password" value={loginForm.password} onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))} className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(19,12,8,0.85)] px-4 py-3 outline-none" />
                </div>
                <button className="w-full rounded-2xl bg-[#e6c987] px-4 py-3 font-black text-[#2f1d11] transition hover:brightness-105">Wejdź do gry</button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#dfcfab]">Login</label>
                  <input value={registerForm.login} onChange={(e) => setRegisterForm((prev) => ({ ...prev, login: e.target.value }))} className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(19,12,8,0.85)] px-4 py-3 outline-none" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#dfcfab]">Email</label>
                  <input value={registerForm.email} onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(19,12,8,0.85)] px-4 py-3 outline-none" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#dfcfab]">Hasło</label>
                  <input type="password" value={registerForm.password} onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))} className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(19,12,8,0.85)] px-4 py-3 outline-none" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#dfcfab]">Powtórz hasło</label>
                  <input type="password" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(19,12,8,0.85)] px-4 py-3 outline-none" />
                </div>
                <button className="w-full rounded-2xl bg-[#e6c987] px-4 py-3 font-black text-[#2f1d11] transition hover:brightness-105">Załóż konto</button>
              </form>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#20150e] text-[#f5e6c8]">
      <div className="relative min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('${activeMap.background}')` }}>
        <div className="absolute inset-0 bg-black/20" />

        <div className="relative z-10 flex items-start justify-between gap-4 px-4 pt-4">
          <div className="max-w-2xl rounded-[28px] border border-[#8b6a3e] bg-[rgba(33,20,12,0.88)] p-5 shadow-2xl backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Plonopolis</p>
            <h1 className="mt-2 text-3xl font-black text-[#f8e4b1]">{activeMap.name}</h1>
            <p className="mt-1 text-sm text-[#ddc79d]">{activeMap.subtitle}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-[rgba(67,43,26,0.8)] p-3"><p className="text-xs uppercase tracking-[0.2em] text-[#d6b26f]">Gracz</p><p className="mt-1 font-bold">{profile.login}</p></div>
              <div className="rounded-2xl bg-[rgba(67,43,26,0.8)] p-3"><p className="text-xs uppercase tracking-[0.2em] text-[#d6b26f]">Poziom</p><p className="mt-1 font-bold">{displayLevel}</p></div>
              <div className="rounded-2xl bg-[rgba(67,43,26,0.8)] p-3"><p className="text-xs uppercase tracking-[0.2em] text-[#d6b26f]">EXP</p><p className="mt-1 font-bold">{displayXp}/{displayXpToNextLevel}</p></div>
              <div className="rounded-2xl bg-[rgba(67,43,26,0.8)] p-3"><p className="text-xs uppercase tracking-[0.2em] text-[#d6b26f]">Gotówka</p><p className="mt-1 font-bold">{moneyFormatted}</p></div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/30">
              <div className="h-full rounded-full bg-[#d8ba7a] transition-all" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={() => void loadProfile()} className="rounded-2xl border border-[#8b6a3e] bg-[rgba(33,20,12,0.88)] px-4 py-2 font-bold backdrop-blur-sm">Odśwież profil</button>
            <button onClick={handleLogout} className="rounded-2xl border border-red-400/40 bg-red-950/50 px-4 py-2 font-bold text-red-100 backdrop-blur-sm">Wyloguj</button>
          </div>
        </div>

        {message && (
          <div className={`relative z-10 mx-4 mt-4 max-w-xl rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-sm ${getMessageClasses(message.type)}`}>
            <p className="font-bold">{message.title}</p>
            <p className="mt-1 text-sm leading-6">{message.text}</p>
          </div>
        )}

        <div className="relative z-10 px-4 pb-8 pt-6">
          <div className="relative mx-auto h-[68vh] w-full max-w-6xl overflow-hidden rounded-[36px] border border-[#8b6a3e] bg-black/10 shadow-2xl">
            {activeMap.entrances.map((entrance) => (
              <button
                key={entrance.id}
                type="button"
                onClick={() => void handleChangeMap(entrance.targetMap)}
                className="group absolute rounded-[28px] border border-[#e7cf96]/40 bg-[rgba(41,26,14,0.34)] transition hover:border-[#f8df9f] hover:bg-[rgba(68,44,23,0.58)]"
                style={{ left: entrance.left, top: entrance.top, width: entrance.width, height: entrance.height }}
                title={entrance.description ?? entrance.label}
              >
                <span className="absolute inset-x-2 bottom-2 rounded-xl bg-[rgba(30,18,9,0.82)] px-3 py-2 text-center text-sm font-bold text-[#f5e6c8] shadow-lg transition group-hover:bg-[rgba(50,31,17,0.94)]">
                  {entrance.label}
                </span>
              </button>
            ))}

            {activeMap.showFarmButton ? (
              <div className="absolute bottom-5 left-5 max-w-sm rounded-[28px] border border-[#8b6a3e] bg-[rgba(32,20,12,0.9)] p-5 shadow-2xl backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Panel farmy</p>
                <h2 className="mt-2 text-2xl font-black text-[#f8e4b1]">Twoje pola</h2>
                <p className="mt-2 text-sm leading-6 text-[#ddc79d]">Wejdź na pola, aby sadzić, podlewać, zbierać i odblokowywać kolejne miejsca pod uprawę.</p>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => setIsFieldViewOpen(true)} className="rounded-2xl bg-[#e6c987] px-4 py-3 font-black text-[#2f1d11]">Wejdź na pola</button>
                  <button onClick={() => void handleChangeMap("city")} className="rounded-2xl border border-[#8b6a3e] bg-[rgba(60,39,24,0.82)] px-4 py-3 font-bold">Jedź do miasta</button>
                </div>
              </div>
            ) : (
              <div className="absolute bottom-5 left-5 max-w-sm rounded-[28px] border border-[#8b6a3e] bg-[rgba(32,20,12,0.9)] p-5 shadow-2xl backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Lokacja</p>
                <h2 className="mt-2 text-2xl font-black text-[#f8e4b1]">{activeMap.name}</h2>
                <p className="mt-2 text-sm leading-6 text-[#ddc79d]">{activeMap.subtitle}</p>
                <p className="mt-3 text-sm leading-6 text-[#ddc79d]">To jest pusta lokacja przygotowana pod dalszą rozbudowę. Możesz dodać tu sklep, NPC, questy albo własny interfejs.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="fixed right-4 top-36 z-20 w-[340px] rounded-[30px] border border-[#8b6a3e] bg-[rgba(30,18,10,0.93)] p-5 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Plecak</p>
              <h2 className="mt-1 text-2xl font-black text-[#f8e4b1]">Nasiona i narzędzia</h2>
            </div>
            <button onClick={() => setSelectedTool(selectedTool === "watering_can" ? null : "watering_can")} className={`rounded-2xl px-3 py-2 text-sm font-black transition ${selectedTool === "watering_can" ? "bg-sky-300 text-sky-950" : "border border-[#8b6a3e] bg-[rgba(57,36,22,0.9)] text-[#f3e6c8]"}`}>💧 Konewka</button>
          </div>

          <div className="mt-4 space-y-3">
            {availableCrops.map((crop) => {
              const amount = seedInventory[crop.id] ?? 0;
              const isActive = selectedSeedId === crop.id;
              return (
                <button key={crop.id} type="button" onClick={() => { setSelectedSeedId(isActive ? null : crop.id); setSelectedTool(null); }} className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${isActive ? "border-[#f6dda1] bg-[rgba(106,74,35,0.92)]" : "border-[#8b6a3e] bg-[rgba(52,33,19,0.82)] hover:bg-[rgba(73,46,27,0.92)]"}`}>
                  <div>
                    <p className="font-bold text-[#f7e1ac]">{crop.name}</p>
                    <p className="text-xs text-[#d8c299]">Od poziomu {crop.unlockLevel}</p>
                  </div>
                  <span className={`rounded-xl px-3 py-1 text-sm font-black ${amount > 0 ? "bg-[#e6c987] text-[#2f1d11]" : "bg-black/30 text-[#ae9d79]"}`}>{amount}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-[#8b6a3e] bg-[rgba(52,33,19,0.82)] p-4 text-sm leading-6 text-[#dfcfab]">
            {selectedTool === "watering_can"
              ? "Masz wybraną konewkę. Kliknij pole, aby je podlać."
              : selectedSeedId
              ? `Wybrano nasiono: ${CROPS.find((crop) => crop.id === selectedSeedId)?.name ?? "roślina"}. Kliknij pole, aby posadzić.`
              : cropsInInventory.length > 0
              ? "Wybierz nasiono albo konewkę."
              : "Nie masz jeszcze dostępnych nasion w plecaku."}
          </div>
        </aside>

        {isFieldViewOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
            <div className="relative h-[92vh] w-full max-w-6xl overflow-hidden rounded-[34px] border border-[#8b6a3e] bg-[rgba(31,19,11,0.97)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#8b6a3e] px-6 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Widok pól</p>
                  <h2 className="mt-1 text-2xl font-black text-[#f8e4b1]">Gospodarstwo</h2>
                </div>
                <button onClick={() => setIsFieldViewOpen(false)} className="rounded-2xl border border-[#8b6a3e] bg-[rgba(59,38,23,0.9)] px-4 py-2 font-bold">Zamknij</button>
              </div>

              <div className="grid h-[calc(92vh-88px)] grid-cols-1 gap-0 lg:grid-cols-[1.2fr_380px]">
                <div className="relative overflow-hidden bg-[url('/polewidok.png')] bg-cover bg-center">
                  <div className="absolute inset-0 bg-black/10" />
                  {FIELD_VIEW_PLOTS.map((plot) => {
                    const plotId = plot.id;
                    const cropState = getPlotCrop(plotId);
                    const plantedCrop = getPlantedCrop(plotId);
                    const unlocked = isPlotUnlocked(plotId);
                    const ready = isCropReady(plotId);
                    const progress = Math.round(getGrowthProgress(plotId) * 100);

                    return (
                      <button
                        key={plotId}
                        type="button"
                        onClick={() => void handlePlotClick(plotId)}
                        className={`absolute rounded-[22px] border-2 p-2 text-left shadow-xl transition ${selectedPlotId === plotId ? "border-[#fff0be] ring-2 ring-[#f7de9c]" : "border-[#7f6238]"} ${!unlocked ? "bg-black/55" : ready ? "bg-emerald-800/55" : cropState.cropId ? "bg-[#7b5326]/60" : "bg-[#4b311b]/45 hover:bg-[#6a4727]/55"}`}
                        style={{ left: plot.left, top: plot.top, width: plot.width, height: plot.height }}
                      >
                        <div className="flex h-full flex-col justify-between">
                          <div className="flex items-start justify-between gap-2">
                            <span className="rounded-lg bg-black/35 px-2 py-1 text-xs font-black text-[#f5e6c8]">#{plotId}</span>
                            {!unlocked ? <span className="rounded-lg bg-red-950/80 px-2 py-1 text-[10px] font-black text-red-100">Zablok.</span> : null}
                          </div>

                          <div>
                            {!unlocked ? (
                              <p className="text-xs font-bold text-[#f6d9a3]">Koszt: {PLOT_UNLOCK_COSTS[plotId] ?? 0} zł</p>
                            ) : plantedCrop ? (
                              <>
                                <p className="text-sm font-black text-[#fff0be]">{plantedCrop.name}</p>
                                <p className="mt-1 text-[11px] text-[#f0dfbb]">{ready ? "Gotowe do zbioru" : `Wzrost: ${progress}%`}</p>
                                {!ready ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-[#e4c57d]" style={{ width: `${progress}%` }} /></div> : null}
                              </>
                            ) : (
                              <p className="text-xs font-bold text-[#f5e6c8]">Puste pole</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="overflow-y-auto border-l border-[#8b6a3e] bg-[rgba(37,23,14,0.96)] p-5">
                  <h3 className="text-xl font-black text-[#f8e4b1]">Szczegóły pola</h3>
                  {selectedPlotId ? (
                    <>
                      <div className="mt-4 rounded-2xl border border-[#8b6a3e] bg-[rgba(59,38,23,0.88)] p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-[#d8ba7a]">Pole</p>
                        <p className="mt-1 text-2xl font-black text-[#f8e4b1]">#{selectedPlotId}</p>
                        <p className="mt-2 text-sm leading-6 text-[#dfcfab]">
                          {!isPlotUnlocked(selectedPlotId)
                            ? `Pole jest zablokowane. Koszt odblokowania: ${PLOT_UNLOCK_COSTS[selectedPlotId] ?? 0} zł.`
                            : getPlotCrop(selectedPlotId).cropId
                            ? `Rośnie tu ${getPlantedCrop(selectedPlotId)?.name?.toLowerCase() ?? "roślina"}.`
                            : "Pole jest gotowe do zasiania."}
                        </p>
                      </div>

                      {isPlotUnlocked(selectedPlotId) && getPlotCrop(selectedPlotId).cropId && (
                        <div className="mt-4 rounded-2xl border border-[#8b6a3e] bg-[rgba(59,38,23,0.88)] p-4 text-sm leading-6 text-[#dfcfab]">
                          <p>Podlane: <span className="font-bold">{getPlotCrop(selectedPlotId).watered ? "Tak" : "Nie"}</span></p>
                          <p>Pozostały czas: <span className="font-bold">{isCropReady(selectedPlotId) ? "Gotowe" : formatSeconds(getRemainingGrowthSeconds(selectedPlotId))}</span></p>
                        </div>
                      )}

                      <div className="mt-4 grid gap-3">
                        {!isPlotUnlocked(selectedPlotId) ? (
                          <button onClick={() => void handleUnlockPlot(selectedPlotId)} className="rounded-2xl bg-[#e6c987] px-4 py-3 font-black text-[#2f1d11]">Odblokuj pole</button>
                        ) : (
                          <>
                            <button onClick={() => { setSelectedTool("watering_can"); setSelectedSeedId(null); }} className="rounded-2xl border border-[#8b6a3e] bg-[rgba(59,38,23,0.88)] px-4 py-3 font-bold">Wybierz konewkę</button>
                            <button onClick={() => selectedSeedId ? void handlePlantFromSelectedSeed(selectedPlotId) : setMessage({ type: "info", title: "Brak nasiona", text: "Najpierw wybierz nasiono z plecaka." })} className="rounded-2xl border border-[#8b6a3e] bg-[rgba(59,38,23,0.88)] px-4 py-3 font-bold">Posadź wybrane nasiono</button>
                            <button onClick={() => void handleWaterPlot(selectedPlotId)} className="rounded-2xl border border-[#8b6a3e] bg-[rgba(59,38,23,0.88)] px-4 py-3 font-bold">Podlej pole</button>
                            <button onClick={() => void handleHarvestPlot(selectedPlotId)} className="rounded-2xl border border-[#8b6a3e] bg-[rgba(59,38,23,0.88)] px-4 py-3 font-bold">Zbierz plony</button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-[#dfcfab]">Wybierz pole po lewej stronie.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
