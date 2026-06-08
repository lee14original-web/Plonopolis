export const CROP_QUALITY_DEFS = {
  rotten:    { label: "Popsuta",    badge: "⚠️", borderColor: "#ffffff", bgColor: "rgba(255,255,255,0.05)", expMult: 0, canPlant: false },
  good:      { label: "Zwykła",     badge: "✅", borderColor: "#ffffff", bgColor: "rgba(255,255,255,0.05)", expMult: 1, canPlant: true  },
  epic:      { label: "Epicka",     badge: "⭐", borderColor: "#22c55e", bgColor: "rgba(20,80,30,0.5)",   expMult: 3, canPlant: true  },
  legendary: { label: "Legendarna", badge: "🌟", borderColor: "#f59e0b", bgColor: "rgba(80,50,5,0.5)",    expMult: 5, canPlant: true  },
} as const;

export type CropQuality = keyof typeof CROP_QUALITY_DEFS;

export type Crop = {
  id: string;
  name: string;
  unlockLevel: number;
  growthTimeMs: number;
  yieldAmount: number;
  expReward: number;
  spritePath: string;
  epicSpritePath?: string;
  rottenSpritePath?: string;
  legendarySpritePath?: string;
};

export type CompostType = "growth" | "yield" | "exp" | "guide";
export type CompostBonus = { type: CompostType; value: number };
