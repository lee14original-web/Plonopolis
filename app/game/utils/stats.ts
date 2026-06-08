export function calcStatEffect(val: number, rate: number): number {
  const eff = val <= 50 ? val : 50 + (val - 50) * 0.5;
  return Math.round(eff * rate * 1000) / 10;
}

export function getStatRank(val: number): { name: string; color: string; prevT: number; nextT: number } {
  if (val >= 75) return { name: "Legenda",   color: "text-yellow-300", prevT: 75, nextT: 100 };
  if (val >= 50) return { name: "Mistrz",    color: "text-purple-300", prevT: 50, nextT: 75  };
  if (val >= 25) return { name: "Ekspert",   color: "text-blue-300",   prevT: 25, nextT: 50  };
  if (val >= 10) return { name: "Rolnik",    color: "text-green-300",  prevT: 10, nextT: 25  };
  return              { name: "Nowicjusz", color: "text-[#8b6a3e]",  prevT: 0,  nextT: 10  };
}

export function getStatUpgradeCost(targetLv: number): number {
  const T: [number, number][] = [
    [1, 25], [5, 45], [10, 78], [20, 960], [30, 3000], [40, 9400],
    [50, 29000], [60, 88000], [70, 260000], [80, 750000], [90, 2100000], [100, 6000000],
  ];
  if (targetLv <= 1) return 25;
  if (targetLv >= 100) return 6000000;
  for (let i = 1; i < T.length; i++) {
    if (targetLv <= T[i][0]) {
      const t = (targetLv - T[i - 1][0]) / (T[i][0] - T[i - 1][0]);
      return Math.round(T[i - 1][1] + t * (T[i][1] - T[i - 1][1]));
    }
  }
  return 6000000;
}
