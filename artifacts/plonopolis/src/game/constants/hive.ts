import type { HiveData } from "../types/hive";

export const DEFAULT_HIVE_DATA: HiveData = { level: 0, bees_progress: 0, honey_start: null, suit_durability: 0, empty_jars: 0, honey_jars: 0 };
export const HIVE_MAX_HONEY      = [0, 8, 10, 12, 14, 16];
export const HIVE_UPGRADE_BEES   = [0, 20, 30, 40, 50];
export const HIVE_SUCCESS_CHANCE = [0, 1.00, 1.00, 1.00, 1.00, 1.00]; // zbiór miodu — zawsze 100%
export const HIVE_BEE_ACCEPT_CHANCE = [0, 0.90, 0.80, 0.70, 0.60, 0.50]; // szansa przyjęcia 1 pszczoły wg poziomu ula
export const HONEY_MS_PER_PT     = 3_600_000;
export const HONEY_JAR_PRICE     = [0, 12, 12, 12, 12, 12];
