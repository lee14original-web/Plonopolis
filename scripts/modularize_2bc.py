#!/usr/bin/env python3
"""Modularyzacja Game.tsx - Etap 2B/2C: wydzielanie 5 modali do game/features/"""
import sys

PATH = "artifacts/plonopolis/src/Game.tsx"

with open(PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total = len(lines)
print(f"Total lines before: {total}")

def check(lineno: int, substr: str):
    content = lines[lineno - 1]
    if substr not in content:
        print(f"FAIL line {lineno}: expected {substr!r}, got {content.rstrip()!r}")
        sys.exit(1)
    else:
        print(f"OK   line {lineno}: {content.rstrip()[:80]}")

check(62,    "EpicPurchaseModal")
check(633,   "shopTab")
check(762,   "selectedAnimal")
check(4027,  "}")
check(7751,  "showShopModal")
check(9791,  "compostNotice")
check(9808,  "showUlModal")
check(11019, "showStodolaModal")
check(11373, "showSadModal")
print("All assertions passed!\n")

# ─── Zamiany od DOŁU do GÓRY (zachowuje indeksy) ───────────────────────────────

# 1. OrchardModal: linie 11373-11621
ORCHARD_USAGE = (
    "          {showSadModal && (\n"
    "            <OrchardModal\n"
    "              displayLevel={displayLevel}\n"
    "              orchardState={orchardState}\n"
    "              orchardError={orchardError}\n"
    "              fruitInventory={fruitInventory}\n"
    "              charEquipped={charEquipped}\n"
    "              playerStats={playerStats}\n"
    "              barnNow={barnNow}\n"
    "              onClose={() => setShowSadModal(false)}\n"
    "              onHarvestTree={handleOrchardHarvestTree}\n"
    "              onHarvestAll={handleOrchardHarvestAll}\n"
    "            />\n"
    "          )}\n"
)
lines[11373-1:11621] = [ORCHARD_USAGE]
print(f"OrchardModal replaced. Lines now: {len(lines)}")

# 2. BarnModal: linie 11019-11371
BARN_USAGE = (
    "          {showStodolaModal && (\n"
    "            <BarnModal\n"
    "              displayLevel={displayLevel}\n"
    "              displayMoney={displayMoney}\n"
    "              barnState={barnState}\n"
    "              seedInventory={seedInventory}\n"
    "              effectiveStats={effectiveStats}\n"
    "              barnNow={barnNow}\n"
    "              onClose={() => setShowStodolaModal(false)}\n"
    "              onBuySlot={handleBarnBuySlot}\n"
    "              onFeed={handleBarnFeed}\n"
    "              onCollect={handleBarnCollect}\n"
    "              onCollectAll={handleBarnCollectAll}\n"
    "            />\n"
    "          )}\n"
)
lines[11019-1:11371] = [BARN_USAGE]
print(f"BarnModal replaced. Lines now: {len(lines)}")

# 3. HiveModal: linie 9808-10058
HIVE_USAGE = (
    "          {showUlModal && (\n"
    "            <HiveModal\n"
    "              hiveData={hiveData}\n"
    "              hiveNow={hiveNow}\n"
    "              displayMoney={displayMoney}\n"
    "              onClose={() => setShowUlModal(false)}\n"
    "              onBuyHive={handleBuyHive}\n"
    "              onAddBees={handleAddBees}\n"
    "              onCollect={handleCollectHoney}\n"
    "            />\n"
    "          )}\n"
)
lines[9808-1:10058] = [HIVE_USAGE]
print(f"HiveModal replaced. Lines now: {len(lines)}")

# 4. CompostNotificationPopup: linie 9791-9806
COMPOST_USAGE = (
    "          {compostNotice && <CompostNotificationPopup notice={compostNotice} />}\n"
)
lines[9791-1:9806] = [COMPOST_USAGE]
print(f"CompostNotif replaced. Lines now: {len(lines)}")

# 5. ShopModal: linie 7751-8109
SHOP_USAGE = (
    "          {showShopModal && (\n"
    "            <ShopModal\n"
    "              profileId={profile?.id}\n"
    "              displayMoney={displayMoney}\n"
    "              displayLevel={displayLevel}\n"
    "              dailyPromos={dailyPromos}\n"
    "              promoCountdown={promoCountdown}\n"
    "              seedInventory={seedInventory}\n"
    "              cropPrices={CROP_PRICES}\n"
    "              barnState={barnState}\n"
    "              orchardState={orchardState}\n"
    "              orchardError={orchardError}\n"
    "              shopCart={shopCart}\n"
    "              shopError={shopError}\n"
    "              setShopCart={setShopCart}\n"
    '              onClose={() => { setShowShopModal(false); setShopError(""); }}\n'
    "              onBuyAnimal={handleShopBuyAnimal}\n"
    "              onBuyTree={handleShopBuyTree}\n"
    "              onBuyHiveItem={handleShopBuyHiveItem}\n"
    "              onBuySeeds={handleShopBuySeeds}\n"
    "            />\n"
    "          )}\n"
)
lines[7751-1:8109] = [SHOP_USAGE]
print(f"ShopModal replaced. Lines now: {len(lines)}")

# 6. Handlery po linii 4027 (handleBuyEpicAvatar closing brace)
HANDLERS = r"""
  async function handleBuyHive() {
    if (!profile?.id) return;
    const playerMoney = profile?.money ?? 0;
    if (playerMoney < HIVE_BUY_COST) {
      setMessage({ type:"error", title:"Brak pieniędzy", text:`Potrzebujesz ${HIVE_BUY_COST} zł żeby kupić ul.` });
      return;
    }
    const { data, error } = await supabase.rpc("buy_hive", { p_user_id: profile.id });
    if (error || !data?.ok) {
      setMessage({ type:"error", title:"Nie udało się kupić ula", text: data?.error || error?.message || "Spróbuj ponownie." });
      await loadProfile(profile.id);
      return;
    }
    setHiveData(data.hive_data as HiveData);
    await loadProfile(profile.id);
    setMessage({ type:"success", title:"🍯 Ul kupiony!", text:`Kup minimum ${HIVE_MIN_BEES_TO_PRODUCE} pszczół żeby ul ruszył z produkcją miodu.` });
  }
  async function handleAddBees(n: number) {
    if (!profile?.id) return;
    const hlvl = hiveData.level;
    const beesNeeded = HIVE_UPGRADE_BEES[hlvl] ?? 50;
    const beesProgress = Math.min(hiveData.bees_progress, beesNeeded);
    const add = Math.min(n, beesNeeded - beesProgress);
    if (add <= 0) return;
    const cost = add * BEE_COST;
    const playerMoney = profile?.money ?? 0;
    if (playerMoney < cost) {
      setMessage({ type:"error", title:"Brak pieniędzy", text:`Potrzebujesz ${cost} zł na ${add} ${add === 1 ? "pszczołę" : add < 5 ? "pszczoły" : "pszczół"}.` });
      return;
    }
    const { data, error } = await supabase.rpc("add_hive_bees", { p_user_id: profile.id, p_amount: add });
    if (error || !data?.ok) {
      setMessage({ type:"error", title:"Nie udało się kupić pszczół", text: data?.error || error?.message || "Spróbuj ponownie." });
      await loadProfile(profile.id);
      return;
    }
    setHiveData(data.hive_data as HiveData);
    await loadProfile(profile.id);
    const _attempted = data.bees_attempted ?? add;
    const _accepted  = data.bees_accepted  ?? _attempted;
    const _rejected  = data.bees_rejected  ?? 0;
    const _lostMoney = _rejected * BEE_COST;
    if (_rejected === 0) {
      if (_accepted === 1) {
        setMessage({ type:"success", title:`🐝 Pszczoła przyjęta!`, text:`Powodzenie — wleciała prosto do ula.` });
      } else {
        setMessage({ type:"success", title:`🐝 Wszystkie ${_accepted} ${_accepted < 5 ? "pszczoły przyjęte" : "pszczół przyjęte"}!`, text:`Świetna robota — żadna nie zginęła.` });
      }
    } else if (_accepted === 0) {
      if (_rejected === 1) {
        setMessage({ type:"error", title:`💀 Pszczoła nie przyjęła się, zginęła!`, text:`Straciłeś ${_lostMoney} zł. Pech! (szansa przyjęcia: ${data.chance_pct}%)` });
      } else {
        setMessage({ type:"error", title:`💀 Wszystkie ${_rejected} ${_rejected < 5 ? "pszczoły zginęły" : "pszczół zginęło"}!`, text:`Straciłeś ${_lostMoney} zł. Pech! (szansa przyjęcia: ${data.chance_pct}%)` });
      }
    } else {
      setMessage({ type:"error", title:`🐝 Przyjęto ${_accepted}/${_attempted} pszczół`, text:`${_rejected} ${_rejected === 1 ? "zginęła" : "zginęło"} — straciłeś ${_lostMoney} zł. (szansa przyjęcia: ${data.chance_pct}%)` });
    }
  }
  async function handleCollectHoney() {
    if (!profile?.id) return;
    const _honeyBonusPct = getEquipBonusPct("% produkcji miodu", charEquipped);
    const _suitSavePct   = getEquipBonusPct("% zużycia stroju", charEquipped);
    const { data, error } = await supabase.rpc("collect_honey", {
      p_user_id: profile.id,
      p_honey_bonus_pct: _honeyBonusPct,
      p_suit_save_pct:   _suitSavePct,
    });
    if (error || !data?.ok) {
      const msg = data?.error === "no_honey" ? "Poczekaj — miód jeszcze nie jest gotowy!"
                : data?.error === "no_jars"  ? "Brak pustych słoików!"
                : data?.error === "no_suit"  ? "Brak stroju pszczelarza!"
                : "Błąd zbierania miodu — spróbuj ponownie.";
      setMessage({ type:"error", title: msg, text: "Synchronizuję stan ula z bazą..." });
      await loadProfile(profile.id);
      return;
    }
    setHiveData(data.hive_data as HiveData);
    if (data.success) {
      const _bonusInfo = _honeyBonusPct > 0 ? ` (+${_honeyBonusPct.toFixed(0)}% produkcji)` : "";
      setMessage({ type:"success", title:`Zebrano ${data.collected} ${data.collected === 1 ? "słoik" : data.collected < 5 ? "słoiki" : "słoików"} miodu! 🍯${_bonusInfo}`, text:"" });
    } else setMessage({ type:"error", title:"Pszczoły były niespokojne — miód się nie udał!", text:"" });
  }
  async function handleShopBuyAnimal(a: AnimalDef) {
    if (!profile?.id) return;
    const st = barnState[a.id];
    if (!st) return;
    if (displayLevel < a.unlockLevel) { setMessage({type:"error",title:"Za niski poziom!",text:`${a.name} odblokujesz na LVL ${a.unlockLevel}.`}); return; }
    if (displayMoney < a.buyPrice) { setMessage({type:"error",title:"Za mało złota!",text:`Potrzebujesz ${a.buyPrice.toLocaleString()} 💰`}); return; }
    if (st.owned >= st.slots) { setMessage({type:"error",title:"Brak miejsca w stodole!",text:`Kup więcej slotów dla ${a.name} w Stodole.`}); return; }
    const { data, error } = await supabase.rpc("buy_barn_animal", { p_user_id: profile.id, p_animal_id: a.id });
    if (error) { setMessage({type:"error",title:"Błąd zakupu!",text:error.message}); return; }
    const response = data as { ok?: boolean; error?: string } | null;
    if (response?.ok === false) { setMessage({type:"error",title:"Błąd zakupu!",text:response.error ?? "Operacja nie powiodła się."}); return; }
    await loadProfile(profile.id);
    setMessage({type:"success",title:`${a.icon} Kupiono!`,text:`${a.name} dołączyła do zagrody.`});
  }
  async function handleShopBuyTree(t: TreeDef) {
    if (!profile?.id) return;
    setOrchardError("");
    const { data, error } = await supabase.rpc("buy_orchard_tree", { p_user_id: profile.id, p_tree_id: t.id });
    if (error) { setOrchardError("Błąd zakupu: " + error.message); return; }
    const response = data as { ok?: boolean; error?: string } | null;
    if (response?.ok === false) { setOrchardError(response.error ?? "Nie udało się kupić drzewa."); return; }
    await loadProfile(profile.id);
    setMessage({ type:"success", title:`${t.icon} Posadzono ${t.name}!`, text:`Pierwsze owoce za ${Math.round(t.growthTimeMs/3600000)}h.` });
  }
  async function handleShopBuyHiveItem(itemId: string, label: string) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("buy_hive_shop_item", { p_item_id: itemId });
    if (error) { setMessage({ type: "error", title: "Błąd zakupu", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; hive_data?: HiveData } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd zakupu", text: response.error ?? "Nieznany błąd" }); return; }
    if (response?.hive_data) setHiveData(response.hive_data);
    await loadProfile(profile.id);
    setMessage({ type: "success", title: "Zakupiono!", text: `Kupiono: ${label}` });
  }
  async function handleShopBuySeeds() {
    if (!profile?.id) return;
    setShopError("");
    const p_items = Object.entries(shopCart)
      .filter(([, qty]) => (qty as number) > 0)
      .map(([key, qty]) => {
        let crop_id = key;
        let quality = "good";
        for (const q of ["epic","legendary","rotten","good"]) {
          if (key.endsWith(`_${q}`)) { crop_id = key.slice(0, -(q.length + 1)); quality = q; break; }
        }
        return { crop_id, quality, qty: qty as number };
      });
    const { data, error } = await supabase.rpc("buy_shop_seeds", { p_user_id: profile.id, p_items });
    if (error) { setShopError("Blad: " + error.message); return; }
    const response = data as { ok?: boolean; error?: string } | null;
    if (response?.ok === false) { setShopError("Blad: " + (response.error ?? "Operacja nie powiodła się.")); return; }
    setShopCart({});
    setShopError("");
    await loadProfile(profile.id);
  }
  async function handleBarnBuySlot(a: AnimalDef) {
    if (!profile?.id) return;
    const st = barnState[a.id];
    const upg = st.slots - a.startSlots;
    if (upg >= a.slotUpgCosts.length) { setMessage({type:"info",title:"Maks!",text:`Maksymalna liczba slotów dla ${a.name}.`}); return; }
    const cost = a.slotUpgCosts[upg];
    if (displayMoney < cost) { setMessage({type:"error",title:"Za mało złota!",text:`Potrzebujesz ${cost.toLocaleString()} 💰`}); return; }
    const { data, error } = await supabase.rpc("buy_barn_slot", { p_user_id: profile.id, p_animal_id: a.id });
    if (error) { setMessage({type:"error",title:"Błąd!",text:error.message}); return; }
    const response = data as { ok?: boolean; error?: string; animal_state?: { slots?: number } } | null;
    if (response?.ok === false) { setMessage({type:"error",title:"Błąd!",text:response.error ?? "Operacja nie powiodła się."}); return; }
    const newSlots = response?.animal_state?.slots ?? (st.slots + 1);
    await loadProfile(profile.id);
    setMessage({type:"success",title:"Slot kupiony!",text:`${a.name}: ${newSlots} / ${a.maxSlots}`});
  }
  async function handleBarnFeed(a: AnimalDef, cropKey: string, points: number, cropName: string, cropIcon: string) {
    const have = seedInventory[cropKey] ?? 0;
    if (have < 1) { setMessage({type:"error",title:"Brak karmy!",text:`Potrzebujesz ${cropName} (${cropIcon}).`}); return; }
    if (!profile?.id) return;
    const opiekaPts = effectiveStats.opieka;
    const st = barnState[a.id];
    const curH = barnCurrentHunger(st, opiekaPts);
    const newH = Math.min(100, curH + points);
    const { data, error } = await supabase.rpc("feed_barn_animal", { p_user_id: profile.id, p_animal_id: a.id, p_crop_key: cropKey });
    if (error) { setMessage({type:"error",title:"Błąd karmienia!",text:error.message}); return; }
    const response = data as { ok?: boolean; error?: string } | null;
    if (response?.ok === false) { setMessage({type:"error",title:"Błąd karmienia!",text:response.error ?? "Karmienie nie powiodło się."}); return; }
    await loadProfile(profile.id);
    setMessage({type:"success",title:`${a.icon} Nakarmiono!`,text:`+${points} sytości → ${Math.round(newH)}%`});
  }
  function handleBarnCollect(a: AnimalDef) {
    if (!profile?.id) return;
    void (async () => {
      const item = ANIMAL_ITEMS.find(i => i.id === a.itemId)!;
      let rpc = await supabase.rpc("collect_animal", { p_user_id: profile.id, p_animal_id: a.id });
      if (rpc.error?.message?.includes("sync_barn_owned")) {
        const st = barnState[a.id];
        if (!st || st.owned === 0) { setMessage({type:"error",title:"Błąd!",text:"Brak zwierząt do synchronizacji."}); return; }
        await supabase.rpc("sync_barn_owned", { p_user_id: profile.id, p_animal_id: a.id, p_new_owned: st.owned, p_new_slots: st.slots });
        rpc = await supabase.rpc("collect_animal", { p_user_id: profile.id, p_animal_id: a.id });
      }
      if (rpc.error) { setMessage({type:"error",title:"Błąd odbioru!",text:rpc.error.message}); return; }
      const res = rpc.data as { ok: boolean; collected: number; item_id: string; new_prod_start: number; new_barn_items: Record<string,number> };
      if (res.collected === 0) { setMessage({type:"info",title:`${a.icon} Brak produktów`,text:`${a.name} jeszcze pracuje — wróć później.`}); return; }
      saveBarnItems(res.new_barn_items);
      saveBarnState({...barnState, [a.id]: {...barnState[a.id], storage: 0, prodStart: res.new_prod_start, baseProdStart: res.new_prod_start}});
      setMessage({type:"success",title:`${item.icon} Odebrano!`,text:`+${res.collected} ${item.name}`});
    })();
  }
  function handleBarnCollectAll() {
    if (!profile?.id) return;
    void (async () => {
      let rpc = await supabase.rpc("collect_all_animals", { p_user_id: profile.id });
      if (rpc.error?.message?.includes("sync_barn_owned")) {
        for (const a of ANIMALS) {
          const st = barnState[a.id];
          if (st && st.owned > 0) await supabase.rpc("sync_barn_owned", { p_user_id: profile.id, p_animal_id: a.id, p_new_owned: st.owned, p_new_slots: st.slots });
        }
        rpc = await supabase.rpc("collect_all_animals", { p_user_id: profile.id });
      }
      if (rpc.error) { setMessage({type:"error",title:"Błąd odbioru!",text:rpc.error.message}); return; }
      const res = rpc.data as { ok: boolean; results: Array<{animal_id:string;item_id:string;collected:number;new_prod_start:number}>; total: number; new_barn_items: Record<string,number> };
      if (res.total === 0) { setMessage({type:"info",title:"Nic do odbioru",text:"Żadne zwierzę nie jest jeszcze gotowe."}); return; }
      saveBarnItems(res.new_barn_items);
      const newState = {...barnState};
      res.results.forEach(r => { if (newState[r.animal_id]) newState[r.animal_id] = {...newState[r.animal_id], storage: 0, prodStart: r.new_prod_start, baseProdStart: r.new_prod_start}; });
      saveBarnState(newState);
      setMessage({type:"success",title:"Odebrano wszystko!",text:`+${res.total} produktów. Sprzedaj je w Ladzie dla klientów.`});
    })();
  }
  function handleOrchardHarvestTree(t: TreeDef) {
    if (!profile?.id) return;
    void (async () => {
      setOrchardError("");
      let rpc = await supabase.rpc("harvest_tree", { p_user_id: profile.id, p_tree_id: t.id });
      if (rpc.error?.message?.includes("sync_orchard_owned")) {
        const cur = orchardState[t.id];
        if (!cur || cur.owned === 0) { setOrchardError("Brak drzew do zebrania."); return; }
        await supabase.rpc("sync_orchard_owned", { p_user_id: profile.id, p_tree_id: t.id, p_new_owned: cur.owned });
        rpc = await supabase.rpc("harvest_tree", { p_user_id: profile.id, p_tree_id: t.id });
      }
      if (rpc.error) { setOrchardError("Błąd zbioru: " + rpc.error.message); return; }
      const res = rpc.data as { ok: boolean; added: Record<string,number>; new_prod_start: number; new_fruit_inventory: Record<string,number> };
      const total = Object.values(res.added ?? {}).reduce<number>((s,v) => s + (Number(v)||0), 0);
      if (total === 0) { setOrchardError(`${t.icon} Drzewo jeszcze rośnie — wróć za chwilę.`); return; }
      saveFruitInventory(res.new_fruit_inventory as Record<string,number>);
      saveOrchardState({ ...orchardState, [t.id]: { ...orchardState[t.id], storage:{ zwykly:0, soczysty:0, zloty:0, zgnile:0 }, prodStart: res.new_prod_start } });
      const a = res.added; const parts: string[] = [];
      if ((a[`${t.fruitId}_zwykly`]   ?? 0) > 0) parts.push(`${a[`${t.fruitId}_zwykly`]} zwykłych`);
      if ((a[`${t.fruitId}_soczysty`] ?? 0) > 0) parts.push(`\u{1F4A7}${a[`${t.fruitId}_soczysty`]} soczystych`);
      if ((a[`${t.fruitId}_zloty`]    ?? 0) > 0) parts.push(`\u2728${a[`${t.fruitId}_zloty`]} złotych`);
      if ((a[`${t.fruitId}_zgnile`]   ?? 0) > 0) parts.push(`\u{1F342}${a[`${t.fruitId}_zgnile`]} zgniłych`);
      setMessage({ type:"success", title:`${t.fruitIcon} Zebrano ${total} ${t.fruitName.toLowerCase()}!`, text: parts.join(" · ") });
    })();
  }
  function handleOrchardHarvestAll() {
    if (!profile?.id) return;
    void (async () => {
      setOrchardError("");
      let rpc = await supabase.rpc("harvest_all_trees", { p_user_id: profile.id });
      if (rpc.error?.message?.includes("sync_orchard_owned")) {
        for (const t of TREES) {
          const st = orchardState[t.id];
          if (st && st.owned > 0) await supabase.rpc("sync_orchard_owned", { p_user_id: profile.id, p_tree_id: t.id, p_new_owned: st.owned });
        }
        rpc = await supabase.rpc("harvest_all_trees", { p_user_id: profile.id });
      }
      if (rpc.error) { setOrchardError("Błąd zbioru: " + rpc.error.message); return; }
      const res = rpc.data as { ok: boolean; results: Array<{tree_id:string;added:Record<string,number>;new_prod_start:number}>; added_all: Record<string,number>; new_fruit_inventory: Record<string,number> };
      const totalAll = Object.values(res.added_all ?? {}).reduce<number>((s,v) => s + (Number(v)||0), 0);
      if (totalAll === 0) { setOrchardError("Brak owoców — drzewa jeszcze rosną."); return; }
      saveFruitInventory(res.new_fruit_inventory as Record<string,number>);
      const newOrch = { ...orchardState };
      res.results.forEach(r => { if (newOrch[r.tree_id]) newOrch[r.tree_id] = { ...newOrch[r.tree_id], storage:{ zwykly:0, soczysty:0, zloty:0, zgnile:0 }, prodStart: r.new_prod_start }; });
      saveOrchardState(newOrch);
      const partsAll: string[] = [];
      TREES.forEach(t => { const n = Object.entries(res.added_all ?? {}).filter(([k]) => k.startsWith(t.fruitId+"_")).reduce((s,[,v]) => s+(Number(v)||0), 0); if (n > 0) partsAll.push(`${t.fruitIcon}\xD7${n}`); });
      setMessage({ type:"success", title:`\uD83C\uDF33 Zebrano ${totalAll} owoców!`, text: partsAll.join(" · ") });
    })();
  }
"""
lines[4027-1:4027] = [HANDLERS]
print(f"Handlers inserted. Lines now: {len(lines)}")

# 7. Usunięcie selectedAnimal (linia 762 — nie zmieniła się, bo zmiany były powyżej 4027 w ostatnim kroku,
#    ale kolejność kroków 1-5 była poniżej 762, więc linia 762 jest nadal poprawna)
target = lines[762-1]
if "selectedAnimal" not in target:
    print(f"FAIL: expected selectedAnimal at 762, got: {target.rstrip()!r}")
    sys.exit(1)
del lines[762-1]
print(f"selectedAnimal removed. Lines now: {len(lines)}")

# 8. Usunięcie shopTab (linia 633)
target = lines[633-1]
if "shopTab" not in target:
    print(f"FAIL: expected shopTab at 633, got: {target.rstrip()!r}")
    sys.exit(1)
del lines[633-1]
print(f"shopTab removed. Lines now: {len(lines)}")

# 9. Importy komponentów (po linii 62)
NEW_IMPORTS = (
    'import { CompostNotificationPopup } from "./game/features/compost/CompostNotificationPopup";\n'
    'import { HiveModal } from "./game/features/hive/HiveModal";\n'
    'import { ShopModal } from "./game/features/shop/ShopModal";\n'
    'import { BarnModal } from "./game/features/barn/BarnModal";\n'
    'import { OrchardModal } from "./game/features/orchard/OrchardModal";\n'
)
lines[62:62] = [NEW_IMPORTS]
print(f"Imports added. Lines now: {len(lines)}")

with open(PATH, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"\nDone! Final line count: {len(lines)}")
