import { useMemo, useState } from "react";
import { LayoutGrid, Plus, Search, Sparkles, X } from "lucide-react";

import { Button } from "@/app/components/common/Button";
import { Modal } from "@/app/components/common/Modal";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";
import { color, f, editorType } from "@/app/styleTokens";

import { DOC_CATEGORIES, templatesFor, type DocKind, type DocTemplate } from "./docTemplates";
import { PaperThumb } from "./PaperThumb";
import { ChipRow } from "@/app/components/editor-shell/ChipRow";

/**
 * 한글·워드 편집기 왼쪽 템플릿 패널(2026-11-19). 기획: docs/doc-editor.md "2-2".
 *   - 폭 300px · 검색 + 용도 칩(형식 칩 없음) · 맨 앞 "빈 문서" · 2열 카드(종이 미리보기 + 제목 한 줄). PPT는 16:9라 1열 큰 미리보기
 *   - 카드를 누르면 바로 바꾸지 않고 미리보기 창(TemplatePreview)을 띄운다.
 *   - 결과가 없으면 딸깍 AI로 이어 준다.
 */
export function TemplatePanel({ kind, width = 300, onPreview, onBlank, onAskAi, onClose }: {
  kind: DocKind;
  /** 패널 너비(끌어서 조절, 2026-11-19). 넓히면 카드가 한 줄에 더 들어간다 */
  width?: number;
  onPreview: (t: DocTemplate) => void;
  onBlank: () => void;
  onAskAi: (query: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("전체");
  const all = useMemo(() => templatesFor(kind), [kind]);
  const q = query.trim().toLowerCase();
  const list = all.filter((x) => (cat === "전체" || x.category === cat) && (!q || [x.title, x.use, x.category, ...x.sections].join(" ").toLowerCase().includes(q)));
  const chips = ["전체", ...DOC_CATEGORIES[kind]];

  return (
    <div className="h-full flex flex-col bg-white" style={{ ...f, width }}>
      <div className="flex items-center gap-2 shrink-0" style={{ height: 48, padding: "0 8px 0 16px", borderBottom: "1px solid #eef0f3" }}>
        <LayoutGrid size={15} color="#334155" />
        <span style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>템플릿</span>
        <IconTooltip label="템플릿 닫기"><button type="button" aria-label="템플릿 닫기" onClick={onClose} className="ml-auto size-8 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
          <X size={15} color="#475569" />
        </button></IconTooltip>
      </div>

      <div className="shrink-0 px-3 pt-3 pb-2">
        <label className="field-pill flex items-center gap-2 h-10 px-3 rounded-lg border border-transparent" style={{ background: "#f3f4f6" }}>
          <Search size={14} color="#94a3b8" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={{ hangul: "공문, 신청서, 기안서…", word: "보고서, 회의록, 자기소개서…", excel: "견적, 지출, 급여…", ppt: "제안서, 실적 보고, 강의…", pdf: "", video: "숏폼, 브이로그, 리뷰…", image: "할인, 카드뉴스, 썸네일…" }[kind]}
            aria-label="템플릿 검색"
            className="field-inline flex-1 min-w-0 bg-transparent outline-none" style={{ fontSize: editorType.body, color: "#111827" }}
          />
          {query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")}><X size={13} color="#94a3b8" /></button>}
        </label>
        <div className="mt-3"><ChipRow label="용도" selectedKey={cat}>
          {chips.map((c) => {
            const on = c === cat;
            return (
              <button
                key={c} type="button" role="tab" aria-selected={on} onClick={() => setCat(c)}
                className="shrink-0 whitespace-nowrap h-8 px-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f7bff]"
                style={{ fontSize: editorType.label, fontWeight: on ? 700 : 500, color: on ? "#fff" : "#475569", background: on ? "#111827" : "#fff", boxShadow: on ? undefined : "inset 0 0 0 1px #e2e8f0" }}
              >
                {c}
              </button>
            );
          })}
        </ChipRow></div>
      </div>

      <div className="flex-1 overflow-y-auto ui-scroll px-3 pb-4">
        {list.length === 0 ? (
          <div className="text-center" style={{ padding: "36px 8px" }}>
            <p style={{ fontSize: editorType.large, fontWeight: 600, color: "#111827" }}>찾는 템플릿이 없어요</p>
            <p style={{ fontSize: editorType.label, color: "#64748b", marginTop: 4, wordBreak: "keep-all" }}>딸깍 AI에게 만들어 달라고 해 보세요.</p>
            <button
              type="button" onClick={() => onAskAi(query.trim())}
              className="mt-3 inline-flex items-center gap-2 h-8 px-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
              style={{ background: color.surface.accent, color: color.brand, fontSize: editorType.body, fontWeight: 700 }}
            >
              <Sparkles size={14} />AI에게 부탁하기
            </button>
          </div>
        ) : (
          <div className="grid gap-x-3 gap-y-3 pt-1" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${kind === "ppt" ? 200 : 120}px, 1fr))` }}>
            {cat === "전체" && !q && (
              <button type="button" onClick={onBlank} className="group text-left outline-none">
                <span className="flex items-center justify-center rounded-lg transition-colors group-hover:bg-[#f8fafc] group-focus-visible:ring-2 group-focus-visible:ring-[#4f7bff]" style={{ aspectRatio: kind === "ppt" ? "16 / 9" : kind === "video" ? "9 / 16" : kind === "image" ? "1 / 1" : "1 / 1.414", border: "1.5px dashed #cbd5e1" }}>
                  <Plus size={20} color="#94a3b8" />
                </span>
                <span className="block truncate mt-2" style={{ fontSize: editorType.body, fontWeight: 600, color: "#111827" }}>{{ ppt: "빈 프레젠테이션", excel: "빈 시트", video: "빈 프로젝트", image: "빈 캔버스" }[kind as string] ?? "빈 문서"}</span>
                <span className="block" style={{ fontSize: editorType.caption, color: "#94a3b8" }}>템플릿 없이 시작</span>
              </button>
            )}
            {list.map((x) => (
              <button key={x.id} type="button" onClick={() => onPreview(x)} className="group text-left outline-none" aria-label={`${x.title} 미리보기`}>
                <span className="block rounded-lg overflow-hidden transition-shadow group-hover:shadow-[0_0_0_2px_#4f7bff] group-focus-visible:shadow-[0_0_0_2px_#4f7bff]" style={{ boxShadow: "0 0 0 1px #e2e8f0" }}>
                  <PaperThumb template={x} scale={kind === "ppt" ? 2 : 1.25} />
                </span>
                <span className="block truncate mt-2" style={{ fontSize: editorType.body, fontWeight: 600, color: "#111827" }} title={x.title}>{x.title}</span>
                <span className="block" style={{ fontSize: editorType.caption, color: "#94a3b8" }}>{x.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 템플릿 미리보기 창 — 큰 종이 · 이럴 때 써요 · 들어 있는 항목 · [이 서식으로 시작] [AI로 내용 채우기].
 * 지금 문서에 내용이 있으면 적용 전에 "새 문서로 열기 / 지금 문서 바꾸기"를 묻는다(docs/doc-editor.md "2-2").
 */
export function TemplatePreview({ template, docHasContent, onApply, onClose, guide }: {
  template: DocTemplate;
  docHasContent: boolean;
  /** 시작 튜토리얼 2단계 중이면 어떤 버튼을 누를지 짚어 준다(docs/starter-tour.md) */
  guide?: boolean;
  onApply: (opts: { withAi: boolean; target: "new" | "replace" }) => void;
  onClose: () => void;
}) {
  const [asking, setAsking] = useState<null | { withAi: boolean }>(null);
  const start = (withAi: boolean, close: () => void) => {
    if (docHasContent) { setAsking({ withAi }); return; }
    onApply({ withAi, target: "replace" });
    close();
  };
  const wide = template.layout === "slide";
  return (
    <Modal onClose={onClose} ariaLabel={`${template.title} 템플릿 미리보기`} maxWidth={wide ? 600 : 760}>
      {(close) => (
        <div className={`relative flex flex-col ${wide ? "" : "sm:flex-row sm:items-start"} gap-8`} style={{ ...f, padding: 32 }}>
          {/* 닫기는 창 오른쪽 위 모서리 한 곳(가로 서식에서 글 머리에 두면 창 가운데에 떠 보였다) */}
          <IconTooltip label="닫기"><button type="button" aria-label="닫기" onClick={close} className="absolute top-4 right-4 z-10 size-9 flex items-center justify-center rounded-full hover:bg-black/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ background: "rgba(255,255,255,0.92)" }}><X size={18} color="#334155" /></button></IconTooltip>
          {/* 미리보기는 서식 비율 그대로(2026-11-19 "너무 납작"): 오른쪽 글 높이에 맞춰 늘어나 아래가 비던 것을 없앴다.
              세로·정사각 서식은 옆에 크게, 가로(슬라이드 16:9) 서식은 위에 가로로 넓게 */}
          <div className={`shrink-0 rounded-xl overflow-hidden ${wide ? "w-full" : "mx-auto sm:mx-0"}`} style={{ width: wide ? undefined : template.layout === "square" ? 340 : 300, boxShadow: "0 0 0 1px #e2e8f0, 0 8px 24px rgba(15,23,42,0.08)" }}>
            <PaperThumb template={template} scale={2.4} />
          </div>
          <div className={`flex-1 min-w-0 flex flex-col ${wide ? "" : "sm:self-stretch"}`}>
            <div className="flex items-start gap-2">
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: editorType.caption, fontWeight: 700, color: color.brand, background: color.surface.accent }}>{template.category}</span>

            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0a0a0a", letterSpacing: "-0.5px", marginTop: 12, wordBreak: "keep-all" }}>{template.title}</h2>
            <p style={{ fontSize: editorType.body, fontWeight: 700, color: "#64748b", marginTop: 24 }}>이럴 때 써요</p>
            <p style={{ fontSize: editorType.large, lineHeight: "22px", color: "#1e293b", marginTop: 8, wordBreak: "keep-all" }}>{template.use}</p>
            <p style={{ fontSize: editorType.body, fontWeight: 700, color: "#64748b", marginTop: 24 }}>들어 있는 항목</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {template.sections.map((s) => <li key={s} className="rounded-md px-2 py-1" style={{ fontSize: editorType.body, color: "#334155", background: "#f1f5f9" }}>{s}</li>)}
            </ul>
            <div className="mt-auto pt-8">
              {asking ? (
                <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} role="group" aria-label="열 방법">
                  <p style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>지금 문서에 쓴 내용이 있어요. 어떻게 열까요?</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button variant="primary" size="md" onClick={() => { onApply({ withAi: asking.withAi, target: "new" }); close(); }}>새 문서로 열기</Button>
                    <Button variant="secondary" size="md" onClick={() => { onApply({ withAi: asking.withAi, target: "replace" }); close(); }}>지금 문서 바꾸기</Button>
                    <Button variant="secondary" size="md" onClick={() => setAsking(null)}>취소</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="md" onClick={() => start(false, close)} data-starter-pulse={guide ? "" : undefined}>이 서식으로 시작</Button>
                  <Button variant="secondary" size="md" onClick={() => start(true, close)} style={{ color: color.brand }}>
                    <Sparkles size={15} />AI로 내용 채우기
                  </Button>
                </div>
              )}
              {guide && !asking ? (
                /* 튜토리얼 중엔 회색 설명 대신 누를 곳을 짚는다(2026-11-20 "양식 누르면 뭘 선택할지 가이드") */
                <p className="flex items-start gap-2 rounded-lg" style={{ fontSize: editorType.body, lineHeight: "20px", color: "#1e293b", background: color.surface.accent, padding: "10px 12px", marginTop: 12, wordBreak: "keep-all" }}>
                  <span aria-hidden className="shrink-0 rounded-full" style={{ fontSize: 11, fontWeight: 700, color: color.brand, background: "#fff", padding: "1px 6px", marginTop: 1 }}>2/3</span>
                  <span><b style={{ fontWeight: 700 }}>이 서식으로 시작</b>을 눌러 양식만 넣어 봐요. 내용은 다음 단계에서 딸깍 AI가 채워 줘요.</span>
                </p>
              ) : (
                <p style={{ fontSize: editorType.caption, color: "#94a3b8", marginTop: 12, wordBreak: "keep-all" }}>
                  AI로 내용 채우기: 서식을 넣고, 오른쪽 딸깍 AI에 이 서식의 빈칸이 열려요. 적은 내용으로 견본 글을 바꿔 줘요.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

