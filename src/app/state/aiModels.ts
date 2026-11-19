import { useSyncExternalStore } from "react";

/**
 * AI 모델 선택(2026-11-19). 기획: docs/ai-models.md.
 *   - 딸깍 기본 AI: 높음 · 보통 · 낮음(크레딧 배율이 다르다)
 *   - 내 AI: Anthropic · OpenAI · Google을 API 키로 연결 → 그 모델 이름 그대로 고른다. 딸깍 크레딧을 쓰지 않는다.
 * creditBalance.ts처럼 모듈 변수 + 구독자로 앱 전체가 같은 값을 본다. 이 브라우저(localStorage)에 기억한다.
 * 키 보안: 프로토타입은 키 전체를 저장하지 않고 끝 4자리만 둔다(실제 서비스는 서버에 암호화 저장).
 */

export type Tier = "high" | "mid" | "low";
export type ProviderId = "anthropic" | "openai" | "google";
/** "ddalkkak:mid" | "anthropic:Claude Sonnet 5.5" … */
export type ModelId = string;

export const TIERS: { id: Tier; label: string; desc: string; multiplier: number; note: string }[] = [
  { id: "high", label: "높음", desc: "가장 꼼꼼해요. 긴 문서·복잡한 표에", multiplier: 2, note: "크레딧 2배" },
  { id: "mid", label: "보통", desc: "대부분의 작업에 알맞아요", multiplier: 1, note: "기본" },
  { id: "low", label: "낮음", desc: "빠르고 크레딧을 적게 써요. 짧은 수정에", multiplier: 0.5, note: "크레딧 절반" },
];

/** 공급자 — models는 예시 목록(실제로는 연결한 키로 공급자의 모델 목록을 불러온다) */
export const PROVIDERS: { id: ProviderId; name: string; product: string; keyPrefix: string; keyHint: string; keyUrl: string; models: string[] }[] = [
  { id: "anthropic", name: "Anthropic", product: "Claude", keyPrefix: "sk-ant-", keyHint: "sk-ant-로 시작해요", keyUrl: "https://console.anthropic.com/settings/keys", models: ["Claude Opus 5.5", "Claude Sonnet 5.5", "Claude Haiku 5.5"] },
  { id: "openai", name: "OpenAI", product: "ChatGPT", keyPrefix: "sk-", keyHint: "sk-로 시작해요", keyUrl: "https://platform.openai.com/api-keys", models: ["GPT-5", "GPT-5 mini"] },
  { id: "google", name: "Google", product: "Gemini", keyPrefix: "AIza", keyHint: "AIza로 시작해요", keyUrl: "https://aistudio.google.com/apikey", models: ["Gemini 2.5 Pro", "Gemini 2.5 Flash"] },
];

export interface Connection { last4: string; visible: string[]; connectedAt: number }
interface State { defaultModel: ModelId; connections: Partial<Record<ProviderId, Connection>> }

const KEY = "ddalkkak.aiModels.v1";
const DEFAULT: State = { defaultModel: "ddalkkak:mid", connections: {} };
function load(): State {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as State | null; return v ? { ...DEFAULT, ...v } : DEFAULT; } catch { return DEFAULT; }
}
let state: State = load();
const listeners = new Set<() => void>();
function set(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 이번 세션만 */ }
  listeners.forEach((l) => l());
}
export const getAiModels = () => state;
export function useAiModels(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, getAiModels, getAiModels);
}

export const isOwnKey = (id: ModelId) => !id.startsWith("ddalkkak:");
export const providerOf = (id: ModelId) => PROVIDERS.find((p) => id.startsWith(`${p.id}:`));
export function modelLabel(id: ModelId, short = false): string {
  if (id.startsWith("ddalkkak:")) { const t = TIERS.find((x) => `ddalkkak:${x.id}` === id) ?? TIERS[1]; return short ? t.label : `딸깍 AI ${t.label}`; }
  return id.slice(id.indexOf(":") + 1);
}
/** 기준 크레딧 → 이 모델로 쓸 크레딧. 내 키는 0 */
export function creditFor(id: ModelId | undefined, base: number): number {
  if (!id) return base;
  if (isOwnKey(id)) return 0;
  const t = TIERS.find((x) => `ddalkkak:${x.id}` === id) ?? TIERS[1];
  return Math.max(1, Math.round(base * t.multiplier));
}
/** 입력창에 보일 내 AI 모델(연결 + 체크한 것) */
export function ownModels(s: State = state): { id: ModelId; label: string; provider: string }[] {
  return PROVIDERS.flatMap((p) => (s.connections[p.id]?.visible ?? []).map((m) => ({ id: `${p.id}:${m}`, label: m, provider: p.product })));
}
/** 고른 모델이 사라졌으면(연결 해제·숨김) 기본으로 */
export function validModel(id: ModelId, s: State = state): ModelId {
  if (!isOwnKey(id)) return id;
  return ownModels(s).some((m) => m.id === id) ? id : "ddalkkak:mid";
}

export function setDefaultModel(id: ModelId) { set({ ...state, defaultModel: id }); }
/** 키 형식 확인 후 연결(끝 4자리만 저장). 실패 문구를 돌려준다 */
export function connectProvider(pid: ProviderId, key: string): string | null {
  const p = PROVIDERS.find((x) => x.id === pid)!;
  const k = key.trim();
  if (!k) return "API 키를 붙여 넣어 주세요.";
  // OpenAI(sk-)와 Anthropic(sk-ant-)이 겹치므로 공급자 칸을 바꿔 넣은 경우도 알려 준다
  if (pid === "openai" && k.startsWith("sk-ant-")) return "Anthropic(Claude) 키예요. Claude 칸에 넣어 주세요.";
  if (!k.startsWith(p.keyPrefix) || k.length < 20) return `키 형식이 맞지 않아요. ${p.product} 키는 ${p.keyHint}.`;
  set({ ...state, connections: { ...state.connections, [pid]: { last4: k.slice(-4), visible: p.models.slice(0, 2), connectedAt: Date.now() } } });
  return null;
}
export function disconnectProvider(pid: ProviderId) {
  const connections = { ...state.connections };
  delete connections[pid];
  const next = { ...state, connections };
  set({ ...next, defaultModel: validModel(state.defaultModel, next) });
}
export function toggleVisible(pid: ProviderId, model: string) {
  const c = state.connections[pid];
  if (!c) return;
  const visible = c.visible.includes(model) ? c.visible.filter((m) => m !== model) : [...c.visible, model];
  const next = { ...state, connections: { ...state.connections, [pid]: { ...c, visible } } };
  set({ ...next, defaultModel: validModel(state.defaultModel, next) });
}
