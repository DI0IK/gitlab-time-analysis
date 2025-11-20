"use client";
import React from "react";
import { GroupContext } from "../GroupContext";
import { BarChart } from "@mui/x-charts";
import SelectorCard from "./PersonSelectorWrapper";

export default function TimePerCategory() {
  const { sprints, timelogs, members, labels } = React.useContext(GroupContext);

  if (!labels || Object.keys(labels).length === 0) {
    return <div>No labels data available.</div>;
  }

  const categoryGroups = Object.keys(labels);

  return (
    <SelectorCard
      title="Time Per Category"
      options={categoryGroups.map((c) => ({ label: c, value: c }))}
      defaultSelected={categoryGroups[0] || ""}
    >
      {(selectedCategory) => {
        const issuesTime: Record<
          string,
          { used: number; estimated: number; category: string }
        > = {};

        timelogs.forEach((log) => {
          if (
            log.issueLabels.some((label) =>
              label.startsWith(selectedCategory + "::")
            )
          ) {
            if (!issuesTime[log.issueUrl]) {
              issuesTime[log.issueUrl] = {
                used: 0,
                estimated: log.issueTimeEstimate,
                category:
                  labels[selectedCategory]?.find(
                    (lbl) =>
                      log.issueLabels.includes(
                        selectedCategory + "::" + lbl.title
                      ) || lbl.title === selectedCategory
                  )?.title || "Uncategorized",
              };
            }
            issuesTime[log.issueUrl].used += log.timeSpent;
          }
        });

        const data = labels[selectedCategory].map((lbl) => {
          const relatedIssues = Object.values(issuesTime).filter(
            (it) => it.category === lbl.title
          );
          const usedHours =
            relatedIssues.reduce((sum, it) => sum + it.used, 0) / 3600;
          const estimatedHours =
            relatedIssues.reduce((sum, it) => sum + it.estimated, 0) / 3600;
          return {
            label: lbl.title,
            usedHours: +usedHours.toFixed(2),
            estimatedHours: +estimatedHours.toFixed(2),
          };
        });

        return (
          <BarChart
            height={300}
            series={[
              { data: data.map((d) => d.usedHours), label: "Used Hours" },
              {
                data: data.map((d) => d.estimatedHours),
                label: "Estimated Hours",
              },
            ]}
            xAxis={[{ data: labels[selectedCategory].map((lbl) => lbl.title) }]}
          />
        );
      }}
    </SelectorCard>
  );
}
