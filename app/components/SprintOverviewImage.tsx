import React from "react";
import { GroupLabelsResponse } from "../api/group/[id]/labels/route";
import { GroupTimelogsResponse } from "../api/group/[id]/timelogs/route";
import { GroupMembersResponse } from "../api/group/[id]/members/route";

export default function SprintOverview({
  timelogs,
  members,
  labels,
  sprintNumber,
  labelGroup,
}: React.PropsWithChildren<{
  timelogs: GroupTimelogsResponse;
  members: GroupMembersResponse;
  labels: GroupLabelsResponse;
  sprintNumber: number;
  labelGroup: string;
}>) {
  const selectedSprint = sprintNumber;
  const selectedLabelGroup = labelGroup;

  // Determine columns: if a label group is selected, show its label titles as columns
  const labelColumns: string[] = selectedLabelGroup
    ? (labels[selectedLabelGroup] || ([] as GroupLabelsResponse[string])).map(
        (l) => l.title
      )
    : Object.keys(labels || {});

  // Ensure Ungrouped column exists for items without a matching label
  if (!labelColumns.includes("Ungrouped")) labelColumns.push("Ungrouped");

  // Build a map: memberId -> column -> timeSpent (seconds)
  const tableData: Record<string, Record<string, number>> = {};

  members.forEach((m) => {
    tableData[m.id] = {};
    labelColumns.forEach((c) => (tableData[m.id][c] = 0));
    tableData[m.id]["__sum"] = 0;
  });

  // Helper: determine if a timelog belongs to the selected sprint
  const inSelectedSprint = (log: GroupTimelogsResponse[number]) =>
    log.sprintNumber === selectedSprint;

  timelogs.forEach((logRaw) => {
    const log = logRaw as GroupTimelogsResponse[number];
    if (!inSelectedSprint(log)) return;
    const memberId = log.username || "unknown";
    if (!tableData[memberId]) {
      // ensure unknown members are present
      tableData[memberId] = {};
      labelColumns.forEach((c) => (tableData[memberId][c] = 0));
      tableData[memberId]["__sum"] = 0;
    }

    let assignedColumn = "Ungrouped";
    if (selectedLabelGroup) {
      // find the first label in the timelog that belongs to the selected group
      const match = (log.issueLabels || []).find((il: string) =>
        il.startsWith(selectedLabelGroup + "::")
      );
      if (match) {
        assignedColumn = match.split("::").slice(1).join("::") || "Ungrouped";
      }
    } else {
      // if no specific group selected, place into 'Ungrouped' (shouldn't happen because select defaults)
      assignedColumn = "Ungrouped";
    }

    if (!tableData[memberId][assignedColumn])
      tableData[memberId][assignedColumn] = 0;
    tableData[memberId][assignedColumn] += log.timeSpent;
    tableData[memberId]["__sum"] += log.timeSpent;
  });

  // Column sums
  const columnSums: Record<string, number> = {};
  labelColumns.forEach((g) => (columnSums[g] = 0));
  columnSums["__sum"] = 0;

  Object.values(tableData).forEach((groupMap) => {
    labelColumns.forEach((g) => {
      columnSums[g] = (columnSums[g] || 0) + (groupMap[g] || 0);
    });
    columnSums["__sum"] += groupMap["__sum"] || 0;
  });

  if (columnSums["Ungrouped"] === 0) {
    // Remove Ungrouped column if empty
    const index = labelColumns.indexOf("Ungrouped");
    if (index > -1) {
      labelColumns.splice(index, 1);
      delete columnSums["Ungrouped"];
      Object.keys(tableData).forEach((memberId) => {
        delete tableData[memberId]["Ungrouped"];
      });
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column", // Stacks rows vertically
        width: "100%",
        backgroundColor: "white", // Important: Satori default transparent
        fontFamily: "Inter",
        border: "1px solid #ccc", // Outer border
      }}
    >
      {/* HEADER ROW */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          backgroundColor: "#f3f4f6", // Light gray header
          borderBottom: "1px solid #ccc",
        }}
      >
        {/* Empty Header for Name Column */}
        <div
          style={{
            flex: 2, // Wider for the name column
            padding: "8px",
            borderRight: "1px solid #ccc",
            fontWeight: "bold",
          }}
        >
          Member
        </div>

        {/* Dynamic Header Columns */}
        {labelColumns.map((g: string) => (
          <div
            key={g}
            style={{
              flex: 1.5, // Increased from 1 to 1.5 for wider columns
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRight: "1px solid #ccc",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            {g}
          </div>
        ))}

        {/* Sum Header */}
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
              borderBottom: "1px solid #ccc", // Row divider
            }}
          >
            {/* Name Cell */}
            <div
              style={{
                flex: 2, // Matches header flex
                padding: "8px",
                borderRight: "1px solid #ccc",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {member ? member.name : memberId}
            </div>

            {/* Dynamic Data Cells */}
            {labelColumns.map((g: string) => (
              <div
                key={g}
                style={{
                  flex: 1.5, // Matches header flex
                  textAlign: "right",
                  padding: "8px",
                  borderRight: "1px solid #ccc",
                }}
              >
                {((tableData[memberId][g] || 0) / 3600).toFixed(2)}
              </div>
            ))}

            {/* Sum Cell */}
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
        {labelColumns.map((g: string) => (
          <div
            key={g}
            style={{
              flex: 1.5,
              textAlign: "right",
              padding: "8px",
              borderRight: "1px solid #ccc",
            }}
          >
            {(columnSums[g] / 3600).toFixed(2)}
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
