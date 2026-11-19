import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Search } from "lucide-react";

import { f, editorType } from "@/app/styleTokens";

/**
 * 메인 메뉴(2026-11-19) — dev 캡처 기준, Figma 메인 메뉴 참고. 기획: docs/ui-design-editor.md "1-4. 메인 메뉴".
 * 맨 위 "액션…" 검색(⌘K): 모든 하위 항목을 이름으로 찾아 바로 실행(↑↓ Enter). 아래는 분류 — 올리면 오른쪽에 하위 메뉴.
 * 아직 안 되는 항목은 흐리게 "준비 중".
 */

export interface MenuItem { label: string; shortcut?: string; run?: () => void; disabled?: boolean; checked?: boolean; soon?: boolean }
export interface MenuGroup { label: string; items: MenuItem[] }

const BG = "#1e1e1e";
const HOVER = "#2f2f2f";
const TEXT = "#f3f4f6";
const DIM = "#8b8f97";

export function MainMenu({ groups, onClose, focusSearch }: { groups: MenuGroup[]; onClose: () => void; focusSearch?: boolean }) {
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (focusSearch) inputRef.current?.focus(); }, [focusSearch]);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key, true); };
  }, [onClose]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => !query ? [] : groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })))
    .filter((it) => it.label.toLowerCase().includes(query) || it.group.toLowerCase().includes(query)), [groups, query]);
  useEffect(() => setCursor(0), [query]);

  const exec = (it: MenuItem) => { if (it.disabled || it.soon || !it.run) return; onClose(); it.run(); };

  return (
    <div ref={ref} className="absolute z-50 rounded-xl py-2" style={{ ...f, left: 4, top: 40, width: 248, background: BG, boxShadow: "0px 12px 40px rgba(0,0,0,0.35)" }} role="menu" aria-label="메인 메뉴">
      <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg px-3 h-10" style={{ background: "#2a2a2a" }}>
        <Search size={14} color={DIM} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
            if (e.key === "Enter" && results[cursor]) { e.preventDefault(); exec(results[cursor]); }
            if (e.key === "Escape") onClose();
          }}
          placeholder="액션…"
          aria-label="액션 검색"
          className="flex-1 min-w-0 bg-transparent outline-none"
          style={{ fontSize: editorType.body, color: TEXT }}
        />
        <span style={{ fontSize: editorType.caption, color: DIM }}>⌘K</span>
      </div>

      {query ? (
        results.length === 0 ? (
          <p style={{ fontSize: editorType.label, color: DIM, padding: "12px 16px" }}>“{q}”에 맞는 액션이 없어요.</p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto ui-scroll">
            {results.map((it, i) => (
              <button
                key={`${it.group}-${it.label}`} type="button" role="menuitem"
                onMouseEnter={() => setCursor(i)} onClick={() => exec(it)}
                className="w-full flex items-center gap-2 px-4 h-8 text-left"
                style={{ background: i === cursor ? HOVER : "transparent", opacity: it.disabled || it.soon ? 0.45 : 1, cursor: it.disabled || it.soon ? "default" : "pointer" }}
              >
                <span style={{ fontSize: editorType.caption, color: DIM }}>{it.group}</span>
                <ChevronRight size={11} color={DIM} />
                <span className="truncate flex-1" style={{ fontSize: editorType.body, color: TEXT }}>{it.label}</span>
                <span style={{ fontSize: editorType.caption, color: DIM }}>{it.soon ? "준비 중" : it.shortcut}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        groups.map((g, i) => (
          <div key={g.label} className="relative" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover((h) => (h === i ? null : h))}>
            <button
              type="button" role="menuitem" aria-haspopup="menu" aria-expanded={hover === i}
              onClick={() => setHover(i)} onFocus={() => setHover(i)}
              className="w-full flex items-center px-4 h-10 text-left outline-none"
              style={{ background: hover === i ? HOVER : "transparent", fontSize: editorType.large, color: TEXT, fontWeight: 500 }}
            >
              <span className="flex-1 pl-5">{g.label}</span>
              <ChevronRight size={13} color={DIM} />
            </button>
            {hover === i && (
              <div className="absolute top-0 rounded-xl py-2" style={{ left: "calc(100% + 4px)", width: 236, background: BG, boxShadow: "0px 12px 40px rgba(0,0,0,0.35)" }} role="menu" aria-label={g.label}>
                {g.items.map((it) => (
                  <button
                    key={it.label} type="button" role="menuitem" disabled={it.disabled || it.soon}
                    onClick={() => exec(it)}
                    className="w-full flex items-center gap-2 px-3 h-8 text-left hover:bg-[#2f2f2f] disabled:hover:bg-transparent outline-none focus-visible:bg-[#2f2f2f]"
                    style={{ opacity: it.disabled || it.soon ? 0.45 : 1 }}
                  >
                    <span className="w-4 shrink-0">{it.checked && <Check size={13} color={TEXT} />}</span>
                    <span className="truncate flex-1" style={{ fontSize: editorType.body, color: TEXT }}>{it.label}</span>
                    <span style={{ fontSize: editorType.caption, color: DIM }}>{it.soon ? "준비 중" : it.shortcut}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
