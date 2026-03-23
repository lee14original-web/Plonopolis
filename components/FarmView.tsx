"use client";

import { useState } from "react";
import { FARM_HITBOXES } from "@/config/farmHitboxes";

type FarmViewProps = {
  image: string;
};

export default function FarmView({ image }: FarmViewProps) {
  const [debug, setDebug] = useState(true);

  const handleClick = (action: string) => {
    console.log("Klik:", action);
  };

  return (
    <div className="relative w-full">
      <img src={image} alt="Farma" className="block w-full h-auto" />

      {FARM_HITBOXES.map((box) => (
        <div
          key={box.id}
          onClick={() => handleClick(box.action)}
          style={{
            position: "absolute",
            left: `${box.left}%`,
            top: `${box.top}%`,
            width: `${box.width}%`,
            height: `${box.height}%`,
          }}
          className="cursor-pointer border-2 border-red-700 bg-red-500/20 transition hover:scale-[1.02] hover:bg-yellow-400/20"
        >
          {debug && (
            <span className="flex h-full w-full items-center justify-center text-center text-xl font-bold text-red-900">
              {box.label}
            </span>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => setDebug((v) => !v)}
        className="absolute left-4 top-4 z-50 rounded bg-black/70 px-3 py-2 text-sm text-white"
      >
        {debug ? "Ukryj debug" : "Pokaż debug"}
      </button>
    </div>
  );
}
