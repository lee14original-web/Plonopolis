"use client";

import { createPortal } from "react-dom";
import type { Profile } from "../../types/profile";
import { BASE_W, BASE_H } from "../../constants/map";

interface TutorialArrowsProps {
  profile: Profile | null;
  tutorialStep: number;
  tutorialArrow: { cx: number; top: number; bottom: number; left: number; right: number; width: number; height: number } | null;
  isFvHarvestModalOpen: boolean;
  fvZbioryPos: { l: number; t: number; w: number; h: number };
  fvTutArrow12Pos: { lPct: number; tPct: number; w: number };
  fvTutArrow13Pos: { lPct: number; tPct: number; w: number };
}

export function TutorialArrows({
  profile,
  tutorialStep,
  tutorialArrow,
  isFvHarvestModalOpen,
  fvZbioryPos,
  fvTutArrow12Pos,
  fvTutArrow13Pos,
}: TutorialArrowsProps) {
  const content = renderTutorialArrowsContent({
    profile,
    tutorialStep,
    tutorialArrow,
    isFvHarvestModalOpen,
    fvZbioryPos,
    fvTutArrow12Pos,
    fvTutArrow13Pos,
  });
  if (!content) return null;
  // Portal poza <main> (ma transform: scale(gameScale)), które inaczej tworzyłoby
  // nowy containing block dla position:fixed i podwójnie skalowałoby pozycje strzałek.
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

function renderTutorialArrowsContent({
  profile,
  tutorialStep,
  tutorialArrow,
  isFvHarvestModalOpen,
  fvZbioryPos,
  fvTutArrow12Pos,
  fvTutArrow13Pos,
}: TutorialArrowsProps) {
          const _noArrow=[7,9,11,13];
          const _tutActive=!!profile?.id&&profile.tutorial_started===true&&profile.tutorial_completed!==true&&profile.tutorial_skipped!==true;
          if(!_tutActive||_noArrow.includes(tutorialStep)) return null;
          type SA={x:number;y:number;size:number;rotation:number};
          // Kroki 2,5,6,8,10,12,13 używają współrzędnych w przestrzeni canvasu gry (BASE_W×BASE_H),
          // które <main> normalnie skaluje razem z resztą UI (transform: scale(gameScale)).
          // Ponieważ strzałki renderujemy portalem poza <main>, trzeba je ręcznie przeliczyć
          // na realne piksele ekranu, identycznie jak robi to <main> (patrz Game.tsx ~linia 5771).
          const _gs=typeof window!=="undefined"?Math.min(window.innerWidth/BASE_W,window.innerHeight/BASE_H):1;
          const _ox=typeof window!=="undefined"?window.innerWidth/2-(BASE_W*_gs)/2:0;
          const _oy=typeof window!=="undefined"?window.innerHeight/2-(BASE_H*_gs)/2:0;
          const canvasToScreen=(a:SA):SA=>({x:_ox+a.x*_gs, y:_oy+a.y*_gs, size:a.size*_gs, rotation:a.rotation});
          // Rotation na osobnym wrapperze wewnętrznym — nie na animate-bounce div.
          // CSS @keyframes bounce nadpisuje transform inline na tym samym elemencie.
          // Lewa/prawa strzałka (rotation ±90): animacja pozioma, bez skakania góra/dół.
          const arr=(a:SA,key:string)=>{
            const h=Math.round(a.size*62/48);
            const isH=Math.abs(a.rotation)===90;
            const bounceAnim=isH
              ? (a.rotation===-90
                  ? "bounceLeft 1s ease-in-out infinite"
                  : "bounceRight 1s ease-in-out infinite")
              : undefined;
            return(
            <div key={key} className="fixed z-[93] pointer-events-none" style={{left:a.x-a.size/2,top:a.y-h/2}}>
              <style>{`
                @keyframes bounceLeft{0%,100%{transform:translateX(-20%);animation-timing-function:cubic-bezier(0.8,0,1,1)}50%{transform:translateX(0);animation-timing-function:cubic-bezier(0,0,0.2,1)}}
                @keyframes bounceRight{0%,100%{transform:translateX(20%);animation-timing-function:cubic-bezier(0.8,0,1,1)}50%{transform:translateX(0);animation-timing-function:cubic-bezier(0,0,0.2,1)}}
              `}</style>
              <div className={isH?undefined:"animate-bounce"} style={isH?{animation:bounceAnim}:{}}>
                <div style={{transform:`rotate(${a.rotation}deg)`}}>
                  <svg width={a.size} height={h} viewBox="0 0 48 62" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 62 L0 28 H16 V0 H32 V28 H48 Z" fill="#f9e7b2" stroke="#8b6a3e" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          );};
          // Step 1: pozycje liczone z getBoundingClientRect "Pola uprawne" (tutorialArrow)
          if(tutorialStep===1){
            if(!tutorialArrow) return null;
            const {cx,top:ft,bottom:fb,left:fl,right:fr,height:fh}=tutorialArrow;
            const cy=ft+fh/2, sz=80, ah=Math.round(sz*62/48);
            return <>{[
              {x:cx,         y:ft-ah/2-14, rotation:0   as number, k:"top"},
              {x:cx,         y:fb+ah/2+14, rotation:180 as number, k:"bottom"},
              {x:fl-sz/2-14, y:cy,          rotation:-90 as number, k:"left"},
              {x:fr+sz/2+14, y:cy,          rotation:90  as number, k:"right"},
            ].map(({x,y,rotation,k})=>arr({x,y,size:sz,rotation},`tut-arr-1-${k}`))}</>;
          }
          // Krok 3: pozycja liczona dynamicznie z getBoundingClientRect celu (guide-compost-item)
          // Strzałka wchodzi z lewej strony, żeby nie zasłaniać tekstu tooltipa nad przedmiotem.
          if(tutorialStep===3){
            if(!tutorialArrow) return null;
            const {left:il,top:it,height:ih}=tutorialArrow;
            const sz=80, cy=it+ih/2;
            return arr({x:il-sz/2-14,y:cy,size:sz,rotation:-90},"tut-arr-3");
          }
          // Kroki 2,5,6,8,10: stałe pozycje z final config (w przestrzeni canvasu gry)
          const cfgN:Record<number,SA>={
            2: {x:153.37, y:132.50, size:108, rotation:0},
            5: {x:154.37, y:326.88, size:102, rotation:0},
            6: {x:852.61, y:643.44, size:122, rotation:90},
            8: {x:155.37, y:529.25, size:112, rotation:0},
            10:{x:152.35, y:718.63, size:118, rotation:0},
          };
          // Krok 12: dwie fazy — przed otwarciem modalu (→ Zbiory) i po otwarciu (→ panel sesji)
          if(tutorialStep===12){
            // Faza 2: modal otwarty — statyczna strzałka w prawo przy panelu sesji (canvas-space)
            if(isFvHarvestModalOpen){
              return arr(canvasToScreen({x:515,y:786,size:80,rotation:-90}),"tut-arr-12-modal");
            }
            // Faza 1: modal zamknięty — strzałka na przycisk Zbiory (pozycja z fvZbioryPos, canvas-space)
            const _sz=fvTutArrow12Pos.w||80;
            const _ah=Math.round(_sz*62/48);
            return arr(canvasToScreen({x:fvZbioryPos.l+fvZbioryPos.w/2,y:fvZbioryPos.t-_ah/2-16,size:_sz,rotation:0}),"tut-arr-12");
          }
          // Krok 13: pozycja jako % canvasu gry (BASE_W×BASE_H), przeliczana na ekran
          if(tutorialStep===13){
            const _13sz=fvTutArrow13Pos.w||80;
            const _13cx=Math.max(_13sz/2,Math.min(BASE_W-_13sz/2,fvTutArrow13Pos.lPct*BASE_W/100));
            const _13cy=Math.max(_13sz/2,Math.min(BASE_H-_13sz/2,fvTutArrow13Pos.tPct*BASE_H/100));
            return arr(canvasToScreen({x:_13cx,y:_13cy,size:_13sz,rotation:0}),"tut-arr-13");
          }
          const a=cfgN[tutorialStep]; return a?arr(canvasToScreen(a),`tut-arr-${tutorialStep}`):null;
}
