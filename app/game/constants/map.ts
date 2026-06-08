export const BASE_W = 1920;
export const BASE_H = 1280;

// Ratusz: 4096×1536 grafika, skalowanie do BASE_H → maxCamX i centrum
export const TH_IMAGE_W = 4096;
export const TH_IMAGE_H = 1536;
export const TH_SCALE = Math.min(BASE_H / TH_IMAGE_H, 1);
export const TH_MAX_CAM_X = Math.max(0, Math.round(TH_IMAGE_W * TH_SCALE) - BASE_W);
export const TH_CENTER_CAM_X = Math.round(TH_MAX_CAM_X / 2);

export const FARM_MAP_W = 2560;
export const FARM_MAP_H = 1440;

// Nowe grafiki farmy 4096×1536 — logika identyczna jak Ratusz
export const FARM_IMG_W = 4096;
export const FARM_IMG_H = 1536;
export const FARM_SCALE = Math.min(BASE_H / FARM_IMG_H, 1);           // ≈ 0.8333
export const FARM_RENDERED_W = Math.round(FARM_IMG_W * FARM_SCALE);   // ≈ 3413
export const FARM_MAX_PAN = Math.max(0, FARM_RENDERED_W - BASE_W);    // ≈ 1493
export const FARM_CENTER_PAN = -Math.round(FARM_MAX_PAN / 2);         // ≈ -747
