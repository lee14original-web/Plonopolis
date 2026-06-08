"use client";
import React from "react";
import type { GameSettings, GraphicsQuality } from "../../types/settings";
import { ModalOverlay } from "../../components/ModalOverlay";

interface Props {
  gameSettings: GameSettings;
  saveGameSettings: (s: GameSettings) => void;
  onClose: () => void;
  onOpenLogout: () => void;
  userZoomFactor: number;
  setUserZoomFactor: React.Dispatch<React.SetStateAction<number>>;
}

export function SettingsModal({ gameSettings, saveGameSettings, onClose, onOpenLogout, userZoomFactor, setUserZoomFactor }: Props) {
  return (
    <ModalOverlay zIndex={500} bgOpacity={0.8} padding={false} onClick={onClose}>
      <div className="relative w-full max-w-[560px] max-h-[calc(100vh-40px)] overflow-y-auto rounded-[24px] border border-[#8b6a3e]/60 bg-[rgba(20,12,6,0.98)] p-7 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-xl text-[#8b6a3e] transition hover:text-[#f9e7b2]">✕</button>
        <p className="mb-1 text-center text-3xl">⚙️</p>
        <h3 className="mb-5 text-center text-xl font-black text-[#f9e7b2]">Ustawienia</h3>

        {/* ─── Muzyka ─── */}
        <div className="mb-4 rounded-xl border border-[#8b6a3e]/40 bg-black/20 p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#d8ba7a]">🎵 Muzyka</p>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm text-[#dfcfab]">Muzyka włączona</span>
            <button
              type="button"
              onClick={() => saveGameSettings({ ...gameSettings, musicEnabled: !gameSettings.musicEnabled })}
              className={`relative h-6 w-11 rounded-full border transition ${gameSettings.musicEnabled ? "border-amber-500/60 bg-amber-600/40" : "border-[#8b6a3e]/40 bg-black/30"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${gameSettings.musicEnabled ? "left-5 bg-amber-400" : "left-0.5 bg-[#8b6a3e]"}`} />
            </button>
          </label>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-5 text-center text-base">{!gameSettings.musicEnabled ? "🔇" : gameSettings.musicVolume < 0.15 ? "🔈" : gameSettings.musicVolume < 0.6 ? "🔉" : "🔊"}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(gameSettings.musicVolume * 100)}
              onChange={e => {
                const v = parseInt(e.target.value) / 100;
                saveGameSettings({ ...gameSettings, musicVolume: v, musicEnabled: v > 0 });
              }}
              className="flex-1 cursor-pointer accent-[#d8ba7a]"
            />
            <span className="w-9 text-right text-xs font-bold tabular-nums text-[#d8ba7a]">{Math.round(gameSettings.musicVolume * 100)}%</span>
          </div>
        </div>

        {/* ─── Dźwięki ─── */}
        <div className="mb-4 rounded-xl border border-[#8b6a3e]/40 bg-black/20 p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#d8ba7a]">🔊 Dźwięki</p>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm text-[#dfcfab]">Efekty dźwiękowe</span>
            <button
              type="button"
              onClick={() => saveGameSettings({ ...gameSettings, soundEnabled: !gameSettings.soundEnabled })}
              className={`relative h-6 w-11 rounded-full border transition ${gameSettings.soundEnabled ? "border-amber-500/60 bg-amber-600/40" : "border-[#8b6a3e]/40 bg-black/30"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${gameSettings.soundEnabled ? "left-5 bg-amber-400" : "left-0.5 bg-[#8b6a3e]"}`} />
            </button>
          </label>
        </div>

        {/* ─── Grafika ─── */}
        <div className="mb-4 rounded-xl border border-[#8b6a3e]/40 bg-black/20 p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#d8ba7a]">🖼️ Grafika</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[#dfcfab]">Jakość grafiki</span>
            <div className="flex gap-1.5">
              {(["low","medium","high"] as GraphicsQuality[]).map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => saveGameSettings({ ...gameSettings, graphicsQuality: q })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${gameSettings.graphicsQuality === q ? "border-amber-500/70 bg-amber-600/30 text-amber-300" : "border-[#8b6a3e]/40 bg-black/20 text-[#8b6a3e] hover:border-[#8b6a3e]/70 hover:text-[#dfcfab]"}`}
                >
                  {q === "low" ? "Niska" : q === "medium" ? "Średnia" : "Wysoka"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Rozmiar gry ─── */}
        <div className="mb-4 rounded-xl border border-[#8b6a3e]/40 bg-black/20 p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#d8ba7a]">🔍 Rozmiar gry</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setUserZoomFactor(prev => Math.max(0.80, Math.round((prev - 0.05) * 100) / 100))}
              disabled={userZoomFactor <= 0.80}
              className="h-9 w-9 shrink-0 rounded-lg border border-[#8b6a3e]/40 bg-black/20 text-xl font-black text-[#dfcfab] transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >−</button>
            <span className="flex-1 text-center text-lg font-black tabular-nums text-[#f9e7b2]">{Math.round(userZoomFactor * 100)}%</span>
            <button
              type="button"
              onClick={() => setUserZoomFactor(prev => Math.min(1.30, Math.round((prev + 0.05) * 100) / 100))}
              disabled={userZoomFactor >= 1.30}
              className="h-9 w-9 shrink-0 rounded-lg border border-[#8b6a3e]/40 bg-black/20 text-xl font-black text-[#dfcfab] transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >+</button>
          </div>
          <p className="mt-2 text-xs text-[#8b6a3e]">Zmienia rozmiar świata gry. Panel i okna dialogowe zostają bez zmian.</p>
          {userZoomFactor !== 1.00 && (
            <button
              type="button"
              onClick={() => setUserZoomFactor(1.00)}
              className="mt-2 w-full rounded-lg border border-[#8b6a3e]/30 bg-black/10 py-1.5 text-xs font-bold text-[#8b6a3e] transition hover:text-[#dfcfab] hover:border-[#8b6a3e]/60"
            >Domyślny (100%)</button>
          )}
        </div>

        {/* ─── Inne ─── */}
        <div className="mb-5 rounded-xl border border-[#8b6a3e]/40 bg-black/20 p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#d8ba7a]">⚙️ Inne</p>
          <p className="mb-3 text-xs text-[#8b6a3e]">Więcej opcji pojawi się w kolejnych aktualizacjach.</p>
          <button
            onClick={onOpenLogout}
            className="w-full rounded-xl border border-red-500/40 bg-red-950/30 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-950/50 hover:border-red-400/60"
          >
            🚪 Wyloguj
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-2xl border border-[#8b6a3e]/60 bg-black/30 py-3 text-base font-bold text-[#dfcfab] transition hover:bg-white/5"
        >
          Zamknij
        </button>
      </div>
    </ModalOverlay>
  );
}
