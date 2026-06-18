/**
 * Avatar utility functions for generating initials and avatar URLs
 */

/**
 * Generate 2-letter initials from a full name
 * @example getInitials("John Doe") => "JD"
 * @example getInitials("Alice") => "AL"
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] + parts[0][1]).toUpperCase().slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generate a color hash based on a string (username or name)
 * Returns a hex color code
 * @example getColorFromHash("john") => "#FF6B6B"
 */
export function getColorFromHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 65;
  const lightness = 55;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}


