---
name: Plonopolis harvest session EXP tracking
description: Why client-tracked session EXP totals can drift from server-computed daily totals, and how session boundaries are defined.
---

The "Sesja zbiorów" modal has two tabs with independent EXP sources:
- "Bieżąca sesja" — summed client-side in React state (`harvestLog`) from each harvest RPC's returned `exp_gained`.
- "Zbiory dzisiaj" — recomputed server-side by the `get_today_harvest_summary` RPC via `SUM(exp_gained)` over `harvest_history` for the day.

These can show different totals even with identical item lists, because the client counter is only an in-memory running total and can silently drift (e.g. across reloads, timing edge cases) while the DB-derived daily total is authoritative.

**Decision:** per user request, "Bieżąca sesja" scope was changed to persist across opening/closing the field view, and only reset when the player clicks "Do miasta" (`handleChangeMap("city")`), refreshes the page, or logs out. Implemented via a dedicated `harvestSessionStartRef` (separate from `fieldViewOpenedAtRef`, which still tracks field-view-open time for other purposes).

**Why:** the user wanted the session counter to represent "one farming outing" (until you leave for town) rather than resetting every time you close/reopen the field view.

**How to apply:** if the two EXP numbers are reported as mismatched again, the fix is not a bug in either counter — it's expected due to independent computation. Only "Zbiory dzisiaj" is guaranteed accurate since it comes straight from `harvest_history`.
