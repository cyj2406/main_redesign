import { useId, type ReactNode } from "react";
import { color, editorEntry, f, motion, radius, typography } from "@/app/styleTokens";
import { Badge } from "@/app/components/common/Badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { EDITOR_APPS } from "@/app/components/editor-shell/apps";

/** 홈 아이콘 줄이 여는 에디터 — App이 워크스페이스 카테고리·결과 형식으로 바꿔 연다. */
// "layer"는 홈 줄에서 빠졌지만(2026-11-13) App.openEditor가 레이어 분리 미니 에디터로 여는 길은 남아 있다.
export type EditorKind = "image" | "word" | "hangul" | "ppt" | "excel" | "pdf" | "uidesign" | "video" | "layer";

/** 목록·그림·이름은 editor-shell/apps.ts 한 곳(공통 헤더 앱 전환 격자와 같은 목록, 2026-11-19). */
const EDITORS: { kind: Exclude<EditorKind, "layer">; label: string; hint: string; art: string }[] =
  EDITOR_APPS.map((a) => ({ kind: a.id, label: a.label, hint: a.hint, art: a.art }));

/**
 * 항목 하나 — 클릭 영역(item × 전체 높이)이 hover 배경 영역과 같고, 모든 항목이 같은 크기다.
 * 아이콘 칸(icon) + 아래 이름. 기본 상태는 배경 없음, hover 는 color.surface.hover 배경(전 항목 동일).
 * hover/포커스 때 한 줄 용도를 툴팁으로 보여준다. 포커스 링은 inset 이라 가로 스크롤 줄에서 잘리지 않는다.
 * 스크린리더: 이름은 aria-label("○○ 편집기 열기"), 툴팁 문구는 설명으로 aria-describedby 에 따로 건다(이름에 합치지 않는다).
 * Radix 툴팁 본문은 열려 있을 때만 DOM 에 있어 그 id 로는 항상 연결할 수 없으므로, 같은 문구를 hidden 요소(고유 id)로
 * 늘 렌더링해 연결한다 — hidden 이어도 aria-describedby 참조로는 읽힌다. 버튼에 직접 준 aria-describedby 가 Radix 가
 * 열릴 때만 넣는 값보다 우선하므로 hover 여부와 관계없이 연결이 유지된다.
 */
function EntryButton({ label, hint, onClick, children, badge, ariaLabel }: {
  label: string;
  hint: string;
  onClick: () => void;
  children: ReactNode;
  badge?: string;
  ariaLabel?: string;
}) {
  const hintId = `editor-hint-${useId()}`;
  return (
    <>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={ariaLabel}
          aria-describedby={hintId}
          className="editor-entry shrink-0 flex flex-col items-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f7bff]"
          style={{ width: editorEntry.item, padding: editorEntry.pad, gap: editorEntry.space, borderRadius: radius.card, transition: `background-color ${motion.fast}`, scrollSnapAlign: "start" }}
        >
          <span className="relative flex items-center justify-center" style={{ width: editorEntry.icon, height: editorEntry.icon }}>
            {children}
            {badge && (
              <span aria-hidden className="absolute" style={{ top: editorEntry.badgeTop, right: editorEntry.badgeRight }}>
                <Badge tone="brandSolid" size="sm">{badge}</Badge>
              </span>
            )}
          </span>
          <span
            className="whitespace-nowrap"
            style={{ ...f, fontWeight: 500, fontSize: editorEntry.labelSize, lineHeight: `${editorEntry.labelLineHeight}px`, letterSpacing: "-0.2px", color: typography.body.color }}
          >
            {label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" sideOffset={6} collisionPadding={8}>{hint}</TooltipContent>
    </Tooltip>
    <span id={hintId} hidden>{hint}</span>
    </>
  );
}

/**
 * 홈 상단 에디터 진입 줄(2026-10-22 재구성) — 위 검색창(AI로 시작)의 대안 경로.
 *   [──── 편집기 바로 열기 ────]
 *   [한글 워드 엑셀 PPT PDF UI 디자인 이미지 영상]  — 2026-11-13 도구모음 대응, 레이어 분리·구분선 제거
 * 각 항목은 해당 포맷의 에디터를 바로 연다(2026-10-29 전체 템플릿 버튼과 첫 구분선 제거).
 * 묶음(.editor-row-inner, w-max)을 홈 공통 컨테이너 안에서 margin-inline:auto 로 가운데 둔다 — 검색창과 같은 중심축.
 * 넘칠 때 justify-center 는 왼쪽이 잘리므로 쓰지 않는다(auto 마진은 0 이 되어 왼쪽 여백부터 가로 스크롤).
 * 라벨 줄은 가로 스크롤 영역 밖(최대 폭 = 묶음 폭)이라 묶음 정렬에 끼어들지 않고, 좁은 화면에서도 보이는 영역 가운데에 남는다.
 * NEW 배지는 absolute 라 정렬에 영향이 없다.
 * 세로 합계는 이전과 같은 130px(styleTokens editorEntry 주석 참고). 모바일에선 페이지 좌우 여백 밖까지 펼친다.
 */
/**
 * 아이콘 묶음 폭 — 항목 8개 + 사이 space 7칸.
 * 라벨 줄의 최대 폭으로 쓴다: 넓은 화면에선 라벨 양옆 선이 묶음 폭과 같고, 묶음이 넘치는 좁은 화면에선
 * 보이는 컨테이너 폭에 맞춰 가운데에 남는다(라벨 줄은 가로 스크롤 영역 밖에 있다).
 */
const BUNDLE_WIDTH = EDITORS.length * editorEntry.item + (EDITORS.length - 1) * editorEntry.space;

export function EditorQuickLinks({ onOpenEditor }: { onOpenEditor: (kind: EditorKind) => void }) {
  const rule = <span aria-hidden className="flex-1 h-px" style={{ background: color.border.default }} />;
  return (
    <nav
      data-tutorial="categories"
      data-onboarding="editor-row"
      aria-labelledby="editor-row-label"
      className="flex flex-col self-stretch"
      style={{ marginTop: editorEntry.searchGapExtra, gap: editorEntry.captionGap, ["--row-gutter" as string]: "var(--gap-screen-x)" }}
    >
      <style>{`
        .editor-row {
          margin-left: calc(-1 * var(--row-gutter)); margin-right: calc(-1 * var(--row-gutter));
          /* 위아래 8px: 가로 스크롤 칸이 세로도 잘라서 튜토리얼 강조 테두리 · 포커스 링이 잘렸다(2026-11-20). 바깥 자리는 음수 여백으로 그대로 */
          padding: 8px var(--row-gutter); margin-top: -8px; margin-bottom: -8px;
          scroll-padding-inline: var(--row-gutter); scroll-snap-type: x proximity;
          scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain;
        }
        .editor-row::-webkit-scrollbar { display: none; }
        .editor-entry:hover { background: ${color.surface.hover}; }
      `}</style>
      <div className="w-full mx-auto flex items-center" style={{ maxWidth: BUNDLE_WIDTH, gap: editorEntry.space }}>
          {rule}
          <p
            id="editor-row-label"
            className="whitespace-nowrap"
            style={{ ...typography.caption, color: color.text.secondary, lineHeight: `${editorEntry.captionLineHeight}px` }}
          >
            편집기 바로 열기
          </p>
          {rule}
      </div>
      <div className="editor-row overflow-x-auto">
        <div className="editor-row-inner w-max mx-auto flex items-start" style={{ gap: editorEntry.space }}>
          {EDITORS.map((e) => (
            <EntryButton key={e.kind} label={e.label} hint={e.hint} ariaLabel={`${e.label} 편집기 열기`} onClick={() => onOpenEditor(e.kind)}>
              <img src={e.art} alt="" draggable={false} className="block" style={{ width: editorEntry.icon, height: editorEntry.icon, objectFit: "contain" }} />
            </EntryButton>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default EditorQuickLinks;
