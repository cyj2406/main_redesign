import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, Frame, FolderOpen, Image as ImageIcon, MessagesSquare, Loader2, MessageSquarePlus, Plus, Scan, Sparkles, Square, Trash2, Upload, X, Zap, ListChecks, Crosshair, Copy, BookOpen, Paperclip, FolderPlus } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import type { ModelId } from "@/app/state/aiModels";
import {
  AGENT_NAME, CLAUDE_MODELS, CODEX_MODELS, isConnectionModel, panelDefault, panelModelId, panelModelLabel, useAiConnection, validPanelModel,
  type AgentId,
} from "@/app/state/aiConnection";
import { color, f, editorType } from "@/app/styleTokens";

import { PanelCloseButton } from "./SideDock";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/**
 * 딸깍 AI 패널(에디터 공통, 2026-11-13 v2) — 오른쪽 도크의 AI 탭. 기획: docs/ui-design-editor.md "4. 딸깍 AI".
 * Claude 사이드 패널을 참고했다:
 *   - 입력창: ＋(파일 올리기 · 프로젝트 파일에서 고르기 · 선택 영역 첨부) · 실행 방식(자동 / 먼저 계획 보여 주기) · 보내기/정지. 그 밖의 아이콘은 뺐다.
 *   - 프로젝트 자료: 지침 + 파일(Claude 프로젝트의 지식). 요청마다 자동으로 함께 보낸다.
 *   - 대화: 제목 · 기록(지난 대화) · 새 대화. 작업 결과: 단계 요약(펼침) · 설명 · 크레딧 · 결과 액션 · 복사/의견.
 * 실제 작업은 에디터가 넘긴 runAi 가 한다(지금은 목업).
 */

export interface AiAttachment { id: string; name: string; size: number; kind: "image" | "pdf" | "fig" | "selection" | "other"; url?: string }
/** model: 이 요청을 처리할 AI(docs/ai-models.md). 에디터는 creditFor(model, 기준)로 크레딧을 계산한다 */
export interface AiRequest { prompt: string; attachments: AiAttachment[]; instructions: string; projectFiles: AiAttachment[]; mode: RunMode; model?: ModelId }
export interface AiResult {
  summary: string; credit: number; stepsDone: number; stopped: boolean; addedCount: number;
  /** 결과 카드 — 누르면 캔버스에서 그 요소를 선택해 보여 준다(Claude 결과 파일 카드처럼) */
  target?: { id: string; label: string; meta: string };
  /** 새로 만든 최상위 요소 — 있으면 최신 결과에 한해 ↶ 되돌리기(만든 것만 지움) */
  createdRootId?: string;
  /** 요청이 모호해 되물은 답 — 작업·크레딧 없음 */
  clarify?: boolean;
}
/**
 * "자세히 적어서 요청하기"(2026-11-19) — 빈칸만 채우면 요청 문장을 만들어 보내는 양식. dev의 "브리프"를 참고했지만
 * ① 이름이 낯설어 무슨 기능인지 몰랐고 ② 도구와 상관없는 칸(시트에 분위기·로고)이 있었다 → 쉬운 이름 + 도구마다 맞는 칸.
 */
export interface BriefField { id: string; label: string; placeholder: string; required?: boolean; multiline?: boolean; chips?: string[] }
export interface BriefConfig {
  fields: BriefField[]; submitLabel: string; compose: (v: Record<string, string>) => string;
  /** 바뀌면 카드를 새로 그린다(템플릿이 바뀔 때 등). 없으면 하나로 본다 */
  key?: string;
  /** 카드 제목·설명·접힌 줄 설명(없으면 "자세히 적어서 요청하기" 기본 문구) */
  title?: string; description?: string; teaser?: string;
  /** 필수 칸 대신 "아무 칸이나 하나는 채워야" 보낼 수 있다(템플릿 채우기) */
  requireAny?: boolean;
  /** 아래 작은 안내(예: 비운 칸은 AI가 채워요) */
  footnote?: string;
}
export type RunAi = (req: AiRequest, onStep: (label: string) => void, isCancelled: () => boolean) => Promise<AiResult>;
export type PlanAi = (req: AiRequest) => string[];
type RunMode = "auto" | "plan";
interface QueueItem { id: number; req: AiRequest }

type AiMsg = { id: number; role: "ai"; status: "plan" | "working" | "done" | "stopped" | "cancelled"; steps: string[]; plan?: string[]; result?: AiResult; req: AiRequest };
type Msg = { id: number; role: "user"; text: string; attachments: AiAttachment[] } | AiMsg;
interface Conversation { id: number; title: string; msgs: Msg[]; at: number; /** 실제 작업이 한 번 끝나 제목이 정해졌는지 — 되물은 답("더" 등)은 제목이 되지 않게 */ titled?: boolean }

const MAX_FILE = 20 * 1024 * 1024;
const MAX_ATTACH = 5;
const PROJECT_LIMIT = 100 * 1024 * 1024;
const MAX_QUEUE = 5;
const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`);
const kindOf = (file: File): AiAttachment["kind"] =>
  file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : /\.fig(craft)?$/i.test(file.name) ? "fig" : "other";
let attSeq = 0;
const toAttachment = (file: File): AiAttachment => ({
  id: `a${Date.now()}${attSeq++}`, name: file.name, size: file.size, kind: kindOf(file), url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
});

export function AiAssistantPanel({
  runAi, planAi, context, suggestions, example, commandCount = 634, onAttachSelection, onShowResult, onUndoResult, onFinished, onClose, closeShortcut, prefill, brief, briefOpen, onManageModels,
}: {
  runAi: RunAi;
  planAi: PlanAi;
  /** 맥락 칩 — 선택한 요소 등. null 이면 "페이지 전체" */
  context: { label: string; onClear: () => void } | null;
  suggestions: string[];
  example: string;
  commandCount?: number;
  onAttachSelection?: () => AiAttachment | null;
  onShowResult?: (r: AiResult) => void;
  onUndoResult?: (r: AiResult) => void;
  /** 작업이 끝났을 때(도크가 접혀 있으면 탭에 점을 붙이는 데 쓴다) */
  /** 끝난 요청 문장(버전 기록 제목으로 쓴다) */
  onFinished?: (prompt: string) => void;
  /** 머리 왼쪽 » 접기 버튼 — 도크가 넘긴다 */
  onClose?: () => void;
  closeShortcut?: string;
  /** 입력창에 문장을 넣어 둔다(보내기는 사용자가). key가 바뀔 때마다 다시 넣는다. 예: 템플릿 "AI로 내용 채우기" */
  prefill?: { text: string; key: number };
  /** key가 바뀌면 "자세히 적어서 요청하기" 카드를 펼친다. 대화 중이면 대화 맨 아래에 펼친다(템플릿 "AI로 내용 채우기", 2026-11-19) */
  briefOpen?: { key: number };
  /** 첫 화면의 "자세히 적어서 요청하기" 양식. 없으면 숨긴다 */
  brief?: BriefConfig;
  /** 모델 메뉴의 "AI 연결 관리 ›" — 설정 › AI 모델 */
  onManageModels?: () => void;
}) {
  const [convs, setConvs] = useState<Conversation[]>([{ id: 1, title: "새 대화", msgs: [], at: Date.now() }]);
  const [cur, setCur] = useState(1);
  const conv = convs.find((c) => c.id === cur)!;
  const msgs = conv.msgs;
  const setMsgs = (fn: (m: Msg[]) => Msg[], convId = cur) =>
    setConvs((all) => all.map((c) => (c.id === convId ? { ...c, msgs: fn(c.msgs), at: Date.now() } : c)));

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const mode: RunMode = "auto";
  // 모델(2026-11-27): 설정 › AI 연결 기준. 새 대화는 채팅을 맡은 AI와 그 모델로 시작하고, 이 대화에서 바꾼 건 대화가 끝날 때까지 유지
  const conn = useAiConnection();
  const [modelRaw, setModel] = useState<ModelId | null>(() => panelDefault(conn));
  const model = validPanelModel(modelRaw, conn);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [menu, setMenu] = useState<null | "plus" | "mode" | "model" | "history">(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [projectFiles, setProjectFiles] = useState<(AiAttachment & { at: number })[]>([]);
  const cancelRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const projFileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    if (!prefill) return;
    setInput(prefill.text);
    requestAnimationFrame(() => {
      const ta = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="딸깍 AI에게 요청"]');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    });
  }, [prefill?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [briefForced, setBriefForced] = useState<number | null>(null);
  useEffect(() => { if (briefOpen) setBriefForced(briefOpen.key); }, [briefOpen?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // 폼이 펼쳐져 있는지(2026-11-20): 펼치면 첫 화면 안내 · 예시를 숨기고 폼만 보인다
  const [briefShown, setBriefShown] = useState(false);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest("[data-ai-menu]")) setMenu(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const projectCount = projectFiles.length + (instructions.trim() ? 1 : 0);

  const execute = async (aid: number, req: AiRequest, convId: number) => {
    setRunning(true);
    cancelRef.current = false;
    const patch = (p: (m: AiMsg) => Partial<AiMsg>) => setMsgs((all) => all.map((m) => (m.id === aid && m.role === "ai" ? { ...m, ...p(m) } : m)), convId);
    patch(() => ({ status: "working" }));
    const result = await runAi(req, (label) => patch((m) => ({ steps: [...m.steps, label] })), () => cancelRef.current);
    patch(() => ({ status: result.stopped ? "stopped" : "done", result }));
    if (!result.clarify) setConvs((all) => all.map((c) => (c.id === convId && !c.titled ? { ...c, title: req.prompt.slice(0, 24), titled: true } : c)));
    setRunning(false);
    onFinished?.(req.prompt);
  };

  const start = (req: AiRequest) => {
    const uid = ++idRef.current, aid = ++idRef.current;
    const convId = cur;
    // 계획을 세울 게 없는 요청(모호해서 되물어야 하는 경우)은 바로 실행해 질문으로 답한다
    if (req.mode === "plan" && planAi(req).length > 0) {
      setMsgs((m) => [...m, { id: uid, role: "user", text: req.prompt, attachments: req.attachments }, { id: aid, role: "ai", status: "plan", steps: [], plan: planAi(req), req }], convId);
      return;
    }
    setMsgs((m) => [...m, { id: uid, role: "user", text: req.prompt, attachments: req.attachments }, { id: aid, role: "ai", status: "working", steps: [], req }], convId);
    void execute(aid, req, convId);
  };

  useEffect(() => {
    if (running || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    start(next.req);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, queue]);

  const send = (text = input) => {
    const t = text.trim();
    if (!t) return;
    const req: AiRequest = { prompt: t, attachments, instructions, projectFiles, mode, model: model ?? undefined };
    if (running) {
      if (queue.length >= MAX_QUEUE) { showToast(`대기는 ${MAX_QUEUE}개까지예요. 앞의 요청이 끝나면 다시 보내 주세요.`, "error"); return; }
      setQueue((q) => [...q, { id: ++idRef.current, req }]);
    } else start(req);
    setInput("");
    setAttachments([]);
  };
  /** 바로 보내기 — 이 요청을 맨 앞으로 올리고 지금 작업을 멈춘다(그린 데까지는 남는다) */
  const sendQueuedNow = (id: number) => {
    setQueue((q) => { const it = q.find((x) => x.id === id); return it ? [it, ...q.filter((x) => x.id !== id)] : q; });
    cancelRef.current = true;
  };

  const [dropping, setDropping] = useState(false);
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const tooBig = list.filter((x) => x.size > MAX_FILE);
    if (tooBig.length) showToast(`${tooBig[0].name} 파일은 20MB가 넘어서 올릴 수 없어요.`, "error");
    const ok = list.filter((x) => x.size <= MAX_FILE);
    setAttachments((a) => {
      const room = MAX_ATTACH - a.length;
      if (ok.length > room) showToast(`한 번에 ${MAX_ATTACH}개까지 첨부할 수 있어요.`, "error");
      return [...a, ...ok.slice(0, Math.max(0, room)).map(toAttachment)];
    });
  };
  const addProjectFiles = (files: FileList | null) => {
    if (!files) return;
    const used = projectFiles.reduce((s, x) => s + x.size, 0);
    let room = PROJECT_LIMIT - used;
    const added: (AiAttachment & { at: number })[] = [];
    for (const file of Array.from(files)) {
      if (file.size > room) { showToast("프로젝트 용량 100MB를 넘어서 올릴 수 없어요.", "error"); break; }
      room -= file.size;
      added.push({ ...toAttachment(file), at: Date.now() });
    }
    setProjectFiles((p) => [...p, ...added]);
  };

  const newChat = () => {
    if (msgs.length === 0) return;
    const id = ++idRef.current;
    setConvs((all) => [{ id, title: "새 대화", msgs: [], at: Date.now() }, ...all]);
    setModel(panelDefault(conn));
    setCur(id);
    setMenu(null);
  };

  const iconBtn = "size-8 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";
  const menuStyle = { boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" } as const;
  const menuItem = "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f8fafc] disabled:opacity-40 disabled:hover:bg-transparent";

  // 파일 끌어다 놓기(2026-11-20): ＋ > 파일 올리기와 같다(이번 요청에만 붙임). 패널 어디에 놓아도 된다
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  return (
    <div className="relative flex flex-col h-full" style={f}
      onDragEnter={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(true); } }}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false); }}
      onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(false); addFiles(e.dataTransfer.files); } }}>
      {dropping && (
        <div className="absolute inset-2 z-40 rounded-xl flex flex-col items-center justify-center gap-2 pointer-events-none" style={{ background: "rgba(238,243,255,0.92)", border: `2px dashed ${color.brand}` }}>
          <Paperclip size={22} color={color.brand} />
          <p style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>여기에 놓으면 첨부돼요</p>
          <p style={{ fontSize: editorType.caption, color: "#64748b" }}>이번 요청에만 붙여요. 파일당 20MB까지예요.</p>
        </div>
      )}
      {/* 머리 — 대화 제목 · 새 대화(대화 중일 때만) */}
      <div className="relative flex items-center gap-1 shrink-0" style={{ height: 48, padding: onClose ? "0 8px 0 6px" : "0 8px 0 14px", borderBottom: "1px solid #eef0f3" }} data-ai-menu>
        {onClose && <PanelCloseButton onClick={onClose} shortcut={closeShortcut} />}
        <Sparkles size={15} color="#111827" className="shrink-0" />
        <span className="truncate" style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>{msgs.length ? conv.title : "딸깍 AI"}</span>
        <div className="ml-auto flex items-center shrink-0">
          {/* 2026-11-19 정리: 대화 목록 버튼은 뺐다(파일마다 대화가 이어지고, 다른 작업은 사이드바에서 연다). 프로젝트 자료는 입력창 ＋ 메뉴로.
              새 대화는 대화가 있을 때만(흐린 아이콘이 고장 난 것처럼 보였다) */}
          {msgs.length > 0 && <IconTooltip label="새 대화"><button type="button" className={iconBtn} aria-label="새 대화" onClick={newChat}><MessageSquarePlus size={18} color="#475569" /></button></IconTooltip>}
        </div>
      </div>

      {/* 대화 */}
      <div ref={listRef} className="flex-1 overflow-y-auto ui-scroll" style={{ padding: "12px 16px 16px" }}>
        {msgs.length === 0 ? (
          <div>
            {/* 빈 화면(2026-11-20, 사용자 "사용자 친화적으로"): Canva AI · ChatGPT · Claude 첫 화면처럼 인사 한 줄 + 할 수 있는 일 한 줄 + 바로 누를 예시.
                예전 "예: “390×844 모바일 홈 화면 프레임…”"(기술 용어)와 "사용할 수 있는 명령 634개"(뜻 없는 숫자)는 AI를 잘 모르는 사람에게 부담이라 뺐다. */}
            {/* 2026-11-20 사용자 "자세히 적어서 요청하기를 누르면 너무 쌓인다": 폼을 펼치면 인사 · 설명 · 예시를 숨기고 폼이 맨 위에(상자 없이) 온다. 닫으면 다시 보인다 */}
            {/* 2026-11-20 사용자 "기존처럼 이런 식이 낫다": 인사형("무엇을 도와드릴까요?")에서 예전 구성으로 되돌림. 예시 문장 + 명령 개수 + 자세히 적어서 요청하기 + 예시 칩 */}
            {!briefShown && (<>
              <p style={{ fontSize: editorType.large, lineHeight: "22px", color: "#4b5563", wordBreak: "keep-all" }}>하고 싶은 작업을 말로 적어 주세요. 예: {example}</p>
              <span className="inline-block mt-2 rounded px-2 py-0.5" style={{ fontSize: editorType.caption, color: "#6b7280", background: "#f3f4f6" }}>사용할 수 있는 명령 {commandCount}개</span>
            </>)}
            {brief && <BriefCard key={`${brief.key ?? "b"}-${briefForced ?? 0}`} brief={brief} bare defaultOpen={briefForced !== null} onOpenChange={setBriefShown} onSend={(text) => { setBriefForced(null); send(text); }} onClose={() => setBriefForced(null)} />}
            {!briefShown && <Suggestions items={suggestions} onPick={(s) => send(s)} />}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {msgs.map((m, mi) => m.role === "user" ? (
              <div key={m.id} className="group self-end max-w-[88%] flex flex-col items-end gap-1">
                {m.attachments.length > 0 && <div className="flex flex-wrap justify-end gap-1">{m.attachments.map((a) => <AttachChip key={a.id} a={a} />)}</div>}
                <div className="rounded-xl px-3 py-2" style={{ background: "#f1f5f9", fontSize: editorType.chat, lineHeight: "24px", color: "#111827", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
                {/* 내가 쓴 요청 복사(2026-11-20 사용자 "내가 친 거 복사할 수 있게"). 올렸을 때 · 키보드로 갔을 때만 보인다 */}
                {m.text && (
                  <IconTooltip label="복사" side="bottom">
                    <button type="button" aria-label="요청 복사" onClick={() => { void navigator.clipboard?.writeText(m.text).then(() => showToast("요청을 복사했어요."), () => showToast("복사하지 못했어요.")); }}
                      className="size-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] transition-opacity">
                      <Copy size={14} color="#64748b" />
                    </button>
                  </IconTooltip>
                )}
              </div>
            ) : (
              <AiTurn
                key={m.id} m={m}
                isLatest={!msgs.slice(mi + 1).some((x) => x.role === "ai")}
                onRunPlan={() => void execute(m.id, { ...m.req, mode: "auto" }, cur)}
                onCancelPlan={() => setMsgs((all) => all.map((x) => (x.id === m.id && x.role === "ai" ? { ...x, status: "cancelled" } : x)))}
                onShow={onShowResult}
              />
            ))}
            {brief && msgs.length > 0 && briefForced !== null && <BriefCard key={`${brief.key ?? "b"}-${briefForced}`} brief={brief} defaultOpen onSend={(text) => { setBriefForced(null); send(text); }} onClose={() => setBriefForced(null)} />}
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="shrink-0" style={{ padding: "0 12px 12px" }}>
        {queue.length > 0 && (
          <QueueTray
            items={queue}
            onRemove={(id) => setQueue((q) => q.filter((x) => x.id !== id))}
            onSendNow={sendQueuedNow}
            onClear={() => setQueue([])}
          />
        )}
        {/* 포커스는 바깥 상자 테두리로만 — 안쪽 입력칸에 전역 포커스 테두리가 겹쳐 그려지지 않게 */}
        <div data-onboarding="ai-composer" className="rounded-2xl bg-white border border-[#e5e7eb] focus-within:border-[#a5b4fc] focus-within:shadow-[0_0_0_3px_rgba(79,123,255,0.12)] transition-shadow" style={{ padding: "8px 12px 8px" }}>
          <div className="flex flex-wrap gap-1 mb-2">
            {context ? (
              <span className="inline-flex items-center gap-1 rounded-md px-2 h-6 max-w-full" style={{ background: color.surface.accent, fontSize: editorType.caption, color: color.brand, fontWeight: 600 }}>
                <Crosshair size={11} /><span className="truncate">선택: {context.label}</span>
                <button type="button" aria-label="선택 맥락 빼기" onClick={context.onClear} className="shrink-0"><X size={11} /></button>
              </span>
            ) : (
              // 2026-11-20: "페이지 전체"는 AI가 어디를 보는지 알려 주는 표시라 바탕 없이 회색 글자만(누르는 칩과 구분)
              <span className="inline-flex items-center gap-1 px-1 h-6" style={{ fontSize: editorType.caption, color: "#64748b" }}><Scan size={12} />페이지 전체</span>
            )}
            {projectCount > 0 && (
              // 2026-11-20: 누르면 프로젝트 자료 패널이 열리는 버튼임을 보이게 — 끝에 ›, 마우스를 올리면 바탕이 진해지고 툴팁
              <IconTooltip label="프로젝트 자료 관리" side="top"><button type="button" onClick={() => setProjectOpen(true)} className="inline-flex items-center gap-1 rounded-md pl-2 pr-1 h-6 bg-[#f3f4f6] hover:bg-[#e5e7eb] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.caption, color: "#475569", fontWeight: 500 }}>
                <FolderOpen size={12} />프로젝트 자료 {projectCount}개 참고 중<ChevronRight size={12} color="#94a3b8" />
              </button></IconTooltip>
            )}
            {attachments.map((a) => <AttachChip key={a.id} a={a} onRemove={() => setAttachments((l) => l.filter((x) => x.id !== a.id))} />)}
          </div>
          <textarea
            rows={2} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
            placeholder={running ? (queue.length ? "더 적으면 대기열 뒤에 붙어요" : "다음에 할 일을 적으면 지금 일이 끝난 뒤 보내요") : "무엇을 할까요?"}
            aria-label="딸깍 AI에게 요청"
            className="field-inline w-full resize-none bg-transparent"
            style={{ ...f, fontSize: editorType.chat, lineHeight: "24px", color: "#111827", outline: "none", boxShadow: "none" }}
          />
          <div className="relative flex items-center gap-1 mt-0.5" data-ai-menu>
            <IconTooltip label="첨부: 파일 · 프로젝트 파일 · 선택 영역" side="top"><button type="button" aria-label="첨부" aria-expanded={menu === "plus"} onClick={() => setMenu(menu === "plus" ? null : "plus")} className="size-8 rounded-full flex items-center justify-center hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
              <Plus size={17} color="#334155" />
            </button></IconTooltip>
            {/* 실행 방식(자동 / 계획 먼저) 칩은 뺐다(2026-11-19 사용자 "원래 없던 기능"): 보내면 늘 바로 작업한다 */}
            <IconTooltip label={model ? `AI 모델: ${panelModelLabel(model)}` : "연결된 AI가 없어요"} side="top"><button type="button" aria-label={model ? `AI 모델 ${panelModelLabel(model)}` : "AI 연결 안 됨"} aria-expanded={menu === "model"} onClick={() => setMenu(menu === "model" ? null : "model")} className="flex items-center gap-1 rounded-full px-2 h-8 min-w-0 hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.label, color: model ? "#334155" : "#b45309", fontWeight: 600 }}>
              <Sparkles size={12} className="shrink-0" /><span className="truncate" style={{ maxWidth: 88 }}>{model ? panelModelLabel(model, true) : "AI 연결 안 됨"}</span><ChevronDown size={11} color="#94a3b8" className="shrink-0" />
            </button></IconTooltip>
            {running && !input.trim() ? (
              <IconTooltip label="작업 중지 (그린 데까지는 남아요)" side="top"><button type="button" aria-label="작업 중지" onClick={() => { cancelRef.current = true; }} className="ml-auto size-8 rounded-full flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]" style={{ background: color.brand }}>
                <Square size={12} color="#fff" fill="#fff" />
              </button></IconTooltip>
            ) : (
              <IconTooltip label={running ? "대기열에 추가 (Enter)" : "보내기 (Enter)"} side="top"><button type="button" aria-label={running ? "대기열에 추가" : "보내기"} disabled={!input.trim()} onClick={() => send()} className="ml-auto size-8 rounded-full flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]" style={{ background: input.trim() ? color.brand : "#c7d2fe" }}>
                <ArrowUp size={16} color="#fff" strokeWidth={2.2} />
              </button></IconTooltip>
            )}

            {menu === "plus" && (
              <div className="absolute left-0 bottom-10 z-30 bg-white rounded-xl py-1 w-[264px] max-w-full" style={menuStyle}>
                {/* ＋ 메뉴(2026-11-19, Claude "파일 추가 / 프로젝트에 추가"·ChatGPT·Gemini 참고): 이번 요청에만 붙일 파일과 이 파일에서 AI가 매번 참고할 프로젝트 파일을 나눈다.
                    이름은 짧게, 차이는 아래 한 줄 설명으로 */}
                {/* 2026-11-20 정리: "프로젝트" 세 줄(올리기 · 보기 · 고르기)이 헷갈려 두 줄로.
                    [프로젝트 자료] 자료가 없으면 바로 파일 고르는 창, 있으면 프로젝트 자료 패널(지침 · 파일 목록 · 더 올리기 · 지우기).
                    "프로젝트 파일에서 고르기"(이번 요청에만 따로 붙이기)는 뺐다: 프로젝트 자료는 원래 매번 다 참고해서 차이가 거의 없다 */}
                <button type="button" className={menuItem} style={{ alignItems: "flex-start" }} onClick={() => { setMenu(null); fileRef.current?.click(); }}>
                  <Paperclip size={16} color="#475569" className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block" style={{ fontSize: editorType.body, color: "#111827" }}>파일 올리기</span><span className="block" style={{ fontSize: editorType.caption, color: "#64748b" }}>이번 요청에만 붙여요. 끌어다 놓아도 돼요</span></span>
                </button>
                <button type="button" className={menuItem} style={{ alignItems: "flex-start" }} onClick={() => { setMenu(null); if (projectCount > 0) setProjectOpen(true); else projFileRef.current?.click(); }}>
                  {projectCount > 0 ? <FolderOpen size={16} color="#475569" className="mt-0.5 shrink-0" /> : <FolderPlus size={16} color="#475569" className="mt-0.5 shrink-0" />}
                  <span className="min-w-0 flex-1"><span className="block" style={{ fontSize: editorType.body, color: "#111827" }}>프로젝트 자료</span><span className="block" style={{ fontSize: editorType.caption, color: "#64748b" }}>이 파일에서 AI가 매번 참고해요</span></span>
                  {projectCount > 0 && <span className="mt-0.5 shrink-0 inline-flex items-center gap-0.5" style={{ fontSize: editorType.caption, fontWeight: 600, color: "#475569" }}>{projectCount}개<ChevronRight size={12} color="#94a3b8" /></span>}
                </button>
                {onAttachSelection && context && <button
                  type="button" className={menuItem}
                  onClick={() => { setMenu(null); const a = onAttachSelection?.(); if (a) setAttachments((l) => (l.length >= MAX_ATTACH ? l : [...l, a])); }}
                >
                  <ImageIcon size={14} color="#475569" /><span style={{ fontSize: editorType.body }}>선택 영역을 이미지로 첨부</span>
                </button>}
              </div>
            )}
            {menu === "model" && (
              <div className="absolute left-0 right-0 bottom-10 z-30 bg-white rounded-xl py-1 max-h-[340px] overflow-y-auto ui-scroll" style={menuStyle} role="menu" aria-label="AI 모델">
                {/* 2026-11-27: 설정 › AI 연결과 같은 목록. 연결된 AI의 모델만, 이전 세대 모델은 설정에서만 */}
                {(["codex", "claude"] as AgentId[]).filter((a) => conn.connected[a]).map((a, gi) => (
                  <div key={a}>
                    {gi > 0 && <div className="h-px my-1" style={{ background: "#f1f5f9" }} />}
                    <p style={{ fontSize: editorType.caption, fontWeight: 700, color: "#64748b", padding: "8px 12px 2px" }}>{AGENT_NAME[a]}</p>
                    {(a === "codex" ? CODEX_MODELS.filter((m) => !m.legacy) : CLAUDE_MODELS).map((m) => {
                      const id = panelModelId(a, m.id);
                      return (
                        <button key={id} type="button" role="menuitemradio" aria-checked={model === id} className={menuItem} onClick={() => { setModel(id); setMenu(null); }}>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-1.5" style={{ fontSize: editorType.body, fontWeight: 600, color: "#111827" }}>
                              {m.label}{m.recommended && <span className="rounded-full px-1.5" style={{ fontSize: 10.5, fontWeight: 700, color: color.brand, background: color.surface.accent }}>추천</span>}
                            </span>
                            <span className="block" style={{ fontSize: editorType.caption, color: "#64748b", wordBreak: "keep-all" }}>{m.desc}</span>
                          </span>
                          {model === id && <Check size={14} color={color.brand} className="shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {!conn.connected.codex && !conn.connected.claude && (
                  <p style={{ fontSize: editorType.caption, color: "#64748b", padding: "10px 12px", lineHeight: 1.5 }}>연결된 AI가 없어요. 설정에서 Codex나 Claude Code에 로그인해 주세요.</p>
                )}
                {onManageModels && (
                  <>
                    <div className="h-px my-1" style={{ background: "#f1f5f9" }} />
                    <button type="button" className={menuItem} onClick={() => { setMenu(null); onManageModels(); }}>
                      <span className="flex-1" style={{ fontSize: editorType.label, fontWeight: 600, color: color.brand }}>AI 연결 설정</span><ChevronRight size={13} color={color.brand} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" multiple className="sr-only" tabIndex={-1} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {projectOpen && (
        <ProjectSheet
          instructions={instructions} setInstructions={setInstructions} files={projectFiles}
          onUpload={() => projFileRef.current?.click()}
          onRemove={(id) => setProjectFiles((l) => l.filter((x) => x.id !== id))}
          onClose={() => setProjectOpen(false)}
        />
      )}
      <input ref={projFileRef} type="file" multiple className="sr-only" tabIndex={-1} onChange={(e) => { const n = e.target.files?.length ?? 0; addProjectFiles(e.target.files); e.target.value = ""; if (n) setProjectOpen(true); }} />
    </div>
  );
}

/**
 * 대기열 — 작업 중에 보낸 요청이 순서대로 쌓인다. 입력창 바로 위에 붙는다.
 * 2026-11-20 정리(사용자 "Claude 참고, 모두 지우기와 ✕ 차이가 뭔지, 레이아웃 · 버튼 디자인 시스템에 맞게"):
 *  - 한 장씩 넘기던 카드(‹ › · 점) → Claude처럼 **모든 대기를 짧은 목록**으로(최대 MAX_QUEUE개라 길지 않다)
 *  - 머리: "대기 중 N개 · 지금 일이 끝나면 차례로 보내요" ··· [모두 빼기](2개 이상일 때만)
 *  - 줄: 순서 번호 · 요청 한 줄(넘치면 …, 전체는 툴팁) ··· [↑ 지금 보내기] [✕ 빼기]
 *    "모두 지우기"와 ✕가 같은 일을 다른 말로 하고 있어서 말을 맞췄다: 줄의 ✕ = 이것만 빼기, 머리 = 모두 빼기
 *  - 버튼은 공통 작은 칸(32px · 아이콘 16px), 글자 버튼은 12px 회색
 */
function QueueTray({ items, onRemove, onSendNow, onClear }: {
  items: QueueItem[]; onRemove: (id: number) => void; onSendNow: (id: number) => void; onClear: () => void;
}) {
  const iconBtn = "size-8 shrink-0 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";
  return (
    <div className="mb-2 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #eef0f3" }} role="region" aria-label={`대기 중인 요청 ${items.length}개`}>
      <div className="flex items-center gap-1.5 h-9" style={{ padding: "0 4px 0 12px" }}>
        <span className="shrink-0" style={{ fontSize: editorType.caption, fontWeight: 600, color: "#334155" }} aria-live="polite">대기 중 {items.length}개</span>
        <span className="truncate" style={{ fontSize: editorType.caption, color: "#64748b" }}>· 지금 일이 끝나면 차례로 보내요</span>
        {items.length > 1 && (
          <button type="button" onClick={onClear} className="ml-auto shrink-0 rounded-md px-2 h-7 hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.caption, fontWeight: 600, color: "#475569" }}>모두 빼기</button>
        )}
      </div>
      <ol style={{ padding: "0 4px 4px" }}>
        {items.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2 rounded-lg bg-white" style={{ padding: "4px 4px 4px 10px", marginTop: i ? 4 : 0, boxShadow: "inset 0 0 0 1px #eef0f3" }}>
            <span className="shrink-0 w-4 text-center" style={{ fontSize: editorType.caption, fontWeight: 600, color: "#94a3b8" }}>{i + 1}</span>
            <p className="flex-1 min-w-0 truncate" style={{ fontSize: editorType.body, lineHeight: "20px", color: "#1f2937" }} title={it.req.prompt}>
              {it.req.prompt}
              {it.req.attachments.length > 0 && <span style={{ fontSize: editorType.caption, color: "#64748b" }}> · 첨부 {it.req.attachments.length}</span>}
            </p>
            <IconTooltip label="지금 보내기: 하던 일을 멈추고 이것부터" side="top"><button type="button" aria-label={`${i + 1}번 지금 보내기`} onClick={() => onSendNow(it.id)} className={iconBtn}>
              <ArrowUp size={16} color={color.brand} strokeWidth={2.2} />
            </button></IconTooltip>
            <IconTooltip label="이것만 빼기" side="top"><button type="button" aria-label={`${i + 1}번 빼기`} onClick={() => onRemove(it.id)} className={iconBtn}>
              <X size={16} color="#64748b" />
            </button></IconTooltip>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BriefCard({ brief, onSend, defaultOpen = false, onClose, onOpenChange, bare = false }: { brief: BriefConfig; onSend: (text: string) => void; defaultOpen?: boolean; onClose?: () => void; onOpenChange?: (open: boolean) => void; /** 첫 화면에서 펼쳤을 때: 상자 없이 패널에 바로 놓고 제목을 머리처럼 크게 */ bare?: boolean }) {
  const [open, setOpenState] = useState(defaultOpen);
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); if (!o) onClose?.(); };
  useEffect(() => { onOpenChange?.(defaultOpen); return () => onOpenChange?.(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, setV] = useState<Record<string, string>>({});
  const ready = brief.requireAny ? brief.fields.some((x) => (v[x.id] ?? "").trim()) : brief.fields.every((x) => !x.required || (v[x.id] ?? "").trim());
  const title = brief.title ?? "자세히 적어서 요청하기";
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: "1px solid #e5e7eb" }}>
        <span className="size-8 shrink-0 rounded-lg flex items-center justify-center" style={{ background: color.surface.accent }}><ListChecks size={15} color={color.brand} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>{title}</span>
          <span className="block" style={{ fontSize: editorType.caption, color: "#64748b", wordBreak: "keep-all" }}>{brief.teaser ?? "무엇을 쓸지 막막하면 빈칸만 채워 보세요"}</span>
        </span>
        <ChevronRight size={14} color="#94a3b8" />
      </button>
    );
  }
  const field = "w-full rounded-lg outline-none border border-[#e5e7eb] focus:border-[#4f7bff] bg-white";
  return (
    <form
      className={bare ? "pt-1" : "mt-4 rounded-xl p-3"} style={bare ? undefined : { border: "1px solid #e5e7eb", background: "#fbfcfd" }}
      onSubmit={(e) => { e.preventDefault(); if (!ready) return; onSend(brief.compose(v)); setOpen(false); setV({}); }}
      aria-label={title}
    >
      <div className="flex items-center">
        <span className="min-w-0 truncate" style={bare ? { fontSize: editorType.chat, lineHeight: "24px", fontWeight: 700, color: "#111827" } : { fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>{title}</span>
        <button type="button" aria-label="닫기" onClick={() => setOpen(false)} className="ml-auto size-6 flex items-center justify-center rounded-md hover:bg-black/[0.05]"><X size={13} color="#64748b" /></button>
      </div>
      <p style={{ fontSize: editorType.caption, color: "#64748b", marginTop: 2, wordBreak: "keep-all" }}>{brief.description ?? "적은 내용으로 요청 문장을 만들어 바로 보내요."}</p>
      {brief.fields.map((x) => (
        <label key={x.id} className="block mt-3">
          <span style={{ fontSize: editorType.label, fontWeight: 600, color: "#334155" }}>{x.label}{x.required && <span style={{ color: "#ef4444" }}> *</span>}</span>
          {x.chips ? (
            <span className="flex flex-wrap gap-2 mt-2">
              {x.chips.map((c) => {
                const on = v[x.id] === c;
                return <button key={c} type="button" aria-pressed={on} onClick={() => setV((o) => ({ ...o, [x.id]: on ? "" : c }))} className="h-8 px-3 rounded-full" style={{ fontSize: editorType.caption, fontWeight: on ? 700 : 500, color: on ? "#fff" : "#475569", background: on ? "#111827" : "#fff", boxShadow: on ? undefined : "inset 0 0 0 1px #e2e8f0" }}>{c}</button>;
              })}
            </span>
          ) : x.multiline ? (
            <textarea value={v[x.id] ?? ""} onChange={(e) => setV((o) => ({ ...o, [x.id]: e.target.value }))} onKeyDown={(e) => e.stopPropagation()} rows={2} placeholder={x.placeholder} className={`${field} mt-2 resize-none`} style={{ ...f, fontSize: editorType.large, lineHeight: "20px", padding: "8px 12px", color: "#111827" }} />
          ) : (
            <input value={v[x.id] ?? ""} onChange={(e) => setV((o) => ({ ...o, [x.id]: e.target.value }))} onKeyDown={(e) => e.stopPropagation()} placeholder={x.placeholder} className={`${field} mt-2 h-10`} style={{ ...f, fontSize: editorType.large, padding: "0 12px", color: "#111827" }} />
          )}
        </label>
      ))}
      <button type="submit" disabled={!ready} className="mt-4 w-full h-10 rounded-lg flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff] disabled:opacity-40" style={{ background: color.brand, color: "#fff", fontSize: editorType.body, fontWeight: 700 }}>
        <Sparkles size={14} />{brief.submitLabel}
      </button>
      {brief.footnote && <p style={{ fontSize: editorType.caption, lineHeight: "17px", color: "#94a3b8", marginTop: 8, wordBreak: "keep-all" }}>{brief.footnote}</p>}
    </form>
  );
}

/**
 * 예시 요청(2026-11-20 다듬음, 사용자 "좀 더 죽여도 될 듯, 세련되게"): 상자 · ✨ 아이콘을 빼고 얇은 선으로 나뉜 글자 목록(ChatGPT · Claude 첫 화면처럼).
 * 위의 "자세히 적어서 요청하기" 카드가 주인공이고 예시는 한 단계 조용하게: 라벨 12px 회색, 글자 14px 진회색, 마우스를 올리면 연한 바탕 + → 화살표.
 */
function Suggestions({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  if (!items.length) return null;
  // 예전 칩 모양으로 되돌림(2026-11-20): 글자 길이만큼의 테두리 버튼, 라벨 "이렇게 시켜 보세요"
  return (
    <div className="flex flex-col gap-2 mt-4" data-onboarding="ai-suggest">
      <p style={{ fontSize: editorType.caption, fontWeight: 600, color: "#64748b" }}>이렇게 시켜 보세요</p>
      {items.map((s) => (
        <button key={s} type="button" onClick={() => onPick(s)} className="self-start text-left rounded-lg px-3 py-2 hover:bg-[#eef2ff] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: editorType.label, color: "#334155", border: "1px solid #e5e7eb", wordBreak: "keep-all" }}>
          {s}
        </button>
      ))}
    </div>
  );
}

function AttachChip({ a, onRemove }: { a: AiAttachment; onRemove?: () => void }) {
  const Icon = a.kind === "image" || a.kind === "selection" ? ImageIcon : FileText;
  return (
    <span className="inline-flex items-center gap-1 rounded-md pl-1 pr-2 h-6 max-w-[200px]" style={{ background: "#f3f4f6", fontSize: editorType.caption, color: "#334155" }} title={`${a.name} · ${fmtSize(a.size)}`}>
      {a.url ? <img src={a.url} alt="" className="size-4 rounded object-cover shrink-0" /> : <Icon size={12} className="shrink-0" />}
      <span className="truncate">{a.name}</span>
      {onRemove && <button type="button" aria-label={`${a.name} 빼기`} onClick={onRemove} className="shrink-0"><X size={11} /></button>}
    </span>
  );
}

function AiTurn({ m, onRunPlan, onCancelPlan, onShow }: { m: AiMsg; isLatest: boolean; onRunPlan: () => void; onCancelPlan: () => void; onShow?: (r: AiResult) => void }) {
  const [open, setOpen] = useState(false);
  if (m.status === "plan" || m.status === "cancelled") {
    return (
      <div className="rounded-2xl" style={{ border: "1px solid #eef0f3", padding: 16 }}>
        <p className="flex items-center gap-2" style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}><ListChecks size={14} />이렇게 진행할게요</p>
        <ol className="mt-2 flex flex-col gap-1 list-decimal pl-5" style={{ fontSize: editorType.label, color: "#374151" }}>{m.plan?.map((s) => <li key={s}>{s}</li>)}</ol>
        {m.status === "plan" ? (
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={onRunPlan} className="rounded-lg px-3 h-8" style={{ background: color.brand, color: "#fff", fontSize: editorType.label, fontWeight: 700 }}>실행</button>
            <button type="button" onClick={onCancelPlan} className="rounded-lg px-3 h-8 border border-[#e5e7eb]" style={{ fontSize: editorType.label, fontWeight: 600, color: "#334155" }}>취소</button>
          </div>
        ) : <p style={{ fontSize: editorType.caption, color: "#94a3b8", marginTop: 8 }}>취소했어요</p>}
      </div>
    );
  }
  if (m.status === "working") {
    return (
      <div className="rounded-2xl" style={{ border: "1px solid #eef0f3", boxShadow: "0px 2px 10px rgba(0,0,0,0.05)", padding: 16 }}>
        <div className="flex gap-3">
          <span className="shrink-0 size-11 rounded-xl flex items-center justify-center" style={{ background: color.surface.accent }}><Sparkles size={20} color={color.brand} className="animate-pulse" /></span>
          <div className="min-w-0">
            <p className="flex items-center gap-1" style={{ fontSize: editorType.caption, color: "#6b7280" }}><Clock size={11} />보통 1~3분</p>
            <p style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827", lineHeight: "20px", marginTop: 2, wordBreak: "keep-all" }}>딸깍이들이 힘을 합쳐 작업하고 있어요</p>
          </div>
        </div>
        <div className="flex gap-2 rounded-xl mt-3" style={{ background: color.surface.accent, padding: "12px 12px" }}>
          <Bell size={13} color={color.brand} className="shrink-0 mt-0.5" />
          <p style={{ fontSize: editorType.caption, lineHeight: "18px", color: "#3b5bdb", wordBreak: "keep-all" }}>패널을 접거나 다른 탭으로 가도 계속 작업할게요. 끝나면 이 탭에 표시해 둘게요.</p>
        </div>
        {m.steps.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {m.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2" style={{ fontSize: editorType.caption, color: "#374151" }}>
                {i === m.steps.length - 1 ? <Loader2 size={12} className="animate-spin" color={color.brand} /> : <Check size={12} color="#16a34a" />}{s}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  const r = m.result!;
  return (
    <div className="flex flex-col gap-3">
      {m.steps.length > 0 && (
        <div>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] rounded" style={{ fontSize: editorType.caption, color: "#6b7280" }}>
            {r.addedCount > 0 ? `요소 ${r.addedCount}개 추가, ` : ""}단계 {m.steps.length}개 {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {open && <ul className="flex flex-col gap-2 mt-2 pl-1">{m.steps.map((s, i) => <li key={i} className="flex items-center gap-2" style={{ fontSize: editorType.caption, color: "#374151" }}><Check size={12} color="#16a34a" />{s}</li>)}</ul>}
        </div>
      )}
      <p style={{ fontSize: editorType.chat, lineHeight: "24px", color: "#111827", wordBreak: "keep-all" }}>{r.summary}</p>
      {/* 결과 카드 — 누르면 캔버스에서 선택해 보여 준다(따로 "선택해서 보기" 버튼을 두지 않는다) */}
      {r.target && (
        <button
          type="button" onClick={() => onShow?.(r)}
          className="self-stretch flex items-center gap-3 rounded-xl px-3 py-2 text-left bg-white hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
          style={{ border: "1px solid #e5e7eb" }}
          title="캔버스에서 선택해 보기"
        >
          <span className="size-8 shrink-0 rounded-lg flex items-center justify-center" style={{ background: color.surface.accent }}><Frame size={15} color={color.brand} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate" style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>{r.target.label}</span>
            <span className="block truncate" style={{ fontSize: editorType.caption, color: "#64748b" }}>{r.target.meta}</span>
          </span>
          <ChevronRight size={14} color="#94a3b8" className="shrink-0" />
        </button>
      )}
      {/* 바닥 줄 — 쓴 크레딧(조용히). 되돌리기는 뺐다(2026-11-20 사용자 "필요 없어 보인다": ⌘Z와 버전 기록으로 되돌린다) */}
      {(r.credit > 0 || m.req.model) && !r.clarify && (
        <div className="flex items-center gap-2" style={{ fontSize: editorType.caption, color: "#94a3b8" }}>
          {/* 무엇으로 만들었는지 남긴다(docs/ai-models.md "2-4") */}
          <span>{isConnectionModel(m.req.model) ? `${panelModelLabel(m.req.model!)} · ` : ""}{r.credit > 0 ? `크레딧 ${r.credit.toLocaleString()} 사용` : "크레딧 안 씀"}</span>
        </div>
      )}
    </div>
  );
}

function ProjectSheet({ instructions, setInstructions, files, onUpload, onRemove, onClose }: {
  instructions: string; setInstructions: (v: string) => void; files: (AiAttachment & { at: number })[]; onUpload: () => void; onRemove: (id: string) => void; onClose: () => void;
}) {
  const used = files.reduce((s, x) => s + x.size, 0);
  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col" role="dialog" aria-label="프로젝트 자료">
      <div className="flex items-center gap-2 shrink-0" style={{ height: 48, padding: "0 8px 0 16px", borderBottom: "1px solid #eef0f3" }}>
        <FolderOpen size={15} color="#111827" />
        <span style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>프로젝트 자료</span>
        <button type="button" aria-label="닫기" onClick={onClose} className="ml-auto size-8 flex items-center justify-center rounded-md hover:bg-black/[0.05]"><X size={15} color="#475569" /></button>
      </div>
      <div className="flex-1 overflow-y-auto ui-scroll" style={{ padding: 16 }}>
        <p style={{ fontSize: editorType.caption, lineHeight: "18px", color: "#64748b", wordBreak: "keep-all" }}>여기 넣은 지침과 파일은 이 파일에서 딸깍 AI에게 시킬 때마다 함께 참고해요.</p>
        <p style={{ fontSize: editorType.label, fontWeight: 700, color: "#111827", marginTop: 16 }}>지침</p>
        <textarea
          value={instructions} onChange={(e) => setInstructions(e.target.value)} onKeyDown={(e) => e.stopPropagation()} rows={5}
          placeholder={"예: 브랜드 컬러는 #FF6B00, 모서리는 16px.\n버튼 문구는 해요체로 짧게."}
          className="w-full mt-2 rounded-lg outline-none resize-none border border-[#e5e7eb] focus:border-[#4f7bff]"
          style={{ ...f, fontSize: editorType.large, lineHeight: "20px", padding: "8px 12px", color: "#111827" }}
        />
        <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
          <p style={{ fontSize: editorType.label, fontWeight: 700, color: "#111827" }}>파일 {files.length}개</p>
          <button type="button" onClick={onUpload} className="inline-flex items-center gap-1 rounded-lg px-3 h-8 border border-[#e5e7eb] hover:bg-[#f8fafc]" style={{ fontSize: editorType.caption, fontWeight: 600, color: "#334155" }}><Upload size={12} />올리기</button>
        </div>
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }} aria-label={`용량 ${fmtSize(used)} / 100MB`}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / PROJECT_LIMIT) * 100)}%`, background: color.brand }} />
        </div>
        <p style={{ fontSize: editorType.caption, color: "#94a3b8", marginTop: 4 }}>{fmtSize(used)} / 100MB 사용</p>
        {files.length === 0 ? (
          <p style={{ fontSize: editorType.caption, lineHeight: "18px", color: "#94a3b8", padding: "16px 0", wordBreak: "keep-all" }}>브랜드 가이드, 로고, 참고 문서나 이미지처럼 작업할 때마다 참고할 파일을 올려 두세요.</p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {files.map((x) => (
              <li key={x.id} className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
                {x.url ? <img src={x.url} alt="" className="size-8 rounded object-cover shrink-0" /> : <span className="size-8 rounded bg-[#f1f5f9] flex items-center justify-center shrink-0"><FileText size={14} color="#64748b" /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ fontSize: editorType.label, color: "#111827" }}>{x.name}</p>
                  <p style={{ fontSize: editorType.caption, color: "#94a3b8" }}>{fmtSize(x.size)} · 방금 올림</p>
                </div>
                <button type="button" aria-label={`${x.name} 지우기`} onClick={() => onRemove(x.id)} className="size-8 flex items-center justify-center rounded hover:bg-black/[0.05]"><Trash2 size={13} color="#64748b" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
