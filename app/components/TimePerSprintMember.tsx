"use client";
import { Typography, useMediaQuery, useTheme } from "@mui/material";
import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GroupContext } from "../GroupContext";
import SelectorCard from "./PersonSelectorWrapper";

const PALETTE = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#a4de6c",
  "#d0ed57", "#8dd1e1", "#83a6ed", "#a893ed", "#e07b7b",
];

export default function TimePerSprintMember() {
  const { sprints, timelogs, members } = React.useContext(GroupContext);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));

  const isDark = theme.palette.mode === "dark";
  const tickColor = isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(15, 23, 42, 0.75)";
  const labelColor = isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.9)";
  const tooltipBg = isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)";
  const tooltipBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const tooltipTextColor = isDark ? "#f3f4f6" : "#0f172a";

  return (
    <SelectorCard
      title="Hours per cycle per member"
      options={[
        ...members
          .filter((m) => !m.bot && m.verified)
          .map((m) => ({ label: m.name, value: m.id, member: m })),
        { value: "all", label: "All Members" },
      ]}
      defaultSelected="all"
      data={{ sprints, timelogs }}
    >
      {(selected, { sprints, timelogs }) => {
        const filteredMembers =
          selected === "all"
            ? members.filter((m) => !m.bot && m.verified)
            : members.filter((m) => m.id === selected);

        if (filteredMembers.length === 0 || sprints.length === 0) {
          return (
            <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
              No data available.
            </Typography>
          );
        }

        const chartData = sprints.map((sp) => {
          const row: Record<string, number | string> = {
            sprint: sp.sprintNumber,
          };
          filteredMembers.forEach((m) => {
            const total = timelogs
              .filter(
                (log) =>
                  log.username === m.id && log.sprintNumber === sp.sprintNumber,
              )
              .reduce((sum, log) => sum + log.timeSpent, 0);
            row[m.id] = +(total / 3600).toFixed(2);
          });
          return row;
        });

        const memberIds = filteredMembers.map((m) => m.id);
        const sprintTotals = chartData.map((row) => {
          const sum = memberIds.reduce((s, id) => s + (row[id] as number), 0);
          return sum / memberIds.length;
        });
        chartData.forEach((row, i) => {
          const start = Math.max(0, i - 1);
          const end = Math.min(sprintTotals.length - 1, i + 1);
          const count = end - start + 1;
          const sum = sprintTotals.slice(start, end + 1).reduce((a, b) => a + b, 0);
          (row as Record<string, number | string>).movingAvg = +((sum / count).toFixed(2));
        });

        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
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
              {filteredMembers.map((m, i) => (
                <Line
                  key={m.id}
                  type="monotone"
                  dataKey={m.id}
                  stroke={PALETTE[i % PALETTE.length]}
                  name={m.name}
                  dot={selected !== "all"}
                  strokeWidth={2}
                  opacity={selected === "all" ? 0.35 : 1}
                />
              ))}
              <Line
                type="monotone"
                dataKey="movingAvg"
                stroke="#ff7300"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="3-Cycle Avg"
              />
            </LineChart>
          </ResponsiveContainer>
        );
      }}
    </SelectorCard>
  );
}
