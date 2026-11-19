import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 한 줄 칩 줄(편집기 공통, 2026-11-19) — 카테고리 칩을 여러 줄로 감싸지 않고 한 줄에 두고 옆으로 넘긴다.
 * Canva·미리캔버스 템플릿 패널처럼: 넘칠 때만 끝을 흐리게 하고 ‹ › 버튼을 보인다. 휠(세로)·트랙패드·끌기로도 넘어간다.
 * 고른 칩(aria-selected)은 바뀔 때 보이는 자리로 옮긴다. 패널 너비를 바꿔도 줄 수는 1줄 그대로.
 */
export function ChipRow({ children, label, selectedKey }: { children: ReactNode; label: string; selectedKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdge((o) => (o.left === left && o.right === right ? o : { left, right }));
  };
  useLayoutEffect(update);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // 세로 휠을 가로로 바꿔 준다(마우스 휠만 있는 사람도 넘길 수 있게)
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener("wheel", wheel); };
  }, []);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selectedKey]);
  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: "smooth" });
  const fade = edge.left && edge.right
    ? "linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%)"
    : edge.right ? "linear-gradient(90deg, #000 calc(100% - 32px), transparent 100%)"
    : edge.left ? "linear-gradient(90deg, transparent 0, #000 32px)" : undefined;
  const arrow = "absolute top-1/2 -translate-y-1/2 size-8 rounded-full bg-white flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] hover:bg-[#f8fafc]";
  return (
    <div className="relative">
      <div
        ref={ref} onScroll={update} role="tablist" aria-label={label}
        className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", maskImage: fade, WebkitMaskImage: fade }}
      >
        {children}
      </div>
      {edge.left && <button type="button" aria-label="앞 칩 보기" tabIndex={-1} onClick={() => page(-1)} className={`${arrow} left-0`} style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.16)" }}><ChevronLeft size={16} color="#475569" /></button>}
      {edge.right && <button type="button" aria-label="뒤 칩 보기" tabIndex={-1} onClick={() => page(1)} className={`${arrow} right-0`} style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.16)" }}><ChevronRight size={16} color="#475569" /></button>}
    </div>
  );
}
