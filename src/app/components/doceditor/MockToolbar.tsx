import type { ComponentType } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, BarChart3, Bold, Captions, ChevronDown, Crop, Eraser, Filter, Highlighter,
  Image, IndentIncrease, Italic, List, ListOrdered, Merge, Music, PaintBucket, Percent, Plus, Scissors, Shapes, Sigma, SlidersHorizontal,
  Strikethrough, Table, Type, Underline, Undo2, Redo2, Wand2,
} from "lucide-react";

import { f, editorType } from "@/app/styleTokens";

import type { DocKind } from "./docTemplates";

/**
 * 편집기 도구 모음 목업(2026-11-19) — 실제 오픈소스 에디터가 들어올 자리.
 * 예전엔 회색 네모 14개 + "오픈소스 영역(목업)" 글자라 덜 만든 화면처럼 보였다(사용자 "친숙한 느낌이 안 난다").
 * 한글·워드·엑셀·파워포인트에서 늘 보던 모양(되돌리기 · 글꼴 · 크기 · 굵게/기울임/밑줄 · 정렬 · 목록 · 표·그림)으로 보여 준다.
 * 아직 동작하지 않는 모양이라 화면 읽기 도구에는 숨긴다(aria-hidden).
 */
type Item = ComponentType<{ size?: number; color?: string; strokeWidth?: number }> | "|" | { select: string; w: number } | { text: string };

const UNDO: Item[] = [Undo2, Redo2, "|"];
const FONT = (font: string, size: string): Item[] => [{ select: font, w: 112 }, { select: size, w: 68 }, "|"];
const TEXT: Item[] = [Bold, Italic, Underline, Strikethrough, Baseline, Highlighter, "|"];
const ALIGN: Item[] = [AlignLeft, AlignCenter, AlignRight, AlignJustify, "|"];

const BAR: Record<DocKind, Item[]> = {
  hangul: [...UNDO, { select: "바탕글", w: 88 }, ...FONT("함초롬바탕", "10.0"), ...TEXT, ...ALIGN, List, ListOrdered, IndentIncrease, "|", Table, Image, Shapes],
  word: [...UNDO, { select: "표준", w: 72 }, ...FONT("맑은 고딕", "11"), ...TEXT, ...ALIGN, List, ListOrdered, IndentIncrease, "|", Table, Image, Shapes],
  excel: [...UNDO, ...FONT("맑은 고딕", "11"), Bold, Italic, Underline, Baseline, PaintBucket, "|", AlignLeft, AlignCenter, AlignRight, Merge, "|", { text: "₩" }, Percent, { text: ".00" }, "|", Sigma, Filter, BarChart3],
  ppt: [...UNDO, { text: "+ 새 슬라이드" }, "|", ...FONT("Pretendard", "24"), Bold, Italic, Underline, Baseline, "|", AlignLeft, AlignCenter, AlignRight, "|", Type, Shapes, Image, Table],
  pdf: [...UNDO, Type, Highlighter, Eraser, "|", Image, Crop, "|", { select: "100%", w: 72 }],
  video: [...UNDO, Scissors, Crop, "|", Captions, Type, Music, "|", SlidersHorizontal, Wand2, Plus],
  image: [...UNDO, Crop, Eraser, "|", Type, Shapes, Image, "|", SlidersHorizontal, Wand2],
};

export function MockToolbar({ kind }: { kind: DocKind }) {
  return (
    <div className="shrink-0 flex items-center gap-1 bg-white px-3 overflow-hidden" style={{ ...f, height: 48, borderBottom: "1px solid #e2e8f0" }} aria-hidden>
      {BAR[kind].map((it, i) => {
        if (it === "|") return <span key={i} className="shrink-0 mx-1" style={{ width: 1, height: 20, background: "#e2e8f0" }} />;
        if (typeof it === "object" && "select" in it) {
          return (
            <span key={i} className="shrink-0 h-8 px-2 rounded-md flex items-center justify-between gap-1" style={{ width: it.w, boxShadow: "inset 0 0 0 1px #e2e8f0", fontSize: editorType.label, color: "#334155" }}>
              <span className="truncate">{it.select}</span><ChevronDown size={14} color="#94a3b8" />
            </span>
          );
        }
        if (typeof it === "object" && "text" in it) {
          return <span key={i} className="shrink-0 h-8 px-2 rounded-md flex items-center" style={{ fontSize: editorType.label, fontWeight: 600, color: "#334155" }}>{it.text}</span>;
        }
        const Icon = it;
        return <span key={i} className="shrink-0 size-8 rounded-md flex items-center justify-center"><Icon size={18} color="#475569" strokeWidth={1.8} /></span>;
      })}
    </div>
  );
}
