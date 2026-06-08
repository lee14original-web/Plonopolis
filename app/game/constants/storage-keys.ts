export const CHAR_EQUIP_KEY    = "plonopolis_char_equipped";
export const ITEM_UPG_KEY      = "plonopolis_item_upg_reg";
export const OWNED_EQ_KEY      = "plonopolis_owned_eq";
export const EXTRA_EQ_KEY      = "plonopolis_extra_eq";
export const KOMPOST_KEY       = "plonopolis_kompost_charges";
export const KOMPOST_BATCHES_KEY = "plonopolis_kompost_batches";
export const SLOT_BOX_KEY      = "plonopolis_slot_box";
export const SETTINGS_KEY      = "plonopolis_settings";
export const ACTIVE_USER_KEY   = "plonopolis_active_user";
export const BARN_STATE_KEY    = "plonopolis_barn";
export const BARN_ITEMS_KEY    = "plonopolis_barn_items";
export const ORCHARD_STATE_KEY = "plonopolis_orchard";

export const DP_LS_KEY = (uid: string) => `plonopolis_dp_${uid}`;

export const PER_SESSION_KEYS = [
  "plonopolis_char_equipped", "plonopolis_item_upg_reg", "plonopolis_owned_eq",
  "plonopolis_extra_eq", "plonopolis_kompost_charges", "plonopolis_kompost_batches",
  "plonopolis_slot_box", "plonopolis_barn", "plonopolis_barn_items",
  "plonopolis_orchard", "plonopolis_fruit_inv",
  "plonopolis_backpack_filter", "plonopolis_backpack_position",
];

export const DEFAULT_SLOT_BOX: Record<string, { top: number; left: number; width: number; height: number }> = {
  glowa:  { top: 32, left: 7.5, width: 22.5, height: 31 },
  dlonie: { top: 32, left: 39,  width: 22,   height: 31 },
  nogi:   { top: 32, left: 70,  width: 22,   height: 31 },
};

export const HUNGER_DECAY_PER_MS = 3 / (60 * 60 * 1000); // 3 pkt/h → 0 po ~33h
