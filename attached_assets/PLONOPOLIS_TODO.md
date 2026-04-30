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
- [ ] **Drzewa / sad** — system sadowniczy w grze (item d13, n8, g5, g7 mają bonus "% speed drzew", ale drzew NIE MA)
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
