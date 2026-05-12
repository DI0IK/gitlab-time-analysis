"use client";
import { useMediaQuery, useTheme } from "@mui/material";
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
import SelectorCard from "./PersonSelectorWrapper";

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
  const { timelogs, members, labels } = React.useContext(GroupContext);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <SelectorCard
      title="Time Per Member"
      options={Object.keys(labels).map((c) => ({ label: c, value: c }))}
      defaultSelected={
        Object.entries(labels).filter(([_group, groupLabels]) =>
          groupLabels.some((l) => l.title.match(/req/i)),
        )[0]?.[0] || ""
      }
      data={{
        timelogs,
        labels,
        members,
      }}
    >
      {(selectedCategoryGroup, { timelogs, labels, members }) => {
        const nonBotMembers = members.filter((m) => !m.bot);
        const allCategories = [
          ...(labels[selectedCategoryGroup] || []),
          { id: "Uncategorized", title: "Uncategorized" },
        ];

        const chartData = nonBotMembers.map((member) => {
          const row: Record<string, number | string> = {
            name: member.name,
          };
          allCategories.forEach((category) => {
            const memberLogs = timelogs.filter(
              (log) =>
                log.username === member.id &&
                ((log.issueLabels || []).some(
                  (label) => label === category.id,
                ) ||
                  (category.id === "Uncategorized" &&
                    !(log.issueLabels || []).some((label) =>
                      (labels[selectedCategoryGroup] || []).some(
                        (lbl) => lbl.id === label,
                      ),
                    ))),
            );
            const totalTime = memberLogs.reduce(
              (sum, log) => sum + log.timeSpent,
              0,
            );
            row[category.title] = +(totalTime / 3600).toFixed(2);
          });
          return row;
        });

        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={true}
                vertical={false}
                opacity={0.3}
              />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.75)" }} />
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
              {!isSmall && <Legend verticalAlign="top" height={36} />}
              {allCategories.map((category, i) => (
                <Bar
                  key={category.id || category.title}
                  dataKey={category.title}
                  stackId="a"
                  fill={PALETTE[i % PALETTE.length]}
                  name={category.title}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      }}
    </SelectorCard>
  );
}
