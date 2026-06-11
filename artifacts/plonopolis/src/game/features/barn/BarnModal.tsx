import React from "react";
import type { BarnState, AnimalDef } from "../../types/barn";
import type { PlayerStatsMap } from "../../types/stats";
import { ANIMALS, ANIMAL_ITEMS } from "../../constants/animals";
import { barnCurrentHunger, barnHungerStatus, barnEffProdMs, barnFmtMs, plItem } from "../../utils/barn";
import { AnimalImg } from "../../components/AnimalImg";

interface BarnModalProps {
  displayLevel: number;
  displayMoney: number;
  barnState: BarnState;
  seedInventory: Record<string, number>;
  effectiveStats: PlayerStatsMap;
  barnNow: number;
  onClose: () => void;
  onBuySlot: (a: AnimalDef) => Promise<void>;
  onFeed: (a: AnimalDef, cropKey: string, points: number, cropName: string, cropIcon: string) => Promise<void>;
  onCollect: (a: AnimalDef) => void;
  onCollectAll: () => void;
}

export function BarnModal({ displayLevel, displayMoney, barnState, seedInventory, effectiveStats, barnNow, onClose, onBuySlot, onFeed, onCollect, onCollectAll }: BarnModalProps) {
  const [selectedAnimal, setSelectedAnimal] = React.useState<string | null>(null);
  const lvl = displayLevel;
  const opiekaPts = effectiveStats.opieka;
  const bonusChancePct = (opiekaPts * 0.15).toFixed(1);
  const hungerReducePct = (opiekaPts * 0.3).toFixed(1);
  const selA = selectedAnimal ? ANIMALS.find(a => a.id === selectedAnimal) : null;
  const totalStorage = ANIMALS.reduce((s,a) => { const st = barnState[a.id]; if (!st) return s; const _bpsS = st.baseProdStart > 0 ? st.baseProdStart : st.prodStart > 0 ? st.prodStart : 0; return s + (_bpsS > 0 ? Math.min(Math.floor((barnNow - _bpsS) / a.prodMs), a.storageMax) * st.owned : 0); }, 0);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[rgba(14,8,4,0.99)]">
      <div className="relative flex w-full flex-1 min-h-0 overflow-hidden">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>

        {/* ─ Sidebar ─ */}
        <div className="flex w-[280px] shrink-0 flex-col gap-1.5 border-r border-[#8b6a3e]/30 bg-black/20 p-4 pt-14 overflow-y-auto">
          <p className="mb-3 text-base font-black uppercase tracking-widest text-[#d8ba7a]">🏚️ Zagroda</p>
          <button onClick={() => setSelectedAnimal(null)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-bold transition ${!selectedAnimal ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"}`}>
            📋 Przegląd
          </button>
          <div className="my-1 border-t border-[#8b6a3e]/20" />
          {ANIMALS.map(a => {
            const locked = lvl < a.unlockLevel;
            const st = barnState[a.id];
            const hasAnimals = st.owned > 0;
            const _bpsS = st.baseProdStart > 0 ? st.baseProdStart : st.prodStart > 0 ? st.prodStart : 0;
            const hasProd = _bpsS > 0 && Math.floor((barnNow - _bpsS) / a.prodMs) >= 1;
            return (
              <button key={a.id} onClick={() => !locked && setSelectedAnimal(a.id)}
                disabled={locked}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-bold transition text-left ${locked ? "opacity-40 cursor-not-allowed text-[#6b7280]" : selectedAnimal===a.id ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"}`}>
                <AnimalImg id={a.id} icon={a.icon} className="h-6 w-6 text-xl" />
                <span className="flex-1 truncate">{a.name}</span>
                {locked && <span className="text-[11px] text-[#6b7280]">LVL{a.unlockLevel}</span>}
                {!locked && hasProd && <span className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />}
                {!locked && hasAnimals && !hasProd && <span className="text-[11px] text-[#8b6a3e]">{st.owned}</span>}
              </button>
            );
          })}
        </div>

        {/* ─ Główna treść ─ */}
        <div className="flex-1 overflow-y-auto p-6 pt-5 text-[#dfcfab]">

          {/* ══ EFEKT OPIEKI ══ */}
          {opiekaPts > 0 && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-950/20 px-4 py-2">
              <span className="text-lg">🐄</span>
              <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
                <p className="text-[11px] font-bold text-green-300">Opieka ({opiekaPts} pkt) aktywna</p>
                <p className="text-[11px] text-[#dfcfab]">🌿 Głód wolniej spada o <span className="font-bold text-green-300">{hungerReducePct}%</span></p>
                <p className="text-[11px] text-[#dfcfab]">📦 Szansa na bonus produkt: <span className="font-bold text-yellow-300">+{bonusChancePct}%</span></p>
              </div>
            </div>
          )}

          {/* ══ PRZEGLĄD ══ */}
          {!selA && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-2xl font-black text-[#f9e7b2]">🏚️ Twoja zagroda</p>
                {totalStorage > 0 && (
                  <button onClick={onCollectAll} className="rounded-xl border border-green-500/60 bg-green-900/20 px-3 py-1.5 text-sm font-bold text-green-300 hover:bg-green-900/40">
                    ✅ Odbierz wszystko
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {ANIMALS.filter(a => lvl >= a.unlockLevel).map(a => {
                  const st = barnState[a.id];
                  const item = ANIMAL_ITEMS.find(i => i.id === a.itemId)!;
                  const h = barnCurrentHunger(st, opiekaPts);
                  const hs = barnHungerStatus(h);
                  const effMs = barnEffProdMs(a, h);
                  const remaining = st.prodStart > 0 ? Math.max(0, effMs - (barnNow - st.prodStart)) : 0;
                  const pct = st.prodStart > 0 ? Math.min(100, ((barnNow - st.prodStart) / effMs) * 100) : 0;
                  return (
                    <div key={a.id} onClick={() => setSelectedAnimal(a.id)}
                      className="cursor-pointer rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-3 hover:border-[#d4a64f]/60 transition">
                      <div className="flex items-center gap-2 mb-2">
                        <AnimalImg id={a.id} icon={a.icon} className="h-10 w-10 text-3xl" />
                        <div className="flex-1">
                          <p className="text-base font-black text-[#f9e7b2]">{a.name}</p>
                          <p className="text-[12px] text-[#8b6a3e]">{st.owned} / {st.slots} · {item.icon} {item.name}</p>
                        </div>
                        {(() => { const _bpsOv = st.baseProdStart > 0 ? st.baseProdStart : st.prodStart > 0 ? st.prodStart : 0; const cyclesOv = _bpsOv > 0 ? Math.min(Math.floor((barnNow - _bpsOv) / a.prodMs), a.storageMax) : 0; const itemsOv = cyclesOv * st.owned; return itemsOv > 0 ? <span className="rounded-full bg-green-500/20 border border-green-500/40 px-2 py-0.5 text-[11px] font-black text-green-300">{itemsOv}/{st.owned} {item.icon}</span> : null; })()}
                      </div>
                      {st.owned > 0 && (
                        <>
                          <div className="h-1.5 w-full rounded-full bg-black/40 mb-1">
                            <div className="h-full rounded-full bg-amber-400 transition-all" style={{width:`${pct}%`}} />
                          </div>
                          <div className="flex justify-between text-[9px] text-[#6b7280]">
                            <span style={{color:hs.color}}>{hs.label.split(" ")[0]} {Math.round(h)}%</span>
                            <span>{st.storage >= a.storageMax ? "📦 Pełny" : remaining > 0 ? barnFmtMs(remaining) : "✅ Gotowe"}</span>
                          </div>
                        </>
                      )}
                      {st.owned === 0 && <p className="text-[11px] text-amber-300/80 text-center py-1">🛒 Kup w mieście · {a.buyPrice.toLocaleString()} 💰</p>}
                    </div>
                  );
                })}
                {ANIMALS.filter(a => lvl < a.unlockLevel).length > 0 && (
                  <div className="rounded-xl border border-[#374151]/40 bg-black/10 p-3 opacity-50 col-span-2 xl:col-span-1">
                    <p className="text-xs text-[#6b7280] text-center">
                      🔒 {ANIMALS.filter(a => lvl < a.unlockLevel).map(a => `${a.icon} LVL${a.unlockLevel}`).join(" · ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ KARTA ZWIERZĘCIA ══ */}
          {selA && (() => {
            const a = selA;
            const st = barnState[a.id];
            const item = ANIMAL_ITEMS.find(i => i.id === a.itemId)!;
            const h = barnCurrentHunger(st, opiekaPts);
            const hs = barnHungerStatus(h);
            const effMs = barnEffProdMs(a, h);
            // Server-aligned: use baseProdStart + BASE prodMs (matches collect_animal RPC)
            const _bps = (st.baseProdStart > 0 ? st.baseProdStart : st.prodStart > 0 ? st.prodStart : 0);
            const serverCycles = _bps > 0 ? Math.min(Math.floor((barnNow - _bps) / a.prodMs), a.storageMax) : 0;
            const storageFull = serverCycles >= a.storageMax;
            const itemsReady = serverCycles * st.owned;
            const itemsMax = a.storageMax * st.owned;
            const _cycleStart = _bps > 0 ? _bps + serverCycles * a.prodMs : 0;
            const remaining = _cycleStart > 0 && !storageFull ? Math.max(0, _cycleStart + a.prodMs - barnNow) : 0;
            const pct = _cycleStart > 0 ? Math.min(100, ((barnNow - _cycleStart) / a.prodMs) * 100) : 0;
            void effMs;
            const nextUpg = st.slots - a.startSlots;
            const upgCost = nextUpg < a.slotUpgCosts.length ? a.slotUpgCosts[nextUpg] : null;
            return (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => setSelectedAnimal(null)} className="text-[#8b6a3e] hover:text-[#f9e7b2] text-sm transition">← Powrót</button>
                  <AnimalImg id={a.id} icon={a.icon} className="h-10 w-10 text-3xl" />
                  <div>
                    <p className="text-xl font-black text-[#f9e7b2]">{a.name}</p>
                    <p className="text-xs text-[#8b6a3e]">Produkuje: {item.icon} {item.name} · co {a.prodMs/3600000}h · sprzedaż: {item.sellPrice.toLocaleString()} 💰/szt</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Lewa kolumna */}
                  <div className="flex flex-col gap-3">
                    {/* Status produkcji */}
                    <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-4">
                      <p className="text-base font-black uppercase tracking-widest text-[#d8ba7a] mb-2">📊 Produkcja</p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{item.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[#f9e7b2]">Posiadasz: {st.owned} / {st.slots}</p>
                          <p className="text-[10px] text-[#8b6a3e]">Magazyn: <span className={itemsReady > 0 ? "text-green-300 font-bold" : ""}>{itemsReady} / {itemsMax} {plItem(itemsMax, item)}</span></p>
                          <p className="text-[9px] text-[#6b7280]">Produkcja: {st.owned > 0 ? `${st.owned} ${plItem(st.owned, item)}` : `1 ${item.n1} / szt.`} co {a.prodMs/3600000}h</p>
                        </div>
                      </div>
                      {st.owned > 0 && (
                        <>
                          <div className="h-2 w-full rounded-full bg-black/40 mb-1">
                            <div className="h-full rounded-full transition-all" style={{width:`${pct}%`, background: storageFull?"#6b7280":"#f59e0b"}} />
                          </div>
                          <p className="text-xs text-center" style={{color: storageFull?"#6b7280":remaining===0?"#4ade80":"#f9e7b2"}}>
                            {storageFull ? "📦 Storage pełny — odbierz produkty" : remaining > 0 ? barnFmtMs(remaining) : "✅ Gotowe do odbioru!"}
                          </p>
                        </>
                      )}
                      {st.owned === 0 && <p className="text-xs text-[#6b7280] text-center">Brak zwierząt — kup pierwsze!</p>}
                      {itemsReady > 0 && (
                        <button onClick={() => onCollect(a)} className="mt-2 w-full rounded-xl border border-green-500/60 bg-green-900/20 py-1.5 text-sm font-bold text-green-300 hover:bg-green-900/40">
                          ✅ Odbierz {itemsReady} {item.icon}
                        </button>
                      )}
                    </div>
                    {/* Głód */}
                    <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-4">
                      <p className="text-base font-black uppercase tracking-widest text-[#d8ba7a] mb-2">🌿 Głód</p>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-3 flex-1 rounded-full bg-black/40">
                          <div className="h-full rounded-full transition-all" style={{width:`${h}%`, background:hs.color}} />
                        </div>
                        <span className="text-xs font-bold" style={{color:hs.color}}>{Math.round(h)}%</span>
                      </div>
                      <p className="text-[11px] font-bold mb-2" style={{color:hs.color}}>{hs.label}{hs.speedMod!==0 ? ` (${hs.speedMod > 0 ? "+" : ""}${Math.round(hs.speedMod*100)}% czas prod.)` : ""}</p>
                      <p className="text-[10px] text-[#8b6a3e] mb-2">Karma (zepsute nie nadają się!):</p>
                      <div className="flex flex-col gap-1">
                        {a.feed.map(f => {
                          const variants: {key:string; label:string; qIcon:string; pts:number; color:string}[] = [
                            {key:`${f.cropId}_good`,      label:`${f.name}`,            qIcon:"",   pts:f.points,                   color:"#dfcfab"},
                            {key:`${f.cropId}_epic`,      label:`${f.name} Epicka`,     qIcon:"⭐", pts:Math.round(f.points*1.5),    color:"#4ade80"},
                            {key:`${f.cropId}_legendary`, label:`${f.name} Legendarna`, qIcon:"🌟", pts:f.points*2,                  color:"#f59e0b"},
                          ];
                          return (
                            <div key={f.cropId}>
                              <p className="text-[9px] text-[#8b6a3e] uppercase tracking-widest mt-1 mb-0.5">{f.icon} {f.name}</p>
                              {variants.map(v => {
                                const have = seedInventory[v.key] ?? 0;
                                const canUse = have > 0;
                                return (
                                  <button key={v.key} onClick={() => void onFeed(a, v.key, v.pts, v.label, f.icon)}
                                    disabled={!canUse}
                                    className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-[11px] font-bold transition mb-0.5 ${!canUse ? "opacity-30 cursor-not-allowed border-[#2d2010] text-[#6b7280]" : "border-[#8b6a3e]/60 text-[#dfcfab] hover:border-green-400/60 hover:bg-green-900/20 cursor-pointer"}`}>
                                    <span>{f.icon}{v.qIcon}</span>
                                    <span className="flex-1 text-left" style={{color: canUse ? v.color : undefined}}>{v.label}</span>
                                    <span className="text-green-400 text-[10px]">+{v.pts}</span>
                                    <span className="text-[#6b7280] text-[9px]">{have} szt</span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {/* Prawa kolumna */}
                  <div className="flex flex-col gap-3">
                    {/* Info: kupno przeniesione do miasta */}
                    <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
                      <p className="text-base font-black uppercase tracking-widest text-amber-300 mb-2">🛒 Kup zwierzę</p>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-base font-bold text-[#f9e7b2]">{a.icon} {a.name}</p>
                          <p className="text-sm text-amber-200/80">Posiadasz: <span className="font-black">{st.owned} / {st.slots}</span></p>
                        </div>
                        <span className="text-base font-black text-amber-400">{a.buyPrice.toLocaleString()} 💰</span>
                      </div>
                      <p className="text-sm text-amber-200/90 leading-relaxed">
                        ➡️ Zwierzęta kupisz w <span className="font-black text-amber-300">mieście → Sklep → zakładka 🐄 Zwierzęta</span>.
                      </p>
                    </div>
                    {/* Ulepszenia slotów */}
                    <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-4">
                      <p className="text-base font-black uppercase tracking-widest text-[#d8ba7a] mb-2">🏗️ Sloty stodoły</p>
                      <p className="text-base font-bold text-[#f9e7b2] mb-1">{st.slots} / {a.maxSlots} slotów</p>
                      <div className="flex gap-1 flex-wrap mb-3">
                        {Array.from({length: a.maxSlots}).map((_, i) => (
                          <div key={i} className={`h-3 w-3 rounded-sm border ${i < st.slots ? "border-amber-400 bg-amber-400/30" : "border-[#374151] bg-black/20"}`} />
                        ))}
                      </div>
                      {upgCost !== null ? (
                        <button onClick={() => void onBuySlot(a)}
                          disabled={displayMoney < upgCost}
                          className={`w-full rounded-xl border py-2 text-sm font-bold transition ${displayMoney < upgCost ? "opacity-50 cursor-not-allowed border-[#374151] text-[#6b7280]" : "border-[#8b6a3e]/60 bg-black/30 text-[#dfcfab] hover:border-amber-400/60 hover:text-amber-200"}`}>
                          Kup slot · {upgCost.toLocaleString()} 💰
                        </button>
                      ) : (
                        <p className="text-xs text-center text-[#4ade80] font-bold">✦ Maks sloty odblokowane ✦</p>
                      )}
                    </div>
                    {/* Tabela produkcji */}
                    <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/25 p-3">
                      <p className="text-base font-black uppercase tracking-widest text-[#d8ba7a] mb-2">📈 Info</p>
                      <div className="flex flex-col gap-1 text-[11px] text-[#dfcfab]">
                        <div className="flex justify-between"><span>Produkuje</span><span className="font-bold">{item.icon} {item.name}</span></div>
                        <div className="flex justify-between"><span>Czas (normalne)</span><span className="font-bold">{a.prodMs/3600000}h</span></div>
                        <div className="flex justify-between"><span>Pojemność magazynu</span><span className="font-bold">{Math.max(1,st.owned) * a.storageMax} {plItem(Math.max(1,st.owned) * a.storageMax, item)}</span></div>
                        <div className="flex justify-between"><span>Cena sprzedaży</span><span className="font-bold text-amber-400">{item.sellPrice.toLocaleString()} 💰</span></div>
                        <div className="flex justify-between"><span>Cena zwierzęcia</span><span className="font-bold">{a.buyPrice.toLocaleString()} 💰</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
