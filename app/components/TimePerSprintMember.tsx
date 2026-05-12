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

  return (
    <SelectorCard
      title="Hours per sprint per member"
      options={[
        ...members
          .filter((m) => !m.bot)
          .map((m) => ({ label: m.name, value: m.id, member: m })),
        { value: "all", label: "All Members" },
      ]}
      defaultSelected="all"
      data={{ sprints, timelogs }}
    >
      {(selected, { sprints, timelogs }) => {
        const filteredMembers =
          selected === "all"
            ? members.filter((m) => !m.bot)
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
              <XAxis dataKey="sprint" tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 11 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.75)" }} label={{ value: "Hours", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.9)" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(30, 30, 30, 0.95)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 8,
                  color: "#fff",
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
                name="3-Sprint Avg"
              />
            </LineChart>
          </ResponsiveContainer>
        );
      }}
    </SelectorCard>
  );
}
