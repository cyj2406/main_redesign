import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { f, editorType } from "@/app/styleTokens";

import { MousePointer2 } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import { isUnread, relTime } from "@/app/components/editor-shell/comments";
import { color } from "@/app/styleTokens";

import { ClusterPin, CommentPin, DraftPopover, ThreadPopover, type Member, type ThreadActions } from "./Comments";
import {
  type Thread,
  EDITOR_ACCENT, absPos, addNode, deleteNode, makeNode, topFrameOf, updateNode,
  type CommentAuthor, type Doc, type DNode, type Page,
} from "./model";

/** 하단 툴바 도구(2026-11-19 Figma 툴바처럼 확장): 이동 묶음(이동·손) · 영역(프레임·섹션) · 도형(사각형·타원·선·화살표) · 연필 · 텍스트 · 코멘트 */
/** sticky = 보드(피그잼형)의 스티커 메모 */
export type Tool = "move" | "hand" | "frame" | "section" | "rect" | "ellipse" | "line" | "arrow" | "pencil" | "text" | "comment" | "sticky";
export interface View { x: number; y: number; zoom: number }
export interface Draft { frameId: string | null; x: number; y: number }

interface Props {
  doc: Doc;
  page: Page;
  view: View;
  setView: (v: View | ((v: View) => View)) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  /** 레이아웃 그리드(8px) 보기 — 툴바 오른쪽 # */
  grid?: boolean;
  /** 보드(피그잼형) 파일 — 점 배경(2026-11-20) */
  board?: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  hoverId: string | null;
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  /** 히스토리 없이 바로 반영(드래그 중) */
  setDocLive: (d: Doc) => void;
  /** 이 시점 이전 상태(base)를 실행 취소 기록에 남기고 반영 */
  commitFrom: (base: Doc, next: Doc) => void;
  threads: Thread[];
  openThreadId: string | null;
  setOpenThreadId: (id: string | null) => void;
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  me: CommentAuthor;
  onCreateThread: (d: Draft, text: string, images: string[]) => void;
  /** 열린 스레드에 대한 동작 묶음(답글·해결·삭제·수정·반응·읽지 않음·링크·초안) */
  threadActions: (t: Thread) => ThreadActions;
  /** 멘션 후보 */
  members: Member[];
  /** "Page 1 · 배달앱 모바일 메인" — 스레드가 붙은 곳 */
  anchorLabel: (t: Thread) => string;
  /** 보내지 않은 답글 초안 */
  draftFor: (threadId: string) => string;
  /** 핀 옮기기 — 놓은 자리의 최상위 프레임으로 다시 붙인다 */
  onMoveThread: (threadId: string, frameId: string | null, x: number, y: number) => void;
  /** 캔버스에서 핀 숨김(⇧C). 코멘트 모드에서는 무시하고 보인다 */
  pinsHidden: boolean;
  /** 오른쪽 코멘트 목록이 열려 있어 스레드를 거기서 보여 준다. 이때는 캔버스 팝오버를 띄우지 않는다 */
  threadInPanel?: boolean;
  /** 딸깍 AI 작업 중 — 방금 그린 요소(커서 위치)와 만들고 있는 프레임 */
  aiCursorNodeId: string | null;
  aiBuildingId: string | null;
  /** 보드 투표 세션 중(2026-11-20): 누르면 그 개체에 투표. 대상이 아니면 null을 돌려준다 */
  voteTargetOf?: (nodeId: string) => string | null;
  onVote?: (nodeId: string) => void;
  onUnvote?: (nodeId: string) => void;
  /** 내 표 — 노드 id → 표 수(개체 오른쪽 위 배지) */
  votes?: Record<string, number>;
}

const SNAP_TEXT_EDIT = "ui-text-edit";

/** Figma 선택 규칙 — 처음 클릭은 최상위 프레임의 직접 자식, 이미 그 안을 고르고 있으면 한 단계 더 안쪽 */
function pickCandidate(doc: Doc, deepest: string, selectedId: string | null, deeper = false): string {
  const chain: string[] = [];
  let n: DNode | undefined = doc.nodes[deepest];
  while (n) { chain.unshift(n.id); n = n.parentId ? doc.nodes[n.parentId] : undefined; }
  if (chain.length === 1) return chain[0];
  const selIdx = selectedId ? chain.indexOf(selectedId) : -1;
  if (deeper && selIdx >= 0) return chain[Math.min(selIdx + 1, chain.length - 1)];
  if (selIdx >= 0) return chain[selIdx];
  // 선택된 요소와 형제(같은 부모)인 단계가 있으면 그 단계에서 고른다
  const selParent = selectedId ? doc.nodes[selectedId]?.parentId : null;
  const pIdx = selParent ? chain.indexOf(selParent) : -1;
  if (pIdx >= 0 && pIdx + 1 < chain.length) return chain[pIdx + 1];
  return chain[1];
}

export function Canvas(p: Props) {
  const { doc, page, view, setView, tool } = p;
  const ref = useRef<HTMLDivElement>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [hoverCand, setHoverCand] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 휠 = 이동, ⌘/Ctrl+휠(트랙패드 핀치 포함) = 커서 기준 확대·축소. preventDefault 가 필요해 passive:false 로 직접 건다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        setView((v) => {
          const zoom = Math.min(8, Math.max(0.1, v.zoom * Math.exp(-e.deltaY * 0.01)));
          return { zoom, x: cx - ((cx - v.x) / v.zoom) * zoom, y: cy - ((cy - v.y) / v.zoom) * zoom };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setView]);

  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /INPUT|TEXTAREA/.test(t.tagName));
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !typing(e.target)) { e.preventDefault(); setSpaceDown(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const toWorld = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.zoom, y: (clientY - r.top - view.y) / view.zoom };
  };
  const toScreen = (wx: number, wy: number) => ({ x: view.x + wx * view.zoom, y: view.y + wy * view.zoom });
  const pageOfNodeId = (id: string) => { let r = id; while (doc.nodes[r]?.parentId) r = doc.nodes[r].parentId!; return page.rootIds.includes(r) ? page.id : null; };

  const nodeIdAt = (target: EventTarget | null) => (target as HTMLElement | null)?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId ?? null;

  /** 드래그 공통 — 창 전체에서 움직임을 받는다 */
  const drag = (e: React.PointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void, onEnd?: (moved: boolean) => void) => {
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      onMove(dx, dy, ev);
    };
    // pointerup 이 오지 않는 환경(일부 자동화·드래그 중 창 밖 놓기)에서도 끝나도록 mouseup·pointercancel 도 받는다 — 한 번만 끝낸다
    let ended = false;
    const up = () => {
      if (ended) return;
      ended = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("mouseup", up);
      onEnd?.(moved);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("mouseup", up);
  };

  const startMove = (e: React.PointerEvent, id: string) => {
    const base = doc;
    const n0 = doc.nodes[id];
    let last = base;
    drag(e, (dx, dy) => {
      last = updateNode(base, id, { x: Math.round(n0.x + dx / view.zoom), y: Math.round(n0.y + dy / view.zoom) });
      p.setDocLive(last);
    }, (moved) => { if (moved) p.commitFrom(base, last); });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || spaceDown || (tool === "hand" && e.button === 0)) {
      e.preventDefault();
      setPanning(true);
      const v0 = view;
      drag(e, (dx, dy) => setView({ ...v0, x: v0.x + dx, y: v0.y + dy }), () => setPanning(false));
      return;
    }
    if (e.button !== 0) return;
    // 투표 중: 개체를 누르면 투표(이동·선택은 하지 않는다)
    if (p.onVote && p.voteTargetOf) {
      const h = nodeIdAt(e.target);
      const t = h ? p.voteTargetOf(h) : null;
      if (t) p.onVote(t);
      return;
    }
    if (p.editingTextId) return; // 텍스트 입력 중 바깥 클릭은 blur 가 처리
    if (p.draft && tool !== "comment") p.setDraft(null);
    const hit = nodeIdAt(e.target);
    const w = toWorld(e.clientX, e.clientY);

    if (tool === "comment") {
      const frameId = hit ? topFrameOf(doc, hit) : null;
      if (frameId) { const a = absPos(doc, frameId); p.setDraft({ frameId, x: w.x - a.x, y: w.y - a.y }); }
      else p.setDraft({ frameId: null, x: w.x, y: w.y });
      p.setOpenThreadId(null);
      return;
    }

    p.setOpenThreadId(null);
    if (tool !== "move" && tool !== "hand") {
      // 프레임 위에서 그리면 그 프레임(가장 안쪽 프레임)의 자식이 된다
      let parentId: string | null = null;
      for (let id = hit; id; id = doc.nodes[id]?.parentId ?? null) if (doc.nodes[id]?.type === "frame") { parentId = id; break; }
      const pa = parentId ? absPos(doc, parentId) : { x: 0, y: 0 };
      const lx = Math.round(w.x - pa.x), ly = Math.round(w.y - pa.y);
      const base = doc;
      if (tool === "text") {
        // 뒤따르는 mousedown 기본 동작이 포커스를 body 로 옮겨 방금 연 입력칸을 닫아 버린다 — 막는다
        e.preventDefault();
        const node = makeNode("text", parentId, lx, ly, 60, 22, { autoW: true });
        p.commitFrom(base, addNode(base, page.id, node));
        p.setSelectedId(node.id);
        p.setEditingTextId(node.id);
        p.setTool("move");
        return;
      }
      const countOf = (pred: (n: DNode) => boolean) => Object.values(doc.nodes).filter(pred).length + 1;
      if (tool === "sticky") {
        // 스티커 메모(보드): 누른 자리를 가운데로 180×180 노란 메모 + 안쪽 글자, 바로 글자 입력
        e.preventDefault();
        const note = makeNode("frame", parentId, lx - 90, ly - 90, 180, 180, { name: `Sticky ${countOf((n) => n.name.startsWith("Sticky"))}`, fill: "#FFE58A", radius: 4 });
        const txt = makeNode("text", note.id, 16, 16, 148, 24, { text: "", fontSize: 16, color: "#111827", autoW: false });
        p.commitFrom(base, addNode(addNode(base, page.id, note), page.id, txt));
        p.setSelectedId(txt.id);
        p.setEditingTextId(txt.id);
        p.setTool("move");
        return;
      }
      if (tool === "pencil") {
        // 연필: 지나간 점을 모아 자유 선. 끝나면 점들이 들어가는 상자로 맞춘다
        const pts: [number, number][] = [[0, 0]];
        const node = makeNode("path", parentId, lx, ly, 1, 1, { name: `Pencil ${countOf((n) => n.type === "path")}`, points: pts, vw: 1, vh: 1 });
        let last = addNode(base, page.id, node);
        p.setDocLive(last);
        const fit = () => {
          const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
          const mx = Math.min(...xs), my = Math.min(...ys);
          const bw = Math.max(1, Math.max(...xs) - mx), bh = Math.max(1, Math.max(...ys) - my);
          return updateNode(last, node.id, { x: lx + mx, y: ly + my, w: bw, h: bh, vw: bw, vh: bh, points: pts.map(([qx, qy]) => [qx - mx, qy - my] as [number, number]) });
        };
        drag(e, (dx, dy) => { pts.push([Math.round(dx / view.zoom), Math.round(dy / view.zoom)]); last = fit(); p.setDocLive(last); }, (moved) => {
          if (!moved) { p.setDocLive(base); return; }
          p.commitFrom(base, last);
          p.setSelectedId(node.id);
        });
        return; // 연필은 계속 그릴 수 있게 도구를 유지한다(Figma와 같음)
      }
      if (tool === "line" || tool === "arrow") {
        const node = makeNode("line", parentId, lx, ly, 1, 1, { name: `${tool === "arrow" ? "Arrow" : "Line"} ${countOf((n) => n.type === "line")}`, arrow: tool === "arrow" });
        let last = addNode(base, page.id, node);
        p.setDocLive(last);
        p.setSelectedId(node.id);
        drag(e, (dx, dy) => {
          const ww = Math.round(Math.abs(dx) / view.zoom), hh = Math.round(Math.abs(dy) / view.zoom);
          last = updateNode(last, node.id, { x: dx < 0 ? lx - ww : lx, y: dy < 0 ? ly - hh : ly, w: Math.max(1, ww), h: Math.max(1, hh), flipX: dx < 0, flipY: dy < 0 });
          p.setDocLive(last);
        }, (moved) => {
          if (!moved) last = updateNode(last, node.id, { w: 120, h: 1 });
          p.commitFrom(base, last);
          p.setTool("move");
        });
        return;
      }
      // 상자형: 프레임 · 섹션(테두리 있는 큰 프레임) · 사각형 · 타원
      const type = tool === "section" ? "frame" : tool === "ellipse" ? "ellipse" : tool === "rect" ? "rect" : "frame";
      const extra: Partial<DNode> = tool === "section"
        ? { name: `Section ${countOf((n) => n.name.startsWith("Section"))}`, fill: "#EEF2F7", stroke: "#CBD5E1", radius: 8 }
        : { name: `${{ frame: "Frame", rect: "Rectangle", ellipse: "Ellipse" }[tool as "frame" | "rect" | "ellipse"]} ${countOf((n) => n.type === type)}` };
      const node = makeNode(type, parentId, lx, ly, 1, 1, extra);
      let last = addNode(base, page.id, node);
      p.setDocLive(last);
      p.setSelectedId(node.id);
      drag(e, (dx, dy) => {
        const ww = Math.round(Math.abs(dx) / view.zoom), hh = Math.round(Math.abs(dy) / view.zoom);
        last = updateNode(last, node.id, { x: dx < 0 ? lx - ww : lx, y: dy < 0 ? ly - hh : ly, w: Math.max(1, ww), h: Math.max(1, hh) });
        p.setDocLive(last);
      }, (moved) => {
        if (!moved) last = updateNode(last, node.id, tool === "frame" ? { w: 390, h: 844 } : tool === "section" ? { w: 640, h: 420 } : { w: 100, h: 100 });
        p.commitFrom(base, last);
        p.setTool("move");
      });
      return;
    }

    // 이동 도구
    if (!hit) { p.setSelectedId(null); return; }
    const cand = pickCandidate(doc, hit, p.selectedId);
    p.setSelectedId(cand);
    startMove(e, cand);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== "move") return;
    const hit = nodeIdAt(e.target);
    if (!hit) return;
    const cand = pickCandidate(doc, hit, p.selectedId, true);
    p.setSelectedId(cand);
    if (doc.nodes[cand]?.type === "text") p.setEditingTextId(cand);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (tool !== "move" || e.buttons) { if (hoverCand) setHoverCand(null); return; }
    const hit = nodeIdAt(e.target);
    const c = hit ? pickCandidate(doc, hit, p.selectedId) : null;
    if (c !== hoverCand) setHoverCand(c);
  };

  const commitText = (id: string, el: HTMLElement) => {
    const n = doc.nodes[id];
    if (!n) return;
    const text = el.innerText.replace(/\n$/, "");
    const base = doc;
    if (!text.trim()) {
      // 빈 텍스트는 남기지 않는다(Figma 와 같음)
      p.commitFrom(base, deleteNode(base, id));
      p.setSelectedId(null);
    } else {
      p.commitFrom(base, updateNode(base, id, { text, name: text.slice(0, 24), ...(n.autoW ? { w: el.offsetWidth, h: el.offsetHeight } : { h: Math.max(n.h, el.offsetHeight) }) }));
    }
    p.setEditingTextId(null);
  };

  const box = (id: string) => {
    const n = doc.nodes[id];
    if (!n) return null;
    const a = absPos(doc, id);
    const s = toScreen(a.x, a.y);
    return { x: s.x, y: s.y, w: n.w * view.zoom, h: n.h * view.zoom, n };
  };

  const startResize = (e: React.PointerEvent, corner: "nw" | "ne" | "sw" | "se") => {
    e.stopPropagation();
    const id = p.selectedId!;
    const base = doc;
    const n0 = doc.nodes[id];
    let last = base;
    drag(e, (dx, dy) => {
      const zx = dx / view.zoom, zy = dy / view.zoom;
      let { x, y, w, h } = n0;
      if (corner.includes("e")) w = n0.w + zx; else { w = n0.w - zx; x = n0.x + zx; }
      if (corner.includes("s")) h = n0.h + zy; else { h = n0.h - zy; y = n0.y + zy; }
      last = updateNode(base, id, { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)), autoW: false });
      p.setDocLive(last);
    }, (moved) => { if (moved) p.commitFrom(base, last); });
  };

  const sel = p.selectedId ? box(p.selectedId) : null;
  const hov = [p.hoverId, hoverCand].find((h) => h && h !== p.selectedId);
  const hovBox = hov ? box(hov) : null;
  const cursor = p.onVote ? "pointer" : panning ? "grabbing" : spaceDown || tool === "hand" ? "grab" : tool === "comment" ? COMMENT_CURSOR : tool === "move" ? "default" : tool === "text" ? "text" : "crosshair";

  const threadPos = (t: { frameId: string | null; x: number; y: number }) => {
    if (t.frameId && doc.nodes[t.frameId]) { const a = absPos(doc, t.frameId); return toScreen(a.x + t.x, a.y + t.y); }
    return toScreen(t.x, t.y);
  };
  // 숨김(눈 끔)이면 코멘트 모드여도 핀과 팝오버를 모두 감춘다(문서 편집기와 같은 규칙, 2026-11-27)
  const showPins = !p.pinsHidden;
  const visibleThreads = p.threads.filter((t) => t.pageId === page.id && showPins && (t.id === p.openThreadId || !t.resolved));
  const openThread = (showPins && !p.threadInPanel && p.threads.find((t) => t.id === p.openThreadId)) || null;

  // ── 핀 옮기기 ── 3px 넘게 움직이면 옮기기, 아니면 열기. 남의 핀은 잡기만 되고 안내.
  const [pinDrag, setPinDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const pressPin = (e: React.PointerEvent, t: Thread) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.clientX !== undefined) e.preventDefault(); // 글자 선택·이미지 끌기가 시작되면 옮기기가 끊긴다
    const mine = t.messages[0]?.author.name === p.me.name;
    const start = threadPos(t);
    let warned = false;
    let last = { dx: 0, dy: 0 };
    const isKeyboard = e.clientX === undefined;
    if (isKeyboard) { p.setDraft(null); p.setOpenThreadId(t.id === p.openThreadId ? null : t.id); return; }
    drag(e, (dx, dy) => {
      if (!mine) { if (!warned) { warned = true; showToast("코멘트는 작성자만 옮길 수 있어요."); } return; }
      last = { dx, dy };
      setPinDrag({ id: t.id, x: start.x + dx, y: start.y + dy });
    }, (moved) => {
      setPinDrag(null);
      if (!moved) { p.setDraft(null); p.setOpenThreadId(t.id === p.openThreadId ? null : t.id); return; }
      if (!mine || !ref.current) return; // 드래그 도중 탭을 닫는 등 캔버스가 사라졌으면 무시
      // 놓은 자리(핀 끝점) 아래 요소 → 최상위 프레임에 다시 붙인다. 핀 자신은 건너뛴다
      // 화면에 보이던 핀 끝점(시작 위치 + 움직인 만큼) 그대로 놓는다
      const r = ref.current!.getBoundingClientRect();
      const sx = start.x + last.dx, sy = start.y + last.dy;
      const under = document.elementsFromPoint(r.left + sx + 1, r.top + sy - 1).find((el) => (el as HTMLElement).dataset?.nodeId) as HTMLElement | undefined;
      const w = { x: (sx - view.x) / view.zoom, y: (sy - view.y) / view.zoom };
      const frameId = under ? topFrameOf(doc, under.dataset.nodeId!) : null;
      if (frameId) { const a = absPos(doc, frameId); p.onMoveThread(t.id, frameId, w.x - a.x, w.y - a.y); }
      else p.onMoveThread(t.id, null, w.x, w.y);
    });
  };

  // ── 확대·축소 시 겹치는 핀 묶기 — 화면에서 28px 안이면 한 묶음(열린 핀·옮기는 핀은 따로) ──
  type PinItem = { kind: "pin"; key: string; x: number; y: number; t: Thread } | { kind: "cluster"; key: string; x: number; y: number; threads: Thread[] };
  const pinItems: PinItem[] = [];
  {
    const groups: { x: number; y: number; threads: Thread[] }[] = [];
    for (const t of visibleThreads) {
      const pos = pinDrag?.id === t.id ? { x: pinDrag.x, y: pinDrag.y } : threadPos(t);
      if (t.id === p.openThreadId || pinDrag?.id === t.id) { pinItems.push({ kind: "pin", key: t.id, x: pos.x, y: pos.y, t }); continue; }
      const g = groups.find((gr) => Math.hypot(gr.x - pos.x, gr.y - pos.y) < 28);
      if (g) g.threads.push(t); else groups.push({ x: pos.x, y: pos.y, threads: [t] });
    }
    for (const g of groups) {
      if (g.threads.length === 1) pinItems.unshift({ kind: "pin", key: g.threads[0].id, x: g.x, y: g.y, t: g.threads[0] });
      else pinItems.unshift({ kind: "cluster", key: `c-${g.threads.map((t) => t.id).join("-")}`, x: g.x, y: g.y, threads: g.threads });
    }
  }
  const zoomInAt = (sx: number, sy: number) => setView((v) => {
    const zoom = Math.min(8, v.zoom * 2);
    return { zoom, x: sx - ((sx - v.x) / v.zoom) * zoom, y: sy - ((sy - v.y) / v.zoom) * zoom };
  });
  const onScreen = (pt: { x: number; y: number }) => pt.x > -20 && pt.y > 0 && pt.x < size.w + 20 && pt.y < size.h + 40;

  const aiBox = p.aiCursorNodeId ? box(p.aiCursorNodeId) : null;
  const buildBox = p.aiBuildingId ? box(p.aiBuildingId) : null;

  return (
    <div
      ref={ref}
      className="relative flex-1 min-w-0 overflow-hidden select-none"
      style={{
        background: page.bg, cursor,
        // 레이아웃 그리드(8px) — 확대에 맞춰 칸이 커지고, 화면을 옮기면 같이 움직인다
        // 보드: 점 배경(FigJam처럼 24px 간격, 확대·이동을 따라감)
        ...(p.board && !p.grid ? { backgroundImage: "radial-gradient(circle, rgba(17,24,39,0.18) 1px, transparent 1.4px)", backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`, backgroundPosition: `${view.x}px ${view.y}px` } : {}),
        ...(p.grid ? { backgroundImage: "linear-gradient(rgba(239,68,68,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.10) 1px, transparent 1px)", backgroundSize: `${8 * view.zoom}px ${8 * view.zoom}px`, backgroundPosition: `${view.x}px ${view.y}px` } : {}),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHoverCand(null)}
      onDoubleClick={onDoubleClick}
      data-canvas
    >
      <div className="absolute left-0 top-0" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: "0 0" }}>
        {page.rootIds.map((id) => (
          <NodeView key={id} doc={doc} id={id} editingTextId={p.editingTextId} onCommitText={commitText} />
        ))}
      </div>

      {/* 화면 좌표 오버레이 — 확대해도 크기가 같은 것들 */}
      {page.rootIds.filter((id) => doc.nodes[id]?.type === "frame").map((id) => {
        const b = box(id)!;
        const on = p.selectedId === id;
        return (
          <div
            key={`label-${id}`}
            className="absolute truncate"
            style={{ ...f, left: b.x, top: b.y - 18, maxWidth: Math.max(40, b.w), fontSize: editorType.caption, color: on ? EDITOR_ACCENT : "#6b7280", fontWeight: 500, cursor: tool === "move" ? "default" : undefined }}
            onPointerDown={(e) => { if (tool !== "move" || spaceDown) return; e.stopPropagation(); p.setSelectedId(id); startMove(e, id); }}
          >
            {b.n.name}
          </div>
        );
      })}
      {hovBox && <div className="absolute pointer-events-none" style={{ left: hovBox.x, top: hovBox.y, width: hovBox.w, height: hovBox.h, boxShadow: `inset 0 0 0 1.5px ${EDITOR_ACCENT}` }} />}
      {sel && (
        <>
          <div className="absolute pointer-events-none" style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h, boxShadow: `inset 0 0 0 1.5px ${EDITOR_ACCENT}` }} />
          {!p.editingTextId && tool === "move" && (["nw", "ne", "sw", "se"] as const).map((c) => (
            <div
              key={c}
              onPointerDown={(e) => startResize(e, c)}
              className="absolute"
              style={{
                left: sel.x + (c.includes("e") ? sel.w : 0) - 4, top: sel.y + (c.includes("s") ? sel.h : 0) - 4, width: 8, height: 8,
                background: "#fff", border: `1.5px solid ${EDITOR_ACCENT}`, borderRadius: 2,
                cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
              }}
            />
          ))}
          <div
            className="absolute pointer-events-none"
            style={{ ...f, left: sel.x + sel.w / 2, top: sel.y + sel.h + 6, transform: "translateX(-50%)", background: EDITOR_ACCENT, color: "#fff", fontSize: editorType.caption, fontWeight: 600, padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap" }}
          >
            {Math.round(sel.n.w)} × {Math.round(sel.n.h)}
          </div>
        </>
      )}

      {buildBox && (
        <div className="absolute pointer-events-none ui-ai-building" style={{ left: buildBox.x - 3, top: buildBox.y - 3, width: buildBox.w + 6, height: buildBox.h + 6, borderRadius: 6, boxShadow: `0 0 0 2px ${color.brand}` }} />
      )}
      {aiBox && (
        <div className="absolute pointer-events-none flex items-start" style={{ left: aiBox.x + Math.min(aiBox.w, 160), top: aiBox.y + Math.min(aiBox.h, 40), transition: "left 450ms cubic-bezier(0.4,0,0.2,1), top 450ms cubic-bezier(0.4,0,0.2,1)", zIndex: 8 }} aria-hidden>
          <MousePointer2 size={18} strokeWidth={1.5} fill={color.brand} color="#fff" />
          <span style={{ ...f, marginTop: 14, marginLeft: -2, padding: "2px 7px", borderRadius: 6, background: color.brand, color: "#fff", fontSize: editorType.caption, fontWeight: 700, whiteSpace: "nowrap" }}>딸깍 AI</span>
        </div>
      )}
      <style>{`@keyframes uiAiPulse{0%,100%{opacity:1}50%{opacity:.35}}.ui-ai-building{animation:uiAiPulse 1.2s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.ui-ai-building{animation:none}}`}</style>
      {/* 투표 배지: 개체 오른쪽 위, 누르면 내 표 하나 빼기 */}
      {p.votes && Object.entries(p.votes).filter(([id, n]) => n > 0 && doc.nodes[id] && pageOfNodeId(id) === page.id).map(([id, n]) => {
        const a = absPos(doc, id), s0 = toScreen(a.x + doc.nodes[id].w, a.y);
        return (
          <button key={`vote-${id}`} type="button" aria-label={`${doc.nodes[id].name}에 준 표 ${n}개, 누르면 하나 빼요`}
            onPointerDown={(e) => { e.stopPropagation(); p.onUnvote?.(id); }}
            className="absolute flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
            style={{ left: s0.x - 14, top: s0.y - 14, minWidth: 28, height: 28, padding: "0 8px", background: EDITOR_ACCENT, color: "#fff", fontSize: 14, fontWeight: 700, boxShadow: "0 0 0 2px #fff, 0 2px 8px rgba(0,0,0,0.18)", zIndex: 6 }}
          >{n}</button>
        );
      })}
      {pinItems.map((it) => it.kind === "cluster" ? (
        <ClusterPin
          key={it.key} x={it.x} y={it.y} count={it.threads.length}
          authors={[...new Map(it.threads.map((t) => [t.messages[0]?.author.name, t.messages[0]?.author ?? p.me])).values()]}
          unread={it.threads.some((t) => isUnread(t, p.me))} onClick={() => zoomInAt(it.x, it.y)}
        />
      ) : (
        <CommentPin
          key={it.key}
          x={it.x}
          y={it.y}
          author={it.t.messages[0]?.author ?? p.me}
          number={it.t.number}
          active={it.t.id === p.openThreadId}
          resolved={it.t.resolved}
          unread={isUnread(it.t, p.me)}
          dragging={pinDrag?.id === it.t.id}
          preview={{ text: it.t.messages[0]?.text ?? "", replies: it.t.messages.length - 1, time: relTime(it.t.messages.at(-1)?.createdAt ?? Date.now()) }}
          onPress={(e) => pressPin(e, it.t)}
        />
      ))}
      {p.draft && (() => {
        const s = threadPos(p.draft);
        return (
          <>
            <CommentPin x={s.x} y={s.y} author={p.me} active draft />
            <DraftPopover x={s.x} y={s.y} bounds={size} me={p.me} members={p.members} onCancel={() => p.setDraft(null)} onSubmit={(text, images) => p.onCreateThread(p.draft!, text, images)} />
          </>
        );
      })()}
      {openThread && openThread.pageId === page.id && (() => {
        const s = threadPos(openThread);
        // 핀이 화면 밖으로 나가면 팝오버도 숨긴다(다시 들어오면 보인다)
        if (!onScreen(s) || pinDrag?.id === openThread.id) return null;
        return (
          <ThreadPopover
            x={s.x}
            y={s.y}
            bounds={size}
            thread={openThread}
            me={p.me}
            members={p.members}
            anchorLabel={p.anchorLabel(openThread)}
            draft={p.draftFor(openThread.id)}
            actions={p.threadActions(openThread)}
          />
        );
      })()}
    </div>
  );
}

/** Figma 코멘트 커서 — 말풍선 */
const COMMENT_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M3 21V9a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6H9z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>',
)}") 2 22, crosshair`;

export function NodeView({ doc, id, editingTextId, onCommitText }: { doc: Doc; id: string; editingTextId: string | null; onCommitText: (id: string, el: HTMLElement) => void }) {
  const n: DNode | undefined = doc.nodes[id];
  const editRef = useRef<HTMLDivElement>(null);
  const editing = editingTextId === id;
  useEffect(() => {
    if (!editing || !editRef.current) return;
    const el = editRef.current;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  }, [editing]);
  if (!n) return null;

  const style: CSSProperties = {
    position: "absolute", left: n.x, top: n.y, width: n.type === "text" && n.autoW ? "max-content" : n.w, height: n.type === "text" ? undefined : n.h,
    minHeight: n.type === "text" ? n.h : undefined,
    // 타원은 가로세로가 달라도 타원이 되게 50%(고정 radius면 알약 모양이 된다)
    background: n.imageUrl ? `${n.fill} url("${n.imageUrl}") center / cover no-repeat` : n.fill, borderRadius: n.type === "ellipse" ? "50%" : n.radius, opacity: n.opacity,
    boxShadow: n.stroke ? `inset 0 0 0 1px ${n.stroke}` : undefined,
    overflow: n.type === "frame" ? "hidden" : undefined,
  };
  if (n.type === "line" || n.type === "path") {
    // 선·연필은 SVG로 — 상자 크기에 맞춰 늘어난다. 얇아도 잘 잡히게 투명한 굵은 선을 아래에 깐다
    const sw = n.strokeWidth ?? 2;
    const [x1, y1, x2, y2] = [n.flipX ? n.w : 0, n.flipY ? n.h : 0, n.flipX ? 0 : n.w, n.flipY ? 0 : n.h];
    const pts = (n.points ?? []).map(([px, py]) => `${(px / (n.vw || 1)) * n.w},${(py / (n.vh || 1)) * n.h}`).join(" ");
    return (
      <div data-node-id={id} data-node-type={n.type} style={{ position: "absolute", left: n.x, top: n.y, width: Math.max(1, n.w), height: Math.max(1, n.h), opacity: n.opacity, overflow: "visible" }}>
        <svg width="100%" height="100%" style={{ overflow: "visible", display: "block" }} aria-hidden>
          {n.arrow && <defs><marker id={`ah-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={n.stroke ?? "#111827"} /></marker></defs>}
          {n.type === "line" ? (
            <>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(10, sw)} />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={n.stroke ?? "#111827"} strokeWidth={sw} strokeLinecap="round" markerEnd={n.arrow ? `url(#ah-${id})` : undefined} />
            </>
          ) : (
            <>
              <polyline points={pts} fill="none" stroke="transparent" strokeWidth={Math.max(10, sw)} />
              <polyline points={pts} fill="none" stroke={n.stroke ?? "#111827"} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </svg>
      </div>
    );
  }
  if (n.type === "text") {
    Object.assign(style, { ...f, color: n.color, fontSize: n.fontSize, fontWeight: n.fontWeight, textAlign: n.align, lineHeight: 1.4, whiteSpace: n.autoW ? "pre" : "pre-wrap", wordBreak: "keep-all" });
    return (
      <div data-node-id={id} data-node-type="text" style={style}>
        {editing ? (
          <div
            ref={editRef}
            className={SNAP_TEXT_EDIT}
            contentEditable
            suppressContentEditableWarning
            style={{ outline: "none", cursor: "text", minWidth: 4 }}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => onCommitText(id, e.currentTarget.parentElement as HTMLElement)}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } e.stopPropagation(); }}
          >
            {n.text}
          </div>
        ) : n.text}
      </div>
    );
  }
  return (
    <div data-node-id={id} data-node-type={n.type} style={style}>
      {n.children.map((c) => <NodeView key={c} doc={doc} id={c} editingTextId={editingTextId} onCommitText={onCommitText} />)}
    </div>
  );
}
