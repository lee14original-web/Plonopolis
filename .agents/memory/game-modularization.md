---
name: Game.tsx modularization
description: Postęp modularyzacji Game.tsx — etapy 1A/1B/2A/2B/2C.
---

## Stan po etapie 2B/2C

Game.tsx: 13 806 linii (było 14 711). Typecheck: 0 błędów.

## Wydzielone komponenty (game/features/)

```
avatar/     — EpicPurchaseModal, SkinPickerModal
barn/       — BarnModal
compost/    — CompostNotificationPopup
hive/       — HiveModal
messages/   — MessagesModal
orchard/    — OrchardModal
ranking/    — RankingModal
settings/   — SettingsModal, LogoutConfirmModal
shop/       — ShopModal
```

## Kluczowe decyzje architektoniczne

**selectedAnimal state** przeniesiony jako local state do BarnModal.

**shopTab state** przeniesiony jako local state do ShopModal.

**shopCart / shopError / orchardError** pozostają w Game.tsx jako stan — przekazywane jako props do ShopModal (w tym setShopCart).

**CROP_PRICES** jest lokalnym const wewnątrz Game component (nie exportowany) — przekazywany jako prop `cropPrices` do ShopModal.

**Handlery** wydzielone z IIFE do Game.tsx scope: handleBuyHive, handleAddBees, handleCollectHoney, handleShopBuy{Animal/Tree/HiveItem/Seeds}, handleBarn{BuySlot/Feed/Collect/CollectAll}, handleOrchard{HarvestTree/HarvestAll}.

**TreeDef** → `game/types/barn.ts` (re-exported z `game/constants/orchard.ts`).

**barnSlotCosts** → lokalnie w `game/constants/animals.ts` (uniknięcie circular dep).

**CompostType** → `game/types/crop.ts` (NIE `types/compost.ts`).

**CompostBonus** → eksportowany z `game/types/farm.ts`.

**Array.from(new Set())** — Railway build nie obsługuje `[...new Set()]`; zawsze używać `Array.from`.

## Wskazówki dla skryptu Python modyfikującego Game.tsx

- Zamiany wykonuj od DOŁU do GÓRY (zachowuje indeksy wcześniejszych sekcji).
- `lines[N-1:N] = [content]` ZASTĘPUJE linię N. Żeby wstawić PO linii N użyj `lines[N:N] = [content]`.
- Używaj asercji (check) przed każdą zamianą, żeby zweryfikować że wciąż trafiasz w właściwe linie.

## Typecheck

`pnpm --filter @workspace/plonopolis run typecheck` → 0 błędów po wszystkich etapach.
