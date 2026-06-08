import { DEFAULT_LEVEL, DEFAULT_MAP } from "../constants/game";

export function getMapForLevel(level: number | null | undefined): string {
  const safeLevel = level ?? DEFAULT_LEVEL;
  if (safeLevel >= 30) return "farm30";
  if (safeLevel >= 25) return "farm25";
  if (safeLevel >= 20) return "farm20";
  if (safeLevel >= 15) return "farm15";
  if (safeLevel >= 10) return "farm10";
  if (safeLevel >= 3)  return "farm5";
  return DEFAULT_MAP;
}

export function getDisplayBackgroundMap(mapId: string | null | undefined): string {
  if (!mapId) return DEFAULT_MAP;
  return mapId;
}

export function getMapDisplayName(mapId: string | null | undefined): string {
  switch (mapId) {
    case "city":         return "Miasto";
    case "city_shop":    return "Sklep";
    case "city_market":  return "Targ";
    case "city_bank":    return "Bank";
    case "city_townhall":return "Ratusz";
    case "farm5":
    case "farm10":
    case "farm15":
    case "farm20":
    case "farm25":
    case "farm1":        return "Farma";
    default:             return mapId ?? "Mapa";
  }
}
