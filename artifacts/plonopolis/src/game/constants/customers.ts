export const CUSTOMER_AVATARS: Record<string, string[]> = {
  neighbor:               Array.from({ length: 12 }, (_, i) => `/klienci/customer_neighbor_${i + 1}.png`),
  village_guest:          Array.from({ length: 10 }, (_, i) => `/klienci/customer_village_guest_${i + 1}.png`),
  small_market:           Array.from({ length: 5  }, (_, i) => `/klienci/customer_small_market_${i + 1}.png`),
  village_shop:           Array.from({ length: 5  }, (_, i) => `/klienci/customer_village_shop_${i + 1}.png`),
  restaurant:             Array.from({ length: 5  }, (_, i) => `/klienci/customer_restaurant_${i + 1}.png`),
  wholesaler:             Array.from({ length: 5  }, (_, i) => `/klienci/customer_wholesaler_${i + 1}.png`),
  market_chain:           Array.from({ length: 5  }, (_, i) => `/klienci/customer_market_chain_${i + 1}.png`),
  distribution_center:    Array.from({ length: 5  }, (_, i) => `/klienci/customer_distribution_center_${i + 1}.png`),
  international_contract: Array.from({ length: 5  }, (_, i) => `/klienci/customer_international_contract_${i + 1}.png`),
};
