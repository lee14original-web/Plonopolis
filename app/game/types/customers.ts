export type CustomerOrderItem = { id: string; qty: number; value: number };
export type CustomerOrderBonus = { id?: string; qty: number; type: "animal" | "crop" | "compost" | "eq_item"; tier?: number };
export type CustomerOrderRewards = { gold: number; exp: number; bonus: CustomerOrderBonus[] };
export type CustomerOrder = {
  id: string;
  user_id: string;
  customer_type: string;
  items: CustomerOrderItem[];
  rewards: CustomerOrderRewards;
  expires_at: string;
  created_at: string;
};
