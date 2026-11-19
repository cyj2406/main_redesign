import { useState, type ReactNode } from "react";
import { BookmarkPlus, History, RotateCcw, Sparkles, X } from "lucide-react";

import { ProfileAvatar } from "@/app/components/mypage/ProfileAvatar";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";
import { color, f, editorType } from "@/app/styleTokens";

import type { CommentAuthor } from "./comments";
import { PanelCloseButton } from "./SideDock";

/**
 * 버전 기록 패널(에디터 공통, 2026-11-19) — 상단 바 🕘로 여는 오른쪽 패널. 기획: docs/editor-common-header.md "9".
 * "대화 목록"(딸깍 AI와 나눈 대화)과는 다른 기능: 여기는 **파일 자체의 이전 상태**를 보고 되돌린다.
 * 2026-11-19 가볍게(피드백 "UI 너무 거창해"): Figma·Google Docs 버전 기록처럼 촘촘한 목록 하나.
 *   - 이름 붙이기는 머리의 작은 아이콘(큰 점선 버튼 없앰) · 고른 버전 아래 작은 미리 보기 + 작은 [되돌리기] 텍스트 버튼(큰 파란 버튼·안내 문구 없앰)
 */
export interface VersionItem {
  id: string;
  /** 이름 붙인 버전이면 그 이름, 아니면 "자동 저장" · "딸깍 AI 작업" 같은 종류 */
  title: string;
  at: number;
  author: CommentAuthor | "ai";
  named?: boolean;
}

const timeLabel = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  const d = new Date(ts);
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return s < 86400 ? `오늘 ${hm}` : `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm}`;
};

export function VersionHistoryPanel({ items, selectedId, onSelect, renderPreview, onRestore, onSaveNamed, onClose }: {
  /** 최신순 */
  items: VersionItem[];
  /** null = 현재 버전 */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  renderPreview: (id: string) => ReactNode;
  onRestore: (id: string) => void;
  onSaveNamed: (name: string) => void;
  onClose: () => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const save = () => { const n = name.trim(); if (!n) return; onSaveNamed(n); setName(""); setNaming(false); };
  return (
    <div className="h-full flex flex-col" style={f}>
      <div className="flex items-center gap-2 shrink-0" style={{ height: 48, padding: "0 8px 0 8px", borderBottom: "1px solid #eef0f3" }}>
        <PanelCloseButton onClick={onClose} />
        <History size={15} color="#111827" />
        <span style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>버전 기록</span>
        <IconTooltip label="지금 상태에 이름 붙여 저장"><button type="button" aria-label="지금 상태에 이름 붙여 저장" aria-pressed={naming} onClick={() => setNaming((v) => !v)} className="ml-auto size-8 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ background: naming ? "rgba(0,0,0,0.05)" : undefined }}>
          <BookmarkPlus size={15} color="#475569" />
        </button></IconTooltip>
      </div>

      <div className="flex-1 overflow-y-auto ui-scroll py-2">
        {naming && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex items-center gap-1 mx-2 mb-1 px-2 h-10 rounded-lg" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") { setNaming(false); setName(""); } }} placeholder="버전 이름 (예: 시안 1차)" aria-label="버전 이름"
              className="flex-1 min-w-0 bg-transparent outline-none" style={{ ...f, fontSize: editorType.body, color: "#111827" }} />
            <button type="submit" disabled={!name.trim()} className="px-2 h-6 rounded disabled:opacity-40" style={{ fontSize: editorType.label, fontWeight: 700, color: color.brand }}>저장</button>
            <button type="button" aria-label="취소" onClick={() => { setNaming(false); setName(""); }} className="size-6 flex items-center justify-center rounded hover:bg-black/[0.05]"><X size={12} color="#94a3b8" /></button>
          </form>
        )}

        <Row selected={selectedId === null} onClick={() => onSelect(null)} title="현재 버전" sub="지금 보고 있는 상태" />
        {items.length === 0 ? (
          <p style={{ fontSize: editorType.caption, lineHeight: "17px", color: "#94a3b8", padding: "12px 16px", wordBreak: "keep-all" }}>
            파일을 고치면 자동으로 저장되고, 그다음부터 이전 버전이 남아요.
          </p>
        ) : items.map((v) => {
          const sel = selectedId === v.id;
          return (
            <div key={v.id}>
              <Row
                selected={sel} onClick={() => onSelect(sel ? null : v.id)}
                title={v.title} named={v.named}
                sub={`${timeLabel(v.at)} · ${v.author === "ai" ? "딸깍 AI" : v.author.name}`}
                avatar={v.author === "ai" ? <Sparkles size={12} color={color.brand} /> : <ProfileAvatar profile={v.author} size={16} />}
              />
              {sel && (
                <div className="mx-3 mb-2 mt-0.5">
                  <div className="rounded-md overflow-hidden" style={{ border: "1px solid #eef0f3" }}>{renderPreview(v.id)}</div>
                  <button type="button" onClick={() => onRestore(v.id)} title="되돌리기 전 상태도 버전으로 남아요" className="mt-1 inline-flex items-center gap-1 h-8 px-2 -ml-2 rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.label, fontWeight: 600, color: color.brand }}>
                    <RotateCcw size={12} />이 버전으로 되돌리기
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ selected, onClick, title, sub, avatar, named }: { selected: boolean; onClick: () => void; title: string; sub: string; avatar?: ReactNode; named?: boolean }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className="w-full flex items-start gap-2 text-left px-3 py-2 hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f7bff]" style={{ background: selected ? "#f1f5f9" : undefined }}>
      <span className="shrink-0 size-4 mt-0.5 flex items-center justify-center">{avatar ?? <span className="size-1.5 rounded-full" style={{ background: selected ? color.brand : "#94a3b8" }} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontSize: editorType.body, fontWeight: named ? 700 : 500, color: "#111827" }}>{title}</span>
        <span className="block truncate" style={{ fontSize: editorType.caption, color: "#94a3b8" }}>{sub}</span>
      </span>
    </button>
  );
}
