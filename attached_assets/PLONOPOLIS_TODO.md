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

## ✅ Balans bonusów wzrostu upraw (capy + globalne minimum)
Stan: **zrobione (klient).**
- Stałe balansu w jednym miejscu (linia ~213): `GROWTH_GLOBAL_MIN_MULT`, `WIEDZA_RATE`, `ZARADNOSC_RATE`, `WIEDZA_MULT_MIN`, `HIVE_MULT_MIN`, `EQUIP_GROWTH_MULT_MIN`, `COMPOST_MULT_MIN`, `WATER_BONUS_MAX`, `WATER_MULT_MIN`.
- **Wiedza:** rate `0.005 → 0.0033` + cap −25% (`WIEDZA_MULT_MIN=0.75`). Każdy poziom Wiedzy do 100 daje wartość; cap osiągany ~val 100 z eq.
- **Zaradność:** rate `0.006 → 0.004` + cap −30% (`WATER_MULT_MIN=0.70`, `WATER_BONUS_MAX=0.30`). Każdy poziom liczy się do 100.
- **Ul:** bez zmian (max −10% przy lvl 5).
- **Eq „% speed upraw":** cap −25% (`EQUIP_GROWTH_MULT_MIN=0.75`).
- **Kompost Wzrostu:** cap −20% (`COMPOST_MULT_MIN=0.80`).
- **GLOBALNE MINIMUM:** `0.35` bazowego czasu (max −65% TOTAL po multiplikatywności). Szparagi 12h → min **4h 12min**.
- Zaktualizowane: `getEffectiveGrowthTimeMs`, toast po podlaniu, tooltip konewki, tooltip nasion (z ostrzeżeniem ⚠️ gdy hit globalne minimum).
- ⚠️ Wiedza > 50 i Zaradność > 50 — gracze, którzy już zainwestowali, dostają de facto nerf. **Rozważ darmowy reset statów raz po patchu** (do dyskusji).

## 📋 ODŁOŻONE — następne kroki
- **Synchronizacja eq z DB** — `charEquipped` jest tylko w localStorage. Bonusy SQL (`collect_honey`, `game_harvest_plot`) chwilowo dostają wartości od klienta — trust ✗. Long-term: dodać kolumnę `char_equipment JSONB` w `profiles` i czytać po stronie serwera.
- **Walidacja `pendingFieldActions` w water/kompost** — `applyCompostToPlot` i `handleWaterPlot` nie blokują się gdy trwa akcja na polu (rzadki edge case).

## 🔥 BUG: Race condition przy zbiorze wielu pól (NAPRAWIONE)
**Objaw:** user posadził 6 marchewek + kompost yield+3 (×6 pól), zebrał wszystkie naraz, dostał ~80 marchewek zamiast 30 (6 + 6×3 = 24 lub 30).
**Przyczyna:** klient po RPC nadpisywał DB **pełnym obiektem** `seed_inventory` po dodaniu compost/extra/bonusDrop po stronie klienta. Gdy zbiór wielu pól leci równolegle, wszystkie callbacki czytają stary `nextInventory`, dodają swój compost+3, i nadpisują DB — ostatni wygrywa, ale każdy z **akumulowaną** wartością z poprzednich.
**Fix:**
1. **SQL** (`sql_fix_harvest_atomic.sql`) — RPC `game_harvest_plot` przyjmuje 3 nowe parametry (`p_compost_yield_extra`, `p_extra_harvest_pct`, `p_bonus_drop_pct`) i aplikuje je **atomicznie** w bazie. Zwraca `gained_good/gained_epic/gained_rotten/extra_harvest_gain/bonus_drop_upgrades` plus `profile`+`zrecznosc_triggered`. Migruje stary klucz `"carrot"` → `"carrot_good"` przy starcie. DROP starych sygnatur.
   - **Anti-exploit**: `plantedQuality` i `compostBonus` (clamp value≤3) odczytywane z DB (`v_plot`) zamiast z parametrów — klient nie może ich zawyżyć. Pozostałe parametry (`p_extra_harvest_pct`, `p_bonus_drop_pct`, `p_zrecznosc`) nadal trust-from-client (zależą od eq w localStorage — patrz "Synchronizacja eq z DB").
   - **Compost yield** zawsze trafia do `_good` (zachowane z poprzedniej semantyki — działa też przy zbiorze epic/rotten).
2. **Klient** (`handleHarvestPlot`) — przekazuje nowe parametry do RPC, USUNIĘTO ręczne dodawanie compost/extra/bonusDrop, USUNIĘTO `await update({seed_inventory})` dla nie-legendarnych (SQL = źródło prawdy). Log events używają `gained_*` z RPC zamiast diff vs prevSnap. Legendary path bez zmian (klient nadal losuje opcję 0/1/2 i nadpisuje DB).

## 🆕 SQL do wgrania w Supabase (kolejność)
1. `attached_assets/sql_hive_bonuses.sql` (z Partii 2)
2. `attached_assets/sql_fix_plant_preserve_compost.sql`
3. `attached_assets/sql_fix_harvest_atomic.sql` ← **ZASTĘPUJE** `sql_harvest_legendary_update.sql`
