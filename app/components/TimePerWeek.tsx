"use client";
import React from "react";
import { GroupContext } from "../GroupContext";
import { BarChart } from "@mui/x-charts";
import { Card, CardContent, CardHeader } from "@mui/material";

export default function TimePerWeek() {
  const { sprints, timelogs, members } = React.useContext(GroupContext);

  // Sum timeSpent per sprint
  const sprintTotals: { sprintNumber: number; timeSpent: number }[] =
    sprints.map((sp) => ({ sprintNumber: sp.sprintNumber, timeSpent: 0 }));

  timelogs.forEach((log) => {
    const logDate = new Date(log.spentAt);
    const sprint = sprints.find(
      (sp) =>
        new Date(sp.startDate) <= logDate &&
        logDate <= new Date(new Date(sp.endDate).setHours(23, 59, 59, 999))
    );
    if (sprint) {
      const idx = sprintTotals.findIndex(
        (t) => t.sprintNumber === sprint.sprintNumber
      );
      if (idx >= 0) sprintTotals[idx].timeSpent += log.timeSpent;
    }
  });

  // Prepare data for BarChart
  const series = members.map((member) => {
    // Sum timeSpent per sprint for this member
    const memberSprintTotals = sprints.map((sp) => ({
      sprintNumber: sp.sprintNumber,
      timeSpent: 0,
    }));

    timelogs
      .filter((log) => log.username === member.id)
      .forEach((log) => {
        const logDate = new Date(log.spentAt);
        const sprint = sprints.find(
          (sp) =>
            new Date(sp.startDate) <= logDate &&
            logDate <= new Date(new Date(sp.endDate).setHours(23, 59, 59, 999))
        );
        if (sprint) {
          const idx = memberSprintTotals.findIndex(
            (t) => t.sprintNumber === sprint.sprintNumber
          );
          if (idx >= 0) memberSprintTotals[idx].timeSpent += log.timeSpent;
        }
      });

    return {
      label: member.name,
      data: memberSprintTotals.map((t) => +(t.timeSpent / 3600).toFixed(2)),
      stack: "Total",
    };
  });

  return (
    <Card>
      <CardHeader title="Total hours per sprint" />
      <CardContent>
        <BarChart
          series={series}
          height={300}
          xAxis={[
            {
              data: sprintTotals.map((t) => t.sprintNumber),
              label: "Sprint Number",
              tickLabelStyle: {
                fontSize: 10,
                angle: 90,
                textAnchor: "start",
              },
            },
          ]}
          grid={{ horizontal: true }}
          yAxis={[{ label: "Hours" }]}
        />
      </CardContent>
    </Card>
  );
}
