import { NextResponse } from "next/server";
import { getTimelogs } from "../../../cache";
export { getTimelogs };

export const revalidate = 60;

export type GroupTimelogsResponse = {
  id: string;
  issueUrl: string;
  issueLabels: string[];
  issueTitle: string;
  issueState: string;
  issueTimeEstimate: number;
  issueCreatedAt: string;
  issueClosedAt: string | null;
  spentAt: string;
  timeSpent: number;
  username: string;
  sprintNumber?: number;
}[];

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const groupId = (await params).id;

  const { data, timestamp } = await getTimelogs(groupId);
  return NextResponse.json(data, {
    headers: { "x-cache-timestamp": String(timestamp) },
  });
};
