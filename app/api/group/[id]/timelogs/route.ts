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
  issueTitle: string;
  issueState: string;
  issueTimeEstimate: number;
  spentAt: string;
  timeSpent: number;
  username: string;
  sprintNumber?: number;
}[];

type TimelogNode = {
  id: string;
  issue: {
    webUrl: string;
    state: string;
    title: string;
    labels: { nodes: { title: string }[] };
    timeEstimate: number;
  } | null;
  spentAt: string;
  timeSpent: number;
  user: { username: string } | null;
};

type TimelogsPage = {
  data: {
    group: {
      timelogs: {
        nodes: TimelogNode[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
  };
};

// Updated cache type to handle background promises and prevent duplicate fetches
type CacheEntry = {
  data: GroupTimelogsResponse | null;
  timestamp: number;
  fetchPromise: Promise<GroupTimelogsResponse> | null;
};

const cache: { [fullGroupPath: string]: CacheEntry } = {};
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

// Extracted fetch and processing logic to keep it isolated from caching logic
async function fetchAndProcessTimelogs(
  fullGroupPath: string,
): Promise<GroupTimelogsResponse> {
  let data: TimelogsPage | undefined;
  let finished = false;
  let cursor: string | null = null;

  // Fetch all pages
  while (!finished) {
    const newData = await runGitlabGraphQLQuery(`
    {
      group(fullPath: "${fullGroupPath}") {
        timelogs(startDate: "${PROJECT_START_DATE}", endDate: "${PROJECT_END_DATE}", first: 100${
          cursor ? `, after: "${cursor}"` : ""
        }) {
          nodes {
            id
            spentAt
            timeSpent
            user {
              username
            }
            issue {
              webUrl
              state
              timeEstimate
              title
              labels {
                nodes {
                  title
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `);

    if (!data) {
      data = newData;
    } else {
      // Merge newData into data
      data.data.group.timelogs.nodes.push(...newData.data.group.timelogs.nodes);
    }

    const pageInfo = newData.data.group.timelogs.pageInfo;
    if (pageInfo.hasNextPage) {
      cursor = pageInfo.endCursor;
    } else {
      finished = true;
    }
  }

  const mappedResponse = data!.data.group.timelogs.nodes.map(
    (log: TimelogNode) => {
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
          (utc(spentDate) - utc(firstSprintStart)) / msPerDay,
        );

        const sprintDurationDays =
          parseInt(SPRINT_DURATION_WEEKS || "1", 10) * 7;
        const calcSprint = Math.floor(daysDifference / sprintDurationDays) + 1;
        sprintNumber = calcSprint > 0 ? calcSprint : undefined;
      }

      return {
        id: log.id,
        issueUrl: log.issue?.webUrl,
        issueLabels: (
          log.issue?.labels.nodes.map(
            (label: { title: string }) => label.title,
          ) || []
        ).map((title: string) =>
          title.includes("::")
            ? title
            : title.includes(":")
              ? title.replace(/:/g, "::")
              : "Ungrouped::" + title,
        ),
        issueTitle: log.issue?.title || "",
        issueState: log.issue?.state || "",
        issueTimeEstimate: log.issue?.timeEstimate || 0,
        spentAt: log.spentAt,
        timeSpent: log.timeSpent,
        username: log.user?.username,
        sprintNumber,
      };
    },
  );

  return (mappedResponse as GroupTimelogsResponse).filter((i) => {
    if (i.issueUrl?.includes("deletion_scheduled")) return false;
    return true;
  });
}

export async function getTimelogs(groupId: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;
  const now = Date.now();

  // Initialize cache entry if it doesn't exist
  if (!cache[fullGroupPath]) {
    cache[fullGroupPath] = {
      data: null,
      timestamp: 0,
      fetchPromise: null,
    };
  }

  const cached = cache[fullGroupPath];
  const isStale = now - cached.timestamp >= CACHE_TTL_MS;

  // If the data is stale (or missing) AND no background refresh is currently running
  if (isStale && !cached.fetchPromise) {
    // Start background refresh and store the promise to prevent duplicate fetches
    cached.fetchPromise = fetchAndProcessTimelogs(fullGroupPath)
      .then((freshData) => {
        cache[fullGroupPath] = {
          data: freshData,
          timestamp: Date.now(),
          fetchPromise: null, // Clear the promise once finished
        };
        return freshData;
      })
      .catch((error) => {
        console.error("Failed to refresh timelogs background cache:", error);
        cache[fullGroupPath].fetchPromise = null; // Free up for next attempt
        throw error;
      });
  }

  // If we already have stale data, serve it immediately (Stale-While-Revalidate)
  if (cached.data) {
    // Catch potential unhandled promise rejections since we are not awaiting it here
    cached.fetchPromise?.catch(() => {});
    return cached.data;
  }

  // If we have NO data at all (first ever request), we MUST wait for the fetch to finish
  return await cached.fetchPromise!;
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const groupId = (await params).id;

  return NextResponse.json(await getTimelogs(groupId));
};
