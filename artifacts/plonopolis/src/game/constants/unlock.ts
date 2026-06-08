export const HIVE_UNLOCK_LVL    = 10;  // od którego poziomu gracza odblokowany jest ul
export const BARN_UNLOCK_LVL    = 3;   // od którego poziomu gracza odblokowana jest stodoła (lvl pierwszego zwierzęcia — Kura)
export const SAD_UNLOCK_LVL     = 10;  // od którego poziomu gracza odblokowany jest sad
export const LADA_UNLOCK_LVL    = 2;   // od którego poziomu gracza odblokowana jest lada dla klientów
export const KOMPOST_UNLOCK_LVL = 2;   // od którego poziomu gracza odblokowany jest kompostownik
export const CITY_UNLOCK_LVL    = 2;   // od którego poziomu gracza odblokowane jest miasto
export const HIVE_BUY_COST      = 250; // koszt zakupu ula (lvl 0 → 1)
export const BEE_COST           = 75;  // koszt 1 pszczoły
export const HIVE_MIN_BEES_TO_PRODUCE = 5; // ile pszczół musi być żeby ul zaczął produkować miód

// ═══ CZAS AKCJI POLOWYCH (sadzenie/zbiór) ═══
export const BASE_PLANT_MS   = 200;
export const BASE_HARVEST_MS = 200;
export const BASE_WATER_MS   = 400;

// ─── Predefiniowane pozycje okna tutoriala (per-step) ───
export const TUT_PANEL_PRESET_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 666, y: 785 },
  2: { x: 603, y: 460 },
  3: { x: 609, y: 825 },
  4: { x: 602, y: 444 },
  5: { x: 602, y: 560 },
  6: { x: 603, y: 843 },
  7: { x: 601, y: 836 },
  8: { x: 919, y: 1087 },
};

// ═══ BALANS WZROSTU UPRAW (capy bonusów + globalne minimum) ═══
export const GROWTH_GLOBAL_MIN_MULT = 0.35; // cap −65% TOTAL
export const WIEDZA_RATE            = 0.0033;
export const ZARADNOSC_RATE         = 0.004;
export const WIEDZA_MULT_MIN        = 0.75;  // cap −25% (z Wiedzy)
export const HIVE_MULT_MIN          = 0.50;  // cap −50%
export const EQUIP_GROWTH_MULT_MIN  = 0.75;  // cap −25% (z eq "% speed upraw")
export const COMPOST_MULT_MIN       = 0.80;  // cap −20% (z Kompostu Wzrostu)
export const WATER_BASE             = 0.05;  // min 5% zawsze z konewki
export const WATER_MULT_MIN         = 0.10;  // globalny min: konewka nie skróci więcej niż 90%
