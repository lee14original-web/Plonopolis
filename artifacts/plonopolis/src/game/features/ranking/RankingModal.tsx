import React, { useState, useCallback, useRef } from "react";
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
      <div className="grid grid-cols-3 gap-3">
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
                  borderRadius: "12px",
                  boxShadow: itemDef ? `0 0 18px ${upgColor}22,inset 0 0 24px rgba(0,0,0,0.5)` : "inset 0 0 16px rgba(0,0,0,0.4)",
                }}
              >
                {itemDef && (
                  <>
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: `${upgColor}80` }} />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: `${upgColor}80` }} />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: `${upgColor}80` }} />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: `${upgColor}80` }} />
                  </>
                )}
                {itemDef?.img ? (
                  <img src={itemDef.img} alt={itemDef.name} className="w-[95%] h-[95%] object-contain" style={{ imageRendering: "pixelated", filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.85))" }} draggable={false} />
                ) : (
                  <span className="text-[#8b6a3e]/40 text-[10px] font-bold uppercase tracking-wider text-center px-2">{slot_label[slot]}</span>
                )}
                {upg > 0 && (
                  <div className="absolute top-1.5 right-1.5 rounded-full w-6 h-6 flex items-center justify-center text-[11px] font-black"
                    style={{ background: "rgba(0,0,0,0.88)", color: upgColor, border: `1.5px solid ${upgColor}70`, textShadow: `0 0 6px ${upgColor}` }}>
                    +{upg}
                  </div>
                )}
              </div>
              <div className="mt-1.5 text-center w-full px-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b6a3e] leading-none">{slot_label[slot]}</p>
                {itemDef && <p className="text-[11px] font-black text-[#f3e6c8] mt-0.5 truncate leading-tight">{itemDef.name}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip portaled to document.body — never clipped by overflow */}
      {tooltip && ReactDOM.createPortal(
        <div
          className="pointer-events-none fixed z-[9999]"
          style={{ left: tooltip.x, top: tooltip.y - 12, transform: "translate(-50%, -100%)" }}
        >
          <div className="rounded-2xl border border-[#8b6a3e]/70 bg-[rgba(14,8,4,0.97)] px-6 py-4 shadow-2xl w-[340px]"
            style={{ boxShadow: `0 0 36px ${tooltip.upgColor}35` }}>
            <p className="text-[22px] font-black text-[#f9e7b2] leading-tight">{tooltip.itemDef.name}</p>
            <p className="text-[16px] text-[#8b6a3e] mt-1">{EQUIP_SLOT_META[tooltip.slot].label} · lvl {tooltip.itemDef.unlockLevel}</p>
            {tooltip.upg > 0 && <p className="text-[18px] font-black mt-1.5" style={{ color: tooltip.upgColor }}>Ulepszenie +{tooltip.upg}</p>}
            <div className="h-px bg-[#8b6a3e]/30 my-2" />
            <p className="text-[17px] font-bold text-cyan-300">{bonusLine(tooltip.itemDef.bonuses, tooltip.upg)}</p>
            {tooltip.itemDef.desc && <p className="mt-2 text-[15px] italic text-[#8b6a3e]/80 leading-snug">&ldquo;{tooltip.itemDef.desc}&rdquo;</p>}
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
  const [selectedPlayer, setSelectedPlayer] = useState<RankingPlayer | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comparing, setComparing] = useState(false);

  const handleSelectPlayer = useCallback(async (p: RankingPlayer) => {
    if (selectedPlayer?.user_id === p.user_id) {
      setSelectedPlayer(null);
      setPlayerDetail(null);
      setComparing(false);
      return;
    }
    setComparing(false);
    setSelectedPlayer(p);
    setPlayerDetail(null);
    setDetailLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_public_player_profile", {
        p_user_id: p.user_id,
      });
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
  }, [selectedPlayer?.user_id]);

  const sorted = [...rankingData].sort((a, b) => {
    if (rankingSort === "level") return (b.ranking_score ?? 0) - (a.ranking_score ?? 0);
    if (rankingSort === "money") return b.money - a.money;
    if (rankingSort === "customers") return (b.customer_orders_completed ?? 0) - (a.customer_orders_completed ?? 0);
    return (b.farm_power ?? 0) - (a.farm_power ?? 0);
  }).filter(p =>
    rankingSearch.trim() === "" || p.player_name.toLowerCase().includes(rankingSearch.trim().toLowerCase())
  );

  const showPanel = selectedPlayer !== null;

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

        {/* ── Main area: table + optional player panel ── */}
        <div className="flex flex-1 min-h-0">

          {/* Table */}
          <div ref={rankingScrollRef}
            className={`overflow-y-auto px-6 py-4 transition-all duration-300 ${showPanel ? "w-[55%] border-r border-[#8b6a3e]/30" : "w-full"}`}>
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
                  <col style={{ width: "52px" }} />
                  <col />
                  {!showPanel && <col style={{ width: "14%" }} />}
                  <col style={{ width: "90px" }} />
                  {!showPanel && <col style={{ width: "90px" }} />}
                  {!showPanel && <col style={{ width: "16%" }} />}
                  <col style={{ width: "100px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-[#8b6a3e]/50 text-left text-[11px] uppercase tracking-widest text-[#a08060]">
                    <th className="pb-3 pt-2 pr-2">#</th>
                    <th className="pb-3 pt-2 pr-3">Gracz</th>
                    {!showPanel && <th className="pb-3 pt-2 pr-3">Gildia</th>}
                    <th className="pb-3 pt-2 pr-2 text-right">Poziom</th>
                    {!showPanel && <th className="pb-3 pt-2 pr-2 text-right">😊 Klienci</th>}
                    {!showPanel && <th className="pb-3 pt-2 pr-2 text-right">Pieniądze</th>}
                    <th className="pb-3 pt-2 text-right">Moc farmy</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => {
                    const isMe = p.user_id === profile?.id;
                    const isSelected = p.user_id === selectedPlayer?.user_id;
                    const highlighted = rankingHighlightMe && isMe;
                    return (
                      <tr key={p.user_id} id={isMe ? "ranking-me-row" : undefined}
                        onClick={() => void handleSelectPlayer(p)}
                        className={`border-b border-[#8b6a3e]/20 cursor-pointer transition-colors duration-100
                          ${isSelected ? "bg-[#d4a64f]/20 outline outline-2 outline-[#d4a64f]/70"
                            : highlighted ? "bg-yellow-500/20 outline outline-2 outline-yellow-400/60"
                            : "hover:bg-white/5"}`}>
                        <td className="py-3 pr-2 font-black text-[#d8ba7a] text-base w-[52px]">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-[15px]">{i + 1}</span>}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={ALL_SKINS[isMe ? (avatarSkin >= 0 ? avatarSkin : 0) : ((p.avatar_skin ?? -1) >= 0 ? (p.avatar_skin ?? 0) : 0)] ?? ALL_SKINS[0]}
                              alt={p.player_name}
                              className="h-12 w-12 shrink-0 rounded-full object-cover object-top border-2 border-[#8b6a3e]/60"
                              style={{ imageRendering: "pixelated" }}
                            />
                            <div className="min-w-0">
                              <span className={`text-[15px] font-bold truncate block ${isSelected ? "text-[#f9e7b2]" : highlighted ? "text-yellow-200" : "text-[#f3e6c8]"}`}>
                                {p.player_name}
                              </span>
                              {showPanel && <span className="text-xs text-[#a08060] truncate block">{p.guild_name || "Brak gildii"}</span>}
                            </div>
                          </div>
                        </td>
                        {!showPanel && <td className="py-3 pr-3 italic text-[#a08060] truncate text-[14px]">{p.guild_name || "—"}</td>}
                        <td className="py-3 pr-2 text-right font-black text-[#f2ca69] text-[15px]">⭐ {p.level}</td>
                        {!showPanel && (
                          <td className="py-3 pr-2 text-right">
                            <span className={`font-bold tabular-nums text-[15px] ${(p.customer_orders_completed ?? 0) > 0 ? "text-emerald-400" : "text-[#8b6a3e]"}`}>
                              {(p.customer_orders_completed ?? 0).toLocaleString("pl-PL")}
                            </span>
                          </td>
                        )}
                        {!showPanel && (
                          <td className="py-3 pr-2 text-right text-[#a8e890] tabular-nums text-[14px]">
                            {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(p.money)}
                          </td>
                        )}
                        <td className="py-3 text-right tabular-nums">
                          <span className={`font-black text-[16px] ${isMe ? "text-yellow-300" : "text-[#f3e6c8]"}`}>
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

          {/* ── Player Profile Panel ── */}
          {showPanel && !comparing && (
            <div className="w-[45%] flex flex-col overflow-y-auto bg-[rgba(18,10,4,0.60)]">
              {detailLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl animate-spin mb-2">⚙️</div>
                    <p className="text-sm text-[#8b6a3e]">Ładowanie profilu...</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col p-5 gap-5">

                  {/* ── Avatar + info ── */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[22px] font-black text-[#f9e7b2] leading-tight truncate">{selectedPlayer.player_name}</p>
                      <p className="text-sm text-[#8b6a3e] mt-0.5">{selectedPlayer.guild_name || "Brak gildii"}</p>
                      <div className="mt-2 flex flex-col gap-1.5">
                        <span className="rounded-xl bg-[rgba(212,166,79,0.18)] border border-[#d4a64f]/40 px-3 py-1.5 text-[14px] font-black text-[#f2ca69] w-fit">
                          ⭐ Poziom {selectedPlayer.level}
                        </span>
                        <span className="rounded-xl bg-[rgba(168,232,144,0.12)] border border-[#a8e890]/30 px-3 py-1.5 text-[14px] font-bold text-[#a8e890] w-fit">
                          ⚡ {(selectedPlayer.farm_power ?? 0).toLocaleString("pl-PL")} mocy
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          {selectedPlayer.user_id !== profile?.id && (
                            <button
                              onClick={() => openComposeTo(selectedPlayer.user_id, selectedPlayer.player_name)}
                              className="mt-1 rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-3 py-1.5 text-xs font-bold text-[#f3e6c8] transition hover:border-[#d8ba7a]/70 hover:bg-[rgba(80,50,10,0.5)]">
                              ✉️ Wyślij wiadomość
                            </button>
                          )}
                          {selectedPlayer.user_id !== profile?.id && (
                            <button
                              onClick={() => setComparing(true)}
                              className="mt-1 rounded-xl border border-[#d4a64f]/60 bg-[rgba(212,166,79,0.12)] px-3 py-1.5 text-xs font-bold text-[#f2ca69] transition hover:border-[#d4a64f] hover:bg-[rgba(212,166,79,0.22)]">
                              ⚔️ Porównaj
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="relative shrink-0 overflow-hidden rounded-2xl border-2 border-[#8b6a3e]/80 shadow-xl self-center"
                      style={{ width: 120, height: 180 }}>
                      <img
                        src={ALL_SKINS[
                          selectedPlayer.user_id === profile?.id
                            ? (avatarSkin >= 0 ? avatarSkin : 0)
                            : ((playerDetail?.avatar_skin ?? selectedPlayer.avatar_skin ?? -1) >= 0
                              ? (playerDetail?.avatar_skin ?? selectedPlayer.avatar_skin ?? 0)
                              : 0)
                        ] ?? ALL_SKINS[0]}
                        alt={selectedPlayer.player_name}
                        className="w-full h-full object-cover object-top"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                  </div>

                  {/* ── Ekwipunek ── */}
                  <EquipSlots charEquipped={playerDetail?.char_equipped as CharEquipped | null | undefined} itemUpgRegistry={playerDetail?.item_upg_registry as Record<string,number> | null | undefined} slot_order={SLOT_ORDER} slot_label={SLOT_LABEL} />

                  {/* ── Statystyki ── */}
                  <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-4 py-4 grid grid-cols-2 gap-x-6 gap-y-4">
                    {STATS_DEFS.map(s => {
                      const val = (playerDetail?.player_stats?.[s.key] ?? 0);
                      return (
                        <div key={s.key} className="flex flex-col gap-0">
                          <p className="text-[12px] font-bold uppercase tracking-wide text-[#8b6a3e] leading-none">{s.label}</p>
                          <p className="text-[30px] font-black text-[#f9e7b2] leading-tight tabular-nums">{val}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Klienci + Pieniądze ── */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-3 text-center">
                      <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">Klienci</p>
                      <p className="text-[28px] font-black text-emerald-400 tabular-nums">
                        {(selectedPlayer.customer_orders_completed ?? 0).toLocaleString("pl-PL")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#a8e890]/20 bg-[rgba(168,232,144,0.05)] p-3 text-center">
                      <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">Pieniądze</p>
                      <p className="text-[20px] font-black text-[#a8e890] tabular-nums">
                        {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(selectedPlayer.money)}
                      </p>
                    </div>
                  </div>

                  <button onClick={() => { setSelectedPlayer(null); setPlayerDetail(null); setComparing(false); }}
                    className="mt-auto self-center text-xs text-[#8b6a3e] hover:text-[#f1dfb5] transition py-1">
                    ✕ Zamknij panel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Tryb porównania ── */}
          {showPanel && comparing && (
            <div className="flex-1 flex flex-col overflow-hidden bg-[rgba(18,10,4,0.80)]">
              {/* Nagłówek porównania */}
              <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#8b6a3e]/30">
                <p className="text-[#f2ca69] font-black text-[15px]">⚔️ Porównanie graczy</p>
                <button
                  onClick={() => setComparing(false)}
                  className="rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-4 py-1.5 text-sm font-bold text-[#f3e6c8] transition hover:border-[#d4a64f]/60 hover:text-[#f2ca69]">
                  ← Wróć
                </button>
              </div>

              {detailLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-3xl animate-spin">⚙️</div>
                </div>
              ) : (
                /* Scroll poziomy — każda kolumna ma min-w-[420px], czyli tę samą szerokość co normalny panel */
                <div className="flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
                  {/* Lewa kolumna — ja */}
                  {(() => {
                    const myRow = rankingData.find(r => r.user_id === profile?.id);
                    return (
                      <div className="min-w-[420px] w-1/2 overflow-y-auto border-r border-[#8b6a3e]/30 flex flex-col p-5 gap-5">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-[22px] font-black text-yellow-200 leading-tight truncate">{myRow?.player_name ?? profile?.login ?? "Ty"}</p>
                            <p className="text-sm text-[#8b6a3e] mt-0.5">{myRow?.guild_name || "Brak gildii"}</p>
                            <div className="mt-2 flex flex-col gap-1.5">
                              <span className="rounded-xl bg-[rgba(212,166,79,0.18)] border border-[#d4a64f]/40 px-3 py-1.5 text-[14px] font-black text-[#f2ca69] w-fit">
                                ⭐ Poziom {profile?.level ?? "?"}
                              </span>
                            </div>
                          </div>
                          <div className="relative shrink-0 overflow-hidden rounded-2xl border-2 border-yellow-400/60 shadow-xl self-center" style={{ width: 90, height: 135 }}>
                            <img src={ALL_SKINS[avatarSkin >= 0 ? avatarSkin : 0] ?? ALL_SKINS[0]} alt="Ja" className="w-full h-full object-cover object-top" style={{ imageRendering: "pixelated" }} />
                          </div>
                        </div>
                        <EquipSlots charEquipped={profile?.char_equipped as CharEquipped | null | undefined} itemUpgRegistry={profile?.item_upg_registry as Record<string,number> | null | undefined} slot_order={SLOT_ORDER} slot_label={SLOT_LABEL} />
                        <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-4 py-4 grid grid-cols-2 gap-x-6 gap-y-4">
                          {STATS_DEFS.map(s => {
                            const myVal = (profile?.player_stats as Record<string,number> | null | undefined)?.[s.key] ?? 0;
                            const theirVal = playerDetail?.player_stats?.[s.key] ?? 0;
                            const better = myVal > theirVal, worse = myVal < theirVal;
                            return (
                              <div key={s.key} className="flex flex-col">
                                <p className="text-[12px] font-bold uppercase tracking-wide text-[#8b6a3e] leading-none">{s.label}</p>
                                <p className={`text-[30px] font-black leading-tight tabular-nums ${better ? "text-emerald-400" : worse ? "text-red-400" : "text-[#f9e7b2]"}`}>{myVal}</p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-3 text-center">
                            <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">Klienci</p>
                            <p className="text-[28px] font-black text-emerald-400 tabular-nums">{(myRow?.customer_orders_completed ?? 0).toLocaleString("pl-PL")}</p>
                          </div>
                          <div className="rounded-xl border border-[#a8e890]/20 bg-[rgba(168,232,144,0.05)] p-3 text-center">
                            <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">Pieniądze</p>
                            <p className="text-[20px] font-black text-[#a8e890] tabular-nums">{new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN",minimumFractionDigits:0}).format(profile?.money ?? 0)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Prawa kolumna — wybrany gracz */}
                  <div className="min-w-[420px] w-1/2 overflow-y-auto flex flex-col p-5 gap-5">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[22px] font-black text-[#f9e7b2] leading-tight truncate">{selectedPlayer.player_name}</p>
                        <p className="text-sm text-[#8b6a3e] mt-0.5">{selectedPlayer.guild_name || "Brak gildii"}</p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <span className="rounded-xl bg-[rgba(212,166,79,0.18)] border border-[#d4a64f]/40 px-3 py-1.5 text-[14px] font-black text-[#f2ca69] w-fit">
                            ⭐ Poziom {selectedPlayer.level}
                          </span>
                          <span className="rounded-xl bg-[rgba(168,232,144,0.12)] border border-[#a8e890]/30 px-3 py-1.5 text-[14px] font-bold text-[#a8e890] w-fit">
                            ⚡ {(selectedPlayer.farm_power ?? 0).toLocaleString("pl-PL")} mocy
                          </span>
                        </div>
                      </div>
                      <div className="relative shrink-0 overflow-hidden rounded-2xl border-2 border-[#8b6a3e]/80 shadow-xl self-center" style={{ width: 90, height: 135 }}>
                        <img src={ALL_SKINS[((playerDetail?.avatar_skin ?? selectedPlayer.avatar_skin ?? -1) >= 0 ? (playerDetail?.avatar_skin ?? selectedPlayer.avatar_skin ?? 0) : 0)] ?? ALL_SKINS[0]} alt={selectedPlayer.player_name} className="w-full h-full object-cover object-top" style={{ imageRendering: "pixelated" }} />
                      </div>
                    </div>
                    <EquipSlots charEquipped={playerDetail?.char_equipped as CharEquipped | null | undefined} itemUpgRegistry={playerDetail?.item_upg_registry as Record<string,number> | null | undefined} slot_order={SLOT_ORDER} slot_label={SLOT_LABEL} />
                    <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-4 py-4 grid grid-cols-2 gap-x-6 gap-y-4">
                      {STATS_DEFS.map(s => {
                        const myVal = (profile?.player_stats as Record<string,number> | null | undefined)?.[s.key] ?? 0;
                        const theirVal = playerDetail?.player_stats?.[s.key] ?? 0;
                        const better = theirVal > myVal, worse = theirVal < myVal;
                        return (
                          <div key={s.key} className="flex flex-col">
                            <p className="text-[12px] font-bold uppercase tracking-wide text-[#8b6a3e] leading-none">{s.label}</p>
                            <p className={`text-[30px] font-black leading-tight tabular-nums ${better ? "text-emerald-400" : worse ? "text-red-400" : "text-[#f9e7b2]"}`}>{theirVal}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-3 text-center">
                        <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">Klienci</p>
                        <p className="text-[28px] font-black text-emerald-400 tabular-nums">{(selectedPlayer.customer_orders_completed ?? 0).toLocaleString("pl-PL")}</p>
                      </div>
                      <div className="rounded-xl border border-[#a8e890]/20 bg-[rgba(168,232,144,0.05)] p-3 text-center">
                        <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">Pieniądze</p>
                        <p className="text-[20px] font-black text-[#a8e890] tabular-nums">{new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN",minimumFractionDigits:0}).format(selectedPlayer.money)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Empty hint when no player selected ── */}
          {!showPanel && !rankingLoading && (
            <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 hidden xl:flex flex-col items-center gap-2 opacity-30">
              <span className="text-4xl">👆</span>
              <p className="text-sm text-[#8b6a3e] font-bold">Kliknij gracza</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#8b6a3e]/30 px-6 py-3 text-center text-xs text-[#8b6a3e]">
          Łącznie graczy: {rankingData.length}
        </div>

      </div>
    </div>
  );
}
