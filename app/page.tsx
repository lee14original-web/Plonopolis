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

const DEFAULT_LEVEL = 1;
const DEFAULT_XP = 0;
const DEFAULT_XP_TO_NEXT_LEVEL = 100;
const DEFAULT_MONEY = 10;
const DEFAULT_LOCATION = "Startowa Polana";
const DEFAULT_MAP = "farm1";

export default function Page() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
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

  const displayLocation = profile?.location ?? DEFAULT_LOCATION;
  const displayLevel = profile?.level ?? DEFAULT_LEVEL;
  const displayXp = profile?.xp ?? DEFAULT_XP;
  const displayXpToNextLevel = profile?.xp_to_next_level ?? DEFAULT_XP_TO_NEXT_LEVEL;
  const displayMoney = profile?.money ?? DEFAULT_MONEY;
  const currentMap = profile?.current_map ?? DEFAULT_MAP;

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

    setProfile(data as Profile);
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

    const { data: existingLogin } = await supabase
      .from("profiles")
      .select("id")
      .ilike("login", login)
      .limit(1);

    if (existingLogin && existingLogin.length > 0) {
      setMessage({
        type: "error",
        title: "Login zajęty",
        text: "Ten login już istnieje. Wybierz inny.",
      });
      return;
    }

    const { data: existingEmail } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1);

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
      current_map: DEFAULT_MAP,
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
      text: "Nowy gracz startuje na mapie początkowej.",
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

    const emailToUse = identifier;

    if (!isEmailValid(identifier)) {
      setMessage({
        type: "error",
        title: "Nieprawidłowy email",
        text: "Zaloguj się używając adresu email.",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
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
    setMessage({
      type: "info",
      title: "Wylogowano",
      text: "Sesja została zakończona.",
    });
  }

  async function handleSaveProgress() {
    if (!profile) return;

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

    const { error } = await supabase
      .from("profiles")
      .update({
        level: nextLevel,
        xp: nextXpStored,
        xp_to_next_level: nextXpToNextLevel,
        money: nextMoney,
        location: displayLocation,
        current_map: currentMap,
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

    setMessage({
      type: "success",
      title: "Postęp zapisany",
      text: "",
    });
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1a130d] text-[#f3e6c8]">
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
          ? "url('/farm1.png')"
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

        <div className="mx-auto flex h-full max-w-6xl items-center justify-center px-4 py-4">
          {!profile ? (
            <div className="grid w-full items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
                  Po pomyślnym logowaniu wczytujemy sesję gracza. Jeśli konto jest nowe, zaczynasz na mapie startowej
                  z poziomem 1, 0 EXP i początkową ilością pieniędzy.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)] p-4">
                    <p className="font-bold text-[#f9e7b2]">Nowy gracz</p>
                    <p className="mt-2 text-sm text-[#dfcfab]">Poziom 1 • 0 / 100 EXP • 10 PLN</p>
                    <p className="mt-2 text-sm text-[#dfcfab]">Lokacja: Startowa Polana</p>
                  </div>

                  <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)] p-4">
                    <p className="font-bold text-[#f9e7b2]">W grze</p>
                    <p className="mt-2 text-sm text-[#dfcfab]">Wyloguj w prawym górnym rogu</p>
                    <p className="mt-2 text-sm text-[#dfcfab]">Na górze: poziom, EXP i pieniądze</p>
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <div className="w-full px-4 pt-12 md:px-8">
  <div className="mx-auto max-w-6xl">
    <div className="flex min-h-[45vh] items-start justify-start">
                  <div className="rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.82)] p-5 text-[#f3e6c8] shadow-2xl backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Sesja wczytana</p>
                    <h2 className="mt-2 text-3xl font-black text-[#f9e7b2]">{profile.login}</h2>
                    <p className="mt-2 text-sm text-[#dfcfab]">Mapa: {currentMap}</p>
                    <p className="mt-2 text-sm text-[#dfcfab]">Lokacja: {displayLocation}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={handleSaveProgress}
                        className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-3 font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                      >
                        Zapisz postęp
                      </button>
                      <button
                        className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-4 py-3 font-bold text-[#f3e6c8] transition hover:bg-[rgba(40,25,14,0.85)]"
                      >
                        Graj dalej
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {message && (
          <div className="fixed bottom-4 left-4 z-50">
            <div
              className={`rounded-2xl px-4 py-3 text-sm shadow-2xl backdrop-blur-sm border ${
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
