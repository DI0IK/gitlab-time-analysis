import { getDescendantGroups as getDescendantGroupsCached, DescendantGroup } from "./cache";

export type { DescendantGroup };

export async function getDescendantGroups(
  token?: string
): Promise<{
  data: DescendantGroup[];
  timestamp: number;
}> {
  return getDescendantGroupsCached(token);
}
