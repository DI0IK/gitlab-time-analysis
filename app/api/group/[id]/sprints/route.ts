import { NextResponse } from "next/server";
import {
  PROJECT_START_DATE,
  PROJECT_END_DATE,
  SPRINT_DURATION_WEEKS,
  SPRINT_START_WEEKDAY,
} from "../../../env";

export const revalidate = 60;

export type GroupSprintsResponse = {
  sprintNumber: number;
  startDate: string;
  endDate: string;
}[];

export function generateSprints(): GroupSprintsResponse {
  // Generate sprints based on PROJECT_START_DATE, PROJECT_END_DATE, SPRINT_DURATION_WEEKS, SPRINT_START_WEEKDAY
  const sprints: GroupSprintsResponse = [];
  const startDate = new Date(PROJECT_START_DATE || "");
  const endDate = new Date(PROJECT_END_DATE || "");
  let sprintStartDate = new Date(startDate);

  // Adjust sprintStartDate to the next SPRINT_START_WEEKDAY
  const weekdayMap: { [key: string]: number } = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const targetWeekday = isNaN(Number(SPRINT_START_WEEKDAY || ""))
    ? weekdayMap[SPRINT_START_WEEKDAY || "Monday"]
    : Number(SPRINT_START_WEEKDAY || "1");
  while (sprintStartDate.getDay() !== targetWeekday) {
    sprintStartDate.setDate(sprintStartDate.getDate() + 1);
  }

  let sprintNumber = 1;
  while (sprintStartDate < endDate) {
    const sprintEndDate = new Date(sprintStartDate);
    sprintEndDate.setDate(
      sprintEndDate.getDate() +
        (SPRINT_DURATION_WEEKS ? Number(SPRINT_DURATION_WEEKS) * 7 - 1 : 13)
    );
    if (sprintEndDate > endDate) {
      break;
    }

    sprints.push({
      sprintNumber,
      startDate: sprintStartDate.toISOString().split("T")[0],
      endDate: sprintEndDate.toISOString().split("T")[0],
    });

    sprintStartDate = new Date(sprintEndDate);
    sprintStartDate.setDate(sprintStartDate.getDate() + 1);
    sprintNumber++;
  }
  return sprints;
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  return NextResponse.json(generateSprints());
};
