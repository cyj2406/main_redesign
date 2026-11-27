import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Download, X } from "lucide-react";

import { color, editorType, f } from "@/app/styleTokens";

/**
 * 내보내기(다운로드) 팝오버(에디터 공통) — 상단 [다운로드]를 누르면 바로 아래에 열린다. 이미지 · 영상.
 * 2026-11-20 dev 다운로드 창 모양으로 되돌림(사용자 "이미지 다운로드 왜 변함"): 라디오 목록 대신
 *  [제목 ✕] → 항목마다 [이름 + 드롭다운 칸] → "다운로드 정보 · PNG · 1배 · 모든 페이지" 요약 → [다운로드].
 * 고른 값의 설명(hint)은 칸 아래 작은 글자로. 켜고 끄는 항목(check)은 체크 상자 한 줄. 서버 없음: 고른 설정을 넘겨 주기만 한다.
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

export function ExportPopover({ title = "내보내기", actionLabel = "내보내기", groups, accent = color.brand, onExport, onClose, onShare }: {
  title?: string;
  /** 아래 버튼 글자(이미지는 "다운로드") */
  actionLabel?: string;
  groups: ExportGroup[];
  accent?: string;
  onExport: (choice: ExportChoice) => void;
  onClose: () => void;
  /**
   * 있으면 맨 아래 "함께 고칠 수도 있어요" 한 줄(2026-11-27). 다운로드는 대개 누군가에게 보내려고 누르니,
   * 그 순간에 공유와 코멘트가 있다는 걸 알려 준다. 튜토리얼 단계 대신 화면 안에서 알게 하는 장치.
   * 링크는 초대받은 사람만 열 수 있어 "링크 복사"가 아니라 공유 창을 연다.
   */
  onShare?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<ExportChoice>(() => Object.fromEntries(groups.map((g) => [g.id, g.default])));
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);
  const valueLabel = (g: ExportGroup) => g.type === "check" ? (choice[g.id] ? g.options[0]?.label : `${g.label} 빼기`) : g.options.find((o) => o.id === choice[g.id])?.label ?? "";

  return (
    <div ref={ref} className="absolute right-0 top-12 z-50 bg-white rounded-2xl" style={{ ...f, width: 320, padding: "20px 20px 20px", boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="dialog" aria-label={title}>
      <div className="flex items-center">
        <p style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{title}</p>
        <button type="button" aria-label="닫기" onClick={onClose} className="ml-auto -mr-1.5 size-8 rounded-lg flex items-center justify-center hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"><X size={18} color="#475569" /></button>
      </div>
      <div className="flex flex-col gap-4 mt-4">
        {groups.map((g) => {
          if (g.type === "check") {
            const on = !!choice[g.id];
            return (
              <button key={g.id} type="button" role="checkbox" aria-checked={on} onClick={() => setChoice((c) => ({ ...c, [g.id]: !c[g.id] }))} className="flex items-center gap-2.5 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
                <span className="size-5 shrink-0 rounded-md flex items-center justify-center" style={{ background: on ? accent : "#fff", boxShadow: on ? undefined : "inset 0 0 0 1.5px #cbd5e1" }}>{on && <Check size={14} color="#fff" strokeWidth={3} />}</span>
                <span style={{ fontSize: editorType.body, fontWeight: 500, color: "#111827" }}>{g.options[0]?.label ?? g.label}</span>
              </button>
            );
          }
          const hint = g.options.find((o) => o.id === choice[g.id])?.hint;
          return (
            <label key={g.id} className="block">
              <span className="block" style={{ fontSize: editorType.label, fontWeight: 600, color: "#334155", marginBottom: 8 }}>{g.label}</span>
              <span className="relative block">
                <select value={String(choice[g.id])} onChange={(e) => setChoice((c) => ({ ...c, [g.id]: e.target.value }))}
                  className="w-full h-11 pl-3.5 pr-9 rounded-xl bg-white appearance-none cursor-pointer outline-none border border-[#e2e8f0]" style={{ fontSize: editorType.body, color: "#111827" }}>
                  {g.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <ChevronDown size={16} color="#64748b" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </span>
              {hint && <span className="block" style={{ fontSize: editorType.caption, color: "#64748b", marginTop: 6 }}>{hint}</span>}
            </label>
          );
        })}
      </div>
      {/* 요약은 고를 게 여러 개일 때만(2026-11-27): 항목이 하나면 바로 위 칸과 같은 말을 반복할 뿐이다 */}
      {groups.length > 1 ? <p className="truncate" style={{ fontSize: editorType.caption, color: "#94a3b8", marginTop: 16 }}>{actionLabel} 정보 · {groups.map(valueLabel).join(" · ")}</p> : <div style={{ height: 4 }} />}
      <button type="button" onClick={() => onExport(choice)} className="mt-3 w-full h-12 rounded-xl flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff] hover:brightness-95" style={{ background: accent, color: "#fff", fontSize: editorType.body, fontWeight: 700 }}>
        <Download size={18} />{actionLabel}
      </button>
      {onShare && (
        <button
          type="button" onClick={onShare}
          className="mt-3 w-full flex items-center gap-2 rounded-xl text-left outline-none hover:bg-[#f1f5f9] focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
          style={{ background: "#f8fafc", padding: "10px 12px" }}
        >
          <span className="min-w-0 flex-1 whitespace-normal" style={{ fontSize: editorType.caption, lineHeight: "18px", color: "#475569", wordBreak: "keep-all" }}>
            파일 대신 공유하면 받는 사람이 바로 코멘트를 남길 수 있어요
          </span>
          <span className="shrink-0 flex items-center" style={{ fontSize: editorType.caption, fontWeight: 700, color: accent }}>공유하기<ChevronRight size={14} /></span>
        </button>
      )}
    </div>
  );
}
