import React from "react";
import type { TreeDef } from "../../types/barn";
import type { FruitQuality, OrchardState } from "../../types/orchard";
import type { CharEquipped } from "../../types/equipment";
import type { PlayerStatsMap } from "../../types/stats";
import { TREES } from "../../constants/orchard";
import { FRUIT_QUALITY_DEFS } from "../../constants/orchard";
import { getMaxTreeSlots, getOrchardTotalOwned } from "../../utils/orchard";
import { getEquipBonusPct, getEquipFlatBonus } from "../../utils/equipment";
import { calcStatEffect } from "../../utils/stats";

interface OrchardModalProps {
  displayLevel: number;
  orchardState: OrchardState;
  orchardError: string;
  fruitInventory: Record<string, number>;
  charEquipped: CharEquipped;
  playerStats: PlayerStatsMap;
  barnNow: number;
  onClose: () => void;
  onHarvestTree: (t: TreeDef) => void;
  onHarvestAll: () => void;
}

export function OrchardModal({ displayLevel, orchardState, orchardError, fruitInventory, charEquipped, playerStats, barnNow, onClose, onHarvestTree, onHarvestAll }: OrchardModalProps) {
  const lvl = displayLevel;
  const maxSlots = getMaxTreeSlots(lvl);
  const ownedTotal = getOrchardTotalOwned(orchardState);
  const ownedTrees = TREES.filter(t => (orchardState[t.id]?.owned ?? 0) > 0);
  const treeSpeedPct = getEquipBonusPct("% speed drzew", charEquipped);
  const sadownikBonus = calcStatEffect(playerStats?.sadownik ?? 0, 0.005);
  const luckPct = calcStatEffect((playerStats?.szczescie ?? 0) + getEquipFlatBonus(" pkt Szczescia", charEquipped), 0.0025);
  const fmtTime = (ms: number) => {
    if (ms <= 0) return "Gotowe!";
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };
  const calcInvValue = () => {
    let v = 0;
    TREES.forEach(t => {
      (["zwykly","soczysty","zloty"] as FruitQuality[]).forEach(q => {
        const k = `${t.fruitId}_${q}`;
        const cnt = fruitInventory[k] ?? 0;
        if (cnt > 0) v += cnt * t.pricePerFruit * FRUIT_QUALITY_DEFS[q].mult;
      });
    });
    return v;
  };
  const invValue = calcInvValue();
  const invTotal = Object.values(fruitInventory).reduce<number>((s,v) => s + (Number(v) || 0), 0);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-[1550px] flex-col overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(28,16,6,0.98)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>
        {/* Header */}
        <div className="shrink-0 border-b border-[#8b6a3e]/40 px-6 py-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#8b6a3e]">🌳 Sad Owocowy</p>
          <p className="text-xl font-black text-[#f9e7b2]">Twoje drzewa <span className="text-sm font-normal text-[#8b6a3e]">({ownedTotal}/{maxSlots} miejsc)</span></p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
            {treeSpeedPct > 0 && <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 font-bold text-emerald-300">⚡ Eq -{treeSpeedPct.toFixed(1)}% czasu</span>}
            {sadownikBonus > 0 && <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-bold text-amber-300">🌳 Sadownik +{sadownikBonus.toFixed(1)}% drop</span>}
            {luckPct > 0 && <span className="rounded-full bg-yellow-500/20 border border-yellow-500/40 px-2 py-0.5 font-bold text-yellow-300">🍀 Szczęście +{luckPct.toFixed(1)}% rare</span>}
          </div>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {ownedTrees.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <div className="text-center max-w-md">
                <p className="text-5xl mb-3">🌱</p>
                <p className="text-base font-black text-[#f9e7b2]">Twój sad jest pusty</p>
                <p className="mt-1 text-sm text-[#8b6a3e]">Kup drzewa w Sklepie → zakładka 🌳 Drzewa.</p>
                {maxSlots === 0 && <p className="mt-2 text-xs text-amber-300">Pierwsze miejsca odblokujesz na poziomie 10.</p>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ownedTrees.map(t => {
                const st = orchardState[t.id];
                const effMs = Math.max(60_000, Math.round(t.growthTimeMs * Math.max(0.30, 1 - treeSpeedPct/100)));
                const elapsed = st.prodStart > 0 ? barnNow - st.prodStart : 0;
                const remaining = Math.max(0, effMs - elapsed);
                const totalStored = st.storage.zwykly + st.storage.soczysty + st.storage.zloty + (st.storage.zgnile ?? 0);
                const cycleEarnings = (st.storage.zwykly * t.pricePerFruit) + (st.storage.soczysty * t.pricePerFruit * 2) + (st.storage.zloty * t.pricePerFruit * 5);
                return (
                  <div key={t.id} className="rounded-2xl border border-[#8b6a3e]/50 bg-black/30 p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{t.icon}</div>
                      <div className="flex-1">
                        <p className="text-base font-black text-[#f9e7b2]">{t.name} <span className="text-xs font-normal text-emerald-400">×{st.owned}</span></p>
                        <p className="text-[11px] text-[#8b6a3e]">Owoc: {t.fruitIcon} {t.fruitName} · Cykl {Math.round(t.growthTimeMs/3600000)}h · Drop {t.dropMin}–{t.dropMax}</p>
                      </div>
                    </div>
                    {/* Status */}
                    <div className="mt-3 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-3">
                      {totalStored === 0 && remaining > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-[#8b6a3e]">⏳ Następny zbiór za</p>
                          <p className="text-lg font-black text-amber-300 font-mono">{fmtTime(remaining)}</p>
                          <div className="mt-1 h-1.5 rounded-full bg-black/50 overflow-hidden">
                            <div className="h-full bg-amber-400 transition-all" style={{ width: `${Math.min(100, (elapsed/effMs)*100)}%` }} />
                          </div>
                        </div>
                      )}
                      {totalStored > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-emerald-400">✅ Gotowe do zbioru!</p>
                          <p className="mt-1 text-base font-black text-[#f9e7b2]">{totalStored} {t.fruitIcon}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                            {st.storage.zwykly > 0          && <span className="rounded bg-emerald-900/40 border border-emerald-500/40 px-2 py-0.5 font-bold text-emerald-300">{st.storage.zwykly} zwykły</span>}
                            {st.storage.soczysty > 0         && <span className="rounded bg-cyan-900/40 border border-cyan-500/40 px-2 py-0.5 font-bold text-cyan-300">💧 {st.storage.soczysty} soczysty</span>}
                            {st.storage.zloty > 0            && <span className="rounded bg-yellow-900/40 border border-yellow-500/40 px-2 py-0.5 font-bold text-yellow-300">✨ {st.storage.zloty} złoty</span>}
                            {(st.storage.zgnile ?? 0) > 0   && <span className="rounded bg-gray-900/40 border border-gray-600/40 px-2 py-0.5 font-bold text-gray-400">🍂 {st.storage.zgnile} zgniłe</span>}
                          </div>
                          <p className="mt-1 text-[10px] text-amber-400">≈ {cycleEarnings.toLocaleString()}💰 wartości</p>
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <button
                      disabled={totalStored === 0}
                      onClick={() => onHarvestTree(t)}
                      className={`mt-2 w-full rounded-xl py-2 text-sm font-black transition ${totalStored > 0 ? "border border-emerald-500/60 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/60" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}>
                      ✅ Zbierz {totalStored > 0 ? totalStored : ""}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Info wszystkich drzew (zakupisz w mieście) */}
          <div className="mt-5 rounded-2xl border border-[#8b6a3e]/40 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a] mb-3">📜 Wszystkie drzewa <span className="font-normal text-[#8b6a3e] normal-case tracking-normal">— zakupisz w mieście (Sklep → 🌳 Drzewa)</span></p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#8b6a3e] border-b border-[#8b6a3e]/30">
                    <th className="text-left py-1.5 pr-2">LVL</th>
                    <th className="text-left py-1.5 pr-2">Drzewo</th>
                    <th className="text-left py-1.5 pr-2">Produkt</th>
                    <th className="text-left py-1.5 pr-2">Czas</th>
                    <th className="text-left py-1.5 pr-2">Drop</th>
                    <th className="text-right py-1.5 pr-2">Cena</th>
                    <th className="text-right py-1.5">Posiadasz</th>
                  </tr>
                </thead>
                <tbody>
                  {TREES.map(t => {
                    const ownedHere = orchardState[t.id]?.owned ?? 0;
                    const locked = lvl < t.unlockLevel;
                    return (
                      <tr key={t.id} className={`border-b border-[#8b6a3e]/10 ${locked ? "opacity-50" : ""}`}>
                        <td className="py-1.5 pr-2 text-[#dfcfab]">{locked && "🔒"}{t.unlockLevel}</td>
                        <td className="py-1.5 pr-2 font-bold text-[#f9e7b2]">{t.icon} {t.name}</td>
                        <td className="py-1.5 pr-2 text-[#dfcfab]">{t.fruitIcon} {t.fruitName}</td>
                        <td className="py-1.5 pr-2 text-[#dfcfab]">{Math.round(t.growthTimeMs/3600000)}h</td>
                        <td className="py-1.5 pr-2 text-[#dfcfab]">{t.dropMin}–{t.dropMax}</td>
                        <td className="py-1.5 pr-2 text-right font-bold text-amber-400">{t.buyPrice.toLocaleString()}💰</td>
                        <td className="py-1.5 text-right">
                          <span className={`font-black ${ownedHere > 0 ? "text-emerald-300" : "text-[#8b6a3e]"}`}>{ownedHere}/{maxSlots}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-[#8b6a3e]">Limit drzew rośnie z poziomem: 10→2, 15→4, 20→6, 25→8 (łącznie wszystkie drzewa).</p>
          </div>
        </div>
        {/* Footer: inventory + harvest (sprzedaż w Ladzie) */}
        {(ownedTrees.length > 0 || invTotal > 0) && (
          <div className="shrink-0 border-t border-[#8b6a3e]/40 bg-black/30 p-4">
            {orchardError && <p className="mb-2 rounded-lg bg-red-900/40 px-3 py-1.5 text-xs text-red-300">{orchardError}</p>}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#8b6a3e]">📦 Magazyn owoców</p>
                <p className="text-sm font-black text-[#f9e7b2]">{invTotal} owoców · wartość ~{invValue.toLocaleString()}💰</p>
                {invTotal > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] max-w-[600px]">
                    {Object.entries(fruitInventory).filter(([,c]) => (c as number) > 0).slice(0, 12).map(([k,c]) => {
                      const lastUnd = k.lastIndexOf("_");
                      const fruitId = k.slice(0, lastUnd);
                      const q = k.slice(lastUnd+1) as FruitQuality;
                      const tree = TREES.find(tt => tt.fruitId === fruitId);
                      if (!tree) return null;
                      const qd = FRUIT_QUALITY_DEFS[q];
                      return <span key={k} className="rounded border border-[#8b6a3e]/40 bg-black/40 px-1.5 py-0.5 font-bold" style={{color: qd.color}}>{qd.icon}{tree.fruitIcon}×{c as number}</span>;
                    })}
                    {Object.keys(fruitInventory).filter(k => (fruitInventory[k] ?? 0) > 0).length > 12 && <span className="text-[#8b6a3e]">…</span>}
                  </div>
                )}
                {invTotal > 0 && <p className="mt-1 text-[11px] text-amber-300/90">💡 Sprzedaż owoców → <span className="font-black text-amber-300">Lada dla klientów</span> w mieście.</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onHarvestAll}
                  className="rounded-xl border border-emerald-500/60 bg-emerald-900/30 px-4 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-900/50">
                  ✅ Zbierz wszystko z drzew
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
