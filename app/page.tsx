"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────
import type { RankingPlayer, Profile } from "./game/types/profile";
import type { Crop, CropQuality, CompostType, CompostBonus } from "./game/types/crop";
import type { PlotCropState, SeedInventory, HarvestEvent, PendingFieldAction } from "./game/types/farm";
import type { PlayerStatsMap } from "./game/types/stats";
import type { EquipSlot, EquipBonus, CharEquipItem, CharEquipped } from "./game/types/equipment";
import type { BarnAnimalState, BarnState, BarnItems, AnimalItemDef, AnimalFeedDef, AnimalDef, THHitbox, TreeDef } from "./game/types/barn";
import type { FruitQuality, OrchardTreeState, OrchardState } from "./game/types/orchard";
import type { HiveData } from "./game/types/hive";
import type { GraphicsQuality, GameSettings, DailyProgress } from "./game/types/settings";
import type { CustomerOrderItem, CustomerOrderBonus, CustomerOrderRewards, CustomerOrder } from "./game/types/customers";
import type { Message, GameMessage } from "./game/types/messages";
import type { MarketItemType, MarketOffer, MarketReturn } from "./game/types/market";
import type { CompostQuality, CompostBatch } from "./game/types/compost";

// ─── Constants ───────────────────────────────────────────────────────────────
import { CROP_QUALITY_DEFS } from "./game/types/crop";
import { STATS_DEFS, DEFAULT_STATS } from "./game/types/stats";
import { DEFAULT_LEVEL, DEFAULT_XP, DEFAULT_XP_TO_NEXT_LEVEL, DEFAULT_MONEY, SESSION_DURATION_MS, DEFAULT_LOCATION, DEFAULT_MAP, MAX_LEVEL, MAX_FIELDS, FARM_UPGRADE_LEVELS, FARM_MUSIC_MAPS, FARM_MAP_ORDER, CITY_MUSIC_MAPS, LADA_MAX_CUSTOMERS } from "./game/constants/game";
import { XP_TABLE } from "./game/constants/xp";
import { CROPS } from "./game/constants/crops";
import { ANIMAL_ITEMS, ANIMALS } from "./game/constants/animals";
import { FRUIT_QUALITY_DEFS, TREES } from "./game/constants/orchard";
import { CHAR_EQUIP_ITEMS, EQUIP_SLOT_META, DEFAULT_CHAR_EQUIPPED, TIER_MATERIAL, UPG_COLOR, UPGRADE_COST, UPGRADE_CHANCE } from "./game/constants/equipment";
import { DEFAULT_HIVE_DATA, HIVE_MAX_HONEY, HIVE_UPGRADE_BEES, HIVE_SUCCESS_CHANCE, HIVE_BEE_ACCEPT_CHANCE, HONEY_MS_PER_PT, HONEY_JAR_PRICE } from "./game/constants/hive";
import { HIVE_UNLOCK_LVL, BARN_UNLOCK_LVL, SAD_UNLOCK_LVL, LADA_UNLOCK_LVL, KOMPOST_UNLOCK_LVL, CITY_UNLOCK_LVL, HIVE_BUY_COST, BEE_COST, HIVE_MIN_BEES_TO_PRODUCE, BASE_PLANT_MS, BASE_HARVEST_MS, BASE_WATER_MS, GROWTH_GLOBAL_MIN_MULT, WIEDZA_RATE, ZARADNOSC_RATE, WIEDZA_MULT_MIN, HIVE_MULT_MIN, EQUIP_GROWTH_MULT_MIN, COMPOST_MULT_MIN, WATER_BASE, WATER_MULT_MIN } from "./game/constants/unlock";
import { SKINS_MALE, SKINS_FEMALE, EPIC_SKINS, EPIC_SKIN_START, ALL_SKINS, NON_EPIC_SKINS, AVATAR_BONUSES, AVATAR_META, AVATAR_CHANGE_TIERS } from "./game/constants/avatars";
import { CHAR_EQUIP_KEY, ITEM_UPG_KEY, OWNED_EQ_KEY, EXTRA_EQ_KEY, KOMPOST_KEY, KOMPOST_BATCHES_KEY, SLOT_BOX_KEY, SETTINGS_KEY, ACTIVE_USER_KEY, BARN_STATE_KEY, BARN_ITEMS_KEY, ORCHARD_STATE_KEY, DP_LS_KEY, PER_SESSION_KEYS, DEFAULT_SLOT_BOX, HUNGER_DECAY_PER_MS } from "./game/constants/storage-keys";
import { BASE_W, BASE_H, TH_IMAGE_W, TH_IMAGE_H, TH_SCALE, TH_MAX_CAM_X, TH_CENTER_CAM_X, FARM_MAP_W, FARM_MAP_H, FARM_IMG_W, FARM_IMG_H, FARM_SCALE, FARM_RENDERED_W, FARM_MAX_PAN, FARM_CENTER_PAN } from "./game/constants/map";
import { FARM_PLOTS, FIELD_VIEW_PLOTS, CHWASTY_IMGS, KRET_IMGS, PIEN_IMGS, DRZEWO_IMGS, KAMIENIE_IMGS, OBSTACLE_DEFS, OBSTACLE_FIXED_COSTS } from "./game/constants/field";
import { KOMPOST_PER_REWARD, KOMPOST_BATCH_SIZE, KOMPOST_REWARDS_PER_BATCH, JACKPOT_CHANCE, MAX_LEGENDARY_EXP_MULT, COMPOST_DEFS, COMPOST_TIER_WEIGHTS, GUIDE_COMPOST_DEF, COMPOST_BASE_VALUE_BY_LEVEL, COMPOST_RARITY_MULT, ITEM_TIER_BY_QUALITY, ITEM_TIER_RARITY, COMPOST_TIER_FIXED_BY_QUALITY } from "./game/constants/compost";

// ─── Utils ────────────────────────────────────────────────────────────────────
import { rollCropQuality, getQualityKey, parseQualityKey, getPolandDayNumber, getMsToPolandMidnight, getDailyPromos, formatShopCountdown, calcObstacleCost } from "./game/utils/crop";
import { getXpForLevel } from "./game/utils/xp";
import { getDefaultUnlockedPlots, normalizeUnlockedPlots, parseUnlockedPlots, saveTutorialPlotIdsToStorage, loadTutorialPlotIdsFromStorage, buildEmptyPlotCrop, parsePlotCrops, serializePlotCrops } from "./game/utils/plots";
import { getDefaultSeedInventory, parseSeedInventory, serializeSeedInventory } from "./game/utils/seeds";
import { getMapForLevel, getDisplayBackgroundMap, getMapDisplayName } from "./game/utils/map";
import { getAvatarBonus, mergeAvatarBonus, getAvatarChangeTier } from "./game/utils/avatar";
import { calcStatEffect, getStatRank, getStatUpgradeCost } from "./game/utils/stats";
import { defaultBarnState, barnCurrentHunger, barnHungerStatus, barnEffProdMs, barnFmtMs, plItem } from "./game/utils/barn";
import { rollFruitQuality, getMaxTreeSlots, defaultOrchardState, migrateOrchardState } from "./game/utils/orchard";
import { getItemTierMultiplier, getSlotMultiplier, getItemTierLabel, getItemTierIndex, getUpgradeCost, getUpgradeMaterials, getEquipBonusPct, getEquipFlatBonus, migrateCharEquipped, upgBonusStr, bonusLine } from "./game/utils/equipment";
import { isCompostKey, isGuideCompostKey, compostTypeFromKey, compostValueFromKey, compostKeyFor, rollCompostTierIdx, getCompostQualityFromScore, getCompostQualityDef, rollFromChances } from "./game/utils/compost";
import { clearPerSessionLocalStorage, lsKey, lsLoadMigrate, loadAvatarDataLS, saveAvatarDataLS } from "./game/utils/storage";
import { todayStr, emptyDP, loadDP, saveDP } from "./game/utils/daily-progress";
import { computeFarmPower } from "./game/utils/farm-power";
import { ttStyle, getLigaTier, compostTierColor, fmtK, fmtFull } from "./game/utils/ui";
import { ModalOverlay } from "./game/components/ModalOverlay";
import { AnimalImg } from "./game/components/AnimalImg";
import { SettingsModal } from "./game/features/settings/SettingsModal";
import { LogoutConfirmModal } from "./game/features/settings/LogoutConfirmModal";
import { RankingModal } from "./game/features/ranking/RankingModal";
import { MessagesModal } from "./game/features/messages/MessagesModal";
import { SkinPickerModal } from "./game/features/avatar/SkinPickerModal";
import { EpicPurchaseModal } from "./game/features/avatar/EpicPurchaseModal";
import { CompostNotificationPopup } from "./game/features/compost/CompostNotificationPopup";
import { HiveModal } from "./game/features/hive/HiveModal";
import { ShopModal } from "./game/features/shop/ShopModal";
import { BarnModal } from "./game/features/barn/BarnModal";
import { OrchardModal } from "./game/features/orchard/OrchardModal";
import { CustomersModal } from "./game/features/customers/CustomersModal";
import { MarketModal } from "./game/features/market/MarketModal";
import { SeedPicker } from "./game/features/field/SeedPicker";
import { CompostPicker } from "./game/features/field/CompostPicker";
import { HarvestSessionModal } from "./game/features/field/HarvestSessionModal";
import { TutorialPanel } from "./game/features/tutorial/TutorialPanel";
import { TutorialArrows } from "./game/features/tutorial/TutorialArrows";

// ─── Ustawienia gry (nie wydzielone — używane bezpośrednio w komponencie) ─────
const DEFAULT_GAME_SETTINGS: GameSettings = { musicEnabled: true, soundEnabled: true, graphicsQuality: "high", musicVolume: 0.4 };

// ─── Funkcje używające supabase (nie można wydzielić) ─────────────────────────
function saveHouseData(userId: string, slots: number, eq: string[]) {
  localStorage.setItem(`plonopolis_eqslots_${userId}`, String(slots));
  localStorage.setItem(`plonopolis_eq_${userId}`, JSON.stringify(eq));
  void supabase.rpc("game_save_house_data", { p_equipment_slots: slots, p_equipment: eq as unknown as Record<string,unknown> });
}
function saveAvatarData(userId: string, skin: number, stats: PlayerStatsMap, fsp: number, prevLevel: number) {
  saveAvatarDataLS(userId, skin, stats, fsp, prevLevel);
  void supabase.rpc("game_save_avatar_data", {
    p_avatar_skin: skin,
    p_player_stats: stats as Record<string, number>,
    p_free_skill_points: fsp,
    p_prev_level: prevLevel,
  });
}

export default function Page() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [selectedServer, setSelectedServer] = useState<string>("testy");
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const serverDropdownRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!serverDropdownOpen) return;
    function handleOutside(e: MouseEvent) {
      if (serverDropdownRef.current && !serverDropdownRef.current.contains(e.target as Node)) {
        setServerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [serverDropdownOpen]);
  const [ready, setReady] = useState(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  // Auto-ukrywanie powiadomień po 6 sekundach (success/info), 8s dla error
  React.useEffect(() => {
    if (!message) return;
    const ms = message.type === 'error' ? 8000 : 6000;
    const t = setTimeout(() => setMessage(null), ms);
    return () => clearTimeout(t);
  }, [message]);
  // Preloading grafik avatarów przy starcie gry — żeby modal otwierał się bez lagów
  React.useEffect(() => {
    ALL_SKINS.forEach(src => { const img = new Image(); img.src = src; });
  }, []);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [registerForm, setRegisterForm] = useState({
    login: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
  });

  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [unlockedPlots, setUnlockedPlots] = useState<number[]>(getDefaultUnlockedPlots());
  const [plotObstacles, setPlotObstacles] = useState<Record<string, { type: string; cost: number }>>({});
  const [plotToBuy, setPlotToBuy] = useState<number | null>(null);
  const [isFieldViewOpen, setIsFieldViewOpen] = useState(false);
  const [fieldHitboxEditMode, setFieldHitboxEditMode] = React.useState(false);
  const [fhOffsetX, setFhOffsetX] = React.useState(16.83);
  const [fhOffsetY, setFhOffsetY] = React.useState(4.15);
  const [fhCellW, setFhCellW] = React.useState(6.59);
  const [fhCellH, setFhCellH] = React.useState(9.01);
  const fhCols = Array.from({length:10},(_,i)=>parseFloat((fhOffsetX+i*fhCellW).toFixed(2)));
  const fhRows = Array.from({length:10},(_,i)=>parseFloat((fhOffsetY+i*fhCellH).toFixed(2)));
  const [fhLockAxis, setFhLockAxis] = React.useState<"none"|"x"|"y">("none");
  const fhHoldRef = React.useRef<ReturnType<typeof setInterval>|null>(null);
  const fhStopHold = () => { if (fhHoldRef.current) { clearInterval(fhHoldRef.current); fhHoldRef.current = null; } };
  const fhStartHold = (fn: () => void) => { fn(); fhHoldRef.current = setInterval(fn, 80); };
  const fhContainerRef = React.useRef<HTMLDivElement>(null);
  const fhDragRef = React.useRef<{startMouseX:number,startMouseY:number,startOffsetX:number,startOffsetY:number}|null>(null);
  const fieldViewScrollRef = React.useRef<HTMLDivElement>(null);
  const fieldScrollDragRef = React.useRef<{active:boolean,startX:number,startY:number,scrollLeft:number,scrollTop:number,moved:boolean}|null>(null);
  const fhResizeRef = React.useRef<{startMouseX:number,startMouseY:number,startW:number,startH:number}|null>(null);
  const handleFhMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!fhContainerRef.current) return;
    const rect = fhContainerRef.current.getBoundingClientRect();
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;
    if (fhDragRef.current) {
      const { startMouseX, startMouseY, startOffsetX, startOffsetY } = fhDragRef.current;
      if (fhLockAxis !== "y") setFhOffsetX(parseFloat((startOffsetX + (pctX - startMouseX)).toFixed(2)));
      if (fhLockAxis !== "x") setFhOffsetY(parseFloat((startOffsetY + (pctY - startMouseY)).toFixed(2)));
    }
    if (fhResizeRef.current) {
      const { startMouseX, startMouseY, startW, startH } = fhResizeRef.current;
      setFhCellW(Math.max(1, parseFloat((startW+(pctX-startMouseX)).toFixed(2))));
      setFhCellH(Math.max(1, parseFloat((startH+(pctY-startMouseY)).toFixed(2))));
    }
  };
  const handleFhMouseUp = () => { fhDragRef.current = null; fhResizeRef.current = null; };

  // ── Edytor pozycji przycisków narzędzi (konewka/zbierz) na obrazie pola ──
  const [fvToolEditMode, setFvToolEditMode] = React.useState(false);
  const [fvKonewkaPos, setFvKonewkaPos] = React.useState({ l: 58, t: 614, w: 192, h: 179 });
  const [fvZbierzPos, setFvZbierzPos] = React.useState({ l: 58, t: 834, w: 190, h: 176 });
  const [fvNasonaPos, setFvNasonaPos] = React.useState({ l: 58, t: 397, w: 192, h: 179 });
  const [fvKompostPos, setFvKompostPos] = React.useState({ l: 58, t: 184, w: 192, h: 179 });
  const [fvSeedPickerOpen, setFvSeedPickerOpen] = React.useState(false);
  const [seedQualityFilter, setSeedQualityFilter] = React.useState<"good"|"epic"|"legendary">(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("plonopolis_seed_filter");
      if (v === "epic" || v === "legendary") return v;
    }
    return "good";
  });
  const [fvCompostPickerOpen, setFvCompostPickerOpen] = React.useState(false);
  // ─── Prawa kolumna: narzędzia masowe (premium) ───
  const [fvCiagnikPos,  setFvCiagnikPos]  = React.useState({ l: 1670, t: 184, w: 192, h: 179 });
  const [fvOgrodnikPos, setFvOgrodnikPos] = React.useState({ l: 1670, t: 397, w: 192, h: 179 });
  const [fvZraszaczPos, setFvZraszaczPos] = React.useState({ l: 1670, t: 614, w: 192, h: 179 });
  const [fvKombajnPos,  setFvKombajnPos]  = React.useState({ l: 1670, t: 834, w: 190, h: 176 });
  const [fvZbioryPos, setFvZbioryPos] = React.useState({ l: 58, t: 1038, w: 190, h: 176 });
  const [fvHarvestLogPos, setFvHarvestLogPos] = React.useState(() => {
    const gs = typeof window !== "undefined" ? Math.min(window.innerWidth / 1920, window.innerHeight / 1280) : 0.5;
    return {
      l: Math.round((typeof window !== "undefined" ? window.innerWidth : 960) * 0.5 + (1573 - 960) * gs),
      t: Math.round((typeof window !== "undefined" ? window.innerHeight : 540) * 0.5 + (853 - 640) * gs),
      w: Math.round(320 * gs),
      h: Math.round(401 * gs),
    };
  });
  const [fvTutArrow12Pos, setFvTutArrow12Pos] = React.useState({ lPct: 8.1, tPct: 93.1, w: 122, h: 0 });
  const [fvTutArrow13Pos, setFvTutArrow13Pos] = React.useState({ lPct: 50.0, tPct: 27.8, w: 80, h: 0 });
  const tutArrowDragRef = React.useRef<{ step: 12|13, startMX: number, startMY: number, startLPct: number, startTPct: number } | null>(null);
  const fvToolDragRef = React.useRef<{ btn: "konewka"|"zbierz"|"nasiona"|"kompost"|"ciagnik"|"ogrodnik"|"zraszacz"|"kombajn"|"harvestlog"|"zbiorybtn"|"tutar12"|"tutar13", mode: "move"|"resize", startMX: number, startMY: number, startL: number, startT: number, startW: number, startH: number } | null>(null);
  React.useEffect(() => {
    if (!isFieldViewOpen) return;
    const handleMove = (e: MouseEvent) => {
      if (!fvToolDragRef.current) return;
      const d = fvToolDragRef.current;
      const gs = 1;
      if (d.btn === "tutar12" || d.btn === "tutar13") {
        const pSetter = d.btn === "tutar12" ? setFvTutArrow12Pos : setFvTutArrow13Pos;
        if (d.mode === "move") {
          pSetter(prev => ({
            ...prev,
            lPct: parseFloat(Math.max(0, Math.min(100, d.startL + (e.clientX - d.startMX) / window.innerWidth * 100)).toFixed(2)),
            tPct: parseFloat(Math.max(0, Math.min(100, d.startT + (e.clientY - d.startMY) / window.innerHeight * 100)).toFixed(2)),
          }));
        } else {
          pSetter(prev => ({
            ...prev,
            w: Math.round(Math.max(40, d.startW + (e.clientX - d.startMX) / gs)),
            h: Math.round(Math.max(40, d.startH + (e.clientY - d.startMY) / gs)),
          }));
        }
        return;
      }
      const setter = d.btn === "konewka" ? setFvKonewkaPos : d.btn === "zbierz" ? setFvZbierzPos : d.btn === "nasiona" ? setFvNasonaPos : d.btn === "kompost" ? setFvKompostPos : d.btn === "ciagnik" ? setFvCiagnikPos : d.btn === "ogrodnik" ? setFvOgrodnikPos : d.btn === "zraszacz" ? setFvZraszaczPos : d.btn === "kombajn" ? setFvKombajnPos : d.btn === "zbiorybtn" ? setFvZbioryPos : setFvHarvestLogPos;
      if (d.mode === "move") {
        setter({
          l: Math.round(Math.max(0, d.startL + (e.clientX - d.startMX) / gs)),
          t: Math.round(Math.max(0, d.startT + (e.clientY - d.startMY) / gs)),
          w: d.startW,
          h: d.startH,
        });
      } else {
        setter(prev => ({
          ...prev,
          w: Math.round(Math.max(40, d.startW + (e.clientX - d.startMX) / gs)),
          h: Math.round(Math.max(40, d.startH + (e.clientY - d.startMY) / gs)),
        }));
      }
    };
    const handleUp = () => { fvToolDragRef.current = null; };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [fvToolEditMode, isFieldViewOpen]);
  // Drag dla strzałek tutorialu kroków 12/13 — globalny handler
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const d = tutArrowDragRef.current;
      if (!d) return;
      const setter = d.step === 12 ? setFvTutArrow12Pos : setFvTutArrow13Pos;
      setter(prev => ({ ...prev, lPct: parseFloat(Math.max(0, Math.min(100, d.startLPct + (e.clientX - d.startMX) / window.innerWidth * 100)).toFixed(2)), tPct: parseFloat(Math.max(0, Math.min(100, d.startTPct + (e.clientY - d.startMY) / window.innerHeight * 100)).toFixed(2)) }));
    };
    const handleUp = () => { tutArrowDragRef.current = null; };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => { document.removeEventListener("mousemove", handleMove); document.removeEventListener("mouseup", handleUp); };
  }, []);
  // Globalne mouseup — kończy drag-to-plant
  React.useEffect(() => {
    const onUp = () => {
      if (isDraggingPlantRef.current) {
        isDraggingPlantRef.current = false;
        dragEndedRef.current = true;
        dragPlantedFieldsRef.current.clear();
      }
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);
  const [plotCrops, setPlotCrops] = useState<Record<number, PlotCropState>>({});
  const [seedInventory, setSeedInventory] = useState<SeedInventory>(getDefaultSeedInventory());
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<"watering_can" | "sickle" | null>(null);
  const [, setGrowthTick] = useState(0);
  // Akcje polowe w toku (sadzenie/zbiór z paskiem postępu)
  const [pendingFieldActions, setPendingFieldActions] = useState<Record<number, PendingFieldAction>>({});
  const [, setPendingTick] = useState(0);
  // Pola oczekujące w kolejce zbioru (zanim zacznie się animacja paska postępu)
  const [queuedHarvestPlotIds, setQueuedHarvestPlotIds] = useState<Set<number>>(new Set());
  const [queuedPlantPlotIds, setQueuedPlantPlotIds] = useState<Set<number>>(new Set());
  const [queuedWaterPlotIds, setQueuedWaterPlotIds] = useState<Set<number>>(new Set());
  // Mapa plotId → setTimeout id (do anulowania przy unmount)
  const fieldActionTimeoutsRef = React.useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const sessionTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs do fresh state — używane w setTimeout callbackach (closure capture by stary state)
  const seedInventoryRef = React.useRef<SeedInventory>({});
  const plotCropsRef = React.useRef<Record<number, PlotCropState>>({});
  // Drag-to-plant refs
  const isDraggingPlantRef = React.useRef(false);
  const dragPlantedFieldsRef = React.useRef<Set<number>>(new Set());
  const dragEndedRef = React.useRef(false);
  const [isDesktop, setIsDesktop] = useState(true);
  // TYMCZASOWE — powiadomienie "obróć telefon" dla testów mobilnych
  const [rotateNoticeDismissed, setRotateNoticeDismissed] = useState(false);
  const [showRotateNotice, setShowRotateNotice] = useState(false);
  const [userZoomFactor, setUserZoomFactor] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const v = parseFloat(localStorage.getItem("plonopolis_zoom") ?? "1");
    return isNaN(v) ? 1 : Math.max(0.80, Math.min(1.30, v));
  });
  const userZoomFactorRef = React.useRef(userZoomFactor);
  const [gameScale, setGameScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    const raw = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
    const v = parseFloat(localStorage.getItem("plonopolis_zoom") ?? "1");
    const zoom = isNaN(v) ? 1 : Math.max(0.80, Math.min(1.30, v));
    return Math.max(0.40, Math.min(1.60, raw * zoom));
  });
  const gameScaleRef = React.useRef(gameScale);
  const [backpackPosition, setBackpackPosition] = useState({ x: 0, y: 0 });
  const [isDraggingBackpack, setIsDraggingBackpack] = useState(false);

  const [isBackpackOpen, setIsBackpackOpen] = useState(true);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mousePos, setMousePos] = React.useState({x:0, y:0});
  const [mouseScreenPos, setMouseScreenPos] = React.useState({x:0, y:0});
  const [draggedSeedId, setDraggedSeedId] = React.useState<string|null>(null);
  const [isFieldViewCollapsed, setIsFieldViewCollapsed] = React.useState(false);
  const [showRankingPanel, setShowRankingPanel] = useState(false);
  const [rankingData, setRankingData] = useState<RankingPlayer[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingSort, setRankingSort] = useState<"level"|"money"|"farmpower"|"customers">("farmpower");
  const [rankingSearch, setRankingSearch] = useState("");
  const [rankingHighlightMe, setRankingHighlightMe] = useState(false);
  const [showGildiaPanel, setShowGildiaPanel] = useState(false);
  const [showMisjePanel, setShowMisjePanel] = useState(false);
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  const [messageTab, setMessageTab] = useState<"systemowe"|"otrzymane"|"wyslane"|"targ">("systemowe");
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [gameMessages, setGameMessages] = useState<GameMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMarketCount, setUnreadMarketCount] = useState(0);
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [recipientSuggestions, setRecipientSuggestions] = useState<{id:string;username:string;avatar_skin?:number|null}[]>([]);
  const [recipientResolved, setRecipientResolved] = useState<{id:string;username:string;avatar_skin?:number|null}|null>(null);
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [messageCooldowns, setMessageCooldowns] = useState<Record<string,number>>({});
  const [composeCountdownSecs, setComposeCountdownSecs] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredCrop, setHoveredCrop] = useState<typeof CROPS[0] | null>(null);
  const [hoveredSeedQuality, setHoveredSeedQuality] = useState<"rotten"|"good"|"epic"|"legendary"|null>(null);
  const [hoveredWateringCan, setHoveredWateringCan] = React.useState(false);
  const [hoveredHiveLock, setHoveredHiveLock] = React.useState(false);
  const [hoveredBarnLock, setHoveredBarnLock] = React.useState(false);
  const [hoveredSadLock, setHoveredSadLock] = React.useState(false);
  const [hoveredLadaLock, setHoveredLadaLock] = React.useState(false);
  const [hoveredKompostLock, setHoveredKompostLock] = React.useState(false);
  const [hoveredStodola, setHoveredStodola] = React.useState(false);
  const [hoveredUl, setHoveredUl] = React.useState(false);
  const [hoveredSad, setHoveredSad] = React.useState(false);
  const [hoveredLada, setHoveredLada] = React.useState(false);
  const [hoveredDom, setHoveredDom] = React.useState(false);
  const [hoveredKompostownik, setHoveredKompostownik] = React.useState(false);
  const [hoveredPolaUprawne, setHoveredPolaUprawne] = React.useState(false);
  const [hoveredDoMiasta, setHoveredDoMiasta] = React.useState(false);
  const [hoveredCityLock, setHoveredCityLock] = React.useState(false);
  const [hoveredNaFarme, setHoveredNaFarme] = React.useState(false);
  const [hoveredSklep, setHoveredSklep] = React.useState(false);
  const [hoveredTarg, setHoveredTarg] = React.useState(false);
  const [hoveredBank, setHoveredBank] = React.useState(false);
  const [hoveredRatusz, setHoveredRatusz] = React.useState(false);
  const [hoveredLiga, setHoveredLiga] = React.useState(false);
  const [townHallCamX, setTownHallCamX] = React.useState(0);
  const thDragRef = React.useRef<{startX:number; startCamX:number} | null>(null);
  const [thHitboxEditMode, setThHitboxEditMode] = React.useState(false);
  const [thMouseOnPanorama, setThMouseOnPanorama] = React.useState({x:0, y:0});
  const [townHallHitboxes, setTownHallHitboxes] = React.useState<THHitbox[]>([
    { id:"ranking", label:"Ranking",      x:259,  y:347, width:716, height:839, action:"ranking" },
    { id:"club",    label:"Klub Rolnika", x:1305, y:542, width:1489, height:807, action:"club"  },
    { id:"event",   label:"Event",        x:3075, y:354, width:798, height:791, action:"event"  },
  ]);
  const thContainerRef = React.useRef<HTMLDivElement>(null);
  const thHbDragRef = React.useRef<{hbId:string; startX:number; startY:number; startHbX:number; startHbY:number; mode:"move"|"resize"; startW:number; startH:number} | null>(null);
  const [thTextEditMode, setThTextEditMode] = React.useState(false);
  const [thShowPreviewRanking, setThShowPreviewRanking] = React.useState(true);
  const [rankingTextLayout, setRankingTextLayout] = React.useState({ startX:0, startY:22, rowHeight:89, nameX:165, scoreRight:28, fontSize:28 });
  const thTextDragRef = React.useRef<{prop:"startX"|"startY"|"rowHeight"|"nameX"|"scoreRight"; startMX:number; startMY:number; startVal:number} | null>(null);
  const [hoveredSickle, setHoveredSickle] = React.useState(false);
  const [avatarSkin, setAvatarSkin] = React.useState<number>(-1);
  const [showSkinModal, setShowSkinModal] = React.useState(false);
  const [showAvatarHover, setShowAvatarHover] = React.useState(false);
  const [unlockedEpicAvatars, setUnlockedEpicAvatars] = React.useState<number[]>([]);
  const [skinTab, setSkinTab] = React.useState<"mezczyzni"|"kobiety"|"wszystkie"|"epickie">("wszystkie");
  const [epicPurchaseTarget, setEpicPurchaseTarget] = React.useState<number|null>(null);
  const [hoveredEpicSkin, setHoveredEpicSkin] = React.useState<number|null>(null);
  const [hoveredNormalSkin, setHoveredNormalSkin] = React.useState<number|null>(null);

  // ── Strażnik tooltipów stref: co 500ms sprawdza :hover, czyści "przyklejone" tooltipy ──
  React.useEffect(() => {
    const zoneSetters: Array<[string, React.Dispatch<React.SetStateAction<boolean>>]> = [
      ["doMiasta",     setHoveredDoMiasta],
      ["naFarme",      setHoveredNaFarme],
      ["dom",          setHoveredDom],
      ["stodola",      setHoveredStodola],
      ["ul",           setHoveredUl],
      ["sad",          setHoveredSad],
      ["lada",         setHoveredLada],
      ["kompostownik", setHoveredKompostownik],
      ["polaUprawne",  setHoveredPolaUprawne],
      ["sklep",        setHoveredSklep],
      ["targ",         setHoveredTarg],
      ["bank",         setHoveredBank],
      ["ratusz",       setHoveredRatusz],
      ["hiveLock",     setHoveredHiveLock],
      ["barnLock",     setHoveredBarnLock],
      ["sadLock",      setHoveredSadLock],
      ["sickle",       setHoveredSickle],
    ];
    const id = setInterval(() => {
      for (const [zone, setter] of zoneSetters) {
        const el = document.querySelector<Element>(`[data-zone="${zone}"]`);
        if (!el || !el.matches(":hover")) setter(false);
      }
    }, 500);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [playerStats, setPlayerStats] = React.useState<PlayerStatsMap>({ ...DEFAULT_STATS });
  const [freeSkillPoints, setFreeSkillPoints] = React.useState(3);
  const [statFlash, setStatFlash] = React.useState<string|null>(null);
  const [avatarChangeCount, setAvatarChangeCount] = React.useState(0);
  const [lastAvatarChangeAt, setLastAvatarChangeAt] = React.useState(0);
  const effectiveStats = React.useMemo(() => mergeAvatarBonus(playerStats, avatarSkin), [playerStats, avatarSkin]);
  const [dailyProgress, setDailyProgress] = React.useState<DailyProgress>(emptyDP());
  const [statUpgradeAmount, setStatUpgradeAmount] = React.useState<1|5|10>(1);
  const [showDomModal, setShowDomModal] = React.useState(false);
  const [showStodolaModal, setShowStodolaModal] = React.useState(false);
  const [showSadModal, setShowSadModal] = React.useState(false);
  const [showUlModal, setShowUlModal] = React.useState(false);
  const [showLadaModal, setShowLadaModal] = React.useState(false);
  const [showLadaInfo, setShowLadaInfo] = React.useState(false);
  const [customerLootDrop, setCustomerLootDrop] = React.useState<null | { gold: number; exp: number; bonus: CustomerOrderBonus[]; customerName: string; customerIcon: string }>(null);
  const [lootHoverIdx, setLootHoverIdx] = React.useState<number | null>(null);
  const ladaInfoCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openLadaInfo = React.useCallback(() => {
    if (ladaInfoCloseTimer.current) { clearTimeout(ladaInfoCloseTimer.current); ladaInfoCloseTimer.current = null; }
    setShowLadaInfo(true);
  }, []);
  const scheduleCloseLadaInfo = React.useCallback(() => {
    if (ladaInfoCloseTimer.current) clearTimeout(ladaInfoCloseTimer.current);
    ladaInfoCloseTimer.current = setTimeout(() => { setShowLadaInfo(false); ladaInfoCloseTimer.current = null; }, 180);
  }, []);
  // Lada NPC — zamówienia klientów
  const [customerOrders, setCustomerOrders] = React.useState<CustomerOrder[]>([]);
  const [currentCustomerIdx, setCurrentCustomerIdx] = React.useState(0);
  const [ladaDetailIdx, setLadaDetailIdx] = React.useState<number | null>(null);
  const [ladaCardHoverIdx, setLadaCardHoverIdx] = React.useState<number | null>(null);
  const [ladaView, setLadaView] = React.useState<"list" | "carousel">("list");
  const [carouselIdx, setCarouselIdx] = React.useState(0);
  const carouselDragRef = React.useRef<{ startX: number; baseIdx: number; totalMoved: number; pointerId: number } | null>(null);
  const carouselHasDraggedRef = React.useRef(false);
  const [customerSelling, setCustomerSelling] = React.useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = React.useState(false);
  const [customerNow, setCustomerNow] = React.useState(Date.now());
  const [nextSpawnAt, setNextSpawnAt] = React.useState<number | null>(null);
  const lastAutoTickAtRef = React.useRef(0);
  const [newCustomerIds, setNewCustomerIds] = React.useState<Set<string>>(new Set());
  const isSpawningCustomerRef = React.useRef(false);
  const spawnRetryAbortedRef = React.useRef(false);
  const customerRetryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCustomerIdsRef = React.useRef<Set<string>>(new Set());
  const hasInitializedCustomerIdsRef = React.useRef(false);
  const newCustomerIdsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ladaStatusMsg, setLadaStatusMsg] = React.useState<'searching' | 'adding' | 'added' | 'failed' | null>(null);
  const ladaStatusTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnFailCooldownRef = React.useRef(0);
  const completingCustomerOrderRef = React.useRef(false);
  const [hiveData, setHiveData] = React.useState<HiveData>({ ...DEFAULT_HIVE_DATA });
  const [hiveNow, setHiveNow] = React.useState(Date.now());
  const [showTestModal, setShowTestModal] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const OWNER_ID = "c68b84c6-335a-4832-af86-477bcb09fc16"; // właściciel gry (do przyszłego użycia)
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const [navEditMode, setNavEditMode] = React.useState(false);
  // pozycje etykiet (niezależne od hitboxów)
  const [navLabelPos, setNavLabelPos] = React.useState<Record<string,{left:number,top:number}>>({
    dom:         {left:26.7, top:25.1},
    stodola:     {left:56.6, top:65.6},
    doMiasta:    {left:77.4, top:11.3},
    polaUprawne: {left:55.4, top:29.8},
    ul:          {left:78.6, top:81.1},
    lada:        {left:22.3, top:62.6},
    kompostownik:{left:80.1, top:32.7},
    sad:         {left:35.4, top:82.2},
  });
  const navLabelDragRef = React.useRef<{id:string,startX:number,startY:number,startPos:{left:number,top:number}}|null>(null);
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = navLabelDragRef.current;
      if (!ds || !mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - ds.startX) / rect.width) * 100;
      const dy = ((e.clientY - ds.startY) / rect.height) * 100;
      setNavLabelPos(prev => ({
        ...prev,
        [ds.id]: {
          left: Math.max(0, Math.min(98, ds.startPos.left + dx)),
          top:  Math.max(0, Math.min(98, ds.startPos.top  + dy)),
        }
      }));
    };
    const onUp = () => { navLabelDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);
  const [hitboxEditMode, setHitboxEditMode] = React.useState(false);
  const [navHitboxPos, setNavHitboxPos] = React.useState<Record<string,{left:number,top:number,width:number,height:number}>>({
    dom:         {left:18.9, top:12.6, width:13.7, height:30.0},
    stodola:     {left:47.7, top:56.9, width:18.8, height:27.0},
    doMiasta:    {left:69.2, top:0.0,  width:15.4, height:17.3},
    polaUprawne: {left:43.4, top:15.3, width:24.3, height:32.8},
    ul:          {left:71.1, top:72.0, width:15.8, height:22.4},
    lada:        {left:17.3, top:51.5, width:9.8,  height:19.8},
    kompostownik:{left:75.7, top:23.5, width:9.6,  height:19.7},
    sad:         {left:28.0, top:71.8, width:14.7, height:28.6},
  });
  const navHitboxDragRef = React.useRef<{type:"move"|"resize",id:string,startX:number,startY:number,startPos:{left:number,top:number,width:number,height:number}}|null>(null);
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = navHitboxDragRef.current;
      if (!ds || !mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - ds.startX) / rect.width) * 100;
      const dy = ((e.clientY - ds.startY) / rect.height) * 100;
      setNavHitboxPos(prev => {
        const p = {...prev[ds.id]};
        if (ds.type === "move") {
          p.left = Math.max(0, Math.min(95, ds.startPos.left + dx));
          p.top  = Math.max(0, Math.min(95, ds.startPos.top  + dy));
        } else {
          p.width  = Math.max(3, ds.startPos.width  + dx);
          p.height = Math.max(3, ds.startPos.height + dy);
        }
        return {...prev, [ds.id]: p};
      });
    };
    const onUp = () => { navHitboxDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ══ MIASTO — EDYTOR HITBOXÓW I ETYKIET ══
  const [ligaTab, setLigaTab] = React.useState<"ranking"|"wyzwanie"|"nagrody">("ranking");
  const [cityNavEditMode, setCityNavEditMode] = React.useState(false);
  const [cityHitboxEditMode, setCityHitboxEditMode] = React.useState(false);
  const [cityHitboxPos, setCityHitboxPos] = React.useState<Record<string,{left:number,top:number,width:number,height:number}>>({
    naFarme: {left:6.6,  top:71.0, width:16.6, height:23.9},
    sklep:   {left:5.5,  top:35.1, width:14.7, height:34.2},
    targ:    {left:21.6, top:41.3, width:20.4, height:26.9},
    bank:    {left:59.0, top:39.6, width:12.1, height:27.3},
    ratusz:  {left:42.3, top:5.1,  width:12.0, height:49.8},
    liga:    {left:75.5, top:19.1, width:23.1, height:58.5},
  });
  const [cityLabelPos, setCityLabelPos] = React.useState<Record<string,{left:number,top:number}>>({
    naFarme: {left:15.4, top:83.0},
    sklep:   {left:12.6, top:54.5},
    targ:    {left:32.1, top:54.8},
    bank:    {left:64.3, top:52.1},
    ratusz:  {left:47.5, top:45.3},
    liga:    {left:85.2, top:55.2},
  });
  const cityHitboxDragRef = React.useRef<{type:"move"|"resize",id:string,startX:number,startY:number,startPos:{left:number,top:number,width:number,height:number}}|null>(null);
  const cityLabelDragRef = React.useRef<{id:string,startX:number,startY:number,startPos:{left:number,top:number}}|null>(null);
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const dh = cityHitboxDragRef.current;
      if (dh && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        const cityDragScaleX = BASE_W / FARM_RENDERED_W;
        const dx = ((e.clientX - dh.startX) / rect.width) * 100 * cityDragScaleX;
        const dy = ((e.clientY - dh.startY) / rect.height) * 100;
        setCityHitboxPos(prev => {
          const p = {...prev[dh.id]};
          if (dh.type === "move") {
            p.left = Math.max(0, Math.min(95, dh.startPos.left + dx));
            p.top  = Math.max(0, Math.min(95, dh.startPos.top  + dy));
          } else {
            p.width  = Math.max(3, dh.startPos.width  + dx);
            p.height = Math.max(3, dh.startPos.height + dy);
          }
          return {...prev, [dh.id]: p};
        });
      }
      const dl = cityLabelDragRef.current;
      if (dl && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        const cityDragScaleX = BASE_W / FARM_RENDERED_W;
        const dx = ((e.clientX - dl.startX) / rect.width) * 100 * cityDragScaleX;
        const dy = ((e.clientY - dl.startY) / rect.height) * 100;
        setCityLabelPos(prev => ({
          ...prev,
          [dl.id]: {
            left: Math.max(0, Math.min(98, dl.startPos.left + dx)),
            top:  Math.max(0, Math.min(98, dl.startPos.top  + dy)),
          }
        }));
      }
    };
    const onUp = () => { cityHitboxDragRef.current = null; cityLabelDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const [showWelcome, setShowWelcome] = React.useState(false);
  const [guideExitStep, setGuideExitStep] = React.useState<0 | 1 | 2>(0);
  const [guideSaving, setGuideSaving] = React.useState(false);
  const [guideError, setGuideError] = React.useState<string | null>(null);
  const [tutorialStep, setTutorialStep] = React.useState<number>(0);
  const [tutorialPlotIds, setTutorialPlotIds] = React.useState<number[]>([]);
  const [tutorialWateredIds, setTutorialWateredIds] = React.useState<number[]>([]);
  const [tutorialHarvestedIds, setTutorialHarvestedIds] = React.useState<number[]>([]);
  const [tutorialPlantedIds, setTutorialPlantedIds] = React.useState<number[]>([]);
  const [tutorialPanelMinimized, setTutorialPanelMinimized] = React.useState<boolean>(false);
  type FieldQueueItem = { plotId: number; kind: string; execute: () => Promise<void> };
  const plantQueueRef     = React.useRef<FieldQueueItem[]>([]);
  const waterQueueRef     = React.useRef<FieldQueueItem[]>([]);
  const harvestQueueRef   = React.useRef<FieldQueueItem[]>([]);
  const plantActiveRef    = React.useRef<number | null>(null);
  const waterActiveRef    = React.useRef<number | null>(null);
  const harvestActiveRef  = React.useRef<number | null>(null);
  const plantProcessingRef   = React.useRef(false);
  const waterProcessingRef   = React.useRef(false);
  const harvestProcessingRef = React.useRef(false);
  const [tutorialArrow, setTutorialArrow] = React.useState<{ cx: number; top: number; bottom: number; left: number; right: number; width: number; height: number } | null>(null);
  const [showShopModal, setShowShopModal] = React.useState(false);
  const [shopCart, setShopCart] = React.useState<Record<string,number>>({});
  const [shopError, setShopError] = React.useState("");
  const [promoCountdown, setPromoCountdown] = React.useState(() => formatShopCountdown(getMsToPolandMidnight()));
  const dailyPromos = React.useMemo(() => getDailyPromos(), []);
  const [domTab, setDomTab] = React.useState<"profil"|"eq"|"plecak">("profil");
    const [backpackTab, setBackpackTab] = React.useState<"uprawy"|"przedmioty"|"owoce">("uprawy");
    type BackpackQualityFilter = "rotten"|"good"|"epic"|"legendary"|"all";
    const [backpackSort, setBackpackSort] = React.useState<BackpackQualityFilter>(() => {
      if (typeof window === "undefined") return "good";
      const saved = window.localStorage.getItem("plonopolis_backpack_filter");
      if (saved === "rotten" || saved === "good" || saved === "epic" || saved === "legendary" || saved === "all") return saved;
      return "good";
    });
    React.useEffect(() => {
      if (typeof window !== "undefined") window.localStorage.setItem("plonopolis_backpack_filter", backpackSort);
    }, [backpackSort]);
    const BACKPACK_FILTER_OPTS: Array<{id: BackpackQualityFilter; label: string; short: string; color: string}> = [
      { id:"rotten",    label:"Popsute",    short:"Pop",  color:"#9aa57a" },
      { id:"good",      label:"Standardowe",short:"Std",  color:"#dfcfab" },
      { id:"epic",      label:"Epickie",    short:"Epic", color:"#a78bfa" },
      { id:"legendary", label:"Legendarne", short:"Leg",  color:"#fbbf24" },
      { id:"all",       label:"Wszystkie",  short:"Wsz",  color:"#dfcfab" },
    ];
  const [charEquipped, setCharEquipped] = React.useState<CharEquipped>({ ...DEFAULT_CHAR_EQUIPPED });
  const [equippingSlot, setEquippingSlot] = React.useState<EquipSlot | null>(null);
  const [selectedExtraUid, setSelectedExtraUid] = React.useState<string | null>(null);
  const [eqFilter, setEqFilter] = React.useState<EquipSlot | "">("");
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = React.useState<EquipSlot | null>(null);
  const [itemUpgRegistry, setItemUpgRegistry] = React.useState<Record<string,number>>({});
  const saveCharEquipped = (next: CharEquipped) => { setCharEquipped(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(CHAR_EQUIP_KEY, uid), JSON.stringify(next)); } catch { /* ignore */ } };
  const saveItemUpg = (reg: Record<string,number>) => { setItemUpgRegistry(reg); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(ITEM_UPG_KEY, uid), JSON.stringify(reg)); } catch { /* ignore */ } };
  const getItemUpg = (id: string) => itemUpgRegistry[id] ?? 0;
  // ─── Ekwipunek: zdobyte przedmioty (gracz musi je zdobyć by je mieć) ───
  const [ownedEqItems, setOwnedEqItems] = React.useState<Record<string, true>>({});
  const saveOwnedEqItems = (next: Record<string, true>) => { setOwnedEqItems(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(OWNED_EQ_KEY, uid), JSON.stringify(next)); } catch {} };
  // ─── Ekwipunek Dodatkowy: nadmiarowe duplikaty (przyszłość: handel/ulepszenia/sprzedaż) ───
  type ExtraEqEntry = { uid: string; id: string; upg: number };
  const [extraEqItems, setExtraEqItems] = React.useState<ExtraEqEntry[]>([]);
  const saveExtraEqItems = (next: ExtraEqEntry[]) => { setExtraEqItems(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(EXTRA_EQ_KEY, uid), JSON.stringify(next)); } catch {} };
  const makeExtraUid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  // ─── Kompostownik ───
  const [kompostBatch, setKompostBatch] = React.useState<CompostBatch>({ fill: 0, scoreSum: 0, cropIds: [] });
  // Flaga przeciw race conditions: blokuje równoległe deposit/claim (np. szybkie podwójne kliknięcia)
  const kompostBusyRef = React.useRef(false);
  // Chroni applyGuideCompostToPlot przed podwójnym kliknięciem (plotId w toku)
  const compostApplyingRef = React.useRef(new Set<number>());
  // Serialized write chain — zapisy plot_crops z kompostem ustawiają się w kolejce
  // Eliminuje race condition: wiele równoległych applyCompostToPlot nadpisywało się wzajemnie
  const compostWriteChainRef = React.useRef<Promise<void>>(Promise.resolve());
  const saveKompostBatch = (batch: CompostBatch) => {
    const uid = profile?.id ?? "";
    const clean: CompostBatch = {
      fill: Math.max(0, Math.min(KOMPOST_BATCH_SIZE, Math.floor(batch.fill))),
      scoreSum: Math.max(0, batch.scoreSum),
      cropIds: Array.isArray(batch.cropIds) ? batch.cropIds : [],
    };
    setKompostBatch(clean);
    if (uid) try {
      localStorage.setItem(lsKey(KOMPOST_BATCHES_KEY, uid), JSON.stringify(clean));
      localStorage.removeItem(lsKey(KOMPOST_KEY, uid));
      localStorage.removeItem(KOMPOST_KEY);
    } catch {}
  };
  const [showKompostModal, setShowKompostModal] = React.useState(false);
  type KompostRewardEntry =
    | { kind:"item"; itemId: string; itemName: string; itemIcon: string }
    | { kind:"compost"; compostType: CompostType; value: number };
  const [kompostRewards, setKompostRewards] = React.useState<KompostRewardEntry[] | null>(null);
  const [kompostDropHistory, setKompostDropHistory] = React.useState<Array<{label: string; color: string; icon: string; ts: number; count: number}>>([]);
  const [showKompostHistory, setShowKompostHistory] = React.useState(false);
  // ESC zamyka modal kompostownika (najpierw panel nagród, potem cały modal)
  React.useEffect(() => {
    if (!showKompostModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (kompostRewards) {
        setKompostRewards(null);
      } else {
        setShowKompostModal(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showKompostModal, kompostRewards]);
  const [kompostHoverTip, setKompostHoverTip] = React.useState<{ x: number; y: number; node: React.ReactNode; color: string } | null>(null);
  const [kompostTierHoverTip, setKompostTierHoverTip] = React.useState<{ x: number; y: number; node: React.ReactNode; color: string } | null>(null);
  const [showKompostHelp, setShowKompostHelp] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [gameSettings, setGameSettings] = React.useState<GameSettings>({ ...DEFAULT_GAME_SETTINGS });
  const saveGameSettings = (next: GameSettings) => {
    setGameSettings(next);
    setMusicMuted(!next.musicEnabled);
    setMusicVolume(next.musicVolume);
    const uid = profile?.id ?? "";
    if (uid) try { localStorage.setItem(lsKey(SETTINGS_KEY, uid), JSON.stringify(next)); } catch { /* ignore */ }
  };
  const [seedPickerTip, setSeedPickerTip] = React.useState<{ x: number; y: number; node: React.ReactNode; color: string } | null>(null);
  const [cardTip, setCardTip] = React.useState<React.ReactNode>(null);
  const [avatarTipVisible, setAvatarTipVisible] = React.useState(false);
  const [avatarTipPos, setAvatarTipPos] = React.useState({ x: 0, y: 0 });
  const loginPanelPos = { left: 738, top: 424, width: 457 };
  const [kompostQty, setKompostQty] = React.useState<1|5|10|100|"max">(1);
  const [kompostFilter, setKompostFilter] = React.useState<"rotten"|"good"|"epic"|"legendary"|"all">("rotten");
  const [compostNotice, setCompostNotice] = React.useState<{ type: CompostType; value: number; plotId: number } | null>(null);
  const [slotBoxCustom, setSlotBoxCustom] = React.useState<Record<string,{top:number,left:number,width:number,height:number}>>({ ...DEFAULT_SLOT_BOX });
  const [editSlotBox, setEditSlotBox] = React.useState(false);
  const saveSlotBox = (v: Record<string,{top:number,left:number,width:number,height:number}>) => {
    setSlotBoxCustom(v); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(SLOT_BOX_KEY, uid), JSON.stringify(v)); } catch { /* ignore */ }
  };
  const [barnNow, setBarnNow] = React.useState(Date.now());
  const [panX, setPanX] = React.useState(FARM_CENTER_PAN);
  const [panY, setPanY] = React.useState(0);
  const [isPanDragging, setIsPanDragging] = React.useState(false);
  const panDragRef = React.useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false });
  const [barnState, setBarnState_] = React.useState<BarnState>(defaultBarnState());
  const barnStateRef = React.useRef<BarnState>(barnState);
  const lastFarmMapRef = React.useRef<string>("farm1");
  const prevFarmMapForTransitionRef = React.useRef<string | null>(null);
  const isProfileLoadedRef = React.useRef(false);
  const mapCrossfadeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapCrossfade, setMapCrossfade] = React.useState<{ from: string; to: string } | null>(null);
  const [showFarmSlider, setShowFarmSlider] = React.useState<{ from: string; to: string } | null>(null);
  const [sliderX, setSliderX] = React.useState(50);
  const sliderDragRef = React.useRef(false);
  const sliderContainerRef = React.useRef<HTMLDivElement>(null);
  const [barnItems, setBarnItems_] = React.useState<BarnItems>({});
  const saveBarnState = (next: BarnState) => { barnStateRef.current = next; setBarnState_(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(BARN_STATE_KEY, uid), JSON.stringify(next)); } catch {} };
  const saveBarnItems = (next: BarnItems) => { setBarnItems_(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(BARN_ITEMS_KEY, uid), JSON.stringify(next)); } catch {} };
  // SAD — state + persystencja
  const [orchardState, setOrchardState_] = React.useState<OrchardState>(defaultOrchardState());
  const saveOrchardState = (next: OrchardState) => { setOrchardState_(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(ORCHARD_STATE_KEY, uid), JSON.stringify(next)); } catch {} };
  const [orchardError, setOrchardError] = React.useState("");
  // Owoce zebrane (Record<"fruitId_quality", number>) — osobny inventory bo sprzedaż per quality, w przyszłości też crafting/gildie
  const FRUIT_INV_KEY = "plonopolis_fruit_inv";
  const [fruitInventory, setFruitInventory_] = React.useState<Record<string,number>>({});
  const saveFruitInventory = (next: Record<string,number>) => { setFruitInventory_(next); const uid = profile?.id ?? ""; if (uid) try { localStorage.setItem(lsKey(FRUIT_INV_KEY, uid), JSON.stringify(next)); } catch {} };
  // ─── TARG GRACZY: stan ───────────────────────────────────────────────────────
  const [showMarketModal, setShowMarketModal] = React.useState(false);
  const [marketTab, setMarketTab] = React.useState<"browse"|"my_offers"|"returns">("browse");
  const [marketBrowse, setMarketBrowse] = React.useState<MarketOffer[]>([]);
  const [myMarketOffers, setMyMarketOffers] = React.useState<MarketOffer[]>([]);
  const [marketReturns, setMarketReturns] = React.useState<MarketReturn[]>([]);
  const [marketLoading, setMarketLoading] = React.useState(false);
  const [marketBrowseFilter, setMarketBrowseFilter] = React.useState<MarketItemType|"all">("crop");
  const [marketSearch, setMarketSearch] = React.useState("");
  const [marketQualityFilter, setMarketQualityFilter] = React.useState<string>("all");
  const [marketSort, setMarketSort] = React.useState<"price_asc"|"price_desc"|"qty_desc"|"expires_asc"|"newest"|"unit_asc">("newest");
  const [marketTierFilter, setMarketTierFilter] = React.useState<"all"|"1"|"2"|"3"|"4"|"5">("all");
  const [marketMyLevelOnly, setMarketMyLevelOnly] = React.useState(false);
  const [pendingReturnCount, setPendingReturnCount] = React.useState(0);
  const [createOfferOpen, setCreateOfferOpen] = React.useState(false);
  const [coItemType, setCoItemType] = React.useState<MarketItemType>("crop");
  const [coItemKey, setCoItemKey] = React.useState("");
  const [coQty, setCoQty] = React.useState(1);
  const [coPrice, setCoPrice] = React.useState<number>(10);
  const [coPriceStr, setCoPriceStr] = React.useState("10");
  const [coDuration, setCoDuration] = React.useState<24|48|72>(24);
  const [coLoading, setCoLoading] = React.useState(false);
  const [buyingOfferId, setBuyingOfferId] = React.useState<string|null>(null);
  const [buyQtyMap, setBuyQtyMap] = React.useState<Record<string, number>>({});
  const [cancellingOfferId, setCancellingOfferId] = React.useState<string|null>(null);
  const [claimingReturns, setClaimingReturns] = React.useState(false);
  const [marketPickerOpen, setMarketPickerOpen] = React.useState(false);
  const [marketPickerSearch, setMarketPickerSearch] = React.useState("");
  const [marketPickerFilter, setMarketPickerFilter] = React.useState<MarketItemType>("crop");
  React.useEffect(() => {
    const t = setInterval(() => setBarnNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (marketPickerOpen) { setMarketPickerOpen(false); return; }
      if (showMarketModal) { setShowMarketModal(false); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marketPickerOpen, showMarketModal]);
  React.useEffect(() => {
    let changed = false;
    const next: BarnState = {};
    const opiekaPts = effectiveStats.opieka;
    const bonusChance = opiekaPts * 0.0015; // +0.15%/pkt
    const bonusMessages: string[] = [];
    const freshBarn = barnStateRef.current;
    ANIMALS.forEach(a => {
      const st = freshBarn[a.id] ?? { owned:0, slots:a.startSlots, hunger:80, lastFedAt:0, storage:0, prodStart:0, baseProdStart:0 };
      if (st.owned === 0) { next[a.id] = st; return; }
      let ns = { ...st };
      // storageMax=1 oznacza max 1 cykl — po 1 cyklu timer staje; owned mnoży ilość produktów przy odbiorze
      if (ns.storage >= a.storageMax) { ns.prodStart = 0; next[a.id] = ns; return; }
      if (ns.prodStart === 0) { ns.prodStart = barnNow; changed = true; next[a.id] = ns; return; }
      const h = barnCurrentHunger(ns, opiekaPts);
      const effMs = barnEffProdMs(a, h);
      const elapsed = barnNow - ns.prodStart;
      if (elapsed >= effMs) {
        const freeSlots = a.storageMax - ns.storage;
        const fullCycles = Math.min(Math.floor(elapsed / effMs), freeSlots);
        let cyclesToAdd = fullCycles;
        // Bonus opieki: szansa na dodatkowy produkt przy odbiorze (nie dodatkowy cykl)
        if (bonusChance > 0) {
          for (let i = 0; i < fullCycles; i++) {
            if (ns.storage + cyclesToAdd >= a.storageMax) break;
            if (Math.random() < bonusChance) {
              cyclesToAdd += 1;
              const item = ANIMAL_ITEMS.find(i => i.id === a.itemId);
              if (item) bonusMessages.push(`${a.icon} ${a.name} dała bonus ${item.name}! ${item.icon}`);
            }
          }
        }
        ns.storage = Math.min(a.storageMax, ns.storage + cyclesToAdd);
        if (ns.storage >= a.storageMax) {
          ns.prodStart = 0;
        } else {
          // Zachowaj resztę czasu po pełnych cyklach (nie marnuj postępu)
          ns.prodStart = ns.prodStart + fullCycles * effMs;
        }
        changed = true;
      }
      next[a.id] = ns;
    });
    if (changed) saveBarnState(next);
    if (bonusMessages.length > 0) {
      setMessage({ type:"success", title:"🐄 Bonus Opieki!", text: bonusMessages.join(" · ") });
    }
  }, [barnNow]); // eslint-disable-line react-hooks/exhaustive-deps
  // ─── SAD: cykl produkcji owoców (analogicznie do zwierząt, ale bez głodu) ───
  React.useEffect(() => {
    let changed = false;
    const next: OrchardState = { ...orchardState };
    // Bonus z eq "% speed drzew" przyspiesza wzrost (max -70%)
    const treeSpeedPct = getEquipBonusPct("% speed drzew", charEquipped) / 100;
    const speedMult = Math.max(0.30, 1 - treeSpeedPct);
    // Skill Sadownik (rate 0.005) → mnożnik liczby owoców (więcej owoców z drzewa)
    const sadownikBonus = calcStatEffect(effectiveStats.sadownik, 0.005) / 100;
    // Szczęście + eq "% bonus drop" → szansa na rare/golden
    const luckPct = calcStatEffect(effectiveStats.szczescie + getEquipFlatBonus(" pkt Szczescia", charEquipped), 0.0025);
    TREES.forEach(t => {
      const st = next[t.id];
      if (!st || st.owned === 0) return;
      const ns = { ...st, storage: { ...st.storage } };
      const effMs = Math.max(60_000, Math.round(t.growthTimeMs * speedMult));
      if (ns.prodStart === 0) { ns.prodStart = barnNow; changed = true; next[t.id] = ns; return; }
      const elapsed = barnNow - ns.prodStart;
      if (elapsed >= effMs) {
        // Liczba pełnych cykli (offline-safe). Limit storage = ~5 cykli per drzewo (żeby nie nazbierało za dużo).
        const STORAGE_CYCLE_CAP = 5;
        const totalStored = ns.storage.zwykly + ns.storage.soczysty + ns.storage.zloty + (ns.storage.zgnile ?? 0);
        const avgDropPerCycle = (t.dropMin + t.dropMax) / 2 * ns.owned;
        const freeCycles = Math.max(0, Math.floor((STORAGE_CYCLE_CAP * avgDropPerCycle - totalStored) / Math.max(1, avgDropPerCycle)));
        const fullCycles = Math.min(Math.floor(elapsed / effMs), freeCycles);
        if (fullCycles > 0) {
          for (let c = 0; c < fullCycles; c++) {
            for (let tree = 0; tree < ns.owned; tree++) {
              const baseDrop = t.dropMin + Math.floor(Math.random() * (t.dropMax - t.dropMin + 1));
              const totalDrop = Math.max(1, Math.round(baseDrop * (1 + sadownikBonus)));
              for (let f = 0; f < totalDrop; f++) {
                const q = rollFruitQuality(luckPct);
                ns.storage[q] += 1;
              }
            }
          }
          ns.prodStart = ns.prodStart + fullCycles * effMs;
          changed = true;
        } else if (freeCycles === 0) {
          // Pełny storage — wstrzymaj nowe cykle (jak u zwierząt)
          ns.prodStart = 0;
          changed = true;
        }
      }
      next[t.id] = ns;
    });
    if (changed) saveOrchardState(next);
  }, [barnNow]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const merged: Record<string,number> = { ...itemUpgRegistry };
    let changed = false;
    const ownedNext: Record<string, true> = { ...ownedEqItems };
    let ownedChanged = false;
    (["dlonie","nogi","glowa"] as EquipSlot[]).forEach(slot => {
      const eq = charEquipped[slot];
      if (eq) {
        if (eq.upg > 0 && (merged[eq.id] ?? 0) < eq.upg) { merged[eq.id] = eq.upg; changed = true; }
        if (!ownedNext[eq.id]) { ownedNext[eq.id] = true; ownedChanged = true; }
      }
    });
    if (changed) saveItemUpg(merged);
    if (ownedChanged) saveOwnedEqItems(ownedNext);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [equipmentSlots, setEquipmentSlots] = React.useState(1);
  const [equipment, setEquipment] = React.useState<string[]>([]);
  const prevLevelRef = React.useRef<number>(0);
  const lastLoadedUserIdRef = React.useRef<string | null>(null);
  const skinDbSyncedRef = React.useRef(false);
  const EQ_SLOT_COSTS = [0, 5000, 15000, 30000, 60000, 100000, 200000]; // slot 1 free, 2-7 paid
  const CROP_PRICES: Record<string,number> = {
    carrot:3.2,potato:4.8,tomato:6.4,cucumber:9.6,onion:14.4,garlic:19.2,
    lettuce:25.6,radish:35.2,beet:48.0,pepper:64.0,cabbage:88.0,broccoli:120.0,
    cauliflower:160.0,strawberry:208.0,raspberry:272.0,blueberry:352.0,
    eggplant:448.0,zucchini:576.0,watermelon:720.0,grape:880.0,pumpkin:1040.0,
    rapeseed:1200.0,sunflower:1440.0,chili:1760.0,asparagus:2240.0,
  };
  const avatarHoverTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [harvestLog, setHarvestLog] = React.useState<HarvestEvent[]>([]);
  const [harvestCountdown, setHarvestCountdown] = React.useState(25);
  const [isFvHarvestModalOpen, setIsFvHarvestModalOpen] = React.useState(false);
  const [fvHarvestTooltip, setFvHarvestTooltip] = React.useState<{cropId:string;cropName:string;baseAmount:number;bonusAmount:number;bonusSource:string|null;baseExp:number;quality:"rotten"|"good"|"epic"|"legendary";cx:number;cy:number}|null>(null);
  const [fvQualityTip, setFvQualityTip] = React.useState<{label:string;expLabel:string;chance:string;sx:number;sy:number}|null>(null);
  const [isDailyHarvestView, setIsDailyHarvestView] = React.useState(false);
  const [dailyHarvestData, setDailyHarvestData] = React.useState<{
    items: Array<{ crop_id: string; quality: "rotten"|"good"|"epic"|"legendary"; amount: number }>;
    total_exp: number;
  } | null>(null);
  const [isDailyHarvestLoading, setIsDailyHarvestLoading] = React.useState(false);
  const harvestEventIdRef = React.useRef(0);
  const rankingScrollRef = React.useRef<HTMLDivElement>(null);
  const harvestLogTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldViewOpenedAtRef = React.useRef<number>(0);
  const farmPowerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const farmAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const cityAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [musicVolume, setMusicVolume] = React.useState(0.4);
  const [musicMuted, setMusicMuted] = React.useState(false);
  const BACKPACK_POSITION_STORAGE_KEY = "plonopolis_backpack_position";

  function isPlotUnlocked(plotId: number) {
    return unlockedPlots.includes(plotId);
  }

  function getPlotUnlockCost(plotId: number) {
    // Koszty startowych pól 1–20: darmowe (zawsze odblokowane)
    if (plotId <= 20) return 0;
    // Pola 21–100: koszt obliczany lokalnie wg typu przeszkody (niezależny od wartości w bazie)
    const obstacle = plotObstacles[String(plotId)];
    if (!obstacle) return 0;
    return calcObstacleCost(plotId, obstacle.type);
  }

  function getPlotObstacleType(plotId: number): string | null {
    if (plotId <= 20) return null;
    return plotObstacles[String(plotId)]?.type ?? null;
  }

  function resetLocalGameState() {
    // Wyczyść localStorage kluczy przypisanych do sesji (stodoła, sad, ekwipunek, kompost...)
    clearPerSessionLocalStorage();
    try { localStorage.removeItem(ACTIVE_USER_KEY); } catch { /* ignore */ }
    // Resetuj React state
    setProfile(null);
    setSelectedPlotId(null);
    setUnlockedPlots(getDefaultUnlockedPlots());
    setPlotObstacles({});
    setPlotCrops({});
    setSeedInventory(getDefaultSeedInventory());
    setPlotToBuy(null);
    setIsFieldViewOpen(false);
    setSelectedSeedId(null);
    setSelectedTool(null);
    setIsDraggingBackpack(false);
    // Resetuj stany ekwipunku, stodoły, sadu, kompostu
    setCharEquipped({ ...DEFAULT_CHAR_EQUIPPED });
    setItemUpgRegistry({});
    setOwnedEqItems({});
    setExtraEqItems([]);
    setBarnState_(defaultBarnState());
    setBarnItems_({});
    setOrchardState_(defaultOrchardState());
    setFruitInventory_({});
    // Resetuj lokalny UI state tutoriala i harvestLog — nie dotykamy DB
    setTutorialStep(0);
    setTutorialPlotIds([]);
    setTutorialPlantedIds([]);
    setTutorialWateredIds([]);
    setTutorialHarvestedIds([]);
    setHarvestLog([]);
    setHarvestCountdown(25);
  }

  async function applyProfileState(rawProfile: unknown) {
    if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
      setProfile(null);
      setUnlockedPlots(getDefaultUnlockedPlots());
      setPlotCrops({});
      setSeedInventory(getDefaultSeedInventory());
      return null;
    }

    const source = rawProfile as Profile;

    // Wykryj zmianę konta — jeśli inny userId niż poprzednio, wyczyść dane z localStorage
    try {
      const lastUserId = localStorage.getItem(ACTIVE_USER_KEY);
      if (lastUserId && lastUserId !== source.id) {
        // Nowe konto na tym urządzeniu → usuń dane poprzedniego gracza
        clearPerSessionLocalStorage();
        setCharEquipped({ ...DEFAULT_CHAR_EQUIPPED });
        setItemUpgRegistry({});
        setOwnedEqItems({});
        setExtraEqItems([]);
        setBarnState_(defaultBarnState());
        setBarnItems_({});
        setOrchardState_(defaultOrchardState());
        setFruitInventory_({});
      }
      localStorage.setItem(ACTIVE_USER_KEY, source.id);
    } catch { /* ignore */ }

    const nextProfile: Profile = {
      ...source,
      level: Math.min(source.level ?? DEFAULT_LEVEL, MAX_LEVEL),
      xp: source.xp ?? DEFAULT_XP,
      xp_to_next_level: source.xp_to_next_level ?? DEFAULT_XP_TO_NEXT_LEVEL,
      money: source.money ?? DEFAULT_MONEY,
      location: source.location ?? DEFAULT_LOCATION,
      current_map: (() => {
        const _lm = getMapForLevel(source.level);
        const _sm = source.current_map;
        if (!_sm) return _lm;
        if (_sm.startsWith("farm")) {
          const _fo = ["farm1","farm5","farm10","farm15","farm20","farm25","farm30"];
          return _fo.indexOf(_sm) >= _fo.indexOf(_lm) ? _sm : _lm;
        }
        return _sm;
      })(),
    };

    setProfile(nextProfile);
    const _loadedTStep = typeof source.tutorial_step === "number" ? source.tutorial_step : 0;
    setTutorialStep(_loadedTStep);
    setUnlockedPlots(parseUnlockedPlots(source.unlocked_plots));
    const _loadedPlots = parsePlotCrops(source.plot_crops);
    setPlotCrops(_loadedPlots);
    const _guidePlotIds = Object.entries(_loadedPlots)
      .filter(([, p]) => p.compostBonus?.type === "guide")
      .map(([id]) => Number(id));
    // Merge localStorage cache — compostBonus może tymczasowo znikać po sadzeniu z RPC
    const _cachedIds = _loadedTStep >= 5 && _loadedTStep <= 13
      ? loadTutorialPlotIdsFromStorage(nextProfile.id)
      : [] as number[];
    const _finalTutorialIds = Array.from(new Set([..._cachedIds, ..._guidePlotIds]));
    setTutorialPlotIds(_finalTutorialIds);
    setTutorialPlantedIds(_finalTutorialIds.filter(id => _loadedPlots[id]?.cropId != null));
    setTutorialWateredIds(_loadedTStep === 9
      ? _finalTutorialIds.filter(id => _loadedPlots[id]?.watered)
      : []);
    // Krok 11: derive z pustych tutorialowych pól (po zbiorze cropId = null)
    setTutorialHarvestedIds(_loadedTStep === 11
      ? _finalTutorialIds.filter(id => !_loadedPlots[id]?.cropId)
      : []);
    // Przeszkody pól — zawsze z DB (losowane na serwerze przy rejestracji)
    if (source.plot_obstacles && typeof source.plot_obstacles === "object" && !Array.isArray(source.plot_obstacles)) {
      setPlotObstacles(source.plot_obstacles as Record<string, { type: string; cost: number }>);
    }

    // Migracja: jeśli DB ma stare klucze (np. "carrot"), zapisz do DB nowe ("carrot_good")
    const _rawInv = source.seed_inventory as Record<string, unknown> | null | undefined;
    const _needsMigration = !!_rawInv && Object.keys(_rawInv).some(k => {
      const { quality } = parseQualityKey(k);
      return quality === null && CROPS.some(c => c.id === k);
    });
    const _migratedInv = parseSeedInventory(source.seed_inventory);
    setSeedInventory(_migratedInv);

    // Synchronizacja barn_items / fruit_inventory z bazy (źródło prawdy są RPC sync_*)
    // Bez tego bonusy z Lady NPC (np. rogi byka) nie pojawiają się w stodole/plecaku
    // bo lokalny stan był tylko z localStorage.
    if (source.barn_items && typeof source.barn_items === "object" && !Array.isArray(source.barn_items)) {
      saveBarnItems(source.barn_items as BarnItems);
    }
    if (source.fruit_inventory && typeof source.fruit_inventory === "object" && !Array.isArray(source.fruit_inventory)) {
      saveFruitInventory(source.fruit_inventory as Record<string, number>);
    }

    const _rawHive = source.hive_data as Record<string,unknown> | null | undefined;
    const _hiveSavedStart = typeof _rawHive?.honey_start === "number" ? _rawHive.honey_start : null;
    // FIX: honey_start = NULL dopóki gracz nie kupi pierwszej pszczoły.
    // Pszczoły są warunkiem produkcji — ul bez pszczół nic nie robi.
    const _parsedHive: HiveData = {
      level:           typeof _rawHive?.level === "number" ? Math.max(0,Math.min(5,_rawHive.level)) : 0,
      bees_progress:   typeof _rawHive?.bees_progress === "number" ? _rawHive.bees_progress : 0,
      honey_start:     _hiveSavedStart,
      suit_durability: typeof _rawHive?.suit_durability === "number" ? _rawHive.suit_durability : 0,
      empty_jars:      typeof _rawHive?.empty_jars === "number" ? _rawHive.empty_jars : 0,
      honey_jars:      typeof _rawHive?.honey_jars === "number" ? _rawHive.honey_jars : 0,
    };
    setHiveData(_parsedHive);
    if (_needsMigration && source.id) {
      await supabase.from("profiles").update({ seed_inventory: _migratedInv }).eq("id", source.id);
    }

    if (source.id && lastLoadedUserIdRef.current !== source.id) {
      lastLoadedUserIdRef.current = source.id;
      const d = loadAvatarDataLS(source.id);
      // localStorage = zawsze aktualne (zapis synchroniczny)
      // Supabase = tylko dla nowych urządzeń (brak localStorage)
      const hasSkinLS  = localStorage.getItem(`plonopolis_skin_${source.id}`) !== null;
      const hasStatsLS = localStorage.getItem(`plonopolis_stats_${source.id}`) !== null;
      const hasFspLS   = localStorage.getItem(`plonopolis_fsp_${source.id}`) !== null;
      const hasPrevLS  = localStorage.getItem(`plonopolis_prevlv_${source.id}`) !== null;
      const skin = hasSkinLS ? d.skin
        : (source.avatar_skin !== null && source.avatar_skin !== undefined && source.avatar_skin >= 0)
          ? source.avatar_skin : -1;
      const stats: PlayerStatsMap = hasStatsLS ? d.stats
        : (source.player_stats && typeof source.player_stats === "object" && !Array.isArray(source.player_stats))
          ? source.player_stats as PlayerStatsMap : { ...DEFAULT_STATS };
      const fsp = hasFspLS ? (d.fsp ?? 3)
        : (source.free_skill_points !== null && source.free_skill_points !== undefined)
          ? source.free_skill_points : 3;
      const prevLevel = hasPrevLS ? (d.prevLevel || (source.level ?? 1))
        : (source.prev_level !== null && source.prev_level !== undefined && source.prev_level > 0)
          ? source.prev_level : (source.level ?? 1);
      setAvatarSkin(skin);
      setPlayerStats(stats);
      setFreeSkillPoints(fsp);
      prevLevelRef.current = prevLevel;
      setAvatarChangeCount(d.changeCount);
      setLastAvatarChangeAt(d.lastChangeAt);
      // Ekwipunek
      const hasEqSlotsLS = localStorage.getItem(`plonopolis_eqslots_${source.id}`) !== null;
      const hasEqLS = localStorage.getItem(`plonopolis_eq_${source.id}`) !== null;
      const eqSlots = hasEqSlotsLS
        ? Number(localStorage.getItem(`plonopolis_eqslots_${source.id}`) ?? "1")
        : (source.equipment_slots ?? 1);
      const eq: string[] = hasEqLS
        ? JSON.parse(localStorage.getItem(`plonopolis_eq_${source.id}`) ?? "[]")
        : (Array.isArray(source.equipment) ? source.equipment : []);
      setEquipmentSlots(eqSlots);
      setEquipment(eq);
      localStorage.setItem(`plonopolis_eqslots_${source.id}`, String(eqSlots));
      localStorage.setItem(`plonopolis_eq_${source.id}`, JSON.stringify(eq));
      // Epickie avatary — zawsze z DB (nie z localStorage)
      setUnlockedEpicAvatars(Array.isArray(source.unlocked_epic_avatars) ? source.unlocked_epic_avatars : []);
      // Zawsze aktualizuj localStorage
      saveAvatarDataLS(source.id, skin, stats, fsp, prevLevel, d.changeCount, d.lastChangeAt);
      // Zsynchronizuj Supabase tylko gdy skin jest prawidłowy (nie zapisuj -1 do bazy)
      if (skin >= 0) {
        void supabase.rpc("game_save_avatar_data", {
          p_avatar_skin: skin,
          p_player_stats: stats as Record<string, number>,
          p_free_skill_points: fsp,
          p_prev_level: prevLevel,
        });
      }
    } else if (source.id) {
      const prevLevel = (source.prev_level !== null && source.prev_level !== undefined && source.prev_level > 0)
        ? source.prev_level : prevLevelRef.current;
      if (prevLevel > prevLevelRef.current) prevLevelRef.current = prevLevel;
    }

    // Załaduj dane z localStorage per-userId (izolacja kont — każde konto ma swoje klucze)
    const uid = source.id;
    setCharEquipped(lsLoadMigrate(CHAR_EQUIP_KEY, uid, s => migrateCharEquipped(JSON.parse(s)), () => ({ ...DEFAULT_CHAR_EQUIPPED })));
    setItemUpgRegistry(lsLoadMigrate(ITEM_UPG_KEY, uid, s => JSON.parse(s) as Record<string,number>, () => ({})));
    setOwnedEqItems(lsLoadMigrate(OWNED_EQ_KEY, uid, s => JSON.parse(s) as Record<string,true>, () => ({})));
    setExtraEqItems(lsLoadMigrate(EXTRA_EQ_KEY, uid, s => { const p = JSON.parse(s); return Array.isArray(p) ? p as ExtraEqEntry[] : []; }, () => []));
    setSlotBoxCustom(lsLoadMigrate(SLOT_BOX_KEY, uid, s => JSON.parse(s) as Record<string,{top:number;left:number;width:number;height:number}>, () => ({ ...DEFAULT_SLOT_BOX })));
    const _loadedSettings = lsLoadMigrate(SETTINGS_KEY, uid, s => { const p = JSON.parse(s) as Partial<GameSettings>; return { ...DEFAULT_GAME_SETTINGS, ...p }; }, () => ({ ...DEFAULT_GAME_SETTINGS }));
    setGameSettings(_loadedSettings);
    setMusicMuted(!_loadedSettings.musicEnabled);
    setMusicVolume(_loadedSettings.musicVolume);
    // Barn: ładuj z localStorage, nadpisz owned/slots/prodStart z DB (DB autorytarne dla timingów)
    const _lsBarn = lsLoadMigrate(BARN_STATE_KEY, uid, s => { const p = JSON.parse(s); return { ...defaultBarnState(), ...p } as BarnState; }, defaultBarnState);
    const _dbBarn = source.barn_state as Record<string, { owned: number; slots: number; prodStart: number }> | null | undefined;
    // _dbBarnIsSet = true gdy admin ustawił barn_state (nawet na {}); null = nowe konto bez danych
    const _dbBarnIsSet = _dbBarn !== null && _dbBarn !== undefined;
    const _dbBarnHasData = _dbBarnIsSet && Object.values(_dbBarn).some(v => ((v as { owned?: number })?.owned ?? 0) > 0);
    if (_dbBarnHasData) {
      // DB ma zwierzęta — nadpisz localStorage danymi z bazy
      ANIMALS.forEach(a => { const d = (_dbBarn as Record<string,{owned:number;slots:number;prodStart:number}>)[a.id]; if (d) { if (typeof d.owned === "number") _lsBarn[a.id].owned = d.owned; if (typeof d.slots === "number") _lsBarn[a.id].slots = d.slots; if (typeof d.prodStart === "number" && d.prodStart > 0) { _lsBarn[a.id].prodStart = d.prodStart; _lsBarn[a.id].baseProdStart = d.prodStart; } } });
    } else if (_dbBarnIsSet) {
      // DB ma pusty {} (reset admina) — wyzeruj owned w localStorage zamiast re-synchronizować
      ANIMALS.forEach(a => { _lsBarn[a.id] = { ..._lsBarn[a.id], owned: 0, prodStart: 0, baseProdStart: 0, storage: 0 }; });
    } else if (uid) {
      // DB null = nowe konto bez barn_state — synchronizuj ze stanu lokalnego
      ANIMALS.forEach(a => { const st = _lsBarn[a.id]; if (st && st.owned > 0) void supabase.rpc("sync_barn_owned", { p_user_id: uid, p_animal_id: a.id, p_new_owned: st.owned, p_new_slots: st.slots }); });
    }
    barnStateRef.current = _lsBarn;
    setBarnState_(_lsBarn);
    // Sad: ładuj z localStorage, nadpisz owned/prodStart z DB (DB autorytarne dla timingów)
    const _lsOrch = lsLoadMigrate(ORCHARD_STATE_KEY, uid, s => migrateOrchardState(JSON.parse(s)), defaultOrchardState);
    const _dbOrch = source.orchard_state as Record<string, { owned: number; prodStart: number }> | null | undefined;
    const _dbOrchHasData = !!(_dbOrch && Object.values(_dbOrch).some(v => ((v as { owned?: number })?.owned ?? 0) > 0));
    if (_dbOrchHasData) {
      TREES.forEach(t => { const d = (_dbOrch as Record<string,{owned:number;prodStart:number}>)[t.id]; if (d) { if (typeof d.owned === "number") _lsOrch[t.id].owned = d.owned; if (typeof d.prodStart === "number" && d.prodStart > 0) _lsOrch[t.id].prodStart = d.prodStart; } });
    } else if (uid) {
      TREES.forEach(t => { const st = _lsOrch[t.id]; if (st && st.owned > 0) void supabase.rpc("sync_orchard_owned", { p_user_id: uid, p_tree_id: t.id, p_new_owned: st.owned }); });
    }
    setOrchardState_(_lsOrch);
    setDailyProgress(loadDP(uid));
    // Kompost: ładuj pojedynczą partię (nowy format) lub migruj stary format tablicowy
    const loadedBatch = lsLoadMigrate(KOMPOST_BATCHES_KEY, uid, s => {
      const parsed = JSON.parse(s);
      // Nowy format: pojedynczy obiekt { fill, scoreSum, cropIds }
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object" && "fill" in parsed) {
        const b = parsed as {fill?:unknown;scoreSum?:unknown;cropIds?:unknown};
        return {
          fill: Math.max(0, Math.min(KOMPOST_BATCH_SIZE, Math.floor(Number(b.fill) || 0))),
          scoreSum: Math.max(0, Number(b.scoreSum) || 0),
          cropIds: Array.isArray(b.cropIds) ? (b.cropIds as unknown[]).filter((x): x is string => typeof x === "string") : [],
        } as CompostBatch;
      }
      // Stary format: tablica partii → sumujemy do jednej dużej partii
      if (Array.isArray(parsed)) {
        const arr = parsed as Array<{fill?:unknown;scoreSum?:unknown;cropIds?:unknown}>;
        const totalFill = arr.reduce((s, b) => s + Math.max(0, Math.min(10, Math.floor(Number(b?.fill) || 0))), 0);
        const totalScore = arr.reduce((s, b) => s + Math.max(0, Number(b?.scoreSum) || 0), 0);
        const allCropIds = Array.from(new Set(arr.flatMap(b => Array.isArray(b?.cropIds) ? (b.cropIds as unknown[]).filter((x): x is string => typeof x === "string") : [])));
        return { fill: Math.min(KOMPOST_BATCH_SIZE, totalFill), scoreSum: totalScore, cropIds: allCropIds } as CompostBatch;
      }
      return { fill: 0, scoreSum: 0, cropIds: [] } as CompostBatch;
    }, () => ({ fill: 0, scoreSum: 0, cropIds: [] } as CompostBatch));
    // Migracja legacy flat counter
    try {
      const legacyKey = lsKey(KOMPOST_KEY, uid);
      const sOld = localStorage.getItem(legacyKey) ?? (uid ? localStorage.getItem(KOMPOST_KEY) : null);
      if (sOld) {
        const pending = Math.max(0, Math.floor(Number(sOld) || 0));
        if (pending > 0) loadedBatch.fill = Math.min(KOMPOST_BATCH_SIZE, loadedBatch.fill + pending);
        localStorage.removeItem(legacyKey); localStorage.removeItem(KOMPOST_KEY);
      }
    } catch {}
    setKompostBatch(loadedBatch);

    return nextProfile;
  }

  function extractRpcProfile(data: unknown) {
    return Array.isArray(data) ? data[0] : data;
  }

  const displayLocation = profile?.location ?? DEFAULT_LOCATION;
  // Symulacja client-side poziomowania dla wyświetlania.
  // Potrzebna gdy profile.xp > getXpForLevel(level) — np. po zmianie tabeli XP między zbiorami.
  // SQL zaktualizuje DB przy następnym zbiorze; client pokazuje stan "jak po aktualizacji".
  {
    // blok tylko dla type-narrowing — wartości trafiają do zmiennych zewnętrznych poniżej
  }
  const _rawLevel = profile?.level ?? DEFAULT_LEVEL;
  const _rawXp    = profile?.xp    ?? DEFAULT_XP;
  let _simLevel   = _rawLevel;
  let _simXp      = _rawXp;
  // Użyj xp_to_next_level z DB jako progu dla bieżącego poziomu — DB jest źródłem prawdy.
  // getXpForLevel używamy tylko dla poziomów powyżej bieżącego (po ewentualnym awansie).
  let _simToNext  = profile?.xp_to_next_level ?? (_simLevel > 0 ? getXpForLevel(_simLevel) : DEFAULT_XP_TO_NEXT_LEVEL);
  while (_simLevel < MAX_LEVEL && _simToNext > 0 && _simXp >= _simToNext) {
    _simXp    -= _simToNext;
    _simLevel += 1;
    _simToNext = getXpForLevel(_simLevel);
  }
  const displayLevel       = _simLevel;
  const displayXp          = _simXp;
  const displayXpToNextLevel = _simLevel >= MAX_LEVEL ? 0 : _simToNext;
  const displayMoney = profile?.money ?? DEFAULT_MONEY;
  const currentMap = profile?.current_map ?? getMapForLevel(profile?.level);
  const canUseTestTools = ["tester", "admin", "owner"].includes(profile?.role ?? "");
  const canEditHitboxes = ["tester", "admin", "owner"].includes(profile?.role ?? "");
  const isTester = profile?.role === 'tester';
  const isOnFarmMap = !!profile && currentMap.startsWith("farm");
  const isOnCityMap = !!profile && currentMap === "city";
  const isOnPanMap = isOnFarmMap || isOnCityMap;
  const backgroundMap = getDisplayBackgroundMap(currentMap);
  // Per-mapowe pozycje hitboxów i etykiet — klucz to backgroundMap
  const FARM_HITBOX_OVERRIDES: Record<string, Record<string,{left:number,top:number,width:number,height:number}>> = {
    farm5: {
      dom:         {left:21.2, top:11.5, width:13.7, height:30.0},
      stodola:     {left:46.9, top:49.5, width:18.8, height:27.0},
      doMiasta:    {left:69.2, top:0.0,  width:15.4, height:17.3},
      polaUprawne: {left:43.0, top:8.5,  width:24.3, height:32.8},
      ul:          {left:72.1, top:67.9, width:15.8, height:22.4},
      lada:        {left:19.0, top:48.1, width:9.8,  height:19.8},
      kompostownik:{left:74.6, top:17.7, width:9.6,  height:19.7},
      sad:         {left:27.0, top:68.7, width:14.7, height:28.6},
    },
    farm10: {
      dom:         {left:18.4, top:11.5, width:13.7, height:30.0},
      stodola:     {left:47.0, top:57.5, width:18.8, height:27.0},
      doMiasta:    {left:63.3, top:0.1,  width:12.6, height:13.4},
      polaUprawne: {left:42.6, top:13.6, width:20.0, height:30.9},
      ul:          {left:73.7, top:69.6, width:12.6, height:25.2},
      lada:        {left:14.5, top:48.7, width:12.5, height:20.5},
      kompostownik:{left:70.8, top:17.2, width:9.7,  height:19.8},
      sad:         {left:16.1, top:76.8, width:18.7, height:19.0},
    },
    farm15: {
      dom:         {left:17.0, top:10.0, width:13.7, height:30.0},
      stodola:     {left:45.2, top:55.8, width:18.8, height:27.0},
      doMiasta:    {left:64.7, top:0.0,  width:12.6, height:13.4},
      polaUprawne: {left:41.9, top:11.7, width:22.2, height:31.0},
      ul:          {left:74.1, top:69.6, width:12.6, height:25.2},
      lada:        {left:13.8, top:47.0, width:12.5, height:20.5},
      kompostownik:{left:73.5, top:18.1, width:11.0, height:28.5},
      sad:         {left:11.9, top:74.0, width:20.8, height:21.2},
    },
    farm20: {
      dom:         {left:22.4, top:9.6,  width:13.7, height:30.0},
      stodola:     {left:42.3, top:57.4, width:19.6, height:29.1},
      doMiasta:    {left:64.5, top:0.0,  width:12.6, height:13.4},
      polaUprawne: {left:45.1, top:13.7, width:22.2, height:31.0},
      ul:          {left:74.0, top:67.3, width:12.6, height:25.2},
      lada:        {left:17.7, top:46.2, width:12.5, height:20.5},
      kompostownik:{left:73.5, top:18.1, width:11.0, height:20.5},
      sad:         {left:10.7, top:73.0, width:20.8, height:21.2},
    },
    farm25: {
      dom:         {left:14.3, top:17.0, width:17.3, height:26.1},
      stodola:     {left:43.0, top:58.0, width:19.6, height:29.1},
      doMiasta:    {left:65.4, top:0.0,  width:12.6, height:13.4},
      polaUprawne: {left:41.1, top:13.8, width:25.7, height:30.6},
      ul:          {left:75.8, top:66.7, width:12.6, height:25.2},
      lada:        {left:13.3, top:54.1, width:12.5, height:20.5},
      kompostownik:{left:73.2, top:23.7, width:11.0, height:20.5},
      sad:         {left:11.5, top:78.2, width:20.8, height:21.2},
    },
    farm30: {
      dom:         {left:14.2, top:17.2, width:18.2, height:26.1},
      stodola:     {left:41.9, top:55.8, width:20.2, height:29.8},
      doMiasta:    {left:65.4, top:0.0,  width:13.3, height:13.9},
      polaUprawne: {left:38.9, top:16.0, width:28.2, height:28.0},
      ul:          {left:75.0, top:64.7, width:14.4, height:25.8},
      lada:        {left:13.6, top:54.2, width:15.5, height:20.0},
      kompostownik:{left:73.1, top:20.7, width:13.3, height:23.4},
      sad:         {left:11.5, top:78.1, width:20.8, height:21.2},
    },
  };
  const FARM_LABEL_OVERRIDES: Record<string, Record<string,{left:number,top:number}>> = {
    farm5: {
      dom:         {left:28.7, top:25.3},
      stodola:     {left:57.2, top:62.7},
      doMiasta:    {left:77.4, top:11.3},
      polaUprawne: {left:55.1, top:22.6},
      ul:          {left:79.8, top:81.6},
      lada:        {left:23.6, top:57.9},
      kompostownik:{left:78.7, top:27.5},
      sad:         {left:33.8, top:80.5},
    },
    farm10: {
      dom:         {left:26.0, top:24.0},
      stodola:     {left:57.2, top:62.7},
      doMiasta:    {left:69.2, top:10.3},
      polaUprawne: {left:52.1, top:26.3},
      ul:          {left:79.8, top:84.8},
      lada:        {left:21.0, top:52.9},
      kompostownik:{left:74.9, top:26.7},
      sad:         {left:26.9, top:83.8},
    },
    farm15: {
      dom:         {left:26.0, top:24.0},
      stodola:     {left:55.2, top:63.6},
      doMiasta:    {left:70.2, top:10.3},
      polaUprawne: {left:53.9, top:27.2},
      ul:          {left:80.2, top:85.2},
      lada:        {left:20.2, top:61.5},
      kompostownik:{left:78.3, top:27.9},
      sad:         {left:22.3, top:84.1},
    },
    farm20: {
      dom:         {left:26.0, top:24.0},
      stodola:     {left:51.6, top:65.9},
      doMiasta:    {left:70.2, top:10.3},
      polaUprawne: {left:53.9, top:27.2},
      ul:          {left:80.2, top:85.2},
      lada:        {left:20.2, top:61.5},
      kompostownik:{left:78.3, top:27.9},
      sad:         {left:22.3, top:84.1},
    },
    farm25: {
      dom:         {left:25.1, top:26.9},
      stodola:     {left:51.6, top:65.9},
      doMiasta:    {left:71.2, top:10.4},
      polaUprawne: {left:52.3, top:27.0},
      ul:          {left:81.2, top:75.3},
      lada:        {left:19.6, top:59.1},
      kompostownik:{left:78.4, top:33.0},
      sad:         {left:20.0, top:87.8},
    },
    farm30: {
      dom:         {left:25.1, top:26.9},
      stodola:     {left:51.6, top:65.9},
      doMiasta:    {left:71.2, top:10.4},
      polaUprawne: {left:52.3, top:27.0},
      ul:          {left:81.2, top:75.3},
      lada:        {left:21.5, top:58.6},
      kompostownik:{left:78.4, top:33.0},
      sad:         {left:20.0, top:87.8},
    },
  };
  const activeHitboxPos = FARM_HITBOX_OVERRIDES[backgroundMap] ?? navHitboxPos;
  const activeLabelPos  = FARM_LABEL_OVERRIDES[backgroundMap]  ?? navLabelPos;
  React.useEffect(() => {
    if ((currentMap === "city_townhall" || currentMap === "city_liga") && rankingData.length === 0 && !rankingLoading) {
      void loadRanking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMap]);

  const xpPercent = useMemo(() => {
    if (!displayXpToNextLevel || displayXpToNextLevel <= 0) return 0;
    return Math.max(0, Math.min(100, (displayXp / displayXpToNextLevel) * 100));
  }, [displayXp, displayXpToNextLevel]);

  const moneyFormatted = useMemo(() => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(displayMoney);
  }, [displayMoney]);

  const moneyFontSize = useMemo(() => {
    const len = moneyFormatted.length;
    if (len > 14) return "text-sm leading-tight";
    if (len > 11) return "text-base leading-tight";
    if (len > 8)  return "text-xl leading-tight";
    return "text-2xl";
  }, [moneyFormatted]);

  const availableCrops = CROPS.filter((crop) => displayLevel >= crop.unlockLevel);
  const cropsInInventory = availableCrops.filter((crop) => (seedInventory[crop.id] ?? 0) > 0);

  function moveSelection(direction: "up" | "down" | "left" | "right") {
    const current = selectedPlotId ?? 1;

    let row = Math.floor((current - 1) / 10);
    let col = (current - 1) % 10;

    if (direction === "up" && row > 0) row -= 1;
    if (direction === "down" && row < 9) row += 1;
    if (direction === "left" && col > 0) col -= 1;
    if (direction === "right" && col < 9) col += 1;

    const nextPlotId = row * 10 + col + 1;
    setSelectedPlotId(nextPlotId);
  }

  function confirmSelectedPlot() {
    if (!selectedPlotId) return;

    if (!isPlotUnlocked(selectedPlotId)) {
      setPlotToBuy(selectedPlotId);
      return;
    }

    if (selectedTool === "watering_can") {
      void handleWaterPlot(selectedPlotId);
      return;
    }

    if (selectedTool === "sickle") {
      void handleHarvestPlot(selectedPlotId);
      return;
    }

    if (selectedSeedId) {
      handlePlantFromSelectedSeed(selectedPlotId);
      return;
    }

    const plot = getPlotCrop(selectedPlotId);
    if (plot.cropId && isCropReady(selectedPlotId)) {
      void handleHarvestPlot(selectedPlotId);
      return;
    }

    const _hasSeedsInPack = Object.entries(seedInventoryRef.current).some(
      ([k, v]) => !isCompostKey(k) && !isGuideCompostKey(k) && (v ?? 0) > 0,
    );
    if (!_hasSeedsInPack) {
      setMessage({
        type: "info",
        title: "Brak nasion w plecaku",
        text: "Kup nasiona w sklepie, żeby móc sadzić.",
      });
    } else {
      setMessage({
        type: "info",
        title: `Pole #${selectedPlotId}`,
        text: "Wybierz nasiono z plecaka albo kliknij narzędzie.",
      });
    }
  }

  function getPlotCrop(plotId: number) {
    return plotCrops[plotId] ?? buildEmptyPlotCrop();
  }

  function getPlantedCrop(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId) return null;
    return CROPS.find((item) => item.id === plot.cropId) ?? null;
  }

  function getEffectiveGrowthTimeMs(plotId: number) {
    const plot = getPlotCrop(plotId);
    const crop = getPlantedCrop(plotId);
    if (!crop) return 0;

    // Wiedza efektywna = bazowa + flat bonus z eq (np. Kapelusz Mistrza Farmy +5)
    const wiedzaEffective = effectiveStats.wiedza + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
    const wiedzaBonus = calcStatEffect(wiedzaEffective, WIEDZA_RATE) / 100;
    const wiedzaMult = Math.max(WIEDZA_MULT_MIN, 1 - wiedzaBonus);
    const hiveMult = Math.max(HIVE_MULT_MIN, 1 - hiveData.level * 0.02);
    // Zamrożony mult stat (wiedza×ul) z momentu sadzenia — upgrade po sadzeniu nie skraca rosnących upraw
    // Źródło prawdy: frozenStatMult w DB (JSONB). Fallback: localStorage (dla starych pól bez DB-wartości).
    const _fsmKey = profile?.id ? `plonopolis_fsm_${profile.id}_${plotId}` : null;
    const _frozenRaw = _fsmKey && typeof window !== "undefined" ? localStorage.getItem(_fsmKey) : null;
    const statMult = (plot.frozenStatMult != null)
      ? plot.frozenStatMult
      : (_frozenRaw !== null ? parseFloat(_frozenRaw) : wiedzaMult * hiveMult);
    // Bonus kompostu Wzrostu: -5/10/15% czasu wzrostu (× boost ze Sadownika)
    const sadownikEff = effectiveStats.sadownik + getEquipFlatBonus(" pkt Sadownika", charEquipped);
    const compostBoost = 1 + calcStatEffect(sadownikEff, 0.005) / 100;
    const compostMult = plot.compostBonus?.type === "guide"
      ? 0.25  // Kompost Przewodnika: flat ×0.25, ale globalne min 0.35 zawsze wygrywa → efektywnie −65%
      : (plot.compostBonus?.type === "growth")
      ? Math.max(COMPOST_MULT_MIN, 1 - (plot.compostBonus.value * compostBoost / 100))
      : 1;
    let totalMult: number;
    if (plot.watered) {
      const zaradnoscEff = effectiveStats.zaradnosc + getEquipFlatBonus(" pkt Zaradnosci", charEquipped);
      const zaradnoscBonus = calcStatEffect(zaradnoscEff, ZARADNOSC_RATE) / 100;
      // Bonus z eq: % efekt podlewania (addytywny); pkt Zaradnosci wchłania dawne "% efekt wody"
      const waterEqPct = getEquipBonusPct("% efekt podlewania", charEquipped) / 100;
      const totalWaterReduction = WATER_BASE + zaradnoscBonus + waterEqPct; // addytywny, bez capa
      const waterMult = Math.max(WATER_MULT_MIN, 1 - totalWaterReduction);
      totalMult = waterMult * statMult * compostMult;
    } else {
      totalMult = statMult * compostMult;
    }
    // Globalne minimum: nawet z full buildem nie schodzimy poniżej GROWTH_GLOBAL_MIN_MULT bazowego czasu
    return Math.round(crop.growthTimeMs * Math.max(GROWTH_GLOBAL_MIN_MULT, totalMult));
  }

  function getGrowthProgress(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return 0;

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) return 0;

    const elapsed = Date.now() - plot.plantedAt;
    return Math.max(0, Math.min(1, elapsed / getEffectiveGrowthTimeMs(plotId)));
  }

  function getGrowthStage(plotId: number) {
    const progress = getGrowthProgress(plotId);

    if (progress < 0.2) return 1;
    if (progress < 0.4) return 2;
    if (progress < 0.6) return 3;
    if (progress < 0.8) return 4;
    return 5;
  }

  function isCropReady(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return false;

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) return false;

    return Date.now() - plot.plantedAt >= getEffectiveGrowthTimeMs(plotId);
  }


  function getCropStageSprite(cropId: string, stage: number): string | null {
    const STAGED: Record<string, string> = {
      "carrot": "/uprawy/carrot",
      "test_nasiono": "/uprawy/carrot",
    };
    const base = STAGED[cropId];
    if (!base) return null;
    return `${base}_${stage}.gif`;
  }
  function getRemainingGrowthSeconds(plotId: number) {
    const plot = getPlotCrop(plotId);
    if (!plot.cropId || !plot.plantedAt) return 0;

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) return 0;

    const remaining = getEffectiveGrowthTimeMs(plotId) - (Date.now() - plot.plantedAt);
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  function formatHMS(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  // ─── Ujednolicona kolejka akcji polowych — sekwencyjne przetwarzanie ───

  function enqueuePlotAction(plotId: number, kind: string, execute: () => Promise<void>) {
    if (!profile) return;
    const _setQueued = kind === "harvest" ? setQueuedHarvestPlotIds : kind === "plant" ? setQueuedPlantPlotIds : kind === "water" ? setQueuedWaterPlotIds : null;
    const wrappedExecute = _setQueued
      ? async () => { try { await execute(); } finally { _setQueued(prev => { const s = new Set(prev); s.delete(plotId); return s; }); } }
      : execute;
    if (kind === "plant") {
      if (plantActiveRef.current === plotId || plantQueueRef.current.some(a => a.plotId === plotId)) return;
      plantQueueRef.current = [...plantQueueRef.current, { plotId, kind, execute: wrappedExecute }];
      if (_setQueued) _setQueued(prev => { const s = new Set(prev); s.add(plotId); return s; });
      if (!plantProcessingRef.current) void processPlantQueue();
    } else if (kind === "water") {
      if (waterActiveRef.current === plotId || waterQueueRef.current.some(a => a.plotId === plotId)) return;
      waterQueueRef.current = [...waterQueueRef.current, { plotId, kind, execute: wrappedExecute }];
      if (_setQueued) _setQueued(prev => { const s = new Set(prev); s.add(plotId); return s; });
      if (!waterProcessingRef.current) void processWaterQueue();
    } else if (kind === "harvest") {
      if (harvestActiveRef.current === plotId || harvestQueueRef.current.some(a => a.plotId === plotId)) return;
      harvestQueueRef.current = [...harvestQueueRef.current, { plotId, kind, execute: wrappedExecute }];
      if (_setQueued) _setQueued(prev => { const s = new Set(prev); s.add(plotId); return s; });
      if (!harvestProcessingRef.current) void processHarvestQueue();
    }
  }

  async function processPlantQueue(): Promise<void> {
    if (plantProcessingRef.current) return;
    plantProcessingRef.current = true;
    try {
      while (plantQueueRef.current.length > 0) {
        const item = plantQueueRef.current[0];
        plantQueueRef.current = plantQueueRef.current.slice(1);
        plantActiveRef.current = item.plotId;
        await item.execute();
        plantActiveRef.current = null;
      }
    } finally { plantProcessingRef.current = false; plantActiveRef.current = null; }
  }

  async function processWaterQueue(): Promise<void> {
    if (waterProcessingRef.current) return;
    waterProcessingRef.current = true;
    try {
      while (waterQueueRef.current.length > 0) {
        const item = waterQueueRef.current[0];
        waterQueueRef.current = waterQueueRef.current.slice(1);
        waterActiveRef.current = item.plotId;
        await item.execute();
        waterActiveRef.current = null;
      }
    } finally { waterProcessingRef.current = false; waterActiveRef.current = null; }
  }

  async function processHarvestQueue(): Promise<void> {
    if (harvestProcessingRef.current) return;
    harvestProcessingRef.current = true;
    try {
      while (harvestQueueRef.current.length > 0) {
        const item = harvestQueueRef.current[0];
        harvestQueueRef.current = harvestQueueRef.current.slice(1);
        harvestActiveRef.current = item.plotId;
        await item.execute();
        harvestActiveRef.current = null;
      }
    } finally { harvestProcessingRef.current = false; harvestActiveRef.current = null; }
  }

  async function handleWaterPlot(plotId: number, _skipTimer = false, _skipCropCheck = false) {
    if (!profile) return;

    if (!_skipTimer) {
      if (!_skipCropCheck) {
        const _pv = getPlotCrop(plotId);
        const _cv = getPlantedCrop(plotId);
        if (!_cv || !_pv.cropId) {
          setMessage({ fieldOnly: true, type: "info", title: "Brak uprawy", text: "Najpierw posadź roślinę na tym polu." });
          return;
        }
        if (_pv.watered) {
          setMessage({ fieldOnly: true, type: "info", title: "Pole już podlane", text: "To pole zostało już podlane." });
          return;
        }
        if (isCropReady(plotId)) {
          setMessage({ fieldOnly: true, type: "info", title: "Uprawa gotowa", text: "Ta uprawa jest już gotowa do zbioru." });
          return;
        }
      }
      enqueuePlotAction(plotId, "water", async () => {
        const _fp = plotCropsRef.current[plotId];
        if (!_fp?.cropId || _fp.watered || isCropReady(plotId)) {
          setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });
          return;
        }
        setPendingFieldActions(prev => ({ ...prev, [plotId]: { kind: "water", startMs: Date.now(), durationMs: BASE_WATER_MS } }));
        await new Promise<void>(resolve => setTimeout(resolve, BASE_WATER_MS));
        await handleWaterPlot(plotId, true);
      });
      return;
    }

    // ─── _skipTimer = true — timer dobiegł końca, fresh check przed RPC ───
    {
      const _fp = plotCropsRef.current[plotId];
      if (!_fp?.cropId || _fp.watered || isCropReady(plotId)) {
        if (process.env.NODE_ENV !== "production") console.debug("[water overlay] clear (skip-fresh)", { plotId, fp: _fp });
        setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });
        return;
      }
    }
    // Zdejmij wskaźnik paska, kontynuuj RPC
    if (process.env.NODE_ENV !== "production") console.debug("[water overlay] clear (before RPC)", { plotId });
    setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });

    const plot = getPlotCrop(plotId);
    const crop = getPlantedCrop(plotId);
    if (!crop || !plot.cropId) return; // guard po fresh check

    // Zachowaj bonus kompostu z pola PRZED wywołaniem RPC (na wypadek gdyby serwer go zgubił)
    const _preservedCompostBonus = plot.compostBonus ?? null;

    const { data, error } = await supabase.rpc("game_water_plot", {
      p_plot_id: plotId,
    });

    if (error) {
      setMessage({ fieldOnly: true,
        type: "error",
        title: "Błąd podlewania",
        text: error.message,
      });
      return;
    }

    await applyProfileState(extractRpcProfile(data));

    if (tutorialStep === 9 && tutorialPlotIds.includes(plotId)) {
      const _newWatered = tutorialWateredIds.includes(plotId) ? tutorialWateredIds : [...tutorialWateredIds, plotId];
      setTutorialWateredIds(_newWatered);
      // Advance do step 10 obsługuje polling useEffect — czeka na faktyczną gotowość upraw
    }

    // ─── compostBonus restore + tutorial step 9 speedup ───
    // Używa danych z odpowiedzi RPC jako bazy (już zatwierdzone w DB, bez dodatkowego fetcha).
    // Speedup aplikujemy tylko dla aktualnie podlewanego pola (per-plot, nie batch).
    const _needsCompostRestore = Boolean(_preservedCompostBonus);
    const _tutorialStep9 = tutorialStep === 9 && tutorialPlotIds.includes(plotId);
    if ((_needsCompostRestore || _tutorialStep9) && profile?.id) {
      // Baza: dane z odpowiedzi RPC (już zapisane w DB przez SQL funkcję)
      const _rpcRaw = extractRpcProfile(data) as { plot_crops?: unknown } | null;
      const _rpcPlots = parsePlotCrops(_rpcRaw?.plot_crops);
      // Guide compost (×0.25) zawsze spada poniżej GROWTH_GLOBAL_MIN_MULT (0.35)
      // → isCropReady zawsze używa 180000 × 0.35 = 63000ms, niezależnie od statystyk gracza
      const _guideEffGrowth = Math.round(15 * 60_000 * GROWTH_GLOBAL_MIN_MULT); // carrot growthTimeMs × global min mult
      const _tutorialSpeedupAt = Date.now() - (_guideEffGrowth - 15_000);
      const _updatedPlots: Record<number, PlotCropState> = {};
      // Baza dla aktualnego pola: RPC → lokalny ref (fallback gdy RPC zgubił dane)
      const _currPlot = _rpcPlots[plotId] ?? plotCropsRef.current[plotId];
      // compostBonus: z RPC jeśli jest, inaczej zachowany przed RPC-em
      const _resolvedBonus = _currPlot?.compostBonus ?? _preservedCompostBonus ?? null;
      // 1. compostBonus restore — jeśli RPC zgubił bonus kompostu dla aktualnego pola
      if (_needsCompostRestore && _currPlot && !_currPlot.compostBonus) {
        _updatedPlots[plotId] = { ..._currPlot, compostBonus: _preservedCompostBonus! };
      }
      // 2. Speedup dla tutorial step 9 — tylko aktualnie podlewane pole
      // Warunek: marchewka na polu tutoriala (niezależnie od typu bonusu kompostu)
      if (_tutorialStep9) {
        const _tPlot = _updatedPlots[plotId] ?? _currPlot;
        if (_tPlot?.cropId === "carrot" && _tPlot?.plantedAt != null) {
          _updatedPlots[plotId] = { ..._tPlot, ...(_resolvedBonus ? { compostBonus: _resolvedBonus } : {}), plantedAt: _tutorialSpeedupAt };
        }
      }
      if (Object.keys(_updatedPlots).length > 0) {
        setPlotCrops(prev => ({ ...prev, ..._updatedPlots }));
        const _safeUpdPlots = { ..._rpcPlots, ..._updatedPlots };
        const { error: _writeErr } = await supabase.from("profiles").update({
          plot_crops: serializePlotCrops(_safeUpdPlots) as unknown as Record<string, unknown>,
        }).eq("id", profile!.id);
        if (process.env.NODE_ENV !== "production") {
          console.debug("[tutorial step9 speedup]", {
            wateredPlotId: plotId,
            speedupApplied: Object.entries(_updatedPlots)
              .filter(([, p]) => p.plantedAt === _tutorialSpeedupAt)
              .map(([id]) => Number(id)),
            newPlantedAt: _tutorialSpeedupAt,
            dbOk: !_writeErr,
            dbError: _writeErr?.message ?? null,
          });
        }
      }
    }

    const _zaradnoscEff = effectiveStats.zaradnosc + getEquipFlatBonus(" pkt Zaradnosci", charEquipped);
    const _zaradBonus = calcStatEffect(_zaradnoscEff, ZARADNOSC_RATE) / 100;
    const _waterEqPct = getEquipBonusPct("% efekt podlewania", charEquipped) / 100;
    const _zaradPct = (WATER_BASE + _zaradBonus + _waterEqPct) * 100;
    setMessage({ fieldOnly: true,
      type: "success",
      title: "Podlano pole 💧",
      text: _zaradPct > 0
        ? `${crop.name} urośnie o ${_zaradPct.toFixed(1)}% szybciej (min 5% + Zaradność efektywna ${_zaradnoscEff}/100).`
        : `${crop.name} podlana. Rozwijaj Zaradnosc, aby przyspieszac wzrost.`,
    });
  }

  async function handlePlantFromSelectedSeed(plotId: number, overrideSeedId?: string, _fromDrag = false) {
    if (!profile) return;
    const effectiveSeedId = overrideSeedId ?? selectedSeedId;

    if (!effectiveSeedId) {
      if (!_fromDrag) setMessage({ fieldOnly: true, type: "info", title: "Brak nasiona", text: "Wybierz nasiono z plecaka." });
      return;
    }

    const { baseCropId: _baseCropId, quality: _seedQuality } = parseQualityKey(effectiveSeedId);
    if (_seedQuality === "rotten") {
      if (!_fromDrag) setMessage({ fieldOnly: true, type: "info", title: "Nie można posadzić", text: "Zepsuta uprawa nie nadaje się do sadzenia. Może przydać się do kompostu." });
      return;
    }
    const crop = CROPS.find((item) => item.id === _baseCropId);
    if (!crop) return;

    const plot = getPlotCrop(plotId);

    if (plot.cropId) {
      if (!_fromDrag) setMessage({ fieldOnly: true, type: "info", title: "Pole zajęte", text: "Na tym polu już coś rośnie." });
      return;
    }

    const amount = seedInventoryRef.current[effectiveSeedId] ?? 0;
    if (amount <= 0) {
      if (!_fromDrag) setMessage({ fieldOnly: true, type: "info", title: "Brak nasion", text: "Nie masz już tych nasion w plecaku." });
      return;
    }

    // Blokada: akcja sadzenia na tym polu już jest aktywna lub w kolejce
    if (
      plantActiveRef.current === plotId ||
      plantQueueRef.current.some(a => a.plotId === plotId)
    ) {
      if (!_fromDrag) setMessage({ fieldOnly: true, type: "info", title: "Akcja w toku", text: "Poczekaj aż zakończy się obecna akcja na polu." });
      return;
    }

    // Twarda blokada tutorial step 7: tylko pola z Kompostem Przewodnika
    if (tutorialStep === 7 && plot.compostBonus?.type !== "guide") {
      if (!_fromDrag) setMessage({ fieldOnly: true, type: "info", title: "Przewodnik", text: "Najpierw użyj Kompostu Przewodnika na tym polu." });
      return;
    }

    // Odlicz nasiono z ref natychmiast — guard dla dedupliku przy szybkim drag/klik
    // setSeedInventory (UI) wywoływane dopiero wewnątrz execute, gdy kolejka dochodzi do tego pola
    seedInventoryRef.current = { ...seedInventoryRef.current, [effectiveSeedId]: (seedInventoryRef.current[effectiveSeedId] ?? 0) - 1 };

    // Gdy skończyły się nasiona — odznacz automatycznie
    if ((seedInventoryRef.current[effectiveSeedId] ?? 0) <= 0 && selectedSeedId === effectiveSeedId) {
      setSelectedSeedId(null);
    }

    const _plantDurMs = BASE_PLANT_MS;

    enqueuePlotAction(plotId, "plant", async () => {
      const _fp = plotCropsRef.current[plotId];
      if (_fp?.cropId) {
        // Pole zajęte — zwróć nasiono do ref (UI nie było jeszcze odliczone)
        seedInventoryRef.current = { ...seedInventoryRef.current, [effectiveSeedId]: (seedInventoryRef.current[effectiveSeedId] ?? 0) + 1 };
        return;
      }
      // Odlicz nasiono w UI dopiero teraz — gdy kolejka dochodzi do tego pola
      setSeedInventory(prev => ({ ...prev, [effectiveSeedId]: (prev[effectiveSeedId] ?? 0) - 1 }));
      setPendingFieldActions(prev => ({
        ...prev,
        [plotId]: { kind: "plant", startMs: Date.now(), durationMs: _plantDurMs, seedId: effectiveSeedId },
      }));
      await new Promise<void>(resolve => setTimeout(resolve, _plantDurMs));
      await executePlantRpc(plotId, effectiveSeedId, _baseCropId, _seedQuality);
    });
  }

  // Akcja na polu podczas przeciągania — cicha wersja bez komunikatów błędów
  function tryApplyFieldAction(plotId: number) {
    if (!isDraggingPlantRef.current) return;
    if (dragPlantedFieldsRef.current.has(plotId)) return;
    if (!isPlotUnlocked(plotId)) return;
    // Dedup przez ref (nie React state) — unika stale closure przy szybkim drag
    if (plantActiveRef.current === plotId || waterActiveRef.current === plotId || harvestActiveRef.current === plotId ||
        plantQueueRef.current.some(a => a.plotId === plotId) || waterQueueRef.current.some(a => a.plotId === plotId) || harvestQueueRef.current.some(a => a.plotId === plotId)) {
      if (process.env.NODE_ENV !== "production") console.debug("[drag] skip — plotId in queue/active", { plotId });
      return;
    }
    // Świeże dane pola z ref (plotCropsRef zawsze aktualny po applyProfileState)
    const _fp = plotCropsRef.current[plotId];
    if (process.env.NODE_ENV !== "production") console.debug("[drag] tryApplyFieldAction", { plotId, cropId: _fp?.cropId, tool: selectedTool, seed: selectedSeedId });

    // Konewka
    if (selectedTool === "watering_can") {
      if (!_fp?.cropId || _fp.watered || isCropReady(plotId)) return;
      dragPlantedFieldsRef.current.add(plotId);
      void handleWaterPlot(plotId);
      return;
    }
    // Sierp
    if (selectedTool === "sickle") {
      if (!_fp?.cropId || !isCropReady(plotId)) return;
      dragPlantedFieldsRef.current.add(plotId);
      void handleHarvestPlot(plotId, false, undefined, true);
      return;
    }
    // Kompost
    if (selectedSeedId && isCompostKey(selectedSeedId)) {
      if (_fp?.cropId || _fp?.compostBonus) return;
      if ((seedInventoryRef.current[selectedSeedId] ?? 0) <= 0) { isDraggingPlantRef.current = false; return; }
      dragPlantedFieldsRef.current.add(plotId);
      void applyCompostToPlot(plotId, selectedSeedId);
      return;
    }
    // Nasiono
    if (selectedSeedId) {
      if (_fp?.cropId) return;
      if ((seedInventoryRef.current[selectedSeedId] ?? 0) <= 0) { isDraggingPlantRef.current = false; return; }
      dragPlantedFieldsRef.current.add(plotId);
      void handlePlantFromSelectedSeed(plotId, undefined, true);
      return;
    }
    // Brak narzędzia/nasiona — zbierz gotowy plon
    if (_fp?.cropId && isCropReady(plotId)) {
      dragPlantedFieldsRef.current.add(plotId);
      void handleHarvestPlot(plotId, false, undefined, true);
    }
  }

  async function executePlantRpc(plotId: number, effectiveSeedId: string, _baseCropId: string, _seedQuality: string | null) {
    // Sprzątanie pendingActions niezależnie od wyniku — try/finally zawsze odpala
    const _clearPending = () => setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });

    // Przywrócenie optymistycznie odliczonego nasiona przy błędzie
    const _restoreSeed = () => {
      setSeedInventory(prev => ({ ...prev, [effectiveSeedId]: (prev[effectiveSeedId] ?? 0) + 1 }));
      seedInventoryRef.current = { ...seedInventoryRef.current, [effectiveSeedId]: (seedInventoryRef.current[effectiveSeedId] ?? 0) + 1 };
    };

    try {
      if (!profile) { _restoreSeed(); return; }
      const crop = CROPS.find((item) => item.id === _baseCropId);
      if (!crop) { _restoreSeed(); return; }
      // Re-walidacja po upływie timera (gracz mógł w międzyczasie coś zmienić)
      // Używamy refs do FRESH state zamiast captured closures
      const _freshPlot: PlotCropState | undefined = plotCropsRef.current[plotId];
      if (_freshPlot?.cropId) {
        setMessage({ fieldOnly: true, type: "info", title: "Pole zajęte", text: "Pole zostało zajęte zanim akcja się zakończyła." });
        _restoreSeed();
        return;
      }
      const _freshInv = seedInventoryRef.current;
      const _freshAmount = _freshInv[effectiveSeedId] ?? 0;
      if (_freshAmount < 0) {
        setMessage({ fieldOnly: true, type: "info", title: "Brak nasion", text: "W międzyczasie skończyły się nasiona." });
        // Nie przywracamy — nasiono już zostało odliczone, inny plot je "zużył"
        return;
      }

      // Migracja formatu inwentarza (tylko dla starych kluczy bez sufiksu jakości, np. "carrot").
      // Nasiona w nowym formacie (np. "carrot_legendary") pomijają ten update —
      // ślepy zapis równoległy nadpisywałby stan DB po poprzednim atomicznym game_plant_crop.
      const _needsMigration = !effectiveSeedId.includes("_");
      if (_needsMigration && profile.id) {
        const _invForDb = { ..._freshInv, [effectiveSeedId]: (_freshAmount + 1) };
        await supabase
          .from("profiles")
          .update({ seed_inventory: serializeSeedInventory(_invForDb) })
          .eq("id", profile.id);
      }

      // Zachowaj bonus kompostu z pola PRZED wywołaniem RPC (na wypadek gdyby serwer go zgubił)
      const _preservedCompostBonus = _freshPlot?.compostBonus ?? null;
      // Snapshot bonusów kompostu WSZYSTKICH pól — applyProfileState może wymazać inne pola przy nadpisaniu plotCrops
      const _allCompostSnapshot: Record<number, CompostBonus> = {};
      for (const [_id, _p] of Object.entries(plotCropsRef.current)) {
        if (_p.compostBonus) _allCompostSnapshot[Number(_id)] = _p.compostBonus;
      }

      const _wiedzaEffPlant = effectiveStats.wiedza + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
      const _wiedzaMultPlant = Math.max(WIEDZA_MULT_MIN, 1 - calcStatEffect(_wiedzaEffPlant, WIEDZA_RATE) / 100);
      const _hiveMultPlant = Math.max(HIVE_MULT_MIN, 1 - hiveData.level * 0.02);
      const _frozenStatMult = _wiedzaMultPlant * _hiveMultPlant;

      const { data, error } = await supabase.rpc("game_plant_crop", {
        p_plot_id: plotId,
        p_crop_id: _baseCropId,
        p_seed_key: effectiveSeedId,
        p_planted_quality: _seedQuality ?? "good",
        p_frozen_stat_mult: _frozenStatMult,
      });
      if (error) {
        _restoreSeed();
        // Pole nie jest odblokowane w DB — zsynchronizuj lokalny stan z DB
        if (error.message?.includes("nie jest odblokowane") && profile?.id) {
          const { data: freshRow } = await supabase
            .from("profiles")
            .select("unlocked_plots, plot_obstacles")
            .eq("id", profile.id)
            .single();
          if (freshRow) {
            setUnlockedPlots(parseUnlockedPlots(freshRow.unlocked_plots));
            if (freshRow.plot_obstacles && typeof freshRow.plot_obstacles === "object") {
              setPlotObstacles(freshRow.plot_obstacles as Record<string, { type: string; cost: number }>);
            }
          } else {
            // Brak odpowiedzi — usuń pole z lokalnych odblokowanych
            setUnlockedPlots(prev => prev.filter(id => id !== plotId));
          }
          setMessage({ fieldOnly: true,
            type: "error",
            title: "Pole nie jest odblokowane",
            text: `Pole #${plotId} nie jest odblokowane w bazie danych. Stan lokalny został zsynchronizowany — kliknij pole, aby je odblokować.`,
          });
          return;
        }
        setMessage({ fieldOnly: true,
          type: "error",
          title: "Błąd sadzenia",
          text: error.message,
        });
        return;
      }

      await applyProfileState(extractRpcProfile(data));
      // Zapisz jakość zasadzonego nasiona (dla EXP przy zbiorze)
      if (typeof window !== "undefined" && profile?.id) {
        const _pqKey = `plonopolis_pq_${profile.id}_${plotId}`;
        localStorage.setItem(_pqKey, _seedQuality ?? "good");
        // Zamrożony mult statystyk — localStorage jako fallback gdy DB nie zwróci frozenStatMult
        localStorage.setItem(`plonopolis_fsm_${profile.id}_${plotId}`, String(_frozenStatMult));
      }

      // Przywróć bonusy kompostu dla INNYCH pól po applyProfileState
      // applyProfileState robi setPlotCrops(_loadedPlots) — serwer może nie zwrócić compostBonus dla pól których nie ruszał
      // UWAGA: aktualny plotId pomijamy — stan po RPC jest źródłem prawdy dla sadzonej działki
      const _restoredPlotsForDb: Record<number, PlotCropState> = {};
      if (Object.keys(_allCompostSnapshot).length > 0) {
        setPlotCrops(prev => {
          let _changed = false;
          const _merged = { ...prev };
          for (const [_sid, _bonus] of Object.entries(_allCompostSnapshot)) {
            const _pid = Number(_sid);
            if (_pid === plotId) continue; // plant RPC jest źródłem prawdy dla tej działki
            const _curr = _merged[_pid];
            if (_curr && !_curr.compostBonus) {
              _merged[_pid] = { ..._curr, compostBonus: _bonus };
              _restoredPlotsForDb[_pid] = _merged[_pid];
              _changed = true;
            }
          }
          return _changed ? _merged : prev;
        });
      }
      // Przywrócone komposty zapisz z powrotem do DB przez write chain
      // (serwer mógł zwrócić plot_crops bez compostBonus dla innych pól — DB by je straciło przy odświeżeniu)
      if (Object.keys(_restoredPlotsForDb).length > 0 && profile?.id) {
        const _profileIdForRestore = profile.id;
        const _restoredCopy = { ..._restoredPlotsForDb };
        compostWriteChainRef.current = compostWriteChainRef.current.then(async () => {
          const { data: _freshRow } = await supabase
            .from("profiles")
            .select("plot_crops")
            .eq("id", _profileIdForRestore)
            .single();
          const _dbPlots = parsePlotCrops(_freshRow?.plot_crops);
          let _needsWrite = false;
          const _mergedDb = { ..._dbPlots };
          for (const [_pid, _restoredPlot] of Object.entries(_restoredCopy)) {
            const _n = Number(_pid);
            if (!_mergedDb[_n]?.compostBonus) {
              _mergedDb[_n] = { ..._mergedDb[_n], compostBonus: _restoredPlot.compostBonus };
              _needsWrite = true;
            }
          }
          if (_needsWrite) {
            await supabase.from("profiles").update({
              plot_crops: serializePlotCrops(_mergedDb) as unknown as Record<string,unknown>,
            }).eq("id", _profileIdForRestore);
          }
        });
      }

      // Jeśli serwer zgubił bonus kompostu przy sadzeniu — przywróć go i zapisz
      if (_preservedCompostBonus && profile?.id) {
        // Pobierz świeże plot_crops — unika nadpisania równoległych zapisów (race condition)
        const { data: _freshRow } = await supabase
          .from("profiles")
          .select("plot_crops")
          .eq("id", profile.id)
          .single();
        const _freshPlots = parsePlotCrops(_freshRow?.plot_crops);
        const _freshEntry = _freshPlots[plotId];
        if (_freshEntry && !_freshEntry.compostBonus) {
          const _safeMerged = { ..._freshPlots, [plotId]: { ..._freshEntry, compostBonus: _preservedCompostBonus } };
          await supabase.from("profiles").update({
            plot_crops: serializePlotCrops(_safeMerged) as unknown as Record<string, unknown>,
          }).eq("id", profile.id);
        }
        // Zaktualizuj lokalny stan (niezależnie od DB — bezpieczne przez functional update)
        setPlotCrops(prev => {
          const _curr = prev[plotId];
          if (!_curr || _curr.compostBonus) return prev;
          return { ...prev, [plotId]: { ..._curr, compostBonus: _preservedCompostBonus } };
        });
      }

      if (tutorialStep === 7) {
        if (tutorialPlotIds.includes(plotId)) {
          // Functional update — unika stale closure race przy szybkim sadzeniu 3 pól
          setTutorialPlantedIds(prev => prev.includes(plotId) ? prev : [...prev, plotId]);
          // Licz z plotCropsRef (świeże po applyProfileState), nie ze stałego closure
          const _planted = tutorialPlotIds.filter(id => !!plotCropsRef.current[id]?.cropId).length;
          if (_planted >= 3) void advanceTutorialStep(8);
        } else if (tutorialPlotIds.length > 0) {
          setMessage({ fieldOnly: true, type: "info", title: "Przewodnik", text: "Posadź marchewki na polach z Kompostem Przewodnika." });
          return;
        }
      }
      setMessage({ fieldOnly: true,
        type: "success",
        title: "Posadzono uprawę",
        text: `Posadzono ${crop.name.toLowerCase()} na polu #${plotId}.`,
      });
    } finally {
      _clearPending();
    }
  }

  function getMaxPlotsForLevel(level: number) {
    // Poziom 1 → 20 pól; każdy poziom +2 pola; max 100
    return Math.min(20 + Math.max(level - 1, 0) * 2, MAX_FIELDS);
  }


  const unlockedPlotsCount = unlockedPlots.length;

  React.useEffect(() => {
    if (!profile?.id) return;
    const prev = prevLevelRef.current;
    if (!prev || prev === 0) { prevLevelRef.current = displayLevel; return; }
    if (displayLevel > prev) {
      prevLevelRef.current = displayLevel;
      localStorage.setItem(`plonopolis_prevlv_${profile.id}`, String(displayLevel));
    }
  }, [displayLevel, profile?.id]);

  useEffect(() => {
    document.body.style.overflowX = "hidden";
    return () => { document.body.style.overflowX = ""; };
  }, []);

  useEffect(() => {
    if (!isFieldViewOpen) { setHarvestLog([]); setIsFvHarvestModalOpen(false); return; }
  }, [isFieldViewOpen]);

  useEffect(() => {
    if (harvestLog.length === 0) { setHarvestCountdown(0); return; }
    if (tutorialStep === 12) { setHarvestCountdown(0); return; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harvestLog, tutorialStep]);

  useEffect(() => {
    if (!isFvHarvestModalOpen) { setIsDailyHarvestView(false); setDailyHarvestData(null); }
  }, [isFvHarvestModalOpen]);

  // ─── Farm music (zapamiętuje pozycję przy zmianie mapy) ───
  useEffect(() => {
    const isFarmMap = (FARM_MUSIC_MAPS as string[]).indexOf(currentMap) !== -1;
    if (!isFarmMap || !profile) {
      // Pauza zamiast resetu — przy powrocie wznowi w tym samym miejscu
      if (farmAudioRef.current && !farmAudioRef.current.paused) {
        farmAudioRef.current.pause();
      }
      return;
    }
    if (!farmAudioRef.current) {
      const audio = new Audio("/farm_music.mp3");
      audio.loop = true;
      audio.volume = musicMuted ? 0 : musicVolume;
      farmAudioRef.current = audio;
    }
    farmAudioRef.current.volume = musicMuted ? 0 : musicVolume;
    if (farmAudioRef.current.paused) {
      farmAudioRef.current.play().catch(() => {});
    }
    return () => {};
  }, [currentMap, musicVolume, musicMuted, profile]);

  // ─── City music (zapamiętuje pozycję przy zmianie mapy) ───
  useEffect(() => {
    const isCityMap = (CITY_MUSIC_MAPS as string[]).indexOf(currentMap) !== -1;
    if (!isCityMap || !profile) {
      // Pauza zamiast resetu — przy powrocie wznowi w tym samym miejscu
      if (cityAudioRef.current && !cityAudioRef.current.paused) {
        cityAudioRef.current.pause();
      }
      return;
    }
    if (!cityAudioRef.current) {
      const audio = new Audio("/city_music.mp3");
      audio.loop = true;
      audio.volume = musicMuted ? 0 : musicVolume * 0.7;
      cityAudioRef.current = audio;
    }
    cityAudioRef.current.volume = musicMuted ? 0 : musicVolume * 0.7;
    if (cityAudioRef.current.paused) {
      cityAudioRef.current.play().catch(() => {});
    }
    return () => {};
  }, [currentMap, musicVolume, musicMuted, profile]);

  // ─── Countdown timer ───
  useEffect(() => {
    if (composeCountdownSecs <= 0) return;
    const t = setInterval(() => {
      setComposeCountdownSecs(s => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [composeCountdownSecs]);

  // ─── Load blocked users from profile ───
  useEffect(() => {
    if (profile?.blocked_users) setBlockedUsers(profile.blocked_users.filter(Boolean) as string[]);
  }, [profile?.blocked_users]);

  // ─── Auto-polling nieprzeczytanych (co 30s) ───
  useEffect(() => {
    if (!profile?.id) return;
    const interval = setInterval(async () => {
      const [{ count: rcvCount }, { count: mktCount }] = await Promise.all([
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("to_user_id", profile.id)
          .eq("read", false)
          .eq("type", "received")
          .not("subject", "ilike", "Targ%")
          .not("subject", "ilike", "🏪%"),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("to_user_id", profile.id)
          .eq("read", false)
          .eq("type", "received")
          .or("subject.ilike.Targ%,subject.ilike.🏪%"),
      ]);
      if (typeof rcvCount === "number") setUnreadCount(rcvCount);
      if (typeof mktCount === "number") setUnreadMarketCount(mktCount);
    }, 30000);
    return () => clearInterval(interval);
  }, [profile?.id]);
  // ─── Oznacz jako przeczytane gdy gracz patrzy na zakładkę Otrzymane lub Targ ───
  useEffect(() => {
    if (showMessagePanel && messageTab === "otrzymane") void markAsRead("received");
    if (showMessagePanel && messageTab === "targ")     void markAsRead("market");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMessagePanel, messageTab]);

  // ─── Zapis Mocy farmy do bazy (debounce 1.5s) ───
  useEffect(() => {
    if (!profile?.id) return;
    if (farmPowerTimerRef.current) clearTimeout(farmPowerTimerRef.current);
    farmPowerTimerRef.current = setTimeout(async () => {
      const fp = computeFarmPower(playerStats, charEquipped, hiveData.level, orchardState, barnState);
      await supabase.from("profiles").update({ farm_power: fp }).eq("id", profile.id);
    }, 1500);
    return () => { if (farmPowerTimerRef.current) clearTimeout(farmPowerTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerStats, charEquipped, hiveData.level, orchardState, barnState, profile?.id]);


  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          // Sprawdź czas poprzedniej sesji (hard 2h timeout)
          let storedStart: number | null = null;
          try { storedStart = Number(sessionStorage.getItem("plono_session_start")) || null; } catch { /* ignore */ }
          if (storedStart && Date.now() - storedStart >= SESSION_DURATION_MS) {
            // Sesja przeterminowana — wyloguj bez ładowania profilu
            await supabase.auth.signOut();
            if (mounted) setReady(true);
            return;
          }
          await loadProfile(session.user.id);
          if (mounted) startSessionTimer(storedStart ?? undefined);
        }
      } catch (error) {
        console.error("BOOTSTRAP ERROR:", error);
        if (mounted) {
          setMessage({
            type: "error",
            title: "Błąd połączenia",
            text: "Nie udało się wczytać sesji gracza.",
          });
        }
      } finally {
        if (mounted) setReady(true);
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  // ─── Powitanie nowego gracza ───
  useEffect(() => {
    if (!profile?.id) return;
    if (!profile.tutorial_started && !profile.tutorial_completed && !profile.tutorial_skipped) {
      setShowWelcome(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // ─── Klawiatura dla potwierdzeń wyjścia z przewodnika ───
  useEffect(() => {
    if (!showWelcome || guideExitStep === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (guideExitStep === 2) setGuideExitStep(1);
        else setGuideExitStep(0);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (guideExitStep === 1) { setGuideExitStep(2); return; }
        if (guideExitStep === 2) {
          if (!profile?.id) return;
          void (async () => {
            setGuideSaving(true);
            setGuideError(null);
            const { error } = await supabase
              .from("profiles")
              .update({ tutorial_started: true, tutorial_completed: false, tutorial_skipped: true, tutorial_step: 0 })
              .eq("id", profile.id);
            setGuideSaving(false);
            if (error) { setGuideError("Błąd zapisu. Spróbuj ponownie."); return; }
            setProfile(p => p ? { ...p, tutorial_started: true, tutorial_completed: false, tutorial_skipped: true, tutorial_step: 0 } : p);
            setTutorialStep(0);
            setShowWelcome(false);
            setGuideExitStep(0);
          })();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWelcome, guideExitStep, profile?.id]);

  // ─── Sync skina do DB raz na sesję (żeby ranking widział avatara) ───
  useEffect(() => {
    if (!profile?.id || avatarSkin < 0 || skinDbSyncedRef.current) return;
    skinDbSyncedRef.current = true;
    supabase.rpc("game_sync_skin", { p_skin: avatarSkin }).then(({ error }) => {
      if (error) console.error("[skin-sync] game_sync_skin error:", error.message, error.code);
      else console.log("[skin-sync] OK, skin =", avatarSkin);
    });
  }, [profile?.id, avatarSkin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { gameScaleRef.current = gameScale; }, [gameScale]);
  useEffect(() => { userZoomFactorRef.current = userZoomFactor; }, [userZoomFactor]);
  useEffect(() => {
    const raw = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
    const s = Math.max(0.40, Math.min(1.60, raw * userZoomFactor));
    setGameScale(s);
    gameScaleRef.current = s;
  }, [userZoomFactor]);
  useEffect(() => {
    try { localStorage.setItem("plonopolis_zoom", String(userZoomFactor)); } catch { /* ignore */ }
  }, [userZoomFactor]);

  const fetchDailyHarvest = React.useCallback(async () => {
    setIsDailyHarvestLoading(true);
    setDailyHarvestData(null);
    const { data, error } = await supabase.rpc("get_today_harvest_summary");
    setIsDailyHarvestLoading(false);
    if (!error && data) {
      setDailyHarvestData(data as { items: Array<{ crop_id: string; quality: "rotten"|"good"|"epic"|"legendary"; amount: number }>; total_exp: number });
    }
  }, []);


  function toGameCoords(clientX: number, clientY: number) {
    const s = gameScaleRef.current;
    return {
      x: BASE_W / 2 + (clientX - window.innerWidth / 2) / s,
      y: BASE_H / 2 + (clientY - window.innerHeight / 2) / s,
    };
  }

  useEffect(() => {
    const checkScreen = () => {
      const isSmall = window.innerWidth < 1024;
      setIsDesktop(!isSmall);
      const raw = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
      const s = Math.max(0.40, Math.min(1.60, raw * userZoomFactorRef.current));
      setGameScale(s);
      gameScaleRef.current = s;
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);

    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // TYMCZASOWE — detekcja orientacji pionowej na telefonie
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowRotateNotice(isMobile && isPortrait);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // ─── Licznik czasu sesji (aktualizacja co sekundę) ────────────────────
  useEffect(() => {
    const tick = () => {
      let stored: number | null = null;
      try { stored = Number(sessionStorage.getItem("plono_session_start")) || null; } catch { /* ignore */ }
      if (!stored) { setSessionTimeLeft(null); return; }
      const remaining = Math.max(0, SESSION_DURATION_MS - (Date.now() - stored));
      setSessionTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!isFieldViewOpen) return;

    const interval = setInterval(() => {
      setGrowthTick((prev) => prev + 1);
    }, 500);

    return () => clearInterval(interval);
  }, [isFieldViewOpen]);

  // Auto-naprawa desynchronizacji pól przy każdym otwarciu widoku pola
  useEffect(() => {
    if (!isFieldViewOpen || !profile?.id) return;
    const _userId = profile.id;
    let cancelled = false;
    void (async () => {
      // Wywołaj RPC repair (uzupełni brakujące plot_obstacles po stronie serwera)
      await supabase.rpc("game_repair_plot_obstacles", { p_user_id: _userId });
      if (cancelled) return;
      // Pobierz świeży stan po repair
      const { data: freshRow } = await supabase
        .from("profiles")
        .select("unlocked_plots, plot_obstacles")
        .eq("id", _userId)
        .single();
      if (cancelled || !freshRow) return;
      setUnlockedPlots(parseUnlockedPlots(freshRow.unlocked_plots));
      if (freshRow.plot_obstacles && typeof freshRow.plot_obstacles === "object" && !Array.isArray(freshRow.plot_obstacles)) {
        setPlotObstacles(freshRow.plot_obstacles as Record<string, { type: string; cost: number }>);
      }
    })();
    return () => { cancelled = true; };
  }, [isFieldViewOpen, profile?.id]);

  // Tutorial strzałka — oblicza pozycję targetu, odpytuje co 400 ms
  useEffect(() => {
    const _active = !!profile?.id && profile.tutorial_started === true && profile.tutorial_completed !== true && profile.tutorial_skipped !== true;
    if (!_active || tutorialStep < 1 || tutorialStep > 13) { setTutorialArrow(null); return; }
    const _selectors: Partial<Record<number, string>> = {
      1:  '[data-tutorial-target="pola-uprawne"]',
      2:  '[data-tutorial-target="kompost-btn"]',
      3:  '[data-tutorial-target="guide-compost-item"]',
      4:  '[data-tutorial-target="tutorial-plot-empty"]',
      5:  '[data-tutorial-target="nasiona-btn"]',
      6:  '[data-tutorial-target="carrot-good-item"]',
      8:  '[data-tutorial-target="konewka-btn"]',
      10: '[data-tutorial-target="zbierz-btn"]',
    };
    const recalc = () => {
      const sel = _selectors[tutorialStep];
      if (!sel) { setTutorialArrow(null); return; }
      const el = document.querySelector(sel);
      if (!el) { setTutorialArrow(null); return; }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) { setTutorialArrow(null); return; }
      setTutorialArrow({ cx: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height });
    };
    recalc();
    window.addEventListener("resize", recalc);
    if (tutorialStep === 1) {
      // rAF: śledzenie rect co klatkę, setState tylko gdy zmiana > 0.5 px
      let _rafId: number;
      let _prev: typeof tutorialArrow = null;
      const _loop = () => {
        const _sel = _selectors[1];
        if (_sel) {
          const _el = document.querySelector(_sel);
          if (_el) {
            const _r = _el.getBoundingClientRect();
            if (_r.width > 0 || _r.height > 0) {
              const _cx = _r.left + _r.width / 2;
              if (!_prev ||
                  Math.abs(_cx - _prev.cx) > 0.5 ||
                  Math.abs(_r.top - _prev.top) > 0.5 ||
                  Math.abs(_r.left - _prev.left) > 0.5 ||
                  Math.abs(_r.right - _prev.right) > 0.5) {
                _prev = { cx: _cx, top: _r.top, bottom: _r.bottom, left: _r.left, right: _r.right, width: _r.width, height: _r.height };
                setTutorialArrow(_prev);
              }
            } else if (_prev !== null) {
              _prev = null;
              setTutorialArrow(null);
            }
          } else if (_prev !== null) {
            _prev = null;
            setTutorialArrow(null);
          }
        }
        _rafId = requestAnimationFrame(_loop);
      };
      _rafId = requestAnimationFrame(_loop);
      return () => { window.removeEventListener("resize", recalc); cancelAnimationFrame(_rafId); };
    }
    const _int = setInterval(recalc, 400);
    return () => { window.removeEventListener("resize", recalc); clearInterval(_int); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialStep, isFieldViewOpen, fvCompostPickerOpen, fvSeedPickerOpen, profile?.id, profile?.tutorial_started, profile?.tutorial_completed, profile?.tutorial_skipped, fvTutArrow12Pos, fvTutArrow13Pos]);

  // Tick dla pasków postępu sadzenia/zbioru — działa tylko gdy są aktywne akcje
  useEffect(() => {
    if (Object.keys(pendingFieldActions).length === 0) return;
    const interval = setInterval(() => {
      setPendingTick(prev => prev + 1);
    }, 60);
    return () => clearInterval(interval);
  }, [pendingFieldActions]);

  // Synchronizuj refs ze świeżym state (dla setTimeout callbackach)
  useEffect(() => { seedInventoryRef.current = seedInventory; }, [seedInventory]);
  useEffect(() => { plotCropsRef.current = plotCrops; }, [plotCrops]);

  // Cleanup wszystkich pending setTimeout przy unmount komponentu
  useEffect(() => {
    return () => {
      fieldActionTimeoutsRef.current.forEach(id => clearTimeout(id));
      fieldActionTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isFieldViewOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "enter",
          " ",
          "escape",
        ].includes(key)
      ) {
        e.preventDefault();
      }

      if (plotToBuy !== null) {
        if (key === "enter" || key === " ") void confirmBuyPlot();
        if (key === "escape") setPlotToBuy(null);
        return;
      }

      if (key === "w" || key === "arrowup") {
        moveSelection("up");
      } else if (key === "s" || key === "arrowdown") {
        moveSelection("down");
      } else if (key === "a" || key === "arrowleft") {
        moveSelection("left");
      } else if (key === "d" || key === "arrowright") {
        moveSelection("right");
      } else if (key === "enter" || key === " ") {
        confirmSelectedPlot();
      } else if (key === "escape") {
        // Podczas tutoriala blokuj wyjście z Widoku Pola przez Escape
        if (tutorialStep >= 1 && tutorialStep <= 11) return;
        setIsFieldViewOpen(false);
        setSelectedPlotId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFieldViewOpen, selectedPlotId, unlockedPlots, displayLevel, plotCrops, selectedTool, selectedSeedId, plotToBuy, tutorialStep]);

  useEffect(() => {
    if (!showRankingPanel) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowRankingPanel(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showRankingPanel]);

  useEffect(() => {
    if (!showDomModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowDomModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showDomModal]);

  useEffect(() => {
    if (!showSadModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowSadModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSadModal]);
  React.useEffect(() => {
    if (!showStodolaModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowStodolaModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showStodolaModal]);
  React.useEffect(() => {
    if (!showLadaModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLadaInfo) setShowLadaInfo(false);
        else if (ladaDetailIdx !== null) setLadaDetailIdx(null);
        else setShowLadaModal(false);
        return;
      }
      if (e.key === "Enter" && ladaDetailIdx !== null && !showLadaInfo) {
        if (e.repeat) return;
        const target = e.target as HTMLElement;
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
        e.preventDefault();
        if (completingCustomerOrderRef.current) return;
        if (customerSelling) return;
        const o = customerOrders[ladaDetailIdx];
        if (!o) return;
        const timeLeft = Math.max(0, new Date(o.expires_at).getTime() - Date.now());
        if (timeLeft <= 0) return;
        const mi = mergeOrderItems(o.items);
        const canDo = mi.every(it => {
          if (it.id === 'honey_jar') return hiveData.honey_jars >= it.qty;
          if (/_(good|epic|legendary)$/.test(it.id)) return (seedInventory[it.id] ?? 0) >= it.qty;
          if (/_(zwykly|soczysty|zloty|zgnile)$/.test(it.id)) return (fruitInventory[it.id] ?? 0) >= it.qty;
          return (barnItems[it.id] ?? 0) >= it.qty;
        });
        if (!canDo) return;
        completingCustomerOrderRef.current = true;
        completeCustomerOrder(o.id).finally(() => { completingCustomerOrderRef.current = false; });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showLadaModal, showLadaInfo, ladaDetailIdx, customerOrders, customerSelling, barnItems, seedInventory, fruitInventory, hiveData, completeCustomerOrder, mergeOrderItems]);
  /* Reset szczegółów gdy zamówienie zniknęło z listy (np. po realizacji lub wygaśnięciu) */
  React.useEffect(() => {
    if (ladaDetailIdx === null) return;
    if (!customerOrders[ladaDetailIdx]) setLadaDetailIdx(null);
  }, [customerOrders, ladaDetailIdx]);
  React.useEffect(() => {
    if (!customerLootDrop) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter") { setCustomerLootDrop(null); setLootHoverIdx(null); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [customerLootDrop]);
  React.useEffect(() => {
    if (!showShopModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowShopModal(false); setShopCart({}); setShopError(""); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showShopModal]);
  React.useEffect(() => {
    const iv = setInterval(() => setPromoCountdown(formatShopCountdown(getMsToPolandMidnight())), 1000);
    return () => clearInterval(iv);
  }, []);
  React.useEffect(() => {
    if (!showUlModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowUlModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showUlModal]);
  React.useEffect(() => {
    if (currentMap !== "city_townhall") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showRankingPanel) { setShowRankingPanel(false); return; }
      handleChangeMap("city");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentMap, showRankingPanel]);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHoveredSickle(false);
        setHoveredWateringCan(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ─── Esc: wiadomości + compose ───────────────────────────────────────────
  React.useEffect(() => {
    if (!showMessagePanel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (document.activeElement as HTMLElement)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!(document.activeElement as HTMLElement)?.isContentEditable) return;
      if (showCompose) { setShowCompose(false); } else { setShowMessagePanel(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showMessagePanel, showCompose]);

  // ─── Esc: gildia ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!showGildiaPanel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (document.activeElement as HTMLElement)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setShowGildiaPanel(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showGildiaPanel]);

  // ─── Esc: misje ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!showMisjePanel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (document.activeElement as HTMLElement)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setShowMisjePanel(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showMisjePanel]);

  // ─── Esc: wybór skina/avatara ─────────────────────────────────────────────
  React.useEffect(() => {
    if (!showSkinModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (document.activeElement as HTMLElement)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setShowSkinModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSkinModal]);

  // ─── Esc: potwierdzenie zakupu epic avatara ───────────────────────────────
  React.useEffect(() => {
    if (epicPurchaseTarget === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setEpicPurchaseTarget(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [epicPurchaseTarget]);

  // ─── Esc: panel testów ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!showTestModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (document.activeElement as HTMLElement)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setShowTestModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showTestModal]);

  // ─── Esc: nawigacja map (city_shop, city_bank, city_market, city_liga) ────
  React.useEffect(() => {
    const citySubMaps = ["city_shop", "city_bank", "city_market", "city_liga"];
    if (!citySubMaps.includes(currentMap)) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (currentMap === "city_market" && showMarketModal) return;
      handleChangeMap("city");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentMap, showMarketModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Zapamiętaj ostatnią mapę farmy ──────────────────────────────────────
  React.useEffect(() => {
    if (currentMap.startsWith("farm")) lastFarmMapRef.current = currentMap;
  }, [currentMap]);

  // ─── Crossfade mapy po level-upie farmy ──────────────────────────────────
  React.useEffect(() => {
    // Ignoruj dopóki profil nie załadowany
    if (!profile) { isProfileLoadedRef.current = false; return; }
    if (!currentMap.startsWith("farm")) return;

    const prev = prevFarmMapForTransitionRef.current;
    prevFarmMapForTransitionRef.current = currentMap;

    // Pierwsze załadowanie profilu — tylko zapamiętaj, nie animuj
    if (!isProfileLoadedRef.current) {
      isProfileLoadedRef.current = true;
      return;
    }

    // Animuj tylko gdy poprzednia mapa to niższa farma (nie miasto)
    if (!prev || !prev.startsWith("farm")) return;
    const prevIdx = FARM_MAP_ORDER.indexOf(prev);
    const nextIdx = FARM_MAP_ORDER.indexOf(currentMap);
    if (nextIdx <= prevIdx) return;

    // Uruchom crossfade
    if (mapCrossfadeTimerRef.current) clearTimeout(mapCrossfadeTimerRef.current);
    setMapCrossfade({ from: prev, to: currentMap });
    setSliderX(50);
    setShowFarmSlider({ from: prev, to: currentMap });
    mapCrossfadeTimerRef.current = setTimeout(() => setMapCrossfade(null), 13000);

    return () => {
      if (mapCrossfadeTimerRef.current) clearTimeout(mapCrossfadeTimerRef.current);
    };
  }, [currentMap, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Wyczyść crossfade gdy gracz wychodzi z farmy (np. wchodzi do miasta) ─
  // Bez tego po powrocie na farmę animacja "stara mapa zanika" restartuje się od zera.
  React.useEffect(() => {
    if (!isOnFarmMap) {
      setMapCrossfade(null);
      if (mapCrossfadeTimerRef.current) clearTimeout(mapCrossfadeTimerRef.current);
    }
  }, [isOnFarmMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Esc: city → farma ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (currentMap !== "city") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (
        showMessagePanel || showGildiaPanel || showMisjePanel || showSkinModal ||
        showTestModal || showShopModal || showRankingPanel || showDomModal ||
        showStodolaModal || showSadModal || showUlModal || showLadaModal ||
        showKompostModal || showMarketModal || epicPurchaseTarget !== null ||
        showLogoutConfirm
      ) return;
      handleChangeMap(lastFarmMapRef.current);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentMap, showMessagePanel, showGildiaPanel, showMisjePanel, showSkinModal, showTestModal, showShopModal, showRankingPanel, showDomModal, showStodolaModal, showSadModal, showUlModal, showLadaModal, showKompostModal, showMarketModal, epicPurchaseTarget, showLogoutConfirm]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Esc: farma → pokaż potwierdzenie wylogowania ────────────────────────
  React.useEffect(() => {
    if (!currentMap.startsWith("farm")) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (document.activeElement as HTMLElement)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!(document.activeElement as HTMLElement)?.isContentEditable) return;
      if (
        isFieldViewOpen || showMessagePanel || showGildiaPanel || showMisjePanel ||
        showSkinModal || showTestModal || showShopModal || showRankingPanel ||
        showDomModal || showStodolaModal || showSadModal || showUlModal ||
        showLadaModal || showKompostModal || showMarketModal || epicPurchaseTarget !== null
      ) return;
      setShowLogoutConfirm(prev => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentMap, isFieldViewOpen, showMessagePanel, showGildiaPanel, showMisjePanel, showSkinModal, showTestModal, showShopModal, showRankingPanel, showDomModal, showStodolaModal, showSadModal, showUlModal, showLadaModal, showKompostModal, showMarketModal, epicPurchaseTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Esc: zamknij popup potwierdzenia wylogowania ────────────────────────
  React.useEffect(() => {
    if (!showLogoutConfirm) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowLogoutConfirm(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showLogoutConfirm]);

  React.useEffect(() => {
    if (!showUlModal) return;
    const t = setInterval(() => setHiveNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [showUlModal]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedPosition = window.localStorage.getItem(BACKPACK_POSITION_STORAGE_KEY);
    if (!savedPosition) {
      setBackpackPosition({ x: 0, y: 0 });
      return;
    }

    try {
      const parsed = JSON.parse(savedPosition) as { x?: number; y?: number };
      setBackpackPosition({
        x: typeof parsed?.x === "number" ? parsed.x : 0,
        y: typeof parsed?.y === "number" ? parsed.y : 0,
      });
    } catch {
      setBackpackPosition({ x: 0, y: 0 });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BACKPACK_POSITION_STORAGE_KEY, JSON.stringify(backpackPosition));
  }, [backpackPosition]);

  // ─── Tutorial krok 11: recovery — wykryj już zebrane pola (niezależnie od jakości) ───
  useEffect(() => {
    if (tutorialStep !== 11 || tutorialPlotIds.length === 0 || !profile?.id) return;
    const _harvested = tutorialPlotIds.filter(id => !plotCrops[id]?.cropId);
    if (_harvested.length >= 3) {
      setTutorialHarvestedIds(tutorialPlotIds);
      void advanceTutorialStep(12);
    } else if (_harvested.length > tutorialHarvestedIds.length) {
      setTutorialHarvestedIds(_harvested);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialStep, tutorialPlotIds, plotCrops]);

  // ─── Tutorial krok 4: recovery — wykryj pola z Kompostem Przewodnika po refreshie ───
  useEffect(() => {
    if (tutorialStep !== 4 || !profile?.id) return;
    const _guidePlots = Object.entries(plotCrops)
      .filter(([, p]) => p.compostBonus?.type === "guide")
      .map(([id]) => Number(id));
    if (_guidePlots.length === 0) return;
    if (_guidePlots.length >= 3) {
      const _top3 = _guidePlots.slice(0, 3);
      setTutorialPlotIds(_top3);
      saveTutorialPlotIdsToStorage(profile.id, _top3);
      void advanceTutorialStep(5);
    } else {
      // Synchronizuj tutorialPlotIds z faktycznym stanem pól (bez nadpisywania istniejących)
      const _merged = Array.from(new Set([...tutorialPlotIds, ..._guidePlots]));
      if (_merged.length !== tutorialPlotIds.length) setTutorialPlotIds(_merged);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialStep, plotCrops, profile?.id]);

  // ─── Tutorial krok 7: recovery — wykryj już posadzone marchewki (np. po refreshie) ───
  useEffect(() => {
    if (tutorialStep !== 7 || tutorialPlotIds.length === 0 || !profile?.id) return;
    const _planted = tutorialPlotIds.filter(id => plotCrops[id]?.cropId != null);
    if (_planted.length >= 3) {
      setTutorialPlantedIds(tutorialPlotIds);
      void advanceTutorialStep(8);
    } else if (_planted.length > tutorialPlantedIds.length) {
      setTutorialPlantedIds(_planted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialStep, tutorialPlotIds, plotCrops]);

  // ─── Tutorial krok 9: advance do step 10 gdy wszystkie tutorialowe marchewki faktycznie gotowe ───
  // plotCrops w deps: efekt ponownie odpala gdy plantedAt zmieni się (np. po speedupie),
  // co zapewnia świeżą closure dla isCropReady.
  useEffect(() => {
    if (tutorialStep !== 9 || tutorialPlotIds.length === 0 || !profile?.id) return;
    // Natychmiastowe sprawdzenie ze świeżą closure
    if (tutorialPlotIds.every(id => isCropReady(id))) {
      void advanceTutorialStep(10);
      return;
    }
    // Polling co 500 ms — backup dla czasu wzrostu (~5 s po speedupie)
    const _iv = setInterval(() => {
      if (tutorialPlotIds.every(id => isCropReady(id))) void advanceTutorialStep(10);
    }, 500);
    return () => clearInterval(_iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialStep, tutorialPlotIds, profile?.id, plotCrops]);

  useEffect(() => {
    if (!isDraggingBackpack) return;

    const handlePointerMove = (event: PointerEvent) => {
      const panelWidth = isBackpackOpen ? 460 : 64;
      const panelHeight = isBackpackOpen ? 760 : 64;
      const _gc = toGameCoords(event.clientX, event.clientY);
      const nextX = Math.max(-8, Math.min(BASE_W - panelWidth - 16, _gc.x - dragOffset.x));
      const nextY = Math.max(-8, Math.min(BASE_H - panelHeight - 16, _gc.y - dragOffset.y));
      setBackpackPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDraggingBackpack(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingBackpack, dragOffset, isBackpackOpen]);

  function startBackpackDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setIsDraggingBackpack(true);
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }
  async function loadProfile(_userId?: string) {
    const { data, error } = await supabase.rpc("game_get_my_profile");

    if (error) {
      setMessage({
        type: "error",
        title: "Błąd profilu",
        text: error.message,
      });
      return null;
    }

    return applyProfileState(extractRpcProfile(data));
  }

  // ─── LADA NPC: helpery + handlery ────────────────────────────────────
  // Scala duplikaty w items zamówienia (np. 10× marchew_good + 29× marchew_good → 39× marchew_good)
  function mergeOrderItems<T extends { id: string; qty: number; value: number | string }>(items: T[]): T[] {
    const map = new Map<string, T>();
    for (const it of items) {
      const ex = map.get(it.id);
      if (ex) {
        ex.qty = (ex.qty || 0) + (it.qty || 0);
        ex.value = Number(ex.value || 0) + Number(it.value || 0);
      } else {
        map.set(it.id, { ...it, qty: it.qty || 0, value: Number(it.value || 0) } as T);
      }
    }
    return Array.from(map.values());
  }

  function getOrderItemDisplay(id: string): { name: string; icon: string; spritePath?: string } {
    if (id === 'honey_jar') return { name: 'Słoik miodu', icon: '🍯' };
    const ai = ANIMAL_ITEMS.find(a => a.id === id);
    if (ai) return { name: ai.name, icon: ai.icon };
    const cropM = id.match(/^(.+)_(good|epic|legendary)$/);
    if (cropM) {
      const crop = CROPS.find(c => c.id === cropM[1]);
      const qLabel = cropM[2] === 'good' ? ' (zwykła)' : cropM[2] === 'epic' ? ' (epicka)' : ' (legendarna)';
      if (crop) {
        const sprite = cropM[2] === 'legendary' ? (crop.legendarySpritePath ?? crop.epicSpritePath ?? crop.spritePath)
                     : cropM[2] === 'epic'      ? (crop.epicSpritePath ?? crop.spritePath)
                     : crop.spritePath;
        return { name: crop.name + qLabel, icon: '🌱', spritePath: sprite };
      }
    }
    const fruitM = id.match(/^(.+)_(zwykly|soczysty|zloty|zgnile)$/);
    if (fruitM) {
      const tree = TREES.find(t => t.fruitId === fruitM[1]);
      const qd = FRUIT_QUALITY_DEFS[fruitM[2] as FruitQuality];
      if (tree) return { name: `${tree.fruitName}${qd?.label ? ' ' + qd.label : ''}`, icon: tree.fruitIcon };
    }
    if (isCompostKey(id)) {
      const t = compostTypeFromKey(id);
      const v = compostValueFromKey(id);
      if (t) {
        const def = COMPOST_DEFS[t];
        return { name: t === "guide" ? def.name : `${def.tierName(v)} ${def.name}`, icon: def.icon };
      }
    }
    const eq = CHAR_EQUIP_ITEMS.find(i => i.id === id);
    if (eq) return { name: eq.name, icon: eq.icon };
    if (id.startsWith('eq_tier_')) {
      const tier = Number(id.split('_').pop()) || 0;
      const minL = tier * 5 + 1, maxL = tier * 5 + 5;
      return { name: `Tajemniczy przedmiot (lvl ${minL}-${maxL})`, icon: '🎁' };
    }
    return { name: id, icon: '📦' };
  }

  function getCustomerDisplay(type: string): { name: string; icon: string } {
    if (type === 'neighbor')              return { name: 'Sąsiad',                  icon: '🧑‍🌾' };
    if (type === 'village_guest')         return { name: 'Gospodyni',               icon: '🧺' };
    if (type === 'small_market')          return { name: 'Mały targ',               icon: '🏪' };
    if (type === 'village_shop')          return { name: 'Sklep wiejski',           icon: '🏬' };
    if (type === 'restaurant')            return { name: 'Karczma',                 icon: '🍽️' };
    if (type === 'wholesaler')            return { name: 'Hurtownik',               icon: '🚚' };
    if (type === 'market_chain')          return { name: 'Kupcy miejscy',           icon: '🏛️' };
    if (type === 'distribution_center')   return { name: 'Centrum skupu',           icon: '🏗️' };
    if (type === 'international_contract')return { name: 'Kontrakt międzynarodowy', icon: '🌍' };
    return { name: type, icon: '👤' };
  }

  // ─── Badge "Nowy!" — persystencja w localStorage przez 5 minut ───
  const LADA_NEW_BADGE_KEY = 'plonopolis_lada_new_customer_until';
  const LADA_NEW_BADGE_DURATION = 300_000;

  function loadBadgeMap(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem(LADA_NEW_BADGE_KEY) ?? '{}') as Record<string, number>; }
    catch { return {}; }
  }
  function saveBadgeMap(m: Record<string, number>): void {
    try { localStorage.setItem(LADA_NEW_BADGE_KEY, JSON.stringify(m)); } catch {}
  }
  function pruneBadgeMap(m: Record<string, number>): Record<string, number> {
    const now = Date.now();
    return Object.fromEntries(Object.entries(m).filter(([, exp]) => exp > now));
  }
  function activeBadgeIds(m: Record<string, number>): Set<string> {
    const now = Date.now();
    return new Set(Object.entries(m).filter(([, exp]) => exp > now).map(([id]) => id));
  }
  // Sprawdza created_at każdego zamówienia — jeśli < 5 min temu, dodaje badge do mapy.
  // Wywoływana przy baseline load (pierwsze otwarcie/reopen Lady).
  function applyRecentBadges(orders: CustomerOrder[]) {
    const now = Date.now();
    const currentIds = new Set(orders.map(o => o.id));
    // Załaduj mapę, usuń wygasłe i ID nieobecnych klientów
    const badgeMap = pruneBadgeMap(loadBadgeMap());
    for (const id of Object.keys(badgeMap)) {
      if (!currentIds.has(id)) delete badgeMap[id];
    }
    // Dodaj klientów stworzonych w ostatnich 5 minutach, jeśli jeszcze nie ma w mapie
    for (const order of orders) {
      const createdMs = new Date(order.created_at).getTime();
      const expiry = createdMs + LADA_NEW_BADGE_DURATION;
      if (expiry > now && !badgeMap[order.id]) {
        badgeMap[order.id] = expiry;
      }
    }
    saveBadgeMap(badgeMap);
    const active = activeBadgeIds(badgeMap);
    if (active.size > 0) {
      setNewCustomerIds(active);
      scheduleBadgeExpiry();
    }
  }

  // Planuje timeout aby React state zaktualizował się dokładnie gdy wygasa najwcześniejszy badge
  function scheduleBadgeExpiry() {
    if (newCustomerIdsTimerRef.current) clearTimeout(newCustomerIdsTimerRef.current);
    const badgeMap = loadBadgeMap();
    const expiries = Object.values(badgeMap);
    if (expiries.length === 0) return;
    const soonest = Math.min(...expiries);
    const delay = Math.max(500, soonest - Date.now());
    newCustomerIdsTimerRef.current = setTimeout(() => {
      const pruned = pruneBadgeMap(loadBadgeMap());
      saveBadgeMap(pruned);
      setNewCustomerIds(activeBadgeIds(pruned));
      if (Object.keys(pruned).length > 0) scheduleBadgeExpiry();
    }, delay);
  }

  // Pomocnicza: oznacza nowych klientów, aktualizuje listę, ustawia status 'added'
  function applyNewCustomers(ri: CustomerOrder[], rAdded: string[]) {
    // Załaduj istniejącą mapę, usuń wygasłe, dodaj nowe z expiry = teraz + 5 min
    const badgeMap = pruneBadgeMap(loadBadgeMap());
    // Usuń ID klientów, których już nie ma na liście (wykonani/wygaśnięci)
    const currentIds = new Set(ri.map(o => o.id));
    for (const id of Object.keys(badgeMap)) {
      if (!currentIds.has(id)) delete badgeMap[id];
    }
    const expiry = Date.now() + LADA_NEW_BADGE_DURATION;
    for (const id of rAdded) badgeMap[id] = expiry;
    saveBadgeMap(badgeMap);
    setNewCustomerIds(activeBadgeIds(badgeMap));
    scheduleBadgeExpiry();
    if (ladaStatusTimerRef.current) clearTimeout(ladaStatusTimerRef.current);
    setLadaStatusMsg('added');
    ladaStatusTimerRef.current = setTimeout(() => setLadaStatusMsg(null), 2000);
    prevCustomerIdsRef.current = new Set(ri.map(o => o.id));
    setCustomerOrders(ri);
    setCurrentCustomerIdx(idx => (ri.length === 0 ? 0 : idx >= ri.length ? 0 : idx));
  }

  // Pomocnicza: kończy retry — ustawia cooldown i komunikat 'failed'
  function finishSpawnRetryFailed() {
    spawnFailCooldownRef.current = Date.now();
    if (ladaStatusTimerRef.current) clearTimeout(ladaStatusTimerRef.current);
    setLadaStatusMsg('failed');
    ladaStatusTimerRef.current = setTimeout(() => setLadaStatusMsg(null), 5000);
    isSpawningCustomerRef.current = false;
  }

  // Normalizuje tablicę orders z RPC do CustomerOrder[]
  function normalizeRpcOrders(raw: unknown): CustomerOrder[] | null {
    if (!Array.isArray(raw)) return null;
    return raw as CustomerOrder[];
  }

  // Hydratacja po spawnie: czysty SELECT co 1000ms, maks. 30 prób (~30s).
  // Nie wywołuje tick — unika pułapki next_spawn_at w przyszłości blokującej retry.
  // spawnConfirmed=true gdy backend zwrócił spawned>0 — wtedy "failed" NIE jest wyświetlany
  // i przez cały czas trwa komunikat "Dodaję klienta...".
  function hydrateCustomerOrdersAfterSpawn(
    userId: string,
    baselineIds: Set<string>,
    attempt: number,
    spawnConfirmed: boolean,
  ) {
    const MAX_HYDRATE = 30;
    if (customerRetryTimerRef.current) clearTimeout(customerRetryTimerRef.current);
    customerRetryTimerRef.current = setTimeout(async () => {
      if (spawnRetryAbortedRef.current) { isSpawningCustomerRef.current = false; return; }
      try {
        const { data, error } = await supabase
          .from("customer_orders")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        if (spawnRetryAbortedRef.current) { isSpawningCustomerRef.current = false; return; }
        if (!error && data) {
          const orders = data as CustomerOrder[];
          const addedIds = orders.map(o => o.id).filter(id => !baselineIds.has(id));
          if (process.env.NODE_ENV !== 'production') {
            console.debug("[lada hydrate]", { attempt, spawnConfirmed, beforeLen: baselineIds.size, selectedLen: orders.length, addedIds });
          }
          if (addedIds.length > 0) {
            if (process.env.NODE_ENV !== 'production') {
              console.debug("[lada hydrate success]", { selectedLen: orders.length, addedIds });
            }
            applyNewCustomers(orders, addedIds);
            isSpawningCustomerRef.current = false;
            return;
          }
        }
        if (attempt >= MAX_HYDRATE) {
          if (spawnConfirmed) {
            // Backend potwierdził spawn — nie pokazuj "Brak nowych klientów", wyczyść status
            if (ladaStatusTimerRef.current) clearTimeout(ladaStatusTimerRef.current);
            setLadaStatusMsg(null);
            isSpawningCustomerRef.current = false;
          } else {
            finishSpawnRetryFailed();
          }
        } else {
          hydrateCustomerOrdersAfterSpawn(userId, baselineIds, attempt + 1, spawnConfirmed);
        }
      } catch {
        if (spawnRetryAbortedRef.current) { isSpawningCustomerRef.current = false; return; }
        if (spawnConfirmed) { setLadaStatusMsg(null); isSpawningCustomerRef.current = false; }
        else finishSpawnRetryFailed();
      }
    }, 1000);
  }

  async function refreshCustomerOrders(opts?: { tick?: boolean }) {
    if (!profile?.id) return;
    if (isSpawningCustomerRef.current) return;
    isSpawningCustomerRef.current = true;
    spawnRetryAbortedRef.current = false;
    setCustomerLoading(true);
    if (opts?.tick) setLadaStatusMsg('searching');
    let delegatedToRetry = false;
    try {
      let spawnedCount = 0;

      if (opts?.tick) {
        const { data: tickData } = await supabase.rpc("tick_customer_orders", { p_user_id: profile.id });
        spawnedCount = (tickData?.spawned as number) ?? 0;
        const rpcOrders = normalizeRpcOrders(tickData?.orders);
        if (tickData?.next_spawn_at) {
          setNextSpawnAt(new Date(tickData.next_spawn_at).getTime());
        }
        const orderCount = (tickData?.order_count as number) ?? rpcOrders?.length ?? -1;

        if (process.env.NODE_ENV !== 'production') {
          console.debug("[lada tick result]", {
            spawned: spawnedCount,
            order_count: orderCount,
            rpcOrdersLen: rpcOrders?.length ?? -1,
            initialized: hasInitializedCustomerIdsRef.current,
            prevLen: prevCustomerIdsRef.current.size,
          });
        }

        if (rpcOrders !== null) {
          if (process.env.NODE_ENV !== 'production') {
            console.debug("[lada set rpc orders]", {
              rpcLen: rpcOrders.length,
              orderCount: tickData?.order_count,
            });
          }

          // ─── BASELINE: pierwsze otwarcie / reopen Lady ───
          // hasInitializedCustomerIdsRef=false zawsze po zamknięciu Lady.
          // Ustaw baseline, zero badge dla starych — ale oznacz jako "Nowy!" klientów
          // których created_at jest w ostatnich 5 minutach.
          if (!hasInitializedCustomerIdsRef.current) {
            hasInitializedCustomerIdsRef.current = true;
            prevCustomerIdsRef.current = new Set(rpcOrders.map(o => o.id));
            setCustomerOrders(rpcOrders);
            setCurrentCustomerIdx(idx => (rpcOrders.length === 0 ? 0 : idx >= rpcOrders.length ? 0 : idx));
            applyRecentBadges(rpcOrders);
            setLadaStatusMsg(null);
            return;
          }

          // ─── LIVE TICK: modal już otwarty, initialized=true ───
          // Zawsze aktualizuj listę z RPC natychmiast — nie czekaj na SELECT.
          const knownIds = new Set(prevCustomerIdsRef.current);
          const freshCurrentLen = prevCustomerIdsRef.current.size;
          const newIds = rpcOrders.map(o => o.id).filter(id => !knownIds.has(id));
          const rpcHasMore = rpcOrders.length > freshCurrentLen || orderCount > freshCurrentLen;

          if (process.env.NODE_ENV !== 'production') {
            console.debug("[lada set from rpc]", {
              currentLen: freshCurrentLen,
              rpcLen: rpcOrders.length,
              orderCount,
              rpcHasMore,
              newIds,
              spawned: spawnedCount,
            });
          }

          if (rpcHasMore) {
            // Nowi klienci — badge tylko dla faktycznie nowych ID
            if (spawnedCount > 0) setLadaStatusMsg('adding');
            const toMark = newIds.length > 0
              ? newIds
              : rpcOrders.slice(freshCurrentLen).map(o => o.id).filter((id): id is string => Boolean(id));
            applyNewCustomers(rpcOrders, toMark);
            return;
          }

          // Brak wzrostu — zaktualizuj listę bez badge
          prevCustomerIdsRef.current = new Set(rpcOrders.map(o => o.id));
          setCustomerOrders(rpcOrders);
          setCurrentCustomerIdx(idx => (rpcOrders.length === 0 ? 0 : idx >= rpcOrders.length ? 0 : idx));
          if (spawnedCount > 0 && rpcOrders.length < LADA_MAX_CUSTOMERS) {
            setLadaStatusMsg('adding');
            delegatedToRetry = true;
            hydrateCustomerOrdersAfterSpawn(profile.id, new Set(rpcOrders.map(o => o.id)), 1, true);
          } else {
            setLadaStatusMsg(null);
          }
          return;
        }
      }

      // Fallback: SELECT (brak tick lub RPC nie zwróciło pola orders)
      const { data, error } = await supabase
        .from("customer_orders")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: true });
      if (!error && data) {
        const incoming = data as CustomerOrder[];
        if (!hasInitializedCustomerIdsRef.current) {
          hasInitializedCustomerIdsRef.current = true;
          prevCustomerIdsRef.current = new Set(incoming.map(o => o.id));
          setCustomerOrders(incoming);
          setCurrentCustomerIdx(idx => (incoming.length === 0 ? 0 : idx >= incoming.length ? 0 : idx));
          applyRecentBadges(incoming);
          if (opts?.tick && spawnedCount > 0) {
            delegatedToRetry = true;
            hydrateCustomerOrdersAfterSpawn(profile.id, new Set(incoming.map(o => o.id)), 1, true);
          } else {
            setLadaStatusMsg(null);
          }
          return;
        }
        const addedIds = incoming.map(o => o.id).filter(id => !prevCustomerIdsRef.current.has(id));
        prevCustomerIdsRef.current = new Set(incoming.map(o => o.id));
        setCustomerOrders(incoming);
        setCurrentCustomerIdx(idx => (incoming.length === 0 ? 0 : idx >= incoming.length ? 0 : idx));
        if (addedIds.length > 0) {
          applyNewCustomers(incoming, addedIds);
        } else if (opts?.tick && incoming.length < LADA_MAX_CUSTOMERS) {
          delegatedToRetry = true;
          hydrateCustomerOrdersAfterSpawn(profile.id, new Set(incoming.map(o => o.id)), 1, spawnedCount > 0);
        } else {
          setLadaStatusMsg(null);
        }
      }
    } finally {
      setCustomerLoading(false);
      if (!delegatedToRetry) isSpawningCustomerRef.current = false;
    }
  }

  async function completeCustomerOrder(orderId: string) {
    if (!profile?.id || customerSelling) return;
    setCustomerSelling(orderId);
    const { data, error } = await supabase.rpc("complete_customer_order", {
      p_user_id: profile.id,
      p_order_id: orderId,
    });
    setCustomerSelling(null);
    if (error || !data?.ok) {
      const rawMsg = error?.message ?? data?.reason ?? "";
      let polishMsg = "Brak wymaganych przedmiotów lub zamówienie wygasło.";
      // insufficient: <item_id> (have X, need Y)
      const mIns = rawMsg.match(/insufficient:\s*([a-z0-9_]+)\s*\(have\s*(\d+),\s*need\s*(\d+)\)/i);
      if (mIns) {
        const d = getOrderItemDisplay(mIns[1]);
        polishMsg = `Brakuje: ${d.icon} ${d.name} — masz ${mIns[2]}, potrzebujesz ${mIns[3]}.`;
      } else if (/expired|wyga/i.test(rawMsg)) {
        polishMsg = "Zamówienie wygasło — klient już odszedł.";
      } else if (/not[\s_-]*found|nie\s*znalezion|no\s*such/i.test(rawMsg)) {
        polishMsg = "Zamówienie nie istnieje (mogło już zostać zrealizowane lub usunięte).";
      } else if (/already.*(complet|fulfill)|już.*(zrealiz|wykonan)/i.test(rawMsg)) {
        polishMsg = "To zamówienie zostało już zrealizowane.";
      } else if (rawMsg) {
        polishMsg = rawMsg;
      }
      setMessage({
        type: "error",
        title: "Nie udało się zrealizować zamówienia",
        text: polishMsg,
      });
      void refreshCustomerOrders();
      return;
    }
    // Obsługa bonusów typu eq_item: SQL zwraca {type:'eq_item', tier:N, qty:1} bez id.
    // Frontend losuje konkretny przedmiot z CHAR_EQUIP_ITEMS po tier+playerLvl,
    // dodaje do owned/extra (tak samo jak w kompostowniku) i podmienia bonus.id.
    const bonusList: CustomerOrderBonus[] = Array.isArray(data.bonus) ? [...data.bonus] : [];
    const eqBonuses = bonusList.filter(b => b.type === 'eq_item');
    if (eqBonuses.length > 0) {
      const playerLvl = profile.level ?? 1;
      let owned = { ...ownedEqItems };
      let extras = [...extraEqItems];
      for (const b of eqBonuses) {
        const tier = Math.max(0, Math.min(4, b.tier ?? 0));
        let pool: typeof CHAR_EQUIP_ITEMS = [];
        for (let t = tier; t >= 0; t--) {
          const minLvl = t * 5 + 1, maxLvl = t * 5 + 5;
          pool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= minLvl && it.unlockLevel <= maxLvl && it.unlockLevel <= playerLvl);
          if (pool.length > 0) break;
        }
        if (pool.length === 0) {
          b.id = `eq_tier_${tier}`; // brak puli — pokaż placeholder w toaście
          continue;
        }
        const item = pool[Math.floor(Math.random() * pool.length)];
        if (!owned[item.id]) {
          owned = { ...owned, [item.id]: true as const };
        } else {
          extras = [...extras, { uid: makeExtraUid(), id: item.id, upg: 0 }];
        }
        b.id = item.id;
      }
      saveOwnedEqItems(owned);
      saveExtraEqItems(extras);
    }
    // SQL complete_customer_order sam aktualizuje money, xp, level w DB.
    // loadProfile odświeża cały stan UI (złoto, EXP, level-up, inventory).
    await loadProfile(profile.id);
    // ─── Historia postępu: klient ───
    if (profile?.id) {
      const _dp = loadDP(profile.id);
      _dp.customers += 1;
      _dp.expGained += Number(data.exp) || 0;
      _dp.moneyGained += Number(data.gold) || 0;
      saveDP(profile.id, _dp);
      setDailyProgress({ ..._dp });
    }
    // Jeśli klient dał dodatkowy bonus → pokaż średni modal z dropem (z tooltipami)
    if (bonusList.length > 0) {
      const order = customerOrders.find(o => o.id === orderId);
      const cd = order ? getCustomerDisplay(order.customer_type) : { name: 'Klient', icon: '👤' };
      setCustomerLootDrop({
        gold: Number(data.gold) || 0,
        exp: Number(data.exp) || 0,
        bonus: bonusList,
        customerName: cd.name,
        customerIcon: cd.icon,
      });
    } else {
      setMessage({
        type: "success",
        title: `🤝 Sprzedano! +${Number(data.gold).toFixed(0)} zł, +${data.exp} EXP`,
        text: "",
      });
    }
    const wasAtMax = customerOrders.length >= LADA_MAX_CUSTOMERS;
    void refreshCustomerOrders(wasAtMax ? { tick: true } : undefined);
  }

  React.useEffect(() => {
    if (!showLadaModal || !profile?.id) return;
    // Przywróć badge "Nowy!" z localStorage — tylko niewygasłe wpisy
    const restoredMap = pruneBadgeMap(loadBadgeMap());
    saveBadgeMap(restoredMap);
    if (Object.keys(restoredMap).length > 0) {
      setNewCustomerIds(activeBadgeIds(restoredMap));
      scheduleBadgeExpiry();
    }
    // Startowi klienci — tylko przy pierwszym wejściu do Lady
    const runOpen = async () => {
      if (!profile.lada_starter_given) {
        const { data } = await supabase.rpc("game_give_starter_customers");
        if ((data as { ok?: boolean } | null)?.ok) {
          setProfile(p => p ? { ...p, lada_starter_given: true } : p);
        }
      }
      void refreshCustomerOrders({ tick: true });
    };
    void runOpen();
    const tickT = setInterval(() => void refreshCustomerOrders({ tick: true }), 5 * 60 * 1000);
    const nowT = setInterval(() => setCustomerNow(Date.now()), 1000);
    return () => {
      clearInterval(tickT);
      clearInterval(nowT);
      if (newCustomerIdsTimerRef.current) clearTimeout(newCustomerIdsTimerRef.current);
      if (ladaStatusTimerRef.current) clearTimeout(ladaStatusTimerRef.current);
      // Przerwij ewentualne trwające retry spawnu
      spawnRetryAbortedRef.current = true;
      if (customerRetryTimerRef.current) clearTimeout(customerRetryTimerRef.current);
      isSpawningCustomerRef.current = false;
      // Reset baseline — przy kolejnym otwarciu Lady pierwsza lista znów jest baseline
      hasInitializedCustomerIdsRef.current = false;
      prevCustomerIdsRef.current = new Set();
      // NIE czyść localStorage — badge "Nowy!" ma przeżyć zamknięcie modala (5 min)
      setNewCustomerIds(new Set());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLadaModal, profile?.id]);

  // DEV: log gdy zmienia się lista klientów lub status
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !showLadaModal) return;
    console.debug("[lada render orders]", {
      stateLen: customerOrders.length,
      status: ladaStatusMsg,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerOrders, ladaStatusMsg, showLadaModal]);

  // Auto-tick natychmiast po zerowaniu countdownu spawnu (z throttle 3s + cooldown po failu 15s)
  React.useEffect(() => {
    if (!showLadaModal || !profile?.id || nextSpawnAt === null || customerLoading) return;
    if (customerNow < nextSpawnAt) return;
    if (isSpawningCustomerRef.current) return;
    if (Date.now() - spawnFailCooldownRef.current < 15000) return;
    if (Date.now() - lastAutoTickAtRef.current < 3000) return;
    lastAutoTickAtRef.current = Date.now();
    void refreshCustomerOrders({ tick: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerNow, nextSpawnAt, showLadaModal, profile?.id, customerLoading]);

  async function persistPlotCrops(nextPlotCrops: Record<number, PlotCropState>, userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        plot_crops: serializePlotCrops(nextPlotCrops),
        last_played_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return error;
  }

  async function persistSeedInventory(nextSeedInventory: SeedInventory, userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        seed_inventory: serializeSeedInventory(nextSeedInventory),
        last_played_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return error;
  }

  function translateAuthError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid login credentials") || m.includes("invalid credentials")) return "Nieprawidłowy adres e-mail lub hasło.";
    if (m.includes("email not confirmed")) return "Adres e-mail nie został jeszcze potwierdzony. Sprawdź swoją skrzynkę pocztową.";
    if (m.includes("already registered") || m.includes("user already registered")) return "Konto z tym adresem e-mail już istnieje.";
    if (m.includes("password should be at least")) return "Hasło musi mieć co najmniej 6 znaków.";
    if (m.includes("unable to validate email") || m.includes("invalid email")) return "Podaj poprawny adres e-mail.";
    if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch")) return "Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie.";
    if (m.includes("too many requests") || m.includes("rate limit")) return "Zbyt wiele prób. Poczekaj chwilę i spróbuj ponownie.";
    if (m.includes("email address") && m.includes("invalid")) return "Podaj poprawny adres e-mail.";
    if (m.includes("signup is disabled")) return "Rejestracja jest tymczasowo wyłączona.";
    if (m.includes("user not found")) return "Nie znaleziono konta o podanym adresie e-mail.";
    return msg;
  }

  function isEmailValid(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const login = registerForm.login.trim();
    const email = registerForm.email.trim();
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;

    if (!login || !email || !password || !confirmPassword) {
      setMessage({
        type: "error",
        title: "Brak danych",
        text: "Uzupełnij wszystkie pola rejestracji.",
      });
      return;
    }

    if (login.length < 3) {
      setMessage({
        type: "error",
        title: "Login jest za krótki",
        text: "Login powinien mieć minimum 3 znaki.",
      });
      return;
    }

    if (!isEmailValid(email)) {
      setMessage({
        type: "error",
        title: "Nieprawidłowy email",
        text: "Podaj poprawny adres email.",
      });
      return;
    }

    if (password.length < 6) {
      setMessage({
        type: "error",
        title: "Hasło jest za krótkie",
        text: "Hasło powinno mieć minimum 6 znaków.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({
        type: "error",
        title: "Hasła nie są zgodne",
        text: "Pole „hasło” i „powtórz hasło” muszą być identyczne.",
      });
      return;
    }

    const { data: availData, error: availError } = await supabase.rpc("check_registration_available", {
      p_login: login,
      p_email: email,
    });

    if (availError) {
      setMessage({
        type: "error",
        title: "Błąd sprawdzania danych",
        text: availError.message,
      });
      return;
    }

    const availResponse = availData as { ok?: boolean; error?: string; login_available?: boolean; email_available?: boolean } | null;

    if (availResponse?.ok === false) {
      setMessage({
        type: "error",
        title: "Błąd sprawdzania danych",
        text: availResponse.error ?? "Nieznany błąd",
      });
      return;
    }

    if (availResponse?.login_available === false) {
      setMessage({
        type: "error",
        title: "Login zajęty",
        text: "Ten login już istnieje. Wybierz inny.",
      });
      return;
    }

    if (availResponse?.email_available === false) {
      setMessage({
        type: "error",
        title: "Email zajęty",
        text: "Na ten adres email konto już zostało utworzone.",
      });
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { login } },
    });

    if (signUpError) {
      setMessage({
        type: "error",
        title: "Błąd rejestracji",
        text: translateAuthError(signUpError.message),
      });
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      setMessage({
        type: "info",
        title: "Sprawdź pocztę",
        text: "Konto zostało utworzone. Dokończ aktywację z linku w emailu, jeśli masz włączone potwierdzanie adresu.",
      });
      return;
    }

    // Nadpisz login w profilu — trigger tworzy go z emailem, tu ustawiamy właściwy login gracza
    const { data: loginData, error: loginRpcError } = await supabase.rpc("set_my_login_after_signup", {
      p_login: login,
    });

    if (loginRpcError) {
      setMessage({
        type: "error",
        title: "Błąd ustawiania loginu",
        text: loginRpcError.message,
      });
      return;
    }

    const loginResponse = loginData as { ok?: boolean; error?: string; login?: string } | null;

    if (loginResponse?.ok === false) {
      setMessage({
        type: "error",
        title: "Błąd ustawiania loginu",
        text: loginResponse.error ?? "Nieznany błąd",
      });
      return;
    }

    setUnlockedPlots(getDefaultUnlockedPlots());
    setPlotCrops({});
    setSeedInventory(getDefaultSeedInventory());
    await loadProfile(userId);

    setRegisterForm({
      login: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    setTab("login");
    setMessage({
      type: "success",
      title: "Konto utworzone",
      text: "Nowy gracz startuje z 3 darmowymi polami.",
    });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const identifier = loginForm.identifier.trim();
    const password = loginForm.password;

    if (!identifier || !password) {
      setMessage({
        type: "error",
        title: "Brak danych",
        text: "Podaj email oraz hasło.",
      });
      return;
    }

    if (!identifier.includes("@")) {
      setMessage({
        type: "error",
        title: "Wymagany adres email",
        text: "Zaloguj się adresem email. Logowanie loginem zostało wyłączone ze względów bezpieczeństwa.",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password,
    });

    if (error) {
      setMessage({
        type: "error",
        title: "Błędne logowanie",
        text: translateAuthError(error.message),
      });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      await loadProfile(session.user.id);
    }

    startSessionTimer();
    setLoginForm({ identifier: "", password: "" });
    setMessage({
      type: "success",
      title: "Witaj ponownie",
      text: "Sesja gracza została wczytana.",
    });
  }

  function startSessionTimer(startedAt?: number) {
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    const now = Date.now();
    const loginAt = startedAt ?? now;
    try { sessionStorage.setItem("plono_session_start", String(loginAt)); } catch { /* ignore */ }
    const remaining = SESSION_DURATION_MS - (now - loginAt);
    if (remaining <= 0) { void autoLogout(); return; }
    sessionTimeoutRef.current = setTimeout(() => { void autoLogout(); }, remaining);
  }

  function clearSessionTimer() {
    if (sessionTimeoutRef.current) { clearTimeout(sessionTimeoutRef.current); sessionTimeoutRef.current = null; }
    try { sessionStorage.removeItem("plono_session_start"); } catch { /* ignore */ }
  }

  async function autoLogout() {
    clearSessionTimer();
    await supabase.auth.signOut();
    resetLocalGameState();
    setMessage({
      type: "info",
      title: "Sesja wygasła",
      text: "Twoja 2-godzinna sesja dobiegła końca. Zaloguj się ponownie.",
    });
  }

  async function handleLogout() {
    clearSessionTimer();
    await supabase.auth.signOut();
    resetLocalGameState();
    setMessage({
      type: "info",
      title: "Wylogowano",
      text: "Sesja została zakończona.",
    });
  }

  async function handleAddGold(amount: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("dev_add_gold", { p_amount: amount });
    if (error) { setMessage({ type: "error", title: "Błąd dodawania złota", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; added?: number; money?: number } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd dodawania złota", text: response.error ?? "Nieznany błąd" }); return; }
    setMessage({ type: "success", title: "Dodano złoto!", text: `Dodano ${(response?.added ?? amount).toLocaleString("pl-PL")} złota.` });
    await loadProfile(profile.id);
  }

  async function handleAddSeeds(amount: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("dev_add_test_items", { p_mode: "seeds_all", p_amount: amount });
    if (error) { setMessage({ type: "error", title: "Błąd dodawania nasion", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; mode?: string; amount?: number; seed_inventory?: Record<string, number> } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd dodawania nasion", text: response.error ?? "Nieznany błąd" }); return; }
    setMessage({ type: "success", title: "Dodano nasiona!", text: `+${response?.amount ?? amount} szt. każdego rodzaju (wszystkie jakości).` });
    await loadProfile(profile.id);
  }

  async function handleAddEpic(amount: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("dev_add_test_items", { p_mode: "seeds_epic", p_amount: amount });
    if (error) { setMessage({ type: "error", title: "Błąd dodawania epickich nasion", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; mode?: string; amount?: number; seed_inventory?: Record<string, number> } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd dodawania epickich nasion", text: response.error ?? "Nieznany błąd" }); return; }
    setMessage({ type: "success", title: "Dodano epickie nasiona!", text: `+${response?.amount ?? amount} szt. ⭐ każdego rodzaju.` });
    await loadProfile(profile.id);
  }

  async function handleAddLegendary(amount: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("dev_add_test_items", { p_mode: "seeds_legendary", p_amount: amount });
    if (error) { setMessage({ type: "error", title: "Błąd dodawania legendarnych nasion", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; mode?: string; amount?: number; seed_inventory?: Record<string, number> } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd dodawania legendarnych nasion", text: response.error ?? "Nieznany błąd" }); return; }
    setMessage({ type: "success", title: "Dodano legendarne nasiona!", text: `+${response?.amount ?? amount} szt. 👑 każdego rodzaju.` });
    await loadProfile(profile.id);
  }

  async function handleAddBarnItems(amount: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("dev_add_test_items", { p_mode: "barn_items", p_amount: amount });
    if (error) { setMessage({ type: "error", title: "Błąd dodawania produktów", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; mode?: string; amount?: number; barn_items?: BarnItems } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd dodawania produktów", text: response.error ?? "Nieznany błąd" }); return; }
    if (response?.barn_items) saveBarnItems(response.barn_items);
    await loadProfile(profile.id);
    setMessage({ type: "success", title: "Dodano produkty!", text: `+${response?.amount ?? amount} × ${ANIMAL_ITEMS.length} rodzajów produktów ze zwierząt.` });
  }

  async function handleAddFruits(amount: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("dev_add_test_items", { p_mode: "fruits", p_amount: amount });
    if (error) { setMessage({ type: "error", title: "Błąd dodawania owoców", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; mode?: string; amount?: number; fruit_inventory?: Record<string, number> } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd dodawania owoców", text: response.error ?? "Nieznany błąd" }); return; }
    if (response?.fruit_inventory) saveFruitInventory(response.fruit_inventory);
    await loadProfile(profile.id);
    setMessage({ type: "success", title: "Dodano owoce!", text: `+${response?.amount ?? amount} × ${TREES.length} gatunków × 4 jakości (zwykły/soczysty/złoty/zgniłe).` });
  }

  async function handleAvatarSelect(idx: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("game_change_avatar_skin", { p_avatar_skin: idx });
    if (error) { setMessage({ type: "error", title: "Błąd zmiany avatara", text: error.message }); return; }
    const response = data as {
      ok?: boolean;
      error?: string;
      remaining_ms?: number;
      spent?: number;
      avatar_skin?: number;
      avatar_change_count?: number;
      last_avatar_change_at?: number;
    } | null;
    if (response?.ok === false) {
      if (typeof response.remaining_ms === "number") {
        const totalMins = Math.ceil(response.remaining_ms / 60000);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const timeStr = hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;
        setMessage({ type: "error", title: "Cooldown aktywny", text: `Następna zmiana avatara dostępna za ${timeStr}.` });
      } else {
        setMessage({ type: "error", title: "Błąd zmiany avatara", text: response.error ?? "Nieznany błąd." });
      }
      return;
    }
    const newSkin = response?.avatar_skin ?? idx;
    const newChangeCount = typeof response?.avatar_change_count === "number"
      ? response.avatar_change_count
      : avatarChangeCount;
    const newLastChangeAt = typeof response?.last_avatar_change_at === "number"
      ? response.last_avatar_change_at
      : lastAvatarChangeAt;
    setAvatarSkin(newSkin);
    setAvatarChangeCount(newChangeCount);
    setLastAvatarChangeAt(newLastChangeAt);
    saveAvatarDataLS(
      profile.id,
      newSkin,
      playerStats,
      freeSkillPoints,
      prevLevelRef.current,
      newChangeCount,
      newLastChangeAt,
    );
    await loadProfile(profile.id);
    setShowSkinModal(false);
  }

  async function handleBuyEpicAvatar(epicAvatarId: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("buy_epic_avatar", { p_avatar_id: epicAvatarId });
    if (error) { setMessage({ type: "error", title: "Błąd zakupu avatara", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; avatar_id?: number; cost?: Record<string,number>; seed_inventory?: Record<string,number>; unlocked_epic_avatars?: number[] } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd zakupu avatara", text: response.error ?? "Nieznany błąd" }); return; }
    if (response?.seed_inventory) setSeedInventory(response.seed_inventory);
    if (response?.unlocked_epic_avatars) setUnlockedEpicAvatars(response.unlocked_epic_avatars);
    setEpicPurchaseTarget(null);
    await loadProfile(profile.id);
    const es = EPIC_SKINS[epicAvatarId - EPIC_SKIN_START];
    setMessage({ type: "success", title: "⭐ Avatar odblokowany!", text: `Odblokowano epicki avatar: ${es?.name ?? ""}` });
  }

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

  async function handleAddHoneyJars(amount: number) {
    if (!profile?.id) return;
    const { data, error } = await supabase.rpc("dev_add_test_items", { p_mode: "honey_jars", p_amount: amount });
    if (error) { setMessage({ type: "error", title: "Błąd dodawania słoików miodu", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; mode?: string; amount?: number; hive_data?: HiveData; honey_jars?: number } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd dodawania słoików miodu", text: response.error ?? "Nieznany błąd" }); return; }
    if (response?.hive_data) setHiveData(response.hive_data);
    await loadProfile(profile.id);
    setMessage({ type: "success", title: "🍯 Dodano słoiki miodu!", text: `+${response?.amount ?? amount} słoików miodu.` });
  }

  async function handleResetAccount() {
    if (!profile?.id) return;
    if (!confirm(
      "⚠️ RESET KONTA — wszystko wraca do stanu nowego gracza:\n" +
      "• Poziom, XP, pieniądze, mapa\n" +
      "• Uprawy, nasiona, kompost (plecak + kompostownik)\n" +
      "• Stodoła: zwierzęta, sloty, produkty (jajka, mleko, futra…)\n" +
      "• Sad: drzewa i owoce wszystkich jakości\n" +
      "• Ul: poziom, pszczoły, słoiki, miód, strój pszczelarza\n" +
      "• Statystyki, punkty umiejętności, avatar, ekwipunek, epickie skiny\n\n" +
      "Kontynuować?"
    )) return;
    if (!confirm("Ostatnie potwierdzenie — na pewno chcesz zresetować całe konto?")) return;
    const _login = (profile as { login?: string }).login ?? null;
    const { data, error } = await supabase.rpc("dev_reset_account");
    if (error) { setMessage({ type: "error", title: "Błąd resetu", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; role?: string; level?: number; xp?: number; xp_to_next_level?: number; money?: number; current_map?: string } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd resetu", text: response.error ?? "Nieznany błąd" }); return; }
    // Reset tutoriala w DB — czekamy przed przeładowaniem strony
    if (_login) { await supabase.rpc("admin_reset_tutorial_test_account", { p_login: _login }); }
    // Wyczyść localStorage dla tego gracza (ekwipunek, statystyki, stodoła, sad, kompost...)
    // Dane są zapisane jako `klucz_${uid}` — clearPerSessionLocalStorage() tego nie oczyści
    const _uid = profile.id;
    const _lsResetKeys = [
      "plonopolis_char_equipped", "plonopolis_item_upg_reg", "plonopolis_owned_eq", "plonopolis_extra_eq",
      "plonopolis_kompost_charges", "plonopolis_kompost_batches", "plonopolis_slot_box", "plonopolis_settings",
      "plonopolis_barn", "plonopolis_barn_items", "plonopolis_orchard", "plonopolis_fruit_inv",
    ];
    const _lsResetUidKeys = [
      `plonopolis_skin_${_uid}`, `plonopolis_stats_${_uid}`, `plonopolis_fsp_${_uid}`,
      `plonopolis_prevlv_${_uid}`, `plonopolis_avatar_changes_${_uid}`, `plonopolis_avatar_last_change_${_uid}`,
      `plonopolis_eqslots_${_uid}`, `plonopolis_eq_${_uid}`,
    ];
    try {
      _lsResetKeys.forEach(k => { localStorage.removeItem(`${k}_${_uid}`); localStorage.removeItem(k); });
      _lsResetUidKeys.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
    // Pełne przeładowanie strony — gwarantuje świeży stan (w tym okno przewodnika)
    window.location.reload();
  }

  async function handleAddExp(amount: number) {
    if (!profile) return;
    const { data, error } = await supabase.rpc("dev_add_exp", { p_amount: amount });
    if (error) { setMessage({ type: "error", title: "Błąd dodawania EXP", text: error.message }); return; }
    const response = data as { ok?: boolean; error?: string; added?: number; level?: number; xp?: number; xp_to_next_level?: number } | null;
    if (response?.ok === false) { setMessage({ type: "error", title: "Błąd dodawania EXP", text: response.error ?? "Nieznany błąd" }); return; }
    await loadProfile(profile.id);
    setMessage({ type: "success", title: "EXP dodany!", text: `+${(response?.added ?? amount).toLocaleString("pl-PL")} EXP, poziom ${response?.level ?? "?"}.` });
  }

  async function handleUnlockPlot(plotId: number) {
    if (!profile) return;

    if (isPlotUnlocked(plotId)) {
      setMessage({
        type: "info",
        title: "Pole już odblokowane",
        text: `Pole #${plotId} jest już dostępne.`,
      });
      return;
    }

    const plotCost = getPlotUnlockCost(plotId);

    if (displayMoney < plotCost) {
      setMessage({ fieldOnly: true,
        type: "error",
        title: "Za mało pieniędzy",
        text: `Potrzebujesz ${plotCost} PLN, aby kupić pole #${plotId}.`,
      });
      return;
    }

    const { data, error } = await supabase.rpc("game_unlock_plot", {
      p_plot_id: plotId,
    });

    if (error) {
      // Brak danych przeszkody — sprawdź w DB czy pole jest faktycznie odblokowane
      if (error.message?.includes("Brak danych przeszkody") && profile?.id) {
        const { data: freshRow } = await supabase
          .from("profiles")
          .select("unlocked_plots, plot_obstacles")
          .eq("id", profile.id)
          .single();
        if (freshRow) {
          const freshUnlocked = parseUnlockedPlots(freshRow.unlocked_plots);
          setUnlockedPlots(freshUnlocked);
          if (freshRow.plot_obstacles && typeof freshRow.plot_obstacles === "object") {
            setPlotObstacles(freshRow.plot_obstacles as Record<string, { type: string; cost: number }>);
          }
          setPlotToBuy(null);
          setSelectedPlotId(null);
          if (freshUnlocked.includes(plotId)) {
            setMessage({ fieldOnly: true, type: "info", title: "Stan zsynchronizowany", text: `Pole #${plotId} jest już odblokowane — stan lokalny został naprawiony.` });
          } else {
            setMessage({ fieldOnly: true, type: "error", title: "Nie można odblokować pola", text: `Pole #${plotId} nie ma danych przeszkody w bazie. Skontaktuj się z administratorem lub zresetuj przeszkody w ustawieniach.` });
          }
        } else {
          setMessage({ fieldOnly: true, type: "error", title: "Błąd zakupu pola", text: error.message });
        }
        return;
      }
      setMessage({ fieldOnly: true,
        type: "error",
        title: "Błąd zakupu pola",
        text: error.message,
      });
      return;
    }

    await applyProfileState(extractRpcProfile(data));

    setPlotToBuy(null);
    setSelectedPlotId(plotId);

    const _ot = getPlotObstacleType(plotId);
    const _od = _ot ? OBSTACLE_DEFS[_ot] : null;
    setMessage({ fieldOnly: true,
      type: "success",
      title: "Pole odblokowane",
      text: `Usunięto ${_od ? `${_od.icon} ${_od.name}` : "przeszkodę"} z pola #${plotId} za ${plotCost} PLN.`,
    });
  }

  async function confirmBuyPlot() {
    if (!plotToBuy) return;
    await handleUnlockPlot(plotToBuy);
  }

  // ─── KOMPOSTOWNIK: aplikacja kompostu na pole ───
  async function applyCompostToPlot(plotId: number, compostKey: string) {
    const t = compostTypeFromKey(compostKey);
    if (!t) return;
    if (!profile?.id) return;
    if ((seedInventory[compostKey] ?? 0) <= 0) {
      setMessage({ fieldOnly: true, type:"info", title:"Brak kompostu", text:"Nie masz tego kompostu w plecaku." });
      return;
    }
    const plot = getPlotCrop(plotId);
    if (plot.cropId) {
      setMessage({ fieldOnly: true, type:"info", title:"Pole zajęte", text:"Kompost stosuje się na PUSTE pole — przed posadzeniem uprawy." });
      return;
    }
    if (plot.compostBonus) {
      setMessage({ fieldOnly: true, type:"info", title:"Już wzbogacone", text:"To pole ma już aktywny kompost. Posadź na nim uprawę." });
      return;
    }
    // Wartość bonusu jest ZASZYTA w kluczu kompostu (np. compost_growth_15 → 15)
    const value = compostValueFromKey(compostKey);
    const nextPlot: PlotCropState = { ...plot, compostBonus: { type: t, value } };
    const nextPlots = { ...plotCrops, [plotId]: nextPlot };
    setPlotCrops(nextPlots);
    // Update inventory
    const nextInv = { ...seedInventory };
    nextInv[compostKey] = (nextInv[compostKey] ?? 0) - 1;
    const ranOut = nextInv[compostKey] <= 0;
    if (ranOut) delete nextInv[compostKey];
    setSeedInventory(nextInv);
    seedInventoryRef.current = { ...seedInventoryRef.current, [compostKey]: (seedInventoryRef.current[compostKey] ?? 0) - 1 };
    // Jeśli to ostatni kompost danego rodzaju — zdejmij zaznaczenie
    if (ranOut) setSelectedSeedId(prev => prev === compostKey ? null : prev);
    // Persist — serialized write chain eliminuje race condition przy szybkim drag na wiele pól.
    // Każdy zapis czeka aż poprzedni się skończy, dopiero wtedy czyta świeży DB i pisze.
    // Przechwytujemy profileId i nextPlot/nextInv do closure zanim chain wystartuje.
    const _profileId = profile.id;
    const _nextPlot = nextPlot;
    const _nextInv = nextInv;
    compostWriteChainRef.current = compostWriteChainRef.current.then(async () => {
      const { data: _freshRowC } = await supabase
        .from("profiles")
        .select("plot_crops")
        .eq("id", _profileId)
        .single();
      const _safePlotsC = { ...parsePlotCrops(_freshRowC?.plot_crops), [plotId]: _nextPlot };
      await supabase.from("profiles").update({
        plot_crops: serializePlotCrops(_safePlotsC) as unknown as Record<string,unknown>,
        seed_inventory: _nextInv,
      }).eq("id", _profileId);
    });
    // Notice
    setCompostNotice({ type: t, value, plotId });
    setTimeout(() => setCompostNotice(null), 5000);
  }

  // ─── KOMPOST PRZEWODNIKA: stosuj na puste pole (przed sadzeniem) — multiplier 0.25 ───
  async function applyGuideCompostToPlot(plotId: number) {
    if (!profile?.id) return;
    // Blokada przed szybkim podwójnym kliknięciem na to samo pole
    if (compostApplyingRef.current.has(plotId)) return;
    if ((seedInventory["guide_compost"] ?? 0) <= 0) {
      setMessage({ fieldOnly: true, type:"info", title:"Brak kompostu", text:"Nie masz Kompostu Przewodnika w plecaku." });
      return;
    }
    const plot = getPlotCrop(plotId);
    if (plot.cropId) {
      setMessage({ fieldOnly: true, type:"info", title:"Pole zajęte", text:"Kompost Przewodnika stosuje się na puste pole — przed posadzeniem uprawy." });
      return;
    }
    if (plot.compostBonus) {
      setMessage({ fieldOnly: true, type:"info", title:"Już wzbogacone", text:"To pole ma już aktywny kompost. Posadź na nim uprawę." });
      return;
    }
    compostApplyingRef.current.add(plotId);
    try {
      // Ustaw compostBonus typu "guide" — getEffectiveGrowthTimeMs zastosuje mnożnik 0.25
      const nextPlot: PlotCropState = { ...plot, compostBonus: { type: "guide", value: 75 } };
      const nextPlots = { ...plotCrops, [plotId]: nextPlot };
      setPlotCrops(nextPlots);
      // Odejmij 1 z inwentarza
      const nextInv = { ...seedInventory };
      nextInv["guide_compost"] = (nextInv["guide_compost"] ?? 0) - 1;
      const ranOut = nextInv["guide_compost"] <= 0;
      if (ranOut) delete nextInv["guide_compost"];
      setSeedInventory(nextInv);
      seedInventoryRef.current = { ...seedInventoryRef.current, guide_compost: (seedInventoryRef.current["guide_compost"] ?? 0) - 1 };
      if (ranOut) setSelectedSeedId(prev => prev === "guide_compost" ? null : prev);
      // Persist — race condition guard: pobierz świeży plot_crops z DB, zmerguj tylko [plotId]
      // Chroni tutorial step 4: szybkie kliknięcie 3 pól nie nadpisuje poprzednich compostBonusów.
      const { data: _freshRowG } = await supabase
        .from("profiles")
        .select("plot_crops")
        .eq("id", profile.id)
        .single();
      const _safePlotsG = { ...parsePlotCrops(_freshRowG?.plot_crops), [plotId]: nextPlot };
      await supabase.from("profiles").update({
        plot_crops: serializePlotCrops(_safePlotsG) as unknown as Record<string,unknown>,
        seed_inventory: nextInv,
      }).eq("id", profile.id);
      // Powiadomienie — reużywamy compostNotice (COMPOST_DEFS["guide"] już istnieje)
      setCompostNotice({ type: "guide", value: 75, plotId });
      setTimeout(() => setCompostNotice(null), 5000);
      if (tutorialStep === 4) {
        // Licz faktyczne pola z guide z AKTUALNEGO (świeżego) plot_crops — nie stale closure
        const _guidePlots = Object.entries(_safePlotsG)
          .filter(([, p]) => p.compostBonus?.type === "guide")
          .map(([id]) => Number(id));
        const _nextIds = Array.from(new Set([...tutorialPlotIds, ..._guidePlots]));
        setTutorialPlotIds(_nextIds);
        if (_nextIds.length >= 3) {
          saveTutorialPlotIdsToStorage(profile.id, _nextIds.slice(0, 3));
          void advanceTutorialStep(5);
        }
      }
    } finally {
      compostApplyingRef.current.delete(plotId);
    }
  }

  // ─── TUTORIAL: zaawansuj krok (nie cofa, zapis do DB) ───
  async function advanceTutorialStep(nextStep: number) {
    if (!profile?.id) return;
    if (!profile.tutorial_started || profile.tutorial_completed || profile.tutorial_skipped) return;
    if (nextStep <= tutorialStep) return;
    setTutorialStep(nextStep);
    await supabase.from("profiles").update({ tutorial_step: nextStep }).eq("id", profile.id);
  }

  // ─── KOMPOSTOWNIK: wrzuć plon → +1 do bieżącej partii + dolicz wartość (base × rzadkość) do scoreSum ───
  async function depositCropToCompost(seedKey: string, count: number = 1) {
    if (kompostBusyRef.current) return; // chroni przed double-click race
    kompostBusyRef.current = true;
    try {
      const have = seedInventory[seedKey] ?? 0;
      if (have <= 0) return;
      // Parsuj jakość z klucza (np. "carrot_legendary" → baseCropId="carrot", quality="legendary")
      const { baseCropId, quality } = parseQualityKey(seedKey);
      const cropDef = CROPS.find(c => c.id === baseCropId);
      const baseValue = cropDef ? (COMPOST_BASE_VALUE_BY_LEVEL[cropDef.unlockLevel] ?? 1.0) : 1.0;
      const rarityKey = (quality ?? "good") as keyof typeof COMPOST_RARITY_MULT;
      const rarityMult = COMPOST_RARITY_MULT[rarityKey] ?? 1.0;
      const valuePerCrop = baseValue * rarityMult;

      const batch: CompostBatch = { fill: kompostBatch.fill, scoreSum: kompostBatch.scoreSum, cropIds: Array.isArray(kompostBatch.cropIds) ? [...kompostBatch.cropIds] : [] };
      const room = KOMPOST_BATCH_SIZE - batch.fill;
      if (room <= 0) return;
      const added = Math.min(Math.min(count, have), room);
      if (added <= 0) return;
      batch.fill += added;
      batch.scoreSum += added * valuePerCrop;
      if (!batch.cropIds) batch.cropIds = [];
      if (baseCropId && !batch.cropIds.includes(baseCropId)) batch.cropIds.push(baseCropId);

      const nextInv = { ...seedInventory };
      nextInv[seedKey] = have - added;
      if (nextInv[seedKey] <= 0) delete nextInv[seedKey];
      setSeedInventory(nextInv);
      saveKompostBatch(batch);
      if (profile?.id) {
        await supabase.from("profiles").update({ seed_inventory: nextInv }).eq("id", profile.id);
      }
    } finally {
      kompostBusyRef.current = false;
    }
  }

  // ─── KOMPOSTOWNIK: wrzuć zgniłe owoce → +1 do bieżącej partii (score: cena owocu × 0.25) ───
  async function depositFruitToCompost(fruitKey: string, count: number = 1) {
    if (kompostBusyRef.current) return;
    kompostBusyRef.current = true;
    try {
      const have = fruitInventory[fruitKey] ?? 0;
      if (have <= 0) return;
      // Parsuj fruitId z klucza np. "jablko_zgnile" → fruitId="jablko"
      const lastU = fruitKey.lastIndexOf("_");
      const fruitId = fruitKey.slice(0, lastU);
      const tree = TREES.find(t => t.fruitId === fruitId);
      // Score = cena owocu × 0.25 (jak "rotten" uprawa — najsłabszy kompost)
      const valuePerFruit = tree ? tree.pricePerFruit * COMPOST_RARITY_MULT.rotten : 1.0;

      const batch: CompostBatch = { fill: kompostBatch.fill, scoreSum: kompostBatch.scoreSum, cropIds: Array.isArray(kompostBatch.cropIds) ? [...kompostBatch.cropIds] : [] };
      const room = KOMPOST_BATCH_SIZE - batch.fill;
      if (room <= 0) return;
      const added = Math.min(Math.min(count, have), room);
      if (added <= 0) return;
      batch.fill += added;
      batch.scoreSum += added * valuePerFruit;
      if (!batch.cropIds) batch.cropIds = [];
      const fruitSpeciesKey = `fruit_${fruitId}`;
      if (!batch.cropIds.includes(fruitSpeciesKey)) batch.cropIds.push(fruitSpeciesKey);

      const nextInv = { ...fruitInventory };
      nextInv[fruitKey] = have - added;
      if (nextInv[fruitKey] <= 0) delete nextInv[fruitKey];
      saveFruitInventory(nextInv);
      saveKompostBatch(batch);
      if (profile?.id) {
        await supabase.rpc("sync_fruit_inventory", { p_user_id: profile.id, p_items: nextInv });
      }
    } finally {
      kompostBusyRef.current = false;
    }
  }

  // ─── KOMPOSTOWNIK: odbierz nagrody — partia (fill=100) = 5 nagród z TIEREM zależnym od score ───
  async function claimKompostReward() {
    if (kompostBusyRef.current) return;
    kompostBusyRef.current = true;
    try {
    const batch = kompostBatch;
    if (batch.fill < KOMPOST_BATCH_SIZE) return;
    const playerLvl = profile?.level ?? 1;
    const rewards: KompostRewardEntry[] = [];
    let inv = { ...seedInventory };
    let owned = { ...ownedEqItems };
    let upgReg = { ...itemUpgRegistry };
    let extras = [...extraEqItems];
    const newHistoryEntries: Array<{label: string; color: string; icon: string; ts?: number; count?: number}> = [];

    const score = batch.scoreSum / KOMPOST_BATCH_SIZE;
    const quality = getCompostQualityFromScore(score);
    // Bonus różnorodności z tej partii
    const diversityCount = (batch.cropIds ?? []).length;
    const diversityItemBonus = Math.min(5, Math.floor(diversityCount / 2));
    const diversityTierBoost = diversityCount >= 6;
    const _luckItemBonus = Math.min(5, (effectiveStats.szczescie ?? 0) * 0.05);
    const itemDropChance = 10 + diversityItemBonus + _luckItemBonus;

    for (let rIdx = 0; rIdx < KOMPOST_REWARDS_PER_BATCH; rIdx++) {
      // Jackpot 0.5% — legendarny item bez względu na jakość partii
      if (Math.random() * 100 < JACKPOT_CHANCE) {
        const jackpotPool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= 21 && it.unlockLevel <= playerLvl);
        const jpFallback = jackpotPool.length > 0 ? jackpotPool : CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel <= playerLvl);
        if (jpFallback.length > 0) {
          const item = jpFallback[Math.floor(Math.random() * jpFallback.length)];
          if (!owned[item.id]) { owned = { ...owned, [item.id]: true as const }; }
          else { extras = [...extras, { uid: makeExtraUid(), id: item.id, upg: 0 }]; }
          rewards.push({ kind:"item", itemId: item.id, itemName: item.name, itemIcon: item.icon });
          newHistoryEntries.push({ label: `JACKPOT! ${item.name}`, color: "#fbbf24", icon: "✨", ts: Date.now(), count: 1 });
          continue;
        }
      }

      const roll = Math.random() * 100;
      if (roll < itemDropChance) {
        let rolledTierIdx = rollFromChances(ITEM_TIER_BY_QUALITY[quality]);
        if (diversityTierBoost && rolledTierIdx < 4 && Math.random() < 0.30) rolledTierIdx += 1;
        const minLvl = rolledTierIdx * 5 + 1;
        const maxLvl = rolledTierIdx * 5 + 5;
        let pool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= minLvl && it.unlockLevel <= maxLvl && it.unlockLevel <= playerLvl);
        if (pool.length === 0) {
          for (let t = rolledTierIdx - 1; t >= 0; t--) {
            pool = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= t*5+1 && it.unlockLevel <= t*5+5 && it.unlockLevel <= playerLvl);
            if (pool.length > 0) break;
          }
        }
        if (pool.length > 0) {
          const item = pool[Math.floor(Math.random() * pool.length)];
          const rarityDef = ITEM_TIER_RARITY[Math.min(4, rolledTierIdx)];
          if (!owned[item.id]) { owned = { ...owned, [item.id]: true as const }; }
          else { extras = [...extras, { uid: makeExtraUid(), id: item.id, upg: 0 }]; }
          rewards.push({ kind:"item", itemId: item.id, itemName: item.name, itemIcon: item.icon });
          newHistoryEntries.push({ label: item.name, color: rarityDef.border, icon: item.icon, ts: Date.now(), count: 1 });
          continue;
        }
        // Brak dostępnego przedmiotu → fallback do kompostu
      }
      // Kompost growth/yield/exp — równe szanse, tier deterministyczny wg jakości
      let compostType: CompostType;
      const r2 = Math.random() * 100;
      if (r2 < 33.3) compostType = "growth";
      else if (r2 < 66.6) compostType = "yield";
      else compostType = "exp";
      const compostTierIdx = COMPOST_TIER_FIXED_BY_QUALITY[quality];
      const value = COMPOST_DEFS[compostType].bonusValues[compostTierIdx];
      const key = compostKeyFor(compostType, value);
      inv = { ...inv, [key]: (inv[key] ?? 0) + 1 };
      rewards.push({ kind:"compost", compostType, value });
      const cDef = COMPOST_DEFS[compostType];
      const tColor = compostTierIdx === 0 ? "#9ca3af" : compostTierIdx === 1 ? "#22c55e" : "#a78bfa";
      newHistoryEntries.push({ label: `${cDef.name} (${cDef.tierName(value)})`, color: tColor, icon: cDef.icon, ts: Date.now(), count: 1 });
    }

    // Reset partii po odebraniu
    const emptyBatch: CompostBatch = { fill: 0, scoreSum: 0, cropIds: [] };
    seedInventoryRef.current = inv;
    setSeedInventory(inv);
    saveOwnedEqItems(owned);
    saveItemUpg(upgReg);
    saveExtraEqItems(extras);
    saveKompostBatch(emptyBatch);
    if (profile?.id) {
      await supabase.from("profiles").update({ seed_inventory: inv }).eq("id", profile.id);
    }
    setKompostDropHistory(prev => {
      const now = Date.now();
      const WINDOW = 15 * 60 * 1000;
      let updated = prev.filter(e => now - e.ts <= WINDOW);
      for (const ne of newHistoryEntries) {
        const idx = updated.findIndex(e => e.label === ne.label);
        if (idx !== -1) {
          updated = [{ ...updated[idx], count: updated[idx].count + 1, ts: now }, ...updated.filter((_, i) => i !== idx)];
        } else {
          updated = [{ ...ne, ts: ne.ts ?? Date.now(), count: ne.count ?? 1 }, ...updated];
        }
      }
      return updated;
    });
    setKompostRewards(rewards);
    } finally {
      kompostBusyRef.current = false;
    }
  }

  // ─── Narzędzia masowe (premium) ───

  function handleBulkCompost() {
    if (tutorialStep >= 1 && tutorialStep <= 11) {
      setMessage({ fieldOnly: true, type:"info", title:"Przewodnik aktywny", text:"Najpierw wykonaj krok przewodnika." });
      return;
    }
    if (!profile?.id) return;
    const compostKey = selectedSeedId;
    if (!compostKey || !isCompostKey(compostKey)) {
      setMessage({ fieldOnly: true, type:"info", title:"Ciągnik", text:"Najpierw wybierz kompost z plecaka (kliknij przycisk Kompost po lewej)." });
      return;
    }
    const t = compostTypeFromKey(compostKey);
    if (!t) return;
    const value = compostValueFromKey(compostKey);
    const available = seedInventory[compostKey] ?? 0;
    if (available <= 0) {
      setMessage({ fieldOnly: true, type:"info", title:"Brak kompostu", text:"Nie masz tego kompostu w plecaku." });
      return;
    }
    const plotUpdates: Record<number, PlotCropState> = {};
    let used = 0;
    for (const plotId of unlockedPlots) {
      if (used >= available) break;
      const plot = getPlotCrop(plotId);
      if (plot.cropId || plot.compostBonus) continue;
      plotUpdates[plotId] = { ...plot, compostBonus: { type: t, value } };
      used++;
    }
    if (used === 0) {
      setMessage({ fieldOnly: true, type:"info", title:"Ciągnik", text:"Brak wolnych pól bez kompostu." });
      return;
    }
    setPlotCrops(prev => ({ ...prev, ...plotUpdates }));
    const newInv = { ...seedInventory };
    newInv[compostKey] = (newInv[compostKey] ?? 0) - used;
    if ((newInv[compostKey] ?? 0) <= 0) delete newInv[compostKey];
    setSeedInventory(newInv);
    seedInventoryRef.current = { ...seedInventoryRef.current, [compostKey]: (seedInventoryRef.current[compostKey] ?? 0) - used };
    if ((seedInventoryRef.current[compostKey] ?? 0) <= 0 && selectedSeedId === compostKey) setSelectedSeedId(null);
    const _pid = profile.id;
    const _pu = { ...plotUpdates };
    const _ni = newInv;
    compostWriteChainRef.current = compostWriteChainRef.current.then(async () => {
      const { data: _fr } = await supabase.from("profiles").select("plot_crops").eq("id", _pid).single();
      const _sp = { ...parsePlotCrops(_fr?.plot_crops) };
      for (const [id, ps] of Object.entries(_pu)) _sp[Number(id)] = ps;
      await supabase.from("profiles").update({
        plot_crops: serializePlotCrops(_sp) as unknown as Record<string, unknown>,
        seed_inventory: _ni,
      }).eq("id", _pid);
    });
    setMessage({ fieldOnly: true, type:"success", title:"🚜 Ciągnik", text:`Zastosowano kompost na ${used} pol${used === 1 ? "u" : "ach"}.` });
  }

  function handleBulkPlant() {
    if (tutorialStep >= 1 && tutorialStep <= 11) {
      setMessage({ fieldOnly: true, type:"info", title:"Przewodnik aktywny", text:"Najpierw wykonaj krok przewodnika." });
      return;
    }
    const seedId = selectedSeedId;
    if (!seedId || isCompostKey(seedId) || isGuideCompostKey(seedId)) {
      setMessage({ fieldOnly: true, type:"info", title:"Ogrodnik", text:"Najpierw wybierz nasiono z plecaka (kliknij przycisk Nasiona po lewej)." });
      return;
    }
    const { quality: _q } = parseQualityKey(seedId);
    if (_q === "rotten") {
      setMessage({ fieldOnly: true, type:"info", title:"Ogrodnik", text:"Zgniłe nasiona nie nadają się do sadzenia." });
      return;
    }
    const available = seedInventoryRef.current[seedId] ?? 0;
    if (available <= 0) {
      setMessage({ fieldOnly: true, type:"info", title:"Brak nasion", text:"Nie masz już tych nasion w plecaku." });
      return;
    }
    let queued = 0;
    for (const plotId of unlockedPlots) {
      if (queued >= available) break;
      const plot = getPlotCrop(plotId);
      if (plot.cropId) continue;
      handlePlantFromSelectedSeed(plotId, seedId);
      queued++;
    }
    if (queued === 0) {
      setMessage({ fieldOnly: true, type:"info", title:"Ogrodnik", text:"Brak wolnych pól do posadzenia." });
    } else {
      setMessage({ fieldOnly: true, type:"success", title:"🌱 Ogrodnik", text:`Sadzę na ${queued} pol${queued === 1 ? "u" : "ach"}…` });
    }
  }

  function handleBulkWater() {
    if (tutorialStep >= 1 && tutorialStep <= 11) {
      setMessage({ fieldOnly: true, type:"info", title:"Przewodnik aktywny", text:"Najpierw wykonaj krok przewodnika." });
      return;
    }
    let queued = 0;
    for (const plotId of unlockedPlots) {
      const plot = getPlotCrop(plotId);
      if (!plot.cropId || plot.watered || isCropReady(plotId)) continue;
      void handleWaterPlot(plotId);
      queued++;
    }
    if (queued === 0) {
      setMessage({ fieldOnly: true, type:"info", title:"Zraszacz", text:"Brak pól do podlania (wszystkie podlane lub gotowe)." });
    } else {
      setMessage({ fieldOnly: true, type:"success", title:"💧 Zraszacz", text:`Podlewam ${queued} pol${queued === 1 ? "e" : "i"}…` });
    }
  }

  function handleBulkHarvest() {
    if (tutorialStep >= 1 && tutorialStep <= 11) {
      setMessage({ fieldOnly: true, type:"info", title:"Przewodnik aktywny", text:"Najpierw wykonaj krok przewodnika." });
      return;
    }
    let queued = 0;
    for (const plotId of unlockedPlots) {
      if (!isCropReady(plotId)) continue;
      void handleHarvestPlot(plotId);
      queued++;
    }
    if (queued === 0) {
      setMessage({ fieldOnly: true, type:"info", title:"Kombajn", text:"Brak gotowych upraw do zebrania." });
    } else {
      setMessage({ fieldOnly: true, type:"success", title:"🌾 Kombajn", text:`Zbieram z ${queued} pol${queued === 1 ? "a" : "i"}…` });
    }
  }

  async function handleHarvestPlot(
    plotId: number,
    _skipTimer: boolean = false,
    _snapBonusesArg?: { extraHarvestPct?: number; bonusDropPct?: number; expPct?: number },
    _fromDrag = false,
  ) {
    if (!profile) return;

    const plot = getPlotCrop(plotId);
    if (!plot.cropId) {
      if (!_fromDrag) setMessage({ fieldOnly: true, type: "info", title: "Puste pole", text: "Najpierw coś posadź na tym polu." });
      return;
    }

    const crop = CROPS.find((item) => item.id === plot.cropId);
    if (!crop) {
      if (!_fromDrag) setMessage({ type: "error", title: "Nieznana uprawa", text: "Nie udało się rozpoznać uprawy na tym polu." });
      return;
    }

    if (!isCropReady(plotId)) {
      if (!_fromDrag) setMessage({ type: "info", title: "Uprawa jeszcze rośnie", text: `${crop.name} będzie gotowa za około ${formatHMS(getRemainingGrowthSeconds(plotId))}.` });
      return;
    }

    // ─── Blokada tutoriala ───
    // Kroki 1–10: zbieranie jeszcze niedozwolone (przewodnik sam zaawansuje)
    if (tutorialStep >= 1 && tutorialStep <= 10) {
      if (!_fromDrag) setMessage({ type: "info", title: "Przewodnik aktywny", text: "Najpierw wykonaj krok przewodnika." });
      return;
    }
    // Krok 11: zbieranie tylko pól tutoriala
    if (tutorialStep === 11 && !tutorialPlotIds.includes(plotId)) {
      if (!_fromDrag) setMessage({ type: "info", title: "Przewodnik aktywny", text: "Zbierz najpierw marchewki z pól przewodnika." });
      return;
    }

    // ─── Kolejkowanie zbioru ───
    if (!_skipTimer) {
      // Dedup — nie kolejkuj jeśli akcja harvest na tym polu już jest aktywna lub w kolejce
      if (
        harvestActiveRef.current === plotId ||
        harvestQueueRef.current.some(a => a.plotId === plotId)
      ) return;
      // Snapshot bonusów eq w momencie kliknięcia — anti-exploit (gracz nie może zmieniać ekwipunku w trakcie)
      const _harvestDurMs = BASE_HARVEST_MS;
      const _harvestBonusesSnapshot = {
        extraHarvestPct: calcStatEffect(effectiveStats.zrecznosc + getEquipFlatBonus(" pkt Zrecznosci", charEquipped), 0.004),
        bonusDropPct:    calcStatEffect(effectiveStats.szczescie + getEquipFlatBonus(" pkt Szczescia", charEquipped), 0.0025),
        expPct:          getEquipBonusPct("% EXP", charEquipped) + getEquipBonusPct("% EXP z upraw", charEquipped),
      };
      enqueuePlotAction(plotId, "harvest", async () => {
        const _fp = plotCropsRef.current[plotId];
        if (!_fp?.cropId || !isCropReady(plotId)) {
          setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });
          return;
        }
        setPendingFieldActions(prev => ({
          ...prev,
          [plotId]: { kind: "harvest", startMs: Date.now(), durationMs: _harvestDurMs, bonusesSnapshot: _harvestBonusesSnapshot },
        }));
        await new Promise<void>(resolve => setTimeout(resolve, _harvestDurMs));
        await handleHarvestPlot(plotId, true, _harvestBonusesSnapshot);
      });
      return;
    }
    // Timer dobiegł końca — sprawdź FRESH state (gracz mógł zmienić w międzyczasie)
    {
      const _freshPlot = plotCropsRef.current[plotId];
      if (!_freshPlot?.cropId) {
        setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });
        setMessage({ type: "info", title: "Pole opróżnione", text: "Uprawa zniknęła zanim akcja się zakończyła." });
        return;
      }
    }
    // SNAPSHOT bonusów z chwili kliknięcia — przekazany BEZPOŚREDNIO przez parametr
    // (nie z React state, bo setTimeout closure ma stale state). Chroni przed exploitem
    // przebierania w trakcie timera. Brak snapshotu = błąd ścieżki — używamy 0 (bezpieczny default).
    const _snapBonuses = _snapBonusesArg;
    if (!_snapBonuses) {
      console.warn(`[harvest] Brak snapshotu bonusów dla pola ${plotId} — używam zer.`);
    }
    // Zdejmij wskaźnik paska, kontynuuj RPC
    setPendingFieldActions(prev => { const n = { ...prev }; delete n[plotId]; return n; });

    const previousLevel = displayLevel;

    const effectiveGrowMs = getEffectiveGrowthTimeMs(plotId);
    // Jakość zasadzonego nasiona (z pola w DB — decyduje o ścieżce EXP i popup)
    const _plantedQualityRaw = getPlotCrop(plotId).plantedQuality ?? "good";
    const _plantedQuality = (["good","epic","rotten","legendary"].includes(_plantedQualityRaw) ? _plantedQualityRaw : "good") as "good"|"epic"|"rotten"|"legendary";

    // ─── Legendarny drop: SQL liczy server-side (eliminuje race condition) ───
    // _legExpMult usuwamy — SQL zwraca legendary_exp_mult w odpowiedzi RPC

    // ─── Epicki EXP — SQL oblicza ×3-6 server-side (uwzględnia rotten roll → 0 EXP) ───

    // ─── Parametry bonusów do RPC (atomicznie po stronie SQL — anti-race) ───
    // Dla legendarnych: zerujemy compost/extra/bonusDrop (klient sam aplikuje legendarny dropy).
    const _plotPreRpc = getPlotCrop(plotId);
    const _compostBonusForRpc = _plotPreRpc.compostBonus ?? null;
    const _compostYieldExtraForRpc = (_plantedQuality !== "legendary" && _compostBonusForRpc?.type === "yield")
      ? (_compostBonusForRpc.value ?? 0)
      : 0;
    const _extraHarvestPctForRpc = _plantedQuality !== "legendary" ? (_snapBonuses?.extraHarvestPct ?? 0) : 0;
    const _bonusDropPctForRpc    = _plantedQuality !== "legendary" ? (_snapBonuses?.bonusDropPct ?? 0) : 0;
    // Łączny % bonus EXP (eq + kompost Nauki) — SQL aplikuje atomicznie, eliminuje race condition
    // klient-side profiles.update przy "Zbierz wszystko".
    const _expEqPctForRpc     = _snapBonuses?.expPct ?? 0;
    const _compostExpPctForRpc = (_compostBonusForRpc?.type === "exp") ? (_compostBonusForRpc.value ?? 0) : 0;
    const _expBonusPctForRpc  = _expEqPctForRpc + _compostExpPctForRpc;

    const { data, error } = await supabase.rpc("game_harvest_plot", {
      p_plot_id: plotId,
      p_effective_grow_ms: effectiveGrowMs,
      p_zrecznosc: effectiveStats.zrecznosc ?? 0,
      p_planted_quality: _plantedQuality,
      // 0 = SQL decyduje (legendarny i epic EXP mult generowany server-side)
      p_exp_mult_override: 0,
      // Atomicznie po stronie SQL (eliminuje race condition przy zbiorze wielu pól naraz)
      p_compost_yield_extra: _compostYieldExtraForRpc,
      p_extra_harvest_pct:   _extraHarvestPctForRpc,
      p_bonus_drop_pct:      _bonusDropPctForRpc,
      p_szczescie:           effectiveStats.szczescie ?? 0,
      // Bonus EXP atomicznie — SQL zwraca exp_gained (fix: inflated popup przy "Zbierz wszystko")
      p_exp_bonus_pct:       _expBonusPctForRpc,
    });
    if (error) {
      setMessage({ type: "error", title: "Błąd zbioru", text: error.message });
      return;
    }

    // Usuń zamrożony mult statystyk — pole wyczyszczone po zbiorze
    if (typeof window !== "undefined" && profile?.id) {
      localStorage.removeItem(`plonopolis_fsm_${profile.id}_${plotId}`);
    }

    // Nowy format RPC: { profile: {...}, zrecznosc_triggered: bool }
    const _rpcWrapper = data as { profile?: unknown; zrecznosc_triggered?: boolean };
    const harvestRpcProfile = extractRpcProfile(_rpcWrapper.profile ?? data);
    const rpcProf = harvestRpcProfile as Profile;
    const rpcInv = (rpcProf?.seed_inventory && typeof rpcProf.seed_inventory === "object")
      ? rpcProf.seed_inventory as Record<string, number>
      : {};
    const _zrecznoscionTriggered = _rpcWrapper.zrecznosc_triggered ?? false;

    // Buduj nextInventory ze zwróconego przez SQL inventory (źródło prawdy dla WSZYSTKICH typów).
    // Legendarny drop obliczany server-side — eliminuje race condition klient-side przy
    // masowym zbiorze (każdy równoległy harvest ma własny FOR UPDATE lock w SQL).
    const _rawNext: Record<string, number> = {};
    for (const [_k, _v] of Object.entries(rpcInv)) {
      if (typeof _v === "number") _rawNext[_k] = _v;
    }
    // Migracja: usuń stare klucze bez sufiksu jakości (np. "carrot" → "carrot_good")
    const nextInventory: Record<string, number> = parseSeedInventory(_rawNext);

    // ─── Bonus z kompostu (zachowany — używany do EXP bonus i notice) ───
    const _compostBonusOnPlot = plot.compostBonus ?? null;

    // ─── Wartości zwrócone przez RPC (atomicznie aplikowane przez SQL) ───
    // SQL jest źródłem prawdy dla WSZYSTKICH typów nasion (good / epic / rotten / legendary).
    // gained_* = dokładnie to, co SQL dodał do DB w tej transakcji.
    const _gainedGood      = (typeof (_rpcWrapper as { gained_good?: unknown }).gained_good      === "number") ? (_rpcWrapper as { gained_good: number }).gained_good           : 0;
    const _gainedEpic      = (typeof (_rpcWrapper as { gained_epic?: unknown }).gained_epic      === "number") ? (_rpcWrapper as { gained_epic: number }).gained_epic           : 0;
    const _gainedRotten    = (typeof (_rpcWrapper as { gained_rotten?: unknown }).gained_rotten  === "number") ? (_rpcWrapper as { gained_rotten: number }).gained_rotten       : 0;
    const _gainedLegendary = (typeof (_rpcWrapper as { gained_legendary?: unknown }).gained_legendary === "number") ? (_rpcWrapper as { gained_legendary: number }).gained_legendary : 0;
    const _totalYield      = _gainedGood + _gainedEpic + _gainedRotten + _gainedLegendary;

    // Zastosuj wynik RPC (XP, poziom, pola) — profil z poprawnym parserem wrappera
    const nextProfile = await applyProfileState(harvestRpcProfile);
    if (tutorialStep === 11 && tutorialPlotIds.includes(plotId)) {
      setTutorialHarvestedIds(prev => {
        const _newHarvested = prev.includes(plotId) ? prev : [...prev, plotId];
        if (_newHarvested.length >= 3) void advanceTutorialStep(12);
        return _newHarvested;
      });
    }
    // Synchronizacja stanu klienta z DB.
    // Używamy Math.max per klucz (nie absolutnego przypisania), żeby równoległe żniwa
    // nie nadpisywały się wzajemnie mniejszą wartością (race condition przy masowym zbiorze).
    setSeedInventory(prev => {
      const _merged: Record<string, number> = { ...prev };
      for (const [_k, _v] of Object.entries(nextInventory)) {
        if (typeof _v === "number") _merged[_k] = Math.max(_merged[_k] ?? 0, _v);
      }
      seedInventoryRef.current = _merged; // ref zawsze = najnowszy stan
      return _merged;
    });
    // SQL jest źródłem prawdy dla WSZYSTKICH typów (w tym legendarnych).
    // NIE nadpisujemy DB pełnym obiektem — chroni przed race condition przy masowym zbiorze.

    // EXP tego pola — SQL zwraca dokładną wartość (base × mult × bonus%).
    // NIE używamy diffu rpcProf.xp - prevXp: przy "Zbierz wszystko" xp akumuluje się
    // w każdym kolejnym RPC (FOR UPDATE serializacja) → diff byłby coraz większy.
    // SQL sam aplikuje cap (legendarny ≤ exp_reward × 50) i bonus EXP atomicznie.
    const _expGainedRpc = (typeof (_rpcWrapper as { exp_gained?: unknown }).exp_gained === "number")
      ? (_rpcWrapper as { exp_gained: number }).exp_gained
      : null;
    const actualExp = _expGainedRpc !== null
      ? Math.max(0, _expGainedRpc)
      : Math.max(0, crop.expReward);

    // ─── Powiadomienie o aktywacji kompostu ───
    if (_compostBonusOnPlot) {
      setCompostNotice({ type: _compostBonusOnPlot.type, value: _compostBonusOnPlot.value, plotId });
      setTimeout(() => setCompostNotice(null), 5000);
    }

    // Dodaj do logu zbiorów — wyłącznie gained_* z RPC (SQL jest źródłem prawdy).
    // Dotyczy WSZYSTKICH typów nasion: good / epic / rotten / legendary.
    // Eliminuje rozbieżności przy równoległym "Zbierz wszystko" (brak diff/snapshot).
    {
      const _now2 = Date.now();
      const _legExpMultRpc = (typeof (_rpcWrapper as { legendary_exp_mult?: unknown }).legendary_exp_mult === "number")
        ? (_rpcWrapper as { legendary_exp_mult: number }).legendary_exp_mult : 0;
      const _qualGainedRpc: Record<CropQuality, number> = {
        good:      Math.max(0, _gainedGood),
        epic:      Math.max(0, _gainedEpic),
        rotten:    Math.max(0, _gainedRotten),
        legendary: Math.max(0, _gainedLegendary),
      };
      const _diffQuals = (["rotten","good","epic","legendary"] as CropQuality[]).filter(_q => _qualGainedRpc[_q] > 0);
      const _logEvents = _diffQuals.map((_q, _idx) => {
        const _isFirst = _idx === 0;
        const _bonusSrc = _isFirst
          ? (_plantedQuality === "legendary" && _legExpMultRpc > 0
              ? `🌟 ×${_legExpMultRpc} EXP`
              : _zrecznoscionTriggered ? "Zręczność 🎯" : null)
          : null;
        return {
          id: ++harvestEventIdRef.current,
          cropId: crop.id,
          cropName: crop.name,
          baseAmount: _qualGainedRpc[_q],
          bonusAmount: 0,
          bonusSource: _bonusSrc,
          baseExp: _isFirst ? actualExp : 0,
          timestamp: _now2,
          quality: _q,
          compostBonus: _isFirst ? (_compostBonusOnPlot ?? null) : null,
          expBonusPct: _isFirst ? _expBonusPctForRpc : 0,
        };
      });
      setHarvestLog(prev => [
        ...prev.filter(e => e.timestamp >= fieldViewOpenedAtRef.current),
        ..._logEvents,
      ]);
    }
    // ─── Historia postępu: zbiór ───
    if (profile?.id) {
      const _rpcLvl = rpcProf?.level ?? previousLevel;
      const _dp = loadDP(profile.id);
      _dp.harvests += 1;
      _dp.expGained += actualExp;
      _dp.levelsGained += Math.max(0, _rpcLvl - previousLevel);
      saveDP(profile.id, _dp);
      setDailyProgress({ ..._dp });
    }
  }

  // ─── TARG GRACZY: helpery ─────────────────────────────────────────────────
  function marketMinPrice(type: string, key: string, upg?: number): number {
    if (type === "equipment") {
      const eItem = CHAR_EQUIP_ITEMS.find(i => i.id === key);
      if (!eItem) return 1;
      const tier = getItemTierIndex(eItem.unlockLevel);
      if (tier <= 3) return 1;
      const baseMin: Record<number, number> = { 4: 3000, 5: 6000, 6: 12000, 7: 25000, 8: 50000 };
      const base = baseMin[Math.min(tier, 8)] ?? 1;
      const upgMults = [1.0, 1.03, 1.07, 1.12, 1.17, 1.23, 1.35, 1.5, 2.0, 2.5, 3.4];
      const mult = upgMults[Math.min(upg ?? 0, 10)] ?? 3.4;
      return Math.round(base * mult);
    }
    return 1;
  }
  function marketItemLabel(type: string, key: string): { name: string; icon: string } {
    if (type === "crop") {
      const { baseCropId, quality } = parseQualityKey(key);
      const crop = CROPS.find(c => c.id === baseCropId);
      const qDef = quality ? CROP_QUALITY_DEFS[quality] : null;
      return { name: `${crop?.name ?? baseCropId} (${qDef?.label ?? quality ?? ""})`, icon: qDef?.badge ?? "" };
    }
    if (type === "compost") {
      const ct = compostTypeFromKey(key);
      const val = compostValueFromKey(key);
      if (ct) { const def = COMPOST_DEFS[ct]; return { name: `${def.name} (${def.tierName(val)})`, icon: def.icon }; }
      return { name: key, icon: "🌿" };
    }
    if (type === "barn_item") {
      const ai = ANIMAL_ITEMS.find(a => a.id === key);
      return { name: ai?.name ?? key, icon: ai?.icon ?? "🐾" };
    }
    if (type === "fruit") {
      const qualSuffix = (["_zloty","_soczysty","_zgnile","_zwykly"] as const).find(s => key.endsWith(s));
      if (qualSuffix) {
        const treeId = key.slice(0, -qualSuffix.length);
        const tree = TREES.find(t => t.id === treeId);
        const qDef = FRUIT_QUALITY_DEFS[qualSuffix.slice(1) as FruitQuality];
        return { name: `${tree?.fruitName ?? treeId} (${qDef?.label ?? ""})`, icon: (tree?.fruitIcon ?? "🍎") + (qDef?.icon ?? "") };
      }
      return { name: key, icon: "🍎" };
    }
    if (type === "honey") return { name: "Słoik miodu", icon: "🍯" };
    if (type === "equipment") {
      const eItem = CHAR_EQUIP_ITEMS.find(i => i.id === key);
      return { name: eItem?.name ?? key, icon: eItem?.icon ?? "⚔️" };
    }
    return { name: key, icon: "📦" };
  }
  function getMarketItemImg(type: MarketItemType, key: string): string | null {
    if (type === "crop") {
      const { baseCropId, quality } = parseQualityKey(key);
      const crop = CROPS.find(c => c.id === baseCropId);
      if (!crop) return null;
      if (quality === "legendary" && crop.legendarySpritePath) return crop.legendarySpritePath;
      if (quality === "epic"      && crop.epicSpritePath)      return crop.epicSpritePath;
      if (quality === "rotten"    && crop.rottenSpritePath)    return crop.rottenSpritePath;
      return crop.spritePath;
    }
    if (type === "barn_item")  return `/przedmioty/item_${key}.png`;
    if (type === "honey")      return `/przedmioty/jar_honey.png`;
    if (type === "equipment")  return CHAR_EQUIP_ITEMS.find(i => i.id === key)?.img ?? null;
    return null;
  }
  function buildSellableItems() {
    const items: { type: MarketItemType; key: string; name: string; icon: string; imgPath: string | null; qty: number; minPrice: number }[] = [];
    Object.entries(seedInventory).forEach(([key, qty]) => {
      if ((qty as number) <= 0) return;
      if (key === "guide_compost") return; // Kompost Przewodnika — niesprzedawalny
      const iType: MarketItemType = isCompostKey(key) ? "compost" : "crop";
      const { name, icon } = marketItemLabel(iType, key);
      items.push({ type: iType, key, name, icon, imgPath: getMarketItemImg(iType, key), qty: qty as number, minPrice: marketMinPrice(iType, key) });
    });
    Object.entries(barnItems).forEach(([key, qty]) => {
      if ((qty as number) <= 0) return;
      const { name, icon } = marketItemLabel("barn_item", key);
      items.push({ type: "barn_item", key, name, icon, imgPath: getMarketItemImg("barn_item", key), qty: qty as number, minPrice: 1 });
    });
    Object.entries(fruitInventory).forEach(([key, qty]) => {
      if ((qty as number) <= 0) return;
      const { name, icon } = marketItemLabel("fruit", key);
      items.push({ type: "fruit", key, name, icon, imgPath: null, qty: qty as number, minPrice: marketMinPrice("fruit", key) });
    });
    const honeyJars = typeof (profile?.hive_data as Record<string,unknown> | null | undefined)?.honey_jars === "number"
      ? (profile!.hive_data as Record<string,unknown>).honey_jars as number : 0;
    if (honeyJars > 0) {
      items.push({ type: "honey", key: "honey_jar", name: "Słoik miodu", icon: "🍯", imgPath: getMarketItemImg("honey", "honey_jar"), qty: honeyJars, minPrice: 1 });
    }
    const equippedIds = new Set(
      (Object.values(charEquipped) as ({ id: string; upg: number } | null)[])
        .filter(Boolean).map(e => e!.id)
    );
    CHAR_EQUIP_ITEMS
      .filter(item => ownedEqItems[item.id] && !equippedIds.has(item.id))
      .forEach(item => {
        items.push({ type: "equipment", key: item.id, name: item.name, icon: item.icon, imgPath: getMarketItemImg("equipment", item.id), qty: 1, minPrice: marketMinPrice("equipment", item.id, getItemUpg(item.id)) });
      });
    return items;
  }
  async function loadMarketData() {
    if (!profile) return;
    setMarketLoading(true);
    try {
      const filterParam = marketBrowseFilter === "all" ? null : marketBrowseFilter;
      const [browseRes, myOffersRes, returnsRes] = await Promise.all([
        supabase.rpc("market_browse", { p_item_type: filterParam }),
        supabase.rpc("market_get_my_offers"),
        supabase.rpc("market_get_returns"),
      ]);
      if (browseRes.data) setMarketBrowse(Array.isArray(browseRes.data) ? browseRes.data as MarketOffer[] : []);
      if (myOffersRes.data) setMyMarketOffers(Array.isArray(myOffersRes.data) ? myOffersRes.data as MarketOffer[] : []);
      if (returnsRes.data) {
        const ret = Array.isArray(returnsRes.data) ? returnsRes.data as MarketReturn[] : [];
        setMarketReturns(ret);
        setPendingReturnCount(ret.length);
      }
    } finally {
      setMarketLoading(false);
    }
  }
  async function handleMarketBrowseFilter(filter: MarketItemType | "all") {
    setMarketBrowseFilter(filter);
    setMarketLoading(true);
    try {
      const { data } = await supabase.rpc("market_browse", { p_item_type: filter === "all" ? null : filter });
      setMarketBrowse(Array.isArray(data) ? data as MarketOffer[] : []);
    } finally {
      setMarketLoading(false);
    }
  }
  function getItemUnlockLevel(type: MarketItemType, key: string): number {
    if (type === "crop") { const { baseCropId } = parseQualityKey(key); return CROPS.find(c => c.id === baseCropId)?.unlockLevel ?? 1; }
    if (type === "equipment") { return CHAR_EQUIP_ITEMS.find(i => i.id === key)?.unlockLevel ?? 1; }
    if (type === "barn_item" || type === "honey") { return ANIMALS.find(a => a.itemId === key || a.id === key)?.unlockLevel ?? 1; }
    if (type === "fruit") { return TREES.find(t => t.fruitId === key)?.unlockLevel ?? 1; }
    return 1;
  }
  async function handleCreateOffer() {
    if (!profile || !coItemKey) return;
    if (isTester) { setMessage({ type: "error", title: "Targ zablokowany", text: "Targ jest zablokowany dla tego konta." }); return; }
    const minP = marketMinPrice(coItemType, coItemKey, coItemType === "equipment" ? getItemUpg(coItemKey) : undefined);
    if (coPrice < minP) { setMessage({ type: "error", title: "Zbyt niska cena", text: `Minimalna cena: ${minP} zł/szt.` }); return; }
    if (coQty <= 0) { setMessage({ type: "error", title: "Błąd", text: "Ilość musi być dodatnia." }); return; }
    setCoLoading(true);
    const { name, icon } = marketItemLabel(coItemType, coItemKey);
    const { data, error } = await supabase.rpc("market_create_offer", {
      p_item_type: coItemType, p_item_key: coItemKey, p_item_name: name, p_item_icon: icon,
      p_quantity: coQty, p_price_per_unit: coPrice, p_duration_hours: coDuration,
      p_unlock_level: getItemUnlockLevel(coItemType, coItemKey),
    });
    setCoLoading(false);
    if (error) { setMessage({ type: "error", title: "Błąd wystawienia", text: error.message }); return; }
    const result = data as { error?: string; success?: boolean };
    if (result?.error) { setMessage({ type: "error", title: "Błąd wystawienia", text: result.error }); return; }
    if (coItemType === "equipment") {
      const next = { ...ownedEqItems } as Record<string, true>;
      delete next[coItemKey];
      saveOwnedEqItems(next);
    }
    setMessage({ type: "success", title: "Oferta wystawiona!", text: `${name} ×${coQty} za ${coPrice} zł/szt.` });
    setCreateOfferOpen(false); setCoItemKey(""); setCoQty(1); setCoPrice(10); setCoPriceStr("10"); setCoDuration(24);
    await Promise.all([loadProfile(), loadMarketData()]);
  }
  async function handleBuyOffer(offerId: string, qty: number) {
    if (!profile) return;
    if (isTester) { setMessage({ type: "error", title: "Targ zablokowany", text: "Targ jest zablokowany dla tego konta." }); return; }
    setBuyingOfferId(offerId);
    const { data, error } = await supabase.rpc("market_buy_offer", { p_offer_id: offerId, p_quantity: qty });
    setBuyingOfferId(null);
    if (error) { setMessage({ type: "error", title: "Błąd zakupu", text: error.message }); return; }
    const result = data as { error?: string; success?: boolean; item_name?: string; item_type?: string; item_key?: string; quantity?: number; paid?: number };
    if (result?.error) { setMessage({ type: "error", title: "Błąd zakupu", text: result.error }); return; }
    setBuyQtyMap(prev => { const n = { ...prev }; delete n[offerId]; return n; });
    if (result?.item_type === "equipment" && result.item_key) {
      saveOwnedEqItems({ ...ownedEqItems, [result.item_key]: true });
    }
    setMessage({ type: "success", title: "Zakup udany!", text: `Kupiono: ${result.item_name} ×${result.quantity} za ${result.paid?.toLocaleString("pl-PL")} zł.` });
    await Promise.all([loadProfile(), loadMarketData()]);
  }
  async function handleCancelOffer(offerId: string) {
    if (!profile) return;
    setCancellingOfferId(offerId);
    const { data, error } = await supabase.rpc("market_cancel_offer", { p_offer_id: offerId });
    setCancellingOfferId(null);
    if (error) { setMessage({ type: "error", title: "Błąd anulowania", text: error.message }); return; }
    const result = data as { error?: string; success?: boolean };
    if (result?.error) { setMessage({ type: "error", title: "Błąd anulowania", text: result.error }); return; }
    setMessage({ type: "success", title: "Oferta anulowana", text: "Przedmiot trafi do zakładki Do Odbioru." });
    await loadMarketData();
  }
  async function handleClaimAllReturns() {
    if (!profile) return;
    setClaimingReturns(true);
    const { data, error } = await supabase.rpc("market_claim_all_returns");
    setClaimingReturns(false);
    if (error) { setMessage({ type: "error", title: "Błąd odbioru", text: error.message }); return; }
    const result = data as { error?: string; success?: boolean; gold_claimed?: number; items_claimed?: number; equipment_keys?: string[] };
    if (result?.error) { setMessage({ type: "error", title: "Błąd odbioru", text: result.error }); return; }
    if (result?.equipment_keys && result.equipment_keys.length > 0) {
      const next = { ...ownedEqItems };
      result.equipment_keys.forEach(k => { next[k] = true; });
      saveOwnedEqItems(next);
    }
    let claimMsg = "";
    if ((result.gold_claimed ?? 0) > 0) claimMsg += `+${result.gold_claimed?.toLocaleString("pl-PL")} zł. `;
    if ((result.items_claimed ?? 0) > 0) claimMsg += `Odebrano ${result.items_claimed} szt. przedmiotów.`;
    setMessage({ type: "success", title: "Odebrano!", text: claimMsg || "Odebrano wszystko z targu." });
    await Promise.all([loadProfile(), loadMarketData()]);
  }

  async function handleChangeMap(targetMap: string) {
      if (!profile) return;

      // Reset pan przy zmianie mapy (farma/miasto → środek, reszta → 0)
      setPanX((targetMap.startsWith("farm") || targetMap === "city") ? FARM_CENTER_PAN : 0); setPanY(0); setIsPanDragging(false);
      panDragRef.current = { active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false };

      // Reset wszystkich hover-stanów — mapa znika zanim onMouseLeave zdąży zadziałać
      setHoveredBarnLock(false);
      setHoveredHiveLock(false);
      setHoveredSadLock(false);
      setHoveredWateringCan(false);
      setHoveredSickle(false);

      setIsMapLoading(true);

      const { data: rpcData, error } = await supabase.rpc("game_change_map", {
        p_target_map: targetMap,
      });

      if (error) {
        setIsMapLoading(false);
        setMessage({ type: "error", title: "Błąd zmiany mapy", text: error.message });
        return;
      }

      const targetBg = getDisplayBackgroundMap(targetMap);
      await new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = `/${targetBg}.png`;
      });

      await applyProfileState(extractRpcProfile(rpcData));
      setIsMapLoading(false);
      setIsFieldViewOpen(false);
      setSelectedPlotId(null);
      setPlotToBuy(null);
    }

  async function loadRanking() {
    setRankingLoading(true);
    const { data: rows, error } = await supabase.rpc("get_player_ranking");
    if (!error && rows) {
      setRankingData((rows as RankingPlayer[]).map(r => ({
        ...r,
        avatar_skin: (r.avatar_skin !== null && r.avatar_skin !== undefined) ? r.avatar_skin : 0,
      })));
    }
    setRankingLoading(false);
  }

  async function loadMessages() {
    if (!profile) return;
    setMessagesLoading(true);
    setMessagesError("");

    // 1. Skrzynka odbiorcza (wiadomości przysłane do mnie)
    const { data: inboxData, error } = await supabase
      .from("messages")
      .select("*")
      .eq("to_user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);

    // 2. Wiadomości systemowe
    const { data: sysData } = await supabase
      .from("messages")
      .select("*")
      .eq("type", "system")
      .order("created_at", { ascending: false })
      .limit(20);

    // 3. Wysłane przeze mnie — pobieramy kopię leżącą u odbiorcy (type="received", from_user_id=my.id)
    //    To daje nam prawdziwe to_user_id = odbiorca
    const { data: sentRaw } = await supabase
      .from("messages")
      .select("*")
      .eq("from_user_id", profile.id)
      .eq("type", "received")
      .order("created_at", { ascending: false })
      .limit(50);

    // 4. Rozwiąż loginy i avatary odbiorców dla wysłanych
    const recipientIds = Array.from(new Set(
      (sentRaw ?? []).map(m => m.to_user_id).filter(Boolean) as string[]
    ));
    const recipientLoginMap: Record<string, string> = {};
    const recipientAvatarMap: Record<string, number> = {};
    if (recipientIds.length > 0) {
      const { data: rProfiles } = await supabase
        .from("profiles")
        .select("id, username, login, avatar_skin")
        .in("id", recipientIds);
      (rProfiles ?? []).forEach((p: { id: string; username?: string | null; login: string; avatar_skin: number | null }) => {
        recipientLoginMap[p.id] = p.username ?? p.login;
        if (p.avatar_skin !== null && p.avatar_skin !== undefined) recipientAvatarMap[p.id] = p.avatar_skin;
      });
    }

    // 4b. Avatar nadawców dla otrzymanych wiadomości
    const senderIds = Array.from(new Set(
      (inboxData ?? []).map((m: { from_user_id: string | null }) => m.from_user_id).filter(Boolean) as string[]
    ));
    const senderAvatarMap: Record<string, number> = {};
    if (senderIds.length > 0) {
      const { data: sProfiles } = await supabase
        .from("profiles")
        .select("id, avatar_skin")
        .in("id", senderIds);
      (sProfiles ?? []).forEach((p: { id: string; avatar_skin: number | null }) => {
        if (p.avatar_skin !== null && p.avatar_skin !== undefined) senderAvatarMap[p.id] = p.avatar_skin;
      });
    }

    const sentMessages: GameMessage[] = (sentRaw ?? []).map(m => ({
      ...m,
      type: "sent" as const,
      category: "sent" as const,
      // Priorytet: to_username z DB (nowe wiadomości), fallback: lookup z profiles (stare)
      to_username: (m.to_username as string | null) ?? recipientLoginMap[m.to_user_id ?? ""] ?? null,
      from_avatar_skin: avatarSkin >= 0 ? avatarSkin : 0,
      to_avatar_skin: recipientAvatarMap[m.to_user_id ?? ""] ?? 0,
    }));

    if (error) {
      console.error("[loadMessages] błąd:", error.message);
      setMessagesError("Błąd ładowania: " + error.message);
      setMessagesLoading(false);
      return;
    }

    // Skrzynka: tylko received i system (pomijamy stare kopie type="sent" przechowywane u nadawcy)
    // Wiadomości z targu (subject startsWith "Targ") trafiają do kategorii "market"
    const isMarketSubject = (subject: string) =>
      subject?.startsWith("Targ") || subject?.startsWith("🏪") || subject?.startsWith("targ");

    const inboxMessages = ((inboxData ?? []).filter(
      m => m.type === "received" || m.type === "system"
    ) as GameMessage[]).map(m => ({
      ...m,
      category: (m.type === "system"
        ? "system"
        : isMarketSubject(m.subject ?? "")
          ? "market"
          : "received") as GameMessage["category"],
      from_avatar_skin: senderAvatarMap[m.from_user_id ?? ""] ?? 0,
    }));

    const combined: GameMessage[] = [
      ...inboxMessages,
      ...sentMessages.map(m => ({ ...m, category: "sent" as const })),
      ...((sysData ?? []).filter(s => !inboxMessages.some(d => d.id === s.id)) as GameMessage[]).map(s => ({ ...s, category: "system" as const })),
    ];
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setGameMessages(combined);
    setUnreadCount(combined.filter(m => !m.read && m.to_user_id === profile.id && m.category === "received").length);
    setUnreadMarketCount(combined.filter(m => !m.read && m.to_user_id === profile.id && m.category === "market").length);
    setMessagesLoading(false);
  }

  async function searchPlayers(q: string) {
    if (q.trim().length < 2) { setRecipientSuggestions([]); return; }
    const { data, error } = await supabase.rpc("search_message_recipients", {
      p_query: q.trim(),
      p_limit: 8,
    });
    if (error) { setRecipientSuggestions([]); return; }
    setRecipientSuggestions((data as {id:string;username:string;avatar_skin?:number|null}[]) ?? []);
  }

  const MESSAGE_COST = 50;
  const MESSAGE_COOLDOWN_MS = 5 * 60 * 1000;

  async function sendMessage() {
    if (!recipientResolved || !profile) return;
    const subject = composeSubject.trim();
    const body = composeBody.trim();
    if (!subject) { setComposeError("Podaj temat wiadomości."); return; }
    if (!body) { setComposeError("Napisz treść wiadomości."); return; }
    if ((profile.money ?? 0) < MESSAGE_COST) {
      setComposeError(`Za mało pieniędzy. Wysłanie kosztuje ${MESSAGE_COST} 💰.`);
      return;
    }
    const lastSent = messageCooldowns[recipientResolved.id] ?? 0;
    const elapsed = Date.now() - lastSent;
    if (elapsed < MESSAGE_COOLDOWN_MS) {
      const secsLeft = Math.ceil((MESSAGE_COOLDOWN_MS - elapsed) / 1000);
      setComposeError(`Możesz napisać do tego gracza za ${secsLeft}s.`);
      setComposeCountdownSecs(secsLeft);
      return;
    }
    setComposeSending(true);
    setComposeError("");
    // Sprawdź czy odbiorca zablokował nadawcę
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("blocked_users")
      .eq("id", recipientResolved.id)
      .single();
    const blockedByRecipient = ((recipientProfile as {blocked_users?:string[]|null})?.blocked_users ?? []).includes(profile.id);
    if (blockedByRecipient) {
      setComposeSending(false);
      setComposeError("Ta osoba cię zablokowała.");
      setMessageCooldowns(prev => ({ ...prev, [recipientResolved.id]: Date.now() }));
      return;
    }
    const fromUsername = (profile as {username?:string;login?:string}).username ?? profile.login ?? "Nieznany";
    const { error } = await supabase.rpc("send_game_message", {
      p_to_user_id:    recipientResolved.id,
      p_from_user_id:  profile.id,
      p_from_username: fromUsername,
      p_subject:       subject,
      p_body:          body,
      p_to_username:   recipientResolved.username,
    });
    setComposeSending(false);
    if (error) { setComposeError(error.message); return; }
    await loadProfile(profile.id);
    setMessageCooldowns(prev => ({ ...prev, [recipientResolved.id]: Date.now() }));
    setShowCompose(false);
    setComposeRecipient("");
    setComposeSubject("");
    setComposeBody("");
    setRecipientResolved(null);
    setRecipientSuggestions([]);
    void loadMessages();
  }

  function openBlankCompose() {
    setRecipientResolved(null);
    setComposeRecipient("");
    setRecipientSuggestions([]);
    setComposeSubject("");
    setComposeBody("");
    setComposeError("");
    setComposeSending(false);
    setShowCompose(true);
    setShowMessagePanel(true);
  }

  function openComposeTo(userId: string, username: string) {
    setRecipientResolved({ id: userId, username });
    setComposeRecipient(username);
    setRecipientSuggestions([]);
    setComposeSubject("");
    setComposeBody("");
    setComposeError("");
    setShowCompose(true);
    setShowMessagePanel(true);
  }

  async function toggleSaveMessage(msgId: string, currentSaved: boolean) {
    const { error } = await supabase.from("messages").update({ saved: !currentSaved }).eq("id", msgId);
    if (!error) setGameMessages(prev => prev.map(m => m.id === msgId ? { ...m, saved: !currentSaved } : m));
  }

  async function deleteMessage(msgId: string) {
    if (!confirm("Usunąć tę wiadomość?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", msgId);
    if (error) {
      setMessage({ type: "error", title: "Błąd usuwania", text: "Nie udało się usunąć wiadomości." });
      return;
    }
    setGameMessages(prev => prev.filter(m => m.id !== msgId));
    setSelectedMsgIds(prev => { const n = new Set(prev); n.delete(msgId); return n; });
  }

  async function deleteSelectedMessages(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`Usunąć ${ids.length} zaznaczon${ids.length === 1 ? "ą" : ids.length < 5 ? "e" : "ych"} wiadomość${ids.length === 1 ? "" : ids.length < 5 ? "i" : "i"}?`)) return;
    const { error } = await supabase.from("messages").delete().in("id", ids);
    if (error) {
      setMessage({ type: "error", title: "Błąd usuwania", text: "Nie udało się usunąć zaznaczonych wiadomości." });
      return;
    }
    setGameMessages(prev => prev.filter(m => !ids.includes(m.id)));
    setSelectedMsgIds(new Set());
  }

  async function blockUser(fromUserId: string) {
    if (!profile) return;
    const current = (profile.blocked_users ?? []).filter(Boolean);
    if (current.includes(fromUserId)) return;
    const updated = [...current, fromUserId];
    await supabase.from("profiles").update({ blocked_users: updated }).eq("id", profile.id);
    setBlockedUsers(updated);
  }

  async function unblockUser(fromUserId: string) {
    if (!profile) return;
    const updated = (profile.blocked_users ?? []).filter(id => id !== fromUserId);
    await supabase.from("profiles").update({ blocked_users: updated }).eq("id", profile.id);
    setBlockedUsers(updated);
  }

  async function markAsRead(category: "received" | "market" = "received") {
    if (!profile) return;
    const unreadIds = gameMessages
      .filter(m => !m.read && m.to_user_id === profile.id && m.category === category)
      .map(m => m.id);
    if (unreadIds.length === 0) return;
    await supabase.from("messages").update({ read: true }).in("id", unreadIds);
    setGameMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, read: true } : m));
    if (category === "received") setUnreadCount(0);
    else setUnreadMarketCount(0);
  }

  // TYMCZASOWE — do testów mobilnych. Ustaw false przed produkcyjnym releasem.
  const ALLOW_MOBILE_TESTING = true;

  if (!isDesktop && !ALLOW_MOBILE_TESTING) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#1a130d] px-6 text-center text-[#f3e6c8]">
        <div className="max-w-md rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.95)] p-8 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Plonopolis</p>

          <h1 className="mt-4 text-3xl font-black text-[#f9e7b2]">Tylko komputer 🖥️</h1>

          <p className="mt-4 text-sm leading-6 text-[#dfcfab]">
            Gra jest obecnie dostępna tylko na komputerze.
            <br />
            <br />
            Wersja mobilna pojawi się w przyszłości jako aplikacja.
          </p>

          <div className="mt-6 animate-bounce text-4xl">🌾</div>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#1a130d] text-[#f3e6c8]">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-wide">Plonopolis</h1>
          <p className="mt-3 text-sm opacity-80">Ładowanie bramy do gospodarstwa...</p>
        </div>
      </main>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000" }}>
      <style>{`
        @keyframes plono-map-fade-out {
          0%   { opacity: 1; }
          85%  { opacity: 0.08; }
          100% { opacity: 0; }
        }
        @keyframes plono-map-banner {
          0%   { opacity: 0; }
          8%   { opacity: 1; }
          78%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      {/* Ambient backdrop — rozmyte tło farmy/miasta/lobby zasłania czarne paski po bokach */}
      {(isOnFarmMap || isOnCityMap || !profile) && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          backgroundImage: `url(${(isOnFarmMap || isOnCityMap) ? `/mapy/${backgroundMap}.png` : "/mapy/assetsmain-lobby.png"})`,
          backgroundSize: "cover", backgroundPosition: "center",
          filter: "blur(18px) brightness(0.45)",
          transform: "scale(1.12)",
        }} />
      )}
        <main
          className="overflow-hidden"
          style={{ width: BASE_W, height: BASE_H, transform: `scale(${gameScale})`, transformOrigin: "center center", position: "absolute", top: "50%", left: "50%", marginLeft: -BASE_W / 2, marginTop: -BASE_H / 2, zIndex: 1 }}
          onMouseMove={(e) => { const gc = toGameCoords(e.clientX, e.clientY); setMousePos(gc); setMouseScreenPos({ x: e.clientX, y: e.clientY }); }}
        >
        <div
          ref={mapContainerRef}
          className="relative overflow-hidden"
          style={{ width: "100%", height: "100%", cursor: isOnPanMap ? "grab" : undefined, userSelect: "none", WebkitUserSelect: "none", touchAction: isOnPanMap ? "none" : undefined } as React.CSSProperties}
          onDragStart={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            if (showSettingsModal) return;
            if (!isOnPanMap || e.button !== 0) return;
            const tgt = e.target as HTMLElement;
            if (tgt.closest('[data-no-map-drag], button, [role="button"], a, input, textarea, select')) return;
            e.preventDefault();
            panDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY, moved: false };
          }}
          onMouseMove={(e) => {
            if (showSettingsModal) { panDragRef.current.active = false; return; }
            if (!panDragRef.current.active || panDragRef.current.moved) return;
            const dx = e.clientX - panDragRef.current.startX;
            if (Math.abs(dx) > 4) {
              panDragRef.current.moved = true;
              document.body.classList.add("plono-dragging");
              setPanX(Math.max(-FARM_MAX_PAN, Math.min(0, panDragRef.current.startPanX + dx / gameScale)));
              setIsPanDragging(true);
            }
          }}
          onMouseUp={() => {
            document.body.classList.remove("plono-dragging");
            panDragRef.current.active = false;
            setIsPanDragging(false);
            if (panDragRef.current.moved) { setTimeout(() => { panDragRef.current.moved = false; }, 100); }
          }}
          onMouseLeave={() => {
            document.body.classList.remove("plono-dragging");
            panDragRef.current.active = false;
            setIsPanDragging(false);
            panDragRef.current.moved = false;
          }}
          onClickCapture={(e) => {
            if (panDragRef.current.moved) { e.stopPropagation(); panDragRef.current.moved = false; }
          }}
          // TYMCZASOWE — touch support do testów mobilnych
          onTouchStart={(e) => {
            if (showSettingsModal) return;
            if (!isOnPanMap) return;
            const tgt = e.target as HTMLElement;
            // Dla touch blokujemy tylko twarde kontrolki UI — hitboxy budynków (button[data-no-map-drag]) przepuszczamy
            if (tgt.closest('input, textarea, select, a[href]')) return;
            const t = e.touches[0];
            panDragRef.current = { active: true, startX: t.clientX, startY: t.clientY, startPanX: panX, startPanY: panY, moved: false };
          }}
          onTouchMove={(e) => {
            if (showSettingsModal) { panDragRef.current.active = false; return; }
            if (!panDragRef.current.active) return;
            const t = e.touches[0];
            const dx = t.clientX - panDragRef.current.startX;
            // Próg 8px dla touch (większy niż 4px mouse) — tolerancja na drżenie palca
            if (Math.abs(dx) > 8) {
              if (!panDragRef.current.moved) {
                panDragRef.current.moved = true;
                document.body.classList.add("plono-dragging");
                setIsPanDragging(true);
              }
              setPanX(Math.max(-FARM_MAX_PAN, Math.min(0, panDragRef.current.startPanX + dx / gameScale)));
            }
          }}
          onTouchEnd={() => {
            document.body.classList.remove("plono-dragging");
            panDragRef.current.active = false;
            setIsPanDragging(false);
            if (panDragRef.current.moved) { setTimeout(() => { panDragRef.current.moved = false; }, 100); }
          }}
          onTouchCancel={() => {
            document.body.classList.remove("plono-dragging");
            panDragRef.current.active = false;
            setIsPanDragging(false);
            panDragRef.current.moved = false;
          }}
        >
        {/* Tło mapy — przesuwa się wraz z panowaniem */}
        {/* A2: div ma finalne wymiary FARM_RENDERED_W×BASE_H bez scale(); browser robi downscale 4096→3413 bilinear */}
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: isOnPanMap ? `${FARM_RENDERED_W}px` : "100%",
          height: isOnPanMap ? `${BASE_H}px` : "100%",
          transform: isOnPanMap ? `translateX(${panX}px)` : undefined,
        }}>
          {/* A1+A2: brak imageRendering:pixelated — bilinear filtering; wymiary finalne zamiast źródłowych */}
          <img
            src={profile ? `/mapy/${backgroundMap}.png` : "/mapy/assetsmain-lobby.png"}
            alt="Mapa gry"
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
            draggable={false}
            style={isOnPanMap ? {width: FARM_RENDERED_W, height: BASE_H} : {}}
          />
          {/* Crossfade: stara mapa zanika po level-upie — ten sam sizing co główna */}
          {mapCrossfade && mapCrossfade.to === backgroundMap && (
            <img
              key={mapCrossfade.from}
              src={`/mapy/${mapCrossfade.from}.png`}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 select-none"
              draggable={false}
              style={{
                width: FARM_RENDERED_W, height: BASE_H,
                zIndex: 2,
                animation: "plono-map-fade-out 12s ease-in-out forwards",
              }}
            />
          )}
        </div>
        {/* Before/after slider modal — awans rancza */}
        {showFarmSlider && isOnFarmMap && (() => {
          const { from, to } = showFarmSlider;
          return (
            <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/65 backdrop-blur-sm">
              <div className="flex w-full flex-col items-center gap-5 px-4">
                {/* Nagłówek */}
                <div className="text-center">
                  <h2 className="text-4xl font-black text-[#f9e7b2] drop-shadow-lg">Ranczo się rozwija!</h2>
                  <p className="mt-1 text-base text-[#d8ba7a]">Przeciągnij suwak, aby zobaczyć zmiany.</p>
                </div>

                {/* Kontener slidera — responsywny, proporcja 16:9 */}
                <div
                  ref={sliderContainerRef}
                  className="relative overflow-hidden rounded-2xl border-2 border-[#8b6a3e] shadow-2xl select-none"
                  style={{
                    width: "100%",
                    maxWidth: "min(92vw, calc(72vh * 16 / 9))",
                    aspectRatio: "16 / 9",
                    background: "rgba(40,24,12,0.95)",
                    cursor: "ew-resize",
                  }}
                  onPointerMove={e => {
                    if (!sliderDragRef.current || !sliderContainerRef.current) return;
                    const rect = sliderContainerRef.current.getBoundingClientRect();
                    const pct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
                    setSliderX(pct);
                  }}
                  onPointerUp={() => { sliderDragRef.current = false; }}
                  onPointerLeave={() => { sliderDragRef.current = false; }}
                >
                  {/* Nowa mapa — dolna warstwa, pełna */}
                  <img
                    src={`/mapy/${to}.png`}
                    alt="Nowe ranczo"
                    draggable={false}
                    className="pointer-events-none absolute inset-0 w-full h-full"
                    style={{ objectFit: "contain", objectPosition: "center", imageRendering: "pixelated" }}
                  />

                  {/* Stara mapa — clipping przez clip-path */}
                  <div
                    className="absolute inset-0"
                    style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}
                  >
                    <img
                      src={`/mapy/${from}.png`}
                      alt="Stare ranczo"
                      draggable={false}
                      className="pointer-events-none w-full h-full"
                      style={{ objectFit: "contain", objectPosition: "center", imageRendering: "pixelated" }}
                    />
                  </div>

                  {/* Separator z uchwytem */}
                  <div
                    className="absolute top-0 bottom-0 z-20 flex items-center justify-center"
                    style={{ left: `${sliderX}%`, transform: "translateX(-50%)", width: 48, cursor: "ew-resize" }}
                    onPointerDown={e => { sliderDragRef.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                  >
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] shadow-[0_0_12px_rgba(244,207,120,0.8)]" style={{ background: "#f4cf78" }} />
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#f4cf78] bg-[rgba(20,12,5,0.95)] shadow-[0_0_16px_rgba(244,207,120,0.6)] text-[#f4cf78] font-black text-base select-none">
                      ⟺
                    </div>
                  </div>

                  {/* Etykieta Przed */}
                  <span className="pointer-events-none absolute left-4 top-3 z-30 rounded-full border border-[#d4a64f]/60 bg-[rgba(60,30,10,0.90)] px-3 py-1 text-sm font-black uppercase tracking-widest text-[#f4cf78]">
                    Przed
                  </span>
                  {/* Etykieta Po */}
                  <span className="pointer-events-none absolute right-4 top-3 z-30 rounded-full border border-[#7ecb5e]/60 bg-[rgba(20,50,15,0.90)] px-3 py-1 text-sm font-black uppercase tracking-widest text-[#7ecb5e]">
                    Po
                  </span>
                </div>

                {/* Przycisk zamknięcia */}
                <button
                  type="button"
                  onClick={() => setShowFarmSlider(null)}
                  className="rounded-2xl border border-[#f4cf78]/70 bg-[rgba(212,166,79,0.15)] px-12 py-3 text-lg font-black text-[#f9e7b2] shadow-lg transition hover:border-[#f4cf78] hover:bg-[rgba(212,166,79,0.30)]"
                >
                  Super, przejdź dalej
                </button>
              </div>
            </div>
          );
        })()}
        {/* Overlay ładowania — statyczny (nie przesuwa się) */}
        {isMapLoading && (
          <div className="pointer-events-none absolute inset-0 z-[200] flex flex-col items-center justify-center gap-8">
            <div className="w-[1280px] overflow-hidden rounded-full border-2 border-[#8b6a3e]/80 bg-black/70 backdrop-blur-sm shadow-2xl">
              <div className="h-10 rounded-full bg-gradient-to-r from-[#c9952f] via-[#f2ca69] to-[#c9952f] animate-pulse" style={{width:"100%"}} />
            </div>
            <p className="text-6xl font-black text-[#f9e7b2] drop-shadow-lg tracking-wide order-first">Ładowanie mapy...</p>
          </div>
        )}
        {/* Overlay kursora grabbing podczas przeciągania */}
        {isPanDragging && (
          <div
            style={{ position: "absolute", inset: 0, zIndex: 99999, cursor: "grabbing", userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
            onDragStart={(e) => e.preventDefault()}
            onMouseMove={(e) => {
              const dx = e.clientX - panDragRef.current.startX;
              setPanX(Math.max(-FARM_MAX_PAN, Math.min(0, panDragRef.current.startPanX + dx / gameScale)));
            }}
            onMouseUp={() => {
              document.body.classList.remove("plono-dragging");
              panDragRef.current.active = false;
              setIsPanDragging(false);
              if (panDragRef.current.moved) { setTimeout(() => { panDragRef.current.moved = false; }, 100); }
            }}
            onTouchMove={(e) => {
              if (!e.touches[0]) return;
              const dx = e.touches[0].clientX - panDragRef.current.startX;
              setPanX(Math.max(-FARM_MAX_PAN, Math.min(0, panDragRef.current.startPanX + dx / gameScale)));
            }}
            onTouchEnd={() => {
              document.body.classList.remove("plono-dragging");
              panDragRef.current.active = false;
              setIsPanDragging(false);
              if (panDragRef.current.moved) { setTimeout(() => { panDragRef.current.moved = false; }, 100); }
            }}
          />
        )}

        <div className="relative z-[1] h-full w-full">
          {profile && !isFieldViewOpen && (isOnFarmMap || currentMap === "city") && (
            <>
              <div className="fixed right-4 top-4 z-[90] flex flex-col items-stretch gap-1.5">
                {sessionTimeLeft !== null && (() => {
                  const totalSec = Math.ceil(sessionTimeLeft / 1000);
                  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
                  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
                  const ss = String(totalSec % 60).padStart(2, "0");
                  const warn = sessionTimeLeft < 10 * 60 * 1000; // czerwono < 10 min
                  return (
                    <div title="Czas do automatycznego wylogowania" className={`flex items-center justify-center gap-2 rounded-xl border px-3.5 py-1.5 backdrop-blur-sm text-sm font-bold tabular-nums cursor-default ${warn ? "border-red-500/60 bg-red-950/50 text-red-300" : "border-[#8b6a3e]/50 bg-[rgba(20,12,8,0.75)] text-[#d8ba7a]"}`}>
                      <span className={warn ? "animate-pulse" : ""}>⏱</span>
                      <span>{hh}:{mm}:{ss}</span>
                    </div>
                  );
                })()}
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="w-full flex items-center justify-center rounded-2xl border border-[#8b6a3e]/40 bg-[rgba(22,13,8,0.75)] px-4 py-3 text-4xl backdrop-blur-sm transition hover:bg-[rgba(22,13,8,0.95)] hover:border-[#d8ba7a]/40"
                  title="Ustawienia"
                >
                  ⚙️
                </button>
              </div>

              {/* ═══ TESTY GRY BUTTON ═══ */}
              <style>{`
                @keyframes arrowBlink{0%,100%{opacity:0;transform:translateX(-6px)}50%{opacity:1;transform:translateX(0)}}
                @keyframes legendaryPulse{0%,100%{box-shadow:0 0 6px 2px rgba(245,158,11,0.55),0 0 14px 4px rgba(245,158,11,0.2);transform:scale(1)}50%{box-shadow:0 0 18px 7px rgba(245,158,11,0.9),0 0 36px 12px rgba(245,158,11,0.4);transform:scale(1.02)}}
                @keyframes legendaryShimmer{0%{opacity:0;transform:translateX(-120%) rotate(20deg)}60%{opacity:0.55}100%{opacity:0;transform:translateX(120%) rotate(20deg)}}

              `}</style>
              {canUseTestTools && (
              <div className="fixed right-4 bottom-6 z-[92] flex items-center gap-2">
                <span className="text-4xl font-black text-orange-400 select-none" style={{animation:"arrowBlink 1.1s ease-in-out infinite",display:"inline-block"}}>➤</span>
                <button onClick={() => setShowTestModal(true)}
                  className="relative flex items-center gap-2 rounded-2xl border border-orange-500/70 bg-[rgba(38,14,4,0.92)] px-8 py-4 font-black text-orange-300 shadow-2xl backdrop-blur-sm transition hover:border-orange-400 hover:text-orange-200">
                  <span className="animate-pulse text-3xl">🧪</span>
                  <span className="text-lg">Testy</span>
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 rounded-full bg-orange-500 animate-ping" />
                </button>
              </div>
              )}



              <div className={`fixed left-1/2 top-4 z-[89] w-full max-w-[700px] -translate-x-1/2 px-4 transition-opacity duration-300 ${isFieldViewOpen ? "opacity-30" : "opacity-100"}`}>
                <div className="z-10 w-full rounded-[24px] border border-[#8b6a3e] bg-[rgba(33,20,12,0.88)] px-4 py-2 text-[#f5dfb0] shadow-2xl backdrop-blur-sm">
                  <div
                    className={`grid items-center gap-3 ${
                      displayLevel >= MAX_LEVEL ? "justify-center grid-cols-[auto_auto]" : "grid-cols-[1fr_auto_auto]"
                    }`}
                  >
                    <div className="rounded-2xl border border-[#8b6a3e] bg-black/20 px-4 py-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-center">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Poziom:</p>
                          <p className="text-2xl font-black text-white">{displayLevel}</p>
                          {displayLevel >= MAX_LEVEL && (
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-300">
                              MAX LEVEL
                            </p>
                          )}
                        </div>

                        <div className="min-w-[210px] flex-1">
                          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.15em] text-[#d8ba7a]">
                            <span>
                              EXP {displayXp} / {displayXpToNextLevel}
                            </span>
                            <span>{xpPercent.toFixed(2).replace('.', ',')}%</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-black/40">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#d9b15c,#f5de8b)]"
                              style={{ width: `${xpPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#8b6a3e] bg-black/20 px-4 py-2 text-center shrink-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#d8ba7a]">Pieniądze</p>
                      <p className={`font-black text-white tabular-nums whitespace-nowrap ${moneyFontSize}`}>{moneyFormatted}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowMessagePanel(true); void loadMessages(); }}
                      className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#8b6a3e] bg-black/20 transition hover:bg-[rgba(80,50,20,0.4)]"
                      title="Wiadomości"
                    >
                      <img src="/ui/mail.png" alt="Wiadomości" className="h-[128px] w-[128px] object-contain" style={{imageRendering:"pixelated"}} />
                      {(unreadCount + unreadMarketCount) > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg">
                          {(unreadCount + unreadMarketCount) > 9 ? "9+" : (unreadCount + unreadMarketCount)}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}


          {profile && (
            <>
              {/* ═══ WARSTWA FARMY — przesuwa się z mapą (drag-to-pan) ═══ */}
              {isOnFarmMap && (
                <div className="pointer-events-none" style={{
                  position:"absolute", top:0, left:0,
                  width:`${FARM_IMG_W}px`, height:`${FARM_IMG_H}px`,
                  transform:`translateX(${panX}px) scale(${FARM_SCALE})`,
                  transformOrigin:"top left",
                  zIndex:20,
                }}>
                  {isOnFarmMap && (
  <button
    type="button"
    data-no-map-drag="true"
    onClick={() => {
      setHoveredPolaUprawne(false);
      fieldViewOpenedAtRef.current = Date.now();
      setIsFieldViewOpen(true);
      setSelectedPlotId((prev) => prev ?? 1);
      if (tutorialStep === 1) void advanceTutorialStep(2);
    }}
    onMouseEnter={() => setHoveredPolaUprawne(true)}
    onMouseLeave={() => setHoveredPolaUprawne(false)}
    data-zone="polaUprawne"
    data-tutorial-target="pola-uprawne"
    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
    style={{
      left: `${activeHitboxPos.polaUprawne.left}%`,
      top: `${activeHitboxPos.polaUprawne.top}%`,
      width: `${activeHitboxPos.polaUprawne.width}%`,
      height: `${activeHitboxPos.polaUprawne.height}%`,
      zIndex: tutorialStep === 1 ? 6 : 4,
      outline: tutorialStep === 1 ? "4px solid rgba(251,191,36,1)" : undefined,
      borderRadius: tutorialStep === 1 ? "14px" : undefined,
      boxShadow: tutorialStep === 1 ? "0 0 0 6px rgba(251,191,36,0.25), 0 0 45px rgba(251,191,36,0.85), 0 0 90px rgba(251,191,36,0.45)" : undefined,
    }}
    title=""
  />
)}

                  {currentMap.startsWith("farm") && (
                      <>
                        {/* Dom — na drzwiach domu */}
                        <button
                          type="button"
                          data-no-map-drag="true"
                          onClick={() => { setHoveredDom(false); setShowDomModal(true); setDomTab("profil"); }}
                          title=""
                          onMouseEnter={() => setHoveredDom(true)}
                          onMouseLeave={() => setHoveredDom(false)}
                          data-zone="dom"
                          className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                          style={{ left:`${activeHitboxPos.dom.left}%`, top:`${activeHitboxPos.dom.top}%`, width:`${activeHitboxPos.dom.width}%`, height:`${activeHitboxPos.dom.height}%`, zIndex: 20 }}
                        />
                        {/* Stodoła */}
                        {(() => {
                          const _playerLvl = profile?.level ?? 1;
                          const _barnUnlocked = _playerLvl >= BARN_UNLOCK_LVL;
                          return (
                            <button
                              type="button"
                              data-no-map-drag="true"
                              title=""
                              onMouseEnter={() => { if (_barnUnlocked) setHoveredStodola(true); else setHoveredBarnLock(true); }}
                              onMouseLeave={() => { setHoveredBarnLock(false); setHoveredStodola(false); }}
                              data-zone={_barnUnlocked ? "stodola" : "barnLock"}
                              onClick={() => {
                                if (!_barnUnlocked) {
                                  setHoveredBarnLock(false);
                                  setMessage({ type:"error", title:"🔒 Stodoła zablokowana", text:`Stodoła odblokowuje się od ${BARN_UNLOCK_LVL} poziomu (masz ${_playerLvl}).` });
                                  return;
                                }
                                setHoveredBarnLock(false);
                                setShowStodolaModal(true);
                              }}
                              className={`pointer-events-auto absolute transition-all duration-300 ${_barnUnlocked ? "hover:scale-105" : "cursor-not-allowed"}`}
                              style={{ left:`${activeHitboxPos.stodola.left}%`, top:`${activeHitboxPos.stodola.top}%`, width:`${activeHitboxPos.stodola.width}%`, height:`${activeHitboxPos.stodola.height}%`, zIndex: 20 }}
                            />
                          );
                        })()}
                      {/* Do miasta */}
                      {(() => {
                        const _playerLvl = profile?.level ?? 1;
                        const _cityUnlocked = _playerLvl >= CITY_UNLOCK_LVL;
                        return (
                          <button
                            type="button"
                            data-no-map-drag="true"
                            onClick={() => {
                              if (!_cityUnlocked) {
                                setMessage({ type: "error", title: "Miasto zablokowane", text: `Miasto odblokuje się od poziomu ${CITY_UNLOCK_LVL}.` });
                                return;
                              }
                              handleChangeMap("city");
                            }}
                            title=""
                            onMouseEnter={() => { if (_cityUnlocked) setHoveredDoMiasta(true); else setHoveredCityLock(true); }}
                            onMouseLeave={() => { setHoveredDoMiasta(false); setHoveredCityLock(false); }}
                            data-zone="doMiasta"
                            className={`pointer-events-auto absolute transition-all duration-300 ${_cityUnlocked ? "hover:scale-105" : "cursor-not-allowed opacity-70"}`}
                            style={{ left:`${activeHitboxPos.doMiasta.left}%`, top:`${activeHitboxPos.doMiasta.top}%`, width:`${activeHitboxPos.doMiasta.width}%`, height:`${activeHitboxPos.doMiasta.height}%`, zIndex: 20 }}
                          />
                        );
                      })()}
                      {/* Ul */}
                      {(() => {
                        const _playerLvl = profile?.level ?? 1;
                        const _hiveUnlocked = _playerLvl >= HIVE_UNLOCK_LVL;
                        return (
                          <button
                            type="button"
                            data-no-map-drag="true"
                            title=""
                            onMouseEnter={() => { if (_hiveUnlocked) setHoveredUl(true); else setHoveredHiveLock(true); }}
                            onMouseLeave={() => { setHoveredHiveLock(false); setHoveredUl(false); }}
                            data-zone={_hiveUnlocked ? "ul" : "hiveLock"}
                            onClick={() => {
                              if (!_hiveUnlocked) {
                                setHoveredHiveLock(false);
                                setMessage({ type:"error", title:"🔒 Ul zablokowany", text:`Ul odblokowuje się od ${HIVE_UNLOCK_LVL} poziomu (masz ${_playerLvl}).` });
                                return;
                              }
                              setHoveredHiveLock(false);
                              setShowUlModal(true);
                            }}
                            className={`pointer-events-auto absolute transition-all duration-300 ${_hiveUnlocked ? "hover:scale-105" : "cursor-not-allowed"}`}
                            style={{ left:`${activeHitboxPos.ul.left}%`, top:`${activeHitboxPos.ul.top}%`, width:`${activeHitboxPos.ul.width}%`, height:`${activeHitboxPos.ul.height}%`, zIndex: 20 }}
                          />
                        );
                      })()}
                      {/* Lada dla klientów — sprzedaż słoików miodu */}
                      {(() => {
                        const _playerLvl = profile?.level ?? 1;
                        const _ladaUnlocked = _playerLvl >= LADA_UNLOCK_LVL;
                        return (
                          <button
                            type="button"
                            data-no-map-drag="true"
                            title=""
                            onMouseEnter={() => { if (_ladaUnlocked) setHoveredLada(true); else setHoveredLadaLock(true); }}
                            onMouseLeave={() => { setHoveredLada(false); setHoveredLadaLock(false); }}
                            data-zone="lada"
                            onClick={() => {
                              if (!_ladaUnlocked) {
                                setHoveredLada(false);
                                setMessage({ type: "error", title: "Lada zablokowana", text: `Lada dla klientów odblokuje się od poziomu ${LADA_UNLOCK_LVL}.` });
                                return;
                              }
                              setHoveredLada(false);
                              setCurrentCustomerIdx(0);
                              setLadaDetailIdx(null);
                              setShowLadaModal(true);
                            }}
                            className={`pointer-events-auto absolute transition-all duration-300 ${_ladaUnlocked ? "hover:scale-105" : "cursor-not-allowed opacity-70"}`}
                            style={{ left:`${activeHitboxPos.lada.left}%`, top:`${activeHitboxPos.lada.top}%`, width:`${activeHitboxPos.lada.width}%`, height:`${activeHitboxPos.lada.height}%`, zIndex: 20 }}
                          />
                        );
                      })()}
                      {/* Kompostownik */}
                      {(() => {
                        const _playerLvl = profile?.level ?? 1;
                        const _kompostUnlocked = _playerLvl >= KOMPOST_UNLOCK_LVL;
                        return (
                          <button
                            type="button"
                            data-no-map-drag="true"
                            title=""
                            onMouseEnter={() => { if (_kompostUnlocked) setHoveredKompostownik(true); else setHoveredKompostLock(true); }}
                            onMouseLeave={() => { setHoveredKompostownik(false); setHoveredKompostLock(false); }}
                            data-zone="kompostownik"
                            onClick={() => {
                              if (!_kompostUnlocked) {
                                setHoveredKompostownik(false);
                                setMessage({ type: "error", title: "Kompostownik zablokowany", text: `Kompostownik odblokuje się od poziomu ${KOMPOST_UNLOCK_LVL}.` });
                                return;
                              }
                              setHoveredKompostownik(false);
                              setShowKompostModal(true);
                            }}
                            className={`pointer-events-auto absolute transition-all duration-300 ${_kompostUnlocked ? "hover:scale-105" : "cursor-not-allowed opacity-70"}`}
                            style={{ left:`${activeHitboxPos.kompostownik.left}%`, top:`${activeHitboxPos.kompostownik.top}%`, width:`${activeHitboxPos.kompostownik.width}%`, height:`${activeHitboxPos.kompostownik.height}%`, zIndex: 20 }}
                          />
                        );
                      })()}
                      {/* Sad */}
                      {(() => {
                        const _playerLvl = profile?.level ?? 1;
                        const _sadUnlocked = _playerLvl >= SAD_UNLOCK_LVL;
                        return (
                          <button
                            type="button"
                            data-no-map-drag="true"
                            title=""
                            onMouseEnter={() => { if (_sadUnlocked) setHoveredSad(true); else setHoveredSadLock(true); }}
                            onMouseLeave={() => { setHoveredSadLock(false); setHoveredSad(false); }}
                            data-zone={_sadUnlocked ? "sad" : "sadLock"}
                            onClick={() => {
                              if (!_sadUnlocked) {
                                setHoveredSadLock(false);
                                setMessage({ type:"error", title:"🔒 Sad zablokowany", text:`Sad odblokowuje się od ${SAD_UNLOCK_LVL} poziomu (masz ${_playerLvl}).` });
                                return;
                              }
                              setHoveredSadLock(false);
                              setShowSadModal(true);
                            }}
                            className={`pointer-events-auto absolute transition-all duration-300 ${_sadUnlocked ? "hover:scale-105" : "cursor-not-allowed"}`}
                            style={{ left:`${activeHitboxPos.sad.left}%`, top:`${activeHitboxPos.sad.top}%`, width:`${activeHitboxPos.sad.width}%`, height:`${activeHitboxPos.sad.height}%`, zIndex: 20 }}
                          />
                        );
                      })()}
                      {/* Etykiety nawigacyjne — niezależne od hitboxów */}
                      {(["dom","stodola","doMiasta","polaUprawne","ul","lada","kompostownik","sad"] as const).map(id => {
                        const labels: Record<string,string> = {dom:"Dom",stodola:"Stodoła",doMiasta:"Do miasta",polaUprawne:"Pola uprawne",ul:"Ul",lada:"Lada",kompostownik:"Kompostownik",sad:"Sad"};
                        const lp = activeLabelPos[id];
                        return (
                          <div key={`lbl${id}`} className="pointer-events-none absolute select-none"
                            style={{left:`${lp.left}%`, top:`${lp.top}%`, transform:"translateX(-50%)", zIndex:22}}>
                            <span className="rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl whitespace-nowrap">
                              {labels[id]}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* ══ EDYTOR ETYKIET NAWIGACYJNYCH ══ */}
                  {navEditMode && isOnFarmMap && (
                    <div className="absolute inset-0 pointer-events-none" style={{zIndex:56}}>
                      {([
                        {id:"dom",          name:"Dom"},
                        {id:"stodola",      name:"Stodoła"},
                        {id:"doMiasta",     name:"Do miasta"},
                        {id:"polaUprawne",  name:"Pola uprawne"},
                        {id:"ul",           name:"Ul"},
                        {id:"lada",         name:"Lada"},
                        {id:"kompostownik", name:"Kompostownik"},
                        {id:"sad",          name:"Sad"},
                      ] as Array<{id:string,name:string}>).map(nb => {
                        const lp = activeLabelPos[nb.id];
                        return (
                          <div key={`nle${nb.id}`}
                            className="absolute cursor-move pointer-events-auto select-none"
                            style={{
                              left:`${lp.left}%`, top:`${lp.top}%`,
                              transform:"translateX(-50%)",
                              border:"2px dashed #38bdf8",
                              background:"rgba(56,189,248,0.18)",
                              borderRadius:8, padding:"2px 4px",
                              userSelect:"none",
                            }}
                            onMouseDown={e => { e.preventDefault(); navLabelDragRef.current = {id:nb.id,startX:e.clientX,startY:e.clientY,startPos:{...lp}}; }}
                          >
                            <span className="block text-[9px] font-black text-sky-200 whitespace-nowrap leading-none text-center" style={{background:"rgba(0,0,0,0.7)",padding:"1px 3px",borderRadius:4}}>
                              {nb.name}<br/>
                              <span className="text-sky-400">{lp.left.toFixed(1)}% {lp.top.toFixed(1)}%</span>
                            </span>
                          </div>
                        );
                      })}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-sky-500 bg-black/95 p-4 pointer-events-auto shadow-2xl" style={{zIndex:200,minWidth:420}}>
                        <div className="font-black text-sky-300 text-sm mb-3 text-center tracking-wide">🏷 ETYKIETY — pozycje (do podania mi)</div>
                        <table className="w-full text-[11px] text-sky-100 border-collapse">
                          <thead><tr className="text-sky-400 text-[10px]"><th className="text-left pb-1 pr-3">nazwa</th><th className="pb-1 pr-3">left %</th><th className="pb-1">top %</th></tr></thead>
                          <tbody>
                            {Object.entries(activeLabelPos).map(([id,lp]) => (
                              <tr key={id} className="border-t border-sky-900">
                                <td className="pr-3 py-0.5 font-bold text-sky-300">{id}</td>
                                <td className="pr-3 py-0.5 text-center font-mono text-yellow-300">{lp.left.toFixed(1)}</td>
                                <td className="py-0.5 text-center font-mono text-yellow-300">{lp.top.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ══ EDYTOR HITBOXÓW ══ */}
                  {hitboxEditMode && isOnFarmMap && (
                    <div className="absolute inset-0 pointer-events-none" style={{zIndex:57}}>
                      {([
                        {id:"dom",          name:"Dom"},
                        {id:"stodola",      name:"Stodoła"},
                        {id:"doMiasta",     name:"Do miasta"},
                        {id:"polaUprawne",  name:"Pola uprawne"},
                        {id:"ul",           name:"Ul"},
                        {id:"lada",         name:"Lada"},
                        {id:"kompostownik", name:"Kompostownik"},
                        {id:"sad",          name:"Sad"},
                      ] as Array<{id:string,name:string}>).map(nb => {
                        const hp = navHitboxPos[nb.id];
                        return (
                          <div key={`hbe${nb.id}`}
                            className="absolute cursor-move pointer-events-auto select-none"
                            style={{
                              left:`${hp.left}%`, top:`${hp.top}%`,
                              width:`${hp.width}%`, height:`${hp.height}%`,
                              border:"2px dashed #f97316",
                              background:"rgba(249,115,22,0.15)",
                              borderRadius:4,
                              userSelect:"none",
                              boxSizing:"border-box",
                            }}
                            onMouseDown={e => { e.preventDefault(); navHitboxDragRef.current = {type:"move",id:nb.id,startX:e.clientX,startY:e.clientY,startPos:{...hp}}; }}
                          >
                            <span className="block text-[9px] font-black text-orange-200 whitespace-nowrap leading-none" style={{background:"rgba(0,0,0,0.75)",padding:"1px 4px",borderRadius:3,display:"inline-block"}}>
                              {nb.name} · {hp.left.toFixed(1)}% {hp.top.toFixed(1)}% · {hp.width.toFixed(1)}×{hp.height.toFixed(1)}
                            </span>
                            {/* uchwyt rozmiaru */}
                            <div
                              className="absolute bottom-0 right-0 cursor-se-resize pointer-events-auto"
                              style={{width:14,height:14,background:"#f97316",borderRadius:"3px 0 3px 0"}}
                              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); navHitboxDragRef.current = {type:"resize",id:nb.id,startX:e.clientX,startY:e.clientY,startPos:{...hp}}; }}
                            />
                          </div>
                        );
                      })}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-orange-500 bg-black/95 p-4 pointer-events-auto shadow-2xl" style={{zIndex:200,minWidth:500}}>
                        <div className="font-black text-orange-300 text-sm mb-3 text-center tracking-wide">🎯 HITBOXY — pozycje (do podania mi)</div>
                        <table className="w-full text-[11px] text-orange-100 border-collapse">
                          <thead><tr className="text-orange-400 text-[10px]"><th className="text-left pb-1 pr-3">nazwa</th><th className="pb-1 pr-3">left %</th><th className="pb-1 pr-3">top %</th><th className="pb-1 pr-3">width %</th><th className="pb-1">height %</th></tr></thead>
                          <tbody>
                            {Object.entries(navHitboxPos).map(([id,hp]) => (
                              <tr key={id} className="border-t border-orange-900">
                                <td className="pr-3 py-0.5 font-bold text-orange-300">{id}</td>
                                <td className="pr-3 py-0.5 text-center font-mono text-yellow-300">{hp.left.toFixed(1)}</td>
                                <td className="pr-3 py-0.5 text-center font-mono text-yellow-300">{hp.top.toFixed(1)}</td>
                                <td className="pr-3 py-0.5 text-center font-mono text-green-300">{hp.width.toFixed(1)}</td>
                                <td className="py-0.5 text-center font-mono text-green-300">{hp.height.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* ═══ WARSTWA MIASTA — przesuwa się z mapą (drag-to-pan) ═══ */}
              {isOnCityMap && (
                <div
                  className="pointer-events-none"
                  style={{
                    position: "absolute", top: 0, left: 0,
                    width: `${FARM_IMG_W}px`, height: `${FARM_IMG_H}px`,
                    transform: `translateX(${panX}px) scale(${FARM_SCALE})`,
                    transformOrigin: "top left",
                    zIndex: 20,
                  }}
                >
                  {/* ── Hitboxy ── */}
                  <button
                    type="button"
                    onClick={() => handleChangeMap(getMapForLevel(profile?.level))}
                    onMouseEnter={() => setHoveredNaFarme(true)}
                    onMouseLeave={() => setHoveredNaFarme(false)}
                    data-no-map-drag="true"
                    data-zone="naFarme"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.naFarme.left}%`, top:`${cityHitboxPos.naFarme.top}%`, width:`${cityHitboxPos.naFarme.width}%`, height:`${cityHitboxPos.naFarme.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => { setShowShopModal(true); }}
                    onMouseEnter={() => setHoveredSklep(true)}
                    onMouseLeave={() => setHoveredSklep(false)}
                    data-no-map-drag="true"
                    data-zone="sklep"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.sklep.left}%`, top:`${cityHitboxPos.sklep.top}%`, width:`${cityHitboxPos.sklep.width}%`, height:`${cityHitboxPos.sklep.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => { setShowMarketModal(true); setMarketTab("browse"); void loadMarketData(); }}
                    onMouseEnter={() => setHoveredTarg(true)}
                    onMouseLeave={() => setHoveredTarg(false)}
                    data-no-map-drag="true"
                    data-zone="targ"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.targ.left}%`, top:`${cityHitboxPos.targ.top}%`, width:`${cityHitboxPos.targ.width}%`, height:`${cityHitboxPos.targ.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => handleChangeMap("city_bank")}
                    onMouseEnter={() => setHoveredBank(true)}
                    onMouseLeave={() => setHoveredBank(false)}
                    data-no-map-drag="true"
                    data-zone="bank"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.bank.left}%`, top:`${cityHitboxPos.bank.top}%`, width:`${cityHitboxPos.bank.width}%`, height:`${cityHitboxPos.bank.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => { handleChangeMap("city_townhall"); setTownHallCamX(TH_CENTER_CAM_X); }}
                    onMouseEnter={() => setHoveredRatusz(true)}
                    onMouseLeave={() => setHoveredRatusz(false)}
                    data-no-map-drag="true"
                    data-zone="ratusz"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.ratusz.left}%`, top:`${cityHitboxPos.ratusz.top}%`, width:`${cityHitboxPos.ratusz.width}%`, height:`${cityHitboxPos.ratusz.height}%` }}
                    title=""
                  />
                  <button
                    type="button"
                    onClick={() => handleChangeMap("city_liga")}
                    onMouseEnter={() => setHoveredLiga(true)}
                    onMouseLeave={() => setHoveredLiga(false)}
                    data-no-map-drag="true"
                    data-zone="liga"
                    className="pointer-events-auto absolute transition-all duration-300 hover:scale-105"
                    style={{ left:`${cityHitboxPos.liga.left}%`, top:`${cityHitboxPos.liga.top}%`, width:`${cityHitboxPos.liga.width}%`, height:`${cityHitboxPos.liga.height}%` }}
                    title=""
                  />
                  {/* ── Etykiety ── */}
                  {([
                    {id:"naFarme", name:"Na farmę"},
                    {id:"sklep",   name:"Sklep"},
                    {id:"targ",    name:"Targ"},
                    {id:"bank",    name:"Bank"},
                    {id:"ratusz",  name:"Ratusz"},
                    {id:"liga",    name:"Liga Farmerów"},
                  ] as Array<{id:string,name:string}>).map(b => {
                    const lp = cityLabelPos[b.id];
                    return (
                      <span
                        key={b.id}
                        className={`absolute rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-xl font-black text-[#f3e6c8] shadow-2xl -translate-x-1/2 ${cityNavEditMode ? "pointer-events-auto cursor-move outline outline-2 outline-sky-400/80 select-none" : "pointer-events-none"}`}
                        style={{left:`${lp.left}%`,top:`${lp.top}%`}}
                        onMouseDown={cityNavEditMode ? (e => { e.preventDefault(); e.stopPropagation(); cityLabelDragRef.current = {id:b.id,startX:e.clientX,startY:e.clientY,startPos:{...lp}}; }) : undefined}
                      >
                        {b.name}
                        {cityNavEditMode && (
                          <span className="block text-center text-[11px] font-normal text-sky-300 leading-tight mt-1 whitespace-nowrap">
                            {lp.left.toFixed(1)}% {lp.top.toFixed(1)}%
                          </span>
                        )}
                      </span>
                    );
                  })}
                  {/* ══ PANEL KOORDYNATÓW ETYKIET ══ */}
                  {cityNavEditMode && canEditHitboxes && (
                    <div className="absolute inset-0 pointer-events-none" style={{zIndex:56}}>
                      <div className="absolute bottom-2 right-2 rounded-xl border border-sky-600 bg-black/90 p-2 text-[10px] text-sky-200 max-w-[230px] pointer-events-auto" style={{zIndex:60}}>
                        <div className="font-black text-sky-400 mb-1">📋 Pozycje etykiet (miasto):</div>
                        {Object.entries(cityLabelPos).map(([id,lp]) => <div key={id}>{id}: left={lp.left.toFixed(1)}% top={lp.top.toFixed(1)}%</div>)}
                      </div>
                    </div>
                  )}
                  {/* ══ EDYTOR HITBOXÓW MIASTA ══ */}
                  {cityHitboxEditMode && canEditHitboxes && (
                    <div className="absolute inset-0 pointer-events-none" style={{zIndex:57}}>
                      {([
                        {id:"naFarme", name:"Na farmę"},
                        {id:"sklep",   name:"Sklep"},
                        {id:"targ",    name:"Targ"},
                        {id:"bank",    name:"Bank"},
                        {id:"ratusz",  name:"Ratusz"},
                        {id:"liga",    name:"Liga Farmerów"},
                      ] as Array<{id:string,name:string}>).map(b => {
                        const hp = cityHitboxPos[b.id];
                        return (
                          <div key={`che${b.id}`}
                            className="absolute cursor-move pointer-events-auto select-none"
                            style={{ left:`${hp.left}%`, top:`${hp.top}%`, width:`${hp.width}%`, height:`${hp.height}%`, border:"2px dashed #f97316", background:"rgba(249,115,22,0.15)", borderRadius:4, userSelect:"none", boxSizing:"border-box" }}
                            onMouseDown={e => { e.preventDefault(); cityHitboxDragRef.current = {type:"move",id:b.id,startX:e.clientX,startY:e.clientY,startPos:{...hp}}; }}
                          >
                            <span className="block text-[9px] font-black text-orange-200 whitespace-nowrap leading-none" style={{background:"rgba(0,0,0,0.75)",padding:"1px 4px",borderRadius:3,display:"inline-block"}}>
                              {b.name} · {hp.left.toFixed(1)}% {hp.top.toFixed(1)}% · {hp.width.toFixed(1)}×{hp.height.toFixed(1)}
                            </span>
                            <div
                              className="absolute bottom-0 right-0 cursor-se-resize pointer-events-auto"
                              style={{width:14,height:14,background:"#f97316",borderRadius:"3px 0 3px 0"}}
                              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); cityHitboxDragRef.current = {type:"resize",id:b.id,startX:e.clientX,startY:e.clientY,startPos:{...hp}}; }}
                            />
                          </div>
                        );
                      })}
                      <div className="absolute bottom-2 left-2 rounded-xl border border-orange-600 bg-black/90 p-2 text-[10px] text-orange-200 max-w-[270px] pointer-events-auto" style={{zIndex:60}}>
                        <div className="font-black text-orange-400 mb-1">📋 Pozycje hitboxów (miasto):</div>
                        {Object.entries(cityHitboxPos).map(([id,hp]) => (
                          <div key={id}>{id}: {hp.left.toFixed(1)}% {hp.top.toFixed(1)}% {hp.width.toFixed(1)}%×{hp.height.toFixed(1)}%</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* ═══ WARSTWA STATYCZNA — miasto i inne lokacje (bez panu) ═══ */}
              <div className="absolute inset-0 z-20 pointer-events-none">

                  {/* ── DEV: panel edytora farmy ── */}
                  {isOnFarmMap && profile && canEditHitboxes && (
                    <div className="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 flex gap-2 z-[200]" style={{zIndex:200}}>
                      <button
                        type="button"
                        onClick={() => { setNavEditMode(p => !p); setHitboxEditMode(false); }}
                        className={`rounded-lg border px-3 py-1 text-[11px] font-black shadow transition ${navEditMode ? "border-sky-400 bg-sky-900/90 text-sky-200" : "border-sky-700/60 bg-black/80 text-sky-400 hover:bg-sky-950"}`}
                      >
                        {navEditMode ? "✅ Etykiety ON" : "🏷 Edytuj etykiety"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setHitboxEditMode(p => !p); setNavEditMode(false); }}
                        className={`rounded-lg border px-3 py-1 text-[11px] font-black shadow transition ${hitboxEditMode ? "border-orange-400 bg-orange-900/90 text-orange-200" : "border-orange-700/60 bg-black/80 text-orange-400 hover:bg-orange-950"}`}
                      >
                        {hitboxEditMode ? "✅ Hitboxy ON" : "🎯 Edytuj hitboxy"}
                      </button>
                    </div>
                  )}

                  {/* ─── Strzałki nawigacji farmy ─── */}
                  <style>{`@keyframes thArrowPulse { 0%,100%{opacity:0.5;transform:translateY(-50%) scale(1)} 50%{opacity:1;transform:translateY(-50%) scale(1.25)} }`}</style>
                  {isOnFarmMap && (
                    <>
                      {panX < 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPanX(prev => Math.min(0, prev + Math.round(BASE_W * 0.5))); }}
                          className="pointer-events-auto absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                          style={{ left:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                          aria-label="Przewiń w lewo"
                        >‹</button>
                      )}
                      {panX > -FARM_MAX_PAN && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPanX(prev => Math.max(-FARM_MAX_PAN, prev - Math.round(BASE_W * 0.5))); }}
                          className="pointer-events-auto absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                          style={{ right:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite 0.4s", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                          aria-label="Przewiń w prawo"
                        >›</button>
                      )}
                      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                        {Array.from({length: 3}).map((_,i) => {
                          const segW = FARM_MAX_PAN / 2;
                          const active = Math.round(-panX / segW) === i;
                          return <div key={i} className={`h-1.5 rounded-full transition-all ${active ? "w-6 bg-amber-400" : "w-2 bg-white/20"}`} />;
                        })}
                      </div>
                    </>
                  )}

                  {currentMap === "city" && (
                    <>
                      {/* ── DEV: przyciski toggle edytora miasta ── */}
                      {canEditHitboxes && (
                      <div className="pointer-events-auto absolute top-2 left-1/2 -translate-x-1/2 flex gap-2" style={{zIndex:200}}>
                        <button
                          type="button"
                          onClick={() => { setCityNavEditMode(p => !p); setCityHitboxEditMode(false); }}
                          className={`rounded-lg border px-3 py-1 text-[11px] font-black shadow transition ${cityNavEditMode ? "border-sky-400 bg-sky-900/90 text-sky-200" : "border-sky-700/60 bg-black/80 text-sky-400 hover:bg-sky-950"}`}
                        >
                          {cityNavEditMode ? "✅ Etykiety ON" : "🏷 Edytuj etykiety"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCityHitboxEditMode(p => !p); setCityNavEditMode(false); }}
                          className={`rounded-lg border px-3 py-1 text-[11px] font-black shadow transition ${cityHitboxEditMode ? "border-orange-400 bg-orange-900/90 text-orange-200" : "border-orange-700/60 bg-black/80 text-orange-400 hover:bg-orange-950"}`}
                        >
                          {cityHitboxEditMode ? "✅ Hitboxy ON" : "🎯 Edytuj hitboxy"}
                        </button>
                      </div>
                      )}
                      {/* ─── Strzałki nawigacji miasta ─── */}
                      {panX < 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPanX(prev => Math.min(0, prev + Math.round(BASE_W * 0.5))); }}
                          className="pointer-events-auto absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                          style={{ left:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                          aria-label="Przewiń w lewo"
                        >‹</button>
                      )}
                      {panX > -FARM_MAX_PAN && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPanX(prev => Math.max(-FARM_MAX_PAN, prev - Math.round(BASE_W * 0.5))); }}
                          className="pointer-events-auto absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                          style={{ right:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite 0.4s", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                          aria-label="Przewiń w prawo"
                        >›</button>
                      )}
                      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                        {Array.from({length: 3}).map((_,i) => {
                          const segW = FARM_MAX_PAN / 2;
                          const active = Math.round(-panX / segW) === i;
                          return <div key={i} className={`h-1.5 rounded-full transition-all ${active ? "w-6 bg-amber-400" : "w-2 bg-white/20"}`} />;
                        })}
                      </div>
                    </>
                  )}

                  {/* ═══ RATUSZ ═══ */}
                    {currentMap === "city_townhall" && (() => {
                        const imageW = 4096;
                        const imageH = 1536;
                        const townHallScale = Math.min(BASE_H / imageH, 1);
                        const renderedW = Math.round(imageW * townHallScale);
                        const TH_W = imageW;
                        const maxCamX = Math.max(0, renderedW - BASE_W);
                        const triggerHitbox = (action: string) => {
                          if (action === "ranking") { void loadRanking(); setShowRankingPanel(true); }
                          else if (action === "club") setShowGildiaPanel(true);
                          else if (action === "event") setShowMisjePanel(true);
                        };
                        const hbIcon = (action: string) => action === "ranking" ? "🏆" : action === "club" ? "⚔️" : "📜";
                        return (
                        <div
                          ref={thContainerRef}
                          className="pointer-events-auto absolute inset-0 overflow-hidden select-none"
                          style={{ cursor: thHitboxEditMode ? "default" : thDragRef.current ? "grabbing" : "grab" }}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            if (thHitboxEditMode) return;
                            thDragRef.current = { startX: e.clientX / gameScale, startCamX: townHallCamX };
                          }}
                          onMouseMove={(e) => {
                            const rect = thContainerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setThMouseOnPanorama({
                                x: Math.round(((e.clientX - rect.left) / gameScale + townHallCamX) / townHallScale),
                                y: Math.round((e.clientY - rect.top) / gameScale / townHallScale),
                              });
                            }
                            const txtDrag = thTextDragRef.current;
                            if (txtDrag) {
                              const dmx = (e.clientX - txtDrag.startMX) / gameScale / townHallScale;
                              const dmy = (e.clientY - txtDrag.startMY) / gameScale / townHallScale;
                              setRankingTextLayout(prev => {
                                if (txtDrag.prop === "startX")     return { ...prev, startX:     Math.max(0,  Math.round(txtDrag.startVal + dmx)) };
                                if (txtDrag.prop === "nameX")      return { ...prev, nameX:      Math.max(20, Math.round(txtDrag.startVal + dmx)) };
                                if (txtDrag.prop === "scoreRight") return { ...prev, scoreRight: Math.max(0,  Math.round(txtDrag.startVal - dmx)) };
                                if (txtDrag.prop === "startY")     return { ...prev, startY:     Math.max(0,  Math.round(txtDrag.startVal + dmy)) };
                                if (txtDrag.prop === "rowHeight")  return { ...prev, rowHeight:  Math.max(20, Math.round(txtDrag.startVal + dmy)) };
                                return prev;
                              });
                              return;
                            }
                            const hbDrag = thHbDragRef.current;
                            if (hbDrag) {
                              const dx = (e.clientX - hbDrag.startX) / gameScale / townHallScale;
                              const dy = (e.clientY - hbDrag.startY) / gameScale / townHallScale;
                              setTownHallHitboxes(prev => prev.map(hb => {
                                if (hb.id !== hbDrag.hbId) return hb;
                                if (hbDrag.mode === "move")   return { ...hb, x: Math.max(0, Math.round(hbDrag.startHbX + dx)), y: Math.max(0, Math.round(hbDrag.startHbY + dy)) };
                                return { ...hb, width: Math.max(80, Math.round(hbDrag.startW + dx)), height: Math.max(40, Math.round(hbDrag.startH + dy)) };
                              }));
                              return;
                            }
                            if (thDragRef.current) {
                              const dx2 = e.clientX / gameScale - thDragRef.current.startX;
                              setTownHallCamX(Math.max(0, Math.min(maxCamX, thDragRef.current.startCamX - dx2)));
                            }
                          }}
                          onMouseUp={() => { thDragRef.current = null; thHbDragRef.current = null; thTextDragRef.current = null; }}
                          onMouseLeave={() => { thDragRef.current = null; thHbDragRef.current = null; thTextDragRef.current = null; }}
                        >
                          {/* Panorama — przesuwa się z kamerą */}
                          <div
                            className="absolute top-0"
                            style={{ width: TH_W, height: imageH, transform: `translateX(-${townHallCamX}px) scale(${townHallScale})`, transformOrigin: "top left", backgroundImage: "url('/mapy/city_townhall.png')", backgroundSize: `${imageW}px ${imageH}px`, backgroundRepeat: "no-repeat", imageRendering: "pixelated" }}
                          >
                            {townHallHitboxes.map(hb => {
                              if (thHitboxEditMode && !(hb.action === "ranking" && thTextEditMode)) {
                                const dragging = thHbDragRef.current?.hbId === hb.id;
                                return (
                                  <div
                                    key={hb.id}
                                    className="absolute flex items-center justify-center cursor-move"
                                    style={{ left: hb.x, top: hb.y, width: hb.width, height: hb.height, border: `2px solid ${dragging ? "#f97316" : "#fb923c"}`, background: dragging ? "rgba(249,115,22,0.25)" : "rgba(194,65,12,0.18)" }}
                                    onMouseDown={(e) => {
                                      if (e.button !== 0) return;
                                      e.stopPropagation(); e.preventDefault();
                                      thHbDragRef.current = { hbId: hb.id, startX: e.clientX, startY: e.clientY, startHbX: hb.x, startHbY: hb.y, mode: "move", startW: hb.width, startH: hb.height };
                                    }}
                                  >
                                    <span className="text-orange-200 font-bold text-sm pointer-events-none">{hb.label}</span>
                                    <span className="text-[10px] text-orange-300/70 ml-2 pointer-events-none">({hb.x},{hb.y})</span>
                                    <div
                                      className="absolute bottom-0 right-0 w-4 h-4 bg-orange-500 cursor-se-resize"
                                      style={{ borderTopLeftRadius: 3 }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation(); e.preventDefault();
                                        thHbDragRef.current = { hbId: hb.id, startX: e.clientX, startY: e.clientY, startHbX: hb.x, startHbY: hb.y, mode: "resize", startW: hb.width, startH: hb.height };
                                      }}
                                    />
                                  </div>
                                );
                              }

                              const hbStyle: React.CSSProperties = {
                                left: hb.x, top: hb.y, width: hb.width, height: hb.height,
                                border: "1px solid rgba(255,215,120,0.18)",
                                background: "transparent",
                                transition: "all 0.18s ease",
                              };
                              const onHover = (e: React.MouseEvent<HTMLDivElement>, enter: boolean) => {
                                const el = e.currentTarget as HTMLDivElement;
                                el.style.background = enter ? "rgba(255,215,120,0.05)" : "transparent";
                                el.style.boxShadow = enter ? "0 0 18px rgba(255,215,120,0.22)" : "none";
                              };

                              if (hb.action === "ranking") {
                                const miniRanking = [...rankingData]
                                  .sort((a, b) => (b.farm_power ?? 0) - (a.farm_power ?? 0))
                                  .slice(0, 9);
                                const rtl = rankingTextLayout;
                                const shadow = "0 1px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)";
                                type RankEntry = { name:string; score:string; color:string; weight:number };
                                const renderRankingRows = (entries: RankEntry[]) => entries.map((p, i) => (
                                  <div key={`r-${i}`} style={{ position:"absolute", top: rtl.startY + i*rtl.rowHeight, left: rtl.startX, right:0, height: rtl.rowHeight, display:"flex", alignItems:"center", pointerEvents:"none" }}>
                                    <span style={{ width: rtl.nameX - rtl.startX, textAlign:"right", fontSize:rtl.fontSize, color:p.color, fontWeight:900, textShadow:shadow, flexShrink:0 }}>{i+1}.</span>
                                    <span style={{ flex:1, marginLeft:8, fontSize:rtl.fontSize, color:p.color, fontWeight:p.weight, textShadow:shadow, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{p.name}</span>
                                    <span style={{ flexShrink:0, marginRight:rtl.scoreRight, fontSize:Math.round(rtl.fontSize*0.9), color:p.color, fontFamily:"monospace", fontWeight:700, textShadow:shadow }}>{p.score}</span>
                                  </div>
                                ));
                                const PREVIEW = [
                                  { name:"PrzykładowyNick", score:"12 345" }, { name:"FarmerTest",     score:"8 901"  },
                                  { name:"Gracz123",        score:"4 567"  }, { name:"RolnikPro",      score:"2 110"  },
                                  { name:"WioskaX",         score:"1 890"  }, { name:"Farmer99",       score:"1 245"  },
                                  { name:"PolowyKról",      score:"987"    }, { name:"StartingUp",     score:"432"    },
                                  { name:"Nowicjusz",       score:"100"    },
                                ];
                                const rankColor = (i: number) => i===0?"#fbbf24":i===1?"#d1d5db":i===2?"#c97c3a":"rgba(255,235,180,0.85)";
                                const rankWeight = (i: number) => i===0?900:i<3?700:600;
                                const previewEntries: RankEntry[] = PREVIEW.map((p, i) => ({ name:p.name, score:p.score, color:rankColor(i), weight:rankWeight(i) }));
                                const realEntries: RankEntry[] = miniRanking.map((p, i) => ({ name:p.player_name, score:(p.farm_power??0).toLocaleString("pl-PL"), color:rankColor(i), weight:rankWeight(i) }));
                                const startDrag = (prop: "startX"|"startY"|"rowHeight"|"nameX"|"scoreRight", val: number) => ({
                                  onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); thTextDragRef.current = { prop, startMX: e.clientX, startMY: e.clientY, startVal: val }; },
                                  onClick: (e: React.MouseEvent) => e.stopPropagation(),
                                });
                                const lbl = (_txt: string, extra?: React.CSSProperties) => ({
                                  fontSize:10, color:"#ffd76a", fontFamily:"monospace", fontWeight:"bold" as const,
                                  textShadow:"0 2px 4px #000", background:"rgba(0,0,0,0.72)",
                                  border:"1px solid rgba(255,215,106,0.5)", borderRadius:3,
                                  padding:"1px 5px", whiteSpace:"nowrap" as const, pointerEvents:"none" as const,
                                  ...extra,
                                });
                                return (
                                  <div
                                    key={hb.id}
                                    className="absolute overflow-hidden"
                                    style={{ ...hbStyle, cursor: thTextEditMode ? "default" : "pointer" }}
                                    onClick={thTextEditMode ? undefined : () => triggerHitbox(hb.action)}
                                    onMouseEnter={(e) => { if (!thTextEditMode) onHover(e, true); }}
                                    onMouseLeave={(e) => { if (!thTextEditMode) onHover(e, false); }}
                                  >
                                    {/* ── Overlay edycji tekstu ── */}
                                    {thTextEditMode && (
                                      <div className="absolute inset-0" style={{ overflow:"hidden", pointerEvents:"auto", background:"rgba(0,0,0,0.55)", zIndex:999 }}>

                                        {/* ── Poziome linie wierszy ── */}
                                        {Array.from({ length: 9 }).map((_, i) => (
                                          <div key={`rg-${i}`} style={{ position:"absolute", left:0, right:0, top: rtl.startY + i*rtl.rowHeight, height:rtl.rowHeight, borderTop:`${i===0?"2px solid":"1px solid"} rgba(255,215,106,${i===0?0.85:0.4})`, boxSizing:"border-box", pointerEvents:"none" }} />
                                        ))}
                                        <div style={{ position:"absolute", left:0, right:0, top: rtl.startY+9*rtl.rowHeight, height:2, background:"rgba(255,215,106,0.4)", pointerEvents:"none" }} />

                                        {/* ── Podgląd wpisów (preview lub prawdziwe dane) ── */}
                                        {renderRankingRows(thShowPreviewRanking ? previewEntries : realEntries)}

                                        {/* ── Pionowa linia startX (biała) — przeciągalna ── */}
                                        <div style={{ position:"absolute", top:0, bottom:0, left: rtl.startX, width:3, background:"rgba(255,255,255,0.7)", cursor:"ew-resize", zIndex:12 }} {...startDrag("startX", rtl.startX)}>
                                          <span style={{ ...lbl(""), position:"absolute", top:12, left:4 }}>startX={rtl.startX}</span>
                                        </div>

                                        {/* ── Pionowa linia nameX (złota) — przeciągalna ── */}
                                        <div style={{ position:"absolute", top:0, bottom:0, left: rtl.nameX, width:3, background:"rgba(255,215,106,0.9)", cursor:"ew-resize", zIndex:11 }} {...startDrag("nameX", rtl.nameX)}>
                                          <span style={{ ...lbl(""), position:"absolute", top:40, left:4 }}>Nr | Nick<br/>nameX={rtl.nameX}</span>
                                        </div>
                                        {/* Nagłówki Nr / Nick */}
                                        <div style={{ position:"absolute", top:4, left: rtl.startX, width: rtl.nameX - rtl.startX, display:"flex", justifyContent:"center", pointerEvents:"none" }}>
                                          <span style={lbl("")}>Nr</span>
                                        </div>
                                        <div style={{ position:"absolute", top:4, left: rtl.nameX+6, pointerEvents:"none" }}>
                                          <span style={lbl("")}>Nick</span>
                                        </div>

                                        {/* ── Pionowa linia scoreRight (zielona) — przeciągalna ── */}
                                        <div style={{ position:"absolute", top:0, bottom:0, right: rtl.scoreRight, width:3, background:"rgba(100,255,150,0.9)", cursor:"ew-resize", zIndex:11 }} {...startDrag("scoreRight", rtl.scoreRight)}>
                                          <span style={{ ...lbl(""), position:"absolute", top:40, right:4, color:"#86efac", border:"1px solid rgba(100,255,150,0.5)" }}>Moc farmy<br/>right={rtl.scoreRight}</span>
                                        </div>
                                        <div style={{ position:"absolute", top:4, right: rtl.scoreRight+6, pointerEvents:"none" }}>
                                          <span style={{ ...lbl(""), color:"#86efac", border:"1px solid rgba(100,255,150,0.5)" }}>Moc farmy</span>
                                        </div>

                                        {/* ── startY — belka — przeciągalna pionowo ── */}
                                        <div style={{ position:"absolute", left:0, right:0, top: rtl.startY-6, height:12, background:"rgba(255,180,0,0.9)", cursor:"ns-resize", display:"flex", alignItems:"center", justifyContent:"center", zIndex:13 }} {...startDrag("startY", rtl.startY)}>
                                          <span style={{ fontSize:12, color:"#fff", fontFamily:"monospace", fontWeight:"bold", textShadow:"0 1px 3px #000", pointerEvents:"none" }}>⬆⬇ StartY = {rtl.startY}</span>
                                        </div>

                                        {/* ── rowHeight — belka na końcu 1. wiersza — przeciągalna ── */}
                                        <div style={{ position:"absolute", left:0, right:0, top: rtl.startY+rtl.rowHeight-6, height:12, background:"rgba(200,70,10,0.9)", cursor:"ns-resize", display:"flex", alignItems:"center", justifyContent:"center", zIndex:13 }} {...startDrag("rowHeight", rtl.rowHeight)}>
                                          <span style={{ fontSize:12, color:"#fed7aa", fontFamily:"monospace", fontWeight:"bold", textShadow:"0 1px 3px #000", pointerEvents:"none" }}>⬆⬇ RowHeight = {rtl.rowHeight}</span>
                                        </div>

                                        {/* ── Przełącznik preview/prawdziwe dane ── */}
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setThShowPreviewRanking(p => !p); }}
                                          style={{ position:"absolute", bottom:8, right:8, fontSize:11, fontFamily:"monospace", fontWeight:"bold", color: thShowPreviewRanking ? "#ffd76a" : "#86efac", background:"rgba(0,0,0,0.75)", border:`1px solid ${thShowPreviewRanking ? "rgba(255,215,106,0.6)" : "rgba(100,255,150,0.6)"}`, borderRadius:4, padding:"3px 8px", cursor:"pointer", zIndex:14 }}
                                        >
                                          {thShowPreviewRanking ? "👁️ Dane testowe" : "👁️ Prawdziwe dane"}
                                        </button>
                                      </div>
                                    )}
                                    {/* ── Treść rankingu (normalny tryb) ── */}
                                    {!thTextEditMode && (
                                      <div className="absolute inset-0 pointer-events-none" style={{ overflow:"hidden" }}>
                                        {rankingLoading ? (
                                          <span style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", color:"rgba(255,235,160,0.5)", fontSize:rtl.fontSize, textShadow:shadow }}>Ładowanie rankingu...</span>
                                        ) : miniRanking.length === 0 ? (
                                          <span style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", color:"rgba(255,235,160,0.4)", fontSize:rtl.fontSize, textShadow:shadow }}>Brak danych rankingu</span>
                                        ) : renderRankingRows(realEntries)}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={hb.id}
                                  className="absolute cursor-pointer"
                                  style={hbStyle}
                                  onClick={() => triggerHitbox(hb.action)}
                                  onMouseEnter={(e) => onHover(e, true)}
                                  onMouseLeave={(e) => onHover(e, false)}
                                />
                              );
                            })}
                          </div>

                          {/* ─── Przyciski stałe (viewport) ─── */}
                          <button
                            type="button"
                            onClick={() => { handleChangeMap("city"); setThHitboxEditMode(false); }}
                            className="absolute left-4 top-4 rounded-2xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-5 py-3 text-base font-black text-[#f3e6c8] shadow-2xl backdrop-blur-sm transition hover:border-yellow-400/60 z-10"
                          >
                            ← Wróć do miasta
                          </button>

                          {canEditHitboxes && (
                          <button
                            type="button"
                            onClick={() => { setThHitboxEditMode(prev => !prev); setThTextEditMode(false); }}
                            className={`absolute left-4 top-20 rounded-2xl border px-5 py-2.5 text-sm font-black shadow-2xl backdrop-blur-sm transition z-10 ${thHitboxEditMode ? "border-orange-400 bg-[rgba(120,50,10,0.95)] text-orange-200 hover:brightness-110" : "border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] text-[#f3e6c8] hover:border-yellow-400/60"}`}
                          >
                            {thHitboxEditMode ? "✅ Zakończ edycję" : "🛠️ Edytuj hitboxy"}
                          </button>
                          )}

                          {thHitboxEditMode && (
                            <button
                              type="button"
                              onClick={() => setThTextEditMode(prev => !prev)}
                              className={`absolute left-4 rounded-2xl border px-5 py-2.5 text-sm font-black shadow-2xl backdrop-blur-sm transition z-10 ${thTextEditMode ? "border-blue-400 bg-[rgba(10,30,80,0.95)] text-blue-200 hover:brightness-110" : "border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] text-[#f3e6c8] hover:border-blue-400/60"}`}
                              style={{ top: 136 }}
                            >
                              {thTextEditMode ? "✅ Zakończ edycję tekstu" : "✏️ Edytuj tekst rankingu"}
                            </button>
                          )}

                          {/* ─── Panel edycji ─── */}
                          {thHitboxEditMode && (
                            <div className="absolute left-4 z-20 w-72 rounded-2xl border border-orange-500/60 bg-[rgba(20,10,2,0.96)] p-4 text-xs text-orange-100 shadow-2xl backdrop-blur-sm space-y-3" style={{ top: thTextEditMode ? 196 : 168 }}>
                              <div className="font-black text-orange-300 text-sm">🛠️ Tryb edycji hitboxów</div>

                              {/* Pozycja myszy */}
                              <div className="flex gap-2 items-center bg-black/30 rounded-lg px-3 py-1.5">
                                <span className="text-orange-400 font-bold">Mysz:</span>
                                <span className="font-mono">{thMouseOnPanorama.x}, {thMouseOnPanorama.y}</span>
                              </div>

                              {/* Lista hitboxów */}
                              <div className="space-y-2">
                                {townHallHitboxes.map(hb => (
                                  <div key={hb.id} className="bg-black/30 rounded-lg px-3 py-2 space-y-0.5">
                                    <div className="font-black text-orange-200">{hb.label}</div>
                                    <div className="font-mono text-orange-100/80">x={hb.x}  y={hb.y}</div>
                                    <div className="font-mono text-orange-100/80">w={hb.width}  h={hb.height}</div>
                                  </div>
                                ))}
                              </div>

                              {/* Kopiuj hitboxy JSON */}
                              <button
                                type="button"
                                className="w-full rounded-xl border border-orange-500/60 bg-orange-900/40 py-2 font-black text-orange-200 hover:brightness-110 transition"
                                onClick={() => { void navigator.clipboard.writeText("const townHallHitboxes = " + JSON.stringify(townHallHitboxes, null, 2) + ";"); }}
                              >
                                📋 Kopiuj JSON hitboxów
                              </button>

                              {/* ── Sekcja layoutu tekstu ── */}
                              {thTextEditMode && (
                                <div className="border-t border-blue-500/30 pt-3 space-y-2">
                                  <div className="font-black text-blue-300 text-sm">✏️ Layout tekstu rankingu</div>
                                  <div className="text-blue-200/60 text-[10px]">Przeciągnij linie na tablicy lub użyj ±</div>
                                  {(Object.entries(rankingTextLayout) as [keyof typeof rankingTextLayout, number][]).map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between bg-black/30 rounded-lg px-2 py-1">
                                      <span className="text-blue-200 font-mono w-24">{k}</span>
                                      <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => setRankingTextLayout(prev => ({ ...prev, [k]: Math.max(0, prev[k] - 1) }))} className="text-blue-300 w-5 text-center hover:text-white font-bold">−</button>
                                        <span className="font-mono text-blue-100 w-10 text-center">{v}</span>
                                        <button type="button" onClick={() => setRankingTextLayout(prev => ({ ...prev, [k]: prev[k] + 1 }))} className="text-blue-300 w-5 text-center hover:text-white font-bold">+</button>
                                      </div>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    className={`w-full rounded-xl border py-2 font-black hover:brightness-110 transition ${thShowPreviewRanking ? "border-amber-500/60 bg-amber-900/40 text-amber-200" : "border-green-500/60 bg-green-900/40 text-green-200"}`}
                                    onClick={() => setThShowPreviewRanking(p => !p)}
                                  >
                                    {thShowPreviewRanking ? "👁️ Dane testowe (kliknij → prawdziwe)" : "👁️ Prawdziwe dane (kliknij → testowe)"}
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full rounded-xl border border-blue-500/60 bg-blue-900/40 py-2 font-black text-blue-200 hover:brightness-110 transition"
                                    onClick={() => { void navigator.clipboard.writeText("const rankingTextLayout = " + JSON.stringify(rankingTextLayout, null, 2) + ";"); }}
                                  >
                                    📋 Kopiuj layout
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ─── Strzałki nawigacji ─── */}
                          {townHallCamX > 0 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setTownHallCamX(prev => Math.max(0, prev - Math.round(BASE_W * 0.5))); }}
                              className="absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                              style={{ left:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                              aria-label="Przewiń w lewo"
                            >‹</button>
                          )}
                          {townHallCamX < maxCamX && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setTownHallCamX(prev => Math.min(maxCamX, prev + Math.round(BASE_W * 0.5))); }}
                              className="absolute z-30 text-[6rem] text-amber-400 hover:text-amber-200 transition-colors"
                              style={{ right:24, top:"50%", transform:"translateY(-50%)", animation:"thArrowPulse 2s ease-in-out infinite 0.4s", background:"none", border:"none", cursor:"pointer", lineHeight:1, textShadow:"0 0 20px rgba(255,180,0,1), 0 0 45px rgba(200,110,0,0.7)" }}
                              aria-label="Przewiń w prawo"
                            >›</button>
                          )}
                          <style>{`@keyframes thArrowPulse { 0%,100%{opacity:0.5;transform:translateY(-50%) scale(1)} 50%{opacity:1;transform:translateY(-50%) scale(1.25)} }`}</style>

                          {/* Wskaźnik pozycji kamery */}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
                            {Array.from({length: 3}).map((_,i) => {
                              const segW = maxCamX / 2;
                              const active = Math.round(townHallCamX / segW) === i;
                              return <div key={i} className={`h-1.5 rounded-full transition-all ${active ? "w-6 bg-amber-400" : "w-2 bg-white/20"}`} />;
                            })}
                          </div>
                        </div>
                        );
                      })()}

                  {/* ═══ LIGA FARMERÓW ═══ */}
                  {currentMap === "city_liga" && (() => {
                    const myFP = computeFarmPower(playerStats, charEquipped, hiveData.level, orchardState, barnState);
                    const sorted = [...rankingData].sort((a,b) => (b.farm_power??0)-(a.farm_power??0));
                    const myRank = sorted.findIndex(p => p.user_id === profile?.id);
                    const total = sorted.length;
                    const myTier = getLigaTier(myRank, total);
                    const TABS = [{id:"ranking",label:"🏆 Ranking"},{id:"wyzwanie",label:"⚔️ Wyzwanie"},{id:"nagrody",label:"🎁 Ligi & Nagrody"}] as const;
                    return (
                      <div className="pointer-events-auto absolute inset-0 overflow-hidden flex flex-col" style={{background:"linear-gradient(180deg,rgba(6,18,6,0.97) 0%,rgba(12,7,2,0.97) 100%)"}}>
                        {/* Header */}
                        <div className="shrink-0 flex items-center justify-between px-10 pt-6 pb-4 border-b border-green-900/40">
                          <div className="flex items-center gap-5">
                            <span className="text-5xl drop-shadow-[0_0_16px_rgba(34,197,94,0.6)]">🌾</span>
                            <div>
                              <p className="text-xs uppercase tracking-[0.35em] text-green-600/70">Miasto · Rywalizacja</p>
                              <h1 className="text-3xl font-black text-[#f9e7b2] leading-tight">Liga Farmerów</h1>
                            </div>
                          </div>
                          {/* Moja liga + moc */}
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs text-[#8b6a3e] uppercase tracking-widest">Moja Moc Farmy</p>
                              <p className="text-2xl font-black text-yellow-300 tabular-nums">⭐ {myFP.toLocaleString("pl-PL")}</p>
                            </div>
                            <div className="flex flex-col items-center justify-center rounded-2xl px-5 py-3 border text-center" style={{background:myTier.bg,borderColor:myTier.border}}>
                              <span className="text-2xl leading-none">{myTier.icon}</span>
                              <p className="mt-1 text-sm font-black whitespace-nowrap" style={{color:myTier.color}}>{myTier.name}</p>
                              {myRank >= 0 && <p className="text-[11px] text-white/50 mt-0.5">#{myRank+1} z {total}</p>}
                            </div>
                            <button type="button" onClick={() => { void handleChangeMap("city"); }}
                              className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-3 text-sm font-black text-[#2f1b0c] shadow-lg hover:brightness-105 transition">
                              ← Miasto
                            </button>
                          </div>
                        </div>
                        {/* Tabs */}
                        <div className="shrink-0 flex gap-1 px-10 py-3 border-b border-green-900/30">
                          {TABS.map(t => (
                            <button key={t.id} type="button" onClick={() => setLigaTab(t.id)}
                              className={`rounded-xl px-5 py-2 text-sm font-bold transition ${ligaTab===t.id ? "bg-green-900/70 text-green-300 border border-green-700/60" : "text-[#8b6a3e] hover:text-[#f3e6c8] hover:bg-white/5"}`}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-10 py-6">
                          {/* ─── TAB: RANKING ─── */}
                          {ligaTab === "ranking" && (
                            <div>
                              {rankingLoading ? (
                                <div className="flex items-center justify-center h-48 text-[#8b6a3e]">
                                  <span className="animate-pulse text-2xl">Ładowanie rankingu…</span>
                                </div>
                              ) : sorted.length === 0 ? (
                                <p className="text-center text-[#8b6a3e] py-16">Brak graczy w rankingu.</p>
                              ) : (
                                <div className="space-y-2">
                                  {sorted.map((p, i) => {
                                    const isMe = p.user_id === profile?.id;
                                    const tier = getLigaTier(i, total);
                                    const fp = p.farm_power ?? 0;
                                    const maxFP = (sorted[0]?.farm_power ?? 1) || 1;
                                    const barW = Math.round((fp / maxFP) * 100);
                                    return (
                                      <div key={p.user_id} className={`flex items-center gap-4 rounded-2xl border px-5 py-3 transition ${isMe ? "border-yellow-500/60 bg-yellow-500/10" : "border-[#8b6a3e]/20 bg-white/3 hover:bg-white/5"}`}>
                                        <span className="w-8 text-center font-black text-[#d8ba7a] text-lg shrink-0">
                                          {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                                        </span>
                                        <img src={ALL_SKINS[isMe?(avatarSkin>=0?avatarSkin:0):((p.avatar_skin??-1)>=0?(p.avatar_skin??0):0)]??ALL_SKINS[0]}
                                          alt={p.player_name} className="h-12 w-12 rounded-full border-2 object-cover shrink-0"
                                          style={{borderColor:tier.border,imageRendering:"pixelated"}} />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className={`font-bold truncate ${isMe?"text-yellow-200":"text-[#f3e6c8]"}`}>{p.player_name}</span>
                                            <span className="text-xs shrink-0" style={{color:tier.color}}>{tier.icon} {tier.name}</span>
                                          </div>
                                          <div className="mt-1 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{width:`${barW}%`,background:`linear-gradient(90deg,${tier.color}80,${tier.color})`}} />
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <p className={`font-black tabular-nums text-lg ${isMe?"text-yellow-300":"text-[#f2ca69]"}`}>⭐ {fp.toLocaleString("pl-PL")}</p>
                                          <p className="text-xs text-[#8b6a3e]">Poz. {i+1}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {/* ─── TAB: WYZWANIE ─── */}
                          {ligaTab === "wyzwanie" && (
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-green-600/60 mb-4">Wybierz przeciwnika i porównaj rancza</p>
                              {rankingLoading ? (
                                <div className="flex items-center justify-center h-48 text-[#8b6a3e]"><span className="animate-pulse text-2xl">Ładowanie…</span></div>
                              ) : (
                                <div className="space-y-3">
                                  {sorted.filter(p => p.user_id !== profile?.id).map((opp, i) => {
                                    const oppFP = opp.farm_power ?? 0;
                                    const winChance = oppFP === 0 ? 99 : Math.min(99, Math.max(1, Math.round(myFP / (myFP + oppFP) * 100)));
                                    const chanceColor = winChance >= 60 ? "#4ade80" : winChance >= 40 ? "#f2ca69" : "#f87171";
                                    const tier = getLigaTier(sorted.findIndex(s=>s.user_id===opp.user_id), total);
                                    return (
                                      <div key={opp.user_id} className="flex items-center gap-4 rounded-2xl border border-[#8b6a3e]/20 bg-white/3 px-5 py-4 hover:bg-white/5 transition">
                                        <span className="w-6 text-center text-sm text-[#8b6a3e] shrink-0">{i+1}</span>
                                        <img src={ALL_SKINS[((opp.avatar_skin??-1)>=0?(opp.avatar_skin??0):0)]??ALL_SKINS[0]}
                                          alt={opp.player_name} className="h-12 w-12 rounded-full border-2 object-cover shrink-0"
                                          style={{borderColor:tier.border,imageRendering:"pixelated"}} />
                                        <div className="flex-1 min-w-0">
                                          <p className="font-bold text-[#f3e6c8] truncate">{opp.player_name}</p>
                                          <p className="text-xs mt-0.5" style={{color:tier.color}}>{tier.icon} {tier.name} · ⭐ {(opp.farm_power??0).toLocaleString("pl-PL")} Mocy</p>
                                        </div>
                                        <div className="text-right shrink-0 mr-3">
                                          <p className="text-xs text-[#8b6a3e]">Szansa zwycięstwa</p>
                                          <p className="text-2xl font-black tabular-nums" style={{color:chanceColor}}>{winChance}%</p>
                                        </div>
                                        <button type="button"
                                          onClick={() => setMessage({type:"info",title:"Liga Farmerów",text:`Wyzwania sezonowe pojawią się w następnym sezonie. Twoja Moc Farmy to ${myFP.toLocaleString("pl-PL")} vs ${(opp.farm_power??0).toLocaleString("pl-PL")} ${opp.player_name}.`})}
                                          className="shrink-0 rounded-xl border border-green-700/60 bg-green-900/40 px-4 py-2 text-sm font-bold text-green-300 hover:bg-green-800/60 transition whitespace-nowrap">
                                          Rzuć wyzwanie
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {/* ─── TAB: NAGRODY ─── */}
                          {ligaTab === "nagrody" && (
                            <div className="space-y-5">
                              <p className="text-xs uppercase tracking-[0.3em] text-green-600/60 mb-2">Nagrody sezonowe przyznawane na koniec sezonu</p>
                              {([
                                {tier:"Liga Drewna",icon:"🌿",color:"#9ca3af",border:"#374151",bg:"rgba(20,20,20,0.7)",desc:"Idealna dla nowych farmerów.",rewards:["Mała ilość XP","Garść złota","Podstawowy ulepszacz upraw"],goal:"Zdobądź pierwsze doświadczenie w rywalizacji."},
                                {tier:"Liga Brązowa",icon:"🥉",color:"#c9952f",border:"#c9952f",bg:"rgba(40,22,5,0.8)",desc:"Dla aktywnych farmerów.",rewards:["Dobra ilość XP","Lepsze złoto","Boostery prędkości upraw","Rzadkie nasiona"],goal:"Regularnie zbieraj plony i obsługuj klientów."},
                                {tier:"Liga Srebrna",icon:"🥈",color:"#94a3b8",border:"#94a3b8",bg:"rgba(25,30,40,0.8)",desc:"Dla doświadczonych farmerów.",rewards:["Duża ilość XP","Boostery do klientów","Rzadkie i epiczne nasiona","Unikalny tytuł sezonu"],goal:"Rozwijaj farmę i wspinaj się w rankingu."},
                                {tier:"Liga Złota",icon:"🥇",color:"#f2ca69",border:"#f2ca69",bg:"rgba(45,30,0,0.85)",desc:"Dla najlepszych farmerów.",rewards:["Ogromna ilość XP","Legendarne uprawy","Bardzo rzadkie ulepszacze","Specjalny avatar sezonowy","Tytuł przy nicku: np. Mistrz Zbiorów"],goal:"Bądź w top 10% graczy serwera."},
                                {tier:"Liga Mistrzów",icon:"🏆",color:"#f97316",border:"#f97316",bg:"rgba(50,20,5,0.9)",desc:"Tylko dla absolutnej elity.",rewards:["Legendarny avatar z animowaną ramką","Unikalny kolor jednej litery nicku (token: 🎨 Farba Farmera)","Tytuł: Legenda Plonopolis / Cesarz Plonów","Nagroda do targu: token sprzedawalny innym graczom"],goal:"Zajmij pierwsze miejsca w globalnym rankingu."},
                              ] as Array<{tier:string;icon:string;color:string;border:string;bg:string;desc:string;rewards:string[];goal:string}>).map(lt => (
                                <div key={lt.tier} className="rounded-[20px] border p-6" style={{background:lt.bg,borderColor:lt.border}}>
                                  <div className="flex items-center gap-3 mb-3">
                                    <span className="text-3xl">{lt.icon}</span>
                                    <div>
                                      <h3 className="text-xl font-black" style={{color:lt.color}}>{lt.tier}</h3>
                                      <p className="text-sm text-[#8b6a3e]">{lt.desc}</p>
                                    </div>
                                  </div>
                                  <ul className="space-y-1 mb-3">
                                    {lt.rewards.map(r => (
                                      <li key={r} className="flex items-center gap-2 text-sm text-[#dfcfab]">
                                        <span style={{color:lt.color}}>✦</span> {r}
                                      </li>
                                    ))}
                                  </ul>
                                  <p className="text-xs text-[#8b6a3e] italic">Cel: {lt.goal}</p>
                                </div>
                              ))}
                              <div className="rounded-2xl border border-green-900/40 bg-green-950/30 p-5 text-sm text-green-300/70 text-center">
                                System sezonowy pojawi się w jednym z kolejnych aktualizacji Plonopolis. Buduj Moc Farmy już teraz!
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                                          {/* ═══ INNE LOKACJE MIEJSKIE ═══ */}
                    {currentMap !== "city" && currentMap !== "city_townhall" && currentMap !== "city_liga" && currentMap.startsWith("city_") && (
                      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center px-4">
                        <div className="w-full max-w-2xl rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.9)] p-8 text-center text-[#f3e6c8] shadow-2xl backdrop-blur-sm">
                          <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Miasto</p>
                          <h2 className="mt-3 text-4xl font-black text-[#f9e7b2]">{getMapDisplayName(currentMap)}</h2>
                          <p className="mt-4 text-base leading-7 text-[#dfcfab]">
                            Ta lokacja jest już podpięta do świata gry, ale jej zawartość dodamy w kolejnym etapie.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleChangeMap("city")}
                            className="mt-6 rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-3 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                          >
                            Wróć do miasta
                          </button>
                        </div>
                      </div>
                    )}
              </div>
            </>
          )}
          <div className="relative" style={{ width: BASE_W, height: BASE_H }}>
            {!profile ? (
              <>
                <div style={{ position: "absolute", left: loginPanelPos.left, top: loginPanelPos.top, width: loginPanelPos.width }}>
                <section className="overflow-hidden rounded-[28px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.88)] shadow-2xl backdrop-blur-sm">
                  <div className="border-b border-[#8b6a3e] bg-[linear-gradient(180deg,rgba(110,73,35,0.95),rgba(76,48,23,0.95))] px-5 py-4 text-[#f9e7b2]">
                    <p className="text-base uppercase tracking-[0.35em] opacity-80">Przeglądarkowa gra farmerska</p>
                    <p className="mt-2 text-lg text-[#f2ddb0]">
                      Zaloguj się do swojego gospodarstwa albo utwórz nowe konto.
                    </p>
                  </div>

                  <div className="p-4 md:p-5">
                    <div className="mb-3 grid grid-cols-2 rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-1">
                      <button
                        onClick={() => setTab("login")}
                        className={`rounded-xl px-4 py-2 text-lg font-bold transition ${
                          tab === "login" ? "bg-[#d4a64f] text-[#2b180c]" : "text-[#f1dfb5] hover:bg-white/5"
                        }`}
                      >
                        Logowanie
                      </button>
                      <button
                        onClick={() => setTab("register")}
                        className={`rounded-xl px-4 py-2 text-lg font-bold transition ${
                          tab === "register" ? "bg-[#d4a64f] text-[#2b180c]" : "text-[#f1dfb5] hover:bg-white/5"
                        }`}
                      >
                        Rejestracja
                      </button>
                    </div>

                    {/* Wybór serwera */}
                    <div className="mb-3">
                      <p className="mb-1.5 text-base font-semibold uppercase tracking-[0.25em] text-[#d8ba7a]">Wybierz serwer</p>
                      <div ref={serverDropdownRef} className="relative">
                        {/* Trigger */}
                        <button
                          type="button"
                          onClick={() => setServerDropdownOpen(o => !o)}
                          className="flex w-full items-center justify-between rounded-xl border border-[#f4cf78] bg-[rgba(212,166,79,0.15)] px-4 py-2.5 text-left text-base font-bold text-[#f9e7b2] transition hover:bg-[rgba(212,166,79,0.25)] shadow-[0_0_8px_rgba(244,207,120,0.25)]"
                        >
                          <span className="flex items-center gap-2">
                            <span>{selectedServer === "testy" ? "Testy" : selectedServer}</span>
                            <span className="rounded-full bg-[#2d4a1e]/80 px-1.5 py-0.5 text-xs font-black uppercase tracking-wider text-[#7ecb5e]">● Aktywny</span>
                          </span>
                          <span className="text-[#d8ba7a] text-lg">{serverDropdownOpen ? "▲" : "▼"}</span>
                        </button>

                        {/* Dropdown overlay */}
                        {serverDropdownOpen && (
                          <div
                            className="absolute left-0 right-0 top-full z-[200] mt-1 rounded-xl border border-[#8b6a3e] bg-[rgba(24,14,7,0.98)] shadow-2xl"
                            style={{ maxHeight: "248px", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#8b6a3e #1a0e07" }}
                          >
                            {([
                              { id: "testy", name: "Testy", active: true },
                              { id: "zielona_dolina", name: "Zielona Dolina", active: false },
                              { id: "sloneczne_pola", name: "Słoneczne Pola", active: false },
                              { id: "zlote_zniwa", name: "Złote Żniwa", active: false },
                              { id: "miodowy_zakatek", name: "Miodowy Zakątek", active: false },
                              { id: "kraina_sadow", name: "Kraina Sadów", active: false },
                            ] as { id: string; name: string; active: boolean }[]).map((srv, i, arr) => (
                              <button
                                key={srv.id}
                                type="button"
                                disabled={!srv.active}
                                onClick={() => { if (srv.active) { setSelectedServer(srv.id); setServerDropdownOpen(false); } }}
                                className={`flex w-full items-center justify-between px-4 py-2.5 text-base font-bold transition
                                  ${i < arr.length - 1 ? "border-b border-[#3a2410]/60" : ""}
                                  ${srv.active
                                    ? "cursor-pointer text-[#f9e7b2] hover:bg-[rgba(212,166,79,0.15)]"
                                    : "cursor-not-allowed text-[#5a3e28] opacity-60"
                                  }`}
                              >
                                <span>{srv.name}</span>
                                {srv.active
                                  ? <span className="rounded-full bg-[#2d4a1e]/80 px-1.5 py-0.5 text-xs font-black uppercase tracking-wider text-[#7ecb5e]">● Aktywny</span>
                                  : <span className="rounded-full bg-[#2a1a0a]/80 px-1.5 py-0.5 text-xs font-black uppercase tracking-wider text-[#7a5535]">Wkrótce</span>
                                }
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {tab === "login" ? (
                      <form onSubmit={handleLogin} className="space-y-3 text-[#f3e6c8]">
                        <div>
                          <label className="mb-1 block text-lg font-semibold">Email</label>
                          <input
                            type="email"
                            placeholder="adres@email.pl"
                            autoComplete="email"
                            value={loginForm.identifier}
                            onChange={(e) => setLoginForm((prev) => ({ ...prev, identifier: e.target.value }))}
                            className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-2 text-base text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-lg font-semibold">Hasło</label>
                          <input
                            type="password"
                            placeholder="Wpisz hasło"
                            autoComplete="current-password"
                            value={loginForm.password}
                            onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                            className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-2 text-base text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-2.5 text-xl font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                        >
                          Zaloguj i wczytaj sesję
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleRegister} className="space-y-3 text-[#f3e6c8]">
                        <div>
                          <label className="mb-1 block text-lg font-semibold">Login</label>
                          <input
                            type="text"
                            placeholder="Unikalny login"
                            autoComplete="username"
                            value={registerForm.login}
                            onChange={(e) => setRegisterForm((prev) => ({ ...prev, login: e.target.value }))}
                            className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-2 text-base text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-lg font-semibold">Email</label>
                          <input
                            type="email"
                            placeholder="twoj@email.pl"
                            autoComplete="email"
                            value={registerForm.email}
                            onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                            className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-2 text-base text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-lg font-semibold">Hasło</label>
                            <input
                              type="password"
                              placeholder="Minimum 6 znaków"
                              autoComplete="new-password"
                              value={registerForm.password}
                              onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                              className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-2 text-base text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-lg font-semibold">Powtórz hasło</label>
                            <input
                              type="password"
                              placeholder="Powtórz hasło"
                              autoComplete="new-password"
                              value={registerForm.confirmPassword}
                              onChange={(e) =>
                                setRegisterForm((prev) => ({
                                  ...prev,
                                  confirmPassword: e.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-[#8b6a3e] bg-[rgba(17,10,6,0.7)] px-4 py-2 text-base text-white outline-none placeholder:text-[#b69d74] focus:border-[#d4a64f]"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-4 py-2.5 text-xl font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                        >
                          Utwórz konto
                        </button>
                      </form>
                    )}
                  </div>
                </section>
                </div>
              </>
            ) : (
              <div className="relative min-h-screen w-full px-4 pt-8 md:px-8">


                {(isOnFarmMap || currentMap === "city_shop" || currentMap === "city_market") && (
                <div className={`fixed left-4 top-4 z-[95] transition-opacity duration-150 ${isFieldViewOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}>
                  <div className="flex flex-col items-start">
                    {/* Avatar gracza — kliknięcie otwiera Dom */}
                    <button
                      type="button"
                      onClick={() => { setShowDomModal(true); setDomTab("profil"); }}
                      onMouseEnter={() => setAvatarTipVisible(true)}
                      onMouseLeave={() => setAvatarTipVisible(false)}
                      onMouseMove={e => setAvatarTipPos(toGameCoords(e.clientX, e.clientY))}
                      className="flex shrink-0 items-center justify-center rounded-2xl border border-[#8b6a3e] bg-[rgba(38,24,14,0.94)] shadow-2xl backdrop-blur-sm transition hover:border-yellow-400/60 hover:bg-[rgba(58,34,18,0.98)] overflow-hidden"
                      aria-label="Otwórz profil"
                    >
                      {avatarSkin >= 0
                        ? <img src={ALL_SKINS[avatarSkin]} alt="Avatar" className="h-[134px] w-[134px] object-cover" style={{imageRendering:"pixelated"}} />
                        : <span className="flex h-[134px] w-[134px] flex-col items-center justify-center gap-0.5 animate-pulse">
                            <span className="text-[#f9e7b2] text-[11px] font-black leading-tight text-center">Wybierz Avatar</span>
                            <span className="text-[#c9952f] text-[10px] font-bold">(kliknij)</span>
                          </span>}
                    </button>
                    <p className="mt-1 w-[134px] truncate text-center text-[16px] font-black text-[#d8ba7a] drop-shadow">{profile?.login ?? ""}</p>
                    {/* Panel plecaka — przeniesiony do Dom → zakładka Plecak */}
                    <div className="hidden">
                      <div
                        className={`max-h-[80vh] w-[440px] overflow-y-auto rounded-[24px] border border-[#8b6a3e] bg-[rgba(38,24,14,0.88)] p-4 text-[#f3e6c8] shadow-2xl backdrop-blur-sm transition-all duration-150 ease-out ${
                          isBackpackOpen ? "pointer-events-auto scale-100" : "pointer-events-none scale-95"
                        }`}
                      >
                        <div
                          className="mb-3 flex items-center justify-between"
                        >
                          <p className="text-xs uppercase tracking-[0.25em] text-[#d8ba7a]">Plecak</p>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSeedId(null);
                              setSelectedTool(null);
                            }}
                            className="rounded-full border border-[#8b6a3e] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#dfcfab] transition hover:bg-[rgba(80,58,28,0.65)]"
                          >
                            Wyczyść wybór
                          </button>
                        </div>

                        {/* Zakładki Uprawy / Przedmioty */}
                          <div className="mt-3 flex gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1">
                            {(["uprawy","owoce","przedmioty"] as const).map(tab => (
                              <button
                                key={tab}
                                type="button"
                                onClick={() => setBackpackTab(tab)}
                                className={`flex-1 rounded-lg py-1.5 text-xs font-bold uppercase tracking-[0.15em] transition ${backpackTab === tab ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "text-[#dfcfab] hover:bg-white/5"}`}
                              >
                                {tab === "uprawy" ? "🌾 Uprawy" : tab === "przedmioty" ? "🎒 Przedmioty" : "🍎 Owoce"}
                              </button>
                            ))}
                          </div>

                          {/* ZAKŁADKA: UPRAWY */}
                          {backpackTab === "uprawy" && (
                            <>
                              <div className="mt-3 flex items-center gap-2">
                                <span className="text-xs text-[#8b6a3e] uppercase tracking-[0.15em] shrink-0">Filtr:</span>
                                <div className="flex flex-1 gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1">
                                  {BACKPACK_FILTER_OPTS.map(opt => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setBackpackSort(opt.id)}
                                      className={`flex-1 rounded-lg py-1 text-[10px] font-bold uppercase tracking-[0.05em] transition ${backpackSort === opt.id ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "hover:bg-white/5"}`}
                                      style={backpackSort === opt.id ? undefined : { color: opt.color }}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-3">
                                {(() => {
                                  const allCrops = (Object.entries(seedInventory).filter(
                                    ([k, amount]) => Number(amount) > 0 && !isCompostKey(k) && !isGuideCompostKey(k)
                                  ) as Array<[string, number]>);
                                  const filtered = backpackSort === "all"
                                    ? allCrops
                                    : allCrops.filter(([k]) => {
                                        const q = parseQualityKey(k).quality ?? "good";
                                        return q === backpackSort;
                                      });
                                  if (allCrops.length === 0) {
                                    return (
                                      <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                                        Plecak jest pusty.
                                      </div>
                                    );
                                  }
                                  if (filtered.length === 0) {
                                    const fLabel = BACKPACK_FILTER_OPTS.find(o => o.id === backpackSort)?.label ?? "";
                                    return (
                                      <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                                        Brak upraw o jakości „{fLabel}". Zmień filtr powyżej.
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="grid grid-cols-4 gap-2">
                                      {(() => {
                                        const sorted = [...filtered].sort(([aId], [bId]) => {
                                          const { baseCropId: _aCrop, quality: _aQ } = parseQualityKey(aId);
                                          const { baseCropId: _bCrop, quality: _bQ } = parseQualityKey(bId);
                                          const aLv = CROPS.find(c => c.id === _aCrop)?.unlockLevel ?? 999;
                                          const bLv = CROPS.find(c => c.id === _bCrop)?.unlockLevel ?? 999;
                                          if (aLv !== bLv) return aLv - bLv;
                                          const _qOrder: Record<string,number> = {rotten:0,good:1,epic:2,legendary:3};
                                          return (_qOrder[_aQ ?? "good"] ?? 1) - (_qOrder[_bQ ?? "good"] ?? 1);
                                        });
                                        return sorted.map(([seedId, amount]) => {
                                        const { baseCropId: _bCropId, quality: _bQuality } = parseQualityKey(seedId);
                                          const crop = CROPS.find((item) => item.id === _bCropId);
                                          if (!crop) return null;
                                          const _qDef2 = _bQuality ? CROP_QUALITY_DEFS[_bQuality] : null;
                                          const _isRotten = _bQuality === "rotten";
                                          const _qualitySprite = _bQuality === "epic" && crop.epicSpritePath ? crop.epicSpritePath
      : _bQuality === "rotten" && crop.rottenSpritePath ? crop.rottenSpritePath
      : _bQuality === "legendary" && crop.legendarySpritePath ? crop.legendarySpritePath
      : crop.spritePath;
                                        return (
                                          <button
                                            key={seedId}
                                            draggable
                                            onDragStart={() => { setDraggedSeedId(seedId); setSelectedSeedId(seedId); setSelectedTool(null); }}
                                            onDragEnd={() => setDraggedSeedId(null)}
                                            type="button"
                                            onClick={() => {
                                              setSelectedSeedId((prev) => (prev === seedId ? null : seedId));
                                              setSelectedTool(null);
                                            }}
                                            onMouseEnter={() => { setHoveredCrop(crop); setHoveredSeedQuality(_bQuality as "rotten"|"good"|"epic"|"legendary"|null); }}
                                            onMouseLeave={() => { setHoveredCrop(null); setHoveredSeedQuality(null); }}
                                            className={`group relative flex h-24 w-24 items-center justify-center rounded-xl border transition ${_isRotten ? "cursor-not-allowed" : ""}`}
                                            style={selectedSeedId === seedId
                                              ? { borderColor: "#f6d860", background: "rgba(60,40,5,0.4)", boxShadow: "0 0 12px rgba(255,220,120,0.22)" }
                                              : _bQuality === "legendary"
                                                ? { borderColor: _qDef2!.borderColor, background: _qDef2!.bgColor, animation: "legendaryPulse 2s ease-in-out infinite" }
                                                : _qDef2
                                                  ? { borderColor: _qDef2.borderColor, background: _qDef2.bgColor }
                                                  : { borderColor: "#8b6a3e", background: "rgba(20,12,8,0.65)" }}
                                          >
                                            <img src={_qualitySprite} alt={crop.name} className="absolute inset-0 h-full w-full object-contain rounded-xl" style={{ imageRendering: "pixelated" }} />
                                            {_bQuality === "legendary" && (
                                              <span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                                <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                              </span>
                                            )}
                                            <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">
                                              {amount}
                                            </span>
                                          </button>
                                        );
                                      });
                                      })()}
                                    </div>
                                  );
                                })()}
                              </div>
                            </>
                          )}

                          {backpackTab === "przedmioty" && (
                            <div className="mt-3">
                              {(() => {
                                const ownedAnimals = ANIMAL_ITEMS.filter(it => (barnItems[it.id] ?? 0) > 0);
                                const hasEmptyJars = hiveData.empty_jars > 0;
                                const hasHoneyJars = hiveData.honey_jars > 0;
                                const hasSuit = hiveData.suit_durability > 0;
                                const compostKeys = Object.keys(seedInventory).filter(k => isCompostKey(k) && (seedInventory[k] ?? 0) > 0);
                                const hasAny = ownedAnimals.length > 0 || hasEmptyJars || hasHoneyJars || hasSuit || compostKeys.length > 0;
                                if (!hasAny) return (
                                  <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                                    Plecak jest pusty.
                                  </div>
                                );
                                return (
                                  <div className="grid grid-cols-4 gap-2">
                                    {ownedAnimals.map(it => {
                                      const animal = ANIMALS.find(a => a.itemId === it.id);
                                      const cnt = barnItems[it.id] ?? 0;
                                      return (
                                        <div key={it.id} className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default"
                                          onMouseEnter={() => setCardTip(<><p className="text-[20px] font-black text-[#f9e7b2]">{it.name}</p>{animal && <><p className="text-[18px] text-amber-300 mt-1">{animal.icon} Z {({'kura':'kury','krolik':'królika','krowa':'krowy','kaczka':'kaczki','owca':'owcy','swinia':'świni','koza':'kozy','indyk':'indyka','kon':'konia','byk':'byka'} as Record<string,string>)[animal.id] ?? animal.name.toLowerCase()}</p><p className="text-[17px] text-[#8b6a3e] mt-0.5">1 zbiór: {animal.prodMs/3600000}h</p></>}</>)}
                                          onMouseLeave={() => setCardTip(null)}>
                                          <div className="relative h-16 w-16 flex items-center justify-center">
                                            
                                            <img src={`/przedmioty/item_${it.id}.png`} alt={it.name} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[180%] w-[180%] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}} />
                                          </div>
                                          
                                          <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{cnt}</span>
                                        </div>
                                      );
                                    })}
                                    {hasEmptyJars && (
                                      <div className="group relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default">
                                        <img src="/przedmioty/jar_empty.png" alt="Słoik" className="h-12 w-12 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                        <p className="mt-1 text-center text-[9px] font-bold text-[#dfcfab] leading-tight px-1">Puste słoiki</p>
                                        <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{hiveData.empty_jars}</span>
                                      </div>
                                    )}
                                    {hasHoneyJars && (
                                      <div className="group relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-amber-600/50 bg-[rgba(30,18,5,0.65)] cursor-default">
                                        <img src="/przedmioty/jar_honey.png" alt="Miód" className="h-12 w-12 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                        <p className="mt-1 text-center text-[9px] font-bold text-amber-300 leading-tight px-1">Miód</p>
                                        <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{hiveData.honey_jars}</span>
                                      </div>
                                    )}
                                    {hasSuit && (
                                      <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default"
                                        onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-[#f9e7b2]">Strój pszczelarza</p><p className="text-[11px] text-amber-300 mt-0.5">{hiveData.suit_durability} zbiorów pozostało</p><p className="text-[10px] text-[#8b6a3e] mt-0.5">Kup nowy w Sklepie → Przedmioty</p></>)}
                                        onMouseLeave={() => setCardTip(null)}>
                                        <img src="/przedmioty/beekeeper_suit.png" alt="Strój" className="h-10 w-10 object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3";}} />
                                        <p className="mt-0.5 text-center text-[9px] font-bold text-[#dfcfab] leading-tight px-1">Strój</p>
                                        <div className="mt-0.5 h-1 w-10 rounded-full bg-black/40 overflow-hidden">
                                          <div className="h-full rounded-full" style={{ width:`${hiveData.suit_durability}%`, background: hiveData.suit_durability > 30 ? "#22c55e" : "#ef4444" }} />
                                        </div>
                                      </div>
                                    )}
                                    {compostKeys
                                      .sort((a,b) => {
                                        const ta = compostTypeFromKey(a) ?? "growth";
                                        const tb = compostTypeFromKey(b) ?? "growth";
                                        const order: Record<CompostType, number> = { growth:0, yield:1, exp:2, guide:3 };
                                        if (order[ta] !== order[tb]) return order[ta] - order[tb];
                                        return compostValueFromKey(a) - compostValueFromKey(b);
                                      })
                                      .map(cid => {
                                        const cnt = seedInventory[cid];
                                        const t = compostTypeFromKey(cid)!;
                                        const def = COMPOST_DEFS[t];
                                        const value = compostValueFromKey(cid);
                                        const tierIdx = def.bonusValues.indexOf(value);
                                        const tierColor = compostTierColor(tierIdx);
                                        const isSel = selectedSeedId === cid;
                                        return (
                                          <div key={cid}
                                            draggable
                                            onDragStart={() => { setDraggedSeedId(cid); setSelectedSeedId(cid); setSelectedTool(null); }}
                                            onDragEnd={() => setDraggedSeedId(null)}
                                            onClick={() => { setSelectedSeedId(prev => prev === cid ? null : cid); setSelectedTool(null); }}
                                            onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-emerald-200">{def.icon} {def.name} <span style={{color: tierColor}}>({def.tierName(value)})</span></p><p className="text-[10px] text-emerald-300/80 mt-0.5">{def.desc}</p><p className="text-[11px] font-black mt-1" style={{color: tierColor}}>Bonus: {def.bonusLabel(value)}</p><p className="text-[10px] text-amber-300 mt-1">↗ Przeciągnij lub kliknij i wybierz puste pole</p></>)}
                                            onMouseLeave={() => setCardTip(null)}
                                            className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border cursor-pointer active:cursor-grabbing transition"
                                            style={isSel
                                              ? { borderColor: tierColor, background: "rgba(60,40,5,0.4)", boxShadow: `0 0 12px ${tierColor}66` }
                                              : { borderColor: "rgba(6,95,70,0.5)", background: "rgba(6,78,59,0.3)" }}>
                                            <span className="text-4xl leading-none">{def.icon}</span>
                                            <p className="mt-0.5 text-center text-[9px] font-bold leading-tight px-1" style={{color: tierColor}}>{def.tierName(value)}</p>
                                            {isSel && <p className="text-[8px] font-black text-amber-300">✓ zaznaczony</p>}
                                            <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">×{cnt}</span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* ZAKŁADKA: OWOCE */}
                          {backpackTab === "owoce" && (() => {
                            const entries = Object.entries(fruitInventory).filter(([,c]) => Number(c) > 0);
                            if (entries.length === 0) {
                              return (
                                <div className="mt-3 rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">
                                  Plecak jest pusty.
                                </div>
                              );
                            }
                            const _qOrd: Record<string, number> = { zgnile: 0, zwykly: 1, soczysty: 2, zloty: 3 };
                            const sorted = [...entries].sort(([aKey], [bKey]) => {
                              const aU = aKey.lastIndexOf("_"); const aFid = aKey.slice(0, aU); const aQ = aKey.slice(aU + 1);
                              const bU = bKey.lastIndexOf("_"); const bFid = bKey.slice(0, bU); const bQ = bKey.slice(bU + 1);
                              const aLv = TREES.find(t => t.fruitId === aFid)?.unlockLevel ?? 999;
                              const bLv = TREES.find(t => t.fruitId === bFid)?.unlockLevel ?? 999;
                              if (aLv !== bLv) return aLv - bLv;
                              return (_qOrd[aQ] ?? 0) - (_qOrd[bQ] ?? 0);
                            });
                            return (
                              <div className="mt-3 grid grid-cols-4 gap-2">
                                {sorted.map(([key, cnt]) => {
                                  const lastU = key.lastIndexOf("_");
                                  const fid = key.slice(0, lastU); const q = key.slice(lastU + 1) as FruitQuality;
                                  const tree = TREES.find(t => t.fruitId === fid);
                                  if (!tree) return null;
                                  const isZgnile = q === "zgnile";
                                  const qLabel = isZgnile ? "Zgniłe" : q === "zwykly" ? "Zwykłe" : q === "soczysty" ? "Soczysty" : "Złote";
                                  const borderColor = isZgnile ? "#ffffff" : q === "zwykly" ? "#ffffff" : q === "soczysty" ? "#22c55e" : "#f59e0b";
                                  const bgColor = isZgnile ? "rgba(255,255,255,0.05)" : q === "zwykly" ? "rgba(255,255,255,0.05)" : q === "soczysty" ? "rgba(20,80,30,0.5)" : "rgba(80,50,5,0.5)";
                                  const labelColor = isZgnile ? "#ffffff" : q === "zwykly" ? "#dfcfab" : q === "soczysty" ? "#22c55e" : "#f59e0b";
                                  return (
                                    <div key={key} className={`relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border ${isZgnile ? "cursor-not-allowed" : "cursor-default"}`}
                                      style={{ borderColor, background: bgColor, ...(q === "zloty" ? { animation: "legendaryPulse 2s ease-in-out infinite" } : {}) }}
                                      onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-[#f9e7b2]">{tree.fruitIcon} {tree.fruitName}</p><p className="text-[11px] mt-0.5" style={{color: labelColor}}>{qLabel}</p><p className="text-[10px] text-[#8b6a3e] mt-0.5">Masz: {Number(cnt)} szt.</p>{isZgnile && <p className="text-[10px] text-amber-400 mt-0.5 font-bold">Nie do sprzedaży — wrzuć do kompostu</p>}</>)}
                                      onMouseLeave={() => setCardTip(null)}>
                                      {isZgnile && <span className="absolute top-1 left-1 text-[10px] leading-none">⚠️</span>}
                                      {q === "zloty" && (
                                        <span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                          <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                        </span>
                                      )}
                                      <div className="relative h-16 w-16 flex items-center justify-center">
                                        <span className="text-4xl leading-none">{tree.fruitIcon}</span>
                                        <img src={`/owoce/owoc_${fid}.png`} alt={tree.fruitName} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[180%] w-[180%] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}} />
                                      </div>
                                      <p className="mt-0.5 text-center text-[9px] font-bold leading-tight px-1" style={{color: labelColor}}>{qLabel}</p>
                                      <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{Number(cnt)}</span>
                                    </div>
                                  );
                                })}
                                <p className="col-span-4 mt-1 text-[10px] text-[#8b6a3e] text-center">Sprzedasz owoce w Sadzie (przycisk „Sprzedaj wszystkie"). Zgniłe idą do kompostu.</p>
                              </div>
                            );
                          })()}

                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ MODAL WYBORU SKINA ═══ */}
          {/* ═══ TEST MODAL ═══ */}
          {/* ═══ MODAL RANKINGU ═══ */}
            {showRankingPanel && (
              <RankingModal
                onClose={() => setShowRankingPanel(false)}
                rankingData={rankingData}
                rankingLoading={rankingLoading}
                rankingSort={rankingSort}
                setRankingSort={setRankingSort}
                rankingSearch={rankingSearch}
                setRankingSearch={setRankingSearch}
                rankingHighlightMe={rankingHighlightMe}
                setRankingHighlightMe={setRankingHighlightMe}
                rankingScrollRef={rankingScrollRef}
                profile={profile}
                avatarSkin={avatarSkin}
                openComposeTo={openComposeTo}
              />
            )}

          {/* ═══ MODAL WIADOMOŚCI ═══ */}
          {showMessagePanel && (
            <MessagesModal
              onClose={() => setShowMessagePanel(false)}
              showCompose={showCompose}
              setShowCompose={setShowCompose}
              loadMessages={loadMessages}
              openBlankCompose={openBlankCompose}
              messageTab={messageTab}
              setMessageTab={setMessageTab}
              selectedMsgIds={selectedMsgIds}
              setSelectedMsgIds={setSelectedMsgIds}
              unreadCount={unreadCount}
              unreadMarketCount={unreadMarketCount}
              composeRecipient={composeRecipient}
              setComposeRecipient={setComposeRecipient}
              setRecipientResolved={setRecipientResolved}
              searchPlayers={searchPlayers}
              recipientSuggestions={recipientSuggestions}
              recipientResolved={recipientResolved}
              composeSubject={composeSubject}
              setComposeSubject={setComposeSubject}
              composeBody={composeBody}
              setComposeBody={setComposeBody}
              composeCountdownSecs={composeCountdownSecs}
              composeError={composeError}
              composeSending={composeSending}
              sendMessage={sendMessage}
              messagesError={messagesError}
              messagesLoading={messagesLoading}
              gameMessages={gameMessages}
              avatarSkin={avatarSkin}
              profile={profile}
              deleteSelectedMessages={deleteSelectedMessages}
              deleteMessage={deleteMessage}
              toggleSaveMessage={toggleSaveMessage}
              blockedUsers={blockedUsers}
              blockUser={blockUser}
              unblockUser={unblockUser}
              openComposeTo={openComposeTo}
            />
          )}

                      {/* ─── Modal startowy przewodnika dla nowego gracza ─── */}
                      {showWelcome && (
                        <>
                          {/* Główne okno przewodnika */}
                          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
                            <div className="relative w-full max-w-[680px] rounded-[28px] border-2 border-[#d8ba7a]/60 bg-[rgba(10,6,2,0.97)] p-8 shadow-2xl text-[#dfcfab]">
                              {/* X — otwiera pierwsze potwierdzenie zamiast zamykać */}
                              <button
                                onClick={() => setGuideExitStep(1)}
                                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#8b6a3e] hover:text-red-300 transition"
                                title="Wyjdź z przewodnika"
                              >✕</button>
                              {/* Nagłówek */}
                              <div className="mb-5 flex flex-col items-center gap-3">
                                <img src="/ui/systemikona.png" alt="Plonopolis" className="h-28 w-28 object-contain" style={{imageRendering:"pixelated"}} />
                                <h2 className="text-center text-[38px] font-black text-[#f9e7b2]">Witaj w Plonopolis!</h2>
                              </div>
                              {/* Treść */}
                              <div className="space-y-4 text-[22px] leading-relaxed text-[#dfcfab]/90">
                                <p>Twoje ranczo dopiero zaczyna działać. Przewodnik pokaże Ci krok po kroku, jak siać, zbierać plony, korzystać z mapy i rozwijać farmę.</p>
                                <p className="text-[20px] text-[#b89a60]">Po ukończeniu przewodnika otrzymasz nagrodę startową: Konto Premium na 7 dni.</p>
                              </div>
                              {/* Stopka */}
                              <div className="mt-8 flex flex-col items-center gap-3">
                                <button
                                  onClick={async () => {
                                    if (!profile?.id) return;
                                    setGuideSaving(true);
                                    setGuideError(null);
                                    const { data: rpcData, error: rpcError } = await supabase
                                      .rpc("game_start_tutorial");
                                    setGuideSaving(false);
                                    if (rpcError || !rpcData?.ok) {
                                      if (rpcData?.error === "already_started") {
                                        // RPC odmówił — ktoś już zaczął/pominął; zamknij modal
                                        setProfile(p => p ? { ...p, tutorial_started: true } : p);
                                        setShowWelcome(false);
                                        return;
                                      }
                                      setGuideError("Błąd zapisu. Spróbuj ponownie.");
                                      return;
                                    }
                                    // Sukces: zaktualizuj lokalny stan profilu i inwentarza
                                    setProfile(p => p ? { ...p, tutorial_started: true, tutorial_completed: false, tutorial_skipped: false } : p);
                                    setTutorialStep(1);
                                    setSeedInventory(prev => ({ ...prev, guide_compost: (prev["guide_compost"] ?? 0) + (rpcData.guide_compost_granted as number ?? 3) }));
                                    setShowWelcome(false);
                                    setMessage({ type: "success", title: "Przewodnik", text: "Przewodnik zostanie uruchomiony wkrótce. Otrzymałeś 3× Kompost Przewodnika!" });
                                  }}
                                  className="w-full rounded-2xl border-2 border-[#d8ba7a]/70 bg-[rgba(80,55,10,0.6)] px-6 py-3 text-[24px] font-black text-[#f9e7b2] transition hover:bg-[rgba(120,85,15,0.7)] hover:border-[#d8ba7a]"
                                >
                                  Rozpocznij przewodnik
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Pierwsze potwierdzenie wyjścia */}
                          {guideExitStep >= 1 && (
                            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
                              <div className="w-full max-w-[520px] rounded-[24px] border-2 border-red-900/60 bg-[rgba(14,4,4,0.98)] p-7 shadow-2xl text-[#dfcfab]">
                                <h3 className="mb-3 text-[26px] font-black text-red-300">Opuścić przewodnik?</h3>
                                <p className="mb-2 text-[20px] leading-relaxed">Próbujesz opuścić przewodnik. Jeśli teraz zrezygnujesz, nie otrzymasz nagrody za ukończenie przewodnika: Konto Premium na 7 dni.</p>
                                <p className="mb-6 text-[20px] text-[#dfcfab]/60">Czy na pewno chcesz wyjść?</p>
                                <div className="flex flex-col gap-3">
                                  <button
                                    onClick={() => setGuideExitStep(0)}
                                    className="w-full rounded-xl border border-[#d8ba7a]/50 bg-[rgba(40,30,5,0.6)] px-5 py-3 text-[20px] font-black text-[#f9e7b2] transition hover:bg-[rgba(80,60,10,0.6)]"
                                  >
                                    Wróć do przewodnika (Esc)
                                  </button>
                                  <button
                                    onClick={() => setGuideExitStep(2)}
                                    className="w-full rounded-xl border border-red-800/50 bg-[rgba(60,10,10,0.5)] px-5 py-3 text-[20px] font-black text-red-300 transition hover:bg-[rgba(90,15,15,0.6)]"
                                  >
                                    Opuść przewodnik (Enter)
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Drugie potwierdzenie — ostateczne */}
                          {guideExitStep >= 2 && (
                            <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 p-4">
                              <div className="w-full max-w-[520px] rounded-[24px] border-2 border-red-700/70 bg-[rgba(20,4,4,0.99)] p-7 shadow-2xl text-[#dfcfab]">
                                <h3 className="mb-3 text-[26px] font-black text-red-400">Na pewno zrezygnować?</h3>
                                <p className="mb-2 text-[20px] leading-relaxed">Rezygnujesz z Przewodnika i konta Premium na 7 dni.</p>
                                <p className="mb-6 text-[20px] text-red-400/80">Tej decyzji nie będzie można cofnąć.</p>
                                {guideError && (
                                  <p className="mb-3 rounded-lg border border-red-700/50 bg-[rgba(80,10,10,0.5)] px-4 py-2 text-[18px] text-red-300">{guideError}</p>
                                )}
                                <div className="flex flex-col gap-3">
                                  <button
                                    onClick={() => { setGuideExitStep(1); setGuideError(null); }}
                                    disabled={guideSaving}
                                    className="w-full rounded-xl border border-[#d8ba7a]/50 bg-[rgba(40,30,5,0.6)] px-5 py-3 text-[20px] font-black text-[#f9e7b2] transition hover:bg-[rgba(80,60,10,0.6)] disabled:opacity-50"
                                  >
                                    Nie, wróć
                                  </button>
                                  <button
                                    disabled={guideSaving}
                                    onClick={async () => {
                                      if (!profile?.id) return;
                                      setGuideSaving(true);
                                      setGuideError(null);
                                      const { error } = await supabase
                                        .from("profiles")
                                        .update({ tutorial_started: true, tutorial_completed: false, tutorial_skipped: true, tutorial_step: 0 })
                                        .eq("id", profile.id);
                                      setGuideSaving(false);
                                      if (error) { setGuideError("Błąd zapisu. Spróbuj ponownie."); return; }
                                      setProfile(p => p ? { ...p, tutorial_started: true, tutorial_completed: false, tutorial_skipped: true, tutorial_step: 0 } : p);
                                      setTutorialStep(0);
                                      setShowWelcome(false);
                                      setGuideExitStep(0);
                                    }}
                                    className="w-full rounded-xl border border-red-700/50 bg-[rgba(80,10,10,0.6)] px-5 py-3 text-[20px] font-black text-red-300 transition hover:bg-[rgba(110,15,15,0.7)] disabled:opacity-50"
                                  >
                                    {guideSaving ? "Zapisywanie..." : "Tak, rezygnuję"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {showTestModal && canUseTestTools && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4">
              <div className="relative w-full max-w-[600px] rounded-[28px] border border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] p-6 shadow-2xl text-[#dfcfab]">
                <button onClick={() => setShowTestModal(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] hover:text-red-300">✕</button>
                <p className="mb-1 text-xs uppercase tracking-widest text-[#d8ba7a]">Panel deweloperski</p>
                <h2 className="mb-5 text-2xl font-black text-[#f9e7b2]">🧪 Testy gry</h2>
                <p className="mb-1 text-xs text-[#8b6a3e]">Mapa: {currentMap} | Lokacja: {displayLocation} | Pola: {unlockedPlotsCount}/{MAX_FIELDS}</p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">➕ Dodaj EXP</p>
                    <div className="flex flex-wrap gap-2">
                      {[250,1000,25000,500000].map(amt => (
                        <button key={amt} onClick={() => handleAddExp(amt)}
                          className="rounded-xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-3 py-2 text-xs font-black text-[#2f1b0c]">
                          +{amt.toLocaleString("pl-PL")} EXP
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">💰 Dodaj Gold</p>
                    <div className="flex flex-wrap gap-2">
                      {[1000,10000,250000,999999999].map(amt => (
                        <button key={amt} onClick={() => handleAddGold(amt)}
                          className="rounded-xl border border-yellow-500/60 bg-yellow-900/30 px-3 py-2 text-xs font-black text-yellow-200 hover:bg-yellow-900/50">
                          +{amt >= 1000000 ? amt.toLocaleString("pl-PL") : amt.toLocaleString("pl-PL")} 💰
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8b6a3e]">🌱 Dodaj nasiona (każdy rodzaj)</p>
                    <div className="flex flex-wrap gap-2">
                      {[10,50,100].map(amt => (
                        <button key={amt} onClick={() => handleAddSeeds(amt)}
                          className="rounded-xl border border-green-500/60 bg-green-900/30 px-3 py-2 text-xs font-black text-green-200 hover:bg-green-900/50">
                          +{amt} każdy
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">⭐ Dodaj epickie nasiona</p>
                    <div className="flex flex-wrap gap-2">
                      {[1,5,10].map(amt => (
                        <button key={amt} onClick={() => handleAddEpic(amt)}
                          className="rounded-xl border border-emerald-500/60 bg-emerald-900/30 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-900/50">
                          +{amt} ⭐
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-400">👑 Dodaj legendarne nasiona</p>
                    <div className="flex flex-wrap gap-2">
                      {[1,5,10].map(amt => (
                        <button key={amt} onClick={() => handleAddLegendary(amt)}
                          className="rounded-xl border border-purple-500/60 bg-purple-900/30 px-3 py-2 text-xs font-black text-purple-200 hover:bg-purple-900/50">
                          +{amt} 👑
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-300">🐄 Dodaj produkty ze zwierząt (każdy rodzaj)</p>
                    <div className="flex flex-wrap gap-2">
                      {[5,10,50].map(amt => (
                        <button key={amt} onClick={() => handleAddBarnItems(amt)}
                          className="rounded-xl border border-orange-500/60 bg-orange-900/30 px-3 py-2 text-xs font-black text-orange-200 hover:bg-orange-900/50">
                          +{amt} każdy
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-[#8b6a3e]">🥚 jajka · 🐇 futra · 🥛 mleko · 🪶 pióra · 🧶 wełna · 💩 nawóz · 🥛 mleko kozie · 🪶 duże pióra · ⚡ energia · 🦴 rogi byka</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-pink-300">🍎 Dodaj owoce z sadu (każdy rodzaj × 4 jakości)</p>
                    <div className="flex flex-wrap gap-2">
                      {[5,10,50].map(amt => (
                        <button key={amt} onClick={() => handleAddFruits(amt)}
                          className="rounded-xl border border-pink-500/60 bg-pink-900/30 px-3 py-2 text-xs font-black text-pink-200 hover:bg-pink-900/50">
                          +{amt} każdy
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-[#8b6a3e]">🍎 jabłko · 🍐 gruszka · 🟣 śliwka · 🍒 wiśnia · 🍒 czereśnia · 🍑 brzoskwinia · 🟠 morela · 🍊 pomarańcza · 🍋 cytryna (zwykły / soczysty / złoty)</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">🍯 Dodaj słoiki miodu</p>
                    <div className="flex flex-wrap gap-2">
                      {[5,10,50].map(amt => (
                        <button key={amt} onClick={() => handleAddHoneyJars(amt)}
                          className="rounded-xl border border-amber-500/60 bg-amber-900/30 px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-900/50">
                          +{amt} 🍯
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-green-400">⭐ Epickie avatary</p>
                    <button
                      onClick={async () => {
                        if (!profile?.id) return;
                        const allEpicIds = EPIC_SKINS.map((_, i) => EPIC_SKIN_START + i);
                        const { data, error } = await supabase.rpc("dev_add_test_items", { p_mode: "epic_avatars", p_avatar_ids: allEpicIds });
                        if (error) { setMessage({ type: "error", title: "Błąd odblokowania avatarów", text: error.message }); return; }
                        const response = data as { ok?: boolean; error?: string; unlocked_epic_avatars?: number[] } | null;
                        if (response?.ok === false) { setMessage({ type: "error", title: "Błąd odblokowania avatarów", text: response.error ?? "Nieznany błąd" }); return; }
                        setUnlockedEpicAvatars(response?.unlocked_epic_avatars ?? allEpicIds);
                        await loadProfile(profile.id);
                        setMessage({ type: "success", title: "Avatary odblokowane!", text: "Wszystkie epickie avatary zostały odblokowane." });
                      }}
                      className="rounded-xl border border-green-500/60 bg-green-900/30 px-4 py-2 text-xs font-black text-green-200 hover:bg-green-900/50">
                      🔓 Odblokuj wszystkie epickie avatary
                    </button>
                  </div>
                  <div className="pt-2 border-t border-[#8b6a3e]/30">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-400">⚠️ Niebezpieczne</p>
                    <button onClick={handleResetAccount}
                      className="rounded-xl border border-red-500/60 bg-red-950/40 px-4 py-2 text-xs font-black text-red-300 hover:bg-red-950/70">
                      🗑️ Zresetuj całe konto
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SHOP MODAL ═══ */}
          {showShopModal && (
            <ShopModal
              profileId={profile?.id}
              displayMoney={displayMoney}
              displayLevel={displayLevel}
              dailyPromos={dailyPromos}
              promoCountdown={promoCountdown}
              seedInventory={seedInventory}
              cropPrices={CROP_PRICES}
              barnState={barnState}
              orchardState={orchardState}
              orchardError={orchardError}
              shopCart={shopCart}
              shopError={shopError}
              setShopCart={setShopCart}
              onClose={() => { setShowShopModal(false); setShopError(""); }}
              onBuyAnimal={handleShopBuyAnimal}
              onBuyTree={handleShopBuyTree}
              onBuyHiveItem={handleShopBuyHiveItem}
              onBuySeeds={handleShopBuySeeds}
            />
          )}

          {/* ═══ DOM MODAL ═══ */}
          {showDomModal && (
            <div className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[rgba(14,8,4,0.99)]">
              <div className="relative flex w-full flex-1 min-h-0 overflow-hidden">

                {/* ─ Zamknij ─ */}
                <button onClick={() => setShowDomModal(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>

                {/* ─ Sidebar ─ */}
                <div className="flex w-[264px] shrink-0 flex-col gap-3 border-r border-[#8b6a3e]/30 bg-black/20 p-8 pt-20 overflow-y-auto">
                  <p className="mb-4 text-sm font-black uppercase tracking-widest text-[#8b6a3e]">🏠 Dom gracza</p>
                  {(["profil","eq","plecak"] as const).map(tab => (
                    <button key={tab} onClick={() => setDomTab(tab)}
                      className={`flex items-center gap-3 rounded-xl px-5 py-4 text-xl font-bold transition ${
                        domTab === tab ? "border border-yellow-400/60 bg-yellow-500/10 text-yellow-200" : "text-[#dfcfab] hover:bg-white/5"
                      }`}>
                      {tab === "profil" ? "👤" : tab === "eq" ? "⚔️" : "🎒"}
                      {tab === "profil" ? "Profil" : tab === "eq" ? "Ekwipunek" : "Plecak"}
                    </button>
                  ))}
                </div>

                {/* ─ Zawartość ─ */}
                <div className="flex-1 min-h-0 overflow-y-auto p-9 pt-8 text-[#dfcfab]">

                  {/* ════ PROFIL ════ */}
                  {domTab === "profil" && (
                    <div className="flex gap-9">
                      {/* Lewa kolumna: avatar */}
                      <div className="flex w-72 shrink-0 flex-col items-center gap-6">
                        <button onClick={() => { setShowDomModal(false); setShowSkinModal(true); }}
                          className="flex h-56 w-56 items-center justify-center rounded-[28px] border-2 border-[#8b6a3e] bg-[rgba(38,24,14,0.8)] shadow-xl transition hover:border-yellow-400/60 overflow-hidden">
                          {avatarSkin >= 0
                            ? <img src={ALL_SKINS[avatarSkin]} alt="Avatar" className="w-full h-full object-cover" style={{imageRendering:"pixelated"}} />
                            : <span className="flex flex-col items-center justify-center gap-1 animate-pulse">
                                <span className="text-[#f9e7b2] text-xl font-black leading-tight text-center">Wybierz Avatar</span>
                                <span className="text-[#c9952f] text-sm font-bold">(kliknij)</span>
                              </span>}
                        </button>
                        <div className="w-full text-center">
                          <p className="text-xl font-black text-[#f9e7b2]">{profile?.login}</p>
                          {freeSkillPoints > 0 && (
                            <span className="mt-1 inline-block rounded-lg bg-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-300">+{freeSkillPoints} pkt do rozdania</span>
                          )}
                        </div>
                        <div className="w-full rounded-xl border border-[#8b6a3e]/30 bg-black/20 p-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[#8b6a3e]">Poziom</span>
                            <span className="font-black text-[#f9e7b2]">⭐ {displayLevel}</span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-[#8b6a3e]">EXP</span>
                              <span className="text-[#dfcfab] tabular-nums">{displayXp.toLocaleString("pl-PL")} / {displayXpToNextLevel.toLocaleString("pl-PL")}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-black/50 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-400 transition-all" style={{ width:`${displayXpToNextLevel > 0 ? Math.min(100, Math.round(displayXp / displayXpToNextLevel * 100)) : 100}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#8b6a3e]">PLN</span>
                            <span className="font-bold text-green-300 tabular-nums">{Number(displayMoney).toLocaleString("pl-PL")} zł</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-[#8b6a3e]/20 pt-2">
                            <span className="text-[#8b6a3e]">Moc farmy</span>
                            <span className="font-black text-yellow-300 tabular-nums">{computeFarmPower(playerStats, charEquipped, hiveData.level, orchardState, barnState)}</span>
                          </div>
                        </div>
                        <div className="w-full rounded-xl border border-[#8b6a3e]/20 bg-black/15 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#8b6a3e] mb-2">Twoje osiągnięcia</p>
                          {(() => {
                            const systems = [
                              { label:"Zwierzęta", val:Object.values(barnState as Record<string,{owned:number}>).reduce((s,a)=>s+a.owned,0) },
                              { label:"Drzewa",    val:Object.values(orchardState as Record<string,{owned:number}>).reduce((s,t)=>s+t.owned,0) },
                              { label:"Pszczoły",  val:hiveData.level },
                            ];
                            const top = [...systems].sort((a,b)=>b.val-a.val)[0];
                            const statLabels: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zręczność",zaradnosc:"Zaradność",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczęście" };
                            const _statEntries = Object.entries(playerStats) as [string,number][];
                            const bestStat = _statEntries.length > 0 ? _statEntries.reduce((a,b)=>a[1]>=b[1]?a:b) : ["wiedza",0] as [string,number];
                            return (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-[#8b6a3e]">Najsilniejszy system</span>
                                  <span className="text-[11px] font-bold text-[#dfcfab]">{top.label} ({top.val})</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-[#8b6a3e]">Najwyższy stat</span>
                                  <span className="text-[11px] font-bold text-[#dfcfab]">{statLabels[bestStat[0]]??bestStat[0]} ({bestStat[1]})</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-[#8b6a3e]">Aktywność dziś</span>
                                  <span className="text-[11px] font-bold text-[#dfcfab]">{dailyProgress.harvests + dailyProgress.customers} akcji</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Prawa kolumna: statystyki */}
                      <div className="flex-1">
                        {/* ─── Moc farmy + bonusy summary ─── */}
                        {(() => {
                          const _wB  = Math.min(25, calcStatEffect(effectiveStats.wiedza + getEquipFlatBonus(" pkt Wiedzy", charEquipped), WIEDZA_RATE));
                          const _zaB = calcStatEffect(effectiveStats.zaradnosc + getEquipFlatBonus(" pkt Zaradnosci", charEquipped), ZARADNOSC_RATE);
                          const _zrB = calcStatEffect(effectiveStats.zrecznosc + getEquipFlatBonus(" pkt Zrecznosci", charEquipped), 0.004);
                          const _saB = calcStatEffect(effectiveStats.sadownik + getEquipFlatBonus(" pkt Sadownika", charEquipped), 0.005);
                          const _opB = Math.min(90, effectiveStats.opieka * 0.3);
                          const _shB = calcStatEffect(effectiveStats.szczescie + getEquipFlatBonus(" pkt Szczescia", charEquipped), 0.0025);
                          const _fp = computeFarmPower(playerStats, charEquipped, hiveData.level, orchardState, barnState);
                          const _statsPow = Math.round(Object.values(playerStats).reduce((s: number, v: unknown) => s + (v as number), 0) * 3);
                          const _eqB = (Object.values(charEquipped) as ({id:string;upg:number}|null)[]).reduce((s, eq) => { if (!eq) return s; const d = CHAR_EQUIP_ITEMS.find(it => it.id === eq.id); return s + (d?.unlockLevel ?? 1) * 8 + (eq.upg ?? 0) * (eq.upg ?? 0) * 4; }, 0);
                          const _hivB = Math.round(hiveData.level * hiveData.level * 20);
                          const _orchB = TREES.reduce((s, t) => s + Math.round(Math.sqrt(t.buyPrice) * 2) * (orchardState[t.id]?.owned ?? 0), 0);
                          const _barnB = ANIMALS.reduce((s, a) => s + Math.round(Math.sqrt(a.buyPrice) * 2.5) * (barnState[a.id]?.owned ?? 0), 0);
                          const _farmRank = _fp >= 15000 ? "Legenda Plonopolis" : _fp >= 7500 ? "Magnat" : _fp >= 3500 ? "Farmer Premium" : _fp >= 1500 ? "Gospodarz" : _fp >= 500 ? "Rolnik" : "Nowicjusz";
                          const _farmRankC = _fp >= 15000 ? "text-purple-300" : _fp >= 7500 ? "text-yellow-300" : _fp >= 3500 ? "text-orange-300" : _fp >= 1500 ? "text-green-300" : _fp >= 500 ? "text-blue-300" : "text-[#8b6a3e]";
                          return (
                            <div className="mb-4 rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-950/20 to-black/20 p-4">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-base font-black text-[#f9e7b2]">🏆 Moc farmy</p>
                                <span className="text-2xl font-black text-yellow-300 tabular-nums">{_fp}</span>
                              </div>
                              <p className="text-xs mb-3"><span className="text-[#8b6a3e]">Ranga: </span><span className={`font-black ${_farmRankC}`}>{_farmRank}</span></p>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { icon:"🌱", label:"Wzrost",    val:`−${_wB.toFixed(1)}%`,  c:"text-green-300"  },
                                  { icon:"💧", label:"Podlanie",  val:`−${_zaB.toFixed(1)}%`, c:"text-cyan-300"   },
                                  { icon:"🎯", label:"Zbiór x2",  val:`+${_zrB.toFixed(1)}%`, c:"text-yellow-300" },
                                  { icon:"🌳", label:"Sad",       val:`+${_saB.toFixed(1)}%`, c:"text-emerald-300"},
                                  { icon:"🐄", label:"Zwierzęta", val:`−${_opB.toFixed(1)}%`, c:"text-orange-300" },
                                  { icon:"🍀", label:"Drop",      val:`+${_shB.toFixed(1)}%`, c:"text-green-300"  },
                                ].map(b => (
                                  <span key={b.label} className="flex items-center gap-1 rounded-lg bg-black/30 px-3 py-1.5 text-xs font-medium">
                                    <span className="text-[#8b6a3e]">{b.icon} {b.label}</span>
                                    <span className={`font-bold ${b.c}`}>{b.val}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="mt-2 grid grid-cols-5 gap-1.5 text-center">
                                {([
                                  { label:"Staty",   val:_statsPow },
                                  { label:"Ekwip.",  val:_eqB      },
                                  { label:"Ul",      val:_hivB     },
                                  { label:"Sad",     val:_orchB    },
                                  { label:"Zwierz.", val:_barnB    },
                                ] as {label:string;val:number}[]).map(c => (
                                  <div key={c.label} className="rounded-lg bg-black/30 py-1.5">
                                    <div className="text-[10px] text-[#8b6a3e]">{c.label}</div>
                                    <div className="text-xs font-black text-yellow-200 tabular-nums">{c.val}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* ─── Historia postępu: dziś ─── */}
                        <div className="mb-4 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/15 to-black/20 p-4">
                          <p className="text-sm font-black text-[#f9e7b2] mb-2">📈 Dziś</p>
                          {(dailyProgress.harvests === 0 && dailyProgress.customers === 0 && dailyProgress.expGained === 0 && dailyProgress.levelsGained === 0) ? (
                            <div className="space-y-2">
                              <p className="text-[11px] text-[#8b6a3e] mb-1">Propozycje na dziś:</p>
                              {([
                                { text:"Zbierz pierwszą uprawę" },
                                { text:"Zrealizuj zamówienie klienta" },
                                { text:"Użyj kompostu na polu" },
                              ] as {text:string}[]).map(t => (
                                <div key={t.text} className="flex items-center gap-2 text-xs text-[#8b6a3e]">
                                  <span className="shrink-0 text-sm">☐</span>
                                  <span>{t.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {dailyProgress.levelsGained > 0 && <span className="flex items-center gap-1 rounded-lg bg-yellow-900/30 border border-yellow-500/30 px-3 py-1.5 text-xs font-bold text-yellow-300">+{dailyProgress.levelsGained} lvl</span>}
                              {dailyProgress.expGained > 0 && <span className="flex items-center gap-1 rounded-lg bg-blue-900/30 border border-blue-500/30 px-3 py-1.5 text-xs font-bold text-blue-300">+{dailyProgress.expGained.toLocaleString("pl-PL")} EXP</span>}
                              {dailyProgress.moneyGained > 0 && <span className="flex items-center gap-1 rounded-lg bg-green-900/30 border border-green-500/30 px-3 py-1.5 text-xs font-bold text-green-300">+{dailyProgress.moneyGained.toLocaleString("pl-PL")} zł</span>}
                              {dailyProgress.customers > 0 && <span className="flex items-center gap-1 rounded-lg bg-purple-900/30 border border-purple-500/30 px-3 py-1.5 text-xs font-bold text-purple-300">+{dailyProgress.customers} klientów</span>}
                              {dailyProgress.harvests > 0 && <span className="flex items-center gap-1 rounded-lg bg-[#8b6a3e]/30 border border-[#8b6a3e]/50 px-3 py-1.5 text-xs font-bold text-[#dfcfab]">+{dailyProgress.harvests} zbiorów</span>}
                            </div>
                          )}
                        </div>

                        {/* ─── Nagłówek + selector ─── */}
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-base font-black text-[#f9e7b2]">🧙 Statystyki</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[#8b6a3e]">Dodaj:</span>
                            {([1,5,10] as const).map(n => (
                              <button key={n} onClick={() => setStatUpgradeAmount(n)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                                  statUpgradeAmount === n ? "border-yellow-400 bg-yellow-500/30 text-yellow-200" : "border-[#8b6a3e]/40 bg-black/20 text-[#8b6a3e] hover:border-yellow-600/60 hover:text-yellow-400"
                                }`}>+{n}</button>
                            ))}
                          </div>
                        </div>

                        {/* ─── Karty statystyk ─── */}
                        <div className="space-y-2">
                          {STATS_DEFS.map(def => {
                            const val = playerStats[def.key];
                            const _avBonus = (getAvatarBonus(avatarSkin)[def.key as keyof PlayerStatsMap] ?? 0) as number;
                            const _eqBonus = def.eqLabel ? getEquipFlatBonus(def.eqLabel, charEquipped) : 0;
                            const effVal = val + _avBonus + _eqBonus;
                            const eff = calcStatEffect(effVal, def.rate);
                            const isLocked = displayLevel < def.unlockLevel;
                            const maxApplicable = Math.max(0, 100 - val);
                            const freeToUse = !isLocked ? Math.min(statUpgradeAmount, freeSkillPoints, maxApplicable) : 0;
                            const paidCount = !isLocked ? Math.min(statUpgradeAmount, maxApplicable) - freeToUse : 0;
                            let paidCost = 0;
                            for (let _i = 0; _i < paidCount; _i++) { paidCost += getStatUpgradeCost(val + freeToUse + _i + 1); }
                            const totalApplicable = freeToUse + paidCount;
                            const canAfford = paidCount === 0 || displayMoney >= paidCost;
                            const canUp2 = !isLocked && totalApplicable > 0 && canAfford;
                            const rank = getStatRank(val);
                            const rankBarFill = rank.nextT > rank.prevT ? Math.round((val - rank.prevT) / (rank.nextT - rank.prevT) * 100) : 100;
                            const nextPtBonus = val < 100
                              ? def.key === "opieka"
                                ? (Math.min(90, (val+1)*0.3) - Math.min(90, val*0.3)).toFixed(2)
                                : (calcStatEffect(val+1, def.rate) - eff).toFixed(2)
                              : "0.00";
                            const bonusStr = def.key === "wiedza"    ? `−${Math.min(25, eff).toFixed(1)}% wzrostu`
                              : def.key === "zrecznosc"  ? `+${eff.toFixed(1)}% szansa`
                              : def.key === "zaradnosc"  ? `−${eff.toFixed(1)}% podlanie`
                              : def.key === "sadownik"   ? `+${eff.toFixed(1)}% drzewa`
                              : def.key === "opieka"     ? `−${Math.min(90, effVal*0.3).toFixed(1)}% głód`
                              : `+${eff.toFixed(1)}% drop`;
                            const isFlashing = statFlash === def.key;
                            return (
                              <div key={def.key}
                                className={`rounded-xl border p-3 transition-all duration-300 ${
                                  isFlashing  ? "border-yellow-400 bg-yellow-500/10 shadow-lg shadow-yellow-500/10"
                                  : isLocked  ? "border-[#8b6a3e]/20 bg-black/10 opacity-60"
                                  : "border-[#8b6a3e]/40 bg-black/20 hover:border-[#8b6a3e]/70"
                                }`}>
                                <div className="flex items-center gap-3">
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[15px] font-black text-[#f9e7b2]">{def.label}</span>
                                      {isLocked
                                        ? <span className="text-[10px] font-bold text-orange-400 bg-orange-900/30 rounded px-1.5 py-0.5">🔒 lvl {def.unlockLevel}</span>
                                        : <span className={`text-[10px] font-bold ${rank.color} bg-black/30 rounded px-1.5 py-0.5`}>{rank.name}</span>
                                      }
                                      {effVal > 0 && (
                                        <span className="text-sm font-bold text-green-200 ml-auto tabular-nums">{bonusStr}</span>
                                      )}
                                    </div>
                                    {isLocked ? (
                                      <div className="mt-0.5 space-y-0.5">
                                        <p className="text-[11px] text-[#8b6a3e]">Ulepszanie odblokuje sie na poziomie {def.unlockLevel}</p>
                                        {_avBonus > 0 && <p className="text-[11px] font-bold text-amber-400">+{_avBonus} z avatara — juz aktywne!</p>}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="mt-1 relative h-2 w-full">
                                          <div className="absolute inset-0 overflow-hidden rounded-full bg-black/40">
                                            <div className="h-full rounded-full bg-gradient-to-r from-[#8b6a3e] to-[#f9e7b2] transition-all duration-500"
                                              style={{ width:`${rankBarFill}%` }} />
                                          </div>
                                          {[25,50,75].map(pct => (
                                            <div key={pct} className="absolute top-0 bottom-0 w-px bg-black/60 z-10" style={{ left:`${pct}%` }} />
                                          ))}
                                        </div>
                                        <div className="flex justify-between mt-0.5 px-0">
                                          {[0,25,50,75,100].map(t => (
                                            <span key={t} className="text-[9px] text-[#6b4e2e] tabular-nums">{t}</span>
                                          ))}
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                          <span className="text-[11px] text-[#9b7a4e]">{def.desc} · {val}/100{_avBonus > 0 ? <span className="text-amber-400 font-bold"> +{_avBonus} avatar</span> : null}{_eqBonus > 0 ? <span className="text-purple-400 font-bold"> +{Math.round(_eqBonus)} eq</span> : null}</span>
                                          {val < 100
                                            ? <span className="text-[11px] text-[#9b7a4e]">+1 pkt → <span className="text-green-300 font-bold">+{nextPtBonus}%</span></span>
                                            : <span className="text-[11px] font-bold text-yellow-400">MAX</span>
                                          }
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {/* Przycisk */}
                                  {!isLocked && (
                                    <button disabled={!canUp2}
                                      onClick={() => {
                                        if (!profile?.id || !canUp2) return;
                                        void (async () => {
                                          let curStats = { ...playerStats };
                                          let curFsp = freeSkillPoints;
                                          // 1. Wolne punkty najpierw
                                          if (freeToUse > 0) {
                                            curStats = { ...curStats, [def.key]: val + freeToUse };
                                            curFsp = freeSkillPoints - freeToUse;
                                            setPlayerStats(curStats);
                                            setFreeSkillPoints(curFsp);
                                            // Await DB — żeby paid RPC widział aktualny poziom stat
                                            await supabase.rpc("game_save_avatar_data", {
                                              p_avatar_skin: avatarSkin,
                                              p_player_stats: curStats as Record<string, number>,
                                              p_free_skill_points: curFsp,
                                              p_prev_level: prevLevelRef.current,
                                            });
                                            saveAvatarDataLS(profile.id, avatarSkin, curStats, curFsp, prevLevelRef.current);
                                          }
                                          // 2. Płatne punkty (jeśli są)
                                          if (paidCount > 0) {
                                            const { data, error } = await supabase.rpc("game_buy_stat_points", {
                                              p_stat_key: def.key,
                                              p_amount: paidCount,
                                            });
                                            if (error) { setMessage({ type: "error", title: "Błąd zakupu statystyki", text: error.message }); return; }
                                            const response = data as {
                                              ok?: boolean; error?: string; stat_key?: string;
                                              amount?: number; cost?: number;
                                              player_stats?: PlayerStatsMap; free_skill_points?: number;
                                            } | null;
                                            if (response?.ok === false) { setMessage({ type: "error", title: "Błąd zakupu statystyki", text: response.error ?? "Nieznany błąd." }); return; }
                                            // Zawsze oblicz lokalnie z curStats (unikamy race condition: game_save_avatar_data
                                            // z wolnych punktów może nie zdążyć zacommitować przed odczytem game_buy_stat_points)
                                            const newStats: PlayerStatsMap = { ...curStats, [def.key]: (curStats[def.key] as number) + paidCount };
                                            const newFsp = curFsp;
                                            setPlayerStats(newStats);
                                            setFreeSkillPoints(newFsp);
                                            saveAvatarDataLS(profile.id, avatarSkin, newStats, newFsp, prevLevelRef.current);
                                            // Zaktualizuj DB z poprawnymi danymi (nadpisuje ewentualnie stale dane z RPC)
                                            void supabase.rpc("game_save_avatar_data", {
                                              p_avatar_skin: avatarSkin,
                                              p_player_stats: newStats as Record<string, number>,
                                              p_free_skill_points: newFsp,
                                              p_prev_level: prevLevelRef.current,
                                            });
                                            await loadProfile(profile.id);
                                            const freeMsg = freeToUse > 0 ? `+${freeToUse} za darmo, ` : '';
                                            setMessage({ type: "success", title: "Statystyka ulepszona", text: `${freeMsg}+${response?.amount ?? paidCount} pkt za ${(response?.cost ?? paidCost).toLocaleString("pl-PL")} 💰.` });
                                          } else {
                                            setMessage({ type: "success", title: "Statystyka ulepszona", text: `+${freeToUse} pkt za darmo.` });
                                          }
                                          setStatFlash(def.key); setTimeout(() => setStatFlash(null), 700);
                                        })();
                                      }}
                                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition whitespace-nowrap border ${
                                        freeToUse > 0 && paidCount === 0 ? "border-yellow-500/50 bg-yellow-500/25 text-yellow-200 hover:bg-yellow-500/40"
                                        : freeToUse > 0 && paidCount > 0  ? "border-purple-500/50 bg-purple-900/30 text-purple-200 hover:bg-purple-800/50"
                                        : canAfford && paidCount > 0       ? "border-green-700/50 bg-green-900/35 text-green-200 hover:bg-green-800/50"
                                        : val >= 100 ? "border-[#8b6a3e]/20 cursor-not-allowed opacity-30 bg-black/20 text-[#8b6a3e]"
                                        : "border-[#8b6a3e]/20 cursor-not-allowed opacity-40 bg-black/20 text-[#8b6a3e]"
                                      }`}>
                                      {val >= 100 ? "MAX"
                                        : freeToUse > 0 && paidCount === 0 ? `▲ +${totalApplicable} pkt`
                                        : freeToUse > 0 && paidCount > 0   ? `▲ +${totalApplicable} pkt · ${paidCost.toLocaleString("pl-PL")} 💰`
                                        : `${paidCost.toLocaleString("pl-PL")} 💰`}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* ─── Reset ─── */}
                        <button className="mt-3 block ml-auto rounded-lg border border-red-400/20 bg-red-950/15 px-3 py-1.5 text-[11px] font-bold text-red-400/60 transition hover:border-red-400/50 hover:text-red-300 hover:bg-red-950/40"
                          onClick={() => {
                            if (!profile?.id) return;
                            if (!confirm("Resetować wszystkie statystyki za 50 000 💰?")) return;
                            void (async () => {
                              const { data, error } = await supabase.rpc("game_reset_player_stats");
                              if (error) { setMessage({ type: "error", title: "Błąd resetu statystyk", text: error.message }); return; }
                              const response = data as {
                                ok?: boolean;
                                error?: string;
                                spent?: number;
                                spent_points?: number;
                                player_stats?: PlayerStatsMap;
                                free_skill_points?: number;
                              } | null;
                              if (response?.ok === false) { setMessage({ type: "error", title: "Błąd resetu statystyk", text: response.error ?? "Nieznany błąd." }); return; }
                              const newStats = response?.player_stats ?? { ...DEFAULT_STATS };
                              const newFsp = typeof response?.free_skill_points === "number" ? response.free_skill_points : freeSkillPoints;
                              setPlayerStats(newStats);
                              setFreeSkillPoints(newFsp);
                              saveAvatarDataLS(profile.id, avatarSkin, newStats, newFsp, prevLevelRef.current);
                              await loadProfile(profile.id);
                              setMessage({ type: "success", title: "Statystyki zresetowane", text: `Odzyskano ${response?.spent_points ?? 0} punktów umiejętności. Koszt: ${response?.spent ?? 50000} 💰.` });
                            })();
                          }}>🔄 Reset statystyk (50 000 💰)</button>
                      </div>
                    </div>
                  )}

                  {/* ════ KOSMETYKA ════ */}
                  {/* ════ EKWIPUNEK ════ */}
                  {domTab === "eq" && (() => {
                    const SLOT_BOX = slotBoxCustom;
                    const handleUpg = async (slot: EquipSlot, eqD: { id: string; upg: number }) => {
                      const nextU = eqD.upg+1; const cost = getUpgradeCost(eqD.id, nextU);
                      if (displayMoney < cost) { setMessage({ type:"error", title:"Za mało złota!", text:`Potrzebujesz ${cost.toLocaleString()} 💰` }); return; }
                      const { data, error: rpcErr } = await supabase.rpc("game_roll_equipment_upgrade", {
                        p_item_id: eqD.id,
                        p_current_upg: eqD.upg,
                        p_luck: effectiveStats.szczescie ?? 0,
                      });
                      if (rpcErr) { setMessage({ type:"error", title:"Błąd ulepszenia", text: rpcErr.message }); return; }
                      const response = data as {
                        ok?: boolean; error?: string; item_id?: string; item_name?: string; slot?: string;
                        current_upg?: number; target_upg?: number; new_upg?: number;
                        success?: boolean; cost?: number; chance?: number;
                        materials?: Array<{ mat_id: string; qty: number; have?: number }>;
                        missing_materials?: Array<{ mat_id: string; need: number; have: number }>;
                        barn_items?: BarnItems;
                      } | null;
                      if (response?.ok === false) {
                        if (response.missing_materials && response.missing_materials.length > 0) {
                          const txt = response.missing_materials.map(m => `${m.mat_id} ${m.have}/${m.need}`).join(", ");
                          setMessage({ type:"error", title:"Brak materiałów!", text:`Brakuje: ${txt}` });
                        } else {
                          setMessage({ type:"error", title:"Błąd ulepszenia", text: response.error ?? "Nieznany błąd." });
                        }
                        return;
                      }
                      const fu = response?.new_upg ?? eqD.upg;
                      if (response?.barn_items) saveBarnItems(response.barn_items);
                      saveCharEquipped({ ...charEquipped, [slot]: { id: eqD.id, upg: fu } });
                      saveItemUpg({ ...itemUpgRegistry, [eqD.id]: fu });
                      await loadProfile(profile!.id);
                      if (response?.success) { setMessage({ type:"success", title:`✨ +${fu} udane!`, text:`Koszt: ${(response.cost ?? cost).toLocaleString()} 💰` }); }
                      else if (fu < eqD.upg) { setMessage({ type:"error", title:`⬇ Item cofa się do +${fu}!`, text:"Ulepszenie nie powiodło się." }); }
                      else { setMessage({ type:"error", title:"Nie powiodło się.", text:`Item pozostaje na +${fu}.` }); }
                    };
                    return (
                      <div>
                        {/* Tytuł + przycisk edycji hitboxów */}
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xl font-black text-[#f9e7b2]">⚔️ Ekwipunek gracza</p>
                          {canEditHitboxes && (
                          <button
                            onClick={() => setEditSlotBox(v => !v)}
                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${editSlotBox ? "border-orange-400 bg-orange-900/50 text-orange-300" : "border-[#8b6a3e]/60 bg-black/30 text-[#dfcfab] hover:border-orange-400/60 hover:text-orange-200"}`}>
                            🎯 {editSlotBox ? "Zakończ edycję" : "Edytuj hitboxy"}
                          </button>
                          )}
                        </div>

                        {/* Panel edycji hitboxów */}
                        {editSlotBox && (
                          <div className="mb-3 rounded-xl border border-orange-400/40 bg-orange-950/30 p-3">
                            <p className="text-[10px] text-orange-300 uppercase tracking-widest mb-2">📐 Pozycje hitboxów (wartości w %)</p>
                            <div className="flex flex-wrap gap-4">
                              {(["glowa","dlonie","nogi"] as EquipSlot[]).map(sl => {
                                const b = slotBoxCustom[sl];
                                const lbl = { glowa:"👑 Głowa", dlonie:"🧤 Dłonie", nogi:"👢 Nogi" }[sl];
                                const upd = (field: string, val: string) => {
                                  const num = parseFloat(val);
                                  if (isNaN(num)) return;
                                  saveSlotBox({ ...slotBoxCustom, [sl]: { ...slotBoxCustom[sl], [field]: num } });
                                };
                                return (
                                  <div key={sl} className="flex flex-col gap-1 min-w-[160px]">
                                    <p className="text-[11px] font-black text-orange-200">{lbl}</p>
                                    {(["top","left","width","height"] as const).map(field => (
                                      <div key={field} className="flex items-center gap-2">
                                        <span className="text-[10px] text-[#8b6a3e] w-12">{field}</span>
                                        <input
                                          type="number" step="0.5" min="0" max="100"
                                          defaultValue={b[field]}
                                          onBlur={e => upd(field, e.target.value)}
                                          onKeyDown={e => { if (e.key === "Enter") upd(field, (e.target as HTMLInputElement).value); }}
                                          className="w-20 rounded border border-orange-400/40 bg-black/40 px-2 py-0.5 text-[11px] text-orange-100 outline-none focus:border-orange-400"
                                        />
                                        <span className="text-[10px] text-[#6b7280]">%</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button onClick={() => saveSlotBox({ ...DEFAULT_SLOT_BOX })}
                                className="rounded-lg border border-[#8b6a3e]/50 px-3 py-1 text-[10px] text-[#dfcfab] hover:bg-white/5">
                                ↺ Resetuj domyślne
                              </button>
                              <p className="text-[9px] text-[#6b7280] self-center">Zmiany zapisywane natychmiast. Enter lub kliknij poza pole.</p>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-3">
                          {/* Grafika postaci z hitboxami — plik: public/ekwip_postac.png */}
                          <div className="relative w-full rounded-xl overflow-hidden border border-[#8b6a3e]/30" style={{ aspectRatio:"1536/1024", background:"rgba(10,6,2,0.6)" }}>
                            <img src="/ekwipunek/ekwip_postac.png" alt="Postać" draggable={false}
                              className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none" />
                            {(["glowa","dlonie","nogi"] as EquipSlot[]).map(slot => {
                              const box = SLOT_BOX[slot];
                              const eqD = charEquipped[slot];
                              const eItem = eqD ? CHAR_EQUIP_ITEMS.find(i => i.id === eqD.id) : null;
                              const upg = eqD?.upg ?? 0;
                              const uc = UPG_COLOR[upg] ?? "#6b7280";
                              const isOver = dragOverSlot === slot;
                              const isSel = equippingSlot === slot;
                              return (
                                <div key={slot}
                                  className="absolute rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition-all"
                                  style={{
                                    top:`${box.top}%`, left:`${box.left}%`, width:`${box.width}%`, height:`${box.height}%`,
                                    border:`2px ${isOver?"dashed":"solid"} ${isOver?"#fbbf24":isSel?"#fff":eqD?uc:"#8b6a3e"}`,
                                    background:isOver?"rgba(251,191,36,0.18)":isSel?"rgba(255,255,255,0.08)":eqD?"rgba(60,40,5,0.55)":"rgba(0,0,0,0.35)",
                                  }}
                                  onDragOver={e => { e.preventDefault(); setDragOverSlot(slot); }}
                                  onDragLeave={() => setDragOverSlot(null)}
                                  onDrop={e => {
                                    e.preventDefault(); setDragOverSlot(null);
                                    if (!draggedItemId) return;
                                    const di = CHAR_EQUIP_ITEMS.find(i => i.id === draggedItemId);
                                    if (!di || di.slot !== slot || (profile?.level??0) < di.unlockLevel) return;
                                    const existing = charEquipped[slot];
                                    saveCharEquipped({ ...charEquipped, [slot]: existing?.id === di.id ? null : { id: di.id, upg: getItemUpg(di.id) } });
                                    setDraggedItemId(null);
                                  }}
                                  onClick={() => { const next = isSel ? null : slot; setEquippingSlot(next); if (next) setEqFilter(next); }}
                                >
                                  {eItem ? (
                                    <>
                                      {eItem.img
                                        ? <img src={eItem.img} alt={eItem.name} className="w-10 h-10 object-contain drop-shadow-lg" draggable={false} />
                                        : <span className="text-xl leading-none">{eItem.icon}</span>}
                                      <span className="text-[30px] font-black mt-0.5" style={{ color:uc }}>+{upg}</span>
                                      <span className="text-[40px] text-[#f9e7b2] leading-tight text-center px-0.5 truncate w-full">{eItem.name.split(" ")[0]}</span>
                                    </>
                                  ) : (
                                    <span className="text-[9px] text-[#8b6a3e] text-center leading-tight">{EQUIP_SLOT_META[slot].icon} {EQUIP_SLOT_META[slot].label}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* Panel ulepszania wybranego slotu */}
                          {equippingSlot && charEquipped[equippingSlot] && (() => {
                            const slot = equippingSlot;
                            const eqD = charEquipped[slot];
                            if (!eqD) return null;
                            const eItem = CHAR_EQUIP_ITEMS.find(i => i.id === eqD.id);
                            if (!eItem) return null;
                            const upg = eqD.upg; const uc = UPG_COLOR[upg]??"#6b7280";
                            return (
                              <div className="rounded-xl border border-[#8b6a3e]/50 bg-black/25 px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-base">{eItem.icon}</span>
                                      <p className="text-xs font-bold text-[#f9e7b2] truncate">{eItem.name}</p>
                                      <span className="text-[11px] font-black px-1.5 rounded" style={{ background:uc+"33", color:uc }}>+{upg}</span>
                                    </div>
                                    <p className="text-[10px] text-cyan-300 mt-0.5">{bonusLine(eItem.bonuses, upg)}</p>
                                    {upg < 10
                                      ? <p className="text-[11px] font-bold text-[#f9e7b2] mt-1">+{upg} → +{upg+1} · {Math.round(Math.min(100, (UPGRADE_CHANCE[upg+1] + Math.min(0.05, (effectiveStats.szczescie ?? 0) * 0.0005)) * 100))}% szansy</p>
                                      : <p className="text-[11px] font-black mt-1" style={{ color:UPG_COLOR[10] }}>✦ MAKS +10 ✦</p>}
                                    {upg > 6 && upg < 10 && <p className="text-[10px] text-red-400">⚠ Fail: cofa do +{upg-1}</p>}
                                    {upg < 10 && (() => {
                                      const matsNeeded = getUpgradeMaterials(eqD.id, upg+1);
                                      if (matsNeeded.length === 0) return null;
                                      return (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {matsNeeded.map(m => {
                                            const md = ANIMAL_ITEMS.find(i => i.id === m.matId);
                                            const have = barnItems[m.matId] ?? 0;
                                            const enough = have >= m.qty;
                                            return (
                                              <span key={m.matId} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${enough ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50" : "bg-red-900/40 text-red-300 border border-red-700/50"}`}>
                                                {md?.icon ?? "•"} {have}/{m.qty}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-col gap-1 shrink-0">
                                    {upg < 10 && (() => {
                                      const matsNeeded = getUpgradeMaterials(eqD.id, upg+1);
                                      const matsOk = matsNeeded.every(m => (barnItems[m.matId] ?? 0) >= m.qty);
                                      return (
                                      <button type="button" onClick={() => handleUpg(slot, eqD)}
                                        disabled={!matsOk}
                                        className="rounded-xl border border-amber-500/60 bg-amber-900/20 px-2 py-1 text-xs font-bold text-amber-300 hover:bg-amber-900/40 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                                        ⚒ {getUpgradeCost(eqD.id, upg+1).toLocaleString()} 💰
                                      </button>
                                      );
                                    })()}
                                    <button type="button" onClick={() => { saveCharEquipped({ ...charEquipped, [slot]: null }); setEquippingSlot(null); }}
                                      className="rounded-xl border border-red-500/50 px-2 py-1 text-[10px] text-red-400 hover:bg-red-900/30">Zdejmij</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* Lista itemów — filtry + siatka */}
                          <div>
                            {/* Tabs filtrów */}
                            <div className="flex gap-1.5 mb-3 flex-wrap">
                              {([["","Wszystkie","⚔️"],["glowa","Głowa","👑"],["dlonie","Dłonie","🧤"],["nogi","Nogi","👢"]] as [EquipSlot|"",string,string][]).map(([val,lbl,ico]) => (
                                <button key={val} onClick={() => setEqFilter(val)}
                                  className={`flex items-center gap-1 rounded-lg border px-3 py-1 text-[11px] font-bold transition ${eqFilter===val?"border-yellow-400/70 bg-yellow-500/15 text-yellow-200":"border-[#8b6a3e]/50 bg-black/20 text-[#dfcfab] hover:border-[#8b6a3e] hover:bg-white/5"}`}>
                                  {ico} {lbl}
                                </button>
                              ))}
                            </div>
                            {/* Siatka kwadratowych slotów */}
                            <div className="grid grid-cols-5 gap-2">
                              {(() => {
                                const ownedList = CHAR_EQUIP_ITEMS
                                  .filter(i => !eqFilter || i.slot === eqFilter)
                                  .filter(i => ownedEqItems[i.id])
                                  .sort((a,b) => {
                                    // 1) wg poziomu rosnąco
                                    if (a.unlockLevel !== b.unlockLevel) return a.unlockLevel - b.unlockLevel;
                                    // 2) wg mocy ulepszenia malejąco (najmocniejsze wyżej w grupie tego samego poziomu)
                                    const aOn = charEquipped[a.slot]?.id === a.id;
                                    const bOn = charEquipped[b.slot]?.id === b.id;
                                    const aUpg = aOn ? (charEquipped[a.slot]?.upg ?? getItemUpg(a.id)) : getItemUpg(a.id);
                                    const bUpg = bOn ? (charEquipped[b.slot]?.upg ?? getItemUpg(b.id)) : getItemUpg(b.id);
                                    return bUpg - aUpg;
                                  });
                                if (ownedList.length === 0) {
                                  return (
                                    <div className="col-span-5 rounded-xl border border-dashed border-[#8b6a3e]/50 bg-black/20 p-6 text-center">
                                      <p className="text-3xl mb-2 opacity-60">🎒</p>
                                      <p className="text-sm font-bold text-[#dfcfab]">Brak zdobytych przedmiotów</p>
                                      <p className="text-[11px] text-[#8b6a3e] mt-1">Zdobądź przedmioty w Kompostowniku — jest 10% szans na losowy item z Twojego poziomu lub niższego.</p>
                                    </div>
                                  );
                                }
                                return ownedList.map(item => {
                                  const sl = item.slot;
                                  const isOn = charEquipped[sl]?.id === item.id;
                                  const regUpg = getItemUpg(item.id);
                                  const curUpg = isOn ? (charEquipped[sl]?.upg ?? regUpg) : regUpg;
                                  const uc = curUpg > 0 ? (UPG_COLOR[curUpg]??"#6b7280") : "#8b6a3e";
                                  const isDragging = draggedItemId === item.id;
                                  const slotIcon = ({glowa:"👑",dlonie:"🧤",nogi:"👢"} as Record<string,string>)[sl];
                                  return (
                                    <div key={item.id}
                                      draggable
                                      onDragStart={() => setDraggedItemId(item.id)}
                                      onDragEnd={() => setDraggedItemId(null)}
                                      onClick={() => { const nowOn = !isOn; saveCharEquipped({...charEquipped, [sl]: nowOn ? {id:item.id, upg:getItemUpg(item.id)} : null}); setEquippingSlot(nowOn ? sl : null); }}
                                      className={`group relative flex flex-col items-center justify-center aspect-square rounded-xl border transition select-none ${isDragging?"opacity-40 cursor-grabbing":"cursor-pointer hover:brightness-125"}`}
                                      style={{ borderColor:isOn?uc:"#8b6a3e", background:isOn?"rgba(60,40,5,0.55)":"rgba(10,6,2,0.55)", boxShadow:isOn?`0 0 8px ${uc}44`:"none" }}>
                                      <span className="absolute top-1 left-1 text-[8px] opacity-40">{slotIcon}</span>
                                      {item.img
                                        ? <img src={item.img} alt={item.name} className="w-8 h-8 object-contain drop-shadow-md" draggable={false} />
                                        : <span className="text-2xl leading-none">{item.icon}</span>}
                                      <span className="mt-0.5 px-0.5 text-[8px] leading-tight truncate w-full text-center" style={{color:isOn?uc:"#9ca3af"}}>
                                        {item.name.split(" ")[0]}
                                      </span>
                                      {isOn && <span className="absolute top-1 right-1 rounded text-[8px] font-black px-0.5" style={{background:uc+"33",color:uc}}>✓{curUpg>0?` +${curUpg}`:""}</span>}
                                      {!isOn && curUpg>0 && <span className="absolute top-1 right-1 rounded text-[8px] font-black px-0.5" style={{background:uc+"22",color:uc}}>+{curUpg}</span>}
                                      {/* Tooltip */}
                                      <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[999] hidden group-hover:flex flex-col gap-1 min-w-[145px] max-w-[187px] rounded-xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-2.5 py-1.5 shadow-2xl text-left">
                                        <p className="text-[10px] font-black text-[#f9e7b2] leading-tight">{item.icon} {item.name}</p>
                                        <p className="text-[9px] text-[#8b6a3e]">{slotIcon} {EQUIP_SLOT_META[sl].label} · poziom <span className="font-bold text-[#dfcfab]">{item.unlockLevel}</span></p>
                                        <div className="h-px bg-[#8b6a3e]/30 my-0.5" />
                                        <p className="text-[9px] text-cyan-300 font-bold">{bonusLine(item.bonuses, curUpg)}</p>
                                        {curUpg > 0 && <p className="text-[9px] font-black" style={{color:uc}}>Ulepszenie: +{curUpg}</p>}
                                        {isOn && <p className="text-[9px] text-green-400 font-bold">✓ Założone</p>}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                          {/* ═══ EKWIPUNEK DODATKOWY (duplikaty) ═══ */}
                          {(() => {
                            const visibleExtras = (eqFilter
                              ? extraEqItems.filter(e => {
                                  const it = CHAR_EQUIP_ITEMS.find(i => i.id === e.id);
                                  return it && it.slot === eqFilter;
                                })
                              : extraEqItems
                            ).slice().sort((a, b) => {
                              // 1) wg poziomu rosnąco
                              const ia = CHAR_EQUIP_ITEMS.find(i => i.id === a.id);
                              const ib = CHAR_EQUIP_ITEMS.find(i => i.id === b.id);
                              const la = ia?.unlockLevel ?? 0;
                              const lb = ib?.unlockLevel ?? 0;
                              if (la !== lb) return la - lb;
                              // 2) wg mocy ulepszenia malejąco
                              return (b.upg ?? 0) - (a.upg ?? 0);
                            });
                            const handleUpgExtra = async (entry: ExtraEqEntry) => {
                              const nextU = entry.upg + 1;
                              const cost = getUpgradeCost(entry.id, nextU);
                              if (displayMoney < cost) { setMessage({ type:"error", title:"Za mało złota!", text:`Potrzebujesz ${cost.toLocaleString()} 💰` }); return; }
                              if (!profile?.id) return;
                              const { data, error: rpcErr } = await supabase.rpc("game_roll_equipment_upgrade", {
                                p_item_id: entry.id,
                                p_current_upg: entry.upg,
                                p_luck: effectiveStats.szczescie ?? 0,
                              });
                              if (rpcErr) { setMessage({ type:"error", title:"Błąd ulepszenia", text: rpcErr.message }); return; }
                              const response = data as {
                                ok?: boolean; error?: string; item_id?: string; item_name?: string; slot?: string;
                                current_upg?: number; target_upg?: number; new_upg?: number;
                                success?: boolean; cost?: number; chance?: number;
                                materials?: Array<{ mat_id: string; qty: number; have?: number }>;
                                missing_materials?: Array<{ mat_id: string; need: number; have: number }>;
                                barn_items?: BarnItems;
                              } | null;
                              if (response?.ok === false) {
                                if (response.missing_materials && response.missing_materials.length > 0) {
                                  const txt = response.missing_materials.map(m => `${m.mat_id} ${m.have}/${m.need}`).join(", ");
                                  setMessage({ type:"error", title:"Brak materiałów!", text:`Brakuje: ${txt}` });
                                } else {
                                  setMessage({ type:"error", title:"Błąd ulepszenia", text: response.error ?? "Nieznany błąd." });
                                }
                                return;
                              }
                              const fu = response?.new_upg ?? entry.upg;
                              if (response?.barn_items) saveBarnItems(response.barn_items);
                              saveExtraEqItems(extraEqItems.map(e => e.uid === entry.uid ? { ...e, upg: fu } : e));
                              await loadProfile(profile.id);
                              if (response?.success) { setMessage({ type:"success", title:`✨ +${fu} udane!`, text:`Koszt: ${(response.cost ?? cost).toLocaleString()} 💰` }); }
                              else if (fu < entry.upg) { setMessage({ type:"error", title:`⬇ Item cofa się do +${fu}!`, text:"Ulepszenie nie powiodło się." }); }
                              else { setMessage({ type:"error", title:"Nie powiodło się.", text:`Item pozostaje na +${fu}.` }); }
                            };
                            const handleSwapExtra = (entry: ExtraEqEntry) => {
                              const mainUpg = itemUpgRegistry[entry.id] ?? 0;
                              if (mainUpg === entry.upg) return;
                              saveItemUpg({ ...itemUpgRegistry, [entry.id]: entry.upg });
                              saveExtraEqItems(extraEqItems.map(e => e.uid === entry.uid ? { ...e, upg: mainUpg } : e));
                              const it = CHAR_EQUIP_ITEMS.find(i => i.id === entry.id);
                              if (it && charEquipped[it.slot]?.id === entry.id) {
                                saveCharEquipped({ ...charEquipped, [it.slot]: { id: entry.id, upg: entry.upg } });
                              }
                              setMessage({ type:"success", title:"🔄 Zamieniono!", text:`Główny: +${entry.upg} ↔ Dodatkowy: +${mainUpg}` });
                            };
                            return (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-black uppercase tracking-widest text-[#8b6a3e]">📦 Ekwipunek Dodatkowy{eqFilter && <span className="ml-1 text-[#dfcfab]/70">· {({glowa:"👑 Głowa",dlonie:"🧤 Dłonie",nogi:"👢 Nogi"} as Record<string,string>)[eqFilter]}</span>}</p>
                              <p className="text-[10px] text-[#8b6a3e]/80">{visibleExtras.length}{eqFilter ? ` / ${extraEqItems.length}` : ""} {visibleExtras.length === 1 ? "przedmiot" : visibleExtras.length < 5 ? "przedmioty" : "przedmiotów"}</p>
                            </div>
                            {extraEqItems.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[#8b6a3e]/40 bg-black/15 p-4 text-center">
                                <p className="text-[11px] text-[#8b6a3e]">Tutaj trafiają duplikaty przedmiotów. Lepsze ulepszenie zostaje w głównym ekwipunku, słabsze (lub równe) wpada tutaj.</p>
                                <p className="text-[10px] text-[#6b7280] mt-1">Kliknij przedmiot, by go ulepszyć lub zamienić ze sztuką w głównym ekwipunku.</p>
                              </div>
                            ) : visibleExtras.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[#8b6a3e]/40 bg-black/15 p-4 text-center">
                                <p className="text-[11px] text-[#8b6a3e]">Brak duplikatów dla wybranego slotu.</p>
                                <p className="text-[10px] text-[#6b7280] mt-1">Wybierz „Wszystkie" w filtrze powyżej, by zobaczyć całość.</p>
                              </div>
                            ) : (
                              <>
                                {/* Panel akcji wybranego duplikatu */}
                                {selectedExtraUid && (() => {
                                  const entry = extraEqItems.find(e => e.uid === selectedExtraUid);
                                  if (!entry) return null;
                                  const item = CHAR_EQUIP_ITEMS.find(i => i.id === entry.id);
                                  if (!item) return null;
                                  const upg = entry.upg;
                                  const uc = upg > 0 ? (UPG_COLOR[upg] ?? "#6b7280") : "#8b6a3e";
                                  const mainUpg = itemUpgRegistry[item.id] ?? 0;
                                  return (
                                    <div className="mb-2 rounded-xl border border-[#8b6a3e]/50 bg-black/25 px-3 py-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-base">{item.icon}</span>
                                            <p className="text-xs font-bold text-[#f9e7b2] truncate">{item.name}</p>
                                            <span className="text-[11px] font-black px-1.5 rounded" style={{ background:uc+"33", color:uc }}>+{upg}</span>
                                            <span className="text-[10px] text-[#8b6a3e]">vs główny: <span className="font-black text-[#dfcfab]">+{mainUpg}</span></span>
                                          </div>
                                          <p className="text-[10px] text-cyan-300 mt-0.5">{bonusLine(item.bonuses, upg)}</p>
                                          {upg < 10
                                            ? <p className="text-[11px] font-bold text-[#f9e7b2] mt-1">+{upg} → +{upg+1} · {Math.round(UPGRADE_CHANCE[upg+1]*100)}% szansy</p>
                                            : <p className="text-[11px] font-black mt-1" style={{ color:UPG_COLOR[10] }}>✦ MAKS +10 ✦</p>}
                                          {upg > 6 && upg < 10 && <p className="text-[10px] text-red-400">⚠ Fail: cofa do +{upg-1}</p>}
                                        </div>
                                        <div className="flex flex-col gap-1 shrink-0">
                                          {upg < 10 && (() => {
                                            const matsNeeded = getUpgradeMaterials(entry.id, upg+1);
                                            const matsOk = matsNeeded.every(m => (barnItems[m.matId] ?? 0) >= m.qty);
                                            return (
                                            <button type="button" onClick={() => handleUpgExtra(entry)}
                                              disabled={!matsOk}
                                              className="rounded-xl border border-amber-500/60 bg-amber-900/20 px-2 py-1 text-xs font-bold text-amber-300 hover:bg-amber-900/40 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                                              ⚒ {getUpgradeCost(entry.id, upg+1).toLocaleString()} 💰
                                            </button>
                                            );
                                          })()}
                                          {upg < 10 && (() => {
                                            const matsNeeded = getUpgradeMaterials(entry.id, upg+1);
                                            if (matsNeeded.length === 0) return null;
                                            return (
                                              <div className="flex flex-wrap gap-0.5 justify-end">
                                                {matsNeeded.map(m => {
                                                  const md = ANIMAL_ITEMS.find(i => i.id === m.matId);
                                                  const have = barnItems[m.matId] ?? 0;
                                                  const enough = have >= m.qty;
                                                  return (
                                                    <span key={m.matId} className={`text-[9px] font-bold px-1 py-0.5 rounded ${enough ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"}`}>
                                                      {md?.icon ?? "•"}{have}/{m.qty}
                                                    </span>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })()}
                                          <button type="button" onClick={() => handleSwapExtra(entry)}
                                            disabled={mainUpg === upg}
                                            title={mainUpg === upg ? "Identyczne ulepszenia — zamiana bez efektu" : "Przenieś do głównego ekwipunku"}
                                            className="rounded-xl border border-cyan-500/60 bg-cyan-900/20 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                                            🔄 Zamień (+{mainUpg})
                                          </button>
                                          <button type="button" onClick={() => setSelectedExtraUid(null)}
                                            className="rounded-xl border border-[#8b6a3e]/50 px-2 py-1 text-[10px] text-[#dfcfab] hover:bg-white/5">
                                            Zamknij
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                                <div className="grid grid-cols-5 gap-2">
                                  {visibleExtras.map(entry => {
                                    const item = CHAR_EQUIP_ITEMS.find(i => i.id === entry.id);
                                    if (!item) return null;
                                    const uc = entry.upg > 0 ? (UPG_COLOR[entry.upg] ?? "#6b7280") : "#8b6a3e";
                                    const slotIcon = ({glowa:"👑",dlonie:"🧤",nogi:"👢"} as Record<string,string>)[item.slot];
                                    const isSel = selectedExtraUid === entry.uid;
                                    return (
                                      <div key={entry.uid}
                                        onClick={() => setSelectedExtraUid(isSel ? null : entry.uid)}
                                        className="group relative flex flex-col items-center justify-center aspect-square rounded-xl border transition select-none cursor-pointer hover:brightness-125"
                                        style={{ borderColor: isSel ? "#fbbf24" : "#8b6a3e", background: isSel ? "rgba(60,40,5,0.55)" : "rgba(10,6,2,0.55)", boxShadow: isSel ? "0 0 8px rgba(251,191,36,0.55)" : "none", opacity: isSel ? 1 : 0.92 }}>
                                        <span className="absolute top-1 left-1 text-[8px] opacity-40">{slotIcon}</span>
                                        {item.img
                                          ? <img src={item.img} alt={item.name} className="w-8 h-8 object-contain drop-shadow-md" draggable={false} />
                                          : <span className="text-2xl leading-none">{item.icon}</span>}
                                        <span className="mt-0.5 px-0.5 text-[8px] leading-tight truncate w-full text-center" style={{color: isSel ? "#f9e7b2" : "#9ca3af"}}>
                                          {item.name.split(" ")[0]}
                                        </span>
                                        <span className="absolute top-1 right-1 rounded text-[8px] font-black px-0.5" style={{background:uc+"22",color:uc}}>+{entry.upg}</span>
                                        {/* Tooltip */}
                                        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[999] hidden group-hover:flex flex-col gap-1 min-w-[145px] max-w-[187px] rounded-xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-2.5 py-1.5 shadow-2xl text-left">
                                          <p className="text-[10px] font-black text-[#f9e7b2] leading-tight">{item.icon} {item.name}</p>
                                          <p className="text-[9px] text-[#8b6a3e]">{slotIcon} {EQUIP_SLOT_META[item.slot].label} · poziom <span className="font-bold text-[#dfcfab]">{item.unlockLevel}</span></p>
                                          <div className="h-px bg-[#8b6a3e]/30 my-0.5" />
                                          <p className="text-[9px] text-cyan-300 font-bold">{bonusLine(item.bonuses, entry.upg)}</p>
                                          <p className="text-[9px] font-black" style={{color:uc}}>Ulepszenie: +{entry.upg}</p>
                                          <p className="text-[9px] text-[#8b6a3e]/80 italic">Kliknij, by ulepszyć lub zamienić</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ════ PLECAK ════ */}
                  {domTab === "plecak" && (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-2xl font-black text-[#f9e7b2]">🎒 Plecak</p>
                        <button type="button"
                          onClick={() => { setSelectedSeedId(null); setSelectedTool(null); }}
                          className="rounded-full border border-[#8b6a3e] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#dfcfab] transition hover:bg-[rgba(80,58,28,0.65)]">
                          Wyczyść wybór
                        </button>
                      </div>
                      <div className="flex gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1 mb-4">
                        {(["uprawy","owoce","przedmioty"] as const).map(tab => (
                          <button key={tab} type="button" onClick={() => setBackpackTab(tab)}
                            className={`flex-1 rounded-lg py-2 text-sm font-bold uppercase tracking-[0.15em] transition ${backpackTab === tab ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "text-[#dfcfab] hover:bg-white/5"}`}>
                            {tab === "uprawy" ? "🌾 Uprawy" : tab === "przedmioty" ? "🎒 Przedmioty" : "🍎 Owoce"}
                          </button>
                        ))}
                      </div>

                      {backpackTab === "uprawy" && (
                        <>
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-xs text-[#8b6a3e] uppercase tracking-[0.15em] shrink-0">Filtr:</span>
                            <div className="flex flex-1 gap-1 rounded-xl border border-[#8b6a3e]/40 bg-black/30 p-1">
                              {BACKPACK_FILTER_OPTS.map(opt => (
                                <button key={opt.id} type="button" onClick={() => setBackpackSort(opt.id)}
                                  className={`flex-1 rounded-lg py-1 text-[10px] font-bold uppercase tracking-[0.05em] transition ${backpackSort === opt.id ? "bg-[#8b6a3e] text-[#f9e7b2] shadow" : "hover:bg-white/5"}`}
                                  style={backpackSort === opt.id ? undefined : { color: opt.color }}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {(() => {
                            const allCrops = (Object.entries(seedInventory).filter(([k, amount]) => Number(amount) > 0 && !isCompostKey(k) && !isGuideCompostKey(k)) as Array<[string, number]>);
                            const filtered = backpackSort === "all" ? allCrops : allCrops.filter(([k]) => { const q = parseQualityKey(k).quality ?? "good"; return q === backpackSort; });
                            if (allCrops.length === 0) return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Plecak jest pusty.</div>;
                            if (filtered.length === 0) { const fLabel = BACKPACK_FILTER_OPTS.find(o => o.id === backpackSort)?.label ?? ""; return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Brak upraw o jakości „{fLabel}". Zmień filtr.</div>; }
                            const sorted = [...filtered].sort(([aId], [bId]) => {
                              const { baseCropId: aC, quality: aQ } = parseQualityKey(aId);
                              const { baseCropId: bC, quality: bQ } = parseQualityKey(bId);
                              const aLv = CROPS.find(c => c.id === aC)?.unlockLevel ?? 999;
                              const bLv = CROPS.find(c => c.id === bC)?.unlockLevel ?? 999;
                              if (aLv !== bLv) return aLv - bLv;
                              const qOrd: Record<string,number> = {rotten:0,good:1,epic:2,legendary:3};
                              return (qOrd[aQ ?? "good"] ?? 1) - (qOrd[bQ ?? "good"] ?? 1);
                            });
                            return (
                              <div className="grid grid-cols-5 gap-2">
                                {sorted.map(([seedId, amount]) => {
                                  const { baseCropId, quality } = parseQualityKey(seedId);
                                  const crop = CROPS.find(c => c.id === baseCropId);
                                  if (!crop) return null;
                                  const qDef = quality ? CROP_QUALITY_DEFS[quality] : null;
                                  const isRotten = quality === "rotten";
                                  const sprite = quality === "epic" && crop.epicSpritePath ? crop.epicSpritePath : quality === "rotten" && crop.rottenSpritePath ? crop.rottenSpritePath : quality === "legendary" && crop.legendarySpritePath ? crop.legendarySpritePath : crop.spritePath;
                                  return (
                                    <button key={seedId} draggable
                                      onDragStart={() => { setDraggedSeedId(seedId); setSelectedSeedId(seedId); setSelectedTool(null); }}
                                      onDragEnd={() => setDraggedSeedId(null)}
                                      type="button"
                                      onClick={() => { setSelectedSeedId(prev => prev === seedId ? null : seedId); setSelectedTool(null); }}
                                      onMouseEnter={() => { setHoveredCrop(crop); setHoveredSeedQuality(quality as "rotten"|"good"|"epic"|"legendary"|null); }}
                                      onMouseLeave={() => { setHoveredCrop(null); setHoveredSeedQuality(null); }}
                                      className={`group relative flex h-24 w-24 items-center justify-center rounded-xl border transition ${isRotten ? "cursor-not-allowed" : ""}`}
                                      style={selectedSeedId === seedId
                                        ? { borderColor: "#f6d860", background: "rgba(60,40,5,0.4)", boxShadow: "0 0 12px rgba(255,220,120,0.22)" }
                                        : quality === "legendary"
                                          ? { borderColor: qDef!.borderColor, background: qDef!.bgColor, animation: "legendaryPulse 2s ease-in-out infinite" }
                                          : qDef
                                            ? { borderColor: qDef.borderColor, background: qDef.bgColor }
                                            : { borderColor: "#8b6a3e", background: "rgba(20,12,8,0.65)" }}>
                                      <img src={sprite} alt={crop.name} className="absolute inset-0 h-full w-full object-contain rounded-xl" style={{ imageRendering: "pixelated" }} />
                                      {quality === "legendary" && (
                                        <span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
                                          <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} />
                                        </span>
                                      )}
                                      <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{amount}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {backpackTab === "przedmioty" && (
                        <div>
                          {(() => {
                            const ownedAnimals = ANIMAL_ITEMS.filter(it => (barnItems[it.id] ?? 0) > 0);
                            const hasEmptyJars = hiveData.empty_jars > 0;
                            const hasHoneyJars = hiveData.honey_jars > 0;
                            const hasSuit = hiveData.suit_durability > 0;
                            const compostKeys = Object.keys(seedInventory).filter(k => isCompostKey(k) && (seedInventory[k] ?? 0) > 0);
                            const hasAny = ownedAnimals.length > 0 || hasEmptyJars || hasHoneyJars || hasSuit || compostKeys.length > 0;
                            if (!hasAny) return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Plecak jest pusty.</div>;
                            return (
                              <div className="grid grid-cols-5 gap-2">
                                {ownedAnimals.map(it => {
                                  const animal = ANIMALS.find(a => a.itemId === it.id);
                                  const cnt = barnItems[it.id] ?? 0;
                                  return (
                                    <div key={it.id} className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default"
                                      onMouseEnter={() => setCardTip(<><p className="text-[20px] font-black text-[#f9e7b2]">{it.name}</p>{animal && <><p className="text-[18px] text-amber-300 mt-1">{animal.icon}</p><p className="text-[17px] text-[#8b6a3e] mt-0.5">1 zbiór: {animal.prodMs/3600000}h</p></>}</>)}
                                      onMouseLeave={() => setCardTip(null)}>
                                      <div className="relative h-16 w-16 flex items-center justify-center">
                                        <img src={`/przedmioty/item_${it.id}.png`} alt={it.name} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[180%] w-[180%] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}} />
                                      </div>
                                      <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{cnt}</span>
                                    </div>
                                  );
                                })}
                                {hasEmptyJars && (<div className="group relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default"><img src="/przedmioty/jar_empty.png" alt="Słoik" className="h-12 w-12 object-contain" style={{imageRendering:"pixelated"}} /><p className="mt-1 text-center text-[9px] font-bold text-[#dfcfab] leading-tight px-1">Puste słoiki</p><span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{hiveData.empty_jars}</span></div>)}
                                {hasHoneyJars && (<div className="group relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-amber-600/50 bg-[rgba(30,18,5,0.65)] cursor-default"><img src="/przedmioty/jar_honey.png" alt="Miód" className="h-12 w-12 object-contain" style={{imageRendering:"pixelated"}} /><p className="mt-1 text-center text-[9px] font-bold text-amber-300 leading-tight px-1">Miód</p><span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{hiveData.honey_jars}</span></div>)}
                                {hasSuit && (<div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] cursor-default" onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-[#f9e7b2]">Strój pszczelarza</p><p className="text-[11px] text-amber-300 mt-0.5">{hiveData.suit_durability} zbiorów pozostało</p></>)} onMouseLeave={() => setCardTip(null)}><img src="/przedmioty/beekeeper_suit.png" alt="Strój" className="h-10 w-10 object-contain" style={{imageRendering:"pixelated"}} /><p className="mt-0.5 text-center text-[9px] font-bold text-[#dfcfab] leading-tight px-1">Strój</p><div className="mt-0.5 h-1 w-10 rounded-full bg-black/40 overflow-hidden"><div className="h-full rounded-full" style={{ width:`${hiveData.suit_durability}%`, background: hiveData.suit_durability > 30 ? "#22c55e" : "#ef4444" }} /></div></div>)}
                                {compostKeys.sort((a,b) => { const ta = compostTypeFromKey(a) ?? "growth"; const tb = compostTypeFromKey(b) ?? "growth"; const order: Record<CompostType, number> = { growth:0, yield:1, exp:2, guide:3 }; if (order[ta] !== order[tb]) return order[ta] - order[tb]; return compostValueFromKey(a) - compostValueFromKey(b); }).map(cid => {
                                  const cnt = seedInventory[cid]; const t = compostTypeFromKey(cid)!; const def = COMPOST_DEFS[t]; const value = compostValueFromKey(cid);
                                  const tierIdx = def.bonusValues.indexOf(value); const tierColor = compostTierColor(tierIdx); const isSel = selectedSeedId === cid;
                                  return (
                                    <div key={cid} draggable onDragStart={() => { setDraggedSeedId(cid); setSelectedSeedId(cid); setSelectedTool(null); }} onDragEnd={() => setDraggedSeedId(null)}
                                      onClick={() => { setSelectedSeedId(prev => prev === cid ? null : cid); setSelectedTool(null); }}
                                      onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-emerald-200">{def.icon} {def.name} <span style={{color: tierColor}}>({def.tierName(value)})</span></p><p className="text-[10px] text-emerald-300/80 mt-0.5">{def.desc}</p><p className="text-[11px] font-black mt-1" style={{color: tierColor}}>Bonus: {def.bonusLabel(value)}</p></>)}
                                      onMouseLeave={() => setCardTip(null)}
                                      className="relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border cursor-pointer transition"
                                      style={isSel ? { borderColor: tierColor, background: "rgba(60,40,5,0.4)", boxShadow: `0 0 12px ${tierColor}66` } : { borderColor: "rgba(6,95,70,0.5)", background: "rgba(6,78,59,0.3)" }}>
                                      <span className="text-4xl leading-none">{def.icon}</span>
                                      <p className="mt-0.5 text-center text-[9px] font-bold leading-tight px-1" style={{color: tierColor}}>{def.tierName(value)}</p>
                                      {isSel && <p className="text-[8px] font-black text-amber-300">✓ zaznaczony</p>}
                                      <span className="absolute bottom-2 right-2 min-w-[18px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">×{cnt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {backpackTab === "owoce" && (() => {
                        const entries = Object.entries(fruitInventory).filter(([,c]) => Number(c) > 0);
                        if (entries.length === 0) return <div className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.55)] p-3 text-sm text-[#dfcfab]">Plecak jest pusty.</div>;
                        const _qOrd: Record<string, number> = { zgnile: 0, zwykly: 1, soczysty: 2, zloty: 3 };
                        const sorted = [...entries].sort(([aKey], [bKey]) => {
                          const aU = aKey.lastIndexOf("_"); const aFid = aKey.slice(0, aU); const aQ = aKey.slice(aU + 1);
                          const bU = bKey.lastIndexOf("_"); const bFid = bKey.slice(0, bU); const bQ = bKey.slice(bU + 1);
                          const aLv = TREES.find(t => t.fruitId === aFid)?.unlockLevel ?? 999;
                          const bLv = TREES.find(t => t.fruitId === bFid)?.unlockLevel ?? 999;
                          if (aLv !== bLv) return aLv - bLv;
                          return (_qOrd[aQ] ?? 0) - (_qOrd[bQ] ?? 0);
                        });
                        return (
                          <div className="grid grid-cols-5 gap-2">
                            {sorted.map(([key, cnt]) => {
                              const lastU = key.lastIndexOf("_"); const fid = key.slice(0, lastU); const q = key.slice(lastU + 1) as FruitQuality;
                              const tree = TREES.find(t => t.fruitId === fid); if (!tree) return null;
                              const isZgnile = q === "zgnile";
                              const qLabel = isZgnile ? "Zgniłe" : q === "zwykly" ? "Zwykłe" : q === "soczysty" ? "Soczysty" : "Złote";
                              const borderColor = isZgnile ? "#ffffff" : q === "zwykly" ? "#ffffff" : q === "soczysty" ? "#22c55e" : "#f59e0b";
                              const bgColor = isZgnile ? "rgba(255,255,255,0.05)" : q === "zwykly" ? "rgba(255,255,255,0.05)" : q === "soczysty" ? "rgba(20,80,30,0.5)" : "rgba(80,50,5,0.5)";
                              const labelColor = isZgnile ? "#ffffff" : q === "zwykly" ? "#dfcfab" : q === "soczysty" ? "#22c55e" : "#f59e0b";
                              return (
                                <div key={key} className={`relative flex h-24 w-24 flex-col items-center justify-center rounded-xl border ${isZgnile ? "cursor-not-allowed" : "cursor-default"}`}
                                  style={{ borderColor, background: bgColor, ...(q === "zloty" ? { animation: "legendaryPulse 2s ease-in-out infinite" } : {}) }}
                                  onMouseEnter={() => setCardTip(<><p className="text-xs font-black text-[#f9e7b2]">{tree.fruitIcon} {tree.fruitName}</p><p className="text-[11px] mt-0.5" style={{color: labelColor}}>{qLabel}</p><p className="text-[10px] text-[#8b6a3e] mt-0.5">Masz: {Number(cnt)} szt.</p>{isZgnile && <p className="text-[10px] text-amber-400 mt-0.5 font-bold">Nie do sprzedaży — wrzuć do kompostu</p>}</>)}
                                  onMouseLeave={() => setCardTip(null)}>
                                  {isZgnile && <span className="absolute top-1 left-1 text-[10px] leading-none">⚠️</span>}
                                  {q === "zloty" && (<span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden"><span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animation: "legendaryShimmer 2.4s ease-in-out infinite" }} /></span>)}
                                  <div className="relative h-16 w-16 flex items-center justify-center">
                                    <span className="text-4xl leading-none">{tree.fruitIcon}</span>
                                    <img src={`/owoce/owoc_${fid}.png`} alt={tree.fruitName} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[180%] w-[180%] object-contain" style={{imageRendering:"pixelated"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}} />
                                  </div>
                                  <p className="mt-0.5 text-center text-[9px] font-bold leading-tight px-1" style={{color: labelColor}}>{qLabel}</p>
                                  <span className="absolute bottom-1 right-1 min-w-[16px] rounded-md bg-black/80 px-1 py-0.5 text-xs font-black leading-none text-[#f9e7b2]">{Number(cnt)}</span>
                                </div>
                              );
                            })}
                            <p className="col-span-5 mt-1 text-[10px] text-[#8b6a3e] text-center">Sprzedasz owoce w Sadzie (przycisk „Sprzedaj wszystkie"). Zgniłe idą do kompostu.</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* ═══ KOMPOSTOWNIK MODAL ═══ */}
          {showKompostModal && (() => {
            const batch = kompostBatch;
            const isReady = batch.fill >= KOMPOST_BATCH_SIZE;
            const fillPct = Math.min(100, (batch.fill / KOMPOST_BATCH_SIZE) * 100);
            const currentScore = batch.fill > 0 ? batch.scoreSum / batch.fill : 0;
            const currentQuality = getCompostQualityFromScore(currentScore);
            const currentQualityDef = getCompostQualityDef(currentQuality);
            const batchFull = isReady;
            const milestoneGlow = batch.fill >= 75 ? "#fbbf24" : batch.fill >= 50 ? "#a78bfa" : batch.fill >= 25 ? "#22c55e" : null;
            const diversityCountUI = (batch.cropIds ?? []).length;
            const diversityItemBonusUI = Math.min(5, Math.floor(diversityCountUI / 2));
            const diversityTierBoostUI = diversityCountUI >= 6;
            const _luckItemBonusUI = Math.min(5, (effectiveStats.szczescie ?? 0) * 0.05);
            const itemDropChancePct = parseFloat((10 + diversityItemBonusUI + _luckItemBonusUI).toFixed(1));
            const currentTierChances = ITEM_TIER_BY_QUALITY[currentQuality];
            const QTY_OPTIONS: Array<1|5|10|100|"max"> = [1,5,10,100,"max"];
            const FILTER_OPTIONS: Array<{ id: typeof kompostFilter; label: string; color: string }> = [
              { id:"rotten",    label:"Popsute",     color:"#ffffff" },
              { id:"good",      label:"Standardowe", color:"#dfcfab" },
              { id:"epic",      label:"Epickie",     color:"#a78bfa" },
              { id:"legendary", label:"Legendarne",  color:"#fbbf24" },
              { id:"all",       label:"Wszystkie",   color:"#6ee7b7" },
            ];
            return (
              <div className="fixed inset-0 z-[300] flex gap-3 overflow-hidden bg-[rgba(14,8,4,0.99)] p-3">
                {/* Panel historii */}
                <div className="flex flex-col items-stretch gap-2 pt-0" style={{ width: 290, flexShrink: 0 }}>
                  <button
                    onClick={() => setShowKompostHistory(v => !v)}
                    className="flex items-center gap-2 rounded-xl border border-[#8b6a3e]/60 bg-[rgba(14,8,4,0.95)] px-4 py-2.5 text-[20px] font-black text-[#dfcfab] shadow-lg hover:border-[#dfcfab]/50 transition">
                    📜 Ostatnie nagrody
                    {kompostDropHistory.length > 0 && <span className="rounded-full bg-[#8b6a3e] px-2 text-[18px] text-white">{kompostDropHistory.reduce((s, e) => s + e.count, 0)}</span>}
                    <span className="ml-auto opacity-50 text-[18px]">{showKompostHistory ? "▲" : "▼"}</span>
                  </button>
                  {showKompostHistory && (
                    <div className="w-full rounded-xl border border-[#8b6a3e]/50 bg-[rgba(14,8,4,0.97)] p-4 shadow-xl">
                      {kompostDropHistory.length === 0
                        ? <p className="text-[18px] text-[#8b6a3e]/60 italic">Brak historii w tej sesji.</p>
                        : <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                            {kompostDropHistory.map((h, i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <p className="text-[20px] font-bold leading-snug truncate" style={{ color: h.color }}>{h.icon} {h.label}</p>
                                {h.count > 1 && <span className="shrink-0 rounded-full bg-white/10 px-2 text-[18px] font-black" style={{ color: h.color }}>x{h.count}</span>}
                              </div>
                            ))}
                          </div>
                      }
                    </div>
                  )}
                </div>
                <div
                  className="relative flex-1 min-w-0 h-full overflow-hidden bg-[rgba(14,8,4,0.98)] flex flex-col transition-all duration-700"
                  style={milestoneGlow ? { boxShadow: `0 0 50px ${milestoneGlow}55, 0 0 100px ${milestoneGlow}22` } : undefined}>
                  <button onClick={() => { setShowKompostModal(false); setKompostRewards(null); setShowKompostHelp(false); }} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300">✕</button>
                  {/* Przycisk pomocy ? */}
                  <button
                    onMouseEnter={() => setShowKompostHelp(true)}
                    onMouseLeave={() => setShowKompostHelp(false)}
                    className="absolute right-16 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#8b6a3e] font-black text-[16px] transition hover:border-emerald-500/60 hover:text-emerald-300 select-none">
                    ?
                  </button>
                  {showKompostHelp && (
                    <div className="absolute right-14 top-14 z-50 w-[480px] rounded-2xl border border-[#8b6a3e]/60 bg-[rgba(10,6,2,0.98)] p-5 shadow-2xl text-[#dfcfab] pointer-events-none"
                      style={{ boxShadow: "0 0 40px rgba(34,197,94,0.15)" }}>
                      <p className="text-[14px] font-black text-emerald-300 mb-3">🌿 Jak działa Kompostownik?</p>

                      {/* Zasady */}
                      <div className="text-[12px] text-[#dfcfab]/90 leading-relaxed mb-3 flex flex-col gap-1">
                        <p>• Wrzuć <span className="font-black text-white">100 upraw lub zgniłych owoców</span> aby zapełnić partię.</p>
                        <p>• Im lepsze wrzutki, tym wyższy <span className="font-black text-amber-300">score</span> partii = lepsze nagrody.</p>
                        <p>• Za pełną partię losowane jest <span className="font-black text-yellow-300">5 nagród</span> jednocześnie.</p>
                        <p>• <span className="font-black text-purple-300">Różnorodność</span> gatunków w jednej partii zwiększa szansę na ekwipunek (+1% co 2 gatunki, maks +5%; 6+ gatunków = bonus tier).</p>
                        <p>• <span className="font-black text-yellow-300">Jackpot 0.5%</span> per losowanie — legendarny item niezależnie od jakości.</p>
                      </div>

                      {/* Tabela rzadkości */}
                      <p className="text-[11px] font-black text-[#8b6a3e]/80 uppercase tracking-wider mb-1.5">Mnożnik rzadkości wrzutu</p>
                      <div className="grid grid-cols-4 gap-1 mb-3 text-center">
                        {([["🟫 Zgniłe","×0.25","#9ca3af"],["🟢 Dobre","×1.0","#86efac"],["🟣 Epickie","×2.5","#c4b5fd"],["🌟 Legendarne","×5.0","#fbbf24"]] as const).map(([label, mult, color]) => (
                          <div key={label} className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
                            <p className="text-[11px] font-bold leading-tight" style={{ color }}>{label}</p>
                            <p className="text-[14px] font-black mt-0.5" style={{ color }}>{mult}</p>
                          </div>
                        ))}
                      </div>

                      {/* Tabela upraw - przykładowe */}
                      <p className="text-[11px] font-black text-[#8b6a3e]/80 uppercase tracking-wider mb-1.5">Score upraw (dobre × mnożnik)</p>
                      <div className="grid grid-cols-5 gap-x-2 gap-y-0.5 text-[11px] mb-3">
                        <span className="font-black text-[#8b6a3e]/70">Uprawa</span>
                        <span className="font-black text-[#9ca3af] text-center">Zgn.</span>
                        <span className="font-black text-[#86efac] text-center">Dob.</span>
                        <span className="font-black text-[#c4b5fd] text-center">Epic</span>
                        <span className="font-black text-[#fbbf24] text-center">Leg.</span>
                        {([
                          ["🥕 Marchew",  "0.25","1.0","2.5","5.0"],
                          ["🧅 Cebula",   "0.45","1.8","4.5","9.0"],
                          ["🧄 Czosnek",  "0.50","2.0","5.0","10.0"],
                          ["🫑 Papryka",  "0.70","2.8","7.0","14.0"],
                          ["🍓 Truskaw.", "0.90","3.6","9.0","18.0"],
                          ["🍇 Winog.",   "1.20","4.8","12.0","24.0"],
                          ["🌻 Słonecz.", "1.35","5.4","13.5","27.0"],
                          ["🌿 Szparagi", "1.50","6.0","15.0","30.0"],
                        ] as const).map(([name, a, b, c, d]) => (
                          <React.Fragment key={name}>
                            <span className="text-[#dfcfab]/80 truncate">{name}</span>
                            <span className="text-center text-[#9ca3af]">{a}</span>
                            <span className="text-center text-[#86efac]">{b}</span>
                            <span className="text-center text-[#c4b5fd]">{c}</span>
                            <span className="text-center text-[#fbbf24]">{d}</span>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Tabela owoców */}
                      <p className="text-[11px] font-black text-[#8b6a3e]/80 uppercase tracking-wider mb-1.5">Score zgniłych owoców (cena × 0.25)</p>
                      <div className="grid grid-cols-3 gap-1 text-[11px]">
                        {([
                          ["🍎 Jabłko","5.0"],["🍐 Gruszka","8.75"],["🟣 Śliwka","13.75"],
                          ["🍒 Wiśnia","20.0"],["🍑 Brzoskw.","37.5"],["🍊 Pomarań.","80.0"],
                          ["🍋 Cytryna","125.0"],
                        ] as const).map(([name, score]) => (
                          <div key={name} className="flex justify-between rounded bg-white/5 px-2 py-0.5">
                            <span className="text-[#dfcfab]/80">{name}</span>
                            <span className="font-black text-emerald-300">{score}</span>
                          </div>
                        ))}
                      </div>

                      {/* Progi jakości */}
                      <p className="text-[11px] font-black text-[#8b6a3e]/80 uppercase tracking-wider mt-3 mb-1.5">Progi jakości partii (avg score)</p>
                      <div className="flex gap-2 flex-wrap text-[11px]">
                        {([["🌟 Leg.","≥15","#fbbf24"],["🟣 B.dobry","≥9","#a78bfa"],["🟢 Dobry","≥5","#6ee7b7"],["⚪ Słaby","<5","#9ca3af"]] as const).map(([label, val, color]) => (
                          <div key={label} className="rounded-lg border px-2.5 py-1 bg-white/5" style={{ borderColor: color + "60" }}>
                            <span className="font-black" style={{ color }}>{label}</span>
                            <span className="ml-1.5 text-[#dfcfab]/60">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-6 pt-6 pb-4 border-b border-[#8b6a3e]/30">
                    {/* Nagłówek */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-4xl">🌿</span>
                      <div className="flex-1">
                        <h2 className="text-2xl font-black text-[#dfcfab]">Kompostownik</h2>
                        <p className="text-sm font-bold text-[#8b6a3e] mt-0.5">Zapełnij partię 100 wrzutami — im lepsze uprawy, tym silniejsze nagrody. Za każdą pełną partię: 5 nagród.</p>
                      </div>
                    </div>

                    {/* ── Wielki pasek postępu ── */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-black text-[#dfcfab]">Partia</span>
                        <span className="font-black text-[#dfcfab]">{batch.fill} / {KOMPOST_BATCH_SIZE}</span>
                      </div>
                      <div
                        className="relative h-7 rounded-full bg-black/50 border border-[#8b6a3e]/40 overflow-hidden"
                        style={milestoneGlow ? { boxShadow: `inset 0 0 16px ${milestoneGlow}44` } : undefined}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${fillPct}%`,
                            background: isReady
                              ? `linear-gradient(to right, #f59e0b, #fbbf24, #fde68a)`
                              : batch.fill >= 75 ? `linear-gradient(to right, #a78bfa, #fbbf24)`
                              : batch.fill >= 50 ? `linear-gradient(to right, #22c55e, #a78bfa)`
                              : batch.fill >= 25 ? `linear-gradient(to right, #166534, #22c55e)`
                              : `linear-gradient(to right, ${currentQualityDef.border}, ${currentQualityDef.color})`,
                          }} />
                        {/* Milestone ticks */}
                        {[25, 50, 75].map(m => (
                          <div key={m} className="absolute top-0 bottom-0 w-px" style={{ left: `${m}%`, background: batch.fill >= m ? "rgba(255,255,255,0.6)" : "rgba(139,106,62,0.4)" }} />
                        ))}
                        {isReady && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[13px] font-black text-white drop-shadow-lg tracking-wide">✨ GOTOWA DO ODBIORU!</span>
                          </div>
                        )}
                      </div>
                      {/* Milestone labels */}
                      <div className="flex justify-between text-[12px] font-bold mt-1 px-0.5">
                        <span className="text-[#8b6a3e]/60">0</span>
                        <span style={{ color: batch.fill >= 25 ? "#22c55e" : "#8b6a3e99" }}>25 🟢</span>
                        <span style={{ color: batch.fill >= 50 ? "#a78bfa" : "#8b6a3e99" }}>50 🟣</span>
                        <span style={{ color: batch.fill >= 75 ? "#fbbf24" : "#8b6a3e99" }}>75 🟡</span>
                        <span style={{ color: isReady ? "#fbbf24" : "#8b6a3e99" }}>100 ✨</span>
                      </div>
                    </div>

                    {/* Jakość + statystyki */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 rounded-xl border bg-black/20 px-3 py-2" style={{ borderColor: currentQualityDef.border + "60" }}>
                        <span className="text-[11px] font-bold text-[#8b6a3e]/80 uppercase tracking-wider block mb-0.5">Jakość partii</span>
                        <span className="text-[15px] font-black" style={{ color: currentQualityDef.color }}>{batch.fill > 0 ? currentQualityDef.label : "—"}</span>
                      </div>
                      <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2 text-center">
                        <span className="text-[11px] font-bold text-[#8b6a3e]/80 uppercase tracking-wider block mb-0.5">Moc</span>
                        <span className="text-[15px] font-black text-[#dfcfab]">{batch.fill > 0 ? currentScore.toFixed(1) : "—"}</span>
                      </div>
                      <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2 text-center">
                        <span className="text-[11px] font-bold text-[#8b6a3e]/80 uppercase tracking-wider block mb-0.5">Gatunki</span>
                        <span className="text-[15px] font-black" style={{ color: diversityCountUI >= 6 ? "#a78bfa" : diversityCountUI >= 2 ? "#22c55e" : "#8b6a3e" }}>{diversityCountUI}/10</span>
                      </div>
                      <div className="rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-3 py-2 text-center">
                        <span className="text-[11px] font-bold text-[#8b6a3e]/80 uppercase tracking-wider block mb-0.5">Szansa item</span>
                        <span className="text-[15px] font-black text-amber-300">{itemDropChancePct}%</span>
                      </div>
                    </div>

                    {/* Prognoza nagród — 3 sekcje */}
                    <div className="mb-3 rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-3 pt-3 pb-2 flex flex-col gap-2">
                      <p className="text-[12px] font-black text-[#dfcfab]/80 uppercase tracking-wider">Możliwe nagrody <span className="normal-case font-bold text-[#8b6a3e]">(per losowanie, 5 losowań na partię)</span></p>

                      {/* Blok 1 — Kompost */}
                      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[15px]">🌱</span>
                          <span className="text-[15px] font-black text-emerald-300">Kompost</span>
                          <span className="ml-auto text-[17px] font-black text-emerald-300">{100 - itemDropChancePct}%</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(["growth","yield","exp"] as const).map(ct => {
                            const cTierIdx = COMPOST_TIER_FIXED_BY_QUALITY[currentQuality];
                            const cColor = cTierIdx === 0 ? "#9ca3af" : cTierIdx === 1 ? "#22c55e" : "#a78bfa";
                            return <span key={ct} className="text-[13px] font-black" style={{ color: cColor }}>{COMPOST_DEFS[ct].icon} {COMPOST_DEFS[ct].tierName(COMPOST_DEFS[ct].bonusValues[cTierIdx])}</span>;
                          })}
                          {diversityTierBoostUI && <span className="text-[12px] text-purple-400 font-black">· +tier boost (6+ gatunków)</span>}
                        </div>
                      </div>

                      {/* Blok 2 — Ekwipunek */}
                      <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[15px]">⚔️</span>
                          <span className="text-[15px] font-black text-amber-300">Ekwipunek</span>
                          <span className="ml-auto text-[17px] font-black text-amber-300">{itemDropChancePct}%</span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {currentTierChances.map((chance, i) => chance > 0 && (
                            <div
                              key={i}
                              className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 cursor-help hover:scale-105 transition"
                              style={{ background: `${ITEM_TIER_RARITY[i].border}18`, border: `1px solid ${ITEM_TIER_RARITY[i].border}70`, boxShadow: `0 0 6px ${ITEM_TIER_RARITY[i].shadow}` }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const minLvl = i * 5 + 1; const maxLvl = i * 5 + 5;
                                const tierItems = CHAR_EQUIP_ITEMS.filter(it => it.unlockLevel >= minLvl && it.unlockLevel <= maxLvl);
                                const rarity = ITEM_TIER_RARITY[i];
                                const tipNode = (
                                  <>
                                    <p className="text-[15px] font-black mb-2" style={{ color: rarity.border }}>{rarity.dot} I{i+1} — {rarity.label} (lvl {minLvl}–{maxLvl})</p>
                                    <p className="text-[12px] font-bold text-[#8b6a3e]/70 mb-1.5 uppercase tracking-wider">Mozliwe nagrody ({tierItems.length}):</p>
                                    <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 320 }}>
                                      {tierItems.map(it => (<p key={it.id} className="text-[13px] text-[#dfcfab] leading-snug">{it.icon} {it.name}</p>))}
                                    </div>
                                  </>
                                );
                                const _tc0 = toGameCoords(rect.left + rect.width / 2, rect.bottom);
                                setKompostTierHoverTip({ x: _tc0.x, y: _tc0.y, node: tipNode, color: rarity.border });
                              }}
                              onMouseLeave={() => setKompostTierHoverTip(null)}>
                              <span className="text-[16px] leading-none">{ITEM_TIER_RARITY[i].dot}</span>
                              <span className="text-[14px] font-black" style={{ color: ITEM_TIER_RARITY[i].border }}>{chance}%</span>
                              <span className="text-[11px] font-bold" style={{ color: ITEM_TIER_RARITY[i].border }}>{ITEM_TIER_RARITY[i].label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Blok 3 — Jackpot */}
                      <div className="rounded-lg border border-yellow-600/40 bg-yellow-950/30 px-3 py-2 flex items-center gap-2">
                        <span className="text-[15px]">✨</span>
                        <span className="text-[15px] font-black text-yellow-300">Jackpot</span>
                        <span className="text-[12px] font-bold text-yellow-200/70 flex-1">— legendarny item (niezależnie od jakości partii)</span>
                        <span className="text-[17px] font-black text-yellow-300">{JACKPOT_CHANCE}%</span>
                      </div>
                    </div>

                    {/* Przycisk odbioru */}
                    <button
                      onClick={() => { if (isReady) void claimKompostReward(); }}
                      disabled={!isReady}
                      className={`w-full rounded-2xl border-2 px-6 py-3 text-base font-black transition shadow-lg ${
                        isReady
                          ? "border-yellow-400/80 bg-gradient-to-r from-yellow-600 to-amber-500 text-white hover:scale-[1.02] shadow-yellow-500/30 animate-pulse cursor-pointer"
                          : "border-[#8b6a3e]/30 bg-black/30 text-[#8b6a3e]/40 shadow-none cursor-not-allowed"
                      }`}>
                      {isReady
                        ? `🎲 Odbierz 5 nagród! (partia gotowa)`
                        : `🎲 Jeszcze ${KOMPOST_BATCH_SIZE - batch.fill} wrzutów do odbioru`}
                    </button>
                  </div>

                  {/* Sticky controls — pasek ilości + filtr (NIE scrolluje się z uprawami) */}
                  <div className="px-6 pt-3 pb-2 border-b border-[#8b6a3e]/30 bg-[rgba(14,8,4,0.85)]">
                    {/* Wybór ilości */}
                    <div className="mb-2">
                      <p className="text-[11px] text-[#8b6a3e] mb-1">Ilość przy kliknięciu:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {QTY_OPTIONS.map(q => (
                          <button
                            key={String(q)}
                            onClick={() => setKompostQty(q)}
                            className={`px-3 py-1 rounded-lg text-xs font-black border transition ${kompostQty === q ? "border-yellow-400/60 bg-yellow-500/20 text-yellow-200" : "border-[#8b6a3e]/40 bg-black/20 text-[#dfcfab] hover:border-[#dfcfab]/40"}`}>
                            {q === "max" ? "Max" : q}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Filtr jakości */}
                    <div>
                      <p className="text-[11px] text-[#8b6a3e] mb-1">Filtruj uprawy:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {FILTER_OPTIONS.map(f => (
                          <button
                            key={f.id}
                            onClick={() => setKompostFilter(f.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-black border transition ${kompostFilter === f.id ? "bg-yellow-500/20 text-yellow-200" : "bg-black/20 text-[#dfcfab] hover:bg-[#8b6a3e]/20"}`}
                            style={{ borderColor: kompostFilter === f.id ? f.color : "rgba(139,106,62,0.4)" }}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {/* Siatka upraw */}
                    {(() => {
                      let cropEntries = (Object.entries(seedInventory).filter(
                        ([k, amt]) => Number(amt) > 0 && !isCompostKey(k)
                      ) as Array<[string, number]>);
                      if (kompostFilter !== "all") {
                        cropEntries = cropEntries.filter(([k]) => parseQualityKey(k).quality === kompostFilter);
                      }
                      if (cropEntries.length === 0) {
                        return (
                          <div className="rounded-2xl border border-dashed border-[#8b6a3e]/40 bg-black/20 p-8 text-center">
                            <p className="text-4xl mb-3">🥕</p>
                            <p className="text-sm font-bold text-[#dfcfab]">{kompostFilter === "all" ? "Brak upraw do kompostowania" : `Brak upraw z filtrem „${FILTER_OPTIONS.find(f=>f.id===kompostFilter)?.label}"`}</p>
                            <p className="text-[11px] text-[#8b6a3e]/70 mt-1">Zmień filtr lub zbierz uprawy z pola.</p>
                          </div>
                        );
                      }
                      const sorted = [...cropEntries].sort(([aId], [bId]) => {
                        const a = parseQualityKey(aId);
                        const b = parseQualityKey(bId);
                        const aLv = CROPS.find(c => c.id === a.baseCropId)?.unlockLevel ?? 999;
                        const bLv = CROPS.find(c => c.id === b.baseCropId)?.unlockLevel ?? 999;
                        return aLv !== bLv ? aLv - bLv : (a.quality ?? "").localeCompare(b.quality ?? "");
                      });
                      return (
                        <div className="grid grid-cols-5 gap-2">
                          {sorted.map(([seedKey, amount]) => {
                            const { baseCropId, quality } = parseQualityKey(seedKey);
                            const crop = CROPS.find(c => c.id === baseCropId);
                            if (!crop) return null;
                            const qDef = quality ? CROP_QUALITY_DEFS[quality] : null;
                            const sprite = quality === "epic" && crop.epicSpritePath ? crop.epicSpritePath
                              : quality === "rotten" && crop.rottenSpritePath ? crop.rottenSpritePath
                              : quality === "legendary" && crop.legendarySpritePath ? crop.legendarySpritePath
                              : crop.spritePath;
                            const qty = kompostQty === "max" ? amount : Math.min(kompostQty, amount);
                            return (
                              <button
                                key={seedKey}
                                onClick={() => void depositCropToCompost(seedKey, qty)}
                                disabled={batchFull}
                                title={batchFull ? "Partia pełna — odbierz nagrody" : `Wrzuć ${qty} szt.`}
                                className="group relative flex flex-col items-center justify-center aspect-square rounded-xl border border-[#8b6a3e]/50 bg-black/30 hover:border-[#dfcfab]/60 hover:bg-[#8b6a3e]/20 hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed p-1"
                                style={qDef ? { borderColor: qDef.borderColor + "88" } : undefined}>
                                {sprite ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={sprite} alt={crop.name} className="w-24 h-24 object-contain" />
                                ) : (
                                  <span className="text-5xl">🌱</span>
                                )}
                                <span className="mt-0.5 text-[10px] font-bold text-[#dfcfab] truncate w-full text-center">{crop.name}</span>
                                {qDef && <span className="text-[9px] font-black" style={{ color: qDef.borderColor }}>{qDef.label}</span>}
                                <span className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[10px] font-black text-[#dfcfab]">×{amount}</span>
                                <span className="absolute bottom-1 right-1 rounded bg-[#8b6a3e]/80 px-1 text-[9px] font-black text-white">+{qty}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Zgniłe owoce */}
                    {(() => {
                      const zgnileEntries = (Object.entries(fruitInventory).filter(
                        ([k, amt]) => Number(amt) > 0 && k.endsWith("_zgnile")
                      ) as Array<[string, number]>);
                      if (zgnileEntries.length === 0) return null;
                      const sortedFruits = [...zgnileEntries].sort(([aKey], [bKey]) => {
                        const aFid = aKey.slice(0, aKey.lastIndexOf("_"));
                        const bFid = bKey.slice(0, bKey.lastIndexOf("_"));
                        const aLv = TREES.find(t => t.fruitId === aFid)?.unlockLevel ?? 999;
                        const bLv = TREES.find(t => t.fruitId === bFid)?.unlockLevel ?? 999;
                        return aLv - bLv;
                      });
                      return (
                        <div className="mt-4">
                          <p className="text-[11px] font-bold text-gray-400 mb-2">🍂 Zgniłe owoce (nie do sprzedaży)</p>
                          <div className="grid grid-cols-5 gap-2">
                            {sortedFruits.map(([fruitKey, amount]) => {
                              const fid = fruitKey.slice(0, fruitKey.lastIndexOf("_"));
                              const tree = TREES.find(t => t.fruitId === fid);
                              if (!tree) return null;
                              const qty = kompostQty === "max" ? amount : Math.min(kompostQty, amount);
                              return (
                                <button
                                  key={fruitKey}
                                  onClick={() => void depositFruitToCompost(fruitKey, qty)}
                                  disabled={batchFull}
                                  title={batchFull ? "Partia pełna — odbierz nagrody" : `Wrzuć ${qty} szt.`}
                                  className="group relative flex flex-col items-center justify-center aspect-square rounded-xl border border-white/40 bg-white/5 hover:border-white/70 hover:bg-white/10 hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed p-1">
                                  <span className="text-5xl">{tree.fruitIcon}</span>
                                  <span className="mt-0.5 text-[10px] font-bold text-white truncate w-full text-center">{tree.fruitName}</span>
                                  <span className="text-[9px] font-black text-white">Zgniłe</span>
                                  <span className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[10px] font-black text-gray-300">×{amount}</span>
                                  <span className="absolute bottom-1 right-1 rounded bg-gray-700/80 px-1 text-[9px] font-black text-white">+{qty}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="px-6 py-3 border-t border-[#8b6a3e]/30 text-center">
                    <p className="text-[11px] text-[#8b6a3e]/70">
                      Rodzaje kompostu: ⚡ Wzrost (-5/10/15% czasu) · 🌾 Urodzaj (+1/2/3 plon) · ⭐ Nauka (+10/20/30% EXP)
                    </p>
                  </div>
                </div>

                {/* Panel nagród (overlay) */}
                {kompostRewards && (
                  <div className="absolute inset-0 z-[10] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-[720px] max-h-[88vh] overflow-hidden rounded-[24px] border-2 border-[#8b6a3e] bg-[rgba(14,8,4,0.98)] shadow-2xl flex flex-col">
                      <div className="px-6 pt-5 pb-3 border-b border-[#8b6a3e]/30 text-center">
                        <div className="text-5xl mb-2">🎁</div>
                        <h3 className="text-[32px] font-black text-[#dfcfab]">Zdobyłeś {kompostRewards.length} {kompostRewards.length === 1 ? "nagrodę" : kompostRewards.length < 5 ? "nagrody" : "nagród"}!</h3>
                        <p className="text-[16px] text-[#8b6a3e] mt-1">Najedź na nagrodę, aby zobaczyć szczegóły.</p>
                      </div>
                      <div className="flex-1 overflow-y-auto px-6 py-4">
                        {(() => {
                          const grouped = new Map<string, { entry: KompostRewardEntry; count: number }>();
                          for (const r of kompostRewards) {
                            const key = r.kind === "item" ? `i:${r.itemId}` : `c:${r.compostType}:${r.value}`;
                            const ex = grouped.get(key);
                            if (ex) ex.count++; else grouped.set(key, { entry: r, count: 1 });
                          }
                          return (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                              {Array.from(grouped.values()).map((g, i) => {
                                const r = g.entry;
                                if (r.kind === "item") {
                                  const it = CHAR_EQUIP_ITEMS.find(x => x.id === r.itemId);
                                  const itemTierIdx = it ? Math.min(4, Math.floor((it.unlockLevel - 1) / 5)) : 0;
                                  const rarityDef = ITEM_TIER_RARITY[itemTierIdx];
                                  const tipNode = (
                                    <>
                                      <p className="text-[17px] font-black" style={{ color: rarityDef.border }}>Przedmiot — {rarityDef.label}</p>
                                      <p className="text-[15px] font-bold text-amber-100">{r.itemIcon} {r.itemName}</p>
                                      {it && <p className="text-[14px] text-amber-300/80">Poziom: {it.unlockLevel} · Slot: {EQUIP_SLOT_META[it.slot]?.label}</p>}
                                      {it && <p className="text-[14px] text-cyan-300">{bonusLine(it.bonuses, 0)}</p>}
                                      <p className="text-[14px] text-emerald-300 mt-1">Trafil do Twojego ekwipunku</p>
                                    </>
                                  );
                                  const showTip = (e: React.MouseEvent<HTMLDivElement>) => {
                                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                    const _tc1 = toGameCoords(rect.left + rect.width / 2, rect.top);
                                  setKompostHoverTip({ x: _tc1.x, y: _tc1.y, node: tipNode, color: rarityDef.border });
                                  };
                                  return (
                                    <div
                                      key={i}
                                      onMouseEnter={showTip}
                                      onMouseMove={showTip}
                                      onMouseLeave={() => setKompostHoverTip(null)}
                                      className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 p-2 transition cursor-help hover:brightness-110"
                                      style={{ borderColor: rarityDef.border, background: `rgba(0,0,0,0.5)`, boxShadow: `0 0 12px ${rarityDef.shadow}` }}>
                                      <span className="text-3xl">{r.itemIcon}</span>
                                      <span className="mt-1 text-[10px] font-black truncate w-full text-center" style={{ color: rarityDef.border }}>{r.itemName}</span>
                                      <span className="text-[8px] font-bold opacity-70" style={{ color: rarityDef.border }}>{rarityDef.label}</span>
                                      {g.count > 1 && <span className="absolute top-1 right-1 rounded bg-black/70 border px-1 text-[10px] font-black text-white" style={{ borderColor: rarityDef.border }}>×{g.count}</span>}
                                    </div>
                                  );
                                }
                                const def = COMPOST_DEFS[r.compostType];
                                const tierIdx = def.bonusValues.indexOf(r.value);
                                const tierColor = compostTierColor(tierIdx);
                                const tipNode = (
                                  <>
                                    <p className="text-[17px] font-black text-emerald-200">{def.icon} {def.name}</p>
                                    <p className="text-[14px] text-emerald-300/80">{def.desc}</p>
                                    <p className="text-[15px] font-black mt-1" style={{ color: tierColor }}>Tier: {def.tierName(r.value)}</p>
                                    <p className="text-[15px] font-black" style={{ color: tierColor }}>Bonus: {def.bonusLabel(r.value)}</p>
                                    <p className="text-[14px] text-amber-300 mt-1">Przeciagnij na pole z uprawa w plecaku</p>
                                  </>
                                );
                                const showTip = (e: React.MouseEvent<HTMLDivElement>) => {
                                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                  const _tc2 = toGameCoords(rect.left + rect.width / 2, rect.top);
                                  setKompostHoverTip({ x: _tc2.x, y: _tc2.y, node: tipNode, color: tierColor });
                                };
                                return (
                                  <div
                                    key={i}
                                    onMouseEnter={showTip}
                                    onMouseMove={showTip}
                                    onMouseLeave={() => setKompostHoverTip(null)}
                                    className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 bg-emerald-950/40 p-2 shadow-lg hover:brightness-110 transition cursor-help"
                                    style={{ borderColor: tierColor }}>
                                    <span className="text-3xl">{def.icon}</span>
                                    <span className="mt-1 text-[9px] font-black text-emerald-200 truncate w-full text-center">{def.name.replace("Kompost ","")}</span>
                                    <span className="text-[9px] font-black" style={{ color: tierColor }}>{def.tierName(r.value)}</span>
                                    {g.count > 1 && <span className="absolute top-1 right-1 rounded bg-emerald-700 px-1 text-[10px] font-black text-white">×{g.count}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="px-6 py-3 border-t border-[#8b6a3e]/30 flex justify-center">
                        <button
                          onClick={() => { setKompostRewards(null); setKompostHoverTip(null); }}
                          className="rounded-2xl border-2 border-yellow-400/70 bg-gradient-to-r from-yellow-600 to-amber-500 px-8 py-2 text-sm font-black text-white hover:scale-105 transition shadow-lg shadow-yellow-500/20">
                          Świetnie!
                        </button>
                      </div>
                    </div>
                    {/* Fixed-position tooltip — poza overflow-hidden panelu */}
                    {kompostHoverTip && (() => {
                      const TIP_W = 336;
                      const TIP_H_EST = 182;
                      const margin = 10;
                      const vw = BASE_W;
                      const vh = BASE_H;
                      let left = kompostHoverTip.x - TIP_W / 2;
                      left = Math.max(margin, Math.min(vw - TIP_W - margin, left));
                      let top = kompostHoverTip.y - TIP_H_EST - 12;
                      const placeBelow = top < margin;
                      if (placeBelow) top = kompostHoverTip.y + 70;
                      top = Math.max(margin, Math.min(vh - TIP_H_EST - margin, top));
                      return (
                        <div
                          className="pointer-events-none fixed z-[9999] flex flex-col gap-1.5 rounded-xl border-2 px-4 py-3 shadow-2xl text-left bg-[rgba(8,18,12,0.98)]"
                          style={{ left, top, width: TIP_W, borderColor: kompostHoverTip.color }}>
                          {kompostHoverTip.node}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {/* Tier tooltip — widoczny zawsze, nie tylko gdy panel nagród otwarty */}
                {kompostTierHoverTip && (() => {
                  const TIP_W = 308;
                  const TIP_H_EST = 420;
                  const margin = 10;
                  const vw = BASE_W;
                  const vh = BASE_H;
                  let left = kompostTierHoverTip.x - TIP_W / 2;
                  left = Math.max(margin, Math.min(vw - TIP_W - margin, left));
                  let top = kompostTierHoverTip.y + 8;
                  top = Math.max(margin, Math.min(vh - TIP_H_EST - margin, top));
                  return (
                    <div
                      className="pointer-events-none fixed z-[9999] flex flex-col gap-1 rounded-xl border-2 px-4 py-3.5 shadow-2xl text-left bg-[rgba(8,18,12,0.98)]"
                      style={{ left, top, width: TIP_W, borderColor: kompostTierHoverTip.color }}>
                      {kompostTierHoverTip.node}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Fixed avatar tooltip — śledzi kursor */}
          {avatarTipVisible && (
            <div
              className="pointer-events-none fixed z-[9999]"
              style={{ left: avatarTipPos.x + 16, top: avatarTipPos.y + 16 }}
            >
              <div className="rounded-[14px] border border-[#8b6a3e] bg-[rgba(18,10,4,0.97)] px-4 py-3 shadow-xl backdrop-blur-sm w-[240px]">
                <p className="mb-2 text-[15px] font-black leading-tight text-[#f9e7b2]">{profile?.login ?? "—"}</p>
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8b6a3e]">Avatar</span>
                    <span className="text-right font-bold text-[#d8ba7a]">
                      {avatarSkin < 0 ? "Brak" : (AVATAR_META[avatarSkin]?.name ?? "—")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8b6a3e]">Doświadczenie</span>
                    <span className="font-bold text-[#d8ba7a]">{displayXp}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8b6a3e]">Kolejny poziom</span>
                    <span className="font-bold text-[#d8ba7a]">{displayXpToNextLevel > 0 ? displayXpToNextLevel : "MAX"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fixed card tooltip — owoce, przedmioty, kompost — nad kursorem */}
          {cardTip && (
            <div
              className="pointer-events-none fixed z-[9999] flex flex-col items-center"
              style={{ left: mousePos.x, top: mousePos.y - 14, transform: "translate(-50%, -100%)" }}>
              <div className="rounded-xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-5 py-[13px] text-center shadow-2xl max-w-[370px]">
                {cardTip}
              </div>
              <div className="h-2 w-2 rotate-45 border-r border-b border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] -mt-1" />
            </div>
          )}

          {/* ═══ POWIADOMIENIE KOMPOSTU ═══ */}
          {compostNotice && <CompostNotificationPopup notice={compostNotice} />}

          {showUlModal && (
            <HiveModal
              hiveData={hiveData}
              hiveNow={hiveNow}
              displayMoney={displayMoney}
              onClose={() => setShowUlModal(false)}
              onBuyHive={handleBuyHive}
              onAddBees={handleAddBees}
              onCollect={handleCollectHoney}
            />
          )}

          {showLadaModal && (
            <CustomersModal
              showLadaInfo={showLadaInfo}
              ladaDetailIdx={ladaDetailIdx}
              ladaCardHoverIdx={ladaCardHoverIdx}
              ladaView={ladaView}
              customerOrders={customerOrders}
              customerSelling={customerSelling}
              customerLoading={customerLoading}
              customerNow={customerNow}
              nextSpawnAt={nextSpawnAt}
              newCustomerIds={newCustomerIds}
              ladaStatusMsg={ladaStatusMsg}
              carouselIdx={carouselIdx}
              profile={profile}
              mousePos={mousePos}
              completingCustomerOrderRef={completingCustomerOrderRef}
              carouselDragRef={carouselDragRef}
              carouselHasDraggedRef={carouselHasDraggedRef}
              barnItems={barnItems}
              seedInventory={seedInventory}
              fruitInventory={fruitInventory}
              hiveData={hiveData}
              setShowLadaModal={setShowLadaModal}
              setShowLadaInfo={setShowLadaInfo}
              setLadaDetailIdx={setLadaDetailIdx}
              setLadaCardHoverIdx={setLadaCardHoverIdx}
              setLadaView={setLadaView}
              setCarouselIdx={setCarouselIdx}
              completeCustomerOrder={completeCustomerOrder}
            />
          )}

          {customerLootDrop && (() => {
            const drop = customerLootDrop;
            const hovered = lootHoverIdx !== null ? drop.bonus[lootHoverIdx] : null;
            // Tooltip dla aktualnie podświetlonego przedmiotu
            const renderTooltip = (b: CustomerOrderBonus) => {
              const lookupId = b.id ?? (b.type === 'eq_item' ? `eq_tier_${b.tier ?? 0}` : '');
              const d = getOrderItemDisplay(lookupId);
              // Ekwipunek postaci
              const eq = lookupId ? CHAR_EQUIP_ITEMS.find(i => i.id === lookupId) : null;
              if (eq) {
                const slotMeta = EQUIP_SLOT_META[eq.slot];
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{eq.icon}</span>
                      <div>
                        <p className="text-base font-black text-amber-200">{eq.name}</p>
                        <p className="text-[11px] text-[#bfa274]">Ekwipunek · {slotMeta?.icon ?? '🎽'} {slotMeta?.label ?? eq.slot}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#8b6a3e]">Wymagany lvl: <span className="text-amber-300">{eq.unlockLevel}</span></p>
                    {eq.bonuses.length > 0 && (
                      <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2">
                        <p className="text-[10px] uppercase tracking-widest text-emerald-300 mb-1 font-black">Bonusy (na +0)</p>
                        <p className="text-[12px] text-emerald-100 leading-relaxed">{bonusLine(eq.bonuses, 0)}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-[#8b6a3e] italic">Można ulepszać u rzemieślnika do +10.</p>
                  </div>
                );
              }
              // Tajemniczy przedmiot ekwipunku (placeholder)
              if (lookupId.startsWith('eq_tier_')) {
                const tier = Number(lookupId.split('_').pop()) || 0;
                const minL = tier * 5 + 1, maxL = tier * 5 + 5;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎁</span>
                      <p className="text-base font-black text-amber-200">Tajemniczy przedmiot</p>
                    </div>
                    <p className="text-[12px] text-[#dfcfab]">Element ekwipunku z poziomu <span className="text-amber-300 font-bold">{minL}–{maxL}</span> — odblokuje się gdy osiągniesz odpowiedni poziom.</p>
                  </div>
                );
              }
              // Artykuł zwierzęcy
              const ai = ANIMAL_ITEMS.find(a => a.id === lookupId);
              if (ai) {
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{ai.icon}</span>
                      <div>
                        <p className="text-base font-black text-amber-200">{ai.name}</p>
                        <p className="text-[11px] text-[#bfa274]">Artykuł zwierzęcy</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#8b6a3e] italic">Trafia do magazynu w stodole.</p>
                  </div>
                );
              }
              // Słoik miodu
              if (lookupId === 'honey_jar') {
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🍯</span>
                      <p className="text-base font-black text-amber-200">Słoik miodu</p>
                    </div>
                    <p className="text-[12px] text-[#dfcfab]">Cenny produkt z ula. Można go sprzedać klientom za dobrą cenę.</p>
                  </div>
                );
              }
              // Kompost
              if (isCompostKey(lookupId)) {
                const t = compostTypeFromKey(lookupId);
                const v = compostValueFromKey(lookupId);
                if (t) {
                  const def = COMPOST_DEFS[t];
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{def.icon}</span>
                        <div>
                          <p className="text-base font-black text-amber-200">{t === "guide" ? def.name : `${def.tierName(v)} ${def.name}`}</p>
                          <p className="text-[11px] text-[#bfa274]">Kompost</p>
                        </div>
                      </div>
                      <p className="text-[12px] text-[#dfcfab]">{def.desc}</p>
                      <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2">
                        <p className="text-[12px] text-emerald-200 font-bold">{def.effectLabel}: {def.bonusLabel(v)}</p>
                      </div>
                    </div>
                  );
                }
              }
              // Uprawa
              const cropM = lookupId.match(/^(.+)_(good|epic|legendary)$/);
              if (cropM) {
                const crop = CROPS.find(c => c.id === cropM[1]);
                if (crop) {
                  const qLabel = cropM[2] === 'good' ? 'zwykła' : cropM[2] === 'epic' ? 'epicka' : 'legendarna';
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {d.spritePath ? (
                          <img src={d.spritePath} alt={d.name} className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated' }} />
                        ) : (
                          <span className="text-2xl">🌱</span>
                        )}
                        <div>
                          <p className="text-base font-black text-amber-200">{crop.name}</p>
                          <p className="text-[11px] text-[#bfa274]">Uprawa · jakość: <span className="text-amber-300">{qLabel}</span></p>
                        </div>
                      </div>
                      <p className="text-[12px] text-[#dfcfab]">Trafia do twojego magazynu plonów.</p>
                    </div>
                  );
                }
              }
              // Owoc
              const fruitM = lookupId.match(/^(.+)_(zwykly|soczysty|zloty|zgnile)$/);
              if (fruitM) {
                const tree = TREES.find(t => t.fruitId === fruitM[1]);
                const qd = FRUIT_QUALITY_DEFS[fruitM[2] as FruitQuality];
                if (tree) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{tree.fruitIcon}</span>
                        <div>
                          <p className="text-base font-black text-amber-200">{tree.fruitName}{qd?.label ? ' ' + qd.label : ''}</p>
                          <p className="text-[11px] text-[#bfa274]">Owoc z drzewa: {tree.name}</p>
                        </div>
                      </div>
                      <p className="text-[12px] text-[#dfcfab]">Trafia do magazynu owoców w sadzie.</p>
                    </div>
                  );
                }
              }
              // Fallback
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{d.icon}</span>
                    <p className="text-base font-black text-amber-200">{d.name}</p>
                  </div>
                </div>
              );
            };

            return (<>
              <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-500/70 bg-[rgba(20,12,5,0.99)] p-6 shadow-2xl">
                  <button
                    onClick={() => { setCustomerLootDrop(null); setLootHoverIdx(null); }}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#8b6a3e]/60 bg-black/40 text-[#dfcfab] transition hover:border-red-400/60 hover:text-red-300"
                  >✕</button>

                  <div className="text-center mb-4">
                    <p className="text-3xl mb-1">🎁</p>
                    <p className="text-lg font-black text-amber-300">Klient zostawił Ci prezent!</p>
                    <p className="text-[12px] text-[#bfa274]">{drop.customerIcon} {drop.customerName} dorzucił dodatkowy bonus do zapłaty</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl border border-yellow-500/50 bg-yellow-950/30 p-2.5 text-center">
                      <p className="text-xl">💰</p>
                      <p className="text-[10px] uppercase text-yellow-400/80 font-black">Złoto</p>
                      <p className="text-base font-black text-yellow-300">+{drop.gold.toFixed(0)} zł</p>
                    </div>
                    <div className="rounded-xl border border-blue-500/50 bg-blue-950/30 p-2.5 text-center">
                      <p className="text-xl">⭐</p>
                      <p className="text-[10px] uppercase text-blue-400/80 font-black">EXP</p>
                      <p className="text-base font-black text-blue-300">+{drop.exp}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-purple-500/60 bg-purple-950/25 p-3 mb-4">
                    <p className="text-[11px] uppercase tracking-widest text-purple-300 mb-2 font-black text-center">🎁 Dodatkowy bonus</p>
                    <div className={`grid gap-2 ${drop.bonus.length === 1 ? 'grid-cols-1' : drop.bonus.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {drop.bonus.map((b, idx) => {
                        const lookupId = b.id ?? (b.type === 'eq_item' ? `eq_tier_${b.tier ?? 0}` : '');
                        const d = getOrderItemDisplay(lookupId);
                        const isHovered = lootHoverIdx === idx;
                        return (
                          <div
                            key={idx}
                            onMouseEnter={() => setLootHoverIdx(idx)}
                            onMouseLeave={() => setLootHoverIdx(prev => prev === idx ? null : prev)}
                            className={`relative rounded-xl border-2 p-3 text-center cursor-help transition-colors ${isHovered ? 'border-amber-300 bg-purple-900/50 shadow-lg shadow-amber-500/20' : 'border-purple-600/40 bg-purple-950/30 hover:border-purple-400/60'}`}
                          >
                            <div className="flex items-center justify-center mb-1 h-12">
                              {d.spritePath ? (
                                <img src={d.spritePath} alt={d.name} className="w-12 h-12 object-contain drop-shadow" style={{ imageRendering: 'pixelated' }} />
                              ) : (
                                <span className="text-4xl">{d.icon}</span>
                              )}
                            </div>
                            <p className="text-[11px] font-black text-purple-100 leading-tight line-clamp-2">{d.name}</p>
                            <p className="text-[10px] text-amber-300 font-bold mt-0.5">×{b.qty}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => { setCustomerLootDrop(null); setLootHoverIdx(null); }}
                    className="w-full rounded-xl py-3 text-base font-black border border-amber-400 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] text-[#2f1b0c] hover:brightness-110 transition"
                  >
                    🤝 Świetnie, dzięki!
                  </button>
                  <p className="text-[10px] text-center text-[#8b6a3e] mt-1.5">Esc lub Enter, aby zamknąć</p>
                </div>
              </div>
              {hovered && (
                <div
                  className="pointer-events-none fixed z-[500] w-[380px] rounded-xl border border-amber-500/80 bg-[rgba(20,12,5,0.98)] p-4 shadow-2xl backdrop-blur-sm"
                  style={ttStyle(mousePos.x, mousePos.y, 400, 180)}
                >
                  {renderTooltip(hovered)}
                </div>
              )}
            </>);
          })()}

          {showStodolaModal && (
            <BarnModal
              displayLevel={displayLevel}
              displayMoney={displayMoney}
              barnState={barnState}
              seedInventory={seedInventory}
              effectiveStats={effectiveStats}
              barnNow={barnNow}
              onClose={() => setShowStodolaModal(false)}
              onBuySlot={handleBarnBuySlot}
              onFeed={handleBarnFeed}
              onCollect={handleBarnCollect}
              onCollectAll={handleBarnCollectAll}
            />
          )}

          {showSadModal && (
            <OrchardModal
              displayLevel={displayLevel}
              orchardState={orchardState}
              orchardError={orchardError}
              fruitInventory={fruitInventory}
              charEquipped={charEquipped}
              playerStats={playerStats}
              barnNow={barnNow}
              onClose={() => setShowSadModal(false)}
              onHarvestTree={handleOrchardHarvestTree}
              onHarvestAll={handleOrchardHarvestAll}
            />
          )}

          {showSkinModal && (
            <SkinPickerModal
              onClose={() => setShowSkinModal(false)}
              avatarSkin={avatarSkin}
              avatarChangeCount={avatarChangeCount}
              lastAvatarChangeAt={lastAvatarChangeAt}
              displayMoney={displayMoney}
              skinTab={skinTab}
              setSkinTab={setSkinTab}
              unlockedEpicAvatars={unlockedEpicAvatars}
              seedInventory={seedInventory}
              handleAvatarSelect={handleAvatarSelect}
              setHoveredNormalSkin={setHoveredNormalSkin}
              setHoveredEpicSkin={setHoveredEpicSkin}
              setEpicPurchaseTarget={setEpicPurchaseTarget}
            />
          )}

          {/* ═══ TOOLTIP EPICKIEGO SKINA ═══ */}
          {hoveredEpicSkin !== null && showSkinModal && (() => {
            const es = EPIC_SKINS[hoveredEpicSkin - EPIC_SKIN_START];
            if (!es) return null;
            const isUnlocked = unlockedEpicAvatars.includes(hoveredEpicSkin);
            const canAfford = Object.entries(es.cost).every(([k,v]) => (seedInventory[k] ?? 0) >= v);
            return (
              <div className="pointer-events-none fixed z-[9999] w-80 rounded-[20px] border border-green-500/70 bg-[rgba(8,25,8,0.98)] p-5 shadow-2xl backdrop-blur-sm"
                style={ttStyle(mousePos.x, mousePos.y, 320, 300)}>
                {/* Podgląd skina */}
                <div className="mb-3 flex justify-center">
                  <div className="relative h-32 w-32 overflow-hidden rounded-2xl border-2 border-green-500/60 shadow-[0_0_16px_rgba(34,197,94,0.3)]">
                    <img src={es.path} alt={es.name} className="h-full w-full object-cover" style={{ imageRendering: "pixelated", filter: isUnlocked ? "none" : "grayscale(80%) brightness(0.5)" }} />
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl">🔒</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Nazwa */}
                <p className="mb-1 text-center text-[20px] font-black text-green-300">⭐ {es.name}</p>
                {/* Status */}
                {isUnlocked
                  ? <p className="mb-2 text-center text-[14px] font-bold text-green-400">✓ Odblokowany — kliknij, aby wybrać</p>
                  : <p className="mb-2 text-center text-[14px] text-[#8b6a3e]">Zablokowany — kliknij, aby odblokować</p>
                }
                {/* Bonusy statystyk */}
                {(() => {
                  const _b = getAvatarBonus(hoveredEpicSkin!);
                  const _e = (Object.entries(_b) as [string,number][]).filter(([,v])=>v>0);
                  const _sl: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zrecznosc",zaradnosc:"Zaradnosc",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczescie" };
                  if (!_e.length) return null;
                  return (
                    <div className="mb-2 rounded-xl border border-green-700/40 bg-green-950/20 px-3 py-2">
                      <p className="mb-1.5 text-[12px] font-black uppercase tracking-widest text-green-500">Bonusy statystyk:</p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {_e.map(([k,v]) => <span key={k} className="rounded bg-green-900/40 border border-green-600/30 px-2 py-0.5 text-[13px] font-bold text-green-200">+{v} {_sl[k]??k}</span>)}
                      </div>
                    </div>
                  );
                })()}
                {/* Koszty */}
                {!isUnlocked && (
                  <div className="rounded-xl border border-green-800/40 bg-black/30 p-3">
                    <p className="mb-1.5 text-[13px] font-black uppercase tracking-widest text-green-500">Koszt odblokowania:</p>
                    {Object.entries(es.cost).map(([k, v]) => {
                      const { baseCropId, quality } = parseQualityKey(k);
                      const crop = CROPS.find(c => c.id === baseCropId);
                      const qLabel = quality === "epic" ? "epickich" : quality === "legendary" ? "legendarnych" : "zwykłych";
                      const have = seedInventory[k] ?? 0;
                      const enough = have >= v;
                      return (
                        <div key={k} className={`flex items-center justify-between text-[12px] font-bold ${enough ? "text-green-300" : "text-red-300"}`}>
                          <span>{v}× {crop?.name ?? k} {qLabel}</span>
                          <span className="ml-2 text-[11px] opacity-70">({have}/{v})</span>
                        </div>
                      );
                    })}
                    {canAfford && <p className="mt-1.5 text-center text-[11px] font-black text-green-400">Masz wystarczająco!</p>}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ TOOLTIP NORMALNEGO SKINA (M/K) ═══ */}
          {hoveredNormalSkin !== null && showSkinModal && (() => {
            const _b = getAvatarBonus(hoveredNormalSkin);
            const _e = (Object.entries(_b) as [string,number][]).filter(([,v])=>v>0);
            if (!_e.length) return null;
            const _meta = AVATAR_META[hoveredNormalSkin];
            const isFemale = hoveredNormalSkin >= 10 && hoveredNormalSkin < EPIC_SKIN_START;
            const _sl: Record<string,string> = { wiedza:"Wiedza",zrecznosc:"Zrecznosc",zaradnosc:"Zaradnosc",sadownik:"Sadownik",opieka:"Opieka",szczescie:"Szczescie" };
            const borderColor = isFemale ? "border-pink-500/70" : "border-amber-500/70";
            const nameColor = isFemale ? "text-pink-300" : "text-amber-300";
            const badgeBg = isFemale ? "bg-pink-900/40 border-pink-600/30 text-pink-200" : "bg-amber-900/40 border-amber-600/30 text-amber-200";
            return (
              <div className={`pointer-events-none fixed z-[9999] w-64 rounded-[18px] border ${borderColor} bg-[rgba(18,10,2,0.98)] px-4 py-3 text-center shadow-2xl backdrop-blur-sm`}
                style={ttStyle(mousePos.x, mousePos.y, 272, 180)}>
                {_meta && <p className={`text-[18px] font-black ${nameColor} mb-2`}>{_meta.name}</p>}
                <div className="flex flex-wrap justify-center gap-1.5">
                  {_e.map(([k,v]) => <span key={k} className={`rounded border px-2 py-0.5 text-[15px] font-bold ${badgeBg}`}>+{v} {_sl[k]??k}</span>)}
                </div>
              </div>
            );
          })()}

          {/* ═══ MODAL ZAKUPU EPICKIEGO AVATARA ═══ */}
          {epicPurchaseTarget !== null && (
            <EpicPurchaseModal
              epicPurchaseTarget={epicPurchaseTarget}
              onClose={() => setEpicPurchaseTarget(null)}
              seedInventory={seedInventory}
              onConfirm={handleBuyEpicAvatar}
            />
          )}

          {isFieldViewOpen && isOnFarmMap && (
            <div
              className="fixed inset-0 z-[80]"
              style={fvToolEditMode ? { userSelect: "none" } : undefined}
            >
                <div
                  ref={fieldViewScrollRef}
                  className="fv-scroll relative w-full h-full bg-[rgba(20,12,6,0.96)] p-5 overflow-auto select-none"
                  style={{ cursor: fieldScrollDragRef.current?.active && fieldScrollDragRef.current?.moved ? "grabbing" : undefined, userSelect: fieldScrollDragRef.current?.moved ? "none" : undefined }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    const tgt = e.target as HTMLElement;
                    if (tgt.closest('button, [role="button"], a, input, select, textarea')) return;
                    const el = fieldViewScrollRef.current;
                    if (!el) return;
                    fieldScrollDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, moved: false };
                  }}
                  onMouseMove={(e) => {
                    const drag = fieldScrollDragRef.current;
                    if (!drag?.active) return;
                    const el = fieldViewScrollRef.current;
                    if (!el) return;
                    const dx = e.clientX - drag.startX;
                    const dy = e.clientY - drag.startY;
                    if (!drag.moved && Math.sqrt(dx * dx + dy * dy) < 5) return;
                    drag.moved = true;
                    el.scrollLeft = drag.scrollLeft - dx;
                    el.scrollTop = drag.scrollTop - dy;
                  }}
                  onMouseUp={() => { if (fieldScrollDragRef.current) fieldScrollDragRef.current.active = false; }}
                  onMouseLeave={() => { if (fieldScrollDragRef.current) fieldScrollDragRef.current.active = false; }}
                  onClickCapture={(e) => { if (fieldScrollDragRef.current?.moved) { e.stopPropagation(); e.preventDefault(); fieldScrollDragRef.current.moved = false; } }}
                >
                  <button
                    onClick={() => {
                      if (tutorialStep >= 1 && tutorialStep <= 11) {
                        setMessage({ type: "info", title: "Przewodnik aktywny", text: "Najpierw wykonaj krok przewodnika." });
                        return;
                      }
                      setIsFieldViewOpen(false);
                      setSelectedPlotId(null);
                      setIsFieldViewCollapsed(false);
                    }}
                    className="absolute right-4 top-4 z-[100] flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-400/70 bg-red-950/70 text-3xl font-black text-red-100 shadow-2xl transition hover:bg-red-800/90 hover:scale-110 active:scale-95"
                    aria-label="Zamknij widok pola"
                  >
                    ✕
                  </button>

                  {/* ─── Przycisk edycji hitboxów narzędzi (tylko tester/admin/owner) ─── */}
                  {canEditHitboxes && (
                  <button
                    type="button"
                    onClick={() => setFvToolEditMode(m => !m)}
                    className={`absolute right-20 top-4 z-[91] flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-xl backdrop-blur-sm transition ${fvToolEditMode ? "border-orange-400 bg-orange-900/80 text-orange-300" : "border-[#8b6a3e]/70 bg-[rgba(22,13,8,0.85)] text-[#dfcfab]"}`}
                  >
                    🎯 {fvToolEditMode ? "Zakończ edycję" : "Edytuj narzędzia"}
                  </button>
                  )}

                  {/* ─── Panel współrzędnych (widoczny tylko w trybie edycji) ─── */}
                  {fvToolEditMode && (
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] w-[340px] rounded-2xl border border-orange-400/60 bg-[rgba(20,8,2,0.97)] p-5 shadow-2xl backdrop-blur-sm pointer-events-none">
                      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">📐 Współrzędne narzędzi</p>
                      <div className="flex flex-col gap-2">
                        <div className="rounded-xl border border-cyan-400/30 bg-cyan-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cyan-300">🚿 Konewka</p>
                          <p className="font-mono text-xs text-cyan-100">l:<span className="font-black text-white">{fvKonewkaPos.l}</span> t:<span className="font-black text-white">{fvKonewkaPos.t}</span> w:<span className="font-black text-white">{fvKonewkaPos.w}</span> h:<span className="font-black text-white">{fvKonewkaPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-yellow-400/30 bg-yellow-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-yellow-300">⚔️ Sierp</p>
                          <p className="font-mono text-xs text-yellow-100">l:<span className="font-black text-white">{fvZbierzPos.l}</span> t:<span className="font-black text-white">{fvZbierzPos.t}</span> w:<span className="font-black text-white">{fvZbierzPos.w}</span> h:<span className="font-black text-white">{fvZbierzPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-green-400/30 bg-green-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-green-300">🌱 Nasiona</p>
                          <p className="font-mono text-xs text-green-100">l:<span className="font-black text-white">{fvNasonaPos.l}</span> t:<span className="font-black text-white">{fvNasonaPos.t}</span> w:<span className="font-black text-white">{fvNasonaPos.w}</span> h:<span className="font-black text-white">{fvNasonaPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-lime-400/30 bg-lime-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-lime-300">♻️ Kompost</p>
                          <p className="font-mono text-xs text-lime-100">l:<span className="font-black text-white">{fvKompostPos.l}</span> t:<span className="font-black text-white">{fvKompostPos.t}</span> w:<span className="font-black text-white">{fvKompostPos.w}</span> h:<span className="font-black text-white">{fvKompostPos.h}</span></p>
                        </div>
                        <p className="mt-2 mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-orange-300/70">— Prawa kolumna —</p>
                        <div className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-amber-300">🚜 Ciągnik</p>
                          <p className="font-mono text-xs text-amber-100">l:<span className="font-black text-white">{fvCiagnikPos.l}</span> t:<span className="font-black text-white">{fvCiagnikPos.t}</span> w:<span className="font-black text-white">{fvCiagnikPos.w}</span> h:<span className="font-black text-white">{fvCiagnikPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">🌿 Ogrodnik</p>
                          <p className="font-mono text-xs text-emerald-100">l:<span className="font-black text-white">{fvOgrodnikPos.l}</span> t:<span className="font-black text-white">{fvOgrodnikPos.t}</span> w:<span className="font-black text-white">{fvOgrodnikPos.w}</span> h:<span className="font-black text-white">{fvOgrodnikPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-blue-400/30 bg-blue-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-blue-300">💧 Zraszacz</p>
                          <p className="font-mono text-xs text-blue-100">l:<span className="font-black text-white">{fvZraszaczPos.l}</span> t:<span className="font-black text-white">{fvZraszaczPos.t}</span> w:<span className="font-black text-white">{fvZraszaczPos.w}</span> h:<span className="font-black text-white">{fvZraszaczPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-yellow-400/30 bg-yellow-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-yellow-300">🌾 Kombajn</p>
                          <p className="font-mono text-xs text-yellow-100">l:<span className="font-black text-white">{fvKombajnPos.l}</span> t:<span className="font-black text-white">{fvKombajnPos.t}</span> w:<span className="font-black text-white">{fvKombajnPos.w}</span> h:<span className="font-black text-white">{fvKombajnPos.h}</span></p>
                        </div>
                        <div className="rounded-xl border border-orange-400/50 bg-orange-950/40 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-orange-300">🌾 Zbiory</p>
                          <p className="font-mono text-xs text-orange-100">l:<span className="font-black text-white">{fvZbioryPos.l}</span> t:<span className="font-black text-white">{fvZbioryPos.t}</span> w:<span className="font-black text-white">{fvZbioryPos.w}</span> h:<span className="font-black text-white">{fvZbioryPos.h}</span></p>
                        </div>
                        <p className="mt-2 mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-purple-300/70">— Strzałki tutorialu —</p>
                        <div className="rounded-xl border border-purple-400/30 bg-purple-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-purple-300">🎯 Strzałka krok 12</p>
                          <p className="font-mono text-xs text-purple-100">lPct:<span className="font-black text-white">{fvTutArrow12Pos.lPct.toFixed(1)}</span>% tPct:<span className="font-black text-white">{fvTutArrow12Pos.tPct.toFixed(1)}</span>%</p>
                        </div>
                        <div className="rounded-xl border border-purple-400/30 bg-purple-950/30 p-2.5">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-purple-300">🎯 Strzałka krok 13</p>
                          <p className="font-mono text-xs text-purple-100">lPct:<span className="font-black text-white">{fvTutArrow13Pos.lPct.toFixed(1)}</span>% tPct:<span className="font-black text-white">{fvTutArrow13Pos.tPct.toFixed(1)}</span>%</p>
                        </div>
                      </div>
                      <p className="mt-3 text-[9px] text-[#6b7280] text-center">Przeciągnij przycisk aby przesunąć · róg aby zmienić rozmiar</p>
                    </div>
                  )}

                  {/* Konewka */}
                  <button
                    type="button"
                    data-tutorial-target="konewka-btn"
                    onClick={() => { if (!fvToolEditMode) { if ((tutorialStep >= 2 && tutorialStep <= 7) || (tutorialStep >= 10 && tutorialStep <= 11)) return; setSelectedTool(prev => prev === "watering_can" ? null : "watering_can"); setSelectedSeedId(null); if (tutorialStep === 8) { const _canW = tutorialPlotIds.some(id => { const _p = getPlotCrop(id); return _p.cropId && !isCropReady(id) && !_p.watered; }); void advanceTutorialStep(_canW ? 9 : 10); } } }}
                    onMouseEnter={() => { if (!fvToolEditMode) setHoveredWateringCan(true); }}
                    onMouseLeave={() => setHoveredWateringCan(false)}
                    onMouseDown={fvToolEditMode ? (e) => {
                      e.preventDefault();
                      const pos = fvKonewkaPos;
                      fvToolDragRef.current = { btn: "konewka", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h };
                    } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : selectedTool === "watering_can" ? "border-cyan-300 bg-cyan-900/70 shadow-[0_0_20px_rgba(80,200,255,0.5)]" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}${tutorialStep === 8 && !fvToolEditMode ? " ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.55)]" : ""}${((tutorialStep >= 2 && tutorialStep <= 7) || (tutorialStep >= 10 && tutorialStep <= 11)) && !fvToolEditMode ? " opacity-40 cursor-not-allowed" : ""}`}
                    style={{ left: fvKonewkaPos.l, top: fvKonewkaPos.t, width: fvKonewkaPos.w, height: fvKonewkaPos.h }}
                  >
                    <p className="text-[20px] font-black text-[#f9e7b2] pointer-events-none leading-none mb-0.5">Konewka</p>
                    <img src="/ui/ikona_konewka.png" alt="Konewka" className="h-[60%] w-[60%] object-contain pointer-events-none" style={{ imageRendering: "pixelated", mixBlendMode: "screen" }} />
                    {fvToolEditMode && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); const pos = fvKonewkaPos; fvToolDragRef.current = { btn: "konewka", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h }; }}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-orange-400/80 rounded-tl"
                      />
                    )}
                  </button>

                  {/* Zbierz */}
                  <button
                    type="button"
                    data-tutorial-target="zbierz-btn"
                    onClick={() => { if (!fvToolEditMode) { if (tutorialStep >= 2 && tutorialStep <= 9) return; setSelectedTool(prev => prev === "sickle" ? null : "sickle"); setSelectedSeedId(null); setHoveredSickle(false); if (tutorialStep === 10) void advanceTutorialStep(11); } }}
                    onMouseEnter={() => { if (!fvToolEditMode) setHoveredSickle(true); }}
                    onMouseLeave={() => setHoveredSickle(false)}
                    data-zone="sickle"
                    onMouseDown={fvToolEditMode ? (e) => {
                      e.preventDefault();
                      const pos = fvZbierzPos;
                      fvToolDragRef.current = { btn: "zbierz", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h };
                    } : (e) => setHoveredSickle(false)}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : selectedTool === "sickle" ? "border-yellow-300 bg-yellow-900/70 shadow-[0_0_20px_rgba(255,220,120,0.5)]" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}${tutorialStep === 10 && !fvToolEditMode ? " ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.55)]" : ""}${tutorialStep >= 2 && tutorialStep <= 9 && !fvToolEditMode ? " opacity-40 cursor-not-allowed" : ""}`}
                    style={{ left: fvZbierzPos.l, top: fvZbierzPos.t, width: fvZbierzPos.w, height: fvZbierzPos.h }}
                  >
                    <p className="text-[20px] font-black text-[#f9e7b2] pointer-events-none leading-none mb-0.5">Zbierz</p>
                    <img src="/ui/ikona_zbierz.png" alt="Zbierz" className="h-[60%] w-[60%] object-contain pointer-events-none" style={{ imageRendering: "pixelated", mixBlendMode: "screen" }} />
                    {fvToolEditMode && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); const pos = fvZbierzPos; fvToolDragRef.current = { btn: "zbierz", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h }; }}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-orange-400/80 rounded-tl"
                      />
                    )}
                  </button>

                  {/* ─── Przycisk Zbiory (pod Zbierz) ─── */}
                  <button
                    type="button"
                    onClick={() => { if (!fvToolEditMode) setIsFvHarvestModalOpen(prev => !prev); }}
                    onMouseDown={fvToolEditMode ? (e) => {
                      e.preventDefault();
                      const pos = fvZbioryPos;
                      fvToolDragRef.current = { btn: "zbiorybtn", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h };
                    } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : isFvHarvestModalOpen ? "border-amber-400 bg-amber-900/60 shadow-[0_0_20px_rgba(251,191,36,0.5)]" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}`}
                    style={{ left: fvZbioryPos.l, top: fvZbioryPos.t, width: fvZbioryPos.w, height: fvZbioryPos.h }}
                  >
                    <p className="text-[20px] font-black text-[#f9e7b2] pointer-events-none leading-none mb-1">Zbiory</p>
                    <span className="text-[38px] leading-none pointer-events-none">🌾</span>
                    {harvestLog.length > 0 && !isFvHarvestModalOpen && !fvToolEditMode && (
                      <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-amber-400 text-[10px] font-black text-black flex items-center justify-center px-1 leading-none">
                        {harvestLog.length}
                      </span>
                    )}
                    {fvToolEditMode && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); const pos = fvZbioryPos; fvToolDragRef.current = { btn: "zbiorybtn", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h }; }}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-orange-400/80 rounded-tl"
                      />
                    )}
                  </button>

                  {/* ─── Przycisk Nasiona ─── */}
                  <button
                    type="button"
                    data-tutorial-target="nasiona-btn"
                    onClick={() => {
                      if (fvToolEditMode) return;
                      if ((tutorialStep >= 2 && tutorialStep <= 4) || (tutorialStep >= 8 && tutorialStep <= 11)) return;
                      setFvSeedPickerOpen(prev => !prev);
                      setFvCompostPickerOpen(false);
                      if (tutorialStep === 5) void advanceTutorialStep(6);
                    }}
                    onMouseDown={fvToolEditMode ? (e) => {
                      e.preventDefault();
                      const pos = fvNasonaPos;
                      fvToolDragRef.current = { btn: "nasiona", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h };
                    } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : (selectedSeedId && !isCompostKey(selectedSeedId) && !isGuideCompostKey(selectedSeedId)) ? "border-green-300 bg-green-900/70 shadow-[0_0_20px_rgba(100,220,100,0.5)]" : fvSeedPickerOpen ? "border-green-500 bg-green-950/80" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}${tutorialStep === 5 && !fvToolEditMode ? " ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.55)]" : ""}${((tutorialStep >= 2 && tutorialStep <= 4) || (tutorialStep >= 8 && tutorialStep <= 11)) && !fvToolEditMode ? " opacity-40 cursor-not-allowed" : ""}`}
                    style={{ left: fvNasonaPos.l, top: fvNasonaPos.t, width: fvNasonaPos.w, height: fvNasonaPos.h }}
                  >
                    {(() => {
                      if (!fvToolEditMode && selectedSeedId && !isCompostKey(selectedSeedId) && !isGuideCompostKey(selectedSeedId)) {
                        const { baseCropId, quality } = parseQualityKey(selectedSeedId);
                        const crop = CROPS.find(c => c.id === baseCropId);
                        if (crop) {
                          const sprite = quality === "legendary" ? (crop.legendarySpritePath ?? crop.spritePath) : quality === "epic" ? (crop.epicSpritePath ?? crop.spritePath) : quality === "rotten" ? (crop.rottenSpritePath ?? crop.spritePath) : crop.spritePath;
                          const cnt = seedInventory[selectedSeedId] ?? 0;
                          return (
                            <>
                              <img src={sprite} alt={crop.name} className="absolute inset-0 h-full w-full object-contain pointer-events-none rounded-[10px]" style={{ imageRendering: "pixelated" }} />
                              {quality === "legendary" && (
                                <div className="absolute inset-0 rounded-[10px] pointer-events-none animate-pulse" style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.7) 0%, rgba(245,158,11,0.1) 40%, rgba(251,191,36,0.7) 100%)", boxShadow: "inset 0 0 20px rgba(251,191,36,1), 0 0 18px rgba(251,191,36,0.9)" }} />
                              )}
                              {quality === "epic" && (
                                <div className="absolute inset-0 rounded-[10px] pointer-events-none animate-pulse" style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.65) 0%, rgba(139,92,246,0.1) 40%, rgba(167,139,250,0.65) 100%)", boxShadow: "inset 0 0 18px rgba(167,139,250,0.9), 0 0 14px rgba(167,139,250,0.8)" }} />
                              )}
                              <p className="absolute bottom-5 left-0 right-0 text-center text-[9px] font-black text-white pointer-events-none leading-none px-1 truncate drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{crop.name}</p>
                              <p className="absolute bottom-1 left-0 right-0 text-center text-[14px] font-black text-green-300 pointer-events-none leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">×{cnt}</p>
                            </>
                          );
                        }
                      }
                      return (
                        <>
                          <p className="text-[20px] font-black text-[#f9e7b2] pointer-events-none leading-none mb-0.5">Nasiona</p>
                          <img src="/ui/ikona_nasiona.png" alt="Nasiona" className="h-[60%] w-[60%] object-contain pointer-events-none" style={{ imageRendering: "pixelated", mixBlendMode: "screen" }} />
                        </>
                      );
                    })()}
                    {fvToolEditMode && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); const pos = fvNasonaPos; fvToolDragRef.current = { btn: "nasiona", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h }; }}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-orange-400/80 rounded-tl"
                      />
                    )}
                  </button>

                  {/* ─── Przycisk Kompost ─── */}
                  <button
                    type="button"
                    data-tutorial-target="kompost-btn"
                    onClick={() => {
                      if (fvToolEditMode) return;
                      if (tutorialStep >= 5 && tutorialStep <= 11) return;
                      setFvCompostPickerOpen(prev => !prev);
                      setFvSeedPickerOpen(false);
                      if (tutorialStep === 2) void advanceTutorialStep(3);
                    }}
                    onMouseDown={fvToolEditMode ? (e) => {
                      e.preventDefault();
                      const pos = fvKompostPos;
                      fvToolDragRef.current = { btn: "kompost", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h };
                    } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : (selectedSeedId && isGuideCompostKey(selectedSeedId)) ? "border-yellow-300 bg-yellow-900/70 shadow-[0_0_20px_rgba(250,204,21,0.5)]" : (selectedSeedId && isCompostKey(selectedSeedId)) ? "border-lime-300 bg-lime-900/70 shadow-[0_0_20px_rgba(140,220,60,0.5)]" : fvCompostPickerOpen ? "border-lime-500 bg-lime-950/80" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}${tutorialStep === 2 && !fvToolEditMode ? " ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.55)]" : ""}${tutorialStep >= 5 && tutorialStep <= 11 && !fvToolEditMode ? " opacity-40 cursor-not-allowed" : ""}`}
                    style={{ left: fvKompostPos.l, top: fvKompostPos.t, width: fvKompostPos.w, height: fvKompostPos.h }}
                  >
                    {(() => {
                      if (!fvToolEditMode && selectedSeedId && isGuideCompostKey(selectedSeedId)) {
                        const cnt = seedInventory["guide_compost"] ?? 0;
                        return (
                          <>
                            <span className="text-3xl pointer-events-none select-none">{GUIDE_COMPOST_DEF.icon}</span>
                            <p className="text-[9px] font-black text-yellow-200 pointer-events-none leading-none mt-0.5 text-center px-1 max-w-full truncate">Przewodnik</p>
                            <p className="text-[9px] text-yellow-300 pointer-events-none leading-none">×{cnt}</p>
                          </>
                        );
                      }
                      if (!fvToolEditMode && selectedSeedId && isCompostKey(selectedSeedId)) {
                        const cType = compostTypeFromKey(selectedSeedId);
                        const cVal = compostValueFromKey(selectedSeedId);
                        const cDef = cType ? COMPOST_DEFS[cType] : null;
                        const cnt = seedInventory[selectedSeedId] ?? 0;
                        if (cDef) {
                          return (
                            <>
                              <span className="text-3xl pointer-events-none select-none">{cDef.icon}</span>
                              <p className="text-[9px] font-black text-[#f9e7b2] pointer-events-none leading-none mt-0.5 text-center px-1 max-w-full truncate">{cDef.tierName(cVal)}</p>
                              <p className="text-[9px] text-lime-300 pointer-events-none leading-none">×{cnt}</p>
                            </>
                          );
                        }
                      }
                      return (
                        <>
                          <p className="text-[20px] font-black text-[#f9e7b2] pointer-events-none leading-none mb-0.5">Kompost</p>
                          <img src="/ui/ikona_kompost.png" alt="Kompost" className="h-[60%] w-[60%] object-contain pointer-events-none" style={{ imageRendering: "pixelated", mixBlendMode: "screen" }} />
                        </>
                      );
                    })()}
                    {fvToolEditMode && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); const pos = fvKompostPos; fvToolDragRef.current = { btn: "kompost", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: pos.l, startT: pos.t, startW: pos.w, startH: pos.h }; }}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-orange-400/80 rounded-tl"
                      />
                    )}
                  </button>

                  {/* ─── Picker: Nasiona ─── */}
                  {fvSeedPickerOpen && !fvToolEditMode && (
                    <SeedPicker
                      fvSeedPickerOpen={fvSeedPickerOpen}
                      fvToolEditMode={fvToolEditMode}
                      setFvSeedPickerOpen={setFvSeedPickerOpen}
                      seedQualityFilter={seedQualityFilter}
                      setSeedQualityFilter={setSeedQualityFilter}
                      seedInventory={seedInventory}
                      selectedSeedId={selectedSeedId}
                      setSelectedSeedId={setSelectedSeedId}
                      setSelectedTool={setSelectedTool}
                      seedPickerTip={seedPickerTip}
                      setSeedPickerTip={setSeedPickerTip}
                      advanceTutorialStep={advanceTutorialStep}
                      tutorialStep={tutorialStep}
                      effectiveStats={effectiveStats}
                      charEquipped={charEquipped}
                      hiveData={hiveData}
                    />
                  )}

                  {/* ─── Picker: Kompost ─── */}
                  {fvCompostPickerOpen && !fvToolEditMode && (
                    <CompostPicker
                      fvCompostPickerOpen={fvCompostPickerOpen}
                      fvToolEditMode={fvToolEditMode}
                      setFvCompostPickerOpen={setFvCompostPickerOpen}
                      seedInventory={seedInventory}
                      selectedSeedId={selectedSeedId}
                      setSelectedSeedId={setSelectedSeedId}
                      setSelectedTool={setSelectedTool}
                      advanceTutorialStep={advanceTutorialStep}
                      tutorialStep={tutorialStep}
                    />
                  )}

                  {/* ─── Prawa kolumna: narzędzia masowe ─── */}

                  {/* Ciągnik — bulk compost */}
                  {(() => {
                    const _tutBlock = !fvToolEditMode && tutorialStep >= 1 && tutorialStep <= 12 && !!profile?.tutorial_started && !profile?.tutorial_completed && !profile?.tutorial_skipped;
                    return (
                  <button
                    type="button"
                    onClick={() => { if (!fvToolEditMode && !_tutBlock) handleBulkCompost(); }}
                    onMouseDown={fvToolEditMode ? (e) => { e.preventDefault(); fvToolDragRef.current = { btn: "ciagnik", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: fvCiagnikPos.l, startT: fvCiagnikPos.t, startW: fvCiagnikPos.w, startH: fvCiagnikPos.h }; } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : _tutBlock ? "border-[#8b6a3e]/40 bg-[rgba(20,12,8,0.5)] opacity-40 cursor-not-allowed" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}`}
                    style={{ left: fvCiagnikPos.l, top: fvCiagnikPos.t, width: fvCiagnikPos.w, height: fvCiagnikPos.h }}
                  >
                    <p className="text-[20px] font-black text-[#f9e7b2] pointer-events-none leading-none mb-0.5">Ciągnik</p>
                    <span className="pointer-events-none text-4xl leading-none">🚜</span>
                    <p className="mt-1 text-[11px] text-[#a07030] pointer-events-none leading-tight text-center px-1">kompost na wolne pola</p>
                    {fvToolEditMode && (
                      <div className="pointer-events-none absolute bottom-1 right-1 flex flex-col items-end gap-0.5">
                        <p className="font-mono text-[8px] text-orange-300 leading-none">{fvCiagnikPos.l},{fvCiagnikPos.t}</p>
                        <div
                          className="pointer-events-auto h-3 w-3 cursor-se-resize rounded-sm bg-orange-400/60"
                          onMouseDown={(e) => { e.stopPropagation(); fvToolDragRef.current = { btn: "ciagnik", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: fvCiagnikPos.l, startT: fvCiagnikPos.t, startW: fvCiagnikPos.w, startH: fvCiagnikPos.h }; }}
                        />
                      </div>
                    )}
                  </button>
                  );
                  })()}

                  {/* Ogrodnik — bulk plant */}
                  {(() => {
                    const _tutBlock = !fvToolEditMode && tutorialStep >= 1 && tutorialStep <= 12 && !!profile?.tutorial_started && !profile?.tutorial_completed && !profile?.tutorial_skipped;
                    return (
                  <button
                    type="button"
                    onClick={() => { if (!fvToolEditMode && !_tutBlock) handleBulkPlant(); }}
                    onMouseDown={fvToolEditMode ? (e) => { e.preventDefault(); fvToolDragRef.current = { btn: "ogrodnik", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: fvOgrodnikPos.l, startT: fvOgrodnikPos.t, startW: fvOgrodnikPos.w, startH: fvOgrodnikPos.h }; } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : _tutBlock ? "border-[#8b6a3e]/40 bg-[rgba(20,12,8,0.5)] opacity-40 cursor-not-allowed" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}`}
                    style={{ left: fvOgrodnikPos.l, top: fvOgrodnikPos.t, width: fvOgrodnikPos.w, height: fvOgrodnikPos.h }}
                  >
                    <p className="text-[20px] font-black text-[#f9e7b2] pointer-events-none leading-none mb-0.5">Ogrodnik</p>
                    <span className="pointer-events-none text-4xl leading-none">🌿</span>
                    <p className="mt-1 text-[11px] text-[#a07030] pointer-events-none leading-tight text-center px-1">sadzi na wszystkich wolnych</p>
                    {fvToolEditMode && (
                      <div className="pointer-events-none absolute bottom-1 right-1 flex flex-col items-end gap-0.5">
                        <p className="font-mono text-[8px] text-orange-300 leading-none">{fvOgrodnikPos.l},{fvOgrodnikPos.t}</p>
                        <div
                          className="pointer-events-auto h-3 w-3 cursor-se-resize rounded-sm bg-orange-400/60"
                          onMouseDown={(e) => { e.stopPropagation(); fvToolDragRef.current = { btn: "ogrodnik", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: fvOgrodnikPos.l, startT: fvOgrodnikPos.t, startW: fvOgrodnikPos.w, startH: fvOgrodnikPos.h }; }}
                        />
                      </div>
                    )}
                  </button>
                  );
                  })()}

                  {/* Zraszacz — bulk water */}
                  {(() => {
                    const _tutBlock = !fvToolEditMode && tutorialStep >= 1 && tutorialStep <= 12 && !!profile?.tutorial_started && !profile?.tutorial_completed && !profile?.tutorial_skipped;
                    return (
                  <button
                    type="button"
                    onClick={() => { if (!fvToolEditMode && !_tutBlock) handleBulkWater(); }}
                    onMouseDown={fvToolEditMode ? (e) => { e.preventDefault(); fvToolDragRef.current = { btn: "zraszacz", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: fvZraszaczPos.l, startT: fvZraszaczPos.t, startW: fvZraszaczPos.w, startH: fvZraszaczPos.h }; } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : _tutBlock ? "border-[#8b6a3e]/40 bg-[rgba(20,12,8,0.5)] opacity-40 cursor-not-allowed" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}`}
                    style={{ left: fvZraszaczPos.l, top: fvZraszaczPos.t, width: fvZraszaczPos.w, height: fvZraszaczPos.h }}
                  >
                    <p className="text-[20px] font-black text-[#f9e7b2] pointer-events-none leading-none mb-0.5">Zraszacz</p>
                    <span className="pointer-events-none text-4xl leading-none">💧</span>
                    <p className="mt-1 text-[11px] text-[#a07030] pointer-events-none leading-tight text-center px-1">podlewa wszystko co rośnie</p>
                    {fvToolEditMode && (
                      <div className="pointer-events-none absolute bottom-1 right-1 flex flex-col items-end gap-0.5">
                        <p className="font-mono text-[8px] text-orange-300 leading-none">{fvZraszaczPos.l},{fvZraszaczPos.t}</p>
                        <div
                          className="pointer-events-auto h-3 w-3 cursor-se-resize rounded-sm bg-orange-400/60"
                          onMouseDown={(e) => { e.stopPropagation(); fvToolDragRef.current = { btn: "zraszacz", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: fvZraszaczPos.l, startT: fvZraszaczPos.t, startW: fvZraszaczPos.w, startH: fvZraszaczPos.h }; }}
                        />
                      </div>
                    )}
                  </button>
                  );
                  })()}

                  {/* Kombajn — bulk harvest */}
                  {(() => {
                    const _tutBlock = !fvToolEditMode && tutorialStep >= 1 && tutorialStep <= 12 && !!profile?.tutorial_started && !profile?.tutorial_completed && !profile?.tutorial_skipped;
                    return (
                  <button
                    type="button"
                    onClick={() => { if (!fvToolEditMode && !_tutBlock) handleBulkHarvest(); }}
                    onMouseDown={fvToolEditMode ? (e) => { e.preventDefault(); fvToolDragRef.current = { btn: "kombajn", mode: "move", startMX: e.clientX, startMY: e.clientY, startL: fvKombajnPos.l, startT: fvKombajnPos.t, startW: fvKombajnPos.w, startH: fvKombajnPos.h }; } : undefined}
                    className={`absolute z-[90] flex flex-col items-center justify-center rounded-xl border-2 transition-colors ${fvToolEditMode ? "cursor-move border-orange-400 bg-orange-950/60 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : _tutBlock ? "border-[#8b6a3e]/40 bg-[rgba(20,12,8,0.5)] opacity-40 cursor-not-allowed" : "border-[#8b6a3e]/80 bg-[rgba(20,12,8,0.85)] hover:bg-[rgba(30,18,10,0.95)]"}`}
                    style={{ left: fvKombajnPos.l, top: fvKombajnPos.t, width: fvKombajnPos.w, height: fvKombajnPos.h }}
                  >
                    <p className="text-[20px] font-black text-[#f9e7b2] pointer-events-none leading-none mb-0.5">Kombajn</p>
                    <span className="pointer-events-none text-4xl leading-none">🌾</span>
                    <p className="mt-1 text-[11px] text-[#a07030] pointer-events-none leading-tight text-center px-1">zbiera wszystkie gotowe</p>
                    {fvToolEditMode && (
                      <div className="pointer-events-none absolute bottom-1 right-1 flex flex-col items-end gap-0.5">
                        <p className="font-mono text-[8px] text-orange-300 leading-none">{fvKombajnPos.l},{fvKombajnPos.t}</p>
                        <div
                          className="pointer-events-auto h-3 w-3 cursor-se-resize rounded-sm bg-orange-400/60"
                          onMouseDown={(e) => { e.stopPropagation(); fvToolDragRef.current = { btn: "kombajn", mode: "resize", startMX: e.clientX, startMY: e.clientY, startL: fvKombajnPos.l, startT: fvKombajnPos.t, startW: fvKombajnPos.w, startH: fvKombajnPos.h }; }}
                        />
                      </div>
                    )}
                  </button>
                  );
                  })()}


                  <div className="mb-4 pr-28 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-3xl font-black text-[#f9e7b2]">Pola uprawne</h2>
                      <p className="mt-2 text-lg text-[#dfcfab] font-medium leading-snug">Poruszaj się po polach myszką lub WASD. Przytrzymaj myszkę i przeciągnij po polach, aby szybko sadzić, podlewać albo zbierać.</p>
                    </div>
                    {(() => {
                      const _growing = Object.entries(plotCrops).filter(([id, p]) => p.cropId && !isCropReady(Number(id))).length;
                      const _ready = Object.entries(plotCrops).filter(([id, p]) => p.cropId && isCropReady(Number(id))).length;
                      return (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex flex-col items-center justify-center rounded-xl border border-[#c9973a]/60 bg-[rgba(14,8,2,0.85)] px-5 py-2.5 shadow-[0_0_8px_rgba(201,151,58,0.15)]">
                            <span className="text-[14px] uppercase tracking-wider text-[#a07030] font-bold leading-none">EXP</span>
                            <span className="mt-1.5 text-2xl font-black text-[#f9e7b2] leading-none">{xpPercent.toFixed(2).replace('.', ',')}%</span>
                          </div>
                          {([
                            { label: "Odblokowane", value: `${unlockedPlots.length}/100` },
                            { label: "Rośnie",      value: String(_growing) },
                            { label: "Gotowe",      value: String(_ready) },
                          ] as {label:string;value:string}[]).map(({ label, value }) => (
                            <div key={label} className="flex flex-col items-center justify-center rounded-xl border border-[#c9973a]/60 bg-[rgba(14,8,2,0.85)] px-5 py-2.5 shadow-[0_0_8px_rgba(201,151,58,0.15)]">
                              <span className="text-[14px] uppercase tracking-wider text-[#a07030] font-bold leading-none">{label}</span>
                              <span className="mt-1.5 text-2xl font-black text-[#f9e7b2] leading-none">{value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                  <div
                    ref={fhContainerRef}
                    className="relative overflow-hidden rounded-[20px] border border-[#8b6a3e] bg-black/20 flex-1"
                    onMouseMove={(e) => { if (fieldHitboxEditMode) handleFhMouseMove(e); }}
                    onMouseUp={() => { handleFhMouseUp(); }}
                    onMouseLeave={() => { handleFhMouseUp(); }}
                    style={fieldHitboxEditMode ? { userSelect: "none" } : {}}
                  >
                  <div className="relative mx-auto aspect-[1536/1092] w-full">
                    <img
                      src="/ui/farm-field-view.png"
                      alt="Widok pola 25 slotów"
                      className="h-full w-full object-contain"
                    />

                    <div
                      className="absolute inset-0"
                      onClick={(e) => {
                        const btn = (e.target as HTMLElement).closest('[data-plotid]');
                        if (!btn) { setSelectedTool(null); setSelectedSeedId(null); }
                      }}
                      onMouseMove={(e) => {
                        if (!isDraggingPlantRef.current) return;
                        // Podczas tutoriala wyłącz sweep-drag — tylko pojedyncze kliknięcia
                        if (!!profile?.id && profile.tutorial_started === true && profile.tutorial_completed !== true && profile.tutorial_skipped !== true) return;
                        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
                        const btn = el?.closest('[data-plotid]') as HTMLElement | null;
                        const _pid = btn ? Number(btn.dataset.plotid) : 0;
                        if (_pid > 0) tryApplyFieldAction(_pid);
                      }}
                    >
                      {(fieldHitboxEditMode
                        ? Array.from({length:100},(_,i)=>({ id:i+1, left:`${fhCols[i%10].toFixed(1)}%`, top:`${fhRows[Math.floor(i/10)].toFixed(1)}%`, width:`${fhCellW.toFixed(1)}%`, height:`${fhCellH.toFixed(1)}%` }))
                        : FIELD_VIEW_PLOTS
                      ).map((plot) => {
                        const plotId = plot.id;
                        const isUnlocked = isPlotUnlocked(plotId);
                        const isSelected = selectedPlotId === plotId;
                        const plotCost = getPlotUnlockCost(plotId);
                        const _pc = getPlotCrop(plotId);
                        const _tutKey = (() => {
                          if (fieldHitboxEditMode) return null;
                          if (tutorialStep === 4 && isUnlocked && !_pc.cropId && !_pc.compostBonus) return "tutorial-plot-empty";
                          if (tutorialStep === 7 && isUnlocked && !_pc.cropId && _pc.compostBonus?.type === "guide") return "tutorial-plot-compost";
                          if (tutorialStep === 9 && tutorialPlotIds.includes(plotId) && !!_pc.cropId && !isCropReady(plotId) && !_pc.watered) return "tutorial-plot-growing";
                          if (tutorialStep === 11 && tutorialPlotIds.includes(plotId) && isCropReady(plotId)) return "tutorial-plot-ready";
                          return null;
                        })();

                        return (
                          <button
                            key={plotId}
                            data-tutorial-target={_tutKey ?? undefined}
                            data-plotid={plotId}
                            type="button"
                            onDragOver={(e)=>e.preventDefault()}
                            onDrop={(e)=>{ e.preventDefault(); if(draggedSeedId && isUnlocked){ if (isGuideCompostKey(draggedSeedId)) { void applyGuideCompostToPlot(plotId); } else if (isCompostKey(draggedSeedId)) { void applyCompostToPlot(plotId, draggedSeedId); } else if (tutorialStep === 7 && getPlotCrop(plotId).compostBonus?.type !== "guide") { setMessage({ type: "info", title: "Przewodnik", text: "W przewodniku posadź marchewkę na polu z Kompostem Przewodnika." }); } else { void handlePlantFromSelectedSeed(plotId, draggedSeedId); } setDraggedSeedId(null); }}}
                            onDragStart={(e) => e.preventDefault()}
                            onMouseEnter={() => {
                              // Podczas tutoriala wyłącz sweep-drag — tylko pojedyncze kliknięcia
                              if (!!profile?.id && profile.tutorial_started === true && profile.tutorial_completed !== true && profile.tutorial_skipped !== true) return;
                              tryApplyFieldAction(plotId);
                            }}
                            onMouseDown={(e) => {
                              if (e.button !== 0) return;
                              e.preventDefault();
                              if (fieldHitboxEditMode) {
                                if ((e.target as HTMLElement).dataset.resizeHandle) return;
                                const rect = fhContainerRef.current?.getBoundingClientRect();
                                if (!rect) return;
                                const pctX = ((e.clientX - rect.left) / rect.width) * 100;
                                const pctY = ((e.clientY - rect.top) / rect.height) * 100;
                                fhDragRef.current = { startMouseX: pctX, startMouseY: pctY, startOffsetX: fhOffsetX, startOffsetY: fhOffsetY };
                                return;
                              }
                              dragEndedRef.current = false;
                              if (!isUnlocked) return;
                              const _plot = getPlotCrop(plotId);
                              let _started = false;
                              if (selectedTool === "watering_can") {
                                if (_plot.cropId && !_plot.watered && !isCropReady(plotId)) _started = true;
                              } else if (selectedTool === "sickle") {
                                if (_plot.cropId && isCropReady(plotId)) _started = true;
                              } else if (selectedSeedId && isGuideCompostKey(selectedSeedId)) {
                                if (!_plot.cropId && !_plot.compostBonus && (seedInventoryRef.current["guide_compost"] ?? 0) > 0) _started = true;
                              } else if (selectedSeedId && isCompostKey(selectedSeedId)) {
                                if (!_plot.cropId && !_plot.compostBonus && (seedInventoryRef.current[selectedSeedId] ?? 0) > 0) _started = true;
                              } else if (selectedSeedId) {
                                if (!_plot.cropId && (seedInventoryRef.current[selectedSeedId] ?? 0) > 0 && !pendingFieldActions[plotId] && !(tutorialStep === 7 && _plot.compostBonus?.type !== "guide")) _started = true;
                              } else if (_plot.cropId && isCropReady(plotId)) {
                                _started = true;
                              }
                              if (_started) {
                                isDraggingPlantRef.current = true;
                                dragPlantedFieldsRef.current = new Set([plotId]);
                                // Wykonaj akcję na pierwszym polu
                                if (selectedTool === "watering_can") void handleWaterPlot(plotId);
                                else if (selectedTool === "sickle") void handleHarvestPlot(plotId);
                                else if (selectedSeedId && isGuideCompostKey(selectedSeedId)) void applyGuideCompostToPlot(plotId);
                                else if (selectedSeedId && isCompostKey(selectedSeedId)) void applyCompostToPlot(plotId, selectedSeedId);
                                else if (selectedSeedId) void handlePlantFromSelectedSeed(plotId);
                                else void handleHarvestPlot(plotId);
                              }
                            }}
                            onClick={() => {
                              if (fieldHitboxEditMode) return;
                              setSelectedPlotId(plotId);
                              if (!isUnlocked) return;
                              // Akcja już wykonana w onMouseDown (drag) — pomiń
                              if (dragEndedRef.current) { dragEndedRef.current = false; return; }
                              if (selectedTool === "watering_can") { void handleWaterPlot(plotId); return; }
                              if (selectedTool === "sickle") { void handleHarvestPlot(plotId); return; }
                              if (selectedSeedId && isGuideCompostKey(selectedSeedId)) { void applyGuideCompostToPlot(plotId); return; }
                              if (selectedSeedId && isCompostKey(selectedSeedId)) { void applyCompostToPlot(plotId, selectedSeedId); return; }
                              if (selectedSeedId) { if (tutorialStep === 7 && getPlotCrop(plotId).compostBonus?.type !== "guide") { setMessage({ type: "info", title: "Przewodnik", text: "W przewodniku posadź marchewkę na polu z Kompostem Przewodnika." }); return; } handlePlantFromSelectedSeed(plotId); return; }
                              if (getPlotCrop(plotId).cropId && isCropReady(plotId)) void handleHarvestPlot(plotId);
                            }}
                            title={(() => {
                              if (!isUnlocked) return `Pole ${plotId} jest zablokowane`;
                              const _pc = getPlotCrop(plotId);
                              const _cb = _pc.compostBonus;
                              const _bonusLine = _cb
                                ? `\n🌿 Aktywny kompost: ${COMPOST_DEFS[_cb.type].icon} ${COMPOST_DEFS[_cb.type].name} (${COMPOST_DEFS[_cb.type].tierName(_cb.value)}) — ${COMPOST_DEFS[_cb.type].bonusLabel(_cb.value)}`
                                : "";
                              if (!_pc.cropId) {
                                return `Pole ${plotId} (puste)${_bonusLine}${_cb ? "\n→ Posadź uprawę, aby aktywować bonus." : ""}`;
                              }
                              const _cropName = CROPS.find(c => c.id === _pc.cropId)?.name ?? _pc.cropId;
                              const _qLabel = _pc.plantedQuality === "legendary" ? "Legendarna" : _pc.plantedQuality === "epic" ? "Epicka" : _pc.plantedQuality === "rotten" ? "Zepsuta" : "Zwykła";
                              const _status = isCropReady(plotId) ? " — gotowa do zbioru! 🌾" : " — rośnie...";
                              return `${_cropName} (${_qLabel})${_status}${_bonusLine}`;
                            })()}
                            className={`absolute rounded-xl transition-all duration-300 ${
                              fieldHitboxEditMode
                                ? "cursor-move border-2 border-orange-400/70 bg-orange-900/10"
                                : isUnlocked ? "cursor-pointer hover:scale-[1.02]" : "cursor-pointer opacity-90"
                            }${_tutKey ? " z-[91] ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]" : ""}${tutorialStep === 7 && isUnlocked && _pc.compostBonus?.type !== "guide" && !_pc.cropId && !fieldHitboxEditMode ? " opacity-30" : ""}`}
                            style={{
                              left: plot.left,
                              top: plot.top,
                              width: plot.width,
                              height: plot.height,
                            }}
                          >
                            {isUnlocked ? (
                              <>
                                <div
                                  className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                                    isSelected
                                      ? "bg-yellow-300/20 shadow-[0_0_32px_rgba(255,220,120,0.8)]"
                                      : "bg-yellow-300/8"
                                  }`}
                                />
                                <div
                                  className={`absolute inset-0 rounded-xl border-2 transition-all duration-300 ${
                                    isSelected
                                      ? "border-yellow-200 shadow-[0_0_24px_rgba(255,220,120,0.7)]"
                                      : "border-yellow-300/55 hover:border-yellow-200 hover:shadow-[0_0_24px_rgba(255,220,120,0.55)]"
                                  }`}
                                />
                                <div className="absolute inset-0 rounded-xl bg-yellow-400/10 opacity-70 blur-md" />

                                {getPlotCrop(plotId).cropId && (() => {
                                  const _plantedCrop = getPlantedCrop(plotId);
                                  const _stage = getGrowthStage(plotId);
                                  const _stagedSrc = _plantedCrop ? getCropStageSprite(_plantedCrop.id, _stage) : null;
                                  const _isReady = isCropReady(plotId);
                                  if (_stagedSrc) {
                                    return (
                                      <img
                                        src={_stagedSrc}
                                        alt={_plantedCrop?.name}
                                        className={`pointer-events-none absolute inset-[8%] h-[84%] w-[84%] object-contain${_isReady ? " animate-pulse" : ""}`}
                                        style={{ imageRendering: "pixelated" }}
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = _plantedCrop?.spritePath ?? "/uprawy/carrot.png"; }}
                                      />
                                    );
                                  }
                                  return (
                                    <div
                                      className={`pointer-events-none absolute inset-[8%]${_isReady ? " animate-pulse" : ""}`}
                                      style={{
                                        backgroundImage: `url('${_plantedCrop?.spritePath ?? "/uprawy/carrot.png"}')`,
                                        backgroundSize: "100% 100%",
                                        backgroundRepeat: "no-repeat",
                                        imageRendering: "pixelated",
                                      }}
                                    />
                                  );
                                })()}

                                {/* Ikona kompostu — lewy górny róg (rozmiar = 💧), duża na środku gdy puste */}
                                {(() => {
                                  const _cb = getPlotCrop(plotId).compostBonus;
                                  if (!_cb) return null;
                                  const _def = COMPOST_DEFS[_cb.type];
                                  const _tIdx = _def.bonusValues.indexOf(_cb.value);
                                  const _tColor = _tIdx === 0 ? "#9ca3af" : _tIdx === 1 ? "#fbbf24" : "#a78bfa";
                                  const _hasCrop = !!getPlotCrop(plotId).cropId;
                                  if (_hasCrop) {
                                    return (
                                      <div
                                        className="pointer-events-none absolute left-0.5 top-0.5 z-10 flex items-center rounded-full px-1 py-0.5 text-[18px] leading-none shadow-lg"
                                        style={{ background: `${_tColor}33`, border: `1px solid ${_tColor}` }}>
                                        <span>{_def.icon}</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div
                                      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                                      style={{ filter: `drop-shadow(0 0 8px ${_tColor}cc)` }}>
                                      <span className="text-4xl md:text-5xl">{_def.icon}</span>
                                      <span className="mt-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider md:text-[10px]"
                                        style={{ background: "rgba(0,0,0,0.6)", color: _tColor, border: `1px solid ${_tColor}88` }}>
                                        {_def.tierName(_cb.value)}
                                      </span>
                                    </div>
                                  );
                                })()}

                                {/* Kropla podlewania — centrum, 20% mniejsza niż poprzednio */}
                                {getPlotCrop(plotId).watered && (
                                  <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 px-1 py-0.5 text-[14px] leading-none">
                                    💧
                                  </div>
                                )}

                                {/* Badge jakości — prawy górny róg (tylko gdy posadzone) */}
                                {(() => {
                                  const _pq = getPlotCrop(plotId).plantedQuality;
                                  if (!getPlotCrop(plotId).cropId) return null;
                                  if (_pq === "epic") return (
                                    <div className="pointer-events-none absolute right-0.5 top-0.5 z-10 animate-pulse rounded px-0.5 py-px text-[8px] font-black leading-tight tracking-wide"
                                      style={{ background: "rgba(88,28,135,0.70)", border: "1px solid rgba(167,139,250,0.65)", color: "#d8b4fe", textShadow: "0 0 5px rgba(167,139,250,0.9)" }}>
                                      EPIC
                                    </div>
                                  );
                                  if (_pq === "legendary") return (
                                    <div className="pointer-events-none absolute right-0.5 top-0.5 z-10 animate-pulse rounded px-0.5 py-px text-[8px] font-black leading-tight tracking-wide"
                                      style={{ background: "rgba(120,53,15,0.70)", border: "1px solid rgba(251,191,36,0.65)", color: "#fde68a", textShadow: "0 0 5px rgba(251,191,36,0.9)" }}>
                                      Legend
                                    </div>
                                  );
                                  return null;
                                })()}

                                {/* Overlay kolejki zbioru — widoczny gdy pole czeka w kolejce, zanim pasek postępu wystartuje */}
                                {queuedHarvestPlotIds.has(plotId) && !pendingFieldActions[plotId] && (
                                  <div className="pointer-events-none absolute inset-0 z-[15] rounded-xl" style={{
                                    background: "rgba(251,146,60,0.18)",
                                    boxShadow: "inset 0 0 0 2.5px rgba(251,146,60,0.75)",
                                  }}>
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                                      <div className="text-[10px] font-black uppercase tracking-wider" style={{
                                        color: "#fb923c",
                                        textShadow: "0 0 4px rgba(0,0,0,0.95)",
                                      }}>
                                        Kolejka...
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Overlay kolejki sadzenia */}
                                {queuedPlantPlotIds.has(plotId) && !pendingFieldActions[plotId] && (
                                  <div className="pointer-events-none absolute inset-0 z-[15] rounded-xl" style={{
                                    background: "rgba(134,239,172,0.18)",
                                    boxShadow: "inset 0 0 0 2.5px rgba(134,239,172,0.75)",
                                  }}>
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                                      <div className="text-[10px] font-black uppercase tracking-wider" style={{
                                        color: "#86efac",
                                        textShadow: "0 0 4px rgba(0,0,0,0.95)",
                                      }}>
                                        Kolejka...
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Overlay kolejki podlewania */}
                                {queuedWaterPlotIds.has(plotId) && !pendingFieldActions[plotId] && (
                                  <div className="pointer-events-none absolute inset-0 z-[15] rounded-xl" style={{
                                    background: "rgba(96,165,250,0.18)",
                                    boxShadow: "inset 0 0 0 2.5px rgba(96,165,250,0.75)",
                                  }}>
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                                      <div className="text-[10px] font-black uppercase tracking-wider" style={{
                                        color: "#60a5fa",
                                        textShadow: "0 0 4px rgba(0,0,0,0.95)",
                                      }}>
                                        Kolejka...
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Pasek postępu sadzenia/zbioru */}
                                {pendingFieldActions[plotId] && (() => {
                                  const _act = pendingFieldActions[plotId];
                                  const _elapsed = Math.max(0, Date.now() - _act.startMs);
                                  const _pct = Math.min(100, Math.max(0, (_elapsed / _act.durationMs) * 100));
                                  const _isPlant = _act.kind === "plant";
                                  const _isWater = _act.kind === "water";
                                  const _color = _isPlant ? "#22d3ee" : _isWater ? "#60a5fa" : "#fbbf24";
                                  const _glow = _isPlant ? "rgba(34,211,238,0.7)" : _isWater ? "rgba(96,165,250,0.7)" : "rgba(251,191,36,0.7)";
                                  const _label = _isPlant ? "Sadzenie..." : _isWater ? "Podlewanie..." : "Zbiór...";
                                  return (
                                    <>
                                      <div className="pointer-events-none absolute inset-0 z-[15] rounded-xl bg-black/35" />
                                      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[16] -translate-x-1/2 -translate-y-1/2 text-center">
                                        <div className="mb-1 text-[10px] font-black uppercase tracking-wider drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]"
                                          style={{ color: _color }}>
                                          {_label}
                                        </div>
                                        <div className="h-1.5 w-[70%] mx-auto overflow-hidden rounded-full border border-black/40 bg-black/60">
                                          <div
                                            className="h-full transition-[width] duration-75 ease-linear"
                                            style={{
                                              width: `${_pct}%`,
                                              background: _color,
                                              boxShadow: `0 0 6px ${_glow}`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}

                                <div className="absolute inset-x-1 bottom-1 z-10 text-center">
                                  {getPlotCrop(plotId).cropId ? (
                                    <span className="rounded-md bg-black/45 px-1 py-0.5 text-[13px] font-bold text-white/90 sm:px-1.5 sm:text-[15px]">
                                      {isCropReady(plotId)
                                        ? "Gotowe"
                                        : formatHMS(getRemainingGrowthSeconds(plotId))}
                                    </span>
                                  ) : (
                                    <span className="text-sm font-black text-white drop-shadow-[0_0_8px_rgba(255,220,120,0.9)] md:text-base">
                                      {plotId}
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div
                                  className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                                    isSelected ? "bg-black/45" : "bg-black/30"
                                  }`}
                                />
                                <div
                                  className={`absolute inset-0 rounded-xl border-2 transition-all duration-300 ${
                                    isSelected ? "border-yellow-200/60" : "border-white/12"
                                  }`}
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center px-0.5 text-center">
                                  {(() => {
                                    const _ot = getPlotObstacleType(plotId);
                                    const _od = _ot ? OBSTACLE_DEFS[_ot] : null;
                                    const _obstacleImgMap: Record<string, readonly string[]> = {
                                      chwasty:   CHWASTY_IMGS,
                                      kret:      KRET_IMGS,
                                      maly_pien: PIEN_IMGS,
                                      duzy_pien: DRZEWO_IMGS,
                                      kamienie:  KAMIENIE_IMGS,
                                    };
                                    const _imgs = _ot ? _obstacleImgMap[_ot] : null;
                                    if (_imgs) {
                                      return (
                                        <>
                                          <img src={_imgs[plotId % 3]} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" />
                                          <span className="relative z-10 text-[16px] font-black text-amber-300 leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{plotCost} PLN</span>
                                        </>
                                      );
                                    }
                                    return _od ? (
                                      <>
                                        <span className="text-[21px] leading-none">{_od.icon}</span>
                                        <span className="mt-0.5 text-[13px] font-bold leading-tight" style={{ color: _od.color }}>{_od.name}</span>
                                        <span className="text-[12px] font-black text-amber-300 leading-none">{plotCost} PLN</span>
                                      </>
                                    ) : (
                                      <span className="text-[13px] font-bold uppercase leading-tight text-[#f5dfb0]">
                                        {plotCost} PLN
                                      </span>
                                    );
                                  })()}
                                </div>
                              </>
                            )}
                            {fieldHitboxEditMode && (
                              <div
                                data-resize-handle="1"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const rect = fhContainerRef.current?.getBoundingClientRect();
                                  if (!rect) return;
                                  const pctX = ((e.clientX - rect.left) / rect.width) * 100;
                                  const pctY = ((e.clientY - rect.top) / rect.height) * 100;
                                  fhResizeRef.current = { startMouseX: pctX, startMouseY: pctY, startW: fhCellW, startH: fhCellH };
                                }}
                                className="absolute bottom-0 right-0 z-50 h-4 w-4 cursor-se-resize rounded-tl-md bg-orange-500 opacity-80 hover:opacity-100"
                                title="Przeciągnij, aby zmienić rozmiar"
                              />
                            )}
                          </button>
                        );
                      })}


                      {selectedPlotId && (
                        <>
                          {(() => {
                            const selectedPlotUnlocked = isPlotUnlocked(selectedPlotId);
                            const selectedPlotCost = getPlotUnlockCost(selectedPlotId);

                            if (selectedPlotUnlocked) {
                              const activePlot = FIELD_VIEW_PLOTS.find((plot) => plot.id === selectedPlotId);
                              if (!activePlot) return null;

                              // Oblicz etykietę — jeśli nie ma żadnej akcjonalnej wskazówki, nie renderuj tooltipa.
                              // "Wybierz nasiono" NIE pojawia się tu: jest obsłużone przez setMessage w confirmSelectedPlot.
                              const _plotReady = getPlotCrop(selectedPlotId).cropId && isCropReady(selectedPlotId);
                              const _hintText = selectedTool === "watering_can"
                                ? "Kliknij pole, aby podlać"
                                : selectedTool === "sickle"
                                ? "Kliknij gotową uprawę, aby zebrać"
                                : (selectedSeedId && (isCompostKey(selectedSeedId) || isGuideCompostKey(selectedSeedId)))
                                ? "Kliknij puste pole, aby zastosować kompost"
                                : selectedSeedId
                                ? `Kliknij pole, aby posadzić ${CROPS.find((c) => c.id === parseQualityKey(selectedSeedId).baseCropId)?.name ?? "roślinę"}`
                                : _plotReady
                                ? "Enter lub kliknij pole, aby zebrać"
                                : null;

                              if (!_hintText) return null;

                              return (
                                <div className="pointer-events-none absolute inset-0">
                                  <div
                                    className="pointer-events-none absolute z-20 rounded-2xl border border-[#8b6a3e] bg-[rgba(24,14,8,0.92)] px-3 py-2 text-xs font-bold text-[#f3e6c8] shadow-2xl"
                                    style={{
                                      left: `calc(${activePlot.left} + ${activePlot.width} + 0.8%)`,
                                      top: activePlot.top,
                                    }}
                                  >
                                    {_hintText}
                                  </div>
                                </div>
                              );
                            }

                            const _obstType = getPlotObstacleType(selectedPlotId);
                            const _obstDef = _obstType ? OBSTACLE_DEFS[_obstType] : null;
                            // Brak danych przeszkody: pole > 20 nie jest odblokowane i nie ma wpisu w plot_obstacles
                            const _isMissingObstacle = selectedPlotId > 20 && !_obstType && !isPlotUnlocked(selectedPlotId);
                            return (
                              <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/50 px-4">
                                <div className="w-full max-w-md rounded-[28px] border border-[#c79b48] bg-[linear-gradient(180deg,rgba(66,39,17,0.98),rgba(34,20,10,0.98))] p-6 text-[#f7e7bf] shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
                                  {_isMissingObstacle ? (
                                    <>
                                      <p className="text-xs uppercase tracking-[0.35em] text-yellow-400">Brak danych przeszkody</p>
                                      <h2 className="mt-3 text-2xl font-black text-[#fff1c7]">Pole #{selectedPlotId}</h2>
                                      <p className="mt-2 text-sm text-[#f2ddb0] leading-relaxed">
                                        Brak danych przeszkody dla tego pola. Kliknij "Napraw", aby odświeżyć stan pól.
                                      </p>
                                      <div className="mt-6 flex justify-end gap-3">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedPlotId(null)}
                                          className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-5 py-2 text-sm font-bold text-[#f3e6c8] transition hover:bg-[rgba(20,12,8,0.8)]"
                                        >
                                          Anuluj
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!profile?.id) return;
                                            const { data: freshRow } = await supabase
                                              .from("profiles")
                                              .select("unlocked_plots, plot_obstacles")
                                              .eq("id", profile.id)
                                              .single();
                                            if (!freshRow) return;
                                            const freshUnlocked = parseUnlockedPlots(freshRow.unlocked_plots);
                                            const freshObstacles: Record<string, { type: string; cost: number }> =
                                              freshRow.plot_obstacles && typeof freshRow.plot_obstacles === "object" && !Array.isArray(freshRow.plot_obstacles)
                                                ? (freshRow.plot_obstacles as Record<string, { type: string; cost: number }>)
                                                : {};
                                            if (freshUnlocked.includes(selectedPlotId)) {
                                              // Prawdziwy desync — pole jest odblokowane w DB
                                              setUnlockedPlots(freshUnlocked);
                                              setPlotObstacles(freshObstacles);
                                              setSelectedPlotId(null);
                                              setMessage({ type: "info", title: "Stan zsynchronizowany", text: `Pole #${selectedPlotId} jest odblokowane — stan naprawiony.` });
                                            } else if (!freshObstacles[String(selectedPlotId)]) {
                                              // Brak przeszkody — wywołaj RPC repair po stronie serwera
                                              await supabase.rpc("game_repair_plot_obstacles", { p_user_id: profile.id });
                                              const { data: repairedRow } = await supabase
                                                .from("profiles")
                                                .select("unlocked_plots, plot_obstacles")
                                                .eq("id", profile.id)
                                                .single();
                                              if (repairedRow) {
                                                setUnlockedPlots(parseUnlockedPlots(repairedRow.unlocked_plots));
                                                if (repairedRow.plot_obstacles && typeof repairedRow.plot_obstacles === "object" && !Array.isArray(repairedRow.plot_obstacles)) {
                                                  setPlotObstacles(repairedRow.plot_obstacles as Record<string, { type: string; cost: number }>);
                                                }
                                              }
                                              setSelectedPlotId(null);
                                              setMessage({ type: "info", title: "Przeszkoda uzupełniona", text: `Dane pola #${selectedPlotId} zostały odświeżone.` });
                                            } else {
                                              setUnlockedPlots(freshUnlocked);
                                              setPlotObstacles(freshObstacles);
                                              setSelectedPlotId(null);
                                            }
                                          }}
                                          className="rounded-2xl border border-yellow-400/80 bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                                        >
                                          Napraw stan pola
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Zablokowane pole</p>
                                      <h2 className="mt-3 text-2xl font-black text-[#fff1c7]">Pole #{selectedPlotId}</h2>
                                      {_obstDef ? (
                                        <p className="mt-2 text-base text-[#f2ddb0]">
                                          Przeszkoda: <span style={{ color: _obstDef.color }} className="font-black">{_obstDef.icon} {_obstDef.name}</span>
                                        </p>
                                      ) : null}
                                      <p className="mt-2 text-base text-[#f2ddb0]">
                                        Koszt usunięcia: <span className="font-black text-amber-300">{selectedPlotCost} PLN</span>
                                      </p>
                                      {displayMoney < selectedPlotCost && (
                                        <p className="mt-2 text-sm text-red-300">Masz za mało pieniędzy na to pole.</p>
                                      )}
                                      <div className="mt-6 flex justify-end gap-3">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedPlotId(null)}
                                          className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-5 py-2 text-sm font-bold text-[#f3e6c8] transition hover:bg-[rgba(20,12,8,0.8)]"
                                        >
                                          Anuluj
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPlotToBuy(selectedPlotId)}
                                          className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                                          disabled={displayMoney < selectedPlotCost}
                                        >
                                          {_obstDef ? `${_obstDef.icon} Usuń: ${selectedPlotCost} PLN` : `Odblokuj: ${selectedPlotCost} PLN`}
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>

                    {plotToBuy !== null && (
                      <div className="absolute inset-0 z-[95] flex items-center justify-center bg-black/60 px-4">
                        <div className="w-full max-w-md rounded-[28px] border border-[#c79b48] bg-[linear-gradient(180deg,rgba(66,39,17,0.98),rgba(34,20,10,0.98))] p-6 text-[#f7e7bf] shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
                          {(() => {
                            const _ot2 = getPlotObstacleType(plotToBuy);
                            const _od2 = _ot2 ? OBSTACLE_DEFS[_ot2] : null;
                            const _cost2 = getPlotUnlockCost(plotToBuy);
                            return (
                              <>
                                <p className="text-xs uppercase tracking-[0.35em] text-[#d8ba7a]">Potwierdzenie usunięcia przeszkody</p>
                                <h2 className="mt-3 text-2xl font-black text-[#fff1c7]">Pole #{plotToBuy}</h2>
                                {_od2 && (
                                  <p className="mt-2 text-base text-[#f2ddb0]">
                                    Przeszkoda: <span style={{ color: _od2.color }} className="font-black">{_od2.icon} {_od2.name}</span>
                                  </p>
                                )}
                                <p className="mt-2 text-base leading-7 text-[#f2ddb0]">
                                  Koszt usunięcia: <span className="font-black text-amber-300">{_cost2} PLN</span>
                                </p>

                                <div className="mt-6 flex justify-end gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setPlotToBuy(null)}
                                    className="rounded-2xl border border-[#8b6a3e] bg-[rgba(20,12,8,0.65)] px-5 py-2 text-sm font-bold text-[#f3e6c8] transition hover:bg-[rgba(20,12,8,0.8)]"
                                  >
                                    Anuluj
                                  </button>
                                  <button
                                    type="button"
                                    onClick={confirmBuyPlot}
                                    className="rounded-2xl border border-[#f4cf78] bg-[linear-gradient(180deg,#f2ca69,#c9952f)] px-5 py-2 text-sm font-black text-[#2f1b0c] shadow-lg transition hover:brightness-105"
                                  >
                                    {_od2 ? `${_od2.icon} Usuń` : "Odblokuj"}: {_cost2} PLN
                                  </button>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          {/* Tutorial overlay wewnątrz field view — przyciemnia tło, narzędzia z-[90] zostają widoczne */}
          {!!profile?.id && profile.tutorial_started === true && profile.tutorial_completed !== true && profile.tutorial_skipped !== true && tutorialStep >= 2 && tutorialStep <= 11 && (
            <div className="absolute inset-0 z-[89] pointer-events-none" style={{ background: "rgba(0,0,0,0.35)" }} />
          )}
          </div>
        )}



          {/* ═══ MODAL — SESJA ZBIORÓW ═══ */}
          {isFvHarvestModalOpen && isFieldViewOpen && (
            <HarvestSessionModal
              harvestLog={harvestLog}
              isDailyHarvestView={isDailyHarvestView}
              setIsDailyHarvestView={setIsDailyHarvestView}
              isDailyHarvestLoading={isDailyHarvestLoading}
              dailyHarvestData={dailyHarvestData}
              fetchDailyHarvest={fetchDailyHarvest}
              setIsFvHarvestModalOpen={setIsFvHarvestModalOpen}
              tutorialStep={tutorialStep}
              advanceTutorialStep={advanceTutorialStep}
              setHarvestLog={setHarvestLog}
              fvHarvestTooltip={fvHarvestTooltip}
              setFvHarvestTooltip={setFvHarvestTooltip}
              setFvQualityTip={setFvQualityTip}
              gameScale={gameScale}
              effectiveStats={effectiveStats}
              charEquipped={charEquipped}
              hiveData={hiveData}
            />
          )}

          {/* Fixed tooltip dla ikon jakości w tutorialu krok 12 — fixed ignoruje overflow-hidden */}
          {fvQualityTip && (
            <div
              className="pointer-events-none fixed z-[9999] rounded-xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-4 py-2.5 shadow-2xl"
              style={{ left: fvQualityTip.sx, top: fvQualityTip.sy - 8, transform: "translateX(-50%) translateY(-100%)" }}
            >
              <p className="text-[15px] font-black text-[#d8ba7a] mb-0.5">{fvQualityTip.label}</p>
              <p className="text-[13px] text-[#f9e7b2]">EXP: <span className="font-bold text-sky-300">{fvQualityTip.expLabel}</span></p>
              <p className="text-[13px] text-[#8b6a3e]">Szansa: {fvQualityTip.chance}</p>
            </div>
          )}

          {/* ═══ POPUP POTWIERDZENIA WYLOGOWANIA (Esc na farmie) ═══ */}
          {showSettingsModal && (
            <SettingsModal
              gameSettings={gameSettings}
              saveGameSettings={saveGameSettings}
              onClose={() => setShowSettingsModal(false)}
              onOpenLogout={() => { setShowSettingsModal(false); setShowLogoutConfirm(true); }}
              userZoomFactor={userZoomFactor}
              setUserZoomFactor={setUserZoomFactor}
            />
          )}

          {showLogoutConfirm && (
            <LogoutConfirmModal
              onClose={() => setShowLogoutConfirm(false)}
              onConfirm={() => { setShowLogoutConfirm(false); void handleLogout(); }}
            />
          )}

        </div>
      </div>
      {/* ═══ TOAST / POWIADOMIENIE ═══ — poza z-[1] żeby działał nad wszystkimi modalami */}
      {message && (() => {
        const isErr = message.type === 'error';
        const isOk = message.type === 'success';
        const colorWrap = isErr
          ? 'border-red-400/60 bg-gradient-to-br from-red-950/95 to-red-900/90 text-red-50 shadow-[0_20px_60px_-10px_rgba(239,68,68,0.4)]'
          : isOk
          ? 'border-emerald-400/60 bg-gradient-to-br from-emerald-950/95 to-emerald-900/90 text-emerald-50 shadow-[0_20px_60px_-10px_rgba(16,185,129,0.4)]'
          : 'border-sky-400/60 bg-gradient-to-br from-sky-950/95 to-sky-900/90 text-sky-50 shadow-[0_20px_60px_-10px_rgba(56,189,248,0.4)]';
        const barColor = isErr ? 'bg-red-400' : isOk ? 'bg-emerald-400' : 'bg-sky-400';
        const icon = isErr ? '⚠️' : isOk ? '✅' : 'ℹ️';
        const durMs = isErr ? 8000 : 6000;
        if (message.fieldOnly && !isFieldViewOpen) return null;
        return (
          <div
            key={`${message.title}-${message.text}`}
            className="fixed bottom-6 left-4 z-[9999] w-[min(92vw,480px)] pointer-events-none"
            style={{ animation: 'plonopolisToastInLeft 280ms cubic-bezier(0.16,1,0.3,1)' }}
          >
            <div className={`pointer-events-auto relative overflow-hidden rounded-2xl border-2 backdrop-blur-md ${colorWrap}`}>
              <button
                onClick={() => setMessage(null)}
                aria-label="Zamknij powiadomienie"
                className="absolute right-2 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/80 text-sm font-black transition hover:bg-black/60 hover:text-white"
              >
                ✕
              </button>
              <div className="flex items-center gap-3 px-4 py-3 pr-10">
                <span className="text-2xl shrink-0 leading-none">{icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-extrabold leading-tight">{message.title}</p>
                  {message.text && <p className="mt-1 text-sm opacity-90 leading-snug">{message.text}</p>}
                </div>
              </div>
              {/* Pasek postępu zanikania */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/25">
                <div
                  className={`h-full ${barColor}`}
                  style={{ animation: `plonopolisToastBar ${durMs}ms linear forwards` }}
                />
              </div>
            </div>
            <style>{`
              @keyframes plonopolisToastIn {
                from { opacity: 0; transform: translate(-50%, -16px) scale(0.96); }
                to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
              }
              @keyframes plonopolisToastInLeft {
                from { opacity: 0; transform: translateY(-12px) scale(0.96); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
              @keyframes plonopolisToastBar {
                from { width: 100%; }
                to   { width: 0%; }
              }
            `}</style>
          </div>
        );
      })()}
    {/* Tooltip sierpa podążający za kursorem */}
      {hoveredSickle && (
        <div
          className="pointer-events-none fixed z-[10000] w-72 rounded-[18px] border border-yellow-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={ttStyle(mousePos.x, mousePos.y, 300, 270)}
        >
          <p className="mb-1 font-black text-yellow-300">Sierp — Zbierz</p>
          <p className="mb-3 text-[18px] text-[#8b6a3e]">Bonusy aktywne przy zbiorze dojrzałej uprawy</p>
          <p className="mb-1">Szansa na podwójny zbiór <span className="font-bold text-yellow-300">(+{calcStatEffect(effectiveStats.zrecznosc + getEquipFlatBonus(" pkt Zrecznosci", charEquipped), 0.004).toFixed(1)}%)</span></p>
          <p className="text-[16px] text-[#8b6a3e] mb-2">Zręczność: {effectiveStats.zrecznosc} stat + {getEquipFlatBonus(" pkt Zrecznosci", charEquipped)} pkt z eq</p>
          <p className="mb-1">Szansa na bonusowy drop <span className="font-bold text-green-300">(+{calcStatEffect(effectiveStats.szczescie + getEquipFlatBonus(" pkt Szczescia", charEquipped), 0.0025).toFixed(1)}%)</span></p>
          <p className="text-[16px] text-[#8b6a3e] mb-2">Szczęście: {effectiveStats.szczescie} stat + {getEquipFlatBonus(" pkt Szczescia", charEquipped)} pkt z eq</p>
          <p className="text-[15px] text-yellow-200/70">🍀 Szczęście zmniejsza szansę na popsute plony i zwiększa szansę na epickie oraz legendarne.</p>
        </div>
      )}
    {/* Tooltip Ul — zablokowany */}
      {hoveredHiveLock && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-yellow-500/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-yellow-300">Ul — zablokowany</p>
          <p className="mb-1">Wymaga: <span className="font-bold text-yellow-300">{HIVE_UNLOCK_LVL} poziom gracza</span></p>
          <p className="mt-2 text-[16px] text-[#8b6a3e]">Po odblokowaniu: ul kosztuje {HIVE_BUY_COST} zł, pszczoła {BEE_COST} zł.</p>
        </div>
      )}
    {/* Tooltip Stodoła — zablokowana */}
      {hoveredBarnLock && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-700/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-amber-400">Stodoła — zablokowana</p>
          <p className="mb-1">Wymaga: <span className="font-bold text-amber-400">{BARN_UNLOCK_LVL} poziom gracza</span></p>
          <p className="mt-2 text-[16px] text-[#8b6a3e]">Po odblokowaniu: pierwsze zwierzę to Kura (600 zł).</p>
        </div>
      )}
    {/* Tooltip Sad — zablokowany */}
      {hoveredSadLock && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-green-600/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-green-400">Sad — zablokowany</p>
          <p className="mb-1">Wymaga: <span className="font-bold text-green-400">{SAD_UNLOCK_LVL} poziom gracza</span></p>
          <p className="mt-2 text-[16px] text-[#8b6a3e]">Drzewa kupisz w Sklepie po odblokowaniu.</p>
        </div>
      )}
    {/* Tooltip Stodoła (odblokowana) */}
      {hoveredStodola && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-700/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-amber-400">Stodoła</p>
          <p className="mb-1 text-[18px]">Hoduj zwierzęta i zbieraj ich produkty.</p>
          <p className="text-[16px] text-[#8b6a3e]">Kury, świnie, krowy i inne — każde zwierzę daje inne surowce.</p>
        </div>
      )}
    {/* Tooltip Ul (odblokowany) */}
      {hoveredUl && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-yellow-500/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-yellow-300">Ul</p>
          <p className="mb-1 text-[18px]">Hoduj pszczoły i produkuj miód.</p>
          <p className="text-[16px] text-[#8b6a3e]">Miód sprzedasz klientom przy Ladzie lub w Targu w mieście.</p>
        </div>
      )}
    {/* Tooltip Sad (odblokowany) */}
      {hoveredSad && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-green-600/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-green-400">Sad</p>
          <p className="mb-1 text-[18px]">Uprawiaj drzewa owocowe i zbieraj owoce.</p>
          <p className="text-[16px] text-[#8b6a3e]">Drzewa kupisz w Sklepie — jabłonie, grusze, śliwy i inne.</p>
        </div>
      )}
    {/* Tooltip Lada — zablokowana */}
      {hoveredLadaLock && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-orange-500/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-orange-300">Lada dla klientów — zablokowana</p>
          <p className="mb-1">Wymaga: <span className="font-bold text-orange-300">{LADA_UNLOCK_LVL} poziom gracza</span></p>
          <p className="mt-2 text-[16px] text-[#8b6a3e]">Po odblokowaniu: obsługuj klientów i zdobywaj złoto, EXP oraz bonusy.</p>
        </div>
      )}
    {/* Tooltip Lada dla klientów */}
      {hoveredLada && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-[320px] rounded-[18px] border border-orange-500/80 bg-[rgba(28,16,8,0.97)] p-5 text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 text-xl font-black text-orange-300">Lada dla klientów</p>
          <p className="mb-1 text-[19px]">Obsługuj klientów i sprzedawaj miód.</p>
          <p className="text-[17px] text-[#8b6a3e]">Klienci przychodzą regularnie — odpowiadaj na zamówienia i sprzedawaj im swoje produkty.</p>
        </div>
      )}
    {/* Tooltip Dom */}
      {hoveredDom && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-rose-600/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-rose-300">Dom gracza</p>
          <p className="mb-1 text-[18px]">Twój profil, statystyki i ekwipunek.</p>
          <p className="text-[16px] text-[#8b6a3e]">Znajdziesz tu poziom, EXP, PLN oraz zarządzanie postacią.</p>
        </div>
      )}
    {/* Tooltip Kompostownik — zablokowany */}
      {hoveredKompostLock && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-teal-600/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-teal-300">Kompostownik — zablokowany</p>
          <p className="mb-1">Wymaga: <span className="font-bold text-teal-300">{KOMPOST_UNLOCK_LVL} poziom gracza</span></p>
          <p className="mt-2 text-[16px] text-[#8b6a3e]">Po odblokowaniu: przerabiaj resztki i zgniłe plony na kompost.</p>
        </div>
      )}
    {/* Tooltip Kompostownik */}
      {hoveredKompostownik && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-teal-600/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-teal-300">Kompostownik</p>
          <p className="mb-1 text-[18px]">Przetwarzaj odpadki w kompost.</p>
          <p className="mb-1 text-[16px] text-[#8b6a3e]">Kompost przyspiesza wzrost upraw i zwiększa plony na polu.</p>
          <p className="text-[16px] text-teal-600">Każde użycie daje % szansę na losowy przedmiot specjalny.</p>
        </div>
      )}
    {/* Tooltip Pola uprawne */}
      {hoveredPolaUprawne && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-lime-600/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-lime-400">Pola uprawne</p>
          <p className="text-[18px]">Sadź, podlewaj i zbieraj plony.</p>
        </div>
      )}
    {/* Tooltip Do miasta — zablokowane */}
      {hoveredCityLock && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-sky-600/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-sky-300">Miasto — zablokowane</p>
          <p className="mb-1">Wymaga: <span className="font-bold text-sky-300">{CITY_UNLOCK_LVL} poziom gracza</span></p>
          <p className="mt-2 text-[16px] text-[#8b6a3e]">Po odblokowaniu: odwiedzisz sklep, targ, bank i ranking.</p>
        </div>
      )}
    {/* Tooltip Do miasta */}
      {hoveredDoMiasta && isOnFarmMap && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-sky-500/80 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-sky-300">Do miasta</p>
          <p className="mb-1 text-[18px]">Przejdź do centrum Plonopolis.</p>
          <p className="text-[16px] text-[#8b6a3e]">W mieście znajdziesz Sklep, Targ, Bank i Ratusz.</p>
        </div>
      )}
    {/* Tooltips — Miasto */}
      {hoveredNaFarme && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-lime-600 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-lime-400">Na farmę</p>
          <p className="mb-1 text-[18px]">Wróć do swojej farmy.</p>
          <p className="text-[16px] text-[#8b6a3e]">Siej, podlewaj i zbieraj plony na polach uprawnych.</p>
        </div>
      )}
      {hoveredSklep && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-amber-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-amber-300">Sklep</p>
          <p className="mb-1 text-[18px]">Kup nasiona, drzewa i zwierzęta.</p>
          <p className="text-[16px] text-[#8b6a3e]">Szeroki asortyment nasion każdej jakości, sadzonki drzew owocowych i ekwipunek.</p>
        </div>
      )}
      {hoveredTarg && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-orange-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-orange-300">Targ</p>
          <p className="mb-1 text-[18px]">Sprzedaj swoje plony i owoce.</p>
          <p className="text-[16px] text-[#8b6a3e]">Ceny na targu zmieniają się dynamicznie — sprawdzaj regularnie, by sprzedawać drożej.</p>
        </div>
      )}
      {hoveredBank && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-yellow-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-yellow-300">Bank</p>
          <p className="mb-1 text-[18px]">Zarządzaj swoimi finansami.</p>
          <p className="text-[16px] text-[#8b6a3e]">Lokaty i pożyczki — pomnażaj oszczędności lub finansuj rozwój farmy.</p>
        </div>
      )}
      {hoveredRatusz && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-purple-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-purple-300">Ratusz</p>
          <p className="mb-1 text-[18px]">Rankingi i osiągnięcia graczy.</p>
          <p className="text-[16px] text-[#8b6a3e]">Sprawdź tablicę wyników i porównaj swoje postępy z innymi farmerami Plonopolis.</p>
        </div>
      )}
      {hoveredLiga && currentMap === "city" && !!profile && (
        <div className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-green-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm" style={ttStyle(mousePos.x, mousePos.y)}>
          <p className="mb-2 font-black text-green-300">Liga Farmerów</p>
          <p className="mb-1 text-[18px]">Rywalizuj z innymi farmerami.</p>
          <p className="text-[16px] text-[#8b6a3e]">Sezony, nagrody i rankingi ligowe — pokaż, że jesteś najlepszym farmerem w Plonopolis.</p>
        </div>
      )}
    {/* Tooltip konewki podążający za kursorem */}
      {hoveredWateringCan && (
        <div
          className="pointer-events-none fixed z-[10000] w-72 rounded-[18px] border border-cyan-500 bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={ttStyle(mousePos.x, mousePos.y, 300, 270)}
        >
          <p className="mb-1 font-black text-cyan-300">Konewka</p>
          <p className="mb-2 text-[18px] text-[#8b6a3e]">Skraca czas wzrostu — min 5% zawsze, rośnie z Zaradnością i pkt Zaradności z ekwipunku (addytywnie, bez limitu)</p>
          <p>Skraca czas wzrostu o <span className="font-bold text-cyan-300">{(() => {
            const _zaradEff = effectiveStats.zaradnosc + getEquipFlatBonus(" pkt Zaradnosci", charEquipped);
            const _zb = calcStatEffect(_zaradEff, ZARADNOSC_RATE) / 100;
            const _we = getEquipBonusPct("% efekt podlewania", charEquipped) / 100;
            return ((WATER_BASE + _zb + _we) * 100).toFixed(1);
          })()}%</span> (Zaradność efektywna: {effectiveStats.zaradnosc + getEquipFlatBonus(" pkt Zaradnosci", charEquipped)}/100)</p>
          <p className="mt-1">Roślinę można podlać <span className="font-bold text-yellow-300">max 1 raz</span></p>
        </div>
      )}
    {/* Tooltip uprawy podążający za kursorem */}
      {hoveredCrop && (
        <div
          className="pointer-events-none fixed z-[999] w-72 rounded-[18px] border border-[#8b6a3e] bg-[rgba(28,16,8,0.97)] p-4 text-[21px] text-[#dfcfab] shadow-2xl backdrop-blur-sm"
          style={ttStyle(mousePos.x, mousePos.y)}
        >
          <p className="mb-1 font-black text-[#f9e7b2]">
            {hoveredCrop.name}
            {hoveredSeedQuality === "legendary" && <span className="ml-1 text-[14px] font-black text-[#f59e0b]">🌟 Legendarna</span>}
            {hoveredSeedQuality === "epic" && <span className="ml-1 text-[14px] font-black text-[#22c55e]">⭐ Epicka</span>}
            {hoveredSeedQuality === "good" && <span className="ml-1 text-[14px] font-black text-emerald-300">✅ Zwykła</span>}
            {hoveredSeedQuality === "rotten" && <span className="ml-1 text-[14px] font-black text-white">⚠️ Popsuta</span>}
          </p>
          <p className="mb-1 text-[14px] text-[#8b6a3e]">
            {hoveredSeedQuality === "legendary" ? `Legendarne nasiono — każda z ${hoveredCrop.yieldAmount <= 2 ? "20–60" : "40–120"} sztuk losuje jakość osobno + EXP ×10–20!` : hoveredSeedQuality === "epic" ? `Epickie nasiono — każda z ${hoveredCrop.yieldAmount <= 2 ? "10–22" : "20–44"} sztuk losuje jakość osobno + EXP ×3–6` : hoveredSeedQuality === "rotten" ? "Zepsute — nie można zasadzić, nadaje się jedynie jako kompost lub do zadań specjalnych." : "Zwykłe nasiono"}
          </p>
          {hoveredSeedQuality !== "rotten" && <>
            {(() => {
              const _baseMs = hoveredCrop.growthTimeMs;
              // Te same wzory co w getEffectiveGrowthTimeMs (bez bonusów per-pole: woda/kompost)
              const _wiedzaEff   = (effectiveStats.wiedza ?? 0) + getEquipFlatBonus(" pkt Wiedzy", charEquipped);
              const _wiedzaPctRaw = calcStatEffect(_wiedzaEff, WIEDZA_RATE); // % redukcji surowy
              const _wiedzaPct   = Math.min((1 - WIEDZA_MULT_MIN) * 100, _wiedzaPctRaw); // cap
              const _hivePct     = Math.min((1 - HIVE_MULT_MIN) * 100, hiveData.level * 2);
              const _wiedzaMult  = Math.max(WIEDZA_MULT_MIN, 1 - _wiedzaPct / 100);
              const _hiveMult    = Math.max(HIVE_MULT_MIN, 1 - _hivePct / 100);
              const _totalMultDry = _wiedzaMult * _hiveMult;
              const _effMs       = Math.round(_baseMs * Math.max(GROWTH_GLOBAL_MIN_MULT, _totalMultDry));
              // Bonus z wody (jeśli podlejesz) — orientacyjnie z aktualnymi statami/eq
              const _zaradnosc   = (effectiveStats.zaradnosc ?? 0) + getEquipFlatBonus(" pkt Zaradnosci", charEquipped);
              const _zaradBonus  = calcStatEffect(_zaradnosc, ZARADNOSC_RATE);
              const _waterEqPct  = getEquipBonusPct("% efekt podlewania", charEquipped);
              const _waterTotalPct = (WATER_BASE * 100) + _zaradBonus + _waterEqPct; // addytywny
              const _waterMult   = Math.max(WATER_MULT_MIN, 1 - _waterTotalPct / 100);
              const _totalMultWet = _waterMult * _wiedzaMult * _hiveMult;
              const _withWaterMs = Math.round(_baseMs * Math.max(GROWTH_GLOBAL_MIN_MULT, _totalMultWet));
              const _hitGlobalMin = _totalMultWet < GROWTH_GLOBAL_MIN_MULT;
              const _fmt = (ms: number) => {
                const _total = Math.max(0, Math.floor(ms / 1000));
                const _h = Math.floor(_total / 3600);
                const _m = Math.floor((_total % 3600) / 60);
                const _sec = _total % 60;
                const parts: string[] = [];
                if (_h > 0) parts.push(`${_h}h`);
                if (_m > 0 || _h > 0) parts.push(`${_m} min`);
                parts.push(`${_sec}s`);
                return parts.join(" ");
              };
              const _saved = _baseMs - _effMs;
              const _savedPct = Math.round((_saved / _baseMs) * 100);
              return (
                <>
                  <div className="mt-1 rounded-lg bg-black/30 p-2 text-[13px]">
                    <p className="font-bold text-[#f9e7b2]">⏱ Twój czas: <span className="text-emerald-300">{_fmt(_effMs)}</span></p>
                    <p className="text-[11px] text-[#8b6a3e]">Bazowo: {_fmt(_baseMs)}{_saved > 0 && <> · oszczędzasz <span className="text-emerald-400 font-bold">{_fmt(_saved)}</span> ({_savedPct}%)</>}</p>
                    {(_wiedzaPct > 0 || _hivePct > 0) && (
                      <div className="mt-1.5 space-y-0.5 text-[12px]">
                        {_wiedzaPct > 0 && <p>📚 Wiedza ({_wiedzaEff}): <span className="text-emerald-300">−{_wiedzaPct.toFixed(1)}%</span></p>}
                        {_hivePct > 0 && <p>🍯 Ul (poz. {hiveData.level}): <span className="text-emerald-300">−{_hivePct}%</span></p>}
                      </div>
                    )}
                    {_waterTotalPct > 0 && (
                      <p className="mt-1.5 text-[12px] text-cyan-300">💧 Z podlaniem: <span className="font-bold">{_fmt(_withWaterMs)}</span> <span className="text-[11px] text-[#8b6a3e]">(dodatkowe −{_waterTotalPct.toFixed(1)}%)</span></p>
                    )}
                    {_hitGlobalMin && (
                      <p className="mt-1 text-[11px] font-bold text-amber-300">⚠️ Globalne minimum {(GROWTH_GLOBAL_MIN_MULT * 100).toFixed(0)}% bazy — bonusy ponad ten próg nie skracają już czasu.</p>
                    )}
                  </div>
                </>
              );
            })()}
            {hoveredSeedQuality === "legendary" ? (
              <div className="mt-1 space-y-0.5 rounded-lg bg-[rgba(245,158,11,0.08)] p-2 text-[13px]">
                <p className="font-black text-amber-300">🌟 Każda sztuka losuje jakość osobno:</p>
                <p>🌾 {hoveredCrop.yieldAmount <= 2 ? "20–60" : "40–120"} szt. (losowa jakość)</p>
                <p>📚 EXP: +{hoveredCrop.expReward * 10}–{hoveredCrop.expReward * 20}</p>
              </div>
            ) : hoveredSeedQuality === "epic" ? (
              <div className="mt-1 space-y-0.5 rounded-lg bg-[rgba(34,197,94,0.08)] p-2 text-[13px]">
                <p className="font-black text-green-300">🎲 Każda sztuka losuje jakość osobno</p>
                <p>🌾 {hoveredCrop.yieldAmount <= 2 ? "10–22 szt." : "20–44 szt."} • EXP: +{hoveredCrop.expReward * 3}–{hoveredCrop.expReward * 6}</p>
              </div>
            ) : (
              <p className="mt-1">🌾 Zbiór: {`${hoveredCrop.yieldAmount <= 2 ? "1–3" : "2–6"} szt. (losowa jakość każdej sztuki)`}</p>
            )}
            {hoveredSeedQuality !== "legendary" && hoveredSeedQuality !== "epic" && (
              <p className="mt-1">⭐ EXP: +{hoveredCrop.expReward}</p>
            )}
          </>}
        </div>
      )}

      {/* ─── TARG GRACZY: przycisk wejścia — usunięty, otwiera się bezpośrednio ─── */}

      {/* ─── TARG GRACZY: modal ──────────────────────────────────────────────── */}
      <MarketModal
        showMarketModal={showMarketModal}
        marketPickerOpen={marketPickerOpen}
        marketTab={marketTab}
        marketBrowse={marketBrowse}
        myMarketOffers={myMarketOffers}
        marketReturns={marketReturns}
        marketLoading={marketLoading}
        marketBrowseFilter={marketBrowseFilter}
        marketSearch={marketSearch}
        marketQualityFilter={marketQualityFilter}
        marketSort={marketSort}
        marketTierFilter={marketTierFilter}
        marketMyLevelOnly={marketMyLevelOnly}
        coItemType={coItemType}
        coItemKey={coItemKey}
        coQty={coQty}
        coPrice={coPrice}
        coPriceStr={coPriceStr}
        coDuration={coDuration}
        coLoading={coLoading}
        createOfferOpen={createOfferOpen}
        marketPickerSearch={marketPickerSearch}
        marketPickerFilter={marketPickerFilter}
        buyQtyMap={buyQtyMap}
        buyingOfferId={buyingOfferId}
        cancellingOfferId={cancellingOfferId}
        claimingReturns={claimingReturns}
        pendingReturnCount={pendingReturnCount}
        isTester={isTester}
        profile={profile}
        setShowMarketModal={setShowMarketModal}
        setMarketTab={setMarketTab}
        setMarketSearch={setMarketSearch}
        setMarketQualityFilter={setMarketQualityFilter}
        setMarketSort={setMarketSort}
        setMarketTierFilter={setMarketTierFilter}
        setMarketMyLevelOnly={setMarketMyLevelOnly}
        setCoItemType={setCoItemType}
        setCoItemKey={setCoItemKey}
        setCoQty={setCoQty}
        setCoPrice={setCoPrice}
        setCoPriceStr={setCoPriceStr}
        setCoDuration={setCoDuration}
        setCreateOfferOpen={setCreateOfferOpen}
        setMarketPickerOpen={setMarketPickerOpen}
        setMarketPickerSearch={setMarketPickerSearch}
        setMarketPickerFilter={setMarketPickerFilter}
        setBuyQtyMap={setBuyQtyMap}
        loadMarketData={loadMarketData}
        handleMarketBrowseFilter={handleMarketBrowseFilter}
        handleCreateOffer={handleCreateOffer}
        handleBuyOffer={handleBuyOffer}
        handleCancelOffer={handleCancelOffer}
        handleClaimAllReturns={handleClaimAllReturns}
        buildSellableItems={buildSellableItems}
        getItemUpg={getItemUpg}
      />


        {/* ─── Panel Przewodnika (globalny fixed overlay) ─── */}
        {!!profile?.id && profile.tutorial_started === true && profile.tutorial_completed !== true && profile.tutorial_skipped !== true && tutorialStep >= 1 && tutorialStep <= 13 && !showWelcome && (
          <TutorialPanel
            tutorialStep={tutorialStep}
            tutorialPlotIds={tutorialPlotIds}
            plotCrops={plotCrops}
            isCropReady={isCropReady}
            tutorialPlantedIds={tutorialPlantedIds}
            tutorialWateredIds={tutorialWateredIds}
            tutorialHarvestedIds={tutorialHarvestedIds}
            tutorialPanelMinimized={tutorialPanelMinimized}
            setTutorialPanelMinimized={setTutorialPanelMinimized}
            onTutorialComplete={async () => {
              if (!profile?.id) return;
              await supabase.from("profiles").update({ tutorial_completed: true }).eq("id", profile.id);
              setProfile(p => p ? { ...p, tutorial_completed: true } : p);
            }}
          />
        )}

        {/* Tutorial: delikatne przyciemnienie mapy na kroku 1 */}
        {!!profile?.id && profile.tutorial_started === true && profile.tutorial_completed !== true && profile.tutorial_skipped !== true && tutorialStep === 1 && !isFieldViewOpen && (
          <div className="fixed inset-0 z-[5] pointer-events-none" style={{ background: "rgba(0,0,0,0.35)" }} />
        )}

        {/* Tutorial: strzałki wskazujące aktywny element */}
        <TutorialArrows
          profile={profile}
          tutorialStep={tutorialStep}
          tutorialArrow={tutorialArrow}
          isFvHarvestModalOpen={isFvHarvestModalOpen}
          fvZbioryPos={fvZbioryPos}
          fvTutArrow12Pos={fvTutArrow12Pos}
          fvTutArrow13Pos={fvTutArrow13Pos}
        />

        {/* TYMCZASOWE — powiadomienie "obróć telefon" dla testów mobilnych */}
        {showRotateNotice && !rotateNoticeDismissed && (
          <div
            style={{
              position: "fixed",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 999998,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              borderRadius: 14,
              background: "rgba(26,19,13,0.93)",
              border: "1.5px solid rgba(200,160,60,0.55)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
              maxWidth: "calc(100vw - 32px)",
              backdropFilter: "blur(6px)",
            }}
          >
            <span style={{ fontSize: 22 }}>📱</span>
            <span style={{ color: "#f3e6c8", fontSize: 13, fontWeight: 600, lineHeight: 1.4, whiteSpace: "nowrap" }}>
              Obróć telefon poziomo,<br />aby wygodniej grać.
            </span>
            <button
              type="button"
              onClick={() => setRotateNoticeDismissed(true)}
              style={{
                marginLeft: 4,
                padding: "5px 12px",
                borderRadius: 8,
                background: "rgba(200,150,40,0.85)",
                border: "none",
                color: "#1a130d",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              OK
            </button>
          </div>
        )}

        </main>
    </div>
  );
}  