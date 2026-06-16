import type { PlayerStatsMap } from "../types/stats";

export const SKINS_MALE = [
  "/avatary/avatar_m1.png", "/avatary/avatar_m2.png", "/avatary/avatar_m3.png", "/avatary/avatar_m4.png", "/avatary/avatar_m5.png",
  "/avatary/avatar_m6.png", "/avatary/avatar_m7.png", "/avatary/avatar_m8.png", "/avatary/avatar_m9.png", "/avatary/avatar_m10.png",
];
export const SKINS_FEMALE = [
  "/avatary/avatar_f1.png", "/avatary/avatar_f2.png", "/avatary/avatar_f3.png", "/avatary/avatar_f4.png", "/avatary/avatar_f5.png",
  "/avatary/avatar_f6.png", "/avatary/avatar_f7.png", "/avatary/avatar_f8.png", "/avatary/avatar_f9.png", "/avatary/avatar_f10.png",
];
export const EPIC_SKINS: { path: string; name: string; cost: Record<string, number> }[] = [
  { path: "/avatary/avatar_epic1.png",  name: "Król Marchewek",       cost: { "carrot_good": 500 } },
  { path: "/avatary/avatar_epic2.png",  name: "Zielona Moc",          cost: { "carrot_epic": 20 } },
  { path: "/avatary/avatar_epic3.png",  name: "Plon Bogów",           cost: { "carrot_legendary": 1 } },
  { path: "/avatary/avatar_epic4.png",  name: "Władca Pól",           cost: { "potato_epic": 5, "carrot_epic": 5 } },
  { path: "/avatary/avatar_epic5.png",  name: "Legenda Farmy",        cost: { "potato_legendary": 1 } },
  { path: "/avatary/avatar_epic6.png",  name: "Bitwa Królów",         cost: { "money": 10 } },
  { path: "/avatary/avatar_epic7.png",  name: "Królowa Truskawek",    cost: { "money": 10 } },
  { path: "/avatary/avatar_epic8.png",  name: "Król Dyń",             cost: { "money": 10 } },
  { path: "/avatary/avatar_epic9.png",  name: "Złoty Wojownik",       cost: { "money": 10 } },
  { path: "/avatary/avatar_epic10.png", name: "Czarodziej Jagód",     cost: { "money": 10 } },
  { path: "/avatary/avatar_epic11.png", name: "Pirat Arbuzów",        cost: { "money": 10 } },
  { path: "/avatary/avatar_epic12.png", name: "Diabelski Pomidor",    cost: { "money": 10 } },
  { path: "/avatary/avatar_epic13.png", name: "Królowa Pszczół",      cost: { "money": 10 } },
  { path: "/avatary/avatar_epic14.png", name: "Strach na Wróble",     cost: { "money": 10 } },
  { path: "/avatary/avatar_epic15.png", name: "Królowa Kur",          cost: { "money": 10 } },
  { path: "/avatary/avatar_epic16.png", name: "Duch Farmera",         cost: { "money": 10 } },
  { path: "/avatary/avatar_epic17.png", name: "Traktor Gigant",       cost: { "money": 10 } },
  { path: "/avatary/avatar_epic18.png", name: "Miodowa Wróżka",       cost: { "money": 10 } },
  { path: "/avatary/avatar_epic19.png", name: "Pszczółka Królewska",  cost: { "money": 10 } },
  { path: "/avatary/avatar_epic20.png", name: "Duch Jabłoni",         cost: { "money": 10 } },
  { path: "/avatary/avatar_epic21.png", name: "Kombajn",              cost: { "money": 10 } },
];
export const EPIC_SKIN_START = 20; // indeksy 20–40
export const ALL_SKINS = [...SKINS_MALE, ...SKINS_FEMALE, ...EPIC_SKINS.map(s => s.path)];
export const NON_EPIC_SKINS = [...SKINS_MALE, ...SKINS_FEMALE];

export const AVATAR_BONUSES: Record<number, Partial<PlayerStatsMap>> = {
  // Mężczyźni (0-9)
  0:  { wiedza: 4, opieka: 3, szczescie: 3 },
  1:  { zrecznosc: 5, zaradnosc: 3, wiedza: 2 },
  2:  { wiedza: 6, zaradnosc: 2, szczescie: 2 },
  3:  { zrecznosc: 4, szczescie: 4, wiedza: 2 },
  4:  { zaradnosc: 5, wiedza: 3, sadownik: 2 },
  5:  { wiedza: 5, zrecznosc: 3, zaradnosc: 2 },
  6:  { sadownik: 6, szczescie: 2, wiedza: 2 },
  7:  { opieka: 6, szczescie: 2, zaradnosc: 2 },
  8:  { szczescie: 6, zrecznosc: 2, opieka: 2 },
  9:  { opieka: 4, zrecznosc: 3, szczescie: 3 },
  // Kobiety (10-19)
  10: { opieka: 5, szczescie: 3, zaradnosc: 2 },
  11: { wiedza: 5, zrecznosc: 3, zaradnosc: 2 },
  12: { sadownik: 4, wiedza: 3, szczescie: 3 },
  13: { zaradnosc: 4, wiedza: 3, opieka: 3 },
  14: { wiedza: 6, szczescie: 2, zrecznosc: 2 },
  15: { wiedza: 3, zrecznosc: 3, zaradnosc: 2, szczescie: 2 },
  16: { szczescie: 5, zaradnosc: 3, sadownik: 2 },
  17: { zrecznosc: 5, wiedza: 3, zaradnosc: 2 },
  18: { opieka: 6, szczescie: 2, zaradnosc: 2 },
  19: { wiedza: 4, opieka: 3, sadownik: 3 },
  // Epickie (20-24) — oryginalne
  20: { wiedza: 12, szczescie: 10, zrecznosc: 8 },
  21: { zaradnosc: 12, szczescie: 10, sadownik: 8 },
  22: { wiedza: 6, zrecznosc: 6, zaradnosc: 6, sadownik: 6, opieka: 3, szczescie: 3 },
  23: { zrecznosc: 14, wiedza: 10, szczescie: 6 },
  24: { opieka: 14, sadownik: 8, szczescie: 8 },
  // Epickie (25-40) — nowe
  25: { wiedza: 10, zrecznosc: 10, szczescie: 10 },
  26: { szczescie: 14, opieka: 10, zaradnosc: 6 },
  27: { sadownik: 12, opieka: 10, szczescie: 8 },
  28: { zrecznosc: 14, zaradnosc: 10, szczescie: 6 },
  29: { wiedza: 14, szczescie: 10, zrecznosc: 6 },
  30: { zaradnosc: 14, szczescie: 10, opieka: 6 },
  31: { zrecznosc: 12, wiedza: 8, szczescie: 5, zaradnosc: 5 },
  32: { sadownik: 10, opieka: 10, szczescie: 10 },
  33: { wiedza: 10, zrecznosc: 10, zaradnosc: 10 },
  34: { opieka: 14, szczescie: 10, sadownik: 6 },
  35: { szczescie: 14, wiedza: 10, zaradnosc: 6 },
  36: { zrecznosc: 14, zaradnosc: 10, wiedza: 6 },
  37: { sadownik: 12, opieka: 10, szczescie: 8 },
  38: { sadownik: 14, szczescie: 10, opieka: 6 },
  39: { sadownik: 14, wiedza: 10, szczescie: 6 },
  40: { zrecznosc: 14, zaradnosc: 10, szczescie: 6 },
};

export const AVATAR_META: Record<number, { name: string; style: string }> = {
  0:  { name: "Stary Farmer",              style: "zbalansowany farmer"     },
  1:  { name: "Farmer z widlami",          style: "szybki zbior"            },
  2:  { name: "Farmer z rzodkiewkami",     style: "mistrz upraw"            },
  3:  { name: "Mlody farmer",              style: "szybkosc i lupy"         },
  4:  { name: "Kierowca traktora",         style: "ekonomia"                },
  5:  { name: "Farmer w kombajnie",        style: "specjalista pol"         },
  6:  { name: "Sadownik",                  style: "sad i drzewa"            },
  7:  { name: "Hodowca",                   style: "hodowla zwierzat"        },
  8:  { name: "Chlopiec z kotem",          style: "rzadkie dropy"           },
  9:  { name: "Farmer przy kurach",        style: "poczatkujacy hodowca"    },
  10: { name: "Farmerka z pieskiem",       style: "zwierzeta i szczescie"   },
  11: { name: "Farmerka z motyka",         style: "szybkie farmienie"       },
  12: { name: "Ogrodniczka z kwiatami",    style: "sad i kwiaty"            },
  13: { name: "Kucharka farmy",            style: "wydajna farma"           },
  14: { name: "Farmerka z koszem warzyw",  style: "specjalistka upraw"      },
  15: { name: "Farmerka w stodole",        style: "zbalansowany rozwoj"     },
  16: { name: "Handlarka farmy",           style: "handel i dropy"          },
  17: { name: "Farmerka sadzaca rosliny",  style: "szybki zbior"            },
  18: { name: "Hodowczyni zwierzat",       style: "mistrzyni zwierzat"      },
  19: { name: "Babcia farmerka",           style: "doswiadczona farmerka"   },
  20: { name: "Krol Marchewek",            style: "mistrz upraw"            },
  21: { name: "Zielona Moc",               style: "ekonomia i handel"       },
  22: { name: "Plon Bogow",                style: "idealny balans"          },
  23: { name: "Wladca Pol",                style: "szybki rozwoj"           },
  24: { name: "Legenda Farmy",             style: "mistrz hodowli"          },
  25: { name: "Bitwa Krolow",              style: "zbalansowany mistrz"     },
  26: { name: "Krolowa Truskawek",         style: "szczescie i opieka"      },
  27: { name: "Krol Dyn",                  style: "sad i hodowla"           },
  28: { name: "Zloty Wojownik",            style: "szybkosc i handel"       },
  29: { name: "Czarodziej Jagod",          style: "wiedza i magia"          },
  30: { name: "Pirat Arbuzow",             style: "handel i przygoda"       },
  31: { name: "Diabelski Pomidor",         style: "ognisty bojownik"        },
  32: { name: "Krolowa Pszczol",           style: "sad i miod"              },
  33: { name: "Strach na Wroble",          style: "wszechstronny"           },
  34: { name: "Krolowa Kur",              style: "mistrzyni hodowli"       },
  35: { name: "Duch Farmera",              style: "tajemnicze szczescie"    },
  36: { name: "Traktor Gigant",            style: "mechanik pol"            },
  37: { name: "Miodowa Wrozka",            style: "sad i magia"             },
  38: { name: "Pszczolka Krolewska",       style: "mistrz pszczol"          },
  39: { name: "Duch Jabloni",              style: "duch sadu"               },
  40: { name: "Kombajn",                   style: "zbior i handel"          },
};

export const AVATAR_CHANGE_TIERS: { cost: number; cooldownMs: number }[] = [
  { cost: 0,     cooldownMs: 0               },  // 1. zmiana gratis
  { cost: 0,     cooldownMs: 0               },  // 2. zmiana gratis
  { cost: 5000,  cooldownMs: 1 * 3600 * 1000 },  // 3. zmiana
  { cost: 15000, cooldownMs: 3 * 3600 * 1000 },  // 4. zmiana
];
