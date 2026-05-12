"use client";
import { Card, CardContent, CardHeader } from "@mui/material";
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
  const { timelogs } = React.useContext(GroupContext);

  const dayTotals = DAYS.map(() => 0);

  timelogs.forEach((log) => {
    const date = new Date(log.spentAt);
    const day = date.getDay();
    const idx = day === 0 ? 6 : day - 1;
    dayTotals[idx] += log.timeSpent;
  });

  const chartData = DAYS.map((day, i) => ({
    day,
    hours: +(dayTotals[i] / 3600).toFixed(2),
  }));

  return (
    <Card>
      <CardHeader title="Hours per weekday" />
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={true}
              vertical={false}
              opacity={0.3}
            />
            <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.75)" }} />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.75)" }}
              label={{ value: "Hours", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.9)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(30, 30, 30, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 8,
                color: "#fff",
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
