import { EPIC_SKINS, EPIC_SKIN_START } from "../../constants/avatars";
import { CROPS } from "../../constants/crops";
import { parseQualityKey } from "../../utils/crop";

interface EpicPurchaseModalProps {
  epicPurchaseTarget: number;
  onClose: () => void;
  seedInventory: Record<string, number>;
  onConfirm: (epicAvatarId: number) => Promise<void>;
}

export function EpicPurchaseModal({
  epicPurchaseTarget,
  onClose,
  seedInventory,
  onConfirm,
}: EpicPurchaseModalProps) {
  const es = EPIC_SKINS[epicPurchaseTarget - EPIC_SKIN_START];
  if (!es) return null;
  const canAfford = Object.entries(es.cost).every(([k,v]) => (seedInventory[k] ?? 0) >= v);
  const costLabel = (key: string, amt: number) => {
    const { baseCropId, quality } = parseQualityKey(key);
    const crop = CROPS.find(c => c.id === baseCropId);
    const qLabel = quality === "epic" ? " epickich" : quality === "legendary" ? " legendarnych" : " zwykłych";
    return `${amt}× ${crop?.name ?? key}${qLabel}`;
  };
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-[420px] rounded-[24px] border border-green-500/60 bg-[rgba(10,30,10,0.98)] p-7 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-[#8b6a3e] hover:text-red-400">✕</button>
        <div className="mb-4 flex justify-center">
          <div className="relative h-36 w-36 overflow-hidden rounded-2xl border-2 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
            <img src={es.path} alt={es.name} className="h-full w-full object-cover" style={{imageRendering:"pixelated"}} />
          </div>
        </div>
        <h3 className="mb-1 text-center text-lg font-black text-green-300">⭐ {es.name}</h3>
        <p className="mb-4 text-center text-xs text-[#8b6a3e]">Avatar epicki — odblokuj raz, używaj na zawsze</p>
        <div className="mb-5 rounded-2xl border border-green-800/50 bg-black/30 p-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-green-400">Koszt odblokowania:</p>
          {Object.entries(es.cost).map(([k,v]) => {
            const have = seedInventory[k] ?? 0;
            const ok = have >= v;
            return (
              <div key={k} className={`flex items-center justify-between text-sm font-bold ${ok ? "text-green-300" : "text-red-400"}`}>
                <span>{costLabel(k, v)}</span>
                <span className="text-xs opacity-70">({ok ? "✓" : `brak — masz ${have}`})</span>
              </div>
            );
          })}
        </div>
        <button
          disabled={!canAfford}
          onClick={() => void onConfirm(epicPurchaseTarget)}
          className={`w-full rounded-2xl py-3 font-black transition text-sm ${canAfford ? "border border-green-400 bg-green-700/40 text-green-200 hover:bg-green-700/60" : "cursor-not-allowed border border-[#8b6a3e]/30 bg-black/20 text-[#8b6a3e] opacity-50"}`}>
          {canAfford ? "✅ Odblokuj avatar" : "❌ Brak surowców"}
        </button>
      </div>
    </div>
  );
}
