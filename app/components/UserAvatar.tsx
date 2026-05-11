import { Avatar, Tooltip, Box } from "@mui/material";
import { getInitials, getColorFromHash } from "@/app/utils/avatarUtils";

export interface UserAvatarProps {
  member: {
    id: string;
    name: string;
    url: string;
    avatarUrl?: string | null;
  };
  size?: "small" | "medium" | "large";
  showTooltip?: boolean;
  sx?: Record<string, unknown>;
}

const sizeMap = {
  small: 24,
  medium: 32,
  large: 48,
};

/**
 * Reusable user avatar component with initials fallback and GitLab avatar support
 * Displays a circular avatar with the user's profile image or initials
 */
export function UserAvatar({
  member,
  size = "medium",
  showTooltip = true,
  sx = {},
}: UserAvatarProps) {
  const sizePixels = sizeMap[size];
  const initials = getInitials(member.name);
  const avatarColor = getColorFromHash(member.id);
  // Use the avatarUrl from the API if available
  const avatarUrl = member.avatarUrl || undefined;

  const avatar = (
    <Avatar
      alt={member.name}
      src={avatarUrl}
      sx={{
        width: sizePixels,
        height: sizePixels,
        fontSize: size === "small" ? "0.75rem" : size === "medium" ? "0.875rem" : "1.25rem",
        fontWeight: 600,
        backgroundColor: avatarColor,
        color: "#ffffff",
        ...sx,
      }}
    >
      {initials}
    </Avatar>
  );

  if (!showTooltip) {
    return avatar;
  }

  return (
    <Tooltip title={member.name} arrow>
      <Box sx={{ display: "inline-flex" }}>{avatar}</Box>
    </Tooltip>
  );
}
