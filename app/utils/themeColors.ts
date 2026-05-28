/**
 * Helper to get cohesive colors for categories depending on the chosen color theme and theme mode.
 */
export function getCategoryColor(categoryId: string, colorTheme: string, isDark: boolean): string {
  const normalizedId = categoryId.toLowerCase();
  
  if (colorTheme === "dhbw") {
    switch (normalizedId) {
      case "project-management":
      case "pm":
        return isDark ? "#f87171" : "#e2001a";
      case "requirements-engineering":
      case "re":
        return isDark ? "#fca5a5" : "#ff6b7d";
      case "implementation":
      case "impl":
        return isDark ? "#ef4444" : "#a80010";
      case "architecture":
      case "arch":
        return isDark ? "#fecdd3" : "#fda4af";
      default:
        return "#9ca3af";
    }
  }

  if (colorTheme === "green") {
    switch (normalizedId) {
      case "project-management":
      case "pm":
        return isDark ? "#34d399" : "#059669";
      case "requirements-engineering":
      case "re":
        return isDark ? "#6ee7b7" : "#34d399";
      case "implementation":
      case "impl":
        return isDark ? "#059669" : "#047857";
      case "architecture":
      case "arch":
        return isDark ? "#d1fae5" : "#a7f3d0";
      default:
        return "#9ca3af";
    }
  }

  if (colorTheme === "purple") {
    switch (normalizedId) {
      case "project-management":
      case "pm":
        return isDark ? "#c084fc" : "#7e22ce";
      case "requirements-engineering":
      case "re":
        return isDark ? "#d8b4fe" : "#a855f7";
      case "implementation":
      case "impl":
        return isDark ? "#a855f7" : "#c084fc";
      case "architecture":
      case "arch":
        return isDark ? "#f5d0fe" : "#e879f9";
      default:
        return "#9ca3af";
    }
  }

  // Default theme
  switch (normalizedId) {
    case "project-management":
    case "pm":
      return isDark ? "#ff8f3d" : "#ff7300";
    case "requirements-engineering":
    case "re":
      return isDark ? "#a5a1ff" : "#8884d8";
    case "implementation":
    case "impl":
      return isDark ? "#a2ecd5" : "#82ca9d";
    case "architecture":
    case "arch":
      return isDark ? "#ffe17d" : "#ffc658";
    default:
      return "#9ca3af";
  }
}
