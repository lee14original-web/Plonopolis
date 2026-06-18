---
name: Inventory structure
description: seed_inventory vs barn_items — co gdzie trafia i skąd czyta UI
---

## Zasada

- **`seed_inventory`** (JSONB w profiles) — plecak gracza z uprawami; klucze np. `cabbage_legendary`, `carrot_good`. Zakładka 🌾 Uprawy w plecaku czyta stąd.
- **`barn_items`** (JSONB w profiles) — stodoła: produkty zwierzęce (`jajko`, `mleko`, `piora`, `futro_krolika`) + surowce rzemieślnicze. UI "Przedmioty" czyta stąd.
- **`fruit_inventory`** (JSONB w profiles) — owoce z sadu. Zakładka 🍎 Owoce czyta stąd.

## Przy dawaniu nagród SQL admina

Legendarne/epickie uprawy → `seed_inventory`:
```sql
UPDATE profiles
SET seed_inventory = jsonb_set(
  COALESCE(seed_inventory, '{}'),
  '{cabbage_legendary}',
  to_jsonb(COALESCE((seed_inventory->>'cabbage_legendary')::int, 0) + 3)
)
WHERE id = '<UUID>';
```

**Why:** Przekonali się boleśnie — UPDATE na barn_items nie pokazuje upraw w plecaku gracza.
