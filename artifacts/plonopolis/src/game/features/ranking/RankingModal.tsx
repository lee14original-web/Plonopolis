import React, { useState, useCallback } from "react";
import type { RankingPlayer, Profile } from "../../types/profile";
import { ALL_SKINS } from "../../constants/avatars";
import { STATS_DEFS } from "../../types/stats";
import { CHAR_EQUIP_ITEMS, EQUIP_SLOT_META, UPG_COLOR } from "../../constants/equipment";
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
  const [detailTab, setDetailTab] = useState<"stats" | "equip">("stats");

  const handleSelectPlayer = useCallback(async (p: RankingPlayer) => {
    if (selectedPlayer?.user_id === p.user_id) {
      setSelectedPlayer(null);
      setPlayerDetail(null);
      return;
    }
    setSelectedPlayer(p);
    setPlayerDetail(null);
    setDetailLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("player_stats, char_equipped, item_upg_registry, avatar_skin, level, login")
        .eq("id", p.user_id)
        .single();
      setPlayerDetail(data as PlayerDetail | null);
    } catch {
      setPlayerDetail(null);
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
            className={`overflow-y-auto px-6 py-4 transition-all duration-300 ${showPanel ? "w-[58%] border-r border-[#8b6a3e]/30" : "w-full"}`}>
            {rankingLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-3 text-4xl animate-spin">⚙️</div>
                  <p className="text-[#8b6a3e]">Ładowanie rankingu...</p>
                </div>
              </div>
            ) : (
              <table className="w-full border-collapse text-sm table-fixed">
                <colgroup>
                  <col style={{ width: "44px" }} />
                  <col />
                  {!showPanel && <col style={{ width: "14%" }} />}
                  <col style={{ width: "80px" }} />
                  {!showPanel && <col style={{ width: "90px" }} />}
                  {!showPanel && <col style={{ width: "15%" }} />}
                  <col style={{ width: "90px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#8b6a3e]/40 text-left text-xs uppercase tracking-widest text-[#8b6a3e]">
                    <th className="py-3 pr-2">#</th>
                    <th className="py-3 pr-3">Gracz</th>
                    {!showPanel && <th className="py-3 pr-3">Gildia</th>}
                    <th className="py-3 pr-2 text-right">Lvl</th>
                    {!showPanel && <th className="py-3 pr-2 text-right">😊</th>}
                    {!showPanel && <th className="py-3 pr-2 text-right">Pieniądze</th>}
                    <th className="py-3 text-right">Moc</th>
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
                        <td className="py-2.5 pr-2 font-black text-[#d8ba7a] text-sm">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={ALL_SKINS[isMe ? (avatarSkin >= 0 ? avatarSkin : 0) : ((p.avatar_skin ?? -1) >= 0 ? (p.avatar_skin ?? 0) : 0)] ?? ALL_SKINS[0]}
                              alt={p.player_name}
                              className="h-10 w-10 shrink-0 rounded-full object-cover object-top border-2 border-[#8b6a3e]/60"
                              style={{ imageRendering: "pixelated" }}
                            />
                            <div className="min-w-0">
                              <span className={`text-sm font-bold truncate block ${isSelected ? "text-[#f9e7b2]" : highlighted ? "text-yellow-200" : "text-[#f3e6c8]"}`}>
                                {p.player_name}
                              </span>
                              {showPanel && <span className="text-xs text-[#8b6a3e] truncate block">{p.guild_name || "Brak gildii"}</span>}
                            </div>
                          </div>
                        </td>
                        {!showPanel && <td className="py-2.5 pr-3 italic text-[#8b6a3e] truncate text-sm">{p.guild_name}</td>}
                        <td className="py-2.5 pr-2 text-right font-black text-[#f2ca69] text-sm">⭐ {p.level}</td>
                        {!showPanel && (
                          <td className="py-2.5 pr-2 text-right">
                            <span className={`font-bold tabular-nums text-sm ${(p.customer_orders_completed ?? 0) > 0 ? "text-emerald-400" : "text-[#8b6a3e]"}`}>
                              {(p.customer_orders_completed ?? 0).toLocaleString("pl-PL")}
                            </span>
                          </td>
                        )}
                        {!showPanel && (
                          <td className="py-2.5 pr-2 text-right text-[#a8e890] tabular-nums text-sm">
                            {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(p.money)}
                          </td>
                        )}
                        <td className="py-2.5 text-right tabular-nums text-sm">
                          <span className={`font-bold ${isMe ? "text-yellow-300" : "text-[#f3e6c8]"}`}>
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
          {showPanel && (
            <div className="w-[42%] flex flex-col overflow-y-auto bg-[rgba(18,10,4,0.60)]">
              {detailLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl animate-spin mb-2">⚙️</div>
                    <p className="text-sm text-[#8b6a3e]">Ładowanie profilu...</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col p-5 gap-4">

                  {/* Avatar + name + level */}
                  <div className="flex items-end gap-4">
                    <div className="relative shrink-0 overflow-hidden rounded-2xl border-2 border-[#8b6a3e]/80 shadow-xl"
                      style={{ width: 100, height: 150 }}>
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
                    <div className="flex-1 min-w-0">
                      <p className="text-[22px] font-black text-[#f9e7b2] leading-tight truncate">{selectedPlayer.player_name}</p>
                      <p className="text-sm text-[#8b6a3e] mt-0.5">{selectedPlayer.guild_name || "Brak gildii"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-xl bg-[rgba(212,166,79,0.18)] border border-[#d4a64f]/40 px-3 py-1 text-sm font-black text-[#f2ca69]">
                          ⭐ Poziom {selectedPlayer.level}
                        </span>
                        <span className="rounded-xl bg-[rgba(168,232,144,0.12)] border border-[#a8e890]/30 px-3 py-1 text-sm font-bold text-[#a8e890]">
                          ⚡ {(selectedPlayer.farm_power ?? 0).toLocaleString("pl-PL")} mocy
                        </span>
                      </div>
                      {/* Wiadomość */}
                      {selectedPlayer.user_id !== profile?.id && (
                        <button
                          onClick={() => openComposeTo(selectedPlayer.user_id, selectedPlayer.player_name)}
                          className="mt-2 rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-3 py-1.5 text-xs font-bold text-[#f3e6c8] transition hover:border-[#d8ba7a]/70 hover:bg-[rgba(80,50,10,0.5)]">
                          ✉️ Wyślij wiadomość
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 border-b border-[#8b6a3e]/30 pb-0">
                    {([["stats", "📊 Statystyki"], ["equip", "⚔️ Ekwipunek"]] as const).map(([tab, label]) => (
                      <button key={tab} onClick={() => setDetailTab(tab)}
                        className={`px-4 py-2 text-sm font-bold rounded-t-xl transition ${detailTab === tab ? "bg-[#d4a64f]/20 border border-[#d4a64f]/50 border-b-transparent text-[#f9e7b2]" : "text-[#8b6a3e] hover:text-[#f1dfb5]"}`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Tab: Statystyki */}
                  {detailTab === "stats" && (
                    <div className="flex flex-col gap-2">
                      <div className="rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-3">
                        {STATS_DEFS.map(s => {
                          const val = (playerDetail?.player_stats?.[s.key] ?? 0);
                          return (
                            <div key={s.key} className="flex items-center gap-2">
                              <img src={s.img} alt={s.label}
                                className="w-7 h-7 shrink-0 rounded-lg border border-[#8b6a3e]/40 object-cover"
                                style={{ imageRendering: "pixelated" }}
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-[#8b6a3e] leading-none">{s.label}</p>
                                <p className="text-[16px] font-black text-[#f9e7b2] leading-tight">{val}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Dodatkowe info */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-3 text-center">
                          <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">😊 Klienci</p>
                          <p className="text-[18px] font-black text-emerald-400">{(selectedPlayer.customer_orders_completed ?? 0).toLocaleString("pl-PL")}</p>
                        </div>
                        <div className="rounded-xl border border-[#a8e890]/20 bg-[rgba(168,232,144,0.05)] p-3 text-center">
                          <p className="text-[11px] text-[#8b6a3e] font-bold uppercase tracking-wide">💰 Pieniądze</p>
                          <p className="text-[16px] font-black text-[#a8e890]">
                            {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(selectedPlayer.money)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab: Ekwipunek */}
                  {detailTab === "equip" && (
                    <div className="flex flex-col gap-3">
                      {SLOT_ORDER.map(slot => {
                        const slotMeta = EQUIP_SLOT_META[slot];
                        const equipped = (playerDetail?.char_equipped as CharEquipped | null | undefined)?.[slot];
                        const itemDef = equipped ? CHAR_EQUIP_ITEMS.find(i => i.id === equipped.id) : null;
                        const upg = equipped ? ((playerDetail?.item_upg_registry as Record<string, number> | null | undefined)?.[equipped.id] ?? equipped.upg ?? 0) : 0;
                        const upgColor = UPG_COLOR[upg] ?? "#9CA3AF";

                        return (
                          <div key={slot}
                            className={`rounded-2xl border p-3 transition ${itemDef ? "border-[#8b6a3e]/50 bg-[rgba(38,24,14,0.60)]" : "border-[#8b6a3e]/20 bg-black/10 opacity-60"}`}>
                            <div className="flex items-start gap-3">
                              {/* Slot icon / item image */}
                              <div className="relative shrink-0 w-14 h-14 rounded-xl border border-[#8b6a3e]/50 bg-black/30 overflow-hidden flex items-center justify-center">
                                {itemDef?.img ? (
                                  <img src={itemDef.img} alt={itemDef.name}
                                    className="w-full h-full object-cover"
                                    style={{ imageRendering: "pixelated" }}
                                    onError={e => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                      const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                                      if (fb) fb.style.display = "flex";
                                    }} />
                                ) : null}
                                <span className={`text-2xl ${itemDef?.img ? "hidden" : "flex"} items-center justify-center`}>
                                  {itemDef?.icon ?? slotMeta.icon}
                                </span>
                                {/* Upgrade badge */}
                                {upg > 0 && (
                                  <div className="absolute bottom-0 right-0 rounded-tl-lg px-1 py-0.5 text-[10px] font-black"
                                    style={{ background: "rgba(0,0,0,0.85)", color: upgColor, border: `1px solid ${upgColor}40` }}>
                                    +{upg}
                                  </div>
                                )}
                              </div>

                              {/* Item info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-[13px] font-black text-[#f9e7b2] leading-tight">
                                    {itemDef?.name ?? <span className="text-[#8b6a3e]">{slotMeta.label} — brak</span>}
                                  </p>
                                  {upg > 0 && (
                                    <span className="text-[11px] font-black px-1.5 py-0.5 rounded-md"
                                      style={{ color: upgColor, background: `${upgColor}18`, border: `1px solid ${upgColor}50` }}>
                                      +{upg}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#8b6a3e] mt-0.5">{slotMeta.label} · Wymagany lvl {itemDef?.unlockLevel ?? "—"}</p>
                                {/* Bonusy */}
                                {itemDef && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {itemDef.bonuses.map((b, bi) => {
                                      const total = upg > 0 ? +(b.base * (1 + upg * 0.1)).toFixed(1) : b.base;
                                      return (
                                        <span key={bi} className="text-[11px] font-bold rounded px-1.5 py-0.5 bg-green-900/30 border border-green-600/30 text-green-300">
                                          +{total}{b.label}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Opis */}
                                {itemDef?.desc && (
                                  <p className="mt-1.5 text-[11px] italic text-[#8b6a3e]/80 leading-snug">&ldquo;{itemDef.desc}&rdquo;</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {!playerDetail?.char_equipped && !detailLoading && (
                        <p className="text-center text-sm text-[#8b6a3e] py-4">Brak danych o ekwipunku</p>
                      )}
                    </div>
                  )}

                  {/* Close hint */}
                  <button onClick={() => { setSelectedPlayer(null); setPlayerDetail(null); }}
                    className="mt-auto self-center text-xs text-[#8b6a3e] hover:text-[#f1dfb5] transition py-1">
                    ✕ Zamknij panel
                  </button>
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
