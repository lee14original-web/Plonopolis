"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ================= TYPES ================= */

type Profile = {
  id: string;
  login: string;
  level: number;
  money: number;
};

type PlotData = {
  plot_index: number;
  status: "empty" | "growing" | "ready";
  crop_type: string | null;
  planted_at: string | null;
  ready_at: string | null;
};

type Crop = {
  id: string;
  name: string;
  growTime: number;
  reward: number;
};

/* ================= CONFIG ================= */

const STARTING_PLOTS = 3;

const CROPS: Record<string, Crop> = {
  wheat: {
    id: "wheat",
    name: "Pszenica",
    growTime: 60,
    reward: 50,
  },
  carrot: {
    id: "carrot",
    name: "Marchew",
    growTime: 120,
    reward: 90,
  },
};

/* GRID 5x5 */
const FARM_PLOTS = Array.from({ length: 25 }).map((_, i) => {
  const row = Math.floor(i / 5);
  const col = i % 5;

  return {
    id: i + 1,
    left: `${40 + col * 6}%`,
    top: `${73 + row * 7}%`,
    width: "5.5%",
    height: "6.5%",
  };
});

/* ================= COMPONENT ================= */

export default function Page() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plotsData, setPlotsData] = useState<Record<number, PlotData>>({});
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const unlockedPlots = STARTING_PLOTS; // na razie stałe

  /* ================= INIT ================= */

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      await loadProfile(session.user.id);
      await loadPlots(session.user.id);
    }

    setReady(true);
  }

  /* ================= LOAD ================= */

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("id, login, level, money")
      .eq("id", userId)
      .single();

    setProfile(data);
  }

  async function loadPlots(userId: string) {
    const { data } = await supabase
      .from("farm_plots")
      .select("*")
      .eq("user_id", userId);

    const map: Record<number, PlotData> = {};

    data?.forEach((p) => {
      map[p.plot_index] = p;
    });

    setPlotsData(map);
  }

  /* ================= HELPERS ================= */

  function getPlotState(plot?: PlotData): "empty" | "growing" | "ready" {
    if (!plot) return "empty";

    if (plot.status === "growing" && plot.ready_at) {
      if (new Date(plot.ready_at) <= new Date()) {
        return "ready";
      }
    }

    return plot.status;
  }

  const moneyFormatted = useMemo(() => {
    if (!profile) return "0 zł";

    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 0,
    }).format(profile.money);
  }, [profile]);

  /* ================= ACTIONS ================= */

  async function plant(plotId: number, cropId: string) {
    if (!profile) return;

    const crop = CROPS[cropId];
    const now = new Date();
    const readyAt = new Date(now.getTime() + crop.growTime * 1000);

    await supabase.from("farm_plots").upsert({
      user_id: profile.id,
      plot_index: plotId,
      status: "growing",
      crop_type: crop.id,
      planted_at: now.toISOString(),
      ready_at: readyAt.toISOString(),
    });

    await loadPlots(profile.id);
  }

  async function harvest(plotId: number) {
    if (!profile) return;

    const plot = plotsData[plotId];
    if (!plot || !plot.crop_type) return;

    const crop = CROPS[plot.crop_type];

    await supabase
      .from("farm_plots")
      .update({
        status: "empty",
        crop_type: null,
        planted_at: null,
        ready_at: null,
      })
      .eq("user_id", profile.id)
      .eq("plot_index", plotId);

    await supabase
      .from("profiles")
      .update({
        money: profile.money + crop.reward,
      })
      .eq("id", profile.id);

    await loadProfile(profile.id);
    await loadPlots(profile.id);
  }

  /* ================= RENDER ================= */

  if (!ready) {
    return (
      <main className="flex h-screen items-center justify-center bg-black text-white">
        Ładowanie...
      </main>
    );
  }

  return (
    <main
      className="h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/farm1.png')" }}
    >
      {/* HUD */}
      {profile && (
        <div className="absolute top-4 left-4 bg-black/70 p-3 rounded text-white">
          <p>{profile.login}</p>
          <p>Poziom: {profile.level}</p>
          <p>{moneyFormatted}</p>
        </div>
      )}

      {/* POLA */}
      {FARM_PLOTS.slice(0, unlockedPlots).map((plot) => {
        const data = plotsData[plot.id];
        const state = getPlotState(data);

        return (
          <button
            key={plot.id}
            onClick={() => setSelectedPlotId(plot.id)}
            className={`absolute rounded border-2 ${
              state === "empty"
                ? "border-yellow-300 bg-yellow-200/10"
                : state === "growing"
                ? "border-blue-400 bg-blue-200/10"
                : "border-green-400 bg-green-200/20"
            }`}
            style={{
              left: plot.left,
              top: plot.top,
              width: plot.width,
              height: plot.height,
            }}
          />
        );
      })}

      {/* PANEL POLA */}
      {selectedPlotId && (
        <PlotPanel
          plotId={selectedPlotId}
          plotData={plotsData[selectedPlotId]}
          onClose={() => setSelectedPlotId(null)}
          onPlant={plant}
          onHarvest={harvest}
        />
      )}
    </main>
  );
}

/* ================= PANEL ================= */

function PlotPanel({
  plotId,
  plotData,
  onClose,
  onPlant,
  onHarvest,
}: {
  plotId: number;
  plotData?: PlotData;
  onClose: () => void;
  onPlant: (id: number, crop: string) => void;
  onHarvest: (id: number) => void;
}) {
  function getState(): "empty" | "growing" | "ready" {
    if (!plotData) return "empty";

    if (plotData.status === "growing" && plotData.ready_at) {
      if (new Date(plotData.ready_at) <= new Date()) return "ready";
    }

    return plotData.status;
  }

  const state = getState();

  return (
    <div className="absolute left-4 top-40 w-80 bg-black/90 p-4 rounded text-white">
      <h2 className="text-xl font-bold">Pole #{plotId}</h2>

      {/* GRID IMAGE */}
      <img src="/farm-grid.png" className="mt-3 rounded" />

      {/* ACTIONS */}
      {state === "empty" && (
        <button
          onClick={() => onPlant(plotId, "wheat")}
          className="mt-3 w-full bg-yellow-500 px-3 py-2 rounded"
        >
          Posiej pszenicę
        </button>
      )}

      {state === "growing" && (
        <p className="mt-3 text-blue-300">Rośnie...</p>
      )}

      {state === "ready" && (
        <button
          onClick={() => onHarvest(plotId)}
          className="mt-3 w-full bg-green-600 px-3 py-2 rounded"
        >
          Zbierz
        </button>
      )}

      <button
        onClick={onClose}
        className="mt-4 w-full text-red-400"
      >
        Zamknij
      </button>
    </div>
  );
}
