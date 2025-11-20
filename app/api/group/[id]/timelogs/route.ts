import { NextResponse } from "next/server";
import {
  GITLAB_GROUP_PATH,
  PROJECT_START_DATE,
  PROJECT_END_DATE,
  SPRINT_DURATION_WEEKS,
  SPRINT_START_WEEKDAY,
} from "../../../env";
import { runGitlabGraphQLQuery } from "../../../gitlab";

export const revalidate = 60;

export type GroupTimelogsResponse = {
  id: string;
  issueUrl: string;
  issueLabels: string[];
  issueTimeEstimate: number;
  spentAt: string;
  timeSpent: number;
  username: string;
  sprintNumber?: number;
}[];

export async function getTimelogs(groupId: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;

  const data = await runGitlabGraphQLQuery(`
    {
      group(fullPath: "${fullGroupPath}") {
        timelogs(startDate: "${PROJECT_START_DATE}", endDate: "${PROJECT_END_DATE}", first: 1000) {
          nodes {
            id
            spentAt
            timeSpent
            user {
              username
            }
            issue {
              webUrl
              timeEstimate
              labels {
                nodes {
                  title
                }
              }
            }
          }
        }
      }
    }
  `);

  return data.data.group.timelogs.nodes.map(
    (log: {
      id: string;
      issue: {
        webUrl: string;
        labels: { nodes: { title: string }[] };
        timeEstimate: number;
      } | null;
      spentAt: string;
      timeSpent: number;
      user: { username: string } | null;
    }) => {
      const spentDate = new Date(log.spentAt);
      const projectStartDate = new Date(PROJECT_START_DATE || "");

      // Helper: parse SPRINT_START_WEEKDAY which may be a number or a name
      const parseDesiredWeekday = (fallbackWeekday: number) => {
        const w = (SPRINT_START_WEEKDAY || "").trim().toLowerCase();
        if (w === "") return fallbackWeekday;
        if (/^\d+$/.test(w)) return parseInt(w, 10) % 7;
        const map: Record<string, number> = {
          sunday: 0,
          sun: 0,
          monday: 1,
          mon: 1,
          tuesday: 2,
          tue: 2,
          wednesday: 3,
          wed: 3,
          thursday: 4,
          thu: 4,
          friday: 5,
          fri: 5,
          saturday: 6,
          sat: 6,
        };
        return map[w] ?? fallbackWeekday;
      };

      // If projectStartDate is invalid, don't compute sprint number
      let sprintNumber: number | undefined = undefined;
      if (!isNaN(projectStartDate.getTime()) && !isNaN(spentDate.getTime())) {
        const desiredWeekday = parseDesiredWeekday(projectStartDate.getDay());

        // Compute the first sprint start >= projectStartDate that falls on desiredWeekday
        const projectStartDay = projectStartDate.getDay();
        const offsetDays = (desiredWeekday - projectStartDay + 7) % 7;
        const firstSprintStart = new Date(projectStartDate);
        firstSprintStart.setDate(projectStartDate.getDate() + offsetDays);

        // Normalize to UTC date boundaries to avoid timezone partial-day issues
        const utc = (d: Date) =>
          Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysDifference = Math.floor(
          (utc(spentDate) - utc(firstSprintStart)) / msPerDay
        );

        const sprintDurationDays =
          parseInt(SPRINT_DURATION_WEEKS || "1", 10) * 7;
        const calcSprint = Math.floor(daysDifference / sprintDurationDays) + 1;
        sprintNumber = calcSprint > 0 ? calcSprint : undefined;
      }

      return {
        id: log.id,
        issueUrl: log.issue?.webUrl,
        issueLabels:
          log.issue?.labels.nodes.map(
            (label: { title: string }) => label.title
          ) || [],
        issueTimeEstimate: log.issue?.timeEstimate || 0,
        spentAt: log.spentAt,
        timeSpent: log.timeSpent,
        username: log.user?.username,
        sprintNumber,
      };
    }
  );
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const groupId = (await params).id;

  return NextResponse.json(await getTimelogs(groupId));
};
