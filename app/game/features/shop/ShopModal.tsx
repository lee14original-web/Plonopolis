import React from "react";
import type { AnimalDef, BarnState, TreeDef } from "../../types/barn";
import type { OrchardState } from "../../types/orchard";
import { CROPS } from "../../constants/crops";
import { ANIMALS, ANIMAL_ITEMS } from "../../constants/animals";
import { TREES } from "../../constants/orchard";
import { plItem } from "../../utils/barn";
import { getMaxTreeSlots, getOrchardTotalOwned } from "../../utils/orchard";
import { AnimalImg } from "../../components/AnimalImg";

interface ShopModalProps {
  profileId: string | undefined;
  displayMoney: number;
  displayLevel: number;
  dailyPromos: { super_: string[]; normal: string[] };
  promoCountdown: string;
  seedInventory: Record<string, number>;
  cropPrices: Record<string, number>;
  barnState: BarnState;
  orchardState: OrchardState;
  orchardError: string;
  shopCart: Record<string, number>;
  shopError: string;
  setShopCart: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onClose: () => void;
  onBuyAnimal: (a: AnimalDef) => Promise<void>;
  onBuyTree: (t: TreeDef) => Promise<void>;
  onBuyHiveItem: (itemId: string, label: string) => Promise<void>;
  onBuySeeds: () => Promise<void>;
}

type ShopTab = "nasiona" | "zwierzeta" | "drzewa" | "przedmioty";

export function ShopModal({ profileId, displayMoney, displayLevel, dailyPromos, promoCountdown, seedInventory, cropPrices, barnState, orchardState, orchardError, shopCart, shopError, setShopCart, onClose, onBuyAnimal, onBuyTree, onBuyHiveItem, onBuySeeds }: ShopModalProps) {
  const [shopTab, setShopTab] = React.useState<ShopTab>("nasiona");

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-[1500px] overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl">
        <button onClick={() => { setShopCart({}); onClose(); }} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] hover:text-red-300">✕</button>
        {/* Sidebar — kategorie sklepu */}
        <div className="flex w-[308px] shrink-0 flex-col border-r border-[#8b6a3e]/30 bg-black/20">
          <div className="flex flex-col gap-3 p-6 pt-14">
            <p className="mb-3 text-[17px] font-black uppercase tracking-widest text-[#8b6a3e]">Sklep</p>
            {(["nasiona","zwierzeta","drzewa","przedmioty"] as const).map(tab => (
              <button key={tab} onClick={() => setShopTab(tab)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[20px] font-bold transition ${
                  shopTab === tab ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"
                }`}>
                {tab === "nasiona" ? "Nasiona" : tab === "zwierzeta" ? "Zwierzęta" : tab === "drzewa" ? "Drzewa" : "Przedmioty"}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {/* Kasa gracza */}
          <div className="border-t border-[#8b6a3e]/30 px-5 pt-5 pb-8">
            <p className="text-sm text-[#8b6a3e] uppercase tracking-widest mb-1">Kasa</p>
            <p className="text-2xl font-black text-[#f9e7b2]">{Number(displayMoney).toFixed(2)}</p>
          </div>
        </div>
        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 text-[#dfcfab]">
            {shopTab === "nasiona" && (
              <div>
                {/* Lista wszystkich upraw — siatka 3 kolumny */}
                <div className="grid grid-cols-3 gap-2">
                  {CROPS.filter(c => c.id !== "test_nasiono").map(crop => {
                    const locked = displayLevel < crop.unlockLevel;
                    const basePrice = cropPrices[crop.id] ?? 0;
                    const isSuper = dailyPromos.super_.includes(crop.id);
                    const isNormal = dailyPromos.normal.includes(crop.id);
                    const disc = isSuper ? 0.8 : isNormal ? 0.9 : 1;
                    const effPrice = Math.round(basePrice * disc * 100) / 100;
                    const qty = shopCart[crop.id] ?? 0;
                    const owned = seedInventory[crop.id + "_good"] ?? 0;
                    const maxBuy = effPrice > 0 ? Math.floor(displayMoney / effPrice) : 0;
                    return (
                      <div key={crop.id} className={`flex flex-col rounded-xl border p-3 transition-all ${locked && isSuper ? "border-green-700/30 bg-green-900/5 opacity-60" : locked && isNormal ? "border-amber-700/30 bg-amber-900/5 opacity-60" : locked ? "border-[#374151]/30 bg-black/10 opacity-50" : isSuper && qty === 0 ? "promo-super bg-green-900/10" : isNormal && qty === 0 ? "promo-normal bg-amber-900/10" : qty > 0 ? "border-yellow-500/40 bg-yellow-900/10" : "border-[#8b6a3e]/30 bg-black/15"}`}>
                        {/* Górny rząd: promo lewo | nazwa środek | cena prawo */}
                        <div className="grid grid-cols-[1fr_auto_1fr] items-start w-full mb-2 gap-1">
                          {/* Lewa: lock + promocja + czas */}
                          <div className="flex flex-col gap-0.5 items-start">
                            {locked && <span className="rounded-full bg-[#1f2937]/80 border border-[#374151]/60 px-1.5 py-0.5 text-[9px] font-black text-[#9ca3af]">🔒 Lvl {crop.unlockLevel}</span>}
                            {isSuper && (
                              <>
                                <span className="rounded-full bg-green-900/40 border border-green-500/40 px-1.5 py-0.5 text-[9px] font-black text-green-300">⭐ -20%</span>
                                {!locked && <span className="text-[13px] text-green-400/80 font-black">{promoCountdown}</span>}
                              </>
                            )}
                            {isNormal && (
                              <>
                                <span className="rounded-full bg-amber-900/40 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-black text-amber-300">🔥 -10%</span>
                                {!locked && <span className="text-[13px] text-amber-400/80 font-black">{promoCountdown}</span>}
                              </>
                            )}
                          </div>
                          {/* Środek: nazwa */}
                          <p className={`text-[15px] font-black leading-tight text-center ${locked ? "text-[#6b7280]" : "text-[#f9e7b2]"}`}>{crop.name}</p>
                          {/* Prawa: cena */}
                          <div className="flex flex-col items-end">
                            {(isNormal || isSuper) ? (
                              <>
                                <p className="text-[11px] text-[#8b6a3e] line-through leading-tight">{basePrice.toFixed(2)} 💰</p>
                                <p className={`text-[15px] font-black leading-tight ${isSuper ? "text-green-300" : "text-amber-300"}`}>{effPrice.toFixed(2)} 💰</p>
                              </>
                            ) : (
                              <p className="text-[15px] font-black text-[#8b6a3e] leading-tight">{effPrice.toFixed(2)} 💰</p>
                            )}
                          </div>
                        </div>
                        {/* Ikona wyśrodkowana */}
                        <div className="flex justify-center w-full mb-2">
                          <img src={crop.spritePath} alt={crop.name} className="h-[96px] w-[96px] object-contain" style={{imageRendering:"pixelated"}} />
                        </div>
                        {/* Masz — dół wycentrowane */}
                        <p className="text-[16px] font-bold text-emerald-400 text-center mb-2">Masz: {owned}</p>
                        {/* Kontrolki ilości */}
                        {!locked && (
                          <div className="flex items-center gap-1 w-full">
                            <button onClick={() => setShopCart(c => ({...c,[crop.id]:Math.max(0,(c[crop.id]??0)-1)}))} className="h-7 w-7 shrink-0 rounded-md border border-[#8b6a3e]/40 bg-black/30 text-base font-black text-[#f9e7b2] hover:bg-red-900/30 hover:border-red-500/40 active:scale-75 active:bg-red-900/50 transition-all duration-75">−</button>
                            <input type="number" min={0} value={qty} onChange={e => setShopCart(c => ({...c,[crop.id]:Math.max(0,Number(e.target.value))}))} className="min-w-0 flex-1 rounded-md border border-[#8b6a3e]/40 bg-black/30 px-1 py-1 text-center text-sm font-bold text-[#f9e7b2] focus:outline-none focus:border-yellow-400/60" />
                            <button onClick={() => setShopCart(c => ({...c,[crop.id]:(c[crop.id]??0)+1}))} className="h-7 w-7 shrink-0 rounded-md border border-[#8b6a3e]/40 bg-black/30 text-base font-black text-[#f9e7b2] hover:bg-emerald-900/30 hover:border-emerald-500/40 active:scale-75 active:bg-emerald-900/50 transition-all duration-75">+</button>
                            <button onClick={() => setShopCart(c => ({...c,[crop.id]:maxBuy}))} disabled={maxBuy === 0} className={`shrink-0 rounded-md border px-1.5 py-1 text-[9px] font-black transition-all duration-75 ${maxBuy > 0 ? "border-amber-500/50 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 active:scale-90" : "border-[#374151]/30 bg-black/10 text-[#6b7280] cursor-not-allowed"}`}>MAX</button>
                            <button onClick={() => setShopCart(c => ({...c,[crop.id]:0}))} disabled={qty === 0} className={`shrink-0 rounded-md border px-1.5 py-1 text-[9px] font-black transition-all duration-75 ${qty > 0 ? "border-red-500/50 bg-red-900/20 text-red-300 hover:bg-red-900/40 active:scale-90" : "border-[#374151]/30 bg-black/10 text-[#6b7280] cursor-not-allowed"}`}>0</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {shopTab === "przedmioty" && (() => {
              const SHOP_ITEMS = [
                { id:"beekeeper_suit", label:"Strój pszczelarza", img:"/przedmioty/beekeeper_suit.png", desc:"100 zbiorów miodu", price:150, qty:100, type:"suit" as const },
                { id:"jar_empty_1",    label:"Słoik × 1",         img:"/przedmioty/jar_pack_1.png",     desc:"1 sztuka",       price:4,   qty:1,   type:"jar" as const },
                { id:"jar_empty_8",    label:"Słoik × 8",         img:"/przedmioty/jar_pack_8.png",     desc:"8 sztuk",        price:30,  qty:8,   type:"jar" as const },
                { id:"jar_empty_15",   label:"Słoik × 15",        img:"/przedmioty/jar_pack_15.png",    desc:"15 sztuk",       price:55,  qty:15,  type:"jar" as const },
              ];
              return (
                <div className="flex flex-col gap-3 p-4 overflow-y-auto">
                  {SHOP_ITEMS.map(item => {
                    const canAfford = displayMoney >= item.price;
                    return (
                      <div key={item.id} className="flex items-center gap-4 rounded-2xl border border-[#8b6a3e]/40 bg-black/20 p-4">
                        <img src={item.img} alt={item.label} className="w-[84px] h-[84px] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                        <div className="flex-1">
                          <p className="font-black text-[#f9e7b2]">{item.label}</p>
                          <p className="text-xs text-[#8b6a3e]">{item.desc}</p>
                          <p className="mt-1 text-sm font-bold text-yellow-300">{item.price.toFixed(2)} 💰</p>
                        </div>
                        <button
                          disabled={!canAfford || !profileId}
                          onClick={() => void onBuyHiveItem(item.id, item.label)}
                          className={`rounded-xl px-4 py-2 text-sm font-black transition ${canAfford ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
                        >Kup</button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {shopTab === "zwierzeta" && (() => {
              const lvl = displayLevel;
              return (
                <div className="flex flex-col gap-2 p-3 overflow-y-auto">
                  <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">🐄 Zwierzęta hodowlane</p>
                    <p className="mt-1 text-sm font-bold text-[#f9e7b2]">Każde zwierzę ma własne sloty w Stodole.</p>
                    <p className="mt-1 text-[11px] text-[#8b6a3e]">Po zakupie zwierzę pojawi się w zagrodzie. Sloty kupujesz w Stodole (przycisk 🏗️).</p>
                  </div>
                  {ANIMALS.map(a => {
                    const st = barnState[a.id];
                    const owned = st?.owned ?? 0;
                    const slots = st?.slots ?? a.startSlots;
                    const item = ANIMAL_ITEMS.find(i => i.id === a.itemId);
                    const locked = lvl < a.unlockLevel;
                    const needSlot = !locked && owned >= slots && slots < a.maxSlots;
                    const atMax = !locked && owned >= slots && slots >= a.maxSlots;
                    const noSlot = needSlot || atMax;
                    const tooPoor = !locked && !noSlot && displayMoney < a.buyPrice;
                    const canBuy = !locked && !noSlot && !tooPoor;
                    return (
                      <div key={a.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${locked ? "border-[#374151]/40 bg-black/10 opacity-60" : "border-[#8b6a3e]/40 bg-black/20"}`}>
                        <div className="flex h-[64px] w-[64px] items-center justify-center rounded-xl border border-[#8b6a3e]/40 bg-black/30 text-4xl overflow-hidden">
                          <AnimalImg id={a.id} icon={a.icon} className="h-full w-full" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-[#f9e7b2]">{a.name}</p>
                            <span className="rounded-full border border-[#8b6a3e]/40 bg-black/30 px-2 py-0.5 text-[10px] font-bold text-[#dfcfab]">LVL {a.unlockLevel}</span>
                            {locked && <span className="rounded-full border border-red-500/40 bg-red-900/20 px-2 py-0.5 text-[10px] font-bold text-red-300">🔒 Zablokowane</span>}
                          </div>
                          <p className="mt-1 text-[11px] text-[#8b6a3e]">
                            {canBuy
                              ? <>{item?.icon} <span className="text-[#dfcfab] font-bold">Produkcja po zakupie: {owned+1} {item ? plItem(owned+1, item) : "szt."} co {a.prodMs/3600000}h</span></>
                              : <>{item?.icon} <span className="text-[#dfcfab] font-bold">Produkcja: {owned > 0 ? `${owned} ${item ? plItem(owned, item) : "szt."}` : `1 ${item ? item.n1 : "szt."} / szt.`} co {a.prodMs/3600000}h</span></>
                            }
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#8b6a3e]">
                            {canBuy
                              ? <>Magazyn po zakupie: <span className="text-[#dfcfab] font-bold">{owned+1} {item ? plItem(owned+1, item) : "szt."}</span></>
                              : owned > 0 ? <>Magazyn: <span className="text-[#dfcfab] font-bold">{owned} {item ? plItem(owned, item) : "szt."}</span></> : null
                            }
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#8b6a3e]">
                            Karma: {a.feed.map(f => `${f.icon} ${f.name}`).join(" lub ")}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#8b6a3e]">
                            Posiadasz: <span className={`font-black ${owned > 0 ? "text-emerald-300" : "text-[#dfcfab]"}`}>{owned}/{slots}</span>
                            <span className="text-[#6b7280]"> (max {a.maxSlots})</span>
                            {" · "}Sprzedaż: <span className="text-amber-300 font-bold">{item?.sellPrice.toLocaleString()} 💰/szt</span>
                          </p>
                          {needSlot && (
                            <p className="mt-0.5 text-[10px] text-amber-300/80">🏗️ Sloty pełne — kup więcej w Stodole (do {a.maxSlots} szt.)</p>
                          )}
                          {atMax && (
                            <p className="mt-0.5 text-[10px] text-[#6b7280]">✦ Osiągnięto maksimum {a.maxSlots} {a.name.toLowerCase()}.</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <p className="text-base font-black text-amber-400">{a.buyPrice.toLocaleString()} 💰</p>
                          <button
                            disabled={!canBuy}
                            onClick={() => void onBuyAnimal(a)}
                            className={`rounded-xl border px-4 py-2 text-sm font-black transition ${canBuy ? "border-emerald-500/60 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/50" : "cursor-not-allowed border-[#374151] bg-black/20 text-[#6b7280]"}`}>
                            {locked ? `🔒 LVL ${a.unlockLevel}` : atMax ? "Maks. zwierząt" : needSlot ? "🏗️ Kup slot" : tooPoor ? "Za mało 💰" : "🛒 Kup"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {shopTab === "drzewa" && (() => {
              const lvl = displayLevel;
              const maxSlots = getMaxTreeSlots(lvl);
              const owned = getOrchardTotalOwned(orchardState);
              const free = maxSlots - owned;
              return (
                <div className="flex flex-col gap-2 p-3">
                  <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">🌳 Sad — twoje miejsca</p>
                    <p className="mt-1 text-sm font-bold text-[#f9e7b2]">{owned} / {maxSlots} <span className="text-xs font-normal text-[#8b6a3e]">drzew (limit od poziomu: 10→2, 15→4, 20→6, 25→8)</span></p>
                    {maxSlots === 0 && <p className="mt-1 text-[11px] text-amber-300">Pierwsze miejsca odblokujesz na poziomie 10.</p>}
                    {free === 0 && maxSlots > 0 && <p className="mt-1 text-[11px] text-red-300">Wszystkie miejsca zajęte. Zwiększ poziom aby kupić więcej drzew.</p>}
                  </div>
                  {TREES.map(t => {
                    const locked = lvl < t.unlockLevel;
                    const canBuy = !locked && free > 0 && displayMoney >= t.buyPrice;
                    const ownedHere = orchardState[t.id]?.owned ?? 0;
                    const avgDrop = ((t.dropMin + t.dropMax) / 2).toFixed(1);
                    const avgEarn = Math.round(((t.dropMin + t.dropMax) / 2) * t.pricePerFruit);
                    return (
                      <div key={t.id} className={`flex items-center gap-3 rounded-xl border bg-black/30 p-3 ${locked ? "border-[#8b6a3e]/20 opacity-60" : "border-[#8b6a3e]/50"}`}>
                        <div className="text-3xl shrink-0">{t.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-[#f9e7b2]">{t.name}</p>
                            {ownedHere > 0 && <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black text-emerald-300">×{ownedHere} w sadzie</span>}
                            {locked && <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-black text-red-300">🔒 LVL {t.unlockLevel}</span>}
                          </div>
                          <p className="text-[11px] text-[#dfcfab]">Owoc: {t.fruitIcon} {t.fruitName} · Drop: {t.dropMin}–{t.dropMax}/cykl · Cykl: {Math.round(t.growthTimeMs/3600000)}h · Cena owocu: {t.pricePerFruit}💰</p>
                          <p className="text-[10px] text-[#8b6a3e]">Średnio ~{avgDrop} owoców → ~{avgEarn}💰 / cykl (przy zwykłych)</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-[#f9e7b2]">{t.buyPrice}💰</p>
                          <button
                            disabled={!canBuy}
                            onClick={() => void onBuyTree(t)}
                            className={`mt-1 rounded-lg px-3 py-1 text-xs font-black ${canBuy ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
                          >Kup</button>
                        </div>
                      </div>
                    );
                  })}
                  {orchardError && <p className="rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-300">{orchardError}</p>}
                </div>
              );
            })()}
          </div>
        </div>
        {shopTab === "nasiona" && (() => {
          const cartEntries = Object.entries(shopCart).filter(([,v]) => (v as number) > 0);
          const total = Math.round(cartEntries.reduce((s, [id, qty]) => {
            const bp = cropPrices[id] ?? 0;
            const disc = dailyPromos.super_.includes(id) ? 0.8 : dailyPromos.normal.includes(id) ? 0.9 : 1;
            return s + bp * disc * (qty as number);
          }, 0) * 100) / 100;
          const totalItems = cartEntries.reduce((s, [,v]) => s + (v as number), 0);
          const canAfford = displayMoney >= total;
          return (
            <div className="flex w-[268px] shrink-0 flex-col border-l border-[#8b6a3e]/30 bg-black/20">
              <div className="px-4 py-3 border-b border-[#8b6a3e]/30 shrink-0">
                <p className="text-[18px] font-black uppercase tracking-wider text-[#d8ba7a]">Koszyk</p>
                {cartEntries.length === 0 && <p className="mt-1.5 text-[17px] text-[#8b6a3e]">Koszyk jest pusty</p>}
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {cartEntries.map(([id, qty]) => {
                  const crop = CROPS.find(c => c.id === id);
                  const bp = cropPrices[id] ?? 0;
                  const disc = dailyPromos.super_.includes(id) ? 0.8 : dailyPromos.normal.includes(id) ? 0.9 : 1;
                  const ep = Math.round(bp * disc * 100) / 100;
                  return (
                    <div key={id} className="flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5 border border-[#8b6a3e]/20">
                      <img src={crop?.spritePath} alt={crop?.name} className="h-9 w-9 object-contain shrink-0" style={{imageRendering:"pixelated"}} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[17px] font-bold text-[#f9e7b2] truncate">{crop?.name}</p>
                        <p className="text-[15px] text-[#8b6a3e]">{qty as number} x {ep.toFixed(2)} 💰</p>
                      </div>
                      <p className="text-[18px] font-black text-yellow-300 shrink-0">{(ep * (qty as number)).toFixed(2)}</p>
                      <button onClick={() => setShopCart(c => { const n = {...c}; delete n[id]; return n; })} className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-red-500/40 bg-red-900/20 text-red-300 hover:bg-red-900/50 hover:text-red-200 transition-all text-[13px] font-black">×</button>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-[#8b6a3e]/30 p-3 shrink-0">
                {shopError && <p className="mb-2 rounded-lg bg-red-900/40 px-2 py-1 text-[18px] text-red-300">{shopError}</p>}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[17px] text-[#8b6a3e]">Suma ({totalItems} szt.)</p>
                  <p className={`text-[21px] font-black ${canAfford || total === 0 ? "text-[#f9e7b2]" : "text-red-400"}`}>{total.toFixed(2)} 💰</p>
                </div>
                {!canAfford && total > 0 && <p className="text-[15px] text-red-400 mb-2">Za malo srodkow!</p>}
                <button
                  disabled={total === 0 || !canAfford}
                  onClick={() => void onBuySeeds()}
                  className={`w-full rounded-xl py-2 font-black text-[21px] transition-all active:scale-95 ${total > 0 && canAfford ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
                >Kup ({totalItems} szt.)</button>
                <button onClick={() => setShopCart({})} className="mt-1 w-full rounded-lg py-1 text-[15px] text-[#8b6a3e] hover:text-red-300 transition-colors">Wyczysc koszyk</button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
