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
  const nonBotMembers = members.filter((m) => !m.bot);

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

  return (
    <Card>
      <CardHeader title="Total hours per sprint" />
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
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
