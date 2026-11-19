import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { History, Home, MessageCircle, Pencil, Plus, Sparkles, X, LayoutGrid } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import { AiAssistantPanel, type AiRequest } from "@/app/components/editor-shell/AiAssistantPanel";
import { CommentListPanel } from "@/app/components/editor-shell/CommentListPanel";
import { DEMO_TEAMMATE, isUnread, type CommentAuthor } from "@/app/components/editor-shell/comments";
import { EditorHeader, type ProfileMenuHandlers, type SaveState, type Viewer } from "@/app/components/editor-shell/EditorHeader";
import { DockButtons, PanelCloseButton, SideDock } from "@/app/components/editor-shell/SideDock";
import { VersionHistoryPanel } from "@/app/components/editor-shell/VersionHistoryPanel";
import { useProfile } from "@/app/state/profile";
import { f, editorType } from "@/app/styleTokens";
import artUiDesign from "@/assets/home/editor/ui-design.png";

import { DesignFile, type FileApi } from "./DesignFile";
import { CLARIFY_REPLY, EDITOR_ACCENT, TEMPLATES, addNode, classifyPrompt, docFromSteps, emptyDoc, generateSteps, makeNode, uid, type Doc, type Thread } from "./model";
import { DocThumb, UiDesignHome } from "./UiDesignHome";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/**
 * 딸깍 UI 디자인 에디터 셸(2026-11-13 v2). 기획: docs/ui-design-editor.md.
 *   상단 바(공통 EditorHeader) / 탭 줄(⌂ 홈 + 파일 탭) / [홈 또는 파일] + 오른쪽 도크(공통 SideDock: 딸깍 AI · 코멘트 · 기록)
 * AI 패널은 에디터 전체에 하나 — 지금 보고 있는 파일에 작업하고, 홈에서 시키면 새 파일을 만든다(Claude in Chrome처럼 탭을 옮겨도 같은 패널).
 * 파일 탭은 모두 마운트한 채 숨겨 두어 탭을 옮겨도 캔버스·실행 취소가 남는다. 저장은 없다.
 */

/**
 * 버전(2026-11-19, docs/editor-common-header.md "9") — 파일의 이전 상태. "대화 목록"(AI 대화)과는 다른 기능.
 *   me: 직접 고친 것(2분 안의 고침은 한 버전으로 합친다) · ai: 딸깍 AI 작업이 끝난 뒤 · named: 이름 붙여 저장 · restore: 되돌리기 전 상태 · created: 처음 만듦
 */
export interface Version { id: string; at: number; by: "me" | "ai" | "named" | "restore" | "created"; name?: string; doc: Doc }
const VERSION_GAP = 2 * 60 * 1000;
const MAX_VERSIONS = 15;
const pushVersion = (list: Version[] | undefined, v: Version) => [...(list ?? []), v].slice(-MAX_VERSIONS);

/** 디자인 파일 — 탭을 닫아도(open=false) "내 파일"에 남는다. doc 은 마지막 상태(다시 열 때 이걸로 연다). rev가 바뀌면 캔버스를 그 doc으로 다시 연다(버전 되돌리기) */
export interface DFile { id: string; name: string; doc: Doc; open: boolean; updatedAt: number; versions?: Version[]; rev?: number }

const STORE_KEY = "ddalkkak.uidesign.v1";
const DOCK_KEY = "ddalkkak.uidesign.dock";
const AI_SHORTCUT = "⌘J";
function loadStore(): { files: DFile[]; threads: Record<string, Thread[]> } {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { files: [], threads: {} };
    const v = JSON.parse(raw) as { files: DFile[]; threads: Record<string, Thread[]> };
    return { files: (v.files ?? []).map((x) => ({ ...x, open: false })), threads: v.threads ?? {} };
  } catch { return { files: [], threads: {} }; }
}
let warnedQuota = false;
function saveStore(files: DFile[], threads: Record<string, Thread[]>): boolean {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ files, threads })); return true; }
  catch { if (!warnedQuota) { warnedQuota = true; showToast("저장 공간이 부족해 이 브라우저에 저장하지 못했어요(큰 이미지가 있으면 그래요). 열려 있는 동안은 그대로예요.", "error"); } return false; }
}
type Dock = "ai" | "comments" | "history";

const SUGGESTIONS_EMPTY = ["배달앱 모바일 메인 화면 만들어 줘", "로그인 화면 만들어 줘", "관리자 대시보드 만들어 줘"];
const SUGGESTIONS_SELECTED = ["선택한 화면 다크 모드로 바꿔 줘", "이 화면 옆에 로그인 화면 만들어 줘"];
const EXAMPLE = "“390×844 모바일 홈 화면 프레임을 만들고 위에 제목, 가운데 카드 3개, 아래 버튼을 넣어 줘”";

export function UiDesignEditor({ onBack, onBellClick, onSwitchApp, profileMenu, onManageModels, initialFileId }: {
  onBack: () => void;
  onBellClick?: () => void;
  /** 앱 이름 ▾ 에서 다른 딸깍 도구를 골랐을 때 */
  onSwitchApp?: (appId: string) => void;
  /** 프로필 메뉴: 서비스 상단바와 같은 항목·동작 */
  profileMenu?: ProfileMenuHandlers;
  /** AI 입력창 모델 메뉴 › AI 연결 관리 */
  onManageModels?: () => void;
  /** 메인 사이드바 "최근 작업"에서 고른 파일 — 있으면 홈 대신 그 파일 탭으로 연다 */
  initialFileId?: string;
}) {
  const profile = useProfile();
  const me: CommentAuthor = useMemo(() => ({ name: profile.name, avatarUrl: profile.avatarUrl, collabColor: profile.collabColor }), [profile]);

  const [initial] = useState(loadStore);
  const [files, setFiles] = useState<DFile[]>(() => initial.files.map((x) => (x.id === initialFileId ? { ...x, open: true } : x)));
  const [active, setActive] = useState<string>(() => (initialFileId && initial.files.some((x) => x.id === initialFileId) ? initialFileId : "home"));
  const [threadsByFile, setThreadsByFile] = useState<Record<string, Thread[]>>(initial.threads);
  // 바뀔 때마다 이 브라우저에 저장(잦은 입력은 0.4초 모아서)
  // 저장 상태 — 헤더에 "저장 중… / 저장됨 · 방금"(저장 버튼 대신 자동 저장, docs/editor-common-header.md "3")
  const [saveState, setSaveState] = useState<SaveState>({ kind: "saved", at: Date.now() });
  const firstSave = useRef(true);
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    setSaveState({ kind: "saving" });
    const t = window.setTimeout(() => setSaveState(saveStore(files, threadsByFile) ? { kind: "saved", at: Date.now() } : { kind: "error" }), 400);
    return () => window.clearTimeout(t);
  }, [files, threadsByFile]);
  const [pinsHidden, setPinsHidden] = useState(false);
  // 오른쪽 패널 열림 상태 — 마지막으로 둔 대로 기억한다(처음엔 딸깍 AI 열림)
  const [dock, setDockRaw] = useState<Dock | null>(() => {
    try { const v = localStorage.getItem(DOCK_KEY); return v === "closed" ? null : v === "ai" || v === "comments" || v === "history" ? v : "ai"; } catch { return "ai"; }
  });
  const setDock = (d: Dock | null) => {
    setDockRaw(d);
    if (d === "ai") setAiDot(false);
    try { localStorage.setItem(DOCK_KEY, d ?? "closed"); } catch { /* 이번 세션만 */ }
  };
  const dockRef = useRef(dock);
  dockRef.current = dock;
  // ⌘J(Ctrl+J) — 딸깍 AI 열기/닫기. 입력칸 안에서도 동작하도록 캡처 단계에서 받는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        e.stopPropagation();
        setDock(dockRef.current === "ai" ? null : "ai");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [aiDot, setAiDot] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const apis = useRef<Record<string, FileApi>>({});
  const activeRef = useRef(active);
  activeRef.current = active;

  const activeFile = files.find((x) => x.id === active) ?? null;
  const threads = activeFile ? threadsByFile[activeFile.id] ?? [] : [];
  const unread = threads.filter((t) => isUnread(t, me)).length;
  // 지금 함께 보는 사람 — 프로토타입: 나 + 이 파일에서 코멘트를 단 예시 팀원(DEMO_). 실제로는 실시간 접속 정보
  const someoneElse = threads.some((t) => t.messages.some((m) => m.author.name === DEMO_TEAMMATE.name));
  const viewers: Viewer[] = someoneElse ? [{ ...me, isMe: true, activity: "이 탭" }, { ...DEMO_TEAMMATE, activity: "방금 활동" }] : [{ ...me, isMe: true, activity: "이 탭" }];

  const openTabs = files.filter((x) => x.open);
  const openFile = (name: string, doc: Doc = emptyDoc()) => {
    const id = uid("file");
    setFiles((l) => [...l, { id, name, doc, open: true, updatedAt: Date.now(), versions: [{ id: uid("v"), at: Date.now(), by: "created", doc }] }]);
    setActive(id);
    setSelection(null);
    return id;
  };
  /** 내 파일에서 열기 — 이미 탭이면 그 탭으로, 닫혀 있으면 마지막 상태로 다시 연다 */
  const reopen = (id: string) => { setFiles((l) => l.map((x) => (x.id === id ? { ...x, open: true } : x))); setActive(id); };
  const closeFile = (id: string) => {
    setFiles((l) => {
      const tabs = l.filter((x) => x.open);
      const idx = tabs.findIndex((x) => x.id === id);
      const rest = tabs.filter((x) => x.id !== id);
      if (activeRef.current === id) setActive(rest[Math.max(0, idx - 1)]?.id ?? "home");
      return l.map((x) => (x.id === id ? { ...x, open: false } : x));
    });
    delete apis.current[id];
  };
  const deleteFile = (id: string) => {
    closeFile(id);
    setFiles((l) => l.filter((x) => x.id !== id));
    setThreadsByFile((all) => { const n = { ...all }; delete n[id]; return n; });
    showToast("파일을 삭제했어요.");
  };
  const duplicateFile = (id: string) => {
    const src = files.find((x) => x.id === id);
    if (!src) return;
    setFiles((l) => [...l, { id: uid("file"), name: `${src.name} 사본`, doc: src.doc, open: false, updatedAt: Date.now() }]);
    showToast("사본을 만들었어요.");
  };
  const nextUntitled = () => {
    const n = files.filter((x) => x.name.startsWith("Untitled")).length;
    return n ? `Untitled ${n + 1}` : "Untitled";
  };
  const docCache = useRef<Record<string, (d: Doc) => void>>({});
  // 고칠 때마다 버전: 마지막 버전이 내가 2분 안에 고친 것이면 그 버전을 갱신, 아니면 새 버전
  const onDocChange = (id: string) => (docCache.current[id] ??= (d: Doc) => setFiles((l) => l.map((x) => {
    if (x.id !== id) return x;
    const now = Date.now();
    const vs = x.versions ?? [];
    const last = vs[vs.length - 1];
    const versions = last && last.by === "me" && now - last.at < VERSION_GAP ? [...vs.slice(0, -1), { ...last, at: now, doc: d }] : pushVersion(vs, { id: uid("v"), at: now, by: "me", doc: d });
    return { ...x, doc: d, updatedAt: now, versions };
  })));
  // 버전 기록 패널
  const [versionSel, setVersionSel] = useState<string | null>(null);
  useEffect(() => { setVersionSel(null); }, [active]);
  const addVersion = (fileId: string, by: Version["by"], name?: string) =>
    setFiles((l) => l.map((x) => {
      if (x.id !== fileId) return x;
      const vs = x.versions ?? [];
      const last = vs[vs.length - 1];
      // 맨 끝 버전이 지금 상태 그대로면 새로 쌓지 않고 그 버전에 이름·종류만 붙인다(같은 상태가 두 줄로 보이지 않게)
      if (last && last.doc === x.doc && last.by !== "named" && last.by !== "restore") return { ...x, versions: [...vs.slice(0, -1), { ...last, by, name, at: Date.now() }] };
      return { ...x, versions: pushVersion(vs, { id: uid("v"), at: Date.now(), by, name, doc: x.doc }) };
    }));
  const restoreVersion = (fileId: string, versionId: string) => {
    setFiles((l) => l.map((x) => {
      if (x.id !== fileId) return x;
      const v = x.versions?.find((y) => y.id === versionId);
      if (!v) return x;
      const before = pushVersion(x.versions, { id: uid("v"), at: Date.now(), by: "restore", name: "되돌리기 전 상태", doc: x.doc });
      return { ...x, doc: v.doc, rev: (x.rev ?? 0) + 1, updatedAt: Date.now(), versions: before };
    }));
    setVersionSel(null);
    showToast("이 버전으로 되돌렸어요. 되돌리기 전 상태는 버전 기록에 남아 있어요.");
  };

  const setThreadsFor = useCallback((fileId: string) => (u: SetStateAction<Thread[]>) =>
    setThreadsByFile((all) => ({ ...all, [fileId]: typeof u === "function" ? (u as (t: Thread[]) => Thread[])(all[fileId] ?? []) : u })), []);
  const setterCache = useRef<Record<string, (u: SetStateAction<Thread[]>) => void>>({});
  const threadsSetter = (id: string) => (setterCache.current[id] ??= setThreadsFor(id));
  const registerCache = useRef<Record<string, (a: FileApi) => void>>({});
  const register = (id: string) => (registerCache.current[id] ??= (a: FileApi) => { apis.current[id] = a; });
  const onSelection = useCallback((label: string | null) => setSelection(label), []);

  /** 홈에서 시키면 새 파일을 만들고, 그 파일이 준비될 때까지 기다렸다가 넘긴다 */
  const fileApiForAi = async (prompt: string): Promise<FileApi> => {
    let id = activeRef.current;
    // 파일 이름은 요청 문장이 아니라 만들 화면 이름으로(예: "배달앱 모바일 메인")
    if (id === "home") id = openFile(prompt.trim() ? generateSteps(prompt, 0, 0).title : nextUntitled());
    for (let i = 0; i < 60 && !apis.current[id]; i++) await new Promise((r) => setTimeout(r, 50));
    return apis.current[id];
  };

  // 오른쪽 패널 토글 — 홈 탭에선 파일 단위 기능(코멘트)을 숨기고 AI만. 버전 기록은 구현 전이라 버튼을 두지 않는다(빈 패널을 여는 버튼 = 동작 없는 버튼).
  const dockTabs = [
    { id: "ai", label: "딸깍 AI", hint: `딸깍 AI 열기/닫기 (${AI_SHORTCUT})`, icon: Sparkles, dot: aiDot && dock !== "ai", emphasized: true },
    ...(activeFile ? [{ id: "history", label: "버전 기록", hint: "버전 기록: 이전 상태 보기·되돌리기", icon: History }] : []),
    ...(activeFile ? [{ id: "comments", label: "코멘트 목록", hint: unread ? `코멘트 목록 (읽지 않음 ${unread})` : "코멘트 목록 (남기기는 툴바 말풍선 · C)", icon: MessageCircle, badge: unread }] : []),
  ];

  const aiPanel = (
    <AiAssistantPanel
      runAi={async (req: AiRequest, onStep, isCancelled) => {
        // 모호하거나 선택이 필요한 요청은 파일을 만들거나 크레딧을 쓰지 않고 되묻는다
        const kind = classifyPrompt(req.prompt, !!(activeFile && selection));
        if (kind !== "create" && kind !== "edit") {
          await new Promise((r) => setTimeout(r, 450));
          return { summary: CLARIFY_REPLY[kind], credit: 0, stepsDone: 0, stopped: false, addedCount: 0, clarify: true };
        }
        return (await fileApiForAi(req.prompt)).runAi(req, onStep, isCancelled);
      }}
      planAi={(req) => {
        const kind = classifyPrompt(req.prompt, !!(activeFile && selection));
        if (kind !== "create" && kind !== "edit") return [];
        return (activeFile ? apis.current[activeFile.id]?.planAi(req) : null) ?? ["새 디자인 파일 만들기", "요청한 화면 그리기"];
      }}
      context={activeFile && selection ? { label: selection, onClear: () => apis.current[activeFile.id]?.clearSelection() } : null}
      suggestions={selection ? SUGGESTIONS_SELECTED : SUGGESTIONS_EMPTY}
      example={EXAMPLE}
      onAttachSelection={() => (activeFile ? apis.current[activeFile.id]?.attachSelection() ?? null : null)}
      onShowResult={(r) => activeFile && apis.current[activeFile.id]?.showResult(r)}
      onUndoResult={(r) => activeFile && apis.current[activeFile.id]?.undoResult(r)}
      onFinished={() => { if (dockRef.current !== "ai") setAiDot(true); if (activeRef.current !== "home") addVersion(activeRef.current, "ai"); }}
      onClose={() => setDock(null)}
      closeShortcut={AI_SHORTCUT}
      onManageModels={onManageModels}
    />
  );

  const commentsPanel = activeFile ? (
    <CommentListPanel
      threads={threads}
      me={me}
      location={(t) => {
        // 페이지 · 붙은 프레임 이름(Figma는 페이지만 보여 줘 어느 화면 얘기인지 몰랐다 — v3 보완)
        const d = activeFile.doc;
        const pg = d.pages.find((x) => x.id === t.pageId)?.name ?? "";
        return `${pg} · ${(t.frameId && d.nodes[t.frameId]?.name) || "캔버스"}`;
      }}
      openThreadId={null}
      hidden={pinsHidden}
      onToggleHidden={() => setPinsHidden((v) => !v)}
      onOpen={(t) => apis.current[activeFile.id]?.jumpTo(t)}
      onMarkAllRead={() => threadsSetter(activeFile.id)((all) => all.map((t) => ({ ...t, readAt: Date.now() })))}
      emptyHint="열린 코멘트가 없어요. 툴바의 말풍선이나 C 키를 누르고 캔버스를 클릭해 남겨 보세요."
      onClose={() => setDock(null)}
    />
  ) : (
    <div className="h-full flex flex-col" style={f}>
      <div className="flex items-center gap-2 shrink-0" style={{ height: 48, padding: "0 16px 0 8px", borderBottom: "1px solid #eef0f3" }}><PanelCloseButton onClick={() => setDock(null)} /><MessageCircle size={15} /><span style={{ fontSize: editorType.large, fontWeight: 700 }}>코멘트</span></div>
      <p style={{ fontSize: editorType.body, color: "#64748b", padding: "28px 20px", textAlign: "center" }}>파일을 열면 그 파일의 코멘트를 모아 볼 수 있어요.</p>
    </div>
  );


  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#f8fafc]" style={f}>
      <EditorHeader
        appIcon={artUiDesign}
        appName="딸깍 UI 디자인"
        currentAppId="uidesign"
        onSwitchApp={onSwitchApp}
        fileName={activeFile?.name}
        onRenameFile={(name) => activeFile && setFiles((l) => l.map((x) => (x.id === activeFile.id ? { ...x, name } : x)))}
        location="임시 보관함"
        saveState={saveState}
        capabilities={{ present: true, share: true }}
        viewers={viewers}
        profileMenu={profileMenu}
        onBack={onBack}
        onBell={onBellClick}
        // ▷▾ — Figma처럼 프레젠테이션(⌥⌘↵) · 미리 보기
        presentOptions={[
          { id: "present", label: "프레젠테이션", shortcut: "⌥⌘↵", keys: (e) => e.altKey && (e.metaKey || e.ctrlKey) && e.key === "Enter", run: () => showToast("프레젠테이션은 준비 중이에요.") },
          { id: "preview", label: "미리 보기", run: () => showToast("미리 보기는 준비 중이에요.") },
        ]}
        accent={EDITOR_ACCENT}
        actions={<DockButtons tabs={dockTabs} active={dock} onChange={(id) => setDock(id as Dock | null)} />}
      />

      {/* 탭 줄 — [파일](파일 목록) + 연 파일 */}
      <div className="h-8 shrink-0 flex items-stretch bg-[#ececee]" style={{ borderTop: "1px solid #eef0f3" }} role="tablist" aria-label="열린 파일">
        {/* 2026-11-19: 집 아이콘이 왼쪽 사이드바 "홈"(딸깍 홈)과 겹쳐 → 격자 아이콘. "파일" 글자는 왼쪽 패널 탭과 겹쳐 아이콘만(툴팁 "파일 목록") */}
        <IconTooltip label="파일 목록"><button type="button" role="tab" aria-selected={active === "home"} aria-label="파일 목록" onClick={() => setActive("home")} className="w-11 flex items-center justify-center" style={{ background: active === "home" ? "#fff" : undefined, borderRight: "1px solid #e2e2e5" }}>
          <LayoutGrid size={14} color="#4b5563" />
        </button></IconTooltip>
        {openTabs.map((x) => (
          <div key={x.id} role="tab" aria-selected={active === x.id} className="group flex items-center gap-2 pl-3 pr-2 cursor-default" style={{ minWidth: 120, maxWidth: 200, background: active === x.id ? "#fff" : undefined, borderRight: "1px solid #e2e2e5" }} onClick={() => setActive(x.id)}>
            <Pencil size={11} color={EDITOR_ACCENT} className="shrink-0" />
            <span className="truncate flex-1" style={{ fontSize: editorType.body, color: "#111827" }}>{x.name}</span>
            <IconTooltip label="탭 닫기"><button type="button" aria-label={`${x.name} 탭 닫기`} onClick={(e) => { e.stopPropagation(); closeFile(x.id); }} className="size-5 flex items-center justify-center rounded hover:bg-black/[0.06]"><X size={11} color="#6b7280" /></button></IconTooltip>
          </div>
        ))}
        <IconTooltip label="새 디자인 파일"><button type="button" aria-label="새 디자인 파일" onClick={() => openFile(nextUntitled())} className="w-9 flex items-center justify-center hover:bg-black/[0.04]"><Plus size={14} color="#4b5563" /></button></IconTooltip>
      </div>

      <div className="flex-1 min-h-0 flex" style={{ borderTop: "1px solid #eef0f3" }}>
        {active === "home" && (
          <UiDesignHome
            files={files}
            unreadByFile={Object.fromEntries(files.map((x) => [x.id, (threadsByFile[x.id] ?? []).filter((t) => isUnread(t, me)).length]))}
            onOpenFile={reopen}
            onRename={(id, name) => setFiles((l) => l.map((x) => (x.id === id ? { ...x, name } : x)))}
            onDuplicate={duplicateFile}
            onDelete={deleteFile}
            onNewFile={() => openFile(nextUntitled())}
            onOpenImage={(name, url, w, h) => {
              const s = Math.min(1, 1200 / Math.max(w, h));
              const frame = makeNode("frame", null, 0, 0, Math.round(w * s), Math.round(h * s), { name, fill: "#FFFFFF", imageUrl: url });
              openFile(name, addNode(emptyDoc(), "p1", frame));
            }}
            onTemplate={(id) => { const t = TEMPLATES.find((x) => x.id === id)!; openFile(t.name, docFromSteps(t.build().steps)); }}
          />
        )}
        {openTabs.map((x) => (
          <DesignFile
            key={`${x.id}:${x.rev ?? 0}`}
            initialDoc={x.doc}
            onDocChange={onDocChange(x.id)}
            shell={{
              newFile: () => openFile(nextUntitled()),
              openImage: (name, url, w, h) => {
                const sc = Math.min(1, 1200 / Math.max(w, h));
                openFile(name, addNode(emptyDoc(), "p1", makeNode("frame", null, 0, 0, Math.round(w * sc), Math.round(h * sc), { name, fill: "#FFFFFF", imageUrl: url })));
              },
              duplicateFile: () => duplicateFile(x.id),
              closeFile: () => closeFile(x.id),
              toggleAi: () => setDock(dockRef.current === "ai" ? null : "ai"),
            }}
            active={active === x.id}
            me={me}
            threads={threadsByFile[x.id] ?? []}
            setThreads={threadsSetter(x.id)}
            pinsHidden={pinsHidden}
            togglePins={() => setPinsHidden((v) => { showToast(v ? "코멘트를 다시 보여요." : "캔버스에서 코멘트를 숨겼어요. ⇧C로 다시 보여요."); return !v; })}
            onCommentMode={() => setDock("comments")}
            registerApi={register(x.id)}
            onSelection={onSelection}
          />
        ))}
        <SideDock
          rail={false}
          active={dock}
          onChange={(id) => setDock(id as Dock | null)}
          tabs={[
            { ...dockTabs[0], panel: aiPanel },
            { id: "comments", label: "코멘트 목록", icon: MessageCircle, panel: commentsPanel },
            {
              id: "history", label: "버전 기록", icon: History,
              panel: activeFile ? (
                <VersionHistoryPanel
                  items={[...(activeFile.versions ?? [])].reverse()
                    // 맨 위 자동 저장이 지금 상태와 같으면 "현재 버전" 줄과 겹치므로 뺀다(이름 붙인 버전은 남긴다)
                    .filter((v, i) => !(i === 0 && v.doc === activeFile.doc && (v.by === "me" || v.by === "created" || v.by === "ai")))
                    .map((v) => ({
                    id: v.id, at: v.at, named: v.by === "named",
                    title: v.name ?? { me: "자동 저장", ai: "딸깍 AI 작업", named: "이름 붙인 버전", restore: "되돌리기 전 상태", created: "처음 만듦" }[v.by],
                    author: v.by === "ai" ? "ai" : me,
                  }))}
                  selectedId={versionSel}
                  onSelect={setVersionSel}
                  renderPreview={(vid) => { const v = activeFile.versions?.find((y) => y.id === vid); return v ? <DocThumb doc={v.doc} height={110} pad={8} /> : null; }}
                  onRestore={(vid) => restoreVersion(activeFile.id, vid)}
                  onSaveNamed={(name) => { addVersion(activeFile.id, "named", name); showToast(`"${name}" 버전을 저장했어요.`); }}
                  onClose={() => setDock(null)}
                />
              ) : null,
            },
          ]}
        />
      </div>
    </div>
  );
}
