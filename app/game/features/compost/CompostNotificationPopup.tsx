import React from "react";
import { COMPOST_DEFS } from "../../constants/compost";
import type { CompostType } from "../../types/crop";

interface Props {
  notice: { type: string; value: number; plotId: number };
}

export function CompostNotificationPopup({ notice }: Props) {
  const _cnDef = COMPOST_DEFS[notice.type as CompostType];
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[400] animate-fade-in">
      <div className="rounded-2xl border border-emerald-500/60 bg-[rgba(10,30,15,0.97)] px-5 py-3 shadow-2xl shadow-emerald-500/30 flex items-center gap-3">
        <span className="text-3xl">{_cnDef.icon}</span>
        <div>
          <p className="text-sm font-black text-emerald-200">Kompost aktywowany!</p>
          <p className="text-xs text-emerald-300/90">
            {_cnDef.name} · Bonus: {_cnDef.bonusLabel(notice.value)} · Pole #{notice.plotId}
          </p>
        </div>
      </div>
    </div>
  );
}
