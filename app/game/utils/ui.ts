import type React from "react";

export function ttStyle(mx: number, my: number, tipW = 288, tipH = 230): React.CSSProperties {
  const gw = 1920;
  const gh = 1280;
  const left = Math.min(mx + 18, gw - tipW - 8);
  const top = my > gh * 0.58
    ? Math.max(8, my - tipH)
    : Math.min(my + 16, gh - tipH - 8);
  return { left, top };
}
