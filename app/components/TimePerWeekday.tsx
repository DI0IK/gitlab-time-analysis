"use client";
import { Card, CardContent, CardHeader, useTheme } from "@mui/material";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GroupContext } from "../GroupContext";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function TimePerWeekday() {
  const { timelogs, members } = React.useContext(GroupContext);
  const theme = useTheme();

  const verifiedMemberIds = new Set(
    members.filter((m) => !m.bot && m.verified).map((m) => m.id.toLowerCase())
  );

  const dayTotals = DAYS.map(() => 0);

  timelogs.forEach((log) => {
    if (!verifiedMemberIds.has(log.username?.toString().toLowerCase() || "")) return;
    const date = new Date(log.spentAt);
    const day = date.getDay();
    const idx = day === 0 ? 6 : day - 1;
    dayTotals[idx] += log.timeSpent;
  });

  const chartData = DAYS.map((day, i) => ({
    day,
    hours: +(dayTotals[i] / 3600).toFixed(2),
  }));

  const isDark = theme.palette.mode === "dark";
  const tickColor = isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(15, 23, 42, 0.75)";
  const labelColor = isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.9)";
  const tooltipBg = isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)";
  const tooltipBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const tooltipTextColor = isDark ? "#f3f4f6" : "#0f172a";

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader title="Hours per weekday" />
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={true}
              vertical={false}
              opacity={0.3}
            />
            <XAxis dataKey="day" tick={{ fill: tickColor }} />
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
            <Bar dataKey="hours" fill="#8884d8" name="Hours" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
