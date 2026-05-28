import { NextResponse } from "next/server";
import { getDescendantGroups } from "../descendantGroups";

export type GroupResponse = {
  id: string;
  name: string;
  url: string;
}[];

export const GET = async (request: Request) => {
  const { data, timestamp } = await getDescendantGroups();

  const result = data.map((g) => ({
    id: g.id,
    name: g.name,
    url: g.url,
  }));

  return NextResponse.json(result, {
    headers: { "x-cache-timestamp": String(timestamp) },
  });
};
