import { MAX_FIELDS } from "./game";
import type { FarmPlot, FieldViewPlotLayout } from "../types/farm";

export const FARM_PLOTS: FarmPlot[] = Array.from({ length: MAX_FIELDS }, (_, index) => ({
  id: index + 1,
  left: "0%",
  top: "0%",
  width: "0%",
  height: "0%",
}));

// Grid 10×10 — pola numerowane wierszami od lewej do prawej, z góry na dół
const _FH_OX = 16.83, _FH_OY = 4.15, _FH_CW = 6.59, _FH_CH = 9.01;
const _COLS = Array.from({ length: 10 }, (_, i) => parseFloat((_FH_OX + i * _FH_CW).toFixed(2)));
const _ROWS = Array.from({ length: 10 }, (_, i) => parseFloat((_FH_OY + i * _FH_CH).toFixed(2)));

export const FIELD_VIEW_PLOTS: FieldViewPlotLayout[] = Array.from({ length: 100 }, (_, i) => {
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

export const CHWASTY_IMGS   = ["/przeszkody/chwasty1.png",  "/przeszkody/chwasty2.png",  "/przeszkody/chwasty3.png"]  as const;
export const KRET_IMGS      = ["/przeszkody/kret1.png",     "/przeszkody/kret2.png",     "/przeszkody/kret3.png"]     as const;
export const PIEN_IMGS      = ["/przeszkody/pien1.png",     "/przeszkody/pien2.png",     "/przeszkody/pien3.png"]     as const;
export const DRZEWO_IMGS    = ["/przeszkody/drzewo1.png",   "/przeszkody/drzewo2.png",   "/przeszkody/drzewo3.png"]   as const;
export const KAMIENIE_IMGS  = ["/przeszkody/kamienie1.png", "/przeszkody/kamienie2.png", "/przeszkody/kamienie3.png"] as const;

export const OBSTACLE_DEFS: Record<string, { name: string; icon: string; color: string }> = {
  chwasty:   { name: "Chwasty",   icon: "🌿", color: "#86efac" },
  kamienie:  { name: "Kamienie",  icon: "🪨", color: "#d1d5db" },
  maly_pien: { name: "Mały pień", icon: "🪵", color: "#d97706" },
  duzy_pien: { name: "Drzewo",    icon: "🌲", color: "#a16207" },
  kret:      { name: "Kret",      icon: "🐾", color: "#a8a29e" },
};

// Stałe koszty usunięcia przeszkód — obliczane lokalnie, niezależne od wartości w bazie.
export const OBSTACLE_FIXED_COSTS: Record<string, number> = {
  chwasty:   15,
  kamienie:  50,
  maly_pien: 150,
  duzy_pien: 250,
  kret:      500,
};
