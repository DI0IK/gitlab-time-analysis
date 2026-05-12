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

export default function SprintRadar() {
  const { sprints, timelogs, labels } = React.useContext(GroupContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const availableGroups = Object.keys(labels || {});

  const [selectedSprint, setSelectedSprint] = React.useState<number | null>(
    sprints.find(
      (sp) =>
        sp.startDate <= new Date().toISOString().slice(0, 10) &&
        new Date().toISOString().slice(0, 10) <= sp.endDate,
    )?.sprintNumber ?? null,
  );
  const [selectedLabelGroup, setSelectedLabelGroup] = React.useState<
    string | null
  >(availableGroups[0] ?? null);

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

  React.useEffect(() => {
    if (availableGroups.length && !selectedLabelGroup) {
      const labelGroup =
        Object.entries(labels).filter(([_group, groupLabels]) =>
          groupLabels.some((l) => l.title.match(/req/i)),
        )[0]?.[0] || availableGroups[0];
      if (availableGroups.includes(labelGroup)) {
        setSelectedLabelGroup(labelGroup);
      }
    }
  }, [availableGroups, labels, selectedLabelGroup]);

  const inSelectedSprint = (log: (typeof timelogs)[number]) =>
    log.sprintNumber === selectedSprint ||
    selectedSprint === 1000 ||
    (selectedSprint !== null &&
      selectedSprint >= 10000 &&
      log.spentAt.startsWith((selectedSprint - 10000).toString()));

  const filteredLogs = selectedSprint ? timelogs.filter(inSelectedSprint) : [];

  // Initialize all subcategories from the label group (including Ungrouped) to 0
  const allSubcategories =
    selectedLabelGroup && labels[selectedLabelGroup]
      ? [...labels[selectedLabelGroup].map((l) => l.title), "Ungrouped"]
      : ["Ungrouped"];

  const subcategoryTotals: Record<string, number> = {};
  allSubcategories.forEach((sub) => {
    subcategoryTotals[sub] = 0;
  });

  // Add timelog data
  filteredLogs.forEach((log) => {
    if (selectedLabelGroup) {
      const match = (log.issueLabels || []).find((il) =>
        il.startsWith(`${selectedLabelGroup}::`),
      );
      const subcategory = match
        ? match.split("::").slice(1).join("::") || "Ungrouped"
        : "Ungrouped";
      subcategoryTotals[subcategory] =
        (subcategoryTotals[subcategory] || 0) + log.timeSpent;
    } else {
      subcategoryTotals.Ungrouped =
        (subcategoryTotals.Ungrouped || 0) + log.timeSpent;
    }
  });

  const totalSeconds = Object.values(subcategoryTotals).reduce(
    (a, b) => a + b,
    0,
  );

  const radarData = allSubcategories
    .map((sub) => ({
      subject: sub,
      value:
        totalSeconds > 0
          ? +((subcategoryTotals[sub] / totalSeconds) * 100).toFixed(1)
          : 0,
      hours: +(subcategoryTotals[sub] / 3600).toFixed(1),
    }))
    .sort((a, b) => b.value - a.value);

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
          <FormControl
            sx={{
              minWidth: isMobile ? "100%" : 220,
              flex: isMobile ? 1 : "auto",
            }}
            size="small"
          >
            <InputLabel id="radar-split-select-label">Split by</InputLabel>
            <Select
              labelId="radar-split-select-label"
              value={selectedLabelGroup ?? ""}
              label="Split by"
              onChange={(e) => setSelectedLabelGroup(e.target.value as string)}
            >
              {availableGroups.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
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
        ) : radarData.length === 0 ? (
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
              <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.75)" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.75)" }} />
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
