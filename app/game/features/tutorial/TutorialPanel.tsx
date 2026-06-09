"use client";

import type { PlotCropState } from "../../types/farm";
import { TUT_PANEL_PRESET_POSITIONS } from "../../constants/unlock";

interface TutorialPanelProps {
  tutorialStep: number;
  tutorialPlotIds: number[];
  plotCrops: Record<number, PlotCropState>;
  isCropReady: (plotId: number) => boolean;
  tutorialPlantedIds: number[];
  tutorialWateredIds: number[];
  tutorialHarvestedIds: number[];
  tutorialPanelMinimized: boolean;
  setTutorialPanelMinimized: (v: boolean) => void;
  onTutorialComplete: () => Promise<void>;
}

export function TutorialPanel({
  tutorialStep,
  tutorialPlotIds,
  plotCrops,
  isCropReady,
  tutorialPlantedIds,
  tutorialWateredIds,
  tutorialHarvestedIds,
  tutorialPanelMinimized,
  setTutorialPanelMinimized,
  onTutorialComplete,
}: TutorialPanelProps) {
          // W step 4: licz faktyczne pola z guide kompostem (nie ufaj tylko tutorialPlotIds po refreshie)
          const _t4 = tutorialStep === 4
            ? Math.min(3, Object.values(plotCrops).filter(p => p.compostBonus?.type === "guide").length)
            : tutorialPlotIds.length;
          const _t7 = tutorialStep === 7 ? tutorialPlotIds.filter(id => !!plotCrops[id]?.cropId && plotCrops[id]?.compostBonus?.type === "guide").length : tutorialPlantedIds.length;
          const _t9 = tutorialWateredIds.length;
          const _t11 = tutorialHarvestedIds.length;
          const _texts: string[] = [
            "",
            "Kliknij Pola uprawne, aby rozpocząć pracę na swoim ranczu.",
            "Kliknij Kompost. Użyjemy go, żeby przyspieszyć pierwsze marchewki.",
            "Wybierz Kompost Przewodnika.",
            `Użyj Kompostu Przewodnika na 3 pustych polach. Dzięki temu pierwsze marchewki urosną dużo szybciej. Wzmocnione pola: ${_t4}/3`,
            "Teraz kliknij Nasiona.",
            "Wybierz zwykłą marchewkę.",
            `Posadź marchewki na 3 wzmocnionych polach. Posadzone: ${_t7}/3`,
            "Kliknij Konewkę.",
            (() => {
              const _canWaterAny = tutorialPlotIds.some(id => { const _p = plotCrops[id]; return _p?.cropId && !isCropReady(id) && !_p.watered; });
              if (_canWaterAny) return `Podlej swoje marchewki, jeśli jeszcze rosną. Podlane: ${_t9}/3`;
              // Wszystkie podlane — sprawdź czy faktycznie gotowe (nie wystarczy watered=true)
              const _allReady = tutorialPlotIds.length > 0 && tutorialPlotIds.every(id => isCropReady(id));
              return _allReady
                ? "Marchewki gotowe! Za chwilę przejdziemy do zbioru."
                : "Marchewki podlane. Poczekaj chwilę — gdy będą gotowe, przewodnik sam przejdzie dalej.";
            })(),
            "Kliknij Zbierz.",
            `Zbierz gotowe marchewki — zebrałeś ${_t11}/3.`,
            "Sprawdź panel Ostatnie zbiory po lewej stronie — przeczytaj opis jakości, a potem kliknij Dalej.",
            "Świetnie! Etap 1 przewodnika ukończony.\n\nPRZEWODNIK W BUDOWIE — na razie tyle. Możesz zminimalizować to okno.",
          ];

          if (tutorialStep === 13 && tutorialPanelMinimized) {
            return (
              <div className="fixed bottom-5 left-1/2 z-[87] -translate-x-1/2 pointer-events-none">
                <button
                  type="button"
                  onClick={() => setTutorialPanelMinimized(false)}
                  className="pointer-events-auto rounded-2xl border-2 border-[#d8ba7a]/60 bg-[rgba(14,8,4,0.96)] px-5 py-2 text-sm font-black text-[#d8ba7a] shadow-2xl backdrop-blur-sm hover:bg-[rgba(30,16,4,0.98)] transition"
                >
                  Etap 1 ukończony — Przewodnik w budowie
                </button>
              </div>
            );
          }

          return (() => {
            const _tutPos = TUT_PANEL_PRESET_POSITIONS[tutorialStep];
            return (
              <div
                className={`fixed z-[87] w-full max-w-[700px] px-4 pointer-events-none${_tutPos ? "" : " bottom-5 left-1/2 -translate-x-1/2"}`}
                style={_tutPos ? { left: _tutPos.x, top: _tutPos.y } : undefined}
              >
                <div className="rounded-2xl border-2 border-[#d8ba7a]/60 bg-[rgba(14,8,4,0.96)] shadow-2xl backdrop-blur-sm pointer-events-auto relative overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm uppercase tracking-widest text-[#d8ba7a] font-black">Etap 1 przewodnika</p>
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-[#8b6a3e]">Krok {tutorialStep}/13</p>
                        {tutorialStep === 13 && (
                          <button
                            type="button"
                            onClick={() => setTutorialPanelMinimized(true)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#8b6a3e]/60 bg-[rgba(255,255,255,0.04)] text-[#8b6a3e] hover:text-[#d8ba7a] hover:border-[#d8ba7a]/60 transition text-base font-black leading-none"
                            title="Minimalizuj"
                          >
                            −
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mb-4 h-2 rounded-full bg-[#3a2510]/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#d8ba7a] transition-all duration-500"
                        style={{ width: `${(tutorialStep / 13) * 100}%` }}
                      />
                    </div>
                    <p className="text-xl font-bold text-[#f9e7b2] leading-snug whitespace-pre-line">
                      {_texts[tutorialStep]}
                    </p>
                    {tutorialStep === 13 && (
                      <button
                        type="button"
                        className="mt-4 w-full rounded-xl border border-[#d8ba7a]/50 bg-[rgba(40,25,8,0.8)] px-4 py-2.5 text-sm font-black text-[#f9e7b2] transition hover:bg-[rgba(60,38,12,0.9)] ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]"
                        onClick={onTutorialComplete}
                      >Dalej</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })();
}
