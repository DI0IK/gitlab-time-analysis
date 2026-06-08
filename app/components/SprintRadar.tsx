"use client";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import React from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { GroupContext } from "../GroupContext";
import { matchLabelToCategory } from "../utils/categoryUtils";
import { CATEGORY_DEFINITIONS } from "../config/categories";

export default function SprintRadar() {
  const { sprints, timelogs, members, selectedSprint, setSelectedSprint } = React.useContext(GroupContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const verifiedMemberIds = React.useMemo(
    () => new Set(members.filter((m) => !m.bot && m.verified).map((m) => m.id.toLowerCase())),
    [members],
  );

  const inSelectedSprint = (log: (typeof timelogs)[number]) =>
    log.sprintNumber === selectedSprint ||
    selectedSprint === 1000 ||
    (selectedSprint !== null &&
      selectedSprint >= 10000 &&
      log.spentAt.startsWith((selectedSprint - 10000).toString()));

  const filteredLogs = selectedSprint
    ? timelogs.filter((log) => inSelectedSprint(log) && verifiedMemberIds.has(log.username?.toString().toLowerCase() || ""))
    : [];

  // Build category totals
  const categorySeconds: Record<string, number> = {};
  for (const def of CATEGORY_DEFINITIONS) {
    categorySeconds[def.id] = 0;
  }
  categorySeconds["other"] = 0;

  filteredLogs.forEach((log) => {
    let assigned = false;
    for (const label of log.issueLabels || []) {
      const catDef = matchLabelToCategory(label);
      if (catDef) {
        categorySeconds[catDef.id] =
          (categorySeconds[catDef.id] || 0) + log.timeSpent;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      categorySeconds["other"] =
        (categorySeconds["other"] || 0) + log.timeSpent;
    }
  });

  const totalSeconds = Object.values(categorySeconds).reduce(
    (a, b) => a + b,
    0,
  );

  const radarData = [
    ...CATEGORY_DEFINITIONS.map((def) => ({
      subject: def.label,
      value:
        totalSeconds > 0
          ? +((categorySeconds[def.id] / totalSeconds) * 100).toFixed(1)
          : 0,
      hours: +((categorySeconds[def.id] || 0) / 3600).toFixed(1),
      color: def.color,
    })),
    ...(categorySeconds["other"] > 0
      ? [
          {
            subject: "Other",
            value:
              totalSeconds > 0
                ? +(
                    (categorySeconds["other"] / totalSeconds) *
                    100
                  ).toFixed(1)
                : 0,
            hours: +((categorySeconds["other"] || 0) / 3600).toFixed(1),
            color: "#666",
          },
        ]
      : []),
  ].sort((a, b) => b.value - a.value);

  const years = timelogs
    .reduce((acc, log) => {
      const year = new Date(log.spentAt).getFullYear();
      if (!acc.includes(year)) acc.push(year);
      return acc;
    }, [] as number[])
    .sort((a, b) => b - a);

  const isDark = theme.palette.mode === "dark";
  const tickColor = isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(15, 23, 42, 0.75)";

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader title="Cycle Category Distribution" />
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>

        {selectedSprint === null ? (
          <Typography
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            No sprint selected.
          </Typography>
        ) : radarData.length === 0 ||
          radarData.every((d) => d.value === 0) ? (
          <Typography
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            No timelogs found for the selected filters.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: tickColor }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: tickColor }}
              />
              <Radar
                name="% of Time"
                dataKey="value"
                stroke={theme.palette.primary.main}
                fill={theme.palette.primary.main}
                fillOpacity={0.6}
              />
              <Tooltip
                formatter={(value) => `${value}%`}
                contentStyle={{
                  backgroundColor: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
                  border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}`,
                  borderRadius: 8,
                  color: isDark ? "#f3f4f6" : "#0f172a",
                  fontSize: 13,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
