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

type UnlockRule = {
  level: number;
  maxPlots: number;
};

const DEFAULT_LEVEL = 1;
const DEFAULT_XP = 0;
const DEFAULT_XP_TO_NEXT_LEVEL = 100;
const DEFAULT_MONEY = 10;
const DEFAULT_LOCATION = "Startowa Polana";
const DEFAULT_MAP = "farm1";

const FARM_UPGRADE_LEVELS = [5, 10, 15, 20] as const;

const FARM_PLOTS: FarmPlot[] = [
  { id: 1, left: "51%", top: "53%", width: "8.5%", height: "10%" },
  { id: 2, left: "61%", top: "52%", width: "8.5%", height: "10%" },
  { id: 3, left: "71%", top: "51%", width: "8.5%", height: "10%" },
  { id: 4, left: "81%", top: "50%", width: "8.5%", height: "10%" },

  { id: 5, left: "50%", top: "65%", width: "8.5%", height: "10%" },
  { id: 6, left: "60%", top: "64%", width: "8.5%", height: "10%" },
  { id: 7, left: "70%", top: "63%", width: "8.5%", height: "10%" },
  { id: 8, left: "80%", top: "62%", width: "8.5%", height: "10%" },

  { id: 9, left: "49%", top: "76%", width: "8.5%", height: "10%" },
  { id: 10, left: "59%", top: "75%", width: "8.5%", height: "10%" },
  { id: 11, left: "69%", top: "74%", width: "8.5%", height: "10%" },
  { id: 12, left: "79%", top: "73%", width: "8.5%", height: "10%" },

  { id: 13, left: "48%", top: "87%", width: "8.5%", height: "10%" },
  { id: 14, left: "58%", top: "86%", width: "8.5%", height: "10%" },
  { id: 15, left: "68%", top: "85%", width: "8.5%", height: "10%" },
  { id: 16, left: "78%", top: "84%", width: "8.5%", height: "10%" },

  { id: 17, left: "46%", top: "98%", width: "8.5%", height: "10%" },
  { id: 18, left: "56%", top: "97%", width: "8.5%", height: "10%" },
  { id: 19, left: "66%", top: "96%", width: "8.5%", height: "10%" },
  { id: 20, left: "76%", top: "95%", width: "8.5%", height: "10%" },

  { id: 21, left: "44%", top: "109%", width: "8.5%", height: "10%" },
  { id: 22, left: "54%", top: "108%", width: "8.5%", height: "10%" },
  { id: 23, left: "64%", top: "107%", width: "8.5%", height: "10%" },
  { id: 24, left: "74%", top: "106%", width: "8.5%", height: "10%" },

  { id: 25, left: "42%", top: "120%", width: "8.5%", height: "10%" },
  { id: 26, left: "52%", top: "119%", width: "8.5%", height: "10%" },
  { id: 27, left: "62%", top: "118%", width: "8.5%", height: "10%" },
  { id: 28, left: "72%", top: "117%", width: "8.5%", height: "10%" },

  { id: 29, left: "40%", top: "131%", width: "8.5%", height: "10%" },
  { id: 30, left: "50%", top: "130%", width: "8.5%", height: "10%" },
  { id: 31, left: "60%", top: "129%", width: "8.5%", height: "10%" },
  { id: 32, left: "70%", top: "128%", width: "8.5%", height: "10%" },

  { id: 33, left: "38%", top: "142%", width: "8.5%", height: "10%" },
  { id: 34, left: "48%", top: "141%", width: "8.5%", height: "10%" },
  { id: 35, left: "58%", top: "140%", width: "8.5%", height: "10%" },
  { id: 36, left: "68%", top: "139%", width: "8.5%", height: "10%" },

  { id: 37, left: "36%", top: "153%", width: "8.5%", height: "10%" },
  { id: 38, left: "46%", top: "152%", width: "8.5%", height: "10%" },
  { id: 39, left: "56%", top: "151%", width: "8.5%", height: "10%" },
  { id: 40, left: "66%", top: "150%", width: "8.5%", height: "10%" },

  { id: 41, left: "34%", top: "164%", width: "8.5%", height: "10%" },
  { id: 42, left: "44%", top: "163%", width: "8.5%", height: "10%" },
  { id: 43, left: "54%", top: "162%", width: "8.5%", height: "10%" },
  { id: 44, left: "64%", top: "161%", width: "8.5%", height: "10%" },
  { id: 45, left: "74%", top: "160%", width: "8.5%", height: "10%" },
];

const PLOT_UNLOCK_COSTS: Record<number, number> = {
  4: 120,
  5: 140,
  6: 160,
  7: 180,
  8: 210,
  9: 240,
  10: 280,
  11: 320,
  12: 370,
  13: 420,
  14: 490,
  15: 560,
  16: 640,
  17: 740,
  18: 850,
  19: 980,
  20: 1130,
  21: 1290,
  22: 1490,
  23: 1710,
  24: 1970,
  25: 2260,
  26: 2600,
  27: 2990,
  28: 3440,
  29: 3960,
  30: 4550,
  31: 5230,
  32: 6020,
  33: 6920,
  34: 7960,
  35: 9150,
  36: 10530,
  37: 12110,
  38: 13920,
  39: 16010,
  40: 18410,
  41: 21170,
  42: 24350,
  43: 28000,
  44: 32200,
  45: 37030,
};

const PLOT_LIMITS_BY_LEVEL: UnlockRule[] = [
  { level: 1, maxPlots: 3 },
  { level: 2, maxPlots: 4 },
  { level: 3, maxPlots: 5 },
  { level: 4, maxPlots: 6 },
  { level: 5, maxPlots: 7 },
  { level: 6, maxPlots: 8 },
  { level: 7, maxPlots: 9 },
  { level: 8, maxPlots: 10 },
  { level: 9, maxPlots: 11 },
  { level: 10, maxPlots: 12 },
  { level: 11, maxPlots: 14 },
  { level: 12, maxPlots: 16 },
  { level: 13, maxPlots: 18 },
  { level: 14, maxPlots: 20 },
  { level: 15, maxPlots: 22 },
  { level: 16, maxPlots: 24 },
  { level: 17, maxPlots: 26 },
  { level: 18, maxPlots: 28 },
  { level: 19, maxPlots: 30 },
  { level: 20, maxPlots: 32 },
  { level: 21, maxPlots: 34 },
  { level: 22, maxPlots: 36 },
  { level: 23, maxPlots: 38 },
  { level: 24, maxPlots: 40 },
  { level: 25, maxPlots: 45 },
];

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

function getMapForLevel(level: number | null | undefined) {
  const safeLevel = level ?? DEFAULT_LEVEL;

  if (safeLevel >= 20) return "farm20";
  if (safeLevel >= 15) return "farm15";
  if (safeLevel >= 10) return "farm10";
  if (safeLevel >= 5) return "farm5";

  return DEFAULT_MAP;
}

function getRequiredLevelForPlot(plotNumber: number) {
  for (const rule of PLOT_LIMITS_BY_LEVEL) {
    if (plotNumber <= rule.maxPlots) {
      return rule.level;
    }
  }

  return PLOT_LIMITS_BY_LEVEL[PLOT_LIMITS_BY_LEVEL.length - 1]?.level ?? DEFAULT_LEVEL;
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

  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [unlockedPlots, setUnlockedPlots] = useState<number>(3);
  const [isFieldViewOpen, setIsFieldViewOpen] = useState(false);

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

  function getMaxPlotsForLevel(level: number) {
    let maxPlots = 3;

    for (const rule of PLOT_LIMITS_BY_LEVEL) {
      if (level >= rule.level) {
        maxPlots = rule.maxPlots;
      }
    }

    return maxPlots;
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
  const canUnlockMore = unlockedPlots < maxPlotsForLevel && unlockedPlots < FARM_PLOTS.length;
  const nextPlotCost = PLOT_UNLOCK_COSTS[nextPlotNumber] ?? null;
  const selectedFieldPlotNumber = selectedPlotId ?? Math.min(unlockedPlots, 1);
  const selectedFieldPlotRequiredLevel = getRequiredLevelForPlot(selectedFieldPlotNumber);
  const selectedFieldPlotUnlocked = selectedFieldPlotNumber <= unlockedPlots;

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

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, login, email, created_at, level, xp, xp_to_next_level, money, location, current_map, last_played_at"
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

    const nextProfile = data as Profile;
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
        text: "Hasło powinien mieć minimum 6 znaków.",
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
      xp_to_next_level: DEFAULT_XP_TO_NEXT_LEVEL,
      money: DEFAULT_MONEY,
      location: DEFAULT_LOCATION,
      current_map: getMapForLevel(DEFAULT_LEVEL),
      last_played_at: new Date().toISOString(),
    });

    if (profileError) {
      setMessage({
        type: "error",
        title: "Błąd zapisu profilu",
        text: profileError.message,
      });
      return;
    }

    setUnlockedPlots(3);
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
    setUnlockedPlots(3);
    setFarmUpgradeModal(null);
    setIsFieldViewOpen(false);
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

    if (nextXp >= displayXpToNextLevel) {
      nextLevel += 1;
      nextXpStored = nextXp - displayXpToNextLevel;
      nextXpToNextLevel = displayXpToNextLevel + 50;
      nextMoney += 100;
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
      setMessage({
        type: "error",
        title: "Błąd odblokowania",
        text: error.message,
      });
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
            <button
              onClick={handleLogout}
              className="absolute right-4 top-4 z-20 rounded-2xl border border-red-400/40 bg-red-950/40 px-4 py-2 font-bold text-red-100 backdrop-blur-sm transition hover:bg-red-950/60"
            >
              Wyloguj
            </button>

            <div className="mx-auto flex max-w-5xl justify-center px-4 pt-2">
              <div className="z-10 w-full max-w-3xl rounded-[24px] border border-[#8b6a3e] bg-[rgba(33,20,12,0.88)] px-4 py-2 text-[#f5dfb0] shadow-2xl backdrop-blur-sm">
                <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_auto]">
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

                  <div className="rounded-2xl border border-[#8b6a3e] bg-black/20 px-4 py-2 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Poziom</p>
                    <p className="text-2xl font-black text-white">{displayLevel}</p>
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
            <div className="relative h-full w-full px-4 pt-8 md:px-8">
              <div className="absolute left-4 top-16 z-20">
                <div className="rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.82)] p-4 text-[#f3e6c8] shadow-2xl backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Sesja wczytana</p>
                  <h2 className="mt-2 text-2xl font-black text-[#f9e7b2]">{profile.login}</h2>
                  <p className="mt-2 text-sm text-[#dfcfab]">Mapa: {currentMap}</p>
                  <p className="mt-1 text-sm text-[#dfcfab]">Lokacja: {displayLocation}</p>
                  <p className="mt-1 text-sm text-[#dfcfab]">
                    Pola: {unlockedPlots} / {maxPlotsForLevel}
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

              <button
                type="button"
                onClick={() => setIsFieldViewOpen(true)}
                className="absolute z-20 flex items-center justify-center text-2xl font-black text-white transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                style={{
                  left: "48%",
                  top: "63%",
                  width: "40%",
                  height: "18%",
                }}
                title="Pola uprawne"
              >
                <div className="relative flex h-full w-full items-center justify-center rounded-xl">
                  <div className="absolute inset-0 rounded-xl border-4 border-red-600 bg-red-500/20" />
                  <div className="absolute inset-0 rounded-xl bg-yellow-400/20 opacity-70 blur-xl animate-pulse" />
                  <div className="absolute inset-0 rounded-xl transition-all duration-300 hover:bg-yellow-300/20 hover:shadow-[0_0_40px_rgba(255,220,120,0.8)]" />
                  <div className="absolute inset-0 rounded-xl border-2 border-yellow-300/60 hover:border-yellow-200" />
                  <span className="relative text-[clamp(1.5rem,2vw,3rem)] drop-shadow-[0_0_10px_rgba(255,220,120,0.9)]">
                    Pola uprawne
                  </span>
                </div>
              </button>

              <div className="pointer-events-none absolute inset-0 z-10">
                {FARM_PLOTS.slice(0, unlockedPlots).map((plot) => (
                  <button
                    key={plot.id}
                    type="button"
                    onClick={() => setSelectedPlotId(plot.id)}
                    className="pointer-events-auto absolute rounded-xl border-2 border-yellow-300/70 bg-yellow-200/10 transition hover:bg-yellow-200/20"
                    style={{
                      left: plot.left,
                      top: plot.top,
                      width: plot.width,
                      height: plot.height,
                    }}
                    title={`Pole ${plot.id}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {isFieldViewOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-2 py-2">
            <div className="relative w-full max-w-[1600px] rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.96)] p-5 shadow-2xl backdrop-blur-sm">
              <button
                onClick={() => setIsFieldViewOpen(false)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-red-400/40 bg-red-950/40 text-xl font-bold text-red-100 transition hover:bg-red-950/60"
                aria-label="Zamknij widok pola"
              >
                ×
              </button>

              <div className="mb-4 pr-14">
                <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Widok pola</p>
                <h2 className="mt-2 text-2xl font-black text-[#f9e7b2]">Twoje pole uprawne</h2>
                <p className="mt-2 text-sm text-[#dfcfab]">
                  Kliknij wybrane pole na siatce. Zablokowane pola pokazują wymagany poziom.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="overflow-hidden rounded-[20px] border border-[#8b6a3e] bg-black/20">
                  <div className="relative">
                    <img
                      src="/farm-field-view.png"
                      alt="Widok pola 25 slotów"
                      className="max-h-[88vh] w-full object-contain"
                    />

                    <div className="absolute left-[9%] top-[8.5%] grid h-[80%] w-[82%] grid-cols-5 gap-x-[3%] gap-y-[4%]">
                      {FIELD_VIEW_PLOTS.map((plotNumber) => {
                        const isUnlocked = plotNumber <= unlockedPlots;
                        const requiredLevel = getRequiredLevelForPlot(plotNumber);
                        const isSelected = selectedPlotId === plotNumber;

                        return (
                          <button
                            key={plotNumber}
                            type="button"
                            onClick={() => {
                              if (isUnlocked) {
                                setSelectedPlotId(plotNumber);
                              }
                            }}
                            disabled={!isUnlocked}
                            className={`relative rounded-xl border-2 transition-all duration-200 ${
                              isUnlocked
                                ? isSelected
                                  ? "border-[#f4cf78] bg-yellow-200/20 shadow-[0_0_25px_rgba(245,222,139,0.35)]"
                                  : "border-yellow-300/55 bg-yellow-200/10 hover:scale-[1.03] hover:bg-yellow-200/18 hover:shadow-[0_0_18px_rgba(245,222,139,0.25)]"
                                : "border-red-300/35 bg-black/20 opacity-95"
                            } ${!isUnlocked ? "cursor-not-allowed" : ""}`}
                            title={
                              isUnlocked
                                ? `Pole ${plotNumber}`
                                : `Pole ${plotNumber} wymaga poziomu ${requiredLevel}`
                            }
                          >
                            <div className="absolute inset-0 rounded-xl bg-black/10" />
                            <div className="relative flex h-full w-full flex-col items-center justify-center px-2 text-center">
                              <span className="text-lg font-black text-white drop-shadow">
                                {plotNumber}
                              </span>
                              {isUnlocked ? (
                                <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#f5dfb0]">
                                  {isSelected ? "Wybrane" : "Aktywne"}
                                </span>
                              ) : (
                                <>
                                  <span className="mt-1 text-[11px] font-black uppercase tracking-[0.15em] text-red-100">
                                    Locked
                                  </span>
                                  <span className="mt-1 text-[10px] font-semibold text-[#f5dfb0]">
                                    Wymaga: poziom {requiredLevel}
                                  </span>
                                </>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <aside className="rounded-[24px] border border-[#8b6a3e] bg-[rgba(20,12,8,0.72)] p-4 text-[#f3e6c8] shadow-2xl">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Menu pola</p>
                  <h3 className="mt-2 text-2xl font-black text-[#f9e7b2]">
                    Pole #{selectedFieldPlotNumber}
                  </h3>
                  <p className="mt-2 text-sm text-[#dfcfab]">
                    {selectedFieldPlotUnlocked
                      ? "Tutaj później dodamy sadzenie, podlewanie i zbiór."
                      : `To pole jest jeszcze zablokowane. Wymagany poziom: ${selectedFieldPlotRequiredLevel}.`}
                  </p>

                  <div className="mt-4 grid gap-2">
                    <button
                      disabled={!selectedFieldPlotUnlocked}
                      className="rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-3 py-2 text-sm font-bold text-[#f3e6c8] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Posiej
                    </button>
                    <button
                      disabled={!selectedFieldPlotUnlocked}
                      className="rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-3 py-2 text-sm font-bold text-[#f3e6c8] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Podlej
                    </button>
                    <button
                      disabled={!selectedFieldPlotUnlocked}
                      className="rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-3 py-2 text-sm font-bold text-[#f3e6c8] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Zbierz
                    </button>

                    <button
                      onClick={handleUnlockNextPlot}
                      disabled={!canUnlockMore || !nextPlotCost}
                      className="mt-2 w-full rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-3 py-2 text-sm font-bold text-[#f3e6c8] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {canUnlockMore && nextPlotCost
                        ? `Odblokuj pole #${nextPlotNumber} za ${nextPlotCost} PLN`
                        : "Osiągnięto limit pól na tym poziomie"}
                    </button>

                    <button
                      onClick={() => setIsFieldViewOpen(false)}
                      className="mt-2 rounded-xl border border-red-400/40 bg-red-950/30 px-3 py-2 text-sm font-bold text-red-100"
                    >
                      Powrót do farmy
                    </button>
                  </div>
                </aside>
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
                <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">
                  Ulepszenie farmy
                </p>
                <h2 className="mt-3 text-3xl font-black text-[#fff1c7]">
                  {farmUpgradeModal.title}
                </h2>
                <p className="mt-4 text-base leading-7 text-[#f2ddb0]">
                  {farmUpgradeModal.text}
                </p>
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
