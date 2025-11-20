import SprintOverview from "@/app/components/SprintOverviewImage";
import satori from "satori";
import { NextRequest, NextResponse } from "next/server";
import { getTimelogs } from "../timelogs/route";
import { generateSprints } from "../sprints/route";
import { getMembers } from "../members/route";
import { getLabels } from "../labels/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const timelogs = await getTimelogs(id);
  const sprints = generateSprints();
  const members = await getMembers(id);
  const labels = await getLabels(id);

  const searchParams = request.nextUrl.searchParams;
  const labelGroup = searchParams.get("labelGroup") || "Ungrouped";
  if (!labels[labelGroup]) {
    return NextResponse.json(
      { error: `Label group '${labelGroup}' not found.` },
      { status: 400 }
    );
  }
  const sprintNumberParam = searchParams.get("sprintNumber");
  if (!sprintNumberParam) {
    return NextResponse.json(
      { error: "sprintNumber query parameter is required." },
      { status: 400 }
    );
  }
  const sprintNumber = parseInt(sprintNumberParam, 10);
  if (isNaN(sprintNumber)) {
    return NextResponse.json(
      { error: "sprintNumber must be a valid number." },
      { status: 400 }
    );
  }
  if (!sprints.find((s) => s.sprintNumber === sprintNumber)) {
    return NextResponse.json(
      { error: `Sprint number ${sprintNumber} not found.` },
      { status: 400 }
    );
  }

  const fontData = await fetch(
    new URL(
      "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff",
      import.meta.url
    )
  ).then((res) => res.arrayBuffer());

  const svg = await satori(
    <SprintOverview
      timelogs={timelogs}
      members={members}
      labels={labels}
      labelGroup={labelGroup}
      sprintNumber={sprintNumber}
    />,
    {
      width: 800,
      height: 600,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          weight: 400,
          style: "normal",
        },
      ],
    }
  );

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
    },
  });
}
