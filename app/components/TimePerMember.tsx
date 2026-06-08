"use client";
import { Card, CardContent, CardHeader, useMediaQuery, useTheme } from "@mui/material";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GroupContext } from "../GroupContext";
import { matchLabelToCategory } from "../utils/categoryUtils";
import { CATEGORY_DEFINITIONS } from "../config/categories";
import { useThemeMode } from "../ThemeContext";
// Dynamic category colors removed; using fixed palette

const PALETTE = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#a4de6c",
  "#d0ed57",
  "#8dd1e1",
  "#83a6ed",
  "#a893ed",
  "#e07b7b",
];

export default function TimePerMember() {
  const { timelogs, members } = React.useContext(GroupContext);
  const theme = useTheme();
  // colorTheme no longer used
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";

  const nonBotMembers = members.filter((m) => !m.bot && m.verified);

  const allCategories = [
    ...CATEGORY_DEFINITIONS.map((d, idx) => ({
      id: d.id,
      title: d.label,
      color: PALETTE[idx % PALETTE.length],
    })),
    { id: "other", title: "Other", color: PALETTE[CATEGORY_DEFINITIONS.length % PALETTE.length] },
  ];

  const chartData = nonBotMembers.map((member) => {
    const row: Record<string, number | string> = {
      name: member.name,
    };
    allCategories.forEach((cat) => {
      const memberLogs = timelogs.filter((log) => {
        if (log.username !== member.id) return false;
        if (cat.id === "other") {
          // Other: no matching category label
          return !(log.issueLabels || []).some(
            (label) => matchLabelToCategory(label) !== null,
          );
        }
        // Check if any of the issue's labels match this category
        return (log.issueLabels || []).some(
          (label) => matchLabelToCategory(label)?.id === cat.id,
        );
      });
      const totalTime = memberLogs.reduce(
        (sum, log) => sum + log.timeSpent,
        0,
      );
      row[cat.title] = +(totalTime / 3600).toFixed(2);
    });
    return row;
  });

  const otherTotal = chartData.reduce(
    (sum, row) => sum + ((row["Other"] as number) || 0),
    0,
  );
  const renderedCategories =
    otherTotal > 0
      ? allCategories
      : allCategories.filter((c) => c.id !== "other");

  const tickColor = isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(15, 23, 42, 0.75)";
  const labelColor = isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.9)";
  const tooltipBg = isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)";
  const tooltipBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const tooltipTextColor = isDark ? "#f3f4f6" : "#0f172a";

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader title="Time Per Member" />
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={true}
              vertical={false}
              opacity={0.3}
            />
            <XAxis dataKey="name" tick={{ fill: tickColor }} />
            <YAxis
              tick={{ fill: tickColor }}
              label={{ value: "Hours", angle: -90, position: "insideLeft", fill: labelColor }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 8,
                color: tooltipTextColor,
                fontSize: 13,
              }}
            />
            {!isSmall && <Legend verticalAlign="top" height={36} />}
            {renderedCategories.map((cat) => (
              <Bar
                key={cat.id}
                dataKey={cat.title}
                stackId="a"
                fill={cat.color}
                name={cat.title}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
