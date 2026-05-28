import React from "react";
import { GroupTimelogsResponse } from "../api/group/[id]/timelogs/route";
import { GroupMembersResponse } from "../api/group/[id]/members/route";
import { CATEGORY_DEFINITIONS } from "../config/categories";
import { matchLabelToCategory } from "../utils/categoryUtils";

export default function SprintOverview({
  timelogs,
  members,
  sprintNumber,
}: React.PropsWithChildren<{
  timelogs: GroupTimelogsResponse;
  members: GroupMembersResponse;
  sprintNumber: number;
}>) {
  const selectedSprint = sprintNumber;

  const categoryColumns = [
    ...CATEGORY_DEFINITIONS.map((d) => ({ id: d.id, title: d.label })),
    { id: "other", title: "Other" },
  ];

  // Build a map: memberId -> column -> timeSpent (seconds)
  const tableData: Record<string, Record<string, number>> = {};

  members
    .filter((m) => !m.bot)
    .forEach((m) => {
      tableData[m.id] = {};
      categoryColumns.forEach((c) => (tableData[m.id][c.id] = 0));
      tableData[m.id]["__sum"] = 0;
    });

  // Helper: determine if a timelog belongs to the selected sprint
  const inSelectedSprint = (log: GroupTimelogsResponse[number]) =>
    log.sprintNumber === selectedSprint ||
    selectedSprint === 1000 ||
    (selectedSprint &&
      selectedSprint >= 10000 &&
      log.spentAt.startsWith((selectedSprint - 10000).toString()));

  timelogs.forEach((logRaw) => {
    const log = logRaw as GroupTimelogsResponse[number];
    if (!inSelectedSprint(log)) return;
    const memberId = log.username || "unknown";
    if (!tableData[memberId]) {
      tableData[memberId] = {};
      categoryColumns.forEach((c) => (tableData[memberId][c.id] = 0));
      tableData[memberId]["__sum"] = 0;
    }

    let assignedColumn = "other";
    for (const label of log.issueLabels || []) {
      const catDef = matchLabelToCategory(label);
      if (catDef) {
        assignedColumn = catDef.id;
        break;
      }
    }

    if (!tableData[memberId][assignedColumn])
      tableData[memberId][assignedColumn] = 0;
    tableData[memberId][assignedColumn] += log.timeSpent;
    tableData[memberId]["__sum"] += log.timeSpent;
  });

  // Column sums
  const columnSums: Record<string, number> = {};
  categoryColumns.forEach((g) => (columnSums[g.id] = 0));
  columnSums["__sum"] = 0;

  Object.values(tableData).forEach((groupMap) => {
    categoryColumns.forEach((g) => {
      columnSums[g.id] = (columnSums[g.id] || 0) + (groupMap[g.id] || 0);
    });
    columnSums["__sum"] += groupMap["__sum"] || 0;
  });

  if (columnSums["other"] === 0) {
    const index = categoryColumns.findIndex((c) => c.id === "other");
    if (index > -1) {
      categoryColumns.splice(index, 1);
      delete columnSums["other"];
      Object.keys(tableData).forEach((memberId) => {
        delete tableData[memberId]["other"];
      });
    }
  }

  const visibleColumns = categoryColumns;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "white",
        fontFamily: "Inter",
        border: "1px solid #ccc",
      }}
    >
      {/* HEADER ROW */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          backgroundColor: "#f3f4f6",
          borderBottom: "1px solid #ccc",
        }}
      >
        <div
          style={{
            flex: 2,
            padding: "8px",
            borderRight: "1px solid #ccc",
            fontWeight: "bold",
          }}
        >
          Member
        </div>
        {visibleColumns.map((col) => (
          <div
            key={col.id}
            style={{
              flex: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRight: "1px solid #ccc",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            {col.title}
          </div>
        ))}
        <div
          style={{
            flex: 1,
            textAlign: "center",
            padding: "8px",
            fontWeight: "bold",
          }}
        >
          Sum (hrs)
        </div>
      </div>

      {/* DATA ROWS */}
      {Object.keys(tableData).map((memberId) => {
        const member = members.find((m) => m.id === memberId);
        return (
          <div
            key={memberId}
            style={{
              display: "flex",
              flexDirection: "row",
              borderBottom: "1px solid #ccc",
            }}
          >
            <div
              style={{
                flex: 2,
                padding: "8px",
                borderRight: "1px solid #ccc",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {member ? member.name : memberId}
            </div>
            {visibleColumns.map((col) => (
              <div
                key={col.id}
                style={{
                  flex: 1.5,
                  textAlign: "right",
                  padding: "8px",
                  borderRight: "1px solid #ccc",
                }}
              >
                {((tableData[memberId][col.id] || 0) / 3600).toFixed(2)}
              </div>
            ))}
            <div
              style={{
                flex: 1,
                textAlign: "right",
                padding: "8px",
                backgroundColor: "#f9f9f9",
              }}
            >
              {((tableData[memberId]["__sum"] || 0) / 3600).toFixed(2)}
            </div>
          </div>
        );
      })}

      {/* TOTALS ROW */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          backgroundColor: "#fafafa",
          fontWeight: "bold",
        }}
      >
        <div
          style={{
            flex: 2,
            padding: "8px",
            borderRight: "1px solid #ccc",
          }}
        >
          Total
        </div>
        {visibleColumns.map((col) => (
          <div
            key={col.id}
            style={{
              flex: 1.5,
              textAlign: "right",
              padding: "8px",
              borderRight: "1px solid #ccc",
            }}
          >
            {(columnSums[col.id] / 3600).toFixed(2)}
          </div>
        ))}
        <div
          style={{
            flex: 1,
            textAlign: "right",
            padding: "8px",
          }}
        >
          {(columnSums["__sum"] / 3600).toFixed(2)}
        </div>
      </div>
    </div>
  );
}
