import type { EditorAppId } from "@/app/components/editor-shell/apps";

/**
 * 최근 편집기 파일(2026-11-19) — 메인 사이드바 "최근 작업"에 AI 대화와 함께 보여 줄 편집기 파일.
 * dev 서비스처럼 편집기에서 만든 파일은 그 편집기 아이콘(사이드바의 선 아이콘, App RECENT_ICON)을 앞에 붙여 대화와 구분하고, 누르면 그 편집기를 그 파일로 바로 연다.
 * 각 편집기가 이 브라우저에 저장한 목록을 읽기만 한다(doceditor: ddalkkak.doceditor.{kind}.v1, UI 디자인: ddalkkak.uidesign.v1).
 * PDF는 연 파일을 저장하지 않아(브라우저 메모리의 파일) 여기 나오지 않는다.
 */
export interface RecentEditorFile { kind: EditorAppId; id: string; name: string; updatedAt: number; app: string }

const EXT: Partial<Record<EditorAppId, string>> = { hangul: "hwpx", word: "docx", excel: "xlsx", ppt: "pptx", video: "mp4", image: "png" };
const APP_NAME: Record<EditorAppId, string> = { hangul: "한글 편집기", word: "딸깍 문서", excel: "딸깍 시트", ppt: "딸깍 슬라이드", pdf: "딸깍 PDF", uidesign: "딸깍 UI 디자인", image: "이미지 디자인", video: "딸깍 영상편집" };

export function readRecentEditorFiles(limit = 6): RecentEditorFile[] {
  const out: RecentEditorFile[] = [];
  const safe = <T,>(key: string, fallback: T): T => { try { return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback; } catch { return fallback; } };
  for (const kind of Object.keys(EXT) as EditorAppId[]) {
    for (const d of safe<{ id: string; name: string; updatedAt: number }[]>(`ddalkkak.doceditor.${kind}.v1`, [])) {
      out.push({ kind, id: d.id, name: `${d.name}.${EXT[kind]}`, updatedAt: d.updatedAt ?? 0, app: APP_NAME[kind] });
    }
  }
  for (const d of safe<{ files?: { id: string; name: string; updatedAt: number }[] }>("ddalkkak.uidesign.v1", {}).files ?? []) {
    out.push({ kind: "uidesign", id: d.id, name: d.name.replace(/^Untitled board( \d+)?$/, "제목 없는 보드$1").replace(/^Untitled( \d+)?$/, "제목 없는 디자인$1"), updatedAt: d.updatedAt ?? 0, app: APP_NAME.uidesign });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

/**
 * 사이드바 · 내 작업의 ⋯ 메뉴(이름 바꾸기 · 삭제, 2026-11-20). 편집기가 저장한 목록을 직접 고친다.
 * 바뀌면 FILES_EVENT를 쏘고, App이 듣고 최근 목록을 다시 읽는다.
 */
export const FILES_EVENT = "ddk-files-changed";
const notify = () => window.dispatchEvent(new Event(FILES_EVENT));
const docKey = (kind: EditorAppId) => `ddalkkak.doceditor.${kind}.v1`;
const read = <T,>(key: string, fallback: T): T => { try { return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback; } catch { return fallback; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 이번 세션만 */ } };

export function renameEditorFile(rf: RecentEditorFile, name: string) {
  const n = name.trim(); if (!n) return;
  if (rf.kind === "uidesign") {
    const st = read<{ files?: { id: string; name: string }[] }>("ddalkkak.uidesign.v1", {});
    write("ddalkkak.uidesign.v1", { ...st, files: (st.files ?? []).map((f) => (f.id === rf.id ? { ...f, name: n } : f)) });
  } else {
    const ext = EXT[rf.kind];
    const bare = ext ? n.replace(new RegExp(`\\.${ext}$`, "i"), "") : n;
    write(docKey(rf.kind), read<{ id: string; name: string }[]>(docKey(rf.kind), []).map((d) => (d.id === rf.id ? { ...d, name: bare } : d)));
  }
  notify();
}
export function deleteEditorFile(rf: RecentEditorFile) {
  if (rf.kind === "uidesign") {
    const st = read<{ files?: { id: string }[] }>("ddalkkak.uidesign.v1", {});
    write("ddalkkak.uidesign.v1", { ...st, files: (st.files ?? []).filter((f) => f.id !== rf.id) });
  } else {
    write(docKey(rf.kind), read<{ id: string }[]>(docKey(rf.kind), []).filter((d) => d.id !== rf.id));
  }
  notify();
}

/** 예시 대화(서버 없음)는 이름 바꾸기 · 삭제를 이 브라우저에 덮어써 둔다. 열쇠는 처음 이름 */
const CHAT_KEY = "ddalkkak.chatOverrides";
type ChatOverrides = { renamed: Record<string, string>; hidden: string[] };
export const readChatOverrides = (): ChatOverrides => read<ChatOverrides>(CHAT_KEY, { renamed: {}, hidden: [] });
export function renameChat(orig: string, name: string) {
  const n = name.trim(); if (!n) return;
  const o = readChatOverrides(); write(CHAT_KEY, { ...o, renamed: { ...o.renamed, [orig]: n } }); notify();
}
export function hideChat(orig: string) {
  const o = readChatOverrides(); write(CHAT_KEY, { ...o, hidden: [...o.hidden, orig] }); notify();
}
