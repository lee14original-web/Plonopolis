import React from "react";
import type { HiveData } from "../../types/hive";
import { HIVE_MAX_HONEY, HIVE_UPGRADE_BEES, HIVE_BEE_ACCEPT_CHANCE, HONEY_MS_PER_PT } from "../../constants/hive";
import { HIVE_BUY_COST, BEE_COST, HIVE_MIN_BEES_TO_PRODUCE } from "../../constants/unlock";

interface HiveModalProps {
  hiveData: HiveData;
  hiveNow: number;
  displayMoney: number;
  onClose: () => void;
  onBuyHive: () => Promise<void>;
  onAddBees: (n: number) => Promise<void>;
  onCollect: () => Promise<void>;
}

export function HiveModal({ hiveData, hiveNow, displayMoney, onClose, onBuyHive, onAddBees, onCollect }: HiveModalProps) {
  const hlvl = hiveData.level;
  const maxHoney = HIVE_MAX_HONEY[hlvl] ?? 16;
  const elapsed = hiveData.honey_start != null ? Math.max(0, hiveNow - hiveData.honey_start) : 0;
  const honeyAvailable = hiveData.honey_start != null ? Math.min(Math.floor(elapsed / HONEY_MS_PER_PT), maxHoney) : 0;
  const msToNext = HONEY_MS_PER_PT - (elapsed % HONEY_MS_PER_PT);
  const secToNext = Math.ceil(msToNext / 1000);
  const hh = Math.floor(secToNext / 3600);
  const mm = Math.floor((secToNext % 3600) / 60);
  const ss = secToNext % 60;
  const timerStr = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
  const beesNeeded = HIVE_UPGRADE_BEES[hlvl] ?? 50;
  const beesProgress = Math.min(hiveData.bees_progress, beesNeeded);
  const honeyStarted = hiveData.honey_start != null;
  const canCollect = honeyStarted && honeyAvailable > 0 && hiveData.empty_jars > 0 && hiveData.suit_durability > 0;
  const suitPct = Math.round((hiveData.suit_durability / 100) * 100);
  const hiveBonusPct = hlvl * 2;
  const hiveImg = `/ul/ul_${hlvl}.png`;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[rgba(14,8,4,0.99)]">
      <div className="relative flex w-full flex-1 min-h-0 flex-col p-8 gap-5 overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>
        {/* Header */}
        <div className="flex items-center gap-4">
          <span className="text-4xl">🍯</span>
          <div>
            <h2 className="text-2xl font-black text-[#f9e7b2]">{hlvl === 0 ? "Ul — brak (kup, by zacząć)" : `Ul — poziom ${hlvl}`}</h2>
            <p className="text-sm text-amber-400/80">{hlvl === 0 ? "Najpierw kup ul, potem pszczoły — i ruszysz z produkcją miodu." : `Pszczoły przyspieszają wzrost o ${hiveBonusPct}%`}</p>
          </div>
        </div>
        {/* hlvl === 0: placeholder + kup ul */}
        {hlvl === 0 && (
          <div className="flex justify-center items-center h-36 rounded-2xl border-2 border-dashed border-[#8b6a3e]/40 bg-black/20">
            <span className="text-6xl opacity-40">🪧</span>
          </div>
        )}
        {hlvl === 0 && (
          <div className="rounded-2xl border border-amber-600/40 bg-amber-900/10 p-5 flex flex-col gap-3">
            <div>
              <p className="text-base font-black text-[#f9e7b2]">Kup ul (poziom 1)</p>
              <p className="text-xs text-[#dfcfab]/80 mt-1">Po zakupie ula musisz dokupić minimum {HIVE_MIN_BEES_TO_PRODUCE} pszczół ({HIVE_MIN_BEES_TO_PRODUCE * BEE_COST} zł), żeby uruchomić produkcję miodu.</p>
            </div>
            <button
              disabled={displayMoney < HIVE_BUY_COST}
              onClick={() => { void onBuyHive(); }}
              className={`w-full rounded-xl py-3 text-sm font-black transition ${displayMoney >= HIVE_BUY_COST ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
            >
              {displayMoney >= HIVE_BUY_COST ? `🍯 Kup ul (${HIVE_BUY_COST} zł)` : `🚫 Brak pieniędzy (${HIVE_BUY_COST} zł)`}
            </button>
          </div>
        )}
        {/* hlvl > 0: 2-kolumnowy layout */}
        {hlvl > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Lewa kolumna: podgląd, produkcja, zbiór */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <img src={hiveImg} alt={`Ul poziom ${hlvl}`} className="h-36 object-contain" style={{imageRendering:"pixelated"}} onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }} />
              </div>
              {/* Miód */}
              <div className="rounded-2xl border border-amber-600/30 bg-black/30 p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#dfcfab] font-bold">🍯 Miód</span>
                  <span className="text-amber-300 font-black">{honeyAvailable} / {maxHoney}</span>
                </div>
                <div className="h-3 rounded-full bg-black/40 border border-amber-700/30 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all" style={{ width:`${maxHoney > 0 ? (honeyAvailable/maxHoney*100) : 0}%` }} />
                </div>
                {honeyStarted && honeyAvailable >= maxHoney ? (
                  <p className="mt-2 text-xs text-amber-400 font-bold">🍯 Ul pełny — zbierz miód!</p>
                ) : honeyStarted ? (
                  <p className="mt-2 text-xs text-[#8b6a3e]">Następny słoik za: <span className="text-amber-300 font-bold">{timerStr}</span></p>
                ) : (
                  <p className="mt-2 text-xs text-amber-400/90 font-bold">🐝 Ul jeszcze nie produkuje — kup minimum {HIVE_MIN_BEES_TO_PRODUCE} pszczół żeby ruszyć z produkcją miodu!</p>
                )}
              </div>
              {/* Zasoby */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3 flex items-center gap-3">
                  <img src="/przedmioty/jar_empty.png" alt="Słoiki" className="w-8 h-8 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0";}} />
                  <div>
                    <p className="text-xs text-[#8b6a3e]">Puste słoiki</p>
                    <p className="font-black text-[#f9e7b2]">{hiveData.empty_jars}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3 flex items-center gap-3">
                  <img src="/przedmioty/jar_honey.png" alt="Miód" className="w-8 h-8 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0";}} />
                  <div>
                    <p className="text-xs text-[#8b6a3e]">Słoiki z miodem</p>
                    <p className="font-black text-[#f9e7b2]">{hiveData.honey_jars}</p>
                  </div>
                </div>
              </div>
              {/* Strój pszczelarza */}
              <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3">
                <div className="flex items-center gap-3 mb-2">
                  <img src="/przedmioty/beekeeper_suit.png" alt="Strój" className="w-8 h-8 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#dfcfab]">Strój pszczelarza</span>
                      <span className={hiveData.suit_durability > 0 ? "text-green-400" : "text-red-400"}>{hiveData.suit_durability}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/40 border border-[#8b6a3e]/30 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width:`${suitPct}%`, background: hiveData.suit_durability > 30 ? "#22c55e" : "#ef4444" }} />
                    </div>
                  </div>
                </div>
              </div>
              {/* Zbierz miód */}
              <button
                disabled={!canCollect}
                onClick={() => { void onCollect(); }}
                className={`w-full rounded-xl py-3 text-sm font-black transition ${canCollect ? "border border-yellow-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}
              >
                {!honeyStarted ? `🐝 Kup minimum ${HIVE_MIN_BEES_TO_PRODUCE} pszczół` : !canCollect && hiveData.suit_durability <= 0 ? "🚫 Brak stroju pszczelarza" : !canCollect && hiveData.empty_jars <= 0 ? "🚫 Brak słoików" : !canCollect ? "🕐 Poczekaj na miód" : `🍯 Zbierz miód (${Math.min(honeyAvailable, hiveData.empty_jars)} słoiki)`}
              </button>
            </div>
            {/* Prawa kolumna: pszczoły i ulepszanie */}
            <div className="flex flex-col gap-4">
              {hlvl >= 1 && hlvl < 5 && (
                <div className="rounded-2xl border border-amber-600/30 bg-black/30 p-4">
                  <p className="text-sm font-bold text-[#dfcfab] mb-1">🐝 Dokup pszczoły ({beesProgress}/{beesNeeded})</p>
                  <p className="text-xs text-amber-400/80 mb-1">Cena: <span className="font-black text-yellow-200">{BEE_COST} zł</span> za 1 pszczołę</p>
                  <p className={`text-xs mb-2 font-bold ${(HIVE_BEE_ACCEPT_CHANCE[hlvl] ?? 0) >= 0.8 ? "text-green-400" : (HIVE_BEE_ACCEPT_CHANCE[hlvl] ?? 0) >= 0.6 ? "text-yellow-300" : "text-red-400"}`}>
                    Szansa przyjęcia pszczoły: <span className="font-black">{Math.round((HIVE_BEE_ACCEPT_CHANCE[hlvl] ?? 0) * 100)}%</span>
                  </p>
                  <p className="text-xs text-red-400/80 mb-2">⚠️ Pszczoła która nie zostanie przyjęta — ginie, a kasa przepada.</p>
                  <div className="h-2 rounded-full bg-black/40 overflow-hidden mb-3">
                    <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width:`${beesNeeded > 0 ? (beesProgress/beesNeeded*100) : 0}%` }} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[1,5,10].map(n => {
                      const _add = Math.min(n, beesNeeded - beesProgress);
                      const _cost = _add * BEE_COST;
                      const _disabled = beesProgress >= beesNeeded || displayMoney < _cost || _add <= 0;
                      return (
                        <button key={n} disabled={_disabled} onClick={() => { void onAddBees(n); }}
                          title={`Koszt: ${_cost} zł`}
                          className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-800/30 disabled:opacity-40 disabled:cursor-not-allowed">
                          +{n} 🐝 ({n * BEE_COST}zł)
                        </button>
                      );
                    })}
                    {(() => {
                      const _addMax = beesNeeded - beesProgress;
                      const _costMax = _addMax * BEE_COST;
                      const _disabledMax = _addMax <= 0 || displayMoney < _costMax;
                      return (
                        <button disabled={_disabledMax} onClick={() => { void onAddBees(_addMax); }}
                          title={`Koszt: ${_costMax} zł`}
                          className="rounded-lg border border-amber-500/60 bg-amber-700/20 px-3 py-2 text-xs font-bold text-yellow-200 hover:bg-amber-700/30 disabled:opacity-40 disabled:cursor-not-allowed">
                          MAX 🐝 ({_costMax}zł)
                        </button>
                      );
                    })()}
                  </div>
                  {beesProgress >= beesNeeded && <p className="mt-2 text-xs text-green-400 font-bold">✅ Ul gotowy do ulepszenia!</p>}
                </div>
              )}
              {hlvl >= 5 && <p className="text-center text-sm text-amber-300 font-bold">✨ Ul osiągnął maksymalny poziom!</p>}
            </div>
          </div>
        )}
        <button onClick={onClose} className="w-full rounded-xl border border-[#8b6a3e]/50 bg-black/30 py-3 text-sm font-bold text-[#f3e6c8] transition hover:border-[#d4a64f]/60 hover:bg-black/50">
          ✕ Zamknij (Esc)
        </button>
      </div>
    </div>
  );
}
