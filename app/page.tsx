"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  login: string;
  email: string;
  level?: number | null;
  xp?: number | null;
  xp_to_next_level?: number | null;
  money?: number | null;
  location?: string | null;
  current_map?: string | null;
};

const DEFAULT_LEVEL = 1;
const DEFAULT_XP = 0;
const DEFAULT_XP_TO_NEXT_LEVEL = 100;
const DEFAULT_MONEY = 10;
const DEFAULT_LOCATION = "Startowa Polana";
const DEFAULT_MAP = "farm1";

export default function Page() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [debug, setDebug] = useState("");

  const xpPercent = useMemo(() => {
    const xp = profile?.xp ?? DEFAULT_XP;
    const xpToNext = profile?.xp_to_next_level ?? DEFAULT_XP_TO_NEXT_LEVEL;
    if (!xpToNext) return 0;
    return Math.max(0, Math.min(100, Math.round((xp / xpToNext) * 100)));
  }, [profile]);

  const moneyFormatted = useMemo(() => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 0,
    }).format(profile?.money ?? DEFAULT_MONEY);
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, login, email, level, xp, xp_to_next_level, money, location, current_map")
            .eq("id", session.user.id)
            .maybeSingle();

          if (!mounted) return;

          if (error) {
            setDebug(`profile error: ${error.message}`);
          } else if (data) {
            setProfile(data as Profile);
            setDebug(`profile ok: ${data.login}`);
          } else {
            setDebug("profile not found");
          }
        } else {
          setDebug("no session");
        }
      } catch (error) {
        console.error(error);
        if (mounted) setDebug("bootstrap error");
      } finally {
        if (mounted) setReady(true);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    setDebug("wylogowano");
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

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1a130d] text-[#f3e6c8]">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-wide">Plonopolis</h1>
          <p className="mt-3 text-sm opacity-80">Brak aktywnej sesji</p>
          <p className="mt-2 text-xs opacity-60">{debug}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/farm1.png')" }}
    >
      <div className="min-h-screen bg-black/40">
        <button
          onClick={handleLogout}
          className="absolute right-4 top-4 z-20 rounded-2xl border border-red-400/40 bg-red-950/40 px-4 py-2 font-bold text-red-100 backdrop-blur-sm"
        >
          Wyloguj
        </button>

        <div className="mx-auto flex max-w-5xl justify-center px-4 pt-4">
          <div className="z-10 w-full max-w-3xl rounded-[24px] border border-[#8b6a3e] bg-[rgba(33,20,12,0.88)] px-4 py-3 text-[#f5dfb0] shadow-2xl backdrop-blur-sm">
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
                <p className="text-2xl font-black text-white">{profile.level ?? DEFAULT_LEVEL}</p>
              </div>

              <div className="rounded-2xl border border-[#8b6a3e] bg-black/20 px-4 py-2 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Pieniądze</p>
                <p className="text-2xl font-black text-white">{moneyFormatted}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex min-h-screen max-w-6xl items-end justify-start px-4 pb-8 pt-20">
          <div className="rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.82)] p-5 text-[#f3e6c8] shadow-2xl backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Sesja wczytana</p>
            <h2 className="mt-2 text-3xl font-black text-[#f9e7b2]">{profile.login}</h2>
            <p className="mt-2 text-sm text-[#dfcfab]">Mapa: {profile.current_map ?? DEFAULT_MAP}</p>
            <p className="mt-2 text-sm text-[#dfcfab]">Lokacja: {profile.location ?? DEFAULT_LOCATION}</p>
            <p className="mt-2 text-xs opacity-60">{debug}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
