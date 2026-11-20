import { useEffect } from "react";

import { Button } from "@/app/components/common/Button";
import { Coachmark } from "./Coachmark";
import { readFlag, writeFlag } from "./onboardingStore";
import { STARTER_SEEN_KEY, STARTER_TOTAL, getStarterPhase, setStarterPhase, useStarterPhase } from "./starterTour";
import { track } from "./track";

/**
 * 시작 튜토리얼 1단계(홈 B안). 새로 만들기 줄을 밝히고 [혼자 둘러볼게요] [30초 따라 하기].
 * 따라 하기 또는 줄에서 한글을 직접 누르면 한글 편집기로 넘어가 2단계(DocEditor 안 StarterEditorSteps).
 */
// 홈 B안: 새로 만들기 줄 / 지금 홈(A안): 편집기 바로 열기 줄(2026-11-20 지금 홈에도 적용, 예전 홈 온보딩 대신)
const ROWS = {
  a: { row: '[data-onboarding="editor-row"]', hangul: '[data-onboarding="editor-row"] button[aria-label="한글 편집기 열기"]' },
  b: { row: '[data-onboarding="new-row"]', hangul: '[data-onboarding="new-row"] button[aria-label="한글 새로 만들기"]' },
};

export function StarterHome({ variant, enabled, replayToken, onFollow }: { variant: "a" | "b"; enabled: boolean; replayToken: number; onFollow: () => void }) {
  const { row: ROW, hangul: HANGUL } = ROWS[variant];
  const phase = useStarterPhase();

  const start = (source: "auto" | "replay") => {
    const t = window.setTimeout(() => {
      if (!document.querySelector(ROW)) return;
      writeFlag("local", STARTER_SEEN_KEY);
      setStarterPhase("home");
      track("starter_start", { source });
      track("starter_step_view", { step: 1 });
    }, 600);
    return () => window.clearTimeout(t);
  };
  // 첫 방문 자동
  useEffect(() => {
    if (!enabled || readFlag("local", STARTER_SEEN_KEY)) return;
    return start("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  // 다시 보기(프로필 메뉴)
  useEffect(() => {
    if (!replayToken || !enabled) return;
    return start("replay");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayToken, enabled]);
  // 홈을 벗어났는데 아직 1단계면 끝(다른 편집기를 직접 고른 경우)
  useEffect(() => {
    if (!enabled && getStarterPhase() === "home") setStarterPhase(null);
  }, [enabled]);
  // 밝힌 줄에서 한글을 직접 누르면 따라 하기와 같다(편집기가 열리기 전에 단계를 넘긴다)
  useEffect(() => {
    if (phase !== "home") return;
    const down = (e: MouseEvent) => {
      if ((e.target as Element).closest?.(HANGUL)) { track("starter_follow", { via: "row" }); setStarterPhase("template"); }
    };
    document.addEventListener("click", down, true);
    return () => document.removeEventListener("click", down, true);
  }, [phase]);

  if (phase !== "home" || !enabled) return null;
  const skip = () => { track("starter_skip", { step: 1 }); setStarterPhase(null); };
  return (
    <Coachmark
      target={ROW} placement="bottom" step={1} total={STARTER_TOTAL} pulse={HANGUL}
      title="만들 문서를 골라 시작해요"
      body="한글, 엑셀, PPT까지 쓰던 편집기를 그대로 써요. 한글로 30초만 따라 해 볼까요?"
      actions={<>
        <Button variant="secondary" size="md" onClick={skip} style={{ height: 36, padding: "0 14px", fontSize: 13 }}>혼자 둘러볼게요</Button>
        <Button variant="primary" size="md" autoFocus onClick={() => { track("starter_follow", { via: "button" }); setStarterPhase("template"); onFollow(); }} style={{ height: 36, padding: "0 16px", fontSize: 13 }}>30초 따라 하기</Button>
      </>}
    />
  );
}
