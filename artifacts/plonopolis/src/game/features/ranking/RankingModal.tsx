import React, { useState, useCallback, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import type { RankingPlayer, Profile } from "../../types/profile";
import { ALL_SKINS } from "../../constants/avatars";
import { STATS_DEFS } from "../../types/stats";
import { CHAR_EQUIP_ITEMS, EQUIP_SLOT_META, UPG_COLOR } from "../../constants/equipment";
import { bonusLine } from "../../utils/equipment";
import type { CharEquipped, EquipSlot } from "../../types/equipment";
import { supabase } from "@/lib/supabase";

type RankingSort = "level" | "money" | "farmpower" | "customers";

interface PlayerDetail {
  player_stats?: Record<string, number> | null;
  char_equipped?: CharEquipped | null;
  item_upg_registry?: Record<string, number> | null;
  avatar_skin?: number | null;
  level?: number | null;
  login?: string | null;
}

interface RankingModalProps {
  onClose: () => void;
  rankingData: RankingPlayer[];
  rankingLoading: boolean;
  rankingSort: RankingSort;
  setRankingSort: (s: RankingSort) => void;
  rankingSearch: string;
  setRankingSearch: (s: string) => void;
  rankingHighlightMe: boolean;
  setRankingHighlightMe: React.Dispatch<React.SetStateAction<boolean>>;
  rankingScrollRef: React.RefObject<HTMLDivElement | null>;
  profile: Profile | null;
  avatarSkin: number;
  openComposeTo: (userId: string, username: string) => void;
}

const SLOT_ORDER: EquipSlot[] = ["glowa", "dlonie", "nogi"];

const SLOT_LABEL: Record<EquipSlot, string> = {
  glowa: "Głowa",
  dlonie: "Dłonie",
  nogi: "Nogi",
};

interface TooltipState {
  itemDef: typeof CHAR_EQUIP_ITEMS[number];
  upg: number;
  upgColor: string;
  slot: EquipSlot;
  x: number;
  y: number;
}

function EquipSlots({ charEquipped, itemUpgRegistry, slot_order, slot_label }: {
  charEquipped: CharEquipped | null | undefined;
  itemUpgRegistry: Record<string, number> | null | undefined;
  slot_order: EquipSlot[];
  slot_label: Record<EquipSlot, string>;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = (e: React.MouseEvent, itemDef: typeof CHAR_EQUIP_ITEMS[number], upg: number, upgColor: string, slot: EquipSlot) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ itemDef, upg, upgColor, slot, x: rect.left + rect.width / 2, y: rect.top });
  };

  const hideTooltip = () => {
    hideTimer.current = setTimeout(() => setTooltip(null), 80);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {slot_order.map(slot => {
          const equipped = charEquipped?.[slot];
          const itemDef = equipped ? CHAR_EQUIP_ITEMS.find(i => i.id === equipped.id) : null;
          const upg = equipped ? (itemUpgRegistry?.[equipped.id] ?? equipped.upg ?? 0) : 0;
          const upgColor = UPG_COLOR[upg] ?? "#9CA3AF";
          return (
            <div key={slot} className="relative flex flex-col items-center"
              onMouseEnter={itemDef ? (e) => showTooltip(e, itemDef, upg, upgColor, slot) : undefined}
              onMouseLeave={itemDef ? hideTooltip : undefined}>
              <div
                className="relative w-full overflow-hidden flex items-center justify-center"
                style={{
                  aspectRatio: "1/1",
                  background: itemDef ? "linear-gradient(160deg,rgba(60,38,12,0.90) 0%,rgba(28,16,4,0.95) 100%)" : "rgba(10,6,2,0.70)",
                  border: itemDef ? `2px solid ${upgColor}70` : "2px solid rgba(139,106,62,0.30)",
                  borderRadius: "10px",
                  boxShadow: itemDef ? `0 0 18px ${upgColor}22,inset 0 0 24px rgba(0,0,0,0.5)` : "inset 0 0 16px rgba(0,0,0,0.4)",
                }}
              >
                {itemDef && (
                  <>
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: `${upgColor}80` }} />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: `${upgColor}80` }} />
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: `${upgColor}80` }} />
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: `${upgColor}80` }} />
                  </>
                )}
                {itemDef?.img ? (
                  <img src={itemDef.img} alt={itemDef.name} className="w-[90%] h-[90%] object-contain" style={{ imageRendering: "pixelated", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.85))" }} draggable={false} />
                ) : (
                  <span className="text-[#8b6a3e]/40 text-[9px] font-bold uppercase tracking-wider text-center px-1">{slot_label[slot]}</span>
                )}
                {upg > 0 && (
                  <div className="absolute top-1 right-1 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black"
                    style={{ background: "rgba(0,0,0,0.88)", color: upgColor, border: `1.5px solid ${upgColor}70`, textShadow: `0 0 6px ${upgColor}` }}>
                    +{upg}
                  </div>
                )}
              </div>
              <div className="mt-1 text-center w-full px-0.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#8b6a3e] leading-none">{slot_label[slot]}</p>
                {itemDef && <p className="text-[10px] font-black text-[#f3e6c8] mt-0.5 truncate leading-tight">{itemDef.name}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip portaled to document.body */}
      {tooltip && ReactDOM.createPortal(
        <div
          className="pointer-events-none fixed z-[9999]"
          style={{ left: tooltip.x, top: tooltip.y - 12, transform: "translate(-50%, -100%)" }}
        >
          <div className="rounded-2xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-6 py-4 shadow-2xl w-[320px]"
            style={{ boxShadow: `0 0 36px ${tooltip.upgColor}35` }}>
            <p className="text-[20px] font-black text-[#f9e7b2] leading-tight">{tooltip.itemDef.name}</p>
            <p className="text-[14px] text-[#8b6a3e] mt-1">{EQUIP_SLOT_META[tooltip.slot].label} · lvl {tooltip.itemDef.unlockLevel}</p>
            {tooltip.upg > 0 && <p className="text-[16px] font-black mt-1.5" style={{ color: tooltip.upgColor }}>Ulepszenie +{tooltip.upg}</p>}
            <div className="h-px bg-[#8b6a3e]/30 my-2" />
            <p className="text-[15px] font-bold text-cyan-300">{bonusLine(tooltip.itemDef.bonuses, tooltip.upg)}</p>
            {tooltip.itemDef.desc && <p className="mt-2 text-[13px] italic text-[#8b6a3e]/80 leading-snug">&ldquo;{tooltip.itemDef.desc}&rdquo;</p>}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[-7px] w-4 h-4 rotate-45 bg-[rgba(14,8,4,0.97)] border-r border-b border-[#8b6a3e]/70" />
        </div>,
        document.body
      )}
    </>
  );
}

export function RankingModal({
  onClose,
  rankingData,
  rankingLoading,
  rankingSort,
  setRankingSort,
  rankingSearch,
  setRankingSearch,
  rankingHighlightMe,
  setRankingHighlightMe,
  rankingScrollRef,
  profile,
  avatarSkin,
  openComposeTo,
}: RankingModalProps) {
  // null = showing own profile; non-null = showing another player
  const [selectedPlayer, setSelectedPlayer] = useState<RankingPlayer | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const didInitialScroll = useRef(false);

  const isViewingOther = selectedPlayer !== null && selectedPlayer.user_id !== profile?.id;

  const sorted = [...rankingData].sort((a, b) => {
    if (rankingSort === "level") return (b.ranking_score ?? 0) - (a.ranking_score ?? 0);
    if (rankingSort === "money") return b.money - a.money;
    if (rankingSort === "customers") return (b.customer_orders_completed ?? 0) - (a.customer_orders_completed ?? 0);
    return (b.farm_power ?? 0) - (a.farm_power ?? 0);
  }).filter(p =>
    rankingSearch.trim() === "" || p.player_name.toLowerCase().includes(rankingSearch.trim().toLowerCase())
  );

  // Auto-scroll to logged-in player on first data load
  useEffect(() => {
    if (rankingLoading || didInitialScroll.current || sorted.length === 0) return;
    const myIndex = sorted.findIndex(p => p.user_id === profile?.id);
    if (myIndex === -1) return;
    didInitialScroll.current = true;
    setTimeout(() => {
      const el = document.getElementById("ranking-me-row");
      const container = rankingScrollRef.current;
      if (!el || !container) return;
      let elTop = 0;
      let node: HTMLElement | null = el as HTMLElement;
      while (node && node !== container) { elTop += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
      container.scrollTop = Math.max(0, elTop - el.offsetHeight * 5);
    }, 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankingLoading, sorted.length, profile?.id]);

  const loadPlayerDetail = useCallback(async (p: RankingPlayer) => {
    setDetailLoading(true);
    setPlayerDetail(null);
    try {
      const { data, error } = await supabase.rpc("get_public_player_profile", { p_user_id: p.user_id });
      if (error) throw error;
      setPlayerDetail(data as PlayerDetail | null);
    } catch {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("player_stats, char_equipped, item_upg_registry, avatar_skin, level, login")
          .eq("id", p.user_id)
          .single();
        setPlayerDetail(data as PlayerDetail | null);
      } catch {
        setPlayerDetail(null);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelectPlayer = useCallback((p: RankingPlayer) => {
    setComparing(false);
    if (p.user_id === profile?.id || selectedPlayer?.user_id === p.user_id) {
      setSelectedPlayer(null);
      setPlayerDetail(null);
      return;
    }
    setSelectedPlayer(p);
    void loadPlayerDetail(p);
  }, [selectedPlayer?.user_id, profile?.id, loadPlayerDetail]);

  const goBackToMe = () => {
    setSelectedPlayer(null);
    setPlayerDetail(null);
    setComparing(false);
  };

  const displayedRow = isViewingOther
    ? selectedPlayer
    : (rankingData.find(r => r.user_id === profile?.id) ?? null);
  const isOwnPanel = !isViewingOther;

  // ─── Reusable player column for compare mode ───────────────────────────────
  const CompareColumn = ({
    name, guild, level, farmPower, skinIndex, borderColor,
    charEquipped: ce, itemUpgRegistry: iur, playerStats: ps,
    customers, money,
    opponentStats,
    isLeft,
  }: {
    name: string; guild: string; level: number | string; farmPower: number;
    skinIndex: number; borderColor: string;
    charEquipped: CharEquipped | null | undefined;
    itemUpgRegistry: Record<string, number> | null | undefined;
    playerStats: Record<string, number> | null | undefined;
    customers: number; money: number;
    opponentStats: Record<string, number> | null | undefined;
    isLeft: boolean;
  }) => (
    <div className={`min-w-[240px] w-1/2 overflow-y-auto flex flex-col p-4 gap-4 ${isLeft ? "border-r border-[#8b6a3e]/30" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-[16px] font-black leading-tight truncate ${isLeft ? "text-yellow-200" : "text-[#f9e7b2]"}`}>{name}</p>
          <p className="text-xs text-[#8b6a3e] mt-0.5 truncate">{guild || "Brak gildii"}</p>
          <span className="mt-1.5 inline-block rounded-xl bg-[rgba(212,166,79,0.18)] border border-[#d4a64f]/40 px-2 py-1 text-[12px] font-black text-[#f2ca69]">
            ⭐ {level}
          </span>
        </div>
        <div className="relative shrink-0 overflow-hidden rounded-xl shadow-xl self-center"
          style={{ width: 64, height: 96, border: `2px solid ${borderColor}` }}>
          <img src={ALL_SKINS[skinIndex] ?? ALL_SKINS[0]} alt={name}
            className="w-full h-full object-cover object-top" style={{ imageRendering: "pixelated" }} />
        </div>
      </div>
      <EquipSlots charEquipped={ce} itemUpgRegistry={iur} slot_order={SLOT_ORDER} slot_label={SLOT_LABEL} />
      <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-3 py-3 grid grid-cols-2 gap-x-4 gap-y-3">
        {STATS_DEFS.map(s => {
          const myVal = ps?.[s.key] ?? 0;
          const oppVal = opponentStats?.[s.key] ?? 0;
          const better = myVal > oppVal, worse = myVal < oppVal;
          return (
            <div key={s.key} className="flex flex-col">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8b6a3e] leading-none">{s.label}</p>
              <p className={`text-[22px] font-black leading-tight tabular-nums ${better ? "text-emerald-400" : worse ? "text-red-400" : "text-[#f9e7b2]"}`}>{myVal}</p>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-2 text-center">
          <p className="text-[10px] text-[#8b6a3e] font-bold uppercase tracking-wide">Klienci</p>
          <p className="text-[20px] font-black text-emerald-400 tabular-nums">{customers.toLocaleString("pl-PL")}</p>
        </div>
        <div className="rounded-xl border border-[#a8e890]/20 bg-[rgba(168,232,144,0.05)] p-2 text-center">
          <p className="text-[10px] text-[#8b6a3e] font-bold uppercase tracking-wide">Pieniądze</p>
          <p className="text-[14px] font-black text-[#a8e890] tabular-nums">
            {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(money)}
          </p>
        </div>
      </div>
    </div>
  );

  const myRow = rankingData.find(r => r.user_id === profile?.id);
  const myStats = profile?.player_stats as Record<string, number> | null | undefined;
  const theirStats = playerDetail?.player_stats;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[rgba(22,13,8,0.99)]">
      <div className="flex w-full flex-1 min-h-0 flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#8b6a3e]/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <h2 className="text-2xl font-black text-[#f9e7b2]">Ranking graczy</h2>
              <p className="text-xs text-[#8b6a3e]">Wszyscy gracze Plonopolis</p>
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-xl border border-[#8b6a3e]/50 bg-black/30 px-4 py-2 text-sm font-bold text-[#f3e6c8] transition hover:border-red-400/50 hover:text-red-300">
            ✕ Zamknij
          </button>
        </div>

        {/* ── Sort tabs + search ── */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#8b6a3e]/30 px-6 py-3">
          {([["farmpower","Moc farmy"],["level","Poziom"],["money","Pieniądze"],["customers","😊 Klienci"]] as [RankingSort, string][]).map(([s, label]) => (
            <button key={s} onClick={() => setRankingSort(s)}
              className={rankingSort === s ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <input type="text" value={rankingSearch} onChange={e => setRankingSearch(e.target.value)}
              placeholder="🔍 Szukaj nicku..."
              className="rounded-xl border border-[#8b6a3e]/60 bg-black/30 px-3 py-2 text-sm text-[#f3e6c8] placeholder-[#8b6a3e] outline-none focus:border-[#d4a64f]/80 w-44" />
            <button onClick={() => {
              setRankingHighlightMe(v => {
                const next = !v;
                if (next) setTimeout(() => {
                  const el = document.getElementById("ranking-me-row");
                  const container = rankingScrollRef.current;
                  if (!el || !container) return;
                  let elTop = 0;
                  let node: HTMLElement | null = el as HTMLElement;
                  while (node && node !== container) { elTop += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
                  container.scrollTop = elTop - container.clientHeight / 2 + el.offsetHeight / 2;
                }, 120);
                return next;
              });
            }} className={`rounded-xl px-4 py-2 text-sm font-bold transition border ${rankingHighlightMe ? "border-yellow-400 bg-yellow-500/20 text-yellow-300" : "border-[#8b6a3e]/50 bg-black/20 text-[#f1dfb5] hover:bg-white/5"}`}>
              🎯 Znajdź mnie
            </button>
          </div>
        </div>

        {/* ── Main area: table 55% + right panel 45% — SIZES NEVER CHANGE ── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left: ranking table — always w-[35%] ── */}
          <div ref={rankingScrollRef} className="w-[35%] overflow-y-auto px-4 py-4 border-r border-[#8b6a3e]/30 shrink-0">
            {rankingLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-3 text-4xl animate-spin">⚙️</div>
                  <p className="text-[#8b6a3e]">Ładowanie rankingu...</p>
                </div>
              </div>
            ) : (
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: "44px" }} />
                  <col />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "92px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-[#8b6a3e]/50 text-left text-[11px] uppercase tracking-widest text-[#a08060]">
                    <th className="pb-3 pt-2 pr-2">#</th>
                    <th className="pb-3 pt-2 pr-3">Gracz</th>
                    <th className="pb-3 pt-2 pr-2 text-right">Poziom</th>
                    <th className="pb-3 pt-2 text-right">Moc farmy</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => {
                    const isMe = p.user_id === profile?.id;
                    const isSelected = isViewingOther && p.user_id === selectedPlayer?.user_id;
                    const highlighted = rankingHighlightMe && isMe;
                    return (
                      <tr key={p.user_id} id={isMe ? "ranking-me-row" : undefined}
                        onClick={() => handleSelectPlayer(p)}
                        className={`border-b border-[#8b6a3e]/20 cursor-pointer transition-colors duration-100
                          ${isSelected ? "bg-[#d4a64f]/20 outline outline-2 outline-[#d4a64f]/70"
                            : isMe && !isViewingOther ? "bg-yellow-500/10 outline outline-1 outline-yellow-400/30"
                            : highlighted ? "bg-yellow-500/20 outline outline-2 outline-yellow-400/60"
                            : "hover:bg-white/5"}`}>
                        <td className="py-3 pr-2 font-black text-[#d8ba7a] text-base">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-[14px]">{i + 1}</span>}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={ALL_SKINS[isMe ? (avatarSkin >= 0 ? avatarSkin : 0) : ((p.avatar_skin ?? -1) >= 0 ? (p.avatar_skin ?? 0) : 0)] ?? ALL_SKINS[0]}
                              alt={p.player_name}
                              className="h-10 w-10 shrink-0 rounded-full object-cover object-top border-2 border-[#8b6a3e]/60"
                              style={{ imageRendering: "pixelated" }}
                            />
                            <div className="min-w-0">
                              <span className={`text-[14px] font-bold truncate block ${isSelected ? "text-[#f9e7b2]" : isMe ? "text-yellow-200" : highlighted ? "text-yellow-200" : "text-[#f3e6c8]"}`}>
                                {p.player_name}
                              </span>
                              <span className="text-[11px] text-[#a08060] truncate block">{p.guild_name || "Brak gildii"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-2 text-right font-black text-[#f2ca69] text-[14px]">⭐ {p.level}</td>
                        <td className="py-3 text-right tabular-nums">
                          <span className={`font-black text-[14px] ${isMe ? "text-yellow-300" : "text-[#f3e6c8]"}`}>
                            {(p.farm_power ?? 0).toLocaleString("pl-PL")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Right panel — always w-[65%], content switches between profile and compare ── */}
          <div className="w-[65%] shrink-0 flex flex-col overflow-hidden bg-[rgba(18,10,4,0.60)]">

            {/* ── Normal profile view ── */}
            {!comparing && (
              <div className="flex flex-col flex-1 overflow-y-auto">
                {detailLoading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl animate-spin mb-2">⚙️</div>
                      <p className="text-sm text-[#8b6a3e]">Ładowanie profilu...</p>
                    </div>
                  </div>
                ) : rankingLoading && !displayedRow ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl animate-spin mb-2">⚙️</div>
                      <p className="text-sm text-[#8b6a3e]">Ładowanie...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col p-5 gap-4">

                    {/* Label + back button */}
                    <div className="flex items-center justify-between gap-2 shrink-0">
                      <p className="text-[11px] uppercase tracking-widest font-bold text-[#8b6a3e]">
                        {isOwnPanel ? "👤 Twój profil" : "👤 Profil gracza"}
                      </p>
                      {isViewingOther && (
                        <button onClick={goBackToMe}
                          className="rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-3 py-1 text-xs font-bold text-[#f3e6c8] transition hover:border-[#d4a64f]/60 hover:text-[#f2ca69]">
                          ← Twój profil
                        </button>
                      )}
                    </div>

                    {/* Avatar + info */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[20px] font-black text-[#f9e7b2] leading-tight truncate">
                          {isOwnPanel ? (displayedRow?.player_name ?? profile?.login ?? "Ty") : selectedPlayer!.player_name}
                        </p>
                        <p className="text-sm text-[#8b6a3e] mt-0.5">
                          {isOwnPanel ? (displayedRow?.guild_name || "Brak gildii") : (selectedPlayer!.guild_name || "Brak gildii")}
                        </p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <span className="rounded-xl bg-[rgba(212,166,79,0.18)] border border-[#d4a64f]/40 px-3 py-1.5 text-[13px] font-black text-[#f2ca69] w-fit">
                            ⭐ Poziom {isOwnPanel ? (displayedRow?.level ?? profile?.level ?? "?") : selectedPlayer!.level}
                          </span>
                          <span className="rounded-xl bg-[rgba(168,232,144,0.12)] border border-[#a8e890]/30 px-3 py-1.5 text-[13px] font-bold text-[#a8e890] w-fit">
                            ⚡ {((isOwnPanel ? displayedRow?.farm_power : selectedPlayer?.farm_power) ?? 0).toLocaleString("pl-PL")} mocy
                          </span>
                          {isViewingOther && (
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => openComposeTo(selectedPlayer!.user_id, selectedPlayer!.player_name)}
                                className="rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-3 py-1.5 text-xs font-bold text-[#f3e6c8] transition hover:border-[#d8ba7a]/70 hover:bg-[rgba(80,50,10,0.5)]">
                                ✉️ Wyślij wiadomość
                              </button>
                              <button
                                onClick={() => setComparing(true)}
                                className="rounded-xl border border-[#d4a64f]/60 bg-[rgba(212,166,79,0.12)] px-3 py-1.5 text-xs font-bold text-[#f2ca69] transition hover:border-[#d4a64f] hover:bg-[rgba(212,166,79,0.22)]">
                                ⚔️ Porównaj
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className="relative shrink-0 overflow-hidden rounded-2xl border-2 shadow-xl self-center"
                        style={{
                          width: 100, height: 150,
                          borderColor: isOwnPanel ? "rgba(250,204,21,0.5)" : "rgba(139,106,62,0.8)",
                        }}>
                        <img
                          src={ALL_SKINS[
                            isOwnPanel
                              ? (avatarSkin >= 0 ? avatarSkin : 0)
                              : ((playerDetail?.avatar_skin ?? selectedPlayer?.avatar_skin ?? -1) >= 0
                                ? (playerDetail?.avatar_skin ?? selectedPlayer?.avatar_skin ?? 0)
                                : 0)
                          ] ?? ALL_SKINS[0]}
                          alt={isOwnPanel ? "Ty" : (selectedPlayer?.player_name ?? "")}
                          className="w-full h-full object-cover object-top"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                    </div>

                    {/* Ekwipunek */}
                    <EquipSlots
                      charEquipped={isOwnPanel ? (profile?.char_equipped as CharEquipped | null | undefined) : (playerDetail?.char_equipped as CharEquipped | null | undefined)}
                      itemUpgRegistry={isOwnPanel ? (profile?.item_upg_registry as Record<string,number> | null | undefined) : (playerDetail?.item_upg_registry as Record<string,number> | null | undefined)}
                      slot_order={SLOT_ORDER}
                      slot_label={SLOT_LABEL}
                    />

                    {/* Statystyki */}
                    <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-4 py-4 grid grid-cols-2 gap-x-6 gap-y-3">
                      {STATS_DEFS.map(s => {
                        const val = isOwnPanel
                          ? ((profile?.player_stats as Record<string,number> | null | undefined)?.[s.key] ?? 0)
                          : (playerDetail?.player_stats?.[s.key] ?? 0);
                        return (
                          <div key={s.key} className="flex flex-col gap-0">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-[#8b6a3e] leading-none">{s.label}</p>
                            <p className="text-[26px] font-black text-[#f9e7b2] leading-tight tabular-nums">{val}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Klienci + Pieniądze */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-3 text-center">
                        <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">Klienci</p>
                        <p className="text-[24px] font-black text-emerald-400 tabular-nums">
                          {((isOwnPanel ? displayedRow?.customer_orders_completed : selectedPlayer?.customer_orders_completed) ?? 0).toLocaleString("pl-PL")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#a8e890]/20 bg-[rgba(168,232,144,0.05)] p-3 text-center">
                        <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">Pieniądze</p>
                        <p className="text-[18px] font-black text-[#a8e890] tabular-nums">
                          {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(
                            isOwnPanel ? (profile?.money ?? 0) : (selectedPlayer?.money ?? 0)
                          )}
                        </p>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* ── Compare view — same w-[45%] container, horizontal scroll for two columns ── */}
            {comparing && selectedPlayer && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#8b6a3e]/30">
                  <p className="text-[#f2ca69] font-black text-[14px]">⚔️ Porównanie</p>
                  <button onClick={() => setComparing(false)}
                    className="rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-3 py-1.5 text-sm font-bold text-[#f3e6c8] transition hover:border-[#d4a64f]/60 hover:text-[#f2ca69]">
                    ← Wróć
                  </button>
                </div>

                {detailLoading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-3xl animate-spin">⚙️</div>
                  </div>
                ) : (
                  <div className="flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
                    <CompareColumn
                      name={myRow?.player_name ?? profile?.login ?? "Ty"}
                      guild={myRow?.guild_name ?? ""}
                      level={profile?.level ?? "?"}
                      farmPower={myRow?.farm_power ?? 0}
                      skinIndex={avatarSkin >= 0 ? avatarSkin : 0}
                      borderColor="rgba(250,204,21,0.5)"
                      charEquipped={profile?.char_equipped as CharEquipped | null | undefined}
                      itemUpgRegistry={profile?.item_upg_registry as Record<string,number> | null | undefined}
                      playerStats={myStats}
                      customers={myRow?.customer_orders_completed ?? 0}
                      money={profile?.money ?? 0}
                      opponentStats={theirStats}
                      isLeft={true}
                    />
                    <CompareColumn
                      name={selectedPlayer.player_name}
                      guild={selectedPlayer.guild_name ?? ""}
                      level={selectedPlayer.level}
                      farmPower={selectedPlayer.farm_power ?? 0}
                      skinIndex={(playerDetail?.avatar_skin ?? selectedPlayer.avatar_skin ?? -1) >= 0
                        ? (playerDetail?.avatar_skin ?? selectedPlayer.avatar_skin ?? 0) : 0}
                      borderColor="rgba(139,106,62,0.8)"
                      charEquipped={playerDetail?.char_equipped as CharEquipped | null | undefined}
                      itemUpgRegistry={playerDetail?.item_upg_registry as Record<string,number> | null | undefined}
                      playerStats={theirStats}
                      customers={selectedPlayer.customer_orders_completed ?? 0}
                      money={selectedPlayer.money}
                      opponentStats={myStats}
                      isLeft={false}
                    />
                  </div>
                )}
              </div>
            )}

          </div>{/* end right panel w-[45%] */}

        </div>{/* end main area */}

        {/* Footer */}
        <div className="shrink-0 border-t border-[#8b6a3e]/30 px-6 py-3 text-center text-xs text-[#8b6a3e]">
          Łącznie graczy: {rankingData.length}
        </div>

      </div>
    </div>
  );
}
