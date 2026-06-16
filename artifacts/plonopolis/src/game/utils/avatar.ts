import type { PlayerStatsMap } from "../types/stats";
import { AVATAR_BONUSES, AVATAR_CHANGE_TIERS } from "../constants/avatars";

export function getAvatarBonus(skin: number): Partial<PlayerStatsMap> {
  return AVATAR_BONUSES[skin] ?? {};
}

export function mergeAvatarBonus(base: PlayerStatsMap, skin: number): PlayerStatsMap {
  const b = getAvatarBonus(skin);
  return {
    wiedza:    (base.wiedza    ?? 0) + (b.wiedza    ?? 0),
    zrecznosc: (base.zrecznosc ?? 0) + (b.zrecznosc ?? 0),
    zaradnosc: (base.zaradnosc ?? 0) + (b.zaradnosc ?? 0),
    sadownik:  (base.sadownik  ?? 0) + (b.sadownik  ?? 0),
    opieka:    (base.opieka    ?? 0) + (b.opieka    ?? 0),
    szczescie: (base.szczescie ?? 0) + (b.szczescie ?? 0),
  };
}

export function getAvatarChangeTier(changeCount: number): { cost: number; cooldownMs: number } {
  if (changeCount < AVATAR_CHANGE_TIERS.length) return AVATAR_CHANGE_TIERS[changeCount];
  return AVATAR_CHANGE_TIERS[AVATAR_CHANGE_TIERS.length - 1];
}
