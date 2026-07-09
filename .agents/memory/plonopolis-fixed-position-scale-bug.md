---
name: Plonopolis fixed-position + CSS transform scaling bug
description: Why position:fixed overlays (tutorial arrows) misaligned inside the scaled game canvas, and the portal-based fix pattern.
---

The main game view in `artifacts/plonopolis/src/Game.tsx` wraps the whole board in a `<main>` with `transform: scale(gameScale)` (gameScale = min(innerWidth/BASE_W, innerHeight/BASE_H)) to letterbox-fit the fixed-size game canvas to any window size.

Per the CSS spec, any ancestor with a `transform` other than `none` becomes the containing block for `position: fixed` descendants. So any `fixed`-positioned overlay rendered *inside* that `<main>` (even though JSX-nested deep inside modals) gets its `left`/`top` interpreted relative to the transformed container's pre-scale box, then that box is itself scaled again — i.e. real screen-pixel coordinates (e.g. from `getBoundingClientRect`) get double-scaled and drift further from the target the more `gameScale` deviates from 1.

**Why:** This caused the tutorial-arrow overlay (`TutorialArrows.tsx`) to only appear correctly positioned when `gameScale` happened to be ~1, and drift for other window sizes — took multiple attempts (hardcoded per-step offsets, then dynamic rect calc) before finding the real cause.

**How to apply:** Any new `position: fixed` overlay that must align with real DOM elements measured via `getBoundingClientRect` (tooltips, spotlight/arrow overlays, etc.) must be rendered via `createPortal(..., document.body)` so it sits outside the scaled `<main>` and its fixed coordinates map 1:1 to real viewport pixels. Guard with `typeof document === "undefined"` for SSR safety.
