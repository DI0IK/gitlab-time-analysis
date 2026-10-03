import { NextResponse } from "next/server";
import { getDescendantGroups } from "../descendantGroups";

export type GroupResponse = {
  id: string;
  name: string;
  url: string;
  parentId?: string | null;
  parentName?: string | null;
  level?: number;
}[];

export const GET = async (request: Request) => {
  const { data, timestamp } = await getDescendantGroups();

  const result = data.map((g) => ({
    id: g.id,
    name: g.name,
    url: g.url,
    parentId: g.parentId ?? null,
    parentName: g.parentName ?? null,
    level: g.level ?? 1,
  }));

  return NextResponse.json(result, {
    headers: { "x-cache-timestamp": String(timestamp) },
  });
};
