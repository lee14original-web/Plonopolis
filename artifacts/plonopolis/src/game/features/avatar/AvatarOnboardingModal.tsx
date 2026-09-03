import { useState } from "react";
import { SKINS_MALE, SKINS_FEMALE, EPIC_SKINS, EPIC_SKIN_START, AVATAR_META } from "../../constants/avatars";
import { getAvatarBonus } from "../../utils/avatar";
import { User, Users, Star, Info, Check, AlertCircle, Loader2 } from "lucide-react";

type SkinTab = "mezczyzni" | "kobiety" | "epickie";

interface AvatarOnboardingModalProps {
  avatarSkin: number | null;
  selectedSkin: number | null;
  onSelect: (index: number) => void;
  onConfirm: () => Promise<void>;
  isSaving: boolean;
  unlockedEpicAvatars: number[];
  error?: string | null;
}

const STAT_LABELS: Record<string, string> = {
  wiedza: "Wiedza",
  zrecznosc: "Zręczność",
  zaradnosc: "Zaradność",
  sadownik: "Sadownik",
  opieka: "Opieka",
  szczescie: "Szczęście",
};

export function AvatarOnboardingModal({
  avatarSkin,
  selectedSkin,
  onSelect,
  onConfirm,
  isSaving,
  unlockedEpicAvatars,
  error,
}: AvatarOnboardingModalProps) {
  const [activeTab, setActiveTab] = useState<SkinTab>(
    avatarSkin !== null && avatarSkin >= EPIC_SKIN_START
      ? "epickie"
      : avatarSkin !== null && avatarSkin >= 10
        ? "kobiety"
        : "mezczyzni",
  );
  const hasEpic = unlockedEpicAvatars && unlockedEpicAvatars.length > 0;

  // Selected avatar details
  const selectedMeta = selectedSkin !== null ? AVATAR_META[selectedSkin] : null;
  const selectedBonus = selectedSkin !== null ? getAvatarBonus(selectedSkin) : null;
  
  let selectedSrc = "";
  if (selectedSkin !== null) {
    if (selectedSkin < 10) selectedSrc = SKINS_MALE[selectedSkin];
    else if (selectedSkin < 20) selectedSrc = SKINS_FEMALE[selectedSkin - 10];
    else {
      const epicIdx = selectedSkin - EPIC_SKIN_START;
      if (EPIC_SKINS[epicIdx]) selectedSrc = EPIC_SKINS[epicIdx].path;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/90 p-2 backdrop-blur-md sm:p-4 md:p-8"
      data-testid="avatar-onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-onboarding-title"
    >
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-y-auto rounded-3xl border border-[#8b6a3e]/60 bg-gradient-to-br from-[#20140b] to-[#120a04] shadow-2xl shadow-black/80 md:max-h-[900px] md:flex-row md:overflow-hidden">
        
        {/* LEFT PANEL - PREVIEW & ACTIONS */}
        <div className="w-full md:w-[40%] lg:w-[35%] flex flex-col border-b md:border-b-0 md:border-r border-[#8b6a3e]/30 bg-black/20 p-6 lg:p-8 relative shrink-0">
          <div className="flex-1 flex flex-col">
            <h1 className="text-4xl font-black text-[#f9e7b2] tracking-wide mb-1 uppercase text-center md:text-left lg:text-5xl">
              Plonopolis
            </h1>
            <h2 id="avatar-onboarding-title" className="mb-6 text-center text-xl font-medium uppercase tracking-widest text-[#dfcfab]/70 md:text-left lg:text-2xl">
              Twój reprezentant
            </h2>

            {/* Selected Avatar Preview */}
            <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center md:min-h-[300px]">
              {selectedSkin !== null ? (
                <div className="group relative h-52 w-36 overflow-hidden rounded-2xl border-2 border-yellow-500/50 bg-black/40 shadow-[0_0_30px_rgba(234,179,8,0.15)] sm:h-72 sm:w-48 md:h-[21rem] md:w-56">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                  <img 
                    src={selectedSrc} 
                    alt={selectedMeta?.name || "Avatar"} 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    style={{ imageRendering: "pixelated" }} 
                  />
                  <div className="absolute bottom-0 inset-x-0 p-4 z-20 flex flex-col items-center">
                    <span className="text-lg font-bold text-[#f9e7b2] text-center drop-shadow-md">
                      {selectedMeta?.name}
                    </span>
                    <span className="text-xs font-semibold text-yellow-400/90 tracking-wider uppercase mb-2">
                      {selectedMeta?.style}
                    </span>
                    <div className="flex flex-wrap justify-center gap-1.5 w-full">
                      {selectedBonus && Object.entries(selectedBonus).map(([key, val]) => {
                        if (!val) return null;
                        return (
                          <div key={key} className="flex items-center gap-1 bg-black/60 rounded pl-1.5 pr-2 py-0.5 border border-white/10">
                            <span className="text-[10px] text-white/70">{STAT_LABELS[key] || key}:</span>
                            <span className="text-[11px] font-bold text-green-400">+{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-52 w-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#8b6a3e]/40 bg-black/20 p-4 text-center opacity-70 sm:h-72 sm:w-48 md:h-[21rem] md:w-56 md:p-6">
                  <User className="w-16 h-16 text-[#8b6a3e]/60 mb-4" />
                  <p className="text-xl font-medium text-[#dfcfab]/60">
                    Wybierz postać z listy po prawej, aby kontynuować
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-red-950/40 border border-red-900/50 p-4 text-red-200 text-xl">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Context Box */}
            <div className="mt-6 rounded-xl bg-[#8b6a3e]/10 border border-[#8b6a3e]/20 p-4 flex gap-3 text-xl">
              <Info className="w-5 h-5 text-[#dfcfab] shrink-0 mt-0.5" />
              <p className="text-lg leading-relaxed text-[#dfcfab]/80">
                Twój awatar oraz przyszła waluta premium są przypisane do całego konta. 
                Poziom, zarobki, plony i ekwipunek pozostają oddzielne dla każdego serwera.
              </p>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={onConfirm}
              disabled={selectedSkin === null || isSaving}
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-5 text-xl font-black uppercase tracking-widest transition-all duration-300 ${
                selectedSkin === null
                  ? "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                  : isSaving
                  ? "bg-yellow-600/50 text-yellow-200 cursor-wait border border-yellow-500/50"
                  : "bg-gradient-to-r from-yellow-600 to-yellow-500 text-yellow-950 hover:from-yellow-500 hover:to-yellow-400 hover:scale-[1.02] active:scale-[0.98] border border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Zapisywanie...
                </>
              ) : selectedSkin === null ? (
                "Wybierz postać"
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Graj jako {selectedMeta?.name?.split(" ")[0]}
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL - GRID */}
        <div className="w-full md:w-[60%] lg:w-[65%] flex flex-col bg-transparent overflow-hidden">
          
          {/* Tabs */}
          <div className={`${hasEpic ? "grid grid-cols-3" : "grid grid-cols-2"} shrink-0 gap-2 p-4 pb-4 sm:flex sm:p-6 sm:pb-4 md:p-8 md:pb-4`}>
            <button
              type="button"
              onClick={() => setActiveTab("mezczyzni")}
              className={`flex items-center justify-center gap-1 rounded-xl px-2 py-3 text-lg font-black uppercase tracking-[0.08em] transition-colors whitespace-nowrap sm:gap-2 sm:px-5 sm:text-xl sm:tracking-widest ${
                activeTab === "mezczyzni"
                  ? "bg-yellow-900/30 text-yellow-300 border border-yellow-500/50"
                  : "bg-black/30 text-[#8b6a3e] border border-[#8b6a3e]/30 hover:bg-black/50 hover:text-[#dfcfab]"
              }`}
            >
              <User className="w-4 h-4" /> Mężczyźni
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("kobiety")}
              className={`flex items-center justify-center gap-1 rounded-xl px-2 py-3 text-lg font-black uppercase tracking-[0.08em] transition-colors whitespace-nowrap sm:gap-2 sm:px-5 sm:text-xl sm:tracking-widest ${
                activeTab === "kobiety"
                  ? "bg-yellow-900/30 text-yellow-300 border border-yellow-500/50"
                  : "bg-black/30 text-[#8b6a3e] border border-[#8b6a3e]/30 hover:bg-black/50 hover:text-[#dfcfab]"
              }`}
            >
              <Users className="w-4 h-4" /> Kobiety
            </button>
            {hasEpic && (
              <button
                type="button"
                onClick={() => setActiveTab("epickie")}
                className={`flex items-center justify-center gap-1 rounded-xl px-2 py-3 text-lg font-black uppercase tracking-[0.08em] transition-colors whitespace-nowrap sm:gap-2 sm:px-5 sm:text-xl sm:tracking-widest ${
                  activeTab === "epickie"
                    ? "bg-green-900/30 text-green-300 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                    : "bg-black/30 text-green-700 border border-green-900/50 hover:bg-black/50 hover:text-green-500"
                }`}
              >
                <Star className="w-4 h-4" /> Epickie
              </button>
            )}
          </div>

          {/* Grid Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-2 fv-scroll">
            
            {activeTab === "mezczyzni" && (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                {SKINS_MALE.map((src, i) => (
                  <AvatarCard
                    key={i}
                    index={i}
                    src={src}
                    isSelected={selectedSkin === i}
                    onSelect={() => onSelect(i)}
                    disabled={isSaving}
                  />
                ))}
              </div>
            )}

            {activeTab === "kobiety" && (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                {SKINS_FEMALE.map((src, i) => {
                  const idx = i + 10;
                  return (
                    <AvatarCard
                      key={idx}
                      index={idx}
                      src={src}
                      isSelected={selectedSkin === idx}
                      onSelect={() => onSelect(idx)}
                      disabled={isSaving}
                    />
                  );
                })}
              </div>
            )}

            {activeTab === "epickie" && hasEpic && (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                {unlockedEpicAvatars.map((idx) => {
                  const epicIdx = idx - EPIC_SKIN_START;
                  const src = EPIC_SKINS[epicIdx]?.path;
                  if (!src) return null;
                  return (
                    <AvatarCard
                      key={idx}
                      index={idx}
                      src={src}
                      isSelected={selectedSkin === idx}
                      onSelect={() => onSelect(idx)}
                      isEpic
                      disabled={isSaving}
                    />
                  );
                })}
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}

function AvatarCard({ 
  index, 
  src, 
  isSelected, 
  onSelect,
  isEpic = false,
  disabled = false
}: { 
  index: number; 
  src: string; 
  isSelected: boolean; 
  onSelect: () => void;
  isEpic?: boolean;
  disabled?: boolean;
}) {
  const meta = AVATAR_META[index];
  
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`group relative flex aspect-[2/3] w-full flex-col overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
        isSelected
          ? isEpic 
            ? "border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)] scale-105 z-10" 
            : "border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)] scale-105 z-10"
          : "border-[#8b6a3e]/30 hover:border-[#dfcfab]/60 hover:scale-105 opacity-80 hover:opacity-100 bg-black/40"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <img 
        src={src} 
        alt={meta?.name || `Avatar ${index}`} 
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
        style={{ imageRendering: "pixelated" }} 
      />
      
      {isSelected && (
        <div className="absolute inset-0 border-2 border-white/20 rounded-xl pointer-events-none mix-blend-overlay" />
      )}
      
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6 text-center">
        <span className={`block text-lg font-bold leading-tight sm:text-xl ${isSelected ? "text-white" : "text-[#dfcfab]/80"}`}>
          {meta?.name}
        </span>
      </div>
    </button>
  );
}
