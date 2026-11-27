import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { color, f, radius, shadow } from "@/app/styleTokens";
import { measure, placeTooltip, prefersReducedMotion } from "./HomeOnboarding";
import type { Placement } from "./onboardingSteps";

/**
 * 시작 튜토리얼 한 단계(스포트라이트 + 말풍선). 홈 온보딩 말풍선과 같은 모양(단계 점 · n/3 · 건너뛰기).
 * 다른 점: **밝힌 자리는 눌러진다**(직접 해 보기). 어두운 바깥만 막는다(구멍 둘레 네 조각).
 */
const PAD = 8;
const TIP_W = 320;
const DIM = "rgba(15, 23, 42, 0.58)";

export function Coachmark({ target, title, body, step, total, placement = "right", onSkip, actions, pulse, tip }: {
  /** data-onboarding 선택자 */
  target: string;
  title: string;
  body: string;
  /** 1부터 */
  step: number;
  total: number;
  placement?: Placement;
  /** 없으면 머리줄 건너뛰기를 숨긴다(홈 단계는 [혼자 둘러볼게요]가 대신한다) */
  onSkip?: () => void;
  actions: ReactNode;
  /** 밝힌 영역 안에서 반짝일 요소(누를 곳) 선택자 */
  pulse?: string;
  /** 마무리 말풍선(튜토리얼 끝): 화면을 어둡게 하거나 막지 않고 대상에 파란 테두리만. 머리줄은 단계 점을 다 채우고 "다 했어요".
   *  건너뛰기 버튼은 없고 onSkip은 Esc로만 쓴다 */
  tip?: boolean;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tipH, setTipH] = useState(170);
  const tipRef = useRef<HTMLDivElement>(null);

  // 대상이 그려지고 자리를 잡을 때까지 매 프레임 잰다(패널이 열리는 애니메이션 200ms)
  useEffect(() => {
    let raf = 0;
    // 반짝이는 테두리(2px + 3px 띄움)가 밝힌 영역 밖으로 나가 잘리지 않게, 누를 곳 둘레 6px까지 합쳐 밝힌다(2026-11-20)
    const tick = () => {
      const r = measure(target);
      const p = pulse ? document.querySelector(pulse)?.getBoundingClientRect() : null;
      if (r && p && p.width) {
        const left = Math.min(r.left, p.left - 6), top = Math.min(r.top, p.top - 6);
        setRect(new DOMRect(left, top, Math.max(r.right, p.right + 6) - left, Math.max(r.bottom, p.bottom + 6) - top));
      } else setRect(r);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, pulse]);

  useLayoutEffect(() => {
    const h = tipRef.current?.offsetHeight;
    if (h && Math.abs(h - tipH) > 1) setTipH(h);
  });

  // 누를 곳 반짝임: 대상 쪽 요소에 속성만 붙이고 모양은 theme.css(.starter-pulse)
  useEffect(() => {
    if (!pulse) return;
    let el: Element | null = null;
    const t = window.setInterval(() => {
      const next = document.querySelector(pulse);
      if (next === el) return;
      el?.removeAttribute("data-starter-pulse");
      el = next; el?.setAttribute("data-starter-pulse", "");
    }, 150);
    return () => { window.clearInterval(t); el?.removeAttribute("data-starter-pulse"); };
  }, [pulse]);

  useEffect(() => {
    if (!onSkip) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onSkip(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onSkip]);

  if (!rect) return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const spot = new DOMRect(Math.max(rect.left - PAD, 0), Math.max(rect.top - PAD, 0), Math.min(rect.width + PAD * 2, vw), Math.min(rect.height + PAD * 2, vh));
  const width = Math.min(TIP_W, vw - 24);
  const pos = placeTooltip(spot, width, tipH, placement);
  const block = "fixed";

  return createPortal(
    <div className="fixed inset-0 z-[120] pointer-events-none" style={f}>
      {tip ? (
        // 마무리 말풍선: 어둡게 하지 않는다. 대상 둘레에 파란 테두리만
        <div aria-hidden className="fixed" style={{ left: spot.left + 4, top: spot.top + 4, width: spot.width - 8, height: spot.height - 8, borderRadius: radius.card, outline: `2px solid ${color.brand}`, outlineOffset: 0 }} />
      ) : <>
      {/* 어두운 바깥: 구멍 둘레 네 조각만 막는다. 구멍(대상)은 그대로 눌린다 */}
      <div className={`${block} pointer-events-auto`} style={{ left: 0, top: 0, width: vw, height: spot.top }} />
      <div className={`${block} pointer-events-auto`} style={{ left: 0, top: spot.bottom, width: vw, height: Math.max(vh - spot.bottom, 0) }} />
      <div className={`${block} pointer-events-auto`} style={{ left: 0, top: spot.top, width: spot.left, height: spot.height }} />
      <div className={`${block} pointer-events-auto`} style={{ left: spot.right, top: spot.top, width: Math.max(vw - spot.right, 0), height: spot.height }} />
      <div aria-hidden className="fixed" style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height, borderRadius: radius.card, boxShadow: `0 0 0 9999px ${DIM}`, outline: "2px solid rgba(255,255,255,0.9)" }} />
      </>}

      <div ref={tipRef} role="dialog" aria-label={title} className="fixed pointer-events-auto"
        style={{ top: pos.top, left: pos.left, width, background: color.surface.default, borderRadius: radius.card, boxShadow: shadow.modal, padding: "18px 20px 20px",
          animation: prefersReducedMotion() ? undefined : "starter-in 160ms ease" }}>
        <div className="flex items-center justify-between" style={{ height: 24 }}>
          <span className="flex items-center gap-2" aria-label={tip ? `${total}단계를 모두 했어요` : `${total}단계 중 ${step}단계`}>
            <span aria-hidden className="flex gap-1">
              {Array.from({ length: total }, (_, i) => <span key={i} style={{ width: !tip && i === step - 1 ? 14 : 6, height: 6, borderRadius: 3, background: tip || i < step ? color.brand : color.border.default }} />)}
            </span>
            <span aria-hidden style={{ fontSize: 12, fontWeight: 600, color: tip ? color.brand : color.text.secondary, fontVariantNumeric: "tabular-nums" }}>{tip ? "다 했어요" : `${step}/${total}`}</span>
          </span>
          {onSkip && !tip && (
            <button type="button" onClick={onSkip} className="rounded-md px-1.5 py-0.5 outline-none hover:bg-[#f1f5f9] focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 12.5, fontWeight: 600, color: color.text.secondary }}>건너뛰기</button>
          )}
        </div>
        {/* 글자 위계(2026-11-20 사용자 "텍스트 두께 위계가 덜 잡혔다"): 제목 18 굵게 진하게, 설명 14 보통 굵기 회색 */}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.4px", lineHeight: "26px", marginTop: 12, wordBreak: "keep-all" }}>{title}</h2>
        <p style={{ fontSize: 14, fontWeight: 400, color: "#64748b", lineHeight: "22px", marginTop: 6, wordBreak: "keep-all" }}>{body}</p>
        <div className="flex items-center justify-end gap-2" style={{ marginTop: 20 }}>{actions}</div>
      </div>
    </div>,
    document.body,
  );
}
