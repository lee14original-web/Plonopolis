import type React from "react";
import type { GameMessage } from "../../types/messages";
import type { Profile } from "../../types/profile";
import { ALL_SKINS } from "../../constants/avatars";

type MessageTab = "systemowe" | "otrzymane" | "wyslane" | "targ";
type RecipientSuggestion = { id: string; username: string; avatar_skin?: number | null };

interface MessagesModalProps {
  onClose: () => void;
  showCompose: boolean;
  setShowCompose: (v: boolean) => void;
  loadMessages: () => Promise<void>;
  openBlankCompose: () => void;
  messageTab: MessageTab;
  setMessageTab: (t: MessageTab) => void;
  selectedMsgIds: Set<string>;
  setSelectedMsgIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  unreadCount: number;
  unreadMarketCount: number;
  composeRecipient: string;
  setComposeRecipient: (v: string) => void;
  setRecipientResolved: (v: RecipientSuggestion | null) => void;
  searchPlayers: (q: string) => Promise<void>;
  recipientSuggestions: RecipientSuggestion[];
  recipientResolved: RecipientSuggestion | null;
  composeSubject: string;
  setComposeSubject: (v: string) => void;
  composeBody: string;
  setComposeBody: (v: string) => void;
  composeCountdownSecs: number;
  composeError: string;
  composeSending: boolean;
  sendMessage: () => Promise<void>;
  messagesError: string;
  messagesLoading: boolean;
  gameMessages: GameMessage[];
  avatarSkin: number;
  profile: Profile | null;
  deleteSelectedMessages: (ids: string[]) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  toggleSaveMessage: (id: string, saved: boolean) => Promise<void>;
  blockedUsers: string[];
  blockUser: (id: string) => Promise<void>;
  unblockUser: (id: string) => Promise<void>;
  openComposeTo: (userId: string, username: string) => void;
}

export function MessagesModal({
  onClose,
  showCompose,
  setShowCompose,
  loadMessages,
  openBlankCompose,
  messageTab,
  setMessageTab,
  selectedMsgIds,
  setSelectedMsgIds,
  unreadCount,
  unreadMarketCount,
  composeRecipient,
  setComposeRecipient,
  setRecipientResolved,
  searchPlayers,
  recipientSuggestions,
  recipientResolved,
  composeSubject,
  setComposeSubject,
  composeBody,
  setComposeBody,
  composeCountdownSecs,
  composeError,
  composeSending,
  sendMessage,
  messagesError,
  messagesLoading,
  gameMessages,
  avatarSkin,
  profile,
  deleteSelectedMessages,
  deleteMessage,
  toggleSaveMessage,
  blockedUsers,
  blockUser,
  unblockUser,
  openComposeTo,
}: MessagesModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] w-full max-w-5xl flex-col rounded-[28px] border border-[#8b6a3e] bg-[rgba(22,13,8,0.98)] shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#8b6a3e]/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📬</span>
            <div>
              <h2 className="text-3xl font-black text-[#f9e7b2]">Wiadomości</h2>
              <p className="text-sm text-[#8b6a3e]">Skrzynka gracza Plonopolis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadMessages()}
              className="rounded-xl border border-[#8b6a3e]/50 bg-black/20 px-4 py-2 text-base font-bold text-[#8b6a3e] transition hover:border-[#d8ba7a]/50 hover:text-[#dfcfab]"
              title="Odśwież skrzynkę"
            >
              🔄
            </button>
            <button
              type="button"
              onClick={() => showCompose ? setShowCompose(false) : openBlankCompose()}
              className="rounded-xl border border-[#d8ba7a]/70 bg-[rgba(80,50,10,0.5)] px-5 py-2 text-base font-bold text-[#f9e7b2] transition hover:bg-[rgba(100,70,15,0.7)]">
              {showCompose ? "← Wróć" : "✉️ Nowa +"}
            </button>
            <button onClick={onClose}
              className="rounded-xl border border-[#8b6a3e]/50 bg-black/30 px-5 py-2 text-base font-bold text-[#f3e6c8] transition hover:border-red-400/50 hover:text-red-300">
              ✕ Zamknij
            </button>
          </div>
        </div>

        {/* Zakładki — ukryte podczas pisania nowej wiadomości */}
        {!showCompose && (
        <div className="flex shrink-0 gap-1 border-b border-[#8b6a3e]/30 bg-black/20 px-4 pt-3 pb-0">
          {([
            { key: "systemowe", label: "Systemowe", icon: "🔔" },
            { key: "otrzymane", label: "Otrzymane", icon: "📥" },
            { key: "wyslane",   label: "Wysłane",   icon: "📤" },
            { key: "targ",      label: "Targ",      icon: "🏪" },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => { setMessageTab(tab.key); setSelectedMsgIds(new Set()); }}
              className={`flex items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] transition border-b-2 ${messageTab === tab.key ? "border-[#d8ba7a] text-[#f9e7b2] bg-[rgba(80,50,20,0.3)]" : "border-transparent text-[#8b6a3e] hover:text-[#dfcfab]"}`}>
              {tab.icon} {tab.label}
              {tab.key === "otrzymane" && unreadCount > 0 && (
                <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">{unreadCount}</span>
              )}
              {tab.key === "targ" && unreadMarketCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-white">{unreadMarketCount}</span>
              )}
            </button>
          ))}
        </div>
        )}

        {/* Treść */}
        <div className="flex-1 overflow-y-auto p-5">
          {showCompose ? (
            <div className="relative z-10 flex h-full flex-col gap-4 pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✉️</span>
                <h3 className="text-xl font-black text-[#f9e7b2]">Nowa wiadomość</h3>
              </div>

              {/* Odbiorca z autouzupełnianiem */}
              <div className="relative">
                <label className="mb-1 block text-sm font-bold uppercase tracking-wider text-[#8b6a3e]">Do (login gracza)</label>
                <input
                  type="text"
                  value={composeRecipient}
                  onChange={e => {
                    const v = e.target.value;
                    setComposeRecipient(v);
                    setRecipientResolved(null);
                    void searchPlayers(v);
                  }}
                  placeholder="Wpisz login gracza..."
                  className="w-full rounded-xl border border-[#8b6a3e]/60 bg-black/30 px-4 py-3 text-base text-[#f3e6c8] placeholder:text-[#8b6a3e]/60 outline-none focus:border-[#d8ba7a]/70"
                />
                {/* Lista podpowiedzi */}
                {recipientSuggestions.length > 0 && !recipientResolved && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-[#8b6a3e]/60 bg-[rgba(22,13,8,0.98)] shadow-2xl">
                    {recipientSuggestions.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setRecipientResolved(s); setComposeRecipient(s.username); }}
                        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[rgba(80,50,10,0.5)]">
                        <img src={ALL_SKINS[((s.avatar_skin ?? -1) >= 0 ? (s.avatar_skin ?? 0) : 0)] ?? ALL_SKINS[0]} alt={s.username} className="h-14 w-14 shrink-0 rounded-full object-cover border border-[#8b6a3e]/60" style={{imageRendering:"pixelated"}} />
                        <span className="text-lg font-bold text-[#f3dfb4]">{s.username}</span>
                      </button>
                    ))}
                  </div>
                )}
                {recipientResolved && (
                  <p className="mt-1 text-sm font-bold text-green-400">✔ Gracz znaleziony: {recipientResolved.username}</p>
                )}
                {composeRecipient.length >= 2 && recipientSuggestions.length === 0 && !recipientResolved && (
                  <p className="mt-1 text-sm text-red-400">Nie znaleziono gracza o podanym loginie.</p>
                )}
              </div>

              {/* Temat */}
              <div>
                <label className="mb-1 block text-sm font-bold uppercase tracking-wider text-[#8b6a3e]">Temat</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  maxLength={120}
                  placeholder="Temat wiadomości..."
                  className="w-full rounded-xl border border-[#8b6a3e]/60 bg-black/30 px-4 py-3 text-base text-[#f3e6c8] placeholder:text-[#8b6a3e]/60 outline-none focus:border-[#d8ba7a]/70"
                />
              </div>

              {/* Treść */}
              <div className="flex flex-1 flex-col">
                <label className="mb-1 block text-sm font-bold uppercase tracking-wider text-[#8b6a3e]">Treść</label>
                <textarea
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  maxLength={2000}
                  placeholder="Napisz wiadomość..."
                  className="flex-1 resize-none rounded-xl border border-[#8b6a3e]/60 bg-black/30 px-4 py-3 text-base text-[#f3e6c8] placeholder:text-[#8b6a3e]/60 outline-none focus:border-[#d8ba7a]/70 min-h-[140px]"
                />
                <p className="mt-1 text-right text-sm text-[#8b6a3e]">{composeBody.length}/2000</p>
              </div>

              {/* Koszt i cooldown */}
              <div className="flex items-center gap-2 rounded-xl border border-[#8b6a3e]/40 bg-black/20 px-4 py-3">
                <span className="text-base">💰</span>
                <p className="text-sm text-[#8b6a3e]">Koszt wysłania: <span className="font-black text-[#f2ca69]">50 💰</span></p>
                {recipientResolved && composeCountdownSecs > 0 && (
                  <span className="ml-auto rounded-lg bg-red-950/40 px-2 py-0.5 text-sm font-black text-red-400">
                    ⏱ Odblokuj za: {Math.floor(composeCountdownSecs/60)}:{String(composeCountdownSecs%60).padStart(2,"0")}
                  </span>
                )}
              </div>
              {composeError && <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm font-bold text-red-400">{composeError}</p>}
              <button
                type="button"
                disabled={!recipientResolved || composeSending}
                onClick={() => void sendMessage()}
                className="rounded-xl border border-[#d8ba7a]/70 bg-[linear-gradient(180deg,#d9a93a,#a06e18)] px-6 py-3 text-base font-black text-[#1a0e00] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {composeSending ? "Wysyłanie..." : "📤 Wyślij wiadomość"}
              </button>
            </div>
          ) : (<>
          {messagesError && (
            <div className="mb-3 rounded-xl border border-red-500/50 bg-red-950/30 px-4 py-3">
              <p className="text-sm font-bold text-red-400">⚠️ {messagesError}</p>
              <p className="mt-1 text-xs text-red-400/70">Sprawdź konsolę przeglądarki (F12) po więcej szczegółów.</p>
            </div>
          )}
          {messagesLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="animate-pulse text-base text-[#8b6a3e]">Ładowanie wiadomości...</p>
            </div>
          ) : (() => {
            const filtered = gameMessages.filter(m => {
              if (messageTab === "systemowe") return m.category === "system";
              if (messageTab === "otrzymane") return m.category === "received";
              if (messageTab === "wyslane")   return m.category === "sent";
              if (messageTab === "targ")      return m.category === "market";
              return false;
            });
            const emptyIcon = messageTab === "systemowe" ? "🔔" : messageTab === "otrzymane" ? "📥" : messageTab === "targ" ? "🏪" : "📤";
            if (filtered.length === 0) return (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#8b6a3e]">
                <span className="text-7xl opacity-40">{emptyIcon}</span>
                <p className="text-base">{messageTab === "targ" ? "Brak powiadomień handlowych" : "Brak wiadomości"}</p>
              </div>
            );
            const selectable = messageTab !== "systemowe";
            const selectableIds = filtered.map(m => m.id);
            const allSelected = selectable && selectableIds.length > 0 && selectableIds.every(id => selectedMsgIds.has(id));
            const selectedInTab = selectableIds.filter(id => selectedMsgIds.has(id));
            return (
              <div className="space-y-3">
                {/* ─ Toolbar zaznaczania ─ */}
                {selectable && (
                  <div className="mb-1 flex items-center gap-3 rounded-xl border border-[#8b6a3e]/30 bg-black/20 px-4 py-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#dfcfab] select-none">
                      <input type="checkbox" checked={allSelected} onChange={() => {
                        if (allSelected) setSelectedMsgIds(prev => { const n = new Set(prev); selectableIds.forEach(id => n.delete(id)); return n; });
                        else setSelectedMsgIds(prev => { const n = new Set(prev); selectableIds.forEach(id => n.add(id)); return n; });
                      }} className="h-4 w-4 accent-yellow-400 cursor-pointer" />
                      {allSelected ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                    </label>
                    {selectedInTab.length > 0 && (
                      <>
                        <span className="text-xs text-[#8b6a3e]">Zaznaczono: <span className="font-bold text-yellow-300">{selectedInTab.length}</span></span>
                        <button type="button"
                          onClick={() => void deleteSelectedMessages(selectedInTab)}
                          className="ml-auto rounded-lg border border-red-600/50 bg-red-950/30 px-4 py-1.5 text-sm font-bold text-red-300 transition hover:bg-red-950/60">
                          🗑️ Usuń zaznaczone ({selectedInTab.length})
                        </button>
                      </>
                    )}
                  </div>
                )}
                {filtered.map(msg => (
                  <div key={msg.id}
                    className={`relative rounded-2xl border p-5 transition ${selectedMsgIds.has(msg.id) ? "border-yellow-400/50 bg-yellow-900/10" : !msg.read && msg.category !== "sent" ? (msg.category === "market" ? "border-amber-500/60 bg-[rgba(80,45,5,0.45)]" : "border-[#d8ba7a]/60 bg-[rgba(80,50,15,0.45)]") : "border-[#8b6a3e]/40 bg-black/20"}`}>

                    {/* Checkbox zaznaczania */}
                    {msg.category !== "system" && (
                      <input type="checkbox"
                        checked={selectedMsgIds.has(msg.id)}
                        onChange={() => setSelectedMsgIds(prev => { const n = new Set(prev); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n; })}
                        className="absolute right-4 top-4 h-5 w-5 accent-yellow-400 cursor-pointer"
                      />
                    )}
                    {/* Data */}
                    <p className="mb-2 text-xs text-[#8b6a3e]">
                      {new Date(msg.created_at).toLocaleDateString("pl-PL", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                    </p>

                    {/* Received / System / Market: Od kogo → Tytuł → Treść */}
                    {(msg.category === "received" || msg.category === "system" || msg.category === "market") && (<>
                      <div className="mb-2 flex items-center gap-3">
                        {msg.category === "system" ? (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#8b6a3e]/50 bg-black/30 text-xl">🔧</span>
                        ) : msg.category === "market" ? (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-600/60 bg-amber-950/40 text-xl">🏪</span>
                        ) : (
                          <img
                            src={ALL_SKINS[msg.from_avatar_skin ?? 0] ?? ALL_SKINS[0]}
                            alt={msg.from_username ?? ""}
                            className="h-10 w-10 shrink-0 rounded-full object-cover border border-[#8b6a3e]/60"
                            style={{imageRendering:"pixelated"}}
                          />
                        )}
                        <div>
                          <p className={`text-xs font-bold ${msg.category === "system" ? "text-red-400 tracking-wide uppercase" : msg.category === "market" ? "text-amber-400 tracking-wide uppercase" : "text-[#8b6a3e]"}`}>
                            {msg.category === "system" ? "⚙️ System Plonopolis" : msg.category === "market" ? "🏪 System Targu" : (msg.from_username ?? "Nieznany")}
                          </p>
                          <p className={`text-lg font-black ${!msg.read ? "text-[#f9e7b2]" : "text-[#dfcfab]"}`}>
                            {msg.subject || "(bez tytułu)"}
                          </p>
                        </div>
                      </div>
                      <p className={`text-base leading-relaxed whitespace-pre-wrap ${msg.category === "system" ? "text-white" : msg.category === "market" ? "text-amber-100/90" : "text-[#dfcfab]/90"}`}>{msg.body}</p>
                    </>)}

                    {/* Sent: Od kogo (ja) → Do kogo → Tytuł → Treść */}
                    {msg.category === "sent" && (<>
                      <div className="mb-2 flex items-center gap-3">
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <img
                            src={ALL_SKINS[msg.from_avatar_skin ?? avatarSkin ?? 0] ?? ALL_SKINS[0]}
                            alt={msg.from_username ?? profile?.login ?? "Ty"}
                            className="h-10 w-10 rounded-full object-cover border border-[#8b6a3e]/60"
                            style={{imageRendering:"pixelated"}}
                            title="Ty"
                          />
                          <span className="text-[9px] text-[#8b6a3e]">Ty</span>
                        </div>
                        <span className="text-[#8b6a3e]">→</span>
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <img
                            src={ALL_SKINS[msg.to_avatar_skin ?? 0] ?? ALL_SKINS[0]}
                            alt={msg.to_username ?? "Odbiorca"}
                            className="h-10 w-10 rounded-full object-cover border border-[#8b6a3e]/60"
                            style={{imageRendering:"pixelated"}}
                            title={msg.to_username ?? "Odbiorca"}
                          />
                          <span className="text-[9px] text-[#8b6a3e]">{msg.to_username ?? "?"}</span>
                        </div>
                        <div className="ml-1">
                          <p className="text-xs text-[#8b6a3e]">
                            <span className="font-bold text-[#d8ba7a]">{msg.from_username ?? profile?.login ?? "Ty"}</span>
                            {" → "}
                            <span className="font-bold text-[#d8ba7a]">{msg.to_username ?? "Nieznany"}</span>
                          </p>
                          <p className="text-lg font-black text-[#dfcfab]">{msg.subject || "(bez tytułu)"}</p>
                        </div>
                      </div>
                      <p className="text-base leading-relaxed text-[#dfcfab]/90 whitespace-pre-wrap">{msg.body}</p>
                    </>)}

                    {/* Akcje — Targ: tylko Usuń */}
                    {msg.category === "market" && (
                      <div className="mt-4 flex justify-end border-t border-[#8b6a3e]/20 pt-4">
                        <button type="button"
                          onClick={() => void deleteMessage(msg.id)}
                          className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-950/50 hover:border-red-500/60">
                          🗑️ Usuń
                        </button>
                      </div>
                    )}
                    {/* Akcje — Otrzymane: Zapisz / Blokuj / Odpowiedz / Usuń */}
                    {msg.category === "received" && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#8b6a3e]/20 pt-4">
                        <button type="button"
                          onClick={() => void toggleSaveMessage(msg.id, msg.saved)}
                          className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${msg.saved ? "border-green-600/60 bg-green-950/40 text-green-300 hover:bg-green-950/60" : "border-[#8b6a3e]/50 bg-black/20 text-[#8b6a3e] hover:border-[#d8ba7a]/50 hover:text-[#dfcfab]"}`}>
                          {msg.saved ? "✔ Zapisano" : "💾 Zapisz"}
                        </button>
                        {msg.from_user_id && (
                          blockedUsers.includes(msg.from_user_id) ? (
                            <button type="button"
                              onClick={() => void unblockUser(msg.from_user_id!)}
                              className="rounded-lg border border-blue-600/60 bg-blue-950/30 px-4 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-950/50">
                              ✅ Odblokuj
                            </button>
                          ) : (
                            <button type="button"
                              onClick={() => void blockUser(msg.from_user_id!)}
                              className="rounded-lg border border-red-600/50 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-950/40">
                              🚫 Blokuj
                            </button>
                          )
                        )}
                        {msg.from_user_id && !blockedUsers.includes(msg.from_user_id) && (
                          <button type="button"
                            onClick={() => openComposeTo(msg.from_user_id!, msg.from_username ?? "")}
                            className="rounded-lg border border-[#8b6a3e]/50 bg-black/20 px-4 py-2 text-sm font-bold text-[#8b6a3e] transition hover:border-[#d8ba7a]/50 hover:text-[#dfcfab]">
                            ✉️ Odpowiedz
                          </button>
                        )}
                        <button type="button"
                          onClick={() => void deleteMessage(msg.id)}
                          className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-950/50 hover:border-red-500/60">
                          🗑️ Usuń
                        </button>
                      </div>
                    )}
                    {/* Akcje (tylko sent) */}
                    {msg.type === "sent" && (
                      <div className="mt-4 flex justify-end border-t border-[#8b6a3e]/20 pt-4">
                        <button type="button"
                          onClick={() => void deleteMessage(msg.id)}
                          className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-950/50 hover:border-red-500/60">
                          🗑️ Usuń
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
          </>)}
        </div>

      </div>
    </div>
  );
}
