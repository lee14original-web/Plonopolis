import type { AnimalItemDef, AnimalDef } from "../types/barn";

function barnSlotCosts(buyPrice: number, upgrades: number): number[] {
  const r: number[] = [];
  let c = Math.round(buyPrice * 0.17);
  for (let i = 0; i < upgrades; i++) {
    r.push(c);
    c = Math.round(c * 1.6);
  }
  return r;
}

export const ANIMAL_ITEMS: AnimalItemDef[] = [
  { id: "jajko",           name: "Jajko",           icon: "🥚", sellPrice: 40,    n1: "jajko",         n24: "jajka",        n5: "jajek"          },
  { id: "futro_krolika",   name: "Futro Królika",    icon: "🐇", sellPrice: 80,    n1: "futro",         n24: "futra",        n5: "futer"          },
  { id: "mleko",           name: "Mleko",            icon: "🥛", sellPrice: 140,   n1: "mleko",         n24: "mleka",        n5: "mleka"          },
  { id: "piora",           name: "Pióra",            icon: "🪶", sellPrice: 220,   n1: "pióro",         n24: "pióra",        n5: "piór"           },
  { id: "welna",           name: "Wełna",            icon: "🧶", sellPrice: 320,   n1: "wełnę",         n24: "wełny",        n5: "wełny"          },
  { id: "nawoz_naturalny", name: "Nawóz Naturalny",  icon: "💩", sellPrice: 450,   n1: "nawóz",         n24: "nawozy",       n5: "nawozów"        },
  { id: "mleko_kozie",     name: "Mleko Kozie",      icon: "🥛", sellPrice: 600,   n1: "mleko kozie",   n24: "mleka kozie",  n5: "mleka koziego"  },
  { id: "duze_piora",      name: "Duże Pióra",       icon: "🪶", sellPrice: 800,   n1: "pióro",         n24: "pióra",        n5: "piór"           },
  { id: "energia_robocza", name: "Energia Robocza",  icon: "⚡", sellPrice: 1100,  n1: "energię",       n24: "energie",      n5: "energii"        },
  { id: "rogi_byka",       name: "Rogi Byka",        icon: "🐂", sellPrice: 1600,  n1: "róg",           n24: "rogi",         n5: "rogów"          },
];

export const ANIMALS: AnimalDef[] = [
  { id: "kura",   name: "Kura",    icon: "🐔", unlockLevel: 3,  prodMs: 4  * 3600000, itemId: "jajko",           storageMax: 1, startSlots: 2, maxSlots: 24, buyPrice: 600,
    slotUpgCosts: barnSlotCosts(600, 22),
    feed: [{ cropId: "carrot",  name: "Marchew",   icon: "🥕", points: 10 }, { cropId: "potato",  name: "Ziemniak",  icon: "🥔", points: 15 }] },
  { id: "krolik", name: "Królik",  icon: "🐇", unlockLevel: 5,  prodMs: 8  * 3600000, itemId: "futro_krolika",   storageMax: 1, startSlots: 2, maxSlots: 20, buyPrice: 1800,
    slotUpgCosts: barnSlotCosts(1800, 18),
    feed: [{ cropId: "carrot",  name: "Marchew",   icon: "🥕", points: 12 }, { cropId: "lettuce", name: "Sałata",    icon: "🥬", points: 18 }] },
  { id: "krowa",  name: "Krowa",   icon: "🐄", unlockLevel: 7,  prodMs: 12 * 3600000, itemId: "mleko",           storageMax: 1, startSlots: 1, maxSlots: 16, buyPrice: 4500,
    slotUpgCosts: barnSlotCosts(4500, 15),
    feed: [{ cropId: "lettuce", name: "Sałata",    icon: "🥬", points: 15 }, { cropId: "rapeseed", name: "Rzepak",  icon: "🌾", points: 30 }] },
  { id: "kaczka", name: "Kaczka",  icon: "🦆", unlockLevel: 9,  prodMs: 16 * 3600000, itemId: "piora",           storageMax: 1, startSlots: 1, maxSlots: 16, buyPrice: 9000,
    slotUpgCosts: barnSlotCosts(9000, 15),
    feed: [{ cropId: "radish",  name: "Rzodkiewka", icon: "🌱", points: 15 }, { cropId: "sunflower", name: "Słonecznik", icon: "🌻", points: 35 }] },
  { id: "owca",   name: "Owca",    icon: "🐑", unlockLevel: 11, prodMs: 20 * 3600000, itemId: "welna",           storageMax: 1, startSlots: 1, maxSlots: 12, buyPrice: 18000,
    slotUpgCosts: barnSlotCosts(18000, 11),
    feed: [{ cropId: "cabbage", name: "Kapusta",   icon: "🥦", points: 20 }, { cropId: "rapeseed", name: "Rzepak",  icon: "🌾", points: 35 }] },
  { id: "swinia", name: "Świnia",  icon: "🐖", unlockLevel: 13, prodMs: 24 * 3600000, itemId: "nawoz_naturalny", storageMax: 1, startSlots: 1, maxSlots: 10, buyPrice: 35000,
    slotUpgCosts: barnSlotCosts(35000, 9),
    feed: [{ cropId: "tomato",  name: "Pomidor",   icon: "🍅", points: 20 }, { cropId: "pumpkin", name: "Dynia",    icon: "🎃", points: 40 }] },
  { id: "koza",   name: "Koza",    icon: "🐐", unlockLevel: 15, prodMs: 30 * 3600000, itemId: "mleko_kozie",     storageMax: 1, startSlots: 1, maxSlots: 8,  buyPrice: 65000,
    slotUpgCosts: barnSlotCosts(65000, 7),
    feed: [{ cropId: "grape",   name: "Winogrono", icon: "🍇", points: 40 }, { cropId: "asparagus", name: "Szparagi", icon: "🌿", points: 60 }] },
  { id: "indyk",  name: "Indyk",   icon: "🦃", unlockLevel: 17, prodMs: 36 * 3600000, itemId: "duze_piora",      storageMax: 1, startSlots: 1, maxSlots: 8,  buyPrice: 120000,
    slotUpgCosts: barnSlotCosts(120000, 7),
    feed: [{ cropId: "sunflower", name: "Słonecznik", icon: "🌻", points: 35 }, { cropId: "chili", name: "Papryczka chili", icon: "🌶️", points: 50 }] },
  { id: "kon",    name: "Koń",     icon: "🐎", unlockLevel: 20, prodMs: 48 * 3600000, itemId: "energia_robocza", storageMax: 1, startSlots: 1, maxSlots: 6,  buyPrice: 250000,
    slotUpgCosts: barnSlotCosts(250000, 5),
    feed: [{ cropId: "rapeseed", name: "Rzepak",   icon: "🌾", points: 50 }, { cropId: "asparagus", name: "Szparagi", icon: "🌿", points: 70 }] },
  { id: "byk",    name: "Byk",     icon: "🐂", unlockLevel: 25, prodMs: 72 * 3600000, itemId: "rogi_byka",       storageMax: 1, startSlots: 1, maxSlots: 4,  buyPrice: 600000,
    slotUpgCosts: barnSlotCosts(600000, 3),
    feed: [{ cropId: "pumpkin", name: "Dynia",     icon: "🎃", points: 50 }, { cropId: "asparagus", name: "Szparagi", icon: "🌿", points: 80 }] },
];
