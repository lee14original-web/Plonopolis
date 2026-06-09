"use client";

import React from "react";
import type { SeedInventory } from "../../types/farm";
import type { PlayerStatsMap } from "../../types/stats";
import type { CharEquipped } from "../../types/equipment";
import type { HiveData } from "../../types/hive";
import { CROPS } from "../../constants/crops";
import { parseQualityKey } from "../../utils/crop";
import { isCompostKey, isGuideCompostKey } from "../../utils/compost";
import { calcStatEffect } from "../../utils/stats";
import { getEquipFlatBonus, getEquipBonusPct } from "../../utils/equipment";
import {
  WIEDZA_RATE, WIEDZA_MULT_MIN, HIVE_MULT_MIN,
  GROWTH_GLOBAL_MIN_MULT, WATER_BASE, WATER_MULT_MIN, ZARADNOSC_RATE,
} from "../../constants/unlock";

interface SeedPickerProps {
  fvSeedPickerOpen: boolean;
  fvToolEditMode: boolean;
  setFvSeedPickerOpen: (v: boolean) => void;
  seedQualityFilter: "good" | "epic" | "legendary";
  setSeedQualityFilter: (q: "good" | "epic" | "legendary") => void;
  seedInventory: SeedInventory;
  selectedSeedId: string | null;
  setSelectedSeedId: (id: string | null) => void;
  setSelectedTool: React.Dispatch<React.SetStateAction<"watering_can" | "sickle" | null>>;
  seedPickerTip: { x: number; y: number; node: React.ReactNode; color: string } | null;
  setSeedPickerTip: (tip: { x: number; y: number; node: React.ReactNode; color: string } | null) => void;
  advanceTutorialStep: (nextStep: number) => Promise<void>;
  tutorialStep: number;
  effectiveStats: PlayerStatsMap;
  charEquipped: CharEquipped;
  hiveData: HiveData;
}

export function SeedPicker({
  fvSeedPickerOpen,
  fvToolEditMode,
  setFvSeedPickerOpen,
  seedQualityFilter,
  setSeedQualityFilter,
  seedInventory,
  selectedSeedId,
  setSelectedSeedId,
  setSelectedTool,
  seedPickerTip,
  setSeedPickerTip,
  advanceTutorialStep,
  tutorialStep,
  effectiveStats,
  charEquipped,
  hiveData,
}: SeedPickerProps) {
  if (!fvSeedPickerOpen || fvToolEditMode) return null;
  return (
                    <div
                      className="fixed inset-0 z-[115] flex items-center justify-center"
                      onClick={() => setFvSeedPickerOpen(false)}
                    >
                      <div
                        className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,6,0.97)] p-5 w-[760px] max-w-[95vw] max-h-[80vh] overflow-y-auto shadow-2xl backdrop-blur-sm"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xl font-black text-[#f9e7b2]">Nasiona w plecaku</h3>
                          <div className="flex gap-1.5">
                            {(["good","epic","legendary"] as const).map(q => {
                              const label = q === "good" ? "Zwykłe" : q === "epic" ? "Epickie" : "Legendarne";
                              const activeColor = q === "good" ? "border-[#6ee7b7] bg-[#6ee7b7]/20 text-[#6ee7b7]" : q === "epic" ? "border-[#a78bfa] bg-[#a78bfa]/20 text-[#a78bfa]" : "border-[#fbbf24] bg-[#fbbf24]/20 text-[#fbbf24]";
                              const inactiveColor = "border-[#8b6a3e]/40 text-[#8b6a3e] hover:text-[#dfcfab]";
                              return (
                                <button key={q} type="button"
                                  className={`rounded-lg px-3 py-1 text-[13px] font-bold border transition-colors ${seedQualityFilter === q ? activeColor : inactiveColor}`}
                                  onClick={() => { setSeedQualityFilter(q); localStorage.setItem("plonopolis_seed_filter", q); }}
                                >{label}</button>
                              );
                            })}
                          </div>
                        </div>
                        {(["legendary","epic","good",null] as (string|null)[]).filter(quality => quality === seedQualityFilter).map(quality => {
                          const entries = Object.entries(seedInventory)
                            .filter(([k, cnt]) => !isCompostKey(k) && !isGuideCompostKey(k) && cnt > 0 && parseQualityKey(k).quality === quality)
                            .sort(([aId], [bId]) => {
                              const aC = parseQualityKey(aId).baseCropId;
                              const bC = parseQualityKey(bId).baseCropId;
                              const aLv = CROPS.find(c => c.id === aC)?.unlockLevel ?? 999;
                              const bLv = CROPS.find(c => c.id === bC)?.unlockLevel ?? 999;
                              return aLv - bLv;
                            });
                          if (entries.length === 0) return (
                            <div key={quality ?? "base"} className="flex flex-col items-center justify-center py-14 gap-2">
                              <span className="text-5xl opacity-20">🌱</span>
                              <p className="text-[#8b6a3e] text-[18px]">Brak nasion tej kategorii.</p>
                            </div>
                          );
                          return (
                            <div key={quality ?? "base"} className="mb-4">
                              <div className="grid grid-cols-5 gap-3">
                                {entries.map(([seedId, cnt]) => {
                                  const { baseCropId, quality: q } = parseQualityKey(seedId);
                                  const crop = CROPS.find(c => c.id === baseCropId);
                                  if (!crop) return null;
                                  const sprite = q === "legendary" ? (crop.legendarySpritePath ?? crop.spritePath) : q === "epic" ? (crop.epicSpritePath ?? crop.spritePath) : q === "rotten" ? (crop.rottenSpritePath ?? crop.spritePath) : crop.spritePath;
                                  const qColor = q === "legendary" ? "#fbbf24" : q === "epic" ? "#a78bfa" : q === "good" ? "#6ee7b7" : "#8b6a3e";
                                  const isSel = selectedSeedId === seedId;
                                  return (
                                    <div key={seedId} className={`flex flex-col items-center gap-1${tutorialStep === 6 && seedId === "carrot_good" ? " outline outline-2 outline-amber-400 rounded-xl shadow-[0_0_16px_rgba(251,191,36,0.5)]" : ""}`} data-tutorial-target={tutorialStep === 6 && seedId === "carrot_good" ? "carrot-good-item" : undefined}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSeedId(isSel ? null : seedId);
                                          setSelectedTool(null);
                                          setFvSeedPickerOpen(false);
                                          setSeedPickerTip(null);
                                          if (tutorialStep === 6 && seedId === "carrot_good") void advanceTutorialStep(7);
                                        }}
                                        onMouseEnter={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const tipColor = q === "legendary" ? "#fbbf24" : q === "epic" ? "#a78bfa" : q === "good" ? "#6ee7b7" : "#9ca3af";
                                          const qLabel = q === "legendary" ? "✨ Legendarne" : q === "epic" ? "🟣 Epickie" : q === "good" ? "🟢 Zwykłe" : q === "rotten" ? "🟫 Zgniłe" : "Zwykłe";
                                          // Efektywny czas wzrostu gracza (te same wzory co getEffectiveGrowthTimeMs, bez per-pole)
                                          const _baseMs = crop.growthTimeMs;
                                          const _wiedzaEff = (effectiveStats.wiedza ?? 0) + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
                                          const _wiedzaPctRaw = calcStatEffect(_wiedzaEff, WIEDZA_RATE);
                                          const _wiedzaPct = Math.min((1 - WIEDZA_MULT_MIN) * 100, _wiedzaPctRaw);
                                          const _hivePct = Math.min((1 - HIVE_MULT_MIN) * 100, hiveData.level * 2);
                                          const _wiedzaMult = Math.max(WIEDZA_MULT_MIN, 1 - _wiedzaPct / 100);
                                          const _hiveMult = Math.max(HIVE_MULT_MIN, 1 - _hivePct / 100);
                                          const _effMs = Math.round(_baseMs * Math.max(GROWTH_GLOBAL_MIN_MULT, _wiedzaMult * _hiveMult));
                                          const _zaradnoscEff2 = (effectiveStats.zaradnosc ?? 0) + getEquipFlatBonus(" pkt Zaradnosci", charEquipped);
                                          const _zaradBonus = calcStatEffect(_zaradnoscEff2, ZARADNOSC_RATE);
                                          const _waterEqPct = getEquipBonusPct("% efekt podlewania", charEquipped);
                                          const _waterTotalPct = (WATER_BASE * 100) + _zaradBonus + _waterEqPct;
                                          const _withWaterMs = Math.round(_baseMs * Math.max(GROWTH_GLOBAL_MIN_MULT, Math.max(WATER_MULT_MIN, 1 - _waterTotalPct / 100) * _wiedzaMult * _hiveMult));
                                          const _fmt = (ms: number) => { const t = Math.max(0, Math.floor(ms/1000)); const h = Math.floor(t/3600); const m = Math.floor((t%3600)/60); const s = t%60; return h > 0 ? `${h}h ${m}min ${s}s` : m > 0 ? `${m}min ${s}s` : `${s}s`; };
                                          const _savedPct = Math.round(((_baseMs - _effMs) / _baseMs) * 100);
                                          const _showBonus = _wiedzaPct > 0 || _hivePct > 0;
                                          // Zręczność
                                          const _zrEff2 = (effectiveStats.zrecznosc ?? 0) + getEquipFlatBonus(" pkt Zrecznosci", charEquipped);
                                          const _zrChance2 = calcStatEffect(_zrEff2, 0.004);
                                          const _isSmall2 = crop.yieldAmount <= 2;
                                          const _dropStr2 = q === "legendary"
                                            ? (_isSmall2 ? "20–60 szt." : "40–120 szt.")
                                            : q === "epic"
                                            ? (_isSmall2 ? "10–22 szt." : "20–44 szt.")
                                            : (_isSmall2 ? "1–3 szt." : "2–6 szt.");
                                          const _dropZrStr2 = q === "legendary"
                                            ? (_isSmall2 ? "40–120 szt." : "80–240 szt.")
                                            : q === "epic"
                                            ? (_isSmall2 ? "20–44 szt." : "40–88 szt.")
                                            : (_isSmall2 ? "2–6 szt." : "4–12 szt.");
                                          const _qualLabel = q === "rotten" ? "popsuta" : q === "epic" ? "epicka" : q === "legendary" ? "legendarna" : "zwykła";
                                          const _expDisplay2 =
                                            q === "rotten"    ? "+0 EXP"
                                            : q === "epic"    ? `+${crop.expReward * 3}–${crop.expReward * 6} EXP`
                                            : q === "legendary" ? `+${crop.expReward * 10}–${crop.expReward * 20} EXP`
                                            : `+${crop.expReward} EXP`;
                                          const tipNode = (
                                            <>
                                              {/* ── HEADER ── */}
                                              <p className="text-[22px] font-black text-[#f9e7b2] leading-tight mb-2">
                                                {crop.name} <span style={{ color: tipColor }}>{_qualLabel}</span>
                                              </p>

                                              {/* ── BODY ── */}
                                              <div className="flex flex-col gap-1 text-[18px]">
                                                {q === "rotten"
                                                  ? <p className="text-[#8b6a3e]">Tej uprawy nie można posadzić. Dobry jako kompost lub do zadań specjalnych.</p>
                                                  : <>
                                                      <p className="text-[#8b6a3e]">Czas z Twoimi bonusami: <span className="font-bold text-[#dfcfab]">{_fmt(_effMs)}</span></p>
                                                    </>
                                                }
                                                <p className="text-[#8b6a3e]">Doświadczenie: <span className="font-bold text-sky-300">{_expDisplay2}</span></p>
                                                <p className="text-[#8b6a3e]">Drop: <span className="font-bold text-yellow-300">{_dropStr2}</span></p>
                                              </div>

                                              {/* ── FOOTER (Zręczność) ── */}
                                              <div className="mt-2 border-t border-white/10 pt-1.5 flex flex-col gap-0.5 text-[17px]">
                                                <p className="text-[#8b6a3e]">Jeśli Zręczność zadziała: <span className="font-bold text-yellow-300">{_dropZrStr2}</span></p>
                                                <p className="text-[#8b6a3e]">Szansa Zręczności: <span className="font-bold text-amber-300">{_zrChance2.toFixed(1)}%</span></p>
                                                <p className="mt-0.5 text-[15px] text-[#8b6a3e]">Podlewanie i kompost mogą dodatkowo skrócić czas.</p>
                                              </div>
                                            </>
                                          );
                                          setSeedPickerTip({ x: rect.left + rect.width / 2, y: rect.top, node: tipNode, color: tipColor });
                                        }}
                                        onMouseLeave={() => setSeedPickerTip(null)}
                                        className="relative w-[112px] h-[112px] rounded-xl border-2 overflow-hidden transition-colors"
                                        style={{ borderColor: isSel ? qColor : "rgba(139,106,62,0.4)", backgroundColor: isSel ? "rgba(30,18,8,0.9)" : "rgba(20,12,6,0.7)", ...(isSel ? { boxShadow: `0 0 14px ${qColor}88` } : {}) }}
                                      >
                                        <img src={sprite} alt={crop.name} className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />
                                        <span className="absolute bottom-1 right-1 min-w-[20px] rounded-md bg-black/80 px-1 py-0.5 text-[11px] font-black leading-none text-[#f9e7b2]">×{cnt}</span>
                                        {isSel && <span className="absolute inset-0 rounded-xl ring-2 ring-inset pointer-events-none" style={{ outlineColor: qColor }} />}
                                      </button>
                                      <p className="text-[11px] font-bold text-[#f9e7b2] text-center leading-tight max-w-[112px] truncate">{crop.name}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {Object.entries(seedInventory).filter(([k, v]) => !isCompostKey(k) && !isGuideCompostKey(k) && v > 0).length === 0 && (
                          <p className="text-sm text-[#dfcfab] text-center py-6">Brak nasion w plecaku</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setFvSeedPickerOpen(false)}
                          className="mt-3 w-full rounded-xl border border-[#8b6a3e]/60 bg-[rgba(38,24,14,0.7)] py-2 text-sm font-bold text-[#dfcfab] hover:bg-[rgba(58,34,18,0.9)] transition-colors"
                        >Zamknij</button>
                      </div>
                      {/* Tooltip nasiona */}
                      {seedPickerTip && (() => {
                        const TIP_W = 360;
                        const TIP_H_EST = 320;
                        const margin = 12;
                        let left = seedPickerTip.x - TIP_W / 2;
                        left = Math.max(margin, Math.min(window.innerWidth - TIP_W - margin, left));
                        let top = seedPickerTip.y - TIP_H_EST - 14;
                        if (top < margin) top = seedPickerTip.y + 125;
                        return (
                          <div
                            className="pointer-events-none fixed z-[9999] flex flex-col gap-1 rounded-xl border-2 px-4 py-3 shadow-2xl text-left bg-[rgba(8,18,12,0.98)]"
                            style={{ left, top, width: TIP_W, borderColor: seedPickerTip.color }}>
                            {seedPickerTip.node}
                          </div>
                        );
                      })()}
                    </div>
  );
}
