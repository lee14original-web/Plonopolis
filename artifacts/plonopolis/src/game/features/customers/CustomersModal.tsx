import React, { useEffect } from "react";
import type { CustomerOrder } from "../../types/customers";
import type { HiveData } from "../../types/hive";
import type { Profile } from "../../types/profile";
import { LADA_MAX_CUSTOMERS } from "../../constants/game";
import { CUSTOMER_AVATARS } from "../../constants/customers";
import { ANIMAL_ITEMS } from "../../constants/animals";
import { CROPS } from "../../constants/crops";
import { TREES, FRUIT_QUALITY_DEFS } from "../../constants/orchard";
import type { FruitQuality } from "../../types/orchard";
import { COMPOST_DEFS } from "../../constants/compost";
import { CHAR_EQUIP_ITEMS } from "../../constants/equipment";
import { isCompostKey, compostTypeFromKey, compostValueFromKey } from "../../utils/compost";

// ── Pure helpers (moved from Game component scope) ──────────────────────────
  function mergeOrderItems<T extends { id: string; qty: number; value: number | string }>(items: T[]): T[] {
    const map = new Map<string, T>();
    for (const it of items) {
      const ex = map.get(it.id);
      if (ex) {
        ex.qty = (ex.qty || 0) + (it.qty || 0);
        ex.value = Number(ex.value || 0) + Number(it.value || 0);
      } else {
        map.set(it.id, { ...it, qty: it.qty || 0, value: Number(it.value || 0) } as T);
      }
    }
    return Array.from(map.values());
  }

  function getOrderItemDisplay(id: string): { name: string; icon: string; spritePath?: string; qualityBadge?: React.ReactNode } {
    if (id === 'honey_jar') return { name: 'Słoik miodu', icon: '🍯', spritePath: '/przedmioty/jar_honey.png' };
    const ai = ANIMAL_ITEMS.find(a => a.id === id);
    if (ai) return { name: ai.name, icon: ai.icon };
    const cropM = id.match(/^(.+)_(good|epic|legendary)$/);
    if (cropM) {
      const crop = CROPS.find(c => c.id === cropM[1]);
      const badge = cropM[2] === 'good'
        ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-800/80 border border-green-500/70 text-green-300 text-[10px] font-black leading-none shrink-0">Z</span>
        : cropM[2] === 'epic'
        ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-900/80 border border-purple-500/70 text-purple-300 text-[10px] font-black leading-none shrink-0">E</span>
        : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-800/80 border border-yellow-400/70 text-yellow-200 text-[10px] font-black leading-none shrink-0">L</span>;
      if (crop) {
        const sprite = cropM[2] === 'legendary' ? (crop.legendarySpritePath ?? crop.epicSpritePath ?? crop.spritePath)
                     : cropM[2] === 'epic'      ? (crop.epicSpritePath ?? crop.spritePath)
                     : crop.spritePath;
        return { name: crop.name, icon: '🌱', spritePath: sprite, qualityBadge: badge };
      }
    }
    const fruitM = id.match(/^(.+)_(zwykly|soczysty|zloty|zgnile)$/);
    if (fruitM) {
      const tree = TREES.find(t => t.fruitId === fruitM[1]);
      const qd = FRUIT_QUALITY_DEFS[fruitM[2] as FruitQuality];
      const fruitBadge = fruitM[2] === 'zwykly'
        ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-800/80 border border-green-500/70 text-green-300 text-[10px] font-black leading-none shrink-0">Z</span>
        : fruitM[2] === 'soczysty'
        ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-900/80 border border-blue-500/70 text-blue-300 text-[10px] font-black leading-none shrink-0">S</span>
        : fruitM[2] === 'zloty'
        ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-800/80 border border-yellow-400/70 text-yellow-200 text-[10px] font-black leading-none shrink-0">Z</span>
        : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-800/80 border border-gray-500/70 text-gray-400 text-[10px] font-black leading-none shrink-0">Zg</span>;
      if (tree) return { name: tree.fruitName, icon: tree.fruitIcon, qualityBadge: fruitBadge };
      if (qd) return { name: fruitM[1], icon: '🍎', qualityBadge: fruitBadge };
    }
    if (isCompostKey(id)) {
      const t = compostTypeFromKey(id);
      const v = compostValueFromKey(id);
      if (t) {
        const def = COMPOST_DEFS[t];
        return { name: t === "guide" ? def.name : `${def.tierName(v)} ${def.name}`, icon: def.icon, spritePath: def.imgs[v] };
      }
    }
    const eq = CHAR_EQUIP_ITEMS.find(i => i.id === id);
    if (eq) return { name: eq.name, icon: eq.icon };
    if (id.startsWith('eq_tier_')) {
      const tier = Number(id.split('_').pop()) || 0;
      const minL = tier * 5 + 1, maxL = tier * 5 + 5;
      return { name: `Tajemniczy przedmiot (lvl ${minL}-${maxL})`, icon: '🎁' };
    }
    return { name: id, icon: '📦' };
  }

  function getCustomerDisplay(type: string): { name: string; icon: string } {
    if (type === 'neighbor')              return { name: 'Sąsiad',                  icon: '🧑‍🌾' };
    if (type === 'village_guest')         return { name: 'Gospodyni',               icon: '🧺' };
    if (type === 'small_market')          return { name: 'Mały targ',               icon: '🏪' };
    if (type === 'village_shop')          return { name: 'Sklep wiejski',           icon: '🏬' };
    if (type === 'restaurant')            return { name: 'Karczma',                 icon: '🍽️' };
    if (type === 'wholesaler')            return { name: 'Hurtownik',               icon: '🚚' };
    if (type === 'market_chain')          return { name: 'Kupcy miejscy',           icon: '🏛️' };
    if (type === 'distribution_center')   return { name: 'Centrum skupu',           icon: '🏗️' };
    if (type === 'international_contract')return { name: 'Kontrakt międzynarodowy', icon: '🌍' };
    // Aliasy dla starszych typów (game_give_starter_customers)
    if (type === 'Gość' || type === 'gosc' || type === 'guest') return { name: 'Sąsiad', icon: '🧑‍🌾' };
    if (type === 'Sąsiad')                return { name: 'Sąsiad',                  icon: '🧑‍🌾' };
    return { name: 'Gość', icon: '🧑‍🌾' };
  }

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

export function CustomersModal({
  showLadaInfo, ladaDetailIdx, ladaCardHoverIdx, ladaView,
  customerOrders, customerSelling, customerLoading, customerNow,
  nextSpawnAt, newCustomerIds, ladaStatusMsg, carouselIdx, profile,
  mousePos, completingCustomerOrderRef, carouselDragRef, carouselHasDraggedRef,
  barnItems, seedInventory, fruitInventory, hiveData,
  setShowLadaModal, setShowLadaInfo, setLadaDetailIdx, setLadaCardHoverIdx,
  setLadaView, setCarouselIdx, completeCustomerOrder,
}: Props) {
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'a' || e.key === 'A' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      setCarouselIdx(ci => Math.max(0, ci - 1));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'd' || e.key === 'D' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      setCarouselIdx(ci => {
        const total = customerOrders.length;
        return Math.min(total - 1, ci + 1);
      });
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [customerOrders.length, setCarouselIdx]);

const totalOrders = customerOrders.length;
const order = ladaDetailIdx !== null ? (customerOrders[ladaDetailIdx] ?? null) : null;

const haveFor = (id: string): number => {
  if (id === 'honey_jar') return hiveData.honey_jars;
  if (/_(good|epic|legendary)$/.test(id)) return seedInventory[id] ?? 0;
  if (/_(zwykly|soczysty|zloty|zgnile)$/.test(id)) return fruitInventory[id] ?? 0;
  return barnItems[id] ?? 0;
};
const mergedItems = order ? mergeOrderItems(order.items) : [];
const canFulfill = order ? mergedItems.every(it => haveFor(it.id) >= it.qty) : false;

const timeLeft = order ? Math.max(0, new Date(order.expires_at).getTime() - customerNow) : 0;
const minLeft = Math.floor(timeLeft / 60000);
const secLeft = Math.floor((timeLeft % 60000) / 1000);
const isExpired = order && timeLeft <= 0;

const customer = order ? getCustomerDisplay(order.customer_type) : null;
const expPct = (() => {
  const xtn = profile?.xp_to_next_level;
  if (!order || !xtn || xtn <= 0) return 0;
  return (order.rewards.exp / xtn) * 100;
})();

return (<>
  <div className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[rgba(14,8,4,0.98)]">
    <div className="relative flex w-full flex-1 min-h-0 flex-col overflow-hidden">
      <button
        type="button"
        onClick={() => setShowLadaInfo(v => !v)}
        className={`absolute left-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border font-black transition hover:scale-110 ${showLadaInfo ? 'border-amber-300 bg-amber-900/60 text-amber-200' : 'border-amber-500/70 bg-black/40 text-amber-300 hover:border-amber-300 hover:text-amber-200'}`}
        title="Pomoc — jak działa lada?"
      >?</button>
      <button onClick={() => setShowLadaModal(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>

      <div className="px-6 pt-6 pb-4 border-b border-amber-700/30">
        <h2 className="text-4xl font-black text-[#f9e7b2] text-center">Lada dla klientów</h2>
      </div>

      {/* Pasek statusu klientów — zawsze widoczny */}
      {(() => {
        const active = customerOrders.length;
        const isOverLimit = active > LADA_MAX_CUSTOMERS;
        const isAtMax = active >= LADA_MAX_CUSTOMERS;
        const left = nextSpawnAt !== null ? Math.max(0, nextSpawnAt - customerNow) : null;
        const m = left !== null ? Math.floor(left / 60000) : 0;
        const s = left !== null ? Math.floor((left % 60000) / 1000) : 0;

        let barCls: string;
        let statusNode: React.ReactNode;

        // Priorytety: statusy ladaStatusMsg zawsze przed timerem,
        // bo RPC może zaktualizować nextSpawnAt na nową wartość zanim status wygaśnie.
        if (isOverLimit) {
          barCls = 'border-orange-700/40 bg-orange-950/20 text-orange-300';
          statusNode = 'Ponad limitem — wykonaj zamówienia lub poczekaj aż część wygaśnie';
        } else if (ladaStatusMsg === 'added') {
          barCls = 'border-emerald-700/40 bg-emerald-950/20 text-emerald-300';
          statusNode = 'Nowy klient przy ladzie!';
        } else if (isAtMax) {
          barCls = 'border-red-900/30 bg-black/20 text-red-400';
          statusNode = 'Limit klientów osiągnięty';
        } else if (ladaStatusMsg === 'adding') {
          barCls = 'border-sky-700/30 bg-black/20 text-sky-300';
          statusNode = 'Klient podchodzi do lady…';
        } else if (ladaStatusMsg === 'searching' || (customerLoading && (left === null || left <= 0))) {
          // Tick w toku przy zegarze = 0
          barCls = 'border-amber-700/20 bg-black/20 text-amber-300';
          statusNode = 'Wypatruję klienta…';
        } else if (ladaStatusMsg === 'failed') {
          barCls = 'border-amber-700/20 bg-black/20 text-[#8b6a3e]';
          statusNode = 'Brak nowych klientów — spróbuję za chwilę';
        } else if (left !== null && left > 0) {
          // Odliczanie — dopiero gdy brak aktywnego statusu
          barCls = 'border-amber-700/20 bg-black/20 text-[#dfcfab]';
          statusNode = m > 0
            ? <>Klient się zbliża… za: <span className="font-black text-amber-400">{m}m {s}s</span></>
            : <>Klient się zbliża… za: <span className="font-black text-amber-400">{s}s</span></>;
        } else {
          barCls = 'border-amber-700/20 bg-black/20 text-[#dfcfab]';
          statusNode = null;
        }

        return (
          <div className={`px-5 py-2 flex items-center justify-center gap-2 text-[13px] font-bold border-b ${barCls}`}>
            <span className="text-[#8b6a3e]">{active}/{LADA_MAX_CUSTOMERS} klientów</span>
            {statusNode && <><span className="text-[#8b6a3e]">·</span><span>{statusNode}</span></>}
          </div>
        );
      })()}

      <div className="relative flex-1 flex flex-col overflow-y-auto overflow-x-hidden p-5">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: ladaView === 'carousel'
              ? "linear-gradient(rgba(14,8,4,0.60), rgba(14,8,4,0.60)), url('/ui/lada_spotlight.gif')"
              : "linear-gradient(rgba(14,8,4,0.55), rgba(14,8,4,0.55)), url('/ui/lada_bg.png')",
            backgroundSize: 'cover',
            backgroundPosition: ladaView === 'carousel' ? 'center center' : 'center top',
            backgroundRepeat: 'no-repeat',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div className="relative z-10 min-h-full flex flex-col">
        {showLadaInfo ? (
          <div className="space-y-5 text-[#dfcfab]">

            {/* 1. Czym jest Lada */}
            <div>
              <p className="text-xl font-black text-amber-300 mb-3">Lada dla klientów</p>
              <p className="text-sm text-[#bfa274] leading-relaxed mb-2">Klienci NPC odwiedzają Twoją farmę i składają zamówienia na produkty. Jeśli masz to, czego potrzebują — możesz zrealizować zamówienie przed upływem czasu.</p>
              <ul className="text-sm text-[#dfcfab] space-y-1 list-none">
                <li>🌱 uprawy (zwykłe, epickie, legendarne),</li>
                <li>🍎 owoce z sadu,</li>
                <li>🐔 produkty zwierzęce,</li>
                <li>🍯 miód i inne rzadsze produkty.</li>
              </ul>
            </div>

            {/* 2. Nagrody */}
            <div>
              <p className="text-lg font-black text-amber-300 mb-2">💰 Nagrody</p>
              <ul className="text-sm space-y-2 list-none text-[#dfcfab] mb-2">
                <li>💰 <span className="font-bold">Złoto</span> — niższe niż pełna wartość rynkowa produktów. Lada nie jest miejscem do szybkiego zarabiania — nie opłaca się kupować produktów tylko po to, by oddać je klientowi.</li>
                <li>⭐ <span className="font-bold">EXP</span> — skaluje się z Twoim poziomem i typem klienta. Na wyższych poziomach większe zamówienia dają znacznie więcej doświadczenia.</li>
                <li>🎁 <span className="font-bold">Bonus dodatkowy</span> (losowo) — może zawierać kompost, produkty zwierząt, rzadkie owoce, materiały lub inne przedmioty. Im większy klient, tym większa szansa.</li>
              </ul>
              <p className="text-sm text-[#8b6a3e]">Główna wartość Lady to regularny EXP i okazjonalne bonusy — nie złoto.</p>
            </div>

            {/* 3. Typy klientów */}
            <div>
              <p className="text-lg font-black text-amber-300 mb-2">👥 Typy klientów</p>
              <p className="text-sm text-[#8b6a3e] mb-2">Im wyższy poziom gracza, tym większe i lepsze zamówienia się pojawiają.</p>
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_50px_60px_50px_68px] gap-x-2 px-3 py-1.5 text-[#8b6a3e] font-bold text-xs uppercase tracking-wider">
                  <span>Klient</span>
                  <span className="text-center">Od lvl</span>
                  <span className="text-center">Produkty</span>
                  <span className="text-center">Czas</span>
                  <span className="text-center">EXP min.</span>
                </div>
                {[
                  { i:'🧑‍🌾', n:'Sąsiad',                   lvl:'1',  it:'1',      t:'12h', e:'0,03%' },
                  { i:'🧺',   n:'Gospodyni',               lvl:'1',  it:'1–2',    t:'16h', e:'0,05%' },
                  { i:'🏪',   n:'Mały targ',               lvl:'3',  it:'2–3',    t:'20h', e:'0,08%' },
                  { i:'🏬',   n:'Sklep wiejski',           lvl:'5',  it:'3–4',    t:'24h', e:'0,12%' },
                  { i:'🍽️',  n:'Karczma',                 lvl:'8',  it:'4–5',    t:'30h', e:'0,18%' },
                  { i:'🚚',   n:'Hurtownik',               lvl:'12', it:'5–6',    t:'36h', e:'0,27%' },
                  { i:'🏛️',  n:'Kupcy miejscy',           lvl:'16', it:'6–8',    t:'42h', e:'0,38%' },
                  { i:'🏗️',  n:'Centrum skupu',           lvl:'20', it:'7–9',    t:'48h', e:'0,50%' },
                  { i:'🌍',   n:'Kontrakt między.',        lvl:'25', it:'8–10',   t:'48h', e:'0,70%' },
                ].map(c => (
                  <div key={c.n} className="grid grid-cols-[1fr_50px_60px_50px_68px] gap-x-2 items-center rounded-lg border border-amber-700/30 bg-black/25 px-3 py-2">
                    <span className="text-sm font-bold text-[#f9e7b2] truncate">{c.i} {c.n}</span>
                    <span className="text-sm text-[#8b6a3e] text-center">{c.lvl}</span>
                    <span className="text-sm text-[#bfa274] text-center">{c.it}</span>
                    <span className="text-sm text-[#8b6a3e] text-center">{c.t}</span>
                    <span className="text-sm text-blue-300 font-bold text-center">{c.e}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-[#8b6a3e] mt-2">EXP min. to gwarantowany próg jako % aktualnego poziomu.</p>
            </div>

            {/* 4. Jakości */}
            <div>
              <p className="text-lg font-black text-amber-300 mb-2">⭐ Jakości produktów</p>
              <div className="space-y-2">
                <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/15 px-3 py-2">
                  <p className="text-sm font-bold text-emerald-300 mb-0.5">🌱 Uprawy</p>
                  <p className="text-sm text-[#bfa274]">zwykła, epicka, legendarna — klient może wymagać konkretnej jakości.</p>
                </div>
                <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/15 px-3 py-2">
                  <p className="text-sm font-bold text-emerald-300 mb-0.5">🍎 Owoce</p>
                  <p className="text-sm text-[#bfa274]">zwykły, soczysty, złoty.</p>
                </div>
              </div>
              <p className="text-sm text-[#8b6a3e] mt-2">Miód i część produktów pojawia się dopiero od wyższych poziomów.</p>
            </div>

            {/* 5. Liga Farmerów */}
            <div className="rounded-lg border border-green-700/40 bg-green-950/15 px-4 py-3">
              <p className="text-lg font-black text-green-300 mb-2">🏆 Liga Farmerów</p>
              <ul className="text-sm space-y-1.5 list-none text-[#dfcfab]">
                <li>Każde zrealizowane zamówienie zapisuje się w statystykach gracza.</li>
                <li>Im więcej klientów regularnie obsługujesz, tym większe masz szanse na wyższe miejsce w Lidze.</li>
                <li>Lada jest więc ważna nie tylko dla EXP i bonusów, ale też dla rywalizacji rankingowej.</li>
              </ul>
            </div>

            {/* 6. Wskazówka ekonomiczna */}
            <div className="rounded-lg border border-amber-700/30 bg-black/20 px-4 py-3">
              <p className="text-lg font-black text-amber-300 mb-2">💡 Wskazówka</p>
              <p className="text-sm text-[#bfa274]">Lada nie jest najlepszym miejscem do zarabiania złota — do tego lepszy jest Targ i handel z graczami. Traktuj ją jako regularne źródło EXP, okazjonalnych bonusów i punktów ligowych.</p>
            </div>

            {/* 7. Jak wykonać */}
            <div>
              <p className="text-lg font-black text-amber-300 mb-2">📋 Jak wykonać zamówienie?</p>
              <ol className="text-sm space-y-1.5 list-decimal list-inside text-[#dfcfab]">
                <li>Zbierz wymagane produkty.</li>
                <li>Kliknij kartę klienta, by zobaczyć szczegóły.</li>
                <li>Kliknij 🤝 „Zrealizuj zamówienie".</li>
                <li>Produkty znikają z magazynu, dostajesz nagrody.</li>
              </ol>
              <p className="text-sm text-[#bfa274] mt-2">⏰ Jeśli czas minie — klient odejdzie. Nowi pojawiają się automatycznie.</p>
            </div>

          </div>
        ) : customerLoading && customerOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">⏳</p>
            <p className="text-[#dfcfab] text-sm">Sprawdzam zamówienia...</p>
          </div>
        ) : customerOrders.length === 0 ? (
          <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-6 text-center">
            <p className="text-3xl mb-2">🪹</p>
            <p className="text-[#dfcfab] text-sm font-bold">Brak klientów.</p>
            <p className="text-xs text-[#8b6a3e]/80 mt-1">Nowi klienci pojawią się za kilka minut. Zajrzyj później!</p>
          </div>
        ) : ladaDetailIdx === null ? (
          /* ── WIDOK WSZYSTKICH KLIENTÓW ── */
          (() => {
            // Sortowanie + avatary — wspólne dla obu widoków
            const _difficulty = (o: typeof customerOrders[number]) => {
              const merged = mergeOrderItems(o.items);
              const itemCount = merged.length;
              const totalQty = merged.reduce((s, it) => s + it.qty, 0);
              return itemCount * 1000 + totalQty * 10 + Number(o.rewards.gold) * 0.01 + o.rewards.exp * 0.05;
            };
            const _sorted = [...customerOrders.map((o, i) => ({ o, originalIndex: i }))]
              .sort((a, b) => _difficulty(a.o) - _difficulty(b.o));
            // Deterministyczne avatary per order.id + deduplikacja indeksów w obrębie widoku
            const _usedIndices = new Map<string, Set<number>>();
            const _avatarMap = new Map<string, string>();
            for (const { o } of _sorted) {
              const pool = CUSTOMER_AVATARS[o.customer_type];
              if (!pool || pool.length === 0) continue;
              let hash = 0;
              for (let ci = 0; ci < o.id.length; ci++) hash = (hash * 31 + o.id.charCodeAt(ci)) & 0xffff;
              const usedForType = _usedIndices.get(o.customer_type) ?? new Set<number>();
              let idx = hash % pool.length;
              let attempts = 0;
              while (usedForType.has(idx) && attempts < pool.length) { idx = (idx + 1) % pool.length; attempts++; }
              usedForType.add(idx);
              _usedIndices.set(o.customer_type, usedForType);
              _avatarMap.set(o.id, pool[idx]);
            }

            // Helper: dane pojedynczej karty
            const _cardData = (o: CustomerOrder) => {
              const cd = getCustomerDisplay(o.customer_type);
              const tl = Math.max(0, new Date(o.expires_at).getTime() - customerNow);
              const ml = Math.floor(tl / 60000);
              const sl = Math.floor((tl % 60000) / 1000);
              const expired = tl <= 0;
              const mi = mergeOrderItems(o.items);
              const canDo = mi.every(it => haveFor(it.id) >= it.qty);
              const createdMs = o.created_at ? new Date(o.created_at).getTime() : null;
              const expiresMs = new Date(o.expires_at).getTime();
              const totalDur = createdMs ? expiresMs - createdMs : null;
              const usedPct = (totalDur && totalDur > 0) ? (customerNow - createdMs!) / totalDur : null;
              const isWarning = usedPct !== null ? usedPct >= 0.75 : tl < 3_600_000;
              const isCritical = usedPct !== null ? usedPct >= 0.90 : tl < 600_000;
              const isNew = newCustomerIds.has(o.id);
              const avatarPath = _avatarMap.get(o.id) ?? null;
              return { cd, tl, ml, sl, expired, mi, canDo, isWarning, isCritical, isNew, avatarPath };
            };

            const safeCarouselIdx = Math.min(carouselIdx, Math.max(0, _sorted.length - 1));
            const centerOrder = _sorted[safeCarouselIdx]?.o ?? null;

            return (
              <div className="flex flex-col gap-3 flex-1">
                {/* Nagłówek */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm text-amber-400 uppercase tracking-widest font-black">
                    {totalOrders} {totalOrders === 1 ? 'aktywny klient' : 'aktywnych klientów'}
                  </p>
                </div>

                {/* Panel: czego potrzebuje nakierowany klient + nagroda */}
                {centerOrder && (() => {
                  const cd = getCustomerDisplay(centerOrder.customer_type);
                  const mi = mergeOrderItems(centerOrder.items);
                  const xtn = profile?.xp_to_next_level;
                  const expPct = xtn && xtn > 0 ? (centerOrder.rewards.exp / xtn) * 100 : 0;
                  const { tl, ml, sl, expired, canDo, isWarning, isCritical } = _cardData(centerOrder);
                  const missingItems = mi.filter(it => haveFor(it.id) < it.qty);
                  const timerCls = expired ? 'text-red-400' : isCritical ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-[#8b6a3e]';
                  return (
                    <div className="rounded-xl border border-[#8b6a3e]/60 bg-black/40 px-6 py-5">
                      <p className="text-center text-xl font-black text-amber-400 uppercase tracking-widest mb-3">
                        {cd.name} potrzebuje:
                      </p>
                      <div className="flex flex-wrap justify-center gap-x-7 gap-y-3 mb-4">
                        {mi.map((it) => {
                          const d = getOrderItemDisplay(it.id);
                          const have = haveFor(it.id);
                          const ok = have >= it.qty;
                          const partial = !ok && have > 0;
                          const textCls = ok ? 'text-emerald-300' : partial ? 'text-yellow-300' : 'text-red-400';
                          return (
                            <div key={it.id} className="flex items-center gap-2.5">
                              {d.spritePath ? (
                                <img src={d.spritePath} alt={d.name} className="w-14 h-14 object-contain shrink-0" style={{ imageRendering: 'pixelated' }} />
                              ) : (
                                <span className="text-3xl leading-none shrink-0">{d.icon}</span>
                              )}
                              <span className={`text-2xl font-bold ${textCls}`}>
                                <span className="text-xl opacity-80">{have}/{it.qty}</span> {d.name}
                              </span>
                              {d.qualityBadge}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-6 text-2xl font-bold pt-3 border-t border-[#8b6a3e]/30">
                        <span className="text-yellow-300">{Number(centerOrder.rewards.gold).toFixed(0)} zł</span>
                        <span className="text-blue-300">
                          +{centerOrder.rewards.exp} EXP
                          {expPct > 0 && <span className="text-base text-blue-400/80 font-bold ml-1">({expPct.toFixed(2).replace('.', ',')}%)</span>}
                        </span>
                        {centerOrder.rewards.bonus && centerOrder.rewards.bonus.length > 0 && (
                          <span className="text-purple-300 text-2xl">
                            {centerOrder.rewards.bonus.map((b, bi) => {
                              const bd = getOrderItemDisplay(b.id ?? (b.type === 'eq_item' ? `eq_tier_${b.tier ?? 0}` : ''));
                              return <span key={bi}>✨ +{b.qty}× {bd.icon} {bd.name}</span>;
                            })}
                          </span>
                        )}
                        <span className={`text-xl font-bold ${timerCls}`}>
                          ⏱ {expired ? 'Wygasło' : ml > 0 ? `${ml}min ${sl}s` : `${sl}s`}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  return (
                  <div className="flex-1 flex flex-col">
                    <div className="mt-8 mb-auto flex flex-col gap-3">
                    {/* ── WIDOK KARUZELA — duży avatar slider 3D ── */}
                    <div
                      className="flex items-center gap-2"
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      {/* Strzałka lewa */}
                      <button type="button"
                        onClick={() => setCarouselIdx(ci => Math.max(0, ci - 1))}
                        disabled={safeCarouselIdx === 0}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-amber-600/50 bg-black/50 text-5xl font-black text-amber-300 transition hover:border-amber-400/80 hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-20"
                      >‹</button>

                      {/* Scena karuzeli — drag do nawigacji */}
                      <div
                        className="relative flex-1 overflow-visible"
                        style={{ height: 500, perspective: 1100, touchAction: 'none', userSelect: 'none', cursor: 'grab' }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          carouselHasDraggedRef.current = false;
                          // Nie rób setPointerCapture tu — zrobimy to dopiero gdy wiemy, że to drag (>8px).
                          // Dzięki temu click na karcie odpali normalnie przy małym ruchu.
                          carouselDragRef.current = { startX: e.clientX, baseIdx: safeCarouselIdx, totalMoved: 0, pointerId: e.pointerId };
                        }}
                        onPointerMove={(e) => {
                          e.stopPropagation();
                          const drag = carouselDragRef.current;
                          if (!drag) return;
                          drag.totalMoved = e.clientX - drag.startX;
                          // Po przekroczeniu progu 8px: to drag — przechwyć pointer i zablokuj click
                          if (Math.abs(drag.totalMoved) > 8 && !carouselHasDraggedRef.current) {
                            carouselHasDraggedRef.current = true;
                            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
                          }
                          if (!carouselHasDraggedRef.current) return;
                          // Krokowe przesunięcie: co 200px = 1 klient, względem pozycji z pointerDown
                          // clamp: max 1 zmiana indeksu na event → płynniejsze, ale przy długim drag nadal przechodzi dalej
                          const steps = Math.trunc(drag.totalMoved / 240);
                          const rawIdx = drag.baseIdx - steps;
                          const newIdx = Math.max(0, Math.min(_sorted.length - 1, rawIdx));
                          setCarouselIdx(prev => {
                            const delta = newIdx - prev;
                            if (delta === 0) return prev;
                            return prev + Math.sign(delta);
                          });
                        }}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
                          carouselDragRef.current = null;
                          // 60 ms okno — blokuje click który przeglądarka może jeszcze wysłać po capture
                          setTimeout(() => { carouselHasDraggedRef.current = false; }, 60);
                        }}
                        onPointerCancel={(e) => {
                          e.stopPropagation();
                          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
                          carouselDragRef.current = null;
                          setTimeout(() => { carouselHasDraggedRef.current = false; }, 60);
                        }}
                      >
                        {_sorted.map(({ o, originalIndex }, i) => {
                          const { cd, tl, ml, sl, expired, canDo, isWarning, isCritical, isNew, avatarPath } = _cardData(o);
                          const offset = i - safeCarouselIdx;
                          const absOff = Math.abs(offset);
                          const isCenter = offset === 0;
                          const scale = isCenter ? 1 : absOff === 1 ? 0.70 : absOff === 2 ? 0.50 : 0.36;
                          const opacity = isCenter ? 1 : absOff === 1 ? 0.64 : absOff === 2 ? 0.46 : 0;
                          const tx = offset * 280;
                          const ry = isCenter ? 0 : offset < 0 ? 24 : -24;
                          const ringCls = isNew
                            ? 'border-[4px] border-emerald-400 shadow-[0_0_32px_rgba(52,211,153,0.5)]'
                            : expired
                            ? 'border-2 border-red-600/60'
                            : isCritical
                            ? 'border-[3px] border-red-500/80'
                            : isWarning
                            ? 'border-[3px] border-orange-500/70'
                            : canDo
                            ? 'border-[3px] border-emerald-500/70 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                            : 'border border-amber-700/50';
                          return (
                            <div
                              key={o.id}
                              onClick={() => {
                                if (carouselHasDraggedRef.current) return;
                                if (!isCenter) setCarouselIdx(i);
                              }}
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                width: 220,
                                marginLeft: -110,
                                transform: `translateX(${tx}px) translateY(-50%) rotateY(${ry}deg) scale(${scale})`,
                                transformOrigin: 'center center',
                                transition: 'transform 0.38s cubic-bezier(.4,0,.2,1), opacity 0.38s ease',
                                opacity,
                                zIndex: 10 - absOff,
                                cursor: absOff > 2 ? 'default' : 'pointer',
                                pointerEvents: absOff > 2 ? 'none' : 'auto',
                              }}
                              className="select-none"
                            >
                              {/* Nazwa klienta NAD avatarem */}
                              <p className="text-[1.5625rem] font-black text-[#f9e7b2] truncate leading-tight text-center mb-2">{cd.name}</p>

                              {/* Blok avatara */}
                              <div className={`relative w-full rounded-3xl overflow-hidden bg-black/40 ${ringCls}`} style={{ aspectRatio: '2 / 3' }}>
                                {avatarPath
                                  ? <img src={avatarPath} alt={cd.name} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-9xl leading-none">{cd.icon}</span>
                                    </div>
                                }
                                {/* ✓ Gotowe — pasek na dole avatara */}
                                {canDo && !expired && (
                                  <div className="absolute bottom-0 inset-x-0 flex justify-center pb-2.5">
                                    <span
                                      className="text-lg font-black text-white rounded-full px-4 py-1"
                                      style={{
                                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                        border: '1px solid rgba(167,243,208,0.9)',
                                        boxShadow: '0 0 14px rgba(52,211,153,0.7), 0 2px 6px rgba(0,0,0,0.5)',
                                      }}
                                    >✓ Gotowe</span>
                                  </div>
                                )}
                                {/* Nowy! */}
                                {isNew && (
                                  <span className="absolute top-2.5 left-2.5 text-base font-black text-emerald-200 bg-emerald-700/90 rounded-full px-3 py-1 border border-emerald-400/70 animate-bounce">Nowy!</span>
                                )}
                                {/* Wygasło overlay */}
                                {expired && (
                                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                                    <span className="text-lg font-black text-red-300">Wygasło</span>
                                  </div>
                                )}
                                {/* ⚠ krytyczny czas */}
                                {isCritical && !expired && !isNew && (
                                  <span className="absolute top-2.5 right-2.5 text-sm font-black text-red-200 bg-red-800/90 rounded-full px-2.5 py-1 border border-red-500/70 animate-pulse">⚠</span>
                                )}
                              </div>

                              {/* Nagrody pod avatarem */}
                              <div className="mt-3 text-center px-1">
                                <div className="flex items-center justify-center gap-3 text-lg font-bold flex-wrap">
                                  <span className="text-yellow-300">{Number(o.rewards.gold).toFixed(0)} zł</span>
                                  <span className="text-blue-300">{o.rewards.exp} EXP</span>
                                  {o.rewards.bonus?.length > 0 && <span className="text-purple-300">+🎁</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Strzałka prawa */}
                      <button type="button"
                        onClick={() => setCarouselIdx(ci => Math.min(_sorted.length - 1, ci + 1))}
                        disabled={safeCarouselIdx >= _sorted.length - 1}
                        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-amber-600/50 bg-black/50 text-5xl font-black text-amber-300 transition hover:border-amber-400/80 hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-20"
                      >›</button>
                    </div>

                    {/* Dots (≤8) lub licznik (>8) */}
                    {_sorted.length > 1 && (
                      _sorted.length <= 8 ? (
                        <div className="flex justify-center gap-2 pt-1">
                          {_sorted.map((_, di) => (
                            <button key={di} type="button" onClick={() => setCarouselIdx(di)}
                              className={`h-2 rounded-full transition-all ${di === safeCarouselIdx ? 'w-6 bg-amber-400' : 'w-2 bg-amber-800/50 hover:bg-amber-600/60'}`}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-base text-[#8b6a3e] font-bold tracking-wide pt-1">
                          {safeCarouselIdx + 1} / {_sorted.length}
                        </p>
                      )
                    )}

                    {/* Przycisk Zrealizuj bezpośrednio pod kartą */}
                    {centerOrder && (() => {
                      const { canDo: cDo, expired: cExp } = _cardData(centerOrder);
                      const isSelling = customerSelling === centerOrder.id;
                      return (
                        <div className="flex justify-center pt-3 pb-1">
                          <button
                            onClick={() => {
                              if (completingCustomerOrderRef.current) return;
                              if (customerSelling) return;
                              completingCustomerOrderRef.current = true;
                              completeCustomerOrder(centerOrder.id).finally(() => { completingCustomerOrderRef.current = false; });
                            }}
                            disabled={!cDo || !!customerSelling || cExp}
                            className="rounded-2xl border-2 border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-10 py-3 text-2xl font-black text-[#2f1b0c] shadow-[0_4px_20px_rgba(242,202,105,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isSelling ? '⏳ Realizuję...' : cExp ? '⏱ Wygasło' : !cDo ? '❌ Brak produktów' : '🤝 Zrealizuj zamówienie'}
                          </button>
                        </div>
                      );
                    })()}
                    </div>
                  </div>
                  );
                })()}
              </div>
            );
          })()
        ) : order && customer && (
          <div className="space-y-4">
            {/* Nagłówek widoku szczegółów */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLadaDetailIdx(null)}
                className="flex flex-col items-center justify-center rounded-xl border border-amber-600/50 bg-black/30 px-5 py-4 font-bold text-amber-400 hover:bg-amber-900/20 hover:border-amber-400/70 transition shrink-0 leading-snug"
              >
                <span className="text-base">← Wróć</span>
                <span className="text-xs text-amber-500/80 font-medium">lub Esc</span>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-[#8b6a3e]">Klient {ladaDetailIdx + 1} z {totalOrders}</p>
                <p className="text-base font-black text-[#f9e7b2] truncate">{customer.icon} {customer.name}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="text-[#8b6a3e]">⏱ Pozostało:</span>
              <span className={`font-black ${timeLeft < 60000 ? 'text-red-400' : 'text-amber-400'}`}>
                {isExpired ? 'Wygasło' : `${minLeft > 0 ? minLeft + 'min ' : ''}${secLeft}s`}
              </span>
            </div>
            {/* Ostrzeżenie — klient zaraz zrezygnuje */}
            {!isExpired && order && (() => {
              const cMs = order.created_at ? new Date(order.created_at).getTime() : null;
              const eMs = new Date(order.expires_at).getTime();
              const dur = cMs ? eMs - cMs : null;
              const used = (dur && dur > 0) ? (customerNow - cMs!) / dur : null;
              const warn = used !== null ? used >= 0.75 : timeLeft < 3_600_000;
              const crit = used !== null ? used >= 0.90 : timeLeft < 600_000;
              if (!warn) return null;
              return (
                <div className={`rounded-lg border px-3 py-2 text-center text-sm font-bold ${crit ? 'border-red-500/60 bg-red-950/20 text-red-300 animate-pulse' : 'border-orange-500/50 bg-orange-950/15 text-orange-300'}`}>
                  {crit ? '⚠️ Uwaga: klient niedługo zrezygnuje!' : '⚠ Klient powoli traci cierpliwość!'}
                </div>
              );
            })()}

            <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
              <p className="text-sm uppercase tracking-widest text-amber-400 mb-3 font-black">📦 Klient potrzebuje:</p>
              <div className="space-y-2">
                {mergedItems.map((it, idx) => {
                  const have = haveFor(it.id);
                  const ok = have >= it.qty;
                  const missing = Math.max(0, it.qty - have);
                  const pct = Math.min(1, have / it.qty);
                  const d = getOrderItemDisplay(it.id);
                  return (
                    <div key={idx} className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${ok ? 'border-emerald-600/40 bg-emerald-950/20' : 'border-red-600/40 bg-red-950/15'}`}>
                      <span className="text-xl shrink-0">{ok ? '✅' : '❌'}</span>
                      {d.spritePath ? (
                        <img src={d.spritePath} alt={d.name} className="w-10 h-10 object-contain shrink-0 drop-shadow" style={{ imageRendering: 'pixelated' }} />
                      ) : (
                        <span className="text-3xl shrink-0">{d.icon}</span>
                      )}
                      <div className="flex-1 min-w-0 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                        <p className="text-lg font-black text-[#f9e7b2] leading-tight shrink-0">{it.qty}× {d.name}</p>
                        <div className="flex-1 min-w-[120px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-bold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                              {ok ? '✓ Gotowe' : `Brakuje: ${missing}`}
                            </span>
                            <span className="text-sm text-[#8b6a3e] font-bold">{have} / {it.qty}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${ok ? 'bg-emerald-500' : pct > 0.5 ? 'bg-amber-400' : 'bg-red-500'}`}
                              style={{ width: `${pct * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/60 bg-black/30 p-4">
              <p className="text-sm uppercase tracking-widest text-amber-400 mb-3 font-black">🏆 Nagroda za zamówienie:</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-yellow-400/50 bg-gradient-to-b from-yellow-900/30 to-yellow-950/20 p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-yellow-500/80 mb-1.5 font-bold">Złoto</p>
                  <p className="text-3xl font-black text-yellow-300">💰 {Number(order.rewards.gold).toFixed(0)} <span className="text-xl">zł</span></p>
                </div>
                <div className="rounded-xl border border-blue-400/50 bg-gradient-to-b from-blue-900/30 to-blue-950/20 p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-blue-500/80 mb-1.5 font-bold">Doświadczenie</p>
                  <p className="text-3xl font-black text-blue-300">⭐ +{order.rewards.exp} <span className="text-xl">EXP</span></p>
                  {expPct > 0 && <p className="text-sm text-blue-400/80 mt-1 font-bold">{expPct.toFixed(2).replace('.', ',')}% poziomu</p>}
                </div>
              </div>
              {order.rewards.bonus && order.rewards.bonus.length > 0 && (
                <div className="mt-3 rounded-xl border border-purple-400/60 bg-gradient-to-b from-purple-900/25 to-purple-950/20 p-3">
                  <p className="text-xs uppercase tracking-widest text-purple-200 mb-2 font-black">✨ Bonus dodatkowy:</p>
                  <div className="space-y-2">
                    {order.rewards.bonus.map((b, idx) => {
                      const lookupId = b.id ?? (b.type === 'eq_item' ? `eq_tier_${b.tier ?? 0}` : '');
                      const d = getOrderItemDisplay(lookupId);
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-sm font-black text-purple-300">+{b.qty}×</span>
                          {d.spritePath ? (
                            <img src={d.spritePath} alt={d.name} className="w-7 h-7 object-contain shrink-0 drop-shadow" style={{ imageRendering: 'pixelated' }} />
                          ) : (
                            <span className="text-xl shrink-0">{d.icon}</span>
                          )}
                          <span className="text-sm font-bold text-purple-100">{d.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
        </div>
      </div>

      <div className="border-t border-amber-700/30 p-5 space-y-2.5">
        {!showLadaInfo && order && customer && (
          <button
            onClick={() => {
              if (completingCustomerOrderRef.current) return;
              if (customerSelling) return;
              completingCustomerOrderRef.current = true;
              completeCustomerOrder(order.id).finally(() => { completingCustomerOrderRef.current = false; });
            }}
            disabled={!canFulfill || !!customerSelling || !!isExpired}
            className="w-full rounded-xl py-4 text-lg font-black transition border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {customerSelling === order.id ? '⏳ Realizuję...' : isExpired ? '⏱ Zamówienie wygasło' : !canFulfill ? '❌ Brak wymaganych produktów' : '🤝 Zrealizuj zamówienie (Enter)'}
          </button>
        )}
        <button onClick={() => setShowLadaModal(false)} className="w-full rounded-xl border border-[#8b6a3e]/50 bg-black/30 py-3 text-base font-bold text-[#f3e6c8] transition hover:border-[#d4a64f]/60 hover:bg-black/50">
          ✕ Zamknij
        </button>
      </div>
    </div>
  </div>
</>);
}
