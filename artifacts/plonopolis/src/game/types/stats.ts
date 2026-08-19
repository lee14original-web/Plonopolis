export const STATS_DEFS = [
  { key: "wiedza",    label: "Wiedza",    icon: "📚", img: "/ekwipunek/skill_wiedza.webp",    desc: "Rośliny rosną szybciej", rate: 0.0033, unlockLevel: 1,  eqLabel: " pkt Wiedzy"     },
  { key: "zrecznosc", label: "Zręczność", icon: "🎯", img: "/ekwipunek/skill_zrecznosc.webp", desc: "Podwójny zbiór",         rate: 0.004,  unlockLevel: 1,  eqLabel: " pkt Zrecznosci" },
  { key: "zaradnosc", label: "Zaradność", icon: "💧", img: "/ekwipunek/skill_zaradnosc.webp", desc: "Bonus podlewania",        rate: 0.004,  unlockLevel: 1,  eqLabel: " pkt Zaradnosci" },
  { key: "sadownik",  label: "Sadownik",  icon: "🌳", img: "/ekwipunek/skill_sadownik.webp",  desc: "Zysk z drzew + kompost", rate: 0.005,  unlockLevel: 10, eqLabel: " pkt Sadownika"  },
  { key: "opieka",    label: "Opieka",    icon: "🐄", img: "/ekwipunek/skill_opieka.webp",    desc: "Zdrowsze zwierzęta",     rate: 0.003,  unlockLevel: 3,  eqLabel: null               },
  { key: "szczescie", label: "Szczęście", icon: "🍀", img: "/ekwipunek/skill_szczescie.webp", desc: "Jakość plonów, ekwipunek, ulepszenia", rate: 0.0025, unlockLevel: 1, eqLabel: " pkt Szczescia"  },
] as const;

export type StatKey = typeof STATS_DEFS[number]["key"];
export type PlayerStatsMap = Record<StatKey, number>;
export const DEFAULT_STATS: PlayerStatsMap = { wiedza: 0, zrecznosc: 0, zaradnosc: 0, sadownik: 0, opieka: 0, szczescie: 0 };
