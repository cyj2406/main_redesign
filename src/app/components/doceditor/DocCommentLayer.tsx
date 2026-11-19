import { useEffect, useMemo, useRef, useState, type SetStateAction } from "react";

import { showToast } from "@/app/components/common/Toast";
import { DEMO_MEMBERS, DEMO_TEAMMATE, relTime, type CommentAuthor } from "@/app/components/editor-shell/comments";
import { CommentPin, DraftPopover, ThreadPopover, type Member, type ThreadActions } from "@/app/components/uidesign/Comments";
import type { Thread } from "@/app/components/uidesign/model";
import { getProfile } from "@/app/state/profile";

/**
 * 한글·워드 문서 코멘트 레이어(2026-11-19). UI 디자인 에디터와 **같은 코멘트**(핀 · 새 코멘트 · 스레드 · 답글 · 반응 · 해결 · 되돌리기)를
 * 문서 쪽 위에 얹는다. 핀 위치는 쪽 기준 좌표(x, y). 실제로는 오픈소스 에디터 위에 겹친 레이어로 붙인다(에디터 UI는 못 고치므로).
 * 상태는 DocEditor가 문서마다 갖고, 이 레이어는 그리기·입력만 한다. 기획: docs/doc-editor.md "2-4".
 */
export type DocThread = Thread;
let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${seq++}`;

export function useDocCommentMembers(me: CommentAuthor): Member[] {
  return useMemo(() => [{ ...me, email: getProfile().email } as Member, ...DEMO_MEMBERS.filter((x) => x.name !== me.name)], [me]);
}

export function DocCommentLayer({ threads, setThreads, me, members, anchorLabel = "1쪽", commentMode, exitCommentMode, openThreadId, setOpenThreadId, pinsHidden }: {
  threads: DocThread[];
  setThreads: (u: SetStateAction<DocThread[]>) => void;
  me: CommentAuthor;
  members: Member[];
  /** 위치 표시 — 문서 "1쪽", 시트 "Sheet1" */
  anchorLabel?: string;
  commentMode: boolean;
  exitCommentMode: () => void;
  openThreadId: string | null;
  setOpenThreadId: (id: string | null) => void;
  pinsHidden: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [bounds, setBounds] = useState({ w: 680, h: 880 });
  const demoReplied = useRef(threads.length > 0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBounds({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Esc: 새 코멘트 닫기 → 코멘트 모드 나가기(열린 스레드는 ThreadPopover가 스스로 닫는다)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || openThreadId) return;
      if (draft) setDraft(null); else if (commentMode) exitCommentMode();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [draft, commentMode, openThreadId, exitCommentMode]);
  useEffect(() => { if (!commentMode) setDraft(null); }, [commentMode]);

  const patch = (id: string, fn: (t: DocThread) => DocThread) => setThreads((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  const restore = (snap: DocThread[]) => setThreads(snap);
  const create = (text: string, images: string[]) => {
    if (!draft) return;
    const now = Date.now();
    const t: DocThread = {
      id: uid("t"), number: threads.reduce((m, x) => Math.max(m, x.number), 0) + 1, pageId: "p1", frameId: null, x: draft.x, y: draft.y,
      resolved: false, readAt: now, messages: [{ id: uid("m"), author: me, text, createdAt: now, images: images.length ? images : undefined }],
    };
    setThreads((all) => [...all, t]);
    setDraft(null);
    setOpenThreadId(t.id);
    // DEMO_: 읽지 않음·멘션 흐름을 보여 주는 예시 팀원 답글 — 문서마다 첫 스레드에 한 번만(UI 디자인 에디터와 같음)
    if (!demoReplied.current) {
      demoReplied.current = true;
      window.setTimeout(() => {
        patch(t.id, (x) => ({ ...x, messages: [...x.messages, { id: uid("m"), author: DEMO_TEAMMATE, text: `@${me.name} 확인했어요! 문서에 반영할게요 👍`, createdAt: Date.now() }] }));
        showToast(`${DEMO_TEAMMATE.name}님이 회원님을 멘션했어요.`);
      }, 4000);
    }
  };
  const actions = (t: DocThread): ThreadActions => ({
    onClose: () => setOpenThreadId(null),
    onReply: (text, images) => patch(t.id, (x) => ({ ...x, readAt: Date.now(), myDraft: undefined, messages: [...x.messages, { id: uid("m"), author: me, text, createdAt: Date.now(), images: images.length ? images : undefined }] })),
    onResolve: (r) => {
      const before = threads;
      patch(t.id, (x) => ({ ...x, resolved: r }));
      if (r) { setOpenThreadId(null); showToast("코멘트를 해결했어요.", "success", { label: "되돌리기", onClick: () => restore(before) }); }
    },
    onDelete: () => {
      const before = threads;
      setThreads((all) => all.filter((x) => x.id !== t.id));
      setOpenThreadId(null);
      showToast("스레드를 삭제했어요.", "success", { label: "되돌리기", onClick: () => restore(before) });
    },
    onEditMsg: (msgId, text) => patch(t.id, (x) => ({ ...x, messages: x.messages.map((m) => (m.id === msgId ? { ...m, text, editedAt: Date.now() } : m)) })),
    onDeleteMsg: (msgId) => {
      const before = threads;
      patch(t.id, (x) => ({ ...x, messages: x.messages.filter((m) => m.id !== msgId) }));
      showToast("답글을 삭제했어요.", "success", { label: "되돌리기", onClick: () => restore(before) });
    },
    onReact: (msgId, emoji) => patch(t.id, (x) => ({
      ...x, messages: x.messages.map((m) => {
        if (m.id !== msgId) return m;
        const who = m.reactions?.[emoji] ?? [];
        return { ...m, reactions: { ...m.reactions, [emoji]: who.includes(me.name) ? who.filter((n) => n !== me.name) : [...who, me.name] } };
      }),
    })),
    onMarkUnread: () => { patch(t.id, (x) => ({ ...x, forcedUnread: true })); setOpenThreadId(null); showToast("읽지 않음으로 표시했어요."); },
    onCopyLink: () => { void navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#comment-${t.number}`).catch(() => {}); showToast("코멘트 링크를 복사했어요."); },
    onDraft: (text) => patch(t.id, (x) => ({ ...x, myDraft: text.trim() ? text : undefined })),
  });

  const open = threads.find((t) => t.id === openThreadId) ?? null;
  return (
    <div ref={ref} className="absolute inset-0" style={{ pointerEvents: commentMode || draft || open ? "auto" : "none", cursor: commentMode ? "crosshair" : undefined }}
      onPointerDown={(e) => {
        if (open) { setOpenThreadId(null); return; }
        if (!commentMode || e.target !== e.currentTarget) return;
        // 빈 곳 mousedown의 기본 동작(포커스를 body로)을 막아야 새 코멘트 입력칸 자동 포커스가 남는다
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setDraft({ x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) });
      }}
    >
      {!pinsHidden && threads.filter((t) => !t.resolved || t.id === openThreadId).map((t) => {
        const first = t.messages[0];
        return (
          <span key={t.id} style={{ pointerEvents: "auto" }}>
            <CommentPin
              x={t.x} y={t.y} author={first?.author ?? me} number={t.number} active={t.id === openThreadId} resolved={t.resolved}
              unread={t.messages.some((m) => m.createdAt > t.readAt && m.author.name !== me.name) || !!t.forcedUnread}
              preview={first ? { text: first.text, replies: t.messages.length - 1, time: relTime(first.createdAt) } : undefined}
              onPress={() => { setDraft(null); setOpenThreadId(t.id === openThreadId ? null : t.id); if (t.id !== openThreadId) patch(t.id, (x) => ({ ...x, readAt: Date.now(), forcedUnread: false })); }}
            />
          </span>
        );
      })}
      {draft && (
        <>
          <CommentPin x={draft.x} y={draft.y} author={me} draft />
          <DraftPopover x={draft.x} y={draft.y} bounds={bounds} me={me} members={members} onCancel={() => setDraft(null)} onSubmit={create} />
        </>
      )}
      {open && (
        <ThreadPopover x={open.x} y={open.y} bounds={bounds} thread={open} me={me} members={members} anchorLabel={anchorLabel} draft={open.myDraft ?? ""} actions={actions(open)} />
      )}
    </div>
  );
}
