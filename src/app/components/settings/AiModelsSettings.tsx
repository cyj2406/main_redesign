import { useState } from "react";
import { Check, ExternalLink, KeyRound } from "lucide-react";

import { Button } from "@/app/components/common/Button";
import { showToast } from "@/app/components/common/Toast";
import {
  PROVIDERS, TIERS, connectProvider, disconnectProvider, ownModels, setDefaultModel, toggleVisible, useAiModels,
  type ModelId, type ProviderId,
} from "@/app/state/aiModels";
import { color, f, radius } from "@/app/styleTokens";

/**
 * 설정 › AI 모델(2026-11-19). 기획: docs/ai-models.md.
 *   ① 기본 AI: 새 대화를 시작할 때 쓸 모델(딸깍 AI 높음·보통·낮음 + 연결한 내 AI)
 *   ② 내 AI 연결: 공급자 카드마다 API 키 → 연결 → 입력창에 보일 모델 체크(Cursor 설정 › Models, Copilot "Manage Models" 참고)
 * 입력창의 모델 칩에서 "AI 연결 관리 ›"를 누르면 여기로 온다.
 */
function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <p style={{ ...f, fontWeight: 700, fontSize: 16, color: color.text.primary, letterSpacing: "-0.4px" }}>{title}</p>
      {desc && <p style={{ ...f, fontWeight: 400, fontSize: 13, color: color.text.muted, letterSpacing: "-0.2px", lineHeight: 1.6, marginTop: 6 }}>{desc}</p>}
    </div>
  );
}

const card = { border: `1px solid ${color.border.default}`, borderRadius: radius.card, background: "#fff" } as const;

export function AiModelsSettings() {
  const s = useAiModels();
  const options: { id: ModelId; label: string; sub: string; own?: boolean }[] = [
    ...TIERS.map((t) => ({ id: `ddalkkak:${t.id}`, label: `딸깍 AI ${t.label}`, sub: `${t.desc} · ${t.note}` })),
    ...ownModels(s).map((m) => ({ id: m.id, label: m.label, sub: `${m.provider} · 내 키, 크레딧 안 씀`, own: true })),
  ];
  return (
    <div className="flex flex-col gap-7" style={f}>
      <div className="flex flex-col gap-3">
        <SectionHead title="기본 AI" desc="새 대화를 시작할 때 쓸 AI예요. 대화 중에는 딸깍 AI 입력창의 모델 버튼으로 바꿀 수 있어요." />
        <div role="radiogroup" aria-label="기본 AI" className="flex flex-col" style={card}>
          {options.map((o, i) => {
            const on = s.defaultModel === o.id;
            return (
              <button
                key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setDefaultModel(o.id)}
                className="flex items-center gap-3 text-left px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f7bff] hover:bg-[#f8fafc]"
                style={{ borderTop: i ? `1px solid ${color.surface.hover}` : undefined }}
              >
                <span className="size-4 rounded-full shrink-0 flex items-center justify-center" style={{ border: `1.5px solid ${on ? color.brand : "#cbd5e1"}` }}>{on && <span className="size-2 rounded-full" style={{ background: color.brand }} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block" style={{ fontSize: 14, fontWeight: 600, color: color.text.primary }}>{o.label}</span>
                  <span className="block" style={{ fontSize: 12.5, color: color.text.secondary }}>{o.sub}</span>
                </span>
                {o.own && <span className="rounded px-1.5 py-0.5 shrink-0" style={{ fontSize: 11, fontWeight: 700, color: "#047857", background: "#ecfdf5" }}>내 키</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHead title="내 AI 연결" desc="쓰고 있는 Claude·ChatGPT·Gemini를 API 키로 연결하면 그 모델로 시킬 수 있어요. 연결한 AI는 딸깍 크레딧을 쓰지 않고, 사용료는 그 서비스에서 청구돼요." />
        {PROVIDERS.map((p) => <ProviderCard key={p.id} pid={p.id} />)}
        <p style={{ fontSize: 12, color: color.text.muted, lineHeight: 1.6 }}>
          키는 끝 4자리만 보여요. 모델 목록은 지금 예시예요. 실제로는 연결한 키로 쓸 수 있는 모델을 불러와요.
        </p>
      </div>
    </div>
  );
}

function ProviderCard({ pid }: { pid: ProviderId }) {
  const s = useAiModels();
  const p = PROVIDERS.find((x) => x.id === pid)!;
  const c = s.connections[pid];
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const connect = () => {
    const err = connectProvider(pid, key);
    if (err) { setError(err); return; }
    setKey(""); setError(null); setEditing(false);
    showToast(`${p.product}를 연결했어요. 딸깍 AI 입력창에서 고를 수 있어요.`, "success");
  };
  return (
    <div className="p-4" style={card}>
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#f1f5f9", fontSize: 13, fontWeight: 800, color: "#334155" }}>{p.product.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: 14, fontWeight: 700, color: color.text.primary }}>{p.product} <span style={{ fontWeight: 500, color: color.text.muted, fontSize: 12.5 }}>{p.name}</span></p>
          <p style={{ fontSize: 12.5, color: c ? "#047857" : color.text.secondary }}>
            {c ? <span className="inline-flex items-center gap-1"><Check size={13} />연결됨 · 키 …{c.last4}</span> : "연결 안 됨"}
          </p>
        </div>
        {c && !editing ? (
          <div className="flex gap-1.5 shrink-0">
            <Button variant="secondary" size="md" onClick={() => setEditing(true)}>키 바꾸기</Button>
            <Button variant="secondary" size="md" onClick={() => { disconnectProvider(pid); showToast(`${p.product} 연결을 해제했어요.`); }} style={{ color: "#dc2626" }}>해제</Button>
          </div>
        ) : !editing && (
          <Button variant="secondary" size="md" onClick={() => setEditing(true)}><KeyRound size={15} strokeWidth={1.8} />연결하기</Button>
        )}
      </div>

      {editing && (
        <form className="mt-3.5" onSubmit={(e) => { e.preventDefault(); connect(); }}>
          <label htmlFor={`key-${pid}`} style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>{p.product} API 키</label>
          <div className="flex gap-2 mt-1.5">
            <input
              id={`key-${pid}`} type="password" autoComplete="off" autoFocus value={key}
              onChange={(e) => { setKey(e.target.value); if (error) setError(null); }}
              placeholder={`${p.keyPrefix}… (${p.keyHint})`}
              aria-invalid={!!error}
              className="flex-1 min-w-0 h-11 px-3.5 rounded-xl outline-none"
              style={{ ...f, fontSize: 13.5, border: `1px solid ${error ? "#ef4444" : color.border.default}` }}
            />
            <Button variant="primary" size="md" type="submit">연결</Button>
            <Button variant="secondary" size="md" type="button" onClick={() => { setEditing(false); setKey(""); setError(null); }}>취소</Button>
          </div>
          <p style={{ fontSize: 12, marginTop: 6, color: error ? "#ef4444" : color.text.muted }}>
            {error ?? <>키는 {p.name} 콘솔에서 만들 수 있어요. <a href={p.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline" style={{ color: color.brand }}>키 만들기<ExternalLink size={11} /></a></>}
          </p>
        </form>
      )}

      {c && !editing && (
        <div className="mt-3.5 pt-3" style={{ borderTop: `1px solid ${color.surface.hover}` }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>입력창에 보일 모델</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {p.models.map((m) => {
              const on = c.visible.includes(m);
              return (
                <button key={m} type="button" aria-pressed={on} onClick={() => toggleVisible(pid, m)} className="h-8 px-3 rounded-full inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
                  style={{ fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? color.brand : "#475569", background: on ? color.surface.accent : "#fff", boxShadow: on ? `inset 0 0 0 1px ${color.brand}` : "inset 0 0 0 1px #e2e8f0" }}>
                  {on && <Check size={13} />}{m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

