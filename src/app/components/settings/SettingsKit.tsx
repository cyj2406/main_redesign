import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";

import { color, f, radius, shadow } from "@/app/styleTokens";
import { FIELD_CLASS, FIELD_SURFACE } from "@/app/components/common/InputField";

/**
 * 설정 화면 공통 조각(2026-11-27). 탭마다 따로 그리던 섹션 머리 · 카드 · 줄 · 토글 · 라디오 목록 · 입력칸을 모았다.
 * 가독성 기준(docs/design-system.md "설정 화면"):
 *   - 설명 글자는 color.text.secondary(#64748b, 흰 바탕 대비 4.7:1). 예전 muted(#9ca3af)는 2.5:1이라 읽기 힘들었다.
 *   - 선택지는 카드마다 굵은 테두리 대신 테두리 하나로 묶고 줄 사이 구분선(AI 모델 탭과 같은 방식). 고른 줄은 브랜드 점 + 옅은 바탕.
 *   - 한 줄에 정보 하나: 제목 14/600, 설명 13/400.
 */

export function SettingsSectionHead({ title, desc, action }: { title: string; desc?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p style={{ ...f, fontWeight: 700, fontSize: 16, color: color.text.primary, letterSpacing: "-0.4px" }}>{title}</p>
        {desc && (
          <p style={{ ...f, fontWeight: 400, fontSize: 13.5, color: color.text.secondary, letterSpacing: "-0.2px", lineHeight: 1.6, marginTop: 6, wordBreak: "keep-all" }}>{desc}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** 작은 묶음 제목(카드 안 소제목, "앱 정보" 같은 묶음 이름) */
export function SettingsGroupLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ ...f, fontWeight: 600, fontSize: 13, color: color.text.secondary, letterSpacing: "-0.2px", ...style }}>{children}</p>;
}

export function SettingsCard({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`bg-white ${className}`} style={{ border: `1px solid ${color.border.default}`, borderRadius: radius.card, boxShadow: shadow.card, ...style }}>
      {children}
    </div>
  );
}

/** 카드 안 한 줄: 왼쪽 제목·설명 / 오른쪽 컨트롤 */
export function SettingsRow({ title, desc, control, divider }: { title: ReactNode; desc?: ReactNode; control?: ReactNode; divider?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5" style={{ borderTop: divider ? `1px solid ${color.surface.hover}` : undefined }}>
      <div className="min-w-0">
        <div style={{ ...f, fontWeight: 600, fontSize: 14, color: color.text.primary, letterSpacing: "-0.3px" }}>{title}</div>
        {desc && <p style={{ ...f, fontWeight: 400, fontSize: 13, color: color.text.secondary, letterSpacing: "-0.2px", lineHeight: 1.55, marginTop: 3, wordBreak: "keep-all" }}>{desc}</p>}
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </div>
  );
}

/** 토글 — 설정 › 알림과 같은 모양(켜짐 검정) */
export function SettingsToggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4f7bff] disabled:opacity-50"
      style={{ background: checked ? color.text.primary : "#d1d5db" }}
    >
      <span className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200" style={{ left: 2, transform: checked ? "translateX(18px)" : "none" }} />
    </button>
  );
}

export interface RadioOption { id: string; label: string; desc?: string; badge?: ReactNode }

/** 라디오 목록 — 테두리 하나로 묶고 줄마다 구분선. 고른 줄은 브랜드 점 + 옅은 바탕 */
export function SettingsRadioList({ label, options, value, onChange }: { label: string; options: RadioOption[]; value: string; onChange: (id: string) => void }) {
  return (
    <SettingsCard className="overflow-hidden">
      <div role="radiogroup" aria-label={label} className="flex flex-col">
        {options.map((o, i) => {
          const on = value === o.id;
          return (
            <button
              key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)}
              className="flex items-center gap-3 text-left px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f7bff]"
              style={{ borderTop: i ? `1px solid ${color.surface.hover}` : undefined, background: on ? color.surface.subtle : undefined }}
            >
              <span className="size-[18px] rounded-full shrink-0 flex items-center justify-center" style={{ border: `1.5px solid ${on ? color.brand : "#cbd5e1"}`, background: "#fff" }}>
                {on && <span className="size-2.5 rounded-full" style={{ background: color.brand }} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span style={{ ...f, fontSize: 14, fontWeight: 600, color: color.text.primary, letterSpacing: "-0.3px" }}>{o.label}</span>
                  {o.badge}
                </span>
                {o.desc && <span className="block" style={{ ...f, fontSize: 13, color: color.text.secondary, lineHeight: 1.5, marginTop: 2, letterSpacing: "-0.2px", wordBreak: "keep-all" }}>{o.desc}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

/** 라벨 + 한 줄 입력칸. changed면 라벨 옆에 브랜드 점("저장 전 바뀐 항목") */
export function SettingsField({ label, changed, hint, className = "", style, ...input }: { label: string; changed?: boolean; hint?: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <span className="flex items-center gap-1.5" style={{ ...f, fontWeight: 600, fontSize: 13, color: "#334155", letterSpacing: "-0.2px" }}>
        {label}
        {changed && <span className="size-1.5 rounded-full" style={{ background: color.brand }} aria-label="바뀜" />}
      </span>
      <input
        {...input}
        className={`${FIELD_CLASS} h-11 w-full min-w-0 rounded-xl px-3.5 outline-none placeholder:text-[#b0b8c4]`}
        style={{ ...f, ...FIELD_SURFACE, fontSize: 14, fontWeight: 500, color: color.text.primary, border: `1px solid ${changed ? "#bfd0ff" : color.border.default}`, ...style }}
      />
      {hint && <span style={{ ...f, fontSize: 12, color: color.text.secondary }}>{hint}</span>}
    </label>
  );
}

/** 연결됨 같은 상태 표시 — 초록 쌍은 AI 모델 탭 "내 키" 배지와 같은 값 */
export function StatusPill({ tone, children }: { tone: "success" | "neutral"; children: ReactNode }) {
  const t = tone === "success" ? { bg: "#ecfdf5", fg: "#047857", dot: "#10b981" } : { bg: "#f1f5f9", fg: "#475569", dot: "#94a3b8" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 whitespace-nowrap" style={{ ...f, fontSize: 12, fontWeight: 600, background: t.bg, color: t.fg }}>
      <span className="size-1.5 rounded-full" style={{ background: t.dot }} />{children}
    </span>
  );
}
