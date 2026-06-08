import type { BarnAnimalState, AnimalDef, BarnState } from "../types/barn";
import { ANIMALS } from "../constants/animals";
import { HUNGER_DECAY_PER_MS } from "../constants/storage-keys";

export function defaultBarnState(): BarnState {
  const s: BarnState = {};
  ANIMALS.forEach(a => {
    s[a.id] = { owned: 0, slots: a.startSlots, hunger: 80, lastFedAt: 0, storage: 0, prodStart: 0, baseProdStart: 0 };
  });
  return s;
}

export function barnCurrentHunger(st: BarnAnimalState, opiekaPts: number = 0): number {
  if (!st.lastFedAt) return 50;
  const reduction = Math.min(0.90, opiekaPts * 0.003); // -0.3%/pkt, max -90%
  const decayRate = HUNGER_DECAY_PER_MS * (1 - reduction);
  return Math.max(0, Math.min(100, st.hunger - (Date.now() - st.lastFedAt) * decayRate));
}

export function barnHungerStatus(h: number): { label: string; color: string; speedMod: number } {
  if (h >= 80) return { label: "Najedzone 😊",   color: "#4ade80", speedMod: -0.10 };
  if (h >= 50) return { label: "Normalne",        color: "#f9e7b2", speedMod:  0    };
  if (h >= 20) return { label: "Głodne 😟",       color: "#fbbf24", speedMod:  0.10 };
  return             { label: "Wygłodzone 😵",   color: "#ef4444", speedMod:  0.20 };
}

export function barnEffProdMs(a: AnimalDef, h: number): number {
  return Math.round(a.prodMs * (1 + barnHungerStatus(h).speedMod));
}

export function barnFmtMs(ms: number): string {
  if (ms <= 0) return "Gotowe!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function plItem(n: number, item: { n1: string; n24: string; n5: string }): string {
  if (n === 1) return item.n1;
  if (n >= 2 && n <= 4) return item.n24;
  return item.n5;
}
