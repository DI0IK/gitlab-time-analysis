import SprintOverview from "@/app/components/SprintOverviewImage";
import satori from "satori";
import { NextRequest, NextResponse } from "next/server";
import { getTimelogs, getMembers } from "../cache";
import { generateSprints } from "./types";

const fontData = fetch(
  new URL(
    "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff",
    import.meta.url,
  ),
).then((res) => res.arrayBuffer());

export async function renderTableSvg(groupId: string, request: NextRequest) {
  const [{ data: timelogs }, { data: members }] = await Promise.all([
    getTimelogs(groupId),
    getMembers(groupId),
  ]);

  const sprints = generateSprints();

  const searchParams = request.nextUrl.searchParams;
  const sprintNumberParam = searchParams.get("sprintNumber");
  if (!sprintNumberParam) {
    return NextResponse.json(
      { error: "sprintNumber query parameter is required." },
      { status: 400 },
    );
  }
  const sprintNumber = parseInt(sprintNumberParam, 10);
  if (isNaN(sprintNumber)) {
    return NextResponse.json(
      { error: "sprintNumber must be a valid number." },
      { status: 400 },
    );
  }
  if (
    !sprints.find((s) => s.sprintNumber === sprintNumber) &&
    sprintNumber !== 1000 &&
    !(sprintNumber >= 10000)
  ) {
    return NextResponse.json(
      { error: `Sprint number ${sprintNumber} not found.` },
      { status: 400 },
    );
  }

  const svg = await satori(
    <SprintOverview
      timelogs={timelogs}
      members={members}
      sprintNumber={sprintNumber}
    />,
    {
      width: 800,
      fonts: [
        {
          name: "Inter",
          data: await fontData,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Security-Policy": "frame-ancestors *",
      "X-Frame-Options": "ALLOWALL",
    },
  });
}
