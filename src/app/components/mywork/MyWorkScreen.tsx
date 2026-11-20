import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { ChevronDown, MoreHorizontal, Pencil, Trash2, Clapperboard, FilePen, FileSpreadsheet, FileText, FileType2, Folder, Frame, Image as ImageIcon, MessageSquare, Pin, PinOff, Presentation, Search } from "lucide-react";

import { Button } from "@/app/components/common/Button";
import { ScrollableChips } from "@/app/components/common/ScrollableChips";
import { readRecentEditorFiles, FILES_EVENT, renameEditorFile, deleteEditorFile, renameChat, hideChat, type RecentEditorFile } from "@/app/state/recentEditorFiles";
import { color, f } from "@/app/styleTokens";

/**
 * 내 작업(2026-11-20 다시 정리, 사용자 "보기 어렵다, 필터도 어떻게 할지 모르겠다"). Google Drive 목록 보기 · Canva 프로젝트 참고.
 *  - 편집기 파일과 AI 대화를 한 목록에(사이드바 "최근"의 전체 버전). 예전엔 대화만 있었다
 *  - 필터 드롭다운(이미지 · 랜딩페이지 · 동영상 …, 예전 AI 결과물 종류) → 종류 칩 한 줄: 전체 · 문서 · 시트 · 발표 · PDF · 디자인 · 영상 · 대화
 *  - 줄 = [종류 아이콘 + 이름 | 종류(회색 글자) | 마지막 수정(2시간 전 · 어제 · 7월 22일)]. 색깔 뱃지는 뺐다
 *  - 고정(📌) = "사이드바 바로가기" 한 가지 뜻(2026-11-20 정리). 사이드바와 같은 목록(localStorage ddalkkak.sidebarPins), 파일만, 최대 5개
 *    내 작업 순서는 바꾸지 않는다(정렬은 고른 기준 그대로), 이름 옆 📌만. 버튼은 줄에 마우스를 올렸을 때만
 */
type Ico = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const ICON: Record<string, Ico> = { hangul: FilePen, word: FileText, excel: FileSpreadsheet, ppt: Presentation, pdf: FileType2, uidesign: Frame, image: ImageIcon, video: Clapperboard, chat: MessageSquare };
const KIND_NAME: Record<string, string> = { hangul: "한글", word: "워드", excel: "엑셀", ppt: "PPT", pdf: "PDF", uidesign: "UI 디자인", image: "이미지", video: "영상", chat: "대화" };
const GROUPS: [string, string[]][] = [
  ["전체", []], ["문서", ["hangul", "word"]], ["시트", ["excel"]], ["발표", ["ppt"]], ["PDF", ["pdf"]], ["디자인", ["uidesign", "image"]], ["영상", ["video"]], ["대화", ["chat"]],
];
const PIN_KEY = "ddalkkak.sidebarPins";
export const PINS_EVENT = "ddk-pins-changed";

export interface ChatItem { title: string; date: string; /** 이름을 바꿨으면 처음 이름(덮어쓰기 열쇠) */ orig?: string }
type Row = { key: string; name: string; orig: string; kind: string; at: number; file?: RecentEditorFile };

/** "2026. 7. 22." → 시각 */
const parseDot = (s: string) => { const m = s.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : 0; };
const ago = (ts: number) => {
  if (!ts) return "";
  const s = (Date.now() - ts) / 1000;
  const d = new Date(ts), now = new Date();
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (d.toDateString() === now.toDateString()) return `${Math.floor(s / 3600)}시간 전`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "어제";
  return d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}월 ${d.getDate()}일` : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};
const readPins = (): string[] => { try { return JSON.parse(localStorage.getItem(PIN_KEY) ?? "[]") as string[]; } catch { return []; } };

export function MyWorkScreen({ chats, onOpenFile, onGoHome }: { chats: ChatItem[]; onOpenFile: (rf: RecentEditorFile) => void; onGoHome: () => void }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(0);
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const [pins, setPins] = useState<string[]>(readPins);
  useEffect(() => { const on = () => setPins(readPins()); window.addEventListener(PINS_EVENT, on); return () => window.removeEventListener(PINS_EVENT, on); }, []);
  const togglePin = (key: string) => {
    const n = pins.includes(key) ? pins.filter((x) => x !== key) : [key, ...pins].slice(0, 5);
    setPins(n);
    try { localStorage.setItem(PIN_KEY, JSON.stringify(n)); } catch { /* 이번 세션만 */ }
    window.dispatchEvent(new Event(PINS_EVENT));
  };
  // 사이드바 ⋯에서 이름을 바꾸거나 지우면 다시 읽는다
  const [filesTick, setFilesTick] = useState(0);
  useEffect(() => { const on = () => setFilesTick((n) => n + 1); window.addEventListener(FILES_EVENT, on); return () => window.removeEventListener(FILES_EVENT, on); }, []);
  const all: Row[] = useMemo(() => [
    ...readRecentEditorFiles(200).map((rf) => ({ key: `${rf.kind}:${rf.id}`, name: rf.name, orig: rf.name, kind: rf.kind, at: rf.updatedAt, file: rf })),
    ...chats.map((c) => ({ key: `chat:${c.orig ?? c.title}`, name: c.title, orig: c.orig ?? c.title, kind: "chat", at: parseDot(c.date) })),
  ], [chats, filesTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = GROUPS[tab][1];
  const rows = all
    .filter((r) => (!kinds.length || kinds.includes(r.kind)) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "ko") : b.at - a.at));

  return (
    <main className="flex-1 flex flex-col overflow-y-auto" style={{ ...f, scrollbarWidth: "none" }}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <div className="rounded-[14px] size-10 flex items-center justify-center shrink-0" style={{ background: color.surface.accent }}><Folder size={20} color={color.brand} strokeWidth={1.8} /></div>
        <span style={{ fontWeight: 700, fontSize: 22, color: "#0a0a0a", letterSpacing: "-0.6px" }}>내 작업</span>
      </div>

      {all.length === 0 ? (
        <div className="mx-4 mb-6 flex flex-col items-center justify-center gap-3 rounded-[20px] border border-[#e2e8f0] bg-white px-8 text-center" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: "#334155" }}>아직 만든 작업이 없어요. 홈에서 첫 작업을 만들어 보세요.</p>
          <Button variant="primary" size="md" onClick={onGoHome} style={{ marginTop: 4 }}>홈으로 가기</Button>
        </div>
      ) : (
        <div className="px-4 pb-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="field-pill flex-1 min-w-0 flex items-center gap-2 h-10 px-3 rounded-xl bg-white border" style={{ borderColor: color.border.default }}>
              <Search size={16} color={color.text.secondary} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="파일이나 대화 이름 검색" aria-label="내 작업 검색" className="field-inline flex-1 min-w-0 bg-transparent outline-none placeholder:text-[#64748b]" style={{ fontSize: 14, color: color.text.primary }} />
            </label>
            <label className="relative shrink-0 h-10 flex items-center rounded-xl bg-white border cursor-pointer" style={{ borderColor: color.border.default }}>
              <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="field-inline h-full pl-3 pr-8 bg-transparent outline-none appearance-none cursor-pointer" style={{ fontSize: 14, color: "#334155" }}>
                <option value="updated">최근 수정순</option><option value="name">이름순</option>
              </select>
              <ChevronDown size={14} color="#64748b" className="absolute right-3 pointer-events-none" />
            </label>
          </div>
          <ScrollableChips items={GROUPS.map(([l]) => l)} activeIndex={tab} onChange={setTab} variant="solid" />

          <div className="bg-white rounded-[20px] border [&>*:last-child]:rounded-b-[20px]" style={{ borderColor: color.border.default }}>
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_72px] gap-x-3 items-center px-4 h-10" style={{ fontSize: 12, fontWeight: 600, color: color.text.secondary, borderBottom: "1px solid #f1f5f9" }}>
              <span>이름</span><span>종류</span><span>마지막 수정</span><span />
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-10 text-center" style={{ fontSize: 14, color: color.text.secondary }}>찾는 작업이 없어요.</p>
            ) : rows.map((r, i) => <WorkRow key={r.key} r={r} first={i === 0} pinned={!!r.file && pins.includes(r.key)} onOpen={() => r.file && onOpenFile(r.file)} onTogglePin={() => togglePin(r.key)} onUnpinOnDelete={() => pins.includes(r.key) && togglePin(r.key)} />)}
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * 내 작업 한 줄(2026-11-20, 사이드바와 같은 ⋯ 메뉴). 오른쪽 [⋯][📌]는 마우스를 올렸을 때만, 고정한 파일은 이름 옆 📌로 표시.
 * ⋯ = 이름 바꾸기(이름 칸에서 바로) · 삭제(한 번 더 눌러 확인). 고정은 파일만.
 */
function WorkRow({ r, first, pinned, onOpen, onTogglePin, onUnpinOnDelete }: { r: Row; first: boolean; pinned: boolean; onOpen: () => void; onTogglePin: () => void; onUnpinOnDelete: () => void }) {
  const I = ICON[r.kind] ?? FileText;
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.name);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => { setMenu(false); setConfirmDel(false); };
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", down, true); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("keydown", key); };
  }, [menu]);
  const commit = () => {
    setEditing(false);
    const n = draft.trim();
    if (!n || n === r.name) return;
    if (r.file) renameEditorFile(r.file, n); else renameChat(r.orig, n);
  };
  const remove = () => { setMenu(false); setConfirmDel(false); onUnpinOnDelete(); if (r.file) deleteEditorFile(r.file); else hideChat(r.orig); };
  const iconBtn = "size-8 rounded-md flex items-center justify-center hover:bg-black/[0.05] outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#4f7bff]";
  const item = "w-full h-9 px-2.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#f1f5f9] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";
  return (
    <div ref={ref} className="group relative grid grid-cols-[1fr_76px_72px] sm:grid-cols-[1fr_120px_120px_72px] gap-x-3 items-center px-4 h-14 hover:bg-[#f8fafc] transition-colors" style={{ borderTop: first ? undefined : "1px solid #f1f5f9" }}>
      {editing ? (
        <div className="min-w-0 flex items-center gap-3">
          <span className="size-8 shrink-0 rounded-lg flex items-center justify-center" style={{ background: "#f1f5f9" }}><I size={16} color="#475569" strokeWidth={1.7} /></span>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onFocus={(e) => e.currentTarget.select()} onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(r.name); setEditing(false); } }}
            aria-label="새 이름" className="field-inline flex-1 min-w-0 h-9 px-2 rounded-lg bg-white outline-none" style={{ fontSize: 14, fontWeight: 500, color: color.text.primary, border: `1px solid ${color.border.focus}` }} />
        </div>
      ) : (
        <button type="button" onClick={onOpen} disabled={!r.file} className="min-w-0 flex items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] rounded-md disabled:cursor-default" title={r.name}>
          <span className="size-8 shrink-0 rounded-lg flex items-center justify-center" style={{ background: "#f1f5f9" }}><I size={16} color="#475569" strokeWidth={1.7} /></span>
          <span className="truncate" style={{ fontSize: 14, fontWeight: 500, color: color.text.primary }}>{r.name}</span>
          {pinned && <Pin size={13} color={color.text.secondary} className="shrink-0" aria-label="고정됨" />}
        </button>
      )}
      <span className="hidden sm:block truncate" style={{ fontSize: 13, color: color.text.secondary }}>{KIND_NAME[r.kind] ?? ""}</span>
      <span className="truncate" style={{ fontSize: 13, color: color.text.secondary }}>{ago(r.at)}</span>
      <div className={`flex items-center justify-end ${menu ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}>
        <button type="button" aria-label={`${r.name} 더 보기`} title="더 보기" aria-expanded={menu} onClick={() => { setMenu((v) => !v); setConfirmDel(false); }} className={`${iconBtn} ${menu ? "bg-black/[0.05]" : ""}`}>
          <MoreHorizontal size={16} color="#64748b" />
        </button>
        {r.file ? (
          <button type="button" onClick={onTogglePin} aria-label={pinned ? `${r.name} 고정 풀기` : `${r.name} 사이드바에 고정`} title={pinned ? "사이드바 고정 풀기" : "사이드바에 고정"} className={iconBtn}>
            {pinned ? <PinOff size={15} color="#64748b" /> : <Pin size={15} color="#64748b" />}
          </button>
        ) : <span className="size-8" />}
      </div>
      {menu && (
        <div role="menu" aria-label={`${r.name} 메뉴`} className="absolute right-4 top-full -mt-1 z-30 w-[184px] bg-white rounded-xl p-1.5" style={{ boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }}>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setDraft(r.name); setEditing(true); }} className={item} style={{ fontSize: 14, color: color.text.primary }}>
            <Pencil size={15} color="#64748b" />이름 바꾸기
          </button>
          <button type="button" role="menuitem" onClick={() => (confirmDel ? remove() : setConfirmDel(true))} className={item} style={{ fontSize: 14, fontWeight: confirmDel ? 600 : 400, color: "#dc2626" }}>
            <Trash2 size={15} color="#dc2626" />{confirmDel ? "한 번 더 누르면 삭제돼요" : "삭제"}
          </button>
        </div>
      )}
    </div>
  );
}
