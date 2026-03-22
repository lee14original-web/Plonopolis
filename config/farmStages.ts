export const FARM_STAGES = [
  { minLevel: 1, image: "/farm1.png" },
  { minLevel: 5, image: "/farm5.png" },
  { minLevel: 10, image: "/farm10.png" },
  { minLevel: 15, image: "/farm15.png" },
  { minLevel: 20, image: "/farm20.png" },
];

export function getFarmStage(level: number) {
  return [...FARM_STAGES].reverse().find(s => level >= s.minLevel) || FARM_STAGES[0];
}
