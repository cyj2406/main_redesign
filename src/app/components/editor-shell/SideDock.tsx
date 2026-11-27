import type { ComponentType, ReactNode } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

import { color, f, editorType } from "@/app/styleTokens";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

import { PanelResizeHandle, usePanelWidth } from "./PanelResize";
import { useHeaderLevel, useHeaderWide } from "./EditorHeader";

/**
 * 오른쪽 도크(에디터 공통, 2026-11-13 v2) — 맨 오른쪽 세로 탭 줄(항상 보임) + 그 왼쪽 패널(기본 360px, 2026-11-19 300에서 넓힘: AI 대화 16px. 왼쪽 끝을 끌어 300~600px).
 * 탭을 누르면 열고, 같은 탭을 다시 누르거나 패널 머리의 »(PanelCloseButton)를 누르면 접는다. 패널은 접거나 다른 탭으로 바꿔도 언마운트하지 않는다
 * (AI 작업·대화·입력 중인 글이 그대로 남는다). Google Workspace·Canva 오른쪽 사이드 패널과 같은 구조.
 */
export interface DockTab {
  id: string;
  label: string;
  /** 툴팁 — 단축키 안내 등. 없으면 label */
  hint?: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  /** 숫자 배지(읽지 않음 등) */
  badge?: number;
  /** 배지 대신 점 — "끝났어요" 같은 알림 */
  dot?: boolean;
  disabled?: boolean;
  /** 아이콘 옆에 이름을 함께 보여 주는 강조 버튼(딸깍 AI처럼 핵심 기능, 2026-11-19) */
  emphasized?: boolean;
  panel: ReactNode;
}

/**
 * rail=false 면 오른쪽 세로 탭 줄을 그리지 않는다 — 토글은 상단 바의 DockButtons 로 옮긴다(2026-11-19 가로 단계 줄이기).
 */
export function SideDock({ tabs, active, onChange, width: defWidth = 360, rail = true }: { tabs: DockTab[]; active: string | null; onChange: (id: string | null) => void; width?: number; rail?: boolean }) {
  // 왼쪽 가장자리를 끌어 너비 조절(2026-11-19). 모든 에디터·모든 도크 탭이 같은 너비를 공유한다.
  const panel = usePanelWidth("dock", defWidth, 300, 600);
  const width = panel.width;
  return (
    <>
      <div className="relative shrink-0 h-full bg-white overflow-hidden" style={{ width: active ? width : 0, borderLeft: active ? "1px solid #eef0f3" : undefined, transition: panel.dragging ? "none" : "width 200ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
        {active && <PanelResizeHandle side="left" panel={panel} label="오른쪽 패널 너비 조절" />}
        {tabs.map((t) => (
          <div key={t.id} className="h-full" style={{ width, display: active === t.id ? "block" : "none" }} role="tabpanel" aria-label={t.label}>
            {t.panel}
          </div>
        ))}
      </div>
      {rail && <nav className="shrink-0 w-12 h-full flex flex-col items-center gap-1 py-2 bg-white" style={{ ...f, borderLeft: "1px solid #eef0f3" }} aria-label="도구 패널" role="tablist" aria-orientation="vertical">
        {tabs.map((t) => {
          const on = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id} type="button" role="tab" aria-selected={on} disabled={t.disabled}
              aria-label={t.badge ? `${t.label} (읽지 않음 ${t.badge})` : t.label}
              title={t.hint ?? (on ? `${t.label} 닫기` : `${t.label} 열기`)}
              onClick={() => onChange(on ? null : t.id)}
              className="relative flex flex-col items-center gap-0.5 w-11 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-35"
            >
              <span className="size-8 rounded-lg flex items-center justify-center" style={{ background: on ? color.surface.accent : "transparent" }}>
                <Icon size={20} color={on ? color.brand : "#475569"} />
              </span>
              <span style={{ fontSize: editorType.caption, color: on ? "#111827" : "#64748b", fontWeight: on ? 600 : 400 }}>{t.label}</span>
              {!!t.badge && (
                <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full flex items-center justify-center" style={{ background: color.brand, color: "#fff", fontSize: 9.5, fontWeight: 700 }}>{t.badge > 99 ? "99+" : t.badge}</span>
              )}
              {!t.badge && t.dot && <span className="absolute top-1.5 right-2 size-2 rounded-full" style={{ background: color.brand }} />}
            </button>
          );
        })}
      </nav>}
    </>
  );
}

/** 패널 머리 왼쪽 끝 접기 버튼(»). 모든 도크 패널이 같은 자리에 둔다 — Claude in Chrome·Figma 오른쪽 패널과 같은 위치 */
/**
 * 패널 닫기. 규칙(2026-11-27): 패널 머리의 캔버스 쪽 끝에, 패널이 접히는 방향을 가리키는 » 또는 «.
 * 오른쪽 패널(AI · 코멘트 · 기록)은 왼쪽 끝 », 왼쪽 패널(템플릿)은 오른쪽 끝 «. 예전엔 왼쪽 패널만 ✕라 같은 동작이 달라 보였다.
 */
export function PanelCloseButton({ onClick, shortcut, side = "right", label = "패널 닫기" }: { onClick: () => void; shortcut?: string; side?: "left" | "right"; label?: string }) {
  const Icon = side === "left" ? ChevronsLeft : ChevronsRight;
  return (
    <IconTooltip label={shortcut ? `${label} (${shortcut})` : label}><button
      type="button"
      aria-label={label}
     
      onClick={onClick}
      className="size-8 shrink-0 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
    >
      <Icon size={15} color="#475569" />
    </button></IconTooltip>
  );
}

/**
 * 상단 바용 패널 버튼 — [✨ 딸깍 AI] [🕘 버전 기록] [💬 코멘트]. 누르면 그 패널을 열고, 열린 걸 다시 누르면 닫는다.
 * - 딸깍 AI(emphasized)만 옅은 파랑 바탕 + 이름(아주 좁을 때만 아이콘). 열리면 파란 테두리를 더한다.
 * - 나머지(버전 기록 · 코멘트)는 테두리 없는 "아이콘 + 이름", 열리면 옅은 회색 바탕(2026-11-27). 템플릿 버튼과 같은 규칙.
 *   예전 회색 묶음은 아무 패널도 안 열렸을 때 고른 게 없는 탭처럼(비활성처럼) 보였고, 덩어리가 커서 딸깍 AI와 무게가 비슷했다.
 *   이름은 상단 바가 넉넉할 때만(HeaderWideContext). 툴팁 · aria-label에는 항상 남는다.
 */
export function DockButtons({ tabs, active, onChange }: { tabs: Omit<DockTab, "panel">[]; active: string | null; onChange: (id: string | null) => void }) {
  const level = useHeaderLevel();
  const wide = useHeaderWide();
  const main = tabs.filter((t) => t.emphasized);
  const rest = tabs.filter((t) => !t.emphasized);
  const tip = (t: Omit<DockTab, "panel">, on: boolean) => t.hint ?? (on ? `${t.label} 닫기` : `${t.label} 열기`);
  return (
    <div className="flex items-center gap-2" role="toolbar" aria-label="패널 열기">
      {main.map((t) => {
        const on = active === t.id;
        const Icon = t.icon;
        return (
          <IconTooltip key={t.id} label={tip(t, on)}><button
            type="button" aria-pressed={on} disabled={t.disabled} aria-label={t.label}
            onClick={() => onChange(on ? null : t.id)}
            className={`relative h-10 ${level < 2 ? "pl-3 pr-4" : "px-2.5"} flex items-center gap-2 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-35 hover:brightness-[0.97]`}
            style={{ ...f, background: color.surface.accent, color: color.brand, fontSize: editorType.body, fontWeight: 600, boxShadow: on ? `inset 0 0 0 1.5px ${color.brand}` : undefined }}
          >
            <Icon size={20} color={color.brand} />
            {level < 2 && <span className="whitespace-nowrap">{t.label}</span>}
            {t.dot && !on && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full" style={{ background: color.brand, boxShadow: "0 0 0 2px #fff" }} />}
          </button></IconTooltip>
        );
      })}
      {rest.length > 0 && (
        <div className="flex items-center gap-1">
          {rest.map((t) => {
            const on = active === t.id;
            const Icon = t.icon;
            const fg = on ? "#111827" : "#475569";
            return (
              <IconTooltip key={t.id} label={tip(t, on)}><button
                type="button" aria-pressed={on} disabled={t.disabled}
                aria-label={t.badge ? `${t.label} (읽지 않음 ${t.badge})` : t.label}
                onClick={() => onChange(on ? null : t.id)}
                className={`relative h-10 ${wide ? "pl-2.5 pr-3" : "w-10 justify-center"} flex items-center gap-1.5 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-35 ${on ? "" : "hover:bg-black/[0.05]"}`}
                style={{ ...f, background: on ? "#f1f5f9" : "transparent", color: fg, fontSize: editorType.body, fontWeight: on ? 600 : 500 }}
              >
                <Icon size={19} color={fg} />
                {wide && <span className="whitespace-nowrap">{t.label}</span>}
                {!!t.badge && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full flex items-center justify-center" style={{ ...f, background: color.brand, color: "#fff", fontSize: 9.5, fontWeight: 700, boxShadow: "0 0 0 2px #fff" }}>{t.badge > 99 ? "99+" : t.badge}</span>}
                {!t.badge && t.dot && !on && <span className="absolute top-1 right-1 size-2 rounded-full" style={{ background: color.brand, boxShadow: "0 0 0 2px #fff" }} />}
              </button></IconTooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
