export const CUSTOMER_AVATARS: Record<string, string[]> = {
  neighbor:               Array.from({ length: 12 }, (_, i) => `/klienci/customer_neighbor_${i + 1}.webp`),
  village_guest:          Array.from({ length: 10 }, (_, i) => `/klienci/customer_village_guest_${i + 1}.webp`),
  small_market:           Array.from({ length: 5  }, (_, i) => `/klienci/customer_small_market_${i + 1}.webp`),
  village_shop:           Array.from({ length: 5  }, (_, i) => `/klienci/customer_village_shop_${i + 1}.webp`),
  restaurant:             Array.from({ length: 5  }, (_, i) => `/klienci/customer_restaurant_${i + 1}.webp`),
  wholesaler:             Array.from({ length: 5  }, (_, i) => `/klienci/customer_wholesaler_${i + 1}.webp`),
  market_chain:           Array.from({ length: 5  }, (_, i) => `/klienci/customer_market_chain_${i + 1}.webp`),
  distribution_center:    Array.from({ length: 5  }, (_, i) => `/klienci/customer_distribution_center_${i + 1}.webp`),
  international_contract: Array.from({ length: 5  }, (_, i) => `/klienci/customer_international_contract_${i + 1}.webp`),
  // Aliasy dla starych typów z game_give_starter_customers
  "Gość":                 Array.from({ length: 12 }, (_, i) => `/klienci/customer_neighbor_${i + 1}.webp`),
  "gosc":                 Array.from({ length: 12 }, (_, i) => `/klienci/customer_neighbor_${i + 1}.webp`),
  "guest":                Array.from({ length: 12 }, (_, i) => `/klienci/customer_neighbor_${i + 1}.webp`),
  "Sąsiad":               Array.from({ length: 12 }, (_, i) => `/klienci/customer_neighbor_${i + 1}.webp`),
};
