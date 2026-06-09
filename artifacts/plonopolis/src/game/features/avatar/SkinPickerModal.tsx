import type React from "react";
import { SKINS_MALE, SKINS_FEMALE, EPIC_SKINS, EPIC_SKIN_START, AVATAR_META } from "../../constants/avatars";
import { getAvatarBonus, getAvatarChangeTier } from "../../utils/avatar";

type SkinTab = "mezczyzni" | "kobiety" | "wszystkie" | "epickie";

interface SkinPickerModalProps {
  onClose: () => void;
  avatarSkin: number;
  avatarChangeCount: number;
  lastAvatarChangeAt: number;
  displayMoney: number;
  skinTab: SkinTab;
  setSkinTab: (t: SkinTab) => void;
  unlockedEpicAvatars: number[];
  seedInventory: Record<string, number>;
  handleAvatarSelect: (idx: number) => Promise<void>;
  setHoveredNormalSkin: (v: number | null) => void;
  setHoveredEpicSkin: (v: number | null) => void;
  setEpicPurchaseTarget: (v: number | null) => void;
}

export function SkinPickerModal({
  onClose,
  avatarSkin,
  avatarChangeCount,
  lastAvatarChangeAt,
  displayMoney,
  skinTab,
  setSkinTab,
  unlockedEpicAvatars,
  seedInventory,
  handleAvatarSelect,
  setHoveredNormalSkin,
  setHoveredEpicSkin,
  setEpicPurchaseTarget,
}: SkinPickerModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[90vh] w-full max-w-[1100px] overflow-y-auto rounded-[28px] border border-[#8b6a3e] bg-[rgba(28,16,6,0.98)] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-[#8b6a3e] text-xl hover:text-red-400">✕</button>
        <h2 className="mb-3 text-center text-lg font-black text-[#f9e7b2]">Wybierz swoją postać</h2>
        {/* Koszt/cooldown zmiany avatara */}
        {(() => {
          const tier = getAvatarChangeTier(avatarChangeCount);
          const now = Date.now();
          const cooldownLeft = tier.cooldownMs > 0 && lastAvatarChangeAt > 0 ? Math.max(0, tier.cooldownMs - (now - lastAvatarChangeAt)) : 0;
          const cMins = Math.ceil(cooldownLeft / 60000);
          const cHrs = Math.floor(cMins / 60);
          const cMinRem = cMins % 60;
          const timeStr = cHrs > 0 ? `${cHrs}h ${cMinRem}min` : `${cMins}min`;
          const isFree = tier.cost === 0;
          const freeLeft = Math.max(0, 2 - avatarChangeCount);
          return (
            <div className={`mb-4 mx-auto max-w-md rounded-xl border px-4 py-2 text-center text-xs font-medium ${
              cooldownLeft > 0 ? "border-red-500/40 bg-red-950/20 text-red-300"
              : isFree ? "border-green-500/40 bg-green-950/15 text-green-300"
              : "border-yellow-500/40 bg-yellow-950/15 text-yellow-300"
            }`}>
              {cooldownLeft > 0
                ? `Cooldown — kolejna zmiana za ${timeStr}`
                : isFree
                  ? `Zmiana avatara bezplatna${freeLeft > 0 ? ` (${freeLeft} gratis pozostalo)` : ""}`
                  : `Zmiana avatara: ${tier.cost.toLocaleString("pl-PL")} zl — posiadasz: ${displayMoney.toLocaleString("pl-PL")} zl`
              }
            </div>
          );
        })()}
        {/* Zakładki */}
        <div className="mb-6 flex gap-2 justify-center flex-wrap">
          {(["wszystkie","mezczyzni","kobiety","epickie"] as const).map(tab => (
            <button key={tab} onClick={() => setSkinTab(tab)}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition border ${
                skinTab === tab
                  ? tab === "epickie" ? "border-green-400 bg-green-900/30 text-green-300" : "border-yellow-400 bg-yellow-900/20 text-yellow-200"
                  : "border-[#8b6a3e]/40 text-[#dfcfab] hover:bg-white/5"
              }`}>
              {tab === "mezczyzni" ? "👨 Mężczyźni" : tab === "kobiety" ? "👩 Kobiety" : tab === "wszystkie" ? "🌾 Wszystkie" : "⭐ Epickie"}
            </button>
          ))}
        </div>

        {/* Mężczyźni */}
        {(skinTab === "mezczyzni" || skinTab === "wszystkie") && (
          <>
            {skinTab === "wszystkie" && <p className="mb-3 text-center text-[10px] text-[#8b6a3e] font-bold uppercase tracking-widest">👨 Mężczyźni</p>}
            <div className={`${skinTab === "wszystkie" ? "mb-4" : ""} grid grid-cols-5 gap-2`}>
              {SKINS_MALE.map((src, i) => {
                const _b = getAvatarBonus(i);
                const _e = (Object.entries(_b) as [string,number][]).filter(([,v])=>v>0);
                const _sl: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zrecznosc",zaradnosc:"Zaradnosc",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczescie" };
                const _meta = AVATAR_META[i];
                void _e; void _sl; void _meta;
                return (
                  <button key={i} onClick={() => void handleAvatarSelect(i)}
                    onMouseEnter={() => setHoveredNormalSkin(i)}
                    onMouseLeave={() => setHoveredNormalSkin(null)}
                    className={`relative flex aspect-[2/3] w-full items-center justify-center rounded-2xl border-2 overflow-hidden transition ${avatarSkin === i ? "border-yellow-400 shadow-[0_0_16px_rgba(255,200,0,0.4)]" : "border-[#8b6a3e]/50 hover:border-[#8b6a3e]"}`}>
                    <img src={src} alt={`Postac ${i+1}`} className="absolute inset-0 w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Kobiety */}
        {(skinTab === "kobiety" || skinTab === "wszystkie") && (
          <>
            {skinTab === "wszystkie" && <p className="mb-3 text-center text-[10px] text-[#8b6a3e] font-bold uppercase tracking-widest">👩 Kobiety</p>}
            <div className="grid grid-cols-5 gap-2">
              {SKINS_FEMALE.map((src, i) => {
                const _idx = i + 10;
                const _b = getAvatarBonus(_idx);
                const _e = (Object.entries(_b) as [string,number][]).filter(([,v])=>v>0);
                const _sl: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zrecznosc",zaradnosc:"Zaradnosc",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczescie" };
                const _meta = AVATAR_META[_idx];
                void _e; void _sl; void _meta;
                return (
                  <button key={_idx} onClick={() => void handleAvatarSelect(_idx)}
                    onMouseEnter={() => setHoveredNormalSkin(_idx)}
                    onMouseLeave={() => setHoveredNormalSkin(null)}
                    className={`relative flex aspect-[2/3] w-full items-center justify-center rounded-2xl border-2 overflow-hidden transition ${avatarSkin === _idx ? "border-pink-400 shadow-[0_0_16px_rgba(255,100,200,0.4)]" : "border-[#8b6a3e]/50 hover:border-[#8b6a3e]"}`}>
                    <img src={src} alt={`Postac ${i+11}`} className="absolute inset-0 w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Epickie */}
        {(skinTab === "epickie" || skinTab === "wszystkie") && (
          <>
            {skinTab === "wszystkie" && <p className="mt-4 mb-3 text-center text-[10px] text-[#8b6a3e] font-bold uppercase tracking-widest">⭐ Epickie</p>}
            <p className="mb-4 text-center text-xs text-green-400/80">Kliknij zablokowany avatar, aby go odblokować za odpowiedni koszt z plecaka.</p>
            <div className="grid grid-cols-5 gap-3">
              {EPIC_SKINS.map((es, i) => {
                const idx = EPIC_SKIN_START + i;
                const isUnlocked = unlockedEpicAvatars.includes(idx);
                const isActive = avatarSkin === idx;
                const canAfford = Object.entries(es.cost).every(([k,v]) => (seedInventory[k] ?? 0) >= v);
                return (
                  <button key={idx}
                    onClick={() => {
                      if (isUnlocked) {
                        void handleAvatarSelect(idx);
                      } else {
                        setEpicPurchaseTarget(idx);
                      }
                    }}
                    onMouseEnter={() => setHoveredEpicSkin(idx)}
                    onMouseLeave={() => setHoveredEpicSkin(null)}
                    className={`relative flex flex-col items-center justify-end rounded-2xl border-2 overflow-hidden transition pb-2 ${
                      isActive ? "border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)] bg-green-900/20"
                      : isUnlocked ? "border-green-500/70 bg-green-950/20 hover:border-green-400"
                      : "border-[#8b6a3e]/40 bg-black/30 hover:border-green-600/50"
                    }`}
                    style={{ aspectRatio: "2/3" }}>
                    <img
                      src={es.path} alt={es.name}
                      className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                      style={{ imageRendering: "pixelated", filter: isUnlocked ? "none" : "grayscale(100%) brightness(0.45)" }}
                    />
                    {isUnlocked && !isActive && (
                      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{boxShadow:"inset 0 0 0 2px rgba(34,197,94,0.4)"}} />
                    )}
                    <div className="relative z-10 mt-auto w-full px-1">
                      {isActive && (
                        <div className="mb-1 rounded-lg bg-green-500/90 px-2 py-0.5 text-center text-[10px] font-black text-white">✓ Aktywny</div>
                      )}
                      {!isUnlocked && (
                        <div className={`mb-1 rounded-lg px-2 py-0.5 text-center text-[10px] font-black ${canAfford ? "bg-green-700/90 text-green-100" : "bg-black/80 text-[#8b6a3e]"}`}>
                          🔒 {canAfford ? "Możesz kupić!" : "Zablokowany"}
                        </div>
                      )}
                      <div className="rounded-lg bg-black/70 px-1 py-0.5 text-center text-[10px] font-bold text-[#f9e7b2]">{es.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
