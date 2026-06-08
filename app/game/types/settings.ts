export type GraphicsQuality = "low" | "medium" | "high";

export interface GameSettings {
  musicEnabled: boolean;
  soundEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  musicVolume: number;
}

export type DailyProgress = {
  date: string;
  harvests: number;
  customers: number;
  expGained: number;
  moneyGained: number;
  levelsGained: number;
};
