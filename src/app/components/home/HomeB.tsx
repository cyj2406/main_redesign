import { useMemo, useState } from "react";
import { ArrowRight, FileText, Search, Sparkles, X } from "lucide-react";

import { EDITOR_APPS, type EditorAppId } from "@/app/components/editor-shell/apps";
import { relTime } from "@/app/components/editor-shell/comments";
import { DOC_TEMPLATES, type DocKind, type DocTemplate } from "@/app/components/doceditor/docTemplates";
import { PaperThumb } from "@/app/components/doceditor/PaperThumb";
import RecommendedCarousel from "@/app/components/home/RecommendedCarousel";
import type { RecentEditorFile } from "@/app/state/recentEditorFiles";
import { color, f } from "@/app/styleTokens";

/**
 * 홈 B안(2026-11-20 시안, 지금 홈은 그대로 두고 오른쪽 아래 스위치로 비교). 기획: docs/home-plan-b.md.
 * 딸깍넷이 ChatGPT · Claude와 다른 점 = "정확한 양식 + 원하는 느낌의 템플릿 + 직접 고치는 에디터".
 * 그래서 맨 위 입력창은 답을 쓰지 않고 ① 정확한 양식 ② 디자인 템플릿 ③ 빈 편집기에서 AI로 시작, 세 갈래로 안내한다.
 * 아래로 새로 만들기(편집기 8개 = 새 빈 파일) → 최근 작업(이어서 하기) → 편집기별 템플릿.
 * 지우려면: 이 파일 + App.tsx의 HomeB · homeVariant · HomeVariantSwitch 부분만 지우면 된다.
 */

const FORM_KINDS: DocKind[] = ["hangul", "word", "excel"];
const DESIGN_KINDS: DocKind[] = ["ppt", "image", "video"];
const KIND_LABEL: Record<string, string> = Object.fromEntries(EDITOR_APPS.map((a) => [a.id, a.label]));
const KIND_ART: Record<string, string> = Object.fromEntries(EDITOR_APPS.map((a) => [a.id, a.art]));
/** 새로 만들기 칸의 한 줄 설명 — 무엇을 만들 때 누르는지(파일 형식보다 하는 일) */
const MAKE_HINT: Record<EditorAppId, string> = {
  hangul: "공문, 신청서", word: "보고서, 안내문", excel: "표, 계산, 견적", ppt: "발표 자료",
  pdf: "PDF 고치기", uidesign: "앱, 웹 화면", image: "카드뉴스, 홍보물", video: "짧은 영상",
};
const EXAMPLES = ["행사 개최 공문", "견적서", "회사 소개 발표", "카드뉴스", "주간 업무 보고"];

/** 적은 말로 어느 편집기가 맞을지 고른다(빈 화면에서 AI로 시작할 때) */
function guessKinds(q: string): DocKind[] {
  const s = q.replace(/\s/g, "");
  if (/엑셀|표|견적|정산|급여|일정|예산|재고|가계부/.test(s)) return ["excel"];
  if (/발표|피피티|ppt|슬라이드|제안서|소개서|IR/i.test(s)) return ["ppt"];
  if (/카드뉴스|포스터|배너|썸네일|홍보물|이미지|인스타|SNS/i.test(s)) return ["image"];
  if (/영상|숏폼|릴스|브이로그|유튜브/.test(s)) return ["video"];
  if (/공문|신청서|확인서|기안|결재|계약/.test(s)) return ["hangul"];
  return ["hangul", "word"];
}
function matches(t: DocTemplate, q: string) {
  const words = q.trim().split(/\s+/).filter(Boolean);
  const hay = `${t.title} ${t.category} ${t.use} ${t.sections.join(" ")} ${KIND_LABEL[t.kind]}`;
  return words.length > 0 && words.some((w) => hay.includes(w) || (w.length > 2 && hay.includes(w.slice(0, -1))));
}

const H2 = { ...f, fontSize: 20, fontWeight: 700, color: color.text.primary, letterSpacing: "-0.5px" } as const;
const SUB = { ...f, fontSize: 14, color: color.text.secondary, letterSpacing: "-0.2px" } as const;

export function HomeB({ recent, onOpenEditor, onOpenTemplate, onAskAi, onOpenRecent, onHelp, onViewAllTemplates }: {
  /** 큰 템플릿 캐러셀의 "전체 보기" */
  onViewAllTemplates: () => void;
  /** 최근 편집기 파일 — App이 편집기를 닫을 때마다 다시 읽은 목록(사이드바와 같은 것) */
  recent: RecentEditorFile[];
  onOpenEditor: (kind: EditorAppId) => void;
  onOpenTemplate: (tpl: DocTemplate, withAi: boolean) => void;
  onAskAi: (kind: DocKind, prompt: string) => void;
  onOpenRecent: (rf: RecentEditorFile) => void;
  onHelp: () => void;
}) {
  const [q, setQ] = useState("");
  const found = useMemo(() => {
    if (!q.trim()) return null;
    const hits = DOC_TEMPLATES.filter((t) => matches(t, q));
    return { forms: hits.filter((t) => FORM_KINDS.includes(t.kind)).slice(0, 4), designs: hits.filter((t) => DESIGN_KINDS.includes(t.kind)).slice(0, 4), kinds: guessKinds(q) };
  }, [q]);
  // 그림(cover)이 있는 템플릿을 앞에 — 실제 결과물 그림이 눈에 먼저 들어오게

  return (
    <main className="flex-1 overflow-y-auto pb-16" style={{ ...f, paddingLeft: "var(--gap-screen-x)", paddingRight: "var(--gap-screen-x)" }}>
      <div className="w-full mx-auto flex flex-col" style={{ maxWidth: "var(--home-container)", gap: 48, paddingTop: 48 }}>

        {/* ① 무엇을 만들까요 — 양식 · 템플릿 · 빈 편집기로 안내하는 입력창 */}
        <section className="flex flex-col items-center text-center">
          <h1 style={{ fontSize: "var(--hero-title-size)", fontWeight: 700, letterSpacing: "var(--hero-title-tracking)", color: "#0a0a0a", lineHeight: 1.3, wordBreak: "keep-all" }}>
            {/* 2026-11-20 문구(사용자 "딸깍이 들어가면 좋겠다"): 지금 홈 "딸깍 한 번이면, 작업은 더 빠르게"의 말투를 잇고, B안이 하는 일(양식 찾기 → AI 채우기)을 한 줄로 */}
            <span style={{ color: color.brand }}>딸깍</span> 한 번이면, 양식부터 내용까지
          </h1>
          <p style={{ ...SUB, fontSize: 16, marginTop: 12 }}>만들 문서를 적으면 맞는 양식을 찾아 AI가 채워 줘요. 고칠 곳은 편집기에서 바로 고치면 돼요.</p>
          <label className="field-pill w-full max-w-[760px] flex items-center gap-3 mt-6 px-5 h-16 rounded-full bg-white border" style={{ borderColor: color.border.default, boxShadow: "0 4px 16px rgba(15,23,42,0.06)" }}>
            <Search size={20} color={color.text.secondary} className="shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="무엇을 만들까요? 예: 행사 개최 공문, 카페 홍보 이미지" className="field-inline flex-1 min-w-0 bg-transparent outline-none placeholder:text-[#64748b]" style={{ fontSize: 16, color: color.text.primary }} aria-label="만들 문서 찾기" />
            {q && <button type="button" aria-label="지우기" onClick={() => setQ("")} className="size-8 rounded-full flex items-center justify-center hover:bg-[#f1f5f9]"><X size={16} color="#64748b" /></button>}
          </label>
          {!found && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" onClick={() => setQ(x)} className="h-9 px-4 rounded-full hover:bg-[#f1f5f9] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: `1px solid ${color.border.default}`, fontSize: 14, color: "#1e293b" }}>{x}</button>
              ))}
              <button type="button" onClick={onHelp} className="h-9 px-4 rounded-full inline-flex items-center gap-1 hover:bg-[#eef2ff] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 14, color: color.brand, fontWeight: 600 }}>
                <Sparkles size={15} />막막하면 요청 작성 도우미
              </button>
            </div>
          )}
        </section>

        {found && (
          <section className="flex flex-col gap-8 -mt-4" aria-label="찾은 결과">
            <ResultGroup no="1" title="정확한 양식" sub="공문, 신청서, 보고서를 서식 그대로" items={found.forms} empty="맞는 양식이 아직 없어요." onOpen={onOpenTemplate} />
            <ResultGroup no="2" title="디자인 템플릿" sub="원하는 느낌을 눈으로 골라요" items={found.designs} empty="맞는 디자인 템플릿이 아직 없어요." onOpen={onOpenTemplate} />
            <div>
              <GroupHead no="3" title="빈 화면에서 시작" sub="양식 없이 편집기를 열고 딸깍 AI가 바로 써요" />
              <div className="flex flex-wrap gap-3 mt-3">
                {found.kinds.map((k) => (
                  <button key={k} type="button" onClick={() => onAskAi(k, q.trim())} className="group h-14 pl-3 pr-4 rounded-2xl flex items-center gap-3 bg-white hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: `1px solid ${color.border.default}` }}>
                    <img src={KIND_ART[k]} alt="" className="size-8 object-contain" />
                    <span style={{ fontSize: 15, fontWeight: 600, color: color.text.primary }}>{KIND_LABEL[k]}에서 AI로 “{q.trim()}” 쓰기</span>
                    <ArrowRight size={16} color="#94a3b8" className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ② 새로 만들기 — 검색창 바로 아래 큰 그림 아이콘 줄(지금 홈처럼 눈에 먼저 들어오게, 2026-11-20 "시각적으로 확 사로잡는 형태"). 누르면 빈 파일 */}
        {!found && (
          <section className="-mt-4" aria-label="새로 만들기" data-onboarding="new-row">
            <div className="flex items-center gap-3" style={{ color: color.text.secondary }}>
              <span className="flex-1 h-px" style={{ background: color.border.default }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>새로 만들기</span>
              <span className="flex-1 h-px" style={{ background: color.border.default }} />
            </div>
            <div className="grid mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))", gap: 4 }}>
              {EDITOR_APPS.map((a) => (
                <button key={a.id} type="button" onClick={() => onOpenEditor(a.id)} aria-label={`${a.label} 새로 만들기`} className="group flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1 hover:bg-[#f1f5f9] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
                  <img src={a.art} alt="" className="size-20 object-contain transition-transform group-hover:-translate-y-1" />
                  <span style={{ fontSize: 16, fontWeight: 700, color: color.text.primary, marginTop: 4 }}>{a.label}</span>
                  <span className="whitespace-nowrap" style={{ fontSize: 13, color: color.text.secondary }}>{MAKE_HINT[a.id]}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 큰 이미지 템플릿 캐러셀 — 지금 홈의 "인기 템플릿으로 시작하기" 그대로(눈길을 끄는 실제 결과물 그림) */}
        {!found && <div className="-mt-12"><RecommendedCarousel onSelectTemplate={() => {}} onViewAll={onViewAllTemplates} /></div>}

        {/* ③ 최근 작업 — 이어서 하기 */}
        {recent.length > 0 && (
          <section>
            <h2 style={H2}>최근 작업</h2>
            <p style={{ ...SUB, marginTop: 4 }}>하던 작업을 바로 이어서 해요.</p>
            <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {recent.map((r) => (
                <button key={`${r.kind}-${r.id}`} type="button" onClick={() => onOpenRecent(r)} className="flex items-center gap-3 rounded-2xl p-3 text-left bg-white hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: `1px solid ${color.border.default}` }}>
                  <span className="size-12 shrink-0 rounded-xl flex items-center justify-center" style={{ background: "#f8fafc" }}>{KIND_ART[r.kind] ? <img src={KIND_ART[r.kind]} alt="" className="size-8 object-contain" /> : <FileText size={20} color="#64748b" />}</span>
                  <span className="min-w-0">
                    <span className="block truncate" style={{ fontSize: 15, fontWeight: 600, color: color.text.primary }}>{r.name}</span>
                    <span className="block truncate" style={{ fontSize: 13, color: color.text.secondary, marginTop: 2 }}>{KIND_LABEL[r.kind] ?? r.app} · {relTime(r.updatedAt)} 수정</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ④ "템플릿으로 시작하기"(편집기별 칩 + 카드 목록)는 뺐다(2026-11-20 사용자). 템플릿은 위 캐러셀 · 전체 보기 · 각 편집기 템플릿 패널에서 */}
      </div>
    </main>
  );
}

function GroupHead({ no, title, sub }: { no: string; title: string; sub: string }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="size-6 rounded-full inline-flex items-center justify-center self-center" style={{ background: color.surface.accent, color: color.brand, fontSize: 13, fontWeight: 700 }}>{no}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color: color.text.primary }}>{title}</span>
      <span style={SUB}>{sub}</span>
    </div>
  );
}

function ResultGroup({ no, title, sub, items, empty, onOpen }: { no: string; title: string; sub: string; items: DocTemplate[]; empty: string; onOpen: (t: DocTemplate, withAi: boolean) => void }) {
  return (
    <div>
      <GroupHead no={no} title={title} sub={sub} />
      {items.length ? (
        <div className="grid gap-4 mt-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {items.map((t) => <TemplateCard key={t.id} t={t} onOpen={onOpen} />)}
        </div>
      ) : <p style={{ ...SUB, marginTop: 8 }}>{empty}</p>}
    </div>
  );
}

/**
 * 템플릿 카드(2026-11-20 정리, 사용자 "정신 사나움, 파란색 너무 많음") — Canva · 미리캔버스처럼 평소엔 그림 + 이름 + 편집기 · 분류만.
 * 버튼은 마우스를 올리거나 키보드로 들어왔을 때만 그림 위에 흰색으로: [✨ AI로 채우기] [그대로 열기]. 카드를 누르면 AI로 채우기.
 * 카드 테두리 · 파란 채움 버튼을 없애 목록 전체에 파란색이 남지 않게 했다.
 */
function TemplateCard({ t, onOpen }: { t: DocTemplate; onOpen: (t: DocTemplate, withAi: boolean) => void }) {
  const wide = t.layout === "slide";
  const pill = "h-9 w-[136px] justify-center whitespace-nowrap rounded-full inline-flex items-center gap-1 bg-white outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] hover:bg-[#f8fafc]";
  return (
    <div className="group flex flex-col gap-2.5">
      <div className="relative overflow-hidden flex items-center justify-center rounded-2xl" style={{ background: "#f1f5f9", aspectRatio: "4 / 3" }}>
        <button type="button" onClick={() => onOpen(t, true)} aria-label={`${t.title} AI로 채우기`} className="absolute inset-0 z-0 outline-none" tabIndex={-1} />
        {t.cover ? (
          <img src={t.cover} alt="" className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04] pointer-events-none" draggable={false} />
        ) : (
          <span className="block transition-transform duration-300 group-hover:scale-[1.03] pointer-events-none" style={{ width: wide ? "88%" : t.layout === "video" ? "40%" : t.layout === "square" ? "64%" : "56%", boxShadow: "0 2px 8px rgba(15,23,42,0.12)" }}>
            <PaperThumb template={t} scale={wide ? 1.4 : 1} />
          </span>
        )}
        {/* 마우스를 올리면: 살짝 어두운 막 + 흰 버튼 두 개 */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto" style={{ background: "rgba(15,23,42,0.35)" }}>
          <button type="button" onClick={() => onOpen(t, true)} className={pill} style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}><Sparkles size={14} color={color.brand} />AI로 채우기</button>
          <button type="button" onClick={() => onOpen(t, false)} className={pill} style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>그대로 열기</button>
        </div>
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate" style={{ fontSize: 15, fontWeight: 600, color: color.text.primary }}>{t.title}</p>
        <p className="truncate" style={{ fontSize: 13, color: color.text.secondary, marginTop: 2 }}>{KIND_LABEL[t.kind]} · {t.category}</p>
      </div>
    </div>
  );
}
