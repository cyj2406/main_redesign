import { useEffect, useRef, useState, type ReactNode } from "react";
import { History, Pencil } from "lucide-react";

import { color, f, editorType } from "@/app/styleTokens";

import { PanelCloseButton } from "./SideDock";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/**
 * 버전 기록 패널(에디터 공통) — 상단 바 🕘로 여는 오른쪽 패널. 기획: docs/editor-common-header.md "24".
 * "대화 목록"(딸깍 AI와 나눈 대화)과는 다른 기능: 여기는 **파일 자체의 지난 상태**를 보고 되돌린다.
 *
 * 2026-11-20 다시 설계(사용자 "기록이 너무 헷갈린다, 이름도 밑에 정보도 뭐가 뭔지 모르겠다, 공유하면 누구 기록인지"):
 *  Google 문서 · Figma · Notion 버전 기록과 Genspark Save Point 참고.
 *  - 줄 하나 = 그때 파일 상태 하나. 제목은 **그 상태를 만든 일**(“AI 요청 문장” · ○○ 템플릿으로 시작 · 오후 2:19 버전으로 되돌림 · 직접 고침).
 *    예전처럼 "직전 상태" · "되돌리기 전 상태" 같은 말은 쓰지 않는다
 *  - 둘째 줄 = 누가 · 언제(최유정 · 오후 2:19 / 딸깍 AI · 오후 2:20). "나" · "방금" 대신 이름과 시각
 *  - 지금 상태인 줄에 현재 뱃지. 따로 "현재 버전" 줄을 두지 않는다
 *  - 되돌리기는 줄을 새로 만들지 않는다(사용자 "되돌림도 꼭 기록해야 하나, 헷갈린다"): 고른 줄로 현재 뱃지가 옮겨 가고,
 *    그 뒤에 고치면 맨 위에 새 줄이 생긴다. 위에 있던 줄은 그대로 남아 언제든 다시 돌아갈 수 있다
 *  - 남기기는 상단 💾(⌘S)가 한다(2026-11-27). 패널 안 [이름 붙여 남기기 · 이름 바꿔 남기기]는 뺐다(사용자 "저장 버튼이 있는데 굳이?").
 *  - 이름 바꾸기: 제목을 더블클릭하거나 마우스를 올리면 나오는 ✏를 누르면 그 자리에서 고친다. Enter · 바깥 클릭 = 저장, Esc = 취소.
 *    이름을 붙이면 그 줄은 "남긴 버전"이 된다. 이름을 지우면 원래 제목으로 돌아간다(남긴 버전 표시는 그대로).
 *    [전체 · 남긴 버전] 탭은 다시 넣지 않는다(사용자 "최대한 심플한 플로우")
 *  - 파일 하나의 기록이라 함께 편집하는 사람 모두의 기록이 같이 쌓인다(Google 문서 · Figma와 같음). 되돌려도 아무 줄도 지우지 않는다
 */
export interface VersionItem {
  id: string;
  /** 이 상태를 만든 일. AI 요청이면 promptTitle()로 자른 문장 */
  title: string;
  at: number;
  /** 누가 만든 상태인지(사람 이름 또는 "딸깍 AI") */
  author: string;
  /** [지금 상태 남기기]로 남긴 버전 */
  saved?: boolean;
  /** 남길 때 붙인 이름(있으면 제목 자리에, 원래 제목은 둘째 줄 앞에) */
  savedName?: string;
}

/** AI 요청 문장 → 버전 제목(따옴표 + 26자에서 자르기) */
export const promptTitle = (prompt: string) => {
  const t = prompt.replace(/\s+/g, " ").trim();
  return `“${t.length > 26 ? `${t.slice(0, 26)}…` : t}”`;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const clockLabel = (ts: number) => { const d = new Date(ts); const h = d.getHours(); return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${pad(d.getMinutes())}`; };
const dayLabel = (ts: number) => {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((t.getTime() - d.getTime()) / 864e5);
  return diff === 0 ? "오늘" : diff === 1 ? "어제" : `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
/** 되돌림 제목용: "오늘 오후 2:19" · "11월 18일 오후 2:19" */
export const whenLabel = (ts: number) => `${dayLabel(ts)} ${clockLabel(ts)}`;

export function VersionHistoryPanel({ items, currentId: currentIdProp, emptyText, selectedId, onSelect, onRestore, onRename, onClose }: {
  /** 최신순. 첫 줄이 지금 상태 */
  items: VersionItem[];
  /** 지금 상태인 줄. 없으면 첫 줄(되돌린 뒤에는 아래 줄이 현재가 된다) */
  currentId?: string;
  /** 기록이 없을 때 안내 */
  emptyText?: string;
  /** null = 아무것도 고르지 않음 */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRestore: (id: string) => void;
  /** 줄 이름 바꾸기(그 줄을 남긴 버전으로). 빈 이름 = 이름 지우기 */
  onRename: (id: string, name: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const shown = items;
  const currentId = currentIdProp ?? items[0]?.id;
  const groups: { day: string; list: VersionItem[] }[] = [];
  for (const v of shown) { const day = dayLabel(v.at); const g = groups[groups.length - 1]; if (g && g.day === day) g.list.push(v); else groups.push({ day, list: [v] }); }

  return (
    <div className="h-full flex flex-col" style={f}>
      {/* 2026-11-20 레이아웃 다시(사용자 "버전 남기기 버튼이 애매하고 글도 애매하게 배치"): 머리 오른쪽 버튼과 위 안내 문구를 뺐다.
          남기기는 "지금 상태"에 하는 일이라 [현재] 줄을 눌렀을 때 그 줄 안에서 한다. 되돌림 안내는 되돌린 뒤 토스트로 */}
      <div className="flex items-center gap-2 shrink-0" style={{ height: 48, padding: "0 8px", borderBottom: "1px solid #eef0f3" }}>
        <PanelCloseButton onClick={onClose} />
        <History size={15} color="#111827" />
        <span style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>버전 기록</span>
      </div>

      <div className="flex-1 overflow-y-auto ui-scroll" style={{ padding: "4px 12px 12px" }}>
        {shown.length === 0 && (
          <p style={{ fontSize: editorType.caption, lineHeight: "18px", color: "#64748b", padding: "12px 12px", wordBreak: "keep-all" }}>
            {emptyText ?? "템플릿을 넣거나 딸깍 AI가 고치면 그때마다 여기에 남아요."}
          </p>
        )}
        {groups.map((g) => (
          <section key={g.day} aria-label={g.day}>
            <p style={{ fontSize: editorType.caption, fontWeight: 600, color: "#64748b", padding: "16px 12px 4px" }}>{g.day}</p>
            {g.list.map((v) => {
              const isCurrent = v.id === currentId;
              const sel = selectedId === v.id;
              return (
                <Row key={v.id} selected={sel && !isCurrent}
                  // 현재 줄은 할 일이 없어(남기기는 상단 💾) 눌러도 고르지 않는다
                  onClick={() => { if (editing) return; onSelect(sel || isCurrent ? null : v.id); }}
                  head={v.savedName || v.title}
                  editing={editing === v.id}
                  onStartEdit={() => setEditing(v.id)}
                  onEndEdit={(next) => {
                    setEditing(null);
                    if (next === null) return;
                    const t = next.trim();
                    if (t === (v.savedName ?? "") || (!v.savedName && t === v.title)) return;
                    onRename(v.id, t === v.title ? "" : t);
                  }}
                  badges={<>{isCurrent && <Badge tone="brand">현재</Badge>}{v.saved && <Badge>남긴 버전</Badge>}</>}
                  desc={`${v.savedName ? `${v.title} · ` : ""}${v.author} · ${clockLabel(v.at)}`}>
                  {sel && !isCurrent && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onRestore(v.id); }} title="다른 버전은 그대로 남아서 언제든 다시 돌아올 수 있어요" className="mt-1 h-7 rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.label, fontWeight: 600, color: color.brand }}>
                      이 버전으로 되돌리기
                    </button>
                  )}
                </Row>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone?: "brand" }) {
  // 회색 뱃지는 흰 바탕 + 테두리: 고른 줄(회색 바탕) 위에서도 묻히지 않게
  return <span className="shrink-0 h-5 px-1.5 rounded inline-flex items-center" style={{ fontSize: 11, fontWeight: 700, color: tone === "brand" ? color.brand : "#475569", background: tone === "brand" ? "#eef3ff" : "#fff", boxShadow: tone === "brand" ? undefined : "inset 0 0 0 1px #e2e8f0" }}>{children}</span>;
}

function Row({ selected, onClick, head, badges, desc, children, editing, onStartEdit, onEndEdit }: {
  selected: boolean; onClick: () => void; head: string; badges?: ReactNode; desc?: string; children?: ReactNode;
  editing: boolean; onStartEdit: () => void;
  /** null = 취소 */
  onEndEdit: (name: string | null) => void;
}) {
  const [draft, setDraft] = useState(head);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { setDraft(head); requestAnimationFrame(() => inputRef.current?.select()); } }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div role="button" tabIndex={0} aria-pressed={selected} onClick={onClick}
      onKeyDown={(e) => { if (editing) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } else if (e.key === "F2") { e.preventDefault(); onStartEdit(); } }}
      className="group rounded-lg cursor-pointer hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
      style={{ padding: "8px 12px", background: selected ? "#f1f5f9" : undefined }}>
      <div className="flex items-center gap-1.5 min-w-0">
        {editing ? (
          <input
            ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="버전 이름"
            onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") onEndEdit(draft); else if (e.key === "Escape") onEndEdit(null); }}
            onBlur={() => onEndEdit(draft)}
            className="flex-1 min-w-0 h-7 -my-1 -ml-1.5 px-1.5 rounded-md bg-white outline-none"
            style={{ ...f, fontSize: editorType.body, fontWeight: 600, color: "#111827", boxShadow: `inset 0 0 0 1.5px ${color.border.focus}` }}
          />
        ) : (
          <>
            <p className="truncate" title={head} onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(); }} style={{ fontSize: editorType.body, fontWeight: 600, color: "#111827" }}>{head}</p>
            {badges}
            <IconTooltip label="이름 바꾸기">
              <button type="button" aria-label="이름 바꾸기" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
                className="ml-auto shrink-0 size-6 -my-1 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
                <Pencil size={13} color="#64748b" />
              </button>
            </IconTooltip>
          </>
        )}
      </div>
      {desc && <p className="truncate" title={desc} style={{ fontSize: editorType.caption, lineHeight: "18px", color: "#64748b", marginTop: 1 }}>{desc}</p>}
      {children}
    </div>
  );
}
