import type { CommentThreadBase } from "@/app/components/editor-shell/comments";

/**
 * 딸깍 UI 디자인 — 문서 모델(노드·페이지·코멘트)과 AI 목업 생성기.
 * 기획: docs/ui-design-editor.md. 노드 좌표(x, y)는 부모 기준(최상위는 캔버스 기준) — Figma와 같다.
 */

/** 에디터 전용 강조색 — 선택·활성 도구(dev 화면 캡처의 초록). 서비스 브랜드 블루와 섞지 않는다. */
export const EDITOR_ACCENT = "#14b86e";
export const EDITOR_ACCENT_SOFT = "#e8f8f0";

/** line = 선·화살표(arrow), path = 연필로 그린 자유 선(2026-11-19 툴바 확장) */
export type NodeType = "frame" | "rect" | "ellipse" | "text" | "line" | "path";

export interface DNode {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null;
  children: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke?: string;
  radius: number;
  opacity: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  /** 텍스트 도구로 만든 글자 — 폭이 내용에 맞춰 늘어난다(크기를 직접 바꾸면 false) */
  autoW?: boolean;
  /** 선: 끝에 화살촉. flipX/flipY = 상자 안에서 선이 어느 대각선으로 가는지(그린 방향) */
  arrow?: boolean;
  flipX?: boolean;
  flipY?: boolean;
  /** 선·연필 두께 */
  strokeWidth?: number;
  /** 연필: 그릴 때의 점들(그릴 때 상자 vw×vh 기준). 크기를 바꾸면 비율대로 늘어난다 */
  points?: [number, number][];
  vw?: number;
  vh?: number;
  /** 이미지 채우기(파일 열기로 넣은 이미지) — 있으면 fill 위에 cover 로 그린다 */
  imageUrl?: string;
}

export interface Page {
  id: string;
  name: string;
  bg: string;
  rootIds: string[];
}

export interface Doc {
  pages: Page[];
  nodes: Record<string, DNode>;
}

export type { CommentAuthor, CommentMsg } from "@/app/components/editor-shell/comments";

/** UI 디자인 코멘트 스레드 — 공통 상태(CommentThreadBase) + 캔버스 위치 */
export interface Thread extends CommentThreadBase {
  pageId: string;
  /** 붙은 최상위 프레임. null 이면 캔버스 좌표 */
  frameId: string | null;
  /** frameId 가 있으면 그 프레임 기준, 없으면 캔버스 기준 */
  x: number;
  y: number;
}

let seq = 0;
export const uid = (p = "n") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function emptyDoc(): Doc {
  return { pages: [{ id: "p1", name: "Page 1", bg: "#F5F5F5", rootIds: [] }], nodes: {} };
}

export function absPos(doc: Doc, id: string): { x: number; y: number } {
  let x = 0, y = 0;
  let n: DNode | undefined = doc.nodes[id];
  while (n) { x += n.x; y += n.y; n = n.parentId ? doc.nodes[n.parentId] : undefined; }
  return { x, y };
}

export function topFrameOf(doc: Doc, id: string): string | null {
  let n: DNode | undefined = doc.nodes[id];
  let top: string | null = null;
  while (n) { if (n.type === "frame") top = n.id; n = n.parentId ? doc.nodes[n.parentId] : undefined; }
  return top;
}

export function pageOfNode(doc: Doc, id: string): Page | undefined {
  let n = doc.nodes[id];
  while (n?.parentId) n = doc.nodes[n.parentId];
  return n ? doc.pages.find((p) => p.rootIds.includes(n.id)) : undefined;
}

/** 노드 추가(불변) — parentId 가 없으면 페이지 최상위 */
export function addNode(doc: Doc, pageId: string, node: DNode): Doc {
  const nodes = { ...doc.nodes, [node.id]: node };
  if (node.parentId) {
    const p = nodes[node.parentId];
    nodes[node.parentId] = { ...p, children: [...p.children, node.id] };
    return { ...doc, nodes };
  }
  return { ...doc, nodes, pages: doc.pages.map((pg) => (pg.id === pageId ? { ...pg, rootIds: [...pg.rootIds, node.id] } : pg)) };
}

export function updateNode(doc: Doc, id: string, patch: Partial<DNode>): Doc {
  const n = doc.nodes[id];
  if (!n) return doc;
  return { ...doc, nodes: { ...doc.nodes, [id]: { ...n, ...patch } } };
}

export function deleteNode(doc: Doc, id: string): Doc {
  const n = doc.nodes[id];
  if (!n) return doc;
  const nodes = { ...doc.nodes };
  const drop = (nid: string) => { nodes[nid]?.children.forEach(drop); delete nodes[nid]; };
  drop(id);
  if (n.parentId && nodes[n.parentId]) {
    const p = nodes[n.parentId];
    nodes[n.parentId] = { ...p, children: p.children.filter((c) => c !== id) };
  }
  return { ...doc, nodes, pages: doc.pages.map((pg) => ({ ...pg, rootIds: pg.rootIds.filter((r) => r !== id) })) };
}

export function makeNode(type: NodeType, parentId: string | null, x: number, y: number, w: number, h: number, extra: Partial<DNode> = {}): DNode {
  const base: Record<NodeType, Partial<DNode>> = {
    frame: { name: "Frame", fill: "#FFFFFF", radius: 0 },
    rect: { name: "Rectangle", fill: "#D9D9D9", radius: 0 },
    ellipse: { name: "Ellipse", fill: "#D9D9D9", radius: 9999 },
    text: { name: "Text", fill: "transparent", radius: 0, text: "텍스트", fontSize: 16, fontWeight: 400, color: "#000000", align: "left" },
    line: { name: "Line", fill: "transparent", radius: 0, stroke: "#111827", strokeWidth: 2 },
    path: { name: "Pencil", fill: "transparent", radius: 0, stroke: "#111827", strokeWidth: 2 },
  };
  return { id: uid(), type, parentId, children: [], x, y, w, h, opacity: 1, ...base[type], ...extra } as DNode;
}

/* ───────────────────────── AI 목업 생성기 ───────────────────────── */

export interface AiStep {
  label: string;
  /** 이 단계에서 추가할 노드 — 부모가 먼저 오도록 순서대로 */
  nodes: DNode[];
}

/** 블록 하나(부모 + 자식들)를 만드는 작은 빌더 */
function block(parent: DNode | null, type: NodeType, name: string, x: number, y: number, w: number, h: number, extra: Partial<DNode> = {}): DNode {
  return makeNode(type, parent?.id ?? null, x, y, w, h, { name, ...extra });
}
const T = (parent: DNode, name: string, text: string, x: number, y: number, w: number, size: number, weight = 400, color = "#111827", extra: Partial<DNode> = {}) =>
  block(parent, "text", name, x, y, w, Math.round(size * 1.4), { text, fontSize: size, fontWeight: weight, color, ...extra });

export function generateSteps(prompt: string, originX: number, originY: number): { title: string; summary: string; steps: AiStep[] } {
  if (/배달|음식|맛집|food/i.test(prompt)) return deliverySteps(originX, originY);
  if (/로그인|login|회원가입/i.test(prompt)) return loginSteps(originX, originY);
  if (/대시보드|dashboard|관리자/i.test(prompt)) return dashboardSteps(originX, originY);
  if (/랜딩|landing|웹사이트/i.test(prompt)) return landingSteps(originX, originY);
  return homeSteps(originX, originY, prompt);
}

/**
 * 요청 분류(목업) — 모호한 말("더", "어엉")로 화면을 통째로 만들고 크레딧을 쓰지 않게, 먼저 되묻는다.
 *   create        : 만들 화면이 보인다(배달·로그인·대시보드·랜딩 또는 화면/페이지/앱/만들어 등)
 *   edit          : 선택 + 지원하는 수정(다크 모드)
 *   needSelection : 수정하라는 말인데 선택이 없다
 *   unsupported   : 선택은 있지만 아직 못 하는 수정
 *   vague         : 무엇을 할지 알 수 없다
 */
export type PromptKind = "create" | "edit" | "needSelection" | "unsupported" | "vague";
const KNOWN_SCREEN = /배달|음식|맛집|food|로그인|login|회원가입|대시보드|dashboard|관리자|랜딩|landing|웹사이트/i;
const CREATE_WORD = /화면|페이지|앱|홈|만들|그려|디자인|프레임|템플릿|screen|page|app|make|create/i;
const EDIT_WORD = /바꿔|바꾸|수정|고쳐|키워|줄여|크게|작게|정렬|색|어둡|밝게|다크|dark|more|더\s*\S/i;
export function classifyPrompt(prompt: string, hasSelection: boolean): PromptKind {
  const p = prompt.trim();
  if (isDarkRequest(p)) return hasSelection ? "edit" : "needSelection";
  if (KNOWN_SCREEN.test(p)) return "create";
  if (EDIT_WORD.test(p) && !CREATE_WORD.test(p)) return hasSelection ? "unsupported" : "needSelection";
  if (CREATE_WORD.test(p) && p.replace(/\s/g, "").length >= 3) return "create";
  return "vague";
}
export const CLARIFY_REPLY: Record<Exclude<PromptKind, "create" | "edit">, string> = {
  vague: "어떤 화면을 만들지 조금 더 알려 주세요. 예: “쇼핑앱 상품 상세 화면 만들어 줘”, “회원가입 화면 만들어 줘”",
  needSelection: "무엇을 바꿀지 캔버스에서 먼저 선택해 주세요. 선택하면 입력창 위에 “선택: …”이 보여요.",
  unsupported: "지금은 선택한 화면을 다크 모드로 바꾸는 수정만 할 수 있어요. 새 화면을 만들어 달라고 해 보세요.",
};

/** 다크 모드 요청 판별 — 선택한 프레임이 있을 때만 "수정" 요청으로 본다 */
export const isDarkRequest = (prompt: string) => /다크|어둡게|dark/i.test(prompt);

/** 프레임과 그 안 요소의 색을 어둡게 바꾼다 — 밝은 바탕은 어둡게, 진한 글자는 밝게(밝기만 뒤집고 색조는 유지) */
export function darkenTree(doc: Doc, rootId: string): { doc: Doc; changed: number } {
  let changed = 0;
  const flip = (hex: string | undefined) => {
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    // 채도 높은 강조색(주황 배너 등)은 그대로 둔다
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (sat > 0.45) return hex;
    const t = (v: number) => Math.round(255 - v * 0.92).toString(16).padStart(2, "0");
    changed++;
    return `#${t(r)}${t(g)}${t(b)}`.toUpperCase();
  };
  const nodes = { ...doc.nodes };
  const walk = (id: string) => {
    const n = nodes[id];
    if (!n) return;
    nodes[id] = { ...n, fill: n.fill === "transparent" ? n.fill : flip(n.fill) ?? n.fill, color: flip(n.color), stroke: n.stroke ? flip(n.stroke) : n.stroke };
    n.children.forEach(walk);
  };
  walk(rootId);
  return { doc: { ...doc, nodes }, changed };
}

function deliverySteps(ox: number, oy: number) {
  const W = 360;
  const frame = block(null, "frame", "배달앱 모바일 메인", ox, oy, W, 760, { fill: "#FFFFFF", radius: 24 });
  const steps: AiStep[] = [{ label: "모바일 프레임(360×760) 만들기", nodes: [frame] }];

  steps.push({ label: "주소·검색바 추가", nodes: (() => {
    const addr = T(frame, "📍 서울시 강남구 테헤란로 123 ▾", "📍 서울시 강남구 테헤란로 123 ▾", 20, 28, 300, 15, 700);
    const search = block(frame, "frame", "검색바", 20, 64, W - 40, 44, { fill: "#F3F4F6", radius: 12 });
    const ph = T(search, "🔍 치킨, 피자, 떡볶이 검색…", "🔍 치킨, 피자, 떡볶이 검색…", 14, 12, 280, 14, 400, "#9CA3AF");
    return [addr, search, ph];
  })() });

  steps.push({ label: "이벤트 배너 추가", nodes: (() => {
    const b = block(frame, "frame", "이벤트 배너", 20, 124, W - 40, 96, { fill: "#FF6B00", radius: 16 });
    return [b, T(b, "오늘의 첫 주문 혜택 🎉", "오늘의 첫 주문 혜택 🎉", 18, 20, 260, 12, 500, "#FFE7D6"), T(b, "최대 15,000원 쿠폰팩!", "최대 15,000원 쿠폰팩!", 18, 44, 280, 20, 800, "#FFFFFF")];
  })() });

  steps.push({ label: "카테고리 4개 배치", nodes: ([["🍗", "치킨"], ["🍕", "피자"], ["🍚", "한식"], ["☕", "카페"]] as const).flatMap(([e, l], i) => {
    const gap = 10, cw = (W - 40 - gap * 3) / 4;
    const c = block(frame, "frame", `카테고리 ${l}`, 20 + i * (cw + gap), 236, cw, 72, { fill: "#FFFFFF", radius: 14, stroke: "#F1F5F9" });
    return [c, T(c, e, e, 0, 12, cw, 24, 400, "#111827", { align: "center" }), T(c, l, l, 0, 44, cw, 13, 500, "#374151", { align: "center" })];
  }) });

  steps.push({ label: "인기 맛집 카드 2개 추가", nodes: (() => {
    const title = T(frame, "우리 동네 인기 맛집 🔥", "우리 동네 인기 맛집 🔥", 20, 330, 280, 18, 800);
    const cards = ([
      ["황금올리브 치킨 강남점", "⭐ 4.9 (2,430+) · 20~30분", "최소주문 15,000원 · 배달팁 2,000원", "#FFF1E6", "🍗"],
      ["성수 수제버거 & 프라이", "⭐ 4.8 (1,820+) · 15~25분", "최소주문 12,000원 · 무료배달", "#EAF2FF", "🍔"],
    ] as const).flatMap(([name, meta, info, tint, emoji], i) => {
      const c = block(frame, "frame", `맛집 카드 ${i + 1}`, 20, 368 + i * 104, W - 40, 92, { fill: "#FFFFFF", radius: 16, stroke: "#F1F5F9" });
      const thumb = block(c, "frame", "썸네일", 12, 12, 68, 68, { fill: tint, radius: 12 });
      return [c, thumb, T(thumb, emoji, emoji, 0, 18, 68, 26, 400, "#111827", { align: "center" }),
        T(c, name, name, 94, 14, 220, 15, 700), T(c, meta, meta, 94, 40, 220, 12, 500, "#4B5563"),
        T(c, info, info, 94, 62, 220, 11, 500, i === 1 ? "#2563EB" : "#6B7280")];
    });
    return [title, ...cards];
  })() });

  steps.push({ label: "하단 탭바 추가", nodes: (() => {
    const bar = block(frame, "frame", "하단 탭바", 0, 760 - 72, W, 72, { fill: "#FFFFFF", stroke: "#F1F5F9", radius: 0 });
    const tabs = ([["🏠", "홈"], ["🔍", "검색"], ["♥", "찜"], ["🧾", "주문내역"], ["👤", "마이"]] as const).flatMap(([e, l], i) => {
      const tw = W / 5;
      const on = i === 0;
      return [T(bar, e, e, i * tw, 12, tw, 18, 400, on ? "#FF6B00" : "#9CA3AF", { align: "center" }), T(bar, l, l, i * tw, 40, tw, 11, on ? 700 : 500, on ? "#FF6B00" : "#9CA3AF", { align: "center" })];
    });
    return [bar, ...tabs];
  })() });

  return { title: "배달앱 모바일 메인", summary: "배달앱 모바일 메인 화면 UI 디자인을 구성했습니다.", steps };
}

function homeSteps(ox: number, oy: number, prompt: string) {
  const W = 390, H = 844;
  const frame = block(null, "frame", "모바일 홈", ox, oy, W, H, { fill: "#FFFFFF", radius: 28 });
  const short = prompt.trim().slice(0, 18) || "새 화면";
  const steps: AiStep[] = [
    { label: `모바일 프레임(${W}×${H}) 만들기`, nodes: [frame] },
    { label: "제목 추가", nodes: [T(frame, "제목", short, 24, 64, W - 48, 26, 800), T(frame, "설명", "필요한 내용을 한눈에 볼 수 있어요", 24, 104, W - 48, 14, 500, "#6B7280")] },
    { label: "가운데 카드 3개 배치", nodes: [0, 1, 2].flatMap((i) => {
      const c = block(frame, "frame", `카드 ${i + 1}`, 24, 160 + i * 156, W - 48, 140, { fill: ["#EEF2FF", "#ECFDF5", "#FFF7ED"][i], radius: 20 });
      return [c, T(c, "카드 제목", `카드 ${i + 1}`, 20, 20, 200, 18, 700), T(c, "카드 설명", "짧은 설명이 들어가는 자리", 20, 52, 260, 13, 500, "#4B5563")];
    }) },
    { label: "아래 버튼 추가", nodes: (() => {
      const btn = block(frame, "frame", "버튼", 24, H - 96, W - 48, 56, { fill: "#111827", radius: 16 });
      return [btn, T(btn, "버튼 라벨", "시작하기", 0, 16, W - 48, 16, 700, "#FFFFFF", { align: "center" })];
    })() },
  ];
  return { title: "모바일 홈", summary: "모바일 홈 화면에 제목·카드 3개·버튼을 배치했습니다.", steps };
}

export function stepCredit(steps: AiStep[]): number {
  return 30 + steps.reduce((s, st) => s + st.nodes.length, 0) * 3;
}

function loginSteps(ox: number, oy: number) {
  const W = 390, H = 844;
  const frame = block(null, "frame", "로그인", ox, oy, W, H, { fill: "#FFFFFF", radius: 28 });
  const field = (label: string, ph: string, y: number) => {
    const box = block(frame, "frame", `${label} 입력`, 24, y + 24, W - 48, 52, { fill: "#F8FAFC", radius: 14, stroke: "#E2E8F0" });
    return [T(frame, `${label} 라벨`, label, 24, y, 200, 13, 600, "#334155"), box, T(box, "placeholder", ph, 16, 15, 280, 14, 400, "#94A3B8")];
  };
  return {
    title: "로그인", summary: "이메일·비밀번호 로그인 화면을 만들었어요. 소셜 로그인 버튼과 회원가입 링크도 넣었어요.",
    steps: [
      { label: "모바일 프레임(390×844) 만들기", nodes: [frame] },
      { label: "로고와 인사말 추가", nodes: [block(frame, "frame", "로고", 24, 96, 48, 48, { fill: "#4F7BFF", radius: 14 }), T(frame, "제목", "다시 만나서 반가워요", 24, 164, 320, 26, 800), T(frame, "설명", "이메일로 로그인해 주세요", 24, 204, 320, 14, 500, "#64748B")] },
      { label: "이메일·비밀번호 입력칸 추가", nodes: [...field("이메일", "name@example.com", 260), ...field("비밀번호", "8자 이상", 352)] },
      { label: "로그인 버튼·소셜 로그인 추가", nodes: (() => {
        const btn = block(frame, "frame", "로그인 버튼", 24, 470, W - 48, 54, { fill: "#4F7BFF", radius: 14 });
        const kakao = block(frame, "frame", "카카오 로그인", 24, 560, W - 48, 50, { fill: "#FEE500", radius: 14 });
        return [btn, T(btn, "라벨", "로그인", 0, 16, W - 48, 16, 700, "#FFFFFF", { align: "center" }), kakao, T(kakao, "라벨", "카카오로 계속하기", 0, 15, W - 48, 14, 600, "#191919", { align: "center" }),
          T(frame, "회원가입", "처음이신가요? 회원가입", 0, 640, W, 13, 500, "#64748B", { align: "center" })];
      })() },
    ] as AiStep[],
  };
}

function dashboardSteps(ox: number, oy: number) {
  const W = 1440, H = 960;
  const frame = block(null, "frame", "대시보드", ox, oy, W, H, { fill: "#F8FAFC", radius: 0 });
  const side = block(frame, "frame", "사이드바", 0, 0, 240, H, { fill: "#FFFFFF", stroke: "#E2E8F0" });
  return {
    title: "대시보드", summary: "수치 카드 4개, 매출 차트, 최근 주문 표로 대시보드를 구성했어요.",
    steps: [
      { label: "데스크톱 프레임(1440×960) 만들기", nodes: [frame] },
      { label: "사이드바 추가", nodes: [side, T(side, "로고", "● Overview", 24, 28, 180, 18, 800), ...["대시보드", "주문", "상품", "고객", "설정"].map((l, i) => T(side, l, l, 24, 92 + i * 44, 180, 14, i ? 500 : 700, i ? "#64748B" : "#14B86E"))] },
      { label: "수치 카드 4개 배치", nodes: [["오늘 매출", "₩12.4M"], ["주문", "1,284"], ["방문자", "38.2K"], ["전환율", "3.4%"]].flatMap(([l, v], i) => {
        const c = block(frame, "frame", `카드 ${l}`, 272 + i * 288, 32, 264, 120, { fill: "#FFFFFF", radius: 16, stroke: "#E2E8F0" });
        return [c, T(c, "라벨", l, 20, 20, 200, 13, 500, "#64748B"), T(c, "값", v, 20, 50, 220, 28, 800)];
      }) },
      { label: "매출 차트 추가", nodes: (() => {
        const c = block(frame, "frame", "매출 차트", 272, 184, 1136, 360, { fill: "#FFFFFF", radius: 16, stroke: "#E2E8F0" });
        const bars = Array.from({ length: 12 }, (_, i) => { const h = 60 + ((i * 47) % 200); return block(c, "rect", `막대 ${i + 1}`, 40 + i * 88, 320 - h, 48, h, { fill: i === 11 ? "#14B86E" : "#BBF7D0", radius: 8 }); });
        return [c, T(c, "제목", "월별 매출", 24, 20, 300, 16, 700), ...bars];
      })() },
      { label: "최근 주문 표 추가", nodes: (() => {
        const c = block(frame, "frame", "최근 주문", 272, 576, 1136, 352, { fill: "#FFFFFF", radius: 16, stroke: "#E2E8F0" });
        const rows = ["#1042 · 김민지 · ₩48,000 · 배송 중", "#1041 · 이서준 · ₩126,000 · 결제 완료", "#1040 · 박하은 · ₩32,500 · 배송 완료", "#1039 · 최도윤 · ₩89,000 · 취소"];
        return [c, T(c, "제목", "최근 주문", 24, 20, 300, 16, 700), ...rows.map((r, i) => T(c, `행 ${i + 1}`, r, 24, 72 + i * 56, 900, 14, 500, "#334155"))];
      })() },
    ] as AiStep[],
  };
}

function landingSteps(ox: number, oy: number) {
  const W = 1440, H = 1024;
  const frame = block(null, "frame", "랜딩 페이지", ox, oy, W, H, { fill: "#FFFFFF" });
  return {
    title: "랜딩 페이지", summary: "대표 영역, 기능 3개, 수치, 푸터로 랜딩 페이지를 만들었어요.",
    steps: [
      { label: "웹 프레임(1440 wide) 만들기", nodes: [frame] },
      { label: "대표 영역 추가", nodes: (() => {
        const hero = block(frame, "frame", "대표 영역", 0, 0, W, 520, { fill: "#ECFDF5" });
        const cta = block(hero, "frame", "CTA", 120, 340, 200, 56, { fill: "#14B86E", radius: 14 });
        return [hero, T(hero, "제목", "팀의 일을 한곳에서", 120, 150, 800, 56, 800), T(hero, "설명", "계획부터 실행까지, 흩어진 일을 한 화면에서 정리하세요.", 120, 250, 800, 20, 500, "#475569"), cta, T(cta, "라벨", "무료로 시작하기", 0, 17, 200, 16, 700, "#FFFFFF", { align: "center" })];
      })() },
      { label: "기능 3개 배치", nodes: [["빠른 시작", "템플릿으로 바로"], ["함께 편집", "실시간 공동 작업"], ["자동 정리", "AI가 알아서 정리"]].flatMap(([t, d], i) => {
        const c = block(frame, "frame", `기능 ${i + 1}`, 120 + i * 412, 580, 380, 200, { fill: "#FFFFFF", radius: 20, stroke: "#E2E8F0" });
        return [c, block(c, "rect", "아이콘", 28, 28, 44, 44, { fill: "#D1FAE5", radius: 12 }), T(c, "제목", t, 28, 96, 300, 20, 700), T(c, "설명", d, 28, 132, 300, 15, 500, "#64748B")];
      }) },
      { label: "푸터 추가", nodes: (() => {
        const ft = block(frame, "frame", "푸터", 0, 864, W, 160, { fill: "#0F172A" });
        return [ft, T(ft, "푸터 문구", "© 2026 Company · 이용약관 · 개인정보처리방침", 120, 66, 800, 14, 500, "#94A3B8")];
      })() },
    ] as AiStep[],
  };
}

function kitSteps(ox: number, oy: number) {
  const frame = block(null, "frame", "디자인 시스템 시작 키트", ox, oy, 1200, 720, { fill: "#FFFFFF" });
  const sw = [["Primary", "#14B86E"], ["Secondary", "#0F172A"], ["Accent", "#F59E0B"], ["Danger", "#EF4444"], ["Surface", "#F8FAFC"], ["Border", "#E2E8F0"]];
  return {
    title: "디자인 시스템 시작 키트", summary: "색상·텍스트 스타일·버튼·입력란·카드를 담은 시작 키트를 만들었어요.",
    steps: [
      { label: "키트 프레임 만들기", nodes: [frame, T(frame, "제목", "Design System", 48, 40, 600, 32, 800)] },
      { label: "색상 팔레트 추가", nodes: sw.flatMap(([n, c], i) => [block(frame, "rect", n, 48 + i * 180, 120, 160, 96, { fill: c, radius: 14, stroke: "#E2E8F0" }), T(frame, `${n} 이름`, `${n} ${c}`, 48 + i * 180, 226, 160, 12, 600, "#334155")]) },
      { label: "텍스트 스타일 추가", nodes: [["Heading 1", 32, 800], ["Heading 2", 24, 700], ["Body", 16, 400], ["Caption", 12, 500]].map(([l, sz, w], i) => T(frame, String(l), String(l), 48, 290 + i * 52, 400, Number(sz), Number(w))) },
      { label: "버튼·입력란·카드 추가", nodes: (() => {
        const b1 = block(frame, "frame", "버튼 Primary", 560, 300, 160, 48, { fill: "#14B86E", radius: 12 });
        const b2 = block(frame, "frame", "버튼 Secondary", 740, 300, 160, 48, { fill: "#FFFFFF", radius: 12, stroke: "#E2E8F0" });
        const inp = block(frame, "frame", "입력란", 560, 372, 340, 48, { fill: "#F8FAFC", radius: 12, stroke: "#E2E8F0" });
        const card = block(frame, "frame", "카드", 560, 448, 340, 180, { fill: "#FFFFFF", radius: 18, stroke: "#E2E8F0" });
        return [b1, T(b1, "라벨", "Primary", 0, 13, 160, 15, 700, "#FFFFFF", { align: "center" }), b2, T(b2, "라벨", "Secondary", 0, 13, 160, 15, 700, "#0F172A", { align: "center" }),
          inp, T(inp, "placeholder", "입력해 주세요", 16, 13, 300, 14, 400, "#94A3B8"), card, T(card, "제목", "카드 제목", 20, 20, 300, 18, 700), T(card, "설명", "카드 설명이 들어가는 자리", 20, 52, 300, 14, 500, "#64748B")];
      })() },
    ] as AiStep[],
  };
}

/** 홈 "템플릿으로 시작" — 생성기를 그대로 써서 문서를 만든다(썸네일도 이 문서를 축소해 그린다) */
export const TEMPLATES = [
  { id: "mobile", name: "모바일 앱", desc: "컴포넌트와 프로토타입 흐름이 포함된 모바일 앱 화면", meta: "앱 · 390 × 844", build: () => homeSteps(0, 0, "모바일 앱") },
  { id: "landing", name: "랜딩 페이지", desc: "대표 영역, 기능, 수치, 푸터로 구성된 반응형 제품 페이지", meta: "웹사이트 · 1440 wide", build: () => landingSteps(0, 0) },
  { id: "dashboard", name: "대시보드", desc: "수치, 막대 차트, 표를 격자로 배치한 분석 화면", meta: "웹 · 1440 × 960", build: () => dashboardSteps(0, 0) },
  { id: "kit", name: "디자인 시스템 시작 키트", desc: "색상 및 텍스트 스타일, 버튼, 입력란, 카드", meta: "키트 · 1 page", build: () => kitSteps(0, 0) },
] as const;

export function docFromSteps(steps: AiStep[]): Doc {
  let d = emptyDoc();
  for (const st of steps) for (const n of st.nodes) d = addNode(d, "p1", n);
  return d;
}
