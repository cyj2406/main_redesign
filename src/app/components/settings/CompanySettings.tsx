import { useMemo, useState } from "react";
import { Building2, Download, History, Plus, RotateCcw, Star, Trash2 } from "lucide-react";

import { Badge } from "@/app/components/common/Badge";
import { Button } from "@/app/components/common/Button";
import { Tabs } from "@/app/components/common/Tabs";
import { showToast } from "@/app/components/common/Toast";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";
import { josa } from "@/app/copy";
import { color, f, radius } from "@/app/styleTokens";
import { SettingsCard, SettingsField, SettingsGroupLabel, SettingsRow, SettingsSectionHead, SettingsToggle } from "./SettingsKit";

/**
 * 설정 › 회사 정보(2026-11-27). 내용은 딸깍 데스크톱 설정 그대로:
 *   법인 목록(추가·삭제·기본) · 새 대화에서 회사 프로필 기본 사용 · 이름(구분용) · 자동으로 가져오기 · 저장
 *   하위 탭: 기본 정보 · 브랜드 · 회사 서술 · 연락처 · 서류·직인 · 민감 정보 · 문서 기본값 · 버전 · 기록
 * 읽기 쉽게 바꾼 점:
 *   - 기본 정보 16칸을 회사 · 등록 정보 · 주소 · 연락 네 묶음으로 나눴다(한 화면에 같은 칸이 끝없이 이어지던 문제)
 *   - "저장 전 바뀐 항목을 확인하세요"를 화면이 직접 보여 준다: 바뀐 칸은 라벨 옆 파란 점, 아래 저장 막대에 "바뀐 항목 N개"
 *   - 저장 버튼은 바뀐 게 있을 때만 아래에 뜬다(이름 칸 옆 상시 검정 버튼 제거)
 *   - 법인 삭제는 휴지통 아이콘 + 되돌리기 토스트(카드 아래 떠 있던 빨간 "삭제" 글자 제거)
 * 서버가 없어 이 브라우저(localStorage)에만 저장한다.
 */
type Fields = Record<string, string>;
interface Version { at: number; changed: string[]; fields: Fields; label: string }
interface Company { id: string; label: string; fields: Fields; versions: Version[] }
interface CompanyState { companies: Company[]; defaultId: string | null; useInNewChat: boolean }

const KEY = "ddalkkak.company.v1";
const EMPTY: CompanyState = { companies: [], defaultId: null, useInNewChat: true };

type FieldDef = { key: string; label: string; placeholder?: string; type?: string; full?: boolean; hint?: string; multiline?: boolean };
type Group = { title?: string; fields: FieldDef[] };

const SUBTABS = ["기본 정보", "브랜드", "회사 서술", "연락처", "서류·직인", "민감 정보", "문서 기본값", "버전", "기록"] as const;
type SubTab = (typeof SUBTABS)[number];

const FORM: Partial<Record<SubTab, Group[]>> = {
  "기본 정보": [
    { title: "회사", fields: [
      { key: "nameKo", label: "회사명(국문)", placeholder: "예: 주식회사 딸깍" },
      { key: "nameEn", label: "회사명(영문)", placeholder: "예: Ddalkkak Inc." },
      { key: "ceoKo", label: "대표자(국문)" },
      { key: "ceoEn", label: "대표자(영문)" },
      { key: "founded", label: "설립일", type: "date" },
    ] },
    { title: "등록 정보", fields: [
      { key: "bizNo", label: "사업자등록번호", placeholder: "숫자 10자리" },
      { key: "corpNo", label: "법인등록번호", placeholder: "숫자 13자리" },
      { key: "bizType", label: "업태", placeholder: "예: 서비스업" },
      { key: "bizItem", label: "종목", placeholder: "예: 소프트웨어 개발" },
    ] },
    { title: "주소", fields: [
      { key: "zip", label: "우편번호", placeholder: "숫자 5자리" },
      { key: "addrKo", label: "주소(국문)", full: true },
      { key: "addrEn", label: "주소(영문)", full: true },
    ] },
    { title: "연락", fields: [
      { key: "tel", label: "대표 전화", type: "tel" },
      { key: "fax", label: "팩스", type: "tel" },
      { key: "email", label: "대표 이메일", type: "email" },
      { key: "web", label: "웹사이트", placeholder: "예: ddalkkak.net" },
    ] },
  ],
  "브랜드": [{ fields: [
    { key: "brandColor", label: "대표 색", type: "color", hint: "문서 제목과 표 머리에 써요." },
    { key: "slogan", label: "슬로건", placeholder: "예: 문서는 딸깍 한 번이면 끝" },
    { key: "logo", label: "로고 파일 이름", placeholder: "예: logo.png", full: true },
  ] }],
  "회사 서술": [{ fields: [
    { key: "oneLiner", label: "한 줄 소개", full: true, placeholder: "예: AI로 공문과 제안서를 만드는 회사예요" },
    { key: "intro", label: "회사 소개", full: true, multiline: true, hint: "제안서와 회사 소개서 첫 장에 들어가요." },
    { key: "business", label: "주요 사업", full: true, multiline: true },
  ] }],
  "연락처": [{ fields: [
    { key: "contactName", label: "담당자 이름" },
    { key: "contactDept", label: "부서" },
    { key: "contactTel", label: "담당자 전화", type: "tel" },
    { key: "contactEmail", label: "담당자 이메일", type: "email" },
  ] }],
  "서류·직인": [{ fields: [
    { key: "sealFile", label: "직인 이미지 파일 이름", placeholder: "예: seal.png", hint: "배경이 투명한 PNG가 좋아요." },
    { key: "certFile", label: "사업자등록증 파일 이름", placeholder: "예: 사업자등록증.pdf" },
  ] }],
  "민감 정보": [{ fields: [
    { key: "bank", label: "거래 은행" },
    { key: "accountHolder", label: "예금주" },
    { key: "account", label: "계좌 번호", full: true, hint: "문서에 넣기 전에 매번 물어봐요." },
  ] }],
  "문서 기본값": [{ fields: [
    { key: "docFont", label: "기본 글꼴", placeholder: "예: 맑은 고딕" },
    { key: "docDate", label: "날짜 표기", placeholder: "예: 2026. 11. 27." },
    { key: "docSigner", label: "기본 결재자", placeholder: "예: 대표이사" },
  ] }],
};

const LABEL: Record<string, string> = Object.fromEntries(
  Object.values(FORM).flatMap((gs) => gs!.flatMap((g) => g.fields.map((d) => [d.key, d.label]))).concat([["__label", "이름(구분용)"]]),
);

const AUTOFILL: Fields = { bizType: "서비스업", bizItem: "응용 소프트웨어 개발", zip: "06236", addrKo: "서울특별시 강남구 테헤란로 123", addrEn: "123 Teheran-ro, Gangnam-gu, Seoul" };

function load(): CompanyState {
  try { const raw = window.localStorage.getItem(KEY); if (raw) return { ...EMPTY, ...JSON.parse(raw) }; } catch { /* 기본값 */ }
  return EMPTY;
}

const timeText = (t: number) => new Date(t).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

export function CompanySettings() {
  const [state, setState] = useState<CompanyState>(load);
  const [activeId, setActiveId] = useState<string | null>(state.defaultId ?? state.companies[0]?.id ?? null);
  const [sub, setSub] = useState<SubTab>("기본 정보");
  // 저장 전 수정본(법인별). 저장하면 비운다.
  const [drafts, setDrafts] = useState<Record<string, { label: string; fields: Fields }>>({});

  const persist = (next: CompanyState) => {
    setState(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 이번 세션만 */ }
  };

  const company = state.companies.find((c) => c.id === activeId) ?? null;
  const draft = company ? drafts[company.id] ?? { label: company.label, fields: company.fields } : null;

  const changed = useMemo(() => {
    if (!company || !draft) return [] as string[];
    const keys = new Set([...Object.keys(company.fields), ...Object.keys(draft.fields)]);
    const list = [...keys].filter((k) => (company.fields[k] ?? "") !== (draft.fields[k] ?? ""));
    if (draft.label !== company.label) list.unshift("__label");
    return list;
  }, [company, draft]);

  const setField = (key: string, v: string) => {
    if (!company || !draft) return;
    setDrafts((d) => ({ ...d, [company.id]: { ...draft, fields: { ...draft.fields, [key]: v } } }));
  };
  const setLabel = (v: string) => company && draft && setDrafts((d) => ({ ...d, [company.id]: { ...draft, label: v } }));
  const discard = () => company && setDrafts((d) => { const n = { ...d }; delete n[company.id]; return n; });

  const save = () => {
    if (!company || !draft || changed.length === 0) return;
    const v: Version = { at: Date.now(), changed, fields: draft.fields, label: draft.label };
    persist({ ...state, companies: state.companies.map((c) => (c.id === company.id ? { ...c, label: draft.label.trim() || c.label, fields: draft.fields, versions: [v, ...c.versions].slice(0, 30) } : c)) });
    discard();
    showToast(`저장했어요. 바뀐 항목 ${changed.length}개가 새 문서부터 들어가요.`);
  };

  const addCompany = () => {
    const n = state.companies.length;
    const c: Company = { id: `c${Date.now()}`, label: n === 0 ? "본사" : `법인 ${n + 1}`, fields: {}, versions: [] };
    persist({ ...state, companies: [...state.companies, c], defaultId: state.defaultId ?? c.id });
    setActiveId(c.id);
    setSub("기본 정보");
  };

  const removeCompany = () => {
    if (!company) return;
    const before = state;
    const rest = state.companies.filter((c) => c.id !== company.id);
    persist({ ...state, companies: rest, defaultId: state.defaultId === company.id ? rest[0]?.id ?? null : state.defaultId });
    setActiveId(rest[0]?.id ?? null);
    showToast(`${company.label} 법인을 삭제했어요.`, "success", { label: "되돌리기", onClick: () => { persist(before); setActiveId(company.id); } });
  };

  const autofill = () => {
    if (!draft) return;
    const digits = (draft.fields.bizNo ?? "").replace(/\D/g, "");
    if (digits.length !== 10) { showToast("사업자등록번호 10자리를 먼저 넣어 주세요.", "error"); setSub("기본 정보"); return; }
    const next = { ...draft.fields };
    let n = 0;
    for (const [k, v] of Object.entries(AUTOFILL)) if (!next[k]) { next[k] = v; n++; }
    setDrafts((d) => ({ ...d, [company!.id]: { ...draft, fields: next } }));
    showToast(n ? `${n}개 항목을 채웠어요. 예시 값이라 확인하고 저장해 주세요.` : "더 채울 빈칸이 없어요.");
  };

  // ── 비어 있을 때 ──
  if (state.companies.length === 0 || !company || !draft) {
    return (
      <div className="flex flex-col gap-5" style={f}>
        <SettingsSectionHead title="회사 정보" desc="여기 적은 회사 정보는 양식, 브리프, 디자인에 자동으로 채워져요. 값이 틀리면 모든 문서에 퍼지니, 저장 전에 바뀐 항목을 확인해 주세요." />
        <div className="flex flex-col items-center text-center gap-2 px-6 py-14" style={{ border: `1.5px dashed ${color.border.default}`, borderRadius: radius.card }}>
          <span className="size-12 rounded-2xl flex items-center justify-center mb-1" style={{ background: color.surface.hover, color: "#475569" }}><Building2 size={24} strokeWidth={1.7} /></span>
          <p style={{ fontSize: 16, fontWeight: 700, color: color.text.primary, letterSpacing: "-0.3px" }}>아직 등록한 회사가 없어요</p>
          <p style={{ fontSize: 13.5, color: color.text.secondary, lineHeight: 1.6 }}>회사 정보를 등록하면 양식, 브리프, 디자인에 자동으로 채워져요.</p>
          <div className="mt-3"><Button variant="dark" size="md" onClick={addCompany}><Plus size={16} strokeWidth={2} />회사 정보 등록하기</Button></div>
        </div>
      </div>
    );
  }

  const isDefault = state.defaultId === company.id;
  const groups = FORM[sub];

  return (
    <div className="flex flex-col gap-6" style={f}>
      <SettingsSectionHead title="회사 정보" desc="여기 적은 회사 정보는 양식, 브리프, 디자인에 자동으로 채워져요. 값이 틀리면 모든 문서에 퍼지니, 저장 전에 바뀐 항목을 확인해 주세요." />

      <SettingsCard>
        <SettingsRow
          title="새 대화에서 회사 프로필 기본 사용"
          desc="켜 두면 새 대화의 입력창에 '회사 프로필 사용'이 켜진 채로 시작해요."
          control={<SettingsToggle checked={state.useInNewChat} onChange={(v) => persist({ ...state, useInNewChat: v })} label="새 대화에서 회사 프로필 기본 사용" />}
        />
      </SettingsCard>

      {/* 법인 고르기 */}
      <div className="flex flex-col gap-2.5">
        <SettingsGroupLabel>법인</SettingsGroupLabel>
        {/* 2026-11-27 다시: 고른 칩(회색 채움)과 "기본" 배지(같은 회색)가 겹쳐 배지 경계가 사라지고 글자만 떠 보였다.
            → 공통 필터 칩(ScrollableChips solid)과 같은 모양: 고른 법인은 검정 채움·흰 글자, 나머지는 흰 바탕·테두리.
            "기본"은 배지 대신 같은 칩 안의 연한 글자. "법인 추가"는 칩이 아니라 글자 버튼(선택지처럼 보이지 않게). */}
        <div className="flex flex-wrap items-center gap-2">
          {state.companies.map((c) => {
            const on = c.id === company.id;
            const dirty = !!drafts[c.id];
            return (
              <button
                key={c.id} type="button" onClick={() => setActiveId(c.id)} aria-pressed={on}
                className={`h-9 px-4 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff] ${on ? "" : "hover:bg-[#f8fafc]"}`}
                style={{ fontSize: 13.5, fontWeight: 600, color: on ? "#fff" : "#334155", background: on ? color.text.primary : "#fff", border: `1px solid ${on ? color.text.primary : color.border.default}` }}
              >
                {c.label}
                {state.defaultId === c.id && <span style={{ fontSize: 12, fontWeight: 500, color: on ? "rgba(255,255,255,0.65)" : color.text.secondary }}>기본</span>}
                {dirty && <span className="size-1.5 rounded-full" style={{ background: on ? "#93b0ff" : color.brand }} aria-label="저장 안 한 수정 있음" />}
              </button>
            );
          })}
          <button
            type="button" onClick={addCompany}
            className="h-9 px-2.5 rounded-full inline-flex items-center gap-1 outline-none hover:bg-[#f1f5f9] focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
            style={{ fontSize: 13.5, fontWeight: 600, color: color.text.secondary }}
          >
            <Plus size={15} strokeWidth={2} />법인 추가
          </button>
        </div>
      </div>

      {/* 고른 법인 */}
      <SettingsCard className="p-5 flex flex-col gap-5">
        <div className="flex items-end gap-2 flex-wrap">
          <SettingsField
            label="이름(구분용)" className="flex-1 min-w-[180px]" value={draft.label} changed={changed.includes("__label")}
            onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.stopPropagation()}
          />
          <Button variant="secondary" size="md" onClick={autofill}><Download size={15} strokeWidth={1.8} />자동으로 가져오기</Button>
          {!isDefault && (
            <IconTooltip label="기본 법인으로 지정">
              <button type="button" aria-label="기본 법인으로 지정" onClick={() => { persist({ ...state, defaultId: company.id }); showToast(`${josa(company.label, "을/를")} 기본 법인으로 정했어요.`); }}
                className="size-11 rounded-[14px] flex items-center justify-center outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: `1px solid ${color.border.default}`, color: "#475569" }}>
                <Star size={17} strokeWidth={1.8} />
              </button>
            </IconTooltip>
          )}
          <IconTooltip label="법인 삭제">
            <button type="button" aria-label="법인 삭제" onClick={removeCompany}
              className="size-11 rounded-[14px] flex items-center justify-center outline-none hover:bg-[#fef2f2] focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: `1px solid ${color.border.default}`, color: "#dc2626" }}>
              <Trash2 size={17} strokeWidth={1.8} />
            </button>
          </IconTooltip>
        </div>

        <div className="-mx-5 px-5" style={{ borderBottom: `1px solid ${color.surface.hover}` }}>
          <Tabs items={SUBTABS.map((t) => ({ value: `company-${t}`, label: t }))} value={`company-${sub}`} onChange={(v) => setSub(v.replace("company-", "") as SubTab)} />
        </div>

        {groups && (
          <div className="flex flex-col gap-6">
            {groups.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-3">
                {g.title && <SettingsGroupLabel>{g.title}</SettingsGroupLabel>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3.5">
                  {g.fields.map((d) => {
                    const v = draft.fields[d.key] ?? "";
                    const ch = changed.includes(d.key);
                    if (d.multiline) {
                      return (
                        <label key={d.key} className="flex flex-col gap-1.5 sm:col-span-2">
                          <span className="flex items-center gap-1.5" style={{ fontWeight: 600, fontSize: 13, color: "#334155" }}>
                            {d.label}{ch && <span className="size-1.5 rounded-full" style={{ background: color.brand }} aria-label="바뀜" />}
                          </span>
                          <textarea
                            value={v} rows={4} onChange={(e) => setField(d.key, e.target.value)} onKeyDown={(e) => e.stopPropagation()}
                            className="ui-field w-full rounded-xl px-3.5 py-3 outline-none resize-y"
                            style={{ ...f, fontSize: 14, fontWeight: 500, lineHeight: 1.6, color: color.text.primary, background: color.surface.subtle, border: `1px solid ${ch ? "#bfd0ff" : color.border.default}` }}
                          />
                          {d.hint && <span style={{ fontSize: 12, color: color.text.secondary }}>{d.hint}</span>}
                        </label>
                      );
                    }
                    if (d.type === "color") {
                      return (
                        <label key={d.key} className="flex flex-col gap-1.5">
                          <span className="flex items-center gap-1.5" style={{ fontWeight: 600, fontSize: 13, color: "#334155" }}>
                            {d.label}{ch && <span className="size-1.5 rounded-full" style={{ background: color.brand }} aria-label="바뀜" />}
                          </span>
                          <span className="ui-field-within h-11 rounded-xl px-2 flex items-center gap-2" style={{ background: color.surface.subtle, border: `1px solid ${ch ? "#bfd0ff" : color.border.default}` }}>
                            <input type="color" value={v || "#4f7bff"} onChange={(e) => setField(d.key, e.target.value)} className="size-7 rounded-md cursor-pointer bg-transparent" aria-label={d.label} />
                            <span className="font-mono" style={{ fontSize: 13, color: v ? color.text.primary : color.text.placeholder }}>{v || "고르지 않음"}</span>
                          </span>
                          {d.hint && <span style={{ fontSize: 12, color: color.text.secondary }}>{d.hint}</span>}
                        </label>
                      );
                    }
                    return (
                      <SettingsField
                        key={d.key} label={d.label} type={d.type ?? "text"} value={v} placeholder={d.placeholder} hint={d.hint} changed={ch}
                        className={d.full ? "sm:col-span-2" : ""} onChange={(e) => setField(d.key, e.target.value)} onKeyDown={(e) => e.stopPropagation()}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {sub === "버전" && (
          company.versions.length === 0 ? <EmptyLine text="저장하면 버전이 하나씩 쌓여요. 잘못 저장했을 때 이전 버전으로 되돌릴 수 있어요." /> : (
            <ul className="flex flex-col">
              {company.versions.map((v, i) => (
                <li key={v.at} className="flex items-center gap-3 py-3" style={{ borderTop: i ? `1px solid ${color.surface.hover}` : undefined }}>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: color.text.primary }}>{timeText(v.at)}{i === 0 && <Badge tone="brand">지금 버전</Badge>}</p>
                    <p className="truncate" style={{ fontSize: 13, color: color.text.secondary, marginTop: 2 }}>{v.changed.length}개 바뀜: {v.changed.map((k) => LABEL[k] ?? k).join(", ")}</p>
                  </div>
                  {i > 0 && (
                    <Button variant="secondary" size="md" onClick={() => { setDrafts((d) => ({ ...d, [company.id]: { label: v.label, fields: v.fields } })); setSub("기본 정보"); showToast("이 버전 값을 불러왔어요. 확인하고 저장해 주세요."); }}>
                      <RotateCcw size={15} strokeWidth={1.8} />이 버전 불러오기
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )
        )}

        {sub === "기록" && (
          company.versions.length === 0 ? <EmptyLine text="누가 언제 어떤 항목을 바꿨는지 여기에 남아요." /> : (
            <ul className="flex flex-col gap-0">
              {company.versions.flatMap((v) => v.changed.map((k) => ({ k, at: v.at }))).slice(0, 50).map((r, i) => (
                <li key={`${r.at}-${r.k}`} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? `1px solid ${color.surface.hover}` : undefined }}>
                  <History size={15} strokeWidth={1.8} color="#94a3b8" className="shrink-0" />
                  <span className="flex-1 min-w-0 truncate" style={{ fontSize: 13.5, color: color.text.primary }}>나: {LABEL[r.k] ?? r.k} 바꿈</span>
                  <span className="shrink-0" style={{ fontSize: 12.5, color: color.text.secondary }}>{timeText(r.at)}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </SettingsCard>

      {/* 저장 막대 — 바뀐 게 있을 때만. 스크롤 영역 아래에 붙는다 */}
      {changed.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-1 px-1 pb-1" style={{ background: "linear-gradient(to top, #fff 70%, rgba(255,255,255,0))", paddingTop: 12 }}>
          <div className="flex items-center gap-3 rounded-2xl pl-4 pr-2 py-2" style={{ background: color.text.primary, boxShadow: "0px 8px 24px rgba(0,0,0,0.18)" }}>
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>바뀐 항목 {changed.length}개</p>
              <p className="truncate" style={{ fontSize: 12.5, color: "#cbd5e1" }}>{changed.map((k) => LABEL[k] ?? k).join(", ")}</p>
            </div>
            <button type="button" onClick={discard} className="h-10 px-3 rounded-xl outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white" style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>되돌리기</button>
            <button type="button" onClick={save} className="h-10 px-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white" style={{ fontSize: 14, fontWeight: 700, color: color.text.primary, background: "#fff" }}>저장</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-8 text-center" style={{ fontSize: 13.5, color: color.text.secondary, lineHeight: 1.6 }}>{text}</p>;
}
