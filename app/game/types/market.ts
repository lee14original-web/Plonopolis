export type MarketItemType = "crop" | "compost" | "barn_item" | "fruit" | "honey" | "equipment";

export type MarketOffer = {
  id: string;
  seller_id: string;
  seller_name?: string;
  seller_avatar?: number | null;
  item_type: MarketItemType;
  item_key: string;
  item_name: string;
  item_icon: string;
  quantity: number;
  price_per_unit: number;
  duration_hours: number;
  status: "active" | "sold" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
  sold_at?: string | null;
  buyer_id?: string | null;
};

export type MarketReturn = {
  id: string;
  user_id: string;
  return_type: "gold" | "item";
  item_key?: string | null;
  item_type?: string | null;
  item_name?: string | null;
  item_icon?: string | null;
  quantity: number;
  gold_amount?: number | null;
  reason: "sold" | "expired" | "cancelled";
  offer_id?: string | null;
  created_at: string;
  claimed: boolean;
};
