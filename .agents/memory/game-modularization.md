---
name: Game.tsx modularization
description: Etap 1A — wydzielenie typów, stałych i utils z Game.tsx do podfolderów game/.
---

## Stan po etapie 1A

Game.tsx ma 15 456 linii (było 17 131). Linie 1–75 to teraz importy + 2 funkcje supabase.

## Struktura katalogów

```
artifacts/plonopolis/src/game/
  types/   — 14 plików + index.ts
  constants/ — 13 plików
  utils/   — 15 plików
  components/ — AnimalImg.tsx
```

## Kluczowe decyzje

**Why:** `saveHouseData` i `saveAvatarData` MUSZĄ zostać w Game.tsx — używają `supabase.rpc`.

**TreeDef** → `game/types/barn.ts` (re-exported z `game/constants/orchard.ts`).

**barnSlotCosts** → lokalnie w `game/constants/animals.ts` (uniknięcie circular dep z utils/barn.ts).

**CompostBonus** → eksportowany z `game/types/farm.ts` (re-export z crop.ts przez `export type`).

**CROPS** — 26 upraw: cauliflower(13), strawberry(14), raspberry(15), blueberry(16), eggplant(17), zucchini(18), watermelon(19), grape(20), pumpkin(21), rapeseed(22), sunflower(23), chili(24), asparagus(25).

**Array.from(new Set())** — Railway build nie obsługuje `[...new Set()]`; zawsze używać `Array.from`.

## Typecheck

`pnpm tsc -p tsconfig.json --noEmit` → 0 błędów po:
1. Dodaniu `export type { CompostBonus }` do `types/farm.ts`
2. Dodaniu `plItem` do importu w Game.tsx (używany w JSX)
