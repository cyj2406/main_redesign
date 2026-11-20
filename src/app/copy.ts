/**
 * 화면 여러 곳에서 같이 쓰는 문구.
 *
 * 같은 문장을 화면마다 따로 적어두면 한쪽만 고쳐져 태블릿·웹 문구가 갈라진다.
 * 공용으로 노출되는 카피는 여기 한 곳에서만 관리한다.
 */

/** 프롬프트 입력창(컴포저) 안내 문구 — 홈·서비스 화면·워크스페이스 공통. */
export const COMPOSER_PLACEHOLDER = "이곳에 원하는 작업을 자유롭게 적어보세요";

/**
 * 조사 붙이기(2026-11-20) — 화면에 "을(를)"처럼 괄호 조사를 보이지 않게 앞말 받침에 맞춰 고른다(토스 문구 방식).
 * josa("이름", "을/를") → "이름을", josa("ChatGPT", "을/를") → "ChatGPT를", josa("파일", "으로/로") → "파일로".
 * 영어·숫자로 끝나면 읽는 소리로 판단한다(l·m·n·r, 0·1·3·6·7·8 은 받침 있음).
 */
type JosaPair = "을/를" | "이/가" | "은/는" | "과/와" | "으로/로" | "이에요/예요";
export function josa(word: string, pair: JosaPair): string {
  const [withBatchim, without] = pair.split("/");
  const last = word.trim().replace(/["'”’)\]]+$/, "").slice(-1);
  let batchim = false, rieul = false;
  const code = last.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) { const jong = code % 28; batchim = jong !== 0; rieul = jong === 8; }
  else if (/[0-9]/.test(last)) { batchim = "013678".includes(last); rieul = "178".includes(last); }
  else if (/[a-z]/i.test(last)) { batchim = /[lmnr]/i.test(last); rieul = /[lr]/i.test(last); }
  const useFirst = pair === "으로/로" ? batchim && !rieul : batchim;
  return word + (useFirst ? withBatchim : without);
}
