import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ChevronDown, ChevronRight, Circle, StickyNote, Timer, Spline, Vote, Frame, Hand, Hash, HelpCircle, Image as ImageIcon, Menu, Minus, MousePointer2, MoveUpRight, PanelLeft, Pencil, Plus, Search, Square, SquareDashed, Type, type LucideIcon } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import type { AiAttachment, AiRequest, AiResult } from "@/app/components/editor-shell/AiAssistantPanel";
import { COMMENT_SHORTCUT, DEMO_MEMBERS, DEMO_TEAMMATE, isCommentShortcut, type CommentAuthor } from "@/app/components/editor-shell/comments";
import { creditFor } from "@/app/state/aiModels";
import { setCreditBalance } from "@/app/state/creditBalance";
import { getProfile } from "@/app/state/profile";
import { f, editorType } from "@/app/styleTokens";
import { PanelResizeHandle, usePanelWidth } from "@/app/components/editor-shell/PanelResize";

import { Canvas, type Draft, type Tool, type View } from "./Canvas";
import type { Member, ThreadActions } from "./Comments";
import { Inspector, type InspectorMode } from "./Inspector";
import { MainMenu, type MenuGroup, type MenuItem } from "./MainMenu";
import {
  EDITOR_ACCENT, EDITOR_ACCENT_SOFT, absPos, addNode, darkenTree, deleteNode, generateSteps, isDarkRequest, makeNode, stepCredit, uid, updateNode,
  type Doc, type DNode, type Thread,
} from "./model";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";
import { josa } from "@/app/copy";

/**
 * 디자인 파일 하나(탭 하나) — 파일 패널·캔버스·툴바·속성 패널. 기획: docs/ui-design-editor.md.
 * 상단 바·탭 줄·오른쪽 도크(AI·코멘트 목록)는 셸(UiDesignEditor)이 갖고, 셸은 FileApi 로 이 파일에 일을 시킨다.
 * 코멘트 스레드는 셸이 들고 있다(도크 목록이 읽어야 해서) — 여기서는 threads/setThreads 로 받는다.
 */

/** 메인 메뉴의 파일 단위 동작 — 탭·파일 목록은 셸이 갖고 있어서 셸이 넘긴다 */
export interface FileShell {
  newFile: () => void;
  openImage: (name: string, dataUrl: string, w: number, h: number) => void;
  duplicateFile: () => void;
  closeFile: () => void;
  toggleAi: () => void;
}

export interface FileApi {
  runAi: (req: AiRequest, onStep: (l: string) => void, isCancelled: () => boolean) => Promise<AiResult>;
  planAi: (req: AiRequest) => string[];
  jumpTo: (t: Thread) => void;
  /** 오른쪽 코멘트 목록 안에서 스레드를 그릴 때 쓰는 것(동작은 부를 때마다 최신 상태로) */
  threadView: (t: Thread) => { actions: ThreadActions; members: Member[]; anchorLabel: string };
  attachSelection: () => AiAttachment | null;
  showResult: (r: AiResult) => void;
  undoResult: (r: AiResult) => void;
  clearSelection: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BORDER = "1px solid #eef0f3";
const LEFT_KEY = "ddalkkak.uidesign.leftPanel";
const profileEmail = getProfile().email;

export function DesignFile({
  initialDoc, active, me, threads, setThreads, pinsHidden, togglePins, onCommentMode, onExitCommentMode, commentPanelOpen, onOpenThreadChange, registerApi, onSelection, onDocChange, shell, kind = "design",
}: {
  initialDoc: Doc;
  /** board = 피그잼형 보드(2026-11-20): 점 배경, 보드 도구(스티커 메모, 연결선 …), 타이머. dev 보드처럼 오른쪽 속성 패널 없음(고를 때마다 패널이 열려 캔버스가 줄어드는 게 어색했다) */
  kind?: "design" | "board";
  active: boolean;
  me: CommentAuthor;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  pinsHidden: boolean;
  togglePins: () => void;
  /** 코멘트 모드에 들어갈 때 — 셸이 도크를 코멘트 탭으로 연다 */
  onCommentMode: () => void;
  /** 코멘트 모드를 나갈 때(Esc · ⌘⌥M · 다른 도구) — 셸이 코멘트 목록도 닫는다(문서 편집기와 같음) */
  onExitCommentMode?: () => void;
  /** 상단 💬로 코멘트 목록이 열려 있으면 이 파일도 코멘트 모드(2026-11-20: 툴바 말풍선을 빼고 상단 💬 하나로) */
  commentPanelOpen?: boolean;
  /** 열린 스레드가 바뀔 때(목록이 열려 있으면 셸이 목록 안에 그린다) */
  onOpenThreadChange?: (id: string | null) => void;
  registerApi: (api: FileApi) => void;
  onSelection: (label: string | null) => void;
  /** 문서가 바뀔 때마다 — 셸이 "내 파일" 썸네일·저장·다시 열기에 쓴다 */
  onDocChange: (d: Doc) => void;
  shell: FileShell;
}) {
  // ── 문서·실행 취소 ──
  const [doc, setDoc] = useState<Doc>(initialDoc);
  const docRef = useRef(doc);
  docRef.current = doc;
  const past = useRef<Doc[]>([]);
  const future = useRef<Doc[]>([]);
  const commitFrom = useCallback((base: Doc, next: Doc) => { past.current.push(base); future.current = []; docRef.current = next; setDoc(next); }, []);
  const commit = useCallback((next: Doc) => commitFrom(docRef.current, next), [commitFrom]);
  const undo = () => { const prev = past.current.pop(); if (prev) { future.current.push(docRef.current); setDoc(prev); } };
  const redo = () => { const nx = future.current.pop(); if (nx) { past.current.push(docRef.current); setDoc(nx); } };

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    onDocChange(doc);
  }, [doc, onDocChange]);

  const [pageId, setPageId] = useState(initialDoc.pages[0].id);
  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [tool, setToolRaw] = useState<Tool>("move");
  // 보드 투표 세션(2026-11-20): per = 1인당 표, target = 모든 개체 | 스티커 메모만, mine = 내 표, ended = 끝나고 결과 보는 중
  const [vote, setVote] = useState<{ per: number; target: "all" | "sticky"; mine: Record<string, number>; ended: boolean } | null>(null);
  const [view, setView] = useState<View>({ x: 120, y: 100, zoom: 1 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rail, setRail] = useState<"file" | "assets" | "vars">("file");
  // 왼쪽 패널 보이기(⌘\) — 마지막 상태를 기억한다
  const [leftOpen, setLeftOpenRaw] = useState(() => { try { return localStorage.getItem(LEFT_KEY) !== "0"; } catch { return true; } });
  // 왼쪽 레이어 패널 너비(2026-11-19: 220 고정 → Figma처럼 기본 240, 오른쪽 끝을 끌어 200~400)
  const layersPanel = usePanelWidth("uidesign.layers", 240, 200, 400);
  const setLeftOpen = (v: boolean) => { setLeftOpenRaw(v); try { localStorage.setItem(LEFT_KEY, v ? "1" : "0"); } catch { /* 이번 세션만 */ } };
  const [menu, setMenu] = useState<null | "menu" | "search">(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  // 모드(디자인 · 프로토타입 · 개발)와 레이아웃 그리드: 2026-11-20부터 툴바가 아니라 오른쪽 패널 탭 · 메뉴 ☰ › 보기
  const [mode, setMode] = useState<InspectorMode>("design");
  const [grid, setGrid] = useState(false);
  const placeRef = useRef<HTMLInputElement>(null);
  const [aiCursor, setAiCursor] = useState<string | null>(null);
  const [aiBuilding, setAiBuilding] = useState<string | null>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const demoReplied = useRef(false);

  const setTool = (t: Tool) => {
    if (tool === "comment" && t !== "comment") onExitCommentMode?.();
    setToolRaw(t);
    setDraft(null);
    if (t === "comment") { setSelectedId(null); onCommentMode(); }
  };
  // 상단 💬(목록)를 열고 닫으면 코멘트 모드도 같이 켜고 끈다
  useEffect(() => {
    if (!active) return;
    if (commentPanelOpen && tool !== "comment") { setToolRaw("comment"); setSelectedId(null); }
    if (!commentPanelOpen && tool === "comment") { setToolRaw("move"); setDraft(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentPanelOpen, active]);
  // 목록에서 보던 스레드는 목록을 닫으면 같이 닫는다(닫자마자 캔버스 팝오버로 튀어나오지 않게)
  useEffect(() => { if (active && !commentPanelOpen) setOpenThreadId(null); }, [commentPanelOpen, active]);
  useEffect(() => { onOpenThreadChange?.(openThreadId); }, [openThreadId, onOpenThreadChange]);

  const selected = selectedId ? doc.nodes[selectedId] ?? null : null;
  useEffect(() => { if (active) onSelection(selected?.name ?? null); }, [active, selected?.name, onSelection]);

  // 템플릿·이미지로 연 파일은 처음에 화면에 맞춘다
  useEffect(() => { if (initialDoc.pages[0].rootIds.length) requestAnimationFrame(() => zoomBy("fit")); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ── 코멘트 ── (v3 보완: docs/ui-design-editor.md "3-5")
  const members: Member[] = useMemo(() => [{ ...me, email: profileEmail } as Member, ...DEMO_MEMBERS.filter((x) => x.name !== me.name)], [me]);
  const patchThread = (id: string, fn: (t: Thread) => Thread) => setThreads((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  const createThread = (d: Draft, text: string, images: string[] = []) => {
    const now = Date.now();
    const t: Thread = {
      id: uid("t"), number: threads.reduce((m, x) => Math.max(m, x.number), 0) + 1, pageId: page.id, frameId: d.frameId, x: d.x, y: d.y,
      resolved: false, readAt: now, messages: [{ id: uid("m"), author: me, text, createdAt: now, images: images.length ? images : undefined }],
    };
    setThreads((all) => [...all, t]);
    setDraft(null);
    setOpenThreadId(t.id);
    // DEMO_: 읽지 않음·멘션 흐름을 보여 주는 예시 팀원 답글 — 파일마다 첫 스레드에 한 번만
    if (!demoReplied.current) {
      demoReplied.current = true;
      window.setTimeout(() => {
        patchThread(t.id, (x) => ({ ...x, messages: [...x.messages, { id: uid("m"), author: DEMO_TEAMMATE, text: `@${me.name} 확인했어요! 오늘 안에 반영해 볼게요 👍`, createdAt: Date.now() }] }));
        showToast(`${DEMO_TEAMMATE.name}님이 회원님을 멘션했어요.`);
      }, 4000);
    }
  };
  const reply = (id: string, text: string, images: string[]) => patchThread(id, (t) => ({
    ...t, readAt: Date.now(), myDraft: undefined, messages: [...t.messages, { id: uid("m"), author: me, text, createdAt: Date.now(), images: images.length ? images : undefined }],
  }));
  /** 되돌리기용 — 바꾸기 전 스레드 목록으로 복원 */
  const restoreThreads = (snapshot: Thread[]) => setThreads(snapshot);
  const resolve = (id: string, resolved: boolean) => {
    const before = threads;
    patchThread(id, (t) => ({ ...t, resolved }));
    if (resolved) { setOpenThreadId(null); showToast("코멘트를 해결했어요.", "success", { label: "되돌리기", onClick: () => restoreThreads(before) }); }
  };
  const deleteThread = (id: string) => {
    const before = threads;
    setThreads((all) => all.filter((t) => t.id !== id));
    setOpenThreadId(null);
    showToast("코멘트를 삭제했어요.", "success", { label: "되돌리기", onClick: () => restoreThreads(before) });
  };
  const threadActions = (t: Thread): ThreadActions => ({
    onClose: () => setOpenThreadId(null),
    onReply: (text, images) => reply(t.id, text, images),
    onResolve: (r) => resolve(t.id, r),
    onDelete: () => deleteThread(t.id),
    onEditMsg: (msgId, text) => patchThread(t.id, (x) => ({ ...x, messages: x.messages.map((m) => (m.id === msgId ? { ...m, text, editedAt: Date.now() } : m)) })),
    onDeleteMsg: (msgId) => {
      const before = threads;
      patchThread(t.id, (x) => ({ ...x, messages: x.messages.filter((m) => m.id !== msgId) }));
      showToast("답글을 삭제했어요.", "success", { label: "되돌리기", onClick: () => restoreThreads(before) });
    },
    onReact: (msgId, emoji) => patchThread(t.id, (x) => ({
      ...x, messages: x.messages.map((m) => {
        if (m.id !== msgId) return m;
        const who = m.reactions?.[emoji] ?? [];
        const next = who.includes(me.name) ? who.filter((n) => n !== me.name) : [...who, me.name];
        return { ...m, reactions: { ...m.reactions, [emoji]: next } };
      }),
    })),
    onMarkUnread: () => { patchThread(t.id, (x) => ({ ...x, forcedUnread: true })); setOpenThreadId(null); showToast("읽지 않음으로 표시했어요."); },
    onCopyLink: () => {
      const url = `${window.location.origin}${window.location.pathname}#comment-${t.number}`;
      void navigator.clipboard?.writeText(url).catch(() => {});
      showToast("코멘트 링크를 복사했어요.");
    },
    onDraft: (text) => patchThread(t.id, (x) => ({ ...x, myDraft: text.trim() ? text : undefined })),
  });
  const anchorLabel = (t: Thread) => {
    const pg = doc.pages.find((x) => x.id === t.pageId)?.name ?? "";
    const fr = t.frameId ? doc.nodes[t.frameId]?.name : null;
    return `${pg} · ${fr ?? "캔버스"}`;
  };
  const moveThread = (id: string, frameId: string | null, x: number, y: number) => setThreads((all) => all.map((t) => (t.id === id ? { ...t, frameId, x, y } : t)));

  // 열려 있는 스레드는 새 댓글이 와도 바로 읽음
  const openThread = threads.find((t) => t.id === openThreadId);
  const lastAt = openThread?.messages.at(-1)?.createdAt ?? 0;
  useEffect(() => {
    if (!openThreadId) return;
    setThreads((all) => all.map((t) => (t.id === openThreadId && lastAt > t.readAt ? { ...t, readAt: Date.now() } : t)));
  }, [openThreadId, lastAt, setThreads]);

  const detachThreads = (d: Doc, nodeId: string) => setThreads((all) => all.map((t) => {
    if (t.frameId !== nodeId) return t;
    const a = absPos(d, nodeId);
    return { ...t, frameId: null, x: a.x + t.x, y: a.y + t.y };
  }));

  // ── 확대·축소 ──
  const fitTo = (minX: number, minY: number, maxX: number, maxY: number, cap = 2) => {
    const el = canvasWrap.current;
    const cw = el?.clientWidth ?? 800, ch = el?.clientHeight ?? 600;
    const zoom = Math.min(cap, (cw - 120) / Math.max(1, maxX - minX), (ch - 160) / Math.max(1, maxY - minY));
    setView({ zoom, x: (cw - (maxX - minX) * zoom) / 2 - minX * zoom, y: (ch - (maxY - minY) * zoom) / 2 - minY * zoom });
  };
  const zoomBy = (action: "in" | "out" | "100" | "fit") => {
    const d = docRef.current;
    const pg = d.pages.find((p) => p.id === pageId) ?? d.pages[0];
    const el = canvasWrap.current;
    const cw = el?.clientWidth ?? 800, ch = el?.clientHeight ?? 600;
    if (action === "fit") {
      const roots = pg.rootIds.map((id) => d.nodes[id]).filter(Boolean);
      if (!roots.length) { setView({ x: 120, y: 100, zoom: 1 }); return; }
      fitTo(Math.min(...roots.map((n) => n.x)), Math.min(...roots.map((n) => n.y)), Math.max(...roots.map((n) => n.x + n.w)), Math.max(...roots.map((n) => n.y + n.h)));
      return;
    }
    setView((v) => {
      const zoom = action === "100" ? 1 : Math.min(8, Math.max(0.1, v.zoom * (action === "in" ? 1.25 : 0.8)));
      return { zoom, x: cw / 2 - ((cw / 2 - v.x) / v.zoom) * zoom, y: ch / 2 - ((ch / 2 - v.y) / v.zoom) * zoom };
    });
  };

  // ── 단축키(보이는 탭만) ──
  useEffect(() => {
    if (!active) return;
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName));
    const onKey = (e: KeyboardEvent) => {
      // ⌘⌥M(Ctrl+Alt+M): 딸깍넷 공통 코멘트 단축키. 입력칸 안에서도 동작(딸깍 AI ⌘J처럼)
      if (isCommentShortcut(e)) { e.preventDefault(); setTool(tool === "comment" ? "move" : "comment"); return; }
      if (typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomBy("in"); return; }
      if (mod && e.key === "-") { e.preventDefault(); zoomBy("out"); return; }
      if (mod && e.key === "0") { e.preventDefault(); zoomBy("100"); return; }
      if (e.shiftKey && e.key === "!") { zoomBy("fit"); return; }
      if (e.shiftKey && e.key.toLowerCase() === "c") { togglePins(); return; }
      // Figma 단축키: ⇧L 화살표 · ⇧S 섹션 · ⇧P 연필 · ⇧D 개발 모드 · ⇧G 레이아웃 그리드 · ⇧⌘K 이미지 넣기
      if (e.shiftKey && mod && e.key.toLowerCase() === "k") { e.preventDefault(); placeRef.current?.click(); return; }
      if (e.shiftKey && !mod) {
        const k2 = e.key.toLowerCase();
        if (k2 === "l") { setTool("arrow"); return; }
        if (k2 === "s") { setTool("section"); return; }
        if (k2 === "p") { setTool("pencil"); return; }
        if (k2 === "d") { setMode((m) => (m === "dev" ? "design" : "dev")); return; }
        if (k2 === "g") { setGrid((v) => !v); return; }
      }
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setMenu("search"); if (!leftOpen) setLeftOpen(true); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); return; }
      if (mod && e.key === "\\") { e.preventDefault(); setLeftOpen(!leftOpen); return; }
      if (mod && e.key.toLowerCase() === "b" && selected?.type === "text") { e.preventDefault(); patchSelected({ fontWeight: (selected.fontWeight ?? 400) >= 700 ? 400 : 700 }); return; }
      if (mod && e.key === "]") { e.preventDefault(); reorder("front"); return; }
      if (mod && e.key === "[") { e.preventDefault(); reorder("back"); return; }
      if (mod) return;
      const k = e.key.toLowerCase();
      if (k === "escape") {
        if (draft) setDraft(null);
        else if (openThreadId) setOpenThreadId(null);
        else if (tool !== "move") setTool("move");
        else setSelectedId(null);
        return;
      }
      if ((k === "delete" || k === "backspace") && selectedId) {
        const d = docRef.current;
        detachThreads(d, selectedId);
        commit(deleteNode(d, selectedId));
        setSelectedId(null);
        return;
      }
      const map: Record<string, Tool> = { v: "move", h: "hand", f: "frame", r: "rect", o: "ellipse", l: "line", t: "text", c: "comment", p: "pencil", ...(kind === "board" ? { s: "sticky", x: "arrow", m: "pencil" } as Record<string, Tool> : {}) };
      if (map[k]) setTool(map[k]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── 딸깍 AI(목업) — 셸의 AI 패널이 FileApi.runAi 로 부른다 ──
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const api: FileApi = {
    planAi: (req) => {
      const sel = selectedRef.current;
      if (sel && isDarkRequest(req.prompt)) return [`선택한 "${docRef.current.nodes[sel]?.name}" 안의 바탕·글자 색 확인`, "밝은 바탕은 어둡게, 진한 글자는 밝게 바꾸기", "강조색(주황·초록 등)은 그대로 두기"];
      return generateSteps(req.prompt, 0, 0).steps.map((s) => s.label);
    },
    runAi: async (req, onStep, isCancelled) => {
      const startDoc = docRef.current;
      const sel = selectedRef.current;
      // 선택 맥락 + 다크 모드 → 새로 그리지 않고 선택한 것만 고친다
      if (sel && startDoc.nodes[sel] && isDarkRequest(req.prompt)) {
        await sleep(700);
        if (isCancelled()) return { summary: "시작 전에 중단했어요.", credit: 0, stepsDone: 0, stopped: true, addedCount: 0 };
        onStep(`"${startDoc.nodes[sel].name}" 색 확인`);
        setAiCursor(sel);
        await sleep(700);
        const { doc: next, changed } = darkenTree(docRef.current, sel);
        commitFrom(docRef.current, next);
        onStep(`색 ${changed}곳 바꾸기`);
        await sleep(300);
        setAiCursor(null);
        const credit = creditFor(req.model, 20 + changed);
        if (credit) setCreditBalance((b) => b - credit);
        return {
          summary: `${josa(`"${startDoc.nodes[sel].name}"`, "을/를")} 다크 모드로 바꿨어요. 강조색은 그대로 뒀어요.`, credit, stepsDone: 2, stopped: false, addedCount: 0,
          target: { id: sel, label: startDoc.nodes[sel].name, meta: `색 ${changed}곳 바꿈 · ⌘Z로 되돌리기` },
        };
      }
      const pg = startDoc.pages.find((p) => p.id === pageId)!;
      const roots = pg.rootIds.map((id) => startDoc.nodes[id]).filter(Boolean);
      const ox = roots.length ? Math.max(...roots.map((n) => n.x + n.w)) + 120 : 0;
      const oy = roots.length ? Math.min(...roots.map((n) => n.y)) : 0;
      const { summary, steps } = generateSteps(req.prompt, ox, oy);
      const rootId = steps[0].nodes[0].id;
      let done = 0, added = 0;
      for (const step of steps) {
        await sleep(done === 0 ? 900 : 650);
        if (isCancelled()) break;
        let next = docRef.current;
        for (const n of step.nodes) next = addNode(next, pg.id, n);
        docRef.current = next;
        setDoc(next);
        added += step.nodes.length;
        onStep(step.label);
        setAiCursor(step.nodes[step.nodes.length > 1 ? 1 : 0].id);
        if (done === 0) {
          setAiBuilding(rootId);
          const fr = step.nodes[0];
          const el = canvasWrap.current;
          const cw = el?.clientWidth ?? 800, ch = el?.clientHeight ?? 600;
          const zoom = Math.min(1, (ch - 140) / fr.h, (cw - 120) / fr.w);
          setView({ zoom, x: (cw - fr.w * zoom) / 2 - fr.x * zoom, y: 60 - fr.y * zoom });
        }
        done++;
      }
      await sleep(400);
      setAiCursor(null);
      setAiBuilding(null);
      if (done > 0) { past.current.push(startDoc); future.current = []; }
      const credit = done > 0 ? creditFor(req.model, stepCredit(steps.slice(0, done))) : 0;
      if (credit) setCreditBalance((b) => b - credit);
      const stopped = done < steps.length;
      return {
        summary: stopped ? (done ? `${done}단계까지 만들고 중단했어요. 그린 내용은 그대로 남겨 뒀어요.` : "시작 전에 중단했어요.") : summary,
        credit, stepsDone: done, stopped, addedCount: added, createdRootId: done > 0 ? rootId : undefined,
        target: done > 0 ? { id: rootId, label: steps[0].nodes[0].name, meta: `${steps[0].nodes[0].w}×${steps[0].nodes[0].h} · 요소 ${added}개` } : undefined,
      };
    },
    jumpTo: (t) => {
      setPageId(t.pageId);
      const d = docRef.current;
      const base = t.frameId && d.nodes[t.frameId] ? absPos(d, t.frameId) : { x: 0, y: 0 };
      const el = canvasWrap.current;
      const cw = el?.clientWidth ?? 800, ch = el?.clientHeight ?? 600;
      setView((v) => ({ ...v, x: cw / 2 - (base.x + t.x) * v.zoom, y: ch / 2 - (base.y + t.y) * v.zoom }));
      setDraft(null);
      setOpenThreadId(t.id);
      setThreads((all) => all.map((x) => (x.id === t.id ? { ...x, readAt: Date.now(), forcedUnread: false } : x)));
    },
    threadView: (t) => ({ actions: threadActions(t), members, anchorLabel: anchorLabel(t) }),
    attachSelection: () => {
      const sel = selectedRef.current;
      const n = sel ? docRef.current.nodes[sel] : null;
      return n ? { id: `sel-${n.id}`, name: `${n.name}.png`, size: Math.round(n.w * n.h * 0.6), kind: "selection" } : null;
    },
    showResult: (r) => {
      const tid = r.target?.id ?? r.createdRootId;
      const n = tid ? docRef.current.nodes[tid] : null;
      if (!n) { showToast("만든 요소를 찾지 못했어요. 이미 지워졌을 수 있어요.", "error"); return; }
      setSelectedId(n.id);
      setToolRaw("move");
      fitTo(n.x, n.y, n.x + n.w, n.y + n.h, 1);
    },
    undoResult: (r) => {
      const id = r.createdRootId;
      if (!id || !docRef.current.nodes[id]) return;
      detachThreads(docRef.current, id);
      commit(deleteNode(docRef.current, id));
      if (selectedRef.current === id) setSelectedId(null);
      showToast("AI가 만든 화면을 지웠어요. ⌘Z로 다시 살릴 수 있어요.");
    },
    clearSelection: () => setSelectedId(null),
  };
  const apiRef = useRef(api);
  apiRef.current = api;
  // 셸에는 항상 최신 함수를 부르는 얇은 래퍼를 한 번만 넘긴다
  const stableApi = useMemo<FileApi>(() => ({
    runAi: (...a) => apiRef.current.runAi(...a), planAi: (r) => apiRef.current.planAi(r), jumpTo: (t) => apiRef.current.jumpTo(t),
    threadView: (t) => {
      const v = apiRef.current.threadView(t);
      // 동작은 누르는 순간의 최신 상태로(되돌리기 스냅숏이 한 박자 늦지 않게)
      const keys = Object.keys(v.actions) as (keyof ThreadActions)[];
      const actions = Object.fromEntries(keys.map((k) => [k, (...a: unknown[]) => (apiRef.current.threadView(t).actions[k] as (...x: unknown[]) => void)(...a)])) as unknown as ThreadActions;
      return { ...v, actions };
    },
    attachSelection: () => apiRef.current.attachSelection(), showResult: (r) => apiRef.current.showResult(r), undoResult: (r) => apiRef.current.undoResult(r),
    clearSelection: () => apiRef.current.clearSelection(),
  }), []);
  useEffect(() => { registerApi(stableApi); }, [registerApi, stableApi]);

  const patchSelected = (patch: Partial<DNode>) => selectedId && commit(updateNode(docRef.current, selectedId, patch));

  // ── 메인 메뉴 동작 ──
  /** 선택한 요소를 자식까지 통째로 복제해 16px 옆에 둔다(⌘D) */
  function duplicateSelected() {
    const d = docRef.current;
    const src = selectedId ? d.nodes[selectedId] : null;
    if (!src) return;
    let next = d;
    let firstId = "";
    const clone = (id: string, parentId: string | null, top: boolean) => {
      const n = d.nodes[id];
      const copy: DNode = { ...n, id: uid(), parentId, children: [], x: top ? n.x + 16 : n.x, y: top ? n.y + 16 : n.y, name: top ? `${n.name} 사본` : n.name };
      if (top) firstId = copy.id;
      next = addNode(next, page.id, copy);
      n.children.forEach((c) => clone(c, copy.id, false));
    };
    clone(src.id, src.parentId, true);
    commit(next);
    setSelectedId(firstId);
  }
  /** 같은 부모 안에서 맨 앞/맨 뒤로 */
  function reorder(where: "front" | "back") {
    const d = docRef.current;
    const n = selectedId ? d.nodes[selectedId] : null;
    if (!n) return;
    const move = (list: string[]) => { const rest = list.filter((x) => x !== n.id); return where === "front" ? [...rest, n.id] : [n.id, ...rest]; };
    if (n.parentId) commit(updateNode(d, n.parentId, { children: move(d.nodes[n.parentId].children) }));
    else commit({ ...d, pages: d.pages.map((pg) => (pg.id === page.id ? { ...pg, rootIds: move(pg.rootIds) } : pg)) });
  }
  /** 부모(프레임) 기준 정렬 — 최상위 요소는 기준이 없어 비활성 */
  const parentOf = selected?.parentId ? doc.nodes[selected.parentId] : null;
  function alignInParent(dir: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
    if (!selected || !parentOf) return;
    const pos = { left: { x: 0 }, hcenter: { x: Math.round((parentOf.w - selected.w) / 2) }, right: { x: parentOf.w - selected.w }, top: { y: 0 }, vcenter: { y: Math.round((parentOf.h - selected.h) / 2) }, bottom: { y: parentOf.h - selected.h } }[dir];
    patchSelected(pos);
  }
  const openImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("이미지나 .svg 파일만 열 수 있어요.", "error"); return; }
    const r = new FileReader();
    r.onload = () => { const url = String(r.result); const img = new Image(); img.onload = () => shell.openImage(file.name.replace(/\.[^.]+$/, ""), url, img.naturalWidth || 800, img.naturalHeight || 600); img.src = url; };
    r.readAsDataURL(file);
  };
  const hasSel = !!selected;
  const isText = selected?.type === "text";
  const soon = (label: string, shortcut?: string): MenuItem => ({ label, shortcut, soon: true });
  const menuGroups: MenuGroup[] = [
    { label: "파일", items: [
      { label: "새 디자인 파일", run: shell.newFile },
      { label: "이미지 열기…", run: () => imageRef.current?.click() },
      { label: "파일 복제", run: shell.duplicateFile },
      soon("PNG로 내보내기", "⇧⌘E"),
      { label: "파일 닫기", shortcut: "⌘W", run: shell.closeFile },
    ] },
    { label: "편집", items: [
      { label: "실행 취소", shortcut: "⌘Z", run: undo, disabled: past.current.length === 0 },
      { label: "다시 실행", shortcut: "⇧⌘Z", run: redo, disabled: future.current.length === 0 },
      { label: "복제", shortcut: "⌘D", run: duplicateSelected, disabled: !hasSel },
      { label: "삭제", shortcut: "⌫", run: () => { if (!selectedId) return; detachThreads(docRef.current, selectedId); commit(deleteNode(docRef.current, selectedId)); setSelectedId(null); }, disabled: !hasSel },
      soon("모두 선택", "⌘A"),
    ] },
    { label: "보기", items: [
      { label: "확대", shortcut: "⌘+", run: () => zoomBy("in") },
      { label: "축소", shortcut: "⌘−", run: () => zoomBy("out") },
      { label: "화면에 맞추기", shortcut: "⇧1", run: () => zoomBy("fit") },
      { label: "100%로 보기", shortcut: "⌘0", run: () => zoomBy("100") },
      { label: "왼쪽 패널", shortcut: "⌘\\", checked: leftOpen, run: () => setLeftOpen(!leftOpen) },
      { label: "코멘트 보이기", checked: !pinsHidden, run: togglePins },
      { label: "레이아웃 그리드", shortcut: "⇧G", checked: grid, run: () => setGrid((v) => !v) },
      { label: "개발 모드", shortcut: "⇧D", checked: mode === "dev", run: () => setMode((m) => (m === "dev" ? "design" : "dev")) },
      { label: "딸깍 AI", shortcut: "⌘J", run: shell.toggleAi },
    ] },
    { label: "개체", items: [
      { label: "맨 앞으로", shortcut: "⌘]", run: () => reorder("front"), disabled: !hasSel },
      { label: "맨 뒤로", shortcut: "⌘[", run: () => reorder("back"), disabled: !hasSel },
      soon("프레임으로 묶기", "⌥⌘G"), soon("잠금", "⇧⌘L"), soon("컴포넌트 만들기", "⌥⌘K"),
    ] },
    { label: "텍스트", items: [
      { label: "굵게", shortcut: "⌘B", run: () => patchSelected({ fontWeight: (selected?.fontWeight ?? 400) >= 700 ? 400 : 700 }), disabled: !isText },
      { label: "왼쪽 정렬", run: () => patchSelected({ align: "left" }), disabled: !isText },
      { label: "가운데 정렬", run: () => patchSelected({ align: "center" }), disabled: !isText },
      { label: "오른쪽 정렬", run: () => patchSelected({ align: "right" }), disabled: !isText },
    ] },
    { label: "배치", items: [
      { label: "왼쪽 맞춤", shortcut: "⌥A", run: () => alignInParent("left"), disabled: !parentOf },
      { label: "가로 가운데 맞춤", shortcut: "⌥H", run: () => alignInParent("hcenter"), disabled: !parentOf },
      { label: "오른쪽 맞춤", shortcut: "⌥D", run: () => alignInParent("right"), disabled: !parentOf },
      { label: "위쪽 맞춤", shortcut: "⌥W", run: () => alignInParent("top"), disabled: !parentOf },
      { label: "세로 가운데 맞춤", shortcut: "⌥V", run: () => alignInParent("vcenter"), disabled: !parentOf },
      { label: "아래쪽 맞춤", shortcut: "⌥S", run: () => alignInParent("bottom"), disabled: !parentOf },
    ] },
    { label: "벡터", items: [soon("벡터 펜"), soon("윤곽선으로 만들기", "⌥⌘O"), soon("불리언 합치기")] },
    { label: "플러그인", items: [soon("플러그인 찾아보기"), soon("최근 플러그인")] },
    { label: "환경설정", items: [soon("눈금자 보기", "⇧R"), soon("픽셀 격자에 맞추기")] },
    { label: "라이브러리", items: [soon("팀 라이브러리 열기", "⌥3"), soon("내 컴포넌트 게시")] },
    { label: "도움말", items: [
      { label: "단축키 보기", shortcut: "⌃⇧?", run: () => setHelpOpen(true) },
      { label: "딸깍 UI 디자인 안내", run: () => showToast("홈 탭의 '시작하기' 안내를 참고해 주세요.") },
    ] },
  ];

  return (
    <div className="flex-1 min-w-0 min-h-0 flex bg-white" style={{ display: active ? "flex" : "none" }}>
      {/* 왼쪽 패널 — 맨 위 [메인 메뉴] [파일 | 에셋 | 변수] [패널 숨기기]. v2의 별도 레일 단을 합쳤다(가로 단계 줄이기) */}
      {leftOpen && (
        <aside className="relative shrink-0 flex flex-col min-h-0" style={{ ...f, width: layersPanel.width, borderRight: BORDER }} aria-label="파일 패널">
          <PanelResizeHandle side="right" panel={layersPanel} label="레이어 패널 너비 조절" />
          <div className="relative flex items-center gap-1 px-1.5 h-11 shrink-0" style={{ borderBottom: BORDER }}>
            <MenuButton open={menu !== null} onClick={() => setMenu(menu ? null : "menu")} />
            <div className="flex items-center gap-0.5 ml-0.5" role="tablist" aria-label="왼쪽 패널">
              {/* 2026-11-19: "파일" → "레이어"(탭 줄 [▦ 파일 목록]과 이름이 겹쳤다. 이 칸은 페이지·레이어 목록이라 이름이 내용과 맞다) */}
              {([["file", "레이어"], ["assets", "에셋"], ["vars", "변수"]] as const).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={rail === k} onClick={() => setRail(k)} className="rounded-md px-2 h-7 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.caption, fontWeight: rail === k ? 700 : 500, color: rail === k ? "#111827" : "#6b7280", background: rail === k ? "#f3f4f6" : "transparent" }}>{l}</button>
              ))}
            </div>
            <IconTooltip label="왼쪽 패널 숨기기 (⌘\)"><button type="button" aria-label="왼쪽 패널 숨기기" onClick={() => setLeftOpen(false)} className="ml-auto size-7 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
              <PanelLeft size={14} color="#6b7280" />
            </button></IconTooltip>
            {menu && <MainMenu groups={menuGroups} focusSearch={menu === "search"} onClose={() => setMenu(null)} />}
          </div>
          {rail === "file" ? (
            <>
              <div className="px-2 py-2" style={{ borderBottom: BORDER }}>
                <div className="flex items-center justify-between px-1 h-7">
                  <span style={{ fontSize: editorType.caption, fontWeight: 600, color: "#111827" }}>페이지</span>
                  <IconTooltip label="페이지 추가"><button
                    type="button" aria-label="페이지 추가" className="size-6 flex items-center justify-center rounded hover:bg-black/[0.05]"
                    onClick={() => {
                      const id = uid("p");
                      const d = docRef.current;
                      commit({ ...d, pages: [...d.pages, { id, name: `Page ${d.pages.length + 1}`, bg: "#F5F5F5", rootIds: [] }] });
                      setPageId(id); setSelectedId(null);
                    }}
                  >
                    <Plus size={13} color="#6b7280" />
                  </button></IconTooltip>
                </div>
                {doc.pages.map((pg) => (
                  <button
                    key={pg.id} type="button"
                    onClick={() => { setPageId(pg.id); setSelectedId(null); setDraft(null); setOpenThreadId(null); }}
                    className="w-full text-left rounded-md px-2 h-7 truncate"
                    style={{ fontSize: editorType.caption, fontWeight: pg.id === page.id ? 600 : 400, color: "#111827", background: pg.id === page.id ? "#f3f4f6" : "transparent" }}
                  >
                    {pg.name}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0 flex flex-col px-2 py-2">
                <div className="flex items-center justify-between px-1 h-7 shrink-0">
                  <span style={{ fontSize: editorType.caption, fontWeight: 600, color: "#111827" }}>레이어</span>
                  <Search size={12} color="#6b7280" />
                </div>
                {page.rootIds.length === 0 ? (
                  <p style={{ fontSize: editorType.caption, color: "#6b7280", padding: "10px 4px", lineHeight: "17px", wordBreak: "keep-all" }}>화면(F)이나 도형(R)을 추가해 시작해 보세요</p>
                ) : (
                  <div className="flex-1 overflow-y-auto ui-scroll" role="tree" aria-label="레이어">
                    {[...page.rootIds].reverse().map((id) => (
                      <LayerRow
                        key={id} doc={doc} id={id} depth={0} selectedId={selectedId} collapsed={collapsed}
                        onToggle={(nid) => setCollapsed((s2) => { const n = new Set(s2); if (n.has(nid)) n.delete(nid); else n.add(nid); return n; })}
                        onSelect={(nid) => { setSelectedId(nid); setToolRaw("move"); }}
                        onHover={setHoverId}
                        onRename={(nid, name) => commit(updateNode(docRef.current, nid, { name }))}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p style={{ fontSize: editorType.caption, color: "#6b7280", padding: 14, lineHeight: "17px", wordBreak: "keep-all" }}>
              {rail === "assets" ? "컴포넌트를 만들면 여기에 모여요. 에셋 라이브러리는 준비 중이에요." : "색이나 간격 같은 변수를 모아 관리하는 기능은 준비 중이에요."}
            </p>
          )}
        </aside>
      )}
      <input ref={placeRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => {
        // 이미지 넣기(Figma Place image): 지금 페이지에 이미지 채우기 사각형으로 넣는다(새 파일로 열지 않음)
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        const r = new FileReader();
        r.onload = () => {
          const url = String(r.result); const img = new Image();
          img.onload = () => {
            const sc = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
            const node = makeNode("rect", null, 40, 40, Math.round(img.naturalWidth * sc), Math.round(img.naturalHeight * sc), { name: file.name.replace(/\.[^.]+$/, ""), fill: "transparent", imageUrl: url });
            commit(addNode(docRef.current, page.id, node));
            setSelectedId(node.id);
            setTool("move");
          };
          img.src = url;
        };
        r.readAsDataURL(file);
      }} />
      <input ref={imageRef} type="file" accept="image/*,.svg" className="sr-only" tabIndex={-1} onChange={(e) => { openImageFile(e.target.files?.[0]); e.target.value = ""; }} />

      {/* 캔버스 + 하단 툴바 */}
      <div ref={canvasWrap} className="relative flex-1 min-w-0 flex">
        <Canvas
          doc={doc} page={page} view={view} setView={setView} tool={tool} setTool={setTool} grid={grid} board={kind === "board"}
          selectedId={selectedId} setSelectedId={setSelectedId} hoverId={hoverId}
          editingTextId={editingTextId} setEditingTextId={setEditingTextId}
          setDocLive={(d) => { docRef.current = d; setDoc(d); }} commitFrom={commitFrom}
          threads={threads} openThreadId={openThreadId}
          setOpenThreadId={(id) => { setOpenThreadId(id); if (id) setThreads((all) => all.map((x) => (x.id === id ? { ...x, readAt: Date.now(), forcedUnread: false } : x))); }}
          draft={draft} setDraft={setDraft} me={me}
          onCreateThread={createThread} threadActions={threadActions} members={members} anchorLabel={anchorLabel}
          draftFor={(id) => threads.find((x) => x.id === id)?.myDraft ?? ""} onMoveThread={moveThread}
          pinsHidden={pinsHidden} threadInPanel={!!commentPanelOpen} aiCursorNodeId={aiCursor} aiBuildingId={aiBuilding}
          votes={vote?.mine}
          {...(vote && !vote.ended ? {
            voteTargetOf: (id: string) => voteTarget(doc, id, vote.target),
            onVote: (id: string) => {
              const used = Object.values(vote.mine).reduce((a, b) => a + b, 0);
              if (used >= vote.per) { showToast("표를 다 썼어요. 숫자 배지를 누르면 표를 뺄 수 있어요.", "error"); return; }
              setVote({ ...vote, mine: { ...vote.mine, [id]: (vote.mine[id] ?? 0) + 1 } });
            },
          } : {})}
          onUnvote={vote && !vote.ended ? (id) => setVote({ ...vote, mine: { ...vote.mine, [id]: Math.max(0, (vote.mine[id] ?? 0) - 1) } }) : undefined}
        />
        {kind === "board" ? (
          <>
            <BoardToolbar tool={tool} setTool={setTool} />
            <BoardWidgets doc={doc} vote={vote} setVote={setVote} />
          </>
        ) : (
          <Toolbar tool={tool} setTool={setTool} onPlaceImage={() => placeRef.current?.click()} />
        )}
        <HelpButton open={helpOpen} setOpen={setHelpOpen} />
        {!leftOpen && (
          <div className="absolute top-3 left-3 flex items-center gap-0.5 rounded-xl bg-white p-1" style={{ boxShadow: "0px 2px 10px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", zIndex: 9 }} onPointerDown={(e) => e.stopPropagation()}>
            <MenuButton open={menu !== null} onClick={() => setMenu(menu ? null : "menu")} />
            <IconTooltip label="왼쪽 패널 보이기 (⌘\)"><button type="button" aria-label="왼쪽 패널 보이기" onClick={() => setLeftOpen(true)} className="size-7 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
              <PanelLeft size={14} color="#475569" />
            </button></IconTooltip>
            {menu && <MainMenu groups={menuGroups} focusSearch={menu === "search"} onClose={() => setMenu(null)} />}
          </div>
        )}
        {tool === "comment" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1.5 pointer-events-none" style={{ ...f, background: "#111827", color: "#fff", fontSize: editorType.caption, fontWeight: 500, whiteSpace: "nowrap" }}>
            코멘트 모드: 남길 자리를 클릭하세요 · 핀은 끌어서 옮겨요 · Esc로 나가기
          </div>
        )}
      </div>

      {kind !== "board" && <Inspector
        page={page} node={selected} zoom={view.zoom} onZoom={zoomBy} onNode={patchSelected} mode={mode} onMode={setMode}
        onPageBg={(bg) => commit({ ...docRef.current, pages: docRef.current.pages.map((p) => (p.id === page.id ? { ...p, bg } : p)) })}
      />}
    </div>
  );
}

function LayerRow({ doc, id, depth, selectedId, collapsed, onToggle, onSelect, onHover, onRename }: {
  doc: Doc; id: string; depth: number; selectedId: string | null; collapsed: Set<string>;
  onToggle: (id: string) => void; onSelect: (id: string) => void; onHover: (id: string | null) => void; onRename: (id: string, name: string) => void;
}) {
  const n = doc.nodes[id];
  const [editing, setEditing] = useState(false);
  if (!n) return null;
  const hasKids = n.children.length > 0;
  const open = hasKids && !collapsed.has(id);
  const on = selectedId === id;
  const Icon = n.type === "frame" ? Hash : n.type === "text" ? Type : Square;
  return (
    <>
      <div
        role="treeitem" aria-selected={on} aria-expanded={hasKids ? open : undefined}
        onClick={() => onSelect(id)} onDoubleClick={() => setEditing(true)}
        onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)}
        className={`flex items-center gap-1 h-7 rounded-md cursor-default ${on ? "" : "hover:bg-[#f5f5f5]"}`}
        style={{ paddingLeft: 4 + depth * 12, paddingRight: 6, background: on ? EDITOR_ACCENT_SOFT : undefined }}
      >
        <button
          type="button" aria-label={open ? "접기" : "펼치기"} tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); if (hasKids) onToggle(id); }}
          className="size-4 shrink-0 flex items-center justify-center" style={{ visibility: hasKids ? "visible" : "hidden" }}
        >
          {open ? <ChevronDown size={10} color="#6b7280" /> : <ChevronRight size={10} color="#6b7280" />}
        </button>
        <Icon size={11} color={n.type === "frame" ? "#374151" : "#6b7280"} className="shrink-0" />
        {editing ? (
          <input
            autoFocus defaultValue={n.name}
            onBlur={(e) => { onRename(id, e.target.value.trim() || n.name); setEditing(false); }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 min-w-0 outline-none rounded px-0.5" style={{ fontSize: editorType.caption, boxShadow: `inset 0 0 0 1px ${EDITOR_ACCENT}` }}
          />
        ) : (
          <span className="truncate" style={{ fontSize: editorType.caption, color: "#111827", fontWeight: depth === 0 ? 500 : 400 }}>{n.name}</span>
        )}
      </div>
      {open && [...n.children].reverse().map((c) => (
        <LayerRow key={c} doc={doc} id={c} depth={depth + 1} selectedId={selectedId} collapsed={collapsed} onToggle={onToggle} onSelect={onSelect} onHover={onHover} onRename={onRename} />
      ))}
    </>
  );
}

function ToolBtn({ label, shortcut, active, onClick, children, dim, compact }: { label: string; shortcut?: string; active?: boolean; onClick: () => void; children: ReactNode; dim?: boolean; compact?: boolean }) {
  return (
    <IconTooltip label={shortcut ? `${label} (${shortcut})` : label} side="top"><button
      type="button" aria-label={label} aria-pressed={active} onClick={onClick}
      className={`${compact ? "size-8" : "size-10"} rounded-lg flex items-center justify-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#4f7bff] ${active ? "" : "hover:bg-[#f3f4f6]"}`}
      style={{ background: active ? EDITOR_ACCENT : undefined, color: active ? "#fff" : dim ? "#9ca3af" : "#111827" }}
    >
      {children}
    </button></IconTooltip>
  );
}

/**
 * 보드 하단 툴바(2026-11-20, dev 보드 · FigJam 참고). 디자인 툴바와 같은 모양 · 크기 규칙(useCompact · BAR_CLASS).
 *   [선택 V] [손 H] │ [스티커 메모 S] [사각형 R] [타원 O] [연결선 X] [텍스트 T] [펜 P] [구역 ⇧S]
 */
function BoardToolbar({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
  const { barRef, compact } = useCompact();
  const ic = compact ? 16 : 20;
  const items: (ToolItem & { tool: Tool })[] = [
    { tool: "move", label: "선택", shortcut: "V", icon: MousePointer2 },
    { tool: "hand", label: "손", shortcut: "H", icon: Hand },
    { tool: "sticky", label: "스티커 메모", shortcut: "S", icon: StickyNote },
    { tool: "rect", label: "사각형", shortcut: "R", icon: Square },
    { tool: "ellipse", label: "타원", shortcut: "O", icon: Circle },
    { tool: "arrow", label: "연결선", shortcut: "X", icon: Spline },
    { tool: "text", label: "텍스트", shortcut: "T", icon: Type },
    { tool: "pencil", label: "펜", shortcut: "P", icon: Pencil },
    { tool: "section", label: "구역", shortcut: "⇧S", icon: SquareDashed },
  ];
  return (
    <div ref={barRef} className={BAR_CLASS(compact)} style={BAR_STYLE} role="toolbar" aria-label="도구" onPointerDown={(e) => e.stopPropagation()}>
      {items.map((i, n) => (
        <span key={i.tool} className="contents">
          {n === 2 && <Sep />}
          <ToolBtn compact={compact} label={i.label} shortcut={i.shortcut} active={tool === i.tool} onClick={() => setTool(i.tool)}><i.icon size={ic} /></ToolBtn>
        </span>
      ))}
    </div>
  );
}

/** 투표 대상 찾기 — 스티커 메모만: 가장 가까운 "Sticky" 프레임, 모든 개체: 페이지 최상위 개체 */
function voteTarget(doc: Doc, id: string, target: "all" | "sticky"): string | null {
  if (target === "sticky") {
    for (let cur: string | null = id; cur; cur = doc.nodes[cur]?.parentId ?? null) if (doc.nodes[cur]?.type === "frame" && doc.nodes[cur].name.startsWith("Sticky")) return cur;
    return null;
  }
  let r = id;
  while (doc.nodes[r]?.parentId) r = doc.nodes[r].parentId!;
  return doc.nodes[r] ? r : null;
}
/** 투표 결과에 보일 이름 — 스티커 메모는 안의 글자 */
function voteLabel(doc: Doc, id: string): string {
  const n = doc.nodes[id];
  if (!n) return "지운 개체";
  const t = n.children.map((c) => doc.nodes[c]).find((c) => c?.type === "text" && c.text?.trim());
  return t?.text?.trim().split("\n")[0] || n.name;
}

type VoteState = { per: number; target: "all" | "sticky"; mine: Record<string, number>; ended: boolean } | null;
const POP = "absolute right-0 top-12 bg-white rounded-xl p-4 w-[300px]";
const POP_STYLE = { boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" } as const;
const PRIMARY = "h-10 px-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff] hover:brightness-95 disabled:opacity-40";
const CHIP = "h-10 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] hover:bg-[#f8fafc]";

/**
 * 보드 오른쪽 위 위젯(2026-11-20, dev 보드 · FigJam 참고, 모양은 딸깍 규칙: 글자 14/12, 칸 40px, 주요 버튼 = 편집기 초록).
 *  ⏱ 타이머: 1 · 3 · 5 · 10 · 15분 또는 직접 입력 → 시작. 도는 동안 남은 시간 + [멈춤], 끝나면 토스트.
 *  🗳 투표: 1인당 표 수 · 대상(모든 개체 / 스티커 메모) → 투표 시작. 진행 중엔 위쪽 띠(남은 표 · 투표 끝내기), 끝나면 결과 카드.
 */
function BoardWidgets({ doc, vote, setVote }: { doc: Doc; vote: VoteState; setVote: (v: VoteState) => void }) {
  const [open, setOpen] = useState<"timer" | "vote" | null>(null);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [mins, setMins] = useState(5);
  const [per, setPer] = useState(3);
  const [target, setTarget] = useState<"all" | "sticky">("all");
  const [, tick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!endAt) return;
    const t = window.setInterval(() => {
      if (Date.now() >= endAt) { setEndAt(null); showToast("타이머가 끝났어요."); }
      tick((n) => n + 1);
    }, 500);
    return () => window.clearInterval(t);
  }, [endAt]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  const left = endAt ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : 0;
  const mmss = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  const startTimer = (m: number) => { setEndAt(Date.now() + m * 60000); setOpen(null); };
  const voting = !!vote && !vote.ended;
  const used = vote ? Object.values(vote.mine).reduce((a, b) => a + b, 0) : 0;
  const results = vote?.ended ? Object.entries(vote.mine).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]) : [];
  const iconBtn = "size-8 rounded-lg flex items-center justify-center hover:bg-[#f3f4f6] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";
  const field = "h-10 w-20 rounded-lg px-3 outline-none border border-[#e5e7eb] focus:border-[#4f7bff]";

  return (
    <>
      <div ref={ref} className="absolute top-3 right-3 z-10" style={f} onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 rounded-xl bg-white p-1" style={{ boxShadow: "0px 2px 10px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
          {endAt ? (
            <>
              <span className="flex items-center gap-1.5 px-2 h-8" style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}><Timer size={16} color={EDITOR_ACCENT} />{mmss}</span>
              <button type="button" onClick={() => setEndAt(null)} className="rounded-lg px-2 h-8 hover:bg-[#f3f4f6] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.label, color: "#475569" }}>멈춤</button>
            </>
          ) : (
            <IconTooltip label="타이머" side="bottom"><button type="button" aria-label="타이머" aria-expanded={open === "timer"} onClick={() => setOpen(open === "timer" ? null : "timer")} className={iconBtn} style={{ background: open === "timer" ? "#f3f4f6" : undefined }}><Timer size={18} color="#111827" /></button></IconTooltip>
          )}
          <span className="w-px h-5" style={{ background: "#e5e7eb" }} />
          <IconTooltip label="투표" side="bottom"><button type="button" aria-label="투표" aria-expanded={open === "vote"} disabled={voting} onClick={() => setOpen(open === "vote" ? null : "vote")} className={`${iconBtn} disabled:opacity-40`} style={{ background: open === "vote" ? "#f3f4f6" : undefined }}><Vote size={18} color="#111827" /></button></IconTooltip>
        </div>

        {open === "timer" && (
          <div className={POP} style={POP_STYLE} role="dialog" aria-label="타이머">
            <p style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>타이머</p>
            <div className="grid grid-cols-5 gap-2 mt-3">
              {[1, 3, 5, 10, 15].map((m) => (
                <button key={m} type="button" onClick={() => startTimer(m)} className={CHIP} style={{ border: "1px solid #e5e7eb", fontSize: editorType.body, color: "#111827" }}>{m}분</button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <label className="flex items-center gap-2" style={{ fontSize: editorType.body, color: "#64748b" }}>
                직접 입력
                <input type="number" min={1} max={60} value={mins} onChange={(e) => setMins(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") startTimer(mins); }} className={field} style={{ fontSize: editorType.body, color: "#111827" }} aria-label="분" />
                분
              </label>
              <button type="button" onClick={() => startTimer(mins)} className={`${PRIMARY} ml-auto`} style={{ background: EDITOR_ACCENT, color: "#fff", fontSize: editorType.body, fontWeight: 600 }}>시작</button>
            </div>
          </div>
        )}

        {open === "vote" && (
          <div className={POP} style={POP_STYLE} role="dialog" aria-label="투표">
            <p style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>투표</p>
            <p style={{ fontSize: editorType.caption, lineHeight: "18px", color: "#64748b", marginTop: 4, wordBreak: "keep-all" }}>마음에 드는 개체를 눌러 표를 줘요. 많이 받은 순서로 결과를 보여 줘요.</p>
            <label className="flex items-center justify-between mt-4" style={{ fontSize: editorType.body, color: "#111827" }}>
              1인당 표 수
              <input type="number" min={1} max={20} value={per} onChange={(e) => setPer(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} onKeyDown={(e) => e.stopPropagation()} className={field} style={{ fontSize: editorType.body }} />
            </label>
            <div className="mt-3" role="radiogroup" aria-label="투표할 대상">
              <p style={{ fontSize: editorType.caption, fontWeight: 600, color: "#64748b" }}>투표할 대상</p>
              {([["all", "모든 개체"], ["sticky", "스티커 메모만"]] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={target === k} onClick={() => setTarget(k)} className="w-full h-10 flex items-center gap-3 rounded-lg px-1 text-left hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.body, color: "#111827" }}>
                  <span className="size-5 rounded-full shrink-0" style={{ boxShadow: `inset 0 0 0 ${target === k ? 6 : 1.5}px ${target === k ? EDITOR_ACCENT : "#cbd5e1"}` }} />{l}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setVote({ per, target, mine: {}, ended: false }); setOpen(null); }} className={`${PRIMARY} w-full mt-3`} style={{ background: EDITOR_ACCENT, color: "#fff", fontSize: editorType.body, fontWeight: 600 }}>투표 시작</button>
          </div>
        )}

        {vote?.ended && (
          <div className={POP} style={POP_STYLE} role="dialog" aria-label="투표 결과">
            <p style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>투표 결과</p>
            {results.length === 0 ? (
              <p style={{ fontSize: editorType.body, color: "#64748b", marginTop: 8 }}>아무도 투표하지 않았어요.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2">
                {results.map(([id, n], i) => (
                  <li key={id} className="flex items-center gap-3">
                    <span className="size-6 shrink-0 rounded-full flex items-center justify-center" style={{ background: i === 0 ? EDITOR_ACCENT : "#f1f5f9", color: i === 0 ? "#fff" : "#475569", fontSize: editorType.caption, fontWeight: 700 }}>{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate" style={{ fontSize: editorType.body, color: "#111827" }}>{voteLabel(doc, id)}</span>
                    <span style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>{n}표</span>
                  </li>
                ))}
              </ol>
            )}
            <button type="button" onClick={() => setVote(null)} className="w-full h-10 mt-4 rounded-lg outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: "1px solid #e5e7eb", fontSize: editorType.body, fontWeight: 600, color: "#111827" }}>결과 지우기</button>
          </div>
        )}
      </div>

      {voting && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 rounded-full pl-4 pr-1.5 py-1.5" style={{ ...f, background: "#111827", color: "#fff", whiteSpace: "nowrap" }} onPointerDown={(e) => e.stopPropagation()}>
          <span style={{ fontSize: editorType.body, fontWeight: 600 }}>투표 중</span>
          <span style={{ fontSize: editorType.body, color: "#cbd5e1" }}>남은 표 {vote!.per - used}개 · {vote!.target === "sticky" ? "스티커 메모" : "개체"}를 눌러 투표해요</span>
          <button type="button" onClick={() => setVote({ ...vote!, ended: true })} className="h-8 px-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ background: "#fff", color: "#111827", fontSize: editorType.label, fontWeight: 600 }}>투표 끝내기</button>
        </div>
      )}
    </>
  );
}

/**
 * 하단 툴바(2026-11-20 딸깍넷에 맞춰 다시 정리, 사용자 "피그마를 너무 따라한 듯"). docs/ui-design-editor.md "하단 툴바 정리".
 *   [선택 V] [손 H] │ [화면 F] [도형▾ 사각형 · 타원 · 선 · 화살표] [텍스트 T] [펜 P] [이미지]
 * 뺀 것: 준비 중 도구(크기 조절 · 슬라이스 · 다각형 · 별 · 벡터 펜), ⚡ 작업(메뉴 ☰ 검색 ⌘K와 같음), 모드 스위치(디자인 · 프로토타입은 오른쪽 패널 탭, 그리드 · 개발 모드는 메뉴 ☰ › 보기).
 * 섹션은 보드의 "구역"으로. 코멘트는 상단 💬(⌘⌥M). 크기 규칙은 그대로(40px · 20px, 좁으면 32px · 16px). 보드 툴바와 같은 모양.
 */
type ToolItem = { tool?: Tool; label: string; shortcut?: string; icon: LucideIcon; run?: () => void };
const SHAPES: ToolItem[] = [
  { tool: "rect", label: "사각형", shortcut: "R", icon: Square }, { tool: "ellipse", label: "타원", shortcut: "O", icon: Circle },
  { tool: "line", label: "선", shortcut: "L", icon: Minus }, { tool: "arrow", label: "화살표", shortcut: "⇧L", icon: MoveUpRight },
];
function useCompact() {
  const barRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const host = barRef.current?.parentElement;
    if (!host) return;
    const ro = new ResizeObserver(() => setCompact(host.clientWidth < 640));
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  return { barRef, compact };
}
const BAR_CLASS = (compact: boolean) => `absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center rounded-2xl bg-white ${compact ? "gap-0.5 p-1" : "gap-1 p-2"}`;
const BAR_STYLE = { boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" } as const;
const Sep = () => <span className="w-px h-6 mx-1 shrink-0" style={{ background: "#e5e7eb" }} />;

function Toolbar({ tool, setTool, onPlaceImage }: { tool: Tool; setTool: (t: Tool) => void; onPlaceImage: () => void }) {
  const { barRef, compact } = useCompact();
  const ic = compact ? 16 : 20;
  const [shape, setShape] = useState<Tool>("rect");
  useEffect(() => { if (SHAPES.some((x) => x.tool === tool)) setShape(tool); }, [tool]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest("[data-tool-menu]")) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const cur = SHAPES.find((x) => x.tool === shape) ?? SHAPES[0];
  const btn = (i: ToolItem) => <ToolBtn key={i.label} compact={compact} label={i.label} shortcut={i.shortcut} active={!!i.tool && tool === i.tool} onClick={() => (i.run ? i.run() : i.tool && setTool(i.tool))}><i.icon size={ic} /></ToolBtn>;
  return (
    <div ref={barRef} className={BAR_CLASS(compact)} style={BAR_STYLE} role="toolbar" aria-label="도구" onPointerDown={(e) => e.stopPropagation()}>
      {btn({ tool: "move", label: "선택", shortcut: "V", icon: MousePointer2 })}
      {btn({ tool: "hand", label: "손", shortcut: "H", icon: Hand })}
      <Sep />
      {btn({ tool: "frame", label: "화면", shortcut: "F", icon: Frame })}
      <div className="relative flex items-center" data-tool-menu>
        <ToolBtn compact={compact} label={cur.label} shortcut={cur.shortcut} active={SHAPES.some((x) => x.tool === tool)} onClick={() => setTool(shape)}><cur.icon size={ic} /></ToolBtn>
        <IconTooltip label="도형 더 보기" side="top"><button type="button" aria-label="도형 더 보기" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`w-5 ${compact ? "h-8" : "h-10"} flex items-center justify-center rounded-md hover:bg-[#f3f4f6] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]`}>
          <ChevronDown size={14} color="#6b7280" />
        </button></IconTooltip>
        {open && (
          <div className="absolute bottom-14 left-0 z-30 bg-white rounded-xl py-2 min-w-[200px]" style={{ ...f, ...BAR_STYLE }} role="menu" aria-label="도형">
            {SHAPES.map((i) => (
              <button key={i.label} type="button" role="menuitem" onClick={() => { setOpen(false); if (i.tool) setTool(i.tool); }} className="w-full flex items-center gap-3 px-3 h-10 text-left outline-none hover:bg-[#f3f4f6] focus-visible:bg-[#f3f4f6]" style={{ color: "#111827" }}>
                <i.icon size={18} />
                <span className="flex-1" style={{ fontSize: editorType.body, fontWeight: i.tool === tool ? 700 : 500 }}>{i.label}</span>
                <span style={{ fontSize: editorType.caption, color: "#9ca3af" }}>{i.shortcut}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {btn({ tool: "text", label: "텍스트", shortcut: "T", icon: Type })}
      {btn({ tool: "pencil", label: "펜", shortcut: "P", icon: Pencil })}
      {btn({ label: "이미지 넣기", shortcut: "⇧⌘K", icon: ImageIcon, run: onPlaceImage })}
    </div>
  );
}

const SHORTCUTS = [["V", "선택"], ["H", "손"], ["F", "화면"], ["R", "사각형"], ["O", "타원"], ["L", "선"], ["⇧L", "화살표"], ["T", "텍스트"], ["P", "펜"], ["⇧⌘K", "이미지 넣기"], [COMMENT_SHORTCUT, "코멘트"], ["⌘K", "메뉴 검색"], ["⇧G", "레이아웃 그리드"], ["⇧D", "개발 모드"], ["Space+드래그", "화면 이동"], ["⌘+휠", "확대와 축소"], ["⇧1", "화면에 맞추기"], ["⌘Z", "실행 취소"], ["Delete", "삭제"]] as const;

function HelpButton({ open, setOpen }: { open: boolean; setOpen: Dispatch<SetStateAction<boolean>> }) {
  return (
    <div className="absolute bottom-4 right-4 z-10" onPointerDown={(e) => e.stopPropagation()} style={f}>{/* 2026-11-20 사용자 "오른쪽 아래에 붙여 줘": 캔버스 오른쪽 아래 구석(16px). 툴바 줄 위로 띄워 두던 것을 내렸다 */}
      {open && (
        <div className="absolute bottom-10 right-0 bg-white rounded-xl p-3" style={{ width: 210, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: editorType.caption, fontWeight: 700, color: "#111827", marginBottom: 6 }}>단축키</p>
          {SHORTCUTS.map(([k, l]) => <div key={k} className="flex justify-between py-0.5" style={{ fontSize: editorType.caption }}><span style={{ color: "#374151" }}>{l}</span><span style={{ color: "#6b7280" }}>{k}</span></div>)}
        </div>
      )}
      <IconTooltip label="단축키 도움말" side="left"><button type="button" aria-label="단축키 도움말" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="size-7 rounded-full bg-white flex items-center justify-center" style={{ border: "1px solid #e5e7eb", boxShadow: "0px 1px 3px rgba(0,0,0,0.05)" }}>
        <HelpCircle size={14} color="#374151" />
      </button></IconTooltip>
    </div>
  );
}

/** 메인 메뉴 버튼 — 열리면 어두운 메뉴(MainMenu: 파일·편집·보기…). 아이콘은 가장 흔한 ☰(2026-11-19: @ 모양은 메인 메뉴인지 알아보기 어렵다는 피드백) */
function MenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <IconTooltip label="메인 메뉴: 파일·편집·보기 (⌘K로 검색)"><button
      type="button" aria-label="메인 메뉴" aria-haspopup="menu" aria-expanded={open} onClick={onClick}
      className="size-8 shrink-0 flex items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
      style={{ background: open ? "#f3f4f6" : undefined }}
      onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = "#f3f4f6"; }}
      onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = ""; }}
    >
      <Menu size={17} color="#111827" strokeWidth={2} />
    </button></IconTooltip>
  );
}
