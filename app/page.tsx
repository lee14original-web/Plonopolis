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
};

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
    growthTimeMs: 30_000,
    yieldAmount: 3,
    expReward: 2,
    spritePath: "/carrot.png",
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

function getFarmUpgradeStorageKey(userId: string, level: number) {
  return `plonopolis_farm_upgrade_seen_${userId}_${level}`;
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

function getRequiredLevelForPlot(plotId: number) {
  if (plotId <= 3) return 1;
  return plotId - 2;
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
  const [unlockedPlots, setUnlockedPlots] = useState<number>(3);
  const [isFieldViewOpen, setIsFieldViewOpen] = useState(false);
  const [plotCrops, setPlotCrops] = useState<Record<number, PlotCropState>>({});
  const [, setGrowthTick] = useState(0);
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(true);

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

  const selectedPlot = selectedPlotId
    ? FARM_PLOTS.find((plot) => plot.id === selectedPlotId) ?? null
    : null;

  const carrotCrop = CROPS.find((crop) => crop.id === "carrot")!;

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

    if (selectedPlotId <= Math.min(unlockedPlots, MAX_FIELDS)) {
      const cropOnPlot = getPlotCrop(selectedPlotId);
      if (cropOnPlot.cropId && isCropReady(selectedPlotId)) {
        void handleHarvestPlot(selectedPlotId);
        return;
      }
      if (!cropOnPlot.cropId) {
        handlePlantCarrot(selectedPlotId);
        return;
      }
    }

    if (
      selectedPlotId > Math.min(unlockedPlots, MAX_FIELDS) &&
      selectedPlotId === unlockedPlots + 1 &&
      displayLevel >= getRequiredLevelForPlot(selectedPlotId)
    ) {
      void handleUnlockNextPlot();
      return;
    }

    setMessage({
      type: "info",
      title: `Pole #${selectedPlotId}`,
      text: "Wybrano pole klawiaturą.",
    });
  }

  function getPlotCrop(plotId: number) {
    return plotCrops[plotId] ?? { cropId: null, plantedAt: null };
  }

  function getGrowthProgress(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return 0;

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) return 0;

    const elapsed = Date.now() - plot.plantedAt;
    return Math.max(0, Math.min(1, elapsed / crop.growthTimeMs));
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

    return Date.now() - plot.plantedAt >= crop.growthTimeMs;
  }

  function getRemainingGrowthSeconds(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return 0;

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) return 0;

    const remaining = crop.growthTimeMs - (Date.now() - plot.plantedAt);
    return Math.max(0, Math.ceil(remaining / 1000));
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

  const maxPlotsForLevel = getMaxPlotsForLevel(displayLevel);
  const nextPlotNumber = unlockedPlots + 1;
  const canUnlockMore = unlockedPlots < maxPlotsForLevel && unlockedPlots < MAX_FIELDS;
  const nextPlotCost = PLOT_UNLOCK_COSTS[nextPlotNumber] ?? null;

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
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 1024;
      const isLandscape = window.innerWidth > window.innerHeight;
      setIsLandscapeMobile(!isMobile || isLandscape);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!isFieldViewOpen) return;
    const interval = setInterval(() => setGrowthTick((prev) => prev + 1), 500);
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

      if (key === "w" || key === "arrowup") moveSelection("up");
      else if (key === "s" || key === "arrowdown") moveSelection("down");
      else if (key === "a" || key === "arrowleft") moveSelection("left");
      else if (key === "d" || key === "arrowright") moveSelection("right");
      else if (key === "enter" || key === " ") confirmSelectedPlot();
      else if (key === "escape") {
        setIsFieldViewOpen(false);
        setSelectedPlotId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFieldViewOpen, selectedPlotId, unlockedPlots, displayLevel, plotCrops]);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, login, email, created_at, level, xp, xp_to_next_level, money, location, current_map, last_played_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setMessage({ type: "error", title: "Błąd profilu", text: error.message });
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

    const maxForCurrentLevel = getMaxPlotsForLevel(nextProfile.level ?? DEFAULT_LEVEL);
    setUnlockedPlots((prev) => {
      const safePrev = prev < 3 ? 3 : prev;
      return Math.min(safePrev, maxForCurrentLevel);
    });
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
      setMessage({ type: "error", title: "Brak danych", text: "Uzupełnij wszystkie pola rejestracji." });
      return;
    }
    if (login.length < 3) {
      setMessage({ type: "error", title: "Login jest za krótki", text: "Login powinien mieć minimum 3 znaki." });
      return;
    }
    if (!isEmailValid(email)) {
      setMessage({ type: "error", title: "Nieprawidłowy email", text: "Podaj poprawny adres email." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "error", title: "Hasło jest za krótkie", text: "Hasło powinno mieć minimum 6 znaków." });
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
      setMessage({ type: "error", title: "Błąd sprawdzania loginu", text: existingLoginError.message });
      return;
    }
    if (existingLogin && existingLogin.length > 0) {
      setMessage({ type: "error", title: "Login zajęty", text: "Ten login już istnieje. Wybierz inny." });
      return;
    }

    const { data: existingEmail, error: existingEmailError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1);

    if (existingEmailError) {
      setMessage({ type: "error", title: "Błąd sprawdzania emaila", text: existingEmailError.message });
      return;
    }
    if (existingEmail && existingEmail.length > 0) {
      setMessage({ type: "error", title: "Email zajęty", text: "Na ten adres email konto już zostało utworzone." });
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setMessage({ type: "error", title: "Błąd rejestracji", text: signUpError.message });
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
      xp_to_next_level: DEFAULT_XP_TO_NEXT_LEVEL,
      money: DEFAULT_MONEY,
      location: DEFAULT_LOCATION,
      current_map: getMapForLevel(DEFAULT_LEVEL),
      last_played_at: new Date().toISOString(),
    });

    if (profileError) {
      setMessage({ type: "error", title: "Błąd zapisu profilu", text: profileError.message });
      return;
    }

    setUnlockedPlots(3);
    await loadProfile(userId);
    setRegisterForm({ login: "", email: "", password: "", confirmPassword: "" });
    setTab("login");
    setMessage({ type: "success", title: "Konto utworzone", text: "Nowy gracz startuje z 3 darmowymi polami." });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const identifier = loginForm.identifier.trim();
    const password = loginForm.password;

    if (!identifier || !password) {
      setMessage({ type: "error", title: "Brak danych", text: "Podaj email oraz hasło." });
      return;
    }
    if (!isEmailValid(identifier)) {
      setMessage({ type: "error", title: "Nieprawidłowy email", text: "Zaloguj się używając adresu email." });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
    if (error) {
      setMessage({ type: "error", title: "Błędne logowanie", text: error.message });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      await loadProfile(session.user.id);
    }

    setLoginForm({ identifier: "", password: "" });
    setMessage({ type: "success", title: "Witaj ponownie", text: "Sesja gracza została wczytana." });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    setSelectedPlotId(null);
    setUnlockedPlots(3);
    setFarmUpgradeModal(null);
    setIsFieldViewOpen(false);
    setMessage({ type: "info", title: "Wylogowano", text: "Sesja została zakończona." });
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
      nextXpToNextLevel = displayXpToNextLevel + 50;
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
      setMessage({ type: "error", title: "Błąd zapisu", text: error.message });
      return;
    }

    await loadProfile(profile.id);
    if (nextLevel > oldLevel) showFarmUpgradeModalOnce(profile.id, nextLevel);

    setMessage({ type: "success", title: "Postęp zapisany", text: "" });
  }

  async function handleUnlockNextPlot() {
    if (!profile) return;

    if (!canUnlockMore || !nextPlotCost) {
      setMessage({
        type: "info",
        title: "Brak odblokowania",
        text: "Na tym poziomie nie możesz jeszcze odblokować kolejnego pola.",
      });
      return;
    }

    if (displayMoney < nextPlotCost) {
      setMessage({
        type: "error",
        title: "Za mało pieniędzy",
        text: `Potrzebujesz ${nextPlotCost} PLN, aby odblokować pole #${nextPlotNumber}.`,
      });
      return;
    }

    const newUnlockedPlots = unlockedPlots + 1;
    const newMoney = displayMoney - nextPlotCost;

    const { error } = await supabase
      .from("profiles")
      .update({
        money: newMoney,
        last_played_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage({ type: "error", title: "Błąd odblokowania", text: error.message });
      return;
    }

    setUnlockedPlots(newUnlockedPlots);
    await loadProfile(profile.id);

    setMessage({
      type: "success",
      title: "Pole odblokowane",
      text: `Odblokowano pole #${newUnlockedPlots}.`,
    });
  }

  function handlePlantCarrot(plotId: number) {
    const plot = getPlotCrop(plotId);

    if (plot.cropId) {
      setMessage({ type: "info", title: "Pole zajęte", text: "Na tym polu już coś rośnie." });
      return;
    }

    if (displayLevel < carrotCrop.unlockLevel) {
      setMessage({
        type: "error",
        title: "Za niski poziom",
        text: `Marchew odblokowuje się od poziomu ${carrotCrop.unlockLevel}.`,
      });
      return;
    }

    setPlotCrops((prev) => ({
      ...prev,
      [plotId]: {
        cropId: carrotCrop.id,
        plantedAt: Date.now(),
      },
    }));

    setMessage({ type: "success", title: "Posadzono marchew", text: `Pole #${plotId} zaczęło rosnąć.` });
  }

  async function handleHarvestPlot(plotId: number) {
    if (!profile) return;

    const plot = getPlotCrop(plotId);
    if (!plot.cropId) {
      setMessage({ type: "info", title: "Puste pole", text: "Najpierw coś posadź na tym polu." });
      return;
    }

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) return;

    if (!isCropReady(plotId)) {
      setMessage({
        type: "info",
        title: "Uprawa jeszcze rośnie",
        text: `Marchew będzie gotowa za około ${getRemainingGrowthSeconds(plotId)} s.`,
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
      nextXpToNextLevel += 50;
    }

    if (nextLevel >= MAX_LEVEL) {
      nextLevel = MAX_LEVEL;
      nextXp = 0;
      nextXpToNextLevel = 0;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        level: nextLevel,
        xp: nextXp,
        xp_to_next_level: nextXpToNextLevel,
        current_map: getMapForLevel(nextLevel),
        last_played_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      setMessage({ type: "error", title: "Błąd zbioru", text: error.message });
      return;
    }

    setPlotCrops((prev) => ({
      ...prev,
      [plotId]: {
        cropId: null,
        plantedAt: null,
      },
    }));

    await loadProfile(profile.id);

    setMessage({
      type: "success",
      title: "Zbiory zakończone",
      text: `Zebrano ${crop.yieldAmount} szt. ${crop.name.toLowerCase()} i +${crop.expReward} EXP.`,
    });
  }

  if (!isLandscapeMobile) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#1a130d] px-6 text-center text-[#f3e6c8]">
        <div className="max-w-sm rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.92)] p-6 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[#d8ba7a]">
            Plonopolis
          </p>
          <h1 className="mt-3 text-2xl font-black text-[#f9e7b2]">
            Obróć telefon
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#dfcfab]">
            Ta gra działa najlepiej w poziomie. Obróć telefon, aby wygodnie grać.
          </p>
          <div className="mt-5 text-5xl">📱↻</div>
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
        backgroundImage: profile ? `url('/${currentMap}.png')` : "url('/assetsmain-lobby.png')",
      }}
    >
      <div className="min-h-screen">
        {profile && (
          <>
            <button
              onClick={handleLogout}
              className="absolute right-4 top-4 z-20 rounded-2xl border border-red-400/40 bg-red-950/40 px-4 py-2 font-bold text-red-100 backdrop-blur-sm transition hover:bg-red-950/60"
            >
              Wyloguj
            </button>

            <div className="mx-auto flex max-w-5xl justify-center px-4 pt-2">
              <div className="z-10 w-full max-w-3xl rounded-[20px] border border-[#8b6a3e] bg-[rgba(33,20,12,0.88)] px-3 py-2 md:px-4 text-[#f5dfb0] shadow-2xl backdrop-blur-sm">
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
                              setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
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
              <div className="absolute left-2 top-14 z-20 sm:left-4 sm:top-16">
                <div className="rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.82)] p-4 text-[#f3e6c8] shadow-2xl backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Sesja wczytana</p>
                  <h2 className="mt-2 text-2xl font-black text-[#f9e7b2]">{profile.login}</h2>
                  <p className="mt-2 text-sm text-[#dfcfab]">Mapa: {currentMap}</p>
                  <p className="mt-1 text-sm text-[#dfcfab]">Lokacja: {displayLocation}</p>
                  <p className="mt-1 text-sm text-[#dfcfab]">
                    Pola: {Math.min(unlockedPlots, MAX_FIELDS)} / {maxPlotsForLevel}
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
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-1 sm:px-2 sm:py-2">
            <div className="relative h-[95vh] w-full max-w-[1600px] overflow-y-auto rounded-[20px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.96)] p-3 md:p-5 shadow-2xl backdrop-blur-sm">
              <button
                onClick={() => {
                  setIsFieldViewOpen(false);
                  setSelectedPlotId(null);
                }}
                className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-red-400/40 bg-red-950/40 text-xl font-bold text-red-100 transition hover:bg-red-950/60 md:right-4 md:top-4"
                aria-label="Zamknij widok pola"
              >
                ×
              </button>

              <div className="mb-3 pr-12 md:mb-4 md:pr-14">
                <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Widok pola</p>
                <h2 className="mt-2 text-xl font-black text-[#f9e7b2] sm:text-2xl">Twoje pole uprawne</h2>
                <p className="mt-2 text-sm text-[#dfcfab]">
                  Kliknij pole w siatce 5 × 5 albo użyj WASD / strzałek. Na telefonie widok skaluje się do pełnej wysokości ekranu.
                </p>
              </div>

              <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="relative overflow-hidden rounded-[18px] border border-[#8b6a3e] bg-black/20">
                  <div className="relative mx-auto w-full max-w-[1100px] min-h-[260px] aspect-[1536/1092]">
                    <img
                      src="/farm-field-view.png"
                      alt="Widok pola 25 slotów"
                      className="h-full w-full object-contain"
                    />

                    <div className="absolute inset-0">
                      {FIELD_VIEW_PLOTS.map((plot) => {
                        const plotId = plot.id;
                        const isUnlocked = plotId <= Math.min(unlockedPlots, MAX_FIELDS);
                        const isSelected = selectedPlotId === plotId;

                        return (
                          <button
                            key={plotId}
                            type="button"
                            onClick={() => setSelectedPlotId(plotId)}
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
                                <div className="absolute inset-x-1 bottom-1 z-10 text-center">
                                  {getPlotCrop(plotId).cropId ? (
                                    <span className="rounded-md bg-black/45 px-1 py-0.5 text-[9px] font-bold text-white/90 sm:px-1.5 sm:text-[10px]">
                                      {isCropReady(plotId) ? "Gotowe!" : `${getRemainingGrowthSeconds(plotId)} s`}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-black text-white drop-shadow-[0_0_8px_rgba(255,220,120,0.9)] sm:text-sm md:text-base">
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
                                  {displayLevel >= getRequiredLevelForPlot(plotId) ? (
                                    <span className="text-[9px] font-bold uppercase leading-tight text-[#f5dfb0] sm:text-[10px] md:text-sm">
                                      KOSZT: {PLOT_UNLOCK_COSTS[plotId] ?? 0} PLN
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold leading-tight text-white/80 sm:text-[10px] md:text-sm">
                                      Wymaga lv: {getRequiredLevelForPlot(plotId)}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] p-3 text-[#f3e6c8] shadow-2xl md:p-4">
                  {selectedPlotId ? (
                    <>
                      <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Menu pola</p>
                      <h3 className="mt-2 text-xl font-black text-[#f9e7b2] sm:text-2xl">Pole #{selectedPlotId}</h3>
                      <p className="mt-2 text-sm text-[#dfcfab]">
                        {selectedPlotId <= Math.min(unlockedPlots, MAX_FIELDS)
                          ? "Marchew od poziomu 1. Czas wzrostu: 30 sekund. Plon: 3 sztuki. Nagroda: 2 EXP za zbiór z jednego pola."
                          : displayLevel >= getRequiredLevelForPlot(selectedPlotId)
                          ? `To pole możesz już kupić za ${PLOT_UNLOCK_COSTS[selectedPlotId] ?? 0} PLN.`
                          : `To pole odblokujesz od poziomu ${getRequiredLevelForPlot(selectedPlotId)}.`}
                      </p>

                      <div className="mt-4 rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                        {selectedPlotId <= Math.min(unlockedPlots, MAX_FIELDS)
                          ? getPlotCrop(selectedPlotId).cropId
                            ? isCropReady(selectedPlotId)
                              ? "Status: marchew gotowa do zebrania."
                              : `Status: marchew rośnie, zostało około ${getRemainingGrowthSeconds(selectedPlotId)} s.`
                            : "Status: pole puste, gotowe do zasiania marchwi."
                          : displayLevel >= getRequiredLevelForPlot(selectedPlotId)
                          ? `Status: gotowe do zakupu za ${PLOT_UNLOCK_COSTS[selectedPlotId] ?? 0} PLN.`
                          : `Status: zablokowane do poziomu ${getRequiredLevelForPlot(selectedPlotId)}.`}
                      </div>

                      <div className="mt-4 grid gap-2">
                        <button
                          onClick={() => handlePlantCarrot(selectedPlotId)}
                          disabled={
                            selectedPlotId > Math.min(unlockedPlots, MAX_FIELDS) ||
                            !!getPlotCrop(selectedPlotId).cropId
                          }
                          className="rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-3 py-2 text-sm font-bold text-[#f3e6c8] transition hover:bg-[rgba(30,18,10,0.9)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Zasiej marchew
                        </button>
                        <button
                          disabled
                          className="rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-3 py-2 text-sm font-bold text-[#f3e6c8] opacity-50"
                        >
                          Podlej
                        </button>
                        <button
                          onClick={() => handleHarvestPlot(selectedPlotId)}
                          disabled={
                            selectedPlotId > Math.min(unlockedPlots, MAX_FIELDS) ||
                            !getPlotCrop(selectedPlotId).cropId
                          }
                          className="rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-3 py-2 text-sm font-bold text-[#f3e6c8] transition hover:bg-[rgba(30,18,10,0.9)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Zbierz
                        </button>
                        <button
                          onClick={handleUnlockNextPlot}
                          className="rounded-xl border border-yellow-400/50 bg-yellow-900/30 px-3 py-2 text-sm font-bold text-yellow-100 transition hover:bg-yellow-900/50"
                        >
                          {selectedPlotId > Math.min(unlockedPlots, MAX_FIELDS)
                            ? `Odblokuj następne pole (#${unlockedPlots + 1})`
                            : "Odblokuj pole"}
                        </button>
                        <button
                          onClick={() => setSelectedPlotId(null)}
                          className="rounded-xl border border-red-400/40 bg-red-950/30 px-3 py-2 text-sm font-bold text-red-100 transition hover:bg-red-950/45"
                        >
                          Zamknij menu pola
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Menu pola</p>
                      <h3 className="mt-2 text-xl font-black text-[#f9e7b2] sm:text-2xl">Wybierz pole</h3>
                      <p className="mt-2 text-sm text-[#dfcfab]">
                        Kliknij jedno z odblokowanych pól w siatce 5 × 5, aby otworzyć jego menu.
                      </p>

                      <div className="mt-4 rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                        Odblokowane pola: {Math.min(unlockedPlots, MAX_FIELDS)} / {MAX_FIELDS}
                      </div>
                    </>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => {
                        setIsFieldViewOpen(false);
                        setSelectedPlotId(null);
                      }}
                      className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                    >
                      Powrót do farmy
                    </button>
                  </div>
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
