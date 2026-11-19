import { useContext, createContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, Cloud, Download, Loader2, Play, Plus } from "lucide-react";

import { ProfileMenuButton } from "@/app/components/account/ProfileMenuButton";
import { color, f, editorType } from "@/app/styleTokens";

import { EDITOR_APPS } from "./apps";
import type { CommentAuthor } from "./comments";
import { SharePopover } from "./SharePopover";
import { ExportPopover, type ExportChoice, type ExportGroup } from "./ExportPopover";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/** 지금 파일을 보고 있는 사람 — activity: "이 탭" · "2분 전 활동" 같은 상태 문구 */
export interface Viewer extends CommentAuthor { isMe?: boolean; activity: string }

/** 도구가 지원하는 것 — 지원하지 않는 버튼은 아예 그리지 않는다(docs/editor-common-header.md "4") */
export interface HeaderCapabilities {
  /** ▷ 미리보기/프레젠테이션/재생 — 문구는 presentLabel */
  present?: boolean;
  /** 내보내기 버튼. 공유가 없으면 이게 주요(채운) 버튼이 된다 */
  export?: boolean;
  /** 공유(공동 작업). 있으면 항상 주요 버튼 */
  share?: boolean;
}

/**
 * ▷ 보기 옵션(2026-11-19, Figma ▷▾ 참고) — ▷를 누르면 첫 옵션, ▾를 누르면 고르는 메뉴. keys가 있으면 그 단축키로도 실행한다.
 * 도구마다: UI 디자인 프레젠테이션·미리 보기 / PPT 처음부터·현재 슬라이드부터 / 문서 읽기 모드·인쇄 미리 보기 …
 */
export interface PresentOption { id: string; label: string; shortcut?: string; keys?: (e: KeyboardEvent) => boolean; run: () => void }

export type SaveState = { kind: "saved"; at: number } | { kind: "saving" } | { kind: "local" } | { kind: "error" };

/**
 * 딸깍 도구 공통 상단 바(2026-11-19 v3) — 기획: docs/editor-common-header.md.
 *   ① 정체성  : ‹ 나가기 · [아이콘] 앱 이름 ▾(다른 도구로 이동 · 새로 만들기) / 파일 이름(더블클릭 이름 바꾸기) · 저장 상태
 *   ② 도구 슬롯: 그 도구에만 있는 핵심 행동 1~2개(toolSlot)
 *   ③ 패널 토글: ✨ AI · 💬 코멘트 · 🕘 기록 아이콘(actions — DockButtons). 오른쪽 패널을 여는 버튼은 오른쪽에
 *   ④ 🔔 알림
 *   ⑤ 결과물  : ▷ · [내보내기] · [공유 •N] — 오른쪽 끝 채운 버튼은 "다음 단계" 하나(공유가 없으면 내보내기)
 * 내 프로필은 오른쪽 끝에 하나만. 메뉴는 서비스 상단바와 같은 컴포넌트(account/ProfileMenuButton). 함께 보는 사람은 공유 팝오버에서(버튼에 인원 표시 없음).
 */
/**
 * 상단 바 반응형(2026-11-19): 상단 바 너비에 따라 0 = 이름 다 보임 · 1 = 보조 버튼(코멘트·기록·템플릿·보기·내보내기)은 아이콘만 · 2 = 딸깍 AI·앱 이름도 아이콘만.
 * 이름은 툴팁·aria-label에 그대로 남는다. DockButtons·도구 슬롯 버튼은 useHeaderLevel()로 읽는다.
 */
export const HeaderLevelContext = createContext<0 | 1 | 2>(0);
export const useHeaderLevel = () => useContext(HeaderLevelContext);
/** 도구 슬롯 버튼 글자: 상단 바가 좁으면(minLevel 이상) 숨기고 화면 읽기용으로만 남긴다 */
export function HeaderLabel({ text, hideFrom = 1 }: { text: string; hideFrom?: 1 | 2 }) {
  const level = useHeaderLevel();
  return level >= hideFrom ? <span className="sr-only">{text}</span> : <>{text}</>;
}

export type ProfileMenuHandlers = Parameters<typeof ProfileMenuButton>[0];

export function EditorHeader({
  appIcon, appName, currentAppId, onSwitchApp, fileName, onRenameFile, location, saveState,
  capabilities = { share: true, present: true }, presentLabel = "프레젠테이션", onPresent, presentOptions, onExport, exportOptions,
  toolSlot, actions, viewers, onBack, onBell, accent = color.brand, profileMenu,
}: {
  appIcon: string;
  appName: string;
  /** 앱 전환 메뉴에서 지금 도구 표시 */
  currentAppId?: string;
  onSwitchApp?: (id: string) => void;
  /** 없으면(홈 탭) 앱 이름만 보이고 결과물 버튼을 숨긴다 */
  fileName?: string;
  onRenameFile?: (name: string) => void;
  location?: string;
  saveState?: SaveState;
  capabilities?: HeaderCapabilities;
  presentLabel?: string;
  onPresent?: () => void;
  /** ▷▾ 보기 옵션. 없으면 onPresent 하나(presentLabel) */
  presentOptions?: PresentOption[];
  onExport?: () => void;
  /** 있으면 [내보내기]가 설정 팝오버(형식·품질 등)를 연다(2026-11-19, 영상) */
  exportOptions?: { title?: string; groups: ExportGroup[]; onExport: (choice: ExportChoice) => void };
  toolSlot?: ReactNode;
  actions?: ReactNode;
  /** 지금 이 파일을 보고 있는 사람(나 포함) — 공유 팝오버에 보이고, 나 말고 있으면 버튼에 인원 */
  viewers: Viewer[];
  onBack: () => void;
  onBell?: () => void;
  /** 주요 버튼 색 — 도구 강조색 */
  accent?: string;
  /** 오른쪽 끝 내 프로필 메뉴: 서비스 상단바와 같은 ProfileMenuButton(2026-11-19) */
  profileMenu?: ProfileMenuHandlers;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [appMenu, setAppMenu] = useState(false);
  const [, tick] = useState(0);
  // "n분 전" 갱신
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 30000); return () => window.clearInterval(t); }, []);
  const exportPrimary = !!capabilities.export && !capabilities.share;
  const headerRef = useRef<HTMLElement>(null);
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { const w = el.clientWidth; setLevel(w >= 1000 ? 0 : w >= 820 ? 1 : 2); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const iconBtn = "size-10 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";

  return (
    <HeaderLevelContext.Provider value={level}>
    <header ref={headerRef} className="h-14 shrink-0 flex items-center gap-1 pl-2 pr-3 whitespace-nowrap [&_button]:shrink-0" style={{ ...f, background: "#fff", borderBottom: "1px solid #eef0f3" }}>
      {/* ① 정체성 */}
      <IconTooltip label="딸깍 홈으로 나가기"><button type="button" aria-label="딸깍 홈으로 나가기" onClick={onBack} className="size-10 flex items-center justify-center rounded-full hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
        <ChevronLeft size={20} color="#111827" />
      </button></IconTooltip>
      <div className="relative">
        <button
          type="button" aria-haspopup="menu" aria-expanded={appMenu} onClick={() => setAppMenu((v) => !v)}
          className="flex items-center gap-2 rounded-lg pl-2 pr-1 h-10 hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
          style={{ background: appMenu ? "rgba(0,0,0,0.05)" : undefined }}
        >
          <img src={appIcon} alt="" className="size-5 object-contain" />
          {level < 2 ? <span style={{ fontSize: editorType.large, fontWeight: fileName ? 600 : 700, color: fileName ? "#475569" : "#111827" }}>{appName}</span> : <span className="sr-only">{appName}</span>}
          <ChevronDown size={13} color="#94a3b8" />
        </button>
        {appMenu && <AppSwitcher current={currentAppId} onClose={() => setAppMenu(false)} onSwitch={onSwitchApp} />}
      </div>
      {fileName && (
        <span className="flex items-center gap-2 min-w-0">
          <span aria-hidden style={{ color: "#cbd5e1" }}>/</span>
          <EditableTitle value={fileName} onChange={onRenameFile} />
          {(saveState || location) && <SaveBadge state={saveState} location={location} />}
        </span>
      )}

      {/* ② 도구 슬롯 */}
      {fileName && toolSlot && <div className={`${level ? "ml-2" : "ml-4"} flex items-center gap-2`}>{toolSlot}</div>}

      <div className="ml-auto flex items-center gap-2">
        {/* ③ 패널 토글 */}
        {actions}
        {actions && <span aria-hidden className="w-px h-5 mx-1" style={{ background: "#e2e8f0" }} />}
        {/* ⑤ 결과물 */}
        {fileName && capabilities.present && (presentOptions?.length || onPresent) && (
          <PresentButton options={presentOptions?.length ? presentOptions : [{ id: "present", label: presentLabel, run: onPresent! }]} />
        )}
        {fileName && capabilities.export && (onExport || exportOptions) && (
          <div className="relative">
          <button
            type="button" aria-expanded={exportOptions ? exportOpen : undefined} aria-haspopup={exportOptions ? "dialog" : undefined}
            onClick={() => (exportOptions ? setExportOpen((v) => !v) : onExport?.())}
            className={`h-10 ${level ? "px-3" : "px-4"} rounded-lg flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]`}
            style={exportPrimary ? { background: accent, color: "#fff", fontSize: editorType.body, fontWeight: 600 } : { background: "#fff", color: "#111827", fontSize: editorType.body, fontWeight: 600, boxShadow: "inset 0 0 0 1px #e2e8f0" }}
          >
            <Download size={18} />{level < 1 ? "내보내기" : <span className="sr-only">내보내기</span>}
          </button>
          {exportOptions && exportOpen && <ExportPopover title={exportOptions.title} groups={exportOptions.groups} accent={accent} onClose={() => setExportOpen(false)} onExport={(c) => { setExportOpen(false); exportOptions.onExport(c); }} />}
          </div>
        )}
        {fileName && capabilities.share && (
          <div className="relative">
            <button
              type="button"
              aria-expanded={shareOpen}
              onClick={() => setShareOpen((v) => !v)}
              className="h-10 px-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]"
              style={{ background: accent, color: "#fff", fontSize: editorType.body, fontWeight: 600 }}
            >
              공유
            </button>
            {shareOpen && <SharePopover fileName={fileName} accent={accent} onClose={() => setShareOpen(false)} />}
          </div>
        )}
        {/* ④ 알림: 내 계정 소식이라 파일 작업 버튼 사이가 아니라 프로필 바로 옆(2026-11-19, Google Docs·Notion·Canva·Figma와 같은 자리) */}
        {onBell && (
          <div className="ml-1"><IconTooltip label="알림"><button type="button" aria-label="알림" onClick={onBell} className="relative size-10 flex items-center justify-center rounded-full hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            <span aria-hidden className="absolute top-[8px] right-[9px] size-2 rounded-full bg-[#2b7fff] ring-2 ring-white" />
          </button></IconTooltip></div>
        )}
        {profileMenu && <div className="ml-1"><ProfileMenuButton {...profileMenu} /></div>}
      </div>
    </header>
    </HeaderLevelContext.Provider>
  );
}

/** ▷▾ 분할 버튼 — ▷ = 첫 옵션 바로 실행, ▾ = 옵션 메뉴(이름 + 단축키). 옵션이 하나면 ▾ 없이 ▷만 */
function PresentButton({ options }: { options: PresentOption[] }) {
  const level = useHeaderLevel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const first = options[0];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
      const hit = options.find((o) => o.keys?.(e));
      if (hit) { e.preventDefault(); setOpen(false); hit.run(); }
      else if (open && e.key === "Escape") setOpen(false);
    };
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => { window.removeEventListener("keydown", key); document.removeEventListener("pointerdown", down); };
  }, [options, open]);
  const half = "h-10 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f7bff] hover:bg-black/[0.06]";
  return (
    <div ref={ref} className="relative flex items-center rounded-lg" style={{ background: open ? "#f8fafc" : "#fff", boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
      <IconTooltip label={first.shortcut ? `${first.label} (${first.shortcut})` : first.label}>
        <button type="button" aria-label={first.label} onClick={() => { setOpen(false); first.run(); }} className={`${half} w-10 ${options.length > 1 ? "rounded-l-lg" : "rounded-lg"}`} style={{ fontSize: editorType.body, fontWeight: 500, color: "#334155" }}>
          <Play size={20} color="#475569" />{/* 2026-11-19 사용자 "프레젠테이션은 아이콘만": ▷만, 이름은 툴팁 */}
        </button>
      </IconTooltip>
      {options.length > 1 && (
        <IconTooltip label="보기 방법 고르기">
          <button type="button" aria-label="보기 방법 고르기" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${half} w-7 rounded-r-lg`} style={{ boxShadow: "inset 1px 0 0 #e2e8f0" }}>
            <ChevronDown size={14} color="#64748b" />
          </button>
        </IconTooltip>
      )}
      {open && (
        <div className="absolute right-0 top-10 z-50 bg-white rounded-xl py-2 min-w-[220px]" style={{ ...f, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="menu" aria-label="보기 방법">
          {options.map((o) => (
            <button key={o.id} type="button" role="menuitem" onClick={() => { setOpen(false); o.run(); }} className="w-full flex items-center gap-6 px-4 h-10 text-left hover:bg-[#f3f4f6] outline-none focus-visible:bg-[#f3f4f6]">
              <span className="flex-1" style={{ fontSize: editorType.large, fontWeight: 600, color: "#111827" }}>{o.label}</span>
              {o.shortcut && <span style={{ fontSize: editorType.label, color: "#64748b", letterSpacing: "0.5px" }}>{o.shortcut}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 저장 상태(자동 저장). 2026-11-19 간소화: 평소(저장됨)엔 구름 아이콘만 두고 위치·시각은 툴팁으로.
 * 글자는 저장 중·저장 못 함처럼 알아야 할 때만 보인다(Google Docs·Canva 방식). 예전엔 "임시 보관함 · 저장됨 · 39초 전"이 늘 붙어 있었다.
 */
function SaveBadge({ state, location }: { state?: SaveState; location?: string }) {
  if (state?.kind === "saving") {
    return <span className="shrink-0 inline-flex items-center gap-1 ml-1" style={{ fontSize: editorType.caption, color: "#94a3b8" }} aria-live="polite"><Loader2 size={12} className="animate-spin" />저장 중…</span>;
  }
  if (state?.kind === "error") {
    return <span className="shrink-0 inline-flex items-center gap-1 ml-1" style={{ fontSize: editorType.caption, color: "#b45309" }} aria-live="polite"><Cloud size={12} />저장 못 함: 이 브라우저 저장 공간 부족</span>;
  }
  // 평소(저장됨)에는 아무것도 안 보인다(2026-11-19, 사용자 "클라우드 표시 있어야 하나"). Figma·Canva처럼 자동 저장은 기본이라 표시하지 않고, 저장 중·실패일 때만 글자로 알린다.
  void location;
  return null;
}

/**
 * 앱 이름 ▾ — 다른 딸깍 편집기로 바로 이동하는 **아이콘 격자**(2026-11-19, Google Workspace·Microsoft 365 앱 런처처럼).
 * 홈 "편집기 바로 열기"와 같은 8개·같은 그림·같은 이름(editor-shell/apps.ts). 아직 못 여는 도구는 흐리게 "준비 중".
 * 예전엔 17개 글자 목록 + 맨 위 "새 파일"이었다 — 새 파일은 탭 줄 ＋가 맡는다.
 */
function AppSwitcher({ current, onClose, onSwitch }: { current?: string; onClose: () => void; onSwitch?: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);
  return (
    <div ref={ref} className="absolute left-0 top-10 z-50 bg-white rounded-2xl p-3" style={{ ...f, width: 336, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="menu" aria-label="딸깍 편집기">
      <p style={{ fontSize: editorType.caption, fontWeight: 700, color: "#94a3b8", padding: "0 4px 8px" }}>딸깍 편집기</p>
      <div className="grid grid-cols-4 gap-1">
        {EDITOR_APPS.map((a) => {
          const on = a.id === current;
          return (
            <button
              key={a.id} type="button" role="menuitem" aria-current={on ? "true" : undefined} aria-disabled={a.soon || undefined}
              title={a.soon ? `${a.label}: 준비 중` : a.hint}
              onClick={() => { if (a.soon) return; onClose(); if (!on) onSwitch?.(a.id); }}
              className={`relative flex flex-col items-center gap-1 rounded-xl pt-3 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] ${a.soon ? "cursor-default" : "hover:bg-[#f3f4f6]"}`}
              style={{ background: on ? color.surface.accent : undefined }}
            >
              <img src={a.art} alt="" className="size-10 object-contain" style={{ opacity: a.soon ? 0.4 : 1 }} draggable={false} />
              <span style={{ fontSize: editorType.label, fontWeight: on ? 700 : 500, color: on ? color.brand : a.soon ? "#94a3b8" : "#1e293b" }}>{a.label}</span>
              {a.soon && <span className="absolute top-1 right-1 rounded px-1" style={{ fontSize: editorType.caption, fontWeight: 700, color: "#64748b", background: "#f1f5f9" }}>준비 중</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditableTitle({ value, onChange }: { value: string; onChange?: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const style = { ...f, fontSize: editorType.large, fontWeight: 700, color: "#111827" } as const;
  if (!editing || !onChange) {
    return (
      <button type="button" title={onChange ? "더블클릭해서 이름 바꾸기" : undefined} onDoubleClick={() => { setText(value); setEditing(true); }} className="truncate max-w-[240px] !shrink min-w-0 text-left rounded px-1 -mx-1 hover:bg-black/[0.04]" style={style}>
        {value}
      </button>
    );
  }
  const done = () => { onChange(text.trim() || value); setEditing(false); };
  return (
    <input
      autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={done}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") done(); if (e.key === "Escape") setEditing(false); }}
      className="outline-none rounded px-1 -mx-1 w-[200px]" style={{ ...style, boxShadow: "inset 0 0 0 1px #4f7bff" }}
    />
  );
}
