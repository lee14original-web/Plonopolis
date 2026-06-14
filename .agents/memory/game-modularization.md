---
name: Game.tsx modularization
description: Stan modularyzacji Game.tsx (Plonopolis) — które etapy zakończone, co zostaje w pliku i dlaczego, konwencje
---

## Stan (czerwiec 2026)

### Zakończone etapy
- **Etap 1A**: typy/stałe/utils wydzielone do `game/{types,constants,utils,components}`
- **Etapy 2B-2D**: 5 modali, CustomersModal, MarketModal
- **Etap 2E**: SeedPicker, CompostPicker, HarvestSessionModal, TutorialPanel, TutorialArrows

### Game.tsx po Etapie 2E: ~11751 linii (było 12404 przed 2E)

### Co celowo zostaje w Game.tsx
- **FieldView main container** — fieldScrollDragRef, fieldViewScrollRef, sweep drag po polach; usunięcie wymagałoby przekazania 8+ refów
- **FieldToolbar** — drag pozycji paska (fvToolDragRef, rezising) + tutorialStep inline checks w onClick
- **FieldPlotTile** — per-tile onMouseDown/onMouseUp/onMouseEnter; drag/sweep event handlers ściśle związane z Game state
- **fvQualityTip display** (linie po HarvestSessionModal) — `fixed` tooltip musi być poza `overflow-hidden` kontenera; setter przekazany do HarvestSessionModal, display w Game.tsx
- **Tutorial dim overlay step 1** — 3 linie, renderowane wewnątrz FieldView diva

## Konwencje ekstrakcji

- Zero logic change, zero zmian tekstów/styli
- Handlery zostają w Game.tsx, przekazywane jako props
- Settery typowane jako `React.Dispatch<React.SetStateAction<T>>` gdy GameTSX przekazuje dokładny typ (nie `string | null`)
- `onTutorialComplete: () => Promise<void>` — supabase call + setProfile zamknięty w Game.tsx closure, przekazany jako handler
- Array.from(new Set()) zamiast [...new Set()] (Railway compat)
- push przez skrypt scripts/src/push-to-github.ts; `--images` pushuje pliki z NEW_IMAGE_FOLDERS rekurencyjnie (fix: collectDirFiles zamiast readdir)

## Następne etapy (planowane)
- Etap 2F: dalsze wydzielenie FieldView (FieldToolbar, może FieldView container)
- Etap 2G: dalsze wydzielenia
