sm">
                <p className="mb-3 text-[12px] font-black uppercase tracking-[0.2em] text-[#d8ba7a]">🎒 Ostatnie zbiory ({harvestCountdown}s)</p>
                {/* Siatka ikon — plecaczek */}
                <div className="flex flex-wrap justify-center gap-3">
                  {items.map((g, i) => {
                    const _qd = CROP_QUALITY_DEFS[g.quality];
                    const _cropDef = CROPS.find(c => c.id === g.cropId);
                    const _sprite = g.quality === "epic" ? (_cropDef?.epicSpritePath ?? _cropDef?.spritePath)
                                  : g.quality === "rotten" ? (_cropDef?.rottenSpritePath ?? _cropDef?.spritePath)
                                  : g.quality === "legendary" ? (_cropDef?.legendarySpritePath ?? _cropDef?.spritePath)
                                  : _cropDef?.spritePath;
                    const _total = g.baseAmount + g.bonusAmount;
                    return (
                      <div key={i} className="group relative">
                        {/* Ikona przedmiotu */}
                        {(() => {
                          const _isExpOnly = g.quality === "legendary" && g.baseAmount === 0;
                          return (
                            <div className="relative h-[68px] w-[68px] cursor-default overflow-hidden rounded-xl border-2 transition-transform duration-150 group-hover:scale-110"
                              style={_isExpOnly
                                ? { borderColor: "#38bdf8", background: "rgba(14,60,100,0.6)" }
                                : g.quality === "legendary"
                                  ? { borderColor: _qd.borderColor, background: _qd.bgColor, animation: "legendaryPulse 2s ease-in-out infinite" }
                                  : { borderColor: _qd.borderColor, background: _qd.bgColor }}>
                              {_isExpOnly
                                ? <span className="flex h-full w-full flex-col items-center justify-center gap-0.5">
                                    <span className="text-[28px] leading-none">⭐</span>
                                    <span className="text-[11px] font-black text-sky-300 leading-none">XP</span>
                                  </span>
                                : _sprite
                                  ? <img src={_sprite} alt={g.cropName} className="h-full w-full object-contain p-1.5" />
                                  : <span className="flex h-full w-full items-center justify-center text-2xl">🌾</span>
                              }
                              {g.quality === "legendary" && !_isExpOnly && (
                                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                                  <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                </span>
                              )}
                              {/* Odznaka jakości — lewy górny róg */}
                              <span className="absolute left-0.5 top-0.5 text-[11px] leading-none drop-shadow">
                                {_isExpOnly ? "✨" : _qd.badge}
                              </span>
                              {/* Ilość — prawy dolny róg */}
                              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[11px] font-black text-white leading-tight">
                                {_total === 0 && g.bonusSource ? g.bonusSource : `×${_total}`}
                              </span>
                            </div>
                          );
                        })()}
                        {/* Tooltip przy hover */}
                        <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[200] hidden w-48 -translate-x-1/2 rounded-xl border border-[#8b6a3e] bg-[rgba(20,10,4,0.98)] p-3 text-xs shadow-2xl group-hover:block">
                          <p className="mb-1 font-black text-[#f9e7b2]">{g.cropName}</p>
                          <p className="mb-1" style={{ color: _qd.borderColor }}>{_qd.badge} {_qd.label}</p>
                          {g.baseAmount > 0 && (
                            <p className="text-[#dfcfab]">Zebrano: <span className="font-bold text-yellow-300">+{g.baseAmount} szt.</span></p>
                          )}
                          {g.bonusAmount > 0 && (
                            <p className="text-[#dfcfab]">Bonus <span className="text-amber-300">({g.bonusSource})</span>: <span className="font-bold text-yellow-300">+{g.bonusAmount} szt.</span></p>
                          )}
                          {g.quality === "legendary" && g.baseAmount === 0 && (
                            <p className="text-amber-300">🌟 Bonus EXP {g.bonusSource}</p>
                          )}
                          <p className="mt-1 border-t border-[#8b6a3e]/40 pt-1 text-sky-300">EXP: +{g.baseExp}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 border-t border-[#8b6a3e]/40 pt-2 text-[13px]">
                  <p className="text-[#d8ba7a]">Łącznie EXP: <span className="font-bold text-sky-300">+{totalExp}</span></p>
                </div>
                <button
                  onClick={() => setHarvestLog([])}
                  className="mt-2 w-full rounded-lg bg-[rgba(255,255,255,0.06)] py-1 text-[10px] text-[#8b6a3e] hover:text-[#d8ba7a]"
                >
                  Zamknij
                </button>
              </div>
            );
          })()}

          {message && (
            <div className="fixed bottom-4 left-4 z-50">
              <div
                className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-sm ${
                  message.type === "error"
                    ? "border-red-400/40 bg-red-950/80 text-red-100"
                    : message.type === "success"
                    ? "border-emerald-400/40 bg-emerald-950/80 text-emerald-100"
                    : "border-sky-400/40 bg-sky-950/80 text-sky-100"
                }`}
              >
                <p className="font-semibold">{message.title}</p>
                {message.text && <p className="mt-1 opacity-90">{message.text}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    {/* Tooltip konewki podążający za kursorem */}
      {hoveredWateringCan && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-cyan-500 bg-[rgba(28,16,8,0.97)] p-4 text-[17px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}
        >
          <p className="mb-1 font-black text-cyan-300">💧 Konewka</p>
          <p className="mb-2 text-[14px] text-[#8b6a3e]">Aktywuje bonus Zaradności — im wyższa statystyka, tym szybszy wzrost podlanej uprawy (0–45%)</p>
          <p>⏱ Skraca czas wzrostu o <span className="font-bold text-cyan-300">{((1 - Math.max(0.5, 1 - calcStatEffect(playerStats.zaradnosc, 0.006) / 100)) * 100).toFixed(1)}%</span> (twoja Zaradność: {playerStats.zaradnosc}/100)</p>
          <p className="mt-1">🚿 Roślinę można podlać <span className="font-bold text-yellow-300">max 1 raz</span></p>
        </div>
      )}
    {/* Tooltip uprawy podążający za kursorem */}
      {hoveredCrop && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-[#8b6a3e] bg-[rgba(28,16,8,0.97)] p-4 text-[17px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={{ left: mousePos.x + 18, top: Math.max(8, mousePos.y - 100) }}
        >
          <p className="mb-1 font-black text-[#f9e7b2]">
            {hoveredCrop.name}
            {hoveredSeedQuality === "legendary" && <span className="ml-1 text-[14px] font-black text-[#f59e0b]">🌟 Legendarna</span>}
            {hoveredSeedQuality === "epic" && <span className="ml-1 text-[14px] font-black text-[#22c55e]">⭐ Epicka</span>}
            {hoveredSeedQuality === "good" && <span className="ml-1 text-[14px] font-black text-emerald-300">✅ Zwykła</span>}
            {hoveredSeedQuality === "rotten" && <span className="ml-1 text-[14px] font-black text-white">⚠️ Popsuta</span>}
          </p>
          <p className="mb-1 text-[14px] text-[#8b6a3e]">
            {hoveredSeedQuality === "legendary" ? "Legendarne nasiono — po zbiorze losuje 1 z 3 nagród (każda po 33%)!" : hoveredSeedQuality === "epic" ? "Epickie nasiono — wyższy plon i EXP" : hoveredSeedQuality === "rotten" ? "Zepsute — nie można zasadzić, nadaje się jedynie jako kompost lub do zadań specjalnych." : "Zwykłe nasiono"}
          </p>
          {hoveredSeedQuality !== "rotten" && <>
            <p>⏱ {(()=>{ const m=Math.round(hoveredCrop.growthTimeMs/60_000); const h=Math.floor(m/60); const r=m%60; return h>0?(r>0?`${h}h ${r} min`:`${h}h`):`${m} min`; })()}</p>
            {hoveredSeedQuality === "legendary" ? (
              <div className="mt-1 space-y-0.5 rounded-lg bg-[rgba(245,158,11,0.08)] p-2 text-[13px]">
                <p className="font-black text-amber-300">🎲 Jedna z 3 równych szans:</p>
                <p>✅ 15–100 zwykłych nasion</p>
                <p>⭐ 5–15 epickich nasion</p>
                <p>🌟 EXP ×15–30 (bez plonu)</p>
              </div>
            ) : (
              <p className="mt-1">🌾 Zbiór: {hoveredSeedQuality === "epic" ? "3–10 szt." : `${hoveredCrop.yieldAmount} szt.`}</p>
            )}
            <p className="mt-1">⭐ EXP: +{hoveredSeedQuality === "legendary" ? `${hoveredCrop.expReward}–${hoveredCrop.expReward * 30}` : hoveredSeedQuality === "epic" ? `${hoveredCrop.expReward * 3}–${hoveredCrop.expReward * 6}` : hoveredCrop.expReward}</p>
          </>}
        </div>
      )}
      </main>
  );
}
