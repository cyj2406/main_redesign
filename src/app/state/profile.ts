import { useSyncExternalStore } from "react";

import imgUserAvatar from "@/imports/새대화딸깍/ec4bf4c83826b512a10ccb46952ef28cdb24b8d8.png";

/**
 * 내 프로필 — 공동 작업자에게 보이는 이름·사진·직무·협업 색상(2026-11-13, 마이페이지).
 *
 * 공동 작업 기능이 생기면서 프로필 메뉴의 이름·아바타가 "나만 보는 값"이 아니라 다른 사람
 * 화면(초대 목록, 커서 라벨, 댓글)에 노출되는 값이 됐다. 그래서 App.tsx 에 하드코딩돼 있던
 * "최유정"·아바타 이미지를 이 스토어 하나로 모은다 — 마이페이지에서 고치면 프로필 메뉴와
 * 상단 아바타가 바로 따라 바뀐다. creditBalance.ts 와 같은 useSyncExternalStore 싱글턴 패턴.
 *
 * **서버 연동은 없다.** 값은 이 브라우저의 localStorage 에만 남는다(저장 불가 환경이면 이번
 * 세션만). 팀·초대 목록은 화면 확인용 예시 데이터다.
 */

/**
 * 협업 색상 — 공동 편집 중 내 커서·선택 영역·이름표에 쓰는 색(Figma·Miro의 멀티플레이어 커서와 같은 역할).
 * UI 색이 아니라 "사람을 구분하는 데이터 색"이라 styleTokens.color 에 넣지 않았다.
 * 흰 글자(이름표)와 대비 3:1 이상이 나오는 진한 톤만 골랐다.
 */
export const COLLAB_COLORS = [
  { id: "blue", label: "파랑", value: "#4f7bff" },
  { id: "violet", label: "보라", value: "#7c5cf0" },
  { id: "pink", label: "분홍", value: "#e0458f" },
  { id: "red", label: "빨강", value: "#e5484d" },
  { id: "orange", label: "주황", value: "#e5741a" },
  { id: "green", label: "초록", value: "#16a34a" },
  { id: "teal", label: "청록", value: "#0e9fb8" },
  { id: "slate", label: "회색", value: "#64748b" },
] as const;
export type CollabColorId = (typeof COLLAB_COLORS)[number]["id"];

export const PROFILE_LIMITS = { name: 20, jobTitle: 20, bio: 40 } as const;

export type TeamRole = "소유자" | "편집자" | "보기 전용";
export interface TeamMembership {
  id: string;
  name: string;
  memberCount: number;
  role: TeamRole;
}
export interface TeamInvite {
  id: string;
  teamName: string;
  invitedBy: string;
  role: TeamRole;
}

export interface Profile {
  name: string;
  email: string;
  /** null 이면 이름 이니셜 + 협업 색상 아바타 */
  avatarUrl: string | null;
  jobTitle: string;
  bio: string;
  collabColor: CollabColorId;
  teams: TeamMembership[];
  invites: TeamInvite[];
}

const STORAGE_KEY = "ddalkkak.profile.v1";
const DEFAULT_AVATAR = "default";
type Persisted = Pick<Profile, "name" | "avatarUrl" | "jobTitle" | "bio" | "collabColor">;

const DEFAULT_PROFILE: Profile = {
  name: "최유정",
  email: "cyj2406@gmail.com",
  avatarUrl: imgUserAvatar,
  jobTitle: "",
  bio: "",
  collabColor: "blue",
  // [예시] 팀 기능 백엔드 전까지 화면 확인용
  teams: [
    { id: "t-personal", name: "최유정의 작업 공간", memberCount: 1, role: "소유자" },
    { id: "t-mkt", name: "딸깍 마케팅팀", memberCount: 6, role: "편집자" },
  ],
  invites: [{ id: "i-1", teamName: "브랜드 디자인 TF", invitedBy: "김하늘", role: "편집자" }],
};

function load(): Profile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const saved = JSON.parse(raw) as Partial<Persisted>;
    // 기본 사진은 경로 대신 표시만 저장한다 — 빌드마다 에셋 파일 이름(해시)이 바뀐다.
    if (saved.avatarUrl === DEFAULT_AVATAR) saved.avatarUrl = imgUserAvatar;
    return { ...DEFAULT_PROFILE, ...saved };
  } catch {
    return DEFAULT_PROFILE;
  }
}

let profile: Profile = load();
const listeners = new Set<() => void>();

function persist() {
  const { name, avatarUrl, jobTitle, bio, collabColor } = profile;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, avatarUrl: avatarUrl === imgUserAvatar ? DEFAULT_AVATAR : avatarUrl, jobTitle, bio, collabColor } satisfies Persisted));
  } catch {
    /* 저장 불가(용량 초과·시크릿 창) — 이번 세션 상태만 유지 */
  }
}

export function getProfile(): Profile {
  return profile;
}

export function updateProfile(patch: Partial<Profile>): void {
  profile = { ...profile, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function respondToInvite(inviteId: string, accept: boolean): void {
  const invite = profile.invites.find((i) => i.id === inviteId);
  if (!invite) return;
  updateProfile({
    invites: profile.invites.filter((i) => i.id !== inviteId),
    teams: accept ? [...profile.teams, { id: `t-${invite.id}`, name: invite.teamName, memberCount: 4, role: invite.role }] : profile.teams,
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, getProfile, getProfile);
}

export function collabColorValue(id: CollabColorId): string {
  return COLLAB_COLORS.find((c) => c.id === id)?.value ?? COLLAB_COLORS[0].value;
}

/** 한글 이름은 뒤 두 글자("최유정" → "유정"), 영문은 단어 첫 글자 두 개. */
export function profileInitials(name: string): string {
  const n = name.trim();
  if (!n) return "?";
  if (/^[가-힣]+$/.test(n)) return n.length >= 3 ? n.slice(-2) : n;
  const parts = n.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : n.slice(0, 2)).toUpperCase();
}

/**
 * 고른 사진을 정사각형 256px JPEG 로 잘라 data URL 로 돌려준다 — 원본을 그대로 담으면
 * localStorage(보통 5MB) 를 금방 넘긴다. 가운데 기준으로 자른다(Canva·Notion 프로필 사진과 같은 원형 크롭).
 */
export function resizeAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("canvas")); return; }
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image")); };
    img.src = url;
  });
}
