---
name: Tutorial step advance race condition
description: applyProfileState resets tutorialStep from stale DB data, cancelling just-advanced local state
---

# Tutorial step advance race condition

## The rule
`applyProfileState` must NEVER downgrade `tutorialStep`. Use `setTutorialStep(prev => Math.max(prev, loaded))`.

**Why:** `advanceTutorialStep` calls `setTutorialStep(next)` optimistically, then awaits the DB write. Any RPC response that arrives before the write completes carries the old `tutorial_step` from the DB. The old `applyProfileState` code did `setTutorialStep(loaded)` unconditionally, silently resetting the just-advanced local state back to the previous step. The user would see the tutorial stuck, then it would advance again on the next interaction — creating an endless loop at the transition.

**How to apply:** The fix is in `artifacts/plonopolis/src/Game.tsx` inside `applyProfileState`. For account switches (different `source.id`), a `setTutorialStep(0)` reset fires first in the same batch, so `Math.max(0, loaded) = loaded` correctly initialises the new user's step.

## Related: tutorialPlotIds empty at step 9
`tutorialPlotIds` is transient React state — it doesn't survive page refresh. If the user refreshes at step 9, the detection useEffect returns early because `tutorialPlotIds.length === 0`.

Fix layers (both present in code):
1. **Load-time recovery** in `applyProfileState`: if `_finalTutorialIds` is empty and step is 8–11, find plots with `cropId === "carrot"` as fallback.
2. **Runtime recovery useEffect**: same logic, fires when `tutorialPlotIds.length === 0` and step is 8–11 during a live session.
