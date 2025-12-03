"use client";
import React from "react";
import { GroupContext } from "../GroupContext";
import { BarChart } from "@mui/x-charts";
import SelectorCard from "./PersonSelectorWrapper";

export default function TimePerCategory() {
  const { timelogs, labels } = React.useContext(GroupContext);

  return (
    <SelectorCard
      title="Time Per Category"
      options={Object.keys(labels).map((c) => ({ label: c, value: c }))}
      defaultSelected={Object.keys(labels)[0] || ""}
      data={{
        timelogs,
        labels,
      }}
    >
      {(selectedCategory, { timelogs, labels }) => {
        if (!labels[selectedCategory]) {
          return <BarChart height={300} series={[]} xAxis={[{ data: [] }]} />;
        }
        const issuesTime: Record<
          string,
          { used: number; estimated: number; category: string }
        > = {};
        const issuesNotEstimatedTime: Record<
          string,
          { used: number; category: string }
        > = {};

        timelogs.forEach((log) => {
          if (
            log.issueLabels.some((label) =>
              label.startsWith(selectedCategory + "::")
            )
          ) {
            if (!log.issueTimeEstimate) {
              if (!issuesNotEstimatedTime[log.issueUrl]) {
                issuesNotEstimatedTime[log.issueUrl] = {
                  used: 0,
                  category:
                    labels[selectedCategory]?.find(
                      (lbl) =>
                        log.issueLabels.includes(
                          selectedCategory + "::" + lbl.title
                        ) || lbl.title === selectedCategory
                    )?.title || "Uncategorized",
                };
              }
              issuesNotEstimatedTime[log.issueUrl].used += log.timeSpent;
            } else {
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
          const relatedNotEstimatedIssues = Object.values(
            issuesNotEstimatedTime
          ).filter((it) => it.category === lbl.title);
          const usedNotEstimatedHours =
            relatedNotEstimatedIssues.reduce((sum, it) => sum + it.used, 0) /
            3600;
          return {
            label: lbl.title,
            usedHours: +usedHours.toFixed(2),
            estimatedHours: +estimatedHours.toFixed(2),
            usedNotEstimatedHours: +usedNotEstimatedHours.toFixed(2),
          };
        });

        return (
          <BarChart
            height={300}
            series={[
              {
                data: data.map((d) => d.usedHours),
                label: "Used Hours",
                barLabel: "value",
                stack: "a",
              },
              {
                data: data.map((d) => d.estimatedHours),
                label: "Estimated Hours",
                barLabel: "value",
                stack: "b",
              },
              {
                data: data.map((d) => d.usedNotEstimatedHours),
                label: "Used Hours (No Estimate)",
                barLabel: "value",
                stack: "a",
              },
            ]}
            grid={{ horizontal: true }}
            xAxis={[
              {
                data: labels[selectedCategory].map((lbl) => lbl.title),
              },
            ]}
          />
        );
      }}
    </SelectorCard>
  );
}
