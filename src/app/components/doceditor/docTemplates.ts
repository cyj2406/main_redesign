import coverExpensePlan from "@/assets/home/templates/task/hangul-1.png";
import coverOperationPlan from "@/assets/home/templates/task/hangul-2.png";
import coverDailyReport from "@/assets/home/templates/task/excel-1.png";
import coverMarketingReport from "@/assets/home/templates/task/excel-2.png";
import coverPlatformIntro from "@/assets/home/templates/task/ppt-1.png";
import coverTrend from "@/assets/home/templates/task/ppt-2.png";
import coverBizPlanDeck from "@/assets/home/templates/ppt-proposal.jpeg";
import coverShortPromo from "@/assets/home/car/c6.png";
import coverStudyVlog from "@/assets/home/car/c13.png";
import coverShort1 from "@/assets/home/templates/task/video-1.png";
import coverShort2 from "@/assets/home/templates/task/video-2.png";
import coverPromoImage from "@/assets/home/car/c1.png";
import coverSnackCard from "@/assets/home/car/c14.png";
import coverTrendCard from "@/assets/home/car/c2.png";
import coverHomeTrainCard from "@/assets/home/car/c7.png";

/**
 * 한글·워드 편집기 템플릿(2026-11-19). 기획: docs/doc-editor.md "2-2".
 * 형식(한글/문서)이 아니라 **용도**로 묶는다. 지금 편집기 형식의 템플릿만 보인다.
 * cover가 있으면 실제 서식 이미지, 없으면 PaperThumb가 layout 모양으로 종이 미리보기를 그린다(제목을 크게 박아 읽히게).
 */
/** pdf는 템플릿 없음 — 기존 파일을 열어 고치는 도구라서(docs/doc-editor.md "2-8") */
export type DocKind = "hangul" | "word" | "excel" | "ppt" | "pdf" | "video" | "image";
/** video = 세로 9:16 영상, square = 1:1 이미지 */
export type PaperLayout = "letter" | "form" | "table" | "report" | "sheet" | "slide" | "video" | "square";

export interface DocTemplate {
  id: string;
  kind: DocKind;
  title: string;
  category: string;
  /** 이럴 때 써요 */
  use: string;
  /** 들어 있는 항목(엑셀은 표의 열 이름, PPT는 슬라이드 구성) */
  sections: string[];
  layout: PaperLayout;
  cover?: string;
}

export const DOC_CATEGORIES: Record<DocKind, string[]> = {
  hangul: ["공문", "신청·확인서", "기안·결재", "보고·계획", "계약·거래"],
  word: ["보고서", "기획·제안", "회의", "취업", "안내문"],
  excel: ["회계·세금", "보고·분석", "일정·관리", "거래·견적", "인사·급여"],
  ppt: ["사업·제안", "보고", "교육·강의", "회사·서비스 소개", "행사·홍보"],
  pdf: [],
  video: ["광고·리뷰", "브이로그·감성", "정보·커뮤니티", "행사·홍보"],
  image: ["광고·프로모션", "카드뉴스", "썸네일·배너", "SNS 게시물"],
};

const t = (kind: DocKind, id: string, title: string, category: string, layout: PaperLayout, use: string, sections: string[], cover?: string): DocTemplate =>
  ({ id: `${kind}-${id}`, kind, title, category, layout, use, sections, cover });

export const DOC_TEMPLATES: DocTemplate[] = [
  // ── 한글 ──
  t("hangul", "coop", "협조 요청 공문", "공문", "letter", "다른 기관·부서에 자료나 협조를 요청할 때", ["수신·참조", "제목", "관련 근거", "요청 내용", "붙임", "발신 명의"]),
  t("hangul", "result", "결과 보고 공문", "공문", "letter", "추진한 사업이나 행사의 결과를 알릴 때", ["수신", "제목", "추진 개요", "추진 결과", "향후 계획", "붙임"]),
  t("hangul", "event", "행사 개최 알림 공문", "공문", "letter", "행사 일정과 참석 협조를 알릴 때", ["수신", "제목", "행사 개요(일시·장소)", "참석 대상", "협조 사항"]),
  t("hangul", "objection", "강제퇴거명령에 대한 이의신청서", "신청·확인서", "form", "출입국 행정 처분에 이의를 신청할 때", ["신청인 인적 사항", "처분 내용", "이의 신청 이유", "첨부 서류", "서명"]),
  t("hangul", "residence", "거소신고(신청)서", "신청·확인서", "form", "국내 거소를 신고할 때", ["신고인 정보", "거소지", "체류 자격", "신고 사유", "서명"]),
  t("hangul", "lodging", "거주숙소제공사실확인서", "신청·확인서", "form", "외국인에게 숙소를 제공했음을 확인할 때", ["숙소 제공자", "피제공자", "숙소 주소", "제공 기간", "확인 서명"]),
  t("hangul", "employment", "재직증명서", "신청·확인서", "form", "회사 재직 사실을 증명할 때", ["인적 사항", "재직 정보(부서·직위·기간)", "용도", "발급 기관 직인"]),
  t("hangul", "draft", "기안서", "기안·결재", "form", "업무 추진을 결재받을 때", ["결재란", "문서번호·시행일자", "제목", "기안 내용", "붙임"]),
  t("hangul", "approval", "기안품의서", "기안·결재", "form", "기안과 품의를 한 장으로 올릴 때", ["결재란", "품의 사유", "소요 예산", "세부 내역", "붙임"]),
  t("hangul", "expense-res", "지출결의서", "기안·결재", "table", "비용 지출을 결재받을 때", ["결재란", "지출 내역 표", "합계", "증빙"]),
  t("hangul", "expense-plan", "지출계획서", "보고·계획", "table", "부서별 인건비·비용 지출을 계획할 때", ["문서번호·부서·작성자", "결재란", "구분·인원수·기본급·총금액 표", "합계"], coverExpensePlan),
  t("hangul", "operation", "운영계획서", "보고·계획", "report", "매장·사업의 판매 목표와 손익을 계획할 때", ["판매목표", "판촉계획", "손익계획", "정보 및 고객관리", "제안 및 건의사항"], coverOperationPlan),
  t("hangul", "trip", "출장 결과 보고서", "보고·계획", "report", "출장 다녀온 내용을 보고할 때", ["출장 개요", "주요 활동", "결과 및 성과", "후속 조치", "경비 내역"]),
  t("hangul", "mou", "양해각서", "계약·거래", "letter", "두 기관이 협력 원칙을 정할 때", ["협약 당사자", "목적", "협력 범위", "유효 기간", "서명란"]),
  t("hangul", "statement", "거래명세서", "계약·거래", "table", "공급한 물품과 금액을 알릴 때", ["공급자·공급받는자", "품목·수량·단가 표", "공급가액·세액", "합계"]),
  t("hangul", "quote", "견적서", "계약·거래", "table", "물품·용역 가격을 제시할 때", ["수신·견적일", "품목 표", "합계 금액", "유효 기간·조건"]),
  // ── 워드 ──
  t("word", "monthly", "월간 업무 보고서", "보고서", "report", "한 달 성과를 정리해 보고할 때", ["요약", "주요 성과", "진행 중인 업무", "이슈와 대응", "다음 달 계획"]),
  t("word", "weekly", "주간 업무 보고", "보고서", "report", "한 주 업무를 짧게 공유할 때", ["이번 주 한 일", "다음 주 할 일", "도움이 필요한 일"]),
  t("word", "bizplan", "사업계획서", "기획·제안", "report", "사업 개요와 시장·재무 계획을 정리할 때", ["사업 개요", "시장 분석", "추진 전략", "재무 계획", "추진 일정"]),
  t("word", "proposal", "제안서", "기획·제안", "form", "프로젝트·서비스를 제안할 때", ["제안 배경", "제안 내용", "기대 효과", "일정·비용"]),
  t("word", "bid", "입찰 제안서", "기획·제안", "report", "공공 입찰에 제출할 때", ["사업 이해", "수행 방안", "수행 조직", "일정 계획", "유사 실적"]),
  t("word", "minutes", "회의록", "회의", "table", "회의 결정 사항과 할 일을 남길 때", ["회의 정보(일시·참석자)", "안건", "논의 내용", "결정 사항", "후속 조치"]),
  t("word", "cover-letter", "자기소개서", "취업", "letter", "취업·대학원 지원서를 쓸 때", ["성장 과정", "지원 동기", "직무 역량", "입사 후 포부"]),
  t("word", "resume", "이력서", "취업", "table", "경력과 학력을 한눈에 정리할 때", ["인적 사항", "학력", "경력", "자격·어학", "기타"]),
  t("word", "notice", "행사 안내문", "안내문", "letter", "행사 일정과 참여 방법을 알릴 때", ["행사 소개", "일시·장소", "참여 방법", "문의처"]),
  t("word", "announce", "공지문", "안내문", "letter", "변경 사항을 짧게 알릴 때", ["제목", "변경 내용", "적용 일자", "문의처"]),
  // ── 엑셀 ── (sections = 표의 열)
  t("excel", "tax-invoice", "세금계산서", "회계·세금", "sheet", "부가가치세법 시행규칙 양식으로 세금계산서를 발행할 때", ["작성일자", "품목", "규격", "수량", "단가", "공급가액", "세액"]),
  t("excel", "expense", "월별 지출 내역", "회계·세금", "sheet", "한 달 지출을 항목별로 정리할 때", ["날짜", "항목", "내용", "금액", "결제 수단", "비고"]),
  t("excel", "daily", "일일 업무 보고", "보고·분석", "sheet", "하루 업무와 다음 날 계획을 보고할 때", ["NO", "작업 내용", "비고"], coverDailyReport),
  t("excel", "marketing", "마케팅 결과보고서", "보고·분석", "sheet", "캠페인 성과 지표와 ROI를 분석할 때", ["구분", "매출금액", "광고비용", "노출수", "클릭수", "전환수", "CPA"], coverMarketingReport),
  t("excel", "sales", "매장별 매출 집계", "보고·분석", "sheet", "매장·기간별 매출을 모아 합계를 볼 때", ["매장", "1주", "2주", "3주", "4주", "합계", "전월 대비"]),
  t("excel", "schedule", "프로젝트 일정표", "일정·관리", "sheet", "업무별 담당자와 기간을 관리할 때", ["업무", "담당자", "시작일", "종료일", "진행률", "상태"]),
  t("excel", "inventory", "재고 관리표", "일정·관리", "sheet", "품목별 입고·출고·재고를 관리할 때", ["품목", "입고", "출고", "현재 재고", "안전 재고", "비고"]),
  t("excel", "quote", "거래처 견적 표", "거래·견적", "sheet", "금액과 항목을 정리해 보낼 때", ["품목", "규격", "수량", "단가", "금액", "비고"]),
  t("excel", "statement", "거래명세표", "거래·견적", "sheet", "공급한 물품과 금액을 알릴 때", ["품목", "수량", "단가", "공급가액", "세액", "합계"]),
  t("excel", "payroll", "급여 대장", "인사·급여", "sheet", "직원별 급여와 공제를 정리할 때", ["이름", "부서", "기본급", "수당", "공제", "실지급액"]),
  t("excel", "attendance", "근태 관리표", "인사·급여", "sheet", "출근·휴가·초과근무를 기록할 때", ["이름", "출근일", "휴가", "지각", "초과근무", "비고"]),
  // ── PPT ── (sections = 슬라이드 구성, 16:9)
  t("ppt", "bizplan", "사업계획 발표자료", "사업·제안", "slide", "투자자에게 사업을 설명할 때", ["표지", "문제 정의", "해결 방법", "시장 규모", "사업 모델", "팀 소개"], coverBizPlanDeck),
  t("ppt", "proposal", "공공·기업 제안서", "사업·제안", "slide", "기관·기업에 사업을 제안할 때", ["표지", "제안 배경", "추진 전략", "세부 과업", "일정", "기대 효과"]),
  t("ppt", "quarterly", "분기 실적 보고", "보고", "slide", "분기 성과를 팀에 보고할 때", ["표지", "요약", "매출 실적", "주요 성과", "다음 분기 계획"]),
  t("ppt", "trend", "트렌드 리포트", "보고", "slide", "시장·소비자 흐름을 정리해 공유할 때", ["표지", "핵심 요약", "트렌드 1", "트렌드 2", "시사점"], coverTrend),
  t("ppt", "lecture", "강의 자료", "교육·강의", "slide", "수업·사내 교육을 진행할 때", ["표지", "학습 목표", "개념 설명", "예시", "정리·퀴즈"]),
  t("ppt", "onboarding", "신입 온보딩", "교육·강의", "slide", "새 팀원에게 회사와 업무를 소개할 때", ["표지", "회사 소개", "조직도", "업무 도구", "첫 주 일정"]),
  t("ppt", "company", "회사 소개서", "회사·서비스 소개", "slide", "회사를 처음 만나는 사람에게 소개할 때", ["표지", "회사 개요", "연혁", "주요 고객", "연락처"]),
  t("ppt", "platform", "플랫폼 소개", "회사·서비스 소개", "slide", "서비스 기능과 장점을 알릴 때", ["표지", "서비스 소개", "주요 기능", "도입 효과", "요금"], coverPlatformIntro),
  t("ppt", "event", "행사 안내 슬라이드", "행사·홍보", "slide", "행사 일정과 프로그램을 안내할 때", ["표지", "행사 개요", "프로그램", "오시는 길"]),
  t("ppt", "launch", "신제품 출시 발표", "행사·홍보", "slide", "새 제품·메뉴 출시를 알릴 때", ["표지", "제품 소개", "특징", "가격·혜택", "출시 일정"]),
  // ── 영상 ── (세로 9:16, sections = 장면 구성)
  t("video", "promo", "숏폼 홍보 영상", "광고·리뷰", "video", "제품·가게를 짧게 알릴 때", ["훅(첫 3초)", "제품 소개", "혜택", "행동 유도"], coverShortPromo),
  t("video", "review", "제품 광고 리뷰", "광고·리뷰", "video", "풀스크린 영상 위에 제목을 얹어 리뷰할 때", ["상단 제목", "사용 장면", "장단점", "마무리"], coverShort1),
  t("video", "vlog", "집중 공부 브이로그", "브이로그·감성", "video", "하루 일상을 차분하게 담을 때", ["오프닝", "공부 장면", "쉬는 시간", "마무리 한마디"], coverStudyVlog),
  t("video", "mood", "감성적인 순간", "브이로그·감성", "video", "음악과 자막으로 분위기를 전할 때", ["오프닝", "장면 1", "장면 2", "엔딩 자막"]),
  t("video", "community", "커뮤니티 게시글 스타일", "정보·커뮤니티", "video", "게시판 글처럼 상단 채널명·제목을 두고 이야기할 때", ["채널명·제목", "본문 장면", "댓글 반응", "마무리"], coverShort2),
  t("video", "tips", "꿀팁 정보 영상", "정보·커뮤니티", "video", "알아두면 좋은 정보를 순서대로 알려 줄 때", ["질문", "팁 1", "팁 2", "팁 3", "요약"]),
  t("video", "event", "행사 하이라이트", "행사·홍보", "video", "행사 장면을 모아 짧게 보여 줄 때", ["오프닝", "현장 스케치", "인터뷰", "다음 행사 안내"]),
  // ── 이미지 ── (1:1)
  t("image", "promo", "기획전 홍보 이미지", "광고·프로모션", "square", "할인·기획전을 한 장으로 알릴 때", ["메인 문구", "상품 사진", "혜택", "기간"], coverPromoImage),
  t("image", "sale", "할인 이벤트", "광고·프로모션", "square", "할인율을 크게 보여 줄 때", ["할인율", "대상 상품", "기간", "버튼 문구"]),
  t("image", "snack", "봄맞이 간식 추천 카드뉴스", "카드뉴스", "square", "여러 장으로 추천 목록을 전할 때", ["표지", "추천 1", "추천 2", "마무리"], coverSnackCard),
  t("image", "trend", "트렌드 소개 카드뉴스", "카드뉴스", "square", "요즘 흐름을 카드로 정리할 때", ["표지", "트렌드 요약", "근거", "정리"], coverTrendCard),
  t("image", "hometrain", "홈트 가이드 카드뉴스", "카드뉴스", "square", "따라 하는 방법을 단계별로 보여 줄 때", ["표지", "1단계", "2단계", "주의할 점"], coverHomeTrainCard),
  t("image", "thumbnail", "유튜브 썸네일", "썸네일·배너", "square", "영상 제목을 눈에 띄게 만들 때", ["큰 제목", "인물·사물", "강조 스티커"]),
  t("image", "banner", "SNS 광고 배너", "썸네일·배너", "square", "광고 배너가 필요할 때", ["제목", "설명", "버튼"]),
  t("image", "post", "공지 게시물", "SNS 게시물", "square", "SNS에 알림을 올릴 때", ["제목", "내용", "날짜"]),
];

export const templatesFor = (kind: DocKind) => DOC_TEMPLATES.filter((x) => x.kind === kind);
