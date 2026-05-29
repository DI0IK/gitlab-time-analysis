import { NextResponse } from "next/server";
import { getMergeRequests } from "../../../cache";

export const revalidate = 60;

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const groupId = (await params).id;

  const { data, timestamp } = await getMergeRequests(groupId);
  return NextResponse.json(data, {
    headers: { "x-cache-timestamp": String(timestamp) },
  });
};
