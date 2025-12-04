"use client";
import React from "react";
import { GroupContext } from "../GroupContext";
import Box from "@mui/material/Box";
import {
  Card,
  CardContent,
  CardHeader,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Accordion,
  AccordionSummary,
  Typography,
  AccordionDetails,
} from "@mui/material";
import { GroupLabelsResponse } from "../api/group/[id]/labels/route";
import { GroupTimelogsResponse } from "../api/group/[id]/timelogs/route";
import Label from "./Label";
import ShareIcon from "@mui/icons-material/Share";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export default function SprintOverview() {
  const { sprints, timelogs, members, labels, groupId } =
    React.useContext(GroupContext);

  const [selectedSprint, setSelectedSprint] = React.useState<number | null>(
    sprints.find(
      (sp) =>
        sp.startDate <= new Date().toISOString().slice(0, 10) &&
        new Date().toISOString().slice(0, 10) <= sp.endDate
    )?.sprintNumber ?? null
  );

  const availableGroups = Object.keys(labels || {});
  const [selectedLabelGroup, setSelectedLabelGroup] = React.useState<
    string | null
  >(availableGroups[0] ?? null);

  React.useEffect(() => {
    if (availableGroups.length && !selectedLabelGroup) {
      setSelectedLabelGroup(availableGroups[0]);
    }
    // if the previously selected group was removed, pick first available
    if (selectedLabelGroup && !availableGroups.includes(selectedLabelGroup)) {
      setSelectedLabelGroup(availableGroups[0] ?? null);
    }
  }, [availableGroups, selectedLabelGroup]);

  React.useEffect(() => {
    if (sprints.length && selectedSprint === null) {
      setSelectedSprint(
        sprints.find(
          (sp) =>
            sp.startDate <= new Date().toISOString().slice(0, 10) &&
            new Date().toISOString().slice(0, 10) <= sp.endDate
        )?.sprintNumber ?? null
      );
    }
  }, [sprints, selectedSprint]);

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

  members
    .filter((m) => !m.bot)
    .forEach((m) => {
      tableData[m.id] = {};
      labelColumns.forEach((c) => (tableData[m.id][c] = 0));
      tableData[m.id]["__sum"] = 0;
    });

  // Helper: determine if a timelog belongs to the selected sprint
  const inSelectedSprint = (log: GroupTimelogsResponse[number]) =>
    log.sprintNumber === selectedSprint || selectedSprint === 1000;

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

  const sprintIssues = React.useMemo(() => {
    if (selectedSprint === null) return {};
    if (selectedSprint === 1000) {
      const issuesMap: Record<
        string,
        { title: string; url: string; timelogs: GroupTimelogsResponse }
      > = {};
      timelogs.forEach((log) => {
        if (!issuesMap[log.issueUrl]) {
          issuesMap[log.issueUrl] = {
            title: log.issueTitle,
            url: log.issueUrl,
            timelogs: [],
          };
        }
        issuesMap[log.issueUrl].timelogs.push(log);
      });
      return issuesMap;
    }
    const timelogsInSprint = timelogs.filter(
      (log) => log.sprintNumber === selectedSprint
    ) as GroupTimelogsResponse;
    const issuesMap: Record<
      string,
      { title: string; url: string; timelogs: GroupTimelogsResponse }
    > = {};
    timelogsInSprint.forEach((log) => {
      if (!issuesMap[log.issueUrl]) {
        issuesMap[log.issueUrl] = {
          title: log.issueTitle,
          url: log.issueUrl,
          timelogs: [],
        };
      }
      issuesMap[log.issueUrl].timelogs.push(log);
    });
    return issuesMap;
  }, [timelogs, selectedSprint]);

  return (
    <Card>
      <CardHeader title="Sprint overview" />
      <CardContent sx={{ overflowX: "auto" }}>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
          <FormControl sx={{ minWidth: 220 }} size="small">
            <InputLabel id="sprint-select-label">Sprint</InputLabel>
            <Select
              labelId="sprint-select-label"
              value={selectedSprint ?? ""}
              label="Sprint"
              onChange={(e) => setSelectedSprint(Number(e.target.value))}
            >
              {sprints.map((sp) => (
                <MenuItem key={sp.sprintNumber} value={sp.sprintNumber}>
                  {`Sprint ${sp.sprintNumber} (${new Date(
                    sp.startDate
                  ).toLocaleDateString()} - ${new Date(
                    sp.endDate
                  ).toLocaleDateString()})`}
                </MenuItem>
              ))}
              <MenuItem key={1000} value={1000}>
                All time
              </MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 220 }} size="small">
            <InputLabel id="split-select-label">Split by</InputLabel>
            <Select
              labelId="split-select-label"
              value={selectedLabelGroup ?? ""}
              label="Split by"
              onChange={(e) => setSelectedLabelGroup(e.target.value as string)}
            >
              {availableGroups.map((g: string) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton
            size="small"
            href={`/api/group/${groupId}/table.svg?sprintNumber=${selectedSprint}&labelGroup=${selectedLabelGroup}`}
            aria-label="Link to SVG"
          >
            <ShareIcon />
          </IconButton>
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              {labelColumns.map((g: string) => (
                <TableCell key={g} align="right">
                  {g}
                </TableCell>
              ))}
              <TableCell align="right">Sum (hrs)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(tableData).map((memberId) => {
              const member = members.find((m) => m.id === memberId);
              return (
                <TableRow key={memberId}>
                  <TableCell>{member ? member.name : memberId}</TableCell>
                  {labelColumns.map((g: string) => (
                    <TableCell key={g} align="right">
                      {((tableData[memberId][g] || 0) / 3600).toFixed(2)}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    {((tableData[memberId]["__sum"] || 0) / 3600).toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Totals row */}
            <TableRow>
              <TableCell style={{ fontWeight: "bold" }}>Total</TableCell>
              {labelColumns.map((g: string) => (
                <TableCell key={g} align="right" style={{ fontWeight: "bold" }}>
                  {(columnSums[g] / 3600).toFixed(2)}
                </TableCell>
              ))}
              <TableCell align="right" style={{ fontWeight: "bold" }}>
                {(columnSums["__sum"] / 3600).toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel2-content"
            id="panel2-header"
          >
            <Typography component="span">Issues</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {selectedSprint !== null ? (
                Object.values(sprintIssues).map((issue) => {
                  const logged = issue.timelogs.reduce(
                    (sum, log) => sum + log.timeSpent,
                    0
                  );
                  const loggedTotal = timelogs.reduce(
                    (sum, log) =>
                      log.issueUrl === issue.url ? sum + log.timeSpent : sum,
                    0
                  );
                  const estimate = issue.timelogs[0]?.issueTimeEstimate || 0;
                  const deviationPercent =
                    estimate > 0
                      ? (((loggedTotal - estimate) / estimate) * 100).toFixed(2)
                      : "N/A";

                  return (
                    <ListItem
                      key={issue.url}
                      component="a"
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ flexDirection: "row", alignItems: "flex-start" }}
                    >
                      <ListItemText
                        primary={issue.title}
                        secondary={
                          <>
                            {`Logged in sprint: ${(logged / 3600).toFixed(
                              2
                            )} hrs | Total logged: ${(
                              loggedTotal / 3600
                            ).toFixed(2)} hrs`}
                            <br />
                            {`Estimate: ${(estimate / 3600).toFixed(
                              2
                            )} hrs | Deviation: `}
                            <span
                              style={{
                                color:
                                  deviationPercent === "N/A"
                                    ? "#000"
                                    : (() => {
                                        const deviation =
                                          Number(deviationPercent);
                                        const thresholdBad = 20;
                                        const thresholdGood = 5;
                                        let t = 0;
                                        if (
                                          Math.abs(deviation) >= thresholdBad
                                        ) {
                                          t = 1;
                                        } else if (
                                          Math.abs(deviation) <= thresholdGood
                                        ) {
                                          t = 0;
                                        } else {
                                          t =
                                            (Math.abs(deviation) -
                                              thresholdGood) /
                                            (thresholdBad - thresholdGood);
                                        }
                                        const green = { r: 56, g: 142, b: 60 };
                                        const red = { r: 211, g: 47, b: 47 };
                                        const r = Math.round(
                                          green.r + (red.r - green.r) * t
                                        );
                                        const g = Math.round(
                                          green.g + (red.g - green.g) * t
                                        );
                                        const b = Math.round(
                                          green.b + (red.b - green.b) * t
                                        );
                                        return `rgb(${r},${g},${b})`;
                                      })(),
                                fontWeight: "bold",
                              }}
                            >
                              {deviationPercent}%
                            </span>
                          </>
                        }
                      />
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          mt: 0.5,
                        }}
                      >
                        {(issue.timelogs[0]?.issueLabels || []).map((label) => (
                          <Label
                            key={label}
                            name={label}
                            color={
                              Object.values(labels || {})
                                .flat()
                                .find((l) => l.id === label)?.color || "#428fdc"
                            }
                          />
                        ))}
                      </Box>
                    </ListItem>
                  );
                })
              ) : (
                <ListItem>
                  <ListItemText primary="No sprint selected" />
                </ListItem>
              )}
            </List>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
}
