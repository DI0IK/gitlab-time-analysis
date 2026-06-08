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

const PALETTE = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#a4de6c",
  "#d0ed57", "#8dd1e1", "#83a6ed", "#a893ed", "#e07b7b",
];

export default function TimePerWeek() {
  const { sprints, timelogs, members } = React.useContext(GroupContext);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const nonBotMembers = members.filter((m) => !m.bot && m.verified);

  const inSprint = (
    log: (typeof timelogs)[number],
    sprint: (typeof sprints)[number],
  ) => {
    const logDate = new Date(log.spentAt);
    return (
      new Date(sprint.startDate) <= logDate &&
      logDate <= new Date(new Date(sprint.endDate).setHours(23, 59, 59, 999))
    );
  };

  const chartData = sprints.map((sp) => {
    const row: Record<string, number | string> = {
      sprint: sp.sprintNumber,
    };
    nonBotMembers.forEach((m) => {
      const total = timelogs
        .filter((log) => log.username === m.id && inSprint(log, sp))
        .reduce((sum, log) => sum + log.timeSpent, 0);
      row[m.id] = +(total / 3600).toFixed(2);
    });
    return row;
  });

  const isDark = theme.palette.mode === "dark";
  const tickColor = isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(15, 23, 42, 0.75)";
  const labelColor = isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.9)";
  const tooltipBg = isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)";
  const tooltipBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const tooltipTextColor = isDark ? "#f3f4f6" : "#0f172a";

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader title="Total hours per cycle" />
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={true}
              vertical={false}
              opacity={0.3}
            />
            <XAxis dataKey="sprint" tick={{ fill: tickColor, fontSize: 11 }} />
            <YAxis tick={{ fill: tickColor }} label={{ value: "Hours", angle: -90, position: "insideLeft", fill: labelColor }} />
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
            {nonBotMembers.map((m, i) => (
              <Bar
                key={m.id}
                dataKey={m.id}
                stackId="total"
                fill={PALETTE[i % PALETTE.length]}
                name={m.name}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
