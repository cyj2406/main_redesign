import { useState } from "react";
import { Plus, Users } from "lucide-react";

import { Badge } from "@/app/components/common/Badge";
import { Button } from "@/app/components/common/Button";
import { showToast } from "@/app/components/common/Toast";
import { color, f } from "@/app/styleTokens";
import { SettingsCard, SettingsField, SettingsSectionHead } from "./SettingsKit";

/**
 * 설정 › 조직·사내 공유(2026-11-27). 내용은 딸깍 데스크톱 설정 그대로:
 *   내 조직(연결) · 새 조직 만들기 · 초대 코드로 들어가기.
 * 읽기 쉽게: 내 조직은 목록 카드(이름 · 내 역할 · 지금 연결된 조직 표시), 만들기와 초대 코드는 "조직 추가" 카드 하나에 두 줄로.
 * 서버가 없어 목록은 이 브라우저(localStorage)에만 남는다.
 */
interface Org { id: string; name: string; role: "관리자" | "구성원" }
interface OrgState { orgs: Org[]; activeId: string | null }

const KEY = "ddalkkak.orgs.v1";
const DEFAULT: OrgState = { orgs: [{ id: "o1", name: "포브로", role: "관리자" }], activeId: null };

function load(): OrgState {
  try { const raw = window.localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* 기본값 */ }
  return DEFAULT;
}

/** 초대 코드는 영문·숫자 15자리. 사이에 띄어 쓰거나 구분 기호를 넣어도 받는다 */
const normalizeCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function OrgSettings() {
  const [state, setState] = useState<OrgState>(load);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const save = (next: OrgState) => {
    setState(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 이번 세션만 */ }
  };

  const create = () => {
    const n = name.trim();
    if (!n) return;
    const org: Org = { id: `o${Date.now()}`, name: n, role: "관리자" };
    save({ orgs: [...state.orgs, org], activeId: state.activeId ?? org.id });
    setName("");
    showToast(`${n} 조직을 만들었어요. 초대 코드는 조직 관리에서 볼 수 있어요.`);
  };

  const join = () => {
    const c = normalizeCode(code);
    if (c.length !== 15) { setCodeError("초대 코드는 영문과 숫자 15자리예요."); return; }
    const org: Org = { id: `o${Date.now()}`, name: "초대받은 조직", role: "구성원" };
    save({ orgs: [...state.orgs, org], activeId: state.activeId ?? org.id });
    setCode("");
    showToast("조직에 들어갔어요. 예시라서 실제 조직은 아니에요.");
  };

  return (
    <div className="flex flex-col gap-9" style={f}>
      <section className="flex flex-col gap-3.5">
        <SettingsSectionHead title="조직·사내 공유" desc="같은 조직의 구성원과 회사 정보, 사내 자료, 결과물을 함께 써요." />
        <p style={{ fontSize: 13, fontWeight: 600, color: color.text.secondary, marginTop: 6 }}>내 조직</p>
        <SettingsCard className="overflow-hidden">
          {state.orgs.length === 0 && (
            <p className="px-4 py-6 text-center" style={{ fontSize: 13.5, color: color.text.secondary }}>아직 속한 조직이 없어요. 아래에서 만들거나 초대 코드로 들어가 보세요.</p>
          )}
          {state.orgs.map((o, i) => {
            const active = state.activeId === o.id;
            return (
              <div key={o.id} className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: i ? `1px solid ${color.surface.hover}` : undefined }}>
                <span className="size-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: color.surface.accent, color: color.brand, fontSize: 15, fontWeight: 700 }}>
                  {o.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate" style={{ fontSize: 15, fontWeight: 700, color: color.text.primary, letterSpacing: "-0.3px" }}>{o.name}</span>
                    {active && <Badge tone="brand">연결됨</Badge>}
                  </div>
                  <p style={{ fontSize: 13, color: color.text.secondary, marginTop: 2 }}>내 역할: {o.role}</p>
                </div>
                {active ? (
                  <Button variant="secondary" size="md" onClick={() => { save({ ...state, activeId: null }); showToast(`${o.name} 연결을 끊었어요.`); }}>연결 끊기</Button>
                ) : (
                  <Button variant="dark" size="md" onClick={() => { save({ ...state, activeId: o.id }); showToast(`${o.name}에 연결했어요. 회사 정보와 사내 자료를 함께 써요.`); }}>연결</Button>
                )}
              </div>
            );
          })}
        </SettingsCard>
      </section>

      <section className="flex flex-col gap-3.5">
        <SettingsSectionHead title="조직 추가" desc="새 조직을 만들거나, 받은 초대 코드로 기존 조직에 들어가요." />
        <SettingsCard className="flex flex-col">
          <form className="p-4 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
            <p className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700, color: color.text.primary }}><Plus size={16} strokeWidth={2} />새 조직 만들기</p>
            <div className="flex items-end gap-2">
              <SettingsField label="조직 이름" className="flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 딸깍주식회사" onKeyDown={(e) => e.stopPropagation()} />
              <Button variant="dark" size="md" type="submit" disabled={!name.trim()}>만들기</Button>
            </div>
          </form>
          <form className="p-4 flex flex-col gap-2" style={{ borderTop: `1px solid ${color.surface.hover}` }} onSubmit={(e) => { e.preventDefault(); join(); }}>
            <p className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700, color: color.text.primary }}><Users size={16} strokeWidth={2} />초대 코드로 들어가기</p>
            <div className="flex items-end gap-2">
              <SettingsField
                label="초대 코드" className="flex-1" value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(null); }}
                placeholder="받은 초대 코드 15자리" aria-invalid={!!codeError} autoComplete="off" spellCheck={false}
                style={code ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.5px" } : undefined}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <Button variant="secondary" size="md" type="submit" disabled={!code.trim()}>들어가기</Button>
            </div>
            {codeError && <p role="alert" style={{ fontSize: 12.5, color: "#dc2626" }}>{codeError}</p>}
          </form>
        </SettingsCard>
      </section>
    </div>
  );
}
