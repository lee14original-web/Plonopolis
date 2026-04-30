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

## ✅ Opcja A — snapshot bonusów eq (anti-exploit przebierania)
Stan: **zrobione dla zbioru i sadzenia.**
- **Sadzenie**: `% speed sadzenia` zamrożone przez `durationMs` w `pendingFieldActions[plotId]`.
- **Zbiór**: `% speed zbioru` zamrożone przez `durationMs`; `extraHarvestPct`, `bonusDropPct`, `expPct` przekazywane **bezpośrednio przez parametr** `handleHarvestPlot(plotId, true, snapshot)` z setTimeout (closure-safe — nie czyta z React state). Brak fallbacku do `getEquipBonusPct` przy zbiorze — gdy snapshot brak, użyje 0 (bezpieczny default).
- **Miód**: bez timera (akcja natychmiastowa) — snapshot zbędny.

### Zostało jako future work (związane)
- **Snapshot przy SADZENIU dla `getEffectiveGrowthTimeMs`** — `pkt Wiedzy`, `% efekt kompostu`, `% speed upraw`, `% efekt podlewania`, `% efekt wody` wpływają na czas wzrostu. Aktualnie czytane na żywo przy zbiorze (przez `getEffectiveGrowthTimeMs(plotId)`). Powinny być snapshotowane na polu (kolumna w `plot_crops`) w chwili sadzenia.
- **Inne timery** (sad, zwierzęta, miód): produkcja czasowa też podatna na exploit (`% speed drzew`, `% reward zwierząt`, `% produkcji miodu`, `% zużycia stroju`). Wymaga osobnej decyzji per system.

## 📋 ODŁOŻONE — następne kroki
- **Synchronizacja eq z DB** — `charEquipped` jest tylko w localStorage. Bonusy SQL (`collect_honey`) chwilowo dostają wartości od klienta — trust ✗. Long-term: dodać kolumnę `char_equipment JSONB` w `profiles` i czytać po stronie serwera.
- **Walidacja `pendingFieldActions` w water/kompost** — `applyCompostToPlot` i `handleWaterPlot` nie blokują się gdy trwa akcja na polu (rzadki edge case).
- **SQL do wgrania**: `attached_assets/sql_hive_bonuses.sql` (z Partii 2)
