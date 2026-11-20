import { useState, type ReactNode } from "react";
import { Bookmark, History, X } from "lucide-react";

import { color, f, editorType } from "@/app/styleTokens";

import { PanelCloseButton } from "./SideDock";

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
 *  - 남기기: 원래 딸깍넷 편집기 기록 창에 있던 기능. [현재] 줄을 누르면 [이름 붙여 남기기] → 이름(안 적어도 됨) → 그 줄에 "남긴 버전" 뱃지.
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

export function VersionHistoryPanel({ items, currentId: currentIdProp, emptyText, selectedId, onSelect, onRestore, onSaveNow, onClose }: {
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
  /** [지금 상태 남기기]. 이름은 비어 있을 수 있다 */
  onSaveNow: (name: string) => void;
  onClose: () => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const close = () => { setNaming(false); setName(""); };
  const save = () => { onSaveNow(name.trim()); close(); };
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
                <Row key={v.id} selected={sel} onClick={() => { close(); onSelect(sel ? null : v.id); }}
                  head={v.savedName || v.title}
                  badges={<>{isCurrent && <Badge tone="brand">현재</Badge>}{v.saved && <Badge>남긴 버전</Badge>}</>}
                  desc={`${v.savedName ? `${v.title} · ` : ""}${v.author} · ${clockLabel(v.at)}`}>
                  {sel && (isCurrent ? (naming ? (
                    <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-2 flex items-center gap-1 h-9 pl-2.5 pr-1 rounded-lg bg-white" style={{ boxShadow: `inset 0 0 0 1px ${color.border.focus}` }}>
                      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") close(); }}
                        placeholder="버전 이름 (안 적어도 돼요)" aria-label="버전 이름" className="field-inline flex-1 min-w-0 bg-transparent outline-none" style={{ ...f, fontSize: editorType.body, color: "#111827" }} />
                      <button type="submit" className="h-7 px-2.5 rounded-md" style={{ background: color.brand, color: "#fff", fontSize: editorType.label, fontWeight: 700 }}>남기기</button>
                      <button type="button" aria-label="취소" onClick={close} className="size-7 flex items-center justify-center rounded-md hover:bg-black/[0.05]"><X size={14} color="#64748b" /></button>
                    </form>
                  ) : (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setNaming(true); }} className="mt-1 h-7 rounded inline-flex items-center gap-1 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.label, fontWeight: 600, color: color.brand }}>
                      <Bookmark size={13} />{v.saved ? "이름 바꿔 남기기" : "이름 붙여 남기기"}
                    </button>
                  )) : (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onRestore(v.id); }} title="다른 버전은 그대로 남아서 언제든 다시 돌아올 수 있어요" className="mt-1 h-7 rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.label, fontWeight: 600, color: color.brand }}>
                      이 버전으로 되돌리기
                    </button>
                  ))}
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
  return <span className="shrink-0 h-5 px-1.5 rounded inline-flex items-center" style={{ fontSize: 11, fontWeight: 700, color: tone === "brand" ? color.brand : "#475569", background: tone === "brand" ? "#eef3ff" : "#f1f5f9" }}>{children}</span>;
}

function Row({ selected, onClick, head, badges, desc, children }: { selected: boolean; onClick: () => void; head: string; badges?: ReactNode; desc?: string; children?: ReactNode }) {
  return (
    <div role="button" tabIndex={0} aria-pressed={selected} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="rounded-lg cursor-pointer hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
      style={{ padding: "8px 12px", background: selected ? "#f1f5f9" : undefined }}>
      <div className="flex items-center gap-1.5 min-w-0">
        <p className="truncate" title={head} style={{ fontSize: editorType.body, fontWeight: 600, color: "#111827" }}>{head}</p>
        {badges}
      </div>
      {desc && <p className="truncate" title={desc} style={{ fontSize: editorType.caption, lineHeight: "18px", color: "#64748b", marginTop: 1 }}>{desc}</p>}
      {children}
    </div>
  );
}
