import React from "react";
import type { MarketOffer, MarketReturn, MarketItemType } from "../../types/market";
import type { Profile } from "../../types/profile";
import { parseQualityKey } from "../../utils/crop";
import { compostTypeFromKey, compostValueFromKey } from "../../utils/compost";
import { fmtK, fmtFull } from "../../utils/ui";
import { CHAR_EQUIP_ITEMS } from "../../constants/equipment";
import { CROPS } from "../../constants/crops";
import { CROP_QUALITY_DEFS } from "../../types/crop";
import { ANIMAL_ITEMS, ANIMALS } from "../../constants/animals";
import { TREES, FRUIT_QUALITY_DEFS } from "../../constants/orchard";
import type { FruitQuality } from "../../types/orchard";
import { COMPOST_DEFS } from "../../constants/compost";
import { getItemTierIndex } from "../../utils/equipment";
import { isCompostKey } from "../../utils/compost";

// ── Pure helpers (moved from Game component scope) ──────────────────────────
  function marketMinPrice(type: string, key: string, upg?: number): number {
    if (type === "equipment") {
      const eItem = CHAR_EQUIP_ITEMS.find(i => i.id === key);
      if (!eItem) return 1;
      const tier = getItemTierIndex(eItem.unlockLevel);
      if (tier <= 3) return 1;
      const baseMin: Record<number, number> = { 4: 3000, 5: 6000, 6: 12000, 7: 25000, 8: 50000 };
      const base = baseMin[Math.min(tier, 8)] ?? 1;
      const upgMults = [1.0, 1.03, 1.07, 1.12, 1.17, 1.23, 1.35, 1.5, 2.0, 2.5, 3.4];
      const mult = upgMults[Math.min(upg ?? 0, 10)] ?? 3.4;
      return Math.round(base * mult);
    }
    return 1;
  }

  function marketItemLabel(type: string, key: string): { name: string; icon: string } {
    if (type === "crop") {
      const { baseCropId, quality } = parseQualityKey(key);
      const crop = CROPS.find(c => c.id === baseCropId);
      const qDef = quality ? CROP_QUALITY_DEFS[quality] : null;
      return { name: `${crop?.name ?? baseCropId} (${qDef?.label ?? quality ?? ""})`, icon: qDef?.badge ?? "" };
    }
    if (type === "compost") {
      const ct = compostTypeFromKey(key);
      const val = compostValueFromKey(key);
      if (ct) { const def = COMPOST_DEFS[ct]; return { name: `${def.name} (${def.tierName(val)})`, icon: def.icon }; }
      return { name: key, icon: "🌿" };
    }
    if (type === "barn_item") {
      const ai = ANIMAL_ITEMS.find(a => a.id === key);
      return { name: ai?.name ?? key, icon: ai?.icon ?? "🐾" };
    }
    if (type === "fruit") {
      const qualSuffix = (["_zloty","_soczysty","_zgnile","_zwykly"] as const).find(s => key.endsWith(s));
      if (qualSuffix) {
        const treeId = key.slice(0, -qualSuffix.length);
        const tree = TREES.find(t => t.id === treeId);
        const qDef = FRUIT_QUALITY_DEFS[qualSuffix.slice(1) as FruitQuality];
        return { name: `${tree?.fruitName ?? treeId} (${qDef?.label ?? ""})`, icon: (tree?.fruitIcon ?? "🍎") + (qDef?.icon ?? "") };
      }
      return { name: key, icon: "🍎" };
    }
    if (type === "honey") return { name: "Słoik miodu", icon: "🍯" };
    if (type === "equipment") {
      const eItem = CHAR_EQUIP_ITEMS.find(i => i.id === key);
      return { name: eItem?.name ?? key, icon: eItem?.icon ?? "⚔️" };
    }
    return { name: key, icon: "📦" };
  }

  function getMarketItemImg(type: MarketItemType, key: string): string | null {
    if (type === "crop") {
      const { baseCropId, quality } = parseQualityKey(key);
      const crop = CROPS.find(c => c.id === baseCropId);
      if (!crop) return null;
      if (quality === "legendary" && crop.legendarySpritePath) return crop.legendarySpritePath;
      if (quality === "epic"      && crop.epicSpritePath)      return crop.epicSpritePath;
      if (quality === "rotten"    && crop.rottenSpritePath)    return crop.rottenSpritePath;
      return crop.spritePath;
    }
    if (type === "barn_item") return `/przedmioty/item_${key}.png`;
    if (type === "honey")     return `/przedmioty/jar_honey.png`;
    return null;
  }

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
  getItemUpg: (id: string) => number;
}

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
  handleBuyOffer, handleCancelOffer, handleClaimAllReturns, buildSellableItems, getItemUpg,
}: Props) {
    function getItemUnlockLevel(type: MarketItemType, key: string): number {
      if (type === "crop") { const { baseCropId } = parseQualityKey(key); return CROPS.find(c => c.id === baseCropId)?.unlockLevel ?? 1; }
      if (type === "equipment") { return CHAR_EQUIP_ITEMS.find(i => i.id === key)?.unlockLevel ?? 1; }
      if (type === "barn_item" || type === "honey") { return ANIMALS.find(a => a.itemId === key || a.id === key)?.unlockLevel ?? 1; }
      if (type === "fruit") { return TREES.find(t => t.fruitId === key)?.unlockLevel ?? 1; }
      return 1;
    }

  return (
    <>
      {showMarketModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[#8b6a3e] shadow-2xl mx-2"
            style={{ background: `url('/mapy/targ_tlo.png') center/cover no-repeat, rgba(18,10,5,0.98)` }}>
            {/* Nagłówek */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#8b6a3e] bg-[linear-gradient(180deg,rgba(110,73,35,0.97),rgba(76,48,23,0.97))] px-6 py-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#f0d48a] font-bold">Miasto</p>
                <h2 className="text-3xl font-black text-[#f9e7b2]">Targ Graczy</h2>
              </div>
              <button type="button" onClick={() => setShowMarketModal(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#8b6a3e] text-[#f9e7b2] hover:bg-[rgba(80,50,20,0.5)] transition font-black text-2xl">X</button>
            </div>
            {/* Zakładki */}
            <div className="flex shrink-0 gap-1 border-b border-[#8b6a3e]/60 bg-black/60 px-4 pt-3 pb-0">
              {([
                { id: "browse" as const,    label: "Przeglądaj" },
                { id: "my_offers" as const, label: "Moje Oferty" },
                { id: "returns" as const,   label: `Do Odbioru${pendingReturnCount > 0 ? ` (${pendingReturnCount})` : ""}` },
              ]).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMarketTab(t.id)}
                  className={`rounded-t-xl px-5 py-2.5 text-base font-bold transition ${marketTab === t.id ? "bg-[#8b6a3e] text-[#f9e7b2]" : "text-[#f0d48a] hover:bg-white/10"} ${t.id === "returns" && pendingReturnCount > 0 ? "!text-[#fbbf24]" : ""}`}
                >
                  {t.label}
                </button>
              ))}
              <button type="button" onClick={() => void loadMarketData()} disabled={marketLoading} className="ml-auto mb-1 rounded-xl border border-[#8b6a3e]/70 bg-black/30 px-4 py-1.5 text-sm font-bold text-[#f0d48a] hover:bg-white/10 transition disabled:opacity-40">
                {marketLoading ? "Wczytuję..." : "Odswież"}
              </button>
            </div>

            {/* Treść */}
            <div className="flex-1 overflow-y-auto p-4 bg-[rgba(12,7,3,0.80)]">

              {/* ── PRZEGLĄDAJ ── */}
              {marketTab === "browse" && (() => {
                const playerLvl = profile?.level ?? 1;
                const getOfferUnlockLevel = (o: MarketOffer): number => getItemUnlockLevel(o.item_type, o.item_key);
                const tierGroup = (lvl: number): string => {
                  if (lvl <= 5)  return "1";
                  if (lvl <= 10) return "2";
                  if (lvl <= 15) return "3";
                  if (lvl <= 20) return "4";
                  return "5";
                };
                const filteredMarketBrowse = marketBrowse.filter(o => {
                  if (marketSearch.trim()) {
                    const q = marketSearch.trim().toLowerCase();
                    if (!o.item_name.toLowerCase().includes(q)) return false;
                  }
                  if (marketQualityFilter !== "all") {
                    if (o.item_type === "crop") {
                      const { quality } = parseQualityKey(o.item_key);
                      if (quality !== marketQualityFilter) return false;
                    } else if (o.item_type === "fruit") {
                      const lastU = o.item_key.lastIndexOf("_");
                      const q = lastU >= 0 ? o.item_key.slice(lastU + 1) : "";
                      if (q !== marketQualityFilter) return false;
                    } else if (o.item_type === "compost") {
                      const ct = compostTypeFromKey(o.item_key);
                      if (ct !== marketQualityFilter) return false;
                    }
                  }
                  if (marketTierFilter !== "all") {
                    const ul = getOfferUnlockLevel(o);
                    if (tierGroup(ul) !== marketTierFilter) return false;
                  }
                  if (getOfferUnlockLevel(o) > playerLvl) return false;
                  return true;
                }).sort((a, b) => {
                  switch (marketSort) {
                    case "price_asc":  return a.price_per_unit - b.price_per_unit;
                    case "price_desc": return b.price_per_unit - a.price_per_unit;
                    case "qty_desc":   return b.quantity - a.quantity;
                    case "expires_asc": return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
                    case "newest":     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    case "unit_asc":   return a.price_per_unit - b.price_per_unit;
                    default:           return 0;
                  }
                });
                return (
                <div>
                  {/* Kategorie */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {([
                      { id: "crop" as const,       label: "Uprawy" },
                      { id: "compost" as const,    label: "Kompost" },
                      { id: "barn_item" as const,  label: "Zwierzeta" },
                      { id: "fruit" as const,      label: "Owoce" },
                      { id: "honey" as const,      label: "Miod" },
                      { id: "equipment" as const,  label: "Ekwipunek" },
                    ]).map(f => (
                      <button key={f.id} type="button"
                        onClick={() => { setMarketSearch(""); setMarketQualityFilter("all"); setMarketTierFilter("all"); setMarketMyLevelOnly(false); void handleMarketBrowseFilter(f.id); }}
                        className={`rounded-xl px-4 py-1.5 text-sm font-bold transition ${marketBrowseFilter === f.id ? "bg-[#8b6a3e] text-[#f9e7b2]" : "border border-[#c9a96e]/70 bg-black/40 text-[#f0d48a] hover:bg-black/60"}`}
                      >{f.label}</button>
                    ))}
                  </div>

                  {/* Wyszukiwarka */}
                  <div className="mb-3 relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b6a3e] text-base">🔍</span>
                    <input
                      type="text"
                      value={marketSearch}
                      onChange={e => setMarketSearch(e.target.value)}
                      placeholder="Szukaj przedmiotu..."
                      className="w-full rounded-xl border border-[#8b6a3e]/70 bg-black/50 pl-9 pr-4 py-2.5 text-sm text-[#f3e6c8] placeholder-[#8b6a3e] outline-none focus:border-[#d8ba7a]/60"
                    />
                  </div>

                  {/* Filtry jakości (kontekstowe) + sortowanie */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {(() => {
                      const qualOpts: { id: string; label: string }[] | null =
                        marketBrowseFilter === "crop" ? [
                          { id:"all",       label:"Wszystkie" },
                          { id:"rotten",    label:"⚪ Popsute" },
                          { id:"good",      label:"🟢 Zwykłe" },
                          { id:"epic",      label:"🟣 Epickie" },
                          { id:"legendary", label:"👑 Legen." },
                        ] : marketBrowseFilter === "fruit" ? [
                          { id:"all",      label:"Wszystkie" },
                          { id:"zgnile",   label:"🍂 Zgniłe" },
                          { id:"zwykle",   label:"🍎 Zwykłe" },
                          { id:"soczyste", label:"💧 Soczyste" },
                          { id:"zlote",    label:"✨ Złote" },
                        ] : marketBrowseFilter === "compost" ? [
                          { id:"all",    label:"Wszystkie" },
                          { id:"growth", label:"⚡ Wzrostu" },
                          { id:"yield",  label:"🌾 Urodzaju" },
                          { id:"exp",    label:"⭐ Nauki" },
                        ] : null;
                      return qualOpts ? (
                        <>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">Jakość:</span>
                          {qualOpts.map(q => (
                            <button key={q.id} type="button"
                              onClick={() => setMarketQualityFilter(q.id)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${marketQualityFilter === q.id ? "bg-[#8b6a3e] text-[#f9e7b2]" : "border border-[#c9a96e]/50 bg-black/40 text-[#f0d48a] hover:bg-black/60"}`}
                            >{q.label}</button>
                          ))}
                        </>
                      ) : null;
                    })()}
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">Sortuj:</span>
                      <select
                        value={marketSort}
                        onChange={e => setMarketSort(e.target.value as typeof marketSort)}
                        className="rounded-lg border border-[#8b6a3e]/70 bg-[rgba(17,10,6,0.85)] px-2 py-1.5 text-xs font-bold text-[#f0d48a] outline-none cursor-pointer"
                      >
                        <option value="newest">Najnowsze</option>
                        <option value="price_asc">Cena rosnaco</option>
                        <option value="price_desc">Cena malejaco</option>
                        <option value="qty_desc">Ilosc</option>
                        <option value="expires_asc">Czas konca</option>
                        <option value="unit_asc">Najtansze/szt.</option>
                      </select>
                    </div>
                  </div>

                  {/* Filtr tierów + mój poziom */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">Poziom:</span>
                    {([
                      { id: "all" as const, label: "Wszystkie" },
                      { id: "1" as const,   label: "Lv 1–5" },
                      { id: "2" as const,   label: "Lv 6–10" },
                      { id: "3" as const,   label: "Lv 11–15" },
                      { id: "4" as const,   label: "Lv 16–20" },
                      { id: "5" as const,   label: "Lv 21–25" },
                    ]).map(t => (
                      <button key={t.id} type="button"
                        onClick={() => setMarketTierFilter(t.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${marketTierFilter === t.id ? "bg-[#8b6a3e] text-[#f9e7b2]" : "border border-[#c9a96e]/50 bg-black/40 text-[#f0d48a] hover:bg-black/60"}`}
                      >{t.label}</button>
                    ))}
                  </div>

                  {isTester && (
                    <div className="mb-3 rounded-xl border border-red-500/60 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
                      Targ jest zablokowany dla tego konta.
                    </div>
                  )}
                  {marketLoading && <p className="py-10 text-center text-base font-bold text-[#f0d48a]">Wczytuję oferty...</p>}
                  {!marketLoading && filteredMarketBrowse.length === 0 && (
                    <div className="rounded-2xl border border-[#8b6a3e]/60 bg-black/60 p-10 text-center text-base font-bold text-[#f0d48a]">
                      {marketBrowse.length === 0 ? "Brak aktywnych ofert w tej kategorii." : "Brak ofert pasujacych do filtrow."}
                    </div>
                  )}
                  {!marketLoading && filteredMarketBrowse.length > 0 && (
                    <div className="space-y-2">
                      {filteredMarketBrowse.map(offer => {
                        const isOwn = offer.seller_id === profile?.id;
                        const timeLeft = Math.max(0, new Date(offer.expires_at).getTime() - Date.now());
                        const hoursLeft = Math.floor(timeLeft / 3600000);
                        const minsLeft  = Math.floor((timeLeft % 3600000) / 60000);
                        const buyQty = Math.min(buyQtyMap[offer.id] ?? 1, offer.quantity);
                        const buyTotal = offer.price_per_unit * buyQty;
                        return (
                          <div key={offer.id} className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/60 bg-black/65 px-4 py-3">
                            <span className="text-2xl shrink-0">{offer.item_icon || "📦"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-bold text-[#f9e7b2] truncate">{offer.item_name}</p>
                              <p className="text-sm font-medium text-[#f0d48a]">{offer.quantity} szt. &middot; {offer.price_per_unit.toLocaleString("pl-PL")} zł/szt.</p>
                              <p className="text-sm text-[#c9a96e]">{offer.seller_name ?? "Nieznany"} &middot; wygasa za {hoursLeft > 0 ? `${hoursLeft}h ` : ""}{minsLeft}min</p>
                            </div>
                            {isOwn ? (
                              <span className="rounded-lg border border-[#c9a96e]/60 bg-black/40 px-3 py-1 text-sm font-bold text-[#c9a96e] shrink-0">Twoja</span>
                            ) : (
                              <div className="flex shrink-0 items-center gap-1.5">
                                {/* Stepper ilości */}
                                {offer.quantity > 1 && (
                                  <div className="flex items-center rounded-xl border border-[#8b6a3e]/60 bg-black/40 overflow-hidden">
                                    <button type="button"
                                      onClick={() => setBuyQtyMap(prev => ({ ...prev, [offer.id]: Math.max(1, (prev[offer.id] ?? 1) - 1) }))}
                                      className="px-2 py-1.5 text-base font-black text-[#f0d48a] hover:bg-white/10 transition disabled:opacity-40"
                                      disabled={buyQty <= 1}
                                    >−</button>
                                    <input
                                      type="number" min={1} max={offer.quantity}
                                      value={buyQty}
                                      onChange={e => setBuyQtyMap(prev => ({ ...prev, [offer.id]: Math.min(offer.quantity, Math.max(1, parseInt(e.target.value) || 1)) }))}
                                      className="w-12 bg-transparent text-center text-sm font-bold text-[#f9e7b2] outline-none"
                                    />
                                    <button type="button"
                                      onClick={() => setBuyQtyMap(prev => ({ ...prev, [offer.id]: Math.min(offer.quantity, (prev[offer.id] ?? 1) + 1) }))}
                                      className="px-2 py-1.5 text-base font-black text-[#f0d48a] hover:bg-white/10 transition disabled:opacity-40"
                                      disabled={buyQty >= offer.quantity}
                                    >+</button>
                                  </div>
                                )}
                                <div className="flex flex-col items-end gap-0.5">
                                  <button type="button" disabled={buyingOfferId === offer.id || isTester}
                                    onClick={() => void handleBuyOffer(offer.id, buyQty)}
                                    className="rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-2 text-sm font-black text-[#2f1b0c] shadow hover:brightness-110 transition disabled:opacity-50"
                                    title={isTester ? "Targ jest zablokowany dla tego konta." : undefined}
                                  >{buyingOfferId === offer.id ? "..." : "Kup"}</button>
                                  <p className="text-xs font-bold text-[#ffe082]">{buyTotal.toLocaleString("pl-PL")} zł</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })()}

              {/* ── MOJE OFERTY ── */}
              {marketTab === "my_offers" && (() => {
                const activeOffers  = myMarketOffers.filter(o => o.status === "active");
                const historyOffers = myMarketOffers.filter(o => o.status !== "active");
                const lvl = profile?.level ?? 1;
                const maxOffers = lvl >= 25 ? 10 : lvl >= 20 ? 8 : lvl >= 10 ? 5 : 3;
                // Anti-boost: limity
                const getActiveValLimit = (l: number): number | null => {
                  if (l >= 25) return null;
                  if (l >= 20) return 500000; if (l >= 15) return 150000;
                  if (l >= 10) return 50000;  if (l >= 7)  return 10000;
                  if (l >= 5)  return 5000;   if (l >= 3)  return 2500;
                  return 1000;
                };
                const getDailyLimit = (l: number): number | null => {
                  if (l >= 25) return null;
                  if (l >= 20) return 750000; if (l >= 15) return 300000;
                  if (l >= 10) return 100000; if (l >= 7)  return 25000;
                  if (l >= 5)  return 10000;  if (l >= 3)  return 5000;
                  return 2000;
                };
                const activeValLimit = getActiveValLimit(lvl);
                const dailyLimit     = getDailyLimit(lvl);
                const activeVal      = activeOffers.reduce((s, o) => s + o.quantity * o.price_per_unit, 0);
                // Dzienny zarobek — z profilu (SQL resetuje przy tworzeniu oferty o północy Warsaw)
                const todayPl = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" })).toISOString().slice(0, 10);
                const earnedDateOk = profile?.market_earned_date === todayPl;
                const earnedToday  = earnedDateOk ? (profile?.market_earned_today ?? 0) : 0;
                const dailyBlocked = dailyLimit !== null && earnedToday >= dailyLimit;
                const canAddOffer  = activeOffers.length < maxOffers && !dailyBlocked && !isTester;
                return (
                  <div>
                    {isTester && (
                      <div className="mb-4 rounded-xl border border-red-500/60 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
                        Targ jest zablokowany dla tego konta.
                      </div>
                    )}
                    {/* ── MMO HUD: karty limitów ── */}
                    {(() => {
                      const slotPct   = Math.min(100, (activeOffers.length / maxOffers) * 100);
                      const valPct    = activeValLimit ? Math.min(100, (activeVal / activeValLimit) * 100) : 0;
                      const earnPct   = dailyLimit     ? Math.min(100, (earnedToday / dailyLimit) * 100)   : 0;
                      const slotCrit  = slotPct  >= 92;
                      const valCrit   = valPct   >= 92;
                      const earnCrit  = earnPct  >= 92;
                      // Czas do resetu o polnocy Warsaw
                      const nowWaw    = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
                      const midnight  = new Date(nowWaw); midnight.setHours(24, 0, 0, 0);
                      const secsLeft  = Math.max(0, Math.floor((midnight.getTime() - nowWaw.getTime()) / 1000));
                      const hh        = String(Math.floor(secsLeft / 3600)).padStart(2, "0");
                      const mm        = String(Math.floor((secsLeft % 3600) / 60)).padStart(2, "0");
                      const ss        = String(secsLeft % 60).padStart(2, "0");
                      const resetIn   = `${hh}:${mm}:${ss}`;
                      type CardProps = { label: string; cur: string; max: string; pct: number; barColor: string; crit: boolean; tooltip?: string };
                      const Card = ({ label, cur, max, pct, barColor, crit, tooltip }: CardProps) => (
                        <div
                          title={tooltip}
                          className={`relative flex-1 min-w-[120px] rounded-2xl border bg-black/40 p-3 overflow-hidden transition-all duration-300 ${crit ? "border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.4)]" : "border-[#8b6a3e]/50"}`}
                          style={crit ? { animation: "mkt-pulse 1.6s ease-in-out infinite" } : undefined}
                        >
                          <div className="mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#c9a96e]">{label}</span>
                          </div>
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className={`text-lg font-black leading-none ${crit ? "text-red-400" : "text-[#f9e7b2]"}`}>{cur}</span>
                            <span className="text-xs text-[#8b6a3e] font-medium">/ {max}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: crit ? "linear-gradient(90deg,#ef4444,#f97316)" : barColor,
                              }}
                            />
                          </div>
                          {cur === max ? (
                            <div className="mt-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wide">Limit osiągnięty</div>
                          ) : crit ? (
                            <div className="mt-1.5 text-[10px] font-bold text-orange-400 uppercase tracking-wide">Bliski limitu</div>
                          ) : null}
                        </div>
                      );
                      return (
                        <>
                          <style>{`@keyframes mkt-pulse{0%,100%{box-shadow:0 0 12px rgba(239,68,68,.4)}50%{box-shadow:0 0 22px rgba(239,68,68,.75)}}`}</style>
                          <div className="mb-1 flex gap-2">
                            <Card
                              label="Oferty"
                              cur={String(activeOffers.length)} max={String(maxOffers)}
                              pct={slotPct} crit={slotCrit}
                              barColor="linear-gradient(90deg,#f2ca69,#c9952f)"
                              tooltip="Liczba aktywnych ofert na targu"
                            />
                            <Card
                              label="Wartość ofert"
                              cur={fmtFull(Math.round(activeVal))}
                              max={activeValLimit ? fmtFull(activeValLimit) + " zł" : "∞"}
                              pct={valPct} crit={valCrit}
                              barColor="linear-gradient(90deg,#f59e0b,#d97706)"
                              tooltip={activeValLimit ? `Łączna wartość aktywnych ofert. Limit dla poziomu ${lvl}: ${fmtFull(activeValLimit)} zł` : "Brak limitu wartości na Twoim poziomie"}
                            />
                            <Card
                              label="Zarobek dziś"
                              cur={fmtFull(Math.round(earnedToday))}
                              max={dailyLimit ? fmtFull(dailyLimit) + " zł" : "∞"}
                              pct={earnPct} crit={earnCrit}
                              barColor="linear-gradient(90deg,#22c55e,#16a34a)"
                              tooltip="Zarobek z targu resetuje się codziennie o 00:00 czasu polskiego"
                            />
                          </div>
                          {/* Reset countdown */}
                          <div className="mb-3 flex items-center justify-end gap-2">
                            <span className="text-xs uppercase tracking-widest text-[#8b6a3e] font-semibold">Reset limitu za</span>
                            <span className="rounded-md bg-black/40 border border-[#8b6a3e]/40 px-3 py-1 font-mono text-sm font-bold text-[#f0d48a] tabular-nums">{resetIn}</span>
                          </div>
                          {/* Przycisk Dodaj ofertę */}
                          <div className="mb-4 flex items-center justify-between">
                            <p className="text-xs text-[#8b6a3e]">Poziom {lvl}</p>
                            <button type="button"
                              disabled={!canAddOffer}
                              onClick={() => { setMarketPickerSearch(""); setMarketPickerFilter("crop"); setMarketPickerOpen(true); }}
                              className="rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >+ Dodaj ofertę</button>
                          </div>
                          {dailyBlocked && (
                            <div className="mb-3 rounded-xl border border-red-500/50 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
                              Osiagnales dzienny limit zarobku z targu ({fmtK(dailyLimit!)} zł). Mozesz wystawiac nowe oferty po polnocy czasu polskiego.
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* ── Panel konfiguracji oferty (po wybraniu itemu z pickera) ── */}
                    {createOfferOpen && coItemKey && (() => {
                      const sellable     = buildSellableItems();
                      const selectedItem = sellable.find(i => i.key === coItemKey && i.type === coItemType);
                      const maxQty       = selectedItem?.qty ?? 1;
                      const minP         = marketMinPrice(coItemType, coItemKey, coItemType === "equipment" ? getItemUpg(coItemKey) : undefined);
                      const total        = Math.round(coQty * coPrice * 100) / 100;
                      const tax          = Math.round(total * 0.1 * 100) / 100;
                      const extFee       = coDuration === 48 ? Math.round(total * 0.03 * 100) / 100 : coDuration === 72 ? Math.round(total * 0.07 * 100) / 100 : 0;
                      const sellerGets   = Math.round((total - tax - extFee) * 100) / 100;
                      return (
                        <div className="mb-4 rounded-2xl border border-[#d8ba7a]/40 bg-[rgba(255,255,255,0.03)] p-5 space-y-4">
                          {/* Nagłówek */}
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-black text-[#d8ba7a]">Nowa oferta</p>
                            <div className="flex items-center gap-2">
                              <button type="button"
                                onClick={() => { setMarketPickerOpen(true); }}
                                className="rounded-lg border border-[#8b6a3e]/60 bg-black/20 px-3 py-1.5 text-sm font-bold text-[#dfcfab] hover:bg-white/5 transition"
                              >Zmień przedmiot</button>
                              <button type="button"
                                onClick={() => { setCreateOfferOpen(false); setCoItemKey(""); }}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#8b6a3e]/60 text-[#dfcfab] hover:text-red-300 font-bold transition"
                              >✕</button>
                            </div>
                          </div>
                          {/* Wybrany przedmiot */}
                          <div className="flex items-center gap-4 rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-4 py-3">
                            {selectedItem?.imgPath ? (
                              <img src={selectedItem.imgPath} alt={selectedItem.name} className="h-16 w-16 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                            ) : (
                              <span className="text-5xl shrink-0">{selectedItem?.icon || "📦"}</span>
                            )}
                            <div>
                              <p className="text-base font-bold text-[#f3e6c8]">{selectedItem?.name ?? coItemKey}</p>
                              <p className="text-sm text-[#dfcfab]">Posiadasz: <span className="font-bold text-[#f9e7b2]">{maxQty} szt.</span></p>
                              <p className="text-sm text-[#8b6a3e]">Min. cena: {minP.toLocaleString("pl-PL")} zł/szt.</p>
                            </div>
                          </div>
                          {/* Ilość + cena */}
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="mb-1.5 block text-sm font-bold uppercase tracking-wider text-[#dfcfab]">Ilość (max {maxQty})</label>
                              <input type="number" min={1} max={maxQty} value={coQty}
                                onChange={e => setCoQty(Math.min(maxQty, Math.max(1, parseInt(e.target.value)||1)))}
                                className="w-full rounded-xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.8)] px-3 py-2.5 text-base text-[#f3e6c8] outline-none focus:border-[#d8ba7a]/60"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="mb-1.5 block text-sm font-bold uppercase tracking-wider text-[#dfcfab]">Cena/szt. (min 1 zł)</label>
                              <input type="text" inputMode="decimal" value={coPriceStr}
                                onChange={e => {
                                  const raw = e.target.value.replace(",", ".");
                                  setCoPriceStr(e.target.value);
                                  const parsed = parseFloat(raw);
                                  if (!isNaN(parsed)) setCoPrice(Math.round(parsed * 100) / 100);
                                }}
                                onBlur={() => {
                                  const val = Math.max(1, isNaN(coPrice) ? 1 : coPrice);
                                  setCoPrice(val);
                                  setCoPriceStr(String(val));
                                }}
                                className="w-full rounded-xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.8)] px-3 py-2.5 text-base text-[#f3e6c8] outline-none focus:border-[#d8ba7a]/60"
                              />
                            </div>
                          </div>
                          {/* Czas trwania */}
                          <div>
                            <label className="mb-1.5 block text-sm font-bold uppercase tracking-wider text-[#dfcfab]">Czas trwania</label>
                            <div className="flex gap-2">
                              {([24, 48, 72] as const).map(d => {
                                const dFee = d === 48 ? Math.round(total * 0.03 * 100) / 100 : d === 72 ? Math.round(total * 0.07 * 100) / 100 : 0;
                                const label = d === 24 ? "24h (darmowe)" : d === 48 ? `48h (+${dFee > 0 ? dFee.toLocaleString("pl-PL") : "3%"} zł)` : `72h (+${dFee > 0 ? dFee.toLocaleString("pl-PL") : "7%"} zł)`;
                                return (
                                  <button key={d} type="button" onClick={() => setCoDuration(d)}
                                    className={`flex-1 rounded-xl border py-2.5 text-base font-bold transition ${coDuration === d ? "border-[#f4cf78] bg-[rgba(242,202,105,0.15)] text-[#f9e7b2]" : "border-[#8b6a3e]/40 text-[#dfcfab] hover:bg-white/5"}`}
                                  >{label}</button>
                                );
                              })}
                            </div>
                          </div>
                          {/* Podsumowanie */}
                          <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-4 space-y-1.5">
                            <p className="text-sm text-[#dfcfab]">Łączna cena: <span className="text-base font-bold text-[#f9e7b2]">{total.toLocaleString("pl-PL")} zł</span></p>
                            <p className="text-sm text-[#dfcfab]">Podatek rynku (10%): <span className="font-bold text-[#fca5a5]">-{tax.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</span></p>
                            {extFee > 0 && <p className="text-sm text-[#dfcfab]">Opłata za 48h (5%): <span className="font-bold text-[#fca5a5]">-{extFee.toLocaleString("pl-PL")} zł</span></p>}
                            <div className="mt-1 border-t border-[#8b6a3e]/30 pt-1.5">
                              <p className="text-sm text-[#dfcfab]">Otrzymasz po sprzedaży: <span className="text-lg font-black text-[#86efac]">{sellerGets.toLocaleString("pl-PL")} zł</span></p>
                            </div>
                          </div>
                          {/* Przycisk */}
                          <button type="button"
                            disabled={coLoading || !coItemKey || coQty <= 0 || coPrice < minP}
                            onClick={() => void handleCreateOffer()}
                            className="w-full rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] py-3.5 text-lg font-black text-[#2f1b0c] hover:brightness-110 transition disabled:opacity-50"
                          >{coLoading ? "Wystawianie..." : "Wystaw ofertę"}</button>
                        </div>
                      );
                    })()}

                    {/* Lista aktywnych ofert */}
                    {activeOffers.length === 0 && !createOfferOpen && (
                      <div className="rounded-2xl border border-[#8b6a3e]/60 bg-black/60 p-8 text-center text-base font-bold text-[#f0d48a]">Nie masz aktywnych ofert.</div>
                    )}
                    {activeOffers.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="text-sm font-bold uppercase tracking-wider text-[#c9a96e] mb-1">Aktywne</p>
                        {activeOffers.map(offer => {
                          const timeLeft = Math.max(0, new Date(offer.expires_at).getTime() - Date.now());
                          const hoursLeft = Math.floor(timeLeft / 3600000);
                          const minsLeft  = Math.floor((timeLeft % 3600000) / 60000);
                          return (
                            <div key={offer.id} className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/60 bg-black/65 px-4 py-3">
                              <span className="text-xl shrink-0">{offer.item_icon || "📦"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-bold text-[#f9e7b2] truncate">{offer.item_name}</p>
                                <p className="text-sm font-medium text-[#f0d48a]">{offer.quantity} szt. &middot; {offer.price_per_unit.toLocaleString("pl-PL")} zł/szt.</p>
                                <p className="text-sm text-[#c9a96e]">wygasa za {hoursLeft > 0 ? `${hoursLeft}h ` : ""}{minsLeft}min</p>
                              </div>
                              <button type="button" disabled={cancellingOfferId === offer.id}
                                onClick={() => void handleCancelOffer(offer.id)}
                                className="shrink-0 rounded-xl border border-[#c9a96e]/70 bg-black/40 px-3 py-2 text-sm font-bold text-[#f0d48a] hover:bg-[rgba(80,50,20,0.5)] transition disabled:opacity-50"
                              >{cancellingOfferId === offer.id ? "..." : "Anuluj"}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Historia */}
                    {historyOffers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-bold uppercase tracking-wider text-[#c9a96e] mb-1">Historia</p>
                        {historyOffers.slice(0, 20).map(offer => {
                          const statusColor = offer.status === "sold" ? "#86efac" : offer.status === "expired" ? "#fca5a5" : "#d8ba7a";
                          const statusLabel = offer.status === "sold" ? "Sprzedano" : offer.status === "expired" ? "Wygasła" : "Anulowano";
                          return (
                            <div key={offer.id} className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/40 bg-black/55 px-4 py-2">
                              <span className="text-lg shrink-0">{offer.item_icon || "📦"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-medium text-[#f0d48a] truncate">{offer.item_name}</p>
                                <p className="text-sm text-[#c9a96e]">{offer.quantity} szt. &middot; {offer.price_per_unit.toLocaleString("pl-PL")} zł/szt.</p>
                              </div>
                              <span className="text-sm font-bold shrink-0" style={{ color: statusColor }}>{statusLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── DO ODBIORU ── */}
              {marketTab === "returns" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-base font-medium text-[#f0d48a]">Czeka na odbiór: <span className="font-bold text-[#f9e7b2]">{marketReturns.length}</span></p>
                    {marketReturns.length > 0 && (
                      <button type="button" disabled={claimingReturns}
                        onClick={() => void handleClaimAllReturns()}
                        className="rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-2 text-sm font-black text-[#2f1b0c] hover:brightness-110 transition disabled:opacity-50"
                      >{claimingReturns ? "Odbieram..." : "Odbierz wszystko"}</button>
                    )}
                  </div>
                  {marketReturns.length === 0 && (
                    <div className="rounded-2xl border border-[#8b6a3e]/60 bg-black/60 p-10 text-center text-base font-bold text-[#f0d48a]">
                      Nic tu nie czeka. Sprzedaj coś na targu albo anuluj ofertę.
                    </div>
                  )}
                  {marketReturns.length > 0 && (
                    <div className="space-y-2">
                      {marketReturns.map(ret => {
                        const reasonLabel = ret.reason === "sold" ? "Sprzedano" : ret.reason === "expired" ? "Wygasła" : "Anulowano";
                        const reasonColor = ret.reason === "sold" ? "#86efac" : ret.reason === "expired" ? "#fca5a5" : "#d8ba7a";
                        return (
                          <div key={ret.id} className="flex items-center gap-3 rounded-xl border border-[#8b6a3e]/60 bg-black/65 px-4 py-3">
                            <span className="text-2xl shrink-0">{ret.return_type === "gold" ? "💰" : (ret.item_icon || "📦")}</span>
                            <div className="flex-1">
                              {ret.return_type === "gold" ? (
                                <>
                                  <p className="text-base font-bold text-[#f9e7b2]">+{(ret.gold_amount ?? 0).toLocaleString("pl-PL")} zł</p>
                                  <p className="text-sm font-medium" style={{ color: reasonColor }}>{reasonLabel}</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-base font-bold text-[#f9e7b2]">{ret.item_name ?? ret.item_key} x{ret.quantity}</p>
                                  <p className="text-sm font-medium" style={{ color: reasonColor }}>{reasonLabel}</p>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ─── PICKER ITEMÓW TARGU — overlay ponad modalem ─────────────────── */}
      {marketPickerOpen && (() => {
        const sellable = buildSellableItems();
        const filtered = sellable.filter(i => i.type === marketPickerFilter).filter(i => {
          if (!marketPickerSearch.trim()) return true;
          return i.name.toLowerCase().includes(marketPickerSearch.trim().toLowerCase());
        });
        const PICKER_FILTERS: { id: MarketItemType; label: string; icon: string }[] = [
          { id: "crop",      label: "Uprawy",     icon: "🌱" },
          { id: "fruit",     label: "Owoce",      icon: "🍎" },
          { id: "barn_item", label: "Stodoła",    icon: "🐔" },
          { id: "compost",   label: "Kompost",    icon: "🌿" },
          { id: "honey",     label: "Miód",       icon: "🍯" },
          { id: "equipment", label: "Ekwipunek",  icon: "⚔️" },
        ];
        const CROP_QUALITY_GROUPS = [
          { label: "Zepsute",    quality: "rotten",    color: "#6b7280" },
          { label: "Zwykłe",     quality: "good",      color: "#f3e6c8" },
          { label: "Epickie",    quality: "epic",      color: "#a855f7" },
          { label: "Legendarne", quality: "legendary", color: "#f59e0b" },
        ];
        const FRUIT_QUALITY_GROUPS = [
          { label: "Zgnite",    quality: "zgnile",   color: "#6b7280" },
          { label: "Zwykłe",    quality: "zwykly",   color: "#f3e6c8" },
          { label: "Soczyste",  quality: "soczysty", color: "#22c55e" },
          { label: "Złote",     quality: "zloty",    color: "#f59e0b" },
        ];
        const EQ_SLOT_GROUPS = [
          { label: "Głowa",  slot: "glowa",  icon: "👑" },
          { label: "Dłonie", slot: "dlonie", icon: "🧤" },
          { label: "Nogi",   slot: "nogi",   icon: "👢" },
        ];
        function renderPickerTile(item: typeof filtered[0]) {
          return (
            <button
              key={`${item.type}::${item.key}`}
              type="button"
              onClick={() => {
                setCoItemType(item.type);
                setCoItemKey(item.key);
                setCoQty(1);
                setCoPrice(item.minPrice);
                setCoPriceStr(String(item.minPrice));
                setCoDuration(24);
                setMarketPickerOpen(false);
                setCreateOfferOpen(true);
              }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[#8b6a3e]/50 bg-[rgba(255,255,255,0.03)] p-3 text-center transition hover:border-[#f4cf78]/60 hover:bg-[rgba(242,202,105,0.09)] active:scale-95"
            >
              {item.imgPath ? (
                <img src={item.imgPath} alt={item.name} className="h-14 w-14 object-contain" style={{ imageRendering: "pixelated" }} />
              ) : (
                <span className="text-5xl leading-none">{item.icon || "📦"}</span>
              )}
              <p className="text-sm font-bold leading-tight text-[#f3e6c8] line-clamp-2">{item.name}</p>
              <p className="text-xs text-[#dfcfab]">Posiadasz: <span className="font-bold text-[#f9e7b2]">{item.qty}</span></p>
              <p className="text-xs text-[#8b6a3e]">Min: {item.minPrice.toLocaleString("pl-PL")} zł</p>
            </button>
          );
        }
        return (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
           <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#8b6a3e] bg-[rgba(8,4,2,0.98)] shadow-2xl" style={{ height: "90vh" }}>
            {/* Nagłówek z wyszukiwarką */}
            <div className="shrink-0 flex items-center gap-3 border-b border-[#8b6a3e]/60 bg-[rgba(18,10,5,0.98)] px-4 py-3">
              <button
                type="button"
                onClick={() => setMarketPickerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8b6a3e]/60 text-xl font-bold text-[#dfcfab] hover:bg-white/5 transition"
              >←</button>
              <div className="flex-1 relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b6a3e] text-lg">🔍</span>
                <input
                  autoFocus
                  type="text"
                  placeholder="Szukaj przedmiotu..."
                  value={marketPickerSearch}
                  onChange={e => setMarketPickerSearch(e.target.value)}
                  className="w-full rounded-xl border border-[#8b6a3e]/60 bg-black/40 pl-10 pr-4 py-2.5 text-base text-[#f3e6c8] placeholder:text-[#8b6a3e]/70 outline-none focus:border-[#d8ba7a]/70"
                />
              </div>
              <button
                type="button"
                onClick={() => setMarketPickerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8b6a3e]/60 font-bold text-[#dfcfab] hover:text-red-300 transition"
              >✕</button>
            </div>

            {/* Filtry */}
            <div className="shrink-0 flex gap-1.5 overflow-x-auto border-b border-[#8b6a3e]/30 bg-black/20 px-4 py-2.5 scrollbar-hide">
              {PICKER_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMarketPickerFilter(f.id)}
                  className={`shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
                    marketPickerFilter === f.id
                      ? "border-[#f4cf78] bg-[rgba(242,202,105,0.18)] text-[#f9e7b2]"
                      : "border-[#8b6a3e]/40 text-[#dfcfab] hover:bg-white/5 hover:border-[#8b6a3e]/70"
                  }`}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>

            {/* Grid itemów */}
            <div className="flex-1 overflow-y-auto p-4">
              {filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-[#8b6a3e]">
                  <span className="text-6xl">📦</span>
                  <p className="text-xl font-bold text-[#dfcfab]">Brak przedmiotów</p>
                  <p className="text-base">Zmień filtr lub zbierz więcej surowców.</p>
                </div>
              ) : marketPickerFilter === "crop" ? (
                <div className="space-y-5">
                  {CROP_QUALITY_GROUPS.map(group => {
                    const groupItems = filtered.filter(i => parseQualityKey(i.key).quality === group.quality);
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group.quality}>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.label}</p>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                          {groupItems.map(item => renderPickerTile(item))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : marketPickerFilter === "fruit" ? (
                <div className="space-y-5">
                  {FRUIT_QUALITY_GROUPS.map(group => {
                    const groupItems = filtered.filter(i => i.key.endsWith(`_${group.quality}`));
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group.quality}>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.label}</p>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                          {groupItems.map(item => renderPickerTile(item))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : marketPickerFilter === "equipment" ? (
                <div className="space-y-5">
                  {EQ_SLOT_GROUPS.map(group => {
                    const groupItems = filtered.filter(i => {
                      const eItem = CHAR_EQUIP_ITEMS.find(e => e.id === i.key);
                      return eItem?.slot === group.slot;
                    });
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group.slot}>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#f4cf78]">{group.icon} {group.label}</p>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                          {groupItems.map(item => renderPickerTile(item))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {filtered.map(item => renderPickerTile(item))}
                </div>
              )}
            </div>
           </div>
          </div>
        );
      })()}
    </>
  );
}
