import type React from "react";
import type { RankingPlayer, Profile } from "../../types/profile";
import { ALL_SKINS } from "../../constants/avatars";

type RankingSort = "level" | "money" | "farmpower" | "customers";

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
  return (
    <div className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[rgba(22,13,8,0.99)]">
      <div className="flex w-full flex-1 min-h-0 flex-col overflow-hidden">

        {/* Header */}
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

        {/* Sort tabs + search + znajdź mnie */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#8b6a3e]/30 px-6 py-3">
          <button onClick={() => setRankingSort("farmpower")}
            className={rankingSort==="farmpower" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
            Moc farmy
          </button>
          <button onClick={() => setRankingSort("level")}
            className={rankingSort==="level" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
            Poziom
          </button>
          <button onClick={() => setRankingSort("money")}
            className={rankingSort==="money" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
            Pieniądze
          </button>
          <button onClick={() => setRankingSort("customers")}
            className={rankingSort==="customers" ? "rounded-xl bg-[#d4a64f] px-4 py-2 text-sm font-bold text-[#2b180c]" : "rounded-xl px-4 py-2 text-sm font-bold text-[#f1dfb5] hover:bg-white/5"}>
            😊 Zadowoleni klienci
          </button>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="text"
              value={rankingSearch}
              onChange={e => setRankingSearch(e.target.value)}
              placeholder="🔍 Szukaj nicku..."
              className="rounded-xl border border-[#8b6a3e]/60 bg-black/30 px-3 py-2 text-sm text-[#f3e6c8] placeholder-[#8b6a3e] outline-none focus:border-[#d4a64f]/80 w-44"
            />
            <button
              onClick={() => {
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
              }}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition border ${rankingHighlightMe ? "border-yellow-400 bg-yellow-500/20 text-yellow-300" : "border-[#8b6a3e]/50 bg-black/20 text-[#f1dfb5] hover:bg-white/5"}`}>
              🎯 Znajdź mnie
            </button>
          </div>
        </div>

        {/* Table */}
        <div ref={rankingScrollRef} className="flex-1 overflow-y-auto px-6 py-4">
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
                <col style={{width:"48px"}} />
                <col style={{width:"30%"}} />
                <col style={{width:"16%"}} />
                <col style={{width:"88px"}} />
                <col style={{width:"100px"}} />
                <col style={{width:"16%"}} />
                <col style={{width:"110px"}} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#8b6a3e]/40 text-left text-xs uppercase tracking-widest text-[#8b6a3e]">
                  <th className="py-3 pr-3">#</th>
                  <th className="py-3 pr-4">Gracz</th>
                  <th className="py-3 pr-3">Gildia</th>
                  <th className="py-3 pr-3 text-right">Poziom</th>
                  <th className="py-3 pr-3 text-right">😊 Klienci</th>
                  <th className="py-3 pr-3 text-right">Pieniądze</th>
                  <th className="py-3 text-right">Moc farmy</th>
                </tr>
              </thead>
              <tbody>
                {[...rankingData].sort((a,b) => {
                  if (rankingSort==="level") return (b.ranking_score ?? 0)-(a.ranking_score ?? 0);
                  if (rankingSort==="money") return b.money-a.money;
                  if (rankingSort==="customers") return (b.customer_orders_completed ?? 0)-(a.customer_orders_completed ?? 0);
                  return (b.farm_power ?? 0)-(a.farm_power ?? 0);
                }).filter(p => rankingSearch.trim()==="" || p.player_name.toLowerCase().includes(rankingSearch.trim().toLowerCase())).map((p,i) => {
                  const isMe = p.user_id === profile?.id;
                  const highlighted = rankingHighlightMe && isMe;
                  return (
                  <tr key={i} id={isMe ? "ranking-me-row" : undefined} className={`border-b border-[#8b6a3e]/20 transition ${highlighted ? "bg-yellow-500/20 outline outline-2 outline-yellow-400/60" : "hover:bg-white/5"}`}>
                    <td className="py-3 pr-3 font-black text-[#d8ba7a]">
                      {i===0 ? "🥇" : i===1 ? "🥈" : i===2 ? "🥉" : i+1}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={ALL_SKINS[isMe ? (avatarSkin >= 0 ? avatarSkin : 0) : ((p.avatar_skin ?? -1) >= 0 ? (p.avatar_skin ?? 0) : 0)] ?? ALL_SKINS[0]}
                          alt={p.player_name}
                          className="h-[52px] w-[52px] shrink-0 rounded-full object-cover border-2 border-[#8b6a3e]/60"
                          style={{imageRendering:"pixelated"}}
                        />
                        <span className={`text-sm font-bold truncate ${highlighted ? "text-yellow-200" : "text-[#f3e6c8]"}`}>{p.player_name}</span>
                        {!isMe && (<button type="button" onClick={() => openComposeTo(p.user_id, p.player_name)} className="ml-1 shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#8b6a3e]/50 bg-black/20 text-sm transition hover:border-[#d8ba7a]/70 hover:bg-[rgba(80,50,10,0.5)]" title={`Wyślij wiadomość do ${p.player_name}`}>✉️</button>)}
                      </div>
                    </td>
                    <td className="py-3 pr-3 italic text-[#8b6a3e] truncate overflow-hidden">{p.guild_name}</td>
                    <td className="py-3 pr-3 text-right font-black text-[#f2ca69]">⭐ {p.level}</td>
                    <td className="py-3 pr-3 text-right">
                      <span className={`font-bold tabular-nums ${(p.customer_orders_completed ?? 0) > 0 ? "text-emerald-400" : "text-[#8b6a3e]"}`}>
                        {(p.customer_orders_completed ?? 0).toLocaleString("pl-PL")}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right text-[#a8e890] tabular-nums">
                      {new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN",minimumFractionDigits:0}).format(p.money)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
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

        <div className="shrink-0 border-t border-[#8b6a3e]/30 px-6 py-3 text-center text-xs text-[#8b6a3e]">
          Łącznie graczy: {rankingData.length}
        </div>

      </div>
    </div>
  );
}
