import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Copy, FolderOpen, Home, LayoutGrid, LayoutList, Link2, MessageCircle, MoreHorizontal, Pencil, Plus, Search, StickyNote, Trash2, X } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import { relTime } from "@/app/components/editor-shell/comments";
import { color, f, editorType } from "@/app/styleTokens";
import artUiDesign from "@/assets/home/editor/ui-design.png";

import { NodeView } from "./Canvas";
import { EDITOR_ACCENT, TEMPLATES, docFromSteps, type Doc } from "./model";
import type { DFile } from "./UiDesignEditor";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/**
 * 딸깍 UI 디자인 홈 탭 v3 — "내가 한 작업"이 먼저 보이게(docs/ui-design-editor.md "1-2. 홈 v3").
 *   한 줄 행동(새 디자인 파일만 초록) → 내 파일 썸네일 격자(정렬·보기 전환·⋯ 메뉴) → 템플릿(작게).
 *   파일이 없을 때만 큰 빈 상태 + 시작하기 안내.
 * 색: 초록은 주요 행동 하나와 열린 탭 표시에만. 나머지는 무채색 — 강조가 겹쳐 내 파일이 묻히지 않게.
 */

const GUIDE_KEY = "ddalkkak.uidesign.guideDismissed";
const GUIDE = [
  ["프레임 그리기", "F", "프레임 도구를 고른 뒤 캔버스에서 드래그하거나 기기 크기를 고르세요."],
  ["딸깍 AI에게 시키기", "", "오른쪽 딸깍 AI에 원하는 화면을 말로 적으면 캔버스에 바로 그려요."],
  ["코멘트 남기기", "C", "캔버스를 클릭해 의견을 남기고, 핀을 끌어 옮길 수 있어요."],
] as const;
const NEUTRAL_ICON = { background: "#f1f5f9", color: "#334155" } as const;
/** 내 파일·템플릿 격자가 같은 열 너비를 쓴다 — 위아래 카드 정렬선이 하나로 떨어지게 */
const GRID_COLS = "repeat(auto-fill, minmax(220px, 1fr))";

export function UiDesignHome({ files, unreadByFile, onOpenFile, onRename, onDuplicate, onDelete, onNewFile, onOpenImage, onTemplate }: {
  files: DFile[];
  unreadByFile: Record<string, number>;
  onOpenFile: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNewFile: () => void;
  onOpenImage: (name: string, dataUrl: string, w: number, h: number) => void;
  onTemplate: (id: string) => void;
}) {
  const [nav, setNav] = useState<"recent" | "templates">("recent");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const [layout, setLayout] = useState<"grid" | "list">(() => { try { return localStorage.getItem("ddalkkak.uidesign.layout") === "list" ? "list" : "grid"; } catch { return "grid"; } });
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [guideHidden, setGuideHidden] = useState(() => { try { return localStorage.getItem(GUIDE_KEY) === "1"; } catch { return false; } });
  const fileRef = useRef<HTMLInputElement>(null);
  const query = q.trim().toLowerCase();
  const templates = TEMPLATES.filter((t) => !query || t.name.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query));
  const mine = files
    .filter((x) => !query || x.name.toLowerCase().includes(query))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "ko") : b.updatedAt - a.updatedAt));
  const setLayoutSaved = (v: "grid" | "list") => { setLayout(v); try { localStorage.setItem("ddalkkak.uidesign.layout", v); } catch { /* 이번 세션만 */ } };

  const openLocal = (file: File | undefined) => {
    if (!file) return;
    if (/\.figcraft$/i.test(file.name)) { showToast(".figcraft 파일 열기는 준비 중이에요."); return; }
    if (!file.type.startsWith("image/")) { showToast("이미지나 .svg 파일만 열 수 있어요.", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const img = new Image();
      img.onload = () => onOpenImage(file.name.replace(/\.[^.]+$/, ""), url, img.naturalWidth || 800, img.naturalHeight || 600);
      img.onerror = () => showToast("이미지를 불러오지 못했어요.", "error");
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const sectionTitle = { fontSize: editorType.large, fontWeight: 700, color: "#111827" } as const;
  const action = "flex items-center gap-3 rounded-xl pl-3 pr-4 h-12 text-left bg-white hover:bg-[#f8fafc] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";

  return (
    <div className="flex-1 min-w-0 min-h-0 flex bg-white" style={f}>
      <aside className="w-[200px] shrink-0 flex flex-col gap-0.5 px-3 py-4" style={{ borderRight: "1px solid #eef0f3" }} aria-label="UI 디자인 홈 메뉴">
        <div className="flex items-center gap-2 px-2 pb-4">
          <img src={artUiDesign} alt="" className="size-6 object-contain" />
          <span style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>딸깍 UI 디자인</span>
        </div>
        <label className="flex items-center gap-2 rounded-lg px-3 h-8 mb-3 border border-transparent focus-within:border-[#cbd5e1]" style={{ background: "#f3f4f6" }}>
          <Search size={13} color="#9ca3af" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="파일 및 템플릿 검색" className="flex-1 min-w-0 bg-transparent outline-none" style={{ fontSize: editorType.label }} />
        </label>
        {([["recent", "최근 항목", Home, files.length], ["templates", "템플릿", LayoutGrid, TEMPLATES.length]] as const).map(([k, l, Icon, n]) => (
          <button key={k} type="button" aria-current={nav === k ? "page" : undefined} onClick={() => setNav(k)} className="flex items-center gap-2 rounded-lg px-3 h-10 text-left hover:bg-[#f8fafc]" style={{ background: nav === k ? "#f1f5f9" : undefined, fontSize: editorType.body, fontWeight: nav === k ? 700 : 500, color: "#111827" }}>
            <Icon size={14} color={nav === k ? "#111827" : "#64748b"} />{l}
            <span className="ml-auto" style={{ fontSize: editorType.caption, color: "#94a3b8", fontWeight: 500 }}>{n || ""}</span>
          </button>
        ))}
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto ui-scroll" style={{ padding: "28px 36px 56px" }}>
        {nav === "templates" ? (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", letterSpacing: "-0.4px" }}>템플릿</h1>
            <p style={{ fontSize: editorType.body, color: "#64748b", marginTop: 4 }}>누르면 그 내용으로 새 파일이 열려요.</p>
            <TemplateGrid items={templates} onPick={onTemplate} large />
          </>
        ) : (
          // 가운데 정렬(2026-11-19) — 폭을 묶고 왼쪽에 붙이면 넓은 화면에서 오른쪽만 비어 보였다(Canva·미리캔버스처럼 양옆 여백을 같게)
          <div className="flex flex-col gap-8 mx-auto" style={{ maxWidth: 1180 }}>
            <div className="flex flex-col gap-4">
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", letterSpacing: "-0.4px" }}>최근 항목</h1>
              {/* 한 줄 행동 — 주요 행동 하나만 초록 */}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onNewFile} className="flex items-center gap-2 rounded-xl px-4 h-12 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]" style={{ background: EDITOR_ACCENT, color: "#fff" }}>
                  <Plus size={16} strokeWidth={2.4} /><span style={{ fontSize: editorType.large, fontWeight: 700 }}>새 디자인 파일</span>
                </button>
                <button type="button" className={action} style={{ border: "1px solid #e5e7eb" }} onClick={() => showToast("보드(화이트보드)는 준비 중이에요.")}>
                  <span className="size-8 rounded-lg flex items-center justify-center" style={NEUTRAL_ICON}><StickyNote size={14} /></span>
                  <span style={{ fontSize: editorType.body, fontWeight: 600, color: "#111827" }}>새 보드</span>
                </button>
                <button type="button" className={action} style={{ border: "1px solid #e5e7eb" }} onClick={() => fileRef.current?.click()} title=".figcraft, .svg 또는 이미지 열기">
                  <span className="size-8 rounded-lg flex items-center justify-center" style={NEUTRAL_ICON}><FolderOpen size={14} /></span>
                  <span style={{ fontSize: editorType.body, fontWeight: 600, color: "#111827" }}>파일 열기</span>
                </button>
                {joinOpen ? (
                  <form className="flex items-center gap-2 rounded-xl pl-3 pr-2 h-12" style={{ border: "1px solid #e5e7eb" }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) showToast("참여 코드를 찾을 수 없어요. 코드나 초대 링크를 다시 확인해 주세요.", "error"); }}>
                    <Link2 size={14} color="#64748b" />
                    <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setJoinOpen(false); }} placeholder="코드 또는 초대 링크" className="w-[180px] bg-transparent outline-none" style={{ fontSize: editorType.body }} />
                    <button type="submit" disabled={!code.trim()} className="rounded-lg px-3 h-8 disabled:opacity-40" style={{ fontSize: editorType.label, fontWeight: 700, color: "#fff", background: "#111827" }}>참여</button>
                    <IconTooltip label="닫기"><button type="button" aria-label="닫기" onClick={() => setJoinOpen(false)} className="size-8 flex items-center justify-center rounded hover:bg-black/[0.05]"><X size={13} color="#64748b" /></button></IconTooltip>
                  </form>
                ) : (
                  <button type="button" className={action} style={{ border: "1px solid #e5e7eb" }} onClick={() => setJoinOpen(true)}>
                    <span className="size-8 rounded-lg flex items-center justify-center" style={NEUTRAL_ICON}><Link2 size={14} /></span>
                    <span style={{ fontSize: editorType.body, fontWeight: 600, color: "#111827" }}>코드로 참여</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*,.svg,.figcraft" className="sr-only" tabIndex={-1} onChange={(e) => { openLocal(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            </div>

            {/* 내 파일 — 이 화면의 주인공 */}
            <section aria-labelledby="mine-title">
              <div className="flex items-center gap-2">
                <h2 id="mine-title" style={sectionTitle}>내 파일 <span style={{ fontWeight: 500, color: "#94a3b8" }}>{files.length || ""}</span></h2>
                {files.length > 0 && (
                  <div className="ml-auto flex items-center gap-1">
                    <label className="relative flex items-center gap-1 rounded-md px-2 h-8 hover:bg-[#f8fafc] cursor-pointer" style={{ fontSize: editorType.label, color: "#475569" }}>
                      {sort === "updated" ? "최근 수정순" : "이름순"}<ChevronDown size={12} />
                      <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="absolute inset-0 opacity-0 cursor-pointer">
                        <option value="updated">최근 수정순</option><option value="name">이름순</option>
                      </select>
                    </label>
                    <div className="flex rounded-md p-0.5" style={{ background: "#f1f5f9" }} role="radiogroup" aria-label="보기">
                      {([["grid", LayoutGrid, "격자로 보기"], ["list", LayoutList, "목록으로 보기"]] as const).map(([k, Icon, l]) => (
                        <IconTooltip key={k} label={l}><button type="button" role="radio" aria-checked={layout === k} aria-label={l} onClick={() => setLayoutSaved(k)} className="size-6 flex items-center justify-center rounded" style={{ background: layout === k ? "#fff" : "transparent", boxShadow: layout === k ? "0px 1px 3px rgba(0,0,0,0.08)" : undefined }}>
                          <Icon size={13} color={layout === k ? "#111827" : "#94a3b8"} />
                        </button></IconTooltip>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {files.length === 0 ? (
                <EmptyMine guideHidden={guideHidden} onHideGuide={() => { setGuideHidden(true); try { localStorage.setItem(GUIDE_KEY, "1"); } catch { /* 이번 세션만 */ } }} onNewFile={onNewFile} />
              ) : mine.length === 0 ? (
                <p style={{ fontSize: editorType.body, color: "#94a3b8", marginTop: 16 }}>“{q}”에 맞는 파일이 없어요.</p>
              ) : layout === "grid" ? (
                <div className="grid gap-4 mt-3" style={{ gridTemplateColumns: GRID_COLS }}>
                  {mine.map((x) => <FileCard key={x.id} file={x} unread={unreadByFile[x.id] ?? 0} onOpen={() => onOpenFile(x.id)} onRename={(n) => onRename(x.id, n)} onDuplicate={() => onDuplicate(x.id)} onDelete={() => onDelete(x.id)} />)}
                  {/* 파일이 적을 때 빈칸 대신 "새로 시작" 자리(Figma·Canva) */}
                  {!query && mine.length < 4 && (
                    <button type="button" onClick={onNewFile} className="rounded-xl flex flex-col items-center justify-center gap-2 min-h-[220px] outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: "1.5px dashed #d8dee6", color: "#64748b" }}>
                      <span className="size-10 rounded-full flex items-center justify-center" style={{ background: "#f1f5f9" }}><Plus size={18} color="#475569" /></span>
                      <span style={{ fontSize: editorType.body, fontWeight: 600 }}>새 디자인 파일</span>
                    </button>
                  )}
                </div>
              ) : (
                <ul className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid #eef0f3" }}>
                  {mine.map((x) => <FileRow key={x.id} file={x} unread={unreadByFile[x.id] ?? 0} onOpen={() => onOpenFile(x.id)} onRename={(n) => onRename(x.id, n)} onDuplicate={() => onDuplicate(x.id)} onDelete={() => onDelete(x.id)} />)}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-center">
                <h2 style={sectionTitle}>템플릿으로 시작</h2>
                <button type="button" onClick={() => setNav("templates")} className="ml-auto rounded-md px-2 h-8 hover:bg-[#f8fafc]" style={{ fontSize: editorType.label, fontWeight: 600, color: "#475569" }}>모두 보기 ›</button>
              </div>
              <TemplateGrid items={templates} onPick={onTemplate} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyMine({ guideHidden, onHideGuide, onNewFile }: { guideHidden: boolean; onHideGuide: () => void; onNewFile: () => void }) {
  return (
    <div className="mt-3 rounded-2xl flex flex-col items-center text-center" style={{ border: "1.5px dashed #e2e8f0", padding: "36px 24px" }}>
      <img src={artUiDesign} alt="" className="size-14 object-contain" />
      <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 12 }}>아직 만든 파일이 없어요</p>
      <p style={{ fontSize: editorType.body, color: "#64748b", marginTop: 4, wordBreak: "keep-all" }}>
        위의 <button type="button" onClick={onNewFile} className="underline underline-offset-2" style={{ color: "#111827", fontWeight: 600 }}>새 디자인 파일</button>로 시작하거나, 오른쪽 딸깍 AI에 만들고 싶은 화면을 적어 보세요. 만든 파일은 여기에 모여요.
      </p>
      {!guideHidden && (
        <div className="relative w-full mt-7 rounded-xl text-left" style={{ background: "#f8fafc", padding: "16px 16px", maxWidth: 820 }}>
          <IconTooltip label="시작하기 안내 닫기"><button type="button" aria-label="시작하기 안내 닫기" onClick={onHideGuide} className="absolute top-2.5 right-2.5 size-6 flex items-center justify-center rounded hover:bg-black/[0.06]"><X size={13} color="#6b7280" /></button></IconTooltip>
          <p style={{ fontSize: editorType.label, fontWeight: 700, color: "#111827" }}>시작하기</p>
          <ol className="grid gap-4 mt-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {GUIDE.map(([t, k, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="size-5 shrink-0 rounded-full flex items-center justify-center bg-white" style={{ fontSize: editorType.meta, color: "#374151", border: "1px solid #e5e7eb" }}>{i + 1}</span>
                <span>
                  <span className="block" style={{ fontSize: editorType.label, fontWeight: 700, color: "#111827" }}>{t} {k && <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: editorType.caption }}>{k}</span>}</span>
                  <span className="block" style={{ fontSize: editorType.caption, lineHeight: "17px", color: "#64748b", marginTop: 2, wordBreak: "keep-all" }}>{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const frameCount = (d: Doc) => d.pages.reduce((s, p) => s + p.rootIds.filter((id) => d.nodes[id]?.type === "frame").length, 0);

function FileMenu({ name, onOpen, onRename, onDuplicate, onDelete, onClose }: { name: string; onOpen: () => void; onRename: () => void; onDuplicate: () => void; onDelete: () => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);
  const item = "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f8fafc]";
  return (
    <div ref={ref} className="absolute right-2 top-9 z-20 bg-white rounded-xl py-1 w-[200px]" style={{ ...f, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="menu" onClick={(e) => e.stopPropagation()}>
      {confirm ? (
        <div style={{ padding: "8px 12px" }}>
          <p style={{ fontSize: editorType.label, color: "#111827", fontWeight: 600, wordBreak: "keep-all" }}>“{name}”을(를) 삭제할까요?</p>
          <p style={{ fontSize: editorType.caption, color: "#64748b", marginTop: 2 }}>코멘트도 함께 지워지고 되돌릴 수 없어요.</p>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={onDelete} className="rounded-md px-3 h-8" style={{ fontSize: editorType.caption, fontWeight: 700, color: "#fff", background: "#ef4444" }}>삭제</button>
            <button type="button" onClick={() => setConfirm(false)} className="rounded-md px-3 h-8 border border-[#e5e7eb]" style={{ fontSize: editorType.caption, fontWeight: 600, color: "#334155" }}>취소</button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" role="menuitem" className={item} onClick={() => { onClose(); onOpen(); }}><FolderOpen size={13} color="#475569" /><span style={{ fontSize: editorType.body }}>열기</span></button>
          <button type="button" role="menuitem" className={item} onClick={() => { onClose(); onRename(); }}><Pencil size={13} color="#475569" /><span style={{ fontSize: editorType.body }}>이름 바꾸기</span></button>
          <button type="button" role="menuitem" className={item} onClick={() => { onClose(); onDuplicate(); }}><Copy size={13} color="#475569" /><span style={{ fontSize: editorType.body }}>복제</span></button>
          <div className="h-px my-1" style={{ background: "#f1f5f9" }} />
          <button type="button" role="menuitem" className={item} onClick={() => setConfirm(true)}><Trash2 size={13} color="#ef4444" /><span style={{ fontSize: editorType.body, color: "#ef4444" }}>삭제</span></button>
        </>
      )}
    </div>
  );
}

type FileItemProps = { file: DFile; unread: number; onOpen: () => void; onRename: (n: string) => void; onDuplicate: () => void; onDelete: () => void };

function NameField({ value, onDone }: { value: string; onDone: (v: string | null) => void }) {
  return (
    <input
      autoFocus defaultValue={value} onClick={(e) => e.stopPropagation()}
      onBlur={(e) => onDone(e.target.value.trim() || null)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") onDone(null); }}
      className="w-full outline-none rounded px-1 -mx-1" style={{ ...f, fontSize: editorType.large, fontWeight: 700, color: "#111827", boxShadow: "inset 0 0 0 1px #4f7bff" }}
    />
  );
}

function Meta({ file, unread }: { file: DFile; unread: number }) {
  const n = frameCount(file.doc);
  return (
    <span className="flex items-center gap-2 flex-wrap" style={{ fontSize: editorType.caption, color: "#64748b" }}>
      {relTime(file.updatedAt)} 수정 · 프레임 {n}개
      {unread > 0 && <span className="inline-flex items-center gap-0.5 rounded-full px-2" style={{ background: color.surface.accent, color: color.brand, fontWeight: 700, fontSize: editorType.meta }}><MessageCircle size={10} />{unread}</span>}
    </span>
  );
}

function FileCard({ file, unread, onOpen, onRename, onDuplicate, onDelete }: FileItemProps) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  return (
    <div className="group relative rounded-xl bg-white transition-shadow hover:shadow-[0px_4px_16px_rgba(0,0,0,0.08)]" style={{ border: "1px solid #e5e7eb" }}>
      <button type="button" onClick={onOpen} onDoubleClick={onOpen} className="block w-full text-left rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" aria-label={`${file.name} 열기`}>
        <span className="block rounded-t-xl overflow-hidden"><DocThumb doc={file.doc} height={150} /></span>
      </button>
      <div className="flex items-start gap-2" style={{ padding: "12px 12px 12px 12px" }}>
        <div className="min-w-0 flex-1">
          {renaming ? <NameField value={file.name} onDone={(v) => { if (v) onRename(v); setRenaming(false); }} /> : (
            <p className="truncate" style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }} onDoubleClick={() => setRenaming(true)} title="더블클릭해서 이름 바꾸기">{file.name}</p>
          )}
          <div className="mt-0.5"><Meta file={file} unread={unread} /></div>
        </div>
        <IconTooltip label="더 보기: 열기 · 이름 바꾸기 · 복제 · 삭제"><button type="button" aria-label={`${file.name} 메뉴`} aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="size-8 shrink-0 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ opacity: menu ? 1 : undefined }}>
          <MoreHorizontal size={15} color="#475569" />
        </button></IconTooltip>
      </div>
      {file.open && <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full px-2 h-5 bg-white" style={{ fontSize: editorType.caption, fontWeight: 700, color: EDITOR_ACCENT, boxShadow: "0px 1px 3px rgba(0,0,0,0.1)" }}><span className="size-1.5 rounded-full" style={{ background: EDITOR_ACCENT }} />열려 있음</span>}
      {menu && <FileMenu name={file.name} onOpen={onOpen} onRename={() => setRenaming(true)} onDuplicate={onDuplicate} onDelete={onDelete} onClose={() => setMenu(false)} />}
    </div>
  );
}

function FileRow({ file, unread, onOpen, onRename, onDuplicate, onDelete }: FileItemProps) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  return (
    <li className="group relative flex items-center gap-3 px-3 py-2 hover:bg-[#f8fafc]" style={{ borderBottom: "1px solid #f1f5f9" }}>
      <button type="button" onClick={onOpen} className="shrink-0 w-[72px] rounded-md overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" aria-label={`${file.name} 열기`} style={{ border: "1px solid #eef0f3" }}>
        <DocThumb doc={file.doc} height={46} pad={4} />
      </button>
      <div className="min-w-0 flex-1 cursor-default" onDoubleClick={onOpen}>
        {renaming ? <NameField value={file.name} onDone={(v) => { if (v) onRename(v); setRenaming(false); }} /> : <p className="truncate" style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>{file.name}</p>}
        <Meta file={file} unread={unread} />
      </div>
      {file.open && <span style={{ fontSize: editorType.caption, fontWeight: 700, color: EDITOR_ACCENT }}>열려 있음</span>}
      <IconTooltip label="더 보기: 열기 · 이름 바꾸기 · 복제 · 삭제"><button type="button" aria-label={`${file.name} 메뉴`} aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="size-8 shrink-0 flex items-center justify-center rounded-md hover:bg-black/[0.05]"><MoreHorizontal size={15} color="#475569" /></button></IconTooltip>
      {menu && <FileMenu name={file.name} onOpen={onOpen} onRename={() => setRenaming(true)} onDuplicate={onDuplicate} onDelete={onDelete} onClose={() => setMenu(false)} />}
    </li>
  );
}

function TemplateGrid({ items, onPick, large }: { items: readonly (typeof TEMPLATES)[number][]; onPick: (id: string) => void; large?: boolean }) {
  if (!items.length) return <p style={{ fontSize: editorType.label, color: "#9ca3af", marginTop: 8 }}>검색 결과가 없어요.</p>;
  return (
    <div className="grid gap-4 mt-3" style={{ gridTemplateColumns: GRID_COLS }}>
      {items.map((t) => (
        <button key={t.id} type="button" onClick={() => onPick(t.id)} className="text-left rounded-xl overflow-hidden bg-white hover:shadow-[0px_4px_16px_rgba(0,0,0,0.08)] transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: "1px solid #eef0f3" }}>
          <TemplateThumb build={t.build} height={large ? 140 : 96} />
          <span className="block" style={{ padding: large ? "10px 12px 12px" : "8px 10px 10px" }}>
            <span className="block" style={{ fontSize: editorType.body, fontWeight: 700, color: "#111827" }}>{t.name}</span>
            {large && <span className="block line-clamp-2" style={{ fontSize: editorType.caption, lineHeight: "17px", color: "#64748b", marginTop: 2 }}>{t.desc}</span>}
            <span className="block" style={{ fontSize: editorType.meta, color: "#94a3b8", marginTop: 4 }}>{t.meta}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function TemplateThumb({ build, height }: { build: () => { steps: Parameters<typeof docFromSteps>[0] }; height: number }) {
  const doc: Doc = useMemo(() => docFromSteps(build().steps), [build]);
  return <DocThumb doc={doc} height={height} />;
}

/** 문서 첫 페이지를 축소해 그린 썸네일 — 내 파일·템플릿 공용. 비어 있으면 빈 캔버스 표시 */
export function DocThumb({ doc, height, pad = 12 }: { doc: Doc; height: number; pad?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(240);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 240));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const page = doc.pages[0];
  const roots = page.rootIds.map((id) => doc.nodes[id]).filter(Boolean);
  return (
    <span ref={ref} className="block relative overflow-hidden pointer-events-none" style={{ height, background: page.bg === "#F5F5F5" ? "#f3f4f6" : page.bg }} aria-hidden>
      {roots.length === 0 ? (
        <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: editorType.caption, color: "#94a3b8" }}>빈 캔버스</span>
      ) : (() => {
        const minX = Math.min(...roots.map((n) => n.x)), minY = Math.min(...roots.map((n) => n.y));
        const bw = Math.max(...roots.map((n) => n.x + n.w)) - minX, bh = Math.max(...roots.map((n) => n.y + n.h)) - minY;
        const scale = Math.min((w - pad * 2) / bw, (height - pad * 2) / bh);
        return (
          <span className="absolute" style={{ left: (w - bw * scale) / 2, top: (height - bh * scale) / 2, width: bw, height: bh, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <span className="absolute" style={{ left: -minX, top: -minY }}>
              {roots.map((n) => <NodeView key={n.id} doc={doc} id={n.id} editingTextId={null} onCommitText={() => {}} />)}
            </span>
          </span>
        );
      })()}
    </span>
  );
}
