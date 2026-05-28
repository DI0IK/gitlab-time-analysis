export const CATEGORY_DEFINITIONS = [
  {
    id: "project-management",
    label: "Project Management",
    shortLabel: "PM",
    color: "#ff7300",
    patterns: [/pm\b/i, /project/i, /management/i],
  },
  {
    id: "requirements-engineering",
    label: "Requirements Engineering",
    shortLabel: "RE",
    color: "#8884d8",
    patterns: [/req/i, /\bre\b/i, /requirements/i],
  },
  {
    id: "implementation",
    label: "Implementation",
    shortLabel: "Impl",
    color: "#82ca9d",
    patterns: [/impl/i, /implementation/i, /\bdev\b/i, /development/i],
  },
  {
    id: "architecture",
    label: "Architecture",
    shortLabel: "Arch",
    color: "#ffc658",
    patterns: [/arch/i, /architecture/i, /entwurf/i],
  },
] as const;

export type CategoryId = (typeof CATEGORY_DEFINITIONS)[number]["id"];

/**
 * Check whether a label (scoped like "Category::pm" or flat like "pm")
 * matches one of the four categories. Returns the matching definition,
 * or null if no category matched.
 */
export function matchLabelToCategory(
  label: string,
): (typeof CATEGORY_DEFINITIONS)[number] | null {
  const subLabel = label.includes("::")
    ? label.split("::").slice(1).join("::")
    : label;
  const groupName = label.includes("::") ? label.split("::")[0] : "Ungrouped";

  for (const def of CATEGORY_DEFINITIONS) {
    if (def.patterns.some((p) => p.test(subLabel) || p.test(groupName))) {
      return def;
    }
  }
  return null;
}

/** Category ids that have real usage data — useful for ordering. */
export const CATEGORY_IDS = CATEGORY_DEFINITIONS.map((d) => d.id);
