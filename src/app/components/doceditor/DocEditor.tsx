import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, LayoutGrid, MessageCircle, Sparkles, History } from "lucide-react";

import { Button } from "@/app/components/common/Button";
import { showToast } from "@/app/components/common/Toast";
import { Coachmark } from "@/app/components/onboarding/Coachmark";
import { STARTER_TOTAL, getStarterPhase, markHintSeen, setStarterPhase, useHintVisible, useStarterPhase } from "@/app/components/onboarding/starterTour";
import { track } from "@/app/components/onboarding/track";
import { AiAssistantPanel, type AiRequest, type AiResult, type BriefConfig } from "@/app/components/editor-shell/AiAssistantPanel";
import { CommentListPanel } from "@/app/components/editor-shell/CommentListPanel";
import { COMMENT_SHORTCUT, isCommentShortcut, isUnread, type CommentAuthor } from "@/app/components/editor-shell/comments";
import { EditorHeader, type ProfileMenuHandlers, type SaveState, type Viewer, HeaderLabel } from "@/app/components/editor-shell/EditorHeader";
import { DockButtons, SideDock } from "@/app/components/editor-shell/SideDock";
import { VersionHistoryPanel, promptTitle } from "@/app/components/editor-shell/VersionHistoryPanel";
import { PanelResizeHandle, usePanelWidth } from "@/app/components/editor-shell/PanelResize";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";
import { creditFor } from "@/app/state/aiModels";
import { setCreditBalance } from "@/app/state/creditBalance";
import { useProfile } from "@/app/state/profile";
import { color, f, editorType } from "@/app/styleTokens";
import artHangul from "@/assets/home/editor/hangul.png";
import artWord from "@/assets/home/editor/word.png";
import artExcel from "@/assets/home/editor/excel.png";
import artPpt from "@/assets/home/editor/ppt.png";
import artPdf from "@/assets/home/editor/pdf.png";
import artVideo from "@/assets/home/editor/video-edit.png";
import artImage from "@/assets/home/editor/image.png";

import { DocCommentLayer, docThreadActions, snapToSheetCell, useDocCommentMembers, type DocThread } from "./DocCommentLayer";
import { ThreadPopover } from "@/app/components/uidesign/Comments";
import { DOC_TEMPLATES, type DocKind, type DocTemplate } from "./docTemplates";
import { MockToolbar } from "./MockToolbar";
import { EditorLoading, EmbeddedStatus, EmbeddedTop, ImageEditorFrame, PdfHome, PdfTop, VideoEditorFrame } from "./EmbeddedChrome";
import { PaperThumb } from "./PaperThumb";
import { TemplatePanel, TemplatePreview } from "./TemplatePanel";

/**
 * 한글·워드·엑셀·PPT·PDF·영상·이미지 편집기 셸(2026-11-19). 기획: docs/doc-editor.md. 셋은 안쪽 오픈소스 에디터만 다르고 바깥은 같다.
 *   상단 바(공통 EditorHeader: 앱 ▾ · 파일 이름 · 저장 상태 · [템플릿] · ✨ 딸깍 AI · 🔔 · 공유 · 프로필)
 *   / [왼쪽 템플릿 패널] [가운데 오픈소스 에디터 자리] [오른쪽 딸깍 AI]
 * 가운데 편집 영역은 오픈소스 에디터라 고칠 수 없다. 이 프로젝트엔 그 에디터가 없어 템플릿·AI 결과만 보이는 목업이다.
 * 코멘트는 UI 디자인 에디터와 같은 방식(헤더 "코멘트"로 남기기 + 코멘트 목록 패널, 쪽 위 핀). 기록·내보내기는 안쪽 에디터에 맡긴다.
 */

/** 문서(한글·워드) "자세히 적어서 요청하기" — 주제 · 꼭 들어갈 내용 · 받는 사람 · 말투 */
const DOC_BRIEF: BriefConfig = {
  submitLabel: "문서 쓰기",
  fields: [
    { id: "topic", label: "무엇을 쓸까요", placeholder: "예: 12월 워크숍 장소 협조 요청 공문", required: true },
    { id: "points", label: "꼭 들어갈 내용", placeholder: "예: 일시 12월 12일, 인원 40명, 회신 기한", multiline: true },
    { id: "to", label: "받는 사람", placeholder: "예: 시설관리팀, 팀장 보고" },
    { id: "tone", label: "말투", placeholder: "", chips: ["공식적인", "공손한", "간결한", "친근한"] },
  ],
  compose: (v) => [`「${v.topic.trim()}」 써 줘.`, v.points?.trim() && `꼭 들어갈 내용: ${v.points.trim()}`, v.to?.trim() && `받는 사람: ${v.to.trim()}`, v.tone && `말투: ${v.tone}`].filter(Boolean).join("\n"),
};
/** 시트(엑셀) — 분위기·로고 대신 표에 필요한 것: 무엇을 정리 · 열 · 기간 · 계산 */
const SHEET_BRIEF: BriefConfig = {
  submitLabel: "표 채우기",
  fields: [
    { id: "topic", label: "무엇을 정리할까요", placeholder: "예: 11월 매장별 매출 정리", required: true },
    { id: "cols", label: "들어갈 항목(열)", placeholder: "예: 매장, 1~4주 매출, 합계" },
    { id: "range", label: "기간·범위", placeholder: "예: 강남·성수·홍대 3개 매장, 11월" },
    { id: "calc", label: "계산", placeholder: "", chips: ["합계", "평균", "전월 대비", "비율"] },
  ],
  compose: (v) => [`「${v.topic.trim()}」 표 만들어 줘.`, v.cols?.trim() && `열: ${v.cols.trim()}`, v.range?.trim() && `기간·범위: ${v.range.trim()}`, v.calc && `계산: ${v.calc}`].filter(Boolean).join("\n"),
};
/** 발표(PPT) — 무엇을 발표 · 꼭 넣을 내용 · 듣는 사람 · 장수 */
const SLIDE_BRIEF: BriefConfig = {
  submitLabel: "슬라이드 만들기",
  fields: [
    { id: "topic", label: "무엇을 발표할까요", placeholder: "예: 가을 신메뉴 출시 안내", required: true },
    { id: "points", label: "꼭 넣을 내용", placeholder: "예: 메뉴 3종, 출시일 10월 1일, 할인 20%", multiline: true },
    { id: "audience", label: "듣는 사람", placeholder: "예: 매장 점주, 투자자" },
    { id: "count", label: "장수", placeholder: "", chips: ["5장", "10장", "15장"] },
  ],
  compose: (v) => [`「${v.topic.trim()}」 발표 자료 만들어 줘.`, v.points?.trim() && `꼭 넣을 내용: ${v.points.trim()}`, v.audience?.trim() && `듣는 사람: ${v.audience.trim()}`, v.count && `장수: ${v.count}`].filter(Boolean).join("\n"),
};
/** PDF — 이미 있는 파일에 시키는 일: 무엇을 · 범위 · 덧붙일 요청 */
const PDF_BRIEF: BriefConfig = {
  submitLabel: "실행하기",
  fields: [
    { id: "task", label: "무엇을 할까요", placeholder: "", required: true, chips: ["요약", "번역", "표를 엑셀로", "개인정보 가리기"] },
    { id: "range", label: "범위", placeholder: "예: 전체, 3~5쪽" },
    { id: "more", label: "덧붙일 요청", placeholder: "예: 세 줄로, 숫자는 그대로", multiline: true },
  ],
  compose: (v) => [`이 PDF ${v.range?.trim() || "전체"}: ${v.task} 해 줘.`, v.more?.trim() && `덧붙일 요청: ${v.more.trim()}`].filter(Boolean).join("\n"),
};
/** 영상 — 분위기·로고 대신 영상에 필요한 것: 무엇 · 길이 · 비율 · 자막 */
const VIDEO_BRIEF: BriefConfig = {
  submitLabel: "영상 만들기",
  fields: [
    { id: "topic", label: "무엇을 만들까요", placeholder: "예: 우리 카페 신메뉴 홍보 숏폼", required: true },
    { id: "length", label: "길이", placeholder: "", chips: ["15초", "30초", "60초"] },
    { id: "ratio", label: "화면 비율", placeholder: "", chips: ["세로 9:16", "가로 16:9", "정사각 1:1"] },
    { id: "caption", label: "꼭 넣을 자막", placeholder: "예: 오늘만 1+1, 매장 위치", multiline: true },
  ],
  compose: (v) => [`「${v.topic.trim()}」 영상 만들어 줘.`, v.length && `길이: ${v.length}`, v.ratio && `비율: ${v.ratio}`, v.caption?.trim() && `꼭 넣을 자막: ${v.caption.trim()}`].filter(Boolean).join("\n"),
};
/** 이미지 — dev 브리프의 분위기는 여기서만 의미가 있다 */
const IMAGE_BRIEF: BriefConfig = {
  submitLabel: "이미지 만들기",
  fields: [
    { id: "topic", label: "무엇을 만들까요", placeholder: "예: 가을 신메뉴 할인 이벤트 이미지", required: true },
    { id: "size", label: "크기", placeholder: "", chips: ["정사각 1080", "세로 1080×1350", "가로 1200×628"] },
    { id: "mood", label: "분위기", placeholder: "", chips: ["깔끔한", "고급스러운", "귀여운", "강렬한"] },
    { id: "copy", label: "꼭 넣을 문구", placeholder: "예: 20% 할인, 10월 31일까지", multiline: true },
  ],
  compose: (v) => [`「${v.topic.trim()}」 이미지 만들어 줘.`, v.size && `크기: ${v.size}`, v.mood && `분위기: ${v.mood}`, v.copy?.trim() && `꼭 넣을 문구: ${v.copy.trim()}`].filter(Boolean).join("\n"),
};

/**
 * 템플릿 브리프(2026-11-19, dev "○○ 브리프" 참고) — 템플릿을 넣은 문서면 "자세히 적어서 요청하기"가 그 템플릿 칸으로 바뀐다.
 * 칸 = 템플릿의 "들어 있는 항목"(최대 6개), 비운 칸은 AI가 알맞게 채운다. dev처럼 공통 칸(분위기·로고 등)을 함께 늘어놓지 않는다.
 * 엑셀은 항목이 열 이름이라 칸 대신 "어떤 데이터로 · 기간·범위 · 계산"을 묻는다.
 */
function templateBrief(tpl: DocTemplate): BriefConfig {
  const base = {
    key: tpl.id, title: `${tpl.title} 내용 채우기`, teaser: "빈칸만 채우면 견본 글을 바꿔 드려요",
    description: "템플릿의 견본 글을 적은 내용으로 바꿔요. 바뀌는 모습은 편집기에서 바로 보여요.",
    submitLabel: "템플릿 채우기", requireAny: true, footnote: "비운 칸은 AI가 알맞게 채워요. 사용한 만큼 크레딧이 들어요.",
  };
  if (tpl.kind === "excel") {
    return {
      ...base,
      fields: [
        { id: "data", label: "어떤 데이터로 채울까요", placeholder: `예: ${tpl.sections.slice(0, 3).join(", ")} 실제 값`, multiline: true },
        { id: "range", label: "기간·범위", placeholder: "예: 11월, 강남·성수·홍대 3개 매장" },
        { id: "calc", label: "계산", placeholder: "", chips: ["합계", "평균", "전월 대비", "비율"] },
      ],
      compose: (v) => [`「${tpl.title}」 템플릿의 견본 값을 아래 내용으로 바꿔 줘. 열: ${tpl.sections.join(", ")}`, v.data?.trim() && `데이터: ${v.data.trim()}`, v.range?.trim() && `기간·범위: ${v.range.trim()}`, v.calc && `계산: ${v.calc}`].filter(Boolean).join("\n"),
    };
  }
  const secs = tpl.sections.slice(0, 6);
  return {
    ...base,
    fields: [
      ...secs.map((x, i) => ({ id: `s${i}`, label: x, placeholder: "비워 두면 AI가 채워요" })),
      { id: "more", label: "더 알려 줄 것", placeholder: "예: 회신 기한 12월 5일, 담당자 연락처 넣기", multiline: true },
    ],
    compose: (v) => [`「${tpl.title}」 템플릿의 견본 글을 아래 내용으로 바꿔 줘.`, ...secs.map((x, i) => v[`s${i}`]?.trim() && `${x}: ${v[`s${i}`].trim()}`), v.more?.trim() && `더 알려 줄 것: ${v.more.trim()}`].filter(Boolean).join("\n"),
  };
}

const CONF: Record<DocKind, { appId: string; appName: string; label: string; icon: string; ext: string; untitled: string; place: string; surface: string; suggestions: string[]; example: string; brief: BriefConfig }> = {
  hangul: {
    appId: "hangul", appName: "한글 편집기", label: "한글", icon: artHangul, ext: "hwpx", untitled: "제목 없는 문서", place: "1쪽", surface: "문서",
    suggestions: ["행사 개최 알림 공문 써 줘", "출장 결과 보고서 초안 써 줘", "협조 요청 공문 써 줘"],
    example: "“제목을 '2026 사업계획서'로 넣고 아래에 추진 일정 표를 만들어 줘”", brief: DOC_BRIEF,
  },
  word: {
    appId: "word", appName: "딸깍 문서", label: "워드", icon: artWord, ext: "docx", untitled: "제목 없는 문서", place: "1쪽", surface: "문서",
    suggestions: ["월간 업무 보고서 초안 써 줘", "회의록 정리해 줘", "자기소개서 지원 동기 써 줘"],
    example: "“제목을 '2026 사업계획서'로 넣고 아래에 일정 표를 만들어 줘”", brief: DOC_BRIEF,
  },
  excel: {
    appId: "excel", appName: "딸깍 시트", label: "엑셀", icon: artExcel, ext: "xlsx", untitled: "제목 없는 시트", place: "Sheet1", surface: "시트",
    suggestions: ["11월 매장별 매출 표 만들어 줘", "거래처 견적 표 만들어 줘", "월별 지출 정리 표 만들어 줘"],
    example: "“A열에 매장, B~E열에 주차별 매출을 넣고 마지막 줄에 합계를 만들어 줘”", brief: SHEET_BRIEF,
  },
  ppt: {
    appId: "ppt", appName: "딸깍 슬라이드", label: "PPT", icon: artPpt, ext: "pptx", untitled: "제목 없는 발표 자료", place: "1번 슬라이드", surface: "슬라이드",
    suggestions: ["신제품 출시 발표 자료 만들어 줘", "분기 실적 보고 슬라이드 만들어 줘", "회사 소개 5장 만들어 줘"],
    example: "“1장 제목을 '가을 신메뉴 출시'로 바꾸고 아래에 할인 문구를 넣어 줘”", brief: SLIDE_BRIEF,
  },
  pdf: {
    appId: "pdf", appName: "딸깍 PDF", label: "PDF", icon: artPdf, ext: "pdf", untitled: "제목 없는 PDF", place: "1쪽", surface: "PDF",
    suggestions: ["이 PDF 세 줄로 요약해 줘", "3쪽 표를 엑셀로 바꿔 줘", "전화번호·주소 가려 줘"],
    example: "“이 PDF를 세 줄로 요약하고 중요한 숫자만 뽑아 줘”", brief: PDF_BRIEF,
  },
  video: {
    appId: "video", appName: "딸깍 영상편집", label: "영상", icon: artVideo, ext: "mp4", untitled: "제목 없는 영상", place: "00:00", surface: "영상",
    suggestions: ["신메뉴 홍보 숏폼 만들어 줘", "3초부터 자막 넣어 줘", "배경 음악 잔잔하게 깔아 줘"],
    example: "“3초부터 5초 동안 가운데에 '오늘의 브이로그' 자막을 크게 넣어 줘”", brief: VIDEO_BRIEF,
  },
  image: {
    appId: "image", appName: "이미지 디자인", label: "이미지", icon: artImage, ext: "png", untitled: "제목 없는 이미지", place: "1페이지", surface: "캔버스",
    suggestions: ["가을 할인 이벤트 이미지 만들어 줘", "유튜브 썸네일 만들어 줘", "카드뉴스 표지 만들어 줘"],
    example: "“가운데에 '가을 신메뉴 출시'를 크게 넣고 아래에 할인 문구를 넣어 줘”", brief: IMAGE_BRIEF,
  },
};
const appName = (kind: DocKind) => CONF[kind].appName;
/** ▷▾ 보기 옵션(Figma 참고) — 첫 옵션이 ▷ 바로 실행. 도구마다 "결과를 보는" 방법이 다르다 */
/** ▷ 보기 방법. 2026-11-19부터 상단 ▷는 PPT(발표)만 쓴다. 한글·워드·엑셀·PDF·이미지는 편집 화면이 곧 결과물이라 뺐다(Google Docs·Word·미리캔버스도 상단에 미리보기 버튼 없음) */
const PRESENT: Record<DocKind, { id: string; label: string; shortcut?: string; keys?: (e: KeyboardEvent) => boolean }[]> = {
  hangul: [{ id: "read", label: "읽기 모드" }, { id: "print", label: "인쇄 미리 보기" }],
  word: [{ id: "read", label: "읽기 모드" }, { id: "print", label: "인쇄 미리 보기" }],
  excel: [{ id: "full", label: "전체 화면으로 보기" }, { id: "print", label: "인쇄 미리 보기" }],
  ppt: [
    { id: "start", label: "처음부터 발표", shortcut: "F5", keys: (e) => e.key === "F5" && !e.shiftKey },
    { id: "current", label: "현재 슬라이드부터", shortcut: "⇧F5", keys: (e) => e.key === "F5" && e.shiftKey },
  ],
  pdf: [{ id: "present", label: "발표 모드" }, { id: "print", label: "인쇄 미리 보기" }],
  video: [{ id: "play", label: "재생" }, { id: "full", label: "전체 화면 미리 보기" }],
  image: [{ id: "preview", label: "미리 보기" }, { id: "actual", label: "실제 크기로 보기" }],
};
const STEPS: Record<DocKind, string[]> = {
  hangul: ["요청 읽기", "목차 잡기", "본문 쓰기", "문서에 넣기"],
  word: ["요청 읽기", "목차 잡기", "본문 쓰기", "문서에 넣기"],
  excel: ["요청 읽기", "표 구조 잡기", "값 채우기", "시트에 넣기"],
  ppt: ["요청 읽기", "구성 잡기", "슬라이드 만들기", "발표 자료에 넣기"],
  pdf: ["PDF 읽기", "내용 정리", "결과 만들기"],
  video: ["요청 읽기", "장면 나누기", "자막·음악 넣기", "타임라인에 넣기"],
  image: ["요청 읽기", "구도 잡기", "요소 배치", "캔버스에 넣기"],
};
const AI_SHORTCUT = "⌘J";
/** 문서 편집기 다운로드 형식(2026-11-27). 첫 번째가 기본. PDF는 형식이 하나라 고르는 창 없이 바로 */
const DOC_FORMATS: Partial<Record<DocKind, { id: string; label: string; hint?: string }[]>> = {
  // 형식 설명은 뺐다(2026-11-27 사용자 "저런 설명 굳이?"): 문서 형식은 이름만으로 충분하다
  hangul: [{ id: "hwpx", label: "한글 (HWPX)" }, { id: "hwp", label: "한글 (HWP)" }, { id: "pdf", label: "PDF" }],
  word: [{ id: "docx", label: "워드 (DOCX)" }, { id: "pdf", label: "PDF" }],
  excel: [{ id: "xlsx", label: "엑셀 (XLSX)" }, { id: "csv", label: "CSV" }, { id: "pdf", label: "PDF" }],
  ppt: [{ id: "pptx", label: "파워포인트 (PPTX)" }, { id: "pdf", label: "PDF" }, { id: "png", label: "PNG" }],
};
const LOADING_TITLE: Record<DocKind, string> = { hangul: "한글 문서를 여는 중", word: "문서를 여는 중", excel: "시트를 여는 중", ppt: "프레젠테이션을 여는 중", pdf: "딸깍 PDF를 여는 중", image: "이미지 편집기를 여는 중", video: "영상 편집기를 준비하는 중" };

interface AiDraft { title: string; sections: { heading: string; body: string }[] }
type DocCauseBy = "ai" | "template" | "restore" | "manual";
/** 버전 하나 = 그때 파일 상태(2026-11-20 다시 설계: 바뀐 "뒤" 상태를 남긴다, 제목은 그 상태를 만든 일). docs/editor-common-header.md "24" */
interface DocVersion { id: string; at: number; title: string; author: string; saved?: boolean; savedName?: string; snap: { name: string; templateId?: string; ai?: AiDraft } }
interface DocFile { id: string; name: string; templateId?: string; ai?: AiDraft; threads?: DocThread[]; updatedAt: number; /** 예전 버전 기록(바뀌기 직전 상태, 더는 쓰지 않음) */ versions?: unknown[]; /** 버전 기록: 내용이 바뀐 뒤 상태, 최신이 끝, 최대 30개 */ hist?: DocVersion[]; /** 지금 상태인 버전(되돌리면 그 버전으로 옮겨 간다). 없으면 마지막 */ curId?: string; /** PDF로 연 파일 이름(내용은 메모리의 object URL) */ pdfName?: string; /** 지금 내용을 만든 일(AI 요청 문장 · 템플릿 이름). 버전 기록 제목이 된다 */ cause?: string; causeBy?: DocCauseBy }
const isEmpty = (d: DocFile) => !d.templateId && !d.ai && !d.pdfName;
const versionTitle = (d: Pick<DocFile, "templateId" | "ai" | "name">) => d.ai ? d.ai.title : d.templateId ? `${DOC_TEMPLATES.find((t) => t.id === d.templateId)?.title ?? "템플릿"} 템플릿` : d.name;
const storeKey = (kind: DocKind) => `ddalkkak.doceditor.${kind}.v1`;
let seq = 0;
const newId = () => `d${Date.now().toString(36)}${seq++}`;

function load(kind: DocKind): DocFile[] {
  try { return (JSON.parse(localStorage.getItem(storeKey(kind)) ?? "[]") as DocFile[]).slice(0, 20); } catch { return []; }
}

/** 요청 문장에서 문서 제목을 뽑는다(목업). "월간 업무 보고서 초안 써 줘" → "월간 업무 보고서" */
function titleFromPrompt(p: string): string {
  const quoted = p.match(/[‘'“"「](.+?)[’'”"」]/)?.[1];
  if (quoted) return quoted.slice(0, 30);
  return p.replace(/(초안|을|를)?\s*(써|만들어|작성해|정리해)\s*(줘|주세요|줄래)[.!?]?$/u, "").trim().slice(0, 30) || "새 문서";
}

export function DocEditor({ kind, onBack, onBellClick, onSwitchApp, profileMenu, onManageModels, initialDocId, initialTemplate, initialPrompt }: {
  kind: DocKind;
  onBack: () => void;
  onBellClick?: () => void;
  onSwitchApp?: (appId: string) => void;
  profileMenu?: ProfileMenuHandlers;
  /** AI 입력창 모델 메뉴 › AI 연결 관리 */
  onManageModels?: () => void;
  /** 메인 사이드바 "최근 작업"에서 고른 파일 — 있으면 새 빈 문서 대신 그 파일로 연다 */
  initialDocId?: string;
  /** 홈 B안(2026-11-20): 고른 템플릿으로 바로 시작. withAi면 "내용 채우기" 카드까지 연다 */
  initialTemplate?: { id: string; withAi: boolean };
  /** 홈 B안 "빈 화면에서 시작": 딸깍 AI 입력창에 이 문장을 넣어 둔다 */
  initialPrompt?: string;
}) {
  const conf = CONF[kind];
  const profile = useProfile();
  const me: CommentAuthor = useMemo(() => ({ name: profile.name, avatarUrl: profile.avatarUrl, collabColor: profile.collabColor }), [profile]);
  const members = useDocCommentMembers(me);

  const untitledName = (list: DocFile[]) => {
    const n = list.filter((d) => d.name.startsWith(conf.untitled)).length;
    // 새 파일 이름 = "제목 없는 ○○"(2026-11-20, 미리캔버스 "제목 없는 디자인"처럼 바꿔야 할 이름이라는 게 보이게). 두 번째부터 " 2"
    return n ? `${conf.untitled} ${n + 1}` : conf.untitled;
  };
  // 열 때마다 새 빈 문서 하나로 시작한다(홈 "편집기 바로 열기" = 새 문서). 지난 문서는 저장소에만 남는다.
  const [docs, setDocs] = useState<DocFile[]>(() => {
    const prev = load(kind);
    if (initialDocId && prev.some((d) => d.id === initialDocId)) return prev;
    return [...prev, { id: newId(), name: untitledName(prev), updatedAt: Date.now() }];
  });
  const [openIds, setOpenIds] = useState<string[]>(() => [initialDocId && docs.some((d) => d.id === initialDocId) ? initialDocId : docs[docs.length - 1].id]);
  const [activeId, setActiveId] = useState(openIds[0]);
  const active = docs.find((d) => d.id === activeId)!;
  const patch = (id: string, p: Partial<DocFile>) => setDocs((l) => l.map((d) => {
    if (d.id !== id) return d;
    // 내용(템플릿 · AI 결과 · 되돌리기)이 바뀌면 바뀐 뒤 상태를 한 줄 남긴다. 제목 = 그 일, 누가 = 딸깍 AI 또는 그 사람
    const next = { ...d, ...p, updatedAt: Date.now() };
    if (("templateId" in p || "ai" in p) && p.causeBy !== "restore" && !isEmpty(next)) {
      const id = newId();
      next.curId = id;
      // 첫 기록이면 바뀌기 전 상태(빈 문서면 "새로 만듦")도 함께 남긴다: 패널에 보이던 그 줄로 되돌아갈 수 있게
      const start: DocVersion[] = d.hist?.length ? d.hist : [{ id: `now-${d.id}`, at: d.updatedAt, title: isEmpty(d) ? "새로 만듦" : d.cause ?? versionTitle(d), author: d.causeBy === "ai" ? "딸깍 AI" : me.name, snap: { name: d.name, templateId: d.templateId, ai: d.ai } }];
      next.hist = [...start, { id, at: Date.now(), title: p.cause ?? versionTitle(next), author: p.causeBy === "ai" ? "딸깍 AI" : me.name, snap: { name: next.name, templateId: next.templateId, ai: next.ai } }].slice(-30);
    }
    return next;
  }));

  // 저장(이 브라우저) — 빈 문서는 저장하지 않는다
  const [saveState, setSaveState] = useState<SaveState>({ kind: "saved", at: Date.now() });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaveState({ kind: "saving" });
    const t = window.setTimeout(() => {
      try { localStorage.setItem(storeKey(kind), JSON.stringify(kind === "pdf" ? [] : docs.filter((d) => !isEmpty(d) || d.threads?.length))); setSaveState({ kind: "saved", at: Date.now() }); }
      catch { setSaveState({ kind: "error" }); }
    }, 400);
    return () => window.clearTimeout(t);
  }, [docs, kind]);
  // 지금 상태인 줄에 "남긴 버전" 표시(이름은 안 적어도 됨). 아직 기록이 없으면 지금 상태를 새로 남긴다. 상단 💾와 기록 패널 이름 바꾸기(기록이 아직 없을 때)가 쓴다
  const markSaved = useCallback((name: string) => {
    setDocs((l) => l.map((d) => {
      if (d.id !== activeId) return d;
      const h = d.hist ?? [];
      const cur = h.find((v) => v.id === d.curId) ?? h[h.length - 1];
      const marked = { saved: true, savedName: name || undefined };
      return { ...d, hist: cur ? h.map((v) => (v === cur ? { ...v, ...marked } : v)) : [{ id: newId(), at: Date.now(), title: isEmpty(d) ? "새로 만듦" : d.cause ?? versionTitle(d), author: me.name, snap: { name: d.name, templateId: d.templateId, ai: d.ai }, ...marked }] };
    }));
  }, [activeId, me.name]);
  // 상단 💾 · ⌘S(2026-11-27, 모든 편집기): 자동 저장은 늘 조용히 되고, 💾는 지금 상태를 버전 기록에 남긴다.
  // 자동 저장은 마지막 상태 하나만 덮어쓰므로, 💾가 같은 일만 하면 버튼에 의미가 없었다
  const saveNow = useCallback(() => {
    setSaveState({ kind: "saving" });
    window.setTimeout(() => {
      try {
        localStorage.setItem(storeKey(kind), JSON.stringify(kind === "pdf" ? [] : docs.filter((d) => !isEmpty(d) || d.threads?.length)));
        markSaved("");
        setSaveState({ kind: "saved", at: Date.now() });
        showToast("저장했어요. 버전 기록에 남겼어요.");
      } catch { setSaveState({ kind: "error" }); showToast("저장하지 못했어요. 이 브라우저 저장 공간이 부족해요.", "error"); }
    }, 300);
  }, [docs, kind, markSaved]);

  // 코멘트: 상단 바 오른쪽 💬 하나로(2026-11-19). 누르면 코멘트 목록이 열리면서 바로 남기기 모드 — Figma 코멘트 도구처럼.
  // 예전엔 왼쪽 "코멘트"(남기기)와 오른쪽 💬(목록)가 따로 있었다.
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [pinsHidden, setPinsHidden] = useState(false);
  const threads = active.threads ?? [];
  const setThreads = (u: React.SetStateAction<DocThread[]>) => setDocs((l) => l.map((d) => (d.id === activeId ? { ...d, threads: typeof u === "function" ? u(d.threads ?? []) : u } : d)));
  const unread = threads.filter((t) => isUnread(t, me)).length;
  // 함께 보는 사람 — 프로토타입: 나 + 이 문서에 코멘트를 단 예시 팀원
  const someoneElse = threads.some((t) => t.messages.some((m) => m.author.name !== me.name));
  const viewers: Viewer[] = [{ ...me, isMe: true, activity: "이 탭" }, ...(someoneElse ? [{ ...threads.flatMap((t) => t.messages).find((m) => m.author.name !== me.name)!.author, activity: "방금 활동" }] : [])];
  useEffect(() => { setOpenThreadId(null); }, [activeId]);

  // 왼쪽 템플릿 패널: 빈 문서일 때 자동으로 열리고, 템플릿·AI로 내용이 생기면 닫힌다
  // 왼쪽 레일(2026-11-19, Canva 편집 화면처럼): [템플릿] [내 파일]. 패널을 닫아도 레일은 남는다 = 접어서 넣어 두기. docs/doc-editor.md "2-11"
  // 기존 파일로 열면(최근 작업) 템플릿 패널은 닫힌 채로 시작
  // 왼쪽 템플릿 패널 — 새 빈 문서면 열린 채로 시작(기존 파일로 열면 닫힘). 다른 파일·홈은 서비스 사이드바 레일(App)에서 간다(2026-11-19)
  const [templatesOpen, setTemplatesOpen] = useState(kind !== "pdf" && !initialDocId);
  const tplPanel = usePanelWidth("templates", 300, 260, 520);
  // PDF: 연 파일은 이 탭에서만(object URL). 빈 PDF면 거기에, 아니면 새 파일로 바꿔 연다
  const pdfUrls = useRef<Record<string, string>>({});
  const pdfInput = useRef<HTMLInputElement>(null);
  const openPdf = (file: File | undefined) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { showToast("PDF 파일만 열 수 있어요.", "error"); return; }
    const name = file.name.replace(/\.pdf$/i, "");
    const url = URL.createObjectURL(file);
    const target = isEmpty(active) ? activeId : openNew({ name, pdfName: file.name });
    pdfUrls.current[target] = url;
    if (target === activeId) patch(activeId, { name, pdfName: file.name });
  };
  const [preview, setPreview] = useState<DocTemplate | null>(null);
  // 오른쪽 딸깍 AI
  const [dock, setDock] = useState<"ai" | "comments" | "history" | null>("ai");
  const [versionSel, setVersionSel] = useState<string | null>(null);
  const commentMode = dock === "comments";
  // 목록에서 보던 스레드는 목록을 닫으면 같이 닫는다(닫자마자 문서 위 팝오버로 튀어나오지 않게)
  useEffect(() => { if (!commentMode) setOpenThreadId(null); }, [commentMode]);
  const dockRef = useRef(dock);
  dockRef.current = dock;
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const [aiDot, setAiDot] = useState(false);
  const [prefill, setPrefill] = useState<{ text: string; key: number } | undefined>();
  const [briefOpen, setBriefOpen] = useState<{ key: number } | undefined>();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault(); e.stopPropagation();
        setDock(dockRef.current === "ai" ? null : "ai");
        setAiDot(false);
        return;
      }
      // ⌘⌥M(Ctrl+Alt+M): 코멘트 모드 켜기/끄기(딸깍넷 공통). 영상은 코멘트가 없다
      if (isCommentShortcut(e) && kindRef.current !== "video") {
        e.preventDefault(); e.stopPropagation();
        setDock(dockRef.current === "comments" ? null : "comments");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const askAi = (text: string) => { setDock("ai"); setAiDot(false); setPrefill({ text, key: Date.now() }); };

  const openNew = (p: Partial<DocFile> = {}) => {
    const d: DocFile = { id: newId(), name: untitledName(docs), updatedAt: Date.now(), ...p };
    setDocs((l) => [...l, d]);
    // 한 화면에 파일 하나: 새 파일을 열면 지금 파일 자리를 바꾼다(지금 파일은 저장돼 있고 사이드바 최근 작업에 남는다)
    setOpenIds([d.id]);
    setActiveId(d.id);
    return d.id;
  };

  const applyTemplate = (tpl: DocTemplate, { withAi, target }: { withAi: boolean; target: "new" | "replace" }) => {
    const p: Partial<DocFile> = { templateId: tpl.id, ai: undefined, name: tpl.title, cause: `${tpl.title} 템플릿으로 시작`, causeBy: "template" };
    if (target === "new") openNew(p); else patch(activeId, p);
    setTemplatesOpen(false);
    // AI로 내용 채우기 → 그 템플릿 칸으로 바뀐 "내용 채우기" 카드를 펼친다(빈 입력창에 문장만 넣던 것보다 무엇을 적을지 보인다)
    // 튜토리얼 2단계에서 AI 버튼을 눌러도 3단계(입력창에 요청을 대신 적어 두기)로 이어지게 카드는 펼치지 않는다
    if (withAi && getStarterPhase() === "template" && kind === "hangul") setDock("ai");
    else if (withAi) { setDock("ai"); setAiDot(false); setBriefOpen({ key: Date.now() }); }
    else showToast("템플릿을 넣었어요. 위쪽 템플릿 버튼으로 다시 열 수 있어요.");
  };

  // 홈 B안에서 템플릿·문장을 들고 열렸을 때 한 번만
  const startedFromHome = useRef(false);
  useEffect(() => {
    if (startedFromHome.current) return;
    startedFromHome.current = true;
    const tpl = initialTemplate && DOC_TEMPLATES.find((x) => x.id === initialTemplate.id);
    if (tpl) applyTemplate(tpl, { withAi: initialTemplate!.withAi, target: "replace" });
    else if (initialPrompt) { setTemplatesOpen(false); setDock("ai"); setPrefill({ text: initialPrompt, key: Date.now() }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI 되돌리기용 — 결과마다 그 직전 문서 상태
  const undoRef = useRef<Record<string, { docId: string; prev: DocFile }>>({});
  const runAi = async (req: AiRequest, onStep: (l: string) => void, isCancelled: () => boolean): Promise<AiResult> => {
    if (req.prompt.trim().length < 4) {
      await new Promise((r) => setTimeout(r, 400));
      return { summary: kind === "video" ? "어떤 영상을 만들지 조금 더 알려 주세요. 예: “신메뉴 홍보 15초 숏폼 만들어 줘”" : kind === "image" ? "어떤 이미지를 만들지 조금 더 알려 주세요. 예: “가을 할인 이벤트 이미지 만들어 줘”" : kind === "ppt" ? "어떤 발표 자료를 만들지 조금 더 알려 주세요. 예: “신제품 출시 발표 5장 만들어 줘”" : kind === "excel" ? "어떤 표를 만들지 조금 더 알려 주세요. 예: “11월 매장별 매출 표 만들어 줘”" : "어떤 문서를 쓸지 조금 더 알려 주세요. 예: “다음 달 워크숍 안내 공문 써 줘”", credit: 0, stepsDone: 0, stopped: false, addedCount: 0, clarify: true };
    }
    if (kind === "pdf") {
      if (!active.pdfName) {
        await new Promise((r) => setTimeout(r, 400));
        return { summary: "먼저 PDF를 열어 주세요. 가운데 'PDF 파일 열기'나 위의 '열기'를 누르면 돼요.", credit: 0, stepsDone: 0, stopped: false, addedCount: 0, clarify: true };
      }
      for (let i = 0; i < STEPS.pdf.length; i++) {
        if (isCancelled()) return { summary: "멈췄어요.", credit: 0, stepsDone: i, stopped: true, addedCount: 0 };
        onStep(STEPS.pdf[i]);
        await new Promise((r) => setTimeout(r, 450));
      }
      const pdfCredit = creditFor(req.model, 20);
      if (pdfCredit) setCreditBalance((b) => b - pdfCredit);
      return { summary: `「${active.pdfName}」에 요청한 작업 결과가 여기에 나와요. (목업: 실제 서비스에서는 요약·번역·추출 결과를 보여 줘요.)`, credit: pdfCredit, stepsDone: STEPS.pdf.length, stopped: false, addedCount: 0 };
    }
    const docId = activeId;
    const doc = docs.find((d) => d.id === docId)!;
    const tpl = DOC_TEMPLATES.find((x) => x.id === doc.templateId);
    const title = tpl?.title ?? titleFromPrompt(req.prompt);
    // 요청에 "열: 매장, 1주, …"가 있으면 그 열을 그대로 쓴다(자세히 적어서 요청하기의 "들어갈 항목")
    const askedCols = kind === "excel" ? req.prompt.match(/열:\s*(.+)/)?.[1]?.split(/[,，、]/).map((x) => x.trim()).filter(Boolean).slice(0, 12) : undefined;
    // PPT: 요청에 "N장"이 있으면 그 장수만큼(표지 + 내용)
    const askedCount = kind === "ppt" ? Number(req.prompt.match(/(\d+)\s*장/)?.[1] ?? 0) : 0;
    // 장수를 적었으면 그 장수가 이긴다 — 템플릿이 있으면 템플릿 구성을 앞에서부터 쓰고 모자라면 "추가 n"으로 채운다
    const base = tpl?.sections ?? ["표지", "목차", "핵심 내용", "정리"];
    const pptHeads = askedCount > 1 ? Array.from({ length: Math.min(askedCount, 20) }, (_, i) => base[i] ?? `추가 ${i + 1 - base.length}`) : base;
    const heads = askedCols?.length ? askedCols : kind === "ppt" ? pptHeads : tpl?.sections ?? (kind === "excel" ? ["항목", "1월", "2월", "3월", "합계"] : kind === "video" ? ["오프닝", "본문", "마무리"] : kind === "image" ? ["제목", "이미지", "문구"] : ["개요", "주요 내용", "세부 사항", "향후 계획"]);
    const steps = STEPS[kind];
    for (let i = 0; i < steps.length; i++) {
      if (isCancelled()) return { summary: "멈췄어요. 문서는 바뀌지 않았어요.", credit: 0, stepsDone: i, stopped: true, addedCount: 0 };
      onStep(steps[i]);
      await new Promise((r) => setTimeout(r, 450));
    }
    const draft: AiDraft = { title, sections: heads.map((h) => ({ heading: h, body: `${h}에 들어갈 내용을 요청에 맞춰 정리한 자리예요. (목업: 실제 서비스에서는 딸깍 AI가 문장을 채워요.)` })) };
    const resultId = newId();
    undoRef.current[resultId] = { docId, prev: doc };
    patch(docId, { ai: draft, name: doc.templateId || doc.name.startsWith(conf.untitled) ? title : doc.name, cause: promptTitle(req.prompt), causeBy: "ai" });
    setTemplatesOpen(false);
    // 모델에 따라: 딸깍 AI 높음 2배 · 낮음 절반, 내 키는 0(docs/ai-models.md "2-2")
    const credit = creditFor(req.model, 30);
    if (credit) setCreditBalance((b) => b - credit);
    return { summary: kind === "video" ? `「${title}」 장면 ${heads.length}개를 타임라인에 넣었어요.` : kind === "image" ? `「${title}」 이미지를 캔버스에 만들었어요.` : kind === "excel" ? `「${title}」 표를 시트에 넣었어요. 열 ${heads.length}개.` : kind === "ppt" ? `「${title}」 슬라이드 ${heads.length}장을 만들었어요.` : `「${title}」 초안을 문서에 넣었어요. 항목 ${heads.length}개를 썼어요.`, credit, stepsDone: steps.length, stopped: false, addedCount: heads.length, target: { id: docId, label: title, meta: `${conf.ext.toUpperCase()} · ${kind === "excel" ? `열 ${heads.length}개` : kind === "ppt" ? `슬라이드 ${heads.length}장` : kind === "video" ? `장면 ${heads.length}개` : kind === "image" ? "1080×1080" : `항목 ${heads.length}개`}` }, createdRootId: resultId };
  };

  // 영상편집은 코멘트 없음(dev: 딸깍 AI · 템플릿 · 기록만, docs/editor-common-header.md "1")
  const hasComments = kind !== "video";
  // 버전 기록(2026-11-20, 사용자 "문서 헤더에 기록 기능이 없다"): 영상만 있던 것을 문서 편집기 전부로. PDF는 연 파일을 고치거나 저장하지 않아 뺀다.
  // 순서는 UI 디자인과 같게 [딸깍 AI] [기록] [코멘트]
  // 기록은 모든 편집기에(2026-11-20 헤더 정리). PDF는 파일을 연 뒤부터: 고쳐서 저장한 상태가 쌓인다(목업은 빈 목록)
  const hasHistory = kind !== "pdf" || !!active.pdfName;
  // 여는 중 화면(2026-11-20): 실제로는 오픈소스 에디터를 불러오는 동안. 목업은 잠깐 보여 준다
  const [booting, setBooting] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setBooting(false), 1100); return () => window.clearTimeout(t); }, []);
  const embedded = kind === "hangul" || kind === "word" || kind === "excel" || kind === "ppt";

  // ── 시작 튜토리얼 2, 3단계(한글, docs/starter-tour.md) ──
  const starter = useStarterPhase();
  const tour = kind === "hangul" && (starter === "template" || starter === "ai" || starter === "ai-wait");
  // 들어오면 템플릿 패널과 딸깍 AI 패널을 연다
  useEffect(() => { if (tour) { setTemplatesOpen(true); setDock("ai"); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tour]);
  // 템플릿이 문서에 들어가면 3단계
  useEffect(() => { if (getStarterPhase() === "template" && kind === "hangul" && active.templateId) { setStarterPhase("ai"); track("starter_step_view", { step: 3 }); } }, [active.templateId, kind]);
  // 3단계: 입력창에 요청을 대신 타이핑해 두고(실제로 해 보는 것처럼), 사용자가 [보내기]를 누르면 말풍선을 걷고 AI가 쓰는 걸 보여 준다
  // (2026-11-20 사용자 "이렇게 시켜 보세요 강조보다 채팅창에 '…만들어 줘'를 실제로 해 보는 것처럼")
  useEffect(() => {
    if (starter !== "ai" || kind !== "hangul") return;
    const tpl = DOC_TEMPLATES.find((t) => t.id === active.templateId);
    const text = tpl ? `${tpl.title} 내용을 채워 줘` : "행사 개최 알림 공문 써 줘";
    let i = 0;
    const t = window.setInterval(() => { i += 1; setPrefill({ text: text.slice(0, i), key: Date.now() }); if (i >= text.length) window.clearInterval(t); }, 55);
    const isSend = (el: Element | null) => !!el?.closest?.('[data-onboarding="ai-composer"] button[aria-label="보내기"]');
    const click = (e: MouseEvent) => { if (isSend(e.target as Element)) setStarterPhase("ai-wait"); };
    const key = (e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey && (e.target as Element)?.closest?.('[data-onboarding="ai-composer"]')) setStarterPhase("ai-wait"); };
    document.addEventListener("click", click, true); document.addEventListener("keydown", key, true);
    return () => { window.clearInterval(t); document.removeEventListener("click", click, true); document.removeEventListener("keydown", key, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starter, kind]);
  // shareTip: 3단계 [끝내기]도 마무리 말풍선을 띄운다(2026-11-27). 버튼 이름이 "끝내기"라 다 했다고 여기고 누르는 사람이 많다.
  // 머리줄 건너뛰기 · Esc · 2단계에서 끝낸 경우만 안 띄운다
  const finishStarter = (done: boolean, shareTipAnyway = false) => {
    track(done ? "starter_complete" : "starter_skip", { step: getStarterPhase() === "template" ? 2 : 3 });
    setStarterPhase(null); markHintSeen("templates"); markHintSeen("ai");
    // 끝까지 한 사람에게만 공유 마무리 말풍선(2026-11-27). 공유는 받는 사람이 있어야 해 볼 수 있어 단계로 넣지 않고,
    // 결과물이 막 생긴 순간에 자리만 알려 준다. AI가 쓴 걸 먼저 보도록 잠깐 뒤에 띄운다
    if (done || shareTipAnyway) window.setTimeout(() => { if (getStarterPhase() === null) { setStarterPhase("share"); track("starter_share_tip_view"); } }, 900);
  };
  const shareTip = kind === "hangul" && starter === "share";
  const closeShareTip = useCallback((via: string) => { if (getStarterPhase() === "share") { setStarterPhase(null); track("starter_share_tip_close", { via }); } }, []);
  // 상단 [공유]를 누르면 말풍선도 닫는다(공유 창은 그대로 열린다)
  useEffect(() => {
    if (!shareTip) return;
    const click = (e: MouseEvent) => { if ((e.target as Element)?.closest?.('[data-onboarding="share"]')) closeShareTip("share"); };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [shareTip, closeShareTip]);
  // AI 결과가 문서에 들어가면 끝
  useEffect(() => { if ((getStarterPhase() === "ai" || getStarterPhase() === "ai-wait") && kind === "hangul" && active.ai) finishStarter(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [active.ai, kind]);
  // 편집기를 닫으면 튜토리얼도 끝
  useEffect(() => () => { const p = getStarterPhase(); if (p === "template" || p === "ai" || p === "ai-wait" || p === "share") setStarterPhase(null); }, []);
  // 건너뛴 사람용 파란 점(튜토리얼 중에는 숨김)
  const tplHint = useHintVisible("templates") && !tour && kind !== "pdf";
  const aiHint = useHintVisible("ai") && !tour;
  const coachBtn = { height: 36, padding: "0 14px", fontSize: 13 } as const;
  const starterCoach = shareTip ? (
    <Coachmark tip target='[data-onboarding="share"]' placement="bottom" step={STARTER_TOTAL} total={STARTER_TOTAL}
      title="함께 고치려면 공유해요" body="링크를 보내면 받는 사람이 문서에 바로 코멘트를 남길 수 있어요. 파일을 주고받지 않아도 돼요."
      onSkip={() => closeShareTip("esc")}
      actions={<Button variant="secondary" size="md" onClick={() => closeShareTip("ok")} style={coachBtn}>확인</Button>} />
  ) : !tour || booting ? null : starter === "template" ? (!preview && (
    <Coachmark target='[data-onboarding="tpl-panel"]' placement="right" step={2} total={STARTER_TOTAL}
      pulse='[data-onboarding="tpl-panel"] button[aria-label$="미리보기"] > span:first-child'
      title="필요한 양식은 여기서 바로 써요" body="공문, 신청서처럼 정해진 양식을 누르면 문서에 바로 들어가요. 하나 눌러 볼까요?"
      onSkip={() => finishStarter(false)}
      actions={<Button variant="secondary" size="md" onClick={() => { setStarterPhase("ai"); track("starter_step_view", { step: 3, via: "next" }); }} style={coachBtn}>다음</Button>} />
  )) : starter === "ai" ? (
    <Coachmark target='[data-onboarding="ai-composer"]' placement="top" step={3} total={STARTER_TOTAL}
      pulse='[data-onboarding="ai-composer"] button[aria-label="보내기"]'
      title="말로만 해도 채워 줘요" body="딸깍 AI에게 하고 싶은 걸 적으면 문서를 대신 써 줘요. 보내기를 눌러 보세요."
      onSkip={() => finishStarter(false)}
      actions={<Button variant="secondary" size="md" onClick={() => finishStarter(false, true)} style={coachBtn}>끝내기</Button>} />
  ) : null;
  const pdfOpen = kind === "pdf" && !!active.pdfName && !!pdfUrls.current[activeId];
  const dockTabs = [
    { id: "ai", label: "딸깍 AI", hint: aiHint ? "어려우면 딸깍 AI에게 말로만 하세요" : `딸깍 AI (${AI_SHORTCUT})`, icon: Sparkles, dot: (aiDot && dock !== "ai") || aiHint, emphasized: true },
    { id: "comments", label: "코멘트", hint: `코멘트 (${COMMENT_SHORTCUT})`, icon: MessageCircle, badge: unread },
    { id: "history", label: "버전 기록", hint: "버전 기록", icon: History },
  ];
  const dockOrder = ["ai", ...(hasHistory ? ["history"] : []), ...(hasComments ? ["comments"] : [])];
  const commentsPanel = (
    <CommentListPanel
      threads={threads}
      me={me}
      location={(t) => t.place ?? conf.place}
      openThreadId={openThreadId}
      hidden={pinsHidden}
      onToggleHidden={() => setPinsHidden((v) => !v)}
      // 목록에서 연 스레드는 목록 안에서 답글까지 본다(문서 위 팝오버 없음). 숨김 상태는 그대로 둔다
      onOpen={(t) => { setOpenThreadId(t.id); setThreads((all) => all.map((x) => (x.id === t.id ? { ...x, readAt: Date.now(), forcedUnread: false } : x))); }}
      renderThread={(t, nav) => (
        <ThreadPopover
          embedded nav={nav} thread={t} me={me} members={members} anchorLabel={t.place ?? conf.place} draft={t.myDraft ?? ""}
          actions={docThreadActions(t, { threads, setThreads, me, setOpenThreadId })}
        />
      )}
      surface={conf.surface}
      hiddenNote={`${conf.surface}에서 코멘트를 숨겼어요. 목록에서는 계속 볼 수 있어요`}
      onMarkAllRead={() => setThreads((all) => all.map((t) => ({ ...t, readAt: Date.now(), forcedUnread: false })))}
      emptyHint={`열린 코멘트가 없어요. ${conf.surface}에서 남길 자리를 클릭해 보세요.`}
      onClose={() => setDock(null)}
    />
  );
  const curTpl = DOC_TEMPLATES.find((x) => x.id === active.templateId);
  // 기록(버전) — 영상 편집기(2026-11-19 사용자 "영상은 기록이랑 내보내기만"). UI 디자인과 같은 공통 VersionHistoryPanel
  const historyPanel = (
    <VersionHistoryPanel
      currentId={active.curId}
      // 기록이 아직 없으면(새 파일 · 예전 방식으로 저장된 파일) 지금 상태를 한 줄로 보여 준다. 빈 목록이면 고장 난 것처럼 보였다(2026-11-20 사용자)
      items={[...(active.hist?.length ? active.hist : [{ id: `now-${active.id}`, at: active.updatedAt, title: isEmpty(active) ? "새로 만듦" : active.cause ?? versionTitle(active), author: active.causeBy === "ai" ? "딸깍 AI" : me.name, snap: { name: active.name, templateId: active.templateId, ai: active.ai } }])].reverse().filter((v) => !v.title.endsWith("버전으로 되돌림")).map((v) => ({ id: v.id, title: v.title, at: v.at, author: v.author, saved: v.saved, savedName: v.savedName }))}
      emptyText={kind === "pdf" ? "PDF를 고치고 저장하면 그때마다 여기에 남아요." : undefined}
      selectedId={versionSel}
      onSelect={setVersionSel}
      onRestore={(id) => {
        const v = active.hist?.find((x) => x.id === id);
        if (!v) return;
        patch(activeId, { templateId: v.snap.templateId, ai: v.snap.ai, name: v.snap.name, cause: v.title, causeBy: "restore", curId: v.id });
        setVersionSel(null);
        // 되돌린 뒤에는 딸깍 AI 대화로 넘어간다(사용자 2026-11-20): 되돌린 다음 할 일은 대개 AI에게 다시 시키는 것. 기록은 🕘로 언제든 다시 연다
        setDock("ai");
        showToast("이 버전으로 되돌렸어요. 다른 버전도 그대로 남아 있어요.");
      }}
      onRename={(id, name) => {
        // 이름을 붙이면 그 줄은 남긴 버전. 기록이 아직 없어 보이는 줄(now-…)이면 지금 상태를 새로 남기며 이름을 붙인다
        if (id.startsWith("now-")) { markSaved(name); }
        else setDocs((l) => l.map((d) => (d.id !== activeId ? d : { ...d, hist: (d.hist ?? []).map((v) => (v.id === id ? { ...v, saved: true, savedName: name || undefined } : v)) })));
        showToast(name ? "이름을 바꿨어요." : "이름을 지웠어요.");
      }}
      onClose={() => setDock(null)}
    />
  );
  const aiPanel = (
    <AiAssistantPanel
      runAi={runAi}
      planAi={(req) => (req.prompt.trim().length < 4 ? [] : STEPS[kind])}
      brief={curTpl ? templateBrief(curTpl) : conf.brief}
      briefOpen={briefOpen}
      onManageModels={onManageModels}
      context={null}
      suggestions={conf.suggestions}
      example={conf.example}
      commandCount={{ hangul: 15, word: 658, excel: 420, ppt: 383, pdf: 198, video: 16, image: 24 }[kind]}
      onShowResult={(r) => r.target && (setOpenIds((o) => (o.includes(r.target!.id) ? o : [...o, r.target!.id])), setActiveId(r.target.id))}
      onUndoResult={(r) => {
        const u = r.createdRootId ? undoRef.current[r.createdRootId] : undefined;
        if (!u) return;
        setDocs((l) => l.map((d) => (d.id === u.docId ? u.prev : d)));
        showToast("AI가 넣은 내용을 되돌렸어요.");
      }}
      onFinished={() => { if (dockRef.current !== "ai") setAiDot(true); }}
      onClose={() => setDock(null)}
      closeShortcut={AI_SHORTCUT}
      prefill={prefill}
    />
  );

  const tpl = DOC_TEMPLATES.find((x) => x.id === active.templateId);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#f8fafc]" style={f}>
      <EditorHeader
        appIcon={conf.icon}
        appName={appName(kind)}
        currentAppId={conf.appId}
        onSwitchApp={onSwitchApp}
        saveState={saveState}
        fileName={kind === "pdf" && !active.pdfName ? undefined : `${active.name}.${conf.ext}`}
        onRenameFile={(name) => patch(activeId, { name: name.replace(new RegExp(`\\.${conf.ext}$`), "") })}
        // 저장 상태는 안쪽 오픈소스 에디터가 보여 준다(워드 "저장되지 않음"·자동 저장) — 헤더에 또 두지 않는다
        // 영상: 공유 없음 → 내보내기가 주요 버튼(헤더 규칙 "4"). 나머지: 공유
        // ▷ 발표는 뺐다(2026-11-20): 실제 PPT 에디터 안에 [발표] 버튼이 있어 겹친다. UI 디자인은 자체 에디터라 유지
        // 다운로드는 넣지 않는다(2026-11-20 사용자 "문서에 다운로드가 필요 없구나"): 안쪽 에디터 파일 메뉴에 저장 · 내려받기가 있다
        // 이미지: [다운로드](테두리) + [공유](채움)(2026-11-20 사용자 "안쪽 내보내기가 거슬린다, 상단에 다운받기?"). 안쪽 파란 [내보내기]는 뺐다
        // 2026-11-27 다시: 저장 · 다운로드를 모든 편집기 상단에(요청 "다운로드랑 저장 버튼 추가", 미리캔버스 상단 [☁][다운로드][공유] 참고)
        capabilities={kind === "video" ? { export: true } : { export: true, share: true }}
        // 💾는 모든 편집기(2026-11-27 고객사 "저장은 그냥 위에 올려 달라"). 한 번 문서 계열에서 뺐다가 되돌림.
        // 안쪽 에디터에도 저장이 있어 겹치지만, 상단 💾는 저장 + 버전 기록에 남기기라 할 일이 다르다. 안쪽 맨 위 줄 숨기기는 docs/editor-overlaps.md 12
        onSave={saveNow}
        onExport={kind === "pdf" ? () => showToast(`${active.name}.pdf 파일을 내려받을게요.`) : undefined}
        exportOptions={DOC_FORMATS[kind] ? {
          title: `${conf.label} 다운로드`,
          groups: [{ id: "format", label: "파일 형식", type: "radio", default: DOC_FORMATS[kind]![0].id, options: DOC_FORMATS[kind]! }],
          onExport: (c) => showToast(`${active.name}.${c.format} 파일을 내려받을게요.`),
        } : kind === "image" ? {
          title: "이미지 다운로드",
          groups: [
            { id: "format", label: "파일 형식", type: "radio", default: "png", options: [{ id: "png", label: "PNG", hint: "선명하고 배경을 투명하게 둘 수 있어요" }, { id: "jpg", label: "JPG", hint: "파일이 작아요" }, { id: "pdf", label: "PDF", hint: "인쇄할 때 좋아요" }] },
            { id: "scale", label: "크기", type: "radio", default: "1", options: [{ id: "1", label: "1배", hint: "1080 × 1080" }, { id: "2", label: "2배", hint: "2160 × 2160, 더 선명해요" }] },
            // dev 다운로드 창의 "페이지 선택"(모든 페이지 1~N). 아래 페이지 줄에 여러 장을 둘 수 있어서 필요하다
            { id: "pages", label: "페이지 선택", type: "radio", default: "all", options: [{ id: "all", label: "모든 페이지 (1~1)" }, { id: "current", label: "지금 보는 페이지" }] },
          ],
          onExport: (c) => showToast(`${c.pages === "current" ? "지금 페이지를 " : "모든 페이지를 "}${String(c.format).toUpperCase()} 파일 ${c.scale}배 크기로 내려받을게요.`),
        } : kind === "video" ? {
          title: "영상 다운로드",
          groups: [
            { id: "format", label: "파일 형식", type: "radio", default: "mp4", options: [{ id: "mp4", label: "MP4 (H.264)", hint: "어디서나 잘 열려요" }, { id: "webm", label: "WebM (VP9)", hint: "파일이 더 작아요" }] },
            { id: "quality", label: "품질", type: "radio", default: "high", options: [{ id: "low", label: "낮음", hint: "파일이 가장 작아요" }, { id: "mid", label: "보통" }, { id: "high", label: "높음", hint: "추천해요. 선명하고 파일 크기도 알맞아요" }, { id: "max", label: "매우 높음", hint: "파일이 가장 커요" }] },
            { id: "audio", label: "오디오", type: "check", default: true, options: [{ id: "audio", label: "오디오 포함" }] },
          ],
          onExport: (c) => showToast(`${c.format === "webm" ? "WebM" : "MP4"} 파일, 품질 ${({ low: "낮음", mid: "보통", high: "높음", max: "매우 높음" } as Record<string, string>)[String(c.quality)]}${c.audio ? "" : ", 오디오 없이"} 내보낼게요.`),
        } : undefined}
        presentOptions={PRESENT[kind].map((o) => ({ ...o, run: () => showToast(`${o.label} 화면은 준비 중이에요.`) }))}
        viewers={viewers}
        profileMenu={profileMenu}
        onBack={onBack}
        onBell={onBellClick}
        toolSlot={kind === "pdf" ? (
          <IconTooltip label="다른 PDF 열기"><button
            type="button" onClick={() => pdfInput.current?.click()}
            className="h-10 px-3 flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] hover:bg-black/[0.05]"
            // 테두리 상자는 공유 · 다운로드에만(2026-11-27). PDF [열기]도 템플릿 자리 버튼이라 같은 모양
            style={{ fontSize: editorType.body, fontWeight: 500, color: "#334155", background: "transparent" }}
          >
            <FileUp size={20} /><HeaderLabel text="열기" />
          </button></IconTooltip>
        ) : (
          <IconTooltip label={tplHint ? "정해진 양식이 필요하면 여기서 골라요" : templatesOpen ? "템플릿 닫기" : "템플릿 열기"}><button
            type="button" aria-pressed={templatesOpen} onClick={() => { markHintSeen("templates"); setTemplatesOpen(!templatesOpen); }}
            className={`relative h-10 px-3 flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] ${templatesOpen ? "" : "hover:bg-black/[0.05]"}`}
            // 패널 버튼 규칙(2026-11-27): 테두리 없는 아이콘 + 이름, 켜지면 옅은 회색 바탕. 버전 기록 · 코멘트와 같다. 파란색은 딸깍 AI와 다운로드에만
            style={{ fontSize: editorType.body, fontWeight: templatesOpen ? 600 : 500, color: templatesOpen ? "#111827" : "#334155", background: templatesOpen ? "#f1f5f9" : "transparent" }}
          >
            <LayoutGrid size={20} color={templatesOpen ? "#111827" : "#475569"} /><HeaderLabel text="템플릿" />
            {tplHint && <span aria-hidden className="hint-dot absolute -top-0.5 -right-0.5 size-2.5 rounded-full" style={{ background: color.brand, boxShadow: "0 0 0 2px #fff" }} />}
          </button></IconTooltip>
        )}
        actions={<DockButtons tabs={dockOrder.map((id) => dockTabs.find((t) => t.id === id)!)} active={dock} onChange={(id) => { if (id === "ai") markHintSeen("ai"); setDock(id as "ai" | "comments" | "history" | null); setAiDot(false); setOpenThreadId(null); if (id === "comments") setPinsHidden(false); }} />}
      />

      {/* 파일 탭 줄 없음(2026-11-19): 한글·워드·엑셀·PPT·PDF·영상·이미지는 한 화면에 파일 하나(dev 편집기와 같음). 다른 파일은 왼쪽 사이드바 레일 "최근 작업"·"내 작업"에서, 새 파일은 템플릿 패널 "빈 문서"에서. 여러 파일 탭은 UI 디자인만 */}

      <div className="flex-1 min-h-0 flex" style={{ borderTop: "1px solid #eef0f3" }}>
        {/* 왼쪽 템플릿(PDF는 없음) */}
        {kind !== "pdf" && <div data-onboarding="tpl-panel" className="relative shrink-0 h-full overflow-hidden" style={{ width: templatesOpen ? tplPanel.width : 0, borderRight: templatesOpen ? "1px solid #eef0f3" : undefined, transition: tplPanel.dragging ? "none" : "width 200ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
          {templatesOpen && <PanelResizeHandle side="right" panel={tplPanel} label="템플릿 패널 너비 조절" />}
          <TemplatePanel
            width={tplPanel.width}
            kind={kind}
            onPreview={setPreview}
            onBlank={() => { if (isEmpty(active)) { setTemplatesOpen(false); return; } openNew(); }}
            onAskAi={(q) => askAi(q ? `${q} 문서 써 줘` : "")}
            onClose={() => setTemplatesOpen(false)}
          />
        </div>}

        {/* 가운데: 오픈소스 에디터 자리(목업) */}
        <main className="relative flex-1 min-w-0 flex flex-col bg-[#e9ebef]" aria-label="문서 편집 영역">
          {/* 2026-11-20: 한글 · 워드 · 엑셀 · PPT · PDF는 dev 캡처의 실제 에디터 모양(EmbeddedChrome, 동작 없음). 영상 · 이미지는 기존 도구 모음 */}
          {kind === "pdf" ? <PdfTop /> : embedded ? <EmbeddedTop kind={kind} title={active.name} /> : kind === "image" || kind === "video" ? null : <MockToolbar kind={kind} />}
          {booting && <EditorLoading title={LOADING_TITLE[kind]} sub={kind === "video" ? "처음 한 번만 내려받아요. 다음부터는 바로 열려요." : undefined} />}
          <input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={(e) => { openPdf(e.target.files?.[0]); e.target.value = ""; }} />
          {kind === "pdf" && !pdfOpen ? <PdfHome onPick={() => pdfInput.current?.click()} onDrop={openPdf} /> : kind === "video" ? (
            // 영상 편집기: dev 캡처 모양(VideoEditorFrame). 미리보기 안에 템플릿 표지 · AI 결과 제목, 타임라인에 장면
            <VideoEditorFrame
              tall={!!(active.ai || tpl)}
              scenes={active.ai?.sections.map((x) => x.heading) ?? tpl?.sections ?? []}
              preview={!active.ai && tpl?.cover ? <img src={tpl.cover} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                : (active.ai?.title ?? tpl?.title) ? <div className="absolute inset-0 flex items-center justify-center text-center" style={{ padding: "0 10%" }}><p style={{ fontSize: 20, fontWeight: 900, color: "#fff", wordBreak: "keep-all" }}>{active.ai?.title ?? tpl?.title}</p></div>
                : null}
            />
          ) : kind === "image" ? (
            // 이미지 편집기: dev 캡처 모양(왼쪽 도구 · 눈금자 · 체크무늬 · 오른쪽 디자인 패널 · 아래 페이지 줄) 안에 캔버스
            <ImageEditorFrame>
              <div className="relative mx-auto bg-white" style={{ width: "100%", aspectRatio: "1 / 1", boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px #e2e8f0" }} aria-label="캔버스">
                {!active.ai && tpl?.cover ? <img src={tpl.cover} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                  : !active.ai && tpl ? <PaperThumb template={tpl} scale={4.2} />
                  : active.ai ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ background: "linear-gradient(135deg, #fde68a 0%, #fca5a5 100%)", padding: "0 10%" }}>
                      <p style={{ fontSize: 34, fontWeight: 900, color: "#111827", lineHeight: 1.2, wordBreak: "keep-all" }}>{active.ai.title}</p>
                      <p style={{ fontSize: editorType.body, color: "#475569", marginTop: 12 }}>목업: 실제 서비스에서는 딸깍 AI가 이미지를 만들어요</p>
                    </div>
                  ) : null}
                <DocCommentLayer
                  key={activeId}
                  threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                  commentMode={commentMode} exitCommentMode={() => setDock(null)}
                  openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden} threadInPanel={commentMode}
                />
              </div>
            </ImageEditorFrame>
          ) : (
          <div className="flex-1 overflow-auto ui-scroll py-8 px-6" style={{ background: kind === "hangul" ? "#e6e6e6" : kind === "ppt" ? "#f1f1f1" : kind === "excel" ? "#fff" : undefined, padding: kind === "excel" ? 0 : undefined }}>
            {commentMode && (
              <div className="sticky top-0 z-20 flex justify-center pointer-events-none" style={{ marginTop: -20, marginBottom: 4 }}>
                <span className="rounded-full px-3 py-1.5" style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#111827" }}>코멘트 모드: 남길 자리를 클릭하세요 · Esc로 나가기</span>
              </div>
            )}
            {kind === "ppt" ? (
              <SlideMock
                title={active.ai?.title ?? tpl?.title}
                slides={active.ai?.sections.map((x) => x.heading) ?? tpl?.sections}
                cover={!active.ai ? tpl?.cover : undefined}
                tpl={!active.ai ? tpl : undefined}
              >
                <DocCommentLayer
                  key={activeId}
                  threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                  commentMode={commentMode} exitCommentMode={() => setDock(null)}
                  openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden} threadInPanel={commentMode}
                />
              </SlideMock>
            ) : null}
            {kind === "ppt" && <SlideNotes />}
            {kind === "pdf" && (active.pdfName && pdfUrls.current[activeId] ? (
              <div className="relative mx-auto bg-white" style={{ width: "min(100%, 900px)", height: "calc(100vh - 200px)", boxShadow: "0 0 0 1px #e2e8f0" }}>
                <iframe src={pdfUrls.current[activeId]} title={active.pdfName} className="w-full h-full" style={{ border: 0 }} />
                <DocCommentLayer
                  key={activeId}
                  threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                  commentMode={commentMode} exitCommentMode={() => setDock(null)}
                  openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden} threadInPanel={commentMode}
                />
              </div>
            ) : null)}
            {kind === "ppt" || kind === "pdf" ? null : kind === "excel" ? (
              <div className="relative bg-white" style={{ width: "100%" }}>
                <SheetMock title={active.ai?.title ?? tpl?.title} cols={active.ai?.sections.map((x) => x.heading) ?? tpl?.sections} />
                <DocCommentLayer
                  key={activeId} snap={snapToSheetCell}
                  threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                  commentMode={commentMode} exitCommentMode={() => setDock(null)}
                  openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden} threadInPanel={commentMode}
                />
              </div>
            ) : (
            <div className="relative mx-auto bg-white" style={{ width: "min(100%, 680px)", minHeight: 880, boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px #e2e8f0", padding: active.ai ? "64px 72px" : tpl ? 0 : "64px 72px" }}>
              {active.ai ? (
                <article>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", textAlign: "center", letterSpacing: "-0.4px" }}>{active.ai.title}</h1>
                  {active.ai.sections.map((s, i) => (
                    <section key={s.heading} style={{ marginTop: i ? 20 : 32 }}>
                      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{i + 1}. {s.heading}</h2>
                      <p style={{ fontSize: 13.5, lineHeight: 1.8, color: "#334155", marginTop: 6 }}>{s.body}</p>
                    </section>
                  ))}
                </article>
              ) : tpl ? (
                <PaperThumb template={tpl} scale={5.2} />
              ) : (
                <span className="inline-block w-px h-5 animate-pulse" style={{ background: "#111827" }} aria-label="빈 문서" />
              )}
              <DocCommentLayer
                key={activeId}
                threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                commentMode={commentMode} exitCommentMode={() => setDock(null)}
                openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden} threadInPanel={commentMode}
              />
            </div>
            )}
          </div>
          )}
          {embedded && <EmbeddedStatus kind={kind} />}
        </main>

        <SideDock rail={false} active={dock} onChange={(id) => setDock(id as "ai" | "comments" | "history" | null)} tabs={dockOrder.map((id) => ({ ...dockTabs.find((t) => t.id === id)!, panel: id === "ai" ? aiPanel : id === "history" ? historyPanel : commentsPanel }))} />
      </div>

      {starterCoach}
      {preview && (
        <TemplatePreview
          template={preview}
          docHasContent={!isEmpty(active)}
          guide={tour && starter === "template"}
          onApply={(o) => applyTemplate(preview, o)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

/** 엑셀 편집 영역 목업 — 열 머리(A~L) · 행 번호. 템플릿·AI 결과가 있으면 1행 제목, 3행 머리글(열 이름) */
function SheetMock({ title, cols }: { title?: string; cols?: string[] }) {
  const letters = "ABCDEFGHIJKL".split("");
  const cell = { height: 26, borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", fontSize: 12, padding: "0 6px" } as const;
  return (
    <div style={{ ...f, display: "grid", gridTemplateColumns: `40px repeat(${letters.length}, minmax(72px, 1fr))` }} aria-label="시트">
      <div style={{ ...cell, background: "#f3f4f6" }} />
      {letters.map((l) => <div key={l} className="flex items-center justify-center" style={{ ...cell, background: "#f3f4f6", color: "#64748b", fontSize: 11.5 }}>{l}</div>)}
      {Array.from({ length: 32 }, (_, r) => (
        <div key={r} className="contents">
          <div className="flex items-center justify-center" style={{ ...cell, background: "#f3f4f6", color: "#64748b", fontSize: 11.5 }}>{r + 1}</div>
          {letters.map((l, c) => {
            const head = r === 2 && cols ? cols[c] : undefined;
            const isTitle = r === 0 && c === 0 && title;
            return (
              <div key={l} data-cell={`${l}${r + 1}`} className="flex items-center overflow-visible whitespace-nowrap" style={{ ...cell, background: head ? "#e7f3ec" : undefined, fontWeight: head || isTitle ? 700 : 400, color: head ? "#166534" : "#111827", fontSize: isTitle ? 14 : 12, outline: r === 0 && c === 0 && !title ? "2px solid #16a34a" : undefined, outlineOffset: -2 }}>
                {isTitle ? title : head ?? ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** PPT 편집 영역 목업 — 왼쪽 슬라이드 목록 + 가운데 16:9 슬라이드(코멘트 레이어는 슬라이드 위) */
function SlideMock({ title, slides, cover, tpl, children }: { title?: string; slides?: string[]; cover?: string; tpl?: DocTemplate; children: React.ReactNode }) {
  const list = slides?.length ? slides : ["표지"];
  return (
    <div className="flex gap-5 mx-auto" style={{ ...f, maxWidth: 1080 }}>
      <ol className="shrink-0 flex flex-col gap-2.5" style={{ width: 132 }} aria-label="슬라이드 목록">
        {list.map((name, i) => (
          <li key={`${name}${i}`} className="flex gap-1.5">
            <span style={{ fontSize: 11, color: "#64748b", width: 14, textAlign: "right" }}>{i + 1}</span>
            <span className="flex-1 flex items-center justify-center bg-white rounded" style={{ aspectRatio: "16 / 9", boxShadow: i === 0 ? "0 0 0 2px #d4622b" : "0 0 0 1px #e2e8f0", fontSize: 9.5, color: "#475569", padding: 4, textAlign: "center", overflow: "hidden" }}>
              {i === 0 && title ? title : name}
            </span>
          </li>
        ))}
      </ol>
      <div className="relative flex-1 min-w-0 bg-white" style={{ aspectRatio: "16 / 9", boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px #e2e8f0" }}>
        {cover ? (
          <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        ) : tpl ? (
          <PaperThumb template={tpl} scale={5.4} />
        ) : title ? (
          <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: "0 8%" }}>
            <div style={{ width: 56, height: 6, background: "#4f7bff", borderRadius: 3 }} />
            <h1 style={{ fontSize: 36, fontWeight: 800, color: "#111827", marginTop: 18, letterSpacing: "-0.8px", wordBreak: "keep-all" }}>{title}</h1>
            <p style={{ fontSize: 15, color: "#64748b", marginTop: 10 }}>슬라이드 {list.length}장 · 목업: 실제 서비스에서는 딸깍 AI가 내용을 채워요</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 22, color: "#cbd5e1" }}>제목을 입력하세요</div>
        )}
        {children}
      </div>
    </div>
  );
}

/** 슬라이드 아래 노트(발표자 메모) 자리 — 안쪽 에디터 화면(dev 캡처)을 흉내 낸 목업 */
function SlideNotes() {
  return <div className="mx-auto mt-4 rounded bg-white" style={{ ...f, maxWidth: 1080, padding: "12px 14px", fontSize: 12.5, color: "#94a3b8", boxShadow: "0 0 0 1px #e2e8f0" }}>클릭하여 노트 추가</div>;
}

