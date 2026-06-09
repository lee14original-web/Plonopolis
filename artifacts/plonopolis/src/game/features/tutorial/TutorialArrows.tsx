"use client";

import type { Profile } from "../../types/profile";

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
          const _noArrow=[7,9,11,13];
          const _tutActive=!!profile?.id&&profile.tutorial_started===true&&profile.tutorial_completed!==true&&profile.tutorial_skipped!==true;
          if(!_tutActive||_noArrow.includes(tutorialStep)) return null;
          type SA={x:number;y:number;size:number;rotation:number};
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
            const ox=-291, cy=ft+fh/2, sz=80, ah=Math.round(sz*62/48);
            return <>{[
              {x:cx+ox,         y:ft-ah/2-14, rotation:0   as number, k:"top"},
              {x:cx+ox,         y:fb+ah/2+14, rotation:180 as number, k:"bottom"},
              {x:fl+ox-sz/2-14, y:cy,          rotation:-90 as number, k:"left"},
              {x:fr+ox+sz/2+14, y:cy,          rotation:90  as number, k:"right"},
            ].map(({x,y,rotation,k})=>arr({x,y,size:sz,rotation},`tut-arr-1-${k}`))}</>;
          }
          // Kroki 2–11: stałe pozycje z final config
          const cfgN:Record<number,SA>={
            2: {x:153.37, y:132.50, size:108, rotation:0},
            3: {x:1090.00,y:587.14, size:80,  rotation:0},
            5: {x:154.37, y:326.88, size:102, rotation:0},
            6: {x:852.61, y:643.44, size:122, rotation:90},
            8: {x:155.37, y:529.25, size:112, rotation:0},
            10:{x:152.35, y:718.63, size:118, rotation:0},
          };
          // Krok 12: dwie fazy — przed otwarciem modalu (→ Zbiory) i po otwarciu (→ panel sesji)
          if(tutorialStep===12){
            // Faza 2: modal otwarty — statyczna strzałka w prawo przy panelu sesji
            if(isFvHarvestModalOpen){
              return arr({x:515,y:786,size:80,rotation:-90},"tut-arr-12-modal");
            }
            // Faza 1: modal zamknięty — strzałka na przycisk Zbiory (pozycja z fvZbioryPos)
            const _sz=fvTutArrow12Pos.w||80;
            const _ah=Math.round(_sz*62/48);
            return arr({x:fvZbioryPos.l+fvZbioryPos.w/2,y:fvZbioryPos.t-_ah/2-16,size:_sz,rotation:0},"tut-arr-12");
          }
          // Krok 13: stała strzałka — x=948, y=287
          if(tutorialStep===13){
            const _13sz=fvTutArrow13Pos.w||80;
            const _13h=Math.round(_13sz*62/48);
            const _13x=Math.max(24+_13sz/2,Math.min(window.innerWidth-24-_13sz/2,fvTutArrow13Pos.lPct*window.innerWidth/100));
            const _13y=Math.max(24+_13h/2,Math.min(window.innerHeight-24-_13h/2,fvTutArrow13Pos.tPct*window.innerHeight/100));
            return arr({x:_13x,y:_13y,size:_13sz,rotation:0},"tut-arr-13");
          }
          const a=cfgN[tutorialStep]; return a?arr(a,`tut-arr-${tutorialStep}`):null;
}
