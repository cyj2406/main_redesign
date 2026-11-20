import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, AtSign, Check, Image as ImageIcon, MapPin, MoreHorizontal, RotateCcw, Smile, X } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import { REACTIONS, relTime, type CommentMsg } from "@/app/components/editor-shell/comments";
import { ProfileAvatar } from "@/app/components/mypage/ProfileAvatar";
import { color, f, editorType } from "@/app/styleTokens";

import { EDITOR_ACCENT, type CommentAuthor, type Thread } from "./model";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/**
 * 코멘트 UI — 로직 정리는 docs/ui-design-editor.md "3. 코멘트"(v3 보완점은 "3-5").
 * 핀·팝오버는 화면 좌표(확대해도 크기 같음). 작성자 아바타는 마이페이지 프로필(사진·이니셜·협업 색상)을 그대로 쓴다.
 */

const avatarOf = (a: CommentAuthor) => ({ name: a.name, avatarUrl: a.avatarUrl, collabColor: a.collabColor });

/**
 * 핀 — 점(클릭한 자리)에 왼쪽 아래 꼭짓점이 닿는 물방울 모양(Figma). 화면 크기 고정.
 * 누르기는 onPress 로 캔버스에 넘긴다 — 캔버스가 3px 넘게 움직이면 옮기기, 아니면 열기로 판단한다.
 * 마우스를 0.3초 올리면 미리보기(작성자·첫 줄·답글 수). 읽지 않음 = 오른쪽 위 브랜드 블루 점.
 */
export function CommentPin({ x, y, author, number, active, resolved, draft, unread, preview, dragging, onPress }: {
  x: number; y: number; author: CommentAuthor; number?: number; active?: boolean; resolved?: boolean; draft?: boolean; unread?: boolean;
  preview?: { text: string; replies: number; time: string }; dragging?: boolean; onPress?: (e: React.PointerEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const showPreview = hover && !active && !draft && !dragging && preview;
  return (
    <>
      <button
        type="button"
        aria-label={draft ? "새 코멘트 위치" : `코멘트 ${number}번, ${author.name}${unread ? " (읽지 않음)" : ""}`}
        onPointerDown={(e) => { e.stopPropagation(); setHover(false); onPress?.(e); }}
        // 핀 안 프로필 사진을 꾹 누르면 브라우저 기본 이미지 끌기가 시작돼 핀 옮기기가 끊겼다(2026-11-20) — 막는다
        onDragStart={(e) => e.preventDefault()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPress?.(e as unknown as React.PointerEvent); } }}
        onMouseEnter={() => { timer.current = window.setTimeout(() => setHover(true), 300); }}
        onMouseLeave={() => { window.clearTimeout(timer.current); setHover(false); }}
        // 2026-11-20 핀 모양(사용자 "너무 피그마 따라 했나"): 한쪽 모서리만 뾰족한 물방울(Figma) 대신 딸깍 말풍선.
        // 동그라미 + 아래 가운데 작은 꼬리, 꼬리 끝이 (x, y). 고른 핀은 테두리와 꼬리가 딸깍 파랑
        className="absolute rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
        style={{
          left: x - 16, top: y - 39, width: 32, height: 39, background: "transparent",
          filter: active || dragging ? "drop-shadow(0 6px 12px rgba(0,0,0,0.22))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.18))",
          opacity: resolved ? 0.6 : 1, cursor: dragging ? "grabbing" : draft ? "default" : "pointer", zIndex: active || dragging ? 6 : 5,
          transform: active || dragging ? "scale(1.06)" : undefined, transformOrigin: "50% 100%", transition: dragging ? undefined : "transform 120ms",
        }}
      >
        <span aria-hidden className="absolute" style={{ left: 11, top: 25, width: 10, height: 10, transform: "rotate(45deg)", borderRadius: 2, background: active || dragging ? color.brand : "#fff" }} />
        <span className="absolute inset-x-0 top-0 rounded-full flex items-center justify-center" style={{ height: 32, background: active || dragging ? color.brand : "#fff" }}>
          <ProfileAvatar profile={avatarOf(author)} size={26} />
        </span>
        {unread && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full" style={{ background: color.brand, boxShadow: "0 0 0 2px #fff" }} />}
      </button>
      {showPreview && (
        <div className="absolute pointer-events-none" style={{ ...f, left: x + 24, top: y - 40, width: 220, background: "#fff", borderRadius: 10, padding: "8px 12px", boxShadow: "0px 8px 24px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb", zIndex: 7 }}>
          <p style={{ fontSize: editorType.caption, fontWeight: 700, color: "#111827" }}>{author.name} <span style={{ fontWeight: 400, color: "#64748b" }}>· {preview.time}</span></p>
          <p className="line-clamp-2" style={{ fontSize: editorType.label, lineHeight: "20px", color: "#1f2937", marginTop: 2 }}>{preview.text}</p>
          {preview.replies > 0 && <p style={{ fontSize: editorType.caption, color: "#64748b", marginTop: 4 }}>답글 {preview.replies}개</p>}
        </div>
      )}
    </>
  );
}

/** 겹친 핀 묶음 — 숫자 대신 작성자 아바타를 겹쳐 보여 준다(Figma). 누르면 그 자리로 확대해 풀어 준다 */
export function ClusterPin({ x, y, authors, count, unread, onClick }: { x: number; y: number; authors: CommentAuthor[]; count: number; unread: boolean; onClick: () => void }) {
  const shown = authors.slice(0, 3);
  const size = 40;
  return (
    <button
      type="button"
      aria-label={`코멘트 ${count}개 묶음, 눌러서 확대`}
      title={`코멘트 ${count}개, 눌러서 확대`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="absolute flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
      style={{ ...f, left: x, top: y - size, width: size + (shown.length - 1) * 10, height: size, padding: 4, borderRadius: 999, background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", zIndex: 5 }}
    >
      <span className="flex items-center">
        {shown.map((a, i) => (
          <span key={a.name} className="rounded-full" style={{ marginLeft: i ? -18 : 0, boxShadow: "0 0 0 2px #fff" }}><ProfileAvatar profile={avatarOf(a)} size={size - 8} /></span>
        ))}
      </span>
      <span className="absolute -bottom-1 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center" style={{ background: "#111827", color: "#fff", fontSize: editorType.meta, fontWeight: 700, boxShadow: "0 0 0 2px #fff" }}>{count}</span>
      {unread && <span aria-hidden className="absolute -top-0.5 right-0 size-2.5 rounded-full" style={{ background: color.brand, boxShadow: "0 0 0 2px #fff" }} />}
    </button>
  );
}

function popoverPos(x: number, y: number, bounds: { w: number; h: number }, width: number, height: number) {
  // 핀이 꼬리 끝(x) 기준 가운데라 양옆 16px. 그 바깥 10px에 띄운다
  let left = x + 26;
  if (left + width > bounds.w - 8) left = Math.max(8, x - width - 26);
  const top = Math.min(Math.max(8, y - 40), Math.max(8, bounds.h - height - 8));
  return { left, top };
}

const POP_STYLE = {
  ...f, width: 320, background: "#fff", borderRadius: 14, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb", zIndex: 10,
} as const;
const MENU_STYLE = { ...f, background: "#1e1e1e", borderRadius: 12, boxShadow: "0px 12px 40px rgba(0,0,0,0.3)" } as const;
const iconBtn = "size-8 shrink-0 rounded-md flex items-center justify-center outline-none hover:bg-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-35";

export interface Member extends CommentAuthor { email?: string }

/** 본문 — @이름(멘션)은 파란 글씨 */
function RichText({ text, members }: { text: string; members: Member[] }) {
  const tokens = members.map((m) => `@${m.name}`).sort((a, b) => b.length - a.length);
  const parts: { t: string; mention: boolean }[] = [];
  let rest = text;
  while (rest) {
    // 가장 앞에 나오는 멘션을 찾아 그 앞뒤로 나눈다(긴 이름 먼저 — "김하늘"과 "김하" 같은 겹침 방지)
    let best: { at: number; tok: string } | null = null;
    for (const tok of tokens) { const at = rest.indexOf(tok); if (at >= 0 && (!best || at < best.at)) best = { at, tok }; }
    if (!best) { parts.push({ t: rest, mention: false }); break; }
    if (best.at) parts.push({ t: rest.slice(0, best.at), mention: false });
    parts.push({ t: best.tok, mention: true });
    rest = rest.slice(best.at + best.tok.length);
  }
  return <>{parts.map((p, i) => (p.mention ? <span key={i} style={{ color: color.brand, fontWeight: 600 }}>{p.t}</span> : <span key={i}>{p.t}</span>))}</>;
}

/** 작은 어두운 메뉴(⋯) */
function DarkMenu({ items, onClose, align = "right" }: { items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean; hint?: string }[]; onClose: () => void; align?: "right" | "left" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute top-8 z-30 py-2 w-[180px]" style={{ ...MENU_STYLE, [align]: 0 }} role="menu">
      {items.map((it) => (
        <button
          key={it.label} type="button" role="menuitem" disabled={it.disabled} title={it.disabled ? it.hint : undefined}
          onClick={() => { onClose(); it.onClick(); }}
          className="w-full text-left px-3 h-8 hover:bg-[#2f2f2f] disabled:opacity-40 disabled:hover:bg-transparent outline-none focus-visible:bg-[#2f2f2f]"
          style={{ fontSize: editorType.body, color: it.danger ? "#fca5a5" : "#f3f4f6" }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

const EMOJI_INSERT = ["👍", "🙏", "👀", "✅", "🔥", "🎉", "😊", "🤔", "❤️", "💡", "⚠️", "👏"];

/**
 * 입력창(Figma 기준) — 😊 이모지 · @ 멘션(입력 중 @ 를 치면 목록, ↑↓ Enter/Tab) · 🖼 이미지(4장·장당 2MB).
 * Enter 보내기 · Shift+Enter 줄바꿈 · Esc 취소. 보내지 않은 글은 onDraft 로 바깥에 남길 수 있다(답글 초안 유지).
 */
function Composer({ placeholder, members, onSubmit, onCancel, autoFocus = true, initial = "", onDraft, leading }: {
  placeholder: string; members: Member[]; onSubmit: (t: string, images: string[]) => void; onCancel?: () => void; autoFocus?: boolean;
  initial?: string; onDraft?: (t: string) => void; leading?: ReactNode;
}) {
  const [text, setText] = useState(initial);
  const [images, setImages] = useState<string[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const grow = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${Math.min(140, el.scrollHeight)}px`; } };
  useEffect(grow, [text]);
  const update = (v: string) => { setText(v); onDraft?.(v); };

  const candidates = mention ? members.filter((m) => !mention.q || m.name.includes(mention.q) || m.email?.toLowerCase().includes(mention.q.toLowerCase())).slice(0, 5) : [];
  const detectMention = (v: string, caret: number) => {
    const m = /(^|\s)@([^\s@]*)$/.exec(v.slice(0, caret));
    if (m) { setMention({ q: m[2], start: caret - m[2].length - 1 }); setCursor(0); } else setMention(null);
  };
  const pick = (m: Member) => {
    if (!mention) return;
    const el = ref.current!;
    const caret = el.selectionStart;
    const v = `${text.slice(0, mention.start)}@${m.name} ${text.slice(caret)}`;
    update(v);
    setMention(null);
    requestAnimationFrame(() => { const pos = mention.start + m.name.length + 2; el.focus(); el.setSelectionRange(pos, pos); });
  };
  const insertAtCaret = (str: string) => {
    const el = ref.current!;
    const a = el.selectionStart ?? text.length, b = el.selectionEnd ?? text.length;
    const v = text.slice(0, a) + str + text.slice(b);
    update(v);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + str.length, a + str.length); detectMention(v, a + str.length); });
  };
  const addImages = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).filter((x) => x.type.startsWith("image/"));
    if (list.some((x) => x.size > 2 * 1024 * 1024)) showToast("이미지는 장당 2MB까지 올릴 수 있어요.", "error");
    const ok = list.filter((x) => x.size <= 2 * 1024 * 1024).slice(0, Math.max(0, 4 - images.length));
    if (list.length > ok.length && images.length + list.length > 4) showToast("이미지는 4장까지 첨부할 수 있어요.", "error");
    ok.forEach((file) => { const r = new FileReader(); r.onload = () => setImages((l) => (l.length >= 4 ? l : [...l, String(r.result)])); r.readAsDataURL(file); });
  };
  const submit = () => { const t = text.trim(); if (!t && !images.length) return; onSubmit(t, images); update(""); setImages([]); setMention(null); };
  const canSend = !!text.trim() || images.length > 0;

  return (
    <div className="relative flex items-start gap-2" style={{ padding: 12 }}>
      {leading}
      <div className="field-pill flex-1 min-w-0 rounded-xl bg-white border border-[#e5e7eb]">
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap" style={{ padding: "8px 8px 0" }}>
            {images.map((src, i) => (
              <span key={i} className="relative">
                <img src={src} alt="" className="size-12 rounded-md object-cover" style={{ border: "1px solid #e5e7eb" }} />
                <button type="button" aria-label="이미지 빼기" onClick={() => setImages((l) => l.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 size-4 rounded-full flex items-center justify-center" style={{ background: "#111827" }}><X size={10} color="#fff" /></button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={ref} rows={1} value={text}
          onChange={(e) => { update(e.target.value); detectMention(e.target.value, e.target.selectionStart); }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (mention && candidates.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % candidates.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c - 1 + candidates.length) % candidates.length); return; }
              if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) { e.preventDefault(); pick(candidates[cursor]); return; }
              if (e.key === "Escape") { e.preventDefault(); setMention(null); return; }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
            if (e.key === "Escape") { e.preventDefault(); onCancel?.(); }
          }}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addImages(e.clipboardData.files); } }}
          placeholder={placeholder}
          className="field-inline w-full resize-none bg-transparent block"
          style={{ ...f, fontSize: editorType.large, lineHeight: "20px", color: "#111827", padding: "8px 12px 4px", outline: "none", maxHeight: 140 }}
        />
        <div className="flex items-center gap-0.5" style={{ padding: "0 4px 4px" }}>
          <IconTooltip label="이모지" side="top"><button type="button" className={iconBtn} aria-label="이모지" onClick={() => setEmojiOpen((v) => !v)}><Smile size={15} color="#64748b" /></button></IconTooltip>
          <IconTooltip label="멘션 추가 (@)" side="top"><button type="button" className={iconBtn} aria-label="멘션 추가" onClick={() => insertAtCaret(text && !/\s$/.test(text) ? " @" : "@")}><AtSign size={15} color="#64748b" /></button></IconTooltip>
          <IconTooltip label="이미지 첨부 (4장, 장당 2MB)" side="top"><button type="button" className={iconBtn} aria-label="이미지 첨부" onClick={() => fileRef.current?.click()}><ImageIcon size={15} color="#64748b" /></button></IconTooltip>
          <IconTooltip label="보내기 (Enter)" side="top"><button type="button" aria-label="보내기" disabled={!canSend} onClick={submit} className="ml-auto size-8 rounded-full flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ background: canSend ? color.brand : "#e5e7eb" }}>
            <ArrowUp size={14} color="#fff" strokeWidth={2.4} />
          </button></IconTooltip>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
      {emojiOpen && (
        <div className="absolute bottom-full left-2 mb-1 z-30 grid grid-cols-6 gap-0.5 p-2 rounded-xl bg-white" style={{ boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} onMouseLeave={() => setEmojiOpen(false)}>
          {EMOJI_INSERT.map((em) => <button key={em} type="button" onClick={() => { insertAtCaret(em); setEmojiOpen(false); }} className="size-8 rounded-md hover:bg-[#f3f4f6]" style={{ fontSize: 16 }}>{em}</button>)}
        </div>
      )}
      {mention && candidates.length > 0 && (
        <div className="absolute bottom-full left-2 right-2 mb-1 z-30 rounded-xl bg-white py-1" style={{ boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="listbox" aria-label="멘션할 사람">
          {candidates.map((m, i) => (
            <button
              key={m.name} type="button" role="option" aria-selected={i === cursor}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }} onMouseEnter={() => setCursor(i)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left" style={{ background: i === cursor ? "#f3f4f6" : undefined }}
            >
              <ProfileAvatar profile={avatarOf(m)} size={28} />
              <span className="min-w-0">
                <span className="block truncate" style={{ fontSize: editorType.body, fontWeight: 600, color: "#111827" }}>{m.name}</span>
                {m.email && <span className="block truncate" style={{ fontSize: editorType.caption, color: "#64748b" }}>{m.email}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DraftPopover({ x, y, bounds, me, members, onSubmit, onCancel }: {
  x: number; y: number; bounds: { w: number; h: number }; me: CommentAuthor; members: Member[]; onSubmit: (t: string, images: string[]) => void; onCancel: () => void;
}) {
  const pos = popoverPos(x, y, bounds, 320, 120);
  return (
    <div className="absolute" style={{ ...POP_STYLE, ...pos }} onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label="새 코멘트">
      <Composer placeholder="코멘트 추가 (@로 멘션)" members={members} onSubmit={onSubmit} onCancel={onCancel} />
    </div>
  );
}

/** 댓글 한 개 — 마우스를 올리면 😊 반응 · ⋯(내 댓글: 수정·삭제). 반응 칩은 다시 누르면 취소 */
function MessageItem({ m, me, members, isFirst, onEdit, onDelete, onReact, onZoomImage }: {
  m: CommentMsg; me: CommentAuthor; members: Member[]; isFirst: boolean;
  onEdit: (text: string) => void; onDelete: () => void; onReact: (emoji: string) => void; onZoomImage: (src: string) => void;
}) {
  const mine = m.author.name === me.name;
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const reactions = Object.entries(m.reactions ?? {}).filter(([, who]) => who.length);
  return (
    <div className="group relative flex gap-3" style={{ padding: "12px 12px" }}>
      <ProfileAvatar profile={avatarOf(m.author)} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 pr-14">
          <span style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>{m.author.name}</span>
          <span style={{ fontSize: editorType.caption, color: "#94a3b8" }}>{relTime(m.createdAt)}{m.editedAt ? " · 수정됨" : ""}</span>
        </div>
        {editing ? (
          <div className="mt-1">
            <textarea
              autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (draft.trim()) { onEdit(draft.trim()); setEditing(false); } } if (e.key === "Escape") { setEditing(false); setDraft(m.text); } }}
              className="w-full resize-none rounded-lg border border-[#a5b4fc]" style={{ ...f, fontSize: editorType.large, lineHeight: "20px", padding: "8px 8px", outline: "none" }}
            />
            <div className="flex justify-end gap-1 mt-1">
              <button type="button" onClick={() => { setEditing(false); setDraft(m.text); }} className="rounded-md px-2 h-6" style={{ fontSize: editorType.caption, color: "#475569" }}>취소</button>
              <button type="button" disabled={!draft.trim()} onClick={() => { onEdit(draft.trim()); setEditing(false); }} className="rounded-md px-3 h-6 disabled:opacity-40" style={{ fontSize: editorType.caption, fontWeight: 700, color: "#fff", background: color.brand }}>저장</button>
            </div>
          </div>
        ) : (
          m.text && <p style={{ fontSize: editorType.large, lineHeight: "20px", color: "#1f2937", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 2 }}><RichText text={m.text} members={members} /></p>
        )}
        {!!m.images?.length && (
          <div className="flex gap-2 flex-wrap mt-2">
            {m.images.map((src, i) => <button key={i} type="button" onClick={() => onZoomImage(src)} aria-label="이미지 크게 보기"><img src={src} alt="" className="h-16 max-w-[120px] rounded-md object-cover" style={{ border: "1px solid #e5e7eb" }} /></button>)}
          </div>
        )}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {reactions.map(([em, who]) => {
              const on = who.includes(me.name);
              return (
                <button key={em} type="button" onClick={() => onReact(em)} title={who.join(", ")} className="inline-flex items-center gap-1 rounded-full px-2 h-6" style={{ fontSize: editorType.label, background: on ? color.surface.accent : "#f3f4f6", border: `1px solid ${on ? "#c7d2fe" : "transparent"}`, color: "#334155" }}>
                  {em}<span style={{ fontSize: editorType.caption, fontWeight: 600 }}>{who.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className={`absolute top-2 right-2 flex items-center ${menu || picker ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}>
        <IconTooltip label="반응 남기기"><button type="button" className={iconBtn} aria-label="반응 남기기" onClick={() => setPicker((v) => !v)}><Smile size={14} color="#64748b" /></button></IconTooltip>
        {mine && <IconTooltip label="수정 · 삭제"><button type="button" className={iconBtn} aria-label="댓글 메뉴" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><MoreHorizontal size={14} color="#64748b" /></button></IconTooltip>}
        {picker && (
          <div className="absolute top-8 right-0 z-30 flex gap-0.5 p-1 rounded-full bg-white" style={{ boxShadow: "0px 8px 24px rgba(0,0,0,0.16)", border: "1px solid #e5e7eb" }} onMouseLeave={() => setPicker(false)}>
            {REACTIONS.map((em) => <button key={em} type="button" onClick={() => { onReact(em); setPicker(false); }} className="size-8 rounded-full hover:bg-[#f3f4f6]" style={{ fontSize: 15 }} aria-label={`${em} 반응`}>{em}</button>)}
          </div>
        )}
        {menu && <DarkMenu onClose={() => setMenu(false)} items={[
          { label: "수정", onClick: () => { setDraft(m.text); setEditing(true); } },
          { label: isFirst ? "코멘트 삭제" : "답글 삭제", danger: true, onClick: onDelete },
        ]} />}
      </div>
    </div>
  );
}

export interface ThreadActions {
  onClose: () => void;
  onReply: (t: string, images: string[]) => void;
  onResolve: (r: boolean) => void;
  onDelete: () => void;
  onEditMsg: (msgId: string, text: string) => void;
  onDeleteMsg: (msgId: string) => void;
  onReact: (msgId: string, emoji: string) => void;
  onMarkUnread: () => void;
  onCopyLink: () => void;
  onDraft: (t: string) => void;
}

/**
 * 스레드 팝오버 — 머리: 코멘트 #n · ⋯(읽지 않음으로 표시 · 링크 복사 · 스레드 삭제) · ✓ 해결 · ✕.
 * 머리 아래 붙은 곳("Page 1 · 배달앱 모바일 메인") — Figma에는 없는 맥락 표시. 답글 초안은 닫아도 남는다.
 */
export function ThreadPopover({ x, y, bounds, thread, me, members, anchorLabel, draft, actions }: {
  x: number; y: number; bounds: { w: number; h: number }; thread: Thread; me: CommentAuthor; members: Member[]; anchorLabel: string; draft: string; actions: ThreadActions;
}) {
  const [menu, setMenu] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const canDelete = thread.messages[0]?.author.name === me.name;
  const pos = popoverPos(x, y, bounds, 320, 400);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [thread.messages.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (zoom) setZoom(null); else actions.onClose(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [actions, zoom]);

  return (
    <div className="absolute flex flex-col" style={{ ...POP_STYLE, ...pos, maxHeight: 460 }} onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label={`코멘트 ${thread.number}번`}>
      <div className="relative flex items-center gap-1" style={{ padding: "12px 8px 8px 16px" }}>
        <span style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>코멘트 <span style={{ color: "#94a3b8", fontWeight: 600 }}>#{thread.number}</span></span>
        {thread.resolved && <span style={{ fontSize: editorType.caption, fontWeight: 700, color: EDITOR_ACCENT, marginLeft: 4 }}>해결됨</span>}
        <div className="ml-auto flex items-center relative">
          <IconTooltip label="읽지 않음 · 링크 복사 · 삭제"><button type="button" className={iconBtn} aria-label="코멘트 메뉴" aria-expanded={menu} onClick={() => setMenu((v) => !v)} style={{ background: menu ? "#eef2ff" : undefined }}><MoreHorizontal size={16} color="#475569" /></button></IconTooltip>
          <IconTooltip label={thread.resolved ? "다시 열기" : "해결로 표시"}><button type="button" className={iconBtn} aria-label={thread.resolved ? "다시 열기" : "해결로 표시"} onClick={() => actions.onResolve(!thread.resolved)}>
            {thread.resolved ? <RotateCcw size={15} color="#475569" /> : <Check size={16} color={EDITOR_ACCENT} strokeWidth={2.4} />}
          </button></IconTooltip>
          <IconTooltip label="닫기 (Esc)"><button type="button" className={iconBtn} aria-label="닫기" onClick={actions.onClose}><X size={16} color="#475569" /></button></IconTooltip>
          {menu && <DarkMenu onClose={() => setMenu(false)} items={[
            { label: "읽지 않음으로 표시", onClick: actions.onMarkUnread },
            { label: "링크 복사", onClick: actions.onCopyLink },
            { label: "코멘트 삭제", danger: true, onClick: actions.onDelete, disabled: !canDelete, hint: "첫 코멘트 작성자만 삭제할 수 있어요" },
          ]} />}
        </div>
      </div>
      <p className="flex items-center gap-1 truncate" style={{ fontSize: editorType.caption, color: "#64748b", padding: "0 16px 8px", borderBottom: "1px solid #f1f5f9" }}>
        <MapPin size={11} className="shrink-0" />{anchorLabel}
      </p>
      <div ref={listRef} className="overflow-y-auto ui-scroll" style={{ padding: "2px 0" }}>
        {thread.messages.map((m, i) => (
          <MessageItem
            key={m.id} m={m} me={me} members={members} isFirst={i === 0}
            onEdit={(t) => actions.onEditMsg(m.id, t)}
            onDelete={() => (i === 0 ? actions.onDelete() : actions.onDeleteMsg(m.id))}
            onReact={(em) => actions.onReact(m.id, em)}
            onZoomImage={setZoom}
          />
        ))}
      </div>
      <div style={{ borderTop: "1px solid #f1f5f9" }}>
        <Composer
          key={thread.id} placeholder="답글 달기" members={members} autoFocus={false} initial={draft} onDraft={actions.onDraft}
          onSubmit={actions.onReply} onCancel={actions.onClose}
        />
      </div>
      {zoom && (
        <button type="button" aria-label="이미지 닫기" onClick={() => setZoom(null)} className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: "rgba(15,23,42,0.6)" }}>
          <img src={zoom} alt="" className="max-w-[80vw] max-h-[80vh] rounded-lg" />
        </button>
      )}
    </div>
  );
}

