import { useSyncExternalStore } from "react";

import { readFlag, writeFlag } from "./onboardingStore";

/**
 * 시작 튜토리얼(홈 B안, 2026-11-20). 기획: docs/starter-tour.md
 * 홈 → 한글 편집기 → 템플릿 누르기 → 딸깍 AI 추천 문장 누르기. 3단계, 30초.
 * 화면을 넘나들어서(홈 → 편집기) 단계는 모듈 상태 하나로 들고 다닌다.
 *
 * phase
 * - "home"     : 홈 새로 만들기 줄 위 말풍선([혼자 둘러볼게요] [30초 따라 하기])
 * - "template" : 한글 편집기 왼쪽 템플릿 패널. 템플릿이 문서에 들어가면 다음으로
 * - "ai"       : 오른쪽 딸깍 AI 추천 문장. 하나 누르면 말풍선을 걷고("ai-wait") AI 결과가 나오면 끝
 * - "share"    : 끝까지 따라 한 사람에게만 마무리 말풍선 하나(단계 수에 안 셈). 상단 [공유]를 가리킨다.
 *                화면을 어둡게 하지 않아 방금 AI가 쓴 문서가 그대로 보인다. [확인] · 공유 누르기 · Esc로 닫힌다
 */
export type StarterPhase = null | "home" | "template" | "ai" | "ai-wait" | "share";

let phase: StarterPhase = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setStarterPhase(p: StarterPhase) { phase = p; emit(); }
export const getStarterPhase = () => phase;
export function useStarterPhase() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => phase, () => phase);
}

export const STARTER_TOTAL = 3;
/** 첫 방문 1회 */
export const STARTER_SEEN_KEY = "ddalkkak.onboarding.starterSeen";

// ── 건너뛴 사람용 파란 점 힌트(편집기 상단 [템플릿] · [딸깍 AI]) ──
// 튜토리얼을 끝까지 따라 하면 둘 다 본 것으로 친다. 버튼을 한 번 누르면 그 점만 사라진다.
export type EditorHintId = "templates" | "ai";
const hintKey = (id: EditorHintId) => `ddalkkak.onboarding.hint.${id}`;
let hintRev = 0;
const hintListeners = new Set<() => void>();
export function markHintSeen(id: EditorHintId) {
  if (readFlag("local", hintKey(id))) return;
  writeFlag("local", hintKey(id)); hintRev++; hintListeners.forEach((l) => l());
}
export function useHintVisible(id: EditorHintId) {
  useSyncExternalStore((l) => { hintListeners.add(l); return () => hintListeners.delete(l); }, () => hintRev, () => hintRev);
  return !readFlag("local", hintKey(id));
}
