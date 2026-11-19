import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ChevronDown, ChevronRight, Circle, Code2, Frame, Hand, Hash, HelpCircle, Image as ImageIcon, Menu, MessageCircle, Minus, MousePointer2, MoveUpRight, PanelLeft, Pencil, PenTool, Plus, Scaling, Search, Slice, Square, SquareDashed, Star, Triangle, Type, Workflow, Zap, type LucideIcon } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import type { AiAttachment, AiRequest, AiResult } from "@/app/components/editor-shell/AiAssistantPanel";
import { DEMO_MEMBERS, DEMO_TEAMMATE, type CommentAuthor } from "@/app/components/editor-shell/comments";
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
  initialDoc, active, me, threads, setThreads, pinsHidden, togglePins, onCommentMode, registerApi, onSelection, onDocChange, shell,
}: {
  initialDoc: Doc;
  active: boolean;
  me: CommentAuthor;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  pinsHidden: boolean;
  togglePins: () => void;
  /** 코멘트 모드에 들어갈 때 — 셸이 도크를 코멘트 탭으로 연다 */
  onCommentMode: () => void;
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
  // 툴바 오른쪽: 모드(디자인·프로토타입·개발) + 레이아웃 그리드, 도형 묶음의 "이미지 넣기"
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
    setToolRaw(t);
    setDraft(null);
    if (t === "comment") { setSelectedId(null); onCommentMode(); }
  };

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
    showToast("스레드를 삭제했어요.", "success", { label: "되돌리기", onClick: () => restoreThreads(before) });
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
      const map: Record<string, Tool> = { v: "move", h: "hand", f: "frame", r: "rect", o: "ellipse", l: "line", t: "text", c: "comment" };
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
          summary: `"${startDoc.nodes[sel].name}"을(를) 다크 모드로 바꿨어요. 강조색은 그대로 뒀어요.`, credit, stepsDone: 2, stopped: false, addedCount: 0,
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
    attachSelection: () => {
      const sel = selectedRef.current;
      const n = sel ? docRef.current.nodes[sel] : null;
      return n ? { id: `sel-${n.id}`, name: `${n.name}.png`, size: Math.round(n.w * n.h * 0.6), kind: "selection" } : null;
    },
    showResult: (r) => {
      const tid = r.target?.id ?? r.createdRootId;
      const n = tid ? docRef.current.nodes[tid] : null;
      if (!n) { showToast("만든 요소를 찾을 수 없어요(지워졌을 수 있어요).", "error"); return; }
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
      { label: "코멘트 보이기", shortcut: "⇧C", checked: !pinsHidden, run: togglePins },
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
    { label: "벡터", items: [soon("펜", "P"), soon("윤곽선으로 만들기", "⌥⌘O"), soon("불리언 합치기")] },
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
                  <p style={{ fontSize: editorType.caption, color: "#6b7280", padding: "10px 4px", lineHeight: "17px", wordBreak: "keep-all" }}>프레임(F) 또는 도형(R)을 추가해 시작하세요</p>
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
              {rail === "assets" ? "컴포넌트를 만들면 여기에 모여요. 에셋 라이브러리는 준비 중이에요." : "색·간격 같은 변수를 모아 관리하는 기능은 준비 중이에요."}
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
          doc={doc} page={page} view={view} setView={setView} tool={tool} setTool={setTool} grid={grid}
          selectedId={selectedId} setSelectedId={setSelectedId} hoverId={hoverId}
          editingTextId={editingTextId} setEditingTextId={setEditingTextId}
          setDocLive={(d) => { docRef.current = d; setDoc(d); }} commitFrom={commitFrom}
          threads={threads} openThreadId={openThreadId}
          setOpenThreadId={(id) => { setOpenThreadId(id); if (id) setThreads((all) => all.map((x) => (x.id === id ? { ...x, readAt: Date.now(), forcedUnread: false } : x))); }}
          draft={draft} setDraft={setDraft} me={me}
          onCreateThread={createThread} threadActions={threadActions} members={members} anchorLabel={anchorLabel}
          draftFor={(id) => threads.find((x) => x.id === id)?.myDraft ?? ""} onMoveThread={moveThread}
          pinsHidden={pinsHidden} aiCursorNodeId={aiCursor} aiBuildingId={aiBuilding}
        />
        <Toolbar
          tool={tool} setTool={setTool}
          onPlaceImage={() => placeRef.current?.click()}
          onActions={() => { setMenu("search"); if (!leftOpen) setLeftOpen(true); }}
          mode={mode} setMode={setMode} grid={grid} setGrid={setGrid}
        />
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

      <Inspector
        page={page} node={selected} zoom={view.zoom} onZoom={zoomBy} onNode={patchSelected} mode={mode} onMode={setMode}
        onPageBg={(bg) => commit({ ...docRef.current, pages: docRef.current.pages.map((p) => (p.id === page.id ? { ...p, bg } : p)) })}
      />
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
 * 하단 툴바(2026-11-19 Figma 툴바 기능으로 확장, 모양은 그대로) — docs/ui-design-editor.md "1-7".
 * 크기(2026-11-19 사용자 "작다"): 도구 버튼 40px·아이콘 20px, 모드 버튼 36px·아이콘 18px, 묶음 메뉴 줄 40px(편집기 상단 버튼과 같은 결).
 *   [이동▾ 이동·손·크기 조절] [영역▾ 프레임·섹션·슬라이스] [도형▾ 사각형·선·화살표·타원·다각형·별·이미지] [만들기▾ 펜·연필] [텍스트] [코멘트] [⚡ 작업]
 *   │ [디자인 · 레이아웃 그리드 · 프로토타입 · 개발 모드]
 * 묶음 버튼은 마지막으로 고른 도구를 보여 주고, ▾로 묶음 안 도구를 고른다. 아직 없는 도구는 흐리게 "준비 중"(누르면 아무것도 바뀌지 않음).
 */
type ToolItem = { tool?: Tool; label: string; shortcut?: string; icon: LucideIcon; soon?: boolean; run?: () => void };
function Toolbar({ tool, setTool, onPlaceImage, onActions, mode, setMode, grid, setGrid }: {
  tool: Tool; setTool: (t: Tool) => void; onPlaceImage: () => void; onActions: () => void;
  mode: InspectorMode; setMode: (m: InspectorMode) => void; grid: boolean; setGrid: (fn: (v: boolean) => boolean) => void;
}) {
  const groups: { id: string; items: ToolItem[] }[] = [
    { id: "move", items: [{ tool: "move", label: "이동", shortcut: "V", icon: MousePointer2 }, { tool: "hand", label: "손 도구", shortcut: "H", icon: Hand }, { label: "크기 조절", shortcut: "K", icon: Scaling, soon: true }] },
    { id: "region", items: [{ tool: "frame", label: "프레임", shortcut: "F", icon: Frame }, { tool: "section", label: "섹션", shortcut: "⇧S", icon: SquareDashed }, { label: "슬라이스", shortcut: "S", icon: Slice, soon: true }] },
    { id: "shape", items: [
      { tool: "rect", label: "사각형", shortcut: "R", icon: Square }, { tool: "line", label: "선", shortcut: "L", icon: Minus }, { tool: "arrow", label: "화살표", shortcut: "⇧L", icon: MoveUpRight },
      { tool: "ellipse", label: "타원", shortcut: "O", icon: Circle }, { label: "다각형", icon: Triangle, soon: true }, { label: "별", icon: Star, soon: true },
      { label: "이미지 넣기", shortcut: "⇧⌘K", icon: ImageIcon, run: onPlaceImage },
    ] },
    { id: "create", items: [{ label: "펜", shortcut: "P", icon: PenTool, soon: true }, { tool: "pencil", label: "연필", shortcut: "⇧P", icon: Pencil }] },
  ];
  // 묶음마다 마지막으로 고른 도구(단축키로 바꿔도 따라간다)
  const [last, setLast] = useState<Record<string, Tool>>({ move: "move", region: "frame", shape: "rect", create: "pencil" });
  useEffect(() => { const g = groups.find((x) => x.items.some((i) => i.tool === tool)); if (g && last[g.id] !== tool) setLast((l) => ({ ...l, [g.id]: tool })); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tool]);
  const [open, setOpen] = useState<string | null>(null);
  // 캔버스가 좁으면(양옆 패널 + AI 패널을 다 열었을 때) 32px·16px으로 줄여 툴바가 패널 밑으로 들어가지 않게 한다(2026-11-19)
  const barRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const host = barRef.current?.parentElement;
    if (!host) return;
    const ro = new ResizeObserver(() => setCompact(host.clientWidth < 640));
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  const ic = compact ? 16 : 20;
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest("[data-tool-menu]")) setOpen(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const modes: { id: InspectorMode | "grid"; label: string; shortcut?: string; icon: LucideIcon }[] = [
    { id: "design", label: "디자인", icon: Pencil }, { id: "grid", label: "레이아웃 그리드", shortcut: "⇧G", icon: Hash },
    { id: "prototype", label: "프로토타입", icon: Workflow }, { id: "dev", label: "개발 모드", shortcut: "⇧D", icon: Code2 },
  ];
  return (
    <div
      ref={barRef}
      className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center rounded-2xl bg-white ${compact ? "gap-0.5 p-1" : "gap-1 p-2"}`}
      style={{ boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }}
      role="toolbar" aria-label="도구" onPointerDown={(e) => e.stopPropagation()}
    >
      {groups.map((g) => {
        const cur = g.items.find((i) => i.tool === last[g.id]) ?? g.items[0];
        const active = g.items.some((i) => i.tool && i.tool === tool);
        return (
          <div key={g.id} className="relative flex items-center" data-tool-menu>
            <ToolBtn compact={compact} label={cur.label} shortcut={cur.shortcut} active={active} onClick={() => cur.tool && setTool(cur.tool)}><cur.icon size={ic} /></ToolBtn>
            <IconTooltip label="도구 더 보기" side="top"><button type="button" aria-label={`${cur.label} 묶음 도구 더 보기`} aria-expanded={open === g.id} onClick={() => setOpen(open === g.id ? null : g.id)} className={`w-5 ${compact ? "h-8" : "h-10"} flex items-center justify-center rounded-md hover:bg-[#f3f4f6] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]`}>
              <ChevronDown size={14} color="#6b7280" />
            </button></IconTooltip>
            {open === g.id && (
              <div className="absolute bottom-14 left-0 z-30 bg-white rounded-xl py-2 min-w-[220px]" style={{ ...f, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="menu" aria-label="도구">
                {g.items.map((i) => (
                  <button key={i.label} type="button" role="menuitem" aria-disabled={i.soon || undefined}
                    onClick={() => { if (i.soon) return; setOpen(null); if (i.run) i.run(); else if (i.tool) setTool(i.tool); }}
                    className={`w-full flex items-center gap-3 px-3 h-10 text-left outline-none ${i.soon ? "cursor-default" : "hover:bg-[#f3f4f6] focus-visible:bg-[#f3f4f6]"}`}
                    style={{ color: i.soon ? "#9ca3af" : "#111827" }}
                  >
                    <i.icon size={18} />
                    <span className="flex-1" style={{ fontSize: editorType.body, fontWeight: i.tool === tool ? 700 : 500 }}>{i.label}</span>
                    {i.soon ? <span className="rounded px-1" style={{ fontSize: editorType.caption, fontWeight: 700, color: "#64748b", background: "#f1f5f9" }}>준비 중</span> : i.shortcut && <span style={{ fontSize: editorType.caption, color: "#9ca3af" }}>{i.shortcut}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <ToolBtn compact={compact} label="텍스트" shortcut="T" active={tool === "text"} onClick={() => setTool("text")}><Type size={ic} /></ToolBtn>
      <ToolBtn label="코멘트 남기기" shortcut="C" active={tool === "comment"} onClick={() => setTool(tool === "comment" ? "move" : "comment")} compact={compact}><MessageCircle size={ic} /></ToolBtn>
      <ToolBtn compact={compact} label="작업: 명령·도구 찾기" shortcut="⌘K" onClick={onActions}><Zap size={ic} /></ToolBtn>
      <span className="w-px h-6 mx-1" style={{ background: "#e5e7eb" }} />
      <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "#f3f4f6" }} role="group" aria-label="모드">
        {modes.map((m) => {
          const on = m.id === "grid" ? grid : mode === m.id;
          return (
            <IconTooltip key={m.id} label={m.shortcut ? `${m.label} (${m.shortcut})` : m.label} side="top"><button
              type="button" aria-label={m.label} aria-pressed={on}
              onClick={() => (m.id === "grid" ? setGrid((v) => !v) : setMode(m.id))}
              className={`${compact ? "size-7" : "size-9"} rounded-md flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]`}
              style={{ background: on ? "#fff" : undefined, boxShadow: on ? "0 1px 2px rgba(0,0,0,0.08)" : undefined, color: on ? EDITOR_ACCENT : "#6b7280" }}
            >
              <m.icon size={compact ? 14 : 18} />
            </button></IconTooltip>
          );
        })}
      </div>
    </div>
  );
}

const SHORTCUTS = [["V", "이동"], ["H", "손 도구"], ["F", "프레임"], ["⇧S", "섹션"], ["R", "사각형"], ["O", "타원"], ["L", "선"], ["⇧L", "화살표"], ["⇧P", "연필"], ["⇧⌘K", "이미지 넣기"], ["T", "텍스트"], ["C", "코멘트"], ["⌘K", "작업(명령 찾기)"], ["⇧G", "레이아웃 그리드"], ["⇧D", "개발 모드"], ["⇧C", "코멘트 숨기기/보이기"], ["Space+드래그", "화면 이동"], ["⌘+휠", "확대·축소"], ["⇧1", "화면에 맞추기"], ["⌘Z", "실행 취소"], ["Delete", "삭제"]] as const;

function HelpButton({ open, setOpen }: { open: boolean; setOpen: Dispatch<SetStateAction<boolean>> }) {
  return (
    <div className="absolute bottom-20 right-4" onPointerDown={(e) => e.stopPropagation()} style={f}>{/* 툴바를 키운 뒤(2026-11-19) 좁은 캔버스에서 툴바 끝과 겹쳐 툴바 줄 위로 올렸다 */}
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
