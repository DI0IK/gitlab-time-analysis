import { ImageResponse } from "next/og";
import { GITLAB_GROUP_PATH } from "../env";
import { runGitlabGraphQLQuery } from "../gitlab";

export const runtime = "nodejs";

export async function GET() {
  const [inter, interBold] = await Promise.all([
    fetch(
      "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff",
    ).then((res) => res.arrayBuffer()),
    fetch(
      "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff",
    ).then((res) => res.arrayBuffer()),
  ]);

  let groups: { name: string }[] = [];
  try {
    const data = await runGitlabGraphQLQuery(`
      {
        group(fullPath: "${GITLAB_GROUP_PATH}") {
          descendantGroups {
            nodes {
              name
            }
          }
        }
      }
    `);
    groups = data.data.group.descendantGroups.nodes;
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
          fontFamily: "Inter",
          padding: 60,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 24,
          }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#8884d8" strokeWidth="2" />
            <path
              d="M12 6v6l4 2"
              stroke="#82ca9d"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#e0e0e0",
              letterSpacing: "-0.02em",
            }}
          >
            GitLab DHBW-SE
          </div>
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a0a0c0",
            textAlign: "center",
            maxWidth: 700,
            lineHeight: 1.4,
            marginBottom: 48,
          }}
        >
          Analyze time tracking data from GitLab for DHBW-SE students
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 16,
            maxWidth: 900,
          }}
        >
          {groups.slice(0, 8).map((g) => (
            <div
              key={g.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="#82ca9d" strokeWidth="1.5" />
              </svg>
              <span style={{ fontSize: 18, color: "#c0c0d0" }}>{g.name}</span>
            </div>
          ))}
          {groups.length > 8 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 18,
                color: "#707090",
                padding: "10px 20px",
              }}
            >
              +{groups.length - 8} more
            </div>
          )}
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
