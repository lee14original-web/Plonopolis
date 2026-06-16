import type { CharEquipItem, EquipSlot, CharEquipped } from "../types/equipment";

export const CHAR_EQUIP_ITEMS: CharEquipItem[] = [
  // ─── DŁONIE (LVL 1–25, jeden per poziom) ───
  { id: "d1",  name: "Spracowane Rękawice",     slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d1_spracowane_rekawice.png",   unlockLevel: 1,  bonuses: [{ base: 1,  label: " pkt Wiedzy", flat: true }], desc: "Widać po nich wiele sezonów, błota i uczciwej pracy." },
  { id: "d2",  name: "Rękawice Siewcy",         slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d2_rekawice_siewcy.png",         unlockLevel: 2,  bonuses: [{ base: 1,  label: " pkt Wiedzy", flat: true }], desc: "Idealne do sadzenia pierwszych marzeń i marchewek." },
  { id: "d3",  name: "Rękawice Rolnika",        slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d3_rekawice_rolnika.png",        unlockLevel: 3,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }], desc: "Pewny chwyt, nawet gdy plony próbują uciec." },
  { id: "d4",  name: "Grabie Ogrodnika",        slot: "dlonie", icon: "🌿", img: "/ekwipunek/rece/d4_grabie_ogrodnika.png",        unlockLevel: 4,  bonuses: [{ base: 1,  label: " pkt Wiedzy", flat: true }], desc: "Niezastąpione przy liściach, chwastach i podejrzanych kopczykach." },
  { id: "d5",  name: "Rękawice Ziemi",          slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d5_rekawice_ziemi.png",          unlockLevel: 5,  bonuses: [{ base: 2,  label: " pkt Sadownika", flat: true }], desc: "Zawsze trochę brudne. Tak powinno być." },
  { id: "d6",  name: "Łopata Polowa",           slot: "dlonie", icon: "🌿", img: "/ekwipunek/rece/d6_lopata_polowa.png",           unlockLevel: 6,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }], desc: "Prosta, solidna i gotowa na każde pole." },
  { id: "d7",  name: "Rękawice Urodzaju",       slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d7_rekawice_urodzaju.png",       unlockLevel: 7,  bonuses: [{ base: 1,  label: " pkt Zrecznosci", flat: true }], desc: "Czasem plony rosną lepiej, gdy nikt nie patrzy." },
  { id: "d8",  name: "Kosz Zbieracza",          slot: "dlonie", icon: "🧺", img: "/ekwipunek/rece/d8_kosz_zbieracza.png",          unlockLevel: 8,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }], desc: "Pomieści więcej, niż wygląda. Farmerzy nie pytają jak." },
  { id: "d9",  name: "Motyka Rolna",            slot: "dlonie", icon: "⛏️", img: "/ekwipunek/rece/d9_motyka_rolna.png",            unlockLevel: 9,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }], desc: "Ulubione narzędzie tych, którzy wolą działać niż narzekać." },
  { id: "d10", name: "Sekator Sadu",            slot: "dlonie", icon: "✂️", img: "/ekwipunek/rece/d10_sekator_sadu.png",           unlockLevel: 10, bonuses: [{ base: 3,  label: "% speed drzew" }], desc: "Precyzyjny jak sadownik przy ostatnim jabłku sezonu." },
  { id: "d11", name: "Rękawice Farmera",        slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d11_rekawice_farmera.png",       unlockLevel: 11, bonuses: [{ base: 2,  label: "% EXP z upraw" }], desc: "Dobre do wszystkiego: siania, zbierania i machania sąsiadowi." },
  { id: "d12", name: "Rękawice Zbiorów",        slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d12_rekawice_zbiorow.png",       unlockLevel: 12, bonuses: [{ base: 1,  label: " pkt Zrecznosci", flat: true }], desc: "Gdy czas zbiorów nadchodzi, same pchają się do pracy." },
  { id: "d13", name: "Narzędzia Sadownika",     slot: "dlonie", icon: "🔧", img: "/ekwipunek/rece/d13_narzedzia_sadownika.png",    unlockLevel: 13, bonuses: [{ base: 4,  label: "% speed drzew" }], desc: "Zestaw dla cierpliwych mistrzów gałęzi, owoców i cienia." },
  { id: "d14", name: "Rękawice Nawadniania",    slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d14_rekawice_nawadniania.png",   unlockLevel: 14, bonuses: [{ base: 3,  label: " pkt Zaradnosci", flat: true }], desc: "Nie boją się wody. Czasem nawet jej szukają." },
  { id: "d15", name: "Rękawice Hodowcy",        slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d15_rekawice_hodowcy.png",       unlockLevel: 15, bonuses: [{ base: 3,  label: "% reward zwierząt" }], desc: "Delikatne dla zwierząt, stanowcze dla bałaganu." },
  { id: "d16", name: "Srebrny Sekator",         slot: "dlonie", icon: "✂️", img: "/ekwipunek/rece/d16_srebrny_sekator.png",        unlockLevel: 16, bonuses: [{ base: 5,  label: "% speed drzew" }], desc: "Błyszczy tak mocno, że jabłka same stają w kolejce." },
  { id: "d17", name: "Rękawice Plonów",         slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d17_rekawice_plonow.png",        unlockLevel: 17, bonuses: [{ base: 2,  label: " pkt Zrecznosci", flat: true }], desc: "Stworzone dla dłoni, które znają wartość każdego zbioru." },
  { id: "d18", name: "Widły Farmera",           slot: "dlonie", icon: "🌿", img: "/ekwipunek/rece/d18_widly_farmera.png",          unlockLevel: 18, bonuses: [{ base: 4,  label: "% EXP z upraw" }], desc: "Klasyczne widły. Do siana, pracy i groźnego pozowania." },
  { id: "d19", name: "Narzędzia Mistrza",       slot: "dlonie", icon: "🔧", img: "/ekwipunek/rece/d19_narzedzia_mistrza.png",      unlockLevel: 19, bonuses: [{ base: 3,  label: " pkt Wiedzy", flat: true }], desc: "Nie pytaj, ile sezonów trzeba, by na nie zasłużyć." },
  { id: "d20", name: "Rękawice Pszczelarza",    slot: "dlonie", icon: "🐝", img: "/ekwipunek/rece/d20_rekawice_pszczelarza.png",   unlockLevel: 20, bonuses: [{ base: 20, label: "% zużycia stroju" }], desc: "Dają odwagę tam, gdzie inni słyszą tylko bzyczenie." },
  { id: "d21", name: "Motyka Obfitości",        slot: "dlonie", icon: "⛏️", img: "/ekwipunek/rece/d21_motyka_obfitosci.png",        unlockLevel: 21, bonuses: [{ base: 2,  label: " pkt Zrecznosci", flat: true }], desc: "Ziemia podobno ją lubi. Plony też." },
  { id: "d22", name: "Rękawice Żniwiarza",      slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d22_rekawice_zniwiarza.png",       unlockLevel: 22, bonuses: [{ base: 4,  label: " pkt Wiedzy", flat: true }], desc: "Szybkie, wytrzymałe i gotowe na wielki finał sezonu." },
  { id: "d23", name: "Sekator Premium",         slot: "dlonie", icon: "✂️", img: "/ekwipunek/rece/d23_sekator_premium.png",          unlockLevel: 23, bonuses: [{ base: 6,  label: "% speed drzew" }], desc: "Tnie gałązki z taką gracją, że sad milknie z podziwu." },
  { id: "d24", name: "Rękawice Natury",         slot: "dlonie", icon: "🧤", img: "/ekwipunek/rece/d24_rekawice_natury.png",           unlockLevel: 24, bonuses: [{ base: 3,  label: " pkt Wiedzy", flat: true }], desc: "Ciepłe, wygodne i dziwnie dobrze dogadują się z ziemią." },
  { id: "d25", name: "Mistyczne Dłonie Farmy",  slot: "dlonie", icon: "✨", img: "/ekwipunek/rece/d25_mistyczne_dlonie_farmy.png",   unlockLevel: 25, bonuses: [{ base: 3,  label: " pkt Wiedzy", flat: true }, { base: 2, label: " pkt Zrecznosci", flat: true }], desc: "Legenda mówi, że potrafią obudzić plon jednym kliknięciem." },
  // ─── NOGI (LVL 1–30) ───
  { id: "n1",  name: "Stare Kalosze",           slot: "nogi", icon: "👢", img: "/ekwipunek/nogi/n1_stare_kalosze.png",           unlockLevel: 1,  bonuses: [{ base: 2,  label: " pkt Wiedzy", flat: true }], desc: "Trochę skrzypią, ale znają drogę na każde pole." },
  { id: "n2",  name: "Kalosze Rolnika",         slot: "nogi", icon: "👢", img: "/ekwipunek/nogi/n2_kalosze_rolnika.png",         unlockLevel: 3,  bonuses: [{ base: 3,  label: " pkt Wiedzy", flat: true }], desc: "Solidne obuwie do błota, deszczu i porannych obchodów." },
  { id: "n3",  name: "Buty Polowe",             slot: "nogi", icon: "👢", img: "/ekwipunek/nogi/n3_buty_polowe.png",             unlockLevel: 6,  bonuses: [{ base: 5,  label: "% efekt podlewania" }], desc: "Lekkie kroki, ciężka praca." },
  { id: "n4",  name: "Buty Zbieracza",          slot: "nogi", icon: "👢", img: "/ekwipunek/nogi/n4_buty_zbieracza.png",          unlockLevel: 9,  bonuses: [{ base: 4,  label: " pkt Wiedzy", flat: true }], desc: "Pomagają dotrzeć do plonów, zanim zrobi to ktoś inny." },
  { id: "n5",  name: "Buty Błotne",             slot: "nogi", icon: "👢", img: "/ekwipunek/nogi/n5_buty_blotne.png",             unlockLevel: 12, bonuses: [{ base: 8,  label: "% efekt podlewania" }], desc: "Im więcej błota, tym bardziej czują się jak w domu." },
  { id: "n6",  name: "Ostrogi Hodowcy",         slot: "nogi", icon: "⚡", img: "/ekwipunek/nogi/n6_ostrogi_hodowcy.png",         unlockLevel: 15, bonuses: [{ base: 6,  label: "% reward zwierząt" }], desc: "Dla tych, którzy potrafią dogadać się nawet z upartą kurą." },
  { id: "n7",  name: "Szybkie Kalosze",         slot: "nogi", icon: "👢", img: "/ekwipunek/nogi/n7_szybkie_kalosze.png",         unlockLevel: 18, bonuses: [{ base: 6,  label: " pkt Wiedzy", flat: true }], desc: "Nie pytaj, czemu są szybkie. Po prostu biegnij." },
  { id: "n8",  name: "Buty Sadownika",          slot: "nogi", icon: "🥾", img: "/ekwipunek/nogi/n8_buty_sadownika.png",          unlockLevel: 21, bonuses: [{ base: 8,  label: "% speed drzew" }], desc: "Wygodne pod drzewami i podczas polowania na idealne jabłko." },
  { id: "n9",  name: "Buty Zaradności",         slot: "nogi", icon: "👢", img: "/ekwipunek/nogi/n9_buty_zaradnosci.png",         unlockLevel: 24, bonuses: [{ base: 10, label: "% efekt podlewania" }], desc: "Przydatne, gdy plan A został zjedzony przez kozę." },
  { id: "n10", name: "Buty Burzy",              slot: "nogi", icon: "⚡", img: "/ekwipunek/nogi/n10_buty_burzy.png",             unlockLevel: 27, bonuses: [{ base: 12, label: " pkt Wiedzy", flat: true }], desc: "Deszcz, wiatr, błoto? Brzmi jak dobry dzień na farmie." },
  { id: "n11", name: "Legendarne Kalosze",      slot: "nogi", icon: "👑", img: "/ekwipunek/nogi/n11_legendarne_kalosze.png",     unlockLevel: 30, bonuses: [{ base: 10, label: " pkt Wiedzy", flat: true }], desc: "Podobno zostawiają ślady w kształcie małych marchewek." },
  // ─── GŁOWA (LVL 1–30) ───
  { id: "g1",  name: "Słomkowy Kapelusz",       slot: "glowa", icon: "👒", img: "/ekwipunek/glowa/g1_slomkowy_kapelusz.png",      unlockLevel: 1,  bonuses: [{ base: 5,  label: "% EXP z upraw" }], desc: "Lekki kapelusz chroniący przed słońcem i ciekawskimi wróblami." },
  { id: "g2",  name: "Kapelusz Rolnika",        slot: "glowa", icon: "👒", img: "/ekwipunek/glowa/g2_kapelusz_rolnika.png",         unlockLevel: 5,  bonuses: [{ base: 5,  label: "% EXP z upraw" }, { base: 3, label: " pkt Wiedzy", flat: true }], desc: "Klasyka pola. Pachnie sianem, pracą i poranną kawą." },
  { id: "g3",  name: "Kapelusz Pszczelarza",    slot: "glowa", icon: "🐝", img: "/ekwipunek/glowa/g3_kapelusz_pszczelarza.png",     unlockLevel: 10, bonuses: [{ base: 10, label: "% produkcji miodu" }, { base: 5, label: " pkt Wiedzy", flat: true }], desc: "Pomaga zachować spokój, gdy pszczoły mają inne zdanie." },
  { id: "g4",  name: "Czapka Szczęścia",        slot: "glowa", icon: "🍀", img: "/ekwipunek/glowa/g4_czapka_szczescia.png",         unlockLevel: 15, bonuses: [{ base: 5,  label: " pkt Szczescia", flat: true }, { base: 3, label: " pkt Zrecznosci", flat: true }, { base: 5, label: "% EXP" }], desc: "Podobno zwiększa szczęście. Podobno." },
  { id: "g5",  name: "Korona Sadownika",        slot: "glowa", icon: "👑", img: "/ekwipunek/glowa/g5_korona_sadownika.png",         unlockLevel: 20, bonuses: [{ base: 10, label: "% speed drzew" }, { base: 5, label: "% reward zwierząt" }, { base: 5, label: " pkt Wiedzy", flat: true }], desc: "Dla tych, którzy wiedzą, że jabłko to nie tylko owoc, ale styl życia." },
  { id: "g6",  name: "Kapelusz Mistrza Farmy",  slot: "glowa", icon: "🎓", img: "/ekwipunek/glowa/g6_kapelusz_mistrza_farmy.png",  unlockLevel: 25, bonuses: [{ base: 10, label: " pkt Wiedzy", flat: true }, { base: 10, label: "% EXP" }, { base: 3, label: " pkt Zrecznosci", flat: true }], desc: "Noszony przez farmerów, którzy podlewali nawet w deszczu." },
  { id: "g7",  name: "Korona Plonopolis",       slot: "glowa", icon: "👑", img: "/ekwipunek/glowa/g7_korona_plonopolis.png",        unlockLevel: 30, bonuses: [{ base: 8,  label: " pkt Wiedzy", flat: true }, { base: 8, label: "% speed drzew" }, { base: 8, label: "% reward zwierząt" }, { base: 5, label: " pkt Zrecznosci", flat: true }], desc: "Symbol prawdziwej legendy pól, sadów i bardzo cierpliwego klikania." },
];

export const EQUIP_SLOT_META: Record<EquipSlot, { label: string; icon: string; desc: string }> = {
  dlonie: { label: "Dłonie", icon: "🧤", desc: "Rękawice, narzędzia, przedmioty robocze" },
  nogi:   { label: "Nogi",   icon: "👢", desc: "Tempo i szybkość gry" },
  glowa:  { label: "Głowa",  icon: "🪖", desc: "Strategia i inteligencja" },
};

export const DEFAULT_CHAR_EQUIPPED: CharEquipped = { dlonie: null, nogi: null, glowa: null };

// ─── Materiały ze zwierząt: M1..M10 → ID przedmiotu zwierzęcego ───
export const TIER_MATERIAL: Record<number, string> = {
  1: "jajko", 2: "piora", 3: "futro_krolika", 4: "nawoz_naturalny", 5: "mleko",
  6: "welna", 7: "mleko_kozie", 8: "duze_piora", 9: "energia_robocza", 10: "rogi_byka",
};

export const UPG_COLOR = ["#6b7280", "#9ca3af", "#9ca3af", "#9ca3af", "#4ade80", "#4ade80", "#4ade80", "#fbbf24", "#fbbf24", "#fbbf24", "#fbbf24"];

// ─── Bazowe koszty ulepszenia (index = poziom docelowy +1..+10) ───
export const UPGRADE_COST   = [0, 50, 100, 250, 500, 1200, 2500, 5000, 10000, 20000, 40000];
export const UPGRADE_CHANCE = [1, 0.95, 0.90, 0.90, 0.85, 0.80, 0.70, 0.60, 0.45, 0.35, 0.20];
