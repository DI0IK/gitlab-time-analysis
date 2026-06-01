import { ImageResponse } from "next/og";
import { GITLAB_GROUP_PATH } from "../../../env";
import { apolloClient, gql } from "../../../apollo-client";
import { CATEGORY_DEFINITIONS } from "@/app/config/categories";
import { getMembers } from "../members/route";
import { getTimelogs } from "../timelogs/route";
import { generateSprints } from "../sprints/route";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [inter, interBold, { data: members }, { data: timelogs }, sprints] = await Promise.all([
    fetch(
      "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff",
    ).then((res) => res.arrayBuffer()),
    fetch(
      "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff",
    ).then((res) => res.arrayBuffer()),
    getMembers(id),
    getTimelogs(id),
    generateSprints(),
  ]);

  const totalHours = Math.round(
    timelogs.reduce((sum, l) => sum + l.timeSpent, 0) / 3600,
  );
  const completedSprints = sprints.filter(
    (s) => s.endDate < new Date().toISOString().slice(0, 10),
  ).length;

  // Build category → subcategories map (mirrors the app's label grouping)
  const catSubs = new Map<string, Set<string>>();
  for (const log of timelogs) {
    for (const label of log.issueLabels) {
      const parts = label.split("::");
      const cat = parts[0];
      const sub = parts.slice(1).join("::");
      if (!catSubs.has(cat)) catSubs.set(cat, new Set());
      catSubs.get(cat)!.add(sub);
    }
  }

  let defaultCat = "";
  let bestScore = 0;
  for (const [cat, subs] of catSubs) {
    const subsArr = [...subs];
    const score = CATEGORY_DEFINITIONS.reduce((acc, def) => {
      if (def.patterns.some((p) => p.test(cat) || subsArr.some((s) => p.test(s))))
        return acc + 1;
      return acc;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      defaultCat = cat;
    }
  }
  if (!defaultCat && catSubs.size > 0) {
    defaultCat = [...catSubs.entries()].sort(
      (a, b) => b[1].size - a[1].size,
    )[0][0];
  }

  // Group timelogs by subcategory within the default category
  const subMinutes: Record<string, number> = {};
  for (const log of timelogs) {
    const subLabel = log.issueLabels.find((l) => l.startsWith(`${defaultCat}::`));
    const sub = subLabel ? subLabel.split("::").slice(1).join("::") : "Uncategorized";
    subMinutes[sub] = (subMinutes[sub] || 0) + log.timeSpent;
  }

  const topSubs = Object.entries(subMinutes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxSubMinutes = topSubs.length > 0 ? topSubs[0][1] : 1;
  const CATEGORY_COLORS = ["#82ca9d", "#8884d8", "#ffc658", "#ff7300"];

  const fullPath = `${GITLAB_GROUP_PATH}/${id}`;
  let groupName = id;
  try {
    const data: any = (await apolloClient.query<any>({
      query: gql`
        query OgGroupName($fullPath: ID!) {
          group(fullPath: $fullPath) {
            name
          }
        }
      `,
      variables: { fullPath },
      fetchPolicy: "no-cache",
    })).data;
    groupName = data.group.name;
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
          fontFamily: "Inter",
          padding: 60,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 16,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#8884d8" strokeWidth="2" />
              <path
                d="M12 6v6l4 2"
                stroke="#82ca9d"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#e0e0e0",
                letterSpacing: "-0.02em",
              }}
            >
              {groupName}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {members
              .filter((m) => !m.bot && m.avatarUrl)
              .slice(0, 8)
              .map((m) => (
                <img
                  key={m.id}
                  src={m.avatarUrl!}
                  style={{
                    display: "flex",
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    border: "2px solid rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            {members.filter((m) => !m.bot && m.avatarUrl).length > 8 && (
              <div
                style={{
                display: "flex",
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                  fontWeight: 700,
                  color: "#a0a0c0",
                  background: "rgba(255,255,255,0.08)",
                  border: "2px solid rgba(255,255,255,0.15)",
                }}
              >
                +{members.filter((m) => !m.bot && m.avatarUrl).length - 8}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#707090",
            marginBottom: 48,
          }}
        >
          GitLab DHBW-SE Time Analysis
        </div>
        <div style={{ display: "flex", gap: 96 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "#82ca9d",
              }}
            >
              {totalHours}
            </span>
            <span
              style={{
                fontSize: 16,
                color: "#a0a0c0",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Total Hours
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "#8884d8",
              }}
            >
              {members.filter((m) => !m.bot).length}
            </span>
            <span
              style={{
                fontSize: 16,
                color: "#a0a0c0",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Team Members
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "#ffc658",
              }}
            >
              {completedSprints}
            </span>
            <span
              style={{
                fontSize: 16,
                color: "#a0a0c0",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Sprints
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              height: 8,
              borderRadius: 4,
              background: "rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                width: `${(completedSprints / sprints.length) * 100}%`,
                height: "100%",
                borderRadius: 4,
                background: "#82ca9d",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 16,
              color: "#a0a0c0",
              whiteSpace: "nowrap",
            }}
          >
            {completedSprints}/{sprints.length} sprints
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              fontSize: 14,
              color: "#707090",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 4,
            }}
          >
            {defaultCat} subcategories
          </div>
          {topSubs.map(([sub, minutes], i) => {
            const hours = Math.round(minutes / 3600);
            const pct = (minutes / maxSubMinutes) * 100;
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <div
                key={sub}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: color,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    fontSize: 16,
                    color: "#c0c0d0",
                    width: 120,
                  }}
                >
                  {sub}
                </div>
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    height: 20,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 4,
                      background: color,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 16,
                    color: "#a0a0c0",
                    minWidth: 50,
                    justifyContent: "flex-end",
                  }}
                >
                  {hours}h
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: inter, weight: 400 },
        { name: "Inter", data: interBold, weight: 700 },
      ],
    },
  );
}
