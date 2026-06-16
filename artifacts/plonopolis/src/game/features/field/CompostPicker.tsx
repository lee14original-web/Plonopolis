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

  const allEntries = (Object.keys(COMPOST_DEFS) as (keyof typeof COMPOST_DEFS)[]).flatMap(cType => {
    const def = COMPOST_DEFS[cType];
    return def.bonusValues.flatMap(val => {
      const key = compostKeyFor(cType, val);
      const cnt = seedInventory[key] ?? 0;
      return cnt > 0 ? [{ key, val, cnt, def, cType }] : [];
    });
  });

  const isEmpty = allEntries.length === 0;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center"
      onClick={() => setFvCompostPickerOpen(false)}
    >
      <div
        className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,6,0.97)] p-5 w-[560px] max-w-[95vw] max-h-[80vh] overflow-y-auto shadow-2xl backdrop-blur-sm"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#d8ba7a] mb-1">Wybierz kompost</p>
        <h3 className="text-xl font-black text-[#f9e7b2] mb-4">♻️ Kompost w plecaku</h3>

        {isEmpty ? (
          <p className="text-sm text-[#dfcfab] text-center py-6">Brak kompostu w plecaku</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 mb-3">
            {allEntries.map(({ key: cKey, val, cnt, def, cType }) => {
              const isSel = selectedSeedId === cKey;
              const tierLabel = def.tierName(val);
              const isTutTarget = tutorialStep === 3 && cKey === "guide_compost";
              return (
                <div
                  key={cKey}
                  className={`flex flex-col items-center gap-1${isTutTarget ? " outline outline-2 outline-amber-400 rounded-xl shadow-[0_0_16px_rgba(251,191,36,0.5)]" : ""}`}
                  data-tutorial-target={isTutTarget ? "guide-compost-item" : undefined}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSeedId(isSel ? null : cKey);
                      setSelectedTool(null);
                      setFvCompostPickerOpen(false);
                      if (isTutTarget) void advanceTutorialStep(4);
                    }}
                    className="relative w-[112px] h-[112px] rounded-xl border-2 overflow-hidden transition-colors"
                    style={{
                      borderColor: isSel ? "#86efac" : isTutTarget ? "#fbbf24" : "rgba(139,106,62,0.4)",
                      backgroundColor: isSel ? "rgba(20,40,10,0.9)" : "rgba(20,12,6,0.7)",
                      ...(isSel ? { boxShadow: "0 0 14px #86efac88" } : {}),
                    }}
                  >
                    <img src={def.imgs[val]} alt={def.name} className="absolute inset-0 w-full h-full object-contain" />
                    <span className="absolute bottom-1 right-1 min-w-[20px] rounded-md bg-black/80 px-1 py-0.5 text-[11px] font-black leading-none text-[#f9e7b2]">×{cnt}</span>
                  </button>
                  <p className="text-[10px] font-bold text-[#f9e7b2] text-center leading-tight px-1">
                    {cType === "guide" ? def.name : `${tierLabel}`}
                  </p>
                  <p className="text-[9px] text-[#d8ba7a] text-center leading-tight px-1">{def.bonusLabel(val)}</p>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setFvCompostPickerOpen(false)}
          className="mt-1 w-full rounded-xl border border-[#8b6a3e]/60 bg-[rgba(38,24,14,0.7)] py-2 text-sm font-bold text-[#dfcfab] hover:bg-[rgba(58,34,18,0.9)] transition-colors"
        >Zamknij</button>
      </div>
    </div>
  );
}
