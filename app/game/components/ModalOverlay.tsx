"use client";
import React from "react";

interface Props {
  zIndex: number;
  children: React.ReactNode;
  onClick?: () => void;
  padding?: boolean;
  blur?: boolean;
  bgOpacity?: number;
  align?: "center" | "start";
}

export function ModalOverlay({
  zIndex,
  children,
  onClick,
  padding = true,
  blur = true,
  bgOpacity = 0.75,
  align = "center",
}: Props) {
  return (
    <div
      className={`fixed inset-0 flex ${align === "center" ? "items-center" : "items-start"} justify-center${padding ? " p-4" : ""}${blur ? " backdrop-blur-sm" : ""}`}
      style={{ zIndex, background: `rgba(0,0,0,${bgOpacity})` }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
