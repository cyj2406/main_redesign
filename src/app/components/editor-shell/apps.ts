import artImage from "@/assets/home/editor/image.png";
import artWord from "@/assets/home/editor/word.png";
import artHangul from "@/assets/home/editor/hangul.png";
import artPpt from "@/assets/home/editor/ppt.png";
import artExcel from "@/assets/home/editor/excel.png";
import artPdf from "@/assets/home/editor/pdf.png";
import artUiDesign from "@/assets/home/editor/ui-design.png";
import artVideo from "@/assets/home/editor/video-edit.png";

/**
 * 딸깍 편집기 목록 — 홈 "편집기 바로 열기"와 공통 헤더 앱 이름 ▾(앱 전환 격자)가 **같은 목록**을 쓴다(2026-11-19).
 * 예전 헤더 메뉴는 도구모음 17개를 글자로만 늘어놓아 홈과 이름·모양이 달랐다. 이제 홈과 같은 8개 · 같은 그림 · 같은 이름.
 * 순서 = 화면 순서 = 도구모음 순서: 문서 편집 → 이미지·디자인 → 영상. hint = 도구모음 카드 설명(툴팁).
 * soon: 앱 전환 격자에서 흐리게 "준비 중"(홈 줄은 누르면 안내 토스트).
 */
export type EditorAppId = "hangul" | "word" | "excel" | "ppt" | "pdf" | "uidesign" | "image" | "video";
export interface EditorApp { id: EditorAppId; label: string; hint: string; art: string; soon?: boolean }

export const EDITOR_APPS: EditorApp[] = [
  { id: "hangul", label: "한글", hint: "HWP, HWPX 문서 편집", art: artHangul }, // 한글 편집기
  { id: "word", label: "워드", hint: "DOCX 문서 편집", art: artWord }, // 딸깍 문서
  { id: "excel", label: "엑셀", hint: "XLSX 스프레드시트 편집", art: artExcel }, // 딸깍 시트
  { id: "ppt", label: "PPT", hint: "PPTX 프레젠테이션 편집", art: artPpt }, // 딸깍 슬라이드
  { id: "pdf", label: "PDF", hint: "PDF 수정과 저장", art: artPdf }, // 딸깍 PDF(2026-11-19 연결)
  { id: "uidesign", label: "UI 디자인", hint: "피그마 파일과 화면 디자인", art: artUiDesign }, // 딸깍 UI 디자인
  { id: "image", label: "이미지", hint: "레이어 사진 편집", art: artImage }, // 딸깍 포토(레이어 분리 포함)
  { id: "video", label: "영상", hint: "간단한 영상 편집", art: artVideo }, // 딸깍 영상편집
];

/**
 * 새로 만들기 메뉴 묶음(2026-11-20, 사용자 "더 추가될 수도 있는데 격자는 비효율적"). Google Drive "새로 만들기"처럼 종류별 한 줄 목록.
 * 편집기가 늘면 맞는 묶음에 id만 넣는다. 10개를 넘으면 메뉴 맨 위에 검색 칸을 붙인다(docs/home-plan-b.md).
 */
export const EDITOR_GROUPS: { label: string; ids: EditorAppId[] }[] = [
  { label: "문서", ids: ["hangul", "word", "pdf"] },
  { label: "표 · 발표", ids: ["excel", "ppt"] },
  { label: "디자인 · 미디어", ids: ["uidesign", "image", "video"] },
];
