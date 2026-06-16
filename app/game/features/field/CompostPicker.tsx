"use client";

import type { SeedInventory } from "../../types/farm";
import { COMPOST_DEFS } from "../../constants/compost";
import { compostKeyFor } from "../../utils/compost";

interface CompostPickerProps {
  fvCompostPickerOpen: boolean;
  fvToolEditMode: boolean;
  setFvCompostPickerOpen: (v: boolean) => void;
  seedInventory: SeedInventory;
  selectedSeedId: string | null;
  setSelectedSeedId: (id: string | null) => void;
  setSelectedTool: React.Dispatch<React.SetStateAction<"watering_can" | "sickle" | null>>;
  advanceTutorialStep: (nextStep: number) => Promise<void>;
  tutorialStep: number;
}

export function CompostPicker({
  fvCompostPickerOpen,
  fvToolEditMode,
  setFvCompostPickerOpen,
  seedInventory,
  selectedSeedId,
  setSelectedSeedId,
  setSelectedTool,
  advanceTutorialStep,
  tutorialStep,
}: CompostPickerProps) {
  if (!fvCompostPickerOpen || fvToolEditMode) return null;
  return (
                    <div
                      className="fixed inset-0 z-[115] flex items-center justify-center"
                      onClick={() => setFvCompostPickerOpen(false)}
                    >
                      <div
                        className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,6,0.97)] p-5 w-[480px] max-w-[95vw] max-h-[80vh] overflow-y-auto shadow-2xl backdrop-blur-sm"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-[10px] uppercase tracking-[0.25em] text-[#d8ba7a] mb-1">Wybierz kompost</p>
                        <h3 className="text-xl font-black text-[#f9e7b2] mb-4">♻️ Kompost w plecaku</h3>
                        {(Object.keys(COMPOST_DEFS) as (keyof typeof COMPOST_DEFS)[]).map(cType => {
                          const def = COMPOST_DEFS[cType];
                          const entries = def.bonusValues.flatMap(val => {
                            const key = compostKeyFor(cType, val);
                            const cnt = seedInventory[key] ?? 0;
                            return cnt > 0 ? [{ key, val, cnt }] : [];
                          });
                          if (entries.length === 0) return null;
                          return (
                            <div key={cType} className="mb-4">
                              <p className="text-xs font-black mb-2 uppercase tracking-wider text-[#d8ba7a]">{def.name}</p>
                              <div className="flex flex-col gap-2">
                                {entries.map(({ key: cKey, val, cnt }) => {
                                  const isSel = selectedSeedId === cKey;
                                  const tierLabel = def.tierName(val);
                                  const bonusLabel = def.bonusLabel(val);
                                  return (
                                    <button
                                      key={cKey}
                                      type="button"
                                      data-tutorial-target={tutorialStep === 3 && cKey === "guide_compost" ? "guide-compost-item" : undefined}
                                      onClick={() => {
                                        setSelectedSeedId(isSel ? null : cKey);
                                        setSelectedTool(null);
                                        setFvCompostPickerOpen(false);
                                        if (tutorialStep === 3 && cKey === "guide_compost") void advanceTutorialStep(4);
                                      }}
                                      className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 transition-colors text-left${tutorialStep === 3 && cKey === "guide_compost" ? " ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]" : ""}`}
                                      style={{ borderColor: isSel ? "#86efac" : tutorialStep === 3 && cKey === "guide_compost" ? "#fbbf24" : "rgba(139,106,62,0.4)", backgroundColor: isSel ? "rgba(20,40,10,0.9)" : "rgba(20,12,6,0.7)" }}
                                    >
                                      <img src={def.imgs[val]} alt={def.name} className="w-8 h-8 object-contain shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[#f9e7b2] leading-tight">{cType === "guide" ? def.name : `${tierLabel} ${def.name}`}</p>
                                        <p className="text-[11px] text-[#d8ba7a]">{bonusLabel}</p>
                                      </div>
                                      <p className="text-sm font-black text-lime-300 shrink-0">×{cnt}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(COMPOST_DEFS).every(t => (COMPOST_DEFS[t as keyof typeof COMPOST_DEFS].bonusValues.every(v => (seedInventory[compostKeyFor(t as keyof typeof COMPOST_DEFS, v)] ?? 0) === 0))) && (
                          <p className="text-sm text-[#dfcfab] text-center py-6">Brak kompostu w plecaku</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setFvCompostPickerOpen(false)}
                          className="mt-3 w-full rounded-xl border border-[#8b6a3e]/60 bg-[rgba(38,24,14,0.7)] py-2 text-sm font-bold text-[#dfcfab] hover:bg-[rgba(58,34,18,0.9)] transition-colors"
                        >Zamknij</button>
                      </div>
                    </div>
  );
}
