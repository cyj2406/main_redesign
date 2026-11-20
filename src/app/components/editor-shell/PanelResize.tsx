import { useCallback, useRef, useState } from "react";
import { color } from "@/app/styleTokens";

/**
 * 패널 너비 조절(에디터 공통, 2026-11-19) — 템플릿·딸깍 AI·코멘트·버전 기록 패널의 안쪽 가장자리를 끌어 너비를 바꾼다.
 * Figma·VS Code·Notion 사이드바처럼: 가장자리에 마우스를 올리면 파란 선과 ↔ 커서, 끌면 바뀌고, 두 번 누르면 기본 너비로.
 * 바꾼 너비는 이 브라우저에 기억한다(ddalkkak.panelWidth.{key}). 키보드: 손잡이에 초점을 두고 ←/→.
 */
const KEY = (k: string) => `ddalkkak.panelWidth.${k}`;

export function usePanelWidth(key: string, def: number, min: number, max: number) {
  const clamp = useCallback((w: number) => Math.round(Math.min(max, Math.max(min, w))), [min, max]);
  const [width, setWidthState] = useState(() => {
    try { const v = Number(localStorage.getItem(KEY(key))); return v ? clamp(v) : def; } catch { return def; }
  });
  const setWidth = useCallback((w: number) => {
    const next = clamp(w);
    setWidthState(next);
    try { localStorage.setItem(KEY(key), String(next)); } catch { /* 저장 못 해도 이번 화면에서는 동작 */ }
  }, [clamp, key]);
  const [dragging, setDragging] = useState(false);
  return { width, setWidth, def, min, max, dragging, setDragging };
}

export type PanelWidth = ReturnType<typeof usePanelWidth>;

/**
 * 손잡이. side = 패널의 어느 가장자리에 붙는지("right": 왼쪽 패널의 오른쪽 끝, "left": 오른쪽 패널의 왼쪽 끝).
 * 부모는 position: relative 여야 한다. 부모가 overflow: hidden 이어도 보이도록 패널 안쪽 6px에 둔다.
 */
export function PanelResizeHandle({ side, panel, label }: { side: "left" | "right"; panel: PanelWidth; label: string }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const dir = side === "right" ? 1 : -1;
  const [hover, setHover] = useState(false);
  const on = hover || panel.dragging;
  return (
    <div
      role="separator" aria-orientation="vertical" aria-label={label} tabIndex={0}
      aria-valuenow={panel.width} aria-valuemin={panel.min} aria-valuemax={panel.max}
      title="끌어서 너비 조절, 두 번 누르면 기본 너비"
      onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: panel.width };
        panel.setDragging(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => { if (start.current) panel.setWidth(start.current.w + (e.clientX - start.current.x) * dir); }}
      onPointerUp={(e) => { setHover((e.currentTarget as HTMLElement).contains(document.elementFromPoint(e.clientX, e.clientY))); start.current = null; panel.setDragging(false); document.body.style.cursor = ""; document.body.style.userSelect = ""; }}
      onLostPointerCapture={() => { start.current = null; panel.setDragging(false); document.body.style.cursor = ""; document.body.style.userSelect = ""; }}
      onDoubleClick={() => panel.setWidth(panel.def)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); panel.setWidth(panel.width + (e.key === "ArrowRight" ? 16 : -16) * dir); }
      }}
      className="absolute top-0 bottom-0 z-20 outline-none group"
      style={{ [side]: 0, width: 6, cursor: "col-resize" }}
    >
      <span className="absolute top-0 bottom-0 group-focus-visible:bg-[#4f7bff]" style={{ [side]: 0, width: 2, background: on ? color.brand : "transparent", transition: "background 120ms" }} />
    </div>
  );
}
