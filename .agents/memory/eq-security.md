---
name: Equipment security architecture
description: How eq items are granted, migrated, and protected from client-side manipulation
---

# Equipment security — Plonopolis

## The rule
Client NEVER writes directly to `owned_eq_items` or `extra_eq_items` in DB. Only `game_grant_eq_items` RPC (SECURITY DEFINER) may do so.

**Why:** Before this, client wrote directly to DB via anon key. A player could manipulate localStorage → DB and invent items.

**How to apply:** Any new place that grants equipment must call `grantEqItemsServer(itemIds[])` helper (defined in Game.tsx), never `supabase.from("profiles").update({ owned_eq_items: ... })`.

## Columns added to profiles
- `char_equipped` jsonb — currently equipped items per slot
- `owned_eq_items` jsonb default `'{}'` — all owned items (server-authoritative)
- `extra_eq_items` jsonb default `'[]'` — duplicate copies of owned items
- `item_upg_registry` jsonb default `'{}'` — upgrade levels per item id

Defaults set to non-null (`{}` / `[]`) so new accounts never trigger the localStorage migration.

## Migration (one-time, completed)
Old accounts stored items only in localStorage. On first login after deploy, `applyProfileState` detects null in DB and runs migration via RPC (not direct update — direct update may be silently blocked by RLS). Migration logs to console: `[Plonopolis] Migracja ... OK`.

Migration will not re-run once DB columns are non-null. Safe to leave in code indefinitely.

## RPC: game_grant_eq_items(p_item_ids text[])
- If item already in `owned_eq_items` → appends to `extra_eq_items` (duplicate copy)
- Else → adds to `owned_eq_items`
- Returns updated `{owned_eq_items, extra_eq_items}`
- Client updates state + localStorage from response
