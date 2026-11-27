import { useContext, createContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, Cloud, CloudAlert, Download, Save, Loader2, Play, Plus, Bell } from "lucide-react";

import { ProfileMenuButton } from "@/app/components/account/ProfileMenuButton";
import { color, f, editorType } from "@/app/styleTokens";

import { EDITOR_APPS } from "./apps";
import type { CommentAuthor } from "./comments";
import { SharePopover } from "./SharePopover";
import { ExportPopover, type ExportChoice, type ExportGroup } from "./ExportPopover";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";
import { showToast } from "@/app/components/common/Toast";

/** 지금 파일을 보고 있는 사람 — activity: "이 탭" · "2분 전 활동" 같은 상태 문구 */
export interface Viewer extends CommentAuthor { isMe?: boolean; activity: string }

/** 도구가 지원하는 것 — 지원하지 않는 버튼은 아예 그리지 않는다(docs/editor-common-header.md "4") */
export interface HeaderCapabilities {
  /** ▷ 미리보기/프레젠테이션/재생 — 문구는 presentLabel */
  present?: boolean;
  /** 다운로드 버튼. 있으면 항상 주요(채운) 버튼, 오른쪽 끝(2026-11-27 "다운로드가 더 강조되어야", 미리캔버스 방식) */
  export?: boolean;
  /** 공유(공동 작업). 다운로드가 있으면 테두리 버튼, 없을 때만 채운 버튼 */
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
 *   ① 정체성  : ‹ 나가기 · [아이콘] 앱 이름 ▾(다른 도구로 이동 · 새로 만들기) / 파일 이름(한 번 눌러 이름 바꾸기, 확장자는 고치는 칸 밖) · 저장 상태
 *   ② 도구 슬롯: 그 도구에만 있는 핵심 행동 1~2개(toolSlot)
 *   ③ 패널 토글: ✨ AI · 💬 코멘트 · 🕘 기록 아이콘(actions — DockButtons). 오른쪽 패널을 여는 버튼은 오른쪽에
 *   ④ 🔔 알림
 *   ⑤ 결과물  : ▷ · [공유] · [다운로드]. 오른쪽 끝 채운 버튼은 하나. 💾는 ① 파일 이름 옆
 * 내 프로필은 오른쪽 끝에 하나만. 메뉴는 서비스 상단바와 같은 컴포넌트(account/ProfileMenuButton). 함께 보는 사람은 공유 팝오버에서(버튼에 인원 표시 없음).
 */
/**
 * 상단 바 반응형(2026-11-19): 상단 바 너비에 따라 0 = 이름 다 보임 · 1 = 보조 버튼(코멘트·기록·템플릿·보기·내보내기)은 아이콘만 · 2 = 딸깍 AI·앱 이름도 아이콘만.
 * 이름은 툴팁·aria-label에 그대로 남는다. DockButtons·도구 슬롯 버튼은 useHeaderLevel()로 읽는다.
 */
export const HeaderLevelContext = createContext<0 | 1 | 2>(0);
export const useHeaderLevel = () => useContext(HeaderLevelContext);
/** 상단 바가 넉넉하면(1240px 이상) 패널 버튼(기록 · 코멘트)도 이름을 보인다(2026-11-27, 아이콘만으론 처음 쓰는 사람이 모른다) */
export const HeaderWideContext = createContext(false);
export const useHeaderWide = () => useContext(HeaderWideContext);
/** 도구 슬롯 버튼 글자: 상단 바가 좁으면(minLevel 이상) 숨기고 화면 읽기용으로만 남긴다 */
export function HeaderLabel({ text, hideFrom = 1 }: { text: string; hideFrom?: 1 | 2 }) {
  const level = useHeaderLevel();
  return level >= hideFrom ? <span className="sr-only">{text}</span> : <>{text}</>;
}

export type ProfileMenuHandlers = Parameters<typeof ProfileMenuButton>[0];

export function EditorHeader({
  appIcon, appName, currentAppId, onSwitchApp, fileName, onRenameFile, location, saveState,
  capabilities = { share: true, present: true }, presentLabel = "프레젠테이션", onPresent, presentOptions, onExport, exportOptions, exportLabel = "다운로드", onSave, primary = "export",
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
  /** [다운로드] 버튼 글자(2026-11-27 기본값 "내보내기" → "다운로드": Canva · 미리캔버스 모두 "다운로드") */
  exportLabel?: string;
  /** 있으면 ☁ 저장 아이콘 버튼 + ⌘S(2026-11-27, 미리캔버스 상단 저장 아이콘 참고). 자동 저장은 그대로, 누르면 지금 바로 저장 */
  onSave?: () => void;
  /** 오른쪽 끝 채운 버튼(2026-11-27). 문서 계열은 다운로드(파일로 받아 제출하는 게 다음 단계), UI 디자인 · 보드는 공유(협업 도구) */
  primary?: "export" | "share";
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
  const hasExport = !!capabilities.export && !!(onExport || exportOptions);
  const hasShare = !!capabilities.share;
  // 채운 버튼은 하나: 고른 쪽이 없으면 남은 쪽이 맡는다
  const exportPrimary = hasExport && (primary === "export" || !hasShare);
  const headerRef = useRef<HTMLElement>(null);
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  const [roomy, setRoomy] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { const w = el.clientWidth; setLevel(w >= 1000 ? 0 : w >= 820 ? 1 : 2); setRoomy(w >= 1240); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const iconBtn = "size-10 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";
  // 홈 B안(2026-11-20): App이 B안이면 편집기 바꾸기(onSwitchApp)를 넘기지 않는다. 그때만
  //  · 데스크톱(1200px 이상, 왼쪽 사이드바 줄에 홈이 보일 때)에서는 ‹(홈으로)를 숨긴다(홈 가는 길이 두 개였다, Figma처럼)
  //  (저장됨 상시 표시는 넣었다가 되돌렸다: 실제 딸깍 문서는 안쪽 오픈소스 에디터 머리에 "자동 저장" · "저장됨"이 이미 있어 두 번 보인다)
  const planB = !onSwitchApp;
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1200px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1200px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <HeaderLevelContext.Provider value={level}><HeaderWideContext.Provider value={roomy}>
    <header ref={headerRef} className="h-14 shrink-0 flex items-center gap-1 pl-2 pr-3 whitespace-nowrap [&_button]:shrink-0" style={{ ...f, background: "#fff", borderBottom: "1px solid #eef0f3" }}>
      {/* ① 정체성 */}
      {!(planB && wide) && <IconTooltip label="딸깍 홈으로 나가기"><button type="button" aria-label="딸깍 홈으로 나가기" onClick={onBack} className="size-10 flex items-center justify-center rounded-full hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
        <ChevronLeft size={20} color="#111827" />
      </button></IconTooltip>}
      {onSwitchApp ? (
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
      ) : (
        // 홈 B안(2026-11-20): 편집기 바꾸기 ▾를 뺐다(새 파일은 사이드바 ＋ 새로 만들기). 어떤 편집기인지는 아이콘으로만(Google 문서 방식).
        // 툴팁은 뺐다(사용자 "일러스트 아이콘 툴팁은 없어도 될 듯"): 눌리는 것도 아닌데 이름이 떠서 거슬렸다. 읽는 이름은 alt로
        // 파일이 없는 화면(UI 디자인 파일 목록)에서는 제목 대신 편집기 이름을 보인다
        <span className="flex items-center gap-2 pl-1 pr-1 h-10">
          <img src={appIcon} alt={appName} className="size-6 object-contain" />
          {!fileName && <span style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>{appName}</span>}
        </span>
      )}
      {fileName && (
        <span className="flex items-center gap-2 min-w-0">
          {onSwitchApp && <span aria-hidden style={{ color: "#cbd5e1" }}>/</span>}
          <EditableTitle value={fileName} onChange={onRenameFile} />
          {/* 💾는 파일 이름 바로 옆(2026-11-27): 저장은 파일에 관한 기능이라 오른쪽(AI · 패널 · 결과물)에서 옮겼다(Canva · 미리캔버스도 파일 이름 근처).
              저장 중은 💾 아이콘(돌아가는 원)이 보여 글자를 겹치지 않는다. 저장 못 함은 놓치면 안 되니 글자도 같이 */}
          {onSave ? (
            <>
              <SaveButton state={saveState} onSave={onSave} />
              {saveState?.kind === "error" && <SaveBadge state={saveState} />}
            </>
          ) : (saveState || location) && <SaveBadge state={saveState} location={location} />}
        </span>
      )}

      {/* ② 도구 슬롯 */}
      {/* 파일(이름 · 💾)과 도구(템플릿 등 패널 버튼) 사이 구분선(2026-11-27): 오른쪽 [패널 토글] | [결과물]과 같은 모양.
          테두리 없는 템플릿이 파일 이름에 붙은 글자처럼 읽혀서 묶음을 선으로 나눴다 */}
      {fileName && toolSlot && <>
        <span aria-hidden className={`w-px h-5 ${level ? "ml-1" : "ml-2"} mr-1 shrink-0`} style={{ background: "#e2e8f0" }} />
        <div className="flex items-center gap-2">{toolSlot}</div>
      </>}

      <div className="ml-auto flex items-center gap-2">
        {/* ③ 패널 토글 */}
        {actions}
        {actions && <span aria-hidden className="w-px h-5 mx-1" style={{ background: "#e2e8f0" }} />}
        {/* ⑤ 결과물 */}
        {fileName && capabilities.present && (presentOptions?.length || onPresent) && (
          <PresentButton options={presentOptions?.length ? presentOptions : [{ id: "present", label: presentLabel, run: onPresent! }]} />
        )}
        {/* 채운 버튼이 오른쪽 끝: 다운로드가 주요면 [공유][다운로드], 공유가 주요면 [다운로드][공유] */}
        {exportPrimary ? <>
        {fileName && hasShare && (
          <div className="relative">
            <button
              type="button"
              aria-expanded={shareOpen}
              data-onboarding="share"
              onClick={() => setShareOpen((v) => !v)}
              className="h-10 px-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]"
              style={exportPrimary ? { background: "#fff", color: "#111827", fontSize: editorType.body, fontWeight: 600, boxShadow: "inset 0 0 0 1px #e2e8f0" } : { background: accent, color: "#fff", fontSize: editorType.body, fontWeight: 600 }}
            >
              공유
            </button>
            {shareOpen && <SharePopover fileName={fileName} accent={accent} onClose={() => setShareOpen(false)} />}
          </div>
        )}
        {fileName && hasExport && (
          <div className="relative">
          <button
            type="button" aria-expanded={exportOptions ? exportOpen : undefined} aria-haspopup={exportOptions ? "dialog" : undefined}
            onClick={() => (exportOptions ? setExportOpen((v) => !v) : onExport?.())}
            className={`h-10 ${level ? "px-3" : "px-4"} rounded-lg flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]`}
            style={exportPrimary ? { background: accent, color: "#fff", fontSize: editorType.body, fontWeight: 600 } : { background: "#fff", color: "#111827", fontSize: editorType.body, fontWeight: 600, boxShadow: "inset 0 0 0 1px #e2e8f0" }}
          >
            <Download size={18} />{level < 1 ? exportLabel : <span className="sr-only">{exportLabel}</span>}
          </button>
          {exportOptions && exportOpen && <ExportPopover title={exportOptions.title} actionLabel={exportLabel} groups={exportOptions.groups} accent={accent} onClose={() => setExportOpen(false)} onExport={(c) => { setExportOpen(false); exportOptions.onExport(c); }} onShare={hasShare ? () => { setExportOpen(false); setShareOpen(true); } : undefined} />}
          </div>
        )}
        </> : <>
        {fileName && hasExport && (
          <div className="relative">
          <button
            type="button" aria-expanded={exportOptions ? exportOpen : undefined} aria-haspopup={exportOptions ? "dialog" : undefined}
            onClick={() => (exportOptions ? setExportOpen((v) => !v) : onExport?.())}
            className={`h-10 ${level ? "px-3" : "px-4"} rounded-lg flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]`}
            style={exportPrimary ? { background: accent, color: "#fff", fontSize: editorType.body, fontWeight: 600 } : { background: "#fff", color: "#111827", fontSize: editorType.body, fontWeight: 600, boxShadow: "inset 0 0 0 1px #e2e8f0" }}
          >
            <Download size={18} />{level < 1 ? exportLabel : <span className="sr-only">{exportLabel}</span>}
          </button>
          {exportOptions && exportOpen && <ExportPopover title={exportOptions.title} actionLabel={exportLabel} groups={exportOptions.groups} accent={accent} onClose={() => setExportOpen(false)} onExport={(c) => { setExportOpen(false); exportOptions.onExport(c); }} onShare={hasShare ? () => { setExportOpen(false); setShareOpen(true); } : undefined} />}
          </div>
        )}
        {fileName && hasShare && (
          <div className="relative">
            <button
              type="button"
              aria-expanded={shareOpen}
              data-onboarding="share"
              onClick={() => setShareOpen((v) => !v)}
              className="h-10 px-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]"
              style={exportPrimary ? { background: "#fff", color: "#111827", fontSize: editorType.body, fontWeight: 600, boxShadow: "inset 0 0 0 1px #e2e8f0" } : { background: accent, color: "#fff", fontSize: editorType.body, fontWeight: 600 }}
            >
              공유
            </button>
            {shareOpen && <SharePopover fileName={fileName} accent={accent} onClose={() => setShareOpen(false)} />}
          </div>
        )}
        </>}
        {/* ④ 알림: 내 계정 소식이라 파일 작업 버튼 사이가 아니라 프로필 바로 옆(2026-11-19, Google Docs·Notion·Canva·Figma와 같은 자리) */}
        {onBell && (
          <div className="ml-1"><IconTooltip label="알림"><button type="button" aria-label="알림" onClick={onBell} className="relative size-10 flex items-center justify-center rounded-full hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
            {/* 2026-11-20 점검: 손으로 그린 svg → lucide Bell(다른 아이콘과 같은 세트), 점 색은 브랜드 토큰 */}
            <Bell size={20} color="#4b5563" strokeWidth={1.7} aria-hidden />
            <span aria-hidden className="absolute top-[8px] right-[9px] size-2 rounded-full ring-2 ring-white" style={{ background: color.brand }} />
          </button></IconTooltip></div>
        )}
        {profileMenu && <div className="ml-1"><ProfileMenuButton {...profileMenu} /></div>}
      </div>
    </header>
    </HeaderWideContext.Provider></HeaderLevelContext.Provider>
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
/**
 * 저장(2026-11-27). 미리캔버스처럼 다운로드 왼쪽 아이콘 하나. 평소엔 💾 디스크(사용자 "구름은 저장처럼 안 보인다"), 저장 중 돌아가는 원, 실패 ☁!.
 * 자동 저장은 계속 되고, 누르거나 ⌘S로 지금 바로 저장. 툴팁은 짧게 "저장 (⌘S)" · "저장됨 · 방금".
 */
const SAVE_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘S" : "Ctrl+S";
function SaveButton({ state, onSave }: { state?: SaveState; onSave: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); onSave(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onSave]);
  const saving = state?.kind === "saving";
  const error = state?.kind === "error";
  const label = saving ? "저장 중" : error ? `저장 못 함: 다시 저장 (${SAVE_KEY})` : state?.kind === "saved" ? `저장됨 · ${relTimeShort(state.at)} (${SAVE_KEY})` : `저장 (${SAVE_KEY})`;
  return (
    <IconTooltip label={label}>
      <button type="button" aria-label={saving ? "저장 중" : error ? "저장 못 함, 다시 저장" : "저장"} onClick={onSave} disabled={saving}
        // 테두리 없는 아이콘(2026-11-27): 자동 저장이라 자주 누를 버튼이 아니다. 상자는 공유 · 다운로드에만
        className="size-10 flex items-center justify-center rounded-lg outline-none hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
        {saving ? <Loader2 size={19} color="#64748b" className="animate-spin" /> : error ? <CloudAlert size={20} color="#b45309" /> : <Save size={19} color="#475569" />}
      </button>
    </IconTooltip>
  );
}
function relTimeShort(at: number) {
  const m = Math.floor((Date.now() - at) / 60000);
  return m < 1 ? "방금" : m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 전`;
}

function SaveBadge({ state, location, showSaved }: { state?: SaveState; location?: string; showSaved?: boolean }) {
  if (state?.kind === "saving") {
    return <span className="shrink-0 inline-flex items-center gap-1 ml-1" style={{ fontSize: editorType.caption, color: "#94a3b8" }} aria-live="polite"><Loader2 size={12} className="animate-spin" />저장 중…</span>;
  }
  if (state?.kind === "error") {
    return <span className="shrink-0 inline-flex items-center gap-1 ml-1" style={{ fontSize: editorType.caption, color: "#b45309" }} aria-live="polite"><Cloud size={12} />저장 못 함: 이 브라우저 저장 공간 부족</span>;
  }
  if (showSaved) return <span className="shrink-0 inline-flex items-center gap-1 ml-1" style={{ fontSize: editorType.caption, color: "#64748b" }}><Check size={12} />저장됨</span>;
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

/**
 * 상단 파일 이름(2026-11-20 다시 설계, 사용자 "표시 없어도 이름 바꿀 수 있다는 걸 알까").
 * 마우스를 올리면 점선 밑줄 + 바로 뜨는 "이름 바꾸기" 툴팁(미리캔버스처럼, 테두리 상자 · 연필 아이콘 없이), **한 번 누르면** 바로 고친다(예전: 더블클릭).
 * 새 파일 기본 이름은 "제목 없는 ○○"이라 바꿔야 할 이름이라는 게 보인다.
 * 확장자(.mp4 · .hwpx …)는 이름과 같은 색으로 보이되 고치는 칸에서는 뺀다(실수로 지우지 않게). 회색은 사용자 "마음에 안 든다"로 뺐다.
 * Enter · 바깥 누르기 = 저장("이름을 바꿨어요."), Esc = 취소. 연필 아이콘은 늘 띄우지 않는다(상단 바 버튼이 이미 많다).
 */
function EditableTitle({ value, onChange }: { value: string; onChange?: (v: string) => void }) {
  const m = /^(.*?)(\.[A-Za-z0-9]{2,5})$/.exec(value);
  const base = m ? m[1] : value;
  const ext = m ? m[2] : "";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(base);
  const closed = useRef(false);
  const style = { ...f, fontSize: editorType.large, fontWeight: 700, color: "#111827", lineHeight: "20px" } as const;
  // 보기 · 고치기 두 상태가 같은 상자(높이 · 안쪽 여백 · 둥글기)를 써서, 눌러도 글자가 한 픽셀도 밀리지 않는다(2026-11-20 사용자 "누르면 밀린다").
  // 테두리는 box-shadow라 크기에 영향이 없다. 점선 밑줄은 글자 위에 겹친 한 줄(absolute)이라 줄 높이를 바꾸지 않는다
  const BOX = "flex items-center min-w-0 max-w-[260px] !shrink h-8 px-2 -mx-1 rounded-lg";
  const extEl = ext && <span className="shrink-0" style={style}>{ext}</span>;
  if (!onChange) return <span className="truncate max-w-[240px] min-w-0" style={style}>{value}</span>;
  if (!editing) {
    return (
      <IconTooltip label="이름 바꾸기">
        <button type="button" aria-label={`파일 이름 ${value}, 눌러서 이름 바꾸기`} onClick={() => { setText(base); closed.current = false; setEditing(true); }}
          className={`group/title ${BOX} text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]`}>
          {/* 미리캔버스처럼 올리면 점선 밑줄(테두리 상자 · 연필 아이콘 없이) */}
          {/* 점선은 이름 + 확장자 전체 아래 한 줄(겹친 선). 글자마다 밑줄을 그으면 한글 · 영문 높이가 달라 선이 어긋났다 */}
          <span className="relative flex min-w-0"><span className="truncate min-w-0" style={style}>{base}</span>{extEl}
            <span aria-hidden className="absolute left-0 right-0 -bottom-1 border-b border-dashed border-transparent group-hover/title:border-[#94a3b8] transition-colors" />
          </span>
        </button>
      </IconTooltip>
    );
  }
  // Enter 뒤 칸이 사라지며 blur가 한 번 더 와도 두 번 저장하지 않게(closed)
  const done = () => {
    if (closed.current) return;
    closed.current = true;
    const next = text.trim();
    setEditing(false);
    if (next && next !== base) { onChange(next + ext); showToast("이름을 바꿨어요."); }
  };
  return (
    <span className={`${BOX} bg-white`} style={{ boxShadow: "inset 0 0 0 1.5px #4f7bff" }}>
      {/* 글자 너비만큼만 칸이 늘어나게(보이지 않는 글자 + 같은 칸에 입력) — 확장자가 이름 바로 뒤에 붙는다 */}
      <span className="inline-grid min-w-0 max-w-[240px]">
        <span aria-hidden className="invisible whitespace-pre overflow-hidden" style={{ ...style, gridArea: "1 / 1" }}>{text || " "}</span>
        <input
          autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={done} onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") done(); if (e.key === "Escape") { closed.current = true; setEditing(false); } }}
          aria-label="파일 이름" size={1}
          className="field-inline outline-none bg-transparent min-w-0 w-full p-0" style={{ ...style, gridArea: "1 / 1" }}
        />
      </span>
      {extEl}
    </span>
  );
}
