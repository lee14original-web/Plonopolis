#!/usr/bin/env python3
"""Etap 2D: extrahuje CustomersModal + MarketModal z Game.tsx."""
import os, sys, textwrap

ROOT  = "/home/runner/workspace"
GAME  = f"{ROOT}/artifacts/plonopolis/src/Game.tsx"
CDIR  = f"{ROOT}/artifacts/plonopolis/src/game/features/customers"
MDIR  = f"{ROOT}/artifacts/plonopolis/src/game/features/market"

with open(GAME, encoding="utf-8") as f:
    lines = f.readlines()

print(f"Game.tsx: {len(lines)} linii")

# ── Weryfikacja granic ───────────────────────────────────────────────────────
L_START, L_END = 9729-1, 10459-1          # Lada modal IIFE (0-indexed)
M_START, M_END = 12858-1, 13621-1         # Market modal+picker block

def check(idx, needle, label):
    if needle not in lines[idx]:
        print(f"FAIL {label}: linia {idx+1}: {lines[idx]!r}")
        sys.exit(1)
    print(f"OK {label} @ {idx+1}")

check(L_START, "showLadaModal && (() => {",   "L_START")
check(L_END,   "})()}",                        "L_END")
check(M_START, "showMarketModal && (",         "M_START")
check(M_END,   "})()}",                        "M_END")

# ── Funkcje pomocnicze z Game.tsx (kopiowane jako pure helpers) ──────────────
FN_RANGES = {
    "mergeOrderItems":    (3088-1, 3100-1),
    "getOrderItemDisplay":(3102-1, 3139-1),
    "getCustomerDisplay": (3141-1, 3152-1),
    "marketMinPrice":     (5135-1, 5148-1),
    "marketItemLabel":    (5149-1, 5182-1),
    "getMarketItemImg":   (5183-1, 5196-1),
    "getItemUnlockLevel": (5263-1, 5268-1),
}
for name, (s, e) in FN_RANGES.items():
    if f"function {name}" not in lines[s]:
        print(f"FAIL fn {name} @ {s+1}: {lines[s]!r}")
        sys.exit(1)
    print(f"OK fn {name} @ {s+1}")

def get_fn(name):
    s, e = FN_RANGES[name]
    return "".join(lines[s:e+1])

def strip_n(line, n):
    sp = len(line) - len(line.lstrip(' '))
    return line[min(sp, n):]

def dedent_block(blk, amount):
    return [strip_n(l, amount) if l.strip() else "\n" for l in blk]

# ═══════════════════════════════════════════════════════════════════════════════
# 1) CustomersModal.tsx
# ═══════════════════════════════════════════════════════════════════════════════
lada_body_raw = lines[L_START+1 : L_END]   # 9730–10458 (1-idx)
min_sp = min((len(l)-len(l.lstrip()) for l in lada_body_raw if l.strip()), default=12)
print(f"Lada min indent: {min_sp}")
lada_body = dedent_block(lada_body_raw, min_sp)

customers_header = """\
import React from "react";
import type { CustomerOrder } from "../../types/customers";
import type { HiveData } from "../../types/hive";
import type { Profile } from "../../types/profile";
import { NON_EPIC_SKINS } from "../../constants/avatars";
import { LADA_MAX_CUSTOMERS } from "../../constants/game";
import { ANIMAL_ITEMS } from "../../constants/animals";
import { CROPS } from "../../constants/crops";
import { TREES, FRUIT_QUALITY_DEFS } from "../../constants/orchard";
import type { FruitQuality } from "../../types/orchard";
import { COMPOST_DEFS } from "../../constants/compost";
import { CHAR_EQUIP_ITEMS } from "../../constants/equipment";
import { isCompostKey, compostTypeFromKey, compostValueFromKey } from "../../utils/compost";

"""

customers_fns = (
    "// ── Pure helpers (moved from Game component scope) ──────────────────────────\n"
    + get_fn("mergeOrderItems")
    + "\n"
    + get_fn("getOrderItemDisplay")
    + "\n"
    + get_fn("getCustomerDisplay")
    + "\n"
)

customers_props = """\
interface Props {
  // state
  showLadaInfo: boolean;
  ladaDetailIdx: number | null;
  ladaCardHoverIdx: number | null;
  ladaView: "list" | "carousel";
  customerOrders: CustomerOrder[];
  customerSelling: string | null;
  customerLoading: boolean;
  customerNow: number;
  nextSpawnAt: number | null;
  newCustomerIds: Set<string>;
  ladaStatusMsg: "searching" | "adding" | "added" | "failed" | null;
  carouselIdx: number;
  profile: Profile | null;
  mousePos: { x: number; y: number };
  completingCustomerOrderRef: React.MutableRefObject<boolean>;
  carouselDragRef: React.MutableRefObject<{
    startX: number; baseIdx: number; totalMoved: number; pointerId: number;
  } | null>;
  carouselHasDraggedRef: React.MutableRefObject<boolean>;
  barnItems: Record<string, number>;
  seedInventory: Record<string, number>;
  fruitInventory: Record<string, number>;
  hiveData: HiveData;
  // setters
  setShowLadaModal: (v: boolean) => void;
  setShowLadaInfo: React.Dispatch<React.SetStateAction<boolean>>;
  setLadaDetailIdx: (v: number | null) => void;
  setLadaCardHoverIdx: (v: number | null) => void;
  setLadaView: (v: "list" | "carousel") => void;
  setCarouselIdx: React.Dispatch<React.SetStateAction<number>>;
  // handlers
  completeCustomerOrder: (orderId: string) => Promise<void>;
}

"""

customers_fn_open = "export function CustomersModal({\n  showLadaInfo, ladaDetailIdx, ladaCardHoverIdx, ladaView,\n  customerOrders, customerSelling, customerLoading, customerNow,\n  nextSpawnAt, newCustomerIds, ladaStatusMsg, carouselIdx, profile,\n  mousePos, completingCustomerOrderRef, carouselDragRef, carouselHasDraggedRef,\n  barnItems, seedInventory, fruitInventory, hiveData,\n  setShowLadaModal, setShowLadaInfo, setLadaDetailIdx, setLadaCardHoverIdx,\n  setLadaView, setCarouselIdx, completeCustomerOrder,\n}: Props) {\n"
customers_fn_close = "}\n"

customers_content = (
    customers_header
    + customers_fns
    + customers_props
    + customers_fn_open
    + "".join(lada_body)
    + customers_fn_close
)

os.makedirs(CDIR, exist_ok=True)
cpath = f"{CDIR}/CustomersModal.tsx"
with open(cpath, "w", encoding="utf-8") as f:
    f.write(customers_content)
print(f"Napisano: {cpath}")

# ═══════════════════════════════════════════════════════════════════════════════
# 2) MarketModal.tsx
# ═══════════════════════════════════════════════════════════════════════════════
market_raw = lines[M_START:M_END+1]    # 12858–13621 (1-idx)
# Keep original indentation — it fits naturally inside return(<>...</>)

market_header = """\
import React from "react";
import type { MarketOffer, MarketReturn, MarketItemType } from "../../types/market";
import type { Profile } from "../../types/profile";
import { parseQualityKey } from "../../utils/crop";
import { compostTypeFromKey, compostValueFromKey } from "../../utils/compost";
import { fmtK, fmtFull } from "../../utils/ui";
import { CHAR_EQUIP_ITEMS } from "../../constants/equipment";
import { CROPS, CROP_QUALITY_DEFS } from "../../constants/crops";
import { ANIMAL_ITEMS, ANIMALS } from "../../constants/animals";
import { TREES, FRUIT_QUALITY_DEFS } from "../../constants/orchard";
import type { FruitQuality } from "../../types/orchard";
import { COMPOST_DEFS } from "../../constants/compost";
import { getItemTierIndex } from "../../utils/equipment";
import { isCompostKey } from "../../utils/compost";

"""

market_pure_fns = (
    "// ── Pure helpers (moved from Game component scope) ──────────────────────────\n"
    + get_fn("marketMinPrice")
    + "\n"
    + get_fn("marketItemLabel")
    + "\n"
    + get_fn("getMarketItemImg")
    + "\n"
)

market_get_unlock = get_fn("getItemUnlockLevel")

market_props = """\
interface SellableItem {
  type: MarketItemType;
  key: string;
  name: string;
  icon: string;
  imgPath: string | null;
  qty: number;
  minPrice: number;
}

interface Props {
  // state
  showMarketModal: boolean;
  marketPickerOpen: boolean;
  marketTab: "browse" | "my_offers" | "returns";
  marketBrowse: MarketOffer[];
  myMarketOffers: MarketOffer[];
  marketReturns: MarketReturn[];
  marketLoading: boolean;
  marketBrowseFilter: MarketItemType | "all";
  marketSearch: string;
  marketQualityFilter: string;
  marketSort: "price_asc" | "price_desc" | "qty_desc" | "expires_asc" | "newest" | "unit_asc";
  marketTierFilter: "all" | "1" | "2" | "3" | "4" | "5";
  marketMyLevelOnly: boolean;
  coItemType: MarketItemType;
  coItemKey: string;
  coQty: number;
  coPrice: number;
  coPriceStr: string;
  coDuration: 24 | 48 | 72;
  coLoading: boolean;
  createOfferOpen: boolean;
  marketPickerSearch: string;
  marketPickerFilter: MarketItemType;
  buyQtyMap: Record<string, number>;
  buyingOfferId: string | null;
  cancellingOfferId: string | null;
  claimingReturns: boolean;
  pendingReturnCount: number;
  isTester: boolean;
  profile: Profile | null;
  // setters
  setShowMarketModal: (v: boolean) => void;
  setMarketTab: (v: "browse" | "my_offers" | "returns") => void;
  setMarketSearch: (v: string) => void;
  setMarketQualityFilter: (v: string) => void;
  setMarketSort: (v: "price_asc" | "price_desc" | "qty_desc" | "expires_asc" | "newest" | "unit_asc") => void;
  setMarketTierFilter: (v: "all" | "1" | "2" | "3" | "4" | "5") => void;
  setMarketMyLevelOnly: (v: boolean) => void;
  setCoItemType: (v: MarketItemType) => void;
  setCoItemKey: (v: string) => void;
  setCoQty: (v: number) => void;
  setCoPrice: (v: number) => void;
  setCoPriceStr: (v: string) => void;
  setCoDuration: (v: 24 | 48 | 72) => void;
  setCreateOfferOpen: (v: boolean) => void;
  setMarketPickerOpen: (v: boolean) => void;
  setMarketPickerSearch: (v: string) => void;
  setMarketPickerFilter: (v: MarketItemType) => void;
  setBuyQtyMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  // handlers
  loadMarketData: () => Promise<void>;
  handleMarketBrowseFilter: (filter: MarketItemType | "all") => Promise<void>;
  handleCreateOffer: () => Promise<void>;
  handleBuyOffer: (offerId: string, qty: number) => Promise<void>;
  handleCancelOffer: (offerId: string) => Promise<void>;
  handleClaimAllReturns: () => Promise<void>;
  buildSellableItems: () => SellableItem[];
}

"""

market_fn_open = """\
export function MarketModal({
  showMarketModal, marketPickerOpen, marketTab, marketBrowse, myMarketOffers,
  marketReturns, marketLoading, marketBrowseFilter, marketSearch, marketQualityFilter,
  marketSort, marketTierFilter, marketMyLevelOnly,
  coItemType, coItemKey, coQty, coPrice, coPriceStr, coDuration, coLoading,
  createOfferOpen, marketPickerSearch, marketPickerFilter,
  buyQtyMap, buyingOfferId, cancellingOfferId, claimingReturns,
  pendingReturnCount, isTester, profile,
  setShowMarketModal, setMarketTab, setMarketSearch, setMarketQualityFilter,
  setMarketSort, setMarketTierFilter, setMarketMyLevelOnly,
  setCoItemType, setCoItemKey, setCoQty, setCoPrice, setCoPriceStr, setCoDuration,
  setCreateOfferOpen, setMarketPickerOpen, setMarketPickerSearch, setMarketPickerFilter,
  setBuyQtyMap,
  loadMarketData, handleMarketBrowseFilter, handleCreateOffer,
  handleBuyOffer, handleCancelOffer, handleClaimAllReturns, buildSellableItems,
}: Props) {
"""

market_unlock_indented = "\n".join("  " + l.rstrip("\n") if l.strip() else "" for l in market_get_unlock.splitlines()) + "\n"

market_fn_body_open = "  return (\n    <>\n"
market_fn_body_close = "    </>\n  );\n"
market_fn_close = "}\n"

market_content = (
    market_header
    + market_pure_fns
    + market_props
    + market_fn_open
    + market_unlock_indented
    + "\n"
    + market_fn_body_open
    + "".join(market_raw)
    + market_fn_body_close
    + market_fn_close
)

os.makedirs(MDIR, exist_ok=True)
mpath = f"{MDIR}/MarketModal.tsx"
with open(mpath, "w", encoding="utf-8") as f:
    f.write(market_content)
print(f"Napisano: {mpath}")

# ═══════════════════════════════════════════════════════════════════════════════
# 3) Aktualizacja Game.tsx
# ═══════════════════════════════════════════════════════════════════════════════
# Nowe importy (dodajemy po ostatnim "from" bloku importów)
new_imports = (
    'import { CustomersModal } from "./game/features/customers/CustomersModal";\n'
    'import { MarketModal } from "./game/features/market/MarketModal";\n'
)

# Znajdź linię po ostatnim bloku importów (szukamy pierwszej linii bez "import")
last_import = 0
for i, l in enumerate(lines):
    if l.startswith("import "):
        last_import = i
print(f"Ostatni import: linia {last_import+1}")

# Zamiana Lada (L_START–L_END) — 0-indexed
lada_replacement = """\
          {showLadaModal && (
            <CustomersModal
              showLadaInfo={showLadaInfo}
              ladaDetailIdx={ladaDetailIdx}
              ladaCardHoverIdx={ladaCardHoverIdx}
              ladaView={ladaView}
              customerOrders={customerOrders}
              customerSelling={customerSelling}
              customerLoading={customerLoading}
              customerNow={customerNow}
              nextSpawnAt={nextSpawnAt}
              newCustomerIds={newCustomerIds}
              ladaStatusMsg={ladaStatusMsg}
              carouselIdx={carouselIdx}
              profile={profile}
              mousePos={mousePos}
              completingCustomerOrderRef={completingCustomerOrderRef}
              carouselDragRef={carouselDragRef}
              carouselHasDraggedRef={carouselHasDraggedRef}
              barnItems={barnItems}
              seedInventory={seedInventory}
              fruitInventory={fruitInventory}
              hiveData={hiveData}
              setShowLadaModal={setShowLadaModal}
              setShowLadaInfo={setShowLadaInfo}
              setLadaDetailIdx={setLadaDetailIdx}
              setLadaCardHoverIdx={setLadaCardHoverIdx}
              setLadaView={setLadaView}
              setCarouselIdx={setCarouselIdx}
              completeCustomerOrder={completeCustomerOrder}
            />
          )}
"""

# Zamiana Market (M_START–M_END) — 0-indexed
market_replacement = """\
      <MarketModal
        showMarketModal={showMarketModal}
        marketPickerOpen={marketPickerOpen}
        marketTab={marketTab}
        marketBrowse={marketBrowse}
        myMarketOffers={myMarketOffers}
        marketReturns={marketReturns}
        marketLoading={marketLoading}
        marketBrowseFilter={marketBrowseFilter}
        marketSearch={marketSearch}
        marketQualityFilter={marketQualityFilter}
        marketSort={marketSort}
        marketTierFilter={marketTierFilter}
        marketMyLevelOnly={marketMyLevelOnly}
        coItemType={coItemType}
        coItemKey={coItemKey}
        coQty={coQty}
        coPrice={coPrice}
        coPriceStr={coPriceStr}
        coDuration={coDuration}
        coLoading={coLoading}
        createOfferOpen={createOfferOpen}
        marketPickerSearch={marketPickerSearch}
        marketPickerFilter={marketPickerFilter}
        buyQtyMap={buyQtyMap}
        buyingOfferId={buyingOfferId}
        cancellingOfferId={cancellingOfferId}
        claimingReturns={claimingReturns}
        pendingReturnCount={pendingReturnCount}
        isTester={isTester}
        profile={profile}
        setShowMarketModal={setShowMarketModal}
        setMarketTab={setMarketTab}
        setMarketSearch={setMarketSearch}
        setMarketQualityFilter={setMarketQualityFilter}
        setMarketSort={setMarketSort}
        setMarketTierFilter={setMarketTierFilter}
        setMarketMyLevelOnly={setMarketMyLevelOnly}
        setCoItemType={setCoItemType}
        setCoItemKey={setCoItemKey}
        setCoQty={setCoQty}
        setCoPrice={setCoPrice}
        setCoPriceStr={setCoPriceStr}
        setCoDuration={setCoDuration}
        setCreateOfferOpen={setCreateOfferOpen}
        setMarketPickerOpen={setMarketPickerOpen}
        setMarketPickerSearch={setMarketPickerSearch}
        setMarketPickerFilter={setMarketPickerFilter}
        setBuyQtyMap={setBuyQtyMap}
        loadMarketData={loadMarketData}
        handleMarketBrowseFilter={handleMarketBrowseFilter}
        handleCreateOffer={handleCreateOffer}
        handleBuyOffer={handleBuyOffer}
        handleCancelOffer={handleCancelOffer}
        handleClaimAllReturns={handleClaimAllReturns}
        buildSellableItems={buildSellableItems}
      />
"""

# Buduj nową listę linii (od końca żeby nie zaburzać indeksów)
new_lines = list(lines)

# 1) Zamień Market (większy indeks, więc najpierw)
new_lines[M_START:M_END+1] = [market_replacement]

# 2) Zamień Lada
new_lines[L_START:L_END+1] = [lada_replacement]

# 3) Dodaj importy po ostatnim imporcie
# last_import jest 0-indexed w oryginalnym lines, ale po zamianie Lada (która jest dalej)
# indeksy do last_import są niezmienione
new_lines.insert(last_import + 1, new_imports)

out = "".join(new_lines)
with open(GAME, "w", encoding="utf-8") as f:
    f.write(out)

print(f"\nGame.tsx zaktualizowany: {len(new_lines)} linii")
print("Gotowe!")
