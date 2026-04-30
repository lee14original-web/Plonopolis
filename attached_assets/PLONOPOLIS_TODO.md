# Plonopolis — TODO

## ✅ Zrobione w tej sesji
- Nowy system kosztów ulepszeń (UPGRADE_COST + tier mult + slot mult Głowa ×1.3)
- System materiałów do ulepszeń +4..+10 (M1..M10)
- Bug offline production zwierząt (Math.floor(elapsed/effMs))
- Tempo głodu: 4→3 pkt/h, speedMod Głodne 0.15→0.10, Wygłodzone 0.30→0.20
- Aggregator `getEquipBonusPct(label, charEquipped)` — sumuje bonusy z 3 slotów
- Wdrożone bonusy z eq (klient-side):
  - % speed upraw → czas wzrostu upraw
  - % efekt podlewania + % efekt wody → boost zaradności przy podlewaniu
  - % efekt kompostu → boost mnożnika kompostu Wzrostu
  - % reward zwierząt → handleCollect / handleCollectAll

## 🚧 Brakujące elementy gry (do zrobienia w pierwszej kolejności)
- [x] **Drzewa / sad** — ✅ ZROBIONE
  - 9 drzew (jabłoń, grusza, śliwa, wiśnia, brzoskwinia, morela, pomarańcza, cytryna, granat) lvl 10–25
  - System jakości owoców: zwykły 85% / soczysty 12% (×2💰) / złoty 3% (×5💰)
  - Limity slotów per LVL: 10→2, 15→4, 20→6, 25→8
  - Cykl produkcji offline-safe (storage cap 5 cykli)
  - Bonusy: "% speed drzew" (z eq), Sadownik (drop +%), Szczęście + "% bonus drop" (rare/golden)
  - Sklep zakładka 🌳 Drzewa, modal Sadu z timerami i sprzedażą per quality
  - Owoce w osobnym `fruitInventory` (klucz `${fruitId}_${quality}`) — gotowe pod przyszłe crafting/gildie/eventy
- [ ] **Czasy sadzenia/zbioru** — itemy n11, c5, n12, c6, c12, d3, d11 mają "% speed sadzenia/zbioru" ale w obecnym RPC sadzenie/zbiór są instant. Decyzja: dodać czasy czy wymienić bonusy?
- [ ] (inne brakujące elementy które user wskaże)

## 📋 ODŁOŻONE — wrócić po dodaniu brakujących elementów
**Pełna implementacja pozostałych 9 bonusów z eq przez SQL/RPC**

Ekwipunek (`charEquipped`) jest tylko w localStorage. Trzeba:
1. Dodać kolumnę `char_equipment JSONB` w tabeli profili Supabase
2. Synchronizować `charEquipped` przy każdej zmianie (rozszerzyć `saveCharEquipped`)
3. Update'ować RPC żeby czytały eq i aplikowały bonusy:

| Bonus | RPC do zmiany | Uwaga |
|---|---|---|
| % speed sadzenia | `game_plant_crop` | |
| % speed zbioru | `game_harvest_plot` | |
| % speed drzew | (nowe RPC drzew) | **wymaga najpierw systemu drzew** |
| % EXP / % EXP z upraw | `game_harvest_plot` | nadawanie EXP |
| % extra harvest | `game_harvest_plot` | yieldAmount |
| % bonus drop | `game_harvest_plot` | rzadkość/drop |
| % produkcji miodu | `collect_honey` | |
| % zużycia stroju | `collect_honey` | durability damage |

**User powiedział:** "najpierw zrobimy to czego brakuje (drzewa itd.) i później się tym zajmiemy"
