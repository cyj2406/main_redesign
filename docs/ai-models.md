# AI 모델 선택 기획 (2026-11-19)

딸깍 AI는 **딸깍 기본 AI(높음 · 보통 · 낮음)**를 쓰고, 원하면 **내 Claude · ChatGPT · Gemini를 연결**해 그 모델로 시킬 수 있다.
코드: `src/app/state/aiModels.ts`(상태) · `components/settings/AiModelsSettings.tsx`(설정 탭) · `editor-shell/AiAssistantPanel.tsx`(입력창 모델 선택).

## 1. 다른 서비스는 어떻게 하나

| 서비스 | 모델 고르는 곳 | 내 AI 연결 | 크레딧 |
|---|---|---|---|
| GitHub Copilot Chat | **채팅 입력창 아래 드롭다운**(지금 모델 이름). 대화 중에 바꾸면 다음 답부터 적용. 드롭다운 안 "Manage Models"로 목록에 보일 모델을 고른다. 기본은 Auto | — | — |
| Notion AI | 채팅에서 "Auto"를 눌러 모델 선택. 관리자가 켠 모델만 보인다 | **내 ChatGPT 계정 연결** → GPT 모델을 고르면 내 플랜을 쓴다 | Auto와 직접 고른 모델의 크레딧이 다르다 |
| Cursor | 채팅 입력창 모델 선택 | **설정 › Models**에서 공급자(OpenAI · Anthropic · Google…)를 고르고 **API 키 붙여넣기 → 저장**. 그 공급자 모델이 선택 목록에 생긴다. 키가 거부되면 그 공급자 요청은 실패 | 내 키는 공급자가 청구 |

공통점: ① **고르는 곳은 채팅 입력창**(지금 모델이 늘 보인다) ② **연결·관리는 설정** ③ 입력창 메뉴에서 설정으로 가는 길이 있다 ④ 모델마다 비용이 다르다는 걸 보여 준다.

출처: [Copilot: Change the chat model](https://docs.github.com/en/copilot/how-tos/use-ai-models/change-the-chat-model) · [Notion: Auto](https://www.notion.com/help/auto) · [Notion: Use your ChatGPT plan](https://www.notion.com/nb/help/use-your-chatgpt-plan-with-notion-agent) · [Cursor: API keys](https://cursor.com/help/models-and-usage/api-keys)

## 2. 결정

### 2-1. 고르는 곳은 두 군데 (질문: "채팅에서도 고르게 해야 하나?" → **네, 둘 다**)
- **설정 › AI 모델** = 기본값과 연결 관리. 새 대화는 이 기본 모델로 시작한다.
- **딸깍 AI 입력창의 모델 칩** = 이번 대화에서 바꾸기. 대화마다 기억하고, 새 대화는 다시 기본값.
- 이유: 매번 설정까지 가면 아무도 안 바꾸고, 입력창에만 두면 "늘 이걸로" 정할 곳이 없다. Copilot·Notion·Cursor 모두 입력창 선택 + 설정 관리를 같이 둔다.

### 2-2. 딸깍 기본 AI — 높음 · 보통 · 낮음
| 단계 | 설명(화면 문구) | 크레딧 |
|---|---|---|
| 높음 | 가장 꼼꼼해요. 긴 문서·복잡한 표에 | 보통의 2배 |
| **보통**(기본) | 대부분의 작업에 알맞아요 | 기준 |
| 낮음 | 빠르고 크레딧을 적게 써요. 짧은 수정에 | 보통의 절반 |
- 이름은 "딸깍 AI 높음"처럼 쓴다(입력창 칩은 짧게 "보통").
- 크레딧 배율은 지금 예시 값(정책 확정 전).

### 2-3. 내 AI 연결 — 공급자 이름·모델 이름 그대로
- 설정에서 공급자 카드(Anthropic Claude · OpenAI GPT · Google Gemini) → **API 키 붙여넣기 → 연결**.
- 연결되면 그 키로 쓸 수 있는 모델이 나오고, **입력창 목록에 보일 모델**을 체크한다(Copilot "Manage Models").
- 모델 이름은 공급자 이름 그대로(예: Claude Sonnet 5.5). 실제 서비스에서는 키로 공급자의 모델 목록 API를 불러 채운다 — 지금은 예시 목록.
- **크레딧을 쓰지 않는다**(사용료는 그 공급자가 청구). 입력창·결과에 "내 키"로 표시.
- 키 보안: 화면에는 끝 4자리만(`sk-…a1b2`). 프로토타입은 키 전체를 저장하지 않고 끝 4자리만 이 브라우저에 둔다. 실제 서비스에서는 서버에 암호화 저장.
- 키 형식이 다르면 바로 알려 준다(Anthropic `sk-ant-` · OpenAI `sk-` · Google `AIza`). 연결 해제 · 키 바꾸기 있음.
- 계정 연결(Notion의 ChatGPT 플랜 연결 방식)은 다음 단계 후보.

### 2-4. 입력창 모델 칩
```
[＋] [◆ 보통 ▾]                          [↑]   (실행 방식 칩 [⚡ 자동 ▾]은 2026-11-19 삭제)
```
- 메뉴: **딸깍 AI** 높음/보통/낮음(크레딧 배율) → **내 AI** 연결된 모델(이름 · 공급자 · 내 키) → 아래 "AI 연결 관리 ›"(없으면 "Claude·ChatGPT 연결하기 ›") = 설정 › AI 모델.
- 입력창 폭 안에서 열린다.
- 결과 아래 한 줄: "보통 · 크레딧 30 사용" / "Claude Sonnet 5.5 · 내 키, 크레딧 안 씀". 무엇으로 만들었는지 남긴다.

## 3. 구현 메모(2026-11-19)
- 크레딧: 에디터는 `creditFor(req.model, 기준)`로 계산(UI 디자인 `DesignFile` · 문서 `DocEditor`). 내 키는 0이라 잔액이 줄지 않는다.
- 입력창 줄: [＋][✦ 모델] … [↑](자동 칩 삭제). 긴 모델 이름은 "Claude So…"처럼 줄이고 툴팁에 전체 이름. 자동 칩은 줄바꿈하지 않는다.
- 연결 상태는 이 브라우저(`ddalkkak.aiModels.v1`)에 끝 4자리 · 보일 모델 · 기본 AI만 저장. 연결 해제나 모델 숨김으로 고른 모델이 사라지면 "딸깍 AI 보통"으로 돌아간다.
- 확인: 형식이 틀린 키(OpenAI 키를 Claude 칸에) → "키 형식이 맞지 않아요…", 맞는 형식 → 연결됨 · 키 …abcd, 기본 AI 목록과 입력창에 Claude 모델이 생기고, Claude로 시키면 결과 아래 "Claude Sonnet 5.5 · 내 키, 크레딧 안 씀".

## 4. 범위 밖
실제 공급자 호출·키 검증 서버, 계정(OAuth) 연결, 팀 관리자의 모델 제한, 자동(Auto) 라우팅.
