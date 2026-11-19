import { collabColorValue, profileInitials, type Profile } from "@/app/state/profile";
import { f } from "@/app/styleTokens";

/**
 * 내 아바타 — 사진이 있으면 사진, 없으면 이름 이니셜 + 협업 색상(Google·Notion·Figma 기본 아바타와 같은 방식).
 * `ring` 을 켜면 협업 색상 테두리를 두른다 — 공동 편집 화면에서 "누가 어느 색인지" 잇는 표시.
 */
export function ProfileAvatar({ profile, size, ring = false }: { profile: Pick<Profile, "name" | "avatarUrl" | "collabColor">; size: number; ring?: boolean }) {
  const c = collabColorValue(profile.collabColor);
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        background: profile.avatarUrl ? "#e0e7ff" : c,
        boxShadow: ring ? `0 0 0 2px #ffffff, 0 0 0 4px ${c}` : undefined,
      }}
    >
      {profile.avatarUrl ? (
        <img alt="" className="size-full object-cover" src={profile.avatarUrl} />
      ) : (
        <span aria-hidden style={{ ...f, fontWeight: 700, fontSize: Math.round(size * 0.36), color: "#ffffff", letterSpacing: "-0.3px" }}>
          {profileInitials(profile.name)}
        </span>
      )}
    </span>
  );
}
