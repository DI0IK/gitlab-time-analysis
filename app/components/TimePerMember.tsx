"use client";
import React from "react";
import { GroupContext } from "../GroupContext";
import { BarChart } from "@mui/x-charts";
import SelectorCard from "./PersonSelectorWrapper";

export default function TimePerMember() {
  const { timelogs, members, labels } = React.useContext(GroupContext);

  return (
    <SelectorCard
      title="Time Per Member"
      options={Object.keys(labels).map((c) => ({ label: c, value: c }))}
      defaultSelected={
        Object.entries(labels).filter(([group, groupLabels]) =>
          groupLabels.some((l) => l.title.match(/req/i))
        )[0]?.[0] || ""
      }
      data={{
        timelogs,
        labels,
        members,
      }}
    >
      {(selectedCategoryGroup, { timelogs, labels, members }) => {
        return (
          <BarChart
            height={300}
            series={[
              ...(labels[selectedCategoryGroup] || []),
              { id: "Uncategorized", title: "Uncategorized" },
            ].map((category) => ({
              data: members
                .filter((m) => !m.bot)
                .map((member) => {
                  const memberLogs = timelogs.filter(
                    (log) =>
                      log.username === member.id &&
                      (log.issueLabels.some((label) => label === category.id) ||
                        (category.id === "Uncategorized" &&
                          !log.issueLabels.some((label) =>
                            labels[selectedCategoryGroup].some(
                              (lbl) => lbl.id === label
                            )
                          )))
                  );
                  const totalTime = memberLogs.reduce(
                    (sum, log) => sum + log.timeSpent,
                    0
                  );
                  return totalTime / 3600; // Convert to hours
                }),
              label: category.title,
              stack: "a",
            }))}
            grid={{ horizontal: true }}
            xAxis={[
              {
                data: members
                  .filter((m) => !m.bot)
                  .map((member) => member.name),
              },
            ]}
          />
        );
      }}
    </SelectorCard>
  );
}
