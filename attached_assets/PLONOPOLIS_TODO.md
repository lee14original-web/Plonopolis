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
- [x] **Drzewa / sad** — ✅ ZROBIONE (9 drzew, jakości, sloty, sklep, sad)
- [x] **Czasy sadzenia/zbioru** — ✅ ZROBIONE
  - BASE_PLANT_MS=2000, BASE_HARVEST_MS=2000, paski postępu (cyan/amber)
  - Bonusy `% speed sadzenia/zbioru` redukują czas max 80% (min 0.4s)
  - Tracking timeout per pole (Map<plotId, id>) z cleanup przy unmount
  - Refs do FRESH state (seedInventory, plotCrops) w callback timera — race-safe
  - try/finally w executePlantRpc — pasek znika zawsze (nawet przy throw)
  - User feedback gdy revalidation po timerze odpada ("Pole zajęte", "Brak nasion")
  - Każde pole ma osobny timer — można sadzić/zbierać równolegle wiele pól

## ✅ Bonusy z eq — STAN PO PARTIACH 1-3

| Bonus | Stan | Gdzie aplikowane |
|---|---|---|
| % speed upraw | ✅ klient | `getEffectiveGrowthTimeMs` |
| % efekt podlewania | ✅ klient | `handleWaterPlot` |
| % efekt wody | ✅ klient | `handleWaterPlot` |
| % efekt kompostu | ✅ klient | `applyCompostToPlot` |
| % reward zwierząt | ✅ klient | `handleCollect`/`handleCollectAll` |
| % speed drzew | ✅ klient | sad |
| % bonus drop (drzewa) | ✅ klient | sad |
| **pkt Wiedzy (flat)** | ✅ klient | `getEffectiveGrowthTimeMs` |
| **% extra harvest** | ✅ klient | `handleHarvestPlot` (pętla per sztuka) |
| **% bonus drop (uprawy)** | ✅ klient | `handleHarvestPlot` (good→epic upgrade) |
| **% EXP** | ✅ klient | `handleHarvestPlot` (level-up loop) |
| **% EXP z upraw** | ✅ klient | `handleHarvestPlot` |
| **% produkcji miodu** | ✅ SQL | `collect_honey` (param `p_honey_bonus_pct`) |
| **% zużycia stroju** | ✅ SQL | `collect_honey` (param `p_suit_save_pct`) |
| **% speed sadzenia** | ✅ klient | `handlePlantFromSelectedSeed` (timer + pasek) |
| **% speed zbioru** | ✅ klient | `handleHarvestPlot` (timer + pasek) |

## 📋 ODŁOŻONE — następne kroki
- **Opcja A (snapshot bonusów eq)** — exploit przebierania: gracz może zaalokować wszystkie czasy/bonusy zaraz przed RPC i zdjąć potem. Plan: zapisać snapshot bonusów na polu w momencie startu akcji (sadzenie/zbiór), użyć przy RPC zamiast aktualnego eq.
- **Synchronizacja eq z DB** — `charEquipped` jest tylko w localStorage. Bonusy SQL (`collect_honey`) chwilowo dostają wartości od klienta — trust ✗. Long-term: dodać kolumnę `char_equipment JSONB` w `profiles` i czytać po stronie serwera.
- **SQL do wgrania**: `attached_assets/sql_hive_bonuses.sql` (nowy z Partii 2)
