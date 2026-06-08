"use client";
import React from "react";
import { ModalOverlay } from "../../components/ModalOverlay";

interface Props {
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmModal({ onClose, onConfirm }: Props) {
  return (
    <ModalOverlay zIndex={500} bgOpacity={0.8} padding={false} onClick={onClose}>
      <div className="relative w-full max-w-[380px] rounded-[24px] border border-red-500/40 bg-[rgba(20,5,5,0.98)] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-[#8b6a3e] hover:text-red-400 transition">✕</button>
        <p className="mb-1 text-center text-3xl">🚪</p>
        <h3 className="mb-2 text-center text-xl font-black text-[#f9e7b2]">Wylogowanie</h3>
        <p className="mb-7 text-center text-base text-[#dfcfab]">Czy na pewno chcesz się wylogować?</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-[#8b6a3e]/60 bg-black/30 py-3 text-base font-bold text-[#dfcfab] transition hover:bg-white/5">
            Nie, zostań
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-2xl border border-red-500/60 bg-red-900/30 py-3 text-base font-bold text-red-300 transition hover:bg-red-900/50">
            Tak, wyloguj
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
