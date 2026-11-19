import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpCircle, LogOut, Mail, Settings as SettingsIcon, UserRound, Users } from "lucide-react";

import { Button } from "@/app/components/common/Button";
import { useFocusTrap } from "@/app/components/common/useFocusTrap";
import { ProfileAvatar } from "@/app/components/mypage/ProfileAvatar";
import { useCreditBalance } from "@/app/state/creditBalance";
import { useProfile } from "@/app/state/profile";
import { findPlan, useSubscription } from "@/app/state/subscription";
import { color, f, radius, typography } from "@/app/styleTokens";

/**
 * 프로필 메뉴(계정 메뉴): 서비스 상단바(App.tsx TopBar)와 에디터 공통 헤더(editor-shell/EditorHeader)가
 * 같은 컴포넌트를 쓴다(2026-11-19). 한쪽만 고치지 말 것.
 *
 * 2026-11-19 정리(ChatGPT·Claude·Canva·Figma·미리캔버스 계정 메뉴와 비교):
 *   - 머리: 아바타 + 이름(구독 중이면 플랜 배지) + 이메일.
 *   - 크레딧 카드는 정리 전 기존 모양 그대로(사용자 결정, 2026-11-19): [사용 가능 크레딧 · 내역 보기 ›] / 잔액 20px /
 *     꽉 찬 "요금제 및 크레딧" 버튼(secondary). 같은 날 한 줄 → 충전·요금제 두 버튼으로 바꿔 봤다가 되돌렸다.
 *   - 묶음: [마이페이지 · 설정] / [튜토리얼 다시 보기 · 문의하기 · 커뮤니티] / [로그아웃]. 도움말 성격을 한 묶음으로.
 *   - 줄 높이 약 40px(예전 50px), 글자 14px.
 *   - 커뮤니티·문의하기·로그아웃은 이전에 눌러도 아무 일이 없었다. 이제 각각 콜백을 받는다.
 * 크레딧이 상단바에 상시 보이면 만들기 전에 비용부터 계산하게 되므로, 잔액은 이 메뉴를 열어야 보인다.
 */
const ROW_CLASS = "w-full flex items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-[#f8fafc] focus-visible:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f7bff]";
const ROW_TEXT = { ...f, fontWeight: 500, fontSize: 14, color: "#1e293b", letterSpacing: "-0.3px" } as const;
const ICON = { size: 18, strokeWidth: 1.6, color: "#94a3b8" } as const;

export function ProfileMenuButton({ onCreditClick, onHistoryClick, onStartTutorial, onSettingsOpen, onMyPageClick, onContact, onCommunity, onLogout }: {
  /** "요금제 및 크레딧" 버튼 */
  onCreditClick?: () => void;
  /** "내역 보기 ›": 설정 › 크레딧(사용 내역) */
  onHistoryClick?: () => void;
  /** 마이페이지(사진·이름·이메일) */
  onMyPageClick?: () => void;
  onStartTutorial?: () => void;
  onSettingsOpen?: () => void;
  onContact?: () => void;
  onCommunity?: () => void;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [creditBalance] = useCreditBalance();
  // 이름·이메일·아바타는 마이페이지에서 고친 값을 그대로 따른다(state/profile.ts).
  const profile = useProfile();
  // 구독 중(해지 예정 포함)일 때만 플랜 배지. 조회 전에는 Free를 임의로 달지 않는다.
  const subscription = useSubscription();
  const currentPlan = findPlan(subscription.planId);
  const hasCurrentPlan = subscription.status === "active" || subscription.status === "cancel_scheduled";
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(menuRef, open);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn?: () => void) => () => { setOpen(false); fn?.(); };
  const Row = ({ icon, label, onClick, last }: { icon: ReactNode; label: string; onClick?: () => void; last?: boolean }) => (
    <button type="button" role="menuitem" onClick={run(onClick)} className={`${ROW_CLASS}${last ? " pb-3" : ""}`}>
      <span className="shrink-0">{icon}</span>
      <span style={ROW_TEXT}>{label}</span>
    </button>
  );
  const Divider = () => <div className="h-px my-1.5 bg-[#f1f5f9]" />;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${profile.name} 계정 메뉴`}
        title={profile.name}
        // 터치 영역 44×44(투명), 보이는 아바타는 32px. 크기를 키우지 않고 누르기 쉬운 영역만 넓힌다.
        className="group size-11 flex items-center justify-center rounded-full shrink-0 outline-none"
        style={{ background: "transparent" }}
      >
        <span className="block rounded-full overflow-hidden border border-[#c7d2fe] transition-shadow duration-150 group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-[#c7d2fe] group-focus-visible:ring-2 group-focus-visible:ring-offset-1 group-focus-visible:ring-[#4f7bff]" style={{ width: 32, height: 32 }}>
          <ProfileAvatar profile={profile} size={30} />
        </span>
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="프로필"
          className="profile-menu-pop absolute right-0 rounded-[18px] bg-white overflow-hidden"
          style={{ top: 42, width: 268, border: "1px solid #e2e8f0", boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", zIndex: 60 }}
        >
          {/* 머리: 아바타 · 이름(플랜) · 이메일 */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <ProfileAvatar profile={profile} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate" style={{ ...f, fontWeight: 700, fontSize: 15, color: "#0a0a0a", letterSpacing: "-0.4px" }}>{profile.name}</p>
                {hasCurrentPlan && currentPlan && (
                  <span className="rounded-full px-2 py-0.5 shrink-0" style={{ ...f, fontWeight: 700, fontSize: 11, letterSpacing: "-0.1px", color: color.brand, background: color.surface.accent }}>
                    {currentPlan.name}
                  </span>
                )}
              </div>
              <p className="truncate" style={{ ...f, fontWeight: 400, fontSize: 12.5, color: "#94a3b8", marginTop: 1 }}>{profile.email}</p>
            </div>
          </div>

          {/* 크레딧 카드(기존 모양): 사용 가능 크레딧 · 내역 보기 / 잔액 / 요금제 및 크레딧 */}
          <div className="px-4 pb-3">
            <div className="flex flex-col gap-3" style={{ background: color.surface.accent, borderRadius: radius.card, padding: "14px 16px" }}>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span style={typography.caption}>사용 가능 크레딧</span>
                  {onHistoryClick && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={run(onHistoryClick)}
                      className="shrink-0 -my-1 -mr-1.5 px-1.5 py-1 rounded-md outline-none transition-colors hover:bg-black/[0.06] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]"
                      style={{ ...f, fontWeight: 600, fontSize: 12, color: color.brand, letterSpacing: "-0.2px" }}
                    >
                      내역 보기 ›
                    </button>
                  )}
                </div>
                <span className="truncate" style={{ ...f, fontWeight: 700, fontSize: 20, color: color.text.primary, letterSpacing: "-0.4px" }}>
                  {creditBalance.toLocaleString()}
                </span>
              </div>
              <Button variant="secondary" size="md" fullWidth role="menuitem" style={{ whiteSpace: "nowrap" }} onClick={run(onCreditClick)}>
                요금제 및 크레딧
              </Button>
            </div>
          </div>

          <Divider />
          <Row icon={<UserRound {...ICON} />} label="마이페이지" onClick={onMyPageClick} />
          <Row icon={<SettingsIcon {...ICON} />} label="설정" onClick={onSettingsOpen} />
          <Divider />
          <Row icon={<HelpCircle {...ICON} />} label="튜토리얼 다시 보기" onClick={onStartTutorial} />
          <Row icon={<Mail {...ICON} />} label="문의하기" onClick={onContact} />
          <Row icon={<Users {...ICON} />} label="커뮤니티" onClick={onCommunity} />
          <Divider />
          <Row icon={<LogOut {...ICON} />} label="로그아웃" onClick={onLogout} last />
        </div>
      )}
      <style>{`
        @keyframes profileMenuIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .profile-menu-pop { animation: profileMenuIn 160ms cubic-bezier(0.4, 0, 0.2, 1); transform-origin: top right; }
        @media (prefers-reduced-motion: reduce) { .profile-menu-pop { animation: none; } }
      `}</style>
    </div>
  );
}
