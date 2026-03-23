"use client";

import { useState } from "react";
import FarmView from "@/components/FarmView";
import { getFarmStage } from "@/config/farmStages";

export default function Game() {
  const [lvl, setLvl] = useState(1);
  const stage = getFarmStage(lvl);

  return (
    <main style={{ padding: 20 }}>
      <h1>Plonopolis - Farma</h1>

      <div style={{ marginBottom: 20 }}>
        {[1, 5, 10, 15, 20].map((l) => (
          <button key={l} onClick={() => setLvl(l)}>
            LV {l}
          </button>
        ))}
      </div>

      <FarmView image={stage.image} />
    </main>
  );
}
