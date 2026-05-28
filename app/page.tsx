"use client";
import React from "react";
import {
  Avatar,
  AvatarGroup,
  Box,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_DEFINITIONS } from "./config/categories";
import { UserLeaderboard } from "./components/UserLeaderboard";
import type { GroupComparisonResponse } from "./api/groups/comparison/route";

const OTHER_COLOR = "rgba(255,255,255,0.15)";

function StackedBar({
  segments,
  otherHours,
  otherLabels,
  totalHours,
  maxTotalHours,
}: {
  segments: {
    label: string;
    hours: number;
    color: string;
    matchedLabels?: string[];
  }[];
  otherHours: number;
  otherLabels: string[];
  totalHours: number;
  maxTotalHours: number;
}) {
  const otherSegment: typeof segments =
    otherHours > 0
      ? [
          {
            label: "Other",
            hours: otherHours,
            color: OTHER_COLOR,
            matchedLabels: otherLabels,
          },
        ]
      : [];
  const allSegments = [...segments, ...otherSegment];

  const barWidthPct =
    maxTotalHours > 0 ? Math.max((totalHours / maxTotalHours) * 100, 10) : 100;

  return (
    <Box
      sx={{
        width: `${barWidthPct}%`,
        height: 20,
        borderRadius: 1.5,
        overflow: "hidden",
        display: "flex",
        bgcolor: "rgba(255,255,255,0.05)",
      }}
    >
      {allSegments.map((seg) => {
        const pct = totalHours > 0 ? (seg.hours / totalHours) * 100 : 0;
        if (pct < 0.5) return null;
        return (
          <Tooltip
            key={seg.label}
            title={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {seg.label}: {seg.hours.toFixed(1)}h ({pct.toFixed(0)}%)
                </Typography>
                {seg.matchedLabels && seg.matchedLabels.length > 0 && (
                  <Box
                    component="ul"
                    sx={{
                      m: 0,
                      px: 1.5,
                      listStyle: "none",
                      "& li": {
                        fontSize: "0.75rem",
                        lineHeight: 1.6,
                        opacity: 0.85,
                      },
                    }}
                  >
                    {seg.matchedLabels.map((l: string) => (
                      <li key={l}>{l}</li>
                    ))}
                  </Box>
                )}
              </Box>
            }
            arrow
          >
            <Box
              sx={{
                width: `${pct}%`,
                minWidth: 4,
                height: "100%",
                bgcolor: seg.color,
                transition: "width 0.3s ease",
                "&:hover": { opacity: 0.8 },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

function MemberAvatars({
  members,
}: {
  members: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bot: boolean;
  }[];
}) {
  const humanMembers = members.filter((m) => !m.bot);
  if (humanMembers.length === 0)
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );

  return (
    <AvatarGroup
      max={5}
      total={humanMembers.length}
      sx={{
        justifyContent: "flex-start",
        "& .MuiAvatar-root": { width: 26, height: 26, fontSize: "0.7rem" },
      }}
    >
      {humanMembers.map((m) => (
        <Tooltip key={m.id} title={m.name} arrow>
          <Avatar
            alt={m.name}
            src={m.avatarUrl || undefined}
            sx={{ width: 26, height: 26 }}
          >
            {m.name.charAt(0).toUpperCase()}
          </Avatar>
        </Tooltip>
      ))}
    </AvatarGroup>
  );
}

function CategoryLegend() {
  return (
    <Box
      sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}
    >
      {CATEGORY_DEFINITIONS.map((def) => (
        <Box
          key={def.id}
          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "2px",
              bgcolor: def.color,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {def.label}
          </Typography>
        </Box>
      ))}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: "2px",
            bgcolor: OTHER_COLOR,
          }}
        />
        <Typography variant="caption" color="text.secondary">
          Other
        </Typography>
      </Box>
    </Box>
  );
}

function ComparisonTable({ data }: { data: GroupComparisonResponse }) {
  const maxTotalHours = Math.max(...data.map((g) => g.totalHours), 0);
  const router = useRouter();
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700 }}>Group</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Members</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>Category split</TableCell>
          <TableCell sx={{ fontWeight: 700 }} align="right">
            Hours
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((group) => (
          <TableRow
            key={group.id}
            onClick={() => router.push(`/${group.id}`)}
            sx={{
              cursor: "pointer",
              "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
              "&:last-child td": { borderBottom: 0 },
              "& td": { textDecoration: "none" },
            }}
          >
            <TableCell sx={{ fontWeight: 600 }}>{group.name}</TableCell>
            <TableCell sx={{ maxWidth: 180 }}>
              <MemberAvatars members={group.members} />
            </TableCell>
            <TableCell sx={{ minWidth: 250 }}>
              <StackedBar
                segments={group.categoryBreakdown}
                otherHours={group.otherHours}
                otherLabels={group.otherLabels}
                totalHours={group.totalHours}
                maxTotalHours={maxTotalHours}
              />
            </TableCell>
            <TableCell
              align="right"
              sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
            >
              {group.totalHours.toFixed(0)}h
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ComparisonCards({ data }: { data: GroupComparisonResponse }) {
  const maxTotalHours = Math.max(...data.map((g) => g.totalHours), 0);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {data.map((group) => (
        <Card
          key={group.id}
          component={NextLink}
          href={`/${group.id}`}
          sx={{
            textDecoration: "none",
            transition: "all 0.2s ease",
            "&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
          }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              {group.name}
            </Typography>
            <Box sx={{ mb: 1.5 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                Members
              </Typography>
              <MemberAvatars members={group.members} />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.5 }}
            >
              Category split
            </Typography>
            <StackedBar
              segments={group.categoryBreakdown}
              otherHours={group.otherHours}
              otherLabels={group.otherLabels}
              totalHours={group.totalHours}
              maxTotalHours={maxTotalHours}
            />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export default function Home() {
  const [data, setData] = React.useState<GroupComparisonResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  React.useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/groups/comparison");
        if (!res.ok) throw new Error(`Failed to load: ${res.statusText}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box
      sx={{
        width: "min(max(80svw, 400px), 100svw)",
        mx: "auto",
        p: 3,
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        GitLab Time Analysis
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select a group to view its time tracking dashboard
      </Typography>

      {loading && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            alignItems: "center",
            py: 8,
          }}
        >
          <Box sx={{ width: "60%", maxWidth: 400 }}>
            <LinearProgress />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Loading group comparison data…
          </Typography>
        </Box>
      )}

      {error && (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography color="error" sx={{ mb: 1 }}>
            Failed to load groups
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
        </Card>
      )}

      {data && data.length === 0 && (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            No groups found. Check your GITLAB_GROUP_PATH configuration.
          </Typography>
        </Card>
      )}

      {data && data.length > 0 && (
        <>
          <Box sx={{ mt: 3 }}>
            <Card>
              <CardHeader
                title={
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <span>
                      Groups{" "}
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                      >
                        ({data.length})
                      </Typography>
                    </span>
                    <CategoryLegend />
                  </Box>
                }
                sx={{ pb: 0 }}
              />
              <CardContent sx={{ px: { xs: 1, sm: 2 } }}>
                {isMobile ? (
                  <ComparisonCards data={data} />
                ) : (
                  <ComparisonTable data={data} />
                )}
              </CardContent>
            </Card>
          </Box>
          <br />
          <UserLeaderboard />
        </>
      )}
    </Box>
  );
}
