import { NextRequest, NextResponse } from "next/server";
import { getMembers, getLabels, getTimelogs, getMergeRequests } from "../../cache";
import { generateSprints } from "../types";
import { renderTableSvg } from "../renderTableSvg";
import { renderOgImage } from "../renderOgImage";

export const revalidate = 60;
export const runtime = "nodejs";

export { getMembers, getLabels, getTimelogs, getMergeRequests, generateSprints };
export * from "../types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // The last segment is the action (members, labels, timelogs, sprints, merge-requests, table.svg, og)
  const action = slug[slug.length - 1];
  
  // The preceding segments form the group ID (e.g. "g1-elixir" or "g1-elixir/e1-wc")
  let groupId = slug.slice(0, -1).join("/");
  if (!groupId) {
    groupId =
      request.nextUrl.searchParams.get("groupId") ||
      request.nextUrl.searchParams.get("id") ||
      "";
  }

  // Extract auth token if provided
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  switch (action) {
    case "members": {
      const { data, timestamp } = await getMembers(groupId, token);
      return NextResponse.json(data, {
        headers: { "x-cache-timestamp": String(timestamp) },
      });
    }

    case "labels": {
      const { data, timestamp } = await getLabels(groupId, token);
      return NextResponse.json(data, {
        headers: { "x-cache-timestamp": String(timestamp) },
      });
    }

    case "timelogs": {
      const { data, timestamp } = await getTimelogs(groupId, token);
      return NextResponse.json(data, {
        headers: { "x-cache-timestamp": String(timestamp) },
      });
    }

    case "merge-requests": {
      const { data, timestamp } = await getMergeRequests(groupId, token);
      return NextResponse.json(data, {
        headers: { "x-cache-timestamp": String(timestamp) },
      });
    }

    case "sprints": {
      return NextResponse.json(generateSprints(), {
        headers: { "x-cache-timestamp": String(Date.now()) },
      });
    }

    case "table.svg": {
      return renderTableSvg(groupId, request);
    }

    case "og": {
      return renderOgImage(groupId, request);
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 404 },
      );
  }
}
