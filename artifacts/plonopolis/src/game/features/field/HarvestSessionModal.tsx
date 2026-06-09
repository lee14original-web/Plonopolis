"use client";

import type { HarvestEvent } from "../../types/farm";
import type { PlayerStatsMap } from "../../types/stats";
import type { CharEquipped } from "../../types/equipment";
import type { HiveData } from "../../types/hive";
import { CROPS, } from "../../constants/crops";
import { CROP_QUALITY_DEFS } from "../../types/crop";
import { BASE_W, BASE_H } from "../../constants/map";
import { calcStatEffect } from "../../utils/stats";
import { getEquipFlatBonus } from "../../utils/equipment";
import { WIEDZA_MULT_MIN, HIVE_MULT_MIN, WIEDZA_RATE, GROWTH_GLOBAL_MIN_MULT } from "../../constants/unlock";

type DailyHarvestData = {
  items: Array<{ crop_id: string; quality: "rotten" | "good" | "epic" | "legendary"; amount: number }>;
  total_exp: number;
};

type FvHarvestTooltip = {
  cropId: string;
  cropName: string;
  baseAmount: number;
  bonusAmount: number;
  bonusSource: string | null;
  baseExp: number;
  quality: "rotten" | "good" | "epic" | "legendary";
  cx: number;
  cy: number;
};

interface HarvestSessionModalProps {
  harvestLog: HarvestEvent[];
  isDailyHarvestView: boolean;
  setIsDailyHarvestView: (v: boolean) => void;
  isDailyHarvestLoading: boolean;
  dailyHarvestData: DailyHarvestData | null;
  fetchDailyHarvest: () => Promise<void>;
  setIsFvHarvestModalOpen: (v: boolean) => void;
  tutorialStep: number;
  advanceTutorialStep: (nextStep: number) => Promise<void>;
  setHarvestLog: (v: HarvestEvent[]) => void;
  fvHarvestTooltip: FvHarvestTooltip | null;
  setFvHarvestTooltip: (t: FvHarvestTooltip | null) => void;
  setFvQualityTip: (t: { label: string; expLabel: string; chance: string; sx: number; sy: number } | null) => void;
  gameScale: number;
  effectiveStats: PlayerStatsMap;
  charEquipped: CharEquipped;
  hiveData: HiveData;
}

export function HarvestSessionModal({
  harvestLog,
  isDailyHarvestView,
  setIsDailyHarvestView,
  isDailyHarvestLoading,
  dailyHarvestData,
  fetchDailyHarvest,
  setIsFvHarvestModalOpen,
  tutorialStep,
  advanceTutorialStep,
  setHarvestLog,
  fvHarvestTooltip,
  setFvHarvestTooltip,
  setFvQualityTip,
  gameScale,
  effectiveStats,
  charEquipped,
  hiveData,
}: HarvestSessionModalProps) {
            const grouped = harvestLog.reduce<Record<string, { cropId: string; cropName: string; baseAmount: number; bonusAmount: number; bonusSource: string | null; baseExp: number; quality: "rotten"|"good"|"epic"|"legendary" }>>(
              (acc, e) => {
                const _gKey = `${e.cropId}_${e.quality}`; if (!acc[_gKey]) {
                  acc[_gKey] = { cropId: e.cropId, cropName: e.cropName, baseAmount: 0, bonusAmount: 0, bonusSource: e.bonusSource, baseExp: 0, quality: e.quality };
                }
                acc[_gKey].baseAmount += e.baseAmount;
                acc[_gKey].bonusAmount += e.bonusAmount;
                acc[_gKey].baseExp += e.baseExp;
                if (e.bonusSource) acc[_gKey].bonusSource = e.bonusSource;
                return acc;
              }, {}
            );
            const totalExp = harvestLog.reduce((s, e) => s + e.baseExp, 0);
            const _QUAL_ORDER: Record<string, number> = { rotten: 0, good: 1, epic: 2, legendary: 3 };
            const items = (Object.values(grouped) as Array<{cropId:string;cropName:string;baseAmount:number;bonusAmount:number;bonusSource:string|null;baseExp:number;quality:"rotten"|"good"|"epic"|"legendary"}>).sort((a, b) => {
              const qDiff = (_QUAL_ORDER[a.quality] ?? 0) - (_QUAL_ORDER[b.quality] ?? 0);
              if (qDiff !== 0) return qDiff;
              const lvA = CROPS.find(c => c.id === a.cropId)?.unlockLevel ?? 999;
              const lvB = CROPS.find(c => c.id === b.cropId)?.unlockLevel ?? 999;
              return lvA - lvB;
            });
            return (
              <div
                className="absolute inset-0 z-[160] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                onClick={() => setIsFvHarvestModalOpen(false)}
              >
                <div
                  className="relative w-[620px] max-w-[95vw] max-h-[calc(100vh-80px)] rounded-[24px] border border-[#8b6a3e] bg-[rgba(18,10,4,0.98)] shadow-2xl flex flex-col overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Nagłówek */}
                  <div className="flex items-start justify-between px-7 py-5 border-b border-[#8b6a3e]/40 bg-[rgba(14,8,3,0.7)] shrink-0">
                    <div>
                      <h2 className="text-[47px] font-black text-[#f9e7b2] tracking-wide">Sesja zbiorów</h2>
                      <p className="text-[22px] text-[#8b6a3e] mt-0.5">
                        {isDailyHarvestView ? "Zebrane plony z dzisiejszego dnia" : "Historia zbiorów z bieżącej sesji w polu uprawnym"}
                      </p>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsDailyHarvestView(false)}
                          className={`rounded-lg px-3.5 py-1 text-[15px] font-bold border transition-colors ${!isDailyHarvestView ? "border-[#8b6a3e] bg-[#8b6a3e]/40 text-[#f9e7b2]" : "border-[#8b6a3e]/30 text-[#8b6a3e] hover:text-[#dfcfab]"}`}
                        >Bieżąca sesja</button>
                        <button
                          type="button"
                          onClick={() => { setIsDailyHarvestView(true); void fetchDailyHarvest(); }}
                          className={`rounded-lg px-3.5 py-1 text-[15px] font-bold border transition-colors ${isDailyHarvestView ? "border-[#d8ba7a] bg-[#d8ba7a]/20 text-[#f9e7b2]" : "border-[#8b6a3e]/30 text-[#8b6a3e] hover:text-[#dfcfab]"}`}
                        >Zbiory dzisiaj</button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFvHarvestModalOpen(false)}
                      className="text-4xl text-[#8b6a3e] hover:text-[#f9e7b2] transition-colors leading-none mt-1"
                    >✕</button>
                  </div>

                  {/* Treść */}
                  <div className="overflow-y-auto flex-1 p-6">
                    {isDailyHarvestView ? (
                      isDailyHarvestLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <span className="text-6xl opacity-30 animate-pulse">🌾</span>
                          <p className="text-[#8b6a3e] text-[21px]">Ładowanie...</p>
                        </div>
                      ) : !dailyHarvestData || dailyHarvestData.items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <span className="text-6xl opacity-30">🌾</span>
                          <p className="text-[#8b6a3e] text-[21px]">Nie zebrałeś jeszcze żadnych plonów dzisiaj.</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-7 gap-2">
                            {[...dailyHarvestData.items].sort((a, b) => {
                              const qOrder = { rotten: 0, good: 1, epic: 2, legendary: 3 } as Record<string, number>;
                              if (qOrder[a.quality] !== qOrder[b.quality]) return qOrder[a.quality] - qOrder[b.quality];
                              const aLvl = CROPS.find(c => c.id === a.crop_id)?.unlockLevel ?? 0;
                              const bLvl = CROPS.find(c => c.id === b.crop_id)?.unlockLevel ?? 0;
                              return aLvl - bLvl;
                            }).slice(0, 35).map((it, i) => {
                              const _qd = CROP_QUALITY_DEFS[it.quality];
                              const _cropDef = CROPS.find(c => c.id === it.crop_id);
                              const _sprite = it.quality === "epic" ? (_cropDef?.epicSpritePath ?? _cropDef?.spritePath)
                                            : it.quality === "rotten" ? (_cropDef?.rottenSpritePath ?? _cropDef?.spritePath)
                                            : it.quality === "legendary" ? (_cropDef?.legendarySpritePath ?? _cropDef?.spritePath)
                                            : _cropDef?.spritePath;
                              return (
                                <div key={i} className="relative"
                                  onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setFvHarvestTooltip({ cropId: it.crop_id, cropName: _cropDef?.name ?? it.crop_id, baseAmount: it.amount, bonusAmount: 0, bonusSource: null, baseExp: _cropDef?.expReward ?? 0, quality: it.quality, cx: r.left + r.width / 2, cy: r.top }); }}
                                  onMouseLeave={() => setFvHarvestTooltip(null)}>
                                  <div className="relative w-full aspect-square rounded-xl border-2"
                                    style={it.quality === "legendary"
                                      ? { borderColor: _qd.borderColor, background: _qd.bgColor, animation: "legendaryPulse 2s ease-in-out infinite" }
                                      : { borderColor: _qd.borderColor, background: _qd.bgColor }}>
                                    {_sprite
                                      ? <img src={_sprite} alt={_cropDef?.name ?? it.crop_id} className="h-full w-full object-contain p-1" />
                                      : <span className="flex h-full w-full items-center justify-center text-3xl">🌾</span>
                                    }
                                    {it.quality === "legendary" && (
                                      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                                        <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                      </span>
                                    )}
                                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[13px] font-black text-white leading-tight">×{it.amount}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {dailyHarvestData.items.length > 35 && (
                            <p className="mt-3 text-center text-[17px] text-[#8b6a3e]">+{dailyHarvestData.items.length - 35} więcej rodzajów</p>
                          )}
                        </>
                      )
                    ) : items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <span className="text-6xl opacity-30">🌾</span>
                        <p className="text-[#8b6a3e] text-[21px]">Brak zbiorów w tej sesji</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-7 gap-2">
                          {items.slice(0, 35).map((g, i) => {
                            const _qd = CROP_QUALITY_DEFS[g.quality];
                            const _cropDef = CROPS.find(c => c.id === g.cropId);
                            const _sprite = g.quality === "epic" ? (_cropDef?.epicSpritePath ?? _cropDef?.spritePath)
                                          : g.quality === "rotten" ? (_cropDef?.rottenSpritePath ?? _cropDef?.spritePath)
                                          : g.quality === "legendary" ? (_cropDef?.legendarySpritePath ?? _cropDef?.spritePath)
                                          : _cropDef?.spritePath;
                            const _total = g.baseAmount + g.bonusAmount;
                            const _isExpOnly = g.quality === "legendary" && g.baseAmount === 0;
                            return (
                              <div key={i} className="relative"
                                onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setFvHarvestTooltip({ ...g, cx: r.left + r.width / 2, cy: r.top }); }}
                                onMouseLeave={() => setFvHarvestTooltip(null)}
                              >
                                <div className="relative w-full aspect-square cursor-default rounded-xl border-2 transition-transform duration-150 hover:scale-105"
                                  style={_isExpOnly
                                    ? { borderColor: "#38bdf8", background: "rgba(14,60,100,0.6)" }
                                    : g.quality === "legendary"
                                      ? { borderColor: _qd.borderColor, background: _qd.bgColor, animation: "legendaryPulse 2s ease-in-out infinite" }
                                      : { borderColor: _qd.borderColor, background: _qd.bgColor }}>
                                  {_isExpOnly
                                    ? <span className="flex h-full w-full flex-col items-center justify-center gap-1">
                                        <span className="text-2xl leading-none">⭐</span>
                                        <span className="text-[13px] font-black text-sky-300 leading-none">XP</span>
                                      </span>
                                    : _sprite
                                      ? <img src={_sprite} alt={g.cropName} className="h-full w-full object-contain p-1" />
                                      : <span className="flex h-full w-full items-center justify-center text-3xl">🌾</span>
                                  }
                                  {g.quality === "legendary" && !_isExpOnly && (
                                    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                                      <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                    </span>
                                  )}
                                  {_isExpOnly && <span className="absolute left-1 top-1 text-[15px] leading-none drop-shadow">✨</span>}
                                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[13px] font-black text-white leading-tight">
                                    {_total === 0 && g.bonusSource ? "★" : `×${_total}`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {items.length > 35 && (
                          <p className="mt-3 text-center text-[17px] text-[#8b6a3e]">+{items.length - 35} więcej rodzajów</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Stopka z EXP */}
                  {(isDailyHarvestView
                    ? (dailyHarvestData != null && dailyHarvestData.total_exp > 0)
                    : items.length > 0
                  ) && (
                    <div className="px-7 py-4 border-t border-[#8b6a3e]/30 bg-[rgba(14,8,3,0.6)] shrink-0 flex items-center justify-between">
                      <span className="text-[27px] font-black uppercase tracking-widest text-[#8b6a3e]">
                        {isDailyHarvestView ? "EXP za dzisiaj" : "EXP za zbiory"}
                      </span>
                      <span className="text-4xl font-black text-sky-200">
                        +{isDailyHarvestView ? (dailyHarvestData?.total_exp ?? 0) : totalExp}
                      </span>
                    </div>
                  )}

                  {/* Tutorial krok 12 */}
                  {tutorialStep === 12 && (
                    <div className="border-t border-[#d8ba7a]/30 bg-[rgba(14,8,4,0.85)] px-7 py-5 shrink-0">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#d8ba7a]">Etap 1 — Krok 12/13</p>
                      <p className="mb-4 text-[22px] text-[#f9e7b2] leading-snug">
                        Przy każdym zbiorze możesz sprawdzić swoje ostatnie zbiory. W grze dostępne są <span className="font-black text-[#d8ba7a]">4 rodzaje</span> zebranych upraw.
                      </p>
                      {/* 4 ikony jakości marchewki — poglądowo */}
                      <div className="mb-5 flex gap-5 items-start">
                        {([
                          { quality: "rotten",    sprite: "/uprawy/carrot_rotten.png",           label: "Popsuta",    expLabel: "+0",      chance: "~10%",   border: "#9ca3af" },
                          { quality: "good",      sprite: "/uprawy/carrot_icon_transparent.png", label: "Zwykła",     expLabel: "+6",      chance: "~87,5%", border: "#d1d5db" },
                          { quality: "epic",      sprite: "/uprawy/carrot_epic.png",             label: "Epicka",     expLabel: "+18–36",  chance: "~2%",    border: "#22c55e" },
                          { quality: "legendary", sprite: "/uprawy/carrot_legendary.png",        label: "Legendarna", expLabel: "+60–120", chance: "~0,5%",  border: "#f59e0b" },
                        ] as { quality: string; sprite: string; label: string; expLabel: string; chance: string; border: string }[]).map(q => (
                          <div key={q.quality}
                            className="flex flex-col items-center gap-1.5 cursor-help"
                            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setFvQualityTip({ label: q.label, expLabel: q.expLabel, chance: q.chance, sx: r.left + r.width / 2, sy: r.top }); }}
                            onMouseLeave={() => setFvQualityTip(null)}
                          >
                            <div className="w-[80px] h-[80px] rounded-xl border-2 flex items-center justify-center bg-[rgba(255,255,255,0.04)] overflow-hidden" style={{ borderColor: q.border }}>
                              <img src={q.sprite} alt={q.label} className="w-14 h-14 object-contain" style={{ imageRendering: "pixelated" }} />
                            </div>
                            <span className="text-[13px] font-bold text-[#dfcfab] whitespace-nowrap">{q.label}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        data-tutorial-target="tutorial-dalej-btn"
                        onClick={() => { void advanceTutorialStep(13); setHarvestLog([]); setIsFvHarvestModalOpen(false); }}
                        className="w-full rounded-xl border border-[#d8ba7a]/50 bg-[rgba(40,25,8,0.8)] px-4 py-2.5 text-[11px] font-black text-[#f9e7b2] transition hover:bg-[rgba(60,38,12,0.9)] ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]"
                      >Dalej</button>
                    </div>
                  )}
                </div>
                {fvHarvestTooltip && (() => {
                  const t = fvHarvestTooltip;
                  const _qd = CROP_QUALITY_DEFS[t.quality];
                  const _cx = BASE_W / 2 + (t.cx - window.innerWidth / 2) / gameScale;
                  const _cy = BASE_H / 2 + (t.cy - window.innerHeight / 2) / gameScale;
                  const _tw = 340;
                  const _left = Math.max(4, Math.min(Math.round(_cx - _tw / 2), BASE_W - _tw - 4));

                  const _cropDef2 = CROPS.find(c => c.id === t.cropId);
                  const _expR = _cropDef2?.expReward ?? 0;
                  const _yieldAmt = _cropDef2?.yieldAmount ?? 1;
                  const _isSmall = _yieldAmt <= 2;
                  const _dropStr = t.quality === "legendary"
                    ? (_isSmall ? "20–60 szt." : "40–120 szt.")
                    : t.quality === "epic"
                    ? (_isSmall ? "10–22 szt." : "20–44 szt.")
                    : (_isSmall ? "1–3 szt." : "2–6 szt.");
                  const _dropZrStr = t.quality === "legendary"
                    ? (_isSmall ? "40–120 szt." : "80–240 szt.")
                    : t.quality === "epic"
                    ? (_isSmall ? "20–44 szt." : "40–88 szt.")
                    : (_isSmall ? "2–6 szt." : "4–12 szt.");

                  const _expDisplay =
                    t.quality === "rotten"    ? "nie sadzi się"
                    : t.quality === "good"    ? `+${_expR} EXP`
                    : t.quality === "epic"    ? `+${_expR * 3}–${_expR * 6} EXP`
                    : /* legendary */           `+${_expR * 10}–${_expR * 20} EXP`;

                  const _wiedzaEff2  = effectiveStats.wiedza + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
                  const _wiedzaMult2 = Math.max(WIEDZA_MULT_MIN, 1 - calcStatEffect(_wiedzaEff2, WIEDZA_RATE) / 100);
                  const _hiveMult2   = Math.max(HIVE_MULT_MIN, 1 - hiveData.level * 0.02);
                  const _effMs       = _cropDef2
                    ? Math.round(_cropDef2.growthTimeMs * Math.max(GROWTH_GLOBAL_MIN_MULT, _wiedzaMult2 * _hiveMult2))
                    : 0;
                  const _effMin      = Math.round(_effMs / 60_000);
                  const _timeStr     = _effMin >= 60
                    ? `${Math.floor(_effMin / 60)}h${_effMin % 60 > 0 ? ` ${_effMin % 60}min` : ""}`
                    : `${_effMin} min`;
                  const _baseMin     = _cropDef2 ? Math.round(_cropDef2.growthTimeMs / 60_000) : 0;
                  const _baseTimeStr = _baseMin >= 60
                    ? `${Math.floor(_baseMin / 60)}h${_baseMin % 60 > 0 ? ` ${_baseMin % 60}min` : ""}`
                    : `${_baseMin} min`;

                  const _zrEff    = effectiveStats.zrecznosc + getEquipFlatBonus(" pkt Zrecznosci", charEquipped);
                  const _zrChance = calcStatEffect(_zrEff, 0.004);

                  return (
                    <div
                      className="pointer-events-none absolute z-[400] rounded-xl border border-[#8b6a3e] bg-[rgba(20,10,4,0.98)] p-3 shadow-2xl"
                      style={{ left: _left, top: Math.round(_cy) - 8, width: _tw, transform: "translateY(-100%)" }}
                    >
                      <p className="mb-0.5 text-[22px] font-black text-[#f9e7b2]">
                        {t.cropName} <span style={{ color: _qd.borderColor }}>{_qd.label.toLowerCase()}</span>
                      </p>
                      {t.quality === "rotten" ? (
                        <div className="mt-1.5 text-[18px]">
                          <p className="text-[#8b6a3e]">Tej uprawy nie można posadzić. Dobry jako kompost lub do zadań specjalnych.</p>
                        </div>
                      ) : (
                        <>
                          <div className="mt-1.5 flex flex-col gap-1 text-[18px]">
                            {_cropDef2 && (
                              <p className="text-[#8b6a3e]">
                                Czas bazowy:{" "}
                                <span className="font-bold text-[#dfcfab]">{_baseTimeStr}</span>
                              </p>
                            )}
                            <p className="text-[#8b6a3e]">
                              EXP po zbiorze:{" "}
                              <span className="font-bold text-sky-300">{_expDisplay}</span>
                            </p>
                            {_cropDef2 && (
                              <>
                                <p className="text-[#8b6a3e]">
                                  Drop po zbiorze:{" "}
                                  <span className="font-bold text-yellow-300">{_dropStr}</span>
                                </p>
                                <p className="text-[13px] text-[#8b6a3e]/70">każda sztuka losuje jakość osobno</p>
                              </>
                            )}
                          </div>
                          <div className="mt-2 border-t border-[#8b6a3e]/40 pt-1.5 flex flex-col gap-0.5 text-[17px]">
                            {_cropDef2 && (
                              <p className="text-[#8b6a3e]">
                                Jeśli Zręczność zadziała:{" "}
                                <span className="font-bold text-yellow-300">{_dropZrStr}</span>
                              </p>
                            )}
                            <p className="text-[#8b6a3e]">
                              Szansa Zręczności:{" "}
                              <span className="font-bold text-amber-300">{_zrChance.toFixed(1)}%</span>
                            </p>
                            <p className="mt-0.5 text-[15px] text-[#8b6a3e]">EXP zależy od zasadzonego nasiona, nie od jakości tej sztuki.</p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
}
