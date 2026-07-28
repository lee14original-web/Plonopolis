---
name: Tutorial step 9 advance bug
description: Root cause and fix for tutorial step 9 not auto-advancing to step 10
---

## Root cause
`tutorialPlotIds` accumulates extra IDs across session (guide-compost plots, recovery fallback plots) — ending up with 5+ entries instead of 3. `isCropReady()` returns `false` for empty plots (no `cropId`), so `every()` always failed.

**Why:** tutorialPlotIds merges from localStorage cache + guide-compost scan + carrot fallback at different lifecycle points, without deduplication cap.

## Fix applied
In the step-9 useEffect (and polling interval), filter to only plots that actually have a crop before checking readiness:
```js
const _withCrop = tutorialPlotIds.filter(id => !!plotCrops[id]?.cropId);
if (_withCrop.length > 0 && _withCrop.every(id => isCropReady(id))) {
  void advanceTutorialStep(10);
}
```

## Also added
Step-8 auto-advance useEffect: if user was away while crops grew (crops Gotowe before clicking the watering can), the effect auto-advances to step 9 (all watered) or step 10 (all ready). Previously the advance ONLY happened on watering can button click — no automatic fallback.

**How to apply:** Any future tutorial readiness check using `tutorialPlotIds.every(isCropReady)` should first filter to `filter(id => !!plotCrops[id]?.cropId)`.
