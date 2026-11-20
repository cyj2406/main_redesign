import type { CollabColorId } from "@/app/state/profile";

/**
 * 에디터 공통 코멘트 규칙 — 스레드 상태·읽음 판정·시간 표시. 핀을 어디에 붙이는지는 에디터마다 다르다
 * (UI 디자인 = 캔버스/프레임, 문서 = 글자 범위 …). 기획: docs/ui-design-editor.md "3. 코멘트".
 */

export interface CommentAuthor {
  name: string;
  avatarUrl: string | null;
  collabColor: CollabColorId;
}
export interface CommentMsg {
  id: string;
  author: CommentAuthor;
  text: string;
  createdAt: number;
  /** 수정한 시각 — 있으면 "(수정됨)" */
  editedAt?: number;
  /** 이모지 반응 — 이모지 → 누른 사람 이름들 */
  reactions?: Record<string, string[]>;
  /** 첨부 이미지(data URL) */
  images?: string[];
}
export interface CommentThreadBase {
  id: string;
  number: number;
  messages: CommentMsg[];
  resolved: boolean;
  /** 내가 마지막으로 읽은 시각 — 그 뒤에 남이 단 댓글이 있으면 읽지 않음 */
  readAt: number;
  /** "읽지 않음으로 표시" — 다시 열 때까지 읽지 않음 */
  forcedUnread?: boolean;
  /** 내가 쓰다 만 답글(보내지 않음) — 팝오버를 닫아도 남고 목록에 "작성 중" */
  myDraft?: string;
  /** 붙은 자리 이름(엑셀 "Sheet1 · B3" 등). 없으면 편집기 기본 위치 이름 */
  place?: string;
}

export function isUnread(t: CommentThreadBase, me: CommentAuthor): boolean {
  return !!t.forcedUnread || t.messages.some((m) => m.createdAt > t.readAt && m.author.name !== me.name);
}

/** 다른 사람이 나를 @멘션했는지 */
export function mentionsMe(t: CommentThreadBase, me: CommentAuthor): boolean {
  return t.messages.some((m) => m.author.name !== me.name && m.text.includes(`@${me.name}`));
}
/** 내가 참여한(쓰거나 답한) 스레드인지 */
export function involvesMe(t: CommentThreadBase, me: CommentAuthor): boolean {
  return t.messages.some((m) => m.author.name === me.name);
}

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "✅"] as const;

export function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 프로토타입 데모용 예시 팀원 — 읽지 않음 흐름을 보여 주는 가짜 답글에만 쓴다 */
export const DEMO_TEAMMATE: CommentAuthor = { name: "김하늘", avatarUrl: null, collabColor: "violet" };
/** 멘션 후보 예시 — 실제로는 파일 공유 대상·팀 멤버(서버 연동 전 프로토타입) */
export const DEMO_MEMBERS: (CommentAuthor & { email: string })[] = [
  { ...DEMO_TEAMMATE, email: "haneul.kim@example.com" },
  { name: "이도윤", avatarUrl: null, collabColor: "teal", email: "doyun.lee@example.com" },
];

/**
 * 딸깍넷 공통 코멘트 단축키(2026-11-20): 모든 편집기에서 ⌘⌥M(윈도우 Ctrl+Alt+M) 하나로 코멘트 모드를 켜고 끈다.
 * Google 문서·시트·슬라이드, Word·PowerPoint와 같은 키. 문서 편집기에선 글자 입력과 겹치는 C 한 글자를 쓸 수 없어서
 * 조합키 하나로 통일했다(딸깍 AI ⌘J처럼). UI 디자인의 C·⇧C는 Figma 습관용으로 동작만 남기고 안내하지 않는다.
 */
export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const COMMENT_SHORTCUT = IS_MAC ? "⌘⌥M" : "Ctrl+Alt+M";
/** e.key는 ⌥와 함께 누르면 다른 글자(µ)가 되므로 물리 키(e.code)로 본다 */
export function isCommentShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.altKey && !e.shiftKey && e.code === "KeyM";
}
