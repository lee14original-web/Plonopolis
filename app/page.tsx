import React, { useEffect, useMemo, useState } from "react";

type UserRecord = {
  id: string;
  login: string;
  email: string;
  password: string; // mock only
  createdAt: string;
  save?: {
    level?: number;
    location?: string;
    lastPlayedAt?: string;
  };
};

type SessionRecord = {
  userId: string;
  login: string;
  loggedInAt: string;
};

const USERS_KEY = "plonopolis_users";
const SESSION_KEY = "plonopolis_session";

function readUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: UserRecord[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readSession(): SessionRecord | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session: SessionRecord) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function Page() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [ready, setReady] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    title: string;
    text: string;
  } | null>(null);

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

  useEffect(() => {
    setUsers(readUsers());
    setSession(readSession());
    setReady(true);
  }, []);

  const currentUser = useMemo(() => {
    if (!session) return null;
    return users.find((u) => u.id === session.userId) ?? null;
  }, [session, users]);

  const handleRegister = (e: React.FormEvent) => {
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

    const loginTaken = users.some((u) => normalize(u.login) === normalize(login));
    if (loginTaken) {
      setMessage({
        type: "error",
        title: "Login zajęty",
        text: "Ten login już istnieje. Wybierz inny.",
      });
      return;
    }

    const emailTaken = users.some((u) => normalize(u.email) === normalize(email));
    if (emailTaken) {
      setMessage({
        type: "error",
        title: "Email zajęty",
        text: "Na ten adres email konto już zostało utworzone.",
      });
      return;
    }

    const newUser: UserRecord = {
      id: createId(),
      login,
      email,
      password,
      createdAt: new Date().toISOString(),
      save: {
        level: 1,
        location: "Startowa Polana",
        lastPlayedAt: new Date().toISOString(),
      },
    };

    const nextUsers = [...users, newUser];
    setUsers(nextUsers);
    writeUsers(nextUsers);

    const nextSession: SessionRecord = {
      userId: newUser.id,
      login: newUser.login,
      loggedInAt: new Date().toISOString(),
    };

    setSession(nextSession);
    writeSession(nextSession);

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
      text: "Rejestracja zakończona sukcesem. Użytkownik został automatycznie zalogowany.",
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const identifier = loginForm.identifier.trim();
    const password = loginForm.password;

    if (!identifier || !password) {
      setMessage({
        type: "error",
        title: "Brak danych",
        text: "Podaj login lub email oraz hasło.",
      });
      return;
    }

    const foundUser = users.find(
      (u) =>
        normalize(u.login) === normalize(identifier) ||
        normalize(u.email) === normalize(identifier)
    );

    if (!foundUser || foundUser.password !== password) {
      setMessage({
        type: "error",
        title: "Błędne logowanie",
        text: "Niepoprawny login/email lub hasło.",
      });
      return;
    }

    const nextSession: SessionRecord = {
      userId: foundUser.id,
      login: foundUser.login,
      loggedInAt: new Date().toISOString(),
    };

    setSession(nextSession);
    writeSession(nextSession);

    setLoginForm({ identifier: "", password: "" });
    setMessage({
      type: "success",
      title: "Witaj ponownie",
      text: `Zalogowano jako ${foundUser.login}. Możesz wrócić do gry.`,
    });
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setMessage({
      type: "info",
      title: "Wylogowano",
      text: "Sesja została usunięta z localStorage.",
    });
  };

  const handleMockSaveProgress = () => {
    if (!currentUser) return;

    const nextUsers = users.map((u) => {
      if (u.id !== currentUser.id) return u;

      const nextLevel = (u.save?.level ?? 1) + 1;

      return {
        ...u,
        save: {
          level: nextLevel,
          location: `Sektor ${nextLevel}`,
          lastPlayedAt: new Date().toISOString(),
        },
      };
    });

    setUsers(nextUsers);
    writeUsers(nextUsers);

    setMessage({
      type: "success",
      title: "Postęp zapisany",
      text: "Mock zapisu konta został zaktualizowany w localStorage.",
    });
  };

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
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/assetsmain-lobby.png')" }}
    >
      <div className="min-h-screen bg-black/50">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-8">
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
                {message && (
                  <div
                    className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                      message.type === "error"
                        ? "border-red-400/40 bg-red-950/40 text-red-100"
                        : message.type === "success"
                        ? "border-emerald-400/40 bg-emerald-950/40 text-emerald-100"
                        : "border-sky-400/40 bg-sky-950/40 text-sky-100"
                    }`}
                  >
                    <p className="font-semibold">{message.title}</p>
                    <p className="mt-1 opacity-90">{message.text}</p>
                  </div>
                )}

                {!session ? (
                  <>
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
                          <label className="mb-2 block text-sm font-semibold">Login lub email</label>
                          <input
                            type="text"
                            placeholder="np. farmer123 lub gracz@plonopolis.pl"
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
                          Zaloguj i wróć do gry
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
                  </>
                ) : (
                  <div className="space-y-6 text-[#f3e6c8]">
                    <div className="rounded-3xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)] p-5">
                      <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Aktywna sesja</p>
                      <p className="mt-2 text-3xl font-black">{currentUser?.login}</p>
                      <p className="mt-1 text-sm text-[#d8c39b]">{currentUser?.email}</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Poziom gospodarstwa</p>
                        <p className="mt-2 text-3xl font-black">{currentUser?.save?.level ?? 1}</p>
                      </div>

                      <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Lokacja</p>
                        <p className="mt-2 text-3xl font-black">
                          {currentUser?.save?.location ?? "Startowa Polana"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <button className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-3 font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105">
                        Graj dalej
                      </button>

                      <button
                        onClick={handleMockSaveProgress}
                        className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-4 py-3 font-bold text-[#f3e6c8] transition hover:bg-[rgba(40,25,14,0.85)]"
                      >
                        Zapisz konto
                      </button>

                      <button
                        onClick={handleLogout}
                        className="rounded-2xl border border-red-400/40 bg-red-950/30 px-4 py-3 font-bold text-red-100 transition hover:bg-red-950/50"
                      >
                        Wyloguj
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <aside className="rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.82)] p-6 text-[#f3e6c8] shadow-2xl backdrop-blur-sm">
              <div className="inline-block rounded-full border border-[#d4a64f]/50 bg-[#d4a64f]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#f5d57f]">
                Ekran startowy
              </div>

              <h2 className="mt-4 text-3xl font-black text-[#f9e7b2]">Twoje gospodarstwo czeka</h2>
              <p className="mt-3 text-sm leading-6 text-[#dfcfab]">
                Ten plik działa jako ekran logowania do gry przeglądarkowej. Ma gotowe formularze,
                sesję w localStorage oraz przywracanie konta po odświeżeniu.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)] p-4">
                  <p className="font-bold text-[#f9e7b2]">Tło gry</p>
                  <p className="mt-2 text-sm text-[#dfcfab]">
                    Umieść grafikę dokładnie w:
                    <span className="ml-2 rounded bg-black/30 px-2 py-1 font-mono text-[#f5d57f]">
                      /public/assetsmain-lobby.png
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.45)] p-4">
                  <p className="font-bold text-[#f9e7b2]">Mock backend</p>
                  <p className="mt-2 text-sm text-[#dfcfab]">
                    Użytkownicy:
                    <span className="ml-2 rounded bg-black/30 px-2 py-1 font-mono text-[#f5d57f]">
                      plonopolis_users
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-[#dfcfab]">
                    Sesja:
                    <span className="ml-2 rounded bg-black/30 px-2 py-1 font-mono text-[#f5d57f]">
                      plonopolis_session
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-400/40 bg-amber-950/20 p-4 text-amber-100">
                  <p className="font-bold">Uwaga produkcyjna</p>
                  <p className="mt-2 text-sm leading-6">
                    Hasła w localStorage są tylko na etap mocka. Później przeniesiesz rejestrację i
                    logowanie do API oraz prawdziwej bazy danych.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
