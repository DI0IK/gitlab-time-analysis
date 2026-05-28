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
  const { sprints, timelogs } = React.useContext(GroupContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [selectedSprint, setSelectedSprint] = React.useState<number | null>(
    sprints.find(
      (sp) =>
        sp.startDate <= new Date().toISOString().slice(0, 10) &&
        new Date().toISOString().slice(0, 10) <= sp.endDate,
    )?.sprintNumber ?? null,
  );

  React.useEffect(() => {
    if (sprints.length && selectedSprint === null) {
      setSelectedSprint(
        sprints.find(
          (sp) =>
            sp.startDate <= new Date().toISOString().slice(0, 10) &&
            new Date().toISOString().slice(0, 10) <= sp.endDate,
        )?.sprintNumber ?? null,
      );
    }
  }, [sprints, selectedSprint]);

  const inSelectedSprint = (log: (typeof timelogs)[number]) =>
    log.sprintNumber === selectedSprint ||
    selectedSprint === 1000 ||
    (selectedSprint !== null &&
      selectedSprint >= 10000 &&
      log.spentAt.startsWith((selectedSprint - 10000).toString()));

  const filteredLogs = selectedSprint
    ? timelogs.filter(inSelectedSprint)
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

  return (
    <Card>
      <CardHeader title="Sprint Category Distribution" />
      <CardContent>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            alignItems: isMobile ? "stretch" : "center",
            mb: 3,
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          <FormControl
            sx={{
              minWidth: isMobile ? "100%" : 220,
              flex: isMobile ? 1 : "auto",
            }}
            size="small"
          >
            <InputLabel id="radar-sprint-select-label">Sprint</InputLabel>
            <Select
              labelId="radar-sprint-select-label"
              value={selectedSprint ?? ""}
              label="Sprint"
              onChange={(e) => setSelectedSprint(Number(e.target.value))}
            >
              {sprints.map((sp) => (
                <MenuItem key={sp.sprintNumber} value={sp.sprintNumber}>
                  {`Sprint ${sp.sprintNumber} (${new Date(
                    sp.startDate,
                  ).toLocaleDateString()} - ${new Date(
                    sp.endDate,
                  ).toLocaleDateString()})`}
                </MenuItem>
              ))}
              {years.map((year) => (
                <MenuItem
                  key={10000 + year}
                  value={10000 + year}
                >{`Year ${year}`}</MenuItem>
              ))}
              <MenuItem key={1000} value={1000}>
                All time
              </MenuItem>
            </Select>
          </FormControl>
        </Box>

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
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "rgba(255,255,255,0.75)" }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: "rgba(255,255,255,0.75)" }}
              />
              <Radar
                name="% of Time"
                dataKey="value"
                stroke="#82ca9d"
                fill="#82ca9d"
                fillOpacity={0.6}
              />
              <Tooltip formatter={(value) => `${value}%`} />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
