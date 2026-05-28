import { NextResponse } from "next/server";
import { getLabels } from "../../../cache";
export { getLabels };

export const revalidate = 60;

export type GroupLabelsResponse = {
  [labelGroup: string]: {
    id: string;
    title: string;
    description: string;
    color: string;
  }[];
};

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const groupId = (await params).id;

  const { data, timestamp } = await getLabels(groupId);
  return NextResponse.json(data, {
    headers: { "x-cache-timestamp": String(timestamp) },
  });
};
