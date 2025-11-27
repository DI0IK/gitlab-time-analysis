"use client";
import React from "react";
import { GroupContext } from "../GroupContext";
import { BarChart } from "@mui/x-charts";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";

export default function TimePerMember() {
  const { timelogs, members } = React.useContext(GroupContext);

  return (
    <Card>
      <CardHeader title="Total hours per member" />
      <CardContent>
        <BarChart
          height={300}
          series={[
            {
              data: members.map((member) => {
                const memberLogs = timelogs.filter(
                  (log) => log.username === member.id
                );
                const totalTime = memberLogs.reduce(
                  (sum, log) => sum + log.timeSpent,
                  0
                );
                return totalTime / 3600; // Convert to hours
              }),
              label: "Hours Logged",
            },
          ]}
          grid={{ horizontal: true }}
          xAxis={[
            {
              data: members.map((member) => member.name),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
