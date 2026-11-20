import { useEffect, useRef, useState } from "react";
import { ChevronDown, Link2 } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import { ProfileAvatar } from "@/app/components/mypage/ProfileAvatar";
import { useProfile } from "@/app/state/profile";
import { f, editorType } from "@/app/styleTokens";


/**
 * 공유 팝오버(에디터 공통) — 지금 함께 보는 중 · 이메일 초대 + 권한 · 참여자 · 링크 복사. 서버 없음: 초대는 목록에만 추가된다.
 * "지금 함께 보는 중"(실시간 접속 표시)은 뺐다(2026-11-19 사용자 "실시간 표시는 없어도 될 듯"): 서버 없이 나 혼자만 보여 의미가 없었다.
 */
export function SharePopover({ fileName, accent, onClose }: { fileName: string; accent: string; onClose: () => void }) {
  const profile = useProfile();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"편집 가능" | "보기 가능" | "코멘트 가능">("편집 가능");
  const [invited, setInvited] = useState<{ email: string; role: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <div ref={ref} className="absolute right-0 top-10 bg-white rounded-xl z-50" style={{ ...f, width: 340, padding: 16, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="dialog" aria-label="공유">
      <p style={{ fontSize: editorType.large, fontWeight: 700, color: "#111827" }}>“{fileName}” 공유</p>
      <div className="flex gap-2 mt-3">
        {/* 2026-11-20 정리: 안쪽 select에 전역 포커스 상자가 따로 떠서 각진 박스가 생기고, 기본 화살표가 칸에서 어긋났다 →
            select도 field-inline(바깥 둥근 칸만 파랗게), 기본 화살표를 숨기고 lucide ChevronDown, 앞에 세로 구분선. 높이는 공통 40px */}
        <div className="field-pill flex-1 min-w-0 flex items-center rounded-lg border border-[#e5e7eb] h-10 overflow-hidden">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="이메일로 초대" aria-label="초대할 이메일" className="field-inline flex-1 min-w-0 px-3 h-full outline-none bg-transparent text-ellipsis placeholder:text-[#64748b]" style={{ fontSize: editorType.body, color: "#111827" }} />
          <span aria-hidden className="w-px h-5 shrink-0" style={{ background: "#e5e7eb" }} />
          <label className="relative shrink-0 h-full flex items-center">
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="field-inline h-full pl-2.5 pr-7 bg-transparent outline-none appearance-none cursor-pointer" style={{ fontSize: editorType.label, color: "#334155" }} aria-label="권한">
              <option>편집 가능</option><option>코멘트 가능</option><option>보기 가능</option>
            </select>
            <ChevronDown size={14} color="#64748b" className="absolute right-2 pointer-events-none" />
          </label>
        </div>
        <button
          type="button" disabled={!valid}
          onClick={() => { setInvited((l) => [...l, { email: email.trim(), role }]); setEmail(""); showToast("초대를 보냈어요. 예시라서 실제 메일은 가지 않아요."); }}
          className="rounded-lg px-4 h-10 shrink-0" style={{ fontSize: editorType.body, fontWeight: 600, color: "#fff", background: valid ? accent : "#cbd5e1" }}
        >
          초대
        </button>
      </div>
      <p style={{ fontSize: editorType.caption, fontWeight: 600, color: "#64748b", marginTop: 16 }}>참여자</p>
      <ul className="mt-2 flex flex-col gap-2">
        <li className="flex items-center gap-2">
          <ProfileAvatar profile={profile} size={26} />
          <span style={{ fontSize: editorType.body, color: "#111827" }}>{profile.name} (나)</span>
          <span className="ml-auto" style={{ fontSize: editorType.caption, color: "#64748b" }}>소유자</span>
        </li>
        {invited.map((m) => (
          <li key={m.email} className="flex items-center gap-2">
            <span className="size-[26px] rounded-full bg-[#f1f5f9] flex items-center justify-center" style={{ fontSize: editorType.meta, color: "#475569" }}>{m.email[0].toUpperCase()}</span>
            <span className="truncate" style={{ fontSize: editorType.body, color: "#111827" }}>{m.email}</span>
            <span className="ml-auto shrink-0" style={{ fontSize: editorType.caption, color: "#64748b" }}>{m.role} · 대기 중</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: editorType.caption, color: "#64748b" }}>링크가 있는 사람: 초대받은 사람만</span>
        <button
          type="button"
          onClick={() => { void navigator.clipboard?.writeText(window.location.href).catch(() => {}); showToast("링크를 복사했어요."); }}
          className="ml-auto flex items-center gap-1 rounded-lg px-3 h-8 border border-[#e5e7eb] hover:bg-[#f8fafc]"
          style={{ fontSize: editorType.label, fontWeight: 600, color: "#111827" }}
        >
          <Link2 size={13} />링크 복사
        </button>
      </div>
    </div>
  );
}
