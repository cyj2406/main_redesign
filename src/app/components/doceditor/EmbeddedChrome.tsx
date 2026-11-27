import { useState, type ComponentType, type ReactNode } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Asterisk, BadgeCheck, BarChart3, Baseline, Binoculars, Bold, BookOpen, CaseSensitive, ChevronDown,
  ChevronUp, ChevronsRight, ClipboardPaste, Copy, Eraser, FileDown, FileMinus, FileOutput, FilePen, FilePlus2, Files, Filter, Focus, FolderOpen, FormInput,
  FunctionSquare, Globe, Grid3x3, HelpCircle, Highlighter, History, Home, Image, IndentDecrease, IndentIncrease, Info, Italic, LayoutGrid, LayoutTemplate,
  Link, List, ListOrdered, Merge, MessageSquare, MessageSquareText, Mic, Minus, MonitorPlay, MoreHorizontal, Paintbrush, PaintBucket, Palette, PanelBottom,
  PanelLeft, PanelTop, Pencil, Percent, Pilcrow, Plus, Presentation, Printer, Redo2, Replace, RotateCcw, Save, ScanText, Scissors, Search, Shapes, Share,
  ShieldCheck, Sigma, SpellCheck, SquareMousePointer, Stamp, Strikethrough, Subscript, Sun, Superscript, Table, Type, Underline, Undo2, Layers, Loader2,
  MousePointer2, PanelsTopLeft, Code2, FileCode2, FileText,
  Folder, Smile, Captions, Settings, ArrowDownUp, CloudUpload, Play, AlignStartVertical, AlignEndVertical, Snowflake, Trash2, Bookmark, ChartLine,
  Magnet, MoveHorizontal, ZoomIn, ZoomOut, Volume2, Eye, Video, SlidersHorizontal, Maximize, Wand2,
} from "lucide-react";

import { color, f } from "@/app/styleTokens";

import type { DocKind } from "./docTemplates";

/**
 * 안쪽 오픈소스 에디터 모양 흉내(2026-11-20, 사용자가 보낸 dev 캡처 기준 · 동작 없음).
 * 실제 서비스에서는 이 자리에 오픈소스 에디터(워드 · 엑셀 · PPT = 오피스형, 한글 = 한글형, PDF = 도구형)가 들어온다.
 * 느낌을 보려는 용도라 모양만 그리고 화면 읽기 도구에는 숨긴다(aria-hidden). 아이콘은 lucide.
 *  - 워드 · 엑셀 · PPT: 탭 줄([↶ ↷ | 파일 홈 삽입 …], 2026-11-27 맨 위 제목 줄을 뺀 목표 화면) → 리본 → (워드 눈금자 · 엑셀 수식 줄) … 아래 상태 줄
 *  - 한글: 메뉴(파일 편집 보기 입력 서식 쪽 표 도구) → 큰 아이콘 리본 → 서식 줄(바탕글 · 대표 · 함초롬바탕 · 10.0pt · 160%) → 눈금자 … 상태 줄
 *  - PDF: [홈 · + 열기] → [메뉴 · 모든 도구 읽기 편집 변환 전자 서명 · 도구 찾기] → 왼쪽 도구 목록 + 환영 화면(추천 도구 · 최근 항목)
 */

type Ico = ComponentType<{ size?: number; color?: string; strokeWidth?: number; className?: string }>;
const T = { ...f, fontSize: 12.5, color: "#334155" } as const;
const OFFICE_ACCENT: Record<string, string> = { word: "#2b6ce6", excel: "#1f8a50", ppt: "#d4622b" };

/* ───────────── 오피스형(워드 · 엑셀 · PPT) ───────────── */

/*
 * 맨 위 제목 줄(자동 저장 · 💾 · 되돌리기 | "제목 — 저장됨" | 검색 · 사용자)은 그리지 않는다(2026-11-27, 목표 화면).
 * 딸깍 헤더와 저장 · 파일 이름 · 프로필이 위아래로 두 번 보였다. 실제 에디터에서 숨길 수 있는지는 개발 확인 필요
 * (ONLYOFFICE 계열이면 머리 줄을 탭 줄로 합치는 compactHeader, 파일 이름 숨기는 toolbarHideFileName 같은 설정이 있는 것으로 안다. docs/editor-overlaps.md 12).
 * 되돌리기 · 다시 하기는 탭 줄 왼쪽으로, PPT [발표]는 탭 줄 오른쪽으로 옮겼다. 자동 저장은 늘 켜 두므로 스위치가 필요 없다.
 */

const OFFICE_TABS: Record<string, string[]> = {
  word: ["파일", "홈", "삽입", "그리기", "디자인", "레이아웃", "참조", "편지", "검토", "보기", "도움말"],
  excel: ["파일", "홈", "삽입", "그리기", "페이지 레이아웃", "수식", "데이터", "검토", "보기", "도움말"],
  ppt: ["파일", "홈", "삽입", "그리기", "디자인", "전환", "애니메이션", "슬라이드 쇼", "녹화", "검토", "보기"],
};

function OfficeTabs({ kind }: { kind: "word" | "excel" | "ppt" }) {
  const accent = OFFICE_ACCENT[kind];
  return (
    <div className="h-10 flex items-end gap-5 px-4 shrink-0 overflow-hidden" style={{ background: "#f6f7f9" }}>
      <span className="mb-2 flex items-center gap-2.5 shrink-0 pr-4" style={{ borderRight: "1px solid #e2e8f0" }}>
        <Undo2 size={16} color="#475569" /><Redo2 size={16} color="#94a3b8" />
      </span>
      {/* 좁으면 탭 이름이 먼저 잘리고, 오른쪽 [발표] · [편집]은 늘 보인다 */}
      <span className="flex-1 min-w-0 flex items-end gap-5 overflow-hidden">
        {OFFICE_TABS[kind].map((t) => (
          <span key={t} className="pb-2 relative shrink-0" style={{ ...T, fontSize: 13, color: t === "홈" ? accent : "#334155", fontWeight: t === "홈" ? 600 : 400 }}>
            {t}{t === "홈" && <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 w-4 h-0.5 rounded-full" style={{ background: accent }} />}
          </span>
        ))}
      </span>
      {/* 워드 안쪽 [댓글] · [공유]는 딸깍 코멘트 · 공유와 겹쳐 목표 화면에서 뺐다(docs/editor-overlaps.md 3, 4). 편집 모드는 안쪽에만 있는 기능이라 둔다 */}
      {kind === "word" && (
        <span className="mb-1.5 flex items-center gap-1.5 shrink-0">
          <span className="h-7 px-2.5 rounded-md flex items-center gap-1" style={{ ...T, boxShadow: "inset 0 0 0 1px #cbd5e1", background: "#fff" }}><Pencil size={13} />편집<ChevronDown size={12} /></span>
        </span>
      )}
      {kind === "ppt" && (
        <span className="mb-1.5 flex items-center gap-1.5 shrink-0">
          <span className="h-7 px-4 rounded-full flex items-center gap-1" style={{ ...T, background: accent, color: "#fff", fontWeight: 600 }}><MonitorPlay size={13} />발표</span>
        </span>
      )}
    </div>
  );
}

/** 리본 조각 */
const Big = ({ icon: I, label, color: c = "#475569", dim }: { icon: Ico; label: string; color?: string; dim?: boolean }) => (
  <span className="shrink-0 flex flex-col items-center gap-1 px-1.5" style={{ opacity: dim ? 0.45 : 1 }}><I size={26} color={c} strokeWidth={1.6} /><span style={{ ...T, fontSize: 12 }}>{label}</span></span>
);
const Small = ({ icon: I, label, dim }: { icon: Ico; label?: string; dim?: boolean }) => (
  <span className="shrink-0 flex items-center gap-1.5 h-6" style={{ opacity: dim ? 0.45 : 1 }}><I size={15} color="#475569" />{label && <span style={{ ...T, fontSize: 12 }}>{label}</span>}</span>
);
const Group = ({ children, label }: { children: ReactNode; label?: string }) => (
  <span className="shrink-0 flex flex-col items-center justify-between h-full px-3" style={{ borderRight: "1px solid #e5e7eb" }}>
    <span className="flex items-center gap-2 flex-1">{children}</span>
    {label && <span style={{ ...T, fontSize: 11, color: "#94a3b8" }}>{label}</span>}
  </span>
);
const Sel = ({ w, text = "" }: { w: number; text?: string }) => (
  <span className="h-6 rounded flex items-center justify-between px-1.5" style={{ width: w, background: "#fff", boxShadow: "inset 0 0 0 1px #d1d5db", ...T, fontSize: 12 }}><span className="truncate">{text}</span><ChevronDown size={12} color="#94a3b8" /></span>
);

function OfficeRibbon({ kind }: { kind: "word" | "excel" | "ppt" }) {
  return (
    <div className="mx-2 mb-2 rounded-lg bg-white flex items-stretch overflow-hidden shrink-0" style={{ height: 100, padding: "8px 0", boxShadow: "0 1px 2px rgba(15,23,42,0.06), 0 0 0 1px #eef0f3" }}>
      <Group label="클립보드">
        <Big icon={ClipboardPaste} label="붙여넣기" color="#2b6ce6" />
        <span className="flex flex-col"><Small icon={Scissors} label="잘라내기" dim /><Small icon={Copy} label="복사" /><Small icon={Paintbrush} label="서식" /></span>
      </Group>
      {kind === "ppt" && (
        <Group label="슬라이드">
          <Big icon={FilePlus2} label="새 슬라이드" color="#d4622b" />
          <span className="flex flex-col"><Small icon={LayoutTemplate} label="레이아웃" /><Small icon={RotateCcw} label="원래대로" /><Small icon={Layers} label="구역" /></span>
        </Group>
      )}
      <Group label="글꼴">
        <span className="flex flex-col gap-1.5">
          <span className="flex gap-1"><Sel w={kind === "ppt" ? 150 : 120} text={kind === "excel" ? "맑은 고딕" : ""} /><Sel w={52} text={kind === "excel" ? "11" : ""} /></span>
          <span className="flex gap-2.5">{[Bold, Italic, Underline, Strikethrough, Superscript, Subscript, CaseSensitive, Highlighter, Baseline].map((I, i) => <I key={i} size={15} color="#475569" />)}</span>
        </span>
      </Group>
      <Group label="단락">
        <span className="flex flex-col gap-1.5">
          <span className="flex gap-2.5">{[List, ListOrdered, IndentDecrease, IndentIncrease].map((I, i) => <I key={i} size={15} color="#475569" />)}</span>
          <span className="flex gap-2.5">{[AlignLeft, AlignCenter, AlignRight, AlignJustify].map((I, i) => <I key={i} size={15} color="#475569" />)}</span>
        </span>
      </Group>
      {kind === "word" && (
        <>
          <Group label="스타일"><Big icon={Type} label="스타일" color="#2b6ce6" /></Group>
          <Group label="편집"><span className="flex flex-col"><Small icon={Search} label="찾기" /><Small icon={Replace} label="바꾸기" /><Small icon={SquareMousePointer} label="선택" /></span></Group>
          <Group label="음성"><Big icon={Mic} label="받아쓰기" dim /></Group>
          <Group label="편집기"><Big icon={SpellCheck} label="편집기" color="#1f8a50" /></Group>
        </>
      )}
      {kind === "excel" && (
        <>
          <Group label="표시 형식"><span className="flex flex-col gap-1.5"><Sel w={110} text="일반" /><span className="flex gap-2.5"><span style={{ ...T, fontWeight: 700 }}>₩</span><Percent size={15} color="#475569" /><span style={{ ...T, fontWeight: 700 }}>.00</span></span></span></Group>
          <Group label="셀"><span className="flex flex-col"><Small icon={Merge} label="병합" /><Small icon={PaintBucket} label="채우기" /><Small icon={Table} label="표 서식" /></span></Group>
          <Group label="편집"><span className="flex flex-col"><Small icon={Sigma} label="합계" /><Small icon={Filter} label="정렬 및 필터" /><Small icon={Eraser} label="지우기" /></span></Group>
          <Group label="차트"><Big icon={BarChart3} label="추천 차트" color="#1f8a50" /></Group>
        </>
      )}
      {kind === "ppt" && (
        <>
          <Group label="그리기"><Big icon={Image} label="그림" color="#1f8a50" /><Big icon={Shapes} label="도형" color="#2b6ce6" /><Big icon={Type} label="텍스트 상자" color="#2b6ce6" /><Big icon={Layers} label="정렬" dim /></Group>
        </>
      )}
      <span className="ml-auto flex items-center pr-2"><ChevronsRight size={16} color="#94a3b8" /></span>
    </div>
  );
}

/** 눈금자(워드 · 한글) */
function Ruler({ bg = "#f6f7f9" }: { bg?: string }) {
  return (
    <div className="h-6 shrink-0 flex items-end overflow-hidden" style={{ background: bg, borderBottom: "1px solid #e5e7eb" }}>
      <div className="mx-auto flex items-end" style={{ width: 680 }}>
        {Array.from({ length: 17 }, (_, i) => (
          <span key={i} className="flex-1 flex flex-col items-start" style={{ borderLeft: "1px solid #cbd5e1", height: 10 }}>
            <span style={{ ...T, fontSize: 9, color: "#94a3b8", marginLeft: 2, marginTop: -12 }}>{i + 1}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FormulaBar() {
  return (
    <div className="h-8 shrink-0 flex items-center gap-2 px-2" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
      <span className="h-6 w-[72px] rounded flex items-center px-1.5" style={{ boxShadow: "inset 0 0 0 1px #d1d5db", ...T, fontSize: 12 }}>A1</span>
      <FunctionSquare size={15} color="#64748b" />
      <span className="flex-1 h-6 rounded" style={{ boxShadow: "inset 0 0 0 1px #e5e7eb" }} />
    </div>
  );
}

/* ───────────── 한글형 ───────────── */

function HangulTop() {
  const big: [Ico, string, string?][] = [
    [Scissors, "오려 두기"], [Copy, "복사 하기"], [ClipboardPaste, "붙이기", "#d4a72c"], [Paintbrush, "모양 복사"],
    [Pilcrow, "조판 부호", "#2b6ce6"], [ListOrdered, "문단 부호", "#2b6ce6"], [Grid3x3, "격자 보기"],
    [Type, "글자 모양", "#2b6ce6"], [AlignJustify, "문단 모양", "#2b6ce6"], [ListOrdered, "문단 번호", "#2b6ce6"], [List, "글머리 표", "#2b6ce6"],
    [IndentDecrease, "수준▲", "#2b6ce6"], [IndentIncrease, "수준▼", "#2b6ce6"],
    [Table, "표", "#2b6ce6"], [Shapes, "도형", "#2b6ce6"], [Image, "그림", "#1f8a50"],
    [SquareMousePointer, "개체 속성", "#2b6ce6"], [Asterisk, "문자표"], [Link, "하이퍼 링크", "#2b6ce6"],
    [PanelTop, "머리말", "#d4a72c"], [PanelBottom, "꼬리말", "#d4a72c"], [FileMinus, "각주", "#1f8a50"], [FileDown, "미주", "#1f8a50"], [Binoculars, "찾기"], [History, "이력 관리", "#2b6ce6"],
  ];
  return (
    <>
      <div className="h-9 flex items-center gap-7 px-5 shrink-0" style={{ background: "#fff", borderBottom: "1px solid #eef0f3" }}>
        {["파일", "편집", "보기", "입력", "서식", "쪽", "표", "도구"].map((t) => <span key={t} className="shrink-0" style={{ ...T, fontSize: 13 }}>{t}</span>)}
        <ChevronUp size={15} color="#64748b" className="ml-auto" />
      </div>
      <div className="h-[60px] flex items-center gap-0.5 px-2 shrink-0 overflow-hidden" style={{ background: "#fff", borderBottom: "1px solid #eef0f3" }}>
        {big.map(([I, l, c], i) => (
          <span key={i} className="shrink-0 w-[46px] flex flex-col items-center gap-0.5">
            <I size={20} color={c ?? "#475569"} strokeWidth={1.6} />
            <span className="text-center" style={{ ...T, fontSize: 10.5, lineHeight: "12px", width: 40, wordBreak: "keep-all" }}>{l}</span>
          </span>
        ))}
        <ChevronsRight size={16} color="#94a3b8" className="ml-auto shrink-0" />
      </div>
      <div className="h-10 flex items-center gap-1.5 px-3 shrink-0 overflow-hidden [&>*]:shrink-0" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <Sel w={100} text="바탕글" /><Sel w={76} text="대표" /><Sel w={150} text="함초롬바탕" /><Sel w={72} text="10.0 pt" /><Sel w={80} text="160 %" />
        <span className="w-px h-5 mx-1" style={{ background: "#e5e7eb" }} />
        {[Bold, Italic, Underline, Strikethrough].map((I, i) => <I key={i} size={16} color="#334155" />)}
        <span className="w-px h-5 mx-1" style={{ background: "#e5e7eb" }} />
        <Baseline size={16} color="#334155" /><Highlighter size={16} color="#d4a72c" />
        <span className="w-px h-5 mx-1" style={{ background: "#e5e7eb" }} />
        {[AlignLeft, AlignCenter, AlignRight, AlignJustify].map((I, i) => <I key={i} size={16} color="#334155" />)}
      </div>
      <Ruler bg="#ececec" />
    </>
  );
}

/* ───────────── 공개 부품 ───────────── */

/** 가운데 편집 영역 위쪽(오피스형 · 한글형). 영상 · 이미지는 기존 도구 모음(MockToolbar) */
export function EmbeddedTop({ kind, title }: { kind: DocKind; title: string }) {
  // 좁아져도(템플릿 패널 · AI 패널을 함께 열었을 때) 글자가 한 자씩 꺾이지 않게: 줄바꿈 없이, 넘치는 건 잘림
  if (kind === "hangul") return <div aria-hidden className="whitespace-nowrap overflow-hidden"><HangulTop /></div>;
  if (kind === "word" || kind === "excel" || kind === "ppt") {
    return (
      <div aria-hidden className="whitespace-nowrap overflow-hidden" style={{ background: "#f6f7f9" }}>
        <OfficeTabs kind={kind} />
        <OfficeRibbon kind={kind} />
        {kind === "word" && <Ruler />}
        {kind === "excel" && <FormulaBar />}
      </div>
    );
  }
  return null;
}

/** 가운데 편집 영역 아래 상태 줄 */
export function EmbeddedStatus({ kind }: { kind: DocKind }) {
  const zoom = (pct: string) => (
    <span className="flex items-center gap-2"><Minus size={14} color="#64748b" /><span className="w-28 h-1 rounded-full relative" style={{ background: "#d1d5db" }}><span className="absolute top-1/2 -translate-y-1/2 size-3 rounded-full bg-white" style={{ left: "45%", boxShadow: "0 0 0 1.5px #64748b" }} /></span><Plus size={14} color="#64748b" /><span style={{ ...T, fontSize: 12 }}>{pct}</span></span>
  );
  const left: Record<string, string[]> = {
    word: ["전체 1페이지 중 1페이지", "단어 0개", "한국어"],
    excel: ["준비", "Sheet1"],
    ppt: ["슬라이드 1/1", "한국어"],
    hangul: ["1/1쪽", "구역: 1/1", "삽입"],
  };
  if (!left[kind]) return null;
  return (
    <div aria-hidden className="h-8 shrink-0 flex items-center gap-5 px-4" style={{ background: kind === "hangul" ? "#fff" : "#f6f7f9", borderTop: "1px solid #e5e7eb" }}>
      {kind === "excel" && <span className="h-6 px-3 -ml-2 rounded-t flex items-center" style={{ ...T, fontSize: 12, fontWeight: 600, color: OFFICE_ACCENT.excel, background: "#fff", boxShadow: "inset 0 -2px 0 " + OFFICE_ACCENT.excel }}>Sheet1</span>}
      {left[kind].filter((x) => !(kind === "excel" && x === "Sheet1")).map((t) => <span key={t} style={{ ...T, fontSize: 12, color: "#64748b" }}>{t}</span>)}
      <span className="ml-auto flex items-center gap-4">
        {kind === "word" && <><Focus size={14} color="#64748b" /><BookOpen size={14} color="#64748b" /><Globe size={14} color="#64748b" /></>}
        {kind === "ppt" && <><span style={{ ...T, fontSize: 12, color: "#64748b" }}>노트</span><span style={{ ...T, fontSize: 12, color: "#64748b" }}>메모</span><PanelLeft size={14} color="#64748b" /><LayoutGrid size={14} color="#64748b" /><BookOpen size={14} color="#64748b" /></>}
        {zoom(kind === "ppt" ? "95%" : "100%")}
      </span>
    </div>
  );
}

/** PDF 도구형 위쪽 두 줄 */
export function PdfTop() {
  return (
    <div aria-hidden className="shrink-0">
      <div className="h-10 flex items-center gap-2 px-3" style={{ background: "#f6f7f9", borderBottom: "1px solid #e5e7eb" }}>
        <span className="size-7 rounded-md flex items-center justify-center" style={{ background: "#e8eefc" }}><Home size={15} color="#2b6ce6" /></span>
        <span className="flex items-center gap-1" style={{ ...T, fontSize: 13 }}><Plus size={15} />열기</span>
        <span className="ml-auto flex items-center gap-3"><HelpCircle size={16} color="#475569" /><Sun size={16} color="#475569" /></span>
      </div>
      <div className="h-12 flex items-center gap-6 px-4 bg-white" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <span className="flex items-center gap-1.5 pr-5" style={{ ...T, fontSize: 13, borderRight: "1px solid #e5e7eb" }}><PanelLeft size={16} />메뉴</span>
        {["모든 도구", "읽기", "편집", "변환", "전자 서명"].map((t, i) => <span key={t} style={{ ...T, fontSize: 13.5, color: i === 0 ? "#111827" : "#475569", fontWeight: i === 0 ? 600 : 400 }}>{t}</span>)}
        <span className="ml-auto h-8 w-[300px] rounded-full flex items-center gap-2 px-3" style={{ boxShadow: "inset 0 0 0 1px #d1d5db", color: "#94a3b8", fontSize: 12.5 }}><Search size={14} />도구 및 명령 찾기<span className="ml-auto">⌘K</span></span>
        <Info size={16} color="#64748b" /><Save size={16} color="#64748b" /><Printer size={16} color="#64748b" />
      </div>
    </div>
  );
}

const PDF_TOOLS: [Ico, string, string][] = [
  [FileOutput, "PDF 내보내기", "#2b6ce6"], [Pencil, "채우기 및 서명", "#7c3aed"], [FilePen, "PDF 편집", "#db2777"], [FilePlus2, "PDF 만들기", "#dc2626"],
  [Files, "파일 결합", "#2b6ce6"], [LayoutGrid, "페이지 구성", "#16a34a"], [MessageSquareText, "주석 추가", "#d97706"], [ScanText, "스캔 및 OCR", "#16a34a"],
  [ShieldCheck, "PDF 보호", "#2b6ce6"], [FileMinus, "PDF 압축", "#dc2626"], [FormInput, "양식 준비", "#7c3aed"], [Stamp, "스탬프 추가", "#7c3aed"], [BadgeCheck, "인증서 사용", "#0d9488"],
];
const PDF_PICKS: [Ico, string, string, string][] = [
  [LayoutGrid, "페이지 구성", "페이지 격자, 회전, 삭제", "#16a34a"], [MessageSquareText, "주석 추가", "스티커 노트, 강조 표시, 밑줄", "#d97706"],
  [FormInput, "양식 준비", "필드 목록, 양식 필드 감지", "#7c3aed"], [FilePen, "PDF 편집", "텍스트와 이미지 편집, 페이지 회전", "#db2777"], [ShieldCheck, "PDF 보호", "암호로 보호, 숨겨진 정보 제거", "#2b6ce6"],
];

/** PDF 첫 화면(파일을 열기 전) — 왼쪽 모든 도구 + 환영 · 추천 도구 · 파일 열기(끌어다 놓아도 됨) · 최근 항목 */
export function PdfHome({ onPick, onDrop }: { onPick: () => void; onDrop: (file: File | undefined) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div className="flex-1 min-h-0 flex" style={f}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(e.dataTransfer.files?.[0]); }}>
      <aside aria-hidden className="w-[260px] shrink-0 bg-white overflow-y-auto ui-scroll" style={{ borderRight: "1px solid #e5e7eb" }}>
        <p className="px-5 h-12 flex items-center" style={{ ...T, fontSize: 14, fontWeight: 600, color: "#111827", borderBottom: "1px solid #eef0f3" }}>모든 도구</p>
        <ul className="py-2">
          {PDF_TOOLS.map(([I, l, c]) => <li key={l} className="h-10 flex items-center gap-3 px-5" style={{ ...T, fontSize: 13.5, color: "#1e293b" }}><I size={18} color={c} strokeWidth={1.6} />{l}</li>)}
        </ul>
      </aside>
      <div className="flex-1 min-w-0 overflow-y-auto ui-scroll" style={{ background: over ? "#eef4ff" : "#eef0f4", padding: "40px 40px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: "-0.6px" }}>딸깍 PDF에 오신 것을 환영합니다</h2>
        <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>PDF를 열어 고치고, 딸깍 AI에게 요약이나 번역을 시킬 수 있어요.</p>
        <div className="mt-6 rounded-2xl bg-white p-5" style={{ boxShadow: "0 0 0 1px #e5e7eb" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>추천 도구</p>
          <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
            {PDF_PICKS.map(([I, l, d, c]) => (
              <div key={l} aria-hidden className="rounded-xl p-4 flex flex-col gap-2" style={{ boxShadow: "inset 0 0 0 1px #e5e7eb" }}>
                <span className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}><I size={18} color={c} strokeWidth={1.6} />{l}</span>
                <span style={{ fontSize: 12, color: "#64748b", lineHeight: "18px" }}>{d}</span>
                <span style={{ fontSize: 12.5, color: color.brand, marginTop: 4 }}>지금 사용</span>
              </div>
            ))}
            <button type="button" onClick={onPick} className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:brightness-95 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ background: "#eef0f4", fontSize: 14, fontWeight: 600, color: "#111827" }}>
              <FolderOpen size={24} color="#334155" strokeWidth={1.6} />PDF 파일 열기
            </button>
          </div>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginTop: 32 }}>최근 항목</p>
        <p style={{ fontSize: 13.5, color: "#64748b", marginTop: 6 }}>딸깍 PDF에서 연 파일이 여기에 보여요. PDF를 이 화면 아무 곳에나 끌어다 놓아도 열려요.</p>
      </div>
    </div>
  );
}

/**
 * 편집기 여는 중 화면(에디터 공통, 2026-11-20) — dev의 "콘텐츠 렌더링 중" · "영상편집 준비 중" 화면을 하나로 맞춤.
 * 사용자 "아이콘보다 간단하게". 캐릭터 그림 없이: 브랜드색 회전 표시 + 한 줄 제목 + 얇은 진행 막대 + 회색 안내. 아래 화면이 흐리게 비친다.
 */
export function EditorLoading({ title, sub = "잠시만 기다려 주세요." }: { title: string; sub?: string }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center" style={{ ...f, background: "rgba(248,250,252,0.86)", backdropFilter: "blur(3px)" }} role="status" aria-live="polite">
      <Loader2 size={28} color={color.brand} className="animate-spin" strokeWidth={2} />
      <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginTop: 16 }}>{title}</p>
      <div className="mt-4 h-1 w-60 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
        <div className="h-full rounded-full ddk-loading-bar" style={{ background: color.brand }} />
      </div>
      <p style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>{sub}</p>
      <style>{`@keyframes ddkLoad { 0% { width: 8%; } 60% { width: 72%; } 100% { width: 96%; } } .ddk-loading-bar { animation: ddkLoad 1.1s cubic-bezier(.4,0,.2,1) forwards; } @media (prefers-reduced-motion: reduce) { .ddk-loading-bar { animation: none; width: 60%; } }`}</style>
    </div>
  );
}

/* ───────────── 이미지 편집기(캔버스형) ───────────── */

/**
 * 이미지 편집기 모양 흉내(2026-11-20, dev 캡처) — 가운데 캔버스(children)를 감싼다. 동작 없는 모양.
 * 2026-11-20 다듬기(사용자 "색감은 다른 에디터처럼, 크게 보기 · 닫기 같은 건 필요 없다, 버튼은 필요한 것만"):
 *  - 색: 오피스형과 같은 틀(도구 줄 · 패널 #f6f7f9, 선 #e5e7eb, 작업 바닥 #e9ebef, 캔버스 흰색). 짙은 체크무늬 · 보라 AI 색은 뺐다
 *  - 위: 회색 알약 [↺ │ ↶ ↷ │ − 62% +]만. ⛶ 화면에 맞추기 · 찾기/바꾸기 · 공유 · 저장 · 내보내기 · ⤢ · ✕는 뺐다 [내보내기]도 뺐다: 바깥 상단 바 [다운로드]로 옮김(파란 버튼이 공유와 겹쳐 거슬림). 뺀 것: ↺(버전 기록과 겹침), 찾기/바꾸기(이미지 한 장에는 거의 안 씀),
 *    공유 · 저장(바깥 상단 바의 공유 · 자동 저장과 겹침), ⤢ 크게 보기 · ✕ 닫기(바깥 틀이 이미 편집기 화면)
 *  - 왼쪽 도구: 선택 · 텍스트 · 도형 · 이미지 · 배경 · 그리기 · 지우개 │ 배경 제거 · HTML 분리. AI 생성 · AI 수정은 오른쪽 딸깍 AI와 겹쳐 뺐다
 *  - 아래: [마스터] [페이지 1] [+] ··· 1080 × 1080 px(키보드 단축키 버튼은 뺐다)
 */
export function ImageEditorFrame({ children }: { children: ReactNode }) {
  const BAR = "#f6f7f9";
  const LINE = "1px solid #e5e7eb";
  const ACC = "#2b6ce6";
  const tool = (I: Ico, l: string, opt: { on?: boolean; dim?: boolean } = {}) => (
    <span key={l} className="w-14 py-2 rounded-xl flex flex-col items-center gap-1" style={{ background: opt.on ? "#e3eafb" : undefined, opacity: opt.dim ? 0.45 : 1 }}>
      <I size={20} color={opt.on ? ACC : "#334155"} strokeWidth={1.7} />
      <span className="text-center" style={{ ...T, fontSize: 11, lineHeight: "13px", color: opt.on ? ACC : "#475569", fontWeight: opt.on ? 600 : 400 }}>{l}</span>
    </span>
  );
  const ticks = (n: number, from: number) => Array.from({ length: n }, (_, i) => from + i * 100);
  return (
    <div className="flex-1 min-h-0 flex flex-col whitespace-nowrap" style={{ ...f, background: BAR }}>
      {/* 위: dev처럼 회색 알약 하나 [↺ │ ↶ ↷ │ − 62% +](2026-11-20 사용자 "이런 식으로, 맨 마지막 아이콘 제외": ⛶ 화면에 맞추기만 뺐다) */}
      <div aria-hidden className="h-12 shrink-0 flex items-center px-3 overflow-hidden" style={{ borderBottom: LINE }}>
        <span className="shrink-0 h-9 px-3 rounded-xl flex items-center gap-3" style={{ background: "#eceef2" }}>
          <RotateCcw size={15} color="#94a3b8" /><span className="w-px h-4" style={{ background: "#d9dee5" }} />
          <Undo2 size={15} color="#94a3b8" /><Redo2 size={15} color="#94a3b8" /><span className="w-px h-4" style={{ background: "#d9dee5" }} />
          <Minus size={15} color="#334155" /><span style={{ ...T, fontSize: 13, fontWeight: 600, color: "#111827" }}>62%</span><Plus size={15} color="#334155" />
        </span>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div aria-hidden className="w-[72px] shrink-0 flex flex-col items-center gap-0.5 py-2 overflow-hidden" style={{ borderRight: LINE }}>
          {tool(MousePointer2, "선택", { on: true })}{tool(Type, "텍스트")}{tool(Shapes, "도형")}{tool(Image, "이미지")}{tool(PanelsTopLeft, "배경")}{tool(Pencil, "그리기", { dim: true })}{tool(Eraser, "지우개", { dim: true })}
          <span className="w-10 h-px my-1" style={{ background: "#e5e7eb" }} />
          {tool(Scissors, "배경 제거", { dim: true })}{tool(Code2, "HTML 분리")}
        </div>
        <div className="relative flex-1 min-w-0 flex flex-col">
          <div aria-hidden className="h-6 shrink-0 flex items-end overflow-hidden pl-6" style={{ background: BAR, borderBottom: LINE }}>
            {ticks(13, -100).map((t) => <span key={t} className="shrink-0 w-[60px]" style={{ ...T, fontSize: 9, color: "#94a3b8", borderLeft: "1px solid #d4d8de", paddingLeft: 3 }}>{t}</span>)}
          </div>
          <div className="flex-1 min-h-0 flex">
            <div aria-hidden className="w-6 shrink-0" style={{ background: BAR, borderRight: LINE }} />
            <div className="flex-1 min-w-0 overflow-auto ui-scroll flex items-center justify-center p-8" style={{ background: "#e9ebef" }}>
              <div className="w-full" style={{ maxWidth: 480 }}>{children}</div>
            </div>
          </div>
        </div>
        <div aria-hidden className="w-[232px] shrink-0 flex flex-col overflow-hidden" style={{ borderLeft: LINE }}>
          <div className="h-11 flex items-stretch" style={{ borderBottom: LINE }}>
            {["디자인", "레이어", "테마"].map((t, i) => <span key={t} className="flex-1 flex items-center justify-center" style={{ ...T, fontSize: 13, color: i === 0 ? ACC : "#64748b", fontWeight: i === 0 ? 600 : 400, boxShadow: i === 0 ? `inset 0 -2px 0 ${ACC}` : undefined }}>{t}</span>)}
          </div>
          <div className="flex flex-col items-center px-4 pt-8 gap-2">
            <span className="size-12 rounded-xl flex items-center justify-center" style={{ background: "#e3eafb" }}><MousePointer2 size={20} color={ACC} /></span>
            <span style={{ ...T, fontSize: 13.5, fontWeight: 700, color: "#111827", marginTop: 6 }}>요소를 선택해 보세요</span>
            <span className="text-center whitespace-normal" style={{ ...T, fontSize: 11.5, color: "#64748b", lineHeight: "17px" }}>캔버스에서 텍스트, 도형, 이미지를 누르면 속성을 고칠 수 있어요.</span>
            {[[Type, "텍스트 추가"], [Shapes, "도형 추가"], [Image, "이미지 추가"]].map(([I, l]) => { const Ic = I as Ico; return <span key={l as string} className="w-full h-9 mt-1 rounded-lg flex items-center gap-2 px-3" style={{ ...T, fontSize: 12.5, background: "#fff", boxShadow: "inset 0 0 0 1px #e5e7eb" }}><Ic size={14} />{l as string}</span>; })}
            {[[FileCode2, "HTML 업로드"], [FileText, "PDF 업로드"]].map(([I, l]) => { const Ic = I as Ico; return <span key={l as string} className="w-full h-10 mt-1 rounded-lg flex items-center justify-center gap-2" style={{ ...T, fontSize: 12.5, fontWeight: 600, border: "1.5px dashed #cfd5dd" }}><Ic size={14} />{l as string}</span>; })}
          </div>
        </div>
      </div>
      <div aria-hidden className="h-16 shrink-0 flex items-center gap-2 px-3" style={{ borderTop: LINE }}>
        <span className="w-14 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5" style={{ background: "#fff", boxShadow: "inset 0 0 0 1px #e5e7eb" }}><PanelTop size={15} color="#475569" /><span style={{ ...T, fontSize: 10.5, color: "#475569", fontWeight: 600 }}>마스터</span></span>
        <span className="w-12 h-12 rounded-lg relative" style={{ boxShadow: `inset 0 0 0 1.5px ${ACC}`, background: "#fff" }}><span className="absolute left-1 top-0.5" style={{ ...T, fontSize: 9, color: "#64748b" }}>1</span></span>
        <span className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ border: "1.5px dashed #cfd5dd" }}><Plus size={16} color="#94a3b8" /></span>
        <span className="ml-auto" style={{ ...T, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>1080 × 1080 px</span>
      </div>
    </div>
  );
}

/* ───────────── 영상 편집기(타임라인형) ───────────── */

/**
 * 영상 편집기 모양 흉내(2026-11-20, 사용자가 보낸 dev 캡처) — 동작 없는 모양. 가운데 미리보기(preview)와 장면(scenes)만 받는다.
 *  ┌ 왼쪽: 세로 아이콘(미디어 · 텍스트 · 스티커 · 효과 · 자막 · 설정) + [미디어 ☰ ⇅ | ⬆ 가져오기] + 끌어다 놓기 칸
 *  ├ 가운데: 미리보기(검정 화면) + 아래 [00:00:00:00 / 00:00:00:00 · ▶ · 맞춤 ▾ · ⛶]
 *  ├ 오른쪽: 속성 패널(클립을 고르기 전 "비어 있어요")
 *  └ 아래 타임라인: [자르기 · 정렬 · 연결 · 복제 · 멈춤 · 삭제 · 표시 · 키프레임 | 기본 장면 ◫ | 자석 · ↔ · − ━ +] + 눈금 + 트랙(소리 · 보기 · 영상)
 * dev 맨 위 줄 [🎞 새 프로젝트 ··· 내보내기 ☀]은 그리지 않는다: 파일 이름과 [내보내기]는 바깥 상단 바에 이미 있다(사용자 "새 프로젝트 또 써야 하나, 위에 고정").
 * 색은 다른 편집기 틀과 같은 결: 바닥 #eef0f3 위 흰 패널(선 #e5e7eb).
 * 좁을 때: 틀 너비 960px 밑에서 오른쪽 속성 패널, 640px 밑에서 왼쪽 미디어 패널을 숨겨 미리보기 자리를 지킨다.
 */
export function VideoEditorFrame({ preview, scenes = [], tall }: { preview: ReactNode; scenes?: string[]; tall?: boolean }) {
  const LINE = "1px solid #e5e7eb";
  const card = { background: "#fff", border: LINE, borderRadius: 10 } as const;
  const ACC = "#2b6ce6";
  const ic = (I: Ico, k: string, c = "#475569") => <I key={k} size={16} color={c} strokeWidth={1.8} />;
  const ticks = ["0:00", "15f", "00:01", "15f", "00:02", "15f", "00:03", "15f"];
  const sceneColors = ["#dbe7fb", "#dcf3e4", "#fdf0cf", "#fbe1ec", "#e8e2fb"];
  return (
    <div className="@container flex-1 min-h-0 flex flex-col gap-1.5 p-1.5 whitespace-nowrap" style={{ ...f, background: "#eef0f3" }}>
      <div className="flex-1 min-h-0 flex gap-1.5">
        {/* 왼쪽: 아이콘 줄 + 미디어 */}
        <div aria-hidden className="w-[276px] shrink-0 hidden @[640px]:flex overflow-hidden" style={card}>
          <div className="w-11 shrink-0 flex flex-col items-center gap-1 py-2" style={{ borderRight: LINE }}>
            {([[Folder, "미디어"], [Type, "텍스트"], [Smile, "스티커"], [Wand2, "효과"], [Captions, "자막"], [Settings, "설정"]] as [Ico, string][]).map(([I, l], i) => (
              <span key={l} className="size-8 rounded-lg flex items-center justify-center" style={{ background: i === 0 ? "#e3eafb" : undefined }}><I size={16} color={i === 0 ? ACC : "#64748b"} strokeWidth={1.8} /></span>
            ))}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="h-11 shrink-0 flex items-center gap-2 px-3" style={{ borderBottom: LINE }}>
              <span style={{ ...T, color: "#64748b" }}>미디어</span>
              <span className="ml-auto flex items-center gap-2">{ic(List, "l")}{ic(ArrowDownUp, "s")}</span>
              <span className="h-7 px-2 rounded-md flex items-center gap-1" style={{ ...T, fontSize: 12, boxShadow: "inset 0 0 0 1px #e5e7eb" }}><CloudUpload size={13} />가져오기</span>
            </div>
            <div className="m-2 rounded-lg flex flex-col items-center justify-center gap-3 text-center" style={{ background: "#f6f7f9", height: 150 }}>
              <CloudUpload size={26} color="#334155" strokeWidth={1.6} />
              <span className="whitespace-normal" style={{ ...T, fontSize: 11.5, color: "#94a3b8", lineHeight: "17px", padding: "0 16px" }}>동영상, 사진, 오디오 파일을 여기에 끌어다 놓아 주세요</span>
            </div>
          </div>
        </div>
        {/* 가운데: 미리보기 */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={card}>
          {/* 미리보기 칸 크기에 맞춰 비율 그대로 가장 크게(container 단위) */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-3">
            <div className="w-full h-full flex items-center justify-center" style={{ containerType: "size" }}>
              <div className="relative overflow-hidden" style={{ width: tall ? "min(100cqw, 100cqh * 9 / 16)" : "min(100cqw, 100cqh * 16 / 9)", aspectRatio: tall ? "9 / 16" : "16 / 9", background: "#000" }} aria-label="미리보기">{preview}</div>
            </div>
          </div>
          <div aria-hidden className="h-11 shrink-0 flex items-center gap-3 px-4">
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11.5, color: ACC }}>00:00:00:00</span>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11.5, color: "#64748b" }}>/ 00:00:00:00</span>
            <span className="mx-auto"><Play size={16} color="#334155" /></span>
            <span className="h-7 px-2 rounded-md flex items-center gap-1" style={{ ...T, fontSize: 12, background: "#f1f3f6" }}>맞춤<ChevronDown size={12} /></span>
            <Maximize size={15} color="#475569" />
          </div>
        </div>
        {/* 오른쪽: 속성 */}
        <div aria-hidden className="w-[232px] shrink-0 hidden @[960px]:flex flex-col items-center justify-center gap-2 text-center px-4" style={card}>
          <span className="size-10 rounded-xl flex items-center justify-center" style={{ boxShadow: "inset 0 0 0 1.5px #cbd5e1" }}><SlidersHorizontal size={18} color="#475569" /></span>
          <span style={{ ...T, fontSize: 14, fontWeight: 600, color: "#111827", marginTop: 4 }}>비어 있어요</span>
          <span className="whitespace-normal" style={{ ...T, fontSize: 11.5, color: "#94a3b8", lineHeight: "17px" }}>타임라인에서 클립을 누르면 속성을 고칠 수 있어요.</span>
        </div>
      </div>
      {/* 아래: 타임라인 */}
      <div className="shrink-0 flex flex-col overflow-hidden" style={{ ...card, height: 236 }}>
        <div aria-hidden className="h-10 shrink-0 flex items-center gap-3 px-3" style={{ borderBottom: LINE }}>
          {[ic(Scissors, "a"), ic(AlignStartVertical, "b"), ic(AlignEndVertical, "c"), ic(Link, "d", "#cbd5e1"), ic(Copy, "e"), ic(Snowflake, "f"), ic(Trash2, "g"), <span key="sep" className="w-px h-4" style={{ background: "#e5e7eb" }} />, ic(Bookmark, "h"), ic(ChartLine, "i", "#cbd5e1")]}
          <span className="mx-auto flex items-center rounded-lg overflow-hidden" style={{ background: "#f1f3f6" }}>
            <span className="h-7 px-2.5 flex items-center" style={{ ...T, fontSize: 12 }}>기본 장면</span>
            <span className="h-7 px-2 flex items-center" style={{ borderLeft: "1px solid #e2e5ea" }}><Layers size={14} color="#475569" /></span>
          </span>
          <span className="size-7 rounded-md flex items-center justify-center" style={{ background: "#e3eafb" }}><Magnet size={15} color={ACC} /></span>
          {ic(MoveHorizontal, "j")}
          <span className="w-px h-4" style={{ background: "#e5e7eb" }} />
          {ic(ZoomOut, "k")}
          <span className="relative w-24 h-1 rounded-full" style={{ background: "#e2e5ea" }}><span className="absolute -top-1 left-0 size-3 rounded-full bg-white" style={{ boxShadow: "0 0 0 1px #94a3b8" }} /></span>
          {ic(ZoomIn, "m")}
        </div>
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div aria-hidden className="h-6 shrink-0 flex items-end" style={{ paddingLeft: 112, borderBottom: "1px solid #f1f3f6" }}>
            {ticks.map((t, i) => <span key={i} className="shrink-0 w-[70px]" style={{ ...T, fontSize: 9.5, color: "#94a3b8", borderLeft: "1px solid #e2e5ea", paddingLeft: 3 }}>{t}</span>)}
          </div>
          <div className="flex-1 min-h-0 flex items-center">
            <span aria-hidden className="w-28 shrink-0 flex items-center justify-center gap-3">{ic(Volume2, "v", "#94a3b8")}{ic(Eye, "w", "#94a3b8")}{ic(Video, "x", "#94a3b8")}</span>
            <div className="flex-1 min-w-0 flex gap-1 pr-3" style={{ height: 44 }} aria-label="타임라인">
              {scenes.map((sc, i) => (
                <span key={`${sc}${i}`} className="rounded-md flex items-center px-2 truncate" style={{ width: 180, background: sceneColors[i % 5], ...T, fontSize: 11.5, fontWeight: 600 }}>{sc}</span>
              ))}
            </div>
          </div>
          <span aria-hidden className="absolute top-0 bottom-0 w-px" style={{ left: 112, background: ACC }}><span className="absolute -left-1 top-0.5 size-2 rounded-full" style={{ background: ACC }} /></span>
        </div>
      </div>
    </div>
  );
}
