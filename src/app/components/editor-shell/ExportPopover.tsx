import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Download } from "lucide-react";

import { color, editorType, f } from "@/app/styleTokens";

/**
 * 내보내기 팝오버(에디터 공통, 2026-11-19) — 상단 [내보내기]를 누르면 바로 아래에 열린다. 첫 적용: 영상 편집기.
 * dev 영상 편집기 "프로젝트 내보내기"(형식 · 품질 · 오디오 → [내보내기]) 구성을 딸깍 스타일(14/12 글자 · 40px 칸 · 브랜드 버튼)로.
 * 묶음은 접을 수 있고(▾), 고른 값은 머리 오른쪽에 요약으로 보인다. 서버 없음: [내보내기]는 고른 설정을 넘겨 주기만 한다.
 */
export interface ExportGroup {
  id: string;
  label: string;
  /** radio = 하나 고르기, check = 켜고 끄기(옵션 하나) */
  type: "radio" | "check";
  options: { id: string; label: string; hint?: string }[];
  default: string | boolean;
}
export type ExportChoice = Record<string, string | boolean>;

export function ExportPopover({ title = "내보내기", groups, accent = color.brand, onExport, onClose }: {
  title?: string;
  groups: ExportGroup[];
  accent?: string;
  onExport: (choice: ExportChoice) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<ExportChoice>(() => Object.fromEntries(groups.map((g) => [g.id, g.default])));
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);
  const summary = (g: ExportGroup) => g.type === "check" ? (choice[g.id] ? "포함" : "빼기") : g.options.find((o) => o.id === choice[g.id])?.label ?? "";

  return (
    <div ref={ref} className="absolute right-0 top-12 z-50 bg-white rounded-xl overflow-hidden" style={{ ...f, width: 340, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="dialog" aria-label={title}>
      <p style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827", padding: "16px 16px 12px" }}>{title}</p>
      {groups.map((g) => {
        const open = !folded[g.id];
        return (
          <section key={g.id} style={{ borderTop: "1px solid #eef0f3" }}>
            <button type="button" aria-expanded={open} onClick={() => setFolded((o) => ({ ...o, [g.id]: open }))} className="w-full h-12 px-4 flex items-center gap-2 text-left hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f7bff]">
              <span style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>{g.label}</span>
              {!open && <span className="truncate" style={{ fontSize: editorType.caption, color: "#64748b" }}>{summary(g)}</span>}
              <ChevronDown size={16} color="#64748b" className="ml-auto shrink-0 transition-transform" style={{ transform: open ? undefined : "rotate(-90deg)" }} />
            </button>
            {open && (
              <div className="px-2 pb-2" role={g.type === "radio" ? "radiogroup" : "group"} aria-label={g.label}>
                {g.options.map((o) => {
                  const on = g.type === "radio" ? choice[g.id] === o.id : !!choice[g.id];
                  return (
                    <button
                      key={o.id} type="button" role={g.type === "radio" ? "radio" : "checkbox"} aria-checked={on}
                      onClick={() => setChoice((c) => ({ ...c, [g.id]: g.type === "radio" ? o.id : !c[g.id] }))}
                      className="w-full min-h-10 px-2 py-2 flex items-center gap-3 rounded-lg text-left hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
                    >
                      {g.type === "radio" ? (
                        <span className="size-5 shrink-0 rounded-full flex items-center justify-center" style={{ boxShadow: `inset 0 0 0 ${on ? 6 : 1.5}px ${on ? accent : "#cbd5e1"}` }} />
                      ) : (
                        <span className="size-5 shrink-0 rounded-md flex items-center justify-center" style={{ background: on ? accent : "#fff", boxShadow: on ? undefined : "inset 0 0 0 1.5px #cbd5e1" }}>{on && <Check size={14} color="#fff" strokeWidth={3} />}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span style={{ fontSize: editorType.body, fontWeight: on ? 600 : 500, color: "#111827" }}>{o.label}</span>
                        {o.hint && <span style={{ fontSize: editorType.caption, color: "#64748b", marginLeft: 6 }}>{o.hint}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      <div className="p-4" style={{ borderTop: "1px solid #eef0f3" }}>
        <button type="button" onClick={() => onExport(choice)} className="w-full h-10 rounded-lg flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff] hover:brightness-95" style={{ background: accent, color: "#fff", fontSize: editorType.body, fontWeight: 600 }}>
          <Download size={18} />내보내기
        </button>
      </div>
    </div>
  );
}
