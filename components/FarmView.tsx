"use client";

import { useState } from "react";
import { FARM_HITBOXES } from "@/config/farmHitboxes";

export default function FarmView({ image }: { image: string }) {
  const [debug, setDebug] = useState(true);
  const [msg, setMsg] = useState("Kliknij obiekt");

  function handle(action: string) {
    setMsg(action);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      
      <button onClick={() => setDebug(!debug)}>
        DEBUG {debug ? "ON" : "OFF"}
      </button>

      <p>{msg}</p>

      <div style={{ position: "relative" }}>
        <img src={image} style={{ width: "100%" }} />

        {FARM_HITBOXES.map(box => (
          <div
            key={box.id}
            onClick={() => handle(box.label)}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              background: debug ? "rgba(255,0,0,0.2)" : "transparent",
              border: debug ? "2px solid red" : "none",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}
