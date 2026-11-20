import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Eye, EyeOff, ListFilter, MessageCircle, Search } from "lucide-react";

import { ProfileAvatar } from "@/app/components/mypage/ProfileAvatar";
import { color, f, editorType } from "@/app/styleTokens";

import { PanelCloseButton } from "./SideDock";
import { involvesMe, isUnread, mentionsMe, relTime, type CommentAuthor, type CommentThreadBase } from "./comments";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/**
 * 코멘트 한번에 보기 — 오른쪽 도크의 코멘트 탭(모든 에디터 공통).
 * 검색 · 필터 메뉴(읽지 않음만 · 나를 멘션한 것 · 내가 참여한 것 · 해결된 것도 보기 — Figma 필터 아이콘) · 최신순 · 모두 읽음 · 캔버스 핀 숨기기.
 * 항목: 작성자 · #번호 · 시간 · 첫 댓글 · 위치(페이지 · 프레임) · 답글 수 · "@나" · "작성 중"(보내지 않은 답글).
 */
export function CommentListPanel<T extends CommentThreadBase>({
  threads, me, location, openThreadId, hidden, onToggleHidden, onOpen, onMarkAllRead, emptyHint, onClose, closeShortcut,
}: {
  threads: T[];
  me: CommentAuthor;
  /** 항목 아래 위치 문구(페이지 이름 등) */
  location: (t: T) => string;
  openThreadId: string | null;
  hidden?: boolean;
  onToggleHidden?: () => void;
  onOpen: (t: T) => void;
  onMarkAllRead: () => void;
  emptyHint: string;
  onClose?: () => void;
  closeShortcut?: string;
}) {
  const [filters, setFilters] = useState({ unread: false, mentions: false, mine: false, resolved: false });
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    const down = (e: PointerEvent) => { if (!filterRef.current?.contains(e.target as Node)) setFilterOpen(false); };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [filterOpen]);
  const [q, setQ] = useState("");
  const unreadCount = threads.filter((t) => isUnread(t, me)).length;
  const query = q.trim().toLowerCase();
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const list = threads
    .filter((t) => filters.resolved || !t.resolved)
    .filter((t) => !filters.unread || isUnread(t, me))
    .filter((t) => !filters.mentions || mentionsMe(t, me))
    .filter((t) => !filters.mine || involvesMe(t, me))
    .filter((t) => !query || t.messages.some((m) => m.text.toLowerCase().includes(query) || m.author.name.toLowerCase().includes(query)))
    .sort((a, b) => (b.messages.at(-1)?.createdAt ?? 0) - (a.messages.at(-1)?.createdAt ?? 0));
  const FILTERS = [
    ["unread", "읽지 않음만", unreadCount],
    ["mentions", "나를 멘션한 것", threads.filter((t) => mentionsMe(t, me)).length],
    ["mine", "내가 참여한 것", threads.filter((t) => involvesMe(t, me)).length],
    ["resolved", "해결된 것도 보기", threads.filter((t) => t.resolved).length],
  ] as const;

  const iconBtn = "size-8 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-40";
  return (
    <div className="flex flex-col h-full" style={f}>
      <div className="flex items-center gap-2 shrink-0" style={{ height: 48, padding: onClose ? "0 8px 0 6px" : "0 8px 0 14px", borderBottom: "1px solid #eef0f3" }}>
        {onClose && <PanelCloseButton onClick={onClose} shortcut={closeShortcut} />}
        <MessageCircle size={15} color="#111827" />
        <span style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>코멘트</span>
        <div className="ml-auto flex items-center">
          <IconTooltip label="모두 읽음으로 표시"><button type="button" className={iconBtn} aria-label="모두 읽음으로 표시" disabled={unreadCount === 0} onClick={onMarkAllRead}>
            <CheckCheck size={15} color="#475569" />
          </button></IconTooltip>
          {onToggleHidden && (
            <IconTooltip label={`${hidden ? "캔버스에 코멘트 보이기" : "캔버스에서 코멘트 숨기기"}`}><button type="button" className={iconBtn} aria-pressed={hidden} aria-label={hidden ? "캔버스에 코멘트 보이기" : "캔버스에서 코멘트 숨기기"} onClick={onToggleHidden}>
              {hidden ? <EyeOff size={15} color="#475569" /> : <Eye size={15} color="#475569" />}
            </button></IconTooltip>
          )}
        </div>
      </div>
      {hidden && (
        <p className="shrink-0" style={{ fontSize: editorType.caption, color: "#92400e", background: "#fffbeb", padding: "8px 16px" }}>캔버스에서 숨김 중. 코멘트 모드에서는 보여요</p>
      )}
      <div className="shrink-0 flex items-center gap-2" style={{ padding: "12px 12px 12px" }}>
        <label className="field-pill flex-1 min-w-0 flex items-center gap-2 rounded-lg px-3 h-8 border border-transparent" style={{ background: "#f5f5f5" }}>
          <Search size={13} color="#9ca3af" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="코멘트나 작성자 검색" className="field-inline flex-1 min-w-0 bg-transparent outline-none" style={{ fontSize: editorType.label, color: "#111827" }} />
        </label>
        <div ref={filterRef} className="relative">
          <IconTooltip label="필터"><button type="button" aria-label={`필터${activeFilters ? ` (${activeFilters}개 켜짐)` : ""}`} aria-expanded={filterOpen} onClick={() => setFilterOpen((v) => !v)} className="relative size-8 flex items-center justify-center rounded-lg hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ background: activeFilters ? color.surface.accent : undefined }}>
            <ListFilter size={15} color={activeFilters ? color.brand : "#475569"} />
            {activeFilters > 0 && <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full flex items-center justify-center" style={{ background: color.brand, color: "#fff", fontSize: 9.5, fontWeight: 700 }}>{activeFilters}</span>}
          </button></IconTooltip>
          {filterOpen && (
            <div className="absolute right-0 top-9 z-30 py-2 w-[200px] rounded-xl" style={{ background: "#1e1e1e", boxShadow: "0px 12px 40px rgba(0,0,0,0.3)" }} role="menu" aria-label="필터">
              {FILTERS.map(([k, l, n]) => (
                <button key={k} type="button" role="menuitemcheckbox" aria-checked={filters[k]} onClick={() => setFilters((fl) => ({ ...fl, [k]: !fl[k] }))} className="w-full flex items-center gap-2 px-3 h-8 text-left hover:bg-[#2f2f2f]">
                  <span className="w-4">{filters[k] && <Check size={13} color="#f3f4f6" />}</span>
                  <span className="flex-1" style={{ fontSize: editorType.body, color: "#f3f4f6" }}>{l}</span>
                  <span style={{ fontSize: editorType.caption, color: "#8b8f97" }}>{n}</span>
                </button>
              ))}
              {activeFilters > 0 && (
                <>
                  <div className="h-px my-1" style={{ background: "#333" }} />
                  <button type="button" onClick={() => setFilters({ unread: false, mentions: false, mine: false, resolved: false })} className="w-full text-left px-3 h-8 hover:bg-[#2f2f2f]" style={{ fontSize: editorType.body, color: "#f3f4f6" }}><span className="inline-block w-4 mr-2" />필터 모두 끄기</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto ui-scroll" style={{ borderTop: "1px solid #f1f5f9" }}>
        {list.length === 0 ? (
          <p style={{ fontSize: editorType.body, lineHeight: "20px", color: "#64748b", padding: "28px 20px", textAlign: "center", wordBreak: "keep-all" }}>
            {query || activeFilters ? "조건에 맞는 코멘트가 없어요." : emptyHint}
          </p>
        ) : list.map((t) => {
          const first = t.messages[0];
          const last = t.messages.at(-1)!;
          const unread = isUnread(t, me);
          return (
            <button
              key={t.id} type="button" onClick={() => onOpen(t)}
              className="relative w-full text-left flex gap-3 outline-none hover:bg-[#f8fafc] focus-visible:bg-[#f8fafc]"
              style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", background: t.id === openThreadId ? "#f0fbf6" : undefined }}
            >
              <ProfileAvatar profile={first.author} size={24} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span style={{ fontSize: editorType.body, fontWeight: unread ? 800 : 600, color: "#111827" }}>{first.author.name}</span>
                  <span style={{ fontSize: editorType.caption, color: "#64748b" }}>#{t.number} · {relTime(last.createdAt)}</span>
                </div>
                <p className="line-clamp-2" style={{ fontSize: editorType.body, lineHeight: "20px", color: "#1f2937", fontWeight: unread ? 600 : 400, marginTop: 2, wordBreak: "break-word" }}>{first.text || (first.images?.length ? `이미지 ${first.images.length}장` : "")}</p>
                <p className="truncate" style={{ fontSize: editorType.caption, color: "#64748b", marginTop: 4 }}>
                  {location(t)}{t.messages.length > 1 ? ` · 답글 ${t.messages.length - 1}개` : ""}
                  {unread && t.messages.length > 1 ? ` · 새 답글: ${last.author.name}` : ""}
                </p>
                {(mentionsMe(t, me) || t.myDraft || t.resolved) && (
                  <span className="flex gap-1 mt-2">
                    {mentionsMe(t, me) && <span className="rounded px-2" style={{ fontSize: editorType.caption, fontWeight: 700, color: color.brand, background: color.surface.accent }}>@나</span>}
                    {t.myDraft && <span className="rounded px-2" style={{ fontSize: editorType.caption, fontWeight: 600, color: "#92400e", background: "#fffbeb" }}>작성 중</span>}
                    {t.resolved && <span className="rounded px-2" style={{ fontSize: editorType.caption, fontWeight: 600, color: "#475569", background: "#f1f5f9" }}>해결됨</span>}
                  </span>
                )}
              </div>
              {unread && <span aria-label="읽지 않음" className="absolute right-3 top-4 size-2 rounded-full" style={{ background: color.brand }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
