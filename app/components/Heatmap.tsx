import React from "react";
import { GroupContext } from "../GroupContext";
import SelectorCard from "./PersonSelectorWrapper";

export default function Heatmap() {
  const { members, sprints, timelogs } = React.useContext(GroupContext);

  return (
    <SelectorCard
      title="Heatmap"
      options={[
        ...members.map((m) => ({ label: m.name, value: m.id })),
        { value: "all", label: "All Members" },
      ]}
      defaultSelected="all"
      data={{ sprints, timelogs }}
    >
      {(selected, { sprints, timelogs }) => {
        const filteredTimelogs =
          selected === "all"
            ? timelogs
            : timelogs.filter((log) => log.username.toString() === selected);

        const heatmapData: {
          [sprint: string]: {
            [weekday: string]: { timeSpent: number; date: string };
          };
        } = {};

        sprints.forEach((sprint) => {
          heatmapData[sprint.sprintNumber.toString()] = {};
        });

        for (
          let d = new Date(sprints[0]?.startDate);
          d <=
          new Date(
            new Date(sprints[sprints.length - 1]?.endDate).setHours(
              23,
              59,
              59,
              999
            )
          );
          d.setDate(d.getDate() + 1)
        ) {
          const sprint = sprints.find(
            (sp) =>
              new Date(sp.startDate) <= d &&
              d <= new Date(new Date(sp.endDate).setHours(23, 59, 59, 999))
          );
          if (sprint) {
            const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
            heatmapData[sprint.sprintNumber.toString()][weekday] = {
              timeSpent: 0,
              date: d.toISOString().split("T")[0],
            };
          }
        }

        filteredTimelogs.forEach((log) => {
          const logDate = new Date(log.spentAt);
          const sprint = sprints.find(
            (sp) =>
              new Date(sp.startDate) <= logDate &&
              logDate <=
                new Date(new Date(sp.endDate).setHours(23, 59, 59, 999))
          );
          if (sprint) {
            const weekday = logDate.toLocaleDateString("en-US", {
              weekday: "long",
            });
            if (
              heatmapData[sprint.sprintNumber.toString()] &&
              heatmapData[sprint.sprintNumber.toString()][weekday]
            ) {
              heatmapData[sprint.sprintNumber.toString()][weekday].timeSpent +=
                log.timeSpent;
            } else {
              console.warn(
                `Timelog date ${log.spentAt} does not map to any sprint weekday cell.`
              );
            }
          }
        });

        // compute overall max to scale colors
        let overallMax = 0;
        Object.values(heatmapData).forEach((sprintObj) =>
          Object.values(sprintObj).forEach((cell) => {
            if (cell.timeSpent > overallMax) overallMax = cell.timeSpent;
          })
        );
        if (overallMax === 0) overallMax = 1;

        const getCellStyle = (value: number, date: Date) => {
          const ratio = Math.min(1, value / overallMax);
          const opacity = value === 0 ? 0.06 : 0.2 + 0.8 * ratio;
          return {
            width: 28,
            height: 28,
            borderRadius: 4,
            border: (() => {
              const today = new Date();
              const cellDate = date;
              if (
                today.getFullYear() === cellDate.getFullYear() &&
                today.getMonth() === cellDate.getMonth() &&
                today.getDate() === cellDate.getDate()
              ) {
                return "2px solid #3b82f6";
              }
              return "none";
            })(),
            background: `rgba(33,110,57,${opacity})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: ratio > 0.5 ? "#fff" : "#000",
          } as React.CSSProperties;
        };

        const weekdayKeys = Object.keys(
          heatmapData[sprints[0]?.sprintNumber.toString()] || {}
        );
        const weekdayCount = Math.max(weekdayKeys.length, 7);

        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `auto repeat(${sprints.length}, auto)`,
              gridTemplateRows: `auto repeat(${weekdayCount}, 28px)`,
              gap: 4,
              overflowX: "auto",
              overflowY: "hidden",
              marginTop: 16,
              paddingBottom: 16,
            }}
          >
            <div style={{ gridRow: 1, gridColumn: 1 }} />
            {weekdayKeys.map((weekday, idx) => (
              <div
                key={weekday}
                style={{
                  gridRow: idx + 2,
                  gridColumn: 1,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  marginBottom: 4,
                }}
              >
                {weekday.slice(0, 3)}
              </div>
            ))}

            {Object.entries(heatmapData).map(
              ([sprintNumber, days], sprintIdx) => (
                <React.Fragment key={sprintNumber}>
                  <div
                    style={{
                      gridRow: 1,
                      gridColumn: sprintIdx + 2,
                      fontWeight: "bold",
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      fontSize: 10,
                    }}
                  >
                    <div>
                      {new Date(sprints[sprintIdx]?.startDate)
                        .getFullYear()
                        .toString()}
                    </div>
                    <div>{sprintNumber}</div>
                  </div>
                  {Object.keys(days).map((weekday, dayIdx) => (
                    <div
                      key={weekday}
                      style={{
                        gridRow: dayIdx + 2,
                        gridColumn: sprintIdx + 2,
                      }}
                      title={`${days[weekday].date}: ${days[weekday].timeSpent} hrs`}
                    >
                      <div
                        style={getCellStyle(
                          days[weekday].timeSpent,
                          new Date(days[weekday].date)
                        )}
                        title={
                          new Date(days[weekday].date).toDateString() +
                          ": " +
                          (days[weekday].timeSpent / 3600).toFixed(2) +
                          " hrs"
                        }
                      ></div>
                    </div>
                  ))}
                </React.Fragment>
              )
            )}
          </div>
        );
      }}
    </SelectorCard>
  );
}
