---
name: Barn animal progression rebalance
description: Nowa logiczna kolejność zwierząt w Stodole, zmiany SQL Lady klientów, TIER_MATERIAL w ekwipunku.
---

# Nowa kolejność zwierząt (post-rebalance)

kura(3) → kaczka(5) → krolik(7) → swinia(9) → krowa(11) → owca(13) → koza(15) → indyk(17) → kon(20) → byk(25)

Kluczowa zmiana: Świnia przesunięta z lvl 13 na lvl 9 (przed Krową), Krowa z 7 na 11.

# TIER_MATERIAL (equipment.ts) — nowa kolejność

{1:jajko, 2:piora, 3:futro_krolika, 4:nawoz_naturalny, 5:mleko, 6:welna, 7:mleko_kozie, 8:duze_piora, 9:energia_robocza, 10:rogi_byka}

**Why:** Tier materiału do upgradu ekwipunku musi odpowiadać unlock_lvl zwierzęcia, nie staremu porządkowi.

# SQL pliki (kolejność wgrywania do Supabase)

1. `sql_fix_npc_category_filter_v1.sql` — filtr kategorii + _npc_pick_item(INT, TEXT) + spawn_customer_order
2. `sql_fix_animal_progression_v1.sql` — _npc_animal_data() + _npc_animal_unlock_cap() + _npc_animal_qty_cap()

# _npc_animal_unlock_cap po rebalansie

- small_market = 3 (tylko jajko)
- village_shop = 7 (jajko + pióra + futro_krolika) — ZMIANA z 5
- restaurant = 15
- wholesaler = 20
- market_chain/distribution/international = 25

# Rozbieżności sellPrice (UI) vs base_price (SQL)

Przed rebalansem sellPrice i base_price były rozbieżne dla ostatnich 4 zwierząt.
Po rebalansie ANIMAL_ITEMS.sellPrice wyrównane z SQL base_price dla wszystkich 10 produktów.

# Karmy zwierząt — znane problemy (NIE naprawiane w tym etapie)

- Kaczka (lvl 5): feed[1]=słonecznik (unlock=23) — nie pasuje do lvl
- Krowa (lvl 11): feed[1]=rzepak (unlock=22) — nie pasuje do lvl
- Koń (lvl 20): feed[1]=rzepak + szparagi (unlock=25) — OK dla lvl 20/25
- Koza, Byk: szparagi (unlock=25) — OK dla lvl 15+/25
Naprawiane w osobnym etapie.
