import { useEffect, useRef, useState } from "react";
import { Asterisk, SquareTerminal, ChevronDown, FolderOpen, LogIn, LogOut, MoreHorizontal, RefreshCw } from "lucide-react";

import { Badge } from "@/app/components/common/Badge";
import { Button } from "@/app/components/common/Button";
import { showToast } from "@/app/components/common/Toast";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";
import {
  AGENT_NAME, CLAUDE_MODELS, CODEX_MODELS, activeChatAgent, updateAiConnection, useAiConnection,
  type AgentId, type ChatOwner,
} from "@/app/state/aiConnection";
import { color, f, shadow } from "@/app/styleTokens";
import { SettingsCard, SettingsGroupLabel, SettingsRadioList, SettingsSectionHead, StatusPill } from "./SettingsKit";

/**
 * 설정 › AI 연결(2026-11-27 2차, 사용자 "잘 못하는 사람들도 쉽게, 필요 없는 정보는 생략").
 * 처음 보는 사람이 알아야 하는 것만 위에 둔다:
 *   ① 지금 AI를 쓸 수 있는지(섹션 설명 한 줄)  ② 어떤 AI가 연결돼 있는지(한 줄씩, 버튼 하나)  ③ 채팅을 누가 맡을지(둘 다 연결됐을 때만)
 * 모델 고르기 · 앱 버전 · 로그는 "고급 설정"으로 접는다(기본 닫힘). 잘 몰라도 그대로 두면 되는 값이라서.
 * 뺀 것: "할 수 있는 일" 칩, 로그 경로와 chat-failures.jsonl 설명, 긴 이어받기 설명. 다른 계정으로 로그인 · 로그아웃은 ⋯ 메뉴로.
 */
const APP_VERSION = "0.3.24";
const LOG_PATH = "~/Library/Application Support/net.ddalkkak.desktop/logs";

// 공급자 로고 대신 lucide 아이콘(브랜드 그림을 쓰지 않는다). 색은 둘 다 중립(색으로 꾸미지 않는다)
const AGENT_INFO: Record<AgentId, { Icon: typeof Asterisk; bg: string; fg: string; sub: string }> = {
  codex: { Icon: SquareTerminal, bg: "#f1f5f9", fg: "#0f172a", sub: "글과 이미지를 모두 만들어요" },
  claude: { Icon: Asterisk, bg: "#f1f5f9", fg: "#0f172a", sub: "글을 써요" },
};

export function AiConnectionSettings() {
  const s = useAiConnection();
  const [checking, setChecking] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const active = activeChatAgent(s);
  const both = s.connected.codex && s.connected.claude;

  const recheck = () => {
    setChecking(true);
    window.setTimeout(() => { setChecking(false); showToast("연결 상태를 다시 확인했어요."); }, 700);
  };

  return (
    <div className="flex flex-col gap-8" style={f}>
      {/* ① 제목 + 지금 상태 한 줄(2026-11-27 3차, 사용자 "초록 카드가 AI 디자인 같다"):
          색 채운 상태 카드를 없애고 다른 설정 섹션과 같은 머리(제목 · 설명 · 오른쪽 버튼)에 상태를 한 줄로.
          Linear · Vercel 설정처럼 상태는 작은 점 + 글자만. 연결됨 색은 아래 줄의 StatusPill이 맡는다 */}
      <SettingsSectionHead
        title="AI 연결"
        desc={active
          ? `이 컴퓨터의 AI 구독으로 작업해요. 지금 채팅은 ${AGENT_NAME[active]}가 맡고 있어요.`
          : "이 컴퓨터의 AI 구독으로 작업해요. 아래에서 하나만 로그인하면 바로 쓸 수 있어요."}
        action={
          <Button variant="secondary" size="md" onClick={recheck} loading={checking}>
            <RefreshCw size={15} strokeWidth={1.8} />다시 확인
          </Button>
        }
      />

      {/* ② 연결한 AI */}
      <div className="flex flex-col gap-2.5">
        <SettingsGroupLabel>이 컴퓨터의 AI</SettingsGroupLabel>
        <SettingsCard>
          {(["codex", "claude"] as AgentId[]).map((id, i) => <AgentRow key={id} id={id} divider={i > 0} />)}
        </SettingsCard>
      </div>

      {/* ③ 채팅을 맡길 AI: 둘 다 있을 때만 고를 게 있다 */}
      {both && (
        <div className="flex flex-col gap-2.5">
          <SettingsGroupLabel>채팅과 문서 작업은 누가 할까요?</SettingsGroupLabel>
          <SettingsRadioList
            label="채팅과 문서 작업을 맡길 AI"
            value={s.chatOwner}
            onChange={(v) => updateAiConnection({ chatOwner: v as ChatOwner })}
            options={[
              { id: "auto", label: "알아서", desc: "하나가 막히면 다른 쪽이 이어서 해요.", badge: <Badge tone="brand">추천</Badge> },
              { id: "codex", label: "Codex" },
              { id: "claude", label: "Claude Code", desc: "이미지는 Codex가 만들어요." },
            ]}
          />
        </div>
      )}

      {/* ④ 고급 설정(접힘) */}
      <div className="flex flex-col gap-4">
        <button
          type="button" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced}
          className="self-start h-9 -ml-2 px-2 rounded-lg inline-flex items-center gap-1 outline-none hover:bg-[#f1f5f9] focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
          style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}
        >
          고급 설정
          <ChevronDown size={16} strokeWidth={2} style={{ transform: advanced ? "rotate(180deg)" : undefined, transition: "transform 150ms" }} />
          {!advanced && <span style={{ fontSize: 13, fontWeight: 400, color: color.text.secondary, marginLeft: 4 }}>모델 고르기, 앱 정보</span>}
        </button>
        {advanced && <Advanced />}
      </div>
    </div>
  );
}

/** 연결된 AI 한 줄: 이름 · 한 줄 설명 / 연결됨 + ⋯(다른 계정으로 로그인 · 로그아웃) 또는 로그인 버튼 */
function AgentRow({ id, divider }: { id: AgentId; divider: boolean }) {
  const s = useAiConnection();
  const connected = s.connected[id];
  const name = AGENT_NAME[id];
  const info = AGENT_INFO[id];
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [menu]);
  const setConnected = (v: boolean) => updateAiConnection({ connected: { ...s.connected, [id]: v } });

  return (
    <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: divider ? `1px solid ${color.surface.hover}` : undefined }}>
      <span className="size-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: info.bg, color: info.fg }}><info.Icon size={20} strokeWidth={2} /></span>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 15, fontWeight: 700, color: color.text.primary, letterSpacing: "-0.3px" }}>{name}</p>
        <p style={{ fontSize: 13, color: color.text.secondary, marginTop: 1 }}>{connected ? info.sub : "로그인하면 바로 쓸 수 있어요"}</p>
      </div>
      {connected ? (
        <div ref={ref} className="relative flex items-center gap-1 shrink-0">
          <StatusPill tone="success">연결됨</StatusPill>
          <IconTooltip label="계정 관리">
            <button
              type="button" aria-label={`${name} 계정 관리`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}
              className="size-9 rounded-lg flex items-center justify-center outline-none hover:bg-[#f1f5f9] focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
            >
              <MoreHorizontal size={18} color="#475569" />
            </button>
          </IconTooltip>
          {menu && (
            <div role="menu" className="absolute right-0 top-11 z-20 bg-white rounded-xl py-1 w-[220px]" style={{ boxShadow: shadow.popover, border: `1px solid ${color.border.default}` }}>
              <button role="menuitem" type="button" className="w-full flex items-center gap-2.5 px-3 h-10 text-left hover:bg-[#f8fafc] outline-none focus-visible:bg-[#f1f5f9]"
                onClick={() => { setMenu(false); showToast(`${name} 로그인 창을 열었어요. 예시라서 실제로 열리지는 않아요.`); }}>
                <RefreshCw size={15} color="#475569" /><span style={{ fontSize: 14, color: color.text.primary }}>다른 계정으로 로그인</span>
              </button>
              <button role="menuitem" type="button" className="w-full flex items-center gap-2.5 px-3 h-10 text-left hover:bg-[#fef2f2] outline-none focus-visible:bg-[#fef2f2]"
                onClick={() => { setMenu(false); setConnected(false); showToast(`${name}에서 로그아웃했어요.`, "success", { label: "되돌리기", onClick: () => setConnected(true) }); }}>
                <LogOut size={15} color="#dc2626" /><span style={{ fontSize: 14, color: "#dc2626" }}>로그아웃</span>
              </button>
              <p style={{ fontSize: 12, color: color.text.secondary, padding: "6px 12px 8px", lineHeight: 1.5, borderTop: `1px solid ${color.surface.hover}`, marginTop: 4 }}>
                구독 한도가 찼다면 다른 계정으로 로그인해 보세요.
              </p>
            </div>
          )}
        </div>
      ) : (
        <Button variant="dark" size="md" onClick={() => { setConnected(true); showToast(`${name}에 연결했어요.`); }}>
          <LogIn size={15} strokeWidth={1.8} />로그인
        </Button>
      )}
    </div>
  );
}

/** 고급 설정: 모델 · 앱 버전 · 로그. 잘 몰라도 그대로 두면 된다 */
function Advanced() {
  const s = useAiConnection();
  const [showLegacy, setShowLegacy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const recommended = <Badge tone="brand">추천</Badge>;
  const codexOptions = CODEX_MODELS.filter((m) => !m.legacy || showLegacy || m.id === s.codexModel);

  return (
    <div className="flex flex-col gap-7">
      <p className="rounded-xl px-3.5 py-2.5" style={{ fontSize: 13, color: "#334155", background: color.surface.subtle, lineHeight: 1.55 }}>
        잘 모르겠으면 그대로 두세요. 바꾸면 다음 요청부터 적용돼요.
      </p>

      {s.connected.codex && (
        <div className="flex flex-col gap-2.5">
          <SettingsGroupLabel>Codex 모델</SettingsGroupLabel>
          <SettingsRadioList
            label="Codex 모델" value={s.codexModel} onChange={(v) => updateAiConnection({ codexModel: v })}
            options={codexOptions.map((m) => ({ id: m.id, label: m.label, desc: m.desc, badge: m.recommended ? recommended : undefined }))}
          />
          <button type="button" onClick={() => setShowLegacy((v) => !v)} aria-expanded={showLegacy}
            className="self-start rounded-md px-1 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
            style={{ fontSize: 13, fontWeight: 600, color: color.text.secondary }}>
            {showLegacy ? "이전 모델 접기" : "이전 모델도 보기"}
          </button>
        </div>
      )}

      {s.connected.claude && (
        <div className="flex flex-col gap-2.5">
          <SettingsGroupLabel>Claude 모델</SettingsGroupLabel>
          <SettingsRadioList
            label="Claude 모델" value={s.claudeModel} onChange={(v) => updateAiConnection({ claudeModel: v })}
            options={CLAUDE_MODELS.map((m) => ({ id: m.id, label: m.label, desc: m.desc, badge: m.recommended ? recommended : undefined }))}
          />
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <SettingsGroupLabel>앱 정보</SettingsGroupLabel>
        <SettingsCard>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: 14, fontWeight: 600, color: color.text.primary }}>딸깍 데스크톱 {APP_VERSION}</p>
              <p style={{ fontSize: 13, color: "#047857", marginTop: 1 }}>최신 버전이에요</p>
            </div>
            <Button variant="secondary" size="md" loading={updating}
              onClick={() => { setUpdating(true); window.setTimeout(() => { setUpdating(false); showToast("최신 버전이에요."); }, 800); }}>
              업데이트 확인
            </Button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: `1px solid ${color.surface.hover}` }}>
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: 14, fontWeight: 600, color: color.text.primary }}>문제가 생겼나요?</p>
              <p style={{ fontSize: 13, color: color.text.secondary, marginTop: 1 }}>문의할 때 로그 폴더의 파일을 함께 보내 주세요.</p>
            </div>
            <IconTooltip label={LOG_PATH}>
              <span><Button variant="secondary" size="md" onClick={() => showToast("로그 폴더는 데스크톱 앱에서 열 수 있어요.")}>
                <FolderOpen size={15} strokeWidth={1.8} />로그 폴더 열기
              </Button></span>
            </IconTooltip>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
