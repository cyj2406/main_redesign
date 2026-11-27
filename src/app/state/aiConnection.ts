import { useSyncExternalStore } from "react";

/**
 * 설정 › AI 연결(2026-11-27, 딸깍 데스크톱 설정 내용 반영).
 * 이 컴퓨터에 설치된 AI 구독 프로그램(Codex CLI, Claude Code) 연결 상태 · 채팅을 맡길 AI · 각 모델.
 * 서버가 없어 연결 상태는 예시 값이고, 고른 값만 localStorage 에 남긴다.
 */
export type AgentId = "codex" | "claude";
export type ChatOwner = "auto" | AgentId;

export interface ModelOption { id: string; label: string; desc: string; recommended?: boolean; legacy?: boolean }

/** 모델 이름은 대시 없이 띄어 쓴다(화면 문구 대시 금지 규칙) */
export const CODEX_MODELS: ModelOption[] = [
  { id: "gpt-6.1-terra", label: "GPT 6.1 Terra", desc: "속도와 품질의 중간이에요. 단순한 문서 작업에 알맞아요." },
  { id: "gpt-6.1-sol", label: "GPT 6.1 Sol", desc: "문서 작성과 채팅 등 대부분의 작업에 알맞아요.", recommended: true },
  { id: "gpt-6-astra", label: "GPT 6 Astra", desc: "가장 똑똑해요. 어렵고 긴 작업에 쓰세요. 답이 느리고 구독 한도가 빨리 줄어요." },
  { id: "gpt-6-luna", label: "GPT 6 Luna", desc: "가장 빨라요. 짧은 질문과 간단한 수정에 쓰세요. 복잡한 문서는 품질이 떨어질 수 있어요." },
  { id: "gpt-5.5-terra", label: "GPT 5.5 Terra", desc: "이전 세대 모델이에요.", legacy: true },
  { id: "gpt-5.5-sol", label: "GPT 5.5 Sol", desc: "이전 세대 모델이에요.", legacy: true },
  { id: "gpt-5-astra", label: "GPT 5 Astra", desc: "이전 세대 모델이에요.", legacy: true },
  { id: "gpt-5-luna", label: "GPT 5 Luna", desc: "이전 세대 모델이에요.", legacy: true },
];

export const CLAUDE_MODELS: ModelOption[] = [
  { id: "default", label: "구독 기본 모델", desc: "Claude Code가 구독에 맞춰 고르는 모델이에요. 잘 모르겠으면 그대로 두세요.", recommended: true },
  { id: "sonnet", label: "Claude Sonnet", desc: "문서 작성과 채팅 등 대부분의 작업에 알맞아요. 빠르고 한도가 천천히 줄어요." },
  { id: "opus", label: "Claude Opus", desc: "더 똑똑해요. 어렵고 긴 작업에 쓰세요. 구독 한도가 빨리 줄어요." },
  { id: "fable", label: "Claude Fable", desc: "가장 똑똑해요. 구독에 따라 쓸 수 없을 수 있고, 한도가 가장 빨리 줄어요." },
  { id: "haiku", label: "Claude Haiku", desc: "가장 빨라요. 짧은 질문과 간단한 수정에 쓰세요." },
];

export const AGENT_NAME: Record<AgentId, string> = { codex: "Codex CLI", claude: "Claude Code" };

export interface AiConnectionState {
  connected: Record<AgentId, boolean>;
  chatOwner: ChatOwner;
  codexModel: string;
  claudeModel: string;
}

const KEY = "ddalkkak.aiConnection.v1";
const DEFAULT: AiConnectionState = { connected: { codex: true, claude: true }, chatOwner: "codex", codexModel: "gpt-6-luna", claudeModel: "sonnet" };

function load(): AiConnectionState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* 저장소를 못 읽는 환경: 기본값 */ }
  return DEFAULT;
}

let state: AiConnectionState = typeof window === "undefined" ? DEFAULT : load();
const listeners = new Set<() => void>();

export function updateAiConnection(patch: Partial<AiConnectionState>) {
  state = { ...state, ...patch };
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 불가: 이번 세션만 */ }
  listeners.forEach((l) => l());
}

export function useAiConnection() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}

/** 지금 채팅을 실제로 맡고 있는 쪽. 자동이면 Codex가 먼저, 고른 쪽이 끊겼으면 다른 쪽 */
export function activeChatAgent(s: AiConnectionState): AgentId | null {
  const first: AgentId = s.chatOwner === "claude" ? "claude" : "codex";
  const other: AgentId = first === "codex" ? "claude" : "codex";
  if (s.connected[first]) return first;
  if (s.connected[other]) return other;
  return null;
}

export function modelLabel(list: ModelOption[], id: string) {
  return list.find((m) => m.id === id)?.label ?? id;
}

/**
 * 딸깍 AI 패널 입력창의 모델 버튼(2026-11-27). 예전 "딸깍 AI 높음·보통·낮음 + 내 키" 대신 설정 › AI 연결과 같은 목록을 쓴다.
 * id 형식: "codex:gpt-6-luna" · "claude:sonnet". 새 대화는 설정에서 채팅을 맡은 AI와 그 모델로 시작하고,
 * 대화에서 바꾼 건 그 대화에만 쓴다(설정 값은 그대로).
 */
export type PanelModelId = string;

export const panelModelId = (agent: AgentId, model: string): PanelModelId => `${agent}:${model}`;
export const panelAgentOf = (id: PanelModelId): AgentId | null => (id.startsWith("codex:") ? "codex" : id.startsWith("claude:") ? "claude" : null);
export const isConnectionModel = (id: string | undefined) => !!id && panelAgentOf(id) !== null;

/** 설정 기준 기본값. 연결된 AI가 없으면 null */
export function panelDefault(s: AiConnectionState): PanelModelId | null {
  const a = activeChatAgent(s);
  if (!a) return null;
  return panelModelId(a, a === "codex" ? s.codexModel : s.claudeModel);
}

/** 고른 모델의 AI가 끊겼으면 기본값으로 */
export function validPanelModel(id: PanelModelId | null, s: AiConnectionState): PanelModelId | null {
  const a = id ? panelAgentOf(id) : null;
  return a && s.connected[a] ? id : panelDefault(s);
}

/** 버튼(short)과 결과 줄에 쓰는 이름. short는 "Sonnet"처럼 앞의 "Claude"를 뗀다 */
export function panelModelLabel(id: PanelModelId, short = false): string {
  const a = panelAgentOf(id);
  if (!a) return id;
  const m = id.slice(id.indexOf(":") + 1);
  if (a === "codex") return modelLabel(CODEX_MODELS, m);
  if (m === "default") return short ? "Claude 기본" : "Claude 구독 기본 모델";
  const label = modelLabel(CLAUDE_MODELS, m);
  return short ? label.replace(/^Claude /, "") : label;
}
