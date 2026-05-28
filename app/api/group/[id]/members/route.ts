import { NextResponse } from "next/server";
import { getMembers } from "../../../cache";
export { getMembers };

export const revalidate = 60;

export type GroupMembersResponse = {
  id: string;
  name: string;
  url: string;
  bot: boolean;
  avatarUrl: string | null;
}[];

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const groupId = (await params).id;

  const { data, timestamp } = await getMembers(groupId);
  return NextResponse.json(data, {
    headers: { "x-cache-timestamp": String(timestamp) },
  });
};
